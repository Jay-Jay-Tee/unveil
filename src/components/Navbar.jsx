import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAudit } from '../lib/AuditContext';
import { signOutUser } from '../lib/auth';

export default function Navbar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, setUser } = useAudit();
  const [menuOpen, setMenuOpen] = useState(false);

  // On home, the Landing page provides its own navbar
  if (pathname === '/') return null;

  async function handleSignOut() {
    await signOutUser();
    setUser(null);
    setMenuOpen(false);
    navigate('/');
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 backdrop-blur-sm border-b"
      style={{ background: 'rgba(251, 246, 238, 0.85)', borderColor: 'var(--color-border)' }}>
      <div className="flex justify-between items-center px-6 py-3.5 max-w-6xl mx-auto w-full">

        {/* Brand */}
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-7 h-7 rounded-md flex items-center justify-center"
            style={{ background: 'var(--color-bg-ink)' }}>
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: '#fff' }}>
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </div>
          <span className="text-lg font-bold tracking-tight" style={{ fontFamily: 'var(--font-sans)' }}>
            Unveil
          </span>
        </Link>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Link to="/glossary" className="btn btn-ghost text-sm">
            Glossary
          </Link>

          {user ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors hover:bg-[var(--color-surface-container)]"
              >
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: 'var(--color-bg-ink)', color: '#fff' }}>
                  {(user.displayName || user.email || '?')[0].toUpperCase()}
                </div>
                <span className="text-sm font-medium hidden sm:inline">
                  {user.displayName || user.email?.split('@')[0] || 'Guest'}
                </span>
                <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 5l3 3 3-3" />
                </svg>
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border overflow-hidden card-shadow-lg z-20"
                    style={{ background: 'var(--color-surface-container-lowest)', borderColor: 'var(--color-border)' }}>
                    <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
                      <p className="text-xs font-semibold" style={{ color: 'var(--color-text-mid)' }}>Signed in as</p>
                      <p className="text-sm font-bold truncate">{user.email || user.displayName || 'Guest'}</p>
                      {user.isGuest && (
                        <p className="text-xs mt-1" style={{ color: 'var(--color-accent-dark)' }}>
                          Local device only — sign up to sync
                        </p>
                      )}
                    </div>
                    <Link
                      to="/dashboard"
                      onClick={() => setMenuOpen(false)}
                      className="block px-4 py-2.5 text-sm hover:bg-[var(--color-surface-container)]"
                    >
                      My audits
                    </Link>
                    <Link
                      to="/upload"
                      onClick={() => setMenuOpen(false)}
                      className="block px-4 py-2.5 text-sm hover:bg-[var(--color-surface-container)]"
                    >
                      New audit
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="block w-full text-left px-4 py-2.5 text-sm border-t hover:bg-[var(--color-surface-container)]"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-status-unfair)' }}
                    >
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost text-sm">Sign in</Link>
              <Link to="/signup" className="btn btn-primary text-sm">Get started</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
