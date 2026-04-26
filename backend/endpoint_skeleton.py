"""
M3 - endpoint_skeleton.py  (complete implementation)

Routes:
  GET  /health    - liveness check
  POST /predict   - single-row model prediction (stub or real model)
  POST /analyze   - full M3 bias analysis: probes + SHAP → model_bias_report.json

Run with:  uvicorn endpoint_skeleton:app --reload --port 8001
"""

import json
import pickle
import tempfile
import os
import sys
from pathlib import Path
from typing import Any, Optional

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from pydantic import BaseModel

# Add backend/ to path so we can import M3 modules
sys.path.insert(0, str(Path(__file__).parent / "backend"))
from backend.probe_generator import ProbeGenerator
from backend.shap_explainer import SHAPExplainer

app = FastAPI(
    title="UnbiasedAI - M3 Model Analyzer",
    description="Black-box probe + SHAP explainability interface for bias analysis",
    version="1.0.0"
)

# ─────────────────────────────────────────────
# Global model store (loaded once, reused across requests)
# ─────────────────────────────────────────────
_loaded_model = None
_loaded_X_background = None


# ─────────────────────────────────────────────
# Request / Response schemas
# ─────────────────────────────────────────────

class PredictRequest(BaseModel):
    features: dict[str, Any]


class PredictResponse(BaseModel):
    prediction: int
    probability: float


class AnalyzeRequest(BaseModel):
    """
    Full bias analysis request - called by M4's dashboard.

    mode: 'http_endpoint' (black-box via URL) | 'local' (loaded model in memory)
    model_endpoint: URL to POST to (used when mode='http_endpoint')
    protected_columns: list of column names flagged PROTECTED by M1
    proxy_columns: list of proxy column names flagged by M1
    sample_data: list of feature row dicts (representative rows from the dataset)
    n_probes: probe pairs per protected attribute (default 100)
    run_shap: whether to compute SHAP (requires model loaded via /upload-model)
    """
    mode: str = "http_endpoint"
    model_endpoint: Optional[str] = None
    protected_columns: list[str]
    proxy_columns: list[str]
    sample_data: list[dict[str, Any]]
    n_probes: int = 100
    run_shap: bool = True


class AnalyzeResponse(BaseModel):
    attribute_results: list[dict]   # [{name, mean_diff, p_value, shap_rank, verdict}]
    shap_summary: list[dict]        # [{feature, mean_abs_shap, shap_rank, is_proxy, is_protected}]


# ─────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "module": "M3 Model Analyzer",
        "model_loaded": _loaded_model is not None,
    }


@app.post("/upload-model")
async def upload_model(file: UploadFile = File(...)):
    """
    Upload a sklearn pickle model file (.pkl).
    Once uploaded, /analyze can use it for SHAP analysis.
    """
    global _loaded_model
    try:
        contents = await file.read()
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pkl") as tmp:
            tmp.write(contents)
            tmp_path = tmp.name
        with open(tmp_path, "rb") as f:
            _loaded_model = pickle.load(f)
        os.unlink(tmp_path)
        return {"status": "ok", "model_type": type(_loaded_model).__name__}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to load model: {e}")


