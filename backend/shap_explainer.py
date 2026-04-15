"""
M3 — shap_explainer.py  (stub — build this on Day 5)

What this will do:
- Accept a trained model (sklearn pickle OR any callable)
- Run TreeExplainer for sklearn/tree models (fast)
- Run KernelExplainer for everything else (model-agnostic)
- Cross-reference top SHAP features against PROTECTED + PROXY columns from M1
- Return shap_summary list for model_bias_report.json
"""

# Day 5 imports (uncomment when building)
# import shap
# import numpy as np
# import pandas as pd
# from typing import Optional


class SHAPExplainer:
    """
    SHAP-based feature attribution for M3.
    Automatically picks TreeExplainer or KernelExplainer based on model type.
    """

    def __init__(self, model, X_background, model_type: str = "auto"):
        """
        Args:
            model: trained model object (sklearn, xgboost, etc.)
            X_background: DataFrame of background samples for KernelExplainer
            model_type: 'tree' | 'kernel' | 'auto'
                        'auto' will try TreeExplainer first, fall back to Kernel
        """
        # TODO Day 5: store model, X_background, model_type
        pass

    def _build_explainer(self):
        """
        Pick the right SHAP explainer.
        TreeExplainer: fast, works on RandomForest, XGBoost, DecisionTree, etc.
        KernelExplainer: slow but universal — works on any model with predict/predict_proba.
        """
        # TODO Day 5:
        # if self.model_type == "tree" or self.model_type == "auto":
        #     try:
        #         return shap.TreeExplainer(self.model), "tree"
        #     except Exception:
        #         if self.model_type == "tree":
        #             raise
        # background = shap.kmeans(self.X_background, 10)  # summarize background
        # return shap.KernelExplainer(self.model.predict_proba, background), "kernel"
        pass

    def explain(self, X_test, protected_columns: list, proxy_columns: list) -> list:
        """
        Compute global SHAP feature importance and cross-reference with protected/proxy columns.

        Args:
            X_test: DataFrame of rows to explain
            protected_columns: from M1's schema_map.json
            proxy_columns: from M1's proxy_flags.json

        Returns:
            list of dicts: [{feature, mean_abs_shap, is_proxy, is_protected}, ...]
            sorted by mean_abs_shap descending
        """
        # TODO Day 5:
        # explainer, mode = self._build_explainer()
        # shap_values = explainer.shap_values(X_test)
        # if isinstance(shap_values, list):
        #     shap_values = shap_values[1]   # class 1 for binary classification
        # mean_abs = np.abs(shap_values).mean(axis=0)
        # flagged = set(protected_columns + proxy_columns)
        # summary = []
        # for i, col in enumerate(X_test.columns):
        #     summary.append({
        #         "feature": col,
        #         "mean_abs_shap": round(float(mean_abs[i]), 4),
        #         "is_proxy": col in proxy_columns,
        #         "is_protected": col in protected_columns
        #     })
        # return sorted(summary, key=lambda x: x["mean_abs_shap"], reverse=True)
        pass

    def get_shap_rank(self, feature_name: str, X_test, protected_columns: list, proxy_columns: list) -> int:
        """
        Get the SHAP rank (1 = most important) for a specific feature.
        Used to populate shap_rank in attribute_results.
        """
        # TODO Day 5: call explain(), find feature, return index+1
        pass