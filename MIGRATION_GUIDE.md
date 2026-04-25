# Unveil — Migration Guide

This folder contains the revamped code to convert your **unbiased-ai-decisions** repo into **Unveil**. Here's exactly what to do.

## TL;DR — what changed

| Problem you reported | Fix delivered |
|---|---|
| "workclass — No bias metrics for this column" | `stats.py` now computes proxy-strength (Cramér's V) + slice eval for AMBIGUOUS columns. `ColumnCard` renders meaningful content for every column type. |
| "every age is shown in that bar graph" | `slice_eval.py` auto-bins: age → `<25 / 25-34 / 35-44 / 45-54 / 55+`, country → top-5 + "Other", numeric → quartiles. |
| "Gemini quota / rate limit keeps happening" | New classifier calls Gemini only for columns the rules can't resolve (common columns like `sex`, `race`, `age`, `income` never hit the API). Disk cache by column-hash. |
| "my report keeps getting cut short" | Report is now generated in 4 independent sections (Executive Summary / Critical Findings / Proxy Risk / Recommendations). Each has its own token budget. One failing section doesn't kill the rest. |
| "terminology is ass" | Whole UI goes through `terminology.js`: **Unfair / Borderline / Fair** instead of BIASED/AMBIGUOUS/CLEAN. **Sensitive / Possible proxy / Regular feature** instead of PROTECTED/AMBIGUOUS/NEUTRAL. |
| "login + dashboard for saved audits" | New `Login` / `SignUp` / `Dashboard` pages. Firebase Auth + Firestore with automatic localStorage fallback if Firebase isn't configured. |
| "rename project" | **Unveil** — plays on "uncover bias". |

---

## Install

### 1. Copy the files

From this folder into your repo, preserving paths. Everything under `backend/` replaces the matching backend file. Everything under `src/` replaces or adds the matching frontend file.

```
Copy these files (replaces existing):
  backend/gemini_classifier.py    ← rules-first classifier with cache
  backend/slice_eval.py           ← binning + top-N grouping
  backend/stats.py                ← proxy metrics for AMBIGUOUS columns
  backend/pipeline.py             ← chunked Gemini report

  src/index.css                   ← new tokens (status-unfair, role-sensitive, etc.)
  src/App.jsx                     ← routes for /login, /signup, /dashboard
  src/lib/api.js                  ← retry metadata for errors
  src/lib/gemini.js               ← chunked report with cache
  src/lib/AuditContext.jsx        ← adds user + saveCurrentAudit()
  src/components/Navbar.jsx       ← rebrand + user menu
  src/components/ColumnCard.jsx   ← new terminology, handles every column type
  src/components/SliceChart.jsx   ← respects binned groups
  src/pages/Landing.jsx           ← rebranded
  src/pages/Report.jsx            ← chunked generation + retry countdown
  src/pages/DatasetAudit.jsx      ← new terminology + save button
  src/pages/ModelAudit.jsx        ← new terminology
  src/pages/Glossary.jsx          ← plain-English glossary
  package.json                    ← adds firebase dep

Copy these files (new):
  src/lib/terminology.js          ← single source of truth for all UI strings
  src/lib/firebase.js             ← lazy Firebase init
  src/lib/auth.js                 ← sign up / sign in / sign out
  src/lib/storage.js              ← save/list/delete audits
  src/pages/Login.jsx
  src/pages/SignUp.jsx
  src/pages/Dashboard.jsx
  .env.example                    ← template for Firebase config
```

**Files you do NOT need to touch:** `Upload.jsx`, `ingestor.py`, `proxy_detection.py`, `probe_generator.py`, `shap_explainer.py`, `counterfactual_engine.py`, `api.py`, the mock data, the tests. They're compatible with the new code.

### 2. Install the new frontend dependency

```bash
npm install
```

The only new dep is `firebase` (~2MB, lazy-loaded so it doesn't block initial paint).

### 3. Set up environment variables

Copy `.env.example` to `.env` in the project root:

```bash
cp .env.example .env
```

**Required for full functionality:**
```
VITE_API_URL=http://localhost:8001
VITE_GEMINI_API_KEY=your_gemini_key_from_aistudio.google.com
```

**Optional (for cloud-synced auth):**
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Without Firebase, auth still works — users get a "guest" account stored in localStorage. Useful for a demo video where you don't want to set up Firebase.

**Backend also needs the Gemini key:**
```bash
# Linux/mac
export GEMINI_API_KEY=your_key_here
# Windows PowerShell
$env:GEMINI_API_KEY = "your_key_here"
```

### 4. (Optional) Set up Firebase for real auth

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com)
2. Add a web app (Project settings → General → Your apps → Web)
3. Copy the config values into `.env`
4. Enable **Email/Password** sign-in (Authentication → Sign-in method → Enable Email/Password)
5. Create a Firestore database (Build → Firestore → Create database → start in test mode)
6. Add this security rule (Firestore → Rules):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/audits/{auditId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### 5. Run it

```bash
# Terminal 1 — backend
cd backend && python -m uvicorn api:app --reload --port 8001

# Terminal 2 — frontend
npm run dev
```

Open http://localhost:5173 and you should see the new Unveil landing page.

---

## What to expect on first run

**Upload UCI Adult dataset:**

1. **Classification** runs fast — `sex`, `race`, `age`, `income` are resolved by the rules-based pass without calling Gemini. Only unusual columns hit the API. If you're rate-limited, you'll see a yellow banner saying "some columns classified using built-in rules instead" and the app keeps working.

2. **Dataset audit page** now shows:
   - An overall verdict banner ("Unfair patterns detected" / "No significant bias detected")
   - Every column has a card with a plain-English finding
   - `workclass` will show its proxy strength + correlated target (no more "No bias metrics")
   - `age` shows 5 buckets in the slice chart, not 73
   - `native-country` shows top-5 + "Other"

3. **Report page** generates 4 sections independently. If Gemini rate-limits mid-generation, you get whichever sections finished plus a "(Couldn't generate this section)" placeholder for the one that failed. Retry only regenerates what's missing (cached sections stay).

4. **Dashboard** (click your avatar → "My audits") lists every audit you've saved, with summary counts and a verdict pill.

---

## If something breaks

**"Module not found: firebase"**
→ Run `npm install`. Firebase is a new dep.

**"Cannot read properties of null (reading 'columns')"**
→ A cached `schemaMap` in localStorage is from the old format. Hit the "Reset" button or run `localStorage.clear()` in your browser console.

**"No sensitive attributes found in the dataset schema"**
→ Your schema_map has no PROTECTED columns. This means either (a) the dataset genuinely has no sensitive attributes, or (b) the classifier is being overly cautious. Check `/audit/dataset` — every column should have a role pill. If none say "Sensitive", the dataset probably doesn't have any demographic columns.

**Gemini still rate-limiting every time**
→ The free Gemini tier is ~10 req/min. The new classifier cuts calls dramatically but if you're rapid-testing, you'll still hit it. Options:
  1. Wait 60 seconds between uploads
  2. Enable billing on your Google Cloud project (pay-as-you-go pricing)
  3. Self-host a different LLM — the classifier's JSON contract is simple, any model that follows instructions will work

**Report section shows "(Couldn't generate this section)"**
→ That specific section's Gemini call failed. The others may have succeeded. Click "Regenerate" to retry — cached sections won't re-run, only the failed ones.

---

## What's included vs what you'd still build out

**Included:**
- Full backend bug fixes (the 4 root causes)
- Full frontend terminology overhaul
- Auth (Firebase + localStorage fallback)
- Saved audits dashboard
- Rebrand throughout UI

**Not included** (since you didn't ask and it's a hackathon):
- Upload a model file from the dashboard (existing Upload flow works fine)
- Sharing audits between users
- Export report as PDF (the plain markdown is copy-pasteable)
- Password reset flow (Firebase supports it but there's no UI for it yet)
- Dark mode

Want any of those? Just ask.

---

## One thing worth knowing

The backend JSON shape is **backward-compatible**. Old field names (PROTECTED, AMBIGUOUS, BIASED, CLEAN) still exist — that's why your existing tests and any external scripts won't break. The entire user-facing rename happens in `src/lib/terminology.js`. If you want to rename more aggressively later, that's the only file to change.

Ship it. 🚀
