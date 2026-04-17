import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import BiasGauge from './BiasGauge';
import SeverityBadge from './SeverityBadge';
import ProxyAlert from './ProxyAlert';
import SliceChart from './SliceChart';

export default function ColumnCard({
  name,
  type,
  proxies = [],
  disparateImpact,
  parityGap,
  pValue,
  verdict,
  slices = [],
}) {
  const hasMetrics = disparateImpact != null && verdict;
  const hasSlices = slices.length > 0;
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col rounded-xl border border-border-subtle bg-bg-card transition-colors hover:border-accent/20"
    >
      {/* Clickable card body */}
      <div
        onClick={() => hasSlices && setExpanded((p) => !p)}
        className={`flex flex-col p-5 ${hasSlices ? 'cursor-pointer' : ''}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="font-[family-name:var(--font-mono)] text-sm font-semibold text-white truncate">
              {name}
            </h3>
            {/* Expand chevron */}
            {hasSlices && (
              <motion.svg
                animate={{ rotate: expanded ? 180 : 0 }}
                transition={{ duration: 0.25 }}
                className="h-4 w-4 shrink-0 text-gray-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </motion.svg>
            )}
          </div>
          <div className="flex shrink-0 gap-1.5">
            <SeverityBadge type={type} />
            {hasMetrics && <SeverityBadge verdict={verdict} />}
          </div>
        </div>

        {/* Gauge */}
        {hasMetrics && (
          <div className="flex justify-center mb-3">
            <BiasGauge value={disparateImpact} verdict={verdict} />
          </div>
        )}

        {/* Metric pills */}
        {hasMetrics && (
          <div className="grid grid-cols-2 gap-2 mb-2">
            <MetricPill label="Parity Gap" value={parityGap?.toFixed(2)} />
            <MetricPill label="p-value" value={pValue < 0.001 ? '<0.001' : pValue?.toFixed(3)} />
          </div>
        )}

        {/* No-metrics placeholder */}
        {!hasMetrics && (
          <div className="flex flex-1 items-center justify-center py-6 text-xs text-gray-600">
            No bias metrics for this column
          </div>
        )}

        {/* Proxy warning */}
        <ProxyAlert proxies={proxies} />

        {/* Expand hint */}
        {hasSlices && !expanded && (
          <p className="mt-3 text-center text-[10px] text-gray-600 uppercase tracking-wider">
            Click to view slice breakdown
          </p>
        )}
      </div>

      {/* Expandable SliceChart */}
      <AnimatePresence initial={false}>
        {expanded && hasSlices && (
          <motion.div
            key="slice-chart"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t border-border-subtle"
          >
            <div className="p-4">
              <SliceChart slices={slices} columnName={name} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function MetricPill({ label, value }) {
  return (
    <div className="rounded-lg bg-white/[0.03] px-3 py-2 text-center">
      <div className="font-[family-name:var(--font-mono)] text-sm font-semibold text-white">
        {value ?? '—'}
      </div>
      <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  );
}
