import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAudit } from '../lib/AuditContext';
import { generateGeminiReport } from '../lib/api';

const SPARKLE = (
  <svg className="h-8 w-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"/>
  </svg>
);

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.12, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function Report() {
  const navigate  = useNavigate();
  const audit     = useAudit();

  const [status, setStatus]     = useState('idle');   // idle | generating | done | error
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
      const text = await generateGeminiReport(
        audit.biasReport       || {},
        audit.modelBiasReport  || {},
      );
      setReportText(text);
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message || 'Gemini report generation failed.');
    }
  }

  if (!hasData) {
    return (
      <div className="min-h-screen pt-32 flex flex-col items-center gap-6 text-center px-6">
        <p className="text-gray-400">No analysis data found. Run a dataset audit first.</p>
        <button onClick={() => navigate('/upload')}
          className="rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent/80 transition">
          ← Upload a Dataset
        </button>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="min-h-screen pt-24 px-6 pb-20">
      <div className="mx-auto max-w-4xl">
        <h1 className="font-[family-name:var(--font-heading)] text-4xl text-white mb-2">AI Compliance Report</h1>
        <p className="text-gray-400 mb-10">Gemini-generated plain-English audit report for non-technical stakeholders.</p>

        {/* Header card */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp}
          className="flex flex-col items-center rounded-xl border border-border-subtle bg-bg-card p-12 text-center mb-8">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10">{SPARKLE}</div>
          <h2 className="font-[family-name:var(--font-heading)] text-2xl text-white mb-4">Gemini Audit Narrative</h2>
          <p className="max-w-2xl text-sm text-gray-400 leading-relaxed">
            Gemini converts the full bias analysis into a plain-English compliance report readable by
            non-technical stakeholders — no data science background required.
          </p>
        </motion.div>

        {/* Generating state */}
        <AnimatePresence>
          {status === 'generating' && (
            <motion.div key="gen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex items-center gap-3 rounded-xl border border-accent/30 bg-accent/5 px-5 py-4 mb-6">
              <Spinner />
              <span className="text-sm text-accent">Generating compliance narrative with Gemini…</span>
            </motion.div>
          )}

          {status === 'error' && (
            <motion.div key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="rounded-xl border border-biased/30 bg-biased/5 px-5 py-4 mb-6">
              <p className="text-sm text-biased font-semibold">Generation failed</p>
              <p className="text-xs text-gray-400 mt-1">{errorMsg}</p>
              <p className="text-xs text-gray-500 mt-1">
                Make sure VITE_GEMINI_API_KEY is set in .env, or start the backend with GEMINI_API_KEY set.
              </p>
              <button onClick={generate}
                className="mt-3 rounded-lg bg-biased/20 px-4 py-2 text-xs font-semibold text-biased hover:bg-biased/30 transition">
                Retry
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Report text */}
        {status === 'done' && reportText && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-border-subtle bg-bg-card overflow-hidden">
            {/* Gemini header bar */}
            <div className="flex items-center gap-3 border-b border-border-subtle px-8 py-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
                <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/>
                </svg>
              </div>
              <span className="text-sm font-semibold text-white">Gemini AI Report</span>
              <span className="ml-auto inline-block h-2 w-2 rounded-full bg-clean animate-pulse" />
              <button onClick={generate}
                className="text-xs text-gray-500 hover:text-white transition ml-4">↺ Regenerate</button>
            </div>

            {/* Report content — render sections */}
            <div className="px-8 py-8 space-y-6 font-mono text-sm leading-relaxed text-gray-300">
              {parseReportSections(reportText).map((section, i) => (
                <div key={i}>
                  {section.heading && (
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                      {section.heading}
                    </h4>
                  )}
                  <p className="whitespace-pre-wrap text-gray-300">{section.body}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Re-run / nav */}
        <div className="mt-8 flex flex-wrap gap-4">
          {status === 'done' && (
            <button onClick={generate}
              className="rounded-xl border border-accent/40 px-5 py-3 text-sm font-semibold text-accent hover:bg-accent/10 transition">
              ↺ Regenerate Report
            </button>
          )}
          <button onClick={() => navigate('/audit/dataset')}
            className="rounded-xl border border-border-subtle px-5 py-3 text-sm font-semibold text-gray-400 hover:bg-white/5 transition">
            ← Back to Dataset Audit
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── helpers ───────────────────────────────────────────────────────────────

function parseReportSections(text) {
  const sectionRe = /^(\d+\.\s+[A-Z ]+)$/m;
  const lines = text.split('\n');
  const sections = [];
  let current = { heading: '', body: '' };

  for (const line of lines) {
    if (sectionRe.test(line.trim())) {
      if (current.body.trim()) sections.push(current);
      current = { heading: line.trim(), body: '' };
    } else {
      current.body += line + '\n';
    }
  }
  if (current.body.trim() || current.heading) sections.push(current);
  return sections.length ? sections : [{ heading: '', body: text }];
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin text-accent" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
    </svg>
  );
}
