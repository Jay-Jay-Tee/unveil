# Unveil — Project File Tree

```
unveil-main/
├── .env.example                   # Environment variable template (Firebase, Gemini keys)
├── .firebaserc                    # Firebase project alias config
├── .gitignore
├── LICENSE
├── index.html                     # Vite HTML entry point
├── eslint.config.js               # ESLint flat config
├── tailwind.config.js             # Tailwind CSS configuration
├── vite.config.js                 # Vite bundler config
├── package.json
├── package-lock.json
├── endpoint_skeleton.py           # Root-level copy of the model endpoint contract
│
├── backend/                       # Python FastAPI backend
│   ├── api.py                     # HTTP routing layer (CORS, request parsing, error mapping)
│   ├── pipeline.py                # Central orchestrator: runs M1→M2→M3 in sequence
│   ├── ingestor.py                # CSV/JSON/XLSX → pandas DataFrame
│   ├── gemini_classifier.py       # Gemini column classification prompt + parser
│   ├── proxy_detection.py         # Cramér's V + mutual information proxy scoring
│   ├── counterfactual_engine.py   # Row cloning + outcome shift measurement
│   ├── slice_eval.py              # FPR/FNR/positive rate per protected group
│   ├── stats.py                   # Disparate impact ratio, parity gap, chi-squared
│   ├── probe_generator.py         # Synthetic persona pairs + black-box probing
│   ├── shap_explainer.py          # TreeExplainer + KernelExplainer + cross-ref
│   ├── generate_model_bias_report.py  # Standalone runner for model bias report
│   ├── endpoint_skeleton.py       # Reference contract for external model endpoints
│   ├── demo_model.pkl             # Lightweight demo model (used in dev/testing)
│   └── train_demo_model.py        # Script to regenerate demo_model.pkl
│
├── data/                          # Sample datasets (large files not committed by default)
│   ├── adult.csv                  # UCI Adult Income dataset (raw)
│   └── adult_fixed.csv            # UCI Adult Income dataset (cleaned)
│
├── models/
│   └── adult_demo_model.pkl       # Pre-trained demo model for sample audit flow
│
├── schemas/                       # Shared inter-module JSON contracts
│   ├── schema_map.json            # column classifications + proxy refs
│   ├── proxy_flags.json           # proxy detection scores
│   ├── bias_report.json           # disparate impact, parity gaps, slices
│   └── model_bias_report.json     # probe scores, SHAP rankings, p-values
│
├── public/                        # Static assets served at root by Vite
│   ├── favicon.ico
│   ├── favicon.png
│   ├── favicon-tab.png
│   ├── favicon.svg
│   └── icons.svg
│
├── src/                           # React frontend (Vite + Tailwind)
│   ├── main.jsx                   # React root — mounts App, sets up Router
│   ├── App.jsx                    # Route definitions
│   ├── App.css                    # Minimal app-level overrides
│   ├── index.css                  # Global CSS, design tokens, Tailwind base
│   │
│   ├── assets/
│   │   ├── logo.png               # Unveil wordmark / nav logo
│   │   ├── hero.png               # Landing page hero illustration
│   │   ├── react.svg
│   │   └── vite.svg
│   │
│   ├── components/                # Reusable UI components
│   │   ├── Navbar.jsx             # Top nav with auth user menu (auto-closes on idle/outside click)
│   │   ├── UploadZone.jsx         # Drag-and-drop file input with validation
│   │   ├── ColumnCard.jsx         # Per-column bias summary card
│   │   ├── BiasGauge.jsx          # Radial gauge for bias severity score
│   │   ├── ShapChart.jsx          # SHAP feature importance bar chart (Recharts)
│   │   ├── SliceChart.jsx         # Per-group metric slice chart (Recharts)
│   │   ├── SeverityBadge.jsx      # Color-coded severity label (fair/moderate/high)
│   │   ├── AnimatedCounter.jsx    # Odometer-style number animation
│   │   ├── ConfettiCanvas.jsx     # Confetti burst for "fair" audit result
│   │   ├── ErrorState.jsx         # Full-page error display with retry
│   │   ├── LoadingAnimation.jsx   # Spinner / progress indicator
│   │   ├── GeminiReport.jsx       # Renders plain-English Gemini narrative
│   │   ├── ExplainerModal.jsx     # Modal wrapper for concept explainers
│   │   ├── WalkthroughModal.jsx   # Guided walkthrough overlay
│   │   ├── ProxyAlert.jsx         # Banner warning for detected proxy columns
│   │   └── Tooltip.jsx            # Generic hover tooltip
│   │
│   ├── pages/                     # Route-level page components
│   │   ├── Landing.jsx            # Home / marketing page (owns its own navbar)
│   │   ├── Login.jsx              # Firebase Auth sign-in page
│   │   ├── SignUp.jsx             # Account creation page
│   │   ├── Upload.jsx             # Dataset + model upload wizard
│   │   ├── DatasetAudit.jsx       # Dataset bias audit results page
│   │   ├── ModelAudit.jsx         # Model bias audit results page
│   │   ├── Dashboard.jsx          # User's saved audits dashboard
│   │   ├── Report.jsx             # Full printable/shareable audit report
│   │   ├── SampleAudit.jsx        # Interactive demo using bundled adult dataset
│   │   └── Glossary.jsx           # Bias terminology reference page
│   │
│   └── lib/                       # Shared logic and services
│       ├── AuditContext.jsx        # React context: global audit state + current user
│       ├── api.js                  # Backend API client (fetch wrappers for all endpoints)
│       ├── auth.js                 # Firebase Auth helpers + local guest-mode fallback
│       ├── storage.js             # Per-user audit persistence (Firestore or localStorage)
│       ├── firebase.js            # Firebase app initialisation
│       ├── gemini.js              # Gemini API client for narrative generation
│       ├── fileParser.js          # Client-side CSV/XLSX preview parser
│       ├── terminology.js         # Bias term definitions (used by Glossary + tooltips)
│       ├── designTokens.js        # JS-side design token constants
│       ├── mockData.js            # Static mock audit results for dev/demo
│       └── constants.js           # App-wide constants (routes, limits, etc.)
│
├── setup/                         # Cross-platform startup scripts
│   ├── start.sh                   # Linux/macOS: installs deps and starts dev servers
│   ├── start.bat                  # Windows CMD equivalent
│   └── start.ps1                  # Windows PowerShell equivalent
│
├── tests/                         # Python backend tests
│   ├── test_api.py                # API endpoint integration tests
│   ├── test_m2.py                 # M2 bias-metric unit tests
│   └── shap_tester.py             # SHAP explainer smoke tests
│
├── src/__tests__/                 # Frontend Jest tests
│   ├── SeverityBadge.test.jsx     # SeverityBadge component unit tests
│   ├── api.test.js                # API client unit tests
│   ├── terminology.test.js        # Terminology lookup tests
│   └── setup.js                   # Jest global test setup
│
└── docs/
    ├── README.md                  # Project overview and quick-start
    ├── HOW_TO_RUN.md              # Detailed local dev setup instructions
    ├── file_tree.md               # This file
    └── problem_statement.md       # Original brief and design rationale
```

## Local Testing

> use `adult_fixed.csv` and the bundled `adult_demo_model.pkl` for the sample audit flow.
