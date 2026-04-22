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

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }

  function onDragOver(e) {
    e.preventDefault();
    setDragging(true);
  }

  function onDragLeave(e) {
    e.preventDefault();
    setDragging(false);
  }

  function onInputChange(e) {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }

  function reset() {
    setFile(null);
    setRowCount(0);
    setColCount(0);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div>
      <motion.div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => !file && !disabled && inputRef.current?.click()}
        animate={{
          borderColor: dragging ? '#FF6B5B' : '#E5E5E0',
          backgroundColor: dragging ? 'rgba(255, 107, 91, 0.08)' : 'rgba(255, 107, 91, 0.02)',
          scale: dragging ? 1.02 : 1,
        }}
        transition={{ duration: 0.2 }}
        className="relative flex cursor-pointer flex-col items-center justify-center rounded-3xl border-3 border-dashed p-16 text-center transition-all"
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          onChange={onInputChange}
          className="hidden"
        />

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center gap-4"
            >
              <div className="h-12 w-12 animate-spin rounded-full border-3 border-accent border-t-transparent" />
              <span className="text-lg font-medium text-text-primary">Parsing file...</span>
              <span className="text-sm text-text-secondary">This should only take a moment</span>
            </motion.div>
          ) : file ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center gap-4"
            >
              {/* Check icon */}
              <motion.div
                className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-secondary to-green-400 text-white shadow-lg"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
              >
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </motion.div>
              <div>
                <p className="text-lg font-bold text-text-primary">{file.name}</p>
                <p className="mt-2 font-[family-name:var(--font-mono)] text-sm text-text-secondary font-medium">
                  ✓ {rowCount.toLocaleString()} rows · {colCount} columns
                </p>
              </div>
              <motion.button
                onClick={(e) => { e.stopPropagation(); reset(); }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="mt-4 rounded-xl border-2 border-text-primary px-6 py-2 text-sm font-bold text-text-primary transition-all hover:border-accent hover:text-accent hover:bg-accent/5"
              >
                📁 Upload different file
              </motion.button>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4"
            >
              {/* Upload icon */}
              <motion.div
                className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-orange-400 text-white shadow-lg"
                animate={{ y: [0, -8, 0] }}
                transition={{ repeat: Infinity, duration: 2 }}
              >
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
              </motion.div>
              <div>
                <p className="text-lg font-bold text-text-primary">
                  Drag & drop your dataset, or{' '}
                  <span className="bg-gradient-to-r from-accent to-secondary bg-clip-text text-transparent">browse</span>
                </p>
                <p className="mt-2 text-sm text-text-secondary font-medium">
                  CSV, JSON, XLSX, or .data files
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="mt-4 rounded-2xl border-2 border-biased bg-gradient-to-r from-biased/10 to-orange-100 px-6 py-4"
          >
            <p className="text-sm font-bold text-biased">❌ Error</p>
            <p className="text-sm text-text-secondary mt-1">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
