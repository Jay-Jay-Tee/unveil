import { SEVERITY, COLUMN_TYPES } from '../lib/constants';
import Tooltip from './Tooltip';

const VERDICT_TOOLTIPS = {
  BIASED:    'This attribute shows statistically significant unfair treatment. The gap in outcomes between groups is large enough to fail the legal 80% threshold.',
  AMBIGUOUS: 'This attribute shows some disparity, but not enough to be certain. Worth monitoring — it may indicate mild bias.',
  CLEAN:     'No significant disparity detected for this attribute. Outcome rates across groups are within acceptable range.',
};

const TYPE_TOOLTIPS = {
  PROTECTED:  'A legally or ethically protected demographic attribute (e.g. race, sex, age). Decisions should not vary based on this.',
  NEUTRAL:    'A feature with no known link to any protected group. Considered safe to use in modelling.',
  OUTCOME:    'The result the model is predicting (e.g. income level, loan approval). This is what we check for fairness.',
  AMBIGUOUS:  'This column is not directly protected, but may be correlated with one — it could act as a hidden proxy for a protected attribute.',
};

export default function SeverityBadge({ verdict, type }) {
  const config = type
    ? COLUMN_TYPES[type] ?? { color: '#9CA3AF', label: type }
    : SEVERITY[verdict] ?? { color: '#9CA3AF', bg: 'rgba(156,163,175,0.1)', label: verdict };

  const bg = config.bg ?? `${config.color}15`;
  const tooltipText = type ? TYPE_TOOLTIPS[type] : VERDICT_TOOLTIPS[verdict];

  const badge = (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold tracking-wider uppercase"
      style={{ color: config.color, backgroundColor: bg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: config.color }} />
      {config.label}
    </span>
  );

  if (!tooltipText) return badge;

  return (
    <Tooltip text={tooltipText} position="bottom">
      {badge}
    </Tooltip>
  );
}
