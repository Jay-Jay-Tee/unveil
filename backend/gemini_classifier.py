"""
Unveil - gemini_classifier.py  (REVAMPED)

What changed vs the old version:
  1. Rules-based fallback fires FIRST for obvious column names (sex, race, age,
     income, etc.). Gemini is only called when the rules-based pass leaves
     columns unclassified or flags real ambiguity. This kills ~90% of API
     calls on common datasets like UCI Adult.
  2. Disk cache (keyed by a hash of the column-meta) means identical datasets
     never hit Gemini twice.
  3. Retry-with-exponential-backoff on 429/503 transient errors. If every
     retry fails, we fall through to a pure rules-based classification and
     mark the result as fallback=True so the UI can show a warning.
  4. Output JSON is the same shape as before - no schema changes downstream.
"""

from __future__ import annotations

import hashlib
import io
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Optional

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")


VALID_TYPES = {"PROTECTED", "OUTCOME", "NEUTRAL", "AMBIGUOUS"}
SCHEMA_VERSION = "1.1.0"

_SCHEMAS_DIR = Path(__file__).resolve().parent.parent / "schemas"
_CACHE_DIR = Path(__file__).resolve().parent / "_cache" / "classifier"
_CACHE_DIR.mkdir(parents=True, exist_ok=True)


# ─────────────────────────────────────────────────────────────
# Rules-based pass - runs FIRST, catches the obvious cases
# ─────────────────────────────────────────────────────────────

# Order matters - PROTECTED patterns check first, OUTCOME next, then proxies.
# We match on normalized names (lowercase, underscores/hyphens stripped).

_PROTECTED_PATTERNS = [
    r"^(sex|gender)$",
    r"^(race|ethnicity|ethnic.*group)$",
    r"^(age|age_group|age.*band|age.*range|birth.*year|dob)$",
    r"^(religion|faith)$",
    r"^(disability|disabled|impairment)$",
    r"^(national.*origin|native.*country|nationality|citizenship|country.*origin)$",
    r"^(marital.*status)$",        # in some jurisdictions, also protected
    r"^(pregnancy|pregnant)$",
    r"^(veteran.*status|veteran)$",
    r"^(sexual.*orientation|orientation)$",
    r"^(gender.*identity)$",
]

_OUTCOME_PATTERNS = [
    r"^(income|salary|wage|earnings|pay)$",
    r"^(approved|approval|hired|hire|rejected|denial|denied|admitted|admission)$",
    r"^(loan.*status|loan.*approved|credit.*decision|default)$",
    r"^(recidiv|score_text|two.*year.*recid)$",
    r"^(target|label|class|y|outcome|prediction)$",
    r"^(churn|churned|converted|purchased)$",
    r"^(>?=?\s*50k|over50k|above50k)$",
]

# Proxy patterns: these tend to correlate with a protected attribute.
# Value is the protected attribute(s) they usually proxy for.
_PROXY_PATTERNS: list[tuple[str, list[str]]] = [
    (r"^(zip|zipcode|postal.*code|postcode)$", ["race", "national_origin"]),
    (r"^(occupation|job.*title|profession)$", ["sex", "race"]),
    (r"^(relationship|household.*role)$", ["sex"]),
    (r"^(marital.*status|married)$", ["sex", "age"]),
    (r"^(first.*name|given.*name|fname|forename)$", ["sex", "race"]),
    (r"^(last.*name|surname|family.*name|lname)$", ["race", "national_origin"]),
    (r"^(workclass|work.*class|employment.*type)$", ["race", "sex"]),
    (r"^(education|degree|school|institution)$", ["race"]),
]

# Known-safe features - skip Gemini entirely.
_NEUTRAL_PATTERNS = [
    r"^(hours.*per.*week|weekly.*hours|work.*hours)$",
    r"^(capital.*gain|capital.*loss)$",
    r"^(education.*num|years.*education)$",
    r"^(fnlwgt|final.*weight|sampling.*weight)$",
    r"^(id|index|row.*id|record.*id|uuid)$",
]


def _norm(name: str) -> str:
    return re.sub(r"[\s_\-\.]+", "_", name.strip().lower())


