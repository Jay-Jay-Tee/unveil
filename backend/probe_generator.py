import sys, io
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

"""
M3 — probe_generator.py  (Day 3 — complete implementation)

What this does:
- Generates synthetic persona pairs differing only in one protected attribute
- POSTs each pair to /predict endpoint (or calls local model function)
- Runs 100+ probes per attribute
- Computes mean output difference + t-test p-value
- Returns results ready for model_bias_report.json
"""

import numpy as np
import random
from scipy import stats
import requests
from typing import Callable, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed


class ProbeGenerator:
    """
    Black-box probe system for M3.
    Accepts a model as either:
      - A callable Python function: model_fn(features_dict) -> float
      - An HTTP endpoint: POST to model_endpoint with features JSON
    """

    def __init__(self, model_fn: Optional[Callable] = None, model_endpoint: Optional[str] = None):
        """
        Args:
            model_fn: callable that takes a dict of features, returns probability float
            model_endpoint: URL string to POST feature rows to (e.g. http://localhost:8001/predict)
        """
        if model_fn is None and model_endpoint is None:
            raise ValueError("ProbeGenerator requires either model_fn or model_endpoint — neither was provided.")

        self.model_fn = model_fn
        self.model_endpoint = model_endpoint

    def _predict(self, features: dict) -> float:
        """
        Internal: call whichever model interface was provided.
        Returns a probability score [0.0, 1.0].
        """
        if self.model_fn is not None:
            return float(self.model_fn(features))
        else:
            assert self.model_endpoint is not None
            resp = requests.post(self.model_endpoint, json={"features": features}, timeout=10)
            resp.raise_for_status()
            return float(resp.json()["probability"])

    @staticmethod
    def load_protected_columns(schema_map: dict) -> list:
        """
        Parse protected column names from M1's schema_map.json.
        Works with both old format (no 'type' field) and new format (with 'type' field).

        Args:
            schema_map: parsed schema_map.json dict

        Returns:
            list of protected column name strings
        """
        return [col["name"] for col in schema_map["columns"]["protected"]
                if col.get("type", "PROTECTED") == "PROTECTED" or "type" not in col]

    def _probe_pair(self, base_row: dict, col: str, unique_vals: list) -> float:
        """
        Run a single probe pair for one protected column.
        Picks two different values, clones the base row, returns absolute prediction diff.
        """
        val_a, val_b = random.sample(unique_vals, 2)
        row_a = {**base_row, col: val_a}
        row_b = {**base_row, col: val_b}
        return abs(self._predict(row_a) - self._predict(row_b))

    def run(self, protected_columns: list, sample_data: list, n_probes: int = 100) -> list:
        """
        Run probes for all protected columns in parallel.

        Args:
            protected_columns: list of column names to probe (from M1's schema_map.json)
            sample_data: list of real feature row dicts to base probes on
            n_probes: number of probe pairs per attribute (default 100)

        Returns:
            list of dicts: [{name, mean_diff, p_value, verdict}, ...]
        """
        results = []

        for col in protected_columns:
            # Collect all unique values this protected column takes in the sample data
            unique_vals = list({row[col] for row in sample_data if col in row})

            if len(unique_vals) < 2:
                print(f"  [SKIP] '{col}' has fewer than 2 unique values in sample_data — cannot probe.")
                results.append({
                    "name": col,
                    "mean_diff": None,
                    "p_value": None,
                    "verdict": "SKIPPED"
                })
                continue

            # Run all probes in parallel — 20 threads, I/O bound so threading is ideal
            with ThreadPoolExecutor(max_workers=20) as executor:
                futures = [
                    executor.submit(self._probe_pair, random.choice(sample_data).copy(), col, unique_vals)
                    for _ in range(n_probes)
                ]
                diffs = [f.result() for f in as_completed(futures)]

            # t-test: are the differences significantly different from 0?
            _, p_value = stats.ttest_1samp(diffs, 0)

            mean_diff = float(np.mean(diffs))
            p_val = float(np.asarray(p_value).item())

            # Verdict logic:
            # BIASED    — statistically significant (p < 0.05) AND meaningful difference (mean_diff > 0.05)
            # AMBIGUOUS — significant but small difference, or borderline p-value
            # CLEAN     — not significant or negligible difference
            if p_val < 0.05 and mean_diff > 0.05:
                verdict = "BIASED"
            elif p_val < 0.10 or mean_diff > 0.03:
                verdict = "AMBIGUOUS"
            else:
                verdict = "CLEAN"

            results.append({
                "name": col,
                "mean_diff": round(mean_diff, 4),
                "p_value": round(p_val, 4),
                "verdict": verdict
            })

            print(f"  [{verdict}] '{col}' — mean_diff={mean_diff:.4f}, p={p_val:.4f}")

        return results


# ─────────────────────────────────────────────
# Quick self-test — run directly to verify
# Uses the live endpoint_skeleton.py stub at port 8001
# ─────────────────────────────────────────────
if __name__ == "__main__":
    import json

    # Load protected columns from M1's updated schema_map.json
    with open("../schemas/schema_map.json") as f:
        schema_map = json.load(f)

    protected_columns = ProbeGenerator.load_protected_columns(schema_map)

    # Minimal fake sample data matching UCI Adult columns
    sample_data = [
        {"age": 35, "race": "White", "gender": "Male", "native-country": "United-States",
         "education": "Bachelors", "hours-per-week": 40, "occupation": "Exec-managerial",
         "marital-status": "Married-civ-spouse", "relationship": "Husband",
         "capital-gain": 0, "capital-loss": 0, "workclass": "Private", "fnlwgt": 77516},
        {"age": 28, "race": "Black", "gender": "Female", "native-country": "United-States",
         "education": "HS-grad", "hours-per-week": 35, "occupation": "Other-service",
         "marital-status": "Never-married", "relationship": "Not-in-family",
         "capital-gain": 0, "capital-loss": 0, "workclass": "Private", "fnlwgt": 226956},
        {"age": 45, "race": "Asian-Pac-Islander", "gender": "Male", "native-country": "India",
         "education": "Masters", "hours-per-week": 50, "occupation": "Prof-specialty",
         "marital-status": "Married-civ-spouse", "relationship": "Husband",
         "capital-gain": 5000, "capital-loss": 0, "workclass": "Self-emp-not-inc", "fnlwgt": 123456},
        {"age": 52, "race": "White", "gender": "Female", "native-country": "United-States",
         "education": "Some-college", "hours-per-week": 30, "occupation": "Craft-repair",
         "marital-status": "Divorced", "relationship": "Unmarried",
         "capital-gain": 0, "capital-loss": 200, "workclass": "Private", "fnlwgt": 334556},
    ]

    print("=" * 50)
    print("ProbeGenerator — self-test against endpoint stub")
    print("Make sure endpoint_skeleton.py is running on port 8001")
    print("  →  uvicorn endpoint_skeleton:app --reload --port 8001")
    print("=" * 50)

    try:
        generator = ProbeGenerator(model_endpoint="http://localhost:8001/predict")
        results = generator.run(protected_columns=protected_columns, sample_data=sample_data, n_probes=100)

        print("\nResults:")
        print(json.dumps(results, indent=2))
        print("\n✅ probe_generator.py working correctly")

    except requests.exceptions.ConnectionError:
        print("\n⚠️  Could not connect to endpoint — is endpoint_skeleton.py running?")
        print("  Run: uvicorn endpoint_skeleton:app --reload --port 8001")