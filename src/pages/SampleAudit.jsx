import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import logoImg from '../assets/logo.png';

// --- Sample data (UCI Adult Income + demo model) ------------------------------

const DATASET_META = {
  name: 'UCI Adult Income',
  rows: 32561,
  columns: 14,
  file: 'adult.csv',
  model: 'adult_demo_model.pkl',
  description: 'A 1994 U.S. Census dataset used to predict whether a person earns over $50K/year. It\'s one of the most widely-studied examples of AI fairness - because it shows exactly how bias creeps into a model through seemingly harmless columns.',
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
    fairness_score: 0.62,
    approval_gap: 0.22,
    verdict: 'BIASED',
    slices: [
      { group: 'Male',   positive_rate: 0.83, count: 21790 },
      { group: 'Female', positive_rate: 0.61, count: 10771 },
    ],
    finding: 'Women are approved at only 62% the rate of men. For every 10 men who get a positive outcome, only about 6 women do - a clear sign of unfair treatment.',
  },
  {
    name: 'race',
    fairness_score: 0.71,
    approval_gap: 0.14,
    verdict: 'BIASED',
    slices: [
      { group: 'White',              positive_rate: 0.79, count: 27816 },
      { group: 'Asian-Pac-Islander', positive_rate: 0.82, count: 1039 },
      { group: 'Black',              positive_rate: 0.65, count: 3124 },
      { group: 'Other',              positive_rate: 0.61, count: 271 },
    ],
    finding: 'The gap between the highest and lowest approval rates across racial groups is 21 percentage points. The "Other" group is approved at just 61% the rate of the highest group - this is statistically significant, not random chance.',
  },
  {
    name: 'occupation',
    fairness_score: 0.84,
    approval_gap: 0.06,
    verdict: 'AMBIGUOUS',
    slices: [
      { group: 'Exec-managerial', positive_rate: 0.82, count: 4066 },
      { group: 'Tech-support',    positive_rate: 0.74, count: 928 },
      { group: 'Craft-repair',    positive_rate: 0.68, count: 4099 },
      { group: 'Other-service',   positive_rate: 0.54, count: 3295 },
    ],
    finding: 'Occupation just barely passes the fairness threshold at 84%, but it\'s strongly linked to gender (correlation: 0.58). It\'s acting as a stand-in for sex - so the gap it creates isn\'t really about the job.',
  },
  {
    name: 'native-country',
    fairness_score: 0.91,
    approval_gap: 0.03,
    verdict: 'CLEAN',
    slices: [
      { group: 'United-States', positive_rate: 0.76, count: 29170 },
      { group: 'Mexico',        positive_rate: 0.73, count: 643 },
    ],
    finding: 'Approval rates are consistent across nationalities. The small gap here is likely just random variation in the data - not evidence of bias.',
  },
];

const PROXY_FLAGS = [
  { column: 'relationship', link_strength: 0.73, info_overlap: 0.41, linked_to: 'sex',           verdict: 'PROXY' },
  { column: 'occupation',   link_strength: 0.58, info_overlap: 0.29, linked_to: 'sex',           verdict: 'PROXY' },
  { column: 'age',          link_strength: 0.21, info_overlap: 0.09, linked_to: 'native-country', verdict: 'WEAK_PROXY' },
];

const MODEL_RESULTS = [
  { name: 'sex',            prediction_shift: 0.18, confidence: 'Very high', feature_rank: 3,  verdict: 'BIASED' },
  { name: 'race',           prediction_shift: 0.12, confidence: 'High',      feature_rank: 7,  verdict: 'BIASED' },
  { name: 'occupation',     prediction_shift: 0.07, confidence: 'Moderate',  feature_rank: 5,  verdict: 'AMBIGUOUS' },
  { name: 'native-country', prediction_shift: 0.02, confidence: 'Low',       feature_rank: 11, verdict: 'CLEAN' },
];

