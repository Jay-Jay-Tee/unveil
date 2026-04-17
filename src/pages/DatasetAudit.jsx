import { motion } from 'framer-motion';
import ColumnCard from '../components/ColumnCard';
import SliceChart from '../components/SliceChart';
import SeverityBadge from '../components/SeverityBadge';
import { mockSchemaMap, mockBiasReport } from '../lib/mockData';
import { SEVERITY } from '../lib/constants';

const SEVERITY_ORDER = { BIASED: 0, AMBIGUOUS: 1, CLEAN: 2 };

function buildColumns(schema, biasReport) {
  const biasMap = {};
  for (const col of biasReport.column_results) {
    biasMap[col.name] = col;
  }
  return schema.columns
    .map((col) => {
      const bias = biasMap[col.name];
      return { ...col, bias };
    })
    .filter((col) => col.bias)
    .sort(
      (a, b) =>
        (SEVERITY_ORDER[a.bias.verdict] ?? 3) -
        (SEVERITY_ORDER[b.bias.verdict] ?? 3)
    );
}

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function DatasetAudit() {
  const columns = buildColumns(mockSchemaMap, mockBiasReport);

  const biasedCount = columns.filter((c) => c.bias.verdict === 'BIASED').length;
  const ambiguousCount = columns.filter((c) => c.bias.verdict === 'AMBIGUOUS').length;
  const cleanCount = columns.filter((c) => c.bias.verdict === 'CLEAN').length;

  // Determine header tint based on worst severity
  const headerBg = biasedCount > 0
    ? 'rgba(255,64,64,0.05)'
    : ambiguousCount > 0
      ? 'rgba(245,166,35,0.05)'
      : 'rgba(46,204,143,0.05)';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen pt-24 px-6 pb-20"
    >
      <div className="mx-auto max-w-6xl">
        {/* Header with severity tint */}
        <div
          className="rounded-xl px-6 py-6 mb-8 transition-colors duration-500"
          style={{ backgroundColor: headerBg }}
        >
          <h1 className="font-[family-name:var(--font-heading)] text-4xl text-white mb-2">
            Dataset Audit
          </h1>
          <p className="text-gray-400">
            Disparate impact analysis and slice evaluation across protected attributes.
          </p>
        </div>

        {/* Summary stats */}
        <motion.div
          initial="hidden"
          animate="visible"
          className="grid grid-cols-3 gap-4 mb-10"
        >
          <motion.div variants={fadeUp} custom={0}>
            <StatCard label="Total Analyzed" value={columns.length} color="#9CA3AF" />
          </motion.div>
          <motion.div variants={fadeUp} custom={1}>
            <StatCard label="Biased" value={biasedCount} color={SEVERITY.BIASED.color} />
          </motion.div>
          <motion.div variants={fadeUp} custom={2}>
            <StatCard label="Ambiguous" value={ambiguousCount} color={SEVERITY.AMBIGUOUS.color} />
          </motion.div>
        </motion.div>

        {/* Per-column sections: card + slice chart side by side */}
        <div className="space-y-8">
          {columns.map((col, i) => (
            <motion.div
              key={col.name}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-40px' }}
              custom={i}
              variants={fadeUp}
            >
              {/* Section heading */}
              <div className="flex items-center gap-3 mb-4">
                <h3 className="font-[family-name:var(--font-mono)] text-lg font-semibold text-white">
                  {col.name}
                </h3>
                <SeverityBadge verdict={col.bias.verdict} />
              </div>

              <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
                {/* Column card */}
                <ColumnCard
                  name={col.name}
                  type={col.type}
                  proxies={col.proxies}
                  disparateImpact={col.bias.disparate_impact}
                  parityGap={col.bias.parity_gap}
                  pValue={col.bias.p_value}
                  verdict={col.bias.verdict}
                />

                {/* Slice chart */}
                <SliceChart
                  slices={col.bias.slices}
                  columnName={col.name}
                />
              </div>
            </motion.div>
          ))}
        </div>
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
