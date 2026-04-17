# UnbiasedAI

Algorithmic bias detection and fairness auditing platform for datasets and machine learning models.

**[Live Demo](https://unbiased-ai-demo.web.app)**

---

## What It Does

UnbiasedAI is a two-part fairness auditing system built for the GDSC Hackathon 2026.

**Part A — Dataset Bias Auditor**
Analyzes training data before a model is built. Columns are classified as Protected, Outcome, Ambiguous, or Neutral using Gemini. The system then runs counterfactual probing, proxy detection via Cramér's V and mutual information, disparate impact ratio, demographic parity gap, and slice-based evaluation (FPR/FNR per group). Results are scored against the legal 80% disparate impact threshold.

**Part B — Model Behavior Analyzer**
Runs black-box probe pairs and SHAP explainability on trained models to detect what the model actually learned — including hidden proxy features that enable indirect discrimination even when protected attributes are excluded from training. A Gemini-generated plain-English report bridges technical findings for non-technical stakeholders.

---

## Tech Stack

### Frontend

| Tool | Purpose |
|------|---------|
| React 19 + Vite | Component framework and dev/build tooling |
| React Router v7 | Client-side routing |
| Tailwind CSS v4 | Utility-first styling |
| Recharts | Slice evaluation and SHAP bar charts |
| Framer Motion | Page transitions and animations |
| PapaParse | CSV parsing in the browser |
| SheetJS (xlsx) | XLSX/XLS parsing in the browser |
| Firebase Hosting | Production deployment |

### Backend (M1–M3, Python)

| Tool | Purpose |
|------|---------|
| google-generativeai | Gemini 1.5 Flash via AI Studio — column classification and audit narrative |
| pandas + numpy | Data normalization and computation |
| scipy | Chi-squared test for Cramér's V |
| scikit-learn | Mutual information, SHAP KernelExplainer support, label encoding |
| shap | TreeExplainer and KernelExplainer for feature attribution |
| FastAPI + uvicorn | HTTP endpoint for black-box model probing |

---

## Project Structure

```
unbiased-ai/
├── backend/
│   ├── ingestor.py              # M1: CSV/TSV/JSON/JSONL/XLSX → normalized DataFrame + metadata
│   ├── gemini_classifier.py     # M1: Gemini column classification → schema_map.json
│   ├── proxy_detection.py       # M1: Cramér's V + mutual information → proxy_flags.json
│   ├── probe_generator.py       # M3: synthetic probe pairs, t-test significance
│   └── shap_explainer.py        # M3: TreeExplainer / KernelExplainer + SHAP cross-reference
│
├── schemas/                     # Inter-module JSON contracts (locked Day 1)
│   ├── schema_map.json          # M1 → M2: column classifications + proxy refs
│   ├── proxy_flags.json         # M1 → M2: Cramér's V and MI scores per proxy pair
│   ├── bias_report.json         # M2 → M4: disparate impact, parity gaps, slice data
│   └── model_bias_report.json   # M3 → M4: probe scores, SHAP rankings, p-values
│
├── src/
│   ├── pages/
│   │   ├── Landing.jsx          # Home page with demo entry point
│   │   ├── Upload.jsx           # Drag-and-drop dataset + model endpoint input
│   │   ├── DatasetAudit.jsx     # Part A results dashboard
│   │   ├── ModelAudit.jsx       # Part B results dashboard
│   │   └── Report.jsx           # Gemini plain-English audit narrative
│   ├── components/
│   │   ├── BiasGauge.jsx        # Radial gauge for disparate impact score
│   │   ├── ColumnCard.jsx       # Per-column classification card
│   │   ├── SliceChart.jsx       # FPR/FNR bar chart per protected group
│   │   ├── ShapChart.jsx        # SHAP feature importance bar chart
│   │   ├── ProxyAlert.jsx       # Proxy column warning banner
│   │   ├── SeverityBadge.jsx    # BIASED / AMBIGUOUS / CLEAN color badge
│   │   ├── GeminiReport.jsx     # Renders Gemini narrative markdown
│   │   └── Navbar.jsx
│   └── lib/
│       ├── gemini.js            # Gemini API call wrapper (frontend)
│       ├── fileParser.js        # CSV/XLSX parsing utilities
│       ├── mockData.js          # Pre-analyzed UCI Adult results for demo mode
│       └── constants.js         # Thresholds, column type labels, color maps
│
├── endpoint_skeleton.py         # M3: FastAPI stub for black-box model probing
├── shap_tester.py               # M3: SHAP environment sanity check
└── docs/
    └── filetree.md              # Full intended project structure
```

---

## Frontend Setup

```bash
# Clone the repo
git clone https://github.com/your-org/unbiased-ai.git
cd unbiased-ai

# Install dependencies
npm install

# Set your Gemini API key (frontend — for the Gemini report narrative)
echo "VITE_GEMINI_API_KEY=your_key_here" > .env.local

# Start dev server
npm run dev
```

The app runs at `http://localhost:5173`.

To build and deploy:

```bash
npm run build
firebase deploy
```

---

## Backend Setup (M1 — Data Pipeline)

The backend modules are pure Python. They run locally and write JSON output files to `schemas/` which the frontend consumes.

**Requirements: Python 3.11+**

```bash
pip install -r requirements.txt
```

**Set your Gemini API key (backend — for column classification):**

```bash
export GEMINI_API_KEY=your_key_here
```

Get a free key at [aistudio.google.com](https://aistudio.google.com) — no billing required.

To persist it across terminal sessions, add the export line to your `~/.zshrc` or `~/.bashrc`.

**Run the M1 pipeline on a dataset:**

```python
from backend.ingestor import ingest
from backend.gemini_classifier import classify
from backend.proxy_detection import detect

result     = ingest("data/uci_adult.csv")
schema_map = classify(result)           # writes schemas/schema_map.json
proxy_flags = detect(result, schema_map) # writes schemas/proxy_flags.json
```

**Self-test each module independently:**

```bash
python backend/ingestor.py          # no API key needed
python backend/proxy_detection.py   # no API key needed
python backend/gemini_classifier.py # requires GEMINI_API_KEY
```

---

## Inter-Module JSON Contracts

These files in `schemas/` are the agreed handoff contracts between members. **Do not change their structure without team sign-off.**

### `schema_map.json` — M1 → M2

Output of `gemini_classifier.py`. Maps every column to one of four types.

```json
{
  "version": "1.0.0",
  "dataset": "uci_adult",
  "columns": {
    "protected": [{ "name": "gender", "type": "PROTECTED", "proxies": [] }],
    "outcome":   [{ "name": "income", "type": "OUTCOME",   "proxies": [] }],
    "ambiguous": [{ "name": "occupation", "type": "AMBIGUOUS", "proxies": ["gender", "race"] }],
    "neutral":   [{ "name": "education", "type": "NEUTRAL", "proxies": [] }]
  }
}
```

### `proxy_flags.json` — M1 → M2

Output of `proxy_detection.py`. Lists columns statistically correlated with protected attributes.

```json
{
  "version": "1.0.0",
  "dataset": "uci_adult",
  "proxy_columns": [
    { "column": "relationship", "proxies_for": "gender", "cramers_v": 0.79, "mutual_information": 0.41, "verdict": "PROXY" },
    { "column": "marital-status", "proxies_for": "gender", "cramers_v": 0.35, "mutual_information": 0.07, "verdict": "WEAK_PROXY" }
  ]
}
```

Proxy verdicts use these thresholds:

| Verdict | Cramér's V | Mutual Information |
|---------|-----------|-------------------|
| `PROXY` | ≥ 0.30 AND | ≥ 0.10 |
| `WEAK_PROXY` | ≥ 0.10 OR | ≥ 0.05 |
| `NONE` | below both — not written to file |

### `bias_report.json` — M2 → M4

Generated by M2's `counterfactual_engine.py` and `stats.py`. Contains disparate impact ratio, parity gap, p-values, and per-slice FPR/FNR for each protected attribute.

### `model_bias_report.json` — M3 → M4

Generated by M3's `probe_generator.py` and `shap_explainer.py`. Contains probe mean differences, t-test p-values, SHAP rankings, and per-attribute verdicts.

---

## Demo

**Quick demo (no upload needed):**
Click "Try Live Demo — UCI Adult Dataset" on the landing page. Loads pre-analyzed results from the UCI Adult Income dataset and renders the full audit dashboard.

**Custom dataset:**
Navigate to `/upload` and drag-and-drop your own CSV, JSON, or XLSX file. The system accepts files up to 5,000 rows (sampled automatically if larger).

**Demo datasets with known documented bias:**

| Dataset | Known Bias | Use |
|---------|-----------|-----|
| UCI Adult Income | Gender + Race | Primary demo — disparate impact ratio 0.62 for gender, fails the 0.8 legal threshold |
| COMPAS Recidivism | Race | ProPublica-documented racial bias in criminal risk scores |
| German Credit | Gender + Age | Loan approval decisions — shows the tool generalizes across domains |

---

## Team

Built for GDSC Hackathon 2026.
