export default function ProxyAlert({ proxies = [] }) {
  if (!proxies.length) return null;
  return (
    <div className="mt-3 flex items-start gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--color-accent-light)' }}>
      <p className="text-xs leading-relaxed" style={{ color: 'var(--color-on-surface)' }}>
        <span className="font-bold">Proxy for:</span> {proxies.join(', ')}
      </p>
    </div>
  );
}