const FEATURE_IMPORTANCE = [
  { feature: 'relationship',   importance: 0.31, is_sensitive: false, is_standin: true,  stands_for: ['sex'] },
  { feature: 'capital-gain',   importance: 0.27, is_sensitive: false, is_standin: false, stands_for: [] },
  { feature: 'sex',            importance: 0.22, is_sensitive: true,  is_standin: false, stands_for: [] },
  { feature: 'education-num',  importance: 0.19, is_sensitive: false, is_standin: false, stands_for: [] },
  { feature: 'occupation',     importance: 0.11, is_sensitive: false, is_standin: true,  stands_for: ['sex'] },
  { feature: 'age',            importance: 0.09, is_sensitive: false, is_standin: false, stands_for: [] },
  { feature: 'race',           importance: 0.08, is_sensitive: true,  is_standin: false, stands_for: [] },
  { feature: 'hours-per-week', importance: 0.07, is_sensitive: false, is_standin: false, stands_for: [] },
  { feature: 'capital-loss',   importance: 0.06, is_sensitive: false, is_standin: false, stands_for: [] },
  { feature: 'marital-status', importance: 0.05, is_sensitive: false, is_standin: false, stands_for: [] },
];

const SAMPLE_REPORT = `## Executive Summary

This AI model has a **serious fairness problem**. Two out of three sensitive demographic attributes - sex and race - show significant disparities in who gets approved and who doesn't. Even more concerning: the model's single most influential input is a column that acts as a hidden stand-in for gender.

**What this means in plain English:** If you removed sex from the dataset entirely, the model would still make gender-biased predictions - because it learned to use "relationship status" as a substitute. Removing the obvious column wasn't enough.

## What We Found

**Sex - Failing (score: 0.62)**
Women are approved at 61% the rate of men. That's a 22-point gap that's not due to chance. The model also changes its prediction significantly when we flip someone's gender while keeping everything else the same - confirming this isn't just a data artifact, it's baked into how the model thinks.

**Race - Failing (score: 0.71)**
The approval gap between the lowest and highest racial groups is 21 percentage points. The "Other" group is approved at just 61% the rate of the best-performing group. This pattern is statistically significant - meaning it's real bias, not noise.

## The Hidden Stand-In Problem

The "relationship" column is the #1 thing that drives this model's predictions. But relationship status (Husband, Wife, Own-child, etc.) is overwhelmingly correlated with gender. So when the model says "this person is a Husband → approve them", what it's really saying is "this person is male → approve them."

"Occupation" does the same thing at a smaller scale - certain jobs cluster heavily by gender, so the model uses job title as another gender signal.

**The bottom line:** You can't fix this model by just removing the sex column. You'd need to also address relationship and occupation - or use a fundamentally different approach to training.

## Recommendations

1. **Do not use this model** for any real decisions until it's been fixed.
2. Remove or transform the relationship and occupation columns to break their link to gender before retraining.
3. Apply fairness-aware training techniques that explicitly penalize gender and racial gaps during learning.
4. After fixing, re-run this audit. Aim for a fairness score above 0.85 for all sensitive attributes.
5. Keep this report as a record - in regulated industries, you'll need to show evidence that you checked for bias.`;

// --- UI Config ----------------------------------------------------------------

const VERDICT_CONFIG = {
  BIASED:    { label: 'Failing',    icon: '●', color: 'var(--color-status-unfair)',     bg: 'var(--color-status-unfair-bg)',     border: 'var(--color-status-unfair-border)' },
  AMBIGUOUS: { label: 'Borderline', icon: '◐', color: 'var(--color-status-borderline)', bg: 'var(--color-status-borderline-bg)', border: 'var(--color-status-borderline-border)' },
  CLEAN:     { label: 'Fair',       icon: '○', color: 'var(--color-status-fair)',        bg: 'var(--color-status-fair-bg)',        border: 'var(--color-status-fair-border)' },
};

const ROLE_CONFIG = {
  PROTECTED: { label: 'Sensitive (sex, race, etc.)', color: 'var(--color-role-sensitive)', bg: 'var(--color-role-sensitive-bg)' },
  AMBIGUOUS: { label: 'Possible stand-in column',   color: 'var(--color-role-proxy)',     bg: 'var(--color-role-proxy-bg)' },
  NEUTRAL:   { label: 'Regular column',             color: 'var(--color-role-neutral)',   bg: 'var(--color-role-neutral-bg)' },
  OUTCOME:   { label: 'What we\'re predicting',     color: 'var(--color-role-target)',    bg: 'var(--color-role-target-bg)' },
};

