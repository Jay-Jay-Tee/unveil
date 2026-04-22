import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

const FLOW = [
  { to: '/upload', label: '01 Upload' },
  { to: '/audit/dataset', label: '02 Dataset' },
  { to: '/audit/model', label: '03 Model' },
  { to: '/report', label: '04 Report' },
];

const TICKER_ITEMS = [
  'Disparate Impact · 80% Rule · SHAP Explainability · Counterfactual Probing · Proxy Detection · Slice Evaluation · Statistical Parity · Demographic Fairness · ',
  'Disparate Impact · 80% Rule · SHAP Explainability · Counterfactual Probing · Proxy Detection · Slice Evaluation · Statistical Parity · Demographic Fairness · ',
];

export default function Navbar() {
  const { pathname } = useLocation();
  const isHome = pathname === '/';
  const stepIndex = FLOW.findIndex(f => pathname.startsWith(f.to.split('/').slice(0,2).join('/')));

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50" style={{ background: 'var(--color-bg)', borderBottom: '1.5px solid var(--color-border)' }}>
        {/* Top row */}
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 h-14">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="relative w-7 h-7 flex-shrink-0">
              <div className="absolute inset-0 rounded-sm rotate-6 opacity-30" style={{ background: 'var(--color-amber)' }} />
              <div className="absolute inset-0 rounded-sm flex items-center justify-center text-xs font-black" style={{ background: 'var(--color-ink)', color: '#fff' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"/>
                  <path d="M8 12H16M12 8V16"/>
                </svg>
              </div>
            </div>
            <span className="text-base font-bold tracking-tight" style={{ fontFamily: 'var(--font-sans)', color: 'var(--color-ink)' }}>
              UnbiasedAI
            </span>
          </Link>

          {/* Center flow nav */}
          {!isHome && (
            <div className="hidden md:flex items-center gap-1">
              {FLOW.map((step, i) => {
                const active = pathname.includes(step.to.replace('/audit','').replace('/upload','upload').split('/')[1]) || pathname === step.to;
                const done = stepIndex > i;
                return (
                  <Link key={step.to} to={step.to}
                    className="relative px-3 py-1.5 text-xs font-semibold tracking-wide transition-all rounded-md"
                    style={{
                      color: active ? 'var(--color-ink)' : done ? 'var(--color-green)' : 'var(--color-ink-muted)',
                      background: active ? 'var(--color-amber-light)' : 'transparent',
                    }}>
                    {done && !active && <span className="mr-1">✓</span>}
                    {step.label}
                  </Link>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-3">
            {!isHome && (
              <Link to="/glossary" className="text-xs font-medium transition-colors hidden md:block" style={{ color: 'var(--color-ink-muted)' }}>
                Glossary
              </Link>
            )}
            <Link to="/upload"
              className="text-xs font-bold px-4 py-2 rounded-md transition-all hover:opacity-90"
              style={{ background: 'var(--color-ink)', color: '#fff' }}>
              Start Audit
            </Link>
          </div>
        </div>

        {/* Ticker */}
        {isHome && (
          <div className="overflow-hidden h-8 flex items-center" style={{ background: 'var(--color-ink)', borderTop: 'none' }}>
            <div className="animate-ticker flex whitespace-nowrap">
              {TICKER_ITEMS.map((t, i) => (
                <span key={i} className="text-[10px] font-medium tracking-widest uppercase mr-0" style={{ color: 'var(--color-amber)', fontFamily: 'var(--font-mono)' }}>
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Progress bar for flow pages */}
        {stepIndex >= 0 && (
          <div className="h-0.5 w-full" style={{ background: 'var(--color-bg-warm)' }}>
            <motion.div
              className="h-full"
              style={{ background: 'var(--color-amber)' }}
              initial={{ width: '0%' }}
              animate={{ width: `${((stepIndex + 1) / FLOW.length) * 100}%` }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        )}
      </nav>
    </>
  );
}
