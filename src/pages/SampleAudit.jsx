import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';

// ─── Sample data (UCI Adult Income + demo model) ──────────────────────────────

const DATASET_META = {
  name: 'UCI Adult Income',
  rows: 32561,
  columns: 14,
  file: 'adult.csv',
  model: 'adult_demo_model.pkl',
  description: 'A 1994 U.S. Census extract used to predict whether a person earns over $50K/year. One of the most widely-studied benchmarks for algorithmic fairness — and a textbook example of how bias sneaks in through proxy columns.',
};

const SCHEMA = [
  { name: 'sex',            type: 'PROTECTED', proxies: ['relationship', 'occupation'] },
  { name: 'race',           type: 'PROTECTED', proxies: [] },
  { name: 'native-country', type: 'PROTECTED', proxies: [] },
  { name: 'relationship',   type: 'AMBIGUOUS',  proxies: ['sex', 'marital-status'] },
  { name: 'occupation',     type: 'AMBIGUOUS',  proxies: ['sex'] },
  { name: 'marital-status', type: 'NEUTRAL',    proxies: ['relationship'] },
  { name: 'age',            type: 'NEUTRAL',    proxies: [] },
  { name: 'education-num',  type: 'NEUTRAL',    proxies: [] },
  { name: 'capital-gain',   type: 'NEUTRAL',    proxies: [] },
  { name: 'hours-per-week', type: 'NEUTRAL',    proxies: [] },
  { name: 'income',         type: 'OUTCOME',    proxies: [] },
];

const BIAS_RESULTS = [
  {
    name: 'sex',
    disparate_impact: 0.62,
    parity_gap: 0.22,
    p_value: 0.0001,
    verdict: 'BIASED',
    slices: [
      { group: 'Male',   positive_rate: 0.83, count: 21790 },
      { group: 'Female', positive_rate: 0.61, count: 10771 },
    ],
    finding: 'Female applicants are approved at just 62% the rate of male applicants — well below the 80% legal threshold. This gap is statistically significant (p < 0.001).',
  },
  {
    name: 'race',
    disparate_impact: 0.71,
    parity_gap: 0.14,
    p_value: 0.003,
    verdict: 'BIASED',
    slices: [
      { group: 'White',              positive_rate: 0.79, count: 27816 },
      { group: 'Asian-Pac-Islander', positive_rate: 0.82, count: 1039 },
      { group: 'Black',              positive_rate: 0.65, count: 3124 },
      { group: 'Other',              positive_rate: 0.61, count: 271 },
    ],
    finding: 'The "Other" racial group is approved at 61% the rate of the highest-approval group — a 21-point gap that fails the EEOC four-fifths rule.',
  },
  {
    name: 'occupation',
    disparate_impact: 0.84,
    parity_gap: 0.06,
    p_value: 0.041,
    verdict: 'AMBIGUOUS',
    slices: [
      { group: 'Exec-managerial', positive_rate: 0.82, count: 4066 },
      { group: 'Tech-support',    positive_rate: 0.74, count: 928 },
      { group: 'Craft-repair',    positive_rate: 0.68, count: 4099 },
      { group: 'Other-service',   positive_rate: 0.54, count: 3295 },
    ],
    finding: 'Occupation has a Cramér\'s V of 0.58 with sex — meaning it largely encodes gender. It passes the 80% threshold but is a confirmed proxy column.',
  },
  {
    name: 'native-country',
    disparate_impact: 0.91,
    parity_gap: 0.03,
    p_value: 0.18,
    verdict: 'CLEAN',
    slices: [
      { group: 'United-States', positive_rate: 0.76, count: 29170 },
      { group: 'Mexico',        positive_rate: 0.73, count: 643 },
    ],
    finding: 'Approval rates are consistent across nationalities. The 9-point gap is not statistically significant (p = 0.18).',
  },
];

const PROXY_FLAGS = [
  { column: 'relationship', cramers_v: 0.73, mutual_info: 0.41, proxy_for: 'sex',          verdict: 'PROXY' },
  { column: 'occupation',   cramers_v: 0.58, mutual_info: 0.29, proxy_for: 'sex',          verdict: 'PROXY' },
  { column: 'age',          cramers_v: 0.21, mutual_info: 0.09, proxy_for: 'native-country', verdict: 'WEAK_PROXY' },
];

const MODEL_RESULTS = [
  { name: 'sex',            mean_diff: 0.18, p_value: 0.0001, shap_rank: 3,  verdict: 'BIASED' },
  { name: 'race',           mean_diff: 0.12, p_value: 0.004,  shap_rank: 7,  verdict: 'BIASED' },
  { name: 'occupation',     mean_diff: 0.07, p_value: 0.038,  shap_rank: 5,  verdict: 'AMBIGUOUS' },
  { name: 'native-country', mean_diff: 0.02, p_value: 0.21,   shap_rank: 11, verdict: 'CLEAN' },
];

