import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAudit } from '../lib/AuditContext';
import { generateGeminiReport } from '../lib/api';
import { VERDICT } from '../lib/terminology';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] } }),
};

// ── Markdown renderer (unchanged from before, small polish) ───────────────

function MarkdownBlock({ text }) {
  if (!text) return null;
  const lines = text.split('\n');
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) { i++; continue; }

    if (/^##+\s/.test(trimmed)) {
      elements.push(
        <h3 key={i} className="text-label-mono mt-6 mb-2 first:mt-0"
          style={{ color: 'var(--color-text-mid)' }}>
          {trimmed.replace(/^##+\s+/, '')}
        </h3>
      );
      i++; continue;
    }

    if (/^\d+\.\s/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s/, ''));
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} className="list-decimal list-inside space-y-1.5 my-2 pl-1">
          {items.map((item, j) => (
            <li key={j} className="text-sm leading-relaxed" style={{ color: 'var(--color-text-mid)' }}>
              <Inline text={item} />
            </li>
          ))}
        </ol>
      );
      continue;
    }

    if (/^[*\-•]\s/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^[*\-•]\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[*\-•]\s/, ''));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="space-y-2 my-2 pl-1">
          {items.map((item, j) => (
            <li key={j} className="flex items-start gap-2.5 text-sm leading-relaxed" style={{ color: 'var(--color-text-mid)' }}>
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--color-accent)' }} />
              <span className="flex-1"><Inline text={item} /></span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Paragraph
    const paraLines = [];
    while (i < lines.length && lines[i].trim()) {
      paraLines.push(lines[i]);
      i++;
    }
    elements.push(
      <p key={`p-${i}`} className="text-sm leading-relaxed my-3" style={{ color: 'var(--color-text-mid)' }}>
        <Inline text={paraLines.join(' ')} />
      </p>
    );
  }
  return <>{elements}</>;
}

