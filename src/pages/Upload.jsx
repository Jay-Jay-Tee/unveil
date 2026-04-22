import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import UploadZone from '../components/UploadZone';
import { useAudit } from '../lib/AuditContext';
import { analyzeDataset, checkBackendHealth } from '../lib/api';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] } }),
};

const TYPE_LABEL  = { PROTECTED: 'Protected', OUTCOME: 'Outcome', AMBIGUOUS: 'Ambiguous', NEUTRAL: 'Neutral' };
const TYPE_COLOR  = { PROTECTED: 'var(--color-biased)', OUTCOME: 'var(--color-green)', AMBIGUOUS: 'var(--color-ambiguous)', NEUTRAL: 'var(--color-ink-muted)' };
const TYPE_BG     = { PROTECTED: 'var(--color-red-light)', OUTCOME: 'var(--color-green-light)', AMBIGUOUS: '#FFF4E6', NEUTRAL: 'var(--color-bg-warm)' };
const VERDICT_COLOR= { BIASED: 'var(--color-biased)', AMBIGUOUS: 'var(--color-ambiguous)', CLEAN: 'var(--color-clean)' };
const VERDICT_BG  = { BIASED: 'var(--color-red-light)', AMBIGUOUS: '#FFF4E6', CLEAN: 'var(--color-green-light)' };

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

