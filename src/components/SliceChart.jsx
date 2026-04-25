import { BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from 'recharts';

const FLAG_THRESHOLD = 0.10;

/**
 * SliceChart — shows per-group approval rates, FPR, and FNR.
 *
 * The old version rendered one bar per unique value, which meant 73 age
 * bars. The backend now bins upstream (age bands, top-N + Other), so this
 * just renders what comes in — but we also:
 *   - Show a "grouped" badge when binning was applied
 *   - Mark small samples (n<20) visually (lower opacity)
 *   - Sort groups by count descending so the biggest is first
 */
export default function SliceChart({ slices, columnName, binning }) {
  if (!slices?.length) return null;

  // Sort descending by count — biggest group first = most reliable stat
  const data = [...slices]
    .sort((a, b) => (b.count || 0) - (a.count || 0))
    .map((s) => ({
      ...s,
      group: s.group == null ? '(missing)' : String(s.group),
      fprFlagged: s.fpr > FLAG_THRESHOLD,
      fnrFlagged: s.fnr > FLAG_THRESHOLD,
    }));

  // Chart height adapts — each row ~48px, with a 40px bottom allowance
  const chartHeight = Math.max(180, data.length * 48 + 40);

  return (
    <div>
      {/* Header */}
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
        <div>
          {columnName && (
            <h4 className="text-sm font-bold" style={{ fontFamily: 'var(--font-mono)' }}>
              {columnName}
            </h4>
          )}
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-mid)' }}>
            Approval rate by group. Tap a bar for exact numbers.
          </p>
        </div>
        {binning && binning !== 'none' && (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full"
            style={{ background: 'var(--color-surface-container)', color: 'var(--color-text-mid)' }}>
            grouped · {binning.replace(/_/g, ' ')}
          </span>
        )}
      </div>

      {/* Legend */}
      <div className="flex gap-3 mb-3 flex-wrap text-xs">
        <LegendSwatch color="var(--color-on-surface)" label="Approval rate" />
        <LegendSwatch color="var(--color-status-borderline)" label="False positive" />
        <LegendSwatch color="var(--color-status-unfair)" label="False negative" />
      </div>

      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 10 }} barCategoryGap="24%" barGap={2}>
          <XAxis
            type="number"
            domain={[0, 1]}
            tickCount={6}
            tickFormatter={(v) => `${Math.round(v * 100)}%`}
            tick={{ fill: 'var(--color-text-mid)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
            axisLine={{ stroke: 'var(--color-border)' }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="group"
            width={110}
            tick={{ fill: 'var(--color-on-surface)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--color-surface-container)' }} />
          <ReferenceLine
            x={FLAG_THRESHOLD}
            stroke="var(--color-status-unfair)"
            strokeDasharray="3 3"
            strokeWidth={1}
            label={{ value: '10% line', position: 'top', fill: 'var(--color-status-unfair)', fontSize: 9, fontFamily: 'var(--font-mono)' }}
          />
          <Bar dataKey="positive_rate" radius={[0, 3, 3, 0]} maxBarSize={12}>
            {data.map((d, i) => (
              <Cell key={i} fill="var(--color-on-surface)" fillOpacity={d.small_sample ? 0.4 : 0.9} />
            ))}
          </Bar>
          <Bar dataKey="fpr" radius={[0, 3, 3, 0]} maxBarSize={12}>
            {data.map((d, i) => (
              <Cell key={i} fill="var(--color-status-borderline)" fillOpacity={d.fprFlagged ? 1 : (d.small_sample ? 0.3 : 0.55)} />
            ))}
          </Bar>
          <Bar dataKey="fnr" radius={[0, 3, 3, 0]} maxBarSize={12}>
            {data.map((d, i) => (
              <Cell key={i} fill="var(--color-status-unfair)" fillOpacity={d.fnrFlagged ? 1 : (d.small_sample ? 0.3 : 0.55)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Small-sample footnote if any bins are under-powered */}
      {data.some((d) => d.small_sample) && (
        <p className="text-[11px] mt-2 italic" style={{ color: 'var(--color-text-mid)' }}>
          Faded bars = fewer than 20 rows in that group. Interpret with caution.
        </p>
      )}
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  return (
    <div className="rounded-lg px-3.5 py-2.5 card-shadow-lg text-xs"
      style={{ background: 'var(--color-bg-ink)', color: '#fff' }}>
      <p className="font-bold mb-2" style={{ fontFamily: 'var(--font-mono)' }}>{label}</p>
      <Row color="rgba(255,255,255,0.9)" label="Approved" value={fmt(row?.positive_rate)} />
      <Row color="var(--color-status-borderline)" label="False +" value={fmt(row?.fpr)} flagged={row?.fprFlagged} />
      <Row color="var(--color-status-unfair)" label="False −" value={fmt(row?.fnr)} flagged={row?.fnrFlagged} />
      {row?.count != null && (
        <p className="mt-2 pt-2 border-t text-[11px]" style={{ color: 'rgba(255,255,255,0.55)', borderColor: 'rgba(255,255,255,0.15)' }}>
          n = {row.count.toLocaleString()}{row.small_sample ? ' · small sample' : ''}
        </p>
      )}
    </div>
  );
}

function Row({ color, label, value, flagged }) {
  return (
    <div className="flex items-center gap-2 mb-0.5">
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      <span className="opacity-80">{label}:</span>
      <span className="font-bold" style={{ fontFamily: 'var(--font-mono)' }}>{value}</span>
      {flagged && <span className="font-bold ml-auto" style={{ color: 'var(--color-status-unfair)' }}>⚑</span>}
    </div>
  );
}

function LegendSwatch({ color, label }) {
  return (
    <div className="flex items-center gap-1.5" style={{ color: 'var(--color-text-mid)' }}>
      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      {label}
    </div>
  );
}

function fmt(v) {
  if (v == null) return '—';
  return `${(v * 100).toFixed(1)}%`;
}