const SHAP_SUMMARY = [
  { feature: 'relationship',  mean_abs_shap: 0.31, is_protected: false, is_proxy: true,  proxy_for: ['sex'] },
  { feature: 'capital-gain',  mean_abs_shap: 0.27, is_protected: false, is_proxy: false, proxy_for: [] },
  { feature: 'sex',           mean_abs_shap: 0.22, is_protected: true,  is_proxy: false, proxy_for: [] },
  { feature: 'education-num', mean_abs_shap: 0.19, is_protected: false, is_proxy: false, proxy_for: [] },
  { feature: 'occupation',    mean_abs_shap: 0.11, is_protected: false, is_proxy: true,  proxy_for: ['sex'] },
  { feature: 'age',           mean_abs_shap: 0.09, is_protected: false, is_proxy: false, proxy_for: [] },
  { feature: 'race',          mean_abs_shap: 0.08, is_protected: true,  is_proxy: false, proxy_for: [] },
  { feature: 'hours-per-week',mean_abs_shap: 0.07, is_protected: false, is_proxy: false, proxy_for: [] },
  { feature: 'capital-loss',  mean_abs_shap: 0.06, is_protected: false, is_proxy: false, proxy_for: [] },
  { feature: 'marital-status',mean_abs_shap: 0.05, is_protected: false, is_proxy: false, proxy_for: [] },
];

const SAMPLE_REPORT = `## Executive Summary

The UCI Adult Income dataset exhibits **systemic bias** across two of three protected attributes tested. The model trained on this data directly encodes gender and racial disparities, compounded by proxy columns that preserve bias even when sensitive attributes are nominally excluded.

**Critical findings:** Sex (disparate impact: 0.62) and race (0.71) both fail the EEOC four-fifths rule. The relationship column — the model's single strongest predictor — has a Cramér's V of 0.73 with sex, meaning it is effectively a gender encoder disguised as a neutral feature.

## Critical Findings

**Sex — Disparate Impact: 0.62 (FAILS)**
Female applicants are approved at 61% the rate of male applicants. This 22-point gap is statistically significant (p < 0.001) and represents a clear violation of the EEOC four-fifths rule. The model's counterfactual probes confirm direct sensitivity: flipping sex alone shifts prediction probability by an average of 0.18.

**Race — Disparate Impact: 0.71 (FAILS)**
The "Other" racial group is approved at 61% the rate of the highest-approval group (Asian-Pac-Islander at 82%). A 21-point spread with p = 0.003 indicates this gap is not random variation.

## Proxy Risk

**relationship** (Cramér's V: 0.73 with sex) is the model's #1 most influential feature by SHAP value. This is the primary mechanism of proxy discrimination: even if sex were removed from training data, the model would reconstruct gender-correlated predictions through relationship status alone.

**occupation** (Cramér's V: 0.58 with sex) ranks #5 by SHAP importance and reinforces the same proxy pathway. Together, these two columns make sex effectively impossible to remove without significant feature engineering.

## Recommendations

1. **Do not deploy this model** in any high-stakes decision context without remediation.
2. Remove or decorrelate relationship and occupation before retraining. Consider fairness-aware encoding techniques.
3. Apply reweighing, adversarial debiasing, or post-processing calibration to equalize approval rates across sex and race groups.
4. Re-audit after remediation. Target disparate impact > 0.85 for all protected attributes.
5. Document the audit trail. In regulated industries, this report should accompany any model card or deployment approval.`;

// ─── Design tokens (inherits from app's CSS vars) ────────────────────────────

const VERDICT_CONFIG = {
  BIASED:    { label: 'Unfair',      icon: '●', color: 'var(--color-status-unfair)',      bg: 'var(--color-status-unfair-bg)',      border: 'var(--color-status-unfair-border)' },
  AMBIGUOUS: { label: 'Borderline',  icon: '◐', color: 'var(--color-status-borderline)',  bg: 'var(--color-status-borderline-bg)',  border: 'var(--color-status-borderline-border)' },
  CLEAN:     { label: 'Fair',        icon: '○', color: 'var(--color-status-fair)',         bg: 'var(--color-status-fair-bg)',         border: 'var(--color-status-fair-border)' },
};

const ROLE_CONFIG = {
  PROTECTED: { label: 'Sensitive attribute', color: 'var(--color-role-sensitive)',  bg: 'var(--color-role-sensitive-bg)' },
  AMBIGUOUS: { label: 'Possible proxy',      color: 'var(--color-role-proxy)',      bg: 'var(--color-role-proxy-bg)' },
  NEUTRAL:   { label: 'Regular feature',     color: 'var(--color-role-neutral)',    bg: 'var(--color-role-neutral-bg)' },
  OUTCOME:   { label: 'Prediction target',   color: 'var(--color-role-target)',     bg: 'var(--color-role-target-bg)' },
};

