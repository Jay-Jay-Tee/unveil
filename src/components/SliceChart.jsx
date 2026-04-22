import { BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from 'recharts';

const FLAG_THRESHOLD = 0.10;

const METRIC_COLORS = {
  positive_rate: 'var(--color-ink)',
  fpr:           'var(--color-ambiguous)',
  fnr:           'var(--color-biased)',
};

const METRIC_LABELS = {
  positive_rate: 'Approval Rate',
  fpr:           'False Positive Rate',
  fnr:           'False Negative Rate',
};

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-4 py-3 shadow-xl text-xs"
      style={{ background: 'var(--color-ink)', color: 'rgba(255,255,255,0.85)', fontFamily: 'var(--font-sans)' }}>
      <p className="font-bold mb-2" style={{ fontFamily: 'var(--font-mono)' }}>{label}</p>
      {payload.map(entry => (
        <div key={entry.dataKey} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
          <span style={{ color: 'rgba(255,255,255,0.6)' }}>{METRIC_LABELS[entry.dataKey]}:</span>
          <span className="font-bold" style={{ fontFamily: 'var(--font-mono)' }}>{entry.value.toFixed(3)}</span>
          {entry.value > FLAG_THRESHOLD && entry.dataKey !== 'positive_rate' && (
            <span className="font-bold" style={{ color: 'var(--color-biased)' }}>FLAGGED</span>
          )}
        </div>
      ))}
      {payload[0]?.payload?.count != null && (
        <p className="mt-2 pt-2 border-t text-[10px]" style={{ color: 'rgba(255,255,255,0.4)', borderColor: 'rgba(255,255,255,0.1)' }}>
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
    <div className="rounded-xl border-2 p-5" style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}>
      {columnName && (
        <h4 className="text-sm font-bold mb-1" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-ink)' }}>
          {columnName} <span className="font-normal text-xs" style={{ color: 'var(--color-ink-muted)' }}>— Group Comparison</span>
        </h4>
      )}
      <p className="text-[11px] mb-4" style={{ color: 'var(--color-ink-muted)' }}>
        How differently each group is treated. Dashed line = 10% flag threshold.
      </p>

      <div className="flex gap-4 mb-3 flex-wrap">
        {Object.entries(METRIC_LABELS).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--color-ink-muted)' }}>
            <span className="w-2 h-2 rounded-full" style={{ background: METRIC_COLORS[key] }} />
            {label}
          </div>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={slices.length * 60 + 40}>
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 20, bottom: 8, left: 10 }} barCategoryGap="20%" barGap={2}>
          <XAxis type="number" domain={[0, 1]} tickCount={6}
            tick={{ fill: 'var(--color-ink-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
            axisLine={{ stroke: 'var(--color-border)' }} tickLine={false} />
          <YAxis type="category" dataKey="group" width={120}
            tick={{ fill: 'var(--color-ink-mid)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
            axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--color-bg-warm)' }} />
          <ReferenceLine x={FLAG_THRESHOLD} stroke="var(--color-biased)" strokeDasharray="4 3" strokeWidth={1}
            label={{ value: '10%', position: 'top', fill: 'var(--color-biased)', fontSize: 9, fontFamily: 'var(--font-mono)' }} />
          <Bar dataKey="positive_rate" radius={[0, 3, 3, 0]} maxBarSize={13}>
            {data.map((_, i) => <Cell key={i} fill="var(--color-ink)" fillOpacity={0.8} />)}
          </Bar>
          <Bar dataKey="fpr" radius={[0, 3, 3, 0]} maxBarSize={13}>
            {data.map((entry, i) => <Cell key={i} fill="var(--color-ambiguous)" fillOpacity={entry.fprFlagged ? 1 : 0.5} />)}
          </Bar>
          <Bar dataKey="fnr" radius={[0, 3, 3, 0]} maxBarSize={13}>
            {data.map((entry, i) => <Cell key={i} fill="var(--color-biased)" fillOpacity={entry.fnrFlagged ? 1 : 0.5} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
