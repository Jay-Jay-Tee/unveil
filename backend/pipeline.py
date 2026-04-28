"""
Unveil - pipeline.py (REVAMPED v2)

Changes from previous version:
  1. _gemini_call_raw now retries on 503/429 with exponential backoff (8s, 16s)
     so transient Gemini overload doesn't surface as an immediate failure.
  2. run_gemini_report now makes ONE single Gemini call for the full report
     instead of 4 separate section calls. This reduces rate-limit exposure
     by 4x and eliminates the partial-stub problem where one 503 would leave
     sections silently empty.
  3. All other functions unchanged in behavior - schema/JSON shapes stable.
"""

import hashlib
import json
import os
import pickle
import tempfile
import time
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
import joblib
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
REPORT_CACHE_DIR = Path(__file__).resolve().parent / "_cache" / "reports"
REPORT_CACHE_DIR.mkdir(parents=True, exist_ok=True)

_cached_model = None


def get_cached_model():
    return _cached_model


# --- helpers (unchanged from old pipeline.py) ------------------------------

def safe_json(obj):
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
    flat = []
    for bucket, label in [("protected", "PROTECTED"), ("outcome", "OUTCOME"),
                           ("ambiguous", "AMBIGUOUS"), ("neutral", "NEUTRAL")]:
        for entry in schema_map.get("columns", {}).get(bucket, []):
            flat.append({
                "name": entry["name"],
                "type": label,
                "proxies": entry.get("proxies", []),
            })
    return flat


def bucket_schema_map(schema_map: dict) -> dict:
    if not isinstance(schema_map.get("columns"), list):
        return schema_map
    buckets = {"protected": [], "outcome": [], "ambiguous": [], "neutral": []}
    for col in schema_map["columns"]:
        t = col.get("type", "NEUTRAL").lower()
        buckets.setdefault(t, []).append(col)
    return {"columns": buckets}


def infer_positive_label(series: pd.Series):
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
    if not records:
        return records
    df = pd.DataFrame(records)
    for col in df.select_dtypes(include=["object", "str"]).columns:
        le = LabelEncoder()
        df[col] = le.fit_transform(df[col].astype(str))
    return df.to_dict(orient="records")


def make_model_fn(model):
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
    seed = abs(hash(str(sorted(str(features).split())))) % 10000
    return float(np.random.default_rng(seed).uniform(0.2, 0.85))


# --- Part A - dataset pipeline (unchanged in shape) ------------------------

def run_dataset_pipeline(file_path: str, original_filename: str | None = None) -> dict:
    ingest_result = ingest(file_path, max_rows=5000)
    df = ingest_result["df"]
    # Override the tmp-path stem with the real uploaded filename
    if original_filename:
        ingest_result["dataset_name"] = Path(original_filename).stem

    with tempfile.TemporaryDirectory() as tmp:
        schema_map = classify(ingest_result, output_path=os.path.join(tmp, "schema_map.json"))
        proxy_flags = detect_proxies(ingest_result, schema_map, output_path=os.path.join(tmp, "proxy_flags.json"))

        outcome_cols = schema_map.get("columns", {}).get("outcome", [])
        label_col = outcome_cols[0]["name"] if outcome_cols else None

        if not label_col or label_col not in df.columns:
            raise ValueError(
                "Couldn't find a prediction target column. Make sure your dataset has "
                "a label column (income, approved, hired, etc.)."
            )

        positive_label = infer_positive_label(df[label_col])

        bias_report = build_bias_report(
            df, schema_map,
            label_column=label_col,
            proxy_flags=proxy_flags,
            output_path=os.path.join(tmp, "bias_report.json"),
            positive_label=positive_label,
        )

        _attach_counterfactuals(df, schema_map, proxy_flags, label_col, positive_label, bias_report)

    return {
        "schema_map": {"columns": flatten_schema_map(schema_map),
                       "used_fallback": schema_map.get("used_fallback", False)},
        "proxy_flags": proxy_flags,
        "bias_report": bias_report,
        "dataset_name": ingest_result["dataset_name"],
        "row_count": ingest_result["row_count"],
        "column_count": ingest_result["column_count"],
        "warnings": ingest_result["warnings"],
    }


