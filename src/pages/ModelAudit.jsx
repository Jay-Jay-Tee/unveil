import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ShapChart from '../components/ShapChart';
import SeverityBadge from '../components/SeverityBadge';
import Tooltip from '../components/Tooltip';
import { useAudit } from '../lib/AuditContext';
import { analyzeModel } from '../lib/api';

const SEVERITY_ORDER = { BIASED: 0, AMBIGUOUS: 1, CLEAN: 2 };
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] } }),
};

const VERDICT_COLOR = { BIASED: 'var(--color-biased)', AMBIGUOUS: 'var(--color-ambiguous)', CLEAN: 'var(--color-green)' };
const VERDICT_BG    = { BIASED: 'var(--color-red-light)', AMBIGUOUS: '#FFF4E6', CLEAN: 'var(--color-green-light)' };

export default function ModelAudit() {
  const navigate = useNavigate();
  const audit = useAudit();
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [nProbes, setNProbes] = useState(100);

  useEffect(() => {
    if (audit.schemaMap && audit.biasReport && !audit.modelBiasReport && status === 'idle') {
      runAnalysis();
    }
  }, [audit.schemaMap]);

  async function runAnalysis() {
    if (!audit.datasetFile) {
      setStatus('error');
      setErrorMsg('No dataset uploaded. Go back to Upload first.');
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
      audit.setModelBiasReport({ attribute_results: result.attributeResults, shap_summary: result.shapSummary });
      audit.setIsMock(audit.isMock || result.isMock);
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message || 'Model analysis failed.');
    }
  }

  const modelReport      = audit.modelBiasReport;
  const attributeResults = modelReport?.attribute_results || [];
  const shapSummary      = modelReport?.shap_summary || [];
  const sorted           = [...attributeResults].sort((a, b) => (SEVERITY_ORDER[a.verdict] ?? 3) - (SEVERITY_ORDER[b.verdict] ?? 3));
  const biasedCount      = sorted.filter(a => a.verdict === 'BIASED').length;
  const proxyCount       = shapSummary.filter(s => s.is_proxy).length;

  if (!audit.schemaMap && status === 'idle') {
    return (
      <div className="min-h-screen pt-32 flex flex-col items-center gap-6 text-center px-6">
        <p style={{ color: 'var(--color-ink-muted)' }}>No dataset analysis found.</p>
        <button onClick={() => navigate('/upload')}
          className="px-6 py-3 text-sm font-bold rounded-lg" style={{ background: 'var(--color-ink)', color: '#fff' }}>
          ← Upload a Dataset First
        </button>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen pt-20 pb-20 px-6">
      <div className="mx-auto max-w-5xl">

        {/* Header */}
        <div className="py-12 border-b-2 mb-10" style={{ borderColor: 'var(--color-border)' }}>
          <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--color-ink-muted)', fontFamily: 'var(--font-mono)' }}>Step 03</p>
          <h1 className="text-5xl md:text-6xl font-black tracking-tight leading-tight mb-4" style={{ fontFamily: 'var(--font-sans)', color: 'var(--color-ink)' }}>
            Model<br />
            <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 400, color: 'var(--color-amber-dark)' }}>Audit.</span>
          </h1>
          <p className="text-base max-w-lg" style={{ color: 'var(--color-ink-mid)' }}>
            Synthetic probe pairs test how the model treats different demographic groups. SHAP reveals which features drive decisions.
          </p>
          {audit.isMock && (
            <p className="text-xs mt-3 font-medium" style={{ color: 'var(--color-ambiguous)', fontFamily: 'var(--font-mono)' }}>
              ⚠ Demo mode — start backend for live probe results
            </p>
          )}
        </div>

        {/* Status messages */}
        <AnimatePresence>
          {status === 'running' && (
            <motion.div key="running" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="mb-8 flex items-center gap-3 px-5 py-4 rounded-xl border-2"
              style={{ borderColor: 'var(--color-amber)', background: 'var(--color-amber-light)' }}>
              <Spinner />
              <span className="text-sm font-semibold" style={{ color: 'var(--color-amber-dark)', fontFamily: 'var(--font-mono)' }}>
                Running {nProbes} synthetic probe pairs per protected attribute…
              </span>
            </motion.div>
          )}
          {status === 'error' && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="mb-8 px-5 py-4 rounded-xl border-2"
              style={{ borderColor: 'var(--color-biased)', background: 'var(--color-red-light)' }}>
              <p className="text-sm font-bold" style={{ color: 'var(--color-biased)' }}>Analysis failed</p>
              <p className="text-sm mt-1" style={{ color: 'var(--color-ink-mid)' }}>{errorMsg}</p>
              <button onClick={runAnalysis}
                className="mt-3 text-xs font-bold px-4 py-2 rounded-lg"
                style={{ background: 'var(--color-biased)', color: '#fff' }}>
                Retry
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Controls */}
        {status !== 'running' && (
          <div className="mb-8 flex flex-wrap items-center gap-3 p-4 rounded-xl border-2" style={{ background: 'var(--color-bg-warm)', borderColor: 'var(--color-border)' }}>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold" style={{ color: 'var(--color-ink-mid)' }}>Probe pairs per attribute:</label>
              <select value={nProbes} onChange={e => setNProbes(Number(e.target.value))}
                className="rounded-lg px-3 py-1.5 text-xs font-bold border-2"
                style={{ background: 'var(--color-bg-card)', color: 'var(--color-ink)', borderColor: 'var(--color-border)', fontFamily: 'var(--font-mono)' }}>
                <option value={50}>50 — fast</option>
                <option value={100}>100 — default</option>
                <option value={200}>200 — thorough</option>
              </select>
            </div>
            <button onClick={runAnalysis}
              className="text-xs font-bold px-4 py-2 rounded-lg border-2 transition-all hover:opacity-80"
              style={{ borderColor: 'var(--color-border-strong)', color: 'var(--color-ink)' }}>
              ↺ Re-run Analysis
            </button>
            <label className="cursor-pointer text-xs font-semibold px-4 py-2 rounded-lg border-2 transition-all hover:opacity-80"
              style={{ borderColor: 'var(--color-border-strong)', color: 'var(--color-ink-mid)' }}>
              Upload Model (.pkl)
              <input type="file" accept=".pkl" className="hidden"
                onChange={e => { audit.setModelFile(e.target.files[0] || null); }} />
            </label>
            {audit.modelFile && (
              <span className="text-xs font-semibold" style={{ color: 'var(--color-green)', fontFamily: 'var(--font-mono)' }}>
                ✓ {audit.modelFile.name}
              </span>
            )}
          </div>
        )}

        {/* Results */}
        {(status === 'done' || audit.modelBiasReport) && sorted.length > 0 && (
          <>
            {/* Stat pills */}
            <motion.div initial="hidden" animate="visible" className="grid grid-cols-3 gap-4 mb-10">
              {[
                { label: 'Tested', value: sorted.length, color: 'var(--color-ink)', bg: 'var(--color-bg-warm)',
                  tip: 'Number of protected demographic attributes tested.' },
                { label: 'Biased', value: biasedCount, color: 'var(--color-biased)', bg: 'var(--color-red-light)',
                  tip: 'Attributes where the model gives significantly different outcomes. Statistically confirmed, not random.' },
                { label: 'Proxy Features', value: proxyCount, color: 'var(--color-ambiguous)', bg: '#FFF4E6',
                  tip: 'Features the model relies on that correlate with a protected attribute — indirect discrimination risk.' },
              ].map((s, i) => (
                <motion.div key={s.label} variants={fadeUp} custom={i}>
                  <Tooltip text={s.tip} position="bottom">
                    <div className="rounded-xl p-5 text-center border-2 card-shadow cursor-help"
                      style={{ background: s.bg, borderColor: 'transparent' }}>
                      <div className="text-3xl font-black" style={{ color: s.color, fontFamily: 'var(--font-mono)' }}>{s.value}</div>
                      <div className="text-[10px] font-bold uppercase tracking-wider mt-1.5" style={{ color: s.color, opacity: 0.7 }}>{s.label}</div>
                    </div>
                  </Tooltip>
                </motion.div>
              ))}
            </motion.div>

            {/* SHAP chart */}
            {shapSummary.length > 0 && (
              <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="mb-10">
                <ShapChart shapSummary={shapSummary} />
              </motion.div>
            )}

            {/* Probe results */}
            <div className="mb-6">
              <h2 className="text-2xl font-black mb-1" style={{ color: 'var(--color-ink)' }}>Counterfactual Probe Results</h2>
              <p className="text-sm mb-6" style={{ color: 'var(--color-ink-muted)' }}>
                Identical synthetic personas differing only in protected attribute — how much did it shift the model's decision?
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {sorted.map((attr, i) => (
                <motion.div key={attr.name}
                  initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-30px' }} custom={i} variants={fadeUp}
                  className="rounded-xl border-2 p-5 card-shadow transition-all hover:-translate-y-0.5"
                  style={{
                    background: 'var(--color-bg-card)',
                    borderColor: attr.verdict === 'BIASED' ? 'var(--color-biased)' : attr.verdict === 'AMBIGUOUS' ? 'var(--color-ambiguous)' : 'var(--color-border)',
                    borderLeftWidth: attr.verdict !== 'CLEAN' ? 4 : 2,
                  }}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-ink)' }}>{attr.name}</h3>
                    <SeverityBadge verdict={attr.verdict} />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Tooltip text="Average shift in the model's output score when only this attribute changed. 0.20 = model score shifted 20 points on average." position="bottom">
                      <MetricPill label="Mean Diff" value={attr.mean_diff != null ? attr.mean_diff.toFixed(3) : 'N/A'} highlight={attr.mean_diff > 0.1} />
                    </Tooltip>
                    <Tooltip text="Statistical confidence that this gap is real. Below 0.05 = not random." position="bottom">
                      <MetricPill label="p-value" value={attr.p_value != null ? (attr.p_value < 0.001 ? '<0.001' : attr.p_value.toFixed(3)) : 'N/A'} highlight={attr.p_value < 0.05} />
                    </Tooltip>
                    <Tooltip text="Rank by SHAP influence. #1 = the feature that drives model decisions most." position="bottom">
                      <MetricPill label="SHAP Rank" value={attr.shap_rank != null ? `#${attr.shap_rank}` : 'N/A'} />
                    </Tooltip>
                  </div>

                  {/* Mean diff bar */}
                  {attr.mean_diff != null && (
                    <div className="mt-4">
                      <div className="flex justify-between text-[10px] mb-1" style={{ color: 'var(--color-ink-muted)', fontFamily: 'var(--font-mono)' }}>
                        <span>Outcome shift</span>
                        <span>{(attr.mean_diff * 100).toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full" style={{ background: 'var(--color-bg-warm)' }}>
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${Math.min(attr.mean_diff / 0.3 * 100, 100)}%`,
                            background: VERDICT_COLOR[attr.verdict] || 'var(--color-ink)',
                          }} />
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>

            {/* CTA */}
            <div className="mt-12 flex flex-wrap gap-4">
              <button onClick={() => navigate('/report')}
                className="px-8 py-4 text-sm font-bold rounded-lg transition-all hover:opacity-90"
                style={{ background: 'var(--color-ink)', color: '#fff' }}>
                Generate Compliance Report →
              </button>
              <button onClick={() => navigate('/audit/dataset')}
                className="px-8 py-4 text-sm font-bold rounded-lg border-2 transition-all hover:opacity-70"
                style={{ border: '2px solid var(--color-border-strong)', color: 'var(--color-ink)' }}>
                ← Back to Dataset Audit
              </button>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}

function MetricPill({ label, value, highlight }) {
  return (
    <div className="rounded-lg px-3 py-2.5 text-center" style={{ background: highlight ? 'var(--color-red-light)' : 'var(--color-bg-warm)' }}>
      <div className="text-sm font-black" style={{ fontFamily: 'var(--font-mono)', color: highlight ? 'var(--color-biased)' : 'var(--color-ink)' }}>{value}</div>
      <div className="text-[10px] font-semibold uppercase tracking-wider mt-0.5" style={{ color: highlight ? 'var(--color-biased)' : 'var(--color-ink-muted)' }}>{label}</div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="var(--color-amber)" strokeWidth="3" opacity="0.3"/>
      <path fill="var(--color-amber-dark)" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z">
        <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/>
      </path>
    </svg>
  );
}
