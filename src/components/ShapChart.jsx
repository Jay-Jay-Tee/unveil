import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg px-4 py-3 shadow-xl max-w-xs text-xs"
      style={{ background: 'var(--color-ink)', color: 'rgba(255,255,255,0.9)', fontFamily: 'var(--font-sans)' }}>
      <p className="font-bold mb-1" style={{ fontFamily: 'var(--font-mono)' }}>{d.feature}</p>
      <p>Influence: <strong>{d.mean_abs_shap.toFixed(3)}</strong></p>
      {d.is_proxy && (
        <p className="mt-1.5 font-semibold" style={{ color: 'var(--color-ambiguous)' }}>
          ⚠ Proxy for: {d.proxy_for?.join(', ')}
        </p>
      )}
      {d.is_protected && (
        <p className="mt-1.5 font-semibold" style={{ color: '#FF8080' }}>Protected attribute</p>
      )}
    </div>
  );
}

export default function ShapChart({ shapSummary }) {
  if (!shapSummary?.length) return null;
  const data = [...shapSummary].sort((a, b) => b.mean_abs_shap - a.mean_abs_shap);
  const proxyCount = data.filter(d => d.is_proxy).length;

  return (
    <div className="rounded-xl border-2 p-6 card-shadow" style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}>
      <div className="flex items-center justify-between mb-1">
        <h4 className="text-sm font-bold" style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-mono)' }}>
          Feature Influence (SHAP Rankings)
        </h4>
        {proxyCount > 0 && (
          <span className="text-xs font-bold px-2.5 py-1 rounded-md" style={{ background: '#FFF4E6', color: 'var(--color-ambiguous)' }}>
            {proxyCount} proxy feature{proxyCount > 1 ? 's' : ''} ⚠
          </span>
        )}
      </div>
      <p className="text-xs mb-5" style={{ color: 'var(--color-ink-muted)' }}>
        Longer bar = more influence on decisions. Orange = proxy feature (indirect discrimination risk).
      </p>

      <div className="flex gap-4 mb-4">
        {[['var(--color-ink)', 'Regular Feature'], ['var(--color-ambiguous)', 'Proxy Feature'], ['var(--color-biased)', 'Protected Attribute']].map(([c, l]) => (
          <div key={l} className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--color-ink-muted)' }}>
            <span className="w-2 h-2 rounded-full" style={{ background: c }} />
            {l}
          </div>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={data.length * 38 + 20}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 20, bottom: 4, left: 10 }} barCategoryGap="25%">
          <XAxis type="number" domain={[0, 'auto']} tickCount={5}
            tick={{ fill: 'var(--color-ink-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
            axisLine={{ stroke: 'var(--color-border)' }} tickLine={false} />
          <YAxis type="category" dataKey="feature" width={120}
            tick={({ x, y, payload }) => {
              const item = data.find(d => d.feature === payload.value);
              return (
                <text x={x} y={y} dy={4} textAnchor="end"
                  fill={item?.is_proxy ? 'var(--color-ambiguous)' : item?.is_protected ? 'var(--color-biased)' : 'var(--color-ink-mid)'}
                  fontSize={11} fontFamily="var(--font-mono)" fontWeight={item?.is_proxy || item?.is_protected ? 600 : 400}>
                  {payload.value}
                </text>
              );
            }}
            axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--color-bg-warm)' }} />
          <Bar dataKey="mean_abs_shap" radius={[0, 4, 4, 0]} maxBarSize={16}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.is_proxy ? 'var(--color-ambiguous)' : entry.is_protected ? 'var(--color-biased)' : 'var(--color-ink)'} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
