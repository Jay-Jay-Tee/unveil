"""
M3 — probe_generator.py  (stub — build this on Day 3)

What this will do:
- Generate synthetic persona pairs differing only in one protected attribute
- POST each pair to /predict endpoint (or call local model function)
- Run 100+ probes per attribute
- Compute mean output difference + t-test p-value
- Return results ready for model_bias_report.json
"""

# Day 3 imports (uncomment when building)
# import numpy as np
# import pandas as pd
# from scipy import stats
# import requests
# from typing import Callable, Optional


class ProbeGenerator:
    """
    Black-box probe system for M3.
    Accepts a model as either:
      - A callable Python function: model_fn(features_dict) -> float
      - An HTTP endpoint: POST to model_endpoint with features JSON
    """

    def __init__(self, model_fn=None, model_endpoint: str = None):
        """
        Args:
            model_fn: callable that takes a dict of features, returns probability float
            model_endpoint: URL string to POST feature rows to
        """
        # TODO Day 3: store model_fn and model_endpoint
        # Validate that at least one is provided
        pass

    def _predict(self, features: dict) -> float:
        """
        Internal: call whichever model interface was provided.
        Returns a probability score [0.0, 1.0].
        """
        # TODO Day 3:
        # if self.model_fn:
        #     return self.model_fn(features)
        # elif self.model_endpoint:
        #     resp = requests.post(self.model_endpoint, json={"features": features})
        #     return resp.json()["probability"]
        pass

    def run(self, protected_columns: list, sample_data: list, n_probes: int = 100) -> list:
        """
        Run probes for all protected columns.

        Args:
            protected_columns: list of column names to probe (from M1's schema_map.json)
            sample_data: list of real feature row dicts to base probes on
            n_probes: number of probe pairs per attribute

        Returns:
            list of dicts: [{name, mean_diff, p_value, verdict}, ...]
        """
        # TODO Day 3:
        # results = []
        # for col in protected_columns:
        #     unique_vals = list(set(row[col] for row in sample_data))
        #     diffs = []
        #     for _ in range(n_probes):
        #         base_row = random.choice(sample_data).copy()
        #         val_a, val_b = random.sample(unique_vals, 2)
        #         row_a = {**base_row, col: val_a}
        #         row_b = {**base_row, col: val_b}
        #         diff = abs(self._predict(row_a) - self._predict(row_b))
        #         diffs.append(diff)
        #     t_stat, p_value = stats.ttest_1samp(diffs, 0)
        #     results.append({
        #         "name": col,
        #         "mean_diff": round(float(np.mean(diffs)), 4),
        #         "p_value": round(float(p_value), 4),
        #         "verdict": "BIASED" if p_value < 0.05 and np.mean(diffs) > 0.05 else "CLEAN"
        #     })
        # return results
        pass