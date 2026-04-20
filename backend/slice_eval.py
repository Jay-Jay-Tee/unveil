"""
M2 - slice_eval.py

Group-level fairness slice metrics for protected attributes.

The evaluator accepts both ground-truth labels and model predictions when
available. When callers only provide one series, the same values can be used
for both arguments, but the resulting FPR/FNR values will only be meaningful
when label and prediction columns differ.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd


FLAG_THRESHOLD = 0.10


def _project_root() -> Path:
    return Path(__file__).resolve().parents[1]


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
        "1",
        "true",
        "yes",
        "y",
        "positive",
        ">50k",
        "approved",
        "high",
        "favorable",
    }
    return normalized.isin(positive_tokens).astype(int)


def _safe_divide(numerator: float, denominator: float) -> float:
    if denominator == 0:
        return 0.0
    return float(numerator / denominator)


def _group_confusion_counts(y_true: pd.Series, y_pred: pd.Series) -> dict[str, int]:
    truth = y_true.astype(int).tolist()
    pred = y_pred.astype(int).tolist()

    tp = sum(1 for actual, guessed in zip(truth, pred) if actual == 1 and guessed == 1)
    tn = sum(1 for actual, guessed in zip(truth, pred) if actual == 0 and guessed == 0)
    fp = sum(1 for actual, guessed in zip(truth, pred) if actual == 0 and guessed == 1)
    fn = sum(1 for actual, guessed in zip(truth, pred) if actual == 1 and guessed == 0)

    return {
        "tp": tp,
        "tn": tn,
        "fp": fp,
        "fn": fn,
        "positives": tp + fp,
        "negatives": tn + fn,
    }


def build_wit_payload(
    df: pd.DataFrame,
    group_column: str,
    label_column: str,
    prediction_column: str,
    *,
    positive_label: Any = 1,
    max_examples_per_group: int = 20,
) -> dict:
    groups: list[dict[str, Any]] = []
    for group_value, group_df in df.groupby(group_column, dropna=False):
        examples = group_df.head(max_examples_per_group).copy()
        records = examples.to_dict(orient="records")
        group_name = None if _is_missing(group_value) else group_value

        groups.append(
            {
                "group": group_name,
                "count": int(len(group_df)),
                "examples": records,
                "positive_rate": round(float(_binary_series(group_df[prediction_column], positive_label).mean()), 6)
                if len(group_df)
                else 0.0,
            }
        )

    return {
        "slice_column": group_column,
        "label_column": label_column,
        "prediction_column": prediction_column,
        "groups": groups,
    }


def evaluate_slices(
    df: pd.DataFrame,
    group_column: str,
    label_column: str,
    prediction_column: str | None = None,
    *,
    positive_label: Any = 1,
    reference_group: Any | None = None,
    include_wit_payload: bool = True,
    max_examples_per_group: int = 20,
) -> dict:
    if prediction_column is None:
        prediction_column = label_column

    if group_column not in df.columns:
        return {
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
        }

    # Deduplicate columns when label == prediction (avoids DataFrame-instead-of-Series bug)
    cols = list(dict.fromkeys([group_column, label_column, prediction_column]))
    working = df[cols].copy()
    working = working.dropna(subset=[group_column])

    if working.empty:
        return {
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
        }

    results: list[dict[str, Any]] = []

    for group_value, group_df in working.groupby(group_column, dropna=False):
        y_true = _binary_series(group_df[label_column], positive_label)
        y_pred = _binary_series(group_df[prediction_column], positive_label)

        counts = _group_confusion_counts(y_true, y_pred)
        positive_rate = _safe_divide(counts["positives"], len(group_df))
        fpr = _safe_divide(counts["fp"], counts["fp"] + counts["tn"])
        fnr = _safe_divide(counts["fn"], counts["fn"] + counts["tp"])

        results.append(
            {
                "group": None if _is_missing(group_value) else group_value,
                "count": int(len(group_df)),
                "positive_rate": round(float(positive_rate), 6),
                "fpr": round(float(fpr), 6),
                "fnr": round(float(fnr), 6),
                "tp": int(counts["tp"]),
                "tn": int(counts["tn"]),
                "fp": int(counts["fp"]),
                "fn": int(counts["fn"]),
                "gap_flagged": False,
                "gap_from_reference": 0.0,
                "positive_rate_gap_from_reference": 0.0,
                "fpr_gap_from_reference": 0.0,
                "fnr_gap_from_reference": 0.0,
                "positive_rate_gap_flagged": False,
                "fpr_gap_flagged": False,
                "fnr_gap_flagged": False,
            }
        )

    if reference_group is None:
        reference_entry = max(results, key=lambda item: (item["count"], item["positive_rate"]))
        reference_group = reference_entry["group"]

    reference_rate = next(
        (entry["positive_rate"] for entry in results if entry["group"] == reference_group),
        results[0]["positive_rate"],
    )
    reference_fpr = next(
        (entry["fpr"] for entry in results if entry["group"] == reference_group),
        results[0]["fpr"],
    )
    reference_fnr = next(
        (entry["fnr"] for entry in results if entry["group"] == reference_group),
        results[0]["fnr"],
    )

    for entry in results:
        positive_gap = float(entry["positive_rate"] - reference_rate)
        fpr_gap = float(entry["fpr"] - reference_fpr)
        fnr_gap = float(entry["fnr"] - reference_fnr)

        entry["gap_from_reference"] = round(positive_gap, 6)
        entry["positive_rate_gap_from_reference"] = round(positive_gap, 6)
        entry["fpr_gap_from_reference"] = round(fpr_gap, 6)
        entry["fnr_gap_from_reference"] = round(fnr_gap, 6)

        entry["positive_rate_gap_flagged"] = abs(positive_gap) > FLAG_THRESHOLD
        entry["fpr_gap_flagged"] = abs(fpr_gap) > FLAG_THRESHOLD
        entry["fnr_gap_flagged"] = abs(fnr_gap) > FLAG_THRESHOLD

        entry["gap_flagged"] = (
            entry["positive_rate_gap_flagged"]
            or entry["fpr_gap_flagged"]
            or entry["fnr_gap_flagged"]
        )

    positive_rate_gap_max = max((abs(entry["positive_rate_gap_from_reference"]) for entry in results), default=0.0)
    fpr_gap_max = max((abs(entry["fpr_gap_from_reference"]) for entry in results), default=0.0)
    fnr_gap_max = max((abs(entry["fnr_gap_from_reference"]) for entry in results), default=0.0)
    slice_gap_max = max(positive_rate_gap_max, fpr_gap_max, fnr_gap_max)

    what_if_tool = (
        build_wit_payload(
            working,
            group_column,
            label_column,
            prediction_column,
            positive_label=positive_label,
            max_examples_per_group=max_examples_per_group,
        )
        if include_wit_payload
        else None
    )

    return {
        "group_column": group_column,
        "label_column": label_column,
        "prediction_column": prediction_column,
        "reference_group": reference_group,
        "reference_positive_rate": round(float(reference_rate), 6),
        "reference_fpr": round(float(reference_fpr), 6),
        "reference_fnr": round(float(reference_fnr), 6),
        "slice_gap_max": round(float(slice_gap_max), 6),
        "positive_rate_gap_max": round(float(positive_rate_gap_max), 6),
        "fpr_gap_max": round(float(fpr_gap_max), 6),
        "fnr_gap_max": round(float(fnr_gap_max), 6),
        "gap_flagged": bool(
            positive_rate_gap_max > FLAG_THRESHOLD
            or fpr_gap_max > FLAG_THRESHOLD
            or fnr_gap_max > FLAG_THRESHOLD
        ),
        "slice_results": results,
        "what_if_tool": what_if_tool,
    }


def load_reportable_slice(path: str | None = None) -> dict:
    slice_path = Path(path) if path else _project_root() / "schemas" / "slice_eval.json"
    with open(slice_path, "r", encoding="utf-8") as handle:
        return json.load(handle)