import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAudit } from '../lib/AuditContext';
import { VERDICT } from '../lib/terminology';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] } }),
};

export default function ModelAudit() {
  const navigate = useNavigate();
  const { modelBiasReport, isMock, schemaMap, datasetMeta } = useAudit();

  if (!modelBiasReport) {
    return (
      <div className="min-h-screen pt-32 flex flex-col items-center gap-5 text-center px-3 sm:px-5">
        <p style={{ color: 'var(--color-text-mid)' }}>No model analysis yet. Upload a model first.</p>
        <button onClick={() => navigate('/upload')} className="btn btn-primary">
          ← Upload model
        </button>
      </div>
    );
  }

  const attrs = modelBiasReport.attribute_results || [];
  const shap = modelBiasReport.shap_summary || [];

  // Flag proxy columns in the SHAP ranking
  const proxyCols = new Set();
  (schemaMap?.columns || []).forEach((c) => {
    if (c.type === 'AMBIGUOUS') proxyCols.add(c.name);
  });
  const sensitiveCols = new Set();
  (schemaMap?.columns || []).forEach((c) => {
    if (c.type === 'PROTECTED') sensitiveCols.add(c.name);
  });

  const unfairAttrs = attrs.filter((a) => a.verdict === 'BIASED').length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen pt-20 pb-20 px-3 sm:px-5">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="py-10 border-b mb-10" style={{ borderColor: 'var(--color-border)' }}>
          <p className="text-label-mono mb-2" style={{ color: 'var(--color-text-mid)' }}>
            Step 03 · Model behavior
          </p>
          <h1 className="text-display-md mb-1" style={{ color: 'var(--color-on-surface)' }}>
            What drives the model's decisions
          </h1>
          <p className="text-base max-w-lg" style={{ color: 'var(--color-text-mid)' }}>
            Counterfactual probes + SHAP feature importance. If a sensitive attribute or its proxy is the top driver, you have a problem.
          </p>
          {isMock && (
            <p className="text-xs mt-4 inline-block px-3 py-1.5 rounded-lg"
              style={{ color: 'var(--color-accent-dark)', background: 'var(--color-accent-light)', fontFamily: 'var(--font-mono)' }}>
              Demo mode - start the backend for live model analysis
            </p>
          )}
        </div>

        {/* Counterfactual probe results */}
        <section className="mb-10">
          <h2 className="text-xl font-bold mb-1">Counterfactual probes</h2>
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-mid)' }}>
            For each sensitive attribute, we cloned 100+ rows and flipped only that attribute.
            A large mean shift means the model is directly using that attribute.
          </p>

          <div className="grid gap-3 md:grid-cols-2">
            {attrs.map((attr, i) => {
              const verdictInfo = VERDICT[attr.verdict] || VERDICT.SKIPPED;
              const cls = {
                BIASED: 'status-pill-unfair',
                AMBIGUOUS: 'status-pill-borderline',
                CLEAN: 'status-pill-fair',
              }[attr.verdict] || 'status-pill-skipped';

              return (
                <motion.div key={attr.name} variants={fadeUp} custom={i}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="rounded-2xl border p-5 card-shadow"
                  style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}>
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-mono font-bold">{attr.name}</h3>
                    <span className={`status-pill ${cls}`}>
                      {verdictInfo.icon} {verdictInfo.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Metric label="Mean shift" value={attr.mean_diff?.toFixed(3) ?? '-'} />
                    <Metric label="p-value" value={attr.p_value != null ? (attr.p_value < 0.001 ? '<0.001' : attr.p_value.toFixed(3)) : '-'} />
                    <Metric label="SHAP rank" value={attr.shap_rank ?? '-'} />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* SHAP ranking */}
        {shap.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xl font-bold mb-1">Top features driving decisions</h2>
            <p className="text-sm mb-4" style={{ color: 'var(--color-text-mid)' }}>
              Features ranked by SHAP importance. Sensitive or proxy features near the top are flagged.
            </p>

            <div className="rounded-2xl border overflow-hidden card-shadow"
              style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}>
              {shap.slice(0, 10).map((f, i) => {
                const isProxy = proxyCols.has(f.feature);
                const isSensitive = sensitiveCols.has(f.feature);
                const maxVal = shap[0]?.mean_abs_shap || 1;
                const widthPct = Math.min(100, (f.mean_abs_shap / maxVal) * 100);

                return (
                  <div key={f.feature} className={`flex items-center gap-4 px-5 py-3 ${i < shap.length - 1 ? 'border-b' : ''}`}
                    style={{ borderColor: 'var(--color-border)', background: (isSensitive || isProxy) ? 'var(--color-status-unfair-bg)' : 'transparent' }}>
                    <span className="text-xs font-mono font-bold w-6" style={{ color: 'var(--color-text-mid)' }}>
                      #{i + 1}
                    </span>
                    <span className="font-mono font-bold text-sm flex-1 truncate">{f.feature}</span>

                    {isSensitive && (
                      <span className="role-pill role-pill-sensitive">Sensitive</span>
                    )}
                    {isProxy && !isSensitive && (
                      <span className="role-pill role-pill-proxy">Proxy</span>
                    )}

                    <div className="w-40 h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-container)' }}>
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${widthPct}%`, background: (isSensitive || isProxy) ? 'var(--color-status-unfair)' : 'var(--color-on-surface)' }} />
                    </div>
                    <span className="text-xs font-mono w-14 text-right" style={{ color: 'var(--color-text-mid)' }}>
                      {f.mean_abs_shap?.toFixed(3)}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Summary callout */}
        {unfairAttrs > 0 && (
          <div className="rounded-2xl p-5 mb-6 border-l-4"
            style={{ background: 'var(--color-status-unfair-bg)', borderLeftColor: 'var(--color-status-unfair)' }}>
            <p className="text-sm font-bold mb-1" style={{ color: 'var(--color-status-unfair)' }}>
              {unfairAttrs} sensitive attribute{unfairAttrs > 1 ? 's' : ''} showing unfair behavior
            </p>
            <p className="text-sm" style={{ color: 'var(--color-text-mid)' }}>
              Your model's decisions shift significantly when these attributes change, even with all other features held constant.
              This is the clearest sign of bias - and the hardest to claim is accidental.
            </p>
          </div>
        )}

        {/* Nav */}
        <div className="flex flex-wrap gap-3">
          <button onClick={() => navigate('/audit/dataset')} className="btn btn-ghost">
            ← Back to dataset audit
          </button>
          <button
            onClick={() => {
              const data = { modelBiasReport, datasetMeta };
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              const name = (datasetMeta?.name || datasetMeta?.datasetName || 'model').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
              a.download = `${name}-model-audit.json`;
              document.body.appendChild(a); a.click(); a.remove();
              URL.revokeObjectURL(url);
            }}
            className="btn btn-ghost"
          >
            ↓ Download model audit
          </button>
          <button onClick={() => navigate('/report')} className="btn btn-primary">
            Next: compliance report →
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-lg p-2 text-center" style={{ background: 'var(--color-surface-container-low)' }}>
      <div className="text-sm font-bold text-metric">{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-wider mt-0.5" style={{ color: 'var(--color-text-mid)' }}>
        {label}
      </div>
    </div>
  );
}

