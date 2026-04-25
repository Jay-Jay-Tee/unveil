import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const ENTRIES = [
  {
    term: 'Fairness ratio (disparate impact)',
    short: 'How equally outcomes are distributed',
    body: "The ratio of positive-outcome rates between the worst-off group and the best-off group. 1.0 means perfectly equal. Below 0.80 fails the EEOC \"four-fifths rule\" — the US legal benchmark for employment discrimination.",
    example: "If men are approved 83% of the time and women only 61%, the fairness ratio is 0.61 / 0.83 = 0.73. Below 0.80 means trouble.",
    tone: 'var(--color-status-unfair)',
  },
  {
    term: 'Approval gap (parity gap)',
    short: 'The raw percentage-point gap between groups',
    body: "The difference between the most-approved group and the least-approved group, in percentage points. Above 10pp is usually flagged.",
    example: "Male approval 83%, female approval 61% → 22-point gap.",
    tone: 'var(--color-status-borderline)',
  },
  {
    term: 'Sensitive attribute',
    short: 'What we used to call "protected"',
    body: "A demographic column that legally or ethically shouldn't influence automated decisions: age, race, sex, religion, disability, national origin, etc.",
    example: "In UCI Adult Income, sex and race are sensitive.",
    tone: 'var(--color-role-sensitive)',
  },
  {
    term: 'Possible proxy',
    short: 'A column that quietly stands in for a sensitive attribute',
    body: "Not sensitive itself, but correlates strongly with one that is. This is the tricky case — removing the sensitive column doesn't help if a proxy is still there.",
    example: "In UCI Adult, \"relationship\" status is ~75% correlated with sex. A model that can't see sex will pick up the same bias through relationship.",
    tone: 'var(--color-role-proxy)',
  },
  {
    term: 'Proxy strength',
    short: 'How strongly a proxy column encodes a sensitive attribute',
    body: "Measured with Cramér's V (0 to 1). Above 0.3 is notable, above 0.5 is strong. A high proxy strength means dropping the sensitive column doesn't fix the bias.",
    example: "\"Relationship\" ↔ sex: Cramér's V ≈ 0.75. Very strong proxy.",
    tone: 'var(--color-role-proxy)',
  },
  {
    term: 'Prediction target',
    short: 'What the model is trying to predict',
    body: "The label column. For a hiring model, it's \"hired\". For a credit model, \"approved\". Bias is measured relative to this.",
    example: 'In UCI Adult, the target is "income" (>$50K or not).',
    tone: 'var(--color-role-target)',
  },
  {
    term: 'Counterfactual probe',
    short: '"Would the answer change if this person\'s sex were different?"',
    body: "For each row, we duplicate it and flip one sensitive attribute, then ask the model for a prediction. If the average prediction shifts significantly, the model is using that attribute.",
    example: "Clone 200 rows, change sex from M to F, run through the model. Mean prediction drops from 0.62 to 0.41 → the model is biased.",
    tone: 'var(--color-on-surface)',
  },
  {
    term: 'SHAP feature importance',
    short: 'Which features actually drive a model\'s decisions',
    body: "A technique that assigns credit for each prediction back to each input feature. Features with the largest SHAP values are the ones steering decisions the most.",
    example: 'If "relationship" has the highest SHAP value and it\'s a known proxy for sex, that\'s a red flag.',
    tone: 'var(--color-on-surface)',
  },
  {
    term: 'p-value',
    short: 'How likely the bias is real vs random noise',
    body: "The probability that the observed gap happened by chance. Below 0.05 means we're 95% confident the gap is real. Below 0.01 means 99% confident.",
    example: "p = 0.003 → very likely a real pattern, not a fluke.",
    tone: 'var(--color-on-surface)',
  },
];

export default function Glossary() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen pt-24 pb-20 px-6">
      <div className="max-w-3xl mx-auto">

        <div className="py-8 mb-10">
          <p className="text-label-mono mb-2" style={{ color: 'var(--color-text-mid)' }}>
            Reference
          </p>
          <h1 className="text-display-md mb-3" style={{ color: 'var(--color-on-surface)' }}>
            The terminology, in plain English
          </h1>
          <p className="text-base max-w-xl" style={{ color: 'var(--color-text-mid)' }}>
            A 2-minute read. Every term Unveil uses, what it means, and a concrete example.
          </p>
        </div>

        <div className="space-y-4">
          {ENTRIES.map((entry, i) => (
            <motion.div
              key={entry.term}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="rounded-2xl border p-6 card-shadow"
              style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border)', borderLeftWidth: 4, borderLeftColor: entry.tone }}
            >
              <h3 className="text-lg font-bold mb-1">{entry.term}</h3>
              <p className="text-xs font-semibold mb-3 italic" style={{ color: 'var(--color-text-mid)' }}>
                {entry.short}
              </p>
              <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--color-text-mid)' }}>
                {entry.body}
              </p>
              {entry.example && (
                <div className="text-xs leading-relaxed rounded-lg p-3" style={{ background: 'var(--color-surface-container-low)' }}>
                  <span className="font-semibold" style={{ color: 'var(--color-on-surface)' }}>Example: </span>
                  <span style={{ color: 'var(--color-text-mid)' }}>{entry.example}</span>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link to="/upload" className="btn btn-primary">
            Got it — let's audit a dataset
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
