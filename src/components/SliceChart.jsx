import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ReferenceLine, ResponsiveContainer, Cell,
} from 'recharts';
import Tooltip_ from './Tooltip';

const FLAG_THRESHOLD = 0.10;

const METRIC_COLORS = {
  positive_rate: '#4D9EFF',
  fpr:           '#F5A623',
  fnr:           '#FF4040',
};

const METRIC_LABELS = {
  positive_rate: 'Approval Rate',
  fpr:           'False Positive Rate',
  fnr:           'False Negative Rate',
};

const METRIC_TOOLTIPS = {
  positive_rate: 'The share of people in this group who received a positive outcome (e.g. approved for a loan, predicted as high-income). A large gap between groups here is the main sign of bias.',
  fpr:           'False Positive Rate — the fraction of people in this group who were wrongly given a positive outcome when they shouldn\'t have been. High FPR means the model is too lenient on this group.',
  fnr:           'False Negative Rate — the fraction of people in this group who were wrongly denied a positive outcome when they deserved one. High FNR means the model is too harsh on this group.',
};

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-border-subtle bg-[#1A1C23] px-4 py-3 shadow-xl">
      <p className="mb-2 text-xs font-semibold text-white">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-xs mb-1">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-gray-400">{METRIC_LABELS[entry.dataKey]}:</span>
          <span className="font-[family-name:var(--font-mono)] font-semibold text-white">
            {entry.value.toFixed(3)}
          </span>
          {entry.dataKey !== 'positive_rate' && entry.value > FLAG_THRESHOLD && (
            <span className="text-[10px] font-semibold text-biased">FLAGGED</span>
          )}
        </div>
      ))}
      {payload[0]?.payload?.count != null && (
        <p className="mt-2 border-t border-white/5 pt-2 text-[10px] text-gray-500">
          n = {payload[0].payload.count.toLocaleString()} people in this group
        </p>
      )}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex justify-center gap-5 mt-2 mb-1 flex-wrap">
      {Object.entries(METRIC_LABELS).map(([key, label]) => (
        <Tooltip_ key={key} text={METRIC_TOOLTIPS[key]} position="top">
          <div className="flex items-center gap-1.5 text-[11px] text-gray-400 cursor-help">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: METRIC_COLORS[key] }}
            />
            {label}
            <span className="text-gray-600 text-[10px]">?</span>
          </div>
        </Tooltip_>
      ))}
    </div>
  );
}

export default function SliceChart({ slices, columnName }) {
  if (!slices?.length) return null;

  const data = slices.map((s) => ({
    ...s,
    fprFlagged: s.fpr > FLAG_THRESHOLD,
    fnrFlagged: s.fnr > FLAG_THRESHOLD,
  }));

  return (
    <div className="rounded-xl border border-border-subtle bg-bg-card p-5">
      {columnName && (
        <h4 className="mb-1 font-[family-name:var(--font-mono)] text-sm font-semibold text-white">
          {columnName}
          <span className="ml-2 text-xs font-normal text-gray-500">— Group Comparison</span>
        </h4>
      )}
      <p className="text-[11px] text-gray-600 mb-3">
        Each bar shows how differently the model treats each group. Hover the legend labels to learn what each metric means.
      </p>

      <Legend />

      <ResponsiveContainer width="100%" height={slices.length * 64 + 40}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 20, bottom: 8, left: 10 }}
          barCategoryGap="20%"
          barGap={2}
        >
          <XAxis
            type="number" domain={[0, 1]} tickCount={6}
            tick={{ fill: '#6B7280', fontSize: 10, fontFamily: 'var(--font-mono)' }}
            axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} tickLine={false}
          />
          <YAxis
            type="category" dataKey="group" width={120}
            tick={{ fill: '#9CA3AF', fontSize: 11, fontFamily: 'var(--font-mono)' }}
            axisLine={false} tickLine={false}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: 'rgba(255,255,255,0.03)' }}
            allowEscapeViewBox={{ x: false, y: false }}
            wrapperStyle={{ zIndex: 10 }}
          />
          <ReferenceLine
            x={FLAG_THRESHOLD}
            stroke="#FF4040"
            strokeDasharray="4 3"
            strokeWidth={1}
            label={{
              value: '10% flag line',
              position: 'top',
              fill: '#FF4040',
              fontSize: 9,
              fontFamily: 'var(--font-mono)',
            }}
          />
          <Bar dataKey="positive_rate" radius={[0, 3, 3, 0]} maxBarSize={14}>
            {data.map((_, i) => <Cell key={i} fill={METRIC_COLORS.positive_rate} />)}
          </Bar>
          <Bar dataKey="fpr" radius={[0, 3, 3, 0]} maxBarSize={14}>
            {data.map((entry, i) => (
              <Cell key={i} fill={METRIC_COLORS.fpr} fillOpacity={entry.fprFlagged ? 1 : 0.6} />
            ))}
          </Bar>
          <Bar dataKey="fnr" radius={[0, 3, 3, 0]} maxBarSize={14}>
            {data.map((entry, i) => (
              <Cell key={i} fill={METRIC_COLORS.fnr} fillOpacity={entry.fnrFlagged ? 1 : 0.6} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
