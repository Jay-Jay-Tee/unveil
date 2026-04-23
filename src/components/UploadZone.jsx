import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { parseFile } from '../lib/fileParser';

const ACCEPT = '.csv,.json,.xlsx,.xls,.data,.txt';

export default function UploadZone({ onParsed, disabled = false }) {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [rowCount, setRowCount] = useState(0);
  const [colCount, setColCount] = useState(0);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  async function handleFile(f) {
    setError(null);
    setLoading(true);
    try {
      const { data, columns } = await parseFile(f);
      setFile(f);
      setRowCount(data.length);
      setColCount(columns.length);
      onParsed?.({ file: f, data, columns });
    } catch (err) {
      setError(err.message ?? 'Failed to parse file');
    } finally {
      setLoading(false);
    }
  }

  function onDrop(e) { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }
  function onDragOver(e) { e.preventDefault(); setDragging(true); }
  function onDragLeave(e) { e.preventDefault(); setDragging(false); }
  function onInputChange(e) { const f = e.target.files?.[0]; if (f) handleFile(f); }
  function reset() { setFile(null); setRowCount(0); setColCount(0); setError(null); if (inputRef.current) inputRef.current.value = ''; }

  let content;
  if (loading) {
    content = (
      <motion.div key="load" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="flex flex-col items-center gap-4">
        <div className="relative w-14 h-14">
          <svg className="animate-spin-slow absolute inset-0 w-14 h-14" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="24" fill="none" stroke="var(--color-amber)" strokeWidth="2" strokeDasharray="40 110" />
          </svg>
          <div className="absolute inset-2 rounded-full" style={{ background: 'var(--color-amber-light)' }} />
        </div>
        <span className="text-base font-semibold" style={{ color: 'var(--color-ink)' }}>Parsing file…</span>
      </motion.div>
    );
  } else if (file) {
    content = (
      <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
        className="flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'var(--color-green-light)' }}>
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="var(--color-green)" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <div>
          <p className="text-lg font-bold" style={{ color: 'var(--color-ink)' }}>{file.name}</p>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-ink-mid)', fontFamily: 'var(--font-mono)' }}>
            {rowCount.toLocaleString()} rows · {colCount} columns
          </p>
        </div>
        <button
          onClick={e => { e.stopPropagation(); reset(); }}
          className="mt-2 text-sm font-semibold px-5 py-2 rounded-lg border-2 transition-all hover:opacity-70"
          style={{ border: '2px solid var(--color-border-strong)', color: 'var(--color-ink-mid)' }}>
          Upload different file
        </button>
      </motion.div>
    );
  } else {
    content = (
      <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="flex flex-col items-center gap-4">
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: 'var(--color-amber-light)' }}>
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="var(--color-amber-dark)" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
        </motion.div>
        <div>
          <p className="text-base font-bold" style={{ color: 'var(--color-ink)' }}>
            Drop dataset here, or{' '}
            <span style={{ color: 'var(--color-amber-dark)', textDecoration: 'underline' }}>browse</span>
          </p>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-ink-muted)' }}>CSV, JSON, XLSX accepted</p>
        </div>
      </motion.div>
    );
  }

  return (
    <div>
      <motion.div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => !file && !disabled && !loading && inputRef.current?.click()}
        animate={{
          borderColor: dragging ? 'var(--color-amber)' : file ? 'var(--color-green)' : 'rgba(26,23,20,0.15)',
          backgroundColor: dragging ? 'rgba(232,160,32,0.06)' : 'var(--color-bg-card)',
          scale: dragging ? 1.01 : 1,
        }}
        transition={{ duration: 0.2 }}
        className="relative rounded-2xl border-2 border-dashed p-14 text-center cursor-pointer transition-all card-shadow"
        style={{ minHeight: 220 }}
      >
        <input ref={inputRef} type="file" accept={ACCEPT} onChange={onInputChange} className="hidden" />

        <AnimatePresence mode="wait">
          {content}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mt-3 px-5 py-3 rounded-xl border-2"
            style={{ borderColor: 'var(--color-biased)', background: 'var(--color-red-light)' }}>
            <p className="text-sm font-bold" style={{ color: 'var(--color-biased)' }}>{error}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
