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

function FileSlot({ label, sublabel, accept, file, onFile, onClear, disabled }) {
  const [drag, setDrag] = useState(false);
  const ref = useRef(null);

  function handle(f) {
    if (!f) return;
    onFile(f);
  }

  return (
    <motion.div
      animate={{
        borderColor: drag ? 'var(--color-outline)' : file ? 'var(--color-status-clean)' : 'var(--color-outline-variant)',
        backgroundColor: drag ? 'var(--color-surface-container)' : file ? 'var(--color-surface-container-lowest)' : 'var(--color-surface)',
        scale: drag ? 1.01 : 1,
      }}
      transition={{ duration: 0.15 }}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={e => { e.preventDefault(); setDrag(false); }}
      onDrop={e => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files?.[0]); }}
      onClick={() => !file && !disabled && ref.current?.click()}
      className="relative rounded-2xl border-2 border-dashed p-12 flex flex-col items-center text-center cursor-pointer transition-all"
      style={{ minHeight: 200 }}
    >
      <input ref={ref} type="file" accept={accept} className="hidden"
        onChange={e => handle(e.target.files?.[0])} />

      <AnimatePresence mode="wait">
        {file ? (
          <motion.div key="file" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-3 w-full">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'var(--color-status-clean)' }}>
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold truncate max-w-50">{file.name}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>
                {(file.size / 1024).toFixed(0)} KB
              </p>
            </div>
            <button onClick={e => { e.stopPropagation(); onClear(); }}
              className="text-xs font-semibold px-4 py-1.5 rounded-lg border-2 transition-all hover:opacity-70 mt-1"
              style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}>
              Remove
            </button>
          </motion.div>
        ) : (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'var(--color-surface-container-high)' }}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-4m0 0V8m0 4h4m-4 0H8" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold">{label}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>{sublabel}</p>
            </div>
            <span className="text-xs font-semibold px-3 py-1 rounded-md" style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)' }}>
              Drop or click
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ProgressStep({ label, status }) {
  const isDone = status === 'done';
  const isRunning = status === 'running';
  const isMuted = status === 'waiting' || status === 'skipped';

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition-all"
        style={{
          background: isDone ? 'var(--color-status-clean)' : isRunning ? 'var(--color-accent-dark)' : 'var(--color-surface-container)',
          color: isDone ? '#fff' : isRunning ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant)',
        }}>
        {isDone ? '✓' : isRunning ? '…' : '○'}
      </div>
      <span className={`text-sm font-semibold ${isMuted ? 'text-on-surface-variant' : 'text-on-surface'}`}>
        {label}
      </span>
    </div>
  );
}

