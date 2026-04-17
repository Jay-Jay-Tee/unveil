import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import UploadZone from '../components/UploadZone';
import ColumnCard from '../components/ColumnCard';
import { mockSchemaMap, mockBiasReport } from '../lib/mockData';

// Merge schema + bias data into a unified list for cards
function buildColumnList(schema, biasReport) {
  const biasMap = {};
  for (const col of biasReport.column_results) {
    biasMap[col.name] = col;
  }

  return schema.columns.map((col) => {
    const bias = biasMap[col.name];
    return {
      name: col.name,
      type: col.type,
      proxies: col.proxies,
      disparateImpact: bias?.disparate_impact ?? null,
      parityGap: bias?.parity_gap ?? null,
      pValue: bias?.p_value ?? null,
      verdict: bias?.verdict ?? null,
      slices: bias?.slices ?? [],
    };
  });
}

// Sort: BIASED first, then AMBIGUOUS, then rest
const SEVERITY_ORDER = { BIASED: 0, AMBIGUOUS: 1, CLEAN: 2 };
function sortColumns(cols) {
  return [...cols].sort((a, b) => {
    const va = a.verdict ? SEVERITY_ORDER[a.verdict] ?? 3 : 4;
    const vb = b.verdict ? SEVERITY_ORDER[b.verdict] ?? 3 : 4;
    return va - vb;
  });
}

export default function Upload() {
  const [uploaded, setUploaded] = useState(false);
  const [fileInfo, setFileInfo] = useState(null);

  // After upload, use mock data to simulate classification
  function handleParsed({ file, data, columns }) {
    setFileInfo({ name: file.name, rows: data.length, cols: columns.length });
    setUploaded(true);
  }

  const columns = uploaded
    ? sortColumns(buildColumnList(mockSchemaMap, mockBiasReport))
    : [];

  const biasedCount = columns.filter((c) => c.verdict === 'BIASED').length;
  const ambiguousCount = columns.filter((c) => c.verdict === 'AMBIGUOUS').length;
  const cleanCount = columns.filter((c) => c.verdict === 'CLEAN').length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen pt-24 px-6 pb-20"
    >
      <div className="mx-auto max-w-6xl">
        <h1 className="font-[family-name:var(--font-heading)] text-4xl text-white mb-2">
          Upload Dataset
        </h1>
        <p className="text-gray-400 mb-10">
          Drag and drop your CSV, JSON, or XLSX file to begin the bias audit.
        </p>

        <UploadZone onParsed={handleParsed} />

        {/* Results */}
        <AnimatePresence>
          {uploaded && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              {/* Summary stats */}
              <div className="mt-12 mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard label="Total Columns" value={columns.length} color="#9CA3AF" />
                <StatCard label="Biased" value={biasedCount} color="#FF4040" />
                <StatCard label="Ambiguous" value={ambiguousCount} color="#F5A623" />
                <StatCard label="Clean" value={cleanCount} color="#2ECC8F" />
              </div>

              {/* Section heading */}
              <h2 className="font-[family-name:var(--font-heading)] text-2xl text-white mb-6">
                Column Classification
              </h2>

              {/* Column cards grid */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {columns.map((col, i) => (
                  <motion.div
                    key={col.name}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.06 }}
                  >
                    <ColumnCard {...col} />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-card p-4 text-center">
      <div
        className="font-[family-name:var(--font-mono)] text-3xl font-bold"
        style={{ color }}
      >
        {value}
      </div>
      <div className="mt-1 text-xs text-gray-500 uppercase tracking-wider">{label}</div>
    </div>
  );
}
