import { BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from 'recharts';

const FLAG_THRESHOLD = 0.10;

const METRIC_COLORS = {
  positive_rate: 'var(--color-on-surface)',
  fpr:           'var(--color-status-ambiguous)',
  fnr:           'var(--color-status-biased)',
};

const METRIC_LABELS = {
  positive_rate: 'Approval Rate',
  fpr:           'False Positive Rate',
  fnr:           'False Negative Rate',
};

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-4 py-3 shadow-lg text-xs"
      style={{ background: 'var(--color-bg-ink)', color: '#ffffff', fontFamily: 'var(--font-sans)' }}>
      <p className="font-bold mb-2" style={{ fontFamily: 'var(--font-mono)' }}>{label}</p>
      {payload.map(entry => (
        <div key={entry.dataKey} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
          <span>{METRIC_LABELS[entry.dataKey]}:</span>
          <span className="font-bold" style={{ fontFamily: 'var(--font-mono)' }}>{entry.value.toFixed(3)}</span>
          {entry.value > FLAG_THRESHOLD && entry.dataKey !== 'positive_rate' && (
            <span className="font-bold" style={{ color: 'var(--color-status-biased)' }}>FLAGGED</span>
          )}
        </div>
      ))}
      {payload[0]?.payload?.count != null && (
        <p className="mt-2 pt-2 border-t text-xs" style={{ color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.1)' }}>
          n = {payload[0].payload.count.toLocaleString()} people
        </p>
      )}
    </div>
  );
}

export default function SliceChart({ slices, columnName }) {
  if (!slices?.length) return null;
  const data = slices.map(s => ({ ...s, fprFlagged: s.fpr > FLAG_THRESHOLD, fnrFlagged: s.fnr > FLAG_THRESHOLD }));

  return (
    <div className="rounded-xl border p-5" style={{ background: 'var(--color-surface-container-lowest)', borderColor: 'var(--color-outline-variant)' }}>
      {columnName && (
        <h4 className="text-sm font-bold mb-1" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-on-surface)' }}>
          {columnName} <span className="font-normal text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>— Group Comparison</span>
        </h4>
      )}
      <p className="text-xs mb-4" style={{ color: 'var(--color-on-surface-variant)' }}>
        How differently each group is treated. Dashed line = 10% flag threshold.
      </p>

      <div className="flex gap-4 mb-3 flex-wrap">
        {Object.entries(METRIC_LABELS).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
            <span className="w-2 h-2 rounded-full" style={{ background: METRIC_COLORS[key] }} />
            {label}
          </div>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={slices.length * 60 + 40}>
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 20, bottom: 8, left: 10 }} barCategoryGap="20%" barGap={2}>
          <XAxis type="number" domain={[0, 1]} tickCount={6}
            tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
            axisLine={{ stroke: 'var(--color-outline-variant)' }} tickLine={false} />
          <YAxis type="category" dataKey="group" width={120}
            tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
            axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--color-surface-container-high)' }} />
          <ReferenceLine x={FLAG_THRESHOLD} stroke="var(--color-status-biased)" strokeDasharray="4 3" strokeWidth={1}
            label={{ value: '10%', position: 'top', fill: 'var(--color-status-biased)', fontSize: 9, fontFamily: 'var(--font-mono)' }} />
          <Bar dataKey="positive_rate" radius={[0, 3, 3, 0]} maxBarSize={13}>
            {data.map((_, i) => <Cell key={i} fill="var(--color-on-surface)" fillOpacity={0.8} />)}
          </Bar>
          <Bar dataKey="fpr" radius={[0, 3, 3, 0]} maxBarSize={13}>
            {data.map((entry, i) => <Cell key={i} fill="var(--color-status-ambiguous)" fillOpacity={entry.fprFlagged ? 1 : 0.5} />)}
          </Bar>
          <Bar dataKey="fnr" radius={[0, 3, 3, 0]} maxBarSize={13}>
            {data.map((entry, i) => <Cell key={i} fill="var(--color-status-biased)" fillOpacity={entry.fnrFlagged ? 1 : 0.5} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