export default function Upload() {
  const navigate = useNavigate();
  const audit = useAudit();

  const [datasetFile, setDatasetFileLocal] = useState(null);
  const [modelFile, setModelFileLocal] = useState(null);
  const [showPkl, setShowPkl] = useState(false);

  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [steps, setSteps] = useState({
    backend: 'waiting',
    dataset: 'waiting',
    model: 'waiting',
  });

  function setStep(key, val) {
    setSteps(prev => ({ ...prev, [key]: val }));
  }

  const hasDataset = !!datasetFile;
  const hasModel = !!modelFile;
  const canRun = hasDataset || hasModel;
  const mode = hasDataset && hasModel ? 'both' : hasDataset ? 'dataset' : hasModel ? 'model' : null;

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
      const online = await checkBackendHealth();
      audit.setBackendOnline(online);
      setStep('backend', 'done');

      let schemaMap = null;
      let proxyFlags = null;

      if (hasDataset) {
        setStep('dataset', 'running');
        const dsResult = await analyzeDataset(datasetFile);
        audit.setSchemaMap(dsResult.schemaMap);
        audit.setProxyFlags(dsResult.proxyFlags);
        audit.setBiasReport(dsResult.biasReport);
        audit.setDatasetMeta({ datasetName: dsResult.datasetName, rowCount: dsResult.rowCount, warnings: dsResult.warnings });
        audit.setIsMock(dsResult.isMock);
        audit.setDatasetFile(datasetFile);
        schemaMap = dsResult.schemaMap;
        proxyFlags = dsResult.proxyFlags;
        setStep('dataset', 'done');
      } else {
        setStep('dataset', 'skipped');
      }

      if (hasModel && !hasDataset) {
        audit.setModelFile(modelFile);
        audit.setModelMeta({ modelName: modelFile.name, isDemo: false, modelOnly: true });
        setStep('model', 'skipped');
        setStatus('error');
        setErrorMsg('Upload a dataset too—we need data rows to probe the model against.');
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
          shap_summary: modelResult.shapSummary,
        });
        audit.setModelMeta({
          modelName: modelFile.name,
          isDemo: false,
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
  function clearModel() { setModelFileLocal(null); }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen pb-20 px-6" style={{ background: 'var(--color-surface)' }}>
      <div className="mx-auto max-w-3xl pt-24">

        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-black mb-3" style={{ fontFamily: 'var(--font-sans)', color: 'var(--color-on-surface)' }}>
            Upload your data
          </h1>
          <p className="text-lg text-on-surface-variant">
            Dataset, model, or both. We'll audit whichever you provide.
          </p>
        </div>

        {/* Upload slots */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Dataset */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <h3 className="font-bold">Dataset</h3>
              <span className="text-xs px-2 py-1 rounded" style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}>
                Required for model analysis
              </span>
            </div>
            <p className="text-xs text-on-surface-variant mb-3">CSV, JSON, or XLSX</p>
            <FileSlot
              label="Drop dataset"
              sublabel="CSV, JSON, or XLSX"
              accept=".csv,.json,.xlsx,.xls,.data,.txt"
              file={datasetFile}
              onFile={setDatasetFileLocal}
              onClear={clearDataset}
              disabled={status === 'analyzing'}
            />
          </div>

          {/* Model */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <h3 className="font-bold">Model</h3>
              <button onClick={() => setShowPkl(true)} className="text-xs px-2 py-1 rounded" style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}>
                How to export?
              </button>
            </div>
            <p className="text-xs text-on-surface-variant mb-3">Scikit-learn .pkl file</p>
            <FileSlot
              label="Drop model"
              sublabel=".pkl file"
              accept=".pkl"
              file={modelFile}
              onFile={setModelFileLocal}
              onClear={clearModel}
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
            color: canRun && status !== 'analyzing' ? '#fff' : 'var(--color-on-surface-variant)',
            cursor: canRun && status !== 'analyzing' ? 'pointer' : 'not-allowed',
          }}>
          {status === 'analyzing' ? 'Analyzing…' :
            !canRun ? 'Upload at least one file' :
              mode === 'both' ? 'Run Full Audit' :
                mode === 'dataset' ? 'Analyze Dataset' :
                  'Analyze Model'}
        </button>

        {/* Progress */}
        <AnimatePresence>
          {status === 'analyzing' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mt-8 rounded-xl border p-6" style={{ background: 'var(--color-surface-container-highest)', borderColor: 'var(--color-outline)' }}>
              <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--color-on-surface-variant)' }}>
                Progress
              </p>
              <ProgressStep label="Connecting to backend" status={steps.backend} />
              <ProgressStep label={hasDataset ? 'Classifying columns & computing metrics' : 'Analyzing dataset'} status={steps.dataset} />
              {hasModel && (
                <ProgressStep label="Analyzing model with synthetic probes" status={steps.model} />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        <AnimatePresence>
          {status === 'error' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="mt-8 px-6 py-4 rounded-xl border-2"
              style={{ borderColor: 'var(--color-status-biased)', background: 'var(--color-error-light)' }}>
              <p className="text-sm font-bold text-status-biased">Failed</p>
              <p className="text-sm mt-1 text-on-surface-variant">{errorMsg}</p>
              <button onClick={() => setStatus('idle')}
                className="mt-3 text-xs font-bold px-4 py-2 rounded-lg text-white"
                style={{ background: 'var(--color-status-biased)' }}>
                Try Again
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success */}
        <AnimatePresence>
          {status === 'done' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="mt-8 rounded-xl border p-6"
              style={{ background: 'var(--color-success-light)', borderColor: 'var(--color-status-clean)' }}>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white" style={{ background: 'var(--color-status-clean)' }}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <p className="text-sm font-black text-status-clean">Analysis complete</p>
              </div>
              <div className="flex flex-wrap gap-3">
                {(mode === 'dataset' || mode === 'both') && (
                  <button onClick={() => navigate('/audit/dataset')}
                    className="px-6 py-3 text-sm font-bold rounded-lg text-white transition-all"
                    style={{ background: 'var(--color-bg-ink)' }}>
                    View Dataset
                  </button>
                )}
                {hasModel && mode === 'both' && (
                  <button onClick={() => navigate('/audit/model')}
                    className="px-6 py-3 text-sm font-bold rounded-lg text-white transition-all"
                    style={{ background: 'var(--color-bg-ink)' }}>
                    View Model
                  </button>
                )}
                <button onClick={() => navigate('/report')}
                  className="px-6 py-3 text-sm font-bold rounded-lg border-2 transition-all"
                  style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface)' }}>
                  View Report
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* PKL Instructions Modal */}
      <AnimatePresence>
        {showPkl && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6"
            style={{ background: 'rgba(26,23,20,0.4)' }}
            onClick={() => setShowPkl(false)}>
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12 }}
              onClick={e => e.stopPropagation()}
              className="rounded-2xl border p-8 max-w-lg w-full"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-outline)' }}>
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-lg font-bold">Export model as .pkl</h3>
                <button onClick={() => setShowPkl(false)} className="text-2xl leading-none opacity-50 hover:opacity-100">×</button>
              </div>
              <p className="text-sm mb-4 text-on-surface-variant">
                Use Python's pickle module after training your model:
              </p>
              <div className="rounded-lg p-4 mb-4 text-xs font-mono leading-relaxed" style={{ background: 'var(--color-bg-ink)', color: '#fff' }}>
                <div>import pickle</div>
                <div className="mt-2">with open('model.pkl', 'wb') as f:</div>
                <div className="ml-4">pickle.dump(model, f)</div>
              </div>
              <p className="text-xs text-on-surface-variant">
                Works with scikit-learn, XGBoost, LightGBM. Model must accept a DataFrame matching your dataset columns.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
