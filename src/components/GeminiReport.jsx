import { useEffect, useState, useRef } from 'react';
import { generateAuditReport } from '../lib/gemini';

const CHARS_PER_TICK = 2;
const TICK_MS = 18;

export default function GeminiReport({ biasReport, modelBiasReport }) {
  const [fullText, setFullText] = useState('');
  const [displayed, setDisplayed] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const timerRef = useRef(null);
  const indexRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    generateAuditReport(biasReport, modelBiasReport)
      .then((text) => {
        if (cancelled) return;
        setFullText(text);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message ?? 'Failed to generate report');
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [biasReport, modelBiasReport]);

  // Typewriter reveal
  useEffect(() => {
    if (!fullText) return;

    indexRef.current = 0;
    setDisplayed('');
    setDone(false);

    timerRef.current = setInterval(() => {
      indexRef.current += CHARS_PER_TICK;
      if (indexRef.current >= fullText.length) {
        indexRef.current = fullText.length;
        clearInterval(timerRef.current);
        setDone(true);
      }
      setDisplayed(fullText.slice(0, indexRef.current));
    }, TICK_MS);

    return () => clearInterval(timerRef.current);
  }, [fullText]);

  // Skip animation
  function skipToEnd() {
    clearInterval(timerRef.current);
    setDisplayed(fullText);
    setDone(true);
  }

  if (error) {
    return (
      <div className="rounded-xl border border-biased/20 bg-biased/5 p-6">
        <p className="text-sm font-semibold text-biased mb-1">Report Generation Failed</p>
        <p className="text-sm text-gray-400">{error}</p>
        <p className="mt-3 text-xs text-gray-500">
          Make sure <code className="rounded bg-white/5 px-1.5 py-0.5 text-accent">VITE_GEMINI_API_KEY</code> is set in your <code className="rounded bg-white/5 px-1.5 py-0.5 text-accent">.env.local</code> file.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border-subtle bg-bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-subtle px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
            <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
            </svg>
          </div>
          <div>
            <span className="text-sm font-semibold text-white">Gemini AI Report</span>
            {loading && (
              <span className="ml-2 text-xs text-gray-500">Generating...</span>
            )}
          </div>
        </div>

        {!done && fullText && (
          <button
            onClick={skipToEnd}
            className="rounded-lg border border-border-subtle px-3 py-1.5 text-xs text-gray-400 transition-colors hover:border-gray-600 hover:text-white"
          >
            Skip animation
          </button>
        )}
      </div>

      {/* Body */}
      <div className="px-6 py-5">
        {loading && (
          <div className="flex items-center gap-3 py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <span className="text-sm text-gray-400">Generating compliance report...</span>
          </div>
        )}

        {displayed && (
          <div className="font-[family-name:var(--font-mono)] text-sm leading-relaxed text-gray-300 whitespace-pre-wrap">
            {displayed}
            {/* Pulsing cursor */}
            {!done && (
              <span className="inline-block w-2 h-4 ml-0.5 align-middle bg-accent animate-pulse rounded-sm" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
