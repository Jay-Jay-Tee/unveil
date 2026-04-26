import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAudit } from '../lib/AuditContext';
import { analyzeDataset, analyzeModel, checkBackendHealth } from '../lib/api';
import { signIn } from '../lib/auth';

// ─── helpers ──────────────────────────────────────────────────────────────

function getErrorText(err, fallback = 'Analysis failed.') {
  if (typeof err === 'string') return err;
  if (err?.message) return err.message;
  try { return JSON.stringify(err); } catch { return fallback; }
}

/** Derive the upload mode from what the user has selected. */
function deriveMode(hasDataset, hasModel) {
  if (hasDataset && hasModel) return 'both';
  if (hasDataset) return 'dataset';
  if (hasModel)   return 'model';
  return null;
}

const RUN_BUTTON_LABEL = {
  analyzing: 'Analyzing…',
  both:      'Run Full Audit',
  dataset:   'Analyze Dataset',
  model:     'Analyze Model',
  none:      'Upload a dataset to start',
};

// ─── sub-components ───────────────────────────────────────────────────────

function FileSlot({ label, sublabel, accept, file, onFile, onClear, disabled }) {
  const [drag, setDrag] = useState(false);
  const ref = useRef(null);

  return (
    <motion.div
      animate={{
        borderColor:     drag ? 'var(--color-outline)' : file ? 'var(--color-status-clean)' : 'var(--color-outline-variant)',
        backgroundColor: drag ? 'var(--color-surface-container)' : file ? 'var(--color-surface-container-lowest)' : 'var(--color-surface)',
        scale: drag ? 1.01 : 1,
      }}
      transition={{ duration: 0.15 }}
      onDragOver={e  => { e.preventDefault(); setDrag(true); }}
      onDragLeave={e => { e.preventDefault(); setDrag(false); }}
      onDrop={e      => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files?.[0]); }}
      onClick={() => !file && !disabled && ref.current?.click()}
      className="relative rounded-2xl border-2 border-dashed p-12 flex flex-col items-center text-center cursor-pointer transition-all"
      style={{ minHeight: 200 }}
    >
      <input ref={ref} type="file" accept={accept} className="hidden"
        onChange={e => onFile(e.target.files?.[0])} />

      <AnimatePresence mode="wait">
        {file ? (
          <motion.div key="file" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-3 w-full">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'var(--color-status-clean)' }}>
              <CheckIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold truncate max-w-50">{file.name}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>
                {(file.size / 1024).toFixed(0)} KB
              </p>
            </div>
            <button
              onClick={e => { e.stopPropagation(); ref.current.value = ''; onClear(); }}
              className="text-xs font-semibold px-4 py-1.5 rounded-lg border-2 transition-all hover:opacity-70 mt-1"
              style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}>
              Remove
            </button>
          </motion.div>
        ) : (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--color-surface-container-high)' }}>
              <PlusIcon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold">{label}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>{sublabel}</p>
            </div>
            <span className="text-xs font-semibold px-3 py-1 rounded-md"
              style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)' }}>
              Drop or click
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ProgressStep({ label, status }) {
  const isDone    = status === 'done';
  const isRunning = status === 'running';
  const isMuted   = status === 'waiting' || status === 'skipped';
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition-all"
        style={{
          background: isDone    ? 'var(--color-status-clean)'    :
                      isRunning ? 'var(--color-accent-dark)'      :
                                  'var(--color-surface-container)',
          color:      isDone    ? '#fff'                          :
                      isRunning ? 'var(--color-on-surface)'       :
                                  'var(--color-on-surface-variant)',
        }}>
        {isDone ? '✓' : isRunning ? '…' : '○'}
      </div>
      <span className={`text-sm font-semibold ${isMuted ? 'text-on-surface-variant' : 'text-on-surface'}`}>
        {label}
      </span>
    </div>
  );
}

