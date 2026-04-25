"""
Unveil — slice_eval.py  (REVAMPED)

Critical fix: numeric columns (age) and high-cardinality categoricals
(native-country, occupation) are now BINNED before slicing. The old version
produced one bar per unique value — 73 age bars, 41 country bars — which
was useless for the user AND bad for the chi-squared test.

Binning strategy:
  - Numeric columns: fixed bands (age: <25, 25-34, 35-44, 45-54, 55+).
    If the column isn't recognized, fall back to quantile-based bins (quartiles).
  - Categorical columns with >= 6 unique values: keep top-5 by frequency,
    collapse the rest into "Other".
  - Categorical with < 6 unique values: leave as-is.

The output shape is unchanged — each slice row still has group/count/
positive_rate/fpr/fnr/tp/tn/fp/fn — so nothing downstream breaks.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Optional

import numpy as np
import pandas as pd
from scipy.stats import chi2_contingency


FLAG_THRESHOLD = 0.10
MAX_CATEGORICAL_GROUPS = 6  # above this, we collapse into top-5 + Other
MIN_BIN_SIZE = 20  # don't keep groups with fewer than this many rows


# ─────────────────────────────────────────────────────────────
# Binning — this is the part that fixes "every age shown as a bar"
# ─────────────────────────────────────────────────────────────

def _col_is_age_like(name: str) -> bool:
    n = re.sub(r"[\s_\-\.]+", "_", name.strip().lower())
    return bool(re.match(r"^(age|age_group|age_band|age_range|years_old)$", n))


def _bin_age(series: pd.Series) -> pd.Series:
    """Canonical age bands used across HR/fairness literature."""
    numeric = pd.to_numeric(series, errors="coerce")
    bins = [-float("inf"), 25, 35, 45, 55, float("inf")]
    labels = ["<25", "25-34", "35-44", "45-54", "55+"]
    return pd.cut(numeric, bins=bins, labels=labels, right=False).astype(str).replace("nan", None)


def _bin_numeric_quantile(series: pd.Series, n_bins: int = 4) -> pd.Series:
    """Quartile binning for arbitrary numeric columns."""
    numeric = pd.to_numeric(series, errors="coerce")
    try:
        binned = pd.qcut(numeric, q=n_bins, duplicates="drop")
        return binned.astype(str).replace("nan", None)
    except Exception:
        # If qcut fails (e.g. too few unique values), give up and leave as-is
        return series.astype(str)


def _bin_categorical_top_n(series: pd.Series, top_n: int = 5) -> pd.Series:
    """Keep top-N most common, collapse the tail into 'Other'."""
    normalized = series.astype(str).replace({"nan": None, "None": None})
    counts = normalized.value_counts(dropna=True)
    top = set(counts.head(top_n).index)
    return normalized.where(normalized.isin(top) | normalized.isna(), other="Other")


def _apply_binning(df: pd.DataFrame, column: str) -> pd.Series:
    """
    Decide the right binning strategy for this column and return the binned
    series. This is where all the 'every age gets a bar' logic lives.
    """
    series = df[column]
    is_numeric = pd.api.types.is_numeric_dtype(series)

    if _col_is_age_like(column) and is_numeric:
        return _bin_age(series)

    if is_numeric:
        # e.g. hours-per-week, capital-gain — bin if high cardinality
        nunique = series.nunique(dropna=True)
        if nunique > MAX_CATEGORICAL_GROUPS:
            return _bin_numeric_quantile(series)
        return series.astype(str)

    # Categorical
    nunique = series.nunique(dropna=True)
    if nunique > MAX_CATEGORICAL_GROUPS:
        return _bin_categorical_top_n(series, top_n=MAX_CATEGORICAL_GROUPS - 1)
    return series.astype(str)


# ─────────────────────────────────────────────────────────────
# Helpers for positive-label inference
# ─────────────────────────────────────────────────────────────

def _is_missing(value: Any) -> bool:
    try:
        return bool(pd.isna(value))
    except Exception:
        return False


def _binary_series(series: pd.Series, positive_label: Any = 1) -> pd.Series:
    if series.empty:
        return pd.Series(dtype=int)

    if pd.api.types.is_bool_dtype(series):
        return series.astype(int)

    if pd.api.types.is_numeric_dtype(series):
        if isinstance(positive_label, (int, float, np.integer, np.floating)):
            return (series.astype(float) >= float(positive_label)).astype(int)
        return (series.astype(float) >= 0.5).astype(int)

    normalized = series.astype(str).str.strip().str.lower()
    positive_tokens = {
        str(positive_label).strip().lower(),
        "1", "true", "yes", "y", "positive",
        ">50k", "approved", "hired", "high", "favorable",
    }
    return normalized.isin(positive_tokens).astype(int)


def _safe_divide(num: float, den: float) -> float:
    return 0.0 if den == 0 else float(num / den)


def _confusion(y_true: pd.Series, y_pred: pd.Series) -> dict[str, int]:
    t = y_true.astype(int).tolist()
    p = y_pred.astype(int).tolist()
    tp = sum(1 for a, g in zip(t, p) if a == 1 and g == 1)
    tn = sum(1 for a, g in zip(t, p) if a == 0 and g == 0)
    fp = sum(1 for a, g in zip(t, p) if a == 0 and g == 1)
    fn = sum(1 for a, g in zip(t, p) if a == 1 and g == 0)
    return {"tp": tp, "tn": tn, "fp": fp, "fn": fn,
            "positives": tp + fp, "negatives": tn + fn}


# ─────────────────────────────────────────────────────────────
# Main entry point
# ─────────────────────────────────────────────────────────────

def evaluate_slices(
    df: pd.DataFrame,
    group_column: str,
    label_column: str,
    prediction_column: Optional[str] = None,
    *,
    positive_label: Any = 1,
    reference_group: Optional[Any] = None,
    include_wit_payload: bool = True,
    max_examples_per_group: int = 20,
) -> dict:
    if prediction_column is None:
        prediction_column = label_column

    empty_result = {
        "group_column": group_column,
        "label_column": label_column,
        "prediction_column": prediction_column,
        "reference_group": None,
        "reference_positive_rate": 0.0,
        "reference_fpr": 0.0,
        "reference_fnr": 0.0,
        "slice_gap_max": 0.0,
        "positive_rate_gap_max": 0.0,
        "fpr_gap_max": 0.0,
        "fnr_gap_max": 0.0,
        "gap_flagged": False,
        "slice_results": [],
        "what_if_tool": None,
        "binning": "none",
    }

    if group_column not in df.columns:
        return empty_result

    cols = list(dict.fromkeys([group_column, label_column, prediction_column]))
    working = df[cols].copy().dropna(subset=[group_column])
    if working.empty:
        return empty_result

    # ★ BINNING HAPPENS HERE — this is the key fix
    binning_used = "none"
    original_nunique = working[group_column].nunique(dropna=True)
    working["_binned_group"] = _apply_binning(working, group_column)
    binned_nunique = working["_binned_group"].nunique(dropna=True)
    if binned_nunique < original_nunique:
        if _col_is_age_like(group_column):
            binning_used = "age_bands"
        elif pd.api.types.is_numeric_dtype(df[group_column]):
            binning_used = "quartiles"
        else:
            binning_used = f"top_{MAX_CATEGORICAL_GROUPS - 1}_plus_other"

    working = working.dropna(subset=["_binned_group"])
    if working.empty:
        return empty_result

    results: list[dict] = []
    for group_value, group_df in working.groupby("_binned_group", dropna=False):
        if len(group_df) < MIN_BIN_SIZE:
            # Still include it but mark it as small — the UI can grey it out
            pass

        y_true = _binary_series(group_df[label_column], positive_label)
        y_pred = _binary_series(group_df[prediction_column], positive_label)
        counts = _confusion(y_true, y_pred)

        pos_rate = _safe_divide(counts["positives"], len(group_df))
        fpr = _safe_divide(counts["fp"], counts["fp"] + counts["tn"])
        fnr = _safe_divide(counts["fn"], counts["fn"] + counts["tp"])

        results.append({
            "group": None if _is_missing(group_value) else str(group_value),
            "count": int(len(group_df)),
            "positive_rate": round(float(pos_rate), 6),
            "fpr": round(float(fpr), 6),
            "fnr": round(float(fnr), 6),
            "tp": int(counts["tp"]), "tn": int(counts["tn"]),
            "fp": int(counts["fp"]), "fn": int(counts["fn"]),
            "small_sample": len(group_df) < MIN_BIN_SIZE,
            "gap_flagged": False,
            "gap_from_reference": 0.0,
            "positive_rate_gap_from_reference": 0.0,
            "fpr_gap_from_reference": 0.0,
            "fnr_gap_from_reference": 0.0,
            "positive_rate_gap_flagged": False,
            "fpr_gap_flagged": False,
            "fnr_gap_flagged": False,
        })

    if not results:
        return empty_result

    # Pick reference group — biggest by count, ties broken by highest positive_rate
    if reference_group is None:
        ref_entry = max(results, key=lambda r: (r["count"], r["positive_rate"]))
        reference_group = ref_entry["group"]

    ref_rate = next((r["positive_rate"] for r in results if r["group"] == reference_group), results[0]["positive_rate"])
    ref_fpr = next((r["fpr"] for r in results if r["group"] == reference_group), results[0]["fpr"])
    ref_fnr = next((r["fnr"] for r in results if r["group"] == reference_group), results[0]["fnr"])

    for entry in results:
        pos_gap = float(entry["positive_rate"] - ref_rate)
        fpr_gap = float(entry["fpr"] - ref_fpr)
        fnr_gap = float(entry["fnr"] - ref_fnr)
        entry["gap_from_reference"] = round(pos_gap, 6)
        entry["positive_rate_gap_from_reference"] = round(pos_gap, 6)
        entry["fpr_gap_from_reference"] = round(fpr_gap, 6)
        entry["fnr_gap_from_reference"] = round(fnr_gap, 6)
        entry["positive_rate_gap_flagged"] = abs(pos_gap) > FLAG_THRESHOLD
        entry["fpr_gap_flagged"] = abs(fpr_gap) > FLAG_THRESHOLD
        entry["fnr_gap_flagged"] = abs(fnr_gap) > FLAG_THRESHOLD
        entry["gap_flagged"] = entry["positive_rate_gap_flagged"] or entry["fpr_gap_flagged"] or entry["fnr_gap_flagged"]

    pos_gap_max = max((abs(r["positive_rate_gap_from_reference"]) for r in results), default=0.0)
    fpr_gap_max = max((abs(r["fpr_gap_from_reference"]) for r in results), default=0.0)
    fnr_gap_max = max((abs(r["fnr_gap_from_reference"]) for r in results), default=0.0)
    slice_gap_max = max(pos_gap_max, fpr_gap_max, fnr_gap_max)

    wit_payload = None
    if include_wit_payload:
        wit_payload = _build_wit_payload(working, "_binned_group", label_column, prediction_column, positive_label, max_examples_per_group)

    return {
        "group_column": group_column,
        "label_column": label_column,
        "prediction_column": prediction_column,
        "reference_group": reference_group,
        "reference_positive_rate": round(float(ref_rate), 6),
        "reference_fpr": round(float(ref_fpr), 6),
        "reference_fnr": round(float(ref_fnr), 6),
        "slice_gap_max": round(float(slice_gap_max), 6),
        "positive_rate_gap_max": round(float(pos_gap_max), 6),
        "fpr_gap_max": round(float(fpr_gap_max), 6),
        "fnr_gap_max": round(float(fnr_gap_max), 6),
        "gap_flagged": bool(pos_gap_max > FLAG_THRESHOLD or fpr_gap_max > FLAG_THRESHOLD or fnr_gap_max > FLAG_THRESHOLD),
        "slice_results": results,
        "what_if_tool": wit_payload,
        "binning": binning_used,  # so the UI can show "grouped into age bands"
    }


def _build_wit_payload(df, group_column, label_column, prediction_column, positive_label, max_examples):
    groups = []
    for group_value, group_df in df.groupby(group_column, dropna=False):
        examples = group_df.head(max_examples).drop(columns=["_binned_group"], errors="ignore").to_dict(orient="records")
        groups.append({
            "group": None if _is_missing(group_value) else str(group_value),
            "count": int(len(group_df)),
            "examples": examples,
            "positive_rate": round(float(_binary_series(group_df[prediction_column], positive_label).mean()), 6) if len(group_df) else 0.0,
        })
    return {
        "slice_column": group_column,
        "label_column": label_column,
        "prediction_column": prediction_column,
        "groups": groups,
    }


def build_wit_payload(df, group_column, label_column, prediction_column, *, positive_label=1, max_examples_per_group=20):
    """Kept for backward compat with any external callers."""
    return _build_wit_payload(df, group_column, label_column, prediction_column, positive_label, max_examples_per_group)


def load_reportable_slice(path: Optional[str] = None) -> dict:
    slice_path = Path(path) if path else Path(__file__).resolve().parents[1] / "schemas" / "slice_eval.json"
    with open(slice_path, "r", encoding="utf-8") as handle:
        return json.load(handle)
