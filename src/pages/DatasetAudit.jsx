import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useState } from 'react';
import ColumnCard from '../components/ColumnCard';
import { useAudit } from '../lib/AuditContext';

const SEVERITY_ORDER = { BIASED: 0, AMBIGUOUS: 1, CLEAN: 2 };

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
  const { schemaMap, biasReport, isMock } = useAudit();
  const [activeTab, setActiveTab] = useState('all');
  const [sortBy, setSortBy] = useState('severity');

  if (!schemaMap || !biasReport) {
    return (
      <div className="min-h-screen pt-32 flex flex-col items-center gap-6 text-center px-6">
        <p style={{ color: 'var(--color-ink-muted)' }}>No analysis data yet. Upload a dataset first.</p>
        <button onClick={() => navigate('/upload')}
          className="px-6 py-3 text-sm font-bold rounded-lg" style={{ background: 'var(--color-ink)', color: '#fff' }}>
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
  const verdictColor = { BIASED: 'var(--color-biased)', AMBIGUOUS: 'var(--color-ambiguous)', CLEAN: 'var(--color-green)' }[overallVerdict];
  const verdictBg    = { BIASED: 'var(--color-red-light)', AMBIGUOUS: '#FFF4E6', CLEAN: 'var(--color-green-light)' }[overallVerdict];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen pt-20 pb-20 px-6">
      <div className="mx-auto max-w-5xl">

        {/* Header */}
        <div className="py-12 border-b-2 mb-10" style={{ borderColor: 'var(--color-border)' }}>
          <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--color-ink-muted)', fontFamily: 'var(--font-mono)' }}>Step 02</p>
          <div className="flex flex-wrap items-end gap-6 mb-4">
            <h1 className="text-5xl md:text-6xl font-black tracking-tight leading-tight" style={{ fontFamily: 'var(--font-sans)', color: 'var(--color-ink)' }}>
              Dataset<br />
              <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 400, color: 'var(--color-amber-dark)' }}>Audit.</span>
            </h1>
            <div className="mb-2 px-5 py-3 rounded-xl border-2 text-center" style={{ background: verdictBg, borderColor: verdictColor }}>
              <div className="text-xl font-black" style={{ color: verdictColor }}>{overallVerdict}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider mt-0.5" style={{ color: verdictColor, opacity: 0.7 }}>Overall</div>
            </div>
          </div>
          <p className="text-base max-w-lg" style={{ color: 'var(--color-ink-mid)' }}>
            Disparate impact ratios, parity gaps, and slice-level breakdowns across every protected attribute.
          </p>
          {isMock && <p className="text-xs mt-3 font-medium" style={{ color: 'var(--color-ambiguous)', fontFamily: 'var(--font-mono)' }}>⚠ Demo mode — start backend for live results</p>}
        </div>

        {/* Stat grid */}
        <motion.div initial="hidden" animate="visible" className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          {[
            { label: 'Columns', value: allColumns.length, color: 'var(--color-ink)', bg: 'var(--color-bg-warm)' },
            { label: 'Biased',  value: biasedCount,     color: 'var(--color-biased)',    bg: 'var(--color-red-light)' },
            { label: 'Ambiguous', value: ambiguousCount, color: 'var(--color-ambiguous)', bg: '#FFF4E6' },
            { label: 'Clean',   value: cleanCount,      color: 'var(--color-green)',      bg: 'var(--color-green-light)' },
          ].map((s, i) => (
            <motion.div key={s.label} variants={fadeUp} custom={i}
              className="rounded-xl p-5 text-center border-2 card-shadow"
              style={{ background: s.bg, borderColor: 'transparent' }}>
              <div className="text-3xl font-black" style={{ color: s.color, fontFamily: 'var(--font-mono)' }}>{s.value}</div>
              <div className="text-xs font-bold uppercase tracking-wider mt-1.5" style={{ color: s.color, opacity: 0.7 }}>{s.label}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap mb-6">
          {[
            { id: 'all',       label: 'All',       count: allColumns.length },
            { id: 'biased',    label: 'Biased',    count: biasedCount },
            { id: 'ambiguous', label: 'Ambiguous', count: ambiguousCount },
            { id: 'clean',     label: 'Clean',     count: cleanCount },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="px-4 py-2 rounded-lg text-sm font-bold transition-all border-2"
              style={{
                background: activeTab === tab.id ? 'var(--color-ink)' : 'transparent',
                color: activeTab === tab.id ? '#fff' : 'var(--color-ink-mid)',
                borderColor: activeTab === tab.id ? 'var(--color-ink)' : 'var(--color-border)',
              }}>
              {tab.label} <span className="opacity-60 text-xs">({tab.count})</span>
            </button>
          ))}

          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs font-medium" style={{ color: 'var(--color-ink-muted)' }}>Sort:</span>
            {[['severity','Severity'],['impact','DI Score'],['name','Name']].map(([id, label]) => (
              <button key={id} onClick={() => setSortBy(id)}
                className="px-3 py-2 rounded-lg text-xs font-bold transition-all"
                style={{ background: sortBy === id ? 'var(--color-amber-light)' : 'transparent', color: sortBy === id ? 'var(--color-amber-dark)' : 'var(--color-ink-muted)' }}>
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
          <button onClick={() => navigate('/audit/model')}
            className="px-8 py-4 text-sm font-bold rounded-lg transition-all hover:opacity-90"
            style={{ background: 'var(--color-ink)', color: '#fff' }}>
            Run Model Audit →
          </button>
          <button onClick={() => navigate('/report')}
            className="px-8 py-4 text-sm font-bold rounded-lg border-2 transition-all hover:opacity-70"
            style={{ border: '2px solid var(--color-border-strong)', color: 'var(--color-ink)' }}>
            Generate Report →
          </button>
        </div>
      </div>
    </motion.div>
  );
}