function Inline({ text }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return (
    <>{parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**'))
        return <strong key={i} style={{ color: 'var(--color-on-surface)', fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
      if (part.startsWith('*') && part.endsWith('*'))
        return <em key={i}>{part.slice(1, -1)}</em>;
      if (part.startsWith('`') && part.endsWith('`'))
        return <code key={i} className="text-xs px-1 py-0.5 rounded"
          style={{ background: 'var(--color-surface-container)', fontFamily: 'var(--font-mono)' }}>{part.slice(1, -1)}</code>;
      return part;
    })}</>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────

export default function Report() {
  const navigate = useNavigate();
  const audit = useAudit();
  const [status, setStatus] = useState('idle');
  const [reportText, setReportText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [retryIn, setRetryIn] = useState(0);

  const hasData = audit.biasReport || audit.modelBiasReport;
  const colResults = audit.biasReport?.column_results || [];
  const attrResults = audit.modelBiasReport?.attribute_results || [];
  const unfairCols = colResults.filter((c) => c.verdict === 'BIASED').length;
  const unfairAttrs = attrResults.filter((a) => a.verdict === 'BIASED').length;

  useEffect(() => {
    if (hasData && status === 'idle') generate(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Countdown for rate-limit retry
  useEffect(() => {
    if (retryIn <= 0) return;
    const t = setTimeout(() => setRetryIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [retryIn]);

  async function generate(forceRefresh = false) {
    setStatus('generating');
    setReportText('');
    setErrorMsg('');
    setRetryIn(0);
    try {
      const text = await generateGeminiReport(audit.biasReport || {}, audit.modelBiasReport || {}, { forceRefresh });
      setReportText(text);
      setStatus('done');
    } catch (err) {
      const msg = err?.message || String(err);
      setErrorMsg(msg);
      // Parse retry hint from the backend's message
      const match = msg.match(/retry in about (\d+)\s*seconds?/i);
      if (match) setRetryIn(parseInt(match[1], 10));
      setStatus('error');
    }
  }

  if (!hasData) {
    return (
      <div className="min-h-screen pt-32 flex flex-col items-center gap-5 text-center px-3 sm:px-5">
        <p style={{ color: 'var(--color-text-mid)' }}>No analysis data. Run a dataset audit first.</p>
        <button onClick={() => navigate('/upload')} className="btn btn-primary">
          ← Upload a dataset
        </button>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen pt-20 pb-20 px-3 sm:px-5">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="py-10 border-b mb-8" style={{ borderColor: 'var(--color-border)' }}>
          <p className="text-label-mono mb-2" style={{ color: 'var(--color-text-mid)' }}>
            Step 04 · Compliance report
          </p>
          <h1 className="text-display-md mb-2" style={{ color: 'var(--color-on-surface)' }}>
            Plain-English audit narrative
          </h1>
          <p className="text-base max-w-lg" style={{ color: 'var(--color-text-mid)' }}>
            A non-technical summary of everything Unveil found. Ready to share with compliance, legal, or product.
          </p>
        </div>

        {/* Summary cards */}
        {(colResults.length > 0 || attrResults.length > 0) && (
          <motion.div initial="hidden" animate="visible" className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {[
              { label: 'Columns checked', value: colResults.length, color: 'var(--color-on-surface)', bg: 'var(--color-surface-container)' },
              { label: 'Unfair columns', value: unfairCols, color: unfairCols > 0 ? 'var(--color-status-unfair)' : 'var(--color-text-mid)', bg: unfairCols > 0 ? 'var(--color-status-unfair-bg)' : 'var(--color-surface-container)' },
              { label: 'Model attributes', value: attrResults.length, color: 'var(--color-on-surface)', bg: 'var(--color-surface-container)' },
              { label: 'Unfair attributes', value: unfairAttrs, color: unfairAttrs > 0 ? 'var(--color-status-unfair)' : 'var(--color-status-fair)', bg: unfairAttrs > 0 ? 'var(--color-status-unfair-bg)' : 'var(--color-status-fair-bg)' },
            ].map((s, i) => (
              <motion.div key={s.label} variants={fadeUp} custom={i} className="rounded-xl p-4 text-center" style={{ background: s.bg }}>
                <div className="text-2xl font-bold text-metric" style={{ color: s.color }}>{s.value}</div>
                <div className="text-[10px] font-bold uppercase tracking-wider mt-1" style={{ color: s.color, opacity: 0.75 }}>
                  {s.label}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Dataset findings quick-list */}
        {colResults.length > 0 && (
          <motion.div initial="hidden" animate="visible" variants={fadeUp}
            className="mb-6 rounded-2xl border p-5 card-shadow"
            style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}>
            <h3 className="text-sm font-bold mb-3">Quick scan</h3>
            <div className="flex flex-wrap gap-1.5">
              {colResults.map((col) => {
                const v = VERDICT[col.verdict];
                const cls = {
                  BIASED: 'status-pill-unfair',
                  AMBIGUOUS: 'status-pill-borderline',
                  CLEAN: 'status-pill-fair',
                }[col.verdict] || 'status-pill-skipped';
                return (
                  <span key={col.name} className={`status-pill ${cls}`}>
                    <span className="font-mono text-[10px] opacity-80">{col.name}</span>
                    <span className="opacity-60">·</span>
                    <span>{v?.shortLabel || '—'}</span>
                    {col.disparate_impact != null && (
                      <span className="opacity-60 font-mono">{col.disparate_impact.toFixed(2)}</span>
                    )}
                  </span>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Generating / error states */}
        <AnimatePresence>
          {status === 'generating' && (
            <motion.div key="gen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex items-center gap-3 px-5 py-4 rounded-xl mb-6"
              style={{ background: 'var(--color-accent-light)', color: 'var(--color-accent-dark)' }}>
              <span className="unveil-spinner" />
              <div>
                <p className="text-sm font-semibold">Writing your compliance narrative…</p>
                <p className="text-xs mt-0.5 opacity-80">
                  Unveil generates the report in 4 sections so a single rate-limit won't kill the whole thing.
                </p>
              </div>
            </motion.div>
          )}

          {status === 'error' && (
            <motion.div key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="px-5 py-4 rounded-xl mb-6 border"
              style={{ background: 'var(--color-status-unfair-bg)', borderColor: 'var(--color-status-unfair-border)' }}>
              <p className="text-sm font-bold mb-1" style={{ color: 'var(--color-status-unfair)' }}>
                Report generation hit a snag
              </p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-mid)' }}>{errorMsg}</p>
              <button onClick={() => generate(false)}
                disabled={retryIn > 0}
                className="btn btn-danger text-sm mt-3"
                style={retryIn > 0 ? { opacity: 0.5, cursor: 'not-allowed' } : {}}>
                {retryIn > 0 ? `Retry in ${retryIn}s` : 'Try again'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* The report itself */}
        {status === 'done' && reportText && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl overflow-hidden card-shadow-lg"
            style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}>

            {/* Header bar */}
            <div className="flex items-center gap-3 px-6 py-4" style={{ background: 'var(--color-bg-ink)' }}>
              <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: 'var(--color-accent)' }}>
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--color-bg-ink)' }}>
                  <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold" style={{ color: '#fff' }}>Compliance narrative</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>Written by Gemini · ready to share</p>
              </div>
              <button onClick={() => generate(true)}
                className="text-xs font-semibold px-3 py-1.5 rounded-md transition-opacity hover:opacity-80"
                style={{ color: 'rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.08)' }}>
                ↺ Regenerate
              </button>
            </div>

            <div className="px-7 py-7">
              <MarkdownBlock text={reportText} />
            </div>
          </motion.div>
        )}

        {/* Nav */}
        <div className="mt-8 flex flex-wrap gap-3">
          <button onClick={() => navigate('/audit/dataset')} className="btn btn-ghost">
            ← Back to audit
          </button>
          <button onClick={() => navigate('/upload')} className="btn btn-secondary">
            ↺ New audit
          </button>
        </div>
      </div>
    </motion.div>
  );
}