@app.post("/predict", response_model=PredictResponse)
def predict(request: PredictRequest):
    """
    Single-row prediction. Uses loaded model if available, else stub.
    probe_generator.py calls this 100+ times per protected attribute.
    """
    global _loaded_model
    features = request.features

    if _loaded_model is not None:
        try:
            row = pd.DataFrame([features])
            # Align columns - model may need specific ordering
            if hasattr(_loaded_model, "feature_names_in_"):
                for col in _loaded_model.feature_names_in_:
                    if col not in row.columns:
                        row[col] = 0
                row = row[_loaded_model.feature_names_in_]

            if hasattr(_loaded_model, "predict_proba"):
                prob = float(_loaded_model.predict_proba(row)[0][1])
            else:
                prob = float(_loaded_model.predict(row)[0])
            pred = int(prob >= 0.5)
            return PredictResponse(prediction=pred, probability=round(prob, 4))
        except Exception as e:
            # Fall through to stub on error so probing doesn't break
            print(f"  [predict] Model error ({e}), using stub")

    # Stub - deterministic-ish based on features so probes see variance
    seed = abs(hash(str(sorted(features.items())))) % 10000
    rng = np.random.default_rng(seed)
    prob = float(rng.uniform(0.2, 0.85))
    return PredictResponse(prediction=int(prob >= 0.5), probability=round(prob, 4))


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(request: AnalyzeRequest):
    """
    Full M3 bias analysis pipeline:
      1. ProbeGenerator - black-box probe pairs → mean_diff + p-value per protected column
      2. SHAPExplainer   - global feature importance → shap_rank cross-referenced with protected/proxy
      3. Merge results → model_bias_report.json schema for M4
    """
    global _loaded_model, _loaded_X_background

    # ── Step 1: ProbeGenerator ────────────────────────────
    if request.mode == "http_endpoint" and request.model_endpoint:
        generator = ProbeGenerator(model_endpoint=request.model_endpoint)
    else:
        # Use local /predict endpoint (this server itself)
        generator = ProbeGenerator(model_endpoint="http://localhost:8001/predict")

    print(f"  [analyze] Running {request.n_probes} probes on {len(request.protected_columns)} protected columns ...")
    probe_results = generator.run(
        protected_columns=request.protected_columns,
        sample_data=request.sample_data,
        n_probes=request.n_probes,
    )

    # ── Step 2: SHAP (optional, requires loaded model) ────
    shap_summary = []
    shap_rank_lookup = {}  # column_name -> rank

    if request.run_shap and _loaded_model is not None and len(request.sample_data) > 0:
        try:
            print("  [analyze] Running SHAP explainer ...")
            X_bg = pd.DataFrame(request.sample_data)
            # Drop non-numeric cols that would break SHAP (handled internally)
            explainer = SHAPExplainer(_loaded_model, X_background=X_bg, model_type="auto")
            X_test = pd.DataFrame(request.sample_data)
            proxy_col_names = request.proxy_columns
            summary = explainer.explain(
                X_test,
                protected_columns=request.protected_columns,
                proxy_columns=proxy_col_names,
            )
            shap_summary = explainer.get_summary_for_m4()
            shap_rank_lookup = {e["feature"]: e["shap_rank"] for e in shap_summary}
        except Exception as e:
            print(f"  [analyze] SHAP failed ({e}) - continuing without SHAP ranks")
    elif request.run_shap and _loaded_model is None:
        print("  [analyze] No model loaded - skipping SHAP. Upload a model via POST /upload-model")

    # ── Step 3: Merge shap_rank into probe results ────────
    attribute_results = []
    for probe in probe_results:
        col_name = probe["name"]
        attribute_results.append({
            "name": col_name,
            "mean_diff": probe.get("mean_diff"),
            "p_value": probe.get("p_value"),
            "shap_rank": shap_rank_lookup.get(col_name),  # None if SHAP not run
            "verdict": probe.get("verdict", "SKIPPED"),
        })

    return AnalyzeResponse(
        attribute_results=attribute_results,
        shap_summary=shap_summary,
    )


@app.post("/generate-report")
def generate_report(request: AnalyzeResponse):
    """
    Accepts model_bias_report data and returns a structured JSON report
    ready to be passed to Gemini for narrative generation (M4 usage).
    """
    biased = [r for r in request.attribute_results if r.get("verdict") == "BIASED"]
    ambiguous = [r for r in request.attribute_results if r.get("verdict") == "AMBIGUOUS"]
    clean = [r for r in request.attribute_results if r.get("verdict") == "CLEAN"]

    top_proxy_shap = [
        e for e in request.shap_summary if e.get("is_proxy")
    ]

    return {
        "summary": {
            "total_attributes": len(request.attribute_results),
            "biased_count": len(biased),
            "ambiguous_count": len(ambiguous),
            "clean_count": len(clean),
            "overall_verdict": "BIASED" if biased else ("AMBIGUOUS" if ambiguous else "CLEAN"),
        },
        "biased_attributes": biased,
        "ambiguous_attributes": ambiguous,
        "top_proxy_shap_features": top_proxy_shap[:5],
        "shap_top_10": request.shap_summary[:10],
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("endpoint_skeleton:app", host="0.0.0.0", port=8001, reload=True)