const TABS = [
  { id: 'overview', label: '01 · Overview' },
  { id: 'dataset',  label: '02 · Fairness check' },
  { id: 'proxies',  label: '03 · Hidden stand-ins' },
  { id: 'model',    label: '04 · Model behavior' },
  { id: 'report',   label: '05 · Report' },
];

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.5, ease: [0.22, 1, 0.36, 1] } }),
};

// --- Small components ---------------------------------------------------------

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

function FairnessGauge({ value, verdict }) {
  if (value == null) return null;
  const clamped = Math.min(Math.max(value, 0), 1.5);
  const pct = (clamped / 1.5) * 100;
  const thresholdPct = (0.8 / 1.5) * 100;
  const cfg = VERDICT_CONFIG[verdict];
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs font-mono mb-1.5" style={{ color: 'var(--color-text-mid)' }}>
        <span>Fairness score: <strong>{value.toFixed(2)}</strong></span>
        <span>minimum: 0.80</span>
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
                {col.type === 'OUTCOME' ? 'This is what the model predicts - not measured for fairness.' : 'Regular column - not checked for group fairness.'}
              </p>
            )}
          </div>
          <span className="text-lg shrink-0" style={{ color: 'var(--color-text-faint)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
            ⌄
          </span>
        </div>
        {biasData && (
          <div className="mt-3">
            <FairnessGauge value={biasData.fairness_score} verdict={biasData.verdict} />
          </div>
        )}
      </button>

      <AnimatePresence>
        {open && biasData && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }} style={{ overflow: 'hidden' }}>
            <div className="px-5 pb-5 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <div className="grid grid-cols-3 gap-3 my-4">
                <StatBox label="Fairness score" value={biasData.fairness_score.toFixed(2)} sub={biasData.fairness_score < 0.8 ? '↓ Below 0.80 minimum' : '↑ Passes minimum'} />
                <StatBox label="Approval gap" value={`${(biasData.approval_gap * 100).toFixed(0)}%`} sub="Best vs worst group" />
                <StatBox label="Certainty" value={biasData.verdict === 'BIASED' ? 'High' : biasData.verdict === 'AMBIGUOUS' ? 'Medium' : 'Low'} sub="That this gap is real" />
              </div>
              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-mid)', fontFamily: 'var(--font-mono)' }}>
                APPROVAL RATES BY GROUP
              </p>
              <ApprovalBarChart slices={biasData.slices} />
              <p className="text-xs mt-2" style={{ color: 'var(--color-text-faint)' }}>
                Dashed line = 80% legal fairness minimum. Red bars = below the threshold.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Tab panels ---------------------------------------------------------------

