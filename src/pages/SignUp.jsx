import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { signUp, isFirebaseConfigured } from '../lib/auth';
import { useAudit } from '../lib/AuditContext';

export default function SignUp() {
  const navigate = useNavigate();
  const { setUser } = useAudit();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e?.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setBusy(true);
    try {
      const user = await signUp({
        email: email.trim(),
        password,
        displayName: displayName.trim() || null,
      });
      setUser(user);
      navigate('/upload');
    } catch (err) {
      setError(friendlySignupError(err));
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
            Free · No card required
          </p>
          <h1 className="text-display-md" style={{ color: 'var(--color-on-surface)' }}>
            Create an Unveil account
          </h1>
          <p className="text-sm mt-2 max-w-xs mx-auto" style={{ color: 'var(--color-text-mid)' }}>
            Save audits, revisit reports, and build an audit history for any dataset or model.
          </p>
        </div>

        <div className="rounded-2xl border p-6 card-shadow"
          style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="name" className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--color-text-mid)' }}>
                Display name <span className="opacity-50">(optional)</span>
              </label>
              <input
                id="name" type="text" autoFocus
                value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                disabled={busy}
                placeholder="Jane Smith"
                className="input"
              />
            </div>

            <div>
              <label htmlFor="email" className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--color-text-mid)' }}>
                Email
              </label>
              <input
                id="email" type="email" required
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
                id="password" type="password" required minLength={6}
                value={password} onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
                placeholder="At least 6 characters"
                className="input"
              />
            </div>

            {error && (
              <div className="text-sm px-3 py-2.5 rounded-lg"
                style={{ color: 'var(--color-status-unfair)', background: 'var(--color-status-unfair-bg)' }}>
                {error}
              </div>
            )}

            {!isFirebaseConfigured() && (
              <div className="text-xs px-3 py-2 rounded-lg"
                style={{ color: 'var(--color-accent-dark)', background: 'var(--color-accent-light)' }}>
                Running without Firebase — your account lives on this device only.
              </div>
            )}

            <button type="submit" disabled={busy} className="btn btn-primary justify-center">
              {busy ? <><span className="unveil-spinner" /> Creating account…</> : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-sm text-center mt-6" style={{ color: 'var(--color-text-mid)' }}>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold underline" style={{ color: 'var(--color-on-surface)' }}>
            Sign in
          </Link>
        </p>
      </div>
    </motion.div>
  );
}

function friendlySignupError(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  if (msg.includes('email-already-in-use')) return 'That email is already registered — try signing in instead.';
  if (msg.includes('weak-password')) return 'That password is too weak. Use at least 6 characters.';
  if (msg.includes('invalid-email')) return 'That email address looks invalid.';
  if (msg.includes('network')) return 'Network issue — check your connection.';
  return err?.message || 'Sign-up failed.';
}
