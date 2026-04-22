import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAudit } from '../lib/AuditContext';

const TICKER_ITEMS = 'Disparate Impact · 80% Rule · SHAP Explainability · Counterfactual Probing · Proxy Detection · Slice Evaluation · Statistical Parity · Demographic Fairness · ';

export default function Navbar() {
  const { pathname } = useLocation();
  const { auditMode, biasReport, modelBiasReport } = useAudit();
  const isHome = pathname === '/';

  // Dynamic breadcrumb based on what was uploaded
  const crumbs = [];
  if (pathname !== '/') {
    crumbs.push({ to: '/upload', label: 'Upload' });
    if (biasReport && pathname !== '/upload') crumbs.push({ to: '/audit/dataset', label: 'Dataset' });
    if (modelBiasReport && pathname !== '/upload') crumbs.push({ to: '/audit/model', label: 'Model' });
    if (pathname === '/report') crumbs.push({ to: '/report', label: 'Report' });
  }

  // progress: how far through the current audit flow
  const FLOW = ['/upload', '/audit/dataset', '/audit/model', '/report', '/glossary'];
  const stepIdx = FLOW.indexOf(pathname);
  const maxStep = auditMode === 'dataset' ? 3 : auditMode === 'both' ? 4 : FLOW.length - 1;
  const progress = stepIdx >= 0 ? Math.min((stepIdx / Math.max(maxStep, 1)) * 100, 100) : 0;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50" style={{ background: 'var(--color-bg)', borderBottom: '1.5px solid var(--color-border)' }}>
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 h-14">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group flex-shrink-0">
          <div className="relative w-7 h-7 flex-shrink-0">
            <div className="absolute inset-0 rounded-sm rotate-6 opacity-30" style={{ background: 'var(--color-amber)' }} />
            <div className="absolute inset-0 rounded-sm flex items-center justify-center" style={{ background: 'var(--color-ink)' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10"/><path d="M8 12H16M12 8V16"/>
              </svg>
            </div>
          </div>
          <span className="text-base font-bold tracking-tight" style={{ fontFamily: 'var(--font-sans)', color: 'var(--color-ink)' }}>
            UnbiasedAI
          </span>
        </Link>

        {/* Breadcrumbs */}
        {!isHome && crumbs.length > 0 && (
          <div className="hidden md:flex items-center gap-1.5 text-xs">
            {crumbs.map((c, i) => (
              <span key={c.to} className="flex items-center gap-1.5">
                {i > 0 && <span style={{ color: 'var(--color-ink-faint)' }}>›</span>}
                <Link to={c.to} className="font-semibold transition-colors hover:opacity-70"
                  style={{ color: pathname === c.to ? 'var(--color-ink)' : 'var(--color-ink-muted)' }}>
                  {c.label}
                </Link>
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3">
          <Link to="/glossary" className="text-xs font-medium transition-colors hidden md:block hover:opacity-70" style={{ color: 'var(--color-ink-muted)' }}>
            Glossary
          </Link>
          <Link to="/upload"
            className="text-xs font-bold px-4 py-2 rounded-md transition-all hover:opacity-90"
            style={{ background: 'var(--color-ink)', color: '#fff' }}>
            {isHome ? 'Start Audit' : '↺ New Audit'}
          </Link>
        </div>
      </div>

      {/* Ticker on home */}
      {isHome && (
        <div className="overflow-hidden h-7 flex items-center" style={{ background: 'var(--color-ink)' }}>
          <div className="animate-ticker flex whitespace-nowrap">
            {[TICKER_ITEMS, TICKER_ITEMS].map((t, i) => (
              <span key={i} className="text-[10px] font-medium tracking-widest uppercase" style={{ color: 'var(--color-amber)', fontFamily: 'var(--font-mono)' }}>
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Progress bar for audit flow */}
      {!isHome && stepIdx >= 0 && (
        <div className="h-0.5 w-full" style={{ background: 'var(--color-bg-warm)' }}>
          <motion.div className="h-full" style={{ background: 'var(--color-amber)' }}
            initial={{ width: '0%' }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} />
        </div>
      )}
    </nav>
  );
}
