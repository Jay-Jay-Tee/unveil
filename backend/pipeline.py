"""
Unveil — pipeline.py (REVAMPED)

Changes from the old version:
  1. run_gemini_report now generates the report in SECTIONS, each with its
     own max_output_tokens budget. The old single-call 2048-token cap was
     exactly why reports got truncated mid-sentence.
  2. Each section is requested separately — if one fails (rate limit), we
     return what we have so far instead of nothing.
  3. Reports are cached by hash of the input — regenerating the same audit
     doesn't burn fresh Gemini quota.
  4. All other functions unchanged in behavior — schema/JSON shapes stable.
"""

import hashlib
import json
import os
import pickle
import tempfile
import traceback
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


# ─── helpers (unchanged from old pipeline.py) ──────────────────────────────

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


# ─── Part A — dataset pipeline (unchanged in shape) ────────────────────────

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
        print(f"  [counterfactual] Failed: {e} — skipping")


# ─── Part B — model pipeline (unchanged) ───────────────────────────────────

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
        print(f"  [SHAP] Failed: {e} — skipping")
        return [], {}


# ─── Gemini report — NOW CHUNKED SO IT DOESN'T GET CUT OFF ─────────────────

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


def _gemini_call_raw(prompt: str, max_tokens: int = 4096) -> str:
    """Single Gemini call. No retries here — the caller handles failures."""
    import urllib.request

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise EnvironmentError("GEMINI_API_KEY is not set on the server.")

    model_name = os.environ.get("GEMINI_REPORT_MODEL", "gemini-2.5-flash")
    body = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": max_tokens},
    }).encode()

    req = urllib.request.Request(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=45) as resp:
        data = json.loads(resp.read())

    try:
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        finish_reason = data["candidates"][0].get("finishReason", "STOP")
        if finish_reason == "MAX_TOKENS":
            # Token cap hit — the text is real but truncated. Caller should
            # handle this (e.g. continue) rather than treating it as an error.
            text += "\n\n*(section truncated due to length — see dashboard for full detail)*"
        return text
    except (KeyError, IndexError) as e:
        raise RuntimeError(f"Gemini returned malformed response: {e}\nBody: {data}")


# Section prompts — each runs independently so a single quota blip doesn't kill
# the whole report.

_EXEC_SUMMARY_PROMPT = """You are a bias compliance officer. Write ONLY the EXECUTIVE SUMMARY section
of an audit report for a non-technical reader. 3-4 sentences MAX. No headings, no bullet points.
Reference "{dataset}" when relevant.

Here is the data:

Dataset findings:
{bias}

Model findings:
{model}

The legal threshold for the fairness ratio (disparate impact) is 0.80. Below that fails the legal 80% rule.
Just write the 3-4 sentence summary. Don't add any section heading — the caller will add that."""

_FINDINGS_PROMPT = """You are a bias compliance officer. Write ONLY the CRITICAL FINDINGS section.
For each unfair or borderline column in the data below, write ONE short paragraph (2-3 sentences)
in plain English. State the column name, the worst-off group, the fairness ratio, and why it matters.
Reference "{dataset}" when relevant. Do NOT include a heading — the caller will add that.

Dataset findings:
{bias}

Model findings:
{model}"""

_PROXY_PROMPT = """You are a bias compliance officer. Write ONLY the PROXY RISK section.
Look for columns where proxy_strength is high or role is PROXY. In 3-4 sentences plain English,
explain which features act as stand-ins for sensitive attributes and why removing the sensitive
column alone doesn't fix bias. Reference "{dataset}" when relevant. No heading.

Dataset findings:
{bias}"""

_RECS_PROMPT = """You are a bias compliance officer. Write ONLY the RECOMMENDATIONS section as
3 bullet points. Each bullet is one sentence, action-oriented, specific to "{dataset}" below.
Start each bullet with "* ".

Dataset findings:
{bias}

Model findings:
{model}"""


def run_gemini_report(bias_report: dict, model_bias_report: dict, force_refresh: bool = False, dataset_name: Optional[str] = None) -> str:
    """
    Generate the compliance narrative in 4 chunks so we don't hit the
    max_output_tokens ceiling and get cut off mid-sentence.
    Cached by content hash — regenerating the same audit is free.
    """
    if not dataset_name:
        dataset_name = "the dataset"
    cache_key = _report_cache_key(bias_report, model_bias_report)
    cached = _report_cache_get(cache_key)
    if not force_refresh:
        cached = _report_cache_get(cache_key)
        if cached:
            return cached
    # Compact the inputs a bit so we don't blow the input token budget
    bias_compact = _compact_bias_report(bias_report)
    model_compact = _compact_model_report(model_bias_report)

    # Shared template fill
    fmt = {
        "bias": json.dumps(bias_compact, indent=2),
        "model": json.dumps(model_compact, indent=2),
        "dataset": dataset_name,
    }

    sections = []
    failed_sections = 0

    def _try_section(heading: str, prompt_template: str, max_tokens: int) -> None:
        nonlocal failed_sections
        try:
            text = _gemini_call_raw(prompt_template.format(**fmt), max_tokens=max_tokens)
            sections.append(f"## {heading}\n\n{text.strip()}")
        except Exception as e:
            failed_sections += 1
            print(f"  [report] Section '{heading}' failed: {e}")
            sections.append(f"## {heading}\n\n*(Couldn't generate this section — {e})*")

    _try_section("Executive Summary", _EXEC_SUMMARY_PROMPT, max_tokens=512)
    _try_section("Critical Findings", _FINDINGS_PROMPT, max_tokens=2048)
    _try_section("Proxy Risk", _PROXY_PROMPT, max_tokens=1024)
    _try_section("Recommendations", _RECS_PROMPT, max_tokens=768)

    full = "\n\n".join(sections)
    if failed_sections < 4:
        _report_cache_put(cache_key, full)
    return full


def _compact_bias_report(br: dict) -> dict:
    """Strip slice payloads etc. down to what the LLM needs — saves input tokens."""
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