def _attach_counterfactuals(df, schema_map, proxy_flags, label_col, positive_label, bias_report):
    protected_cols = [c["name"] for c in schema_map.get("columns", {}).get("protected", []) if c["name"] in df.columns]
    try:
        cf_results = run_counterfactuals(df, protected_cols, outcome_column=label_col,
                                          positive_label=positive_label, proxy_flags=proxy_flags, sample_size=250)
        cf_lookup = {r["name"]: r for r in cf_results}
        for col_result in bias_report.get("column_results", []):
            cf = cf_lookup.get(col_result["name"], {})
            col_result["counterfactual"] = {
                "mean_shift": cf.get("mean_shift"),
                "mean_abs_shift": cf.get("mean_abs_shift"),
                "n_pairs": cf.get("n_pairs"),
                "status": cf.get("status"),
            }
    except Exception as e:
        print(f"  [counterfactual] Failed: {e} - skipping")


# --- Part B - model pipeline (unchanged) -----------------------------------

def run_model_pipeline(dataset_path, schema_map, proxy_flags, model_path=None, n_probes=100):
    global _cached_model

    schema_map = bucket_schema_map(schema_map)
    protected_cols = [c["name"] for c in schema_map.get("columns", {}).get("protected", [])]
    proxy_col_names = list({e["column"] for e in proxy_flags.get("proxy_columns", [])})
    outcome_cols = [c["name"] for c in schema_map.get("columns", {}).get("outcome", [])]

    if not protected_cols:
        raise ValueError("No sensitive attributes found in the dataset schema.")

    ingest_result = ingest(dataset_path, max_rows=5000)
    df = ingest_result["df"]
    feature_df = df.drop(columns=[c for c in outcome_cols if c in df.columns], errors="ignore")

    sample_records = feature_df.sample(min(200, len(feature_df)), random_state=42).to_dict(orient="records")
    encoded_sample = encode_categoricals(sample_records)

    loaded_model = _load_model(model_path)
    _cached_model = loaded_model
    model_fn = make_model_fn(loaded_model) if loaded_model is not None else stub_predict

    generator = ProbeGenerator(model_fn=model_fn)
    probe_results = generator.run(protected_columns=protected_cols, sample_data=encoded_sample, n_probes=n_probes)

    shap_summary, shap_rank_lookup = [], {}
    if loaded_model is not None:
        shap_summary, shap_rank_lookup = _run_shap(loaded_model, feature_df, encoded_sample, protected_cols, proxy_col_names)

    attribute_results = [{
        "name": p["name"],
        "mean_diff": p.get("mean_diff"),
        "p_value": p.get("p_value"),
        "shap_rank": shap_rank_lookup.get(p["name"]),
        "verdict": p.get("verdict", "SKIPPED"),
    } for p in probe_results]

    return {"attribute_results": attribute_results, "shap_summary": shap_summary}


def _load_model(model_path):
    path = Path(model_path) if model_path else DEMO_MODEL_PATH
    if path.exists():
        try:
            return joblib.load(path)
        except Exception as joblib_error:
            try:
                with open(path, "rb") as f:
                    return pickle.load(f)
            except Exception as pickle_error:
                if model_path:
                    raise ValueError(
                        "Uploaded model is not a valid sklearn joblib/pickle artifact. "
                        "Please upload a .pkl/.joblib model exported from scikit-learn."
                    ) from pickle_error
                raise RuntimeError(
                    f"Failed to load bundled demo model at {path}: {joblib_error} / {pickle_error}"
                ) from pickle_error
    return None


def _run_shap(model, feature_df, encoded_sample, protected_cols, proxy_col_names):
    try:
        X_bg = feature_df.head(200).apply(lambda c: c.astype("category").cat.codes if c.dtype == object else c)
        X_test = pd.DataFrame(encoded_sample).apply(lambda c: c.astype("category").cat.codes if c.dtype == object else c)
        explainer = SHAPExplainer(model, X_background=X_bg, model_type="auto")
        explainer.explain(X_test, protected_columns=protected_cols, proxy_columns=proxy_col_names)
        summary = explainer.get_summary_for_m4()
        rank_lookup = {e["feature"]: e["shap_rank"] for e in summary}
        return summary, rank_lookup
    except Exception as e:
        print(f"  [SHAP] Failed: {e} - skipping")
        return [], {}


