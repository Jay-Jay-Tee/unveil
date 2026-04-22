import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import UploadZone from '../components/UploadZone';
import WalkthroughModal from '../components/WalkthroughModal';
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
  const [showWalkthrough, setShowWalkthrough] = useState(false);

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
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="min-h-screen pt-28 px-6 pb-20 bg-gradient-to-br from-white via-accent/2 to-secondary/2">
      <WalkthroughModal onComplete={() => setShowWalkthrough(false)} />
      
      <div className="mx-auto max-w-6xl">
        <div className="mb-12">
          <h1 className="font-[family-name:var(--font-heading)] text-6xl text-text-primary mb-4 font-bold">Upload Dataset</h1>
          <p className="text-lg text-text-secondary max-w-2xl leading-relaxed">
            Drag and drop your CSV, JSON, or XLSX file. We'll analyze it for bias patterns, disparate impact, and compliance issues.
          </p>
        </div>

        <UploadZone onParsed={handleParsed} disabled={status === 'analyzing'} />

        <AnimatePresence>
          {(status === 'checking' || status === 'analyzing') && (
            <motion.div key="prog" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mt-8 flex items-center gap-4 rounded-2xl border-2 border-accent bg-gradient-to-r from-accent/10 to-orange-100 px-6 py-5">
              <Spinner /><span className="text-base font-medium text-accent">{progress}</span>
            </motion.div>
          )}
          {status === 'error' && (
            <motion.div key="err" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="mt-8 rounded-2xl border-2 border-biased bg-gradient-to-r from-biased/10 to-orange-100 px-6 py-5">
              <p className="text-base font-bold text-biased">❌ Analysis failed</p>
              <p className="text-sm text-text-secondary mt-2">{errorMsg}</p>
            </motion.div>
          )}
          {audit.isMock && status === 'done' && (
            <motion.div key="mock" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="mt-8 rounded-2xl border-2 border-ambiguous bg-gradient-to-r from-ambiguous/10 to-yellow-100 px-6 py-4">
              <p className="text-sm font-semibold text-text-primary">⚠️  Demo Mode Active</p>
              <p className="text-sm text-text-secondary mt-2">
                Backend is offline. Showing pre-computed UCI Adult demo results.
                To run live analysis: <code className="bg-text-primary/5 px-2 py-1 rounded text-xs">uvicorn backend.api:app --port 8001</code>
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {status === 'done' && columns.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }}>
              {audit.datasetMeta && (
                <div className="mt-12 mb-8 flex flex-col sm:flex-row items-start sm:items-center gap-6 text-sm font-medium text-text-secondary">
                  <div><span className="text-text-muted">Dataset:</span> <span className="text-text-primary font-mono font-bold">{audit.datasetMeta.datasetName}</span></div>
                  <div><span className="text-text-muted">Rows:</span> <span className="text-text-primary font-mono font-bold">{String(audit.datasetMeta.rowCount).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}</span></div>
                  {!audit.isMock && <div className="text-clean font-bold">✓ Live Analysis</div>}
                </div>
              )}
              <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard label="Total Columns" value={columns.length} color="from-text-primary to-text-secondary" />
                <StatCard label="Biased"     value={biasedCount}    color="from-accent to-orange-500" />
                <StatCard label="Ambiguous"  value={ambiguousCount} color="from-ambiguous to-yellow-500" />
                <StatCard label="Clean"      value={cleanCount}     color="from-secondary to-green-500" />
              </div>

              <div className="mt-14 mb-8">
                <h2 className="font-[family-name:var(--font-heading)] text-4xl text-text-primary mb-8 font-bold">Column Classification</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {columns.map((col, i) => (
                    <motion.div key={col.name} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.05 }}>
                      <ColCard col={col} />
                    </motion.div>
                  ))}
                </div>
              </div>

              <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={columns.length} className="mt-14 flex flex-col sm:flex-row gap-4">
                <button onClick={() => navigate('/audit/dataset')} className="group relative rounded-xl bg-gradient-to-r from-accent to-accent-dark px-8 py-4 text-sm font-bold text-white shadow-lg shadow-accent/30 transition-all hover:shadow-xl hover:shadow-accent/50 hover:-translate-y-1 active:translate-y-0">
                  📊 Dataset Audit →
                </button>
                <button onClick={() => navigate('/audit/model')} className="rounded-xl border-2 border-text-primary px-8 py-4 text-sm font-bold text-text-primary transition-all hover:border-accent hover:text-accent hover:bg-accent/5 active:-translate-y-0.5">
                  🔍 Model Audit →
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

const TYPE_COLORS    = { PROTECTED:'#FF6B5B', OUTCOME:'#1FCEC6', AMBIGUOUS:'#FFA500', NEUTRAL:'#999999' };
const VERDICT_COLORS = { BIASED:'#FF6B5B', AMBIGUOUS:'#FFA500', CLEAN:'#00D99F' };

function ColCard({ col }) {
  const tc = TYPE_COLORS[col.type] || '#999999';
  const vc = VERDICT_COLORS[col.bias?.verdict] || null;
  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -4 }}
      className="rounded-2xl border-2 border-border-light bg-white p-6 flex flex-col gap-3 shadow-sm hover:shadow-lg transition-shadow cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="font-mono text-sm font-bold text-text-primary break-all leading-tight">{col.name}</span>
        <span className="shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider"
          style={{ color: tc, backgroundColor: tc + '18' }}>{col.type}</span>
      </div>
      {col.bias && (
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border-light">
          <span className="rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider"
            style={{ color: vc, backgroundColor: vc + '18' }}>{col.bias.verdict}</span>
          {col.bias.disparate_impact != null && (
            <span className="text-[11px] text-text-muted font-mono bg-text-primary/5 px-2 py-1 rounded">DI: {col.bias.disparate_impact.toFixed(2)}</span>
          )}
        </div>
      )}
      {col.proxies?.length > 0 && <p className="text-[11px] text-text-muted italic">🔗 Proxy for: {col.proxies.join(', ')}</p>}
    </motion.div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <motion.div
      whileHover={{ scale: 1.05, y: -4 }}
      className={`rounded-2xl border-2 border-border-light bg-gradient-to-br ${color} p-6 text-center shadow-sm hover:shadow-lg transition-shadow`}
    >
      <div className="font-mono text-3xl font-bold text-white drop-shadow-sm">{value}</div>
      <div className="mt-2 text-xs text-white/80 uppercase tracking-wider font-bold">{label}</div>
    </motion.div>
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
