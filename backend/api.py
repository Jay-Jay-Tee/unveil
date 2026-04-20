"""
UnbiasedAI — backend/api.py
FastAPI server that wires together M1, M2, M3 into a single HTTP API
consumed by the React frontend.

Routes:
  GET  /health
  POST /analyze/dataset   — M1 + M2: ingest CSV → classify columns → bias report
  POST /analyze/model     — M3: probe + SHAP → model bias report
  POST /report/gemini     — call Gemini to generate plain-English narrative

Run:
  cd <repo-root>
  uvicorn backend.api:app --reload --port 8001

CORS is open for localhost:5173 (Vite dev) and the Firebase domain.
Set GEMINI_API_KEY env var before running.
"""

import io
import json
import os
import sys
import tempfile
import traceback
from pathlib import Path
from typing import Any, Optional

import numpy as np
import pandas as pd
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── make sure backend/ modules are importable ──────────────────────────────
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "backend"))

from backend.ingestor import ingest
from backend.counterfactual_engine import run_counterfactuals
from backend.gemini_classifier import classify
from backend.proxy_detection import detect as detect_proxies
from backend.stats import build_bias_report
from backend.probe_generator import ProbeGenerator
from backend.shap_explainer import SHAPExplainer

# ── app setup ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="UnbiasedAI API",
    description="Bias detection API — Part A (dataset) + Part B (model)",
    version="1.0.0",
)

# Extra origins can be added via CORS_ORIGINS env var (comma-separated).
# Useful when deploying backend to Cloud Run or any URL not in the default list.
# e.g. export CORS_ORIGINS="https://my-cloudrun-url.run.app"
_extra_origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]
_allowed_origins = [
    "http://localhost:5173",
    "http://localhost:4173",
    "https://unbiased-ai-demo.web.app",
    "https://unbiased-ai-demo.firebaseapp.com",
] + _extra_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── in-memory model store (loaded via /analyze/model upload) ───────────────
_loaded_model = None
_loaded_X_background: Optional[pd.DataFrame] = None


# ── helpers ────────────────────────────────────────────────────────────────

def _flatten_schema_map(schema_map: dict) -> list[dict]:
    """
    Convert the nested bucket format from gemini_classifier into a flat list
    matching the mockSchemaMap shape the frontend expects:
      [{ name, type, proxies }]
    """
    flat = []
    for bucket, label in [
        ("protected", "PROTECTED"),
        ("outcome", "OUTCOME"),
        ("ambiguous", "AMBIGUOUS"),
        ("neutral", "NEUTRAL"),
    ]:
        for entry in schema_map.get("columns", {}).get(bucket, []):
            flat.append({
                "name": entry["name"],
                "type": label,
                "proxies": entry.get("proxies", []),
            })
    return flat


def _infer_positive_label(series):
    unique = series.dropna().unique()
    if set(map(str, unique)).issubset({"0", "1", "0.0", "1.0"}):
        return 1
    positive_tokens = {">50k", "yes", "y", "true", "1", "approved", "hired", "high", "positive"}
    for val in unique:
        if str(val).strip().lower() in positive_tokens:
            return val
    counts = series.value_counts()
    return counts.index[-1] if len(counts) > 1 else unique[0]


def _safe_json(obj):
    """Recursively convert numpy scalars to native Python types."""
    if isinstance(obj, dict):
        return {k: _safe_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_safe_json(v) for v in obj]
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return float(obj)
    if isinstance(obj, (np.bool_,)):
        return bool(obj)
    if isinstance(obj, float) and (np.isnan(obj) or np.isinf(obj)):
        return None
    return obj


# ── routes ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_loaded": _loaded_model is not None,
        "gemini_key_set": bool(os.environ.get("GEMINI_API_KEY")),
    }


