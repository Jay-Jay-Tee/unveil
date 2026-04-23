"""
backend/pipeline.py
Business logic for the UnbiasedAI API.

Each public function maps 1-to-1 with an API route and returns a plain dict.
No FastAPI types live here — keeping this import-free from the web layer makes
it independently testable and reusable from CLI scripts.
"""

import json
import os
import pickle
import tempfile
import traceback
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
from sklearn.preprocessing import LabelEncoder

from backend.ingestor import ingest
from backend.gemini_classifier import classify
from backend.proxy_detection import detect as detect_proxies
from backend.counterfactual_engine import run_counterfactuals
from backend.stats import build_bias_report
from backend.probe_generator import ProbeGenerator
from backend.shap_explainer import SHAPExplainer

ROOT = Path(__file__).resolve().parent.parent
DEMO_MODEL_PATH = ROOT / "backend" / "demo_model.pkl"

# ── module-level model cache ───────────────────────────────────────────────
# Holds the last model loaded by run_model_pipeline so the /predict endpoint
# in api.py can serve external callers (endpoint_skeleton, generate_model_bias_report).
_cached_model = None


def get_cached_model():
    return _cached_model


# ─────────────────────────────────────────────────────────────
# Shared helpers
# ─────────────────────────────────────────────────────────────

def safe_json(obj):
    """Recursively convert numpy scalars to native Python types for JSON serialisation."""
    if isinstance(obj, dict):
        return {k: safe_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [safe_json(v) for v in obj]
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.floating):
        return float(obj)
    if isinstance(obj, np.bool_):
        return bool(obj)
    if isinstance(obj, float) and (np.isnan(obj) or np.isinf(obj)):
        return None
    return obj


def flatten_schema_map(schema_map: dict) -> list[dict]:
    """
    Convert the nested bucket format from gemini_classifier into the flat list
    the frontend expects: [{ name, type, proxies }]
    """
    flat = []
    for bucket, label in [
        ("protected", "PROTECTED"),
        ("outcome",   "OUTCOME"),
        ("ambiguous", "AMBIGUOUS"),
        ("neutral",   "NEUTRAL"),
    ]:
        for entry in schema_map.get("columns", {}).get(bucket, []):
            flat.append({
                "name":    entry["name"],
                "type":    label,
                "proxies": entry.get("proxies", []),
            })
    return flat


def bucket_schema_map(schema_map: dict) -> dict:
    """
    Reverse of flatten_schema_map. The frontend sends a flat columns list;
    this rebuilds the bucket format that internal modules expect.
    No-op if already bucketed.
    """
    if not isinstance(schema_map.get("columns"), list):
        return schema_map
    buckets: dict[str, list] = {"protected": [], "outcome": [], "ambiguous": [], "neutral": []}
    for col in schema_map["columns"]:
        t = col.get("type", "NEUTRAL").lower()
        buckets.setdefault(t, []).append(col)
    return {"columns": buckets}


def infer_positive_label(series: pd.Series):
    """Guess the positive class label from a target column."""
    unique = series.dropna().unique()
    if set(map(str, unique)).issubset({"0", "1", "0.0", "1.0"}):
        return 1
    positive_tokens = {">50k", "yes", "y", "true", "1", "approved", "hired", "high", "positive"}
    for val in unique:
        if str(val).strip().lower() in positive_tokens:
            return val
    counts = series.value_counts()
    return counts.index[-1] if len(counts) > 1 else unique[0]


def encode_categoricals(records: list[dict]) -> list[dict]:
    """Label-encode all string columns in a list of feature dicts."""
    if not records:
        return records
    df = pd.DataFrame(records)
    for col in df.select_dtypes(include=["object", "str"]).columns:
        le = LabelEncoder()
        df[col] = le.fit_transform(df[col].astype(str))
    return df.to_dict(orient="records")


def make_model_fn(model) -> callable:
    """
    Wrap a loaded sklearn model as a callable (dict → float).
    Falls back to a deterministic stub on any prediction error.

    Using a callable avoids the self-call deadlock that occurs when
    ProbeGenerator POSTs to /predict on the same uvicorn worker that is
    already blocked handling /analyze/model.
    """
    def _predict(features: dict) -> float:
        try:
            row = pd.DataFrame([features])
            if hasattr(model, "feature_names_in_"):
                for col in model.feature_names_in_:
                    if col not in row.columns:
                        row[col] = 0
                row = row[model.feature_names_in_]
            if hasattr(model, "predict_proba"):
                return float(model.predict_proba(row)[0][1])
            return float(model.predict(row)[0])
        except Exception as e:
            print(f"  [model_fn] error ({e}), using stub")
            return stub_predict(features)

    return _predict


