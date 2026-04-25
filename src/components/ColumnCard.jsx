import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SliceChart from './SliceChart';
import {
  COLUMN_ROLE, VERDICT, METRIC,
  summarizeColumnFinding,
} from '../lib/terminology';

/**
 * ColumnCard — shows bias findings for ONE column.
 *
 * Major improvements over the old card:
 *  1. Plain-English role labels (Sensitive / Possible proxy / Regular feature)
 *  2. Every column shows SOMETHING meaningful — no more "No bias metrics"
 *     dead-ends. Neutral columns get a clear "not applicable" note.
 *     Proxy columns show proxy strength.
 *  3. One-sentence plain-English finding summarizes what actually matters.
 *  4. Binning info shown when groups were collapsed ("grouped into age bands").
 */
export default function ColumnCard(props) {
  const {
    name,
    type,            // PROTECTED | AMBIGUOUS | NEUTRAL | OUTCOME
    proxies = [],
    disparate_impact: disparateImpact,
    parity_gap: parityGap,
    p_value: pValue,
    verdict,
    slices = [],
    binning,
    proxy_strength: proxyStrength,
    proxy_targets: proxyTargets,
    role,            // PROTECTED | PROXY
  } = props;

  const [expanded, setExpanded] = useState(false);

  const hasStats = verdict && (disparateImpact != null || parityGap != null);
  const hasSlices = slices?.length > 0;
  const verdictInfo = VERDICT[verdict] || VERDICT.SKIPPED;

  const finding = hasStats ? summarizeColumnFinding({
    name, role, verdict,
    disparate_impact: disparateImpact, parity_gap: parityGap,
    slices, proxy_strength: proxyStrength, proxy_targets: proxyTargets,
  }) : null;

  // The left border color signals verdict at a glance
  const borderLeftColor = hasStats ? verdictInfo.color : 'transparent';
  const borderLeftWidth = hasStats ? 4 : 1;

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all card-shadow"
      style={{
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
        borderLeftColor,
        borderLeftWidth,
      }}
    >
      <div className="p-5">
        {/* Top row: column name + role + verdict pills */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <h3 className="text-base font-bold truncate" style={{ fontFamily: 'var(--font-mono)' }}>
                {name}
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <RolePill type={type} />
              {hasStats && <VerdictPill verdict={verdict} />}
              {binning && binning !== 'none' && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                  style={{ background: 'var(--color-surface-container)', color: 'var(--color-text-mid)' }}>
                  grouped: {binning.replace(/_/g, ' ')}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Plain-English finding */}
        {finding && (
          <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--color-text-mid)' }}>
            {finding}
          </p>
        )}

        {/* Metrics strip — shown when we have real bias stats */}
        {hasStats && (
          <div className="grid grid-cols-3 gap-2 mb-3">
            <Metric
              label={METRIC.disparate_impact.shortLabel}
              fullLabel={METRIC.disparate_impact.label}
              value={METRIC.disparate_impact.format(disparateImpact)}
              flagged={disparateImpact != null && disparateImpact < METRIC.disparate_impact.legalThreshold}
              tooltip={METRIC.disparate_impact.description}
            />
            <Metric
              label={METRIC.parity_gap.shortLabel}
              fullLabel={METRIC.parity_gap.label}
              value={METRIC.parity_gap.format(parityGap)}
              flagged={parityGap != null && parityGap > METRIC.parity_gap.flagThreshold}
              tooltip={METRIC.parity_gap.description}
            />
            <Metric
              label={METRIC.p_value.shortLabel}
              fullLabel={METRIC.p_value.label}
              value={METRIC.p_value.format(pValue)}
              flagged={pValue != null && pValue < METRIC.p_value.flagThreshold}
              tooltip={METRIC.p_value.description}
            />
          </div>
        )}

        {/* Proxy strength meter — only for proxy-role columns */}
        {role === 'PROXY' && proxyStrength != null && (
          <div className="mb-3 p-3 rounded-lg" style={{ background: 'var(--color-role-proxy-bg)' }}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold" style={{ color: 'var(--color-role-proxy)' }}>
                Proxy strength
              </span>
              <span className="text-xs font-mono font-bold" style={{ color: 'var(--color-role-proxy)' }}>
                {proxyStrength.toFixed(2)}
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.08)' }}>
              <div className="h-full transition-all rounded-full"
                style={{ width: `${Math.min(100, proxyStrength * 100)}%`, background: 'var(--color-role-proxy)' }} />
            </div>
            {proxyTargets && proxyTargets.length > 0 && (
              <p className="text-[11px] mt-2" style={{ color: 'var(--color-text-mid)' }}>
                Correlated with: <span className="font-mono font-semibold">{proxyTargets.join(', ')}</span>
              </p>
            )}
          </div>
        )}

        {/* Neutral columns: clear message, not "No bias metrics" */}
        {!hasStats && type === 'NEUTRAL' && (
          <div className="text-sm py-2" style={{ color: 'var(--color-text-mid)' }}>
            Regular feature — no demographic correlation expected, bias analysis doesn't apply.
          </div>
        )}

        {/* Outcome (target) column: explain what it is */}
        {!hasStats && type === 'OUTCOME' && (
          <div className="text-sm py-2" style={{ color: 'var(--color-text-mid)' }}>
            This is the column a model predicts. Bias is measured relative to this.
          </div>
        )}

        {/* Proxy listed without metrics (edge case: protected column they correlate with is missing) */}
        {!hasStats && type === 'AMBIGUOUS' && proxies?.length > 0 && (
          <div className="text-sm py-2" style={{ color: 'var(--color-text-mid)' }}>
            Possible proxy for: <span className="font-mono font-semibold">{proxies.join(', ')}</span>.
            Full analysis unavailable — the sensitive column isn't present in the dataset.
          </div>
        )}

        {/* Expand toggle for slice breakdown */}
        {hasSlices && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="w-full flex items-center justify-center gap-1.5 pt-3 mt-2 border-t text-xs font-semibold transition-colors"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-mid)' }}
          >
            <span>{expanded ? 'Hide' : 'Show'} group-by-group breakdown</span>
            <svg className="w-3 h-3 transition-transform" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"
              style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0)' }}>
              <path d="M3 5l3 3 3-3" />
            </svg>
          </button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {expanded && hasSlices && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <div className="p-4" style={{ background: 'var(--color-surface-container-low)' }}>
              <SliceChart slices={slices} columnName={name} binning={binning} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── sub-components ─────────────────────────────────────────────────────

function RolePill({ type }) {
  const info = COLUMN_ROLE[type];
  if (!info) return null;
  const cls = {
    PROTECTED: 'role-pill-sensitive',
    OUTCOME: 'role-pill-target',
    AMBIGUOUS: 'role-pill-proxy',
    NEUTRAL: 'role-pill-neutral',
  }[type];
  return (
    <span className={`role-pill ${cls}`} title={info.description}>
      {info.label}
    </span>
  );
}

function VerdictPill({ verdict }) {
  const info = VERDICT[verdict];
  if (!info) return null;
  const cls = {
    BIASED: 'status-pill-unfair',
    AMBIGUOUS: 'status-pill-borderline',
    CLEAN: 'status-pill-fair',
    SKIPPED: 'status-pill-skipped',
  }[verdict];
  return (
    <span className={`status-pill ${cls}`} title={info.description}>
      {info.icon} {info.label}
    </span>
  );
}

function Metric({ label, fullLabel, value, flagged, tooltip }) {
  return (
    <div
      className="rounded-lg p-2 text-center cursor-help transition-colors"
      title={tooltip}
      style={{
        background: flagged ? 'var(--color-status-unfair-bg)' : 'var(--color-surface-container-low)',
      }}
    >
      <div className="text-base font-bold text-metric" style={{ color: flagged ? 'var(--color-status-unfair)' : 'var(--color-on-surface)' }}>
        {value}
      </div>
      <div className="text-[10px] font-semibold uppercase tracking-wider mt-0.5" style={{ color: flagged ? 'var(--color-status-unfair)' : 'var(--color-text-mid)' }}>
        {label}
      </div>
    </div>
  );
}
