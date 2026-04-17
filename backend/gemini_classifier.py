"""
M1 — gemini_classifier.py
Location: backend/part_a/gemini_classifier.py

Responsibilities:
  - Take an ingest_result dict from ingestor.py
  - Build a structured prompt from column_meta (names, dtype, kind, sample_values)
  - Call Gemini 1.5 Flash via AI Studio (google-generativeai SDK)
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

Notes on AI Studio key:
  Set env var GEMINI_API_KEY=<your key from aistudio.google.com>
  Never hard-code the key in source.
"""

import os
import json
import re
import google.generativeai as genai
from pathlib import Path


# ─────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────

VALID_TYPES = {"PROTECTED", "OUTCOME", "NEUTRAL", "AMBIGUOUS"}

SCHEMA_VERSION = "1.0.0"

# Gemini will be asked to reply with only JSON — no markdown, no preamble.
# This system instruction is included in every request.
_SYSTEM_INSTRUCTION = (
    "You are a data bias auditor specializing in algorithmic fairness. "
    "You classify dataset columns for bias analysis. "
    "You always respond with valid JSON only — no markdown fences, no explanation, no preamble."
)

# ─────────────────────────────────────────────────────────────
# Public entry point
# ─────────────────────────────────────────────────────────────
def classify(ingest_result: dict, output_path: str = "") -> dict:
    """
    Classify columns using Gemini and return a validated schema_map dict.

    Args:
        ingest_result : dict returned by ingestor.ingest()
        output_path   : optional path to write schema_map.json.
                        Defaults to schemas/schema_map.json relative to CWD.

    Returns:
        schema_map dict (see module docstring)

    Raises:
        EnvironmentError  : GEMINI_API_KEY not set
        ValueError        : Gemini response could not be parsed or validated
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise EnvironmentError(
            "GEMINI_API_KEY is not set. "
            "Get a free key at https://aistudio.google.com and run:\n"
            "  export GEMINI_API_KEY=your_key_here"
        )

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(
        model_name="gemini-1.5-flash",
        system_instruction=_SYSTEM_INSTRUCTION,
    )

    prompt = _build_prompt(ingest_result)
    raw_response = _call_gemini(model, prompt)
    schema_map = _parse_and_validate(raw_response, ingest_result)

    # ── write to disk ──
    out_path = _resolve_output_path(output_path).resolve()
    cwd = Path.cwd().resolve()
    
    # Prevent directory traversal attacks
    try:
        out_path.relative_to(cwd)
    except ValueError:
        raise ValueError(
            f"Output path {out_path} is outside the working directory {cwd}. "
            "For security, output must be within the project directory."
        )
    
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(schema_map, f, indent=2)
    print(f"  schema_map.json written → {out_path}")

    return schema_map


# ─────────────────────────────────────────────────────────────
# Prompt construction
# ─────────────────────────────────────────────────────────────

def _build_prompt(ingest_result: dict) -> str:
    """
    Build the classification prompt from column_meta.

    Each column is described with its name, data type, kind, and sample values
    so Gemini has enough signal to make a meaningful classification without
    seeing the full dataset.

    Classification rules embedded in the prompt:
      PROTECTED  — demographic attributes legally/ethically protected (age, race,
                   gender, religion, disability, national origin, etc.)
      OUTCOME    — the target variable the model predicts (income, loan_approved, etc.)
      AMBIGUOUS  — columns that may encode a protected attribute indirectly
                   (marital status, zip code, surname, occupation)
      NEUTRAL    — features with no known demographic correlation
    """
    column_descriptions = []
    for col in ingest_result["column_meta"]:
        samples = ", ".join(str(v) for v in col["sample_values"])
        column_descriptions.append(
            f'  - name: "{col["name"]}" | dtype: {col["dtype"]} | '
            f'kind: {col["kind"]} | sample values: [{samples}]'
        )

    columns_block = "\n".join(column_descriptions)

    prompt = f"""You are auditing the dataset "{ingest_result['dataset_name']}" for algorithmic bias.