# --- Gemini report ---------------------------------------------------------
#
# FIX 1: _gemini_call_raw now retries on 503/429 with exponential backoff.
#         Retry schedule: wait 8s before attempt 2, 16s before attempt 3.
#         Hard non-retryable errors (4xx except 429, env errors) propagate
#         immediately so the caller's error handling still works correctly.
#
# FIX 3: run_gemini_report now issues ONE unified Gemini call for the full
#         report instead of four separate section calls. This cuts rate-limit
#         exposure by 4x and eliminates the partial-stub failure mode where
#         one 503 would silently hollow out individual sections.

# HTTP status codes that Gemini uses for transient overload / quota.
_GEMINI_RETRYABLE_STATUSES = {429, 503}

# Backoff delays in seconds between successive retry attempts (attempt index 1, 2, ...).
_GEMINI_BACKOFF_SECONDS = [8, 16]


def _gemini_call_raw(prompt: str, max_tokens: int = 4096, retries: int = 2) -> str:
    """
    Single Gemini HTTP call with exponential-backoff retry on 503/429.

    Args:
        prompt:    The full prompt text to send.
        max_tokens: Maximum output tokens for generationConfig.
        retries:   Number of additional attempts after the first failure
                   (total attempts = retries + 1). Defaults to 2, giving
                   a schedule of: try → 8s → try → 16s → try → raise.

    Raises:
        EnvironmentError: GEMINI_API_KEY not set (never retried).
        RuntimeError:     Malformed Gemini response body.
        Exception:        Final error after all retries exhausted.
    """
    import urllib.request
    import urllib.error

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise EnvironmentError("GEMINI_API_KEY is not set on the server.")

    model_name = os.environ.get("GEMINI_REPORT_MODEL", "gemini-2.5-flash")
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model_name}:generateContent?key={api_key}"
    )
    body = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": max_tokens},
    }).encode()

    last_err: Exception = RuntimeError("No attempts made.")

    for attempt in range(retries + 1):
        # Backoff before every retry (not before the first attempt).
        if attempt > 0:
            wait_sec = _GEMINI_BACKOFF_SECONDS[min(attempt - 1, len(_GEMINI_BACKOFF_SECONDS) - 1)]
            print(f"  [gemini] attempt {attempt + 1}/{retries + 1} - waiting {wait_sec}s after transient error")
            time.sleep(wait_sec)

        req = urllib.request.Request(url, data=body,
                                     headers={"Content-Type": "application/json"},
                                     method="POST")
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = json.loads(resp.read())
        except urllib.error.HTTPError as http_err:
            status = http_err.code
            if status in _GEMINI_RETRYABLE_STATUSES and attempt < retries:
                last_err = http_err
                print(f"  [gemini] HTTP {status} (transient) on attempt {attempt + 1} - will retry")
                continue
            # Non-retryable HTTP error or retries exhausted - re-raise immediately.
            raise
        except Exception as conn_err:
            # Network-level errors (timeout, DNS) are also retryable.
            if attempt < retries:
                last_err = conn_err
                print(f"  [gemini] Connection error on attempt {attempt + 1}: {conn_err} - will retry")
                continue
            raise

        # Successful HTTP response - parse the body.
        try:
            text = data["candidates"][0]["content"]["parts"][0]["text"]
            finish_reason = data["candidates"][0].get("finishReason", "STOP")
            if finish_reason == "MAX_TOKENS":
                text += "\n\n*(section truncated due to length - see dashboard for full detail)*"
            return text
        except (KeyError, IndexError) as e:
            raise RuntimeError(f"Gemini returned malformed response: {e}\nBody: {data}")

    # All retries exhausted.
    raise last_err


