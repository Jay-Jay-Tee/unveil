import sys, io
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

"""
M1 - proxy_detection.py
Location: backend/part_a/proxy_detection.py

Responsibilities:
  - Take an ingest_result dict (from ingestor.py) and a schema_map dict
    (from gemini_classifier.py)
  - Compute Cramér's V between every pair of categorical columns
  - Compute mutual information between every categorical column and each
    PROTECTED column
  - Flag columns that are statistically close to a PROTECTED column as
    PROXY or WEAK_PROXY
  - Write proxy_flags.json to schemas/ (part of the M1 → M2 contract)

Output dict shape (mirrors schemas/proxy_flags.json):
{
    "version": "1.0.0",
    "generated_by": "proxy-detector",
    "dataset": str,
    "proxy_columns": [
        {
            "column": str,
            "proxies_for": str,           # name of the PROTECTED column
            "cramers_v": float,           # association strength [0, 1]
            "mutual_information": float,  # MI in nats [0, ∞)
            "verdict": str                # "PROXY" | "WEAK_PROXY" | "NONE"
        },
        ...
    ]
}

Thresholds (tunable via constants below):
  Cramér's V ≥ 0.30  AND  MI ≥ 0.10  →  PROXY
  Cramér's V ≥ 0.10  OR   MI ≥ 0.05  →  WEAK_PROXY
  Otherwise                           →  NONE

Only PROXY and WEAK_PROXY entries are written to proxy_flags.json.
NONE pairs are computed but silently dropped to keep the file readable.
"""

import json
import numpy as np
import pandas as pd
from pathlib import Path
from itertools import combinations
from scipy.stats import chi2_contingency
from sklearn.metrics import mutual_info_score
from sklearn.preprocessing import LabelEncoder


# ─────────────────────────────────────────────────────────────
# Thresholds
# ─────────────────────────────────────────────────────────────

PROXY_CV_THRESHOLD      = 0.30   # Cramér's V - strong association
PROXY_MI_THRESHOLD      = 0.10   # mutual information - strong
WEAK_PROXY_CV_THRESHOLD = 0.10   # Cramér's V - moderate association
WEAK_PROXY_MI_THRESHOLD = 0.05   # mutual information - moderate

SCHEMA_VERSION = "1.0.0"


# ─────────────────────────────────────────────────────────────
# Public entry point
# ─────────────────────────────────────────────────────────────

