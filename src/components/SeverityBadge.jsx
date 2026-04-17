import { SEVERITY, COLUMN_TYPES } from '../lib/constants';

export default function SeverityBadge({ verdict, type }) {
  // If it's a column type badge (PROTECTED, NEUTRAL, OUTCOME, AMBIGUOUS without a verdict)
  const config = type
    ? COLUMN_TYPES[type] ?? { color: '#9CA3AF', label: type }
    : SEVERITY[verdict] ?? { color: '#9CA3AF', bg: 'rgba(156,163,175,0.1)', label: verdict };

  const bg = config.bg ?? `${config.color}15`;

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold tracking-wider uppercase"
      style={{ color: config.color, backgroundColor: bg }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: config.color }}
      />
      {config.label}
    </span>
  );
}
