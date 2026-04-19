import { motion } from 'framer-motion';
import ShapChart from '../components/ShapChart';
import SeverityBadge from '../components/SeverityBadge';
import { mockModelBiasReport } from '../lib/mockData';
import { SEVERITY } from '../lib/constants';

const SEVERITY_ORDER = { BIASED: 0, AMBIGUOUS: 1, CLEAN: 2 };

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function ModelAudit() {
  const { attribute_results, shap_summary } = mockModelBiasReport;

  const sorted = [...attribute_results].sort(
    (a, b) => (SEVERITY_ORDER[a.verdict] ?? 3) - (SEVERITY_ORDER[b.verdict] ?? 3)
  );

  const biasedCount = sorted.filter((a) => a.verdict === 'BIASED').length;
  const proxyFeatures = shap_summary.filter((s) => s.is_proxy);
  const proxyCount = proxyFeatures.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen pt-24 px-6 pb-20"
    >
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div
          className="rounded-xl px-6 py-6 mb-8 transition-colors duration-500"
          style={{
            backgroundColor: biasedCount > 0
              ? 'rgba(255,64,64,0.05)'
              : 'rgba(46,204,143,0.05)',
          }}
        >
          <h1 className="font-[family-name:var(--font-heading)] text-4xl text-white mb-2">
            Model Audit
          </h1>
          <p className="text-gray-400">
            SHAP analysis and counterfactual probing results for model behavior.
          </p>
        </div>

        {/* Summary stats */}
        <motion.div
          initial="hidden"
          animate="visible"
          className="grid grid-cols-3 gap-4 mb-10"
        >
          <motion.div variants={fadeUp} custom={0}>
            <StatCard label="Attributes Tested" value={sorted.length} color="#9CA3AF" />
          </motion.div>
          <motion.div variants={fadeUp} custom={1}>
            <StatCard label="Biased" value={biasedCount} color={SEVERITY.BIASED.color} />
          </motion.div>
          <motion.div variants={fadeUp} custom={2}>
            <StatCard label="Proxy Features" value={proxyCount} color={SEVERITY.AMBIGUOUS.color} />
          </motion.div>
        </motion.div>

        {/* SHAP chart — the main visual */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="mb-10"
        >
          <ShapChart shapSummary={shap_summary} />
        </motion.div>

        {/* Attribute result cards */}
        <h2 className="font-[family-name:var(--font-heading)] text-2xl text-white mb-6">
          Counterfactual Probing Results
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          {sorted.map((attr, i) => (
            <motion.div
              key={attr.name}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-30px' }}
              custom={i}
              variants={fadeUp}
              className="rounded-xl border border-border-subtle bg-bg-card p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-[family-name:var(--font-mono)] text-sm font-semibold text-white">
                  {attr.name}
                </h3>
                <SeverityBadge verdict={attr.verdict} />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <MetricPill label="Mean Diff" value={attr.mean_diff.toFixed(3)} />
                <MetricPill
                  label="p-value"
                  value={attr.p_value < 0.001 ? '<0.001' : attr.p_value.toFixed(3)}
                />
                <MetricPill label="SHAP Rank" value={`#${attr.shap_rank}`} />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Proxy warning callouts */}
        {proxyFeatures.length > 0 && (
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="mt-10"
          >
            <h2 className="font-[family-name:var(--font-heading)] text-2xl text-white mb-6">
              Proxy Risk Analysis
            </h2>

            <div className="space-y-4">
              {proxyFeatures.map((pf, i) => (
                <motion.div
                  key={pf.feature}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: '-30px' }}
                  custom={i}
                  variants={fadeUp}
                  className="flex items-start gap-4 rounded-xl border border-ambiguous/20 bg-ambiguous/5 p-5"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ambiguous/10">
                    <svg className="h-5 w-5 text-ambiguous" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-[family-name:var(--font-mono)] text-sm font-semibold text-white">
                        {pf.feature}
                      </span>
                      <span className="rounded-full bg-ambiguous/10 px-2.5 py-0.5 text-[10px] font-semibold text-ambiguous uppercase tracking-wider">
                        Proxy
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 leading-relaxed">
                      This feature has a SHAP importance of{' '}
                      <span className="font-[family-name:var(--font-mono)] font-semibold text-white">{pf.mean_abs_shap?.toFixed(2) ?? "N/A"}</span>
                      {' '}and acts as a proxy for{' '}
                      {pf.proxy_for.map((p, j) => (
                        <span key={p}>
                          <span className="font-semibold text-ambiguous">{p}</span>
                          {j < pf.proxy_for.length - 1 && ', '}
                        </span>
                      ))}
                      . The model may be using this feature to indirectly discriminate on protected attributes
                      even when those attributes are excluded from training.
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-card p-5 text-center">
      <div
        className="font-[family-name:var(--font-mono)] text-3xl font-bold"
        style={{ color }}
      >
        {value}
      </div>
      <div className="mt-1 text-xs text-gray-500 uppercase tracking-wider">{label}</div>
    </div>
  );
}

function MetricPill({ label, value }) {
  return (
    <div className="rounded-lg bg-white/[0.03] px-3 py-2 text-center">
      <div className="font-[family-name:var(--font-mono)] text-sm font-semibold text-white">
        {value}
      </div>
      <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  );
}