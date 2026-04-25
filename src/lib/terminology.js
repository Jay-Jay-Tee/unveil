/**
 * terminology.js — Unveil's single source of truth for user-facing language.
 *
 * Why this file exists: the backend produces JSON with terms like
 * "PROTECTED", "AMBIGUOUS", "BIASED", "CLEAN" — these are statistically
 * correct but nobody knows what they mean. This module maps every such
 * term into plain English, with a one-line explanation the UI can show.
 *
 * Rule: NEVER display raw verdict/type codes in the UI. Always go through
 * these helpers.
 */

// ── Column role (from schema_map) ───────────────────────────────────────

export const COLUMN_ROLE = {
  PROTECTED: {
    label: 'Sensitive',
    description: 'A demographic attribute (like sex or race) that legally or ethically shouldn\'t drive automated decisions.',
    color: 'var(--color-role-sensitive)',
    icon: '🛡',
  },
  OUTCOME: {
    label: 'Target',
    description: 'The column a model is trying to predict.',
    color: 'var(--color-role-target)',
    icon: '🎯',
  },
  AMBIGUOUS: {
    label: 'Possible proxy',
    description: 'Not itself sensitive, but often encodes a sensitive attribute — e.g. zip code for race.',
    color: 'var(--color-role-proxy)',
    icon: '⚠',
  },
  NEUTRAL: {
    label: 'Regular feature',
    description: 'No meaningful link to a sensitive attribute. Bias analysis doesn\'t apply.',
    color: 'var(--color-role-neutral)',
    icon: '·',
  },
};

export function roleLabel(type) {
  return COLUMN_ROLE[type]?.label || 'Regular feature';
}

export function roleDescription(type) {
  return COLUMN_ROLE[type]?.description || '';
}

// ── Verdicts (from bias_report) ─────────────────────────────────────────

export const VERDICT = {
  BIASED: {
    label: 'Unfair',
    shortLabel: 'Unfair',
    description: 'The outcome gap between groups is large and statistically significant.',
    icon: '●',
    tone: 'bad',
    color: 'var(--color-status-unfair)',
    bgColor: 'var(--color-status-unfair-bg)',
  },
  AMBIGUOUS: {
    label: 'Borderline',
    shortLabel: 'Borderline',
    description: 'Some gap is present, but not decisive. Worth a closer look.',
    icon: '◐',
    tone: 'warn',
    color: 'var(--color-status-borderline)',
    bgColor: 'var(--color-status-borderline-bg)',
  },
  CLEAN: {
    label: 'Fair',
    shortLabel: 'Fair',
    description: 'No significant gap detected across groups.',
    icon: '○',
    tone: 'good',
    color: 'var(--color-status-fair)',
    bgColor: 'var(--color-status-fair-bg)',
  },
  SKIPPED: {
    label: 'Not analyzed',
    shortLabel: '—',
    description: 'Bias analysis didn\'t apply to this attribute.',
    icon: '—',
    tone: 'neutral',
    color: 'var(--color-text-faint)',
    bgColor: 'var(--color-surface-container)',
  },
};

export function verdictLabel(v) {
  return VERDICT[v]?.label || 'Not analyzed';
}

export function verdictDescription(v) {
  return VERDICT[v]?.description || '';
}

export function verdictColor(v) {
  return VERDICT[v]?.color || 'var(--color-text-faint)';
}

export function verdictBg(v) {
  return VERDICT[v]?.bgColor || 'var(--color-surface-container)';
}

// ── Metric explanations — what each number actually means ───────────────

