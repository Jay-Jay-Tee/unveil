# UnbiasedAI

Algorithmic bias detection and fairness auditing platform for datasets and machine learning models.

**[Live Demo](https://unbiased-ai-demo.web.app)**

---

## About

UnbiasedAI is a two-part fairness auditing system:

**Part A -- Dataset Bias Auditor**
Analyzes training data for disparate impact, parity gaps, and demographic slice imbalances across protected attributes (race, sex, age, etc.). Each column is classified as Protected, Neutral, Ambiguous, or Outcome, and scored against the legal 80% rule threshold. Interactive bias gauges visualize how far each attribute falls from compliance.

**Part B -- Model Behavior Analyzer**
Runs counterfactual probing and SHAP explainability analysis on trained models to detect what the model actually learned -- including hidden proxy features that enable indirect discrimination even when protected attributes are excluded from training.

A Gemini 2.0 Flash integration converts both analyses into a plain-English compliance report readable by non-technical stakeholders.

---

## Tech Stack

| Tool | Purpose |
|------|---------|
| React | Component UI framework |
| Vite | Dev server and production bundler |
| Tailwind CSS | Utility-first styling |
| Recharts | Slice evaluation and SHAP bar charts |
| Framer Motion | Page transitions and card animations |
| Firebase Hosting | Production deployment |
| Gemini API | AI-generated compliance narrative |
| PapaParse | CSV parsing in the browser |
| SheetJS (xlsx) | XLSX/XLS file parsing |

---

## Setup Instructions

```bash
# Clone the repo
git clone https://github.com/your-org/unbiased-ai.git
cd unbiased-ai

# Install dependencies
npm install

# Create environment file
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

## Architecture

UnbiasedAI is built as a 4-module system for the GDSC Hackathon:

| Module | Role | Owner |
|--------|------|-------|
| M1 -- Data Pipeline | Ingests raw CSV/XLSX, normalizes schema, classifies columns as Protected/Neutral/Outcome/Ambiguous using Gemini | Data pipeline lead |
| M2 -- Bias Statistics | Computes disparate impact, parity gap, p-values, and per-group slice metrics (positive rate, FPR, FNR) for each protected attribute | Statistics lead |
| M3 -- Model Analyzer | Runs counterfactual probing and SHAP analysis on pre-trained models to detect learned bias and proxy feature reliance | ML lead |
| M4 -- Frontend | Visualizes all outputs in a React dashboard with interactive bias gauges, slice charts, SHAP charts, and a Gemini narrative report | Frontend + integration lead |

M1/M2/M3 output JSON files that M4 consumes. The agreed schemas are defined in `src/lib/mockData.js`.

---

## Demo Instructions

**Quick demo (no upload needed):**
Click "Try Live Demo -- UCI Adult Dataset" on the landing page. This loads pre-analyzed results from the UCI Adult Income dataset -- one of the most studied examples of algorithmic bias -- and renders the full audit dashboard with bias gauges, slice charts, and SHAP analysis.

**Custom dataset:**
Navigate to `/upload` and drag-and-drop your own CSV, JSON, or XLSX file. The system accepts headerless `.data` files (UCI format) and standard CSVs with headers.

---

## Team

Built for the GDSC Hackathon 2026.
