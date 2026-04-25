import { describe, it, expect } from 'vitest';
import {
  COLUMN_ROLE,
  VERDICT,
  roleLabel,
  roleDescription,
  verdictLabel,
  verdictDescription,
  verdictColor,
  verdictBg,
  summarizeColumnFinding,
  overallDatasetVerdict,
  overallVerdictHeadline,
} from '../lib/terminology';

describe('roleLabel', () => {
  it('returns the human-readable label for known types', () => {
    expect(roleLabel('PROTECTED')).toBe('Sensitive');
    expect(roleLabel('OUTCOME')).toBe('Target');
    expect(roleLabel('AMBIGUOUS')).toBe('Possible proxy');
    expect(roleLabel('NEUTRAL')).toBe('Regular feature');
  });

  it('falls back to "Regular feature" for unknown types', () => {
    expect(roleLabel('UNKNOWN')).toBe('Regular feature');
    expect(roleLabel(undefined)).toBe('Regular feature');
  });
});

describe('roleDescription', () => {
  it('returns a non-empty description for known types', () => {
    expect(roleDescription('PROTECTED')).toMatch(/demographic/i);
    expect(roleDescription('OUTCOME')).toMatch(/predict/i);
  });

  it('returns empty string for unknown types', () => {
    expect(roleDescription('UNKNOWN')).toBe('');
  });
});

describe('verdictLabel', () => {
  it('maps backend codes to plain-English labels', () => {
    expect(verdictLabel('BIASED')).toBe('Unfair');
    expect(verdictLabel('AMBIGUOUS')).toBe('Borderline');
    expect(verdictLabel('CLEAN')).toBe('Fair');
    expect(verdictLabel('SKIPPED')).toBe('Not analyzed');
  });

  it('falls back to "Not analyzed" for unknown verdicts', () => {
    expect(verdictLabel('TOTALLY_FAIR')).toBe('Not analyzed');
    expect(verdictLabel(undefined)).toBe('Not analyzed');
  });
});

describe('verdictDescription', () => {
  it('returns a description string for each verdict', () => {
    expect(verdictDescription('BIASED')).toBeTruthy();
    expect(verdictDescription('CLEAN')).toBeTruthy();
    expect(verdictDescription('AMBIGUOUS')).toBeTruthy();
  });
});

describe('verdictColor and verdictBg', () => {
  it('returns CSS variable strings for known verdicts', () => {
    expect(verdictColor('BIASED')).toContain('--color');
    expect(verdictBg('CLEAN')).toContain('--color');
  });

  it('falls back to faint-text color for unknown verdicts', () => {
    expect(verdictColor('UNKNOWN')).toBe('var(--color-text-faint)');
    expect(verdictBg('UNKNOWN')).toBe('var(--color-surface-container)');
  });
});

describe('summarizeColumnFinding', () => {
  it('returns null for an unknown verdict', () => {
    expect(summarizeColumnFinding({ name: 'col', verdict: 'UNKNOWN' })).toBeNull();
  });

  it('reports "No meaningful gap" for a CLEAN protected column', () => {
    const text = summarizeColumnFinding({ name: 'sex', role: 'PROTECTED', verdict: 'CLEAN' });
    expect(text).toMatch(/no meaningful/i);
    expect(text).toContain('sex');
  });

  it('highlights worst-off group when disparate_impact is below 0.80', () => {
    const text = summarizeColumnFinding({
      name: 'race',
      role: 'PROTECTED',
      verdict: 'BIASED',
      disparate_impact: 0.62,
      parity_gap: 0.22,
      slices: [
        { group: 'White', positive_rate: 0.83 },
        { group: 'Black', positive_rate: 0.51 },
      ],
    });
    expect(text).toMatch(/Black/);
    expect(text).toMatch(/0\.62/);
  });

  it('reports gap percentage when disparate_impact ≥ 0.80 but parity_gap > 0.10', () => {
    const text = summarizeColumnFinding({
      name: 'age',
      role: 'PROTECTED',
      verdict: 'BIASED',
      disparate_impact: 0.85,
      parity_gap: 0.18,
      slices: [],
    });
    expect(text).toMatch(/18\.0-percentage-point/);
  });

  it('mentions proxy target when proxy_strength is provided', () => {
    const text = summarizeColumnFinding({
      name: 'zip',
      role: 'AMBIGUOUS',
      verdict: 'AMBIGUOUS',
      proxy_strength: 0.7,
      proxy_targets: ['race'],
    });
    expect(text).toContain('race');
    expect(text).toContain('zip');
  });
});

describe('overallDatasetVerdict', () => {
  it('returns SKIPPED when there are no column results', () => {
    expect(overallDatasetVerdict(null)).toBe('SKIPPED');
    expect(overallDatasetVerdict({})).toBe('SKIPPED');
    expect(overallDatasetVerdict({ column_results: [] })).toBe('SKIPPED');
  });

  it('returns BIASED when any column is BIASED', () => {
    const report = {
      column_results: [
        { verdict: 'CLEAN' },
        { verdict: 'BIASED' },
        { verdict: 'AMBIGUOUS' },
      ],
    };
    expect(overallDatasetVerdict(report)).toBe('BIASED');
  });

  it('returns AMBIGUOUS when no BIASED but at least one AMBIGUOUS', () => {
    const report = {
      column_results: [
        { verdict: 'CLEAN' },
        { verdict: 'AMBIGUOUS' },
      ],
    };
    expect(overallDatasetVerdict(report)).toBe('AMBIGUOUS');
  });

  it('returns CLEAN when all columns are clean', () => {
    const report = { column_results: [{ verdict: 'CLEAN' }, { verdict: 'CLEAN' }] };
    expect(overallDatasetVerdict(report)).toBe('CLEAN');
  });
});

describe('overallVerdictHeadline', () => {
  it('returns a headline string for each known verdict', () => {
    expect(overallVerdictHeadline('BIASED')).toBe('Unfair patterns detected');
    expect(overallVerdictHeadline('AMBIGUOUS')).toBe('Borderline — inspect closely');
    expect(overallVerdictHeadline('CLEAN')).toBe('No significant bias detected');
    expect(overallVerdictHeadline('SKIPPED')).toBe('Not enough data to analyze');
  });
});
