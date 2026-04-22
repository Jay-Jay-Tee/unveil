export default function LoadingAnimation({ text = 'Loading…' }) {
  return (
    <div className="flex items-center gap-3 px-5 py-4 rounded-xl border-2"
      style={{ borderColor: 'var(--color-amber)', background: 'var(--color-amber-light)' }}>
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="var(--color-amber)" strokeWidth="3" opacity="0.3"/>
        <path fill="var(--color-amber-dark)" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z">
          <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/>
        </path>
      </svg>
      <span className="text-sm font-semibold" style={{ color: 'var(--color-amber-dark)', fontFamily: 'var(--font-mono)' }}>{text}</span>
    </div>
  );
}