export const METRIC = {
  disparate_impact: {
    label: 'Fairness ratio',
    shortLabel: 'FR',
    description: 'How often the worst-off group gets a positive outcome, as a fraction of the best-off group. 1.0 = perfectly equal. Below 0.80 = legally concerning (EEOC 80% rule).',
    legalThreshold: 0.80,
    format: (v) => v == null ? '—' : v.toFixed(2),
    // Reverse-direction metric: LOWER is worse
    isWorseWhenLower: true,
  },
  parity_gap: {
    label: 'Approval gap',
    shortLabel: 'Gap',
    description: 'Absolute percentage-point gap between the most- and least-approved groups. 0.22 means 22 percentage points.',
    flagThreshold: 0.10,
    format: (v) => v == null ? '—' : `${(v * 100).toFixed(1)}pp`,
    isWorseWhenLower: false,
  },
  p_value: {
    label: 'Confidence',
    shortLabel: 'p',
    description: 'Probability that the observed gap is due to random chance. Below 0.05 means the gap is statistically real.',
    flagThreshold: 0.05,
    format: (v) => v == null ? '—' : (v < 0.001 ? '<0.001' : v.toFixed(3)),
    isWorseWhenLower: false,
  },
  proxy_strength: {
    label: 'Proxy strength',
    shortLabel: 'Proxy',
    description: 'How strongly this column encodes a sensitive attribute. 0 = independent, 1 = perfectly predicts it. Above 0.3 is notable.',
    flagThreshold: 0.30,
    format: (v) => v == null ? '—' : v.toFixed(2),
    isWorseWhenLower: false,
  },
  positive_rate: {
    label: 'Approval rate',
    shortLabel: 'Approved',
    description: 'Share of this group that received a positive outcome.',
    format: (v) => v == null ? '—' : `${(v * 100).toFixed(0)}%`,
    isWorseWhenLower: false,
  },
};

// ── Plain-English findings — lightweight templates for inline explanation ──

export function summarizeColumnFinding({ name, role, verdict, disparate_impact, parity_gap, slices, proxy_strength, proxy_targets }) {
  const v = VERDICT[verdict];
  if (!v) return null;

  // Find the worst-off group if we have slices
  let worst = null;
  if (slices && slices.length > 1) {
    worst = slices.reduce((a, b) => (a.positive_rate < b.positive_rate ? a : b));
  }

  if (verdict === 'CLEAN') {
    return `No meaningful outcome gap detected across ${roleLabel(role).toLowerCase()} ${name}.`;
  }

  if (role === 'PROXY' || proxy_strength != null) {
    const target = proxy_targets?.[0];
    const strengthText = proxy_strength != null ? ` (${proxy_strength.toFixed(2)} proxy strength)` : '';
    if (target) {
      return `${name} strongly encodes ${target}${strengthText}. Removing ${target} alone won't fix this — a model could still pick up the same bias through ${name}.`;
    }
    return `${name} may be acting as a stand-in for a sensitive attribute${strengthText}.`;
  }

  // Protected column with a verdict
  if (worst && disparate_impact != null && disparate_impact < 0.80) {
    const worstPct = Math.round((worst.positive_rate || 0) * 100);
    return `Group "${worst.group}" receives positive outcomes only ${worstPct}% of the time — a fairness ratio of ${disparate_impact.toFixed(2)}, below the 0.80 legal threshold.`;
  }

  if (parity_gap != null && parity_gap > 0.10) {
    const gapPct = (parity_gap * 100).toFixed(1);
    return `${gapPct}-percentage-point gap in approval rates between the best- and worst-off groups.`;
  }

  return v.description;
}

// ── Summary overall verdict ─────────────────────────────────────────────

export function overallDatasetVerdict(biasReport) {
  if (!biasReport?.column_results?.length) return 'SKIPPED';
  const verdicts = biasReport.column_results.map((c) => c.verdict);
  if (verdicts.includes('BIASED')) return 'BIASED';
  if (verdicts.includes('AMBIGUOUS')) return 'AMBIGUOUS';
  return 'CLEAN';
}

export function overallVerdictHeadline(v) {
  return {
    BIASED: 'Unfair patterns detected',
    AMBIGUOUS: 'Borderline — inspect closely',
    CLEAN: 'No significant bias detected',
    SKIPPED: 'Not enough data to analyze',
  }[v];
}
