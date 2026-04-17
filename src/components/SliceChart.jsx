import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';

const FLAG_THRESHOLD = 0.10;

const METRIC_COLORS = {
  positive_rate: '#4D9EFF',
  fpr: '#F5A623',
  fnr: '#FF4040',
};

const METRIC_LABELS = {
  positive_rate: 'Positive Rate',
  fpr: 'False Positive Rate',
  fnr: 'False Negative Rate',
};

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-border-subtle bg-[#1A1C23] px-4 py-3 shadow-xl">
      <p className="mb-2 text-xs font-semibold text-white">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-xs">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-gray-400">{METRIC_LABELS[entry.dataKey]}:</span>
          <span className="font-[family-name:var(--font-mono)] font-semibold text-white">
            {entry.value.toFixed(3)}
          </span>
          {entry.dataKey !== 'positive_rate' && entry.value > FLAG_THRESHOLD && (
            <span className="text-[10px] font-semibold text-biased">FLAGGED</span>
          )}
        </div>
      ))}
      {/* Count if present */}
      {payload[0]?.payload?.count != null && (
        <p className="mt-2 border-t border-white/5 pt-2 text-[10px] text-gray-500">
          n = {payload[0].payload.count.toLocaleString()}
        </p>
      )}
    </div>
  );
}

function renderLegend() {
  return (
    <div className="flex justify-center gap-5 mt-2 mb-1">
      {Object.entries(METRIC_LABELS).map(([key, label]) => (
        <div key={key} className="flex items-center gap-1.5 text-[11px] text-gray-400">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: METRIC_COLORS[key] }}
          />
          {label}
        </div>
      ))}
    </div>
  );
}

export default function SliceChart({ slices, columnName }) {
  if (!slices?.length) return null;

  // Flag bars that exceed threshold for pulsing effect
  const data = slices.map((s) => ({
    ...s,
    fprFlagged: s.fpr > FLAG_THRESHOLD,
    fnrFlagged: s.fnr > FLAG_THRESHOLD,
  }));

  return (
    <div className="rounded-xl border border-border-subtle bg-bg-card p-5">
      {columnName && (
        <h4 className="mb-4 font-[family-name:var(--font-mono)] text-sm font-semibold text-white">
          {columnName}
          <span className="ml-2 text-xs font-normal text-gray-500">Slice Evaluation</span>
        </h4>
      )}

      {renderLegend()}

      <ResponsiveContainer width="100%" height={slices.length * 64 + 40}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 20, bottom: 8, left: 10 }}
          barCategoryGap="20%"
          barGap={2}
        >
          <XAxis
            type="number"
            domain={[0, 1]}
            tickCount={6}
            tick={{ fill: '#6B7280', fontSize: 10, fontFamily: 'var(--font-mono)' }}
            axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="group"
            width={120}
            tick={{ fill: '#9CA3AF', fontSize: 11, fontFamily: 'var(--font-mono)' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: 'rgba(255,255,255,0.03)' }}
            position={{ x: 0 }}
            allowEscapeViewBox={{ x: false, y: false }}
            wrapperStyle={{ zIndex: 10 }}
          />

          {/* Dashed reference line at flag threshold */}
          <ReferenceLine
            x={FLAG_THRESHOLD}
            stroke="#FF4040"
            strokeDasharray="4 3"
            strokeWidth={1}
            label={{
              value: 'Flag 0.10',
              position: 'top',
              fill: '#FF4040',
              fontSize: 9,
              fontFamily: 'var(--font-mono)',
            }}
          />

          <Bar dataKey="positive_rate" radius={[0, 3, 3, 0]} maxBarSize={14}>
            {data.map((entry, i) => (
              <Cell key={i} fill={METRIC_COLORS.positive_rate} />
            ))}
          </Bar>

          <Bar dataKey="fpr" radius={[0, 3, 3, 0]} maxBarSize={14}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={METRIC_COLORS.fpr}
                fillOpacity={entry.fprFlagged ? 1 : 0.6}
              />
            ))}
          </Bar>

          <Bar dataKey="fnr" radius={[0, 3, 3, 0]} maxBarSize={14}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={METRIC_COLORS.fnr}
                fillOpacity={entry.fnrFlagged ? 1 : 0.6}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
