import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useState } from 'react';
import ColumnCard from '../components/ColumnCard';
import { useAudit } from '../lib/AuditContext';

const SEVERITY_ORDER = { BIASED: 0, AMBIGUOUS: 1, CLEAN: 2 };
const VERDICT_COLOR = { BIASED: 'var(--color-status-biased)', AMBIGUOUS: 'var(--color-status-ambiguous)', CLEAN: 'var(--color-status-clean)' };

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] } }),
};

function buildColumns(schemaMap, biasReport) {
  if (!schemaMap || !biasReport) return [];
  const biasMap = {};
  for (const col of (biasReport.column_results || [])) biasMap[col.name] = col;
  return (schemaMap.columns || []).map(col => ({ ...col, bias: biasMap[col.name] || null }));
}

export default function DatasetAudit() {
  const navigate = useNavigate();
  const { schemaMap, biasReport, isMock, modelBiasReport, modelFile } = useAudit();
  const [activeTab, setActiveTab] = useState('all');
  const [sortBy, setSortBy] = useState('severity');

  if (!schemaMap || !biasReport) {
    return (
      <div className="min-h-screen pt-32 flex flex-col items-center gap-6 text-center px-6">
        <p style={{ color: 'var(--color-on-surface-variant)' }}>No analysis data yet. Upload a dataset first.</p>
        <button onClick={() => navigate('/upload')}
          className="px-6 py-3 text-sm font-bold rounded-lg text-white transition-colors"
          style={{ background: 'var(--color-bg-ink)' }}>
          ← Upload Dataset
        </button>
      </div>
    );
  }

  const allColumns = buildColumns(schemaMap, biasReport);
  const biasedCount = allColumns.filter(c => c.bias?.verdict === 'BIASED').length;
  const ambiguousCount = allColumns.filter(c => c.bias?.verdict === 'AMBIGUOUS').length;
  const cleanCount = allColumns.filter(c => c.bias?.verdict === 'CLEAN').length;

  const filtered = activeTab === 'all' ? allColumns
    : activeTab === 'biased'    ? allColumns.filter(c => c.bias?.verdict === 'BIASED')
    : activeTab === 'ambiguous' ? allColumns.filter(c => c.bias?.verdict === 'AMBIGUOUS')
    : allColumns.filter(c => c.bias?.verdict === 'CLEAN');

  const display = [...filtered].sort((a, b) => {
    if (sortBy === 'severity') return (SEVERITY_ORDER[a.bias?.verdict] ?? 3) - (SEVERITY_ORDER[b.bias?.verdict] ?? 3);
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'impact') return (b.bias?.disparate_impact ?? 0) - (a.bias?.disparate_impact ?? 0);
    return 0;
  });

  const overallVerdict = biasedCount > 0 ? 'BIASED' : ambiguousCount > 0 ? 'AMBIGUOUS' : 'CLEAN';
  const verdictColor = VERDICT_COLOR[overallVerdict];
  const verdictBg    = { BIASED: '#ffe0e0', AMBIGUOUS: '#fff4d6', CLEAN: 'var(--color-success-light)' }[overallVerdict];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen pt-20 pb-20 px-6" style={{ background: 'var(--color-surface)' }}>
      <div className="mx-auto max-w-5xl">

        {/* Header */}
        <div className="py-12 border-b mb-10" style={{ borderColor: 'var(--color-outline-variant)' }}>
          <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-mono)' }}>Step 02</p>
          <h1 className="text-4xl font-black" style={{ color: 'var(--color-on-surface)' }}>
            Dataset Analysis
          </h1>
          <p className="text-base max-w-lg" style={{ color: 'var(--color-on-surface-variant)' }}>
            Disparate impact ratios, parity gaps, and slice-level breakdowns across every protected attribute.
          </p>
          {isMock && <p className="text-xs mt-3 px-4 py-2 rounded" style={{ color: 'var(--color-on-surface-variant)', background: 'var(--color-surface-container-high)', fontFamily: 'var(--font-mono)' }}>Demo mode — start backend for live results</p>}
        </div>

        {/* Stat grid */}
        <motion.div initial="hidden" animate="visible" className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-12">
          {[
            { label: 'Columns', value: allColumns.length, color: 'var(--color-primary)', bg: 'var(--color-surface-container)' },
            { label: 'Biased',  value: biasedCount,     color: 'var(--color-status-biased)',    bg: '#ffe0e0' },
            { label: 'Ambiguous', value: ambiguousCount, color: 'var(--color-status-ambiguous)', bg: '#fff4d6' },
            { label: 'Clean',   value: cleanCount,      color: 'var(--color-status-clean)',      bg: 'var(--color-success-light)' },
          ].map((s, i) => (
            <motion.div key={s.label} variants={fadeUp} custom={i}
              className="rounded-2xl p-6 text-center border cursor-help transition-all hover:shadow-md w-full flex flex-col items-center justify-center" style={{ background: s.bg, borderColor: s.color, borderOpacity: '0.2', height: '120px' }}>
              <div className="text-3xl font-black" style={{ color: s.color, fontFamily: 'var(--font-mono)' }}>{s.value}</div>
              <div className="text-xs font-bold uppercase tracking-wider mt-2" style={{ color: s.color, opacity: 0.8 }}>{s.label}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap mb-8 items-center">
          {[
            { id: 'all',       label: 'All',       count: allColumns.length },
            { id: 'biased',    label: 'Biased',    count: biasedCount },
            { id: 'ambiguous', label: 'Ambiguous', count: ambiguousCount },
            { id: 'clean',     label: 'Clean',     count: cleanCount },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="px-4 py-2 rounded-lg text-sm font-bold transition-all border"
              style={{
                background: activeTab === tab.id ? 'var(--color-bg-ink)' : 'transparent',
                color: activeTab === tab.id ? '#fff' : 'var(--color-on-surface-variant)',
                borderColor: activeTab === tab.id ? 'var(--color-bg-ink)' : 'var(--color-outline-variant)',
              }}>
              {tab.label} <span className="opacity-60 text-xs">({tab.count})</span>
            </button>
          ))}

          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs font-medium" style={{ color: 'var(--color-on-surface-variant)' }}>Sort by:</span>
            {[['severity','Severity'],['impact','DI Score'],['name','Name']].map(([id, label]) => (
              <button key={id} onClick={() => setSortBy(id)}
                className="px-3 py-2 rounded-lg text-xs font-bold transition-all"
                style={{ background: sortBy === id ? 'var(--color-surface-container-high)' : 'transparent', color: sortBy === id ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant)' }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Column grid */}
        <div className="grid gap-4 md:grid-cols-2">
          {display.map((col, i) => (
            <motion.div key={col.name} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <ColumnCard
                name={col.name}
                type={col.type}
                proxies={col.proxies || []}
                disparateImpact={col.bias?.disparate_impact}
                parityGap={col.bias?.parity_gap}
                pValue={col.bias?.p_value}
                verdict={col.bias?.verdict}
                slices={col.bias?.slices || []}
              />
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-12 flex flex-wrap gap-4">
          {(modelBiasReport || modelFile) && (
            <button onClick={() => navigate('/audit/model')}
              className="px-8 py-4 text-sm font-bold rounded-lg text-white transition-colors hover:opacity-90"
              style={{ background: 'var(--color-bg-ink)' }}>
              View Model Analysis
            </button>
          )}
          <button onClick={() => navigate('/report')}
            className="px-8 py-4 text-sm font-bold rounded-lg border-2 transition-colors hover:opacity-70"
            style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface)' }}>
            Generate Report
          </button>
        </div>
      </div>
    </motion.div>
  );
}
