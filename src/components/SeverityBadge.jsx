const TYPE_STYLE = {
  PROTECTED: { bg: 'var(--color-red-light)', color: 'var(--color-biased)', label: 'Protected' },
  OUTCOME:   { bg: 'var(--color-green-light)', color: 'var(--color-green)', label: 'Outcome' },
  AMBIGUOUS: { bg: '#FFF4E6', color: 'var(--color-ambiguous)', label: 'Ambiguous' },
  NEUTRAL:   { bg: 'var(--color-bg-warm)', color: 'var(--color-ink-muted)', label: 'Neutral' },
};
const VERDICT_STYLE = {
  BIASED:    { bg: 'var(--color-red-light)', color: 'var(--color-biased)', label: 'Biased' },
  AMBIGUOUS: { bg: '#FFF4E6', color: 'var(--color-ambiguous)', label: 'Ambiguous' },
  CLEAN:     { bg: 'var(--color-green-light)', color: 'var(--color-green)', label: 'Clean' },
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