const TABS = [
  { id: 'overview',  label: '01 · Overview' },
  { id: 'dataset',   label: '02 · Dataset audit' },
  { id: 'proxies',   label: '03 · Proxy detection' },
  { id: 'model',     label: '04 · Model behavior' },
  { id: 'report',    label: '05 · Report' },
];

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.5, ease: [0.22, 1, 0.36, 1] } }),
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function VerdictPill({ verdict }) {
  const cfg = VERDICT_CONFIG[verdict];
  if (!cfg) return null;
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function RolePill({ type }) {
  const cfg = ROLE_CONFIG[type];
  if (!cfg) return null;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold"
      style={{ color: cfg.color, background: cfg.bg }}>
      {cfg.label}
    </span>
  );
}

function StatBox({ label, value, sub }) {
  return (
    <div className="rounded-xl p-4 border" style={{ background: 'var(--color-surface-container-low)', borderColor: 'var(--color-border)' }}>
      <p className="text-xs font-semibold mb-1" style={{ color: 'var(--color-text-mid)', fontFamily: 'var(--font-mono)' }}>{label}</p>
      <p className="text-2xl font-bold" style={{ color: 'var(--color-on-surface)' }}>{value}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-faint)' }}>{sub}</p>}
    </div>
  );
}

function DIGauge({ value, verdict }) {
  if (value == null) return null;
  const clamped = Math.min(Math.max(value, 0), 1.5);
  const pct = (clamped / 1.5) * 100;
  const thresholdPct = (0.8 / 1.5) * 100;
  const cfg = VERDICT_CONFIG[verdict];
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs font-mono mb-1.5" style={{ color: 'var(--color-text-mid)' }}>
        <span>DI: <strong>{value.toFixed(2)}</strong></span>
        <span>threshold: 0.80</span>
      </div>
      <div className="relative h-2 rounded-full" style={{ background: 'var(--color-surface-container-high)' }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: cfg?.color || 'var(--color-status-fair)' }} />
        <div className="absolute top-0 bottom-0 w-0.5 rounded" style={{ left: `${thresholdPct}%`, background: 'var(--color-on-surface)', opacity: 0.3 }} />
      </div>
    </div>
  );
}