function PklModal({ onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(26,23,20,0.4)' }}
      onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12 }}
        onClick={e => e.stopPropagation()}
        className="rounded-2xl border p-8 max-w-lg w-full"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-outline)' }}>
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-lg font-bold">Export model as .pkl</h3>
          <button onClick={onClose} className="text-2xl leading-none opacity-50 hover:opacity-100">×</button>
        </div>
        <p className="text-sm mb-4 text-on-surface-variant">
          Use Python's pickle module after training your model:
        </p>
        <div className="rounded-lg p-4 mb-4 text-xs font-mono leading-relaxed"
          style={{ background: 'var(--color-bg-ink)', color: '#fff' }}>
          <div>import pickle</div>
          <div className="mt-2">with open('model.pkl', 'wb') as f:</div>
          <div className="ml-4">pickle.dump(model, f)</div>
        </div>
        <p className="text-xs text-on-surface-variant">
          Works with scikit-learn, XGBoost, LightGBM. Model must accept a DataFrame matching your dataset columns.
        </p>
      </motion.div>
    </motion.div>
  );
}

function ErrorBanner({ message, onDismiss }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="mt-8 px-6 py-4 rounded-xl border-2"
      style={{ borderColor: 'var(--color-status-biased)', background: 'var(--color-error-light)' }}>
      <p className="text-sm font-bold text-status-biased">Failed</p>
      <p className="text-sm mt-1 text-on-surface-variant">{message}</p>
      <button onClick={onDismiss}
        className="mt-3 text-xs font-bold px-4 py-2 rounded-lg text-white"
        style={{ background: 'var(--color-status-biased)' }}>
        Try Again
      </button>
    </motion.div>
  );
}

function SuccessBanner({ mode, hasModel, onNavigate }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="mt-8 rounded-xl border p-6"
      style={{ background: 'var(--color-success-light)', borderColor: 'var(--color-status-clean)' }}>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
          style={{ background: 'var(--color-status-clean)' }}>
          <CheckIcon className="w-5 h-5" />
        </div>
        <p className="text-sm font-black text-status-clean">Analysis complete</p>
      </div>
      <p className="text-xs mb-4" style={{ color: 'var(--color-text-mid)' }}>
        {mode === 'both'
          ? 'Dataset audit → Model audit → Report'
          : mode === 'model'
          ? 'Model audit → Report'
          : 'Dataset audit → Report'}
      </p>
      <div className="flex flex-wrap gap-3">
        <button onClick={() => onNavigate(mode === 'model' ? '/audit/model' : '/audit/dataset')}
          className="px-6 py-3 text-sm font-bold rounded-lg text-white transition-all"
          style={{ background: 'var(--color-bg-ink)' }}>
          {mode === 'model' ? 'View Model Audit →' : 'View Dataset Audit →'}
        </button>
      </div>
    </motion.div>
  );
}

// ─── icon atoms ───────────────────────────────────────────────────────────

function CheckIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function PlusIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-4m0 0V8m0 4h4m-4 0H8" />
    </svg>
  );
}

// ─── orchestration ────────────────────────────────────────────────────────

/**
 * Run the dataset leg of the analysis.
 * Returns { schemaMap, proxyFlags } for use by the model leg.
 */
async function runDatasetLeg(datasetFile, audit, setStep) {
  setStep('dataset', 'running');
  const result = await analyzeDataset(datasetFile);
  audit.setSchemaMap(result.schemaMap);
  audit.setProxyFlags(result.proxyFlags);
  audit.setBiasReport(result.biasReport);
  audit.setDatasetMeta({
    datasetName: result.datasetName,
    rowCount:    result.rowCount,
    columnCount: result.columnCount,
    warnings:    result.warnings,
  });
  audit.setIsMock(result.isMock);
  audit.setDatasetFile(datasetFile);
  setStep('dataset', 'done');
  // Return full result so caller can pass fresh data to saveCurrentAudit
  return { schemaMap: result.schemaMap, proxyFlags: result.proxyFlags, result };
}

