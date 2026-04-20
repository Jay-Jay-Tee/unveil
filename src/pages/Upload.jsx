import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import UploadZone from '../components/UploadZone';
import { useAudit } from '../lib/AuditContext';
import { analyzeDataset, checkBackendHealth } from '../lib/api';
import { SEVERITY } from '../lib/constants';

const SEVERITY_ORDER = { BIASED: 0, AMBIGUOUS: 1, CLEAN: 2 };

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function Upload() {
  const navigate = useNavigate();
  const audit = useAudit();
  const [status, setStatus]   = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [progress, setProgress] = useState('');

  async function handleParsed({ file }) {
    audit.setDatasetFile(file);
    setStatus('checking');
    setProgress('Checking backend connection…');
    const online = await checkBackendHealth();
    audit.setBackendOnline(online);
    setStatus('analyzing');
    setProgress(online
      ? 'Running Gemini column classification… (this takes 15-30 seconds)'
      : 'Backend offline — loading pre-computed demo results…');
    try {
      const result = await analyzeDataset(file);
      audit.setSchemaMap(result.schemaMap);
      audit.setProxyFlags(result.proxyFlags);
      audit.setBiasReport(result.biasReport);
      audit.setDatasetMeta({ datasetName: result.datasetName, rowCount: result.rowCount, warnings: result.warnings });
      audit.setIsMock(result.isMock);
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message || 'Analysis failed.');
    }
  }

  const columns = buildColumns(audit.schemaMap, audit.biasReport);
  const biasedCount    = columns.filter(c => c.bias?.verdict === 'BIASED').length;
  const ambiguousCount = columns.filter(c => c.bias?.verdict === 'AMBIGUOUS').length;
  const cleanCount     = columns.filter(c => c.bias?.verdict === 'CLEAN').length;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="min-h-screen pt-24 px-6 pb-20">
      <div className="mx-auto max-w-6xl">
        <h1 className="font-[family-name:var(--font-heading)] text-4xl text-white mb-2">Upload Dataset</h1>
        <p className="text-gray-400 mb-10">Drag and drop your CSV, JSON, or XLSX file to begin the bias audit.</p>
        <UploadZone onParsed={handleParsed} disabled={status === 'analyzing'} />

        <AnimatePresence>
          {(status === 'checking' || status === 'analyzing') && (
            <motion.div key="prog" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mt-6 flex items-center gap-3 rounded-xl border border-accent/30 bg-accent/5 px-5 py-4">
              <Spinner /><span className="text-sm text-accent">{progress}</span>
            </motion.div>
          )}
          {status === 'error' && (
            <motion.div key="err" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="mt-6 rounded-xl border border-biased/30 bg-biased/5 px-5 py-4">
              <p className="text-sm text-biased font-semibold">Analysis failed</p>
              <p className="text-xs text-gray-400 mt-1">{errorMsg}</p>
            </motion.div>
          )}
          {audit.isMock && status === 'done' && (
            <motion.div key="mock" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="mt-6 rounded-xl border border-ambiguous/30 bg-ambiguous/5 px-5 py-3 text-sm text-ambiguous">
              ⚠ Backend offline — showing pre-computed UCI Adult demo results.
              Start with <code className="font-mono text-xs bg-white/10 px-1 rounded">uvicorn backend.api:app --port 8001</code>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {status === 'done' && columns.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }}>
              {audit.datasetMeta && (
                <div className="mt-10 mb-4 flex items-center gap-4 text-xs text-gray-500">
                  <span>Dataset: <span className="text-white font-mono">{audit.datasetMeta.datasetName}</span></span>
                  <span>Rows: <span className="text-white font-mono">{String(audit.datasetMeta.rowCount)}</span></span>
                  {!audit.isMock && <span className="text-clean">✓ Live analysis</span>}
                </div>
              )}
              <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard label="Total Columns" value={columns.length} color="#9CA3AF" />
                <StatCard label="Biased"     value={biasedCount}    color={SEVERITY.BIASED.color} />
                <StatCard label="Ambiguous"  value={ambiguousCount} color={SEVERITY.AMBIGUOUS.color} />
                <StatCard label="Clean"      value={cleanCount}     color={SEVERITY.CLEAN.color} />
              </div>
              <h2 className="font-[family-name:var(--font-heading)] text-2xl text-white mb-6">Column Classification</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {columns.map((col, i) => (
                  <motion.div key={col.name} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.05 }}>
                    <ColCard col={col} />
                  </motion.div>
                ))}
              </div>
              <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={columns.length} className="mt-12 flex flex-wrap gap-4">
                <button onClick={() => navigate('/audit/dataset')} className="rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent/80 transition">
                  View Dataset Audit →
                </button>
                <button onClick={() => navigate('/audit/model')} className="rounded-xl border border-border-subtle px-6 py-3 text-sm font-semibold text-white hover:bg-white/5 transition">
                  Run Model Audit →
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function buildColumns(schemaMap, biasReport) {
  if (!schemaMap || !biasReport) return [];
  const biasMap = {};
  for (const col of (biasReport.column_results || [])) biasMap[col.name] = col;
  return (schemaMap.columns || [])
    .map(col => ({ ...col, bias: biasMap[col.name] || null }))
    .sort((a, b) => {
      const va = a.bias ? ({ BIASED: 0, AMBIGUOUS: 1, CLEAN: 2 }[a.bias.verdict] ?? 3) : 4;
      const vb = b.bias ? ({ BIASED: 0, AMBIGUOUS: 1, CLEAN: 2 }[b.bias.verdict] ?? 3) : 4;
      return va - vb;
    });
}

const TYPE_COLORS    = { PROTECTED:'#FF4040', OUTCOME:'#4D9EFF', AMBIGUOUS:'#F5A623', NEUTRAL:'#6B7280' };
const VERDICT_COLORS = { BIASED:'#FF4040', AMBIGUOUS:'#F5A623', CLEAN:'#2ECC8F' };

function ColCard({ col }) {
  const tc = TYPE_COLORS[col.type] || '#6B7280';
  const vc = VERDICT_COLORS[col.bias?.verdict] || null;
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-card p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-sm font-semibold text-white break-all">{col.name}</span>
        <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
          style={{ color: tc, backgroundColor: tc + '18' }}>{col.type}</span>
      </div>
      {col.bias && (
        <div className="flex items-center gap-2 mt-1">
          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            style={{ color: vc, backgroundColor: vc + '18' }}>{col.bias.verdict}</span>
          {col.bias.disparate_impact != null && (
            <span className="text-[11px] text-gray-400 font-mono">DI: {col.bias.disparate_impact.toFixed(2)}</span>
          )}
        </div>
      )}
      {col.proxies?.length > 0 && <p className="text-[10px] text-gray-500">Proxy for: {col.proxies.join(', ')}</p>}
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-card p-4 text-center">
      <div className="font-mono text-3xl font-bold" style={{ color }}>{value}</div>
      <div className="mt-1 text-xs text-gray-500 uppercase tracking-wider">{label}</div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin text-accent" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
    </svg>
  );
}
