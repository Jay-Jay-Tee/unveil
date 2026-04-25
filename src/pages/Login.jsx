import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { signIn, isFirebaseConfigured } from '../lib/auth';
import { useAudit } from '../lib/AuditContext';

export default function Login() {
  const navigate = useNavigate();
  const { setUser } = useAudit();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e?.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user = await signIn({ email: email.trim(), password });
      setUser(user);
      navigate('/dashboard');
    } catch (err) {
      setError(friendlyAuthError(err));
      setBusy(false);
    }
  }

  async function handleGuestContinue() {
    setBusy(true);
    try {
      // In non-Firebase mode, signIn just returns the local guest
      const user = await signIn({ email: '', password: '' });
      setUser(user);
      navigate('/upload');
    } catch {
      setBusy(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="min-h-screen pt-24 pb-20 px-6 flex flex-col items-center"
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="text-label-mono mb-2" style={{ color: 'var(--color-text-mid)' }}>
            Welcome back
          </p>
          <h1 className="text-display-md" style={{ color: 'var(--color-on-surface)' }}>
            Sign in to Unveil
          </h1>
        </div>

        <div className="rounded-2xl border p-6 card-shadow"
          style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="email" className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--color-text-mid)' }}>
                Email
              </label>
              <input
                id="email" type="email" required autoFocus
                value={email} onChange={(e) => setEmail(e.target.value)}
                disabled={busy}
                placeholder="you@example.com"
                className="input"
              />
            </div>

            <div>
              <label htmlFor="password" className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--color-text-mid)' }}>
                Password
              </label>
              <input
                id="password" type="password" required
                value={password} onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
                placeholder="••••••••"
                className="input"
              />
            </div>

            {error && (
              <div className="text-sm px-3 py-2.5 rounded-lg"
                style={{ color: 'var(--color-status-unfair)', background: 'var(--color-status-unfair-bg)' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={busy} className="btn btn-primary justify-center">
              {busy ? <><span className="unveil-spinner" /> Signing in…</> : 'Sign in'}
            </button>
          </form>

          {!isFirebaseConfigured() && (
            <>
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
                <span className="text-xs" style={{ color: 'var(--color-text-mid)' }}>or</span>
                <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
              </div>

              <button
                onClick={handleGuestContinue}
                disabled={busy}
                className="btn btn-secondary w-full justify-center"
              >
                Continue as guest
              </button>
              <p className="text-xs text-center mt-2" style={{ color: 'var(--color-text-mid)' }}>
                Audits stored locally on this device only.
              </p>
            </>
          )}
        </div>

        <p className="text-sm text-center mt-6" style={{ color: 'var(--color-text-mid)' }}>
          New to Unveil?{' '}
          <Link to="/signup" className="font-semibold underline" style={{ color: 'var(--color-on-surface)' }}>
            Create an account
          </Link>
        </p>
      </div>
    </motion.div>
  );
}

function friendlyAuthError(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  if (msg.includes('user-not-found') || msg.includes('wrong-password') || msg.includes('invalid-credential')) {
    return 'Wrong email or password.';
  }
  if (msg.includes('too-many-requests')) return 'Too many attempts — wait a minute and try again.';
  if (msg.includes('network')) return 'Network issue — check your connection.';
  return err?.message || 'Sign-in failed.';
}