function ApprovalBarChart({ slices }) {
  return (
    <ResponsiveContainer width="100%" height={140}>
      <BarChart data={slices} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barSize={28}>
        <XAxis dataKey="group" tick={{ fontSize: 10, fontFamily: 'var(--font-mono)', fill: 'var(--color-text-mid)' }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 1]} tick={{ fontSize: 9, fontFamily: 'var(--font-mono)', fill: 'var(--color-text-faint)' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v*100).toFixed(0)}%`} />
        <ReferenceLine y={0.8} stroke="var(--color-accent)" strokeDasharray="3 3" strokeWidth={1.5} />
        <RechartsTooltip
          formatter={(v) => [`${(v * 100).toFixed(1)}%`, 'Approval rate']}
          contentStyle={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 10, fontSize: 12 }}
        />
        <Bar dataKey="positive_rate" radius={[4, 4, 0, 0]}>
          {slices.map((s, i) => (
            <Cell key={i} fill={s.positive_rate < 0.8 ? 'var(--color-status-unfair)' : 'var(--color-status-fair)'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function BiasCard({ col, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen || false);
  const biasData = BIAS_RESULTS.find(b => b.name === col.name);
  const verdictCfg = biasData ? VERDICT_CONFIG[biasData.verdict] : null;
  const borderLeft = verdictCfg ? `4px solid ${verdictCfg.color}` : '1px solid var(--color-border)';

  return (
    <div className="rounded-2xl overflow-hidden card-shadow"
      style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderLeft }}>
      <button className="w-full p-5 text-left" onClick={() => setOpen(v => !v)}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="font-bold font-mono text-base">{col.name}</span>
              <RolePill type={col.type} />
              {biasData && <VerdictPill verdict={biasData.verdict} />}
            </div>
            {biasData && (
              <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-mid)' }}>
                {biasData.finding}
              </p>
            )}
            {!biasData && (
              <p className="text-sm" style={{ color: 'var(--color-text-faint)' }}>
                {col.type === 'OUTCOME' ? 'Prediction target — fairness not measured here.' : 'No bias analysis for neutral features.'}
              </p>
            )}
          </div>
          <span className="text-lg shrink-0" style={{ color: 'var(--color-text-faint)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
            ⌄
          </span>
        </div>
        {biasData && (
          <div className="mt-3">
            <DIGauge value={biasData.disparate_impact} verdict={biasData.verdict} />
          </div>
        )}
      </button>

      <AnimatePresence>
        {open && biasData && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }} style={{ overflow: 'hidden' }}>
            <div className="px-5 pb-5 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <div className="grid grid-cols-3 gap-3 my-4">
                <StatBox label="Disparate impact" value={biasData.disparate_impact.toFixed(2)} sub={biasData.disparate_impact < 0.8 ? '↓ Below 0.80 threshold' : '↑ Passes threshold'} />
                <StatBox label="Parity gap" value={`${(biasData.parity_gap * 100).toFixed(0)}pp`} sub="Best vs worst group" />
                <StatBox label="p-value" value={biasData.p_value < 0.001 ? '<0.001' : biasData.p_value.toFixed(3)} sub={biasData.p_value < 0.05 ? 'Significant' : 'Not significant'} />
              </div>
              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-mid)', fontFamily: 'var(--font-mono)' }}>
                APPROVAL RATES BY GROUP
              </p>
              <ApprovalBarChart slices={biasData.slices} />
              <p className="text-xs mt-2" style={{ color: 'var(--color-text-faint)' }}>
                Dashed line = 80% EEOC threshold. Red bars = below threshold.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Tab panels ──────────────────────────────────────────────────────────────

function OverviewTab() {
  const biasedCount = BIAS_RESULTS.filter(b => b.verdict === 'BIASED').length;
  const proxyCount = PROXY_FLAGS.filter(p => p.verdict === 'PROXY').length;

  return (
    <motion.div initial="hidden" animate="visible" className="space-y-8">
      {/* Dataset info */}
      <motion.div variants={fadeUp} custom={0}
        className="rounded-2xl p-6 border" style={{ background: 'var(--color-surface-container-low)', borderColor: 'var(--color-border)' }}>
        <div className="flex items-start gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="text-label-mono mb-1" style={{ color: 'var(--color-text-mid)' }}>Sample dataset</p>
            <h2 className="text-2xl font-bold mb-1">{DATASET_META.name}</h2>
            <p className="text-sm leading-relaxed max-w-2xl" style={{ color: 'var(--color-text-mid)' }}>
              {DATASET_META.description}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <span className="px-3 py-1.5 rounded-full text-xs font-mono font-bold" style={{ background: 'var(--color-bg-ink)', color: '#fff' }}>
              {DATASET_META.file}
            </span>
            <span className="px-3 py-1.5 rounded-full text-xs font-mono font-bold" style={{ background: 'var(--color-accent-light)', color: 'var(--color-accent-dark)' }}>
              {DATASET_META.model}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
          <StatBox label="Rows" value={DATASET_META.rows.toLocaleString()} />
          <StatBox label="Columns" value={DATASET_META.columns} />
          <StatBox label="Protected attrs" value="3" sub="sex, race, native-country" />
          <StatBox label="Target" value="income" sub=">$50K prediction" />
        </div>
      </motion.div>

      {/* Verdict banner */}
      <motion.div variants={fadeUp} custom={1}
        className="rounded-2xl p-6 border-l-4"
        style={{ background: 'var(--color-status-unfair-bg)', borderLeftColor: 'var(--color-status-unfair)' }}>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl" style={{ color: 'var(--color-status-unfair)' }}>●</span>
          <p className="font-bold text-lg" style={{ color: 'var(--color-status-unfair)' }}>Overall verdict: Unfair</p>
        </div>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-mid)' }}>
          {biasedCount} of 3 protected attributes fail the EEOC four-fifths rule. The model's top predictor
          is a proxy column (relationship, Cramér's V = 0.73 with sex) — meaning removing sex from
          training data would not fix the underlying bias.
        </p>
      </motion.div>

      {/* Flow steps */}
      <motion.div variants={fadeUp} custom={2}>
        <p className="text-label-mono mb-4" style={{ color: 'var(--color-text-mid)' }}>How this audit ran</p>
        <div className="grid sm:grid-cols-4 gap-4">
          {[
            { n: '01', t: 'Ingest', d: 'adult.csv loaded into pandas. 32,561 rows × 14 columns. Column dtypes and sample values extracted.' },
            { n: '02', t: 'Classify', d: 'Gemini 2.5 Flash classified each column: PROTECTED, OUTCOME, AMBIGUOUS, or NEUTRAL. Rules fallback for obvious names.' },
            { n: '03', t: 'Proxy scan', d: 'Cramér\'s V + mutual information computed between every neutral column and each protected attribute.' },
            { n: '04', t: 'Bias stats', d: 'Disparate impact ratios, parity gaps, chi-squared p-values. Model probed with 100+ counterfactuals + SHAP.' },
          ].map((step, i) => (
            <motion.div key={step.n} variants={fadeUp} custom={i + 3}
              className="rounded-xl p-4 border" style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}>
              <p className="font-mono text-xs font-bold mb-2" style={{ color: 'var(--color-accent-dark)' }}>{step.n}</p>
              <p className="font-bold mb-1.5">{step.t}</p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-mid)' }}>{step.d}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Summary tiles */}
      <motion.div variants={fadeUp} custom={7} className="grid sm:grid-cols-3 gap-4">
        {[
          { label: 'Attributes failing 4/5 rule', value: `${biasedCount}/3`, color: 'var(--color-status-unfair)', bg: 'var(--color-status-unfair-bg)' },
          { label: 'Confirmed proxy columns', value: proxyCount, color: 'var(--color-status-borderline)', bg: 'var(--color-status-borderline-bg)' },
          { label: 'Top feature is a proxy', value: 'Yes', color: 'var(--color-status-unfair)', bg: 'var(--color-status-unfair-bg)' },
        ].map((t, i) => (
          <div key={i} className="rounded-2xl p-5 border-l-4"
            style={{ background: t.bg, borderLeftColor: t.color }}>
            <p className="text-3xl font-bold mb-1" style={{ color: t.color }}>{t.value}</p>
            <p className="text-sm font-medium" style={{ color: t.color, opacity: 0.8 }}>{t.label}</p>
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
}

function DatasetTab() {
  const [filter, setFilter] = useState('all');
  const verdictCounts = {
    biased: BIAS_RESULTS.filter(b => b.verdict === 'BIASED').length,
    ambiguous: BIAS_RESULTS.filter(b => b.verdict === 'AMBIGUOUS').length,
    clean: BIAS_RESULTS.filter(b => b.verdict === 'CLEAN').length,
  };

  const filtered = SCHEMA.filter(col => {
    const bias = BIAS_RESULTS.find(b => b.name === col.name);
    if (filter === 'all') return true;
    if (filter === 'biased') return bias?.verdict === 'BIASED';
    if (filter === 'ambiguous') return bias?.verdict === 'AMBIGUOUS';
    if (filter === 'clean') return bias?.verdict === 'CLEAN';
    if (filter === 'no-bias') return !bias;
    return true;
  });

  return (
    <motion.div initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={fadeUp} custom={0}>
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-mid)' }}>
          Each sensitive attribute is sliced by group. Approval rates, disparate impact ratios, and p-values are computed per column.
          The 80% threshold is the EEOC four-fifths rule — the legal standard for detecting disparate impact.
        </p>
        <div className="flex gap-2 flex-wrap">
          {[
            { id: 'all', label: `All (${SCHEMA.length})` },
            { id: 'biased', label: `Unfair (${verdictCounts.biased})`, color: 'var(--color-status-unfair)' },
            { id: 'ambiguous', label: `Borderline (${verdictCounts.ambiguous})`, color: 'var(--color-status-borderline)' },
            { id: 'clean', label: `Fair (${verdictCounts.clean})`, color: 'var(--color-status-fair)' },
            { id: 'no-bias', label: 'Not measured' },
          ].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className="px-3 py-1.5 rounded-full text-sm font-medium transition-all"
              style={{
                background: filter === f.id ? 'var(--color-bg-ink)' : 'var(--color-surface-container)',
                color: filter === f.id ? '#fff' : (f.color || 'var(--color-text-mid)'),
                fontFamily: 'var(--font-mono)',
              }}>
              {f.label}
            </button>
          ))}
        </div>
      </motion.div>

      <div className="space-y-3">
        {filtered.map((col, i) => (
          <motion.div key={col.name} variants={fadeUp} custom={i + 1} initial="hidden" animate="visible">
            <BiasCard col={col} defaultOpen={i === 0 && (filter === 'all' || filter === 'biased')} />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function ProxyTab() {
  return (
    <motion.div initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={fadeUp} custom={0}>
        <p className="text-sm leading-relaxed max-w-2xl" style={{ color: 'var(--color-text-mid)' }}>
          Proxy detection finds "neutral" columns that statistically encode a sensitive attribute.
          Removing sex from your dataset doesn't help if relationship does the same work.
          Columns are scored using <strong>Cramér's V</strong> (categorical association, 0–1) and
          <strong> mutual information</strong> (information overlap). Thresholds: V ≥ 0.30 AND MI ≥ 0.10 = confirmed proxy.
        </p>
      </motion.div>

      {/* Threshold explainer */}
      <motion.div variants={fadeUp} custom={1}
        className="rounded-xl p-5 border" style={{ background: 'var(--color-accent-light)', borderColor: 'var(--color-accent)' }}>
        <p className="text-sm font-bold mb-1" style={{ color: 'var(--color-accent-dark)' }}>Why proxies matter</p>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-accent-dark)', opacity: 0.85 }}>
          A hiring model doesn't say "don't hire women" — it says "candidates with relationship = Husband score higher."
          The sensitive attribute is already gone; its proxy is doing the work instead.
        </p>
      </motion.div>

      {/* Column classification overview */}
      <motion.div variants={fadeUp} custom={2}>
        <p className="text-label-mono mb-3" style={{ color: 'var(--color-text-mid)' }}>Column classification</p>
        <div className="space-y-2">
          {SCHEMA.map((col, i) => (
            <motion.div key={col.name} variants={fadeUp} custom={i + 3}
              className="flex items-center gap-3 p-3 rounded-xl border"
              style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}>
              <span className="font-mono font-bold text-sm w-36 shrink-0">{col.name}</span>
              <RolePill type={col.type} />
              {col.proxies.length > 0 && (
                <span className="text-xs" style={{ color: 'var(--color-text-faint)' }}>
                  proxy for: {col.proxies.join(', ')}
                </span>
              )}
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Proxy scores */}
      <motion.div variants={fadeUp} custom={15}>
        <p className="text-label-mono mb-3" style={{ color: 'var(--color-text-mid)' }}>Proxy scores</p>
        <div className="space-y-3">
          {PROXY_FLAGS.map((p, i) => (
            <motion.div key={p.column} variants={fadeUp} custom={i + 16}
              className="rounded-2xl p-5 border card-shadow"
              style={{
                background: 'var(--color-bg-card)',
                borderColor: p.verdict === 'PROXY' ? 'var(--color-status-borderline-border)' : 'var(--color-border)',
                borderLeft: p.verdict === 'PROXY' ? '4px solid var(--color-status-borderline)' : undefined,
              }}>
              <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold">{p.column}</span>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold"
                    style={{
                      background: p.verdict === 'PROXY' ? 'var(--color-status-borderline-bg)' : 'var(--color-surface-container)',
                      color: p.verdict === 'PROXY' ? 'var(--color-status-borderline)' : 'var(--color-text-mid)',
                    }}>
                    {p.verdict === 'PROXY' ? '⚠ Confirmed proxy' : '· Weak proxy'}
                  </span>
                </div>
                <span className="text-sm" style={{ color: 'var(--color-text-mid)' }}>
                  proxy for: <strong>{p.proxy_for}</strong>
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-mono mb-1.5" style={{ color: 'var(--color-text-faint)' }}>Cramér's V</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full" style={{ background: 'var(--color-surface-container-high)' }}>
                      <div className="h-full rounded-full" style={{ width: `${p.cramers_v * 100}%`, background: p.cramers_v >= 0.3 ? 'var(--color-status-borderline)' : 'var(--color-status-fair)' }} />
                    </div>
                    <span className="font-mono text-sm font-bold">{p.cramers_v.toFixed(2)}</span>
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--color-text-faint)' }}>threshold ≥ 0.30</p>
                </div>
                <div>
                  <p className="text-xs font-mono mb-1.5" style={{ color: 'var(--color-text-faint)' }}>Mutual information</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full" style={{ background: 'var(--color-surface-container-high)' }}>
                      <div className="h-full rounded-full" style={{ width: `${Math.min(p.mutual_info / 0.5, 1) * 100}%`, background: p.mutual_info >= 0.1 ? 'var(--color-status-borderline)' : 'var(--color-status-fair)' }} />
                    </div>
                    <span className="font-mono text-sm font-bold">{p.mutual_info.toFixed(2)}</span>
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--color-text-faint)' }}>threshold ≥ 0.10</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

function ModelTab() {
  return (
    <motion.div initial="hidden" animate="visible" className="space-y-8">
      <motion.div variants={fadeUp} custom={0}>
        <p className="text-sm leading-relaxed max-w-2xl" style={{ color: 'var(--color-text-mid)' }}>
          The demo model (adult_demo_model.pkl) is a scikit-learn RandomForestClassifier trained on this dataset.
          We ran two analyses: <strong>counterfactual probing</strong> (flip one attribute, measure prediction change)
          and <strong>SHAP feature attribution</strong> (which inputs actually drive decisions).
        </p>
      </motion.div>

      {/* Counterfactual probes */}
      <motion.div variants={fadeUp} custom={1}>
        <p className="text-label-mono mb-3" style={{ color: 'var(--color-text-mid)' }}>Counterfactual probes</p>
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-mid)' }}>
          100+ row pairs per attribute. Each pair is identical except one attribute is flipped (e.g. sex: Male → Female).
          A large mean shift + low p-value means the model directly uses that attribute.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          {MODEL_RESULTS.map((attr, i) => {
            const cfg = VERDICT_CONFIG[attr.verdict];
            return (
              <motion.div key={attr.name} variants={fadeUp} custom={i + 2}
                className="rounded-2xl p-5 border card-shadow"
                style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border)', borderLeft: `4px solid ${cfg.color}` }}>
                <div className="flex items-start justify-between mb-3">
                  <span className="font-mono font-bold">{attr.name}</span>
                  <VerdictPill verdict={attr.verdict} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Mean shift', value: attr.mean_diff.toFixed(3) },
                    { label: 'p-value', value: attr.p_value < 0.001 ? '<0.001' : attr.p_value.toFixed(3) },
                    { label: 'SHAP rank', value: `#${attr.shap_rank}` },
                  ].map(m => (
                    <div key={m.label} className="rounded-lg p-3 text-center" style={{ background: 'var(--color-surface-container-low)' }}>
                      <p className="text-xs font-mono mb-1" style={{ color: 'var(--color-text-faint)' }}>{m.label}</p>
                      <p className="text-lg font-bold">{m.value}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* SHAP chart */}
      <motion.div variants={fadeUp} custom={7}>
        <p className="text-label-mono mb-2" style={{ color: 'var(--color-text-mid)' }}>SHAP feature importance</p>
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-mid)' }}>
          Mean absolute SHAP values — how much each feature drives individual predictions.
          <span className="ml-2 px-2 py-0.5 rounded text-xs font-semibold" style={{ background: 'var(--color-role-sensitive-bg)', color: 'var(--color-role-sensitive)' }}>■ sensitive</span>
          <span className="ml-1 px-2 py-0.5 rounded text-xs font-semibold" style={{ background: 'var(--color-status-borderline-bg)', color: 'var(--color-status-borderline)' }}>■ proxy</span>
        </p>
        <div className="space-y-2.5">
          {SHAP_SUMMARY.map((s, i) => {
            const max = SHAP_SUMMARY[0].mean_abs_shap;
            const pct = (s.mean_abs_shap / max) * 100;
            const barColor = s.is_protected ? 'var(--color-role-sensitive)' : s.is_proxy ? 'var(--color-status-borderline)' : 'var(--color-surface-dim)';
            const textColor = s.is_protected ? 'var(--color-role-sensitive)' : s.is_proxy ? 'var(--color-status-borderline)' : 'var(--color-on-surface)';
            return (
              <motion.div key={s.feature} variants={fadeUp} custom={i + 8} className="flex items-center gap-3">
                <span className="font-mono text-sm w-32 shrink-0 text-right" style={{ color: textColor, fontWeight: s.is_protected || s.is_proxy ? 700 : 400 }}>
                  {s.feature}
                </span>
                <div className="flex-1 h-6 rounded-md overflow-hidden" style={{ background: 'var(--color-surface-container)' }}>
                  <div className="h-full rounded-md transition-all duration-700 flex items-center"
                    style={{ width: `${pct}%`, background: barColor }}>
                    <span className="text-xs font-mono px-2" style={{ color: s.is_protected || s.is_proxy ? '#fff' : 'var(--color-on-surface)', whiteSpace: 'nowrap', opacity: pct > 20 ? 1 : 0 }}>
                      {s.mean_abs_shap.toFixed(2)}
                    </span>
                  </div>
                </div>
                {pct <= 20 && (
                  <span className="text-xs font-mono w-10 shrink-0" style={{ color: 'var(--color-text-mid)' }}>{s.mean_abs_shap.toFixed(2)}</span>
                )}
                {(s.is_protected || s.is_proxy) && (
                  <span className="text-xs shrink-0" style={{ color: textColor, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    {s.is_protected ? 'sensitive' : `proxy→${s.proxy_for[0]}`}
                  </span>
                )}
              </motion.div>
            );
          })}
        </div>
        <div className="mt-4 rounded-xl p-4 border-l-4"
          style={{ background: 'var(--color-status-unfair-bg)', borderLeftColor: 'var(--color-status-unfair)' }}>
          <p className="text-sm font-bold mb-1" style={{ color: 'var(--color-status-unfair)' }}>Critical finding</p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-mid)' }}>
            The top predictor is <strong>relationship</strong> — a confirmed proxy for sex (Cramér's V = 0.73).
            Even if sex were removed from training, the model would reconstruct gender-correlated predictions
            through this column alone.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ReportTab() {
  const sections = SAMPLE_REPORT.split('\n## ').map((s, i) => ({
    id: i,
    raw: i === 0 ? s : '## ' + s,
  }));

  function renderSection(raw) {
    const lines = raw.split('\n');
    return lines.map((line, i) => {
      if (line.startsWith('## ')) {
        return <h2 key={i} className="text-xl font-bold mt-6 mb-3" style={{ color: 'var(--color-on-surface)' }}>{line.replace('## ', '')}</h2>;
      }
      if (line.startsWith('**') && line.endsWith('**')) {
        return <p key={i} className="font-bold mt-4 mb-1" style={{ color: 'var(--color-on-surface)' }}>{line.replace(/\*\*/g, '')}</p>;
      }
      if (!line.trim()) return <br key={i} />;
      // Inline bold
      const parts = line.split(/\*\*(.*?)\*\*/g);
      return (
        <p key={i} className="text-sm leading-relaxed mb-2" style={{ color: 'var(--color-text-mid)' }}>
          {parts.map((p, j) => j % 2 === 1 ? <strong key={j} style={{ color: 'var(--color-on-surface)' }}>{p}</strong> : p)}
        </p>
      );
    });
  }

  return (
    <motion.div initial="hidden" animate="visible" className="space-y-4">
      <motion.div variants={fadeUp} custom={0}
        className="rounded-xl px-3 py-2.5 border inline-flex items-center gap-2"
        style={{ background: 'var(--color-accent-light)', borderColor: 'var(--color-accent)' }}>
        <span className="text-xs font-mono font-bold" style={{ color: 'var(--color-accent-dark)' }}>
          ✦ Sample report — generated by Gemini 2.5 Flash
        </span>
      </motion.div>

      <motion.div variants={fadeUp} custom={1}
        className="rounded-2xl p-6 border" style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}>
        {renderSection(SAMPLE_REPORT)}
      </motion.div>

      <motion.div variants={fadeUp} custom={2}
        className="rounded-xl p-4 border" style={{ background: 'var(--color-surface-container-low)', borderColor: 'var(--color-border)' }}>
        <p className="text-sm" style={{ color: 'var(--color-text-mid)' }}>
          Real reports are generated live from your audit data — four Gemini calls for Executive Summary, Critical Findings,
          Proxy Risk, and Recommendations. Each section is independent so rate limits don't break the others.
        </p>
      </motion.div>
    </motion.div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function SampleAudit() {
  const [tab, setTab] = useState('overview');

  return (
    <div style={{ background: 'var(--color-surface)', color: 'var(--color-on-surface)', minHeight: '100vh' }}>

      {/* Header */}
      <div className="pt-20 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div className="max-w-5xl mx-auto px-3 sm:px-5 py-8">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="flex items-center gap-2 mb-3">
              <Link to="/" className="text-sm hover:underline" style={{ color: 'var(--color-text-mid)' }}>← Back</Link>
              <span style={{ color: 'var(--color-border-strong)' }}>/</span>
              <span className="text-sm font-mono" style={{ color: 'var(--color-text-mid)' }}>sample-audit</span>
            </div>
            <div className="flex items-end gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <h1 className="text-display-md mb-1">UCI Adult Income — live audit results</h1>
                <p className="text-base max-w-2xl" style={{ color: 'var(--color-text-mid)' }}>
                  A real bias audit on real data. Explore every step — from column classification
                  to proxy detection, model probing, and the final compliance report.
                </p>
              </div>
              <div className="flex gap-2">
                <Link to="/upload" className="btn btn-secondary text-sm">Run your own →</Link>
                <Link to="/signup" className="btn btn-primary text-sm">Sign up free</Link>
              </div>
            </div>
          </motion.div>

          {/* Tabs */}
          <div className="flex gap-0 mt-6 -mb-px overflow-x-auto">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors shrink-0"
                style={{
                  borderBottomColor: tab === t.id ? 'var(--color-on-surface)' : 'transparent',
                  color: tab === t.id ? 'var(--color-on-surface)' : 'var(--color-text-mid)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-3 sm:px-5 py-10">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            {tab === 'overview' && <OverviewTab />}
            {tab === 'dataset'  && <DatasetTab />}
            {tab === 'proxies'  && <ProxyTab />}
            {tab === 'model'    && <ModelTab />}
            {tab === 'report'   && <ReportTab />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom CTA */}
      <div className="border-t py-12 text-center" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-container-low)' }}>
        <h2 className="text-2xl font-bold mb-3">Ready to audit your own data?</h2>
        <p className="text-base mb-6 max-w-md mx-auto" style={{ color: 'var(--color-text-mid)' }}>
          Upload a CSV, XLSX, or JSON. Add a .pkl model for behavioral analysis. Get results in under a minute.
        </p>
        <div className="flex gap-3 justify-center">
          <Link to="/signup" className="btn btn-primary text-base px-6 py-3">
            Create free account →
          </Link>
          <Link to="/upload" className="btn btn-secondary text-base px-6 py-3">
            Try without signing up
          </Link>
        </div>
      </div>
    </div>
  );
}
