# Unveil - AI Bias Auditing Platform

> **Uncover the bias hiding in your data.**  
> Upload a dataset or ML model. Unveil finds unfair outcomes across sensitive attributes, explains what's driving them, and produces a plain-English compliance report - in under a minute.

Built for the **Google AI Solution Challenge** using Gemini 2.5 Flash.

---

[![Live Demo](https://img.shields.io/badge/Live%20Demo-unveil--201cc.web.app-blue?style=for-the-badge&logo=firebase)](https://unveil-201cc.web.app/)
[![API Docs](https://img.shields.io/badge/API%20Docs-FastAPI%20Swagger-green?style=for-the-badge&logo=fastapi)](https://unveil-ee2v.onrender.com/docs)

| | |
|---|---|
| 🌐 **Frontend** | https://unveil-201cc.web.app/ |
| 📡 **Backend API** | https://unveil-ee2v.onrender.com/docs |

---

## What is this?

Unveil is a full-stack web app that audits datasets and machine learning models for algorithmic bias. It's aimed at developers, data scientists, and compliance teams who need to know whether their data or model is treating different demographic groups unfairly - without needing a PhD in fairness research to interpret the results.

You upload a CSV (or XLSX, JSON). Unveil does three things:

1. **Finds which columns are sensitive attributes** - age, sex, race, marital status, etc. - using Gemini to classify them, with a rules-based fallback for common column names.
2. **Measures fairness** across those attributes using disparate impact ratios (the legal 80% / four-fifths rule), approval gaps, and per-group breakdown statistics.
3. **Catches proxy columns** - seemingly neutral columns like `relationship`, `occupation`, or `zip_code` that correlate so strongly with a sensitive attribute that removing the obvious column doesn't fix anything.

On top of that, if you upload a `.pkl` model alongside the dataset, Unveil runs **black-box counterfactual probing** (flipping one attribute at a time and watching the prediction change) plus **SHAP feature attribution** to show which inputs are actually steering decisions.

The whole audit ends with a **Gemini-generated compliance narrative** - an executive summary, per-finding breakdown, proxy risk explanation, and actionable recommendations - written for a non-technical reader, ready to hand to legal or product.

---

## The problem it solves

Algorithmic bias in real deployments isn't usually obvious. A hiring model doesn't say "don't hire women" - it says "candidates from relationship status = *Husband* score higher." A lending model doesn't say "deny minorities" - it says "zip code 94103 is high-risk." The sensitive attribute is already gone from the data; its proxy is doing the work instead.

Unveil was built specifically to surface that second layer. It's not enough to remove `sex` and `race` from your dataset. You need to know that `relationship` has a Cramér's V of 0.73 with `sex`, or that `occupation` has a mutual information score of 0.41 with `race`. That's what the proxy detector does.

---

## Tech stack

| Layer | What |
|-------|------|
| Frontend | React 19, Vite, Tailwind CSS v4, Framer Motion, Recharts |
| Backend | Python, FastAPI, Uvicorn |
| AI | Gemini 2.5 Flash (column classification + report generation) |
| Auth | Firebase Auth (optional) / localStorage fallback |
| Storage | Firestore (optional) / localStorage fallback |
| ML | scikit-learn, SHAP, SciPy |
| File formats | CSV, XLSX, JSON, JSONL, TSV |

---

## Repo structure

```
unveil/
│
├── src/                          # React frontend
│   ├── pages/
│   │   ├── Landing.jsx           # Homepage / marketing
│   │   ├── Upload.jsx            # File upload + analysis orchestration
│   │   ├── DatasetAudit.jsx      # Per-column bias results
│   │   ├── ModelAudit.jsx        # Model fairness + SHAP chart
│   │   ├── Report.jsx            # Gemini compliance narrative
│   │   ├── Dashboard.jsx         # Saved audit history
│   │   ├── Glossary.jsx          # Plain-English term definitions
│   │   ├── Login.jsx
│   │   └── SignUp.jsx
│   │
│   ├── components/
│   │   ├── Navbar.jsx
│   │   ├── ColumnCard.jsx        # Per-column bias breakdown card
│   │   ├── BiasGauge.jsx         # Visual fairness ratio indicator
│   │   ├── SliceChart.jsx        # Per-group approval rate bar chart
│   │   ├── ShapChart.jsx         # SHAP feature importance chart
│   │   ├── ProxyAlert.jsx        # Proxy column warning banner
│   │   └── GeminiReport.jsx      # Report renderer
│   │
│   └── lib/
│       ├── api.js                # Frontend → backend HTTP client
│       ├── gemini.js             # Direct Gemini API fallback (browser-side)
│       ├── auth.js               # Firebase Auth + local account mode
│       ├── storage.js            # Firestore + localStorage audit persistence
│       ├── AuditContext.jsx      # Global audit state (React context)
│       └── fileParser.js         # Client-side CSV/XLSX preview
│
├── backend/
│   ├── api.py                    # FastAPI routes (HTTP only - no business logic)
│   ├── pipeline.py               # Analysis orchestration (Part A + Part B)
│   ├── ingestor.py               # File ingestion → normalized DataFrame
│   ├── gemini_classifier.py      # Column classification via Gemini + rules fallback
│   ├── proxy_detection.py        # Cramér's V + mutual information proxy detection
│   ├── stats.py                  # Disparate impact, p-values, per-group stats
│   ├── slice_eval.py             # Per-group approval rate / FPR / FNR calculation
│   ├── counterfactual_engine.py  # Row cloning + attribute flipping for model probing
│   ├── probe_generator.py        # Black-box model probing (100+ probes / attribute)
│   ├── shap_explainer.py         # TreeExplainer / KernelExplainer wrapper
│   ├── train_demo_model.py       # Script to (re)train the bundled demo model
│   └── demo_model.pkl            # Pre-trained sklearn model on UCI Adult
│
├── start.sh                      # macOS / Linux startup script
├── start.bat                     # Windows CMD startup script
├── start.ps1                     # Windows PowerShell startup script
├── requirements.txt              # Python dependencies
├── package.json                  # Node dependencies
└── adult.csv                     # UCI Adult Income dataset (sample)
```

---

## How the analysis works

### Part A - Dataset audit

```
ingestor.py  →  gemini_classifier.py  →  proxy_detection.py  →  stats.py
```

**1. Ingest** - reads CSV/XLSX/JSON into a pandas DataFrame, normalises column names, extracts column metadata (dtype, unique count, sample values).

**2. Classify** - Gemini 2.5 Flash reads the column names and sample values and assigns each one a role: `PROTECTED` (sensitive attribute), `OUTCOME` (prediction target), `AMBIGUOUS` (proxy candidate), or `NEUTRAL`. A rules-based pass runs first and handles obvious names like `sex`, `race`, `age`, `income` without burning API quota.

**3. Proxy detection** - for every `NEUTRAL` or `AMBIGUOUS` column, compute:
- **Cramér's V** against each `PROTECTED` column (association strength, 0-1)
- **Mutual information** between them

Thresholds: Cramér's V ≥ 0.30 AND MI ≥ 0.10 → `PROXY`. Either alone → `WEAK_PROXY`.

**4. Bias stats** - for each `PROTECTED` column, slice the dataset by group and compute:
- **Disparate impact ratio**: `min(group approval rate) / max(group approval rate)`. Below **0.80** fails the EEOC four-fifths rule.
- **Parity gap**: raw percentage-point difference between best and worst group. Above **10pp** is flagged.
- **p-value** (chi-squared test): below 0.05 = statistically significant.
- Verdict: `BIASED`, `AMBIGUOUS`, or `CLEAN`.

### Part B - Model audit

```
probe_generator.py  →  counterfactual_engine.py  →  shap_explainer.py
```

**Counterfactual probing** - generates 100+ synthetic row pairs per protected attribute. Each pair is identical except one attribute is flipped (e.g. `sex: Male → Female`). The model scores both. A large mean shift + low p-value = the model is using that attribute.

**SHAP** - runs `TreeExplainer` for sklearn tree-based models (fast, exact) or `KernelExplainer` for everything else (model-agnostic, slower). Returns per-feature importance ranked by mean absolute SHAP value. Protected and proxy columns are highlighted in the chart.

### Report generation

Four Gemini calls in sequence, each with its own large token budget:
- Executive Summary (1024 tokens)
- Critical Findings (8192 tokens - one paragraph per biased column)
- Proxy Risk (2048 tokens)
- Recommendations (1536 tokens)

Sections are generated independently. If one hits a rate limit, the others still complete. Results are cached by content hash so regenerating the same audit is free.

---

## Setup

### Requirements

- **Node.js** 18+
- **Python** 3.10+
- A **Gemini API key** (free at [aistudio.google.com](https://aistudio.google.com/app/apikey))

### 1. Clone the repo

```bash
git clone https://github.com/Jay-Jay-Tee/unbiased-ai-decisions.git
cd unbiased-ai-decisions
```

### 2. Install dependencies

```bash
# Frontend
npm install

# Backend
pip install -r requirements.txt
```

### 3. Create a `.env` file

```env
# Required
VITE_GEMINI_API_KEY=your_gemini_api_key_here

# Backend URL - leave as-is for local development
VITE_API_URL=http://localhost:8001/api

# Optional: disable auth requirement for local testing only
# VITE_REQUIRE_AUTH_FOR_ANALYSIS=false

# Optional: Firebase (for cloud accounts + audit sync across devices)
# Without these, the app uses localStorage - fully functional but device-local
# VITE_FIREBASE_API_KEY=
# VITE_FIREBASE_AUTH_DOMAIN=
# VITE_FIREBASE_PROJECT_ID=
# VITE_FIREBASE_STORAGE_BUCKET=
# VITE_FIREBASE_MESSAGING_SENDER_ID=
# VITE_FIREBASE_APP_ID=
```

### 4. Start the app

**macOS / Linux:**
```bash
bash start.sh
```

**Windows (CMD):**
```bat
start.bat
```

**Windows (PowerShell):**
```powershell
.\start.ps1
```

The scripts check for dependencies, install anything missing, and start both services:
- Frontend → [http://localhost:5173](http://localhost:5173)
- Backend API → [http://localhost:8001](http://localhost:8001)

---

## Running an audit

1. **Create an account** (or continue as guest - audits won't be saved in guest mode)
2. **Upload a dataset** - drag a CSV, XLSX, or JSON file onto the upload zone. `adult.csv` in the repo root is a ready-to-use example.
3. Optionally **upload a model** - a `.pkl` sklearn model. If you skip this, Unveil audits the dataset only.
4. Hit **Run audit** - the status panel shows each step as it completes.
5. View results on the **Dataset Audit** page - columns are sorted by severity, each with its fairness ratio, approval gap, per-group chart, and proxy strength.
6. If you uploaded a model, the **Model Audit** page shows counterfactual probing results and the SHAP feature chart.
7. Hit **Generate report** to get the Gemini compliance narrative.
8. Audits are **auto-saved** to your dashboard on completion.

---

## Authentication and data storage

**Without Firebase** (default):  
Accounts are stored in `localStorage`. Each email address creates a stable local account - signing up with `you@example.com` always returns the same account on the same browser. Audits are saved locally under your account's uid. Nothing leaves your device.

**With Firebase** (set the `VITE_FIREBASE_*` env vars):  
Full cloud accounts via Firebase Auth. Audits persist in Firestore and sync across devices. This is the production mode.

Guest mode lets you run audits without signing up. The results are shown in full but not saved to a dashboard. The "My audits" page shows a sign-up prompt.

---

## Fairness concepts - quick reference

| Term | What it means |
|------|--------------|
| **Disparate impact ratio** | `min_group_rate / max_group_rate`. Below **0.80** fails the EEOC four-fifths rule. |
| **Parity gap** | Raw percentage-point difference between best and worst group. Above **10pp** is flagged. |
| **p-value** | Probability the gap is random noise. Below **0.05** = statistically significant. |
| **Proxy column** | A neutral-looking column that encodes a sensitive attribute. Cramér's V ≥ 0.30 = proxy. |
| **Cramér's V** | Association strength between two categorical columns, 0-1. |
| **Counterfactual probe** | Flip one attribute, re-score, measure the change. If the model cares, prediction shifts. |
| **SHAP value** | How much credit each feature gets for each individual prediction. |

The full glossary is in the app at `/glossary`.

---

## Running tests

```bash
# Frontend (Vitest)
npm test

# Backend (pytest)
python -m pytest tests/
```

---

## Environment variables reference

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_GEMINI_API_KEY` | **Yes** | Gemini API key - get one free at aistudio.google.com |
| `VITE_API_URL` | No | Backend base URL. Default: `/api` (proxied by Vite) |
| `VITE_REQUIRE_AUTH_FOR_ANALYSIS` | No | Set `false` to skip auth checks locally |
| `VITE_USE_MOCK` | No | Set `false` to disable mock data fallback when backend is offline |
| `VITE_FIREBASE_API_KEY` | No | Firebase project API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | No | e.g. `your-project.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | No | Your Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | No | e.g. `your-project.appspot.com` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | No | Firebase sender ID |
| `VITE_FIREBASE_APP_ID` | No | Firebase app ID |