@app.post("/analyze/dataset")
async def analyze_dataset(file: UploadFile = File(...)):
    """
    Part A pipeline:
      1. Save upload to temp file
      2. ingestor.ingest() → DataFrame + column_meta
      3. gemini_classifier.classify() → schema_map (PROTECTED/OUTCOME/NEUTRAL/AMBIGUOUS)
      4. proxy_detection.detect_proxies() → proxy_flags
      5. stats.build_bias_report() → bias_report

    Returns JSON matching the mockSchemaMap + mockBiasReport shape the frontend expects.
    """
    # Save upload to a temp file so ingestor can read it by path
    suffix = Path(file.filename or "upload.csv").suffix or ".csv"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        contents = await file.read()
        tmp.write(contents)
        tmp.flush()
        tmp_path = tmp.name
    finally:
        tmp.close()

    try:
        # ── M1: ingest ────────────────────────────────────
        ingest_result = ingest(tmp_path, max_rows=5000)
        df = ingest_result["df"]

        # ── M1: Gemini classify ───────────────────────────
        schema_map_dir = tempfile.mkdtemp()
        schema_map = classify(
            ingest_result,
            output_path=os.path.join(schema_map_dir, "schema_map.json"),
        )

        # ── M1: proxy detection ───────────────────────────
        proxy_flags = detect_proxies(
            ingest_result,
            schema_map,
            output_path=os.path.join(schema_map_dir, "proxy_flags.json"),
        )

        # ── M2: bias stats ────────────────────────────────
        outcome_cols = schema_map.get("columns", {}).get("outcome", [])
        label_col = outcome_cols[0]["name"] if outcome_cols else None

        if label_col is None or label_col not in df.columns:
            raise HTTPException(
                status_code=422,
                detail="Could not identify an outcome column. Make sure your dataset has a label column.",
            )

        bias_report = build_bias_report(
            df,
            schema_map,
            label_column=label_col,
            proxy_flags=proxy_flags,
            output_path=os.path.join(schema_map_dir, "bias_report.json"),
            positive_label=_infer_positive_label(df[label_col]),
        )

        # ── M2: counterfactual probing ────────────────────
        protected_cols_for_cf = [
            c["name"] for c in schema_map.get("columns", {}).get("protected", [])
            if c["name"] in df.columns
        ]
        try:
            counterfactual_results = run_counterfactuals(
                df,
                protected_cols_for_cf,
                outcome_column=label_col,
                positive_label=_infer_positive_label(df[label_col]),
                proxy_flags=proxy_flags,
                sample_size=250,
            )
            cf_lookup = {r["name"]: r for r in counterfactual_results}
            for col_result in bias_report.get("column_results", []):
                cf = cf_lookup.get(col_result["name"], {})
                col_result["counterfactual"] = {
                    "mean_shift": cf.get("mean_shift"),
                    "mean_abs_shift": cf.get("mean_abs_shift"),
                    "n_pairs": cf.get("n_pairs"),
                    "status": cf.get("status"),
                }
        except Exception as cf_err:
            print(f"  [counterfactual] Failed: {cf_err} — continuing without CF results")

        # ── flatten schema for frontend ───────────────────
        flat_columns = _flatten_schema_map(schema_map)

        return _safe_json({
            "schema_map": {"columns": flat_columns},
            "proxy_flags": proxy_flags,
            "bias_report": bias_report,
            "dataset_name": ingest_result["dataset_name"],
            "row_count": ingest_result["row_count"],
            "column_count": ingest_result["column_count"],
            "warnings": ingest_result["warnings"],
        })

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
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
    """
    Part B pipeline:
      1. Load dataset + schema from Part A results
      2. Load model pickle (optional — uses stub if not provided)
      3. ProbeGenerator → probe_results
      4. SHAPExplainer → shap_summary (if model provided)
      5. Return model_bias_report shape

    schema_map_json and proxy_flags_json are the JSON strings returned by /analyze/dataset.
    """
    global _loaded_model, _loaded_X_background

    # ── parse schema inputs ───────────────────────────────
    try:
        schema_map = json.loads(schema_map_json)
        proxy_flags = json.loads(proxy_flags_json)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=422, detail=f"Invalid JSON in schema inputs: {e}")

    # ── save dataset to temp file ─────────────────────────
    ds_suffix = Path(dataset.filename or "upload.csv").suffix or ".csv"
    ds_tmp = tempfile.NamedTemporaryFile(delete=False, suffix=ds_suffix)
    try:
        ds_contents = await dataset.read()
        ds_tmp.write(ds_contents)
        ds_tmp.flush()
        ds_path = ds_tmp.name
    finally:
        ds_tmp.close()

    model_tmp_path = None
    try:
        # ── ingest dataset ────────────────────────────────
        ingest_result = ingest(ds_path, max_rows=5000)
        df = ingest_result["df"]

        # ── rebuild schema_map in bucket format ───────────
        # Frontend sends flat columns list; rebuild bucket format for ProbeGenerator
        if isinstance(schema_map.get("columns"), list):
            # flat format from frontend
            buckets: dict[str, list] = {"protected": [], "outcome": [], "ambiguous": [], "neutral": []}
            for col in schema_map["columns"]:
                t = col.get("type", "NEUTRAL").lower()
                buckets[t].append(col)
            schema_map_bucketed = {"columns": buckets}
        else:
            schema_map_bucketed = schema_map

        protected_cols = [c["name"] for c in schema_map_bucketed.get("columns", {}).get("protected", [])]
        proxy_col_names = list({e["column"] for e in proxy_flags.get("proxy_columns", [])})
        outcome_cols = [c["name"] for c in schema_map_bucketed.get("columns", {}).get("outcome", [])]

        # Drop outcome from feature rows
        feature_df = df.drop(columns=[c for c in outcome_cols if c in df.columns], errors="ignore")
        sample_data = feature_df.sample(min(200, len(feature_df)), random_state=42).to_dict(orient="records")

        # ── load model if provided ────────────────────────
        import pickle
        if model is not None:
            model_contents = await model.read()
            model_tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pkl")
            model_tmp.write(model_contents)
            model_tmp.flush()
            model_tmp_path = model_tmp.name
            model_tmp.close()
            with open(model_tmp_path, "rb") as f:
                _loaded_model = pickle.load(f)
            _loaded_X_background = feature_df.head(200)

        # ── ProbeGenerator ────────────────────────────────
        if not protected_cols:
            raise HTTPException(status_code=422, detail="No PROTECTED columns found in schema_map.")

        # Use /predict on this same server as a black-box endpoint
        generator = ProbeGenerator(model_endpoint="http://localhost:8001/predict")
        probe_results = generator.run(
            protected_columns=protected_cols,
            sample_data=sample_data,
            n_probes=n_probes,
        )

        # ── SHAPExplainer (only if model loaded) ──────────
        shap_summary = []
        shap_rank_lookup = {}

        if _loaded_model is not None:
            try:
                X_bg = _loaded_X_background.copy() if _loaded_X_background is not None else feature_df.head(200)
                # Label-encode object columns for SHAP
                X_bg_enc = X_bg.apply(
                    lambda col: col.astype("category").cat.codes if col.dtype == object else col
                )
                explainer = SHAPExplainer(_loaded_model, X_background=X_bg_enc, model_type="auto")
                X_test_enc = pd.DataFrame(sample_data).apply(
                    lambda col: col.astype("category").cat.codes if col.dtype == object else col
                )
                explainer.explain(
                    X_test_enc,
                    protected_columns=protected_cols,
                    proxy_columns=proxy_col_names,
                )
                shap_summary = explainer.get_summary_for_m4()
                shap_rank_lookup = {e["feature"]: e["shap_rank"] for e in shap_summary}
            except Exception as e:
                print(f"  [SHAP] Failed: {e} — returning without SHAP ranks")

        # ── merge results ─────────────────────────────────
        attribute_results = []
        for probe in probe_results:
            col_name = probe["name"]
            attribute_results.append({
                "name": col_name,
                "mean_diff": probe.get("mean_diff"),
                "p_value": probe.get("p_value"),
                "shap_rank": shap_rank_lookup.get(col_name),
                "verdict": probe.get("verdict", "SKIPPED"),
            })

        return _safe_json({
            "attribute_results": attribute_results,
            "shap_summary": shap_summary,
        })

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        os.unlink(ds_path)
        if model_tmp_path and os.path.exists(model_tmp_path):
            os.unlink(model_tmp_path)


