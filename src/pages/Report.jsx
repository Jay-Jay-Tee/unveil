import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAudit } from '../lib/AuditContext';
import { generateGeminiReport } from '../lib/api';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] } }),
};

function parseReportSections(text) {
  const lines = text.split('\n');
  const sections = [];
  let current = { heading: '', body: '' };
  for (const line of lines) {
    if (/^(\d+\.\s+[A-Z ]+)$/.test(line.trim())) {
      if (current.body.trim()) sections.push(current);
      current = { heading: line.trim(), body: '' };
    } else {
      current.body += line + '\n';
    }
  }
  if (current.body.trim() || current.heading) sections.push(current);
  return sections.length ? sections : [{ heading: '', body: text }];
}

const VERDICT_EMOJI = { BIASED: '🔴', AMBIGUOUS: '🟡', CLEAN: '🟢' };
const VERDICT_COLOR = { BIASED: 'var(--color-biased)', AMBIGUOUS: 'var(--color-ambiguous)', CLEAN: 'var(--color-green)' };

export default function Report() {
  const navigate = useNavigate();
  const audit = useAudit();
  const [status, setStatus] = useState('idle');
  const [reportText, setReportText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const hasData = audit.biasReport || audit.modelBiasReport;

  useEffect(() => {
    if (hasData && status === 'idle') generate();
  }, []);

  async function generate() {
    setStatus('generating');
    setReportText('');
    try {
      const text = await generateGeminiReport(audit.biasReport || {}, audit.modelBiasReport || {});
      setReportText(text);
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message || 'Gemini report generation failed.');
    }
  }

  // Summary numbers from data
  const colResults = audit.biasReport?.column_results || [];
  const attrResults = audit.modelBiasReport?.attribute_results || [];
  const biasedCols = colResults.filter(c => c.verdict === 'BIASED').length;
  const biasedAttrs = attrResults.filter(a => a.verdict === 'BIASED').length;

  if (!hasData) {
    return (
      <div className="min-h-screen pt-32 flex flex-col items-center gap-6 text-center px-6">
        <p style={{ color: 'var(--color-ink-muted)' }}>No analysis data. Run a dataset audit first.</p>
        <button onClick={() => navigate('/upload')}
          className="px-6 py-3 text-sm font-bold rounded-lg" style={{ background: 'var(--color-ink)', color: '#fff' }}>
          ← Upload a Dataset
        </button>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen pt-20 pb-20 px-6">
      <div className="mx-auto max-w-4xl">

        {/* Header */}
        <div className="py-12 border-b-2 mb-10" style={{ borderColor: 'var(--color-border)' }}>
          <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--color-ink-muted)', fontFamily: 'var(--font-mono)' }}>Step 04</p>
          <h1 className="text-5xl md:text-6xl font-black tracking-tight leading-tight mb-4" style={{ fontFamily: 'var(--font-sans)', color: 'var(--color-ink)' }}>
            Compliance<br />
            <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 400, color: 'var(--color-amber-dark)' }}>Report.</span>
          </h1>
          <p className="text-base max-w-lg" style={{ color: 'var(--color-ink-mid)' }}>
            Gemini converts your full bias analysis into plain-English findings. No data science background required.
          </p>
        </div>

        {/* Quick summary cards */}
        {(colResults.length > 0 || attrResults.length > 0) && (
          <motion.div initial="hidden" animate="visible" className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
            {[
              { label: 'Dataset Columns', value: colResults.length, color: 'var(--color-ink)', bg: 'var(--color-bg-warm)' },
              { label: 'Biased Columns',  value: biasedCols,       color: 'var(--color-biased)', bg: 'var(--color-red-light)' },
              { label: 'Model Attributes',value: attrResults.length, color: 'var(--color-ink)', bg: 'var(--color-bg-warm)' },
              { label: 'Biased Attrs',    value: biasedAttrs,       color: biasedAttrs > 0 ? 'var(--color-biased)' : 'var(--color-green)', bg: biasedAttrs > 0 ? 'var(--color-red-light)' : 'var(--color-green-light)' },
            ].map((s, i) => (
              <motion.div key={s.label} variants={fadeUp} custom={i}
                className="rounded-xl p-4 text-center border-2 card-shadow"
                style={{ background: s.bg, borderColor: 'transparent' }}>
                <div className="text-2xl font-black" style={{ color: s.color, fontFamily: 'var(--font-mono)' }}>{s.value}</div>
                <div className="text-[10px] font-bold uppercase tracking-wider mt-1" style={{ color: s.color, opacity: 0.7 }}>{s.label}</div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Column findings summary */}
        {colResults.length > 0 && (
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={1} className="mb-8 rounded-xl border-2 p-6 card-shadow" style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}>
            <h3 className="text-sm font-black mb-4" style={{ color: 'var(--color-ink)' }}>Dataset Findings</h3>
            <div className="space-y-2">
              {colResults.map(col => (
                <div key={col.name} className="flex items-center gap-3 py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <span className="text-base">{VERDICT_EMOJI[col.verdict] || '⚪'}</span>
                  <span className="text-sm font-bold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-ink)' }}>{col.name}</span>
                  <span className="text-xs font-bold" style={{ color: VERDICT_COLOR[col.verdict] }}>{col.verdict}</span>
                  {col.disparate_impact != null && (
                    <span className="ml-auto text-xs" style={{ color: 'var(--color-ink-muted)', fontFamily: 'var(--font-mono)' }}>
                      DI {col.disparate_impact.toFixed(2)} {col.disparate_impact < 0.8 && <span style={{ color: 'var(--color-biased)' }}>— below 0.80 threshold</span>}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Generating state */}
        <AnimatePresence>
          {status === 'generating' && (
            <motion.div key="gen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex items-center gap-3 px-5 py-4 rounded-xl border-2 mb-6"
              style={{ borderColor: 'var(--color-amber)', background: 'var(--color-amber-light)' }}>
              <Spinner />
              <span className="text-sm font-semibold" style={{ color: 'var(--color-amber-dark)', fontFamily: 'var(--font-mono)' }}>
                Generating compliance narrative with Gemini…
              </span>
            </motion.div>
          )}
          {status === 'error' && (
            <motion.div key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="px-5 py-4 rounded-xl border-2 mb-6"
              style={{ borderColor: 'var(--color-biased)', background: 'var(--color-red-light)' }}>
              <p className="text-sm font-bold" style={{ color: 'var(--color-biased)' }}>Generation failed</p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-ink-mid)' }}>{errorMsg}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-ink-muted)' }}>
                Make sure VITE_GEMINI_API_KEY is set in .env, or start the backend with GEMINI_API_KEY set.
              </p>
              <button onClick={generate}
                className="mt-3 text-xs font-bold px-4 py-2 rounded-lg"
                style={{ background: 'var(--color-biased)', color: '#fff' }}>
                Retry
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Report card */}
        {status === 'done' && reportText && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border-2 overflow-hidden card-shadow-lg"
            style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}>

            {/* Report header bar */}
            <div className="flex items-center gap-3 px-8 py-5 border-b-2"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-ink)' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--color-amber)' }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="var(--color-ink)" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-white">Gemini AI Audit Narrative</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Plain-English compliance report — ready to share</p>
              </div>
              <div className="ml-auto flex items-center gap-3">
                <span className="w-2 h-2 rounded-full" style={{ background: 'var(--color-green)' }} />
                <button onClick={generate}
                  className="text-xs font-semibold transition-opacity hover:opacity-70"
                  style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)' }}>
                  ↺ Regenerate
                </button>
              </div>
            </div>

            {/* Report body */}
            <div className="px-8 py-8 space-y-6">
              {parseReportSections(reportText).map((section, i) => (
                <div key={i}>
                  {section.heading && (
                    <h4 className="text-[10px] font-black uppercase tracking-widest mb-2"
                      style={{ color: 'var(--color-ink-muted)', fontFamily: 'var(--font-mono)' }}>
                      {section.heading}
                    </h4>
                  )}
                  <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--color-ink-mid)' }}>
                    {section.body}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Nav buttons */}
        <div className="mt-8 flex flex-wrap gap-4">
          {status === 'done' && (
            <button onClick={generate}
              className="px-5 py-3 text-sm font-bold rounded-lg border-2 transition-all hover:opacity-70"
              style={{ border: '2px solid var(--color-border-strong)', color: 'var(--color-ink)' }}>
              ↺ Regenerate Report
            </button>
          )}
          <button onClick={() => navigate('/audit/model')}
            className="px-5 py-3 text-sm font-bold rounded-lg border-2 transition-all hover:opacity-70"
            style={{ border: '2px solid var(--color-border)', color: 'var(--color-ink-mid)' }}>
            ← Back to Model Audit
          </button>
          <button onClick={() => navigate('/upload')}
            className="px-5 py-3 text-sm font-bold rounded-lg transition-all hover:opacity-90"
            style={{ background: 'var(--color-ink)', color: '#fff' }}>
            ↺ New Audit
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="var(--color-amber)" strokeWidth="3" opacity="0.3"/>
      <path fill="var(--color-amber-dark)" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z">
        <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/>
      </path>
    </svg>
  );
}
