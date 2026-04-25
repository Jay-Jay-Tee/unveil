# How to Run UnbiasedAI (End-to-End)

## Prerequisites
- Python 3.10+
- Node.js 18+
- A free Gemini API key from https://aistudio.google.com

---

## Step 1 — Set up environment variables

```bash
cp .env.example .env
# Edit .env and paste your Gemini API key into VITE_GEMINI_API_KEY
```

If you will run protected backend analysis endpoints, also configure Firebase:

```bash
# Frontend Firebase config
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...

# Backend auth enforcement
AUTH_REQUIRED=true
FIREBASE_SERVICE_ACCOUNT_PATH=/absolute/path/to/service-account.json
```

For local-only testing without Firebase auth enforcement:

```bash
AUTH_REQUIRED=false
VITE_REQUIRE_AUTH_FOR_ANALYSIS=false
```

---

## Step 2 — Install Python dependencies

```bash
python -m pip install -r requirements.txt
```

---

## Step 3 — Start the backend

```bash
# From the repo root:
export GEMINI_API_KEY=your_key_here      # Mac/Linux
# $env:GEMINI_API_KEY = "your_key_here" # Windows PowerShell

python -m uvicorn backend.api:app --reload --port 8001
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8001
```

Test it: http://localhost:8001/health

Protected endpoint auth check (expected 401 if no token and AUTH_REQUIRED=true):

```bash
curl -X POST http://localhost:8001/analyze/dataset
```

---

## Step 4 — Start the frontend

```bash
# In a separate terminal, from the repo root:
npm install
npm run dev
```

Open http://localhost:5173

---

## Step 5 — Demo flow

1. Go to **Upload** — drag in `adult.csv` (included in the repo)
2. The app will:
   - Send the file to the backend (`/analyze/dataset`)
   - Gemini classifies columns (PROTECTED/OUTCOME/NEUTRAL/AMBIGUOUS)
   - Proxy detection runs (Cramér's V + mutual information)
   - Bias stats compute (disparate impact, parity gap, slice evaluation)
3. Click **View Dataset Audit** — see real results for your dataset
4. Click **Run Model Audit** — 100 counterfactual probes run automatically
5. Click **Generate Compliance Report** — Gemini writes the narrative live

---

## Deploying for the hackathon demo

### Option A — ngrok (easiest, 5 minutes)
```bash
# With backend running on port 8001:
ngrok http 8001

# Copy the https URL (e.g. https://abc123.ngrok.io)
# Update .env:
VITE_API_URL=https://abc123.ngrok.io

# Rebuild frontend:
npm run build
firebase deploy
```

### Option B — Google Cloud Run
```bash
# Build and deploy the backend:
gcloud run deploy unbiased-ai-backend \
  --source . \
  --command "uvicorn backend.api:app --host 0.0.0.0 --port 8080" \
  --port 8080 \
  --set-env-vars GEMINI_API_KEY=your_key \
  --region us-central1 \
  --allow-unauthenticated

# Get the Cloud Run URL and set it in .env as VITE_API_URL
```

---

## What happens if the backend is offline?

The frontend automatically falls back to pre-computed mock data for the UCI Adult dataset,
with a yellow warning banner. The Gemini report still calls the Gemini API directly from
the browser using VITE_GEMINI_API_KEY. So the demo always works — but live analysis
requires the backend.

When `AUTH_REQUIRED=true`, backend analysis/report endpoints also require a valid Firebase ID token.
Guest users can still browse locally, but protected server analysis calls will show a sign-in prompt.

---

## Architecture

```
Browser (React + Firebase)
    │
    ├── /upload          → POST /analyze/dataset
    │                         M1: ingest → Gemini classify → proxy detect
    │                         M2: bias stats → slice eval → bias_report.json
    │
    ├── /audit/model     → POST /analyze/model
    │                         M3: ProbeGenerator (100 probes/attribute)
    │                             SHAPExplainer (if model .pkl uploaded)
    │
    └── /report          → POST /report/gemini  (backend proxy)
                               OR direct Gemini API call (browser fallback)
```