def detect(ingest_result: dict, schema_map: dict, output_path: str | None = None) -> dict:
    """
    Detect proxy columns relative to protected attributes.

    Args:
        ingest_result : dict from ingestor.ingest()
        schema_map    : dict from gemini_classifier.classify()
        output_path   : optional path to write proxy_flags.json.
                        Defaults to schemas/proxy_flags.json relative to CWD.

    Returns:
        proxy_flags dict (see module docstring)
    """
    df = ingest_result["df"]
    protected_cols = _get_protected_columns(schema_map)
    outcome_cols   = _get_outcome_columns(schema_map)

    # Only probe categorical columns - Cramér's V and MI are defined for categories.
    # Exclude OUTCOME columns from being flagged as proxies.
    categorical_cols = _get_categorical_columns(ingest_result, exclude=outcome_cols)

    if not protected_cols:
        print("  [WARN] No PROTECTED columns found in schema_map - proxy detection skipped.")
        return _empty_result(ingest_result["dataset_name"])

    # ── encode all categorical columns to integers for MI computation ──
    encoded = _encode_categoricals(df, categorical_cols)

    proxy_entries = []

    for protected in protected_cols:
        if protected not in categorical_cols:
            print(f"  [SKIP] Protected column '{protected}' is not categorical - skipping MI/CV.")
            continue

        for candidate in categorical_cols:
            if candidate == protected:
                continue

            cv    = _cramers_v(df, protected, candidate)
            mi    = _mutual_information(encoded, protected, candidate)
            verdict = _verdict(cv, mi)

            if verdict == "NONE":
                continue  # drop clean pairs - proxy_flags.json only lists flagged ones

            proxy_entries.append({
                "column":             candidate,
                "proxies_for":        protected,
                "cramers_v":          round(cv, 4),
                "mutual_information": round(mi, 4),
                "verdict":            verdict,
            })

            print(f"  [{verdict}] '{candidate}' → '{protected}'  "
                  f"CV={cv:.3f}  MI={mi:.3f}")

    # Sort: PROXY first, then WEAK_PROXY; within each group by CV descending
    proxy_entries.sort(key=lambda x: (0 if x["verdict"] == "PROXY" else 1, -x["cramers_v"]))

    proxy_flags = {
        "version":        SCHEMA_VERSION,
        "generated_by":   "proxy-detector",
        "dataset":        ingest_result["dataset_name"],
        "proxy_columns":  proxy_entries,
    }

    # ── write to disk ──
    out_path = _resolve_output_path(output_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(proxy_flags, f, indent=2)
    print(f"  proxy_flags.json written → {out_path}")

    return proxy_flags


# ─────────────────────────────────────────────────────────────
# Cramér's V
# ─────────────────────────────────────────────────────────────

def _cramers_v(df: pd.DataFrame, col_a: str, col_b: str) -> float:
    """
    Compute Cramér's V between two categorical columns.

    Cramér's V is a symmetric measure of association derived from the
    chi-squared statistic. It is bounded [0, 1]:
      0 = no association at all
      1 = perfect association

    Uses the bias-corrected formula (Bergsma 2013) to avoid inflated
    values on small contingency tables.

    Args:
        df    : DataFrame containing both columns
        col_a : first column name
        col_b : second column name

    Returns:
        Cramér's V as a float in [0.0, 1.0]
    """
    # Drop rows where either column is null
    valid = df[[col_a, col_b]].dropna()
    if len(valid) < 2:
        return 0.0

    contingency = pd.crosstab(valid[col_a], valid[col_b])
    n = contingency.values.sum()

    if n == 0:
        return 0.0

    chi2, _, _, _ = chi2_contingency(contingency, correction=False)

    r, k = contingency.shape  # rows, columns

    # Bias-corrected Cramér's V (Bergsma 2013)
    phi2 = chi2 / n
    phi2_corr = max(0.0, phi2 - ((k - 1) * (r - 1)) / (n - 1))
    k_corr    = k - (k - 1) ** 2 / (n - 1)
    r_corr    = r - (r - 1) ** 2 / (n - 1)

    denom = min(k_corr - 1, r_corr - 1)
    if denom <= 0:
        return 0.0

    return float(np.sqrt(phi2_corr / denom))


# ─────────────────────────────────────────────────────────────
# Mutual Information
# ─────────────────────────────────────────────────────────────

def _mutual_information(encoded: dict, col_a: str, col_b: str) -> float:
    """
    Compute mutual information between two label-encoded categorical columns.

    MI measures how much knowing col_b reduces uncertainty about col_a.
    Unlike Cramér's V it is not normalized, so it can be > 1 for columns
    with high cardinality. We use it alongside CV to catch cases where
    two columns share mutual information even though their contingency
    table is sparse.

    Args:
        encoded : dict of {col_name: np.ndarray of integer labels}
        col_a   : first column name
        col_b   : second column name

    Returns:
        mutual information in nats (float ≥ 0.0)
    """
    if col_a not in encoded or col_b not in encoded:
        return 0.0
    return float(mutual_info_score(encoded[col_a], encoded[col_b]))


# ─────────────────────────────────────────────────────────────
# Verdict
# ─────────────────────────────────────────────────────────────

def _verdict(cv: float, mi: float) -> str:
    """
    Assign a proxy verdict based on Cramér's V and mutual information.

    PROXY      → strong signal on both measures (both thresholds exceeded)
    WEAK_PROXY → moderate signal on either measure
    NONE       → below both thresholds
    """
    if cv >= PROXY_CV_THRESHOLD and mi >= PROXY_MI_THRESHOLD:
        return "PROXY"
    if cv >= WEAK_PROXY_CV_THRESHOLD or mi >= WEAK_PROXY_MI_THRESHOLD:
        return "WEAK_PROXY"
    return "NONE"


# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────

def _get_protected_columns(schema_map: dict) -> list[str]:
    return [c["name"] for c in schema_map["columns"].get("protected", [])]


def _get_outcome_columns(schema_map: dict) -> list[str]:
    return [c["name"] for c in schema_map["columns"].get("outcome", [])]


def _get_categorical_columns(ingest_result: dict, exclude: list[str]) -> list[str]:
    """
    Return column names that are categorical (per ingestor's kind field)
    and not in the exclude list (e.g. outcome columns).
    """
    exclude_set = set(exclude)
    return [
        col["name"]
        for col in ingest_result["column_meta"]
        if col["kind"] == "categorical" and col["name"] not in exclude_set
    ]


def _encode_categoricals(df: pd.DataFrame, columns: list[str]) -> dict:
    """
    Label-encode each categorical column, handling NaN by treating it as
    a separate category ("__NULL__") so MI computation isn't skewed.

    Returns:
        dict of {col_name: np.ndarray of int labels}
    """
    encoded = {}
    le = LabelEncoder()
    for col in columns:
        if col not in df.columns:
            continue
        series = df[col].fillna("__NULL__").astype(str)
        encoded[col] = le.fit_transform(series)
    return encoded


def _empty_result(dataset_name: str) -> dict:
    return {
        "version":       SCHEMA_VERSION,
        "generated_by":  "proxy-detector",
        "dataset":       dataset_name,
        "proxy_columns": [],
    }


def _resolve_output_path(output_path: str | None) -> Path:
    if output_path:
        return Path(output_path).resolve()
    cwd = Path.cwd()
    for parent in [cwd, *cwd.parents]:
        candidate = parent / "schemas" / "proxy_flags.json"
        if candidate.parent.exists():
            return candidate
    return cwd / "schemas" / "proxy_flags.json"


def summarize(proxy_flags: dict) -> None:
    """Print a human-readable summary of a proxy_flags dict."""
    entries = proxy_flags.get("proxy_columns", [])
    print(f"\n{'=' * 60}")
    print(f"  Dataset : {proxy_flags['dataset']}")
    print(f"  Proxy pairs found: {len(entries)}")
    if not entries:
        print("  ✅ No proxy columns detected.")
    else:
        print(f"\n  {'Column':<22} {'Proxies For':<18} {'CV':>6} {'MI':>7}  Verdict")
        print(f"  {'-' * 60}")
        for e in entries:
            print(
                f"  {e['column']:<22} {e['proxies_for']:<18} "
                f"{e['cramers_v']:>6.3f} {e['mutual_information']:>7.3f}  {e['verdict']}"
            )
    print(f"{'=' * 60}\n")


# ─────────────────────────────────────────────────────────────
# Self-test - run directly: python proxy_detection.py
# Does NOT require GEMINI_API_KEY - uses a hardcoded mock schema_map.
# ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys
    import os
    import tempfile
    sys.path.insert(0, str(Path(__file__).parent))
    from ingestor import ingest

    print("Running proxy_detection self-test...\n")

    # ── Build UCI Adult synthetic data with known proxy relationships ──
    # relationship and marital-status are known proxies for gender in UCI Adult.
    np.random.seed(42)
    n = 200

    gender      = np.random.choice(["Male", "Female"], n, p=[0.67, 0.33])
    race        = np.random.choice(["White", "Black", "Asian-Pac-Islander", "Other"], n, p=[0.85, 0.09, 0.03, 0.03])

    # relationship is a strong proxy for gender in UCI Adult
    relationship = np.where(
        gender == "Male",
        np.random.choice(["Husband", "Not-in-family", "Own-child"], n, p=[0.6, 0.3, 0.1]),
        np.random.choice(["Wife", "Not-in-family", "Unmarried"], n, p=[0.4, 0.35, 0.25]),
    )

    # marital-status is a moderate proxy for gender
    marital = np.where(
        gender == "Male",
        np.random.choice(["Married-civ-spouse", "Never-married", "Divorced"], n, p=[0.55, 0.3, 0.15]),
        np.random.choice(["Married-civ-spouse", "Never-married", "Divorced"], n, p=[0.35, 0.35, 0.3]),
    )

    occupation = np.random.choice(
        ["Exec-managerial", "Prof-specialty", "Other-service", "Craft-repair"], n
    )
    education  = np.random.choice(["Bachelors", "HS-grad", "Masters", "11th"], n)
    income     = np.random.choice([">50K", "<=50K"], n, p=[0.24, 0.76])
    age        = np.random.randint(18, 65, n)

    synthetic_data = {
        "age": age,
        "gender": gender,
        "race": race,
        "relationship": relationship,
        "marital-status": marital,
        "occupation": occupation,
        "education": education,
        "income": income,
    }

    # Mock schema_map - what gemini_classifier would produce for this data
    mock_schema_map = {
        "version": "1.0.0",
        "generated_by": "gemini-column-classifier",
        "dataset": "uci_adult_test",
        "columns": {
            "protected": [
                {"name": "gender", "type": "PROTECTED", "proxies": []},
                {"name": "race",   "type": "PROTECTED", "proxies": []},
                {"name": "age",    "type": "PROTECTED", "proxies": []},
            ],
            "outcome": [
                {"name": "income", "type": "OUTCOME", "proxies": []},
            ],
            "ambiguous": [],
            "neutral": [
                {"name": "education",  "type": "NEUTRAL", "proxies": []},
                {"name": "occupation", "type": "NEUTRAL", "proxies": []},
            ],
        }
    }

    with tempfile.TemporaryDirectory() as tmp:
        csv_path = os.path.join(tmp, "uci_adult_test.csv")
        import pandas as pd
        pd.DataFrame(synthetic_data).to_csv(csv_path, index=False)

        result = ingest(csv_path)
        proxy_flags = detect(
            result,
            mock_schema_map,
            output_path=os.path.join(tmp, "proxy_flags.json")
        )

        summarize(proxy_flags)

        # ── Assertions ──
        assert proxy_flags["dataset"] == "uci_adult_test"
        assert isinstance(proxy_flags["proxy_columns"], list)

        # relationship should be flagged as proxy for gender (strong correlation by design)
        flagged = {(e["column"], e["proxies_for"]): e["verdict"] for e in proxy_flags["proxy_columns"]}
        assert ("relationship", "gender") in flagged, (
            f"Expected ('relationship', 'gender') to be flagged. Got: {list(flagged.keys())}"
        )
        assert flagged[("relationship", "gender")] in ("PROXY", "WEAK_PROXY")

        # income (OUTCOME) must NOT appear as a proxy candidate
        assert not any(e["column"] == "income" for e in proxy_flags["proxy_columns"]), \
            "OUTCOME column 'income' should not appear in proxy_columns"

        # All verdicts must be valid
        for e in proxy_flags["proxy_columns"]:
            assert e["verdict"] in ("PROXY", "WEAK_PROXY"), f"Invalid verdict: {e['verdict']}"

        print("✅ All proxy_detection tests passed 🚀")

