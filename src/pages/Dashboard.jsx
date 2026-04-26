import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { listAudits, deleteAudit } from '../lib/storage';
import { useAudit } from '../lib/AuditContext';
import { overallDatasetVerdict, overallVerdictHeadline, VERDICT } from '../lib/terminology';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, authReady, loadAudit } = useAudit();
  const [audits, setAudits] = useState([]);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      navigate('/login');
      return;
    }
    if (user.isGuest) return; // Guest sees the sign-up wall below - no audit fetch needed
    (async () => {
      try {
        const list = await listAudits(user);
        setAudits(list);
        setStatus('ready');
      } catch (e) {
        console.error('[dashboard] list failed:', e);
        setStatus('error');
      }
    })();
  }, [user, authReady, navigate]);

  async function handleDelete(auditId) {
    if (!confirm('Delete this audit? This cannot be undone.')) return;
    try {
      await deleteAudit(user, auditId);
      setAudits((list) => list.filter((a) => a.id !== auditId));
    } catch (e) {
      alert('Delete failed: ' + (e?.message || 'unknown error'));
    }
  }

  function handleOpen(audit) {
    loadAudit(audit);
    navigate('/audit/dataset');
  }

  if (!authReady || (status === 'loading' && !user?.isGuest)) {
    return (
      <div className="min-h-screen pt-32 flex items-center justify-center">
        <span className="unveil-spinner" />
      </div>
    );
  }

  // Guest wall - they can browse but audits don't save without an account
  if (user?.isGuest) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="min-h-screen pt-20 pb-20 px-3 sm:px-5 flex flex-col items-center justify-center text-center">
        <div className="max-w-md">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl flex items-center justify-center"
            style={{ background: 'var(--color-bg-ink)' }}>
            <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <h1 className="text-display-md mb-3" style={{ color: 'var(--color-on-surface)' }}>
            Sign up to save audits
          </h1>
          <p className="text-sm mb-6 leading-relaxed" style={{ color: 'var(--color-text-mid)' }}>
            You're currently in guest mode. Create a free account to save your audit history,
            revisit past results, and generate compliance reports anytime.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link to="/signup" className="btn btn-primary">Create free account</Link>
            <Link to="/login" className="btn btn-secondary">Sign in</Link>
          </div>
          <div className="mt-3">
            <Link to="/upload" className="btn btn-ghost text-sm">
              No, continue as guest
            </Link>
          </div>
          <p className="text-xs mt-5" style={{ color: 'var(--color-text-mid)' }}>
            You can still run audits as a guest - results just won't be saved between sessions.
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="min-h-screen pt-20 pb-20 px-3 sm:px-5"
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="py-10 border-b mb-10 flex items-end justify-between flex-wrap gap-4"
          style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <p className="text-label-mono mb-2" style={{ color: 'var(--color-text-mid)' }}>
              Your audits
            </p>
            <h1 className="text-display-md mb-1" style={{ color: 'var(--color-on-surface)' }}>
              Welcome back{user.displayName ? `, ${user.displayName}` : ''}
            </h1>
            <p className="text-sm" style={{ color: 'var(--color-text-mid)' }}>
              {audits.length === 0
                ? 'No audits yet - run your first one to get started.'
                : `${audits.length} saved audit${audits.length === 1 ? '' : 's'}`}
            </p>
          </div>
          <Link to="/upload" className="btn btn-primary">
            + New audit
          </Link>
        </div>

        {/* Empty state */}
        {audits.length === 0 && (
          <EmptyState />
        )}

        {/* Audit grid */}
        {audits.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {audits.map((audit, i) => (
              <motion.div
                key={audit.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <AuditCard
                  audit={audit}
                  onOpen={() => handleOpen(audit)}
                  onDelete={() => handleDelete(audit.id)}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function safeFileSlug(value) {
  return String(value || 'audit')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'audit';
}

function downloadJsonFile(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportAuditJson(audit) {
  const stamp = new Date(audit.createdAt || Date.now()).toISOString().slice(0, 10);
  const prefix = `${safeFileSlug(audit.datasetName)}-${stamp}`;
  downloadJsonFile(`${prefix}.audit.json`, audit);
}

function exportAuditArtifacts(audit) {
  const stamp = new Date(audit.createdAt || Date.now()).toISOString().slice(0, 10);
  const prefix = `${safeFileSlug(audit.datasetName)}-${stamp}`;
  const files = [
    { name: `${prefix}.summary.json`, data: {
      id: audit.id,
      datasetName: audit.datasetName,
      rowCount: audit.rowCount,
      columnCount: audit.columnCount,
      createdAt: audit.createdAt,
      summary: audit.summary,
      note: audit.note || '',
    } },
    { name: `${prefix}.schema_map.json`, data: audit.schemaMap || { columns: [] } },
    { name: `${prefix}.bias_report.json`, data: audit.biasReport || { column_results: [] } },
  ];

  if (audit.modelBiasReport) {
    files.push({ name: `${prefix}.model_bias_report.json`, data: audit.modelBiasReport });
  }

  files.forEach((f) => downloadJsonFile(f.name, f.data));

  // Download report as markdown if it exists
  if (audit.reportText) {
    const blob = new Blob([audit.reportText], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${prefix}-report.md`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }
}

function AuditCard({ audit, onOpen, onDelete }) {
  const verdict = overallDatasetVerdict(audit.biasReport);
  const verdictInfo = VERDICT[verdict] || VERDICT.SKIPPED;
  const summary = audit.summary || { unfair: 0, borderline: 0, fair: 0 };

  const verdictClass = {
    BIASED: 'status-pill-unfair',
    AMBIGUOUS: 'status-pill-borderline',
    CLEAN: 'status-pill-fair',
    SKIPPED: 'status-pill-skipped',
  }[verdict];

  return (
    <div
      className="rounded-2xl border p-5 card-shadow transition-all cursor-pointer card-shadow-hover"
      style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-bold truncate mb-1">{audit.datasetName}</h3>
          <p className="text-xs" style={{ color: 'var(--color-text-mid)' }}>
            {audit.rowCount?.toLocaleString() || '-'} rows · {audit.columnCount || '-'} columns
          </p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1.5 rounded-md opacity-60 hover:opacity-100 hover:bg-surface-container transition-all"
          title="Delete audit"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ color: 'var(--color-text-mid)' }}>
            <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
          </svg>
        </button>
      </div>

      <span className={`status-pill ${verdictClass} mb-3`}>
        {verdictInfo.icon} {overallVerdictHeadline(verdict)}
      </span>

      {/* Mini summary */}
      <div className="grid grid-cols-3 gap-1.5 mt-3 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
        <Mini label="Unfair" value={summary.unfair} color="var(--color-status-unfair)" />
        <Mini label="Borderline" value={summary.borderline} color="var(--color-status-borderline)" />
        <Mini label="Fair" value={summary.fair} color="var(--color-status-fair)" />
      </div>

      {audit.note && (
        <p className="text-xs italic mt-3 line-clamp-2" style={{ color: 'var(--color-text-mid)' }}>
          "{audit.note}"
        </p>
      )}

      <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }} onClick={(e) => e.stopPropagation()}>
        <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-mid)' }}>Downloads</p>
        <div className="flex flex-col gap-1.5">
          {/* Dataset audit - always present */}
          <button
            onClick={() => {
              const stamp = new Date(audit.createdAt || Date.now()).toISOString().slice(0, 10);
              const prefix = `${safeFileSlug(audit.datasetName)}-${stamp}`;
              downloadJsonFile(`${prefix}.dataset-audit.json`, { biasReport: audit.biasReport, schemaMap: audit.schemaMap, datasetMeta: { name: audit.datasetName, rowCount: audit.rowCount, columnCount: audit.columnCount } });
            }}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all text-left"
            style={{ background: 'var(--color-surface-container-low)', color: 'var(--color-on-surface)' }}
            title="Download dataset bias audit as JSON"
          >
            <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            Dataset audit (.json)
          </button>

          {/* Model audit - only if model data exists */}
          <button
            onClick={() => {
              if (!audit.modelBiasReport) return;
              const stamp = new Date(audit.createdAt || Date.now()).toISOString().slice(0, 10);
              const prefix = `${safeFileSlug(audit.datasetName)}-${stamp}`;
              downloadJsonFile(`${prefix}.model-audit.json`, audit.modelBiasReport);
            }}
            disabled={!audit.modelBiasReport}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all text-left"
            style={{
              background: audit.modelBiasReport ? 'var(--color-surface-container-low)' : 'var(--color-surface-container)',
              color: audit.modelBiasReport ? 'var(--color-on-surface)' : 'var(--color-text-faint)',
              cursor: audit.modelBiasReport ? 'pointer' : 'not-allowed',
              opacity: audit.modelBiasReport ? 1 : 0.5,
            }}
            title={audit.modelBiasReport ? 'Download model bias audit as JSON' : 'No model audit - upload a model file to generate one'}
          >
            <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            Model audit (.json){!audit.modelBiasReport && <span className="ml-auto opacity-60">- no model</span>}
          </button>

          {/* Report - only if report has been generated */}
          <button
            onClick={() => {
              if (!audit.reportText) return;
              const stamp = new Date(audit.createdAt || Date.now()).toISOString().slice(0, 10);
              const prefix = `${safeFileSlug(audit.datasetName)}-${stamp}`;
              const blob = new Blob([audit.reportText], { type: 'text/markdown;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = `${prefix}-report.md`;
              document.body.appendChild(a); a.click(); a.remove();
              URL.revokeObjectURL(url);
            }}
            disabled={!audit.reportText}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all text-left"
            style={{
              background: audit.reportText ? 'var(--color-surface-container-low)' : 'var(--color-surface-container)',
              color: audit.reportText ? 'var(--color-on-surface)' : 'var(--color-text-faint)',
              cursor: audit.reportText ? 'pointer' : 'not-allowed',
              opacity: audit.reportText ? 1 : 0.5,
            }}
            title={audit.reportText ? 'Download compliance report as Markdown' : 'No report yet - generate one from the audit page'}
          >
            <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            Compliance report (.md){!audit.reportText && <span className="ml-auto opacity-60">- not generated</span>}
          </button>
        </div>
      </div>

      <p className="text-[11px] mt-3" style={{ color: 'var(--color-text-faint)' }}>
        {formatTimeAgo(audit.createdAt)}
      </p>
    </div>
  );
}

function Mini({ label, value, color }) {
  return (
    <div className="text-center">
      <div className="text-sm font-bold text-metric" style={{ color }}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: 'var(--color-text-mid)' }}>{label}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="rounded-2xl border-2 border-dashed p-12 text-center"
      style={{ borderColor: 'var(--color-border-strong)', background: 'var(--color-surface-container-low)' }}
    >
      <div className="w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center"
        style={{ background: 'var(--color-bg-ink)', color: '#fff' }}>
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      </div>
      <h2 className="text-xl font-bold mb-2">No audits yet</h2>
      <p className="text-sm mb-6 max-w-sm mx-auto" style={{ color: 'var(--color-text-mid)' }}>
        Upload a dataset or connect a model to run your first bias audit. It takes under a minute.
      </p>
      <Link to="/upload" className="btn btn-primary">
        Start first audit →
      </Link>
    </div>
  );
}

function formatTimeAgo(ts) {
  if (!ts) return '';
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} day${Math.floor(seconds / 86400) === 1 ? '' : 's'} ago`;
  return new Date(ts).toLocaleDateString();
}