def _rules_classify(column_meta: list[dict]) -> tuple[dict[str, dict], list[str]]:
    """
    Return (classified_dict, unresolved_column_names).

    classified_dict maps name -> { name, type, proxies, confidence }.
    Unresolved columns are those the rules couldn't decide on confidently -
    these are the only ones we'll actually send to Gemini.
    """
    classified: dict[str, dict] = {}
    unresolved: list[str] = []

    # First pass - detect protected columns (needed as proxy targets)
    protected_names: list[str] = []
    for col in column_meta:
        nname = _norm(col["name"])
        for pattern in _PROTECTED_PATTERNS:
            if re.match(pattern, nname):
                protected_names.append(col["name"])
                break

    # Second pass - full classification
    for col in column_meta:
        name = col["name"]
        nname = _norm(name)
        matched_type: Optional[str] = None
        matched_proxies: list[str] = []

        for pattern in _PROTECTED_PATTERNS:
            if re.match(pattern, nname):
                matched_type = "PROTECTED"
                break

        if matched_type is None:
            for pattern in _OUTCOME_PATTERNS:
                if re.match(pattern, nname):
                    matched_type = "OUTCOME"
                    break

        if matched_type is None:
            for pattern in _NEUTRAL_PATTERNS:
                if re.match(pattern, nname):
                    matched_type = "NEUTRAL"
                    break

        if matched_type is None:
            for pattern, proxy_for in _PROXY_PATTERNS:
                if re.match(pattern, nname):
                    # Only treat it as a proxy candidate if the corresponding
                    # protected column is actually in this dataset.
                    hits = [
                        p for p in protected_names
                        if any(pt in _norm(p) for pt in proxy_for)
                    ]
                    if hits:
                        matched_type = "AMBIGUOUS"
                        matched_proxies = hits
                    break

        if matched_type is not None:
            classified[name] = {
                "name": name,
                "type": matched_type,
                "proxies": matched_proxies,
                "confidence": "high",
            }
        else:
            unresolved.append(name)

    return classified, unresolved


# ─────────────────────────────────────────────────────────────
# Disk cache
# ─────────────────────────────────────────────────────────────

def _cache_key(ingest_result: dict) -> str:
    """Stable hash of column-meta so identical datasets reuse classifications."""
    payload = json.dumps(
        [
            {"name": c["name"], "dtype": c.get("dtype"), "kind": c.get("kind")}
            for c in ingest_result["column_meta"]
        ],
        sort_keys=True,
    )
    return hashlib.sha1(payload.encode()).hexdigest()[:16]


def _cache_get(key: str) -> Optional[dict]:
    path = _CACHE_DIR / f"{key}.json"
    if path.exists():
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return None
    return None


def _cache_put(key: str, value: dict) -> None:
    path = _CACHE_DIR / f"{key}.json"
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(value, f, indent=2)
    except Exception as e:
        print(f"  [cache] write failed: {e}")


# ─────────────────────────────────────────────────────────────
# Gemini call (only for unresolved columns)
# ─────────────────────────────────────────────────────────────

def _call_gemini_for_unresolved(
    unresolved_cols: list[dict],
    known_protected: list[str],
    dataset_name: str,
) -> list[dict]:
    """
    Ask Gemini to classify ONLY the columns we couldn't resolve from rules.
    Retries up to 3 times on transient errors with exponential backoff.
    Raises on permanent failure - the caller decides whether to fall back.
    """
    from google import genai
    from google.genai import types

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise EnvironmentError("GEMINI_API_KEY not set")

    client = genai.Client(api_key=api_key)

    column_descriptions = []
    for col in unresolved_cols:
        samples = ", ".join(str(v) for v in col.get("sample_values", [])[:5])
        column_descriptions.append(
            f'  - name: "{col["name"]}" | dtype: {col.get("dtype")} | '
            f'kind: {col.get("kind")} | samples: [{samples}]'
        )

    known_protected_hint = (
        f"\nKnown protected columns already in this dataset: {', '.join(known_protected)}"
        if known_protected else ""
    )

    prompt = f"""You are a bias auditor classifying columns in the dataset "{dataset_name}".

Classify ONLY these columns (others have already been handled):
{chr(10).join(column_descriptions)}
{known_protected_hint}

For each column, return one of:
  PROTECTED   - demographic attribute (age, race, sex, religion, disability, etc.)
  OUTCOME     - the label a model would predict (income, approved, hired, score)
  AMBIGUOUS   - correlates with a protected attribute (list which one in "proxies")
  NEUTRAL     - no demographic correlation (hours worked, education years, etc.)

Return ONLY this JSON - no markdown, no prose:
{{"columns":[{{"name":"...","type":"...","proxies":["..."]}}]}}"""

    last_err: Optional[Exception] = None
    for attempt in range(3):
        try:
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                config=types.GenerateContentConfig(
                    system_instruction=(
                        "You are a data bias auditor. You always respond with valid JSON only."
                    ),
                    temperature=0.0,
                    max_output_tokens=2048,
                ),
                contents=prompt,
            )
            raw = (response.text or "").strip()
            raw = re.sub(r"^```(?:json)?\s*", "", raw)
            raw = re.sub(r"\s*```$", "", raw.strip()).strip()
            parsed = json.loads(raw)
            return parsed.get("columns", [])
        except Exception as e:
            last_err = e
            msg = str(e).lower()
            # Retry on transient errors, fail fast on permanent ones
            if any(s in msg for s in ("429", "503", "resource_exhausted", "unavailable", "overloaded")):
                sleep_for = (2 ** attempt) + 0.5  # 1.5s, 2.5s, 4.5s
                print(f"  [Gemini] transient error ({e}), retrying in {sleep_for:.1f}s")
                time.sleep(sleep_for)
                continue
            raise

    assert last_err is not None
    raise last_err


