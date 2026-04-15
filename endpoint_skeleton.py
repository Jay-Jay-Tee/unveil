"""
M3 — Day 1: FastAPI Endpoint Skeleton
This is the HTTP interface your probe_generator.py will POST to on Day 3.
Two modes:
  - /predict  → accepts a feature row, returns model prediction (simulated)
  - /analyze  → (Day 5) full bias analysis endpoint that M4 will call

Run with:  uvicorn endpoint_skeleton:app --reload --port 8001
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Any, Optional
import numpy as np

app = FastAPI(
    title="UnbiasedAI — M3 Model Analyzer",
    description="Black-box probe interface for bias analysis",
    version="0.1.0"
)


# ─────────────────────────────────────────────
# Request / Response schemas
# ─────────────────────────────────────────────

class PredictRequest(BaseModel):
    """
    A single feature row sent by the probe generator.
    features: dict of column_name -> value
    """
    features: dict[str, Any]


class PredictResponse(BaseModel):
    """
    Model prediction response.
    prediction: 0 or 1 (binary outcome)
    probability: confidence score [0.0, 1.0]
    """
    prediction: int
    probability: float


class AnalyzeRequest(BaseModel):
    """
    Full bias analysis request (used on Day 5 by M4).
    protected_columns: list of column names flagged PROTECTED by M1
    proxy_columns: list of proxy column names flagged by M1
    n_probes: number of probe pairs to run per attribute (default 100)
    model_type: 'sklearn_pickle' | 'http_endpoint' | 'auto'
    model_path: path to pickle file (if white-box)
    model_endpoint: URL to POST predictions to (if black-box)
    sample_data: list of feature rows used to build realistic probes
    """
    protected_columns: list[str]
    proxy_columns: list[str]
    n_probes: int = 100
    model_type: str = "http_endpoint"
    model_path: Optional[str] = None
    model_endpoint: Optional[str] = None
    sample_data: list[dict[str, Any]] = []


class AnalyzeResponse(BaseModel):
    """
    Maps directly to model_bias_report.json — the contract with M4.
    """
    attribute_results: list[dict]   # [{name, mean_diff, p_value, shap_rank, verdict}]
    shap_summary: list[dict]        # [{feature, mean_abs_shap, is_proxy}]


# ─────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────

@app.get("/health")
def health_check():
    """Quick check that the server is running."""
    return {"status": "ok", "module": "M3 Model Analyzer"}


@app.post("/predict", response_model=PredictResponse)
def predict(request: PredictRequest):
    """
    Simulated model prediction endpoint.
    On Day 3 you'll replace the stub logic here with a real loaded model.
    The probe_generator.py will call this 100+ times per protected attribute.
    """
    features = request.features

    # ── STUB: replace this with your actual model.predict() call on Day 3 ──
    # Example real implementation (Day 3):
    #
    #   import pickle
    #   model = pickle.load(open("model.pkl", "rb"))
    #   row = pd.DataFrame([features])
    #   prob = model.predict_proba(row)[0][1]
    #   pred = int(prob >= 0.5)
    #   return PredictResponse(prediction=pred, probability=prob)
    #
    prob = float(np.random.uniform(0.3, 0.8))   # stub — random for now
    pred = int(prob >= 0.5)
    return PredictResponse(prediction=pred, probability=round(prob, 4))


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(request: AnalyzeRequest):
    """
    Full bias analysis endpoint — called by M4's dashboard on Day 7+.
    On Day 1 this returns a stub. You'll wire in probe_generator.py + shap_explainer.py here.
    """
    # ── STUB: wire in your real modules here on Day 5 ──
    # Real flow (Day 5+):
    #
    #   from probe_generator import ProbeGenerator
    #   from shap_explainer import SHAPExplainer
    #
    #   generator = ProbeGenerator(model_endpoint=request.model_endpoint)
    #   probe_results = generator.run(
    #       protected_columns=request.protected_columns,
    #       sample_data=request.sample_data,
    #       n_probes=request.n_probes
    #   )
    #   shap_results = SHAPExplainer(...).explain()
    #   return AnalyzeResponse(attribute_results=probe_results, shap_summary=shap_results)

    stub_response = AnalyzeResponse(
        attribute_results=[
            {
                "name": col,
                "mean_diff": round(float(np.random.uniform(0.05, 0.25)), 3),
                "p_value": round(float(np.random.uniform(0.001, 0.05)), 4),
                "shap_rank": i + 1,
                "verdict": "BIASED"
            }
            for i, col in enumerate(request.protected_columns)
        ],
        shap_summary=[
            {"feature": col, "mean_abs_shap": round(float(np.random.uniform(0.1, 0.4)), 3), "is_proxy": False}
            for col in request.protected_columns
        ] + [
            {"feature": col, "mean_abs_shap": round(float(np.random.uniform(0.05, 0.2)), 3), "is_proxy": True}
            for col in request.proxy_columns
        ]
    )
    return stub_response


# ─────────────────────────────────────────────
# Run directly for testing
# ─────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("endpoint_skeleton:app", host="0.0.0.0", port=8001, reload=True)