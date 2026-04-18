"""
M2 - counterfactual_engine.py

Counterfactual row-cloning utilities for bias analysis.

This module is intentionally model-agnostic. Callers provide either:
  - a score_fn(row_dict) -> float, or
  - an outcome_column name that can be converted into a binary score.

It also supports proxy-aware grouped variation by reading the correlated
columns emitted by backend/proxy_detection.py.
"""

from __future__ import annotations

import json
import random
from pathlib import Path
from typing import Any, Callable

import numpy as np
import pandas as pd


def _project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def load_schema_map(path: str | None = None) -> dict:
    schema_path = Path(path) if path else _project_root() / "schemas" / "schema_map.json"
    with open(schema_path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def load_proxy_flags(path: str | None = None) -> dict:
    proxy_path = Path(path) if path else _project_root() / "schemas" / "proxy_flags.json"
    with open(proxy_path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def _python_value(value: Any) -> Any:
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return float(value)
    if isinstance(value, (np.bool_,)):
        return bool(value)
    return value


def _is_missing(value: Any) -> bool:
    try:
        return bool(pd.isna(value))
    except Exception:
        return False


def _values_equal(left: Any, right: Any) -> bool:
    if _is_missing(left) and _is_missing(right):
        return True
    return left == right


def _binary_score(value: Any, positive_label: Any = 1) -> float:
    if _is_missing(value):
        return 0.0

    if isinstance(value, (np.bool_, bool)):
        return 1.0 if bool(value) else 0.0

    if isinstance(value, (int, float, np.integer, np.floating)):
        return 1.0 if float(value) >= 0.5 else 0.0

    normalized = str(value).strip().lower()
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
    return 1.0 if normalized in positive_tokens else 0.0


def _build_proxy_lookup(proxy_flags: dict | None) -> dict[str, list[str]]:
    lookup: dict[str, list[str]] = {}
    if not proxy_flags:
        return lookup

    for entry in proxy_flags.get("proxy_columns", []):
        protected = entry.get("proxies_for")
        candidate = entry.get("column")
        if not protected or not candidate:
            continue
        lookup.setdefault(protected, [])
        if candidate not in lookup[protected]:
            lookup[protected].append(candidate)
    return lookup


class CounterfactualEngine:
    """
    Clone rows and vary a protected column while keeping correlated proxy
    features aligned to the target group when proxy data is available.
    """

    def __init__(
        self,
        score_fn: Callable[[dict], float] | None = None,
        outcome_column: str | None = None,
        positive_label: Any = 1,
        proxy_flags: dict | None = None,
        random_state: int = 42,
    ):
        self.score_fn = score_fn
        self.outcome_column = outcome_column
        self.positive_label = positive_label
        self.proxy_lookup = _build_proxy_lookup(proxy_flags)
        self.rng = random.Random(random_state)

    def _score_row(self, row: dict) -> float:
        if self.score_fn is not None:
            return float(self.score_fn(row))
        if not self.outcome_column:
            raise ValueError("counterfactual scoring requires either score_fn or outcome_column")
        return _binary_score(row.get(self.outcome_column), self.positive_label)

    def _candidate_values(self, df: pd.DataFrame, protected_column: str) -> list[Any]:
        values = []
        for value in df[protected_column].dropna().unique().tolist():
            python_value = _python_value(value)
            if python_value not in values:
                values.append(python_value)
        return values

    def _proxy_columns(self, protected_column: str) -> list[str]:
        return list(self.proxy_lookup.get(protected_column, []))

    def _sample_donor_row(self, df: pd.DataFrame, protected_column: str, target_value: Any) -> dict | None:
        donor_pool = df[df[protected_column].apply(lambda value: _values_equal(value, target_value))]
        if donor_pool.empty:
            return None
        donor = donor_pool.sample(n=1, random_state=self.rng.randrange(1_000_000_000)).iloc[0]
        return donor.to_dict()

    def _counterfactual_row(
        self,
        base_row: dict,
        df: pd.DataFrame,
        protected_column: str,
        target_value: Any,
    ) -> dict:
        counterfactual = dict(base_row)
        counterfactual[protected_column] = target_value

        proxy_columns = self._proxy_columns(protected_column)
        if not proxy_columns:
            return counterfactual

        donor = self._sample_donor_row(df, protected_column, target_value)
        if donor is None:
            return counterfactual

        for proxy_column in proxy_columns:
            if proxy_column in donor:
                counterfactual[proxy_column] = donor[proxy_column]

        return counterfactual

    def summarize_column(
        self,
        df: pd.DataFrame,
        protected_column: str,
        sample_size: int = 250,
    ) -> dict:
        if protected_column not in df.columns:
            return {
                "name": protected_column,
                "status": "SKIPPED",
                "reason": "missing column",
                "candidate_values": [],
                "proxy_columns": self._proxy_columns(protected_column),
                "n_pairs": 0,
                "pairwise_shifts": [],
            }

        working = df.dropna(subset=[protected_column]).copy()
        if working.empty:
            return {
                "name": protected_column,
                "status": "SKIPPED",
                "reason": "no usable rows",
                "candidate_values": [],
                "proxy_columns": self._proxy_columns(protected_column),
                "n_pairs": 0,
                "pairwise_shifts": [],
            }

        if sample_size and len(working) > sample_size:
            working = working.sample(n=sample_size, random_state=self.rng.randrange(1_000_000_000))

        candidate_values = self._candidate_values(working, protected_column)
        if len(candidate_values) < 2:
            return {
                "name": protected_column,
                "status": "SKIPPED",
                "reason": "fewer than 2 unique values",
                "candidate_values": candidate_values,
                "proxy_columns": self._proxy_columns(protected_column),
                "n_pairs": 0,
                "pairwise_shifts": [],
            }

        pairwise_shifts: list[dict[str, Any]] = []
        for _, row in working.iterrows():
            base_row = {key: _python_value(value) for key, value in row.to_dict().items()}
            base_score = self._score_row(base_row)

            for target_value in candidate_values:
                if _values_equal(base_row.get(protected_column), target_value):
                    continue

                counterfactual_row = self._counterfactual_row(base_row, working, protected_column, target_value)
                counter_score = self._score_row(counterfactual_row)
                shift = float(counter_score - base_score)

                pairwise_shifts.append(
                    {
                        "base_value": _python_value(base_row.get(protected_column)),
                        "target_value": _python_value(target_value),
                        "base_score": round(float(base_score), 6),
                        "counter_score": round(float(counter_score), 6),
                        "shift": round(shift, 6),
                    }
                )

        shifts = [entry["shift"] for entry in pairwise_shifts]
        mean_shift = float(np.mean(shifts)) if shifts else 0.0
        mean_abs_shift = float(np.mean(np.abs(shifts))) if shifts else 0.0

        return {
            "name": protected_column,
            "status": "OK",
            "candidate_values": candidate_values,
            "proxy_columns": self._proxy_columns(protected_column),
            "n_rows": int(len(working)),
            "n_pairs": int(len(pairwise_shifts)),
            "mean_shift": round(mean_shift, 6),
            "mean_abs_shift": round(mean_abs_shift, 6),
            "max_shift": round(float(np.max(shifts)), 6) if shifts else 0.0,
            "min_shift": round(float(np.min(shifts)), 6) if shifts else 0.0,
            "pairwise_shifts": pairwise_shifts,
        }

    def run(self, df: pd.DataFrame, protected_columns: list[str], sample_size: int = 250) -> list[dict]:
        return [self.summarize_column(df, column, sample_size=sample_size) for column in protected_columns]


def run_counterfactuals(
    df: pd.DataFrame,
    protected_columns: list[str],
    *,
    score_fn: Callable[[dict], float] | None = None,
    outcome_column: str | None = None,
    positive_label: Any = 1,
    proxy_flags: dict | None = None,
    sample_size: int = 250,
    random_state: int = 42,
) -> list[dict]:
    engine = CounterfactualEngine(
        score_fn=score_fn,
        outcome_column=outcome_column,
        positive_label=positive_label,
        proxy_flags=proxy_flags,
        random_state=random_state,
    )
    return engine.run(df, protected_columns, sample_size=sample_size)