# ─────────────────────────────────────────────────────────────
# Public entry point
# ─────────────────────────────────────────────────────────────

def classify(ingest_result: dict, output_path: Optional[str] = None) -> dict:
    """
    Classify columns. Tries: (1) disk cache, (2) rules-based, (3) Gemini for leftovers.
    Falls back gracefully on every failure - we never leave the user staring at
    a rate-limit error when we could have done the obvious parts ourselves.
    """
    cache_key = _cache_key(ingest_result)
    cached = _cache_get(cache_key)
    if cached:
        print(f"  [classifier] cache hit ({cache_key})")
        if output_path:
            Path(output_path).parent.mkdir(parents=True, exist_ok=True)
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(cached, f, indent=2)
        return cached

    column_meta = ingest_result["column_meta"]

    # Step 1 - rules first
    rules_classified, unresolved = _rules_classify(column_meta)
    print(f"  [classifier] rules resolved {len(rules_classified)}/{len(column_meta)} columns")

    used_fallback = False
    gemini_classified: list[dict] = []

    if unresolved:
        unresolved_meta = [c for c in column_meta if c["name"] in unresolved]
        known_protected = [n for n, v in rules_classified.items() if v["type"] == "PROTECTED"]
        try:
            gemini_classified = _call_gemini_for_unresolved(
                unresolved_meta, known_protected, ingest_result["dataset_name"]
            )
            print(f"  [classifier] Gemini classified {len(gemini_classified)} leftover columns")
        except Exception as e:
            print(f"  [classifier] Gemini failed ({e}) - using NEUTRAL fallback for unresolved columns")
            used_fallback = True
            gemini_classified = [
                {"name": n, "type": "NEUTRAL", "proxies": []} for n in unresolved
            ]

    # Merge
    known_names = {c["name"] for c in column_meta}
    known_protected = [n for n, v in rules_classified.items() if v["type"] == "PROTECTED"]
    known_protected_extra = [
        e["name"] for e in gemini_classified
        if e.get("type") == "PROTECTED" and e.get("name") in known_names
    ]
    known_protected += known_protected_extra

    classified: dict[str, dict] = dict(rules_classified)
    for entry in gemini_classified:
        name = entry.get("name", "").strip()
        col_type = entry.get("type", "NEUTRAL").strip().upper()
        proxies = entry.get("proxies", []) or []

        if name not in known_names:
            continue
        if col_type not in VALID_TYPES:
            col_type = "NEUTRAL"
        if col_type != "AMBIGUOUS":
            proxies = []
        else:
            proxies = [p for p in proxies if p in known_names]

        classified[name] = {
            "name": name,
            "type": col_type,
            "proxies": proxies,
            "confidence": "medium",
        }

    # Backfill anything still missing
    for col in column_meta:
        if col["name"] not in classified:
            classified[col["name"]] = {
                "name": col["name"],
                "type": "NEUTRAL",
                "proxies": [],
                "confidence": "low",
            }

    # Bucket
    buckets = {"protected": [], "outcome": [], "ambiguous": [], "neutral": []}
    for entry in classified.values():
        buckets[entry["type"].lower()].append({
            "name": entry["name"],
            "type": entry["type"],
            "proxies": entry["proxies"],
        })

    schema_map = {
        "version": SCHEMA_VERSION,
        "generated_by": "unveil-hybrid-classifier",
        "dataset": ingest_result["dataset_name"],
        "used_fallback": used_fallback,
        "columns": buckets,
    }

    _cache_put(cache_key, schema_map)

    if output_path:
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(schema_map, f, indent=2)
        print(f"  schema_map.json written → {output_path}")

    return schema_map


# Keep the legacy summarize helper so callers don't break
def summarize(schema_map: dict) -> None:
    print(f"\n  Dataset: {schema_map.get('dataset')}")
    for bucket, label in [
        ("protected", "SENSITIVE"),
        ("outcome", "TARGET"),
        ("ambiguous", "POSSIBLE PROXY"),
        ("neutral", "REGULAR"),
    ]:
        entries = schema_map["columns"].get(bucket, [])
        if entries:
            print(f"  {label}:")
            for e in entries:
                proxy_str = f"  → proxies: {e['proxies']}" if e["proxies"] else ""
                print(f"    • {e['name']}{proxy_str}")

