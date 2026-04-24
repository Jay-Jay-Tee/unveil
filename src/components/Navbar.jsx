import { Link, useLocation } from 'react-router-dom';
import { useAudit } from '../lib/AuditContext';

export default function Navbar() {
  const { pathname } = useLocation();
  const isHome = pathname === '/';

  // On home page, use custom navbar from Landing page
  if (isHome) return null;

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 border-b" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-outline-variant)' }}>
      <div className="flex justify-between items-center px-6 py-4 max-w-6xl mx-auto w-full">
        {/* Logo */}
        <Link to="/" className="text-xl font-bold" style={{ fontFamily: 'var(--font-sans)' }}>
          UnbiasedAI
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <Link to="/glossary" className="text-sm font-bold px-4 py-2 rounded-lg text-white transition-colors hover:opacity-90" style={{ background: 'var(--color-bg-ink)' }}>
            Glossary
          </Link>
          <Link to="/" className="text-sm font-bold px-4 py-2 rounded-lg text-white transition-colors hover:opacity-90" style={{ background: 'var(--color-bg-ink)' }}>
            Home
          </Link>
        </div>
      </div>
    </nav>
  );
}