export default function Upload() {
  const navigate = useNavigate();
  const audit = useAudit();
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [progress, setProgress] = useState('');

  async function handleParsed({ file }) {
    audit.setDatasetFile(file);
    setStatus('checking');
    setProgress('Checking backend…');
    const online = await checkBackendHealth();
    audit.setBackendOnline(online);
    setStatus('analyzing');
    setProgress(online
      ? 'Running Gemini column classification… (15–30 seconds)'
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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen pt-20 pb-20 px-6">
      <div className="mx-auto max-w-5xl">

        {/* Header */}
        <div className="py-12 border-b-2 mb-12" style={{ borderColor: 'var(--color-border)' }}>
          <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--color-ink-muted)', fontFamily: 'var(--font-mono)' }}>
            Step 01
          </p>
          <h1 className="text-5xl md:text-6xl font-black tracking-tight leading-tight mb-4" style={{ fontFamily: 'var(--font-sans)', color: 'var(--color-ink)' }}>
            Upload<br />
            <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 400, color: 'var(--color-amber-dark)' }}>your dataset.</span>
          </h1>
          <p className="text-base max-w-lg" style={{ color: 'var(--color-ink-mid)' }}>
            CSV, JSON, or XLSX. Gemini classifies each column — Protected, Outcome, Ambiguous, or Neutral.
          </p>
        </div>

        <UploadZone onParsed={handleParsed} disabled={status === 'analyzing'} />

        {/* Status messages */}
        <AnimatePresence>
          {(status === 'checking' || status === 'analyzing') && (
            <motion.div key="prog" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mt-6 flex items-center gap-3 px-5 py-4 rounded-xl border-2"
              style={{ borderColor: 'var(--color-amber)', background: 'var(--color-amber-light)' }}>
              <Spinner />
              <span className="text-sm font-semibold" style={{ color: 'var(--color-amber-dark)', fontFamily: 'var(--font-mono)' }}>{progress}</span>
            </motion.div>
          )}
          {status === 'error' && (
            <motion.div key="err" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="mt-6 px-5 py-4 rounded-xl border-2"
              style={{ borderColor: 'var(--color-biased)', background: 'var(--color-red-light)' }}>
              <p className="text-sm font-bold" style={{ color: 'var(--color-biased)' }}>Analysis failed</p>
              <p className="text-sm mt-1" style={{ color: 'var(--color-ink-mid)' }}>{errorMsg}</p>
            </motion.div>
          )}
          {audit.isMock && status === 'done' && (
            <motion.div key="mock" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="mt-6 px-5 py-3 rounded-xl border-2"
              style={{ borderColor: 'var(--color-ambiguous)', background: '#FFF4E6' }}>
              <p className="text-xs font-bold" style={{ color: 'var(--color-ambiguous)', fontFamily: 'var(--font-mono)' }}>
                ⚠ DEMO MODE — showing pre-computed UCI Adult dataset results.
                Run <code style={{ background: 'rgba(0,0,0,0.07)', padding: '1px 5px', borderRadius: 3 }}>uvicorn backend.api:app --port 8001</code> for live analysis.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        <AnimatePresence>
          {status === 'done' && columns.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>

              {/* Meta */}
              {audit.datasetMeta && (
                <div className="mt-10 mb-8 flex flex-wrap gap-6 text-sm py-5 border-y-2" style={{ borderColor: 'var(--color-border)' }}>
                  <span><span style={{ color: 'var(--color-ink-muted)' }}>Dataset</span>{' '}
                    <span className="font-bold" style={{ fontFamily: 'var(--font-mono)' }}>{audit.datasetMeta.datasetName}</span></span>
                  <span><span style={{ color: 'var(--color-ink-muted)' }}>Rows</span>{' '}
                    <span className="font-bold" style={{ fontFamily: 'var(--font-mono)' }}>{String(audit.datasetMeta.rowCount).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}</span></span>
                  {!audit.isMock && <span className="font-bold" style={{ color: 'var(--color-green)' }}>✓ Live Analysis</span>}
                </div>
              )}

              {/* Stat pills */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
                {[
                  { label: 'Total', value: columns.length, color: 'var(--color-ink)', bg: 'var(--color-bg-warm)' },
                  { label: 'Biased', value: biasedCount, color: 'var(--color-biased)', bg: 'var(--color-red-light)' },
                  { label: 'Ambiguous', value: ambiguousCount, color: 'var(--color-ambiguous)', bg: '#FFF4E6' },
                  { label: 'Clean', value: cleanCount, color: 'var(--color-green)', bg: 'var(--color-green-light)' },
                ].map(s => (
                  <div key={s.label} className="rounded-xl p-5 text-center border-2 card-shadow" style={{ background: s.bg, borderColor: 'transparent' }}>
                    <div className="text-3xl font-black" style={{ color: s.color, fontFamily: 'var(--font-mono)' }}>{s.value}</div>
                    <div className="text-xs font-bold uppercase tracking-wider mt-1.5" style={{ color: s.color, opacity: 0.7 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Column grid */}
              <h2 className="text-2xl font-black mb-6" style={{ color: 'var(--color-ink)' }}>Column Classification</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {columns.map((col, i) => (
                  <motion.div
                    key={col.name}
                    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.04 }}
                    className="rounded-xl p-5 border-2 card-shadow transition-all hover:-translate-y-0.5"
                    style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <span className="font-bold text-sm break-all leading-tight" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-ink)' }}>{col.name}</span>
                      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
                        style={{ color: TYPE_COLOR[col.type], background: TYPE_BG[col.type] }}>
                        {TYPE_LABEL[col.type] || col.type}
                      </span>
                    </div>
                    {col.bias && (
                      <div className="flex items-center gap-2 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
                          style={{ color: VERDICT_COLOR[col.bias.verdict], background: VERDICT_BG[col.bias.verdict] }}>
                          {col.bias.verdict}
                        </span>
                        {col.bias.disparate_impact != null && (
                          <span className="text-[11px] font-medium" style={{ color: 'var(--color-ink-muted)', fontFamily: 'var(--font-mono)' }}>
                            DI: {col.bias.disparate_impact.toFixed(2)}
                          </span>
                        )}
                      </div>
                    )}
                    {col.proxies?.length > 0 && (
                      <p className="mt-2 text-[11px]" style={{ color: 'var(--color-ambiguous)' }}>
                        Proxy for: {col.proxies.join(', ')}
                      </p>
                    )}
                  </motion.div>
                ))}
              </div>

              {/* CTA */}
              <div className="mt-12 flex flex-wrap gap-4">
                <button onClick={() => navigate('/audit/dataset')}
                  className="px-8 py-4 text-sm font-bold rounded-lg transition-all hover:opacity-90"
                  style={{ background: 'var(--color-ink)', color: '#fff' }}>
                  View Dataset Audit →
                </button>
                <button onClick={() => navigate('/audit/model')}
                  className="px-8 py-4 text-sm font-bold rounded-lg border-2 transition-all hover:opacity-70"
                  style={{ border: '2px solid var(--color-border-strong)', color: 'var(--color-ink)' }}>
                  Skip to Model Audit →
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 shrink-0" style={{ color: 'var(--color-amber)' }} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-30" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
      <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z">
        <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/>
      </path>
    </svg>
  );
}