def stub_predict(features: dict) -> float:
    """Deterministic stub used when no model is loaded."""
    seed = abs(hash(str(sorted(str(features).split())))) % 10000
    return float(np.random.default_rng(seed).uniform(0.2, 0.85))


# ─────────────────────────────────────────────────────────────
# Part A — dataset pipeline
# ─────────────────────────────────────────────────────────────

def run_dataset_pipeline(file_path: str) -> dict:
    """
    Full Part A pipeline: ingest → classify → proxy detect → bias report.

    Args:
        file_path: path to the uploaded dataset file (CSV/JSON/XLSX)

    Returns:
        dict with keys: schema_map, proxy_flags, bias_report,
                        dataset_name, row_count, column_count, warnings
    """
    ingest_result = ingest(file_path, max_rows=5000)
    df = ingest_result["df"]

    with tempfile.TemporaryDirectory() as tmp:
        schema_map = classify(
            ingest_result,
            output_path=os.path.join(tmp, "schema_map.json"),
        )
        proxy_flags = detect_proxies(
            ingest_result,
            schema_map,
            output_path=os.path.join(tmp, "proxy_flags.json"),
        )

        outcome_cols = schema_map.get("columns", {}).get("outcome", [])
        label_col = outcome_cols[0]["name"] if outcome_cols else None

        if not label_col or label_col not in df.columns:
            raise ValueError(
                "Could not identify an outcome column. "
                "Make sure your dataset has a label column."
            )

        positive_label = infer_positive_label(df[label_col])

        bias_report = build_bias_report(
            df,
            schema_map,
            label_column=label_col,
            proxy_flags=proxy_flags,
            output_path=os.path.join(tmp, "bias_report.json"),
            positive_label=positive_label,
        )

        _attach_counterfactuals(df, schema_map, proxy_flags, label_col, positive_label, bias_report)

    return {
        "schema_map":   {"columns": flatten_schema_map(schema_map)},
        "proxy_flags":  proxy_flags,
        "bias_report":  bias_report,
        "dataset_name": ingest_result["dataset_name"],
        "row_count":    ingest_result["row_count"],
        "column_count": ingest_result["column_count"],
        "warnings":     ingest_result["warnings"],
    }


def _attach_counterfactuals(df, schema_map, proxy_flags, label_col, positive_label, bias_report):
    """Run counterfactual probing and stitch results into bias_report in-place."""
    protected_cols = [
        c["name"] for c in schema_map.get("columns", {}).get("protected", [])
        if c["name"] in df.columns
    ]
    try:
        cf_results = run_counterfactuals(
            df,
            protected_cols,
            outcome_column=label_col,
            positive_label=positive_label,
            proxy_flags=proxy_flags,
            sample_size=250,
        )
        cf_lookup = {r["name"]: r for r in cf_results}
        for col_result in bias_report.get("column_results", []):
            cf = cf_lookup.get(col_result["name"], {})
            col_result["counterfactual"] = {
                "mean_shift":     cf.get("mean_shift"),
                "mean_abs_shift": cf.get("mean_abs_shift"),
                "n_pairs":        cf.get("n_pairs"),
                "status":         cf.get("status"),
            }
    except Exception as e:
        print(f"  [counterfactual] Failed: {e} — skipping")


# ─────────────────────────────────────────────────────────────
# Part B — model pipeline
# ─────────────────────────────────────────────────────────────

