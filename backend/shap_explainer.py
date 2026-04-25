import sys, io
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

"""
M3 - shap_explainer.py  (complete implementation)

What this does:
- Accept a trained model (sklearn pickle OR any callable)
- Run TreeExplainer for sklearn/tree models (fast, exact)
- Run KernelExplainer for everything else (model-agnostic, slower)
- Cross-reference top SHAP features against PROTECTED + PROXY columns from M1
- Return shap_summary list and shap_rank lookup for model_bias_report.json
"""

import shap
import numpy as np
import pandas as pd
from typing import Optional


class SHAPExplainer:
    """
    SHAP-based feature attribution for M3.
    Automatically picks TreeExplainer or KernelExplainer based on model type.
    """

    def __init__(self, model, X_background: pd.DataFrame, model_type: str = "auto"):
        """
        Args:
            model: trained sklearn model object (or any callable with predict_proba)
            X_background: DataFrame of background/training samples for KernelExplainer
            model_type: 'tree' | 'kernel' | 'auto'
                        'auto' tries TreeExplainer first, falls back to KernelExplainer
        """
        self.model = model
        self.X_background = X_background
        self.model_type = model_type
        self._explainer = None
        self._explainer_mode = None  # 'tree' or 'kernel'
        self._shap_summary_cache = None

    def _build_explainer(self):
        if self.model_type in ("tree", "auto"):
            try:
                explainer = shap.TreeExplainer(self.model)
                self._explainer_mode = "tree"
                return explainer
            except Exception as e:
                if self.model_type == "tree":
                    raise RuntimeError(f"TreeExplainer failed: {e}") from e
                print(f"  [SHAP] TreeExplainer not available ({e}), falling back to KernelExplainer")

        # KernelExplainer - summarise background to 10 centroids for speed
        background = shap.kmeans(self.X_background, min(10, len(self.X_background)))
        predict_fn = self.model.predict_proba if hasattr(self.model, "predict_proba") else self.model.predict
        explainer = shap.KernelExplainer(predict_fn, background)
        self._explainer_mode = "kernel"
        return explainer

    def _shap_values_class1(self, shap_values) -> np.ndarray:
        """Normalise SHAP output to 2D (samples x features) for class 1."""
        if isinstance(shap_values, list):
            return np.array(shap_values[1])
        if isinstance(shap_values, np.ndarray) and shap_values.ndim == 3:
            return shap_values[:, :, 1]
        return shap_values

    def explain(
        self,
        X_test: pd.DataFrame,
        protected_columns: list,
        proxy_columns: list,
        max_rows: int = 200,
    ) -> list:
        """
        Compute global SHAP feature importance and cross-reference with protected/proxy columns.

        Returns:
            list of dicts sorted by mean_abs_shap descending:
            [{ feature, mean_abs_shap, shap_rank, is_protected, is_proxy }, ...]
        """
        if self._explainer is None:
            self._explainer = self._build_explainer()

        X_explain = X_test.head(max_rows)
        print(f"  [SHAP] Running {self._explainer_mode} explainer on {len(X_explain)} rows ...")

        shap_values = self._explainer.shap_values(X_explain)
        sv = self._shap_values_class1(shap_values)
        mean_abs = np.abs(sv).mean(axis=0)

        protected_set = set(protected_columns)
        proxy_set = set(proxy_columns)

        summary = []
        for i, col in enumerate(X_explain.columns):
            summary.append({
                "feature": col,
                "mean_abs_shap": round(float(mean_abs[i]), 4),
                "is_protected": col in protected_set,
                "is_proxy": col in proxy_set,
            })

        summary.sort(key=lambda x: x["mean_abs_shap"], reverse=True)
        for rank, entry in enumerate(summary, start=1):
            entry["shap_rank"] = rank

        self._shap_summary_cache = summary
        print(f"  [SHAP] Done. Top feature: '{summary[0]['feature']}' (mean |SHAP|={summary[0]['mean_abs_shap']})")
        return summary

    def get_shap_rank(self, feature_name: str) -> Optional[int]:
        """Return SHAP rank (1=most important) for a feature. Call explain() first."""
        if self._shap_summary_cache is None:
            return None
        for entry in self._shap_summary_cache:
            if entry["feature"] == feature_name:
                return entry["shap_rank"]
        return None

    def get_summary_for_m4(self) -> list:
        """Return shap_summary in the exact schema M4 expects."""
        if self._shap_summary_cache is None:
            return []
        return [
            {
                "feature": e["feature"],
                "mean_abs_shap": e["mean_abs_shap"],
                "shap_rank": e["shap_rank"],
                "is_protected": e["is_protected"],
                "is_proxy": e["is_proxy"],
            }
            for e in self._shap_summary_cache
        ]

    @staticmethod
    def load_model_from_pickle(path: str):
        """Convenience loader for sklearn pickle files."""
        import pickle
        with open(path, "rb") as f:
            return pickle.load(f)


if __name__ == "__main__":
    import json
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.linear_model import LogisticRegression
    from sklearn.model_selection import train_test_split
    from sklearn.datasets import load_breast_cancer, load_iris

    print("=" * 55)
    print("SHAPExplainer - self-test")
    print("=" * 55)

    print("\nTEST 1: TreeExplainer (RandomForest)")
    data = load_breast_cancer()
    X = pd.DataFrame(data.data, columns=data.feature_names)
    y = data.target
    X_train, X_test, y_train, _ = train_test_split(X, y, test_size=0.2, random_state=42)
    model = RandomForestClassifier(n_estimators=50, random_state=42)
    model.fit(X_train, y_train)

    explainer = SHAPExplainer(model, X_background=X_train, model_type="tree")
    summary = explainer.explain(X_test, protected_columns=["mean radius"], proxy_columns=["mean perimeter"])
    print(f"  Top 3: {[e['feature'] for e in summary[:3]]}")
    print(f"  Rank of 'mean radius': {explainer.get_shap_rank('mean radius')}")
    print("  OK TreeExplainer")

    print("\nTEST 2: auto mode fallback to KernelExplainer (LogisticRegression)")
    data2 = load_iris()
    X2 = pd.DataFrame(data2.data[:100], columns=data2.feature_names)
    y2 = data2.target[:100]
    lr = LogisticRegression(max_iter=200).fit(X2[:80], y2[:80])
    exp2 = SHAPExplainer(lr, X_background=X2[:80], model_type="auto")
    summary2 = exp2.explain(X2[80:], protected_columns=[], proxy_columns=[])
    print(f"  Features: {[e['feature'] for e in summary2]}")
    print("  OK KernelExplainer fallback")

    print("\nTEST 3: M4 output schema")
    mock_report = {
        "attribute_results": [
            {"name": "gender", "mean_diff": 0.14, "p_value": 0.003, "shap_rank": 2, "verdict": "BIASED"},
        ],
        "shap_summary": explainer.get_summary_for_m4()[:3]
    }
    print(json.dumps(mock_report, indent=2))
    print("\nAll tests passed - shap_explainer.py ready")
