const TYPE_STYLE = {
  PROTECTED: { bg: 'var(--color-error-light)', color: 'var(--color-status-biased)', label: 'Protected' },
  OUTCOME:   { bg: 'var(--color-success-light)', color: 'var(--color-status-clean)', label: 'Outcome' },
  AMBIGUOUS: { bg: 'var(--color-accent-light)', color: 'var(--color-status-ambiguous)', label: 'Ambiguous' },
  NEUTRAL:   { bg: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)', label: 'Neutral' },
};
const VERDICT_STYLE = {
  BIASED:    { bg: 'var(--color-error-light)', color: 'var(--color-status-biased)', label: 'Biased' },
  AMBIGUOUS: { bg: 'var(--color-accent-light)', color: 'var(--color-status-ambiguous)', label: 'Ambiguous' },
  CLEAN:     { bg: 'var(--color-success-light)', color: 'var(--color-status-clean)', label: 'Clean' },
};

export default function SeverityBadge({ type, verdict }) {
  const style = type ? TYPE_STYLE[type] : verdict ? VERDICT_STYLE[verdict] : null;
  if (!style) return null;
  return (
    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
      style={{ background: style.bg, color: style.color }}>
      {style.label}
    </span>
  );
}
