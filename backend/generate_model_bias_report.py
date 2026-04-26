import sys, io
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

"""
M3 - generate_model_bias_report.py

Standalone runner that:
  1. Loads a trained sklearn model (pickle)
  2. Loads sample data (CSV)
  3. Reads M1's schema_map.json + proxy_flags.json
  4. Runs ProbeGenerator (black-box probing)
  5. Runs SHAPExplainer (feature attribution)
  6. Writes model_bias_report.json for M4

Usage:
  python backend/generate_model_bias_report.py \
      --model path/to/model.pkl \
      --data  path/to/data.csv \
      --schema schemas/schema_map.json \
      --proxy  schemas/proxy_flags.json \
      --out    schemas/model_bias_report.json \
      --n-probes 100

For UCI Adult demo (no model pkl - uses HTTP stub):
  # Terminal 1: uvicorn endpoint_skeleton:app --port 8001
  # Terminal 2: python backend/generate_model_bias_report.py --endpoint http://localhost:8001/predict ...
"""

import argparse
import json
import sys
import pickle
from pathlib import Path

import pandas as pd

# Allow running from repo root
sys.path.insert(0, str(Path(__file__).parent))
from backend.probe_generator import ProbeGenerator
from backend.shap_explainer import SHAPExplainer


def load_schema(schema_path: str) -> dict:
    with open(schema_path) as f:
        return json.load(f)


def load_proxy_flags(proxy_path: str) -> dict:
    with open(proxy_path) as f:
        return json.load(f)


def get_protected_columns(schema_map: dict) -> list[str]:
    return [c["name"] for c in schema_map["columns"]["protected"]]


def get_proxy_column_names(proxy_flags: dict) -> list[str]:
    return list({e["column"] for e in proxy_flags.get("proxy_columns", [])})


def build_sample_data(df: pd.DataFrame, n: int = 200) -> list[dict]:
    sample = df.sample(min(n, len(df)), random_state=42)
    return sample.to_dict(orient="records")


def run(args):
    print("=" * 55)
    print("M3 - generate_model_bias_report.py")
    print("=" * 55)

    # Load schemas
    schema_map = load_schema(args.schema)
    proxy_flags = load_proxy_flags(args.proxy)
    protected_cols = get_protected_columns(schema_map)
    proxy_col_names = get_proxy_column_names(proxy_flags)

    print(f"\nProtected columns : {protected_cols}")
    print(f"Proxy columns     : {proxy_col_names}")

    # Load data
    df = pd.read_csv(args.data)
    # Drop outcome column from sample data (don't leak labels into probes)
    outcome_cols = [c["name"] for c in schema_map["columns"]["outcome"]]
    feature_df = df.drop(columns=[c for c in outcome_cols if c in df.columns], errors="ignore")
    sample_data = build_sample_data(feature_df, n=args.sample_size)
    print(f"Sample rows       : {len(sample_data)}")

    # -- Step 1: Probe Generator ----------------------------
    print(f"\n[1/2] Running ProbeGenerator ({args.n_probes} probes per attribute) ...")

    if args.endpoint:
        generator = ProbeGenerator(model_endpoint=args.endpoint)
    elif args.model:
        with open(args.model, "rb") as f:
            model_obj = pickle.load(f)
        def model_fn(row: dict) -> float:
            row_df = pd.DataFrame([row])
            if hasattr(model_obj, "feature_names_in_"):
                for col in model_obj.feature_names_in_:
                    if col not in row_df.columns:
                        row_df[col] = 0
                row_df = row_df[model_obj.feature_names_in_]
            if hasattr(model_obj, "predict_proba"):
                return float(model_obj.predict_proba(row_df)[0][1])
            return float(model_obj.predict(row_df)[0])
        generator = ProbeGenerator(model_fn=model_fn)
    else:
        print("ERROR: Provide --model or --endpoint")
        sys.exit(1)

    probe_results = generator.run(
        protected_columns=protected_cols,
        sample_data=sample_data,
        n_probes=args.n_probes,
    )

    # -- Step 2: SHAP Explainer -----------------------------
    shap_summary = []
    shap_rank_lookup = {}

    if args.model:
        print(f"\n[2/2] Running SHAPExplainer ...")
        X_bg = feature_df.head(200)
        # Encode categoricals simply for SHAP
        X_bg_enc = X_bg.apply(lambda col: col.astype("category").cat.codes if col.dtype == object else col)
        try:
            explainer = SHAPExplainer(model_obj, X_background=X_bg_enc, model_type="auto")
            summary = explainer.explain(
                X_bg_enc,
                protected_columns=protected_cols,
                proxy_columns=proxy_col_names,
            )
            shap_summary = explainer.get_summary_for_m4()
            shap_rank_lookup = {e["feature"]: e["shap_rank"] for e in shap_summary}
        except Exception as e:
            print(f"  SHAP failed: {e} - continuing without SHAP ranks")
    else:
        print("\n[2/2] SHAP skipped (no model pickle - HTTP endpoint mode)")

    # -- Step 3: Merge → model_bias_report.json ------------
    attribute_results = []
    for probe in probe_results:
        col = probe["name"]
        attribute_results.append({
            "name": col,
            "mean_diff": probe.get("mean_diff"),
            "p_value": probe.get("p_value"),
            "shap_rank": shap_rank_lookup.get(col),
            "verdict": probe.get("verdict", "SKIPPED"),
        })

    report = {
        "attribute_results": attribute_results,
        "shap_summary": shap_summary,
    }

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(report, f, indent=2)

    print(f"\n model_bias_report.json written → {out_path}")
    print(json.dumps(report, indent=2))
    return report


def main():
    parser = argparse.ArgumentParser(description="M3 model bias report generator")
    parser.add_argument("--model",    help="Path to sklearn pickle (.pkl)")
    parser.add_argument("--endpoint", help="HTTP predict endpoint URL (alternative to --model)")
    parser.add_argument("--data",     required=True, help="Path to dataset CSV")
    parser.add_argument("--schema",   default="schemas/schema_map.json")
    parser.add_argument("--proxy",    default="schemas/proxy_flags.json")
    parser.add_argument("--out",      default="schemas/model_bias_report.json")
    parser.add_argument("--n-probes", type=int, default=100)
    parser.add_argument("--sample-size", type=int, default=200)
    args = parser.parse_args()
    run(args)


if __name__ == "__main__":
    main()