function OverviewTab() {
  const failingCount = BIAS_RESULTS.filter(b => b.verdict === 'BIASED').length;
  const standinCount = PROXY_FLAGS.filter(p => p.verdict === 'PROXY').length;

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
              + AI model included
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
          <StatBox label="People in dataset" value={DATASET_META.rows.toLocaleString()} />
          <StatBox label="Data columns" value={DATASET_META.columns} />
          <StatBox label="Sensitive attributes" value="3" sub="sex, race, country" />
          <StatBox label="Predicting" value="income" sub=">$50K / year" />
        </div>
      </motion.div>

      {/* Overall verdict */}
      <motion.div variants={fadeUp} custom={1}
        className="rounded-2xl p-6 border-l-4"
        style={{ background: 'var(--color-status-unfair-bg)', borderLeftColor: 'var(--color-status-unfair)' }}>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl" style={{ color: 'var(--color-status-unfair)' }}>●</span>
          <p className="font-bold text-lg" style={{ color: 'var(--color-status-unfair)' }}>Overall result: Unfair</p>
        </div>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-mid)' }}>
          {failingCount} out of 3 sensitive attributes fail the legal fairness minimum. Worse, the model's
          most influential input is "relationship status" - which is strongly linked to gender, meaning
          <strong> removing the sex column wouldn't actually fix the problem</strong>.
        </p>
      </motion.div>

      {/* How it ran */}
      <motion.div variants={fadeUp} custom={2}>
        <p className="text-label-mono mb-4" style={{ color: 'var(--color-text-mid)' }}>How this audit ran</p>
        <div className="grid sm:grid-cols-4 gap-4">
          {[
            { n: '01', t: 'Load data', d: 'The dataset was loaded and each column was scanned - what type of data it holds, how many unique values, and some example entries.' },
            { n: '02', t: 'Classify columns', d: 'AI classified each column: is it sensitive (like sex or race), a stand-in for something sensitive, the thing being predicted, or just regular data?' },
            { n: '03', t: 'Check for stand-ins', d: 'We measured how closely "neutral" columns are linked to sensitive ones. Zip code linked to race, or job title linked to gender, are common examples.' },
            { n: '04', t: 'Measure fairness', d: 'For each sensitive attribute, we compared approval rates across groups, checked if the gaps are statistically real, and tested how the model reacts when we change that attribute.' },
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

      {/* Summary */}
      <motion.div variants={fadeUp} custom={7} className="grid sm:grid-cols-3 gap-4">
        {[
          { label: 'Attributes failing fairness check', value: `${failingCount}/3`, color: 'var(--color-status-unfair)', bg: 'var(--color-status-unfair-bg)' },
          { label: 'Hidden stand-in columns found', value: standinCount, color: 'var(--color-status-borderline)', bg: 'var(--color-status-borderline-bg)' },
          { label: '#1 feature is a gender stand-in', value: 'Yes', color: 'var(--color-status-unfair)', bg: 'var(--color-status-unfair-bg)' },
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

  const filtered = SCHEMA.filter(col => {
    const bias = BIAS_RESULTS.find(b => b.name === col.name);
    if (filter === 'all') return true;
    if (filter === 'failing') return bias?.verdict === 'BIASED';
    if (filter === 'borderline') return bias?.verdict === 'AMBIGUOUS';
    if (filter === 'fair') return bias?.verdict === 'CLEAN';
    if (filter === 'other') return !bias;
    return true;
  });

  const counts = {
    failing: BIAS_RESULTS.filter(b => b.verdict === 'BIASED').length,
    borderline: BIAS_RESULTS.filter(b => b.verdict === 'AMBIGUOUS').length,
    fair: BIAS_RESULTS.filter(b => b.verdict === 'CLEAN').length,
  };

  return (
    <motion.div initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={fadeUp} custom={0}>
        <p className="text-sm mb-4 leading-relaxed" style={{ color: 'var(--color-text-mid)' }}>
          For each sensitive attribute, we split the dataset into groups (e.g. Male / Female) and compare approval rates.
          The <strong>fairness score</strong> is the ratio of the lowest group's approval rate to the highest.
          A score below <strong>0.80</strong> means the worst-off group is being approved at less than 80% the rate of the best-off group - the legal threshold used by the U.S. Equal Employment Opportunity Commission.
        </p>
        <div className="flex gap-2 flex-wrap">
          {[
            { id: 'all',       label: `All columns (${SCHEMA.length})` },
            { id: 'failing',   label: `Failing (${counts.failing})`,    color: 'var(--color-status-unfair)' },
            { id: 'borderline',label: `Borderline (${counts.borderline})`, color: 'var(--color-status-borderline)' },
            { id: 'fair',      label: `Fair (${counts.fair})`,           color: 'var(--color-status-fair)' },
            { id: 'other',     label: 'Not measured' },
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
            <BiasCard col={col} defaultOpen={i === 0 && (filter === 'all' || filter === 'failing')} />
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
          A "hidden stand-in" column is one that looks neutral on the surface but actually carries the same
          information as a sensitive attribute. For example, job titles cluster heavily by gender - so a model
          that uses occupation is effectively making gender-based decisions, even without knowing anyone's sex.
        </p>
      </motion.div>

      <motion.div variants={fadeUp} custom={1}
        className="rounded-xl p-5 border" style={{ background: 'var(--color-accent-light)', borderColor: 'var(--color-accent)' }}>
        <p className="text-sm font-bold mb-1" style={{ color: 'var(--color-accent-dark)' }}>Why this matters</p>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-accent-dark)', opacity: 0.85 }}>
          A biased hiring model doesn't say "don't hire women" - it says "candidates with relationship status = Husband score higher."
          The sensitive attribute is gone from the data, but its stand-in is still there doing the same work.
          Removing the obvious column is not enough.
        </p>
      </motion.div>

      {/* How columns were categorised */}
      <motion.div variants={fadeUp} custom={2}>
        <p className="text-label-mono mb-3" style={{ color: 'var(--color-text-mid)' }}>How each column was categorised</p>
        <div className="space-y-2">
          {SCHEMA.map((col, i) => (
            <motion.div key={col.name} variants={fadeUp} custom={i + 3}
              className="flex items-center gap-3 p-3 rounded-xl border"
              style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}>
              <span className="font-mono font-bold text-sm w-36 shrink-0">{col.name}</span>
              <RolePill type={col.type} />
              {col.proxies.length > 0 && (
                <span className="text-xs" style={{ color: 'var(--color-text-faint)' }}>
                  acting as stand-in for: {col.proxies.join(', ')}
                </span>
              )}
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Stand-in scores */}
      <motion.div variants={fadeUp} custom={15}>
        <p className="text-label-mono mb-1" style={{ color: 'var(--color-text-mid)' }}>Stand-in column scores</p>
        <p className="text-xs mb-3" style={{ color: 'var(--color-text-faint)' }}>
          "Link strength" (0-1) = how correlated the column is with the sensitive attribute. "Information overlap" = how much shared information they contain. Thresholds: link strength ≥ 0.30 AND overlap ≥ 0.10 = confirmed stand-in.
        </p>
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
                    {p.verdict === 'PROXY' ? '⚠ Confirmed stand-in' : '· Weak link'}
                  </span>
                </div>
                <span className="text-sm" style={{ color: 'var(--color-text-mid)' }}>
                  standing in for: <strong>{p.linked_to}</strong>
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-mono mb-1.5" style={{ color: 'var(--color-text-faint)' }}>Link strength</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full" style={{ background: 'var(--color-surface-container-high)' }}>
                      <div className="h-full rounded-full" style={{ width: `${p.link_strength * 100}%`, background: p.link_strength >= 0.3 ? 'var(--color-status-borderline)' : 'var(--color-status-fair)' }} />
                    </div>
                    <span className="font-mono text-sm font-bold">{p.link_strength.toFixed(2)}</span>
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--color-text-faint)' }}>threshold ≥ 0.30</p>
                </div>
                <div>
                  <p className="text-xs font-mono mb-1.5" style={{ color: 'var(--color-text-faint)' }}>Information overlap</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full" style={{ background: 'var(--color-surface-container-high)' }}>
                      <div className="h-full rounded-full" style={{ width: `${Math.min(p.info_overlap / 0.5, 1) * 100}%`, background: p.info_overlap >= 0.1 ? 'var(--color-status-borderline)' : 'var(--color-status-fair)' }} />
                    </div>
                    <span className="font-mono text-sm font-bold">{p.info_overlap.toFixed(2)}</span>
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
          We ran two tests on the actual AI model. First, we made copies of real rows and flipped one attribute
          (like changing sex from Male to Female) while keeping everything else exactly the same - then watched
          how much the model's prediction changed. Second, we measured which inputs actually drive the model's
          decisions the most.
        </p>
      </motion.div>

      {/* Flip test results */}
      <motion.div variants={fadeUp} custom={1}>
        <p className="text-label-mono mb-1" style={{ color: 'var(--color-text-mid)' }}>Flip test results</p>
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-mid)' }}>
          We made 100+ pairs of identical rows and flipped just one attribute in each pair. A large "prediction change" means
          the model is directly using that attribute to decide outcomes.
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
                    { label: 'Prediction change', value: attr.prediction_shift.toFixed(3) },
                    { label: 'Certainty', value: attr.confidence },
                    { label: 'Influence rank', value: `#${attr.feature_rank}` },
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

      {/* Feature influence chart */}
      <motion.div variants={fadeUp} custom={7}>
        <p className="text-label-mono mb-1" style={{ color: 'var(--color-text-mid)' }}>What drives the model's decisions</p>
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-mid)' }}>
          Each bar shows how much that column influences the model's outcome. Longer bar = more influence.
          <span className="ml-2 px-2 py-0.5 rounded text-xs font-semibold" style={{ background: 'var(--color-role-sensitive-bg)', color: 'var(--color-role-sensitive)' }}>■ sensitive attribute</span>
          <span className="ml-1 px-2 py-0.5 rounded text-xs font-semibold" style={{ background: 'var(--color-status-borderline-bg)', color: 'var(--color-status-borderline)' }}>■ hidden stand-in</span>
        </p>
        <div className="space-y-2.5">
          {FEATURE_IMPORTANCE.map((s, i) => {
            const max = FEATURE_IMPORTANCE[0].importance;
            const pct = (s.importance / max) * 100;
            const barColor = s.is_sensitive ? 'var(--color-role-sensitive)' : s.is_standin ? 'var(--color-status-borderline)' : 'var(--color-surface-dim)';
            const textColor = s.is_sensitive ? 'var(--color-role-sensitive)' : s.is_standin ? 'var(--color-status-borderline)' : 'var(--color-on-surface)';
            return (
              <motion.div key={s.feature} variants={fadeUp} custom={i + 8} className="flex items-center gap-3">
                <span className="font-mono text-sm w-32 shrink-0 text-right" style={{ color: textColor, fontWeight: s.is_sensitive || s.is_standin ? 700 : 400 }}>
                  {s.feature}
                </span>
                <div className="flex-1 h-6 rounded-md overflow-hidden" style={{ background: 'var(--color-surface-container)' }}>
                  <div className="h-full rounded-md transition-all duration-700 flex items-center"
                    style={{ width: `${pct}%`, background: barColor }}>
                    <span className="text-xs font-mono px-2" style={{ color: s.is_sensitive || s.is_standin ? '#fff' : 'var(--color-on-surface)', whiteSpace: 'nowrap', opacity: pct > 20 ? 1 : 0 }}>
                      {s.importance.toFixed(2)}
                    </span>
                  </div>
                </div>
                {pct <= 20 && (
                  <span className="text-xs font-mono w-10 shrink-0" style={{ color: 'var(--color-text-mid)' }}>{s.importance.toFixed(2)}</span>
                )}
                {(s.is_sensitive || s.is_standin) && (
                  <span className="text-xs shrink-0" style={{ color: textColor, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    {s.is_sensitive ? 'sensitive' : `stand-in for ${s.stands_for[0]}`}
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
            The #1 most influential input is <strong>relationship</strong> - a confirmed stand-in for sex (link strength: 0.73).
            Even if sex were removed from the training data entirely, the model would still make gender-biased predictions
            through this column.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ReportTab() {
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
          ✦ Sample report - generated by Gemini 2.5 Flash
        </span>
      </motion.div>

      <motion.div variants={fadeUp} custom={1}
        className="rounded-2xl p-6 border" style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}>
        {renderSection(SAMPLE_REPORT)}
      </motion.div>

      <motion.div variants={fadeUp} custom={2}
        className="rounded-xl p-4 border" style={{ background: 'var(--color-surface-container-low)', borderColor: 'var(--color-border)' }}>
        <p className="text-sm" style={{ color: 'var(--color-text-mid)' }}>
          Reports are generated live from your audit data. The AI writes four sections - Summary, Findings, Hidden Stand-ins,
          and Recommendations - each independently so a slow connection won't break the others.
        </p>
      </motion.div>
    </motion.div>
  );
}

// --- Main page ----------------------------------------------------------------

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
                <h1 className="text-display-md mb-1">UCI Adult Income - real audit results</h1>
                <p className="text-base max-w-2xl" style={{ color: 'var(--color-text-mid)' }}>
                  A complete bias audit, step by step. See how Unveil finds unfair patterns, traces them
                  to hidden stand-in columns, and explains what the AI model is actually doing.
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
          Upload a CSV, Excel, or JSON file. Add an AI model for deeper analysis. Results in under a minute.
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
