"""
M2 - stats.py

Fairness statistics and report assembly for bias_report.json.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from scipy.stats import chi2_contingency

try:
    from .slice_eval import evaluate_slices
except ImportError:
    from slice_eval import evaluate_slices


SCHEMA_VERSION = "1.0.0"
DISPARATE_IMPACT_THRESHOLD = 0.80
PARITY_GAP_THRESHOLD = 0.10
SIGNIFICANCE_THRESHOLD = 0.05
AMBIGUOUS_THRESHOLD = 0.10


def _project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def _python_value(value: Any) -> Any:
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return float(value)
    if isinstance(value, (np.bool_,)):
        return bool(value)
    return value


def _protected_columns(schema_map: dict) -> list[str]:
    protected = schema_map.get("columns", {}).get("protected", [])
    return [entry["name"] for entry in protected if entry.get("name")]


def disparate_impact_ratio(slice_results: list[dict], reference_group: Any | None = None) -> float:
    rates = [float(entry.get("positive_rate", 0.0)) for entry in slice_results if entry.get("count", 0) > 0]
    if not rates:
        return 0.0

    if reference_group is not None:
        reference_rate = next(
            (float(entry.get("positive_rate", 0.0)) for entry in slice_results if entry.get("group") == reference_group),
            max(rates),
        )
    else:
        reference_rate = max(rates)

    if reference_rate == 0:
        return 0.0

    ratios = [rate / reference_rate for rate in rates if reference_rate > 0]
    return float(min(ratios)) if ratios else 0.0


def demographic_parity_gap(slice_results: list[dict]) -> float:
    rates = [float(entry.get("positive_rate", 0.0)) for entry in slice_results if entry.get("count", 0) > 0]
    if not rates:
        return 0.0
    return float(max(rates) - min(rates))


def chi_square_p_value(slice_results: list[dict]) -> float:
    contingency: list[list[int]] = []
    for entry in slice_results:
        count = int(entry.get("count", 0))
        if count <= 0:
            continue
        positives = int(entry.get("tp", 0)) + int(entry.get("fp", 0))
        negatives = max(0, count - positives)
        contingency.append([positives, negatives])

    if len(contingency) < 2:
        return 1.0

    _, p_value, _, _ = chi2_contingency(contingency)
    if np.isnan(p_value):
        return 1.0
    return float(p_value)


def assign_verdict(disparate_impact: float, parity_gap: float, p_value: float) -> str:
    if disparate_impact < DISPARATE_IMPACT_THRESHOLD and (
        p_value < SIGNIFICANCE_THRESHOLD or parity_gap > PARITY_GAP_THRESHOLD
    ):
        return "BIASED"

    if (
        disparate_impact < (DISPARATE_IMPACT_THRESHOLD + 0.10)
        or parity_gap > PARITY_GAP_THRESHOLD
        or p_value < AMBIGUOUS_THRESHOLD
    ):
        return "AMBIGUOUS"

    return "CLEAN"


def summarize_column_metrics(slice_result: dict) -> dict:
    slice_results = slice_result.get("slice_results", [])
    reference_group = slice_result.get("reference_group")

    disparate_impact = disparate_impact_ratio(slice_results, reference_group=reference_group)
    parity_gap = demographic_parity_gap(slice_results)
    p_value = chi_square_p_value(slice_results)
    verdict = assign_verdict(disparate_impact, parity_gap, p_value)

    return {
        "name": slice_result.get("group_column"),
        "disparate_impact": round(float(disparate_impact), 6),
        "parity_gap": round(float(parity_gap), 6),
        "p_value": round(float(p_value), 6),
        "verdict": verdict,
        "slice_gap_max": round(float(slice_result.get("slice_gap_max", 0.0)), 6),
        "gap_flagged": bool(slice_result.get("gap_flagged", False)),
        "reference_group": reference_group,
        "slices": [
            {
                "group": _python_value(entry.get("group")),
                "positive_rate": round(float(entry.get("positive_rate", 0.0)), 6),
                "fpr": round(float(entry.get("fpr", 0.0)), 6),
                "fnr": round(float(entry.get("fnr", 0.0)), 6),
                "count": int(entry.get("count", 0)),
                "gap_from_reference": round(float(entry.get("gap_from_reference", 0.0)), 6),
                "gap_flagged": bool(entry.get("gap_flagged", False)),
            }
            for entry in slice_results
        ],
        "what_if_tool": slice_result.get("what_if_tool"),
    }


def _resolve_output_path(output_path: str | None = None) -> Path:
    if output_path:
        return Path(output_path).resolve()
    return _project_root() / "schemas" / "bias_report.json"


def build_bias_report(
    df: pd.DataFrame,
    schema_map: dict,
    *,
    label_column: str | None = None,
    prediction_column: str | None = None,
    positive_label: Any = 1,
    proxy_flags: dict | None = None,
    output_path: str | None = None,
    sample_size: int | None = None,
) -> dict:
    del proxy_flags  # reserved for future proxy-aware score routing

    protected_columns = _protected_columns(schema_map)
    outcome_columns = schema_map.get("columns", {}).get("outcome", [])
    if label_column is None:
        label_column = prediction_column or (outcome_columns[0]["name"] if outcome_columns else None)

    if prediction_column is None:
        prediction_column = label_column

    if label_column is None or prediction_column is None:
        raise ValueError("build_bias_report requires at least one label or prediction column")

    working = df.copy()
    if sample_size is not None and len(working) > sample_size:
        working = working.sample(n=sample_size, random_state=42).reset_index(drop=True)

    column_results: list[dict] = []
    for protected_column in protected_columns:
        if protected_column not in working.columns:
            continue

        slice_result = evaluate_slices(
            working,
            protected_column,
            label_column,
            prediction_column,
            positive_label=positive_label,
            include_wit_payload=True,
        )
        column_results.append(summarize_column_metrics(slice_result))

    bias_report = {
        "version": SCHEMA_VERSION,
        "generated_by": "m2-bias-statistics",
        "dataset": schema_map.get("dataset"),
        "column_results": column_results,
        "summary": {
            "biased": sum(1 for entry in column_results if entry["verdict"] == "BIASED"),
            "ambiguous": sum(1 for entry in column_results if entry["verdict"] == "AMBIGUOUS"),
            "clean": sum(1 for entry in column_results if entry["verdict"] == "CLEAN"),
        },
    }

    resolved_output_path = _resolve_output_path(output_path)
    resolved_output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(resolved_output_path, "w", encoding="utf-8") as handle:
        json.dump(bias_report, handle, indent=2)

    return bias_report
