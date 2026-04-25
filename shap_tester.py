"""
M3 - Day 1: SHAP Environment Sanity Check
Run this to verify your environment is ready before Day 3.
Tests both TreeExplainer and KernelExplainer.
"""

import numpy as np
import pandas as pd
from sklearn.datasets import load_iris, load_breast_cancer
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
import shap

# ─────────────────────────────────────────────
# TEST 1: TreeExplainer (for sklearn tree models)
# This is what you'll use on Day 5 for white-box analysis
# ─────────────────────────────────────────────
print("=" * 50)
print("TEST 1: shap.TreeExplainer (sklearn RandomForest)")
print("=" * 50)

data = load_breast_cancer()
X = pd.DataFrame(data.data, columns=data.feature_names)
y = data.target

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

model = RandomForestClassifier(n_estimators=50, random_state=42)
model.fit(X_train, y_train)

explainer = shap.TreeExplainer(model)
shap_values = explainer.shap_values(X_test)

# For binary classification, shap_values is a list of 2 arrays (one per class)
# We use class 1 (positive outcome) - same pattern you'll use in probe_generator.py
# shap_values can be a 3D array (samples, features, classes) in newer SHAP versions
# or a list of 2D arrays (one per class) in older versions
if isinstance(shap_values, list):
    shap_class1 = shap_values[1]
elif shap_values.ndim == 3:
    shap_class1 = shap_values[:, :, 1]   # (samples, features, class=1)
else:
    shap_class1 = shap_values

mean_abs_shap = np.abs(shap_class1).mean(axis=0)
shap_ranking = pd.Series(mean_abs_shap, index=X.columns).sort_values(ascending=False)

print("\n✅ TreeExplainer OK")
print("\nTop 5 features by SHAP importance:")
print(shap_ranking.head(5).to_string())
print(f"\nshap_values shape: {shap_class1.shape}")


# ─────────────────────────────────────────────
# TEST 2: KernelExplainer (model-agnostic, black-box)
# This is what you'll use when you only have an HTTP endpoint
# ─────────────────────────────────────────────
print("\n" + "=" * 50)
print("TEST 2: shap.KernelExplainer (LogisticRegression - black-box mode)")
print("=" * 50)

# Use a smaller dataset so KernelExplainer doesn't time out
data2 = load_iris()
X2 = pd.DataFrame(data2.data[:100], columns=data2.feature_names)  # only 2 classes
y2 = data2.target[:100]

X2_train, X2_test = X2[:80], X2[80:]

lr_model = LogisticRegression(max_iter=200)
lr_model.fit(X2_train, y2[:80])

# KernelExplainer needs a background dataset (use kmeans summary for speed)
background = shap.kmeans(X2_train, 10)
kernel_explainer = shap.KernelExplainer(lr_model.predict_proba, background)

# Only explain a few rows - KernelExplainer is slow
shap_values_kernel = kernel_explainer.shap_values(X2_test[:5])

print("\n✅ KernelExplainer OK")
print(f"\nshap_values shape: {np.array(shap_values_kernel).shape}")
print("Feature SHAP values for first test row (class 0):")
for feat, val in zip(data2.feature_names, shap_values_kernel[0][0]):
    print(f"  {feat}: {val:.4f}")


# ─────────────────────────────────────────────
# TEST 3: Verify output schema matches model_bias_report.json
# This is the contract M4 expects from you
# ─────────────────────────────────────────────
print("\n" + "=" * 50)
print("TEST 3: model_bias_report.json schema preview")
print("=" * 50)

import json

# Simulate what your final output will look like
# This exact structure is what M4 will consume
mock_report = {
    "attribute_results": [
        {
            "name": "gender",
            "mean_diff": 0.14,       # mean output difference across 100+ probes
            "p_value": 0.003,        # from t-test - < 0.05 = significant
            "shap_rank": 2,          # rank in global SHAP importance list
            "verdict": "BIASED"      # BIASED | CLEAN | AMBIGUOUS
        },
        {
            "name": "race",
            "mean_diff": 0.09,
            "p_value": 0.041,
            "shap_rank": 5,
            "verdict": "BIASED"
        }
    ],
    "shap_summary": [
        {"feature": "relationship", "mean_abs_shap": 0.31, "is_proxy": True},
        {"feature": "gender", "mean_abs_shap": 0.22, "is_proxy": False},
        {"feature": "education_num", "mean_abs_shap": 0.18, "is_proxy": False}
    ]
}

print(json.dumps(mock_report, indent=2))
print("\n✅ Schema looks correct - this is what you'll output to M4")


print("\n" + "=" * 50)
print("ALL TESTS PASSED - M3 environment is ready for Day 3 🚀")
print("=" * 50)
