import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import ShapChart from '../components/ShapChart';
import SeverityBadge from '../components/SeverityBadge';
import Tooltip from '../components/Tooltip';
import { useAudit } from '../lib/AuditContext';

const SEVERITY_ORDER = { BIASED: 0, AMBIGUOUS: 1, CLEAN: 2 };
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] } }),
};
const VERDICT_COLOR = { BIASED: 'var(--color-status-biased)', AMBIGUOUS: 'var(--color-status-ambiguous)', CLEAN: 'var(--color-status-clean)' };

export default function ModelAudit() {
  const navigate = useNavigate();
  const audit = useAudit();

  const modelReport      = audit.modelBiasReport;
  const attributeResults = modelReport?.attribute_results || [];
  const shapSummary      = modelReport?.shap_summary || [];
  const sorted           = [...attributeResults].sort((a, b) => (SEVERITY_ORDER[a.verdict] ?? 3) - (SEVERITY_ORDER[b.verdict] ?? 3));
  const biasedCount      = sorted.filter(a => a.verdict === 'BIASED').length;
  const proxyCount       = shapSummary.filter(s => s.is_proxy).length;
  const meta             = audit.modelMeta;

  // No data at all — redirect
  if (!modelReport && !audit.schemaMap) {
    return (
      <div className="min-h-screen pt-32 flex flex-col items-center gap-6 text-center px-6">
        <p style={{ color: 'var(--color-on-surface-variant)' }}>No model analysis found. Run an audit first.</p>
        <button onClick={() => navigate('/upload')}
          className="px-6 py-3 text-sm font-bold rounded-lg text-white transition-colors"
          style={{ background: 'var(--color-bg-ink)' }}>
          ← Back to Upload
        </button>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen pt-20 pb-20 px-6" style={{ background: 'var(--color-surface)' }}>
      <div className="mx-auto max-w-5xl">

        {/* Header */}
        <div className="py-12 border-b mb-10" style={{ borderColor: 'var(--color-outline-variant)' }}>
          <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-mono)' }}>
            {audit.auditMode === 'both' ? 'Step 03' : 'Step 02'}
          </p>
          <h1 className="text-4xl font-black mb-4" style={{ color: 'var(--color-on-surface)' }}>
            Model Analysis
          </h1>
          <p className="text-base max-w-lg" style={{ color: 'var(--color-on-surface-variant)' }}>
            Synthetic probe pairs test how the model treats different demographic groups. SHAP reveals which features drive decisions.
          </p>
        </div>

        {/* Model info banner */}
        <div className="mb-8 rounded-xl border p-5"
          style={{ background: meta?.isDemo ? 'var(--color-surface-container-low)' : 'var(--color-surface-container-lowest)', borderColor: 'var(--color-outline-variant)' }}>
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-mono)' }}>
            {meta?.isDemo ? 'Auto-generated model' : 'Uploaded model'}
          </p>
          <p className="text-sm font-bold mb-2" style={{ color: 'var(--color-on-surface)' }}>
            {meta?.modelName || 'Logistic regression trained on your dataset'}
          </p>
          {meta?.isDemo && (
            <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
              No .pkl was uploaded — we trained a logistic regression on your dataset internally. Upload your own model on the <button onClick={() => navigate('/upload')} className="underline font-semibold hover:opacity-70" style={{ color: 'var(--color-on-surface)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>Upload page</button> for real-world results.
            </p>
          )}
        </div>

        {audit.isMock && (
          <p className="text-xs mb-6 px-4 py-2 rounded" style={{ color: 'var(--color-on-surface-variant)', background: 'var(--color-surface-container-high)', fontFamily: 'var(--font-mono)' }}>
            Demo mode — showing pre-computed results. Start backend for live analysis.
          </p>
        )}

        {/* Stats Boxes */}
        <motion.div initial="hidden" animate="visible" className="grid grid-cols-3 gap-6 mb-12">
          {[
            { label: 'Attributes Tested', value: sorted.length, tip: 'Number of protected demographic attributes the model was tested against.' },
            { label: 'Biased', value: biasedCount, tip: 'Attributes where the model gives statistically significant different outcomes based on that demographic.' },
            { label: 'Proxy Features', value: proxyCount, tip: 'Features correlated with protected attributes that the model relies on — indirect discrimination risk.' },
          ].map((s, i) => (
            <motion.div key={s.label} variants={fadeUp} custom={i} className="w-full h-full">
              <Tooltip text={s.tip} position="bottom">
                <div className="w-full h-full rounded-lg p-6 text-center border cursor-help transition-all hover:shadow-sm flex flex-col items-center justify-center" style={{ background: 'var(--color-surface-container-lowest)', borderColor: 'var(--color-outline-variant)', minHeight: '140px' }}>
                  <div className="text-3xl font-black" style={{ color: 'var(--color-on-surface)', fontFamily: 'var(--font-mono)' }}>{s.value}</div>
                  <div className="text-xs font-bold uppercase tracking-wider mt-2" style={{ color: 'var(--color-on-surface-variant)' }}>{s.label}</div>
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
        {sorted.length > 0 && (
          <>
            <h2 className="text-2xl font-black mb-1" style={{ color: 'var(--color-on-surface)' }}>
              Counterfactual Probe Results
            </h2>
            <p className="text-sm mb-6" style={{ color: 'var(--color-on-surface-variant)' }}>
              Synthetic personas differing only in one protected attribute — how much did it shift the model's decision?
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              {sorted.map((attr, i) => (
                <motion.div key={attr.name}
                  initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-30px' }} custom={i} variants={fadeUp}
                  className="rounded-xl border p-5 transition-all"
                  style={{
                    background: 'var(--color-surface-container-lowest)',
                    borderColor: attr.verdict === 'BIASED' ? 'var(--color-status-biased)' : attr.verdict === 'AMBIGUOUS' ? 'var(--color-status-ambiguous)' : 'var(--color-outline-variant)',
                    borderLeftWidth: attr.verdict !== 'CLEAN' ? 4 : 1,
                  }}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-on-surface)' }}>{attr.name}</h3>
                    <SeverityBadge verdict={attr.verdict} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <Tooltip text="Average shift in model output score when only this attribute changed. 0.20 = model score shifted by 20 points on average." position="bottom">
                      <MetricPill label="Mean Diff" value={attr.mean_diff != null ? attr.mean_diff.toFixed(3) : 'N/A'} highlight={attr.mean_diff > 0.1} />
                    </Tooltip>
                    <Tooltip text="Statistical confidence. Below 0.05 = the gap is real, not random noise." position="bottom">
                      <MetricPill label="p-value" value={attr.p_value != null ? (attr.p_value < 0.001 ? '<0.001' : attr.p_value.toFixed(3)) : 'N/A'} highlight={attr.p_value < 0.05} />
                    </Tooltip>
                    <Tooltip text="SHAP rank — how high this attribute appears in feature importance. #1 = biggest driver of decisions." position="bottom">
                      <MetricPill label="SHAP Rank" value={attr.shap_rank != null ? `#${attr.shap_rank}` : 'N/A'} />
                    </Tooltip>
                  </div>
                  {attr.mean_diff != null && (
                    <div>
                      <div className="h-1.5 w-full rounded-full" style={{ background: 'var(--color-surface-container-high)' }}>
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${Math.min(attr.mean_diff / 0.3 * 100, 100)}%`, background: VERDICT_COLOR[attr.verdict] || 'var(--color-on-surface)' }} />
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </>
        )}

        {/* Nav */}
        <div className="mt-12 flex flex-wrap gap-4">
          <button onClick={() => navigate('/report')}
            className="px-8 py-4 text-sm font-bold rounded-lg text-white transition-colors hover:opacity-90"
            style={{ background: 'var(--color-bg-ink)' }}>
            Generate Report
          </button>
          {audit.auditMode === 'both' && (
            <button onClick={() => navigate('/audit/dataset')}
              className="px-8 py-4 text-sm font-bold rounded-lg border-2 transition-colors hover:opacity-70"
              style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface)' }}>
              View Dataset
            </button>
          )}
          <button onClick={() => navigate('/upload')}
            className="px-8 py-4 text-sm font-bold rounded-lg border-2 transition-colors hover:opacity-70"
            style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}>
            New Upload
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function MetricPill({ label, value, highlight }) {
  return (
    <div className="rounded-lg px-3 py-2.5 text-center" style={{ background: highlight ? 'var(--color-error-light)' : 'var(--color-surface-container-high)' }}>
      <div className="text-sm font-black" style={{ fontFamily: 'var(--font-mono)', color: highlight ? 'var(--color-status-biased)' : 'var(--color-on-surface)' }}>{value}</div>
      <div className="text-xs font-semibold uppercase tracking-wider mt-0.5" style={{ color: highlight ? 'var(--color-status-biased)' : 'var(--color-on-surface-variant)' }}>{label}</div>
    </div>
  );
}
