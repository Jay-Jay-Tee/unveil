import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

const COLOR_NORMAL = '#4D9EFF';
const COLOR_PROXY = '#FF4040';

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;

  const d = payload[0].payload;

  return (
    <div className="rounded-lg border border-border-subtle bg-[#1A1C23] px-4 py-3 shadow-xl">
      <p className="mb-1 text-xs font-semibold text-white">{d.feature}</p>
      <div className="flex items-center gap-2 text-xs">
        <span className="text-gray-400">SHAP Importance:</span>
        <span className="font-[family-name:var(--font-mono)] font-semibold text-white">
          {d.mean_abs_shap.toFixed(3)}
        </span>
      </div>
      {d.is_proxy && (
        <div className="mt-2 border-t border-white/5 pt-2">
          <span className="text-[10px] font-semibold text-biased">PROXY FEATURE</span>
          <p className="text-[10px] text-gray-400">
            Acts as proxy for:{' '}
            <span className="font-semibold text-biased">
              {d.proxy_for.join(', ')}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}

export default function ShapChart({ shapSummary }) {
  if (!shapSummary?.length) return null;

  // Sort descending by importance
  const data = [...shapSummary].sort((a, b) => b.mean_abs_shap - a.mean_abs_shap);

  const proxyCount = data.filter((d) => d.is_proxy).length;

  return (
    <div className="rounded-xl border border-border-subtle bg-bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="font-[family-name:var(--font-mono)] text-sm font-semibold text-white">
          SHAP Feature Importance
        </h4>
        {proxyCount > 0 && (
          <span className="text-[11px] font-semibold text-biased">
            {proxyCount} proxy feature{proxyCount > 1 ? 's' : ''} detected
          </span>
        )}
      </div>

      {/* Legend */}
      <div className="flex gap-5 mb-3">
        <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: COLOR_NORMAL }} />
          Direct Feature
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: COLOR_PROXY }} />
          Proxy Feature
        </div>
      </div>

      <ResponsiveContainer width="100%" height={data.length * 40 + 20}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 20, bottom: 4, left: 10 }}
          barCategoryGap="25%"
        >
          <XAxis
            type="number"
            domain={[0, 'auto']}
            tickCount={5}
            tick={{ fill: '#6B7280', fontSize: 10, fontFamily: 'var(--font-mono)' }}
            axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="feature"
            width={120}
            tick={({ x, y, payload }) => {
              const item = data.find((d) => d.feature === payload.value);
              return (
                <text
                  x={x}
                  y={y}
                  dy={4}
                  textAnchor="end"
                  fill={item?.is_proxy ? COLOR_PROXY : '#9CA3AF'}
                  fontSize={11}
                  fontFamily="var(--font-mono)"
                  fontWeight={item?.is_proxy ? 600 : 400}
                >
                  {payload.value}
                </text>
              );
            }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: 'rgba(255,255,255,0.03)' }}
          />

          <Bar dataKey="mean_abs_shap" radius={[0, 4, 4, 0]} maxBarSize={18}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.is_proxy ? COLOR_PROXY : COLOR_NORMAL}
                fillOpacity={entry.is_proxy ? 1 : 0.8}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}