Classify each column below into exactly one of these four types:

  PROTECTED  — a demographic attribute that is legally or ethically protected from
               use in automated decisions (examples: age, race, gender, sex,
               religion, disability, national origin, marital status when used as
               a gender proxy, native country).

  OUTCOME    — the variable a model would predict or the label column
               (examples: income, loan_approved, recidivism_score, hired).

  AMBIGUOUS  — a column that is not directly protected but may encode or correlate
               with a protected attribute (proxy risk). Examples: zip code, surname,
               occupation, relationship status, club membership. List which protected
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
    return prompt


# ─────────────────────────────────────────────────────────────
# Gemini call
# ─────────────────────────────────────────────────────────────

def _call_gemini(model, prompt: str) -> str:
    """
    Send the prompt to Gemini and return the raw text response.
    Strips markdown code fences if Gemini adds them despite the system instruction.
    """
    response = model.generate_content(
        prompt,
        generation_config=genai.GenerationConfig(
            temperature=0.0,        # deterministic — bias auditing needs consistency
            max_output_tokens=4096,
        ),
    )
    raw = response.text.strip()

    # Strip ```json ... ``` fences if Gemini adds them anyway
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw.strip())

    return raw.strip()


# ─────────────────────────────────────────────────────────────
# Parse and validate
# ─────────────────────────────────────────────────────────────

def _validate_and_normalize_entry(entry: dict, known_columns: set) -> tuple[str, dict] | None:
    """
    Validate and normalize a single column entry from Gemini's response.
    Returns (name, normalized_entry) or None if entry should be skipped.
    """
    name = entry.get("name", "").strip()
    col_type = entry.get("type", "NEUTRAL").strip().upper()
    proxies = entry.get("proxies", [])

    # Skip columns not in the dataset
    if name not in known_columns:
        print(f"  [WARN] Gemini returned unknown column '{name}' — skipped.")
        return None

    # Coerce invalid types to NEUTRAL
    if col_type not in VALID_TYPES:
        print(f"  [WARN] Invalid type '{col_type}' for '{name}' — defaulting to NEUTRAL.")
        col_type = "NEUTRAL"

    # Enforce proxies list contract
    if col_type != "AMBIGUOUS":
        if proxies:
            print(f"  [WARN] '{name}' is {col_type} but has proxies — clearing proxies.")
        proxies = []
    else:
        # Filter proxies to only valid column names
        proxies = [p for p in proxies if p in known_columns]

    return name, {"name": name, "type": col_type, "proxies": proxies}


def _build_schema_map_from_classified(classified: dict, ingest_result: dict) -> dict:
    """Build the final schema_map in the agreed contract format."""
    buckets = {"protected": [], "outcome": [], "ambiguous": [], "neutral": []}
    for entry in classified.values():
        bucket_key = entry["type"].lower()
        buckets[bucket_key].append(entry)

    schema_map = {
        "version": SCHEMA_VERSION,
        "generated_by": "gemini-column-classifier",
        "dataset": ingest_result["dataset_name"],
        "columns": buckets,
    }
    return schema_map


def _parse_and_validate(raw: str, ingest_result: dict) -> dict:
    """
    Parse Gemini's JSON response and validate it against the full column list.

    Validation rules:
      1. Every column from ingest_result must be present.
      2. Every "type" must be one of the four valid values.
      3. AMBIGUOUS columns must have a non-empty "proxies" list.
      4. Non-AMBIGUOUS columns must have an empty "proxies" list.
      5. No extra columns that aren't in the dataset.

    If validation finds issues, it applies safe fallbacks rather than crashing
    (unknown columns dropped; missing columns defaulted to NEUTRAL).
    """
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as e:
        raise ValueError(
            f"Gemini returned invalid JSON.\n"
            f"Error: {e}\n"
            f"Raw response:\n{raw}"
        )

    if "columns" not in parsed or not isinstance(parsed["columns"], list):
        raise ValueError(
            f"Gemini response is missing the 'columns' list.\n"
            f"Raw response:\n{raw}"
        )

    known_columns = {col["name"] for col in ingest_result["column_meta"]}
    classified = {}

    for entry in parsed["columns"]:
        result = _validate_and_normalize_entry(entry, known_columns)
        if result:
            name, normalized = result
            classified[name] = normalized

    # Any column Gemini missed → default NEUTRAL with a warning
    for col in ingest_result["column_meta"]:
        if col["name"] not in classified:
            print(f"  [WARN] Gemini did not classify '{col['name']}' — defaulting to NEUTRAL.")
            classified[col["name"]] = {"name": col["name"], "type": "NEUTRAL", "proxies": []}

    return _build_schema_map_from_classified(classified, ingest_result)


# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────

def _resolve_output_path(output_path: str | None) -> Path:
    if output_path:
        return Path(output_path).resolve()
    # Walk up from CWD to find the schemas/ dir, or create it adjacent to CWD
    cwd = Path.cwd()
    for parent in [cwd, *cwd.parents]:
        candidate = parent / "schemas" / "schema_map.json"
        if candidate.parent.exists():
            return candidate
    return cwd / "schemas" / "schema_map.json"


def summarize(schema_map: dict) -> None:
    """Print a human-readable summary of a schema_map dict."""
    print(f"\n{'=' * 55}")
    print(f"  Dataset : {schema_map['dataset']}")
    print(f"  Generated by: {schema_map['generated_by']}")
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
# Requires GEMINI_API_KEY env var.
# ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys
    import tempfile
    import pandas as pd
    sys.path.insert(0, str(Path(__file__).parent))
    from ingestor import ingest

    print("Running gemini_classifier self-test...\n")
    print("Note: requires GEMINI_API_KEY to be set.\n")

    # Build a minimal synthetic UCI Adult CSV
    synthetic_data = {
        "age": [39, 50, 38, 53, 28],
        "workclass": ["State-gov", "Self-emp-not-inc", "Private", "Private", "Private"],
        "fnlwgt": [77516, 83311, 215646, 234721, 338409],
        "education": ["Bachelors", "Bachelors", "HS-grad", "11th", "Bachelors"],
        "education-num": [13, 13, 9, 7, 13],
        "marital-status": ["Never-married", "Married-civ-spouse", "Divorced", "Married-civ-spouse", "Married-civ-spouse"],
        "occupation": ["Adm-clerical", "Exec-managerial", "Handlers-cleaners", "Handlers-cleaners", "Prof-specialty"],
        "relationship": ["Not-in-family", "Husband", "Not-in-family", "Husband", "Wife"],
        "race": ["White", "White", "White", "Black", "Black"],
        "gender": ["Male", "Male", "Male", "Male", "Female"],
        "capital-gain": [2174, 0, 0, 0, 0],
        "capital-loss": [0, 0, 0, 0, 0],
        "hours-per-week": [40, 13, 40, 40, 40],
        "native-country": ["United-States", "United-States", "United-States", "United-States", "Cuba"],
        "income": [">50K", "<=50K", "<=50K", "<=50K", "<=50K"],
    }

    with tempfile.TemporaryDirectory() as tmp:
        csv_path = os.path.join(tmp, "uci_adult.csv")
        pd.DataFrame(synthetic_data).to_csv(csv_path, index=False)

        result = ingest(csv_path)
        schema_map = classify(result, output_path=os.path.join(tmp, "schema_map.json"))

        summarize(schema_map)

        # Basic structural assertions
        assert schema_map["dataset"] == "uci_adult"
        assert "protected" in schema_map["columns"]
        assert "outcome" in schema_map["columns"]
        assert "neutral" in schema_map["columns"]

        all_classified = (
            schema_map["columns"]["protected"]
            + schema_map["columns"]["outcome"]
            + schema_map["columns"].get("ambiguous", [])
            + schema_map["columns"]["neutral"]
        )
        assert len(all_classified) == 15, f"Expected 15, got {len(all_classified)}"

        protected_names = [c["name"] for c in schema_map["columns"]["protected"]]
        assert "gender" in protected_names, f"gender not in protected: {protected_names}"
        assert "race" in protected_names, f"race not in protected: {protected_names}"

        outcome_names = [c["name"] for c in schema_map["columns"]["outcome"]]
        assert "income" in outcome_names, f"income not in outcome: {outcome_names}"

        print("✅ All gemini_classifier tests passed 🚀")
