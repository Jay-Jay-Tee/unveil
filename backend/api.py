"""
backend/api.py
FastAPI routing layer for UnbiasedAI.

This file owns only HTTP concerns: request parsing, response shaping,
error mapping, and CORS. All business logic lives in pipeline.py.

Run:
  uvicorn backend.api:app --reload --port 8001
"""

import io
import json
import os
import re
import sys
import tempfile
import traceback
from pathlib import Path
from typing import Optional

# ── resolve repo root early so env loading is cwd-independent ─────────────
ROOT = Path(__file__).resolve().parent.parent

# ── stdout encoding fix for Windows ───────────────────────────────────────
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import dotenv
dotenv.load_dotenv(dotenv_path=ROOT / ".env")

import numpy as np
import pandas as pd
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi import status
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials, get_app, initialize_app

# ── ensure repo root is on sys.path ───────────────────────────────────────
sys.path.insert(0, str(ROOT))

from backend.pipeline import (
    run_dataset_pipeline,
    run_model_pipeline,
    run_gemini_report,
    make_model_fn,
    stub_predict,
    get_cached_model,
    safe_json,
)

# ── app ────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="UnbiasedAI API",
    description="Bias detection API — Part A (dataset) + Part B (model)",
    version="1.0.0",
)

_extra_origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]
AUTH_REQUIRED = os.environ.get("AUTH_REQUIRED", "true").strip().lower() != "false"
ALLOW_LOCALHOST_CORS = os.environ.get("ALLOW_LOCALHOST_CORS", "true").strip().lower() != "false"
_firebase_admin_inited = False


def _init_firebase_admin() -> None:
    """Initialize Firebase Admin SDK once so ID tokens can be verified."""
    global _firebase_admin_inited
    if _firebase_admin_inited:
        return

    try:
        get_app()
        _firebase_admin_inited = True
        return
    except ValueError:
        pass

    service_account_path = os.environ.get("FIREBASE_SERVICE_ACCOUNT_PATH", "").strip()
    if service_account_path:
        initialize_app(credentials.Certificate(service_account_path))
    else:
        initialize_app()
    _firebase_admin_inited = True


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:4173",
        "https://unbiased-ai-demo.web.app",
        "https://unbiased-ai-demo.firebaseapp.com",
    ] + _extra_origins,
    allow_origin_regex=(r"https?://(localhost|127\.0\.0\.1)(:\d+)?$" if ALLOW_LOCALHOST_CORS else None),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── helpers ────────────────────────────────────────────────────────────────

def _tmp_file(upload: UploadFile, contents: bytes) -> str:
    """Write upload bytes to a named temp file and return its path."""
    suffix = Path(upload.filename or "upload").suffix or ".csv"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        tmp.write(contents)
        tmp.flush()
    finally:
        tmp.close()
    return tmp.name


def _http_error(exc: Exception, status: int = 500) -> HTTPException:
    traceback.print_exc()
    return HTTPException(status_code=status, detail=str(exc))


def _extract_retry_after_seconds(exc: Exception) -> Optional[int]:
    text = f"{type(exc).__name__}: {exc}".lower()
    match = re.search(r"retry(?:\s+in|delay)?[^0-9]*(\d+(?:\.\d+)?)\s*s", text)
    if not match:
        return None
    try:
        return max(1, int(round(float(match.group(1)))))
    except ValueError:
        return None


def _is_gemini_overloaded_error(exc: Exception) -> bool:
    """Detect transient Gemini capacity errors (HTTP 503 / UNAVAILABLE)."""
    text = f"{type(exc).__name__}: {exc}".lower()
    return (
        "503" in text
        and (
            "unavailable" in text
            or "high demand" in text
            or "resource_exhausted" in text
            or "overloaded" in text
        )
    )


def _is_gemini_quota_error(exc: Exception) -> bool:
    """Detect Gemini 429 quota/rate-limit errors."""
    text = f"{type(exc).__name__}: {exc}".lower()
    return (
        "429" in text
        and (
            "resource_exhausted" in text
            or "quota" in text
            or "rate limit" in text
            or "generate_content_free_tier_requests" in text
        )
    )


def _gemini_overloaded_detail(action: str) -> dict:
    return {
        "code": "GEMINI_OVERLOADED",
        "message": (
            f"Gemini is experiencing high demand and could not {action} right now. "
            "Please retry in 30-60 seconds."
        ),
        "retryable": True,
    }


