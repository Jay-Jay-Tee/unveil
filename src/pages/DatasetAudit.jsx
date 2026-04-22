import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import ColumnCard from '../components/ColumnCard';
import SliceChart from '../components/SliceChart';
import SeverityBadge from '../components/SeverityBadge';
import Tooltip from '../components/Tooltip';
import { useAudit } from '../lib/AuditContext';
import { SEVERITY } from '../lib/constants';

const SEVERITY_ORDER = { BIASED: 0, AMBIGUOUS: 1, CLEAN: 2 };

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function DatasetAudit() {
  const navigate = useNavigate();
  const { schemaMap, biasReport, isMock } = useAudit();

  if (!schemaMap || !biasReport) {
    return (
      <div className="min-h-screen pt-32 flex flex-col items-center gap-8 text-center px-6">
        <div>
          <p className="text-lg text-text-muted font-medium">📊 No analysis data yet</p>
          <p className="text-sm text-text-secondary mt-2">Upload a dataset to start the audit</p>
        </div>
        <motion.button onClick={() => navigate('/upload')}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="rounded-xl bg-gradient-to-r from-accent to-accent-dark px-8 py-4 text-sm font-bold text-white shadow-lg shadow-accent/30 transition-all hover:shadow-xl">
          ← Upload Dataset
        </motion.button>
      </div>
    );
  }

  const columns      = buildColumns(schemaMap, biasReport);
  const biasedCount  = columns.filter(c => c.bias?.verdict === 'BIASED').length;
  const ambiguousCount = columns.filter(c => c.bias?.verdict === 'AMBIGUOUS').length;
  const cleanCount = columns.filter(c => c.bias?.verdict === 'CLEAN').length;

  const headerColor = biasedCount > 0
    ? 'from-accent/10 to-orange-100'
    : ambiguousCount > 0
      ? 'from-ambiguous/10 to-yellow-100'
      : 'from-secondary/10 to-green-100';

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="min-h-screen pt-28 px-6 pb-20 bg-gradient-to-br from-white to-accent/3">
      <div className="mx-auto max-w-6xl">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-3xl px-8 py-8 mb-8 bg-gradient-to-r ${headerColor} border-2 border-border-light transition-all`}
        >
          <h1 className="font-[family-name:var(--font-heading)] text-5xl text-text-primary mb-3 font-bold">Dataset Audit</h1>
          <p className="text-lg text-text-secondary max-w-2xl">
            Fairness analysis across demographic groups. Detect disparate impact, bias, and compliance risks.
          </p>
          {isMock && <p className="text-sm text-ambiguous mt-4 font-medium">⚠️  Demo mode — start backend for live results</p>}
        </motion.div>

        {/* Hover hint */}
        <p className="text-sm text-text-secondary mb-10 px-2 font-medium">
          💡 Hover over any metric or chart to learn what it means
        </p>

        {/* Summary stats */}
        <motion.div initial="hidden" animate="visible" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {[
            { label: 'Total Columns', value: columns.length, color: 'from-text-primary to-text-secondary', tooltip: 'Total demographic columns analyzed.' },
            { label: 'Biased', value: biasedCount, color: 'from-accent to-orange-500', tooltip: 'Severe bias detected — fails 80% legal threshold.' },
            { label: 'Ambiguous', value: ambiguousCount, color: 'from-ambiguous to-yellow-500', tooltip: 'Possible bias — worth investigating further.' },
            { label: 'Clean', value: cleanCount, color: 'from-secondary to-green-500', tooltip: 'No significant bias detected.' },
          ].map((s, i) => (
            <motion.div key={s.label} variants={fadeUp} custom={i}>
              <Tooltip text={s.tooltip} position="bottom">
                <motion.div
                  whileHover={{ scale: 1.05, y: -4 }}
                  className={`w-full rounded-2xl border-2 border-border-light bg-gradient-to-br ${s.color} p-6 text-center cursor-help shadow-sm hover:shadow-lg transition-all`}
                >
                  <div className="font-mono text-3xl font-bold text-white drop-shadow-sm">{s.value}</div>
                  <div className="mt-2 text-sm text-white/80 uppercase tracking-wider font-bold flex items-center justify-center gap-1">
                    {s.label} <span className="text-lg">?</span>
                  </div>
                </motion.div>
              </Tooltip>
            </motion.div>
          ))}
        </motion.div>

        {/* Per-column results */}
        <div className="space-y-10">
          {columns.map((col, i) => (
            <motion.div key={col.name} initial="hidden" whileInView="visible"
              viewport={{ once: true, margin: '-40px' }} custom={i} variants={fadeUp}>
              <div className="flex items-center gap-4 mb-6">
                <h3 className="font-mono text-2xl font-bold text-text-primary">{col.name}</h3>
                <SeverityBadge verdict={col.bias?.verdict} />
              </div>
              <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
                <ColumnCard
                  name={col.name} type={col.type} proxies={col.proxies}
                  disparateImpact={col.bias?.disparate_impact} parityGap={col.bias?.parity_gap}
                  pValue={col.bias?.p_value} verdict={col.bias?.verdict}
                />
                <SliceChart slices={col.bias?.slices} columnName={col.name} />
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div initial="hidden" whileInView="visible" className="mt-14 flex flex-col sm:flex-row gap-4">
          <motion.button onClick={() => navigate('/audit/model')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="rounded-xl bg-gradient-to-r from-accent to-accent-dark px-8 py-4 text-sm font-bold text-white shadow-lg shadow-accent/30 transition-all hover:shadow-xl hover:-translate-y-1">
            🔍 Model Audit →
          </motion.button>
          <motion.button onClick={() => navigate('/report')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="rounded-xl border-2 border-text-primary px-8 py-4 text-sm font-bold text-text-primary transition-all hover:border-accent hover:text-accent hover:bg-accent/5">
            📋 View Report →
          </motion.button>
        </motion.div>
      </div>
    </motion.div>
  );
}

function buildColumns(schemaMap, biasReport) {
  const biasMap = {};
  for (const col of (biasReport?.column_results || [])) biasMap[col.name] = col;
  return (schemaMap?.columns || [])
    .map(col => ({ ...col, bias: biasMap[col.name] || null }))
    .filter(col => col.bias)
    .sort((a, b) => (SEVERITY_ORDER[a.bias.verdict] ?? 3) - (SEVERITY_ORDER[b.bias.verdict] ?? 3));
}
