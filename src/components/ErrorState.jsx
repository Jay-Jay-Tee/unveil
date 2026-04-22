export default function ErrorState({ message }) {
  return (
    <div className="flex items-center justify-center py-12 px-6">
      <div className="rounded-xl border-2 px-6 py-5 max-w-sm"
        style={{ borderColor: 'var(--color-biased)', background: 'var(--color-red-light)' }}>
        <p className="text-sm font-bold" style={{ color: 'var(--color-biased)' }}>Error</p>
        {message && <p className="text-sm mt-1" style={{ color: 'var(--color-ink-mid)' }}>{message}</p>}
      </div>
    </div>
  );
}