/**
 * Run the model leg of the analysis.
 * Requires schemaMap + proxyFlags from the dataset leg.
 */
async function runModelLeg(datasetFile, modelFile, schemaMap, proxyFlags, audit, setStep) {
  setStep('model', 'running');
  const result = await analyzeModel(
    datasetFile,
    schemaMap,
    proxyFlags ?? { proxy_columns: [] },
    modelFile,
    100,
  );
  const modelBiasReport = {
    attribute_results: result.attributeResults,
    shap_summary:      result.shapSummary,
  };
  audit.setModelBiasReport(modelBiasReport);
  audit.setModelMeta({ modelName: modelFile.name, isDemo: false, modelOnly: false });
  audit.setModelFile(modelFile);
  audit.setIsMock(audit.isMock || result.isMock);
  setStep('model', 'done');
  return { modelBiasReport };
}

// ─── main component ───────────────────────────────────────────────────────

export default function Upload() {
  const AUTH_TRANSITION_MS_SIGNUP_SIGNIN = 220; // a little less than sign out
  const AUTH_TRANSITION_MS_GUEST = 260; // same as sign out
  const navigate = useNavigate();
  const audit    = useAudit();

  const [datasetFile, setDatasetFile] = useState(null);
  const [modelFile,   setModelFile]   = useState(null);
  const [showPkl,     setShowPkl]     = useState(false);
  const [status,      setStatus]      = useState('idle');   // idle | analyzing | done | error
  const [errorMsg,    setErrorMsg]    = useState('');
  const [guestLoading, setGuestLoading] = useState(false);
  const [guestExiting, setGuestExiting] = useState(false);
  const [authNavTarget, setAuthNavTarget] = useState(null);
  const [steps,       setSteps]       = useState({ backend: 'waiting', dataset: 'waiting', model: 'waiting' });

  const setStep = (key, val) => setSteps(prev => ({ ...prev, [key]: val }));

  // ── Auth gate ─────────────────────────────────────────────────────────
  if (!audit.authReady) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen pt-32 flex items-center justify-center"
      >
        <span className="unveil-spinner" />
      </motion.div>
    );
  }
  if (!audit.user) {
    async function handleAuthNavigate(path, target) {
      if (guestLoading || authNavTarget) return;
      setAuthNavTarget(target);
      setGuestExiting(true);
      await new Promise((resolve) => setTimeout(resolve, AUTH_TRANSITION_MS_SIGNUP_SIGNIN));
      navigate(path);
    }

    async function handleContinueAsGuest() {
      setGuestLoading(true);
      try {
        setAuthNavTarget('guest');
        setGuestExiting(true);
        // Give the interstitial time to animate out before switching screens.
        await new Promise((resolve) => setTimeout(resolve, AUTH_TRANSITION_MS_GUEST));
        const guest = await signIn({ email: '', password: '' });
        audit.setUser(guest);
      } catch (e) {
        console.error('[upload] continue as guest failed:', e);
        setGuestExiting(false);
        setAuthNavTarget(null);
      } finally {
        setGuestLoading(false);
      }
    }

    return (
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 1 }}
        animate={guestExiting ? { opacity: 0, y: -8, scale: 0.99 } : { opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: guestExiting ? 0.22 : 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="min-h-screen pt-20 pb-20 px-3 sm:px-5 flex flex-col items-center justify-center text-center"
      >
        <div className="max-w-md">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl flex items-center justify-center"
            style={{ background: 'var(--color-bg-ink)' }}>
            <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.3 }}
          className="text-display-md mb-3"
          style={{ color: "var(--color-on-surface)" }}
        >
          Sign up to save audits
        </motion.p>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="text-sm mb-6 leading-relaxed"
          style={{ color: "var(--color-text-mid)" }}
        >
          You're currently in guest mode. Create a free account to save your audit history,
          revisit past results, and generate compliance reports anytime.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.3 }}
          className="flex gap-3 flex-wrap justify-center"
        >
          <button
            onClick={() => handleAuthNavigate('/signup', 'signup')}
            className="btn btn-primary"
            disabled={guestLoading || !!authNavTarget}
          >
            {authNavTarget === 'signup' ? 'Opening sign up…' : 'Create free account'}
          </button>
          <button
            onClick={() => handleAuthNavigate('/login', 'login')}
            className="btn btn-secondary"
            disabled={guestLoading || !!authNavTarget}
          >
            {authNavTarget === 'login' ? 'Opening sign in…' : 'Sign in'}
          </button>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
          className="mt-4"
        >
          <button
            onClick={handleContinueAsGuest}
            disabled={guestLoading || !!authNavTarget}
            className="btn btn-ghost text-sm"
          >
            {guestLoading ? 'Continuing as guest…' : 'No, continue as guest'}
          </button>
        </motion.div>
        <p className="text-xs mt-5" style={{ color: 'var(--color-text-mid)' }}>
          You can still run audits as a guest - results just won't be saved between sessions.
        </p>
        </div>
      </motion.div>
    );
  }

  const hasDataset = !!datasetFile;
  const hasModel   = !!modelFile;
  const canRun     = hasDataset || hasModel;
  const mode       = deriveMode(hasDataset, hasModel);

  async function runAnalysis() {
    if (!canRun) return;

    // Reset relevant audit state before starting
    hasModel ? audit.resetAll() : (audit.setModelBiasReport(null), audit.setModelMeta(null), audit.setModelFile(null));

    setStatus('analyzing');
    setSteps({ backend: 'running', dataset: 'waiting', model: 'waiting' });

    try {
      audit.setBackendOnline(await checkBackendHealth());
      setStep('backend', 'done');

      // Model-only is unsupported - we need rows to probe against
      if (hasModel && !hasDataset) {
        audit.setModelFile(modelFile);
        audit.setModelMeta({ modelName: modelFile.name, isDemo: false, modelOnly: true });
        setStep('dataset', 'skipped');
        setStep('model', 'skipped');
        throw new Error('Upload a dataset too - we need data rows to probe the model against.');
      }

      let schemaMap  = null;
      let proxyFlags = null;
      let datasetResult = null;
      let modelBiasReport = null;

      if (hasDataset) {
        ({ schemaMap, proxyFlags, result: datasetResult } = await runDatasetLeg(datasetFile, audit, setStep));
      } else {
        setStep('dataset', 'skipped');
      }

      if (hasDataset && hasModel) {
        ({ modelBiasReport } = await runModelLeg(datasetFile, modelFile, schemaMap, proxyFlags, audit, setStep));
      } else {
        setStep('model', 'skipped');
      }

      audit.setAuditMode(mode);

      // Auto-save - pass fresh data DIRECTLY so we don't read stale React state
      if (!audit.user?.isGuest && datasetResult) {
        try {
          await audit.saveCurrentAudit('', {
            datasetName:    datasetResult.datasetName,
            rowCount:       datasetResult.rowCount,
            columnCount:    datasetResult.columnCount,
            schemaMap:      datasetResult.schemaMap,
            biasReport:     datasetResult.biasReport,
            modelBiasReport: modelBiasReport ?? null,
          });
        } catch (saveErr) {
          console.warn('[upload] auto-save failed:', saveErr?.message);
        }
      }
      setStatus('done');

    } catch (err) {
      setStatus('error');
      if (err?.code === 'AUTH_REQUIRED' || err?.status === 401) {
        setErrorMsg('Sign in with Firebase to run server-side analysis. Guest mode is limited to local browsing and saved local data.');
      } else {
        setErrorMsg(getErrorText(err));
      }
    }
  }

  const runButtonLabel =
    status === 'analyzing' ? RUN_BUTTON_LABEL.analyzing :
    !canRun                ? RUN_BUTTON_LABEL.none       :
                             RUN_BUTTON_LABEL[mode];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="min-h-screen pb-20 px-3 sm:px-5"
      style={{ background: 'var(--color-surface)' }}>
      <div className="mx-auto max-w-7xl pt-24">

        {/* Header */}
        <div className="mb-12">
          <h1 className="text-display-lg mb-3" style={{ color: 'var(--color-on-surface)' }}>
            Upload your data
          </h1>
          <p className="text-lg text-on-surface-variant">
            Dataset, model, or both. We'll audit whichever you provide.
          </p>
        </div>

        {/* Upload slots */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <h3 className="font-bold">Dataset</h3>
              <span className="text-xs px-2 py-1 rounded"
                style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}>
                Required for model analysis
              </span>
            </div>
            <p className="text-xs text-on-surface-variant mb-3">CSV, JSON, or XLSX</p>
            <FileSlot
              label="Drop dataset" sublabel="CSV, JSON, or XLSX"
              accept=".csv,.json,.xlsx"
              file={datasetFile} onFile={setDatasetFile} onClear={() => setDatasetFile(null)}
              disabled={status === 'analyzing'}
            />
          </div>

          <div>
            <div className="flex items-center gap-3 mb-3">
              <h3 className="font-bold">Model</h3>
              <button 
                onClick={() => setShowPkl(true)} 
                className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all hover:-translate-y-0.5"
                style={{ 
                  background: 'var(--color-surface-container-high)', 
                  color: 'var(--color-on-surface)',
                  border: '1px solid var(--color-outline-variant)',
                  cursor: 'pointer',
                }}
                title="Click to learn how to export a model">
                ℹ️ How to export?
              </button>
            </div>
            <p className="text-xs text-on-surface-variant mb-3">Scikit-learn .pkl file</p>
            <FileSlot
              label="Drop model" sublabel=".pkl file"
              accept=".pkl"
              file={modelFile} onFile={setModelFile} onClear={() => setModelFile(null)}
              disabled={status === 'analyzing'}
            />
          </div>
        </div>

        {/* Run button */}
        <button
          onClick={runAnalysis}
          disabled={!canRun || status === 'analyzing'}
          className="w-full py-4 text-base font-bold rounded-lg transition-all"
          style={{
            background: canRun && status !== 'analyzing' ? 'var(--color-bg-ink)' : 'var(--color-surface-container)',
            color:      canRun && status !== 'analyzing' ? '#fff' : 'var(--color-on-surface-variant)',
            cursor:     canRun && status !== 'analyzing' ? 'pointer' : 'not-allowed',
          }}>
          {runButtonLabel}
        </button>

        {/* Progress */}
        <AnimatePresence>
          {status === 'analyzing' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mt-8 rounded-xl border p-6"
              style={{ background: 'var(--color-surface-container-highest)', borderColor: 'var(--color-outline)' }}>
              <p className="text-xs font-bold uppercase tracking-wider mb-4"
                style={{ color: 'var(--color-on-surface-variant)' }}>Progress</p>
              <ProgressStep label="Connecting to backend" status={steps.backend} />
              <ProgressStep label="Classifying columns & computing metrics" status={steps.dataset} />
              {hasModel && <ProgressStep label="Analyzing model with synthetic probes" status={steps.model} />}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error / Success */}
        <AnimatePresence>
          {status === 'error' && (
            <ErrorBanner message={errorMsg} onDismiss={() => setStatus('idle')} />
          )}
          {status === 'done' && (
            <SuccessBanner mode={mode} hasModel={hasModel} onNavigate={navigate} />
          )}
        </AnimatePresence>
      </div>

      {/* PKL Modal */}
      <AnimatePresence>
        {showPkl && <PklModal onClose={() => setShowPkl(false)} />}
      </AnimatePresence>
    </motion.div>
  );
}

