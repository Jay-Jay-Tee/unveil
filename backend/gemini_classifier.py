"""
M1 — gemini_classifier.py
Location: backend/gemini_classifier.py

Responsibilities:
  - Take an ingest_result dict from ingestor.py
  - Build a structured prompt from column_meta (names, dtype, kind, sample_values)
  - Call Gemini via AI Studio (google-genai SDK)
  - Parse the JSON response into a validated schema_map dict
  - Write schema_map.json to schemas/ (the M1 → M2 contract)

Output dict shape (mirrors schemas/schema_map.json):
{
    "version": "1.0.0",
    "generated_by": "gemini-column-classifier",
    "dataset": str,
    "columns": {
        "protected":  [{ "name": str, "type": "PROTECTED",  "proxies": [] }],
        "outcome":    [{ "name": str, "type": "OUTCOME",    "proxies": [] }],
        "ambiguous":  [{ "name": str, "type": "AMBIGUOUS",  "proxies": [str] }],
        "neutral":    [{ "name": str, "type": "NEUTRAL",    "proxies": [] }],
    }
}

API key:
  Set env var GEMINI_API_KEY=<your key from aistudio.google.com>
  PowerShell : $env:GEMINI_API_KEY = "your_key_here"
  bash/zsh   : export GEMINI_API_KEY=your_key_here
"""

import os
import json
import re
from pathlib import Path

from google import genai
from google.genai import types


# ─────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────

VALID_TYPES    = {"PROTECTED", "OUTCOME", "NEUTRAL", "AMBIGUOUS"}
SCHEMA_VERSION = "1.0.0"

_SYSTEM_INSTRUCTION = (
    "You are a data bias auditor specializing in algorithmic fairness. "
    "You classify dataset columns for bias analysis. "
    "You always respond with valid JSON only — no markdown fences, no explanation, no preamble."
)

# schemas/ is always one level above this file (repo_root/schemas/)
_SCHEMAS_DIR = Path(__file__).resolve().parent.parent / "schemas"


# ─────────────────────────────────────────────────────────────
# Public entry point
# ─────────────────────────────────────────────────────────────

def classify(ingest_result: dict, output_path: str | None = None) -> dict:
    """
    Classify columns using Gemini and return a validated schema_map dict.

    Args:
        ingest_result : dict returned by ingestor.ingest()
        output_path   : path to write schema_map.json.
                        Defaults to schemas/schema_map.json at the repo root.
                        Pass any path to override — including temp dirs for testing.

    Returns:
        schema_map dict

    Raises:
        EnvironmentError : GEMINI_API_KEY not set
        ValueError       : Gemini response could not be parsed or validated
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise EnvironmentError(
            "GEMINI_API_KEY is not set.\n"
            "  PowerShell : $env:GEMINI_API_KEY = 'your_key_here'\n"
            "  bash/zsh   : export GEMINI_API_KEY=your_key_here\n"
            "Get a free key at https://aistudio.google.com"
        )

    client     = genai.Client(api_key=api_key)
    prompt     = _build_prompt(ingest_result)
    raw        = _call_gemini(client, prompt)
    schema_map = _parse_and_validate(raw, ingest_result)

    out_path = Path(output_path) if output_path else _SCHEMAS_DIR / "schema_map.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(schema_map, f, indent=2)
    print(f"  schema_map.json written → {out_path}")

    return schema_map


# ─────────────────────────────────────────────────────────────
# Prompt construction
# ─────────────────────────────────────────────────────────────

def _build_prompt(ingest_result: dict) -> str:
    column_descriptions = []
    for col in ingest_result["column_meta"]:
        samples = ", ".join(str(v) for v in col["sample_values"])
        column_descriptions.append(
            f'  - name: "{col["name"]}" | dtype: {col["dtype"]} | '
            f'kind: {col["kind"]} | sample values: [{samples}]'
        )

    columns_block = "\n".join(column_descriptions)

    return f"""You are auditing the dataset "{ingest_result['dataset_name']}" for algorithmic bias.