# Unified single-call prompt.  All four sections are requested in one shot so
# the total number of Gemini API calls drops from 4 → 1 per report generation.
_FULL_REPORT_PROMPT = """\
You are a bias compliance officer writing a full audit report for a non-technical reader.

Write a complete compliance report for the dataset "{dataset}" with exactly these four sections.
Use markdown headings (## Section Name) for each. Be thorough and specific.

## Executive Summary
3-4 sentences. Plain English, no jargon. State what dataset was analyzed, what was found overall,
and the most urgent issue.

## Critical Findings
One short paragraph (2-3 sentences) per column with verdict "BIASED" or "AMBIGUOUS". State the
column name, worst-affected group, fairness ratio, and why it matters. If no issues, say so clearly.

## Proxy Risk
3-4 sentences. Identify columns with high proxy_strength or role=PROXY. Explain which sensitive
attribute they encode and why removing the obvious column is not enough.

## Recommendations
Exactly 3 bullet points starting with "* ". One sentence each, action-oriented and specific to
what is in this dataset.

Rules:
- A fairness ratio below 0.80 fails the legal 80% rule
- Say "sensitive attributes" instead of "PROTECTED"
- Reference the dataset as "{dataset}"
- Do NOT add any preamble, intro, or closing remarks outside the four sections
- Write ALL four sections even if data is sparse

Dataset findings:
{bias}

Model findings:
{model}"""


def run_gemini_report(
    bias_report: dict,
    model_bias_report: dict,
    force_refresh: bool = False,
    dataset_name: Optional[str] = None,
) -> str:
    """
    Generate the compliance narrative in a single Gemini call.

    Cached by content hash so regenerating the same audit is free.
    Retries on transient 503/429 are handled inside _gemini_call_raw.
    """
    if not dataset_name:
        dataset_name = "the dataset"

    cache_key = _report_cache_key(bias_report, model_bias_report)
    if not force_refresh:
        cached = _report_cache_get(cache_key)
        if cached:
            return cached

    bias_compact = _compact_bias_report(bias_report)
    model_compact = _compact_model_report(model_bias_report)

    prompt = _FULL_REPORT_PROMPT.format(
        dataset=dataset_name,
        bias=json.dumps(bias_compact, indent=2),
        model=json.dumps(model_compact, indent=2),
    )

    # Single call - retries are handled inside _gemini_call_raw.
    # max_tokens is set to cover all four sections comfortably (512 + 2048 + 1024 + 768 = 4352,
    # rounded up with headings/whitespace overhead).
    full_report = _gemini_call_raw(prompt, max_tokens=4352, retries=2)

    _report_cache_put(cache_key, full_report)
    return full_report


# --- Cache helpers ---------------------------------------------------------

def _report_cache_key(bias_report: dict, model_bias_report: dict) -> str:
    payload = json.dumps({"b": bias_report, "m": model_bias_report}, sort_keys=True, default=str)
    return hashlib.sha1(payload.encode()).hexdigest()[:16]


def _report_cache_get(key: str) -> Optional[str]:
    path = REPORT_CACHE_DIR / f"{key}.txt"
    if path.exists():
        try:
            cached = path.read_text(encoding="utf-8")
            if "GEMINI_API_KEY is not set on the server." in cached:
                return None
            return cached
        except Exception:
            return None
    return None


def _report_cache_put(key: str, value: str) -> None:
    try:
        (REPORT_CACHE_DIR / f"{key}.txt").write_text(value, encoding="utf-8")
    except Exception as e:
        print(f"  [report cache] write failed: {e}")


# --- Compact helpers -------------------------------------------------------

def _compact_bias_report(br: dict) -> dict:
    """Strip slice payloads etc. down to what the LLM needs - saves input tokens."""
    if not br:
        return {}
    compact_cols = []
    for c in br.get("column_results", []) or []:
        compact_cols.append({
            "name": c.get("name"),
            "role": c.get("role", "PROTECTED"),
            "disparate_impact": c.get("disparate_impact"),
            "parity_gap": c.get("parity_gap"),
            "p_value": c.get("p_value"),
            "verdict": c.get("verdict"),
            "proxy_strength": c.get("proxy_strength"),
            "proxy_targets": c.get("proxy_targets"),
            "worst_group": _pick_worst_group(c.get("slices") or []),
        })
    return {"dataset": br.get("dataset"), "summary": br.get("summary"), "column_results": compact_cols}


def _compact_model_report(mr: dict) -> dict:
    if not mr:
        return {}
    return {
        "attribute_results": mr.get("attribute_results", []),
        "top_shap": (mr.get("shap_summary") or [])[:10],
    }


def _pick_worst_group(slices: list[dict]) -> Optional[dict]:
    if not slices:
        return None
    worst = min(slices, key=lambda s: s.get("positive_rate", 1.0))
    return {"group": worst.get("group"), "positive_rate": worst.get("positive_rate"), "count": worst.get("count")}
