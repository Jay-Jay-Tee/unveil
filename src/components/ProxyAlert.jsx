export default function ProxyAlert({ proxies = [] }) {
  if (!proxies.length) return null;
  return (
    <div className="mt-3 flex items-start gap-2 px-3 py-2 rounded-lg" style={{ background: '#FFF4E6' }}>
      <span className="text-sm mt-px">⚠</span>
      <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-ambiguous)' }}>
        <span className="font-bold">Proxy for:</span> {proxies.join(', ')}
      </p>
    </div>
  );
}
