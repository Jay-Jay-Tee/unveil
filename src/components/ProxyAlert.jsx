export default function ProxyAlert({ proxies }) {
  if (!proxies || proxies.length === 0) return null;

  return (
    <div className="mt-3 flex items-start gap-2 rounded-lg border border-ambiguous/20 bg-ambiguous/5 px-3 py-2">
      <svg
        className="mt-0.5 h-4 w-4 shrink-0 text-ambiguous"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
        />
      </svg>
      <div>
        <span className="text-[11px] font-semibold text-ambiguous">PROXY WARNING</span>
        <p className="text-[11px] text-gray-400 leading-relaxed">
          Correlated with{' '}
          {proxies.map((p, i) => (
            <span key={p}>
              <span className="font-semibold text-ambiguous">{p}</span>
              {i < proxies.length - 1 && ', '}
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}