def run_model_pipeline(
    dataset_path: str,
    schema_map: dict,
    proxy_flags: dict,
    model_path: Optional[str] = None,
    n_probes: int = 100,
) -> dict:
    """
    Full Part B pipeline: probe → SHAP → model_bias_report.

    Args:
        dataset_path: path to uploaded dataset file
        schema_map:   flat or bucketed schema from Part A
        proxy_flags:  proxy_flags dict from Part A
        model_path:   path to a .pkl model file (None → use demo model)
        n_probes:     number of probe pairs per protected attribute

    Returns:
        dict with keys: attribute_results, shap_summary
    """
    global _cached_model

    schema_map = bucket_schema_map(schema_map)

    protected_cols  = [c["name"] for c in schema_map.get("columns", {}).get("protected", [])]
    proxy_col_names = list({e["column"] for e in proxy_flags.get("proxy_columns", [])})
    outcome_cols    = [c["name"] for c in schema_map.get("columns", {}).get("outcome", [])]

    if not protected_cols:
        raise ValueError("No PROTECTED columns found in schema_map.")

    ingest_result = ingest(dataset_path, max_rows=5000)
    df = ingest_result["df"]
    feature_df = df.drop(columns=[c for c in outcome_cols if c in df.columns], errors="ignore")

    # Encode categoricals before probing so the model receives numeric input
    sample_records  = feature_df.sample(min(200, len(feature_df)), random_state=42).to_dict(orient="records")
    encoded_sample  = encode_categoricals(sample_records)

    # Load model — provided file → demo model → None (stub only)
    loaded_model = _load_model(model_path)
    _cached_model = loaded_model  # expose for /predict endpoint
    model_fn = make_model_fn(loaded_model) if loaded_model is not None else stub_predict

    # Probing via callable — no HTTP self-call, no deadlock
    generator = ProbeGenerator(model_fn=model_fn)
    probe_results = generator.run(
        protected_columns=protected_cols,
        sample_data=encoded_sample,
        n_probes=n_probes,
    )

    # SHAP — only meaningful with a real model
    shap_summary, shap_rank_lookup = [], {}
    if loaded_model is not None:
        shap_summary, shap_rank_lookup = _run_shap(
            loaded_model, feature_df, encoded_sample,
            protected_cols, proxy_col_names,
        )

    attribute_results = [
        {
            "name":      p["name"],
            "mean_diff": p.get("mean_diff"),
            "p_value":   p.get("p_value"),
            "shap_rank": shap_rank_lookup.get(p["name"]),
            "verdict":   p.get("verdict", "SKIPPED"),
        }
        for p in probe_results
    ]

    return {"attribute_results": attribute_results, "shap_summary": shap_summary}


def _load_model(model_path: Optional[str]):
    """Load a pickle model from the given path, or fall back to demo_model.pkl."""
    path = Path(model_path) if model_path else DEMO_MODEL_PATH
    if path.exists():
        with open(path, "rb") as f:
            return pickle.load(f)
    return None


def _run_shap(model, feature_df, encoded_sample, protected_cols, proxy_col_names):
    """Run SHAPExplainer and return (shap_summary, shap_rank_lookup)."""
    try:
        X_bg = feature_df.head(200).apply(
            lambda col: col.astype("category").cat.codes if col.dtype == object else col
        )
        X_test = pd.DataFrame(encoded_sample).apply(
            lambda col: col.astype("category").cat.codes if col.dtype == object else col
        )
        explainer = SHAPExplainer(model, X_background=X_bg, model_type="auto")
        explainer.explain(X_test, protected_columns=protected_cols, proxy_columns=proxy_col_names)
        summary = explainer.get_summary_for_m4()
        rank_lookup = {e["feature"]: e["shap_rank"] for e in summary}
        return summary, rank_lookup
    except Exception as e:
        print(f"  [SHAP] Failed: {e} — skipping")
        return [], {}


# ─────────────────────────────────────────────────────────────
# Gemini report
# ─────────────────────────────────────────────────────────────

def run_gemini_report(bias_report: dict, model_bias_report: dict) -> str:
    """
    Call Gemini to produce a plain-English compliance narrative.
    Returns the report text string.
    """
    import urllib.request

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise EnvironmentError("GEMINI_API_KEY not set on the server.")

    prompt = f"""You are a bias compliance officer writing an audit report for a non-technical compliance team.
Write in plain English, no jargon. Structure your response in exactly 4 sections:

1. EXECUTIVE SUMMARY (3 sentences maximum)
2. CRITICAL FINDINGS (one paragraph per biased attribute)
3. PROXY RISK ANALYSIS (explain which features act as proxies and why this matters)
4. RECOMMENDATIONS (3 bullet points)

Dataset Bias Report:
{json.dumps(bias_report, indent=2)}

Model Behavior Report:
{json.dumps(model_bias_report, indent=2)}

The legal threshold for disparate impact is 0.8. Any score below this fails the 80% rule."""

    body = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 1024},
    }).encode()

    req = urllib.request.Request(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read())

    return data["candidates"][0]["content"]["parts"][0]["text"]
