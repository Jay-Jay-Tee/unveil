import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useState } from 'react';
import ColumnCard from '../components/ColumnCard';
import { useAudit } from '../lib/AuditContext';
import { VERDICT, overallDatasetVerdict, overallVerdictHeadline } from '../lib/terminology';

const SEVERITY_ORDER = { BIASED: 0, AMBIGUOUS: 1, CLEAN: 2 };

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] } }),
};

/**
 * Merge schema_map columns with their corresponding bias_report entries.
 * A column from the schema gets whatever metrics the bias_report has for it;
 * columns with no entry just render their "role info" state.
 */
function buildColumns(schemaMap, biasReport) {
  if (!schemaMap) return [];
  const biasMap = {};
  for (const col of biasReport?.column_results || []) {
    biasMap[col.name] = col;
  }
  return (schemaMap.columns || []).map((col) => ({
    ...col,
    bias: biasMap[col.name] || null,
  }));
}

export default function DatasetAudit() {
  const navigate = useNavigate();
  const { schemaMap, biasReport, isMock, modelBiasReport, modelFile, user, saveCurrentAudit, datasetMeta } = useAudit();
  const [activeTab, setActiveTab] = useState('all');
  const [sortBy, setSortBy] = useState('severity');
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved | error

  if (!schemaMap || !biasReport) {
    return (
      <div className="min-h-screen pt-32 flex flex-col items-center gap-5 text-center px-3 sm:px-5">
        <p style={{ color: 'var(--color-text-mid)' }}>No analysis yet. Upload a dataset first.</p>
        <button onClick={() => navigate('/upload')} className="btn btn-primary">
          ← Upload dataset
        </button>
      </div>
    );
  }

  const allColumns = buildColumns(schemaMap, biasReport);
  const unfairCount = allColumns.filter((c) => c.bias?.verdict === 'BIASED').length;
  const borderlineCount = allColumns.filter((c) => c.bias?.verdict === 'AMBIGUOUS').length;
  const fairCount = allColumns.filter((c) => c.bias?.verdict === 'CLEAN').length;

  const filtered = activeTab === 'all' ? allColumns
    : activeTab === 'unfair' ? allColumns.filter((c) => c.bias?.verdict === 'BIASED')
    : activeTab === 'borderline' ? allColumns.filter((c) => c.bias?.verdict === 'AMBIGUOUS')
    : activeTab === 'fair' ? allColumns.filter((c) => c.bias?.verdict === 'CLEAN')
    : allColumns.filter((c) => !c.bias);

  const display = [...filtered].sort((a, b) => {
    if (sortBy === 'severity') {
      const aVerd = a.bias?.verdict;
      const bVerd = b.bias?.verdict;
      return (SEVERITY_ORDER[aVerd] ?? 3) - (SEVERITY_ORDER[bVerd] ?? 3);
    }
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'impact') return (b.bias?.disparate_impact ?? 0) - (a.bias?.disparate_impact ?? 0);
    return 0;
  });

  const overall = overallDatasetVerdict(biasReport);
  const overallInfo = VERDICT[overall];
  const overallBg = {
    BIASED: 'var(--color-status-unfair-bg)',
    AMBIGUOUS: 'var(--color-status-borderline-bg)',
    CLEAN: 'var(--color-status-fair-bg)',
    SKIPPED: 'var(--color-surface-container)',
  }[overall];

  async function handleSave() {
    if (!user) {
      navigate('/login');
      return;
    }
    setSaveState('saving');
    try {
      await saveCurrentAudit();
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2500);
    } catch (e) {
      console.error('[audit] save failed:', e);
      setSaveState('error');
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen pt-20 pb-20 px-3 sm:px-5">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="py-10 border-b mb-8" style={{ borderColor: 'var(--color-border)' }}>
          <p className="text-label-mono mb-2" style={{ color: 'var(--color-text-mid)' }}>
            Step 02 · Dataset audit
          </p>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-display-md mb-1" style={{ color: 'var(--color-on-surface)' }}>
                {datasetMeta?.datasetName || datasetMeta?.name || 'Dataset analysis'}
              </h1>
              <p className="text-base max-w-lg" style={{ color: 'var(--color-text-mid)' }}>
                Approval gaps, proxy strength, and per-group breakdowns for every column.
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSave} className="btn btn-secondary text-sm" disabled={saveState === 'saving'}>
                {saveState === 'saving' && <><span className="unveil-spinner" /> Saving…</>}
                {saveState === 'saved' && '✓ Saved to dashboard'}
                {saveState === 'idle' && '💾 Save to dashboard'}
                {saveState === 'error' && 'Retry save'}
              </button>
              <button onClick={() => navigate('/report')} className="btn btn-primary text-sm">
                Generate report →
              </button>
            </div>
          </div>
          {isMock && (
            <p className="text-xs mt-4 inline-block px-3 py-1.5 rounded-lg"
              style={{ color: 'var(--color-accent-dark)', background: 'var(--color-accent-light)', fontFamily: 'var(--font-mono)' }}>
              Demo mode - start the backend for live results
            </p>
          )}
          {schemaMap.used_fallback && (
            <p className="text-xs mt-2 inline-block px-3 py-1.5 rounded-lg ml-2"
              style={{ color: 'var(--color-accent-dark)', background: 'var(--color-accent-light)', fontFamily: 'var(--font-mono)' }}>
              Gemini was rate-limited - some columns were classified using built-in rules instead.
            </p>
          )}
        </div>

        {/* Overall verdict banner */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-6 mb-8 border-l-4 flex items-center gap-4"
          style={{ background: overallBg, borderLeftColor: overallInfo?.color }}
        >
          <div className="text-3xl" style={{ color: overallInfo?.color }}>{overallInfo?.icon}</div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: overallInfo?.color, opacity: 0.8 }}>
              Overall verdict
            </p>
            <h2 className="text-xl font-bold" style={{ color: overallInfo?.color }}>
              {overallVerdictHeadline(overall)}
            </h2>
          </div>
        </motion.div>

        {/* Stat grid */}
        <motion.div initial="hidden" animate="visible" className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          {[
            { label: 'Columns', value: allColumns.length, color: 'var(--color-on-surface)', bg: 'var(--color-surface-container)' },
            { label: 'Unfair', value: unfairCount, color: 'var(--color-status-unfair)', bg: 'var(--color-status-unfair-bg)' },
            { label: 'Borderline', value: borderlineCount, color: 'var(--color-status-borderline)', bg: 'var(--color-status-borderline-bg)' },
            { label: 'Fair', value: fairCount, color: 'var(--color-status-fair)', bg: 'var(--color-status-fair-bg)' },
          ].map((s, i) => (
            <motion.div key={s.label} variants={fadeUp} custom={i}
              className="rounded-2xl p-5 text-center card-shadow"
              style={{ background: s.bg }}>
              <div className="text-3xl font-black text-metric" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs font-bold uppercase tracking-wider mt-2" style={{ color: s.color, opacity: 0.8 }}>
                {s.label}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap mb-8 items-center">
          {[
            { id: 'all', label: 'All', count: allColumns.length },
            { id: 'unfair', label: 'Unfair', count: unfairCount },
            { id: 'borderline', label: 'Borderline', count: borderlineCount },
            { id: 'fair', label: 'Fair', count: fairCount },
          ].map((tab) => (
            <button
              key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="px-3.5 py-2 rounded-lg text-sm font-semibold transition-all border"
              style={{
                background: activeTab === tab.id ? 'var(--color-bg-ink)' : 'transparent',
                color: activeTab === tab.id ? '#fff' : 'var(--color-text-mid)',
                borderColor: activeTab === tab.id ? 'var(--color-bg-ink)' : 'var(--color-border-strong)',
              }}
            >
              {tab.label} <span className="opacity-60 text-xs">({tab.count})</span>
            </button>
          ))}

          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--color-text-mid)' }}>Sort:</span>
            {[['severity', 'Severity'], ['impact', 'Fairness ratio'], ['name', 'Name']].map(([id, label]) => (
              <button key={id} onClick={() => setSortBy(id)}
                className="px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all"
                style={{
                  background: sortBy === id ? 'var(--color-surface-container-high)' : 'transparent',
                  color: sortBy === id ? 'var(--color-on-surface)' : 'var(--color-text-mid)',
                }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Column grid */}
        <div className="grid gap-4 md:grid-cols-2">
          {display.map((col, i) => (
            <motion.div key={col.name}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}>
              <ColumnCard
                name={col.name}
                type={col.type}
                proxies={col.proxies || []}
                {...col.bias}  // spreads disparate_impact, parity_gap, p_value, verdict, slices, role, proxy_strength, proxy_targets, binning
              />
            </motion.div>
          ))}
        </div>

        {/* CTA row */}
        <div className="mt-12 flex flex-wrap gap-3 items-center">
          <button onClick={() => navigate('/upload')} className="btn btn-ghost">
            ← Back
          </button>
          <button
            onClick={() => {
              const data = { biasReport, schemaMap, datasetMeta };
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              const name = (datasetMeta?.name || datasetMeta?.datasetName || 'dataset').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
              a.download = `${name}-dataset-audit.json`;
              document.body.appendChild(a); a.click(); a.remove();
              URL.revokeObjectURL(url);
            }}
            className="btn btn-ghost"
          >
            ↓ Download dataset audit
          </button>
          {(modelBiasReport || modelFile) ? (
            <button onClick={() => navigate('/audit/model')} className="btn btn-primary">
              Next: model audit →
            </button>
          ) : (
            <button onClick={() => navigate('/report')} className="btn btn-primary">
              Next: compliance report →
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

