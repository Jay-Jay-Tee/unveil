import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAudit } from '../lib/AuditContext';
import { analyzeDataset, analyzeModel, checkBackendHealth } from '../lib/api';

function getErrorText(err, fallback = 'Analysis failed.') {
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const message = typeof err.message === 'string' ? err.message : null;
    if (message) return message;
    try {
      return JSON.stringify(err);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

// ─── tiny file drop zone used twice on this page ───────────────────────────
function FileSlot({ label, sublabel, accept, icon, file, onFile, onClear, disabled }) {
  const [drag, setDrag] = useState(false);
  const ref = useRef(null);

  function handle(f) {
    if (!f) return;
    onFile(f);
  }

  return (
    <motion.div
      animate={{
        borderColor: drag ? 'var(--color-amber)' : file ? 'var(--color-green)' : 'rgba(26,23,20,0.18)',
        backgroundColor: drag ? 'rgba(232,160,32,0.05)' : file ? 'rgba(26,158,106,0.04)' : 'var(--color-bg-card)',
        scale: drag ? 1.01 : 1,
      }}
      transition={{ duration: 0.15 }}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={e => { e.preventDefault(); setDrag(false); }}
      onDrop={e => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files?.[0]); }}
      onClick={() => !file && !disabled && ref.current?.click()}
      className="relative rounded-2xl border-2 border-dashed p-8 flex flex-col items-center text-center cursor-pointer transition-all card-shadow"
      style={{ minHeight: 200 }}
    >
      <input ref={ref} type="file" accept={accept} className="hidden"
        onChange={e => handle(e.target.files?.[0])} />

      <AnimatePresence mode="wait">
        {file ? (
          <motion.div key="file" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-3 w-full">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'var(--color-green-light)' }}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="var(--color-green)" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold truncate max-w-[200px]" style={{ color: 'var(--color-ink)' }}>{file.name}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-ink-muted)' }}>
                {(file.size / 1024).toFixed(0)} KB
              </p>
            </div>
            <button onClick={e => { e.stopPropagation(); onClear(); }}
              className="text-xs font-semibold px-4 py-1.5 rounded-lg border-2 transition-all hover:opacity-70 mt-1"
              style={{ borderColor: 'var(--color-border-strong)', color: 'var(--color-ink-muted)' }}>
              Remove
            </button>
          </motion.div>
        ) : (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-3">
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
              className="w-12 h-12 rounded-xl flex items-center justify-center text-xl"
              style={{ background: 'var(--color-amber-light)' }}>
              {icon}
            </motion.div>
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--color-ink)' }}>{label}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-ink-muted)' }}>{sublabel}</p>
            </div>
            <span className="text-xs font-semibold px-3 py-1 rounded-md" style={{ background: 'var(--color-amber-light)', color: 'var(--color-amber-dark)' }}>
              Drop or click to browse
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── how to export pkl instructions ────────────────────────────────────────
function PklInstructions({ open, onClose }) {
  if (!open) return null;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-6"
        style={{ background: 'rgba(26,23,20,0.6)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12 }}
          onClick={e => e.stopPropagation()}
          className="rounded-2xl border-2 p-8 max-w-lg w-full card-shadow-lg"
          style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}>
          <div className="flex items-start justify-between mb-5">
            <h3 className="text-lg font-black" style={{ color: 'var(--color-ink)' }}>How to export your model as .pkl</h3>
            <button onClick={onClose} className="text-xl leading-none hover:opacity-50" style={{ color: 'var(--color-ink-muted)' }}>×</button>
          </div>
          <p className="text-sm mb-4" style={{ color: 'var(--color-ink-mid)' }}>
            Any scikit-learn (or compatible) model can be exported with <code style={{ background: 'var(--color-bg-warm)', padding: '1px 5px', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: '0.85em' }}>pickle</code>:
          </p>
          <div className="rounded-xl p-4 mb-5 text-xs leading-relaxed" style={{ background: 'var(--color-ink)', color: 'rgba(255,255,255,0.85)', fontFamily: 'var(--font-mono)' }}>
            <p style={{ color: 'var(--color-ink-faint)' }}># After training your model:</p>
            <p className="mt-1"><span style={{ color: 'var(--color-amber)' }}>import</span> pickle</p>
            <p className="mt-1"><span style={{ color: 'var(--color-amber)' }}>with</span> <span style={{ color: '#7dd3fc' }}>open</span>(<span style={{ color: '#86efac' }}>'my_model.pkl'</span>, <span style={{ color: '#86efac' }}>'wb'</span>) <span style={{ color: 'var(--color-amber)' }}>as</span> f:</p>
            <p className="ml-4">pickle.dump(model, f)</p>
            <p className="mt-3" style={{ color: 'var(--color-ink-faint)' }}># Works with sklearn, XGBoost, LightGBM, etc.</p>
            <p className="mt-1" style={{ color: 'var(--color-ink-faint)' }}># The model must accept a DataFrame of the same</p>
            <p style={{ color: 'var(--color-ink-faint)' }}># columns as your dataset (minus the outcome col).</p>
          </div>
          <div className="rounded-xl p-4 text-sm" style={{ background: 'var(--color-amber-light)', borderLeft: '3px solid var(--color-amber)' }}>
            <p className="font-bold mb-1" style={{ color: 'var(--color-amber-dark)' }}>No model? No problem.</p>
            <p style={{ color: 'var(--color-ink-mid)' }}>
              Upload a .pkl only if you want to audit your own trained model.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── progress step display ──────────────────────────────────────────────────
function ProgressStep({ label, status }) {
  // status: 'waiting' | 'running' | 'done' | 'skipped'
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold transition-all"
        style={{
          background: status === 'done'    ? 'var(--color-green)'    :
                      status === 'running' ? 'var(--color-amber)'    :
                      status === 'skipped' ? 'var(--color-bg-warm)'  : 'var(--color-bg-warm)',
          color:      status === 'done'    ? '#fff'                  :
                      status === 'running' ? 'var(--color-ink)'      :
                      status === 'skipped' ? 'var(--color-ink-faint)': 'var(--color-ink-faint)',
        }}>
        {status === 'done'    ? '✓'  :
         status === 'running' ? <SpinDot /> :
         status === 'skipped' ? '—'  : '·'}
      </div>
      <span className="text-sm font-semibold"
        style={{ color: status === 'waiting' || status === 'skipped' ? 'var(--color-ink-muted)' : 'var(--color-ink)' }}>
        {label}
      </span>
    </div>
  );
}

function SpinDot() {
  return (
    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3"/>
      <path fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z">
        <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.7s" repeatCount="indefinite"/>
      </path>
    </svg>
  );
}

// ─── main component ─────────────────────────────────────────────────────────
export default function Upload() {
  const navigate = useNavigate();
  const audit = useAudit();

  const [datasetFile, setDatasetFileLocal] = useState(null);
  const [modelFile,   setModelFileLocal]   = useState(null);
  const [showPkl,     setShowPkl]          = useState(false);

  // analysis state
  const [status,    setStatus]    = useState('idle'); // idle | analyzing | done | error
  const [errorMsg,  setErrorMsg]  = useState('');
  const [steps,     setSteps]     = useState({
        backend:  'waiting',
        dataset:  'waiting',
        model:    'waiting',
  });

  function setStep(key, val) {
    setSteps(prev => ({ ...prev, [key]: val }));
  }

  // derived
  const hasDataset = !!datasetFile;
  const hasModel   = !!modelFile;
  const canRun     = hasDataset || hasModel;
  const mode       = hasDataset && hasModel ? 'both' : hasDataset ? 'dataset' : hasModel ? 'model' : null;

  async function runAnalysis() {
    if (!canRun) return;
    if (hasModel) {
      audit.resetAll();
    } else {
      audit.setModelBiasReport(null);
      audit.setModelMeta(null);
      audit.setModelFile(null);
    }
    setStatus('analyzing');
    setSteps({ backend: 'running', dataset: 'waiting', model: 'waiting' });

    try {
      // 1. backend health
      const online = await checkBackendHealth();
      audit.setBackendOnline(online);
      setStep('backend', 'done');

      let schemaMap = null;
      let proxyFlags = null;

      // 2. dataset analysis (Part A) — only if dataset provided
      if (hasDataset) {
        setStep('dataset', 'running');
        const dsResult = await analyzeDataset(datasetFile);
        audit.setSchemaMap(dsResult.schemaMap);
        audit.setProxyFlags(dsResult.proxyFlags);
        audit.setBiasReport(dsResult.biasReport);
        audit.setDatasetMeta({ datasetName: dsResult.datasetName, rowCount: dsResult.rowCount, warnings: dsResult.warnings });
        audit.setIsMock(dsResult.isMock);
        audit.setDatasetFile(datasetFile);
        schemaMap  = dsResult.schemaMap;
        proxyFlags = dsResult.proxyFlags;
        setStep('dataset', 'done');
      } else {
        setStep('dataset', 'skipped');
      }

      // 3. model analysis (Part B) only when a model file is uploaded
      if (hasModel && !hasDataset) {
        // model only with no dataset: can't do probing without data rows
        audit.setModelFile(modelFile);
        audit.setModelMeta({ modelName: modelFile.name, isDemo: false, modelOnly: true });
        setStep('model', 'skipped');
        // Surface a clear error for this case
        setStatus('error');
        setErrorMsg('Model-only upload requires a dataset too — we need data rows to probe the model against. Please also upload your dataset CSV.');
        return;
      }

      if (hasDataset && hasModel) {
        setStep('model', 'running');
        const modelResult = await analyzeModel(
          datasetFile,
          schemaMap,
          proxyFlags || { proxy_columns: [] },
          modelFile,
          100,
        );
        audit.setModelBiasReport({
          attribute_results: modelResult.attributeResults,
          shap_summary:      modelResult.shapSummary,
        });
        audit.setModelMeta({
          modelName: modelFile.name,
          isDemo:    false,
          modelOnly: false,
        });
        audit.setModelFile(modelFile);
        audit.setIsMock(audit.isMock || modelResult.isMock);
        setStep('model', 'done');
      } else if (hasDataset) {
        setStep('model', 'skipped');
      }

      audit.setAuditMode(mode);
      setStatus('done');

    } catch (err) {
      setStatus('error');
      setErrorMsg(getErrorText(err));
    }
  }

  function clearDataset() { setDatasetFileLocal(null); }
  function clearModel()   { setModelFileLocal(null); }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen pt-20 pb-20 px-6">
      <PklInstructions open={showPkl} onClose={() => setShowPkl(false)} />

      <div className="mx-auto max-w-4xl">

        {/* Header */}
        <div className="py-12 border-b-2 mb-10" style={{ borderColor: 'var(--color-border)' }}>
          <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--color-ink-muted)', fontFamily: 'var(--font-mono)' }}>
            Step 01 — Upload
          </p>
          <h1 className="text-5xl md:text-6xl font-black tracking-tight leading-tight mb-4" style={{ fontFamily: 'var(--font-sans)', color: 'var(--color-ink)' }}>
            What do you<br />
            <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 400, color: 'var(--color-amber-dark)' }}>want to audit?</span>
          </h1>
          <p className="text-base max-w-xl" style={{ color: 'var(--color-ink-mid)' }}>
            Upload a dataset, a trained model, or both. We'll run whichever analyses apply.
          </p>
        </div>

        {/* Upload slots */}
        <div className="grid md:grid-cols-2 gap-5 mb-4">
          {/* Dataset slot */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-ink-muted)', fontFamily: 'var(--font-mono)' }}>Dataset</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-ink-faint)' }}>CSV · JSON · XLSX</p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-md" style={{ background: 'var(--color-bg-warm)', color: 'var(--color-ink-muted)' }}>
                Optional
              </span>
            </div>
            <FileSlot
              label="Drop your dataset"
              sublabel="CSV, JSON, or XLSX file"
              accept=".csv,.json,.xlsx,.xls,.data,.txt"
              icon="📊"
              file={datasetFile}
              onFile={setDatasetFileLocal}
              onClear={clearDataset}
              disabled={status === 'analyzing'}
            />
            <p className="mt-2 text-xs" style={{ color: 'var(--color-ink-muted)' }}>
              Runs disparate impact, parity gaps, and slice-level bias metrics.
            </p>
          </div>

          {/* Model slot */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-ink-muted)', fontFamily: 'var(--font-mono)' }}>Trained Model</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-ink-faint)' }}>.pkl (scikit-learn compatible)</p>
              </div>
              <button onClick={() => setShowPkl(true)}
                className="text-xs font-semibold px-2.5 py-1 rounded-md transition-all hover:opacity-80"
                style={{ background: 'var(--color-amber-light)', color: 'var(--color-amber-dark)' }}>
                How to export? →
              </button>
            </div>
            <FileSlot
              label="Drop your model weights"
              sublabel="sklearn .pkl file"
              accept=".pkl"
              icon="🧠"
              file={modelFile}
              onFile={setModelFileLocal}
              onClear={clearModel}
              disabled={status === 'analyzing'}
            />
            <p className="mt-2 text-xs" style={{ color: 'var(--color-ink-muted)' }}>
              No model? We'll train a logistic regression on your dataset and audit that instead.
            </p>
          </div>
        </div>

        {/* Mode indicator */}
        <AnimatePresence>
          {mode && status === 'idle' && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mb-6 flex items-center gap-3 px-4 py-3 rounded-xl border-2"
              style={{ background: 'var(--color-bg-warm)', borderColor: 'var(--color-border)' }}>
              <span className="text-base">
                {mode === 'both' ? '🎯' : mode === 'dataset' ? '📊' : '🧠'}
              </span>
              <div>
                <span className="text-sm font-bold" style={{ color: 'var(--color-ink)' }}>
                  {mode === 'both'    ? 'Full audit — dataset + model'   :
                   mode === 'dataset' ? 'Dataset audit only' :
                                        'Model audit (needs dataset too)'}
                </span>
                <span className="ml-2 text-xs" style={{ color: 'var(--color-ink-muted)' }}>
                  {mode === 'both'    ? 'Disparate impact, SHAP, probing on your uploaded model'   :
                   mode === 'dataset' ? 'Dataset bias metrics only' :
                                        'Please add a dataset file to probe the model against'}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Run button */}
        <button
          onClick={runAnalysis}
          disabled={!canRun || status === 'analyzing'}
          className="w-full py-5 text-base font-black rounded-xl transition-all"
          style={{
            background: canRun && status !== 'analyzing' ? 'var(--color-ink)' : 'var(--color-bg-warm)',
            color:      canRun && status !== 'analyzing' ? '#fff'             : 'var(--color-ink-faint)',
            cursor:     canRun && status !== 'analyzing' ? 'pointer'          : 'not-allowed',
          }}>
          {status === 'analyzing' ? 'Running Analysis…' :
           !canRun                ? 'Upload at least one file to begin' :
           mode === 'both'        ? 'Run Full Audit →' :
           mode === 'dataset'     ? 'Run Dataset Audit →' :
                                    'Run Audit →'}
        </button>

        {/* Progress */}
        <AnimatePresence>
          {status === 'analyzing' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mt-6 rounded-xl border-2 p-6" style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}>
              <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--color-ink-muted)', fontFamily: 'var(--font-mono)' }}>
                Analysis Progress
              </p>
              <ProgressStep label="Connecting to backend" status={steps.backend} />
              <ProgressStep label={hasDataset ? 'Classifying columns + computing bias metrics (Gemini + stats)' : 'Dataset analysis'} status={steps.dataset} />
              {hasModel && (
                <ProgressStep label={`Probing your model (${modelFile?.name}) with synthetic pairs + SHAP`} status={steps.model} />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        <AnimatePresence>
          {status === 'error' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="mt-6 px-5 py-4 rounded-xl border-2"
              style={{ borderColor: 'var(--color-biased)', background: 'var(--color-red-light)' }}>
              <p className="text-sm font-bold" style={{ color: 'var(--color-biased)' }}>Analysis failed</p>
              <p className="text-sm mt-1" style={{ color: 'var(--color-ink-mid)' }}>{errorMsg}</p>
              <button onClick={() => setStatus('idle')}
                className="mt-3 text-xs font-bold px-4 py-2 rounded-lg"
                style={{ background: 'var(--color-biased)', color: '#fff' }}>
                Try Again
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Done — navigate */}
        <AnimatePresence>
          {status === 'done' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="mt-6 rounded-xl border-2 p-6" style={{ background: 'var(--color-green-light)', borderColor: 'var(--color-green)' }}>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--color-green)' }}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <p className="text-sm font-black" style={{ color: 'var(--color-green)' }}>Analysis complete — choose where to go</p>
              </div>
              <div className="flex flex-wrap gap-3">
                {(mode === 'dataset' || mode === 'both') && (
                  <button onClick={() => navigate('/audit/dataset')}
                    className="px-6 py-3 text-sm font-bold rounded-lg transition-all hover:opacity-90"
                    style={{ background: 'var(--color-ink)', color: '#fff' }}>
                    View Dataset Audit →
                  </button>
                )}
                {hasModel && mode === 'both' && (
                  <button onClick={() => navigate('/audit/model')}
                    className="px-6 py-3 text-sm font-bold rounded-lg transition-all hover:opacity-90"
                    style={{ background: mode === 'both' ? 'var(--color-ink)' : 'transparent', color: mode === 'both' ? '#fff' : 'var(--color-ink)',
                             border: mode === 'both' ? 'none' : '2px solid var(--color-border-strong)' }}>
                    View Model Audit →
                  </button>
                )}
                <button onClick={() => navigate('/report')}
                  className="px-6 py-3 text-sm font-bold rounded-lg border-2 transition-all hover:opacity-70"
                  style={{ border: '2px solid var(--color-border-strong)', color: 'var(--color-ink)' }}>
                  Jump to Report →
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Demo hint */}
        {status === 'idle' && !canRun && (
          <p className="mt-6 text-center text-xs" style={{ color: 'var(--color-ink-faint)' }}>
            Want to try it? Use the included <code style={{ fontFamily: 'var(--font-mono)' }}>adult.csv</code> file from the repo root.
          </p>
        )}
      </div>
    </motion.div>
  );
}