@app.post("/predict")
def predict(request: dict):
    """
    Black-box predict endpoint — used by ProbeGenerator internally.
    Uses loaded model if available, else a deterministic stub.
    """
    features = request.get("features", {})

    if _loaded_model is not None:
        try:
            row = pd.DataFrame([features])
            if hasattr(_loaded_model, "feature_names_in_"):
                for col in _loaded_model.feature_names_in_:
                    if col not in row.columns:
                        row[col] = 0
                row = row[_loaded_model.feature_names_in_]
            if hasattr(_loaded_model, "predict_proba"):
                prob = float(_loaded_model.predict_proba(row)[0][1])
            else:
                prob = float(_loaded_model.predict(row)[0])
            return {"prediction": int(prob >= 0.5), "probability": round(prob, 4)}
        except Exception as e:
            print(f"  [predict] model error ({e}), falling back to stub")

    # Deterministic stub — varies by feature content so probes see realistic variance
    seed = abs(hash(str(sorted(str(features).split())))) % 10000
    rng = np.random.default_rng(seed)
    prob = float(rng.uniform(0.2, 0.85))
    return {"prediction": int(prob >= 0.5), "probability": round(prob, 4)}


@app.post("/report/gemini")
async def gemini_report(payload: dict):
    """
    Accepts { bias_report, model_bias_report } and calls Gemini to generate
    a plain-English compliance narrative.

    Returns { report_text: str }
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="GEMINI_API_KEY not set on the server. Set it and restart.",
        )

    bias_report = payload.get("bias_report", {})
    model_bias_report = payload.get("model_bias_report", {})

    prompt = f"""You are a bias compliance officer writing an audit report for a non-technical compliance team. Write in plain English, no jargon. Structure your response in exactly 4 sections:

1. EXECUTIVE SUMMARY (3 sentences maximum)
2. CRITICAL FINDINGS (one paragraph per biased attribute)
3. PROXY RISK ANALYSIS (explain which features act as proxies and why this matters)
4. RECOMMENDATIONS (3 bullet points)

Dataset Bias Report:
{json.dumps(bias_report, indent=2)}

Model Behavior Report:
{json.dumps(model_bias_report, indent=2)}

The legal threshold for disparate impact is 0.8. Any score below this fails the 80% rule."""

    import urllib.request
    req_body = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 1024},
    }).encode()

    req = urllib.request.Request(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}",
        data=req_body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        return {"report_text": text}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gemini API error: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.api:app", host="0.0.0.0", port=8001, reload=True)  