Classify each column below into exactly one of these four types:

  PROTECTED  — a demographic attribute that is legally or ethically protected from
               use in automated decisions (examples: age, race, gender, sex,
               religion, disability, national origin, native country).

  OUTCOME    — the variable a model would predict or the label column
               (examples: income, loan_approved, recidivism_score, hired).

  AMBIGUOUS  — a column that is not directly protected but may encode or correlate
               with a protected attribute (proxy risk). Examples: zip code, surname,
               occupation, relationship status, marital status. List which protected
               attributes it may proxy for in the "proxies" field.

  NEUTRAL    — a feature with no known or plausible demographic correlation
               (examples: education level in years, hours worked, capital gain/loss).

Dataset columns to classify:
{columns_block}

Return a single JSON object with this exact structure — no other text:
{{
  "columns": [
    {{
      "name": "<column_name>",
      "type": "<PROTECTED|OUTCOME|AMBIGUOUS|NEUTRAL>",
      "proxies": ["<protected_column_name_if_AMBIGUOUS>"]
    }}
  ]
}}

Rules:
- Every column listed above must appear in the output exactly once.
- "proxies" must be an empty list [] for PROTECTED, OUTCOME, and NEUTRAL columns.
- "proxies" must name the protected column(s) the AMBIGUOUS column may correlate with.
- Use the column names exactly as given — do not rename or alter them.
- Return only the JSON object. No markdown, no explanation.
"""


# ─────────────────────────────────────────────────────────────
# Gemini call
# ─────────────────────────────────────────────────────────────

def _call_gemini(client: genai.Client, prompt: str) -> str:
    """Call Gemini and return clean text, stripping any stray markdown fences."""
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        config=types.GenerateContentConfig(
            system_instruction=_SYSTEM_INSTRUCTION,
            temperature=0.0,
            max_output_tokens=4096,
        ),
        contents=prompt,
    )
    assert response.text
    raw = response.text.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw.strip())
    return raw.strip()


# ─────────────────────────────────────────────────────────────
# Parse and validate
# ─────────────────────────────────────────────────────────────

def _parse_and_validate(raw: str, ingest_result: dict) -> dict:
    """
    Parse Gemini's JSON and validate it against the full column list.
    - Unknown columns from Gemini are dropped with a warning.
    - Columns Gemini missed are defaulted to NEUTRAL with a warning.
    - Invalid types are coerced to NEUTRAL.
    - Proxies are cleared for non-AMBIGUOUS columns.
    """
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as e:
        raise ValueError(f"Gemini returned invalid JSON.\nError: {e}\nRaw:\n{raw}")

    if "columns" not in parsed or not isinstance(parsed["columns"], list):
        raise ValueError(f"Gemini response missing 'columns' list.\nRaw:\n{raw}")

    known      = {col["name"] for col in ingest_result["column_meta"]}
    classified = {}

    for entry in parsed["columns"]:
        name     = entry.get("name", "").strip()
        col_type = entry.get("type", "NEUTRAL").strip().upper()
        proxies  = entry.get("proxies", [])

        if name not in known:
            print(f"  [WARN] Gemini returned unknown column '{name}' — skipped.")
            continue

        if col_type not in VALID_TYPES:
            print(f"  [WARN] Invalid type '{col_type}' for '{name}' — defaulting to NEUTRAL.")
            col_type = "NEUTRAL"

        if col_type != "AMBIGUOUS":
            proxies = []
        else:
            proxies = [p for p in proxies if p in known]

        classified[name] = {"name": name, "type": col_type, "proxies": proxies}

    for col in ingest_result["column_meta"]:
        if col["name"] not in classified:
            print(f"  [WARN] Gemini missed '{col['name']}' — defaulting to NEUTRAL.")
            classified[col["name"]] = {"name": col["name"], "type": "NEUTRAL", "proxies": []}

    buckets = {"protected": [], "outcome": [], "ambiguous": [], "neutral": []}
    for entry in classified.values():
        buckets[entry["type"].lower()].append(entry)

    return {
        "version":      SCHEMA_VERSION,
        "generated_by": "gemini-column-classifier",
        "dataset":      ingest_result["dataset_name"],
        "columns":      buckets,
    }


# ─────────────────────────────────────────────────────────────
# Utility
# ─────────────────────────────────────────────────────────────

def summarize(schema_map: dict) -> None:
    """Print a human-readable summary of a schema_map dict."""
    print(f"\n{'=' * 55}")
    print(f"  Dataset : {schema_map['dataset']}")
    cols = schema_map["columns"]
    for bucket, label in [
        ("protected", "🔴 PROTECTED"),
        ("outcome",   "🎯 OUTCOME"),
        ("ambiguous", "🟡 AMBIGUOUS"),
        ("neutral",   "⚪ NEUTRAL"),
    ]:
        entries = cols.get(bucket, [])
        if entries:
            print(f"\n  {label}:")
            for e in entries:
                proxy_str = f"  → proxies: {e['proxies']}" if e["proxies"] else ""
                print(f"    • {e['name']}{proxy_str}")
    print(f"{'=' * 55}\n")


# ─────────────────────────────────────────────────────────────
# Self-test — run directly: python gemini_classifier.py
# Requires GEMINI_API_KEY to be set.
# ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys
    import tempfile
    import pandas as pd

    sys.path.insert(0, str(Path(__file__).parent))
    from ingestor import ingest

    print("Running gemini_classifier self-test...\n")

    synthetic_data = {
        "age":            [39, 50, 38, 53, 28],
        "workclass":      ["State-gov", "Self-emp-not-inc", "Private", "Private", "Private"],
        "fnlwgt":         [77516, 83311, 215646, 234721, 338409],
        "education":      ["Bachelors", "Bachelors", "HS-grad", "11th", "Bachelors"],
        "education-num":  [13, 13, 9, 7, 13],
        "marital-status": ["Never-married", "Married-civ-spouse", "Divorced", "Married-civ-spouse", "Married-civ-spouse"],
        "occupation":     ["Adm-clerical", "Exec-managerial", "Handlers-cleaners", "Handlers-cleaners", "Prof-specialty"],
        "relationship":   ["Not-in-family", "Husband", "Not-in-family", "Husband", "Wife"],
        "race":           ["White", "White", "White", "Black", "Black"],
        "sex":            ["Male", "Male", "Male", "Male", "Female"],
        "capital-gain":   [2174, 0, 0, 0, 0],
        "capital-loss":   [0, 0, 0, 0, 0],
        "hours-per-week": [40, 13, 40, 40, 40],
        "native-country": ["United-States", "United-States", "United-States", "United-States", "Cuba"],
        "income":         [">50K", "<=50K", "<=50K", "<=50K", "<=50K"],
    }

    with tempfile.TemporaryDirectory() as tmp:
        csv_path = os.path.join(tmp, "uci_adult.csv")
        pd.DataFrame(synthetic_data).to_csv(csv_path, index=False)

        result     = ingest(csv_path)
        schema_map = classify(result, output_path=os.path.join(tmp, "schema_map.json"))

        summarize(schema_map)

        assert schema_map["dataset"] == "uci_adult"
        assert "protected" in schema_map["columns"]
        assert "outcome"   in schema_map["columns"]
        assert "neutral"   in schema_map["columns"]

        all_cols = (
            schema_map["columns"]["protected"]
            + schema_map["columns"]["outcome"]
            + schema_map["columns"].get("ambiguous", [])
            + schema_map["columns"]["neutral"]
        )
        assert len(all_cols) == 15, f"Expected 15 columns, got {len(all_cols)}"

        protected_names = [c["name"] for c in schema_map["columns"]["protected"]]
        assert "sex"  in protected_names, f"sex not in protected: {protected_names}"
        assert "race" in protected_names, f"race not in protected: {protected_names}"

        outcome_names = [c["name"] for c in schema_map["columns"]["outcome"]]
        assert "income" in outcome_names, f"income not in outcome: {outcome_names}"

        print("✅ All gemini_classifier tests passed 🚀")