import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ShapChart from '../components/ShapChart';
import SeverityBadge from '../components/SeverityBadge';
import { useAudit } from '../lib/AuditContext';
import { analyzeModel } from '../lib/api';
import { SEVERITY } from '../lib/constants';

const SEVERITY_ORDER = { BIASED: 0, AMBIGUOUS: 1, CLEAN: 2 };
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function ModelAudit() {
  const navigate = useNavigate();
  const audit = useAudit();

  const [status, setStatus]     = useState('idle');   // idle | running | done | error
  const [errorMsg, setErrorMsg] = useState('');
  const [nProbes, setNProbes]   = useState(100);

  // Auto-run if we have dataset data but no model results yet
  useEffect(() => {
    if (audit.schemaMap && audit.biasReport && !audit.modelBiasReport && status === 'idle') {
      runAnalysis();
    }
  }, [audit.schemaMap]);

  async function runAnalysis() {
    if (!audit.datasetFile) {
      setStatus('error');
      setErrorMsg('No dataset uploaded. Go back to Upload and upload a file first.');
      return;
    }
    setStatus('running');
    try {
      const result = await analyzeModel(
        audit.datasetFile,
        audit.schemaMap,
        audit.proxyFlags || { proxy_columns: [] },
        audit.modelFile || null,
        nProbes,
      );
      audit.setModelBiasReport({
        attribute_results: result.attributeResults,
        shap_summary: result.shapSummary,
      });
      audit.setIsMock(audit.isMock || result.isMock);
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message || 'Model analysis failed.');
    }
  }

  const modelReport = audit.modelBiasReport;
  const attributeResults = modelReport?.attribute_results || [];
  const shapSummary      = modelReport?.shap_summary || [];

  const sorted      = [...attributeResults].sort((a, b) => (SEVERITY_ORDER[a.verdict] ?? 3) - (SEVERITY_ORDER[b.verdict] ?? 3));
  const biasedCount = sorted.filter(a => a.verdict === 'BIASED').length;
  const proxyCount  = shapSummary.filter(s => s.is_proxy).length;

  if (!audit.schemaMap && status === 'idle') {
    return (
      <div className="min-h-screen pt-32 flex flex-col items-center gap-6 text-center px-6">
        <p className="text-gray-400">No dataset analysis found.</p>
        <button onClick={() => navigate('/upload')}
          className="rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent/80 transition">
          ← Upload a Dataset First
        </button>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="min-h-screen pt-24 px-6 pb-20">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-xl px-6 py-6 mb-8 transition-colors duration-500"
          style={{ backgroundColor: biasedCount > 0 ? 'rgba(255,64,64,0.05)' : 'rgba(46,204,143,0.05)' }}>
          <h1 className="font-[family-name:var(--font-heading)] text-4xl text-white mb-2">Model Audit</h1>
          <p className="text-gray-400">SHAP analysis and counterfactual probing results for model behavior.</p>
          {audit.isMock && <p className="text-xs text-ambiguous mt-2">⚠ Demo data — start backend for live probe results</p>}
        </div>

        {/* Running / error states */}
        <AnimatePresence>
          {status === 'running' && (
            <motion.div key="running" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="mb-8 flex items-center gap-3 rounded-xl border border-accent/30 bg-accent/5 px-5 py-4">
              <Spinner />
              <span className="text-sm text-accent">
                Running {nProbes} counterfactual probes per protected attribute…
              </span>
            </motion.div>
          )}
          {status === 'error' && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="mb-8 rounded-xl border border-biased/30 bg-biased/5 px-5 py-4">
              <p className="text-sm text-biased font-semibold">Analysis failed</p>
              <p className="text-xs text-gray-400 mt-1">{errorMsg}</p>
              <button onClick={runAnalysis}
                className="mt-3 rounded-lg bg-biased/20 px-4 py-2 text-xs font-semibold text-biased hover:bg-biased/30 transition">
                Retry
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Re-run controls */}
        {status !== 'running' && (
          <div className="mb-8 flex items-center gap-4 flex-wrap">
            <label className="text-xs text-gray-400">
              Probes per attribute:
              <select value={nProbes} onChange={e => setNProbes(Number(e.target.value))}
                className="ml-2 rounded-lg bg-bg-card border border-border-subtle px-2 py-1 text-xs text-white">
                <option value={50}>50 (fast)</option>
                <option value={100}>100 (default)</option>
                <option value={200}>200 (thorough)</option>
              </select>
            </label>
            <button onClick={runAnalysis}
              className="rounded-xl border border-accent/40 px-4 py-2 text-xs font-semibold text-accent hover:bg-accent/10 transition">
              ↺ Re-run Analysis
            </button>
            {/* Optional model upload */}
            <label className="cursor-pointer rounded-xl border border-border-subtle px-4 py-2 text-xs font-semibold text-gray-400 hover:bg-white/5 transition">
              Upload Model (.pkl)
              <input type="file" accept=".pkl" className="hidden"
                onChange={e => { audit.setModelFile(e.target.files[0] || null); }}/>
            </label>
            {audit.modelFile && <span className="text-xs text-clean">✓ {audit.modelFile.name}</span>}
          </div>
        )}

        {/* Results */}
        {(status === 'done' || audit.modelBiasReport) && sorted.length > 0 && (
          <>
            <motion.div initial="hidden" animate="visible" className="grid grid-cols-3 gap-4 mb-10">
              {[
                { label: 'Attributes Tested', value: sorted.length,  color: '#9CA3AF' },
                { label: 'Biased',            value: biasedCount,    color: SEVERITY.BIASED.color },
                { label: 'Proxy Features',    value: proxyCount,     color: SEVERITY.AMBIGUOUS.color },
              ].map((s, i) => (
                <motion.div key={s.label} variants={fadeUp} custom={i}>
                  <div className="rounded-xl border border-border-subtle bg-bg-card p-5 text-center">
                    <div className="font-mono text-3xl font-bold" style={{ color: s.color }}>{s.value}</div>
                    <div className="mt-1 text-xs text-gray-500 uppercase tracking-wider">{s.label}</div>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            {shapSummary.length > 0 && (
              <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="mb-10">
                <ShapChart shapSummary={shapSummary} />
              </motion.div>
            )}

            <h2 className="font-[family-name:var(--font-heading)] text-2xl text-white mb-6">
              Counterfactual Probing Results
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {sorted.map((attr, i) => (
                <motion.div key={attr.name} initial="hidden" whileInView="visible"
                  viewport={{ once: true, margin: '-30px' }} custom={i} variants={fadeUp}
                  className="rounded-xl border border-border-subtle bg-bg-card p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-mono text-sm font-semibold text-white">{attr.name}</h3>
                    <SeverityBadge verdict={attr.verdict} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <MetricPill label="Mean Diff" value={attr.mean_diff != null ? attr.mean_diff.toFixed(3) : 'N/A'} />
                    <MetricPill label="p-value"   value={attr.p_value != null ? (attr.p_value < 0.001 ? '<0.001' : attr.p_value.toFixed(3)) : 'N/A'} />
                    <MetricPill label="SHAP Rank" value={attr.shap_rank != null ? `#${attr.shap_rank}` : 'N/A'} />
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Proxy callouts */}
            {shapSummary.filter(s => s.is_proxy).length > 0 && (
              <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="mt-10">
                <h2 className="font-[family-name:var(--font-heading)] text-2xl text-white mb-6">Proxy Risk Analysis</h2>
                <div className="space-y-4">
                  {shapSummary.filter(s => s.is_proxy).map((pf, i) => (
                    <motion.div key={pf.feature} initial="hidden" whileInView="visible"
                      viewport={{ once: true, margin: '-30px' }} custom={i} variants={fadeUp}
                      className="flex items-start gap-4 rounded-xl border border-ambiguous/20 bg-ambiguous/5 p-5">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ambiguous/10">
                        <svg className="h-5 w-5 text-ambiguous" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
                        </svg>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-mono text-sm font-semibold text-white">{pf.feature}</span>
                          <span className="rounded-full bg-ambiguous/10 px-2.5 py-0.5 text-[10px] font-semibold text-ambiguous uppercase tracking-wider">Proxy</span>
                        </div>
                        <p className="text-sm text-gray-400 leading-relaxed">
                          SHAP importance <span className="font-mono font-semibold text-white">{pf.mean_abs_shap?.toFixed(2) ?? 'N/A'}</span> — acts as proxy for{' '}
                          {(pf.proxy_for || []).map((p, j, arr) => (
                            <span key={p}><span className="font-semibold text-ambiguous">{p}</span>{j < arr.length - 1 && ', '}</span>
                          ))}.
                          The model may use this feature to discriminate indirectly even if protected attributes are excluded from training.
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            <div className="mt-12 flex gap-4">
              <button onClick={() => navigate('/report')}
                className="rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent/80 transition">
                Generate Compliance Report →
              </button>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}

function MetricPill({ label, value }) {
  return (
    <div className="rounded-lg bg-white/[0.03] px-3 py-2 text-center">
      <div className="font-mono text-sm font-semibold text-white">{value}</div>
      <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">{label}</div>
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
