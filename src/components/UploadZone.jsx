import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { parseFile } from '../lib/fileParser';

const ACCEPT = '.csv,.json,.xlsx,.xls,.data,.txt';

export default function UploadZone({ onParsed }) {
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
        onClick={() => !file && inputRef.current?.click()}
        animate={{
          borderColor: dragging ? '#4D9EFF' : 'rgba(77,158,255,0.3)',
          backgroundColor: dragging ? 'rgba(77,158,255,0.06)' : 'rgba(255,255,255,0.03)',
        }}
        transition={{ duration: 0.2 }}
        className="relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-14 text-center transition-colors"
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
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3"
            >
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              <span className="text-sm text-gray-400">Parsing file...</span>
            </motion.div>
          ) : file ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center gap-3"
            >
              {/* Check icon */}
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-clean/10">
                <svg className="h-6 w-6 text-clean" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{file.name}</p>
                <p className="mt-1 font-[family-name:var(--font-mono)] text-xs text-gray-400">
                  {rowCount.toLocaleString()} rows &middot; {colCount} columns
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); reset(); }}
                className="mt-2 rounded-lg border border-border-subtle px-4 py-1.5 text-xs text-gray-400 transition-colors hover:border-gray-600 hover:text-white"
              >
                Upload different file
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3"
            >
              {/* Upload icon */}
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
                <svg className="h-6 w-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-white">
                  Drag & drop your dataset, or{' '}
                  <span className="font-semibold text-accent">browse</span>
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Supports CSV, JSON, XLSX, .data
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
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mt-3 rounded-lg border border-biased/20 bg-biased/5 px-4 py-2.5 text-sm text-biased"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
