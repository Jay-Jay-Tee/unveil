export default function BiasGauge({ value, verdict }) {
  if (value == null) return null;

  const clamped = Math.min(Math.max(value, 0), 1.5);
  const color = verdict === 'BIASED' ? 'var(--color-status-biased)' : verdict === 'AMBIGUOUS' ? 'var(--color-status-ambiguous)' : 'var(--color-status-clean)';
  const pct = (clamped / 1.5) * 100;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-xs font-semibold mb-1.5"
        style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-mono)' }}>
        <span>DI: {value.toFixed(2)}</span>
        <span>80% threshold: 0.80</span>
      </div>
      <div className="h-2 w-full rounded-full" style={{ background: 'var(--color-surface-container-high)' }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="relative mt-1">
        <div className="absolute" style={{ left: `${(0.8 / 1.5) * 100}%`, top: 0, width: '1px', height: '8px', background: 'var(--color-on-surface-variant)', opacity: 0.4 }} />
      </div>
    </div>
  );
}
