"""
Unveil - stats.py  (REVAMPED)

Key change: we now also produce a column_result for AMBIGUOUS (proxy-candidate)
columns so the UI stops showing "No bias metrics for this column".

For AMBIGUOUS columns we compute:
  - proxy_strength: how much this column encodes the protected attribute it's
    suspected of proxying for (Cramér's V, 0-1)
  - slice stats (positive_rate, fpr, fnr) grouped by the binned values of this
    column - same as for PROTECTED columns
  - a verdict: BIASED if proxy_strength > 0.5 AND outcome gap > 10pp,
               AMBIGUOUS if one of those,
               CLEAN otherwise

This means every column the user could reasonably care about now has a
real, explainable metric attached.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Optional

import numpy as np
import pandas as pd
from scipy.stats import chi2_contingency

try:
    from .slice_eval import evaluate_slices
except ImportError:
    from slice_eval import evaluate_slices


SCHEMA_VERSION = "1.1.0"
DISPARATE_IMPACT_THRESHOLD = 0.80
PARITY_GAP_THRESHOLD = 0.10
SIGNIFICANCE_THRESHOLD = 0.05
AMBIGUOUS_THRESHOLD = 0.10
PROXY_STRENGTH_THRESHOLD = 0.30


def _python_value(value: Any) -> Any:
    if isinstance(value, np.integer):
        return int(value)
    if isinstance(value, np.floating):
        return float(value)
    if isinstance(value, np.bool_):
        return bool(value)
    return value


def disparate_impact_ratio(slice_results: list[dict], reference_group: Optional[Any] = None) -> float:
    rates = [float(r.get("positive_rate", 0.0)) for r in slice_results if r.get("count", 0) > 0]
    if not rates:
        return 0.0
    if reference_group is not None:
        ref_rate = next((float(r.get("positive_rate", 0.0)) for r in slice_results if r.get("group") == reference_group), max(rates))
    else:
        ref_rate = max(rates)
    if ref_rate == 0:
        return 0.0
    ratios = [rate / ref_rate for rate in rates]
    return float(min(ratios))


def demographic_parity_gap(slice_results: list[dict]) -> float:
    rates = [float(r.get("positive_rate", 0.0)) for r in slice_results if r.get("count", 0) > 0]
    if not rates:
        return 0.0
    return float(max(rates) - min(rates))


def chi_square_p_value(slice_results: list[dict]) -> float:
    contingency = []
    for r in slice_results:
        count = int(r.get("count", 0))
        if count <= 0:
            continue
        pos = int(r.get("tp", 0)) + int(r.get("fp", 0))
        neg = max(0, count - pos)
        contingency.append([pos, neg])
    if len(contingency) < 2:
        return 1.0
    try:
        _, p, _, _ = chi2_contingency(contingency)
        return 1.0 if np.isnan(p) else float(p)
    except Exception:
        return 1.0


def cramers_v(series_a: pd.Series, series_b: pd.Series) -> float:
    """Symmetric correlation for two categorical variables, 0 to 1."""
    a = series_a.astype(str).fillna("__MISSING__")
    b = series_b.astype(str).fillna("__MISSING__")
    ct = pd.crosstab(a, b)
    if ct.size == 0:
        return 0.0
    try:
        chi2, _, _, _ = chi2_contingency(ct)
        n = ct.values.sum()
        if n == 0:
            return 0.0
        phi2 = chi2 / n
        r, k = ct.shape
        if min(r - 1, k - 1) == 0:
            return 0.0
        v = float(np.sqrt(phi2 / min(r - 1, k - 1)))
        return max(0.0, min(1.0, v))
    except Exception:
        return 0.0


def assign_verdict(disparate_impact: float, parity_gap: float, p_value: float) -> str:
    if disparate_impact < DISPARATE_IMPACT_THRESHOLD and (p_value < SIGNIFICANCE_THRESHOLD or parity_gap > PARITY_GAP_THRESHOLD):
        return "BIASED"
    if disparate_impact < (DISPARATE_IMPACT_THRESHOLD + 0.10) or parity_gap > PARITY_GAP_THRESHOLD or p_value < AMBIGUOUS_THRESHOLD:
        return "AMBIGUOUS"
    return "CLEAN"


def assign_proxy_verdict(proxy_strength: float, parity_gap: float, p_value: float) -> str:
    """Verdict logic specifically for proxy-candidate (AMBIGUOUS) columns."""
    if proxy_strength > 0.5 and (parity_gap > PARITY_GAP_THRESHOLD or p_value < SIGNIFICANCE_THRESHOLD):
        return "BIASED"
    if proxy_strength > PROXY_STRENGTH_THRESHOLD or parity_gap > PARITY_GAP_THRESHOLD:
        return "AMBIGUOUS"
    return "CLEAN"


def summarize_column_metrics(slice_result: dict, *, role: str = "PROTECTED", proxy_strength: Optional[float] = None, proxy_targets: Optional[list[str]] = None) -> dict:
    slice_results = slice_result.get("slice_results", [])
    reference_group = slice_result.get("reference_group")

    di = disparate_impact_ratio(slice_results, reference_group=reference_group)
    gap = demographic_parity_gap(slice_results)
    p = chi_square_p_value(slice_results)

    if role == "PROXY" and proxy_strength is not None:
        verdict = assign_proxy_verdict(proxy_strength, gap, p)
    else:
        verdict = assign_verdict(di, gap, p)

    out = {
        "name": slice_result.get("group_column"),
        "role": role,                              # NEW - 'PROTECTED' or 'PROXY'
        "disparate_impact": round(float(di), 6),
        "parity_gap": round(float(gap), 6),
        "p_value": round(float(p), 6),
        "verdict": verdict,
        "binning": slice_result.get("binning", "none"),      # NEW
        "slice_gap_max": round(float(slice_result.get("slice_gap_max", 0.0)), 6),
        "positive_rate_gap_max": round(float(slice_result.get("positive_rate_gap_max", 0.0)), 6),
        "fpr_gap_max": round(float(slice_result.get("fpr_gap_max", 0.0)), 6),
        "fnr_gap_max": round(float(slice_result.get("fnr_gap_max", 0.0)), 6),
        "gap_flagged": bool(slice_result.get("gap_flagged", False)),
        "reference_group": reference_group,
        "reference_positive_rate": round(float(slice_result.get("reference_positive_rate", 0.0)), 6),
        "reference_fpr": round(float(slice_result.get("reference_fpr", 0.0)), 6),
        "reference_fnr": round(float(slice_result.get("reference_fnr", 0.0)), 6),
        "slices": [
            {
                "group": _python_value(r.get("group")),
                "positive_rate": round(float(r.get("positive_rate", 0.0)), 6),
                "fpr": round(float(r.get("fpr", 0.0)), 6),
                "fnr": round(float(r.get("fnr", 0.0)), 6),
                "count": int(r.get("count", 0)),
                "small_sample": bool(r.get("small_sample", False)),
                "gap_from_reference": round(float(r.get("gap_from_reference", 0.0)), 6),
                "positive_rate_gap_from_reference": round(float(r.get("positive_rate_gap_from_reference", r.get("gap_from_reference", 0.0))), 6),
                "fpr_gap_from_reference": round(float(r.get("fpr_gap_from_reference", 0.0)), 6),
                "fnr_gap_from_reference": round(float(r.get("fnr_gap_from_reference", 0.0)), 6),
                "gap_flagged": bool(r.get("gap_flagged", False)),
                "positive_rate_gap_flagged": bool(r.get("positive_rate_gap_flagged", False)),
                "fpr_gap_flagged": bool(r.get("fpr_gap_flagged", False)),
                "fnr_gap_flagged": bool(r.get("fnr_gap_flagged", False)),
            }
            for r in slice_results
        ],
        "what_if_tool": slice_result.get("what_if_tool"),
    }

    if proxy_strength is not None:
        out["proxy_strength"] = round(float(proxy_strength), 4)
    if proxy_targets:
        out["proxy_targets"] = proxy_targets

    return out


def build_bias_report(
    df: pd.DataFrame,
    schema_map: dict,
    *,
    label_column: Optional[str] = None,
    prediction_column: Optional[str] = None,
    positive_label: Any = 1,
    proxy_flags: Optional[dict] = None,
    output_path: Optional[str] = None,
    sample_size: Optional[int] = None,
) -> dict:
    del proxy_flags

    protected = [e["name"] for e in schema_map.get("columns", {}).get("protected", [])]
    ambiguous = schema_map.get("columns", {}).get("ambiguous", [])
    outcome_cols = schema_map.get("columns", {}).get("outcome", [])

    if label_column is None:
        label_column = prediction_column or (outcome_cols[0]["name"] if outcome_cols else None)
    if prediction_column is None:
        prediction_column = label_column
    if label_column is None:
        raise ValueError("build_bias_report requires at least one label or prediction column")

    working = df.copy()
    if sample_size and len(working) > sample_size:
        working = working.sample(n=sample_size, random_state=42).reset_index(drop=True)

    column_results: list[dict] = []

    # Protected columns - the primary audit target
    for col in protected:
        if col not in working.columns:
            continue
        sr = evaluate_slices(working, col, label_column, prediction_column, positive_label=positive_label, include_wit_payload=True)
        column_results.append(summarize_column_metrics(sr, role="PROTECTED"))

    # Proxy-candidate columns - we want these on the dashboard too
    for entry in ambiguous:
        col = entry["name"]
        proxies_for = entry.get("proxies", [])
        if col not in working.columns:
            continue

        # Proxy strength = how strongly this column correlates with the
        # protected attribute(s) it's suspected of being a stand-in for
        strength = 0.0
        best_target = None
        for target in proxies_for:
            if target in working.columns:
                s = cramers_v(working[col], working[target])
                if s > strength:
                    strength = s
                    best_target = target

        sr = evaluate_slices(working, col, label_column, prediction_column, positive_label=positive_label, include_wit_payload=True)
        column_results.append(summarize_column_metrics(
            sr, role="PROXY", proxy_strength=strength, proxy_targets=proxies_for,
        ))

    # Count for summary block
    counts = {"biased": 0, "ambiguous": 0, "clean": 0}
    for c in column_results:
        v = c["verdict"].lower()
        if v in counts:
            counts[v] += 1

    bias_report = {
        "version": SCHEMA_VERSION,
        "generated_by": "unveil-bias-statistics",
        "dataset": schema_map.get("dataset"),
        "column_results": column_results,
        "summary": counts,
    }

    if output_path:
        out_path = Path(output_path).resolve()
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(bias_report, f, indent=2)

    return bias_report

