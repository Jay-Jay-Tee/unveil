import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import BiasGauge from './BiasGauge';
import SeverityBadge from './SeverityBadge';
import ProxyAlert from './ProxyAlert';
import SliceChart from './SliceChart';
import Tooltip from './Tooltip';

const VERDICT_COLOR = { BIASED: 'var(--color-status-biased)', AMBIGUOUS: 'var(--color-status-ambiguous)', CLEAN: 'var(--color-status-clean)' };

export default function ColumnCard({ name, type, proxies = [], disparateImpact, parityGap, pValue, verdict, slices = [] }) {
  const hasMetrics = disparateImpact != null && verdict;
  const hasSlices = slices.length > 0;
  const [expanded, setExpanded] = useState(false);

  const verdictBorderColor = VERDICT_COLOR[verdict] || 'var(--color-outline-variant)';
  const hasBias = verdict === 'BIASED' || verdict === 'AMBIGUOUS';

  return (
    <div className="rounded-xl border overflow-hidden transition-all"
      style={{ background: 'var(--color-surface-container-lowest)', borderColor: hasBias ? verdictBorderColor : 'var(--color-outline-variant)', borderLeftWidth: hasBias ? 4 : 1 }}>

      <div onClick={() => hasSlices && setExpanded(p => !p)}
        className={`p-5 ${hasSlices ? 'cursor-pointer' : ''}`}>

        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-bold truncate" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-on-surface)' }}>{name}</span>
            {hasSlices && (
              <motion.svg animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}
                className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--color-on-surface-variant)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </motion.svg>
            )}
          </div>
          <div className="flex shrink-0 gap-1.5">
            <SeverityBadge type={type} />
            {hasMetrics && <SeverityBadge verdict={verdict} />}
          </div>
        </div>

        {hasMetrics && (
          <div className="flex justify-center mb-4">
            <BiasGauge value={disparateImpact} verdict={verdict} />
          </div>
        )}

        {hasMetrics && (
          <div className="grid grid-cols-2 gap-2 mb-2">
            <Tooltip text="Difference in approval/positive rates between best-off and worst-off group. Over 10% (0.10) is a red flag.">
              <MetricPill label="Parity Gap" value={parityGap?.toFixed(2)} />
            </Tooltip>
            <Tooltip text="Statistical confidence. Below 0.05 means the gap is real, not random noise.">
              <MetricPill label="p-value" value={pValue < 0.001 ? '<0.001' : pValue?.toFixed(3)} />
            </Tooltip>
          </div>
        )}

        {!hasMetrics && (
          <div className="flex items-center justify-center py-5 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
            No bias metrics for this column
          </div>
        )}

        <ProxyAlert proxies={proxies} />

        {hasSlices && !expanded && (
          <p className="mt-3 text-center text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-on-surface-variant)' }}>
            Click to view slice breakdown ↓
          </p>
        )}
      </div>

      <AnimatePresence initial={false}>
        {expanded && hasSlices && (
          <motion.div
            key="slices"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t"
            style={{ borderColor: 'var(--color-outline-variant)' }}>
            <div className="p-4">
              <SliceChart slices={slices} columnName={name} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MetricPill({ label, value }) {
  return (
    <div className="rounded-lg px-3 py-2.5 text-center" style={{ background: 'var(--color-surface-container-high)' }}>
      <div className="text-sm font-bold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-on-surface)' }}>{value ?? '—'}</div>
      <div className="text-xs font-semibold uppercase tracking-wider mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>{label}</div>
    </div>
  );
}