def _gemini_quota_detail(action: str, exc: Exception) -> dict:
    retry_after = _extract_retry_after_seconds(exc)
    message = (
        f"Gemini quota or rate limits were exceeded and could not {action} right now. "
        "Please wait and try again."
    )
    if retry_after is not None:
        message += f" Retry in about {retry_after} seconds."
    message += " If this keeps happening, reduce repeat requests or enable billing/upgrade your Gemini plan."
    detail = {
        "code": "GEMINI_QUOTA_EXCEEDED",
        "message": message,
        "retryable": True,
    }
    if retry_after is not None:
        detail["retry_after_seconds"] = retry_after
    return detail


def _extract_bearer_token(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    value = authorization.strip()
    if not value:
        return None
    if not value.lower().startswith("bearer "):
        return None
    token = value[7:].strip()
    return token or None


def require_authenticated_user(
    authorization: Optional[str] = Header(default=None),
) -> dict:
    if not AUTH_REQUIRED:
        return {"uid": "anonymous", "auth_disabled": True}

    token = _extract_bearer_token(authorization)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "AUTH_REQUIRED",
                "message": "Sign in with Firebase to use this endpoint.",
                "retryable": False,
            },
        )

    try:
        _init_firebase_admin()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "AUTH_CONFIG_ERROR",
                "message": "Server authentication is not configured correctly.",
                "retryable": False,
            },
        )

    try:
        return firebase_auth.verify_id_token(token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "AUTH_INVALID_TOKEN",
                "message": "Your session is invalid or expired. Please sign in again.",
                "retryable": False,
            },
        )


# ── routes ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    model = get_cached_model()
    return {
        "status":          "ok",
        "model_loaded":    model is not None,
        "gemini_key_set":  bool(os.environ.get("GEMINI_API_KEY")),
    }


@app.post("/analyze/dataset")
async def analyze_dataset(
    file: UploadFile = File(...),
    _claims: dict = Depends(require_authenticated_user),
):
    contents = await file.read()
    tmp_path = _tmp_file(file, contents)
    try:
        result = run_dataset_pipeline(tmp_path)
        return safe_json(result)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        if _is_gemini_quota_error(e):
            raise HTTPException(
                status_code=429,
                detail=_gemini_quota_detail("classify dataset columns", e),
            )
        if _is_gemini_overloaded_error(e):
            raise HTTPException(
                status_code=503,
                detail=_gemini_overloaded_detail("classify dataset columns"),
            )
        raise _http_error(e)
    finally:
        os.unlink(tmp_path)


@app.post("/analyze/model")
async def analyze_model(
    dataset: UploadFile = File(...),
    model: Optional[UploadFile] = File(None),
    schema_map_json: str = Form(...),
    proxy_flags_json: str = Form(...),
    n_probes: int = Form(100),
    _claims: dict = Depends(require_authenticated_user),
):
    try:
        schema_map  = json.loads(schema_map_json)
        proxy_flags = json.loads(proxy_flags_json)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=422, detail=f"Invalid JSON in schema inputs: {e}")

    ds_path    = _tmp_file(dataset, await dataset.read())
    model_path = _tmp_file(model,   await model.read()) if model else None

    try:
        result = run_model_pipeline(
            dataset_path=ds_path,
            schema_map=schema_map,
            proxy_flags=proxy_flags,
            model_path=model_path,
            n_probes=n_probes,
        )
        return safe_json(result)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise _http_error(e)
    finally:
        os.unlink(ds_path)
        if model_path and os.path.exists(model_path):
            os.unlink(model_path)


@app.post("/predict")
def predict(request: dict):
    """
    Black-box predict endpoint for external callers
    (endpoint_skeleton.py, generate_model_bias_report.py).
    Uses the last model loaded by /analyze/model, or a deterministic stub.
    Note: ProbeGenerator inside /analyze/model uses model_fn directly
    to avoid a self-call deadlock on this endpoint.
    """
    features = request.get("features", {})
    model = get_cached_model()

    if model is not None:
        predict_fn = make_model_fn(model)
        prob = predict_fn(features)
    else:
        prob = stub_predict(features)

    return {"prediction": int(prob >= 0.5), "probability": round(prob, 4)}


@app.post("/report/gemini")
async def gemini_report(
    payload: dict,
    _claims: dict = Depends(require_authenticated_user),
):
    try:
        text = run_gemini_report(
            payload.get("bias_report", {}),
            payload.get("model_bias_report", {}),
            force_refresh=bool(payload.get("force_refresh", False)),
        )
        return {"report_text": text}
    except EnvironmentError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        if _is_gemini_quota_error(e):
            raise HTTPException(
                status_code=429,
                detail=_gemini_quota_detail("generate the compliance report", e),
            )
        if _is_gemini_overloaded_error(e):
            raise HTTPException(
                status_code=503,
                detail=_gemini_overloaded_detail("generate the compliance report"),
            )
        raise HTTPException(status_code=502, detail=f"Gemini API error: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.api:app", host="0.0.0.0", port=8001, reload=True)
