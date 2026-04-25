# backend/train_demo_model.py
# Run once from repo root to generate the demo model pickle:
#   python backend/train_demo_model.py
#
# Trains a logistic regression on UCI Adult (adult_fixed.csv).
# Output: backend/demo_model.pkl - used as fallback in /analyze/model
# when no model file is uploaded by the user.

import pickle
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.pipeline import Pipeline

df = pd.read_csv("data/adult_fixed.csv")

df_enc = df.copy()
for col in df_enc.select_dtypes(include="object").columns:
    df_enc[col] = LabelEncoder().fit_transform(df_enc[col].astype(str))

X = df_enc.drop(columns=["income"])
y = df_enc["income"]

model = Pipeline([
    ("scaler", StandardScaler()),
    ("clf", LogisticRegression(max_iter=5000, random_state=67)),
])
model.fit(X, y)

with open("backend/demo_model.pkl", "wb") as f:
    pickle.dump(model, f)

print("Done - backend/demo_model.pkl written")
