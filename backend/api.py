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
import sys
import tempfile
import traceback
from pathlib import Path
from typing import Optional

# ── stdout encoding fix for Windows ───────────────────────────────────────
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import dotenv
dotenv.load_dotenv()

import numpy as np
import pandas as pd
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

# ── ensure repo root is on sys.path ───────────────────────────────────────
ROOT = Path(__file__).resolve().parent.parent
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
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:4173",
        "https://unbiased-ai-demo.web.app",
        "https://unbiased-ai-demo.firebaseapp.com",
    ] + _extra_origins,
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
async def analyze_dataset(file: UploadFile = File(...)):
    contents = await file.read()
    tmp_path = _tmp_file(file, contents)
    try:
        result = run_dataset_pipeline(tmp_path)
        return safe_json(result)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
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
async def gemini_report(payload: dict):
    try:
        text = run_gemini_report(
            payload.get("bias_report", {}),
            payload.get("model_bias_report", {}),
        )
        return {"report_text": text}
    except EnvironmentError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gemini API error: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.api:app", host="0.0.0.0", port=8001, reload=True)
