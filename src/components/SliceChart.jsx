import { useRef, useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, Cell } from 'recharts';

const FLAG_THRESHOLD  = 0.10;
const CHAR_WIDTH      = 7;    // px per monospace char at 11px
const Y_AXIS_MIN      = 72;
const Y_AXIS_MAX      = 180;
const BAR_ROW_HEIGHT  = 48;
const CHART_MIN_H     = 180;
const CHART_MIN_W     = 260;  // absolute floor so the chart stays legible

export default function SliceChart({ slices, columnName, binning }) {
  if (!slices?.length) return null;

  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const data = [...slices]
    .sort((a, b) => (b.count || 0) - (a.count || 0))
    .map((s) => ({
      ...s,
      group:      s.group == null ? '(missing)' : String(s.group),
      fprFlagged: s.fpr > FLAG_THRESHOLD,
      fnrFlagged: s.fnr > FLAG_THRESHOLD,
    }));

  const longestLabel = data.reduce((max, d) => Math.max(max, d.group.length), 0);
  const yAxisWidth   = Math.min(Y_AXIS_MAX, Math.max(Y_AXIS_MIN, longestLabel * CHAR_WIDTH + 12));
  const chartHeight  = Math.max(CHART_MIN_H, data.length * BAR_ROW_HEIGHT + 40);

  // On mobile containerWidth will be small — use it directly (no scroll needed).
  // On desktop use the container width but floor it at CHART_MIN_W so bars stay readable.
  const chartWidth = containerWidth
    ? Math.max(CHART_MIN_W, containerWidth)
    : null; // null = wait for first measure, render nothing to avoid flash

  return (
    <div ref={containerRef}>
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
        <LegendSwatch color="var(--color-on-surface)"        label="Approval rate" />
        <LegendSwatch color="var(--color-status-borderline)" label="False positive" />
        <LegendSwatch color="var(--color-status-unfair)"     label="False negative" />
      </div>

      {/* Chart — fills container width, no horizontal page scroll */}
      {chartWidth && (
        <BarChart
          width={chartWidth}
          height={chartHeight}
          data={data}
          layout="vertical"
          margin={{ top: 16, right: 16, bottom: 8, left: 4 }}
          barCategoryGap="24%"
          barGap={2}
        >
          <XAxis
            type="number"
            domain={[0, 1]}
            tickCount={5}
            tickFormatter={(v) => `${Math.round(v * 100)}%`}
            tick={{ fill: 'var(--color-text-mid)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
            axisLine={{ stroke: 'var(--color-border)' }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="group"
            width={yAxisWidth}
            tick={{ fill: 'var(--color-on-surface)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: 'var(--color-surface-container)' }}
          />
          <ReferenceLine
            x={FLAG_THRESHOLD}
            stroke="var(--color-status-unfair)"
            strokeDasharray="3 3"
            strokeWidth={1}
            label={{
              value: '10%',
              position: 'top',
              fill: 'var(--color-status-unfair)',
              fontSize: 9,
              fontFamily: 'var(--font-mono)',
            }}
          />
          <Bar dataKey="positive_rate" radius={[0, 3, 3, 0]} maxBarSize={12}>
            {data.map((d, i) => (
              <Cell key={i} fill="var(--color-on-surface)" fillOpacity={d.small_sample ? 0.4 : 0.9} />
            ))}
          </Bar>
          <Bar dataKey="fpr" radius={[0, 3, 3, 0]} maxBarSize={12}>
            {data.map((d, i) => (
              <Cell key={i} fill="var(--color-status-borderline)"
                fillOpacity={d.fprFlagged ? 1 : (d.small_sample ? 0.3 : 0.55)} />
            ))}
          </Bar>
          <Bar dataKey="fnr" radius={[0, 3, 3, 0]} maxBarSize={12}>
            {data.map((d, i) => (
              <Cell key={i} fill="var(--color-status-unfair)"
                fillOpacity={d.fnrFlagged ? 1 : (d.small_sample ? 0.3 : 0.55)} />
            ))}
          </Bar>
        </BarChart>
      )}

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
      <Row color="rgba(255,255,255,0.9)"           label="Approved" value={fmt(row?.positive_rate)} />
      <Row color="var(--color-status-borderline)"  label="False +"  value={fmt(row?.fpr)} flagged={row?.fprFlagged} />
      <Row color="var(--color-status-unfair)"      label="False −"  value={fmt(row?.fnr)} flagged={row?.fnrFlagged} />
      {row?.count != null && (
        <p className="mt-2 pt-2 border-t text-[11px]"
          style={{ color: 'rgba(255,255,255,0.55)', borderColor: 'rgba(255,255,255,0.15)' }}>
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
