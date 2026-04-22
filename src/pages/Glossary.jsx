import { motion } from 'framer-motion';

const TERMS = [
  { term: 'Disparate Impact', abbr: 'DI', def: 'The ratio of positive outcome rates between the least-favored and most-favored group. The legal threshold is 0.80 — below it, the dataset or model likely violates the 80% rule.' },
  { term: 'Counterfactual Probing', abbr: 'CF', def: 'Testing a model by creating synthetic identical people who differ only in one protected attribute (e.g., same income, job, age — but different gender). A large output difference means the model is sensitive to that attribute.' },
  { term: 'SHAP', abbr: 'SHAP', def: 'SHapley Additive exPlanations. A game-theory-based method that quantifies how much each feature "pushed" the model\'s decision. Think of it as a blame score for each column.' },
  { term: 'Protected Attribute', abbr: 'PA', def: 'A column representing a demographic characteristic legally protected from discrimination — typically race, sex, age, national origin, religion, or disability status.' },
  { term: 'Proxy Column', abbr: 'PX', def: 'A column that isn\'t a protected attribute itself, but is statistically correlated with one. Even if you remove race from training data, a model may still discriminate by using "neighborhood" as a proxy.' },
  { term: 'Statistical Parity', abbr: 'SP', def: 'The condition where the probability of a positive outcome is equal across all demographic groups. A gap > 10 percentage points typically warrants investigation.' },
  { term: 'Demographic Parity Gap', abbr: 'DPG', def: 'The raw difference in approval/positive rates between the best-off and worst-off group. A gap of 0.22 means one group is approved 22 percentage points less than another.' },
  { term: 'False Positive Rate', abbr: 'FPR', def: 'The fraction of people in a group who were wrongly given a positive outcome when they shouldn\'t have been. High FPR means the model is too lenient on that group.' },
  { term: 'False Negative Rate', abbr: 'FNR', def: 'The fraction of people in a group who were wrongly denied a positive outcome when they deserved one. High FNR means the model is too harsh on that group.' },
  { term: 'p-value', abbr: 'p', def: 'Statistical significance of a measured bias. Below 0.05 means the disparity is almost certainly real, not random noise. Below 0.001 means extremely confident.' },
  { term: 'Cramér\'s V', abbr: 'CV', def: 'A measure of association between two categorical variables, ranging 0–1. Used to detect proxy columns — a high Cramér\'s V between occupation and sex means they\'re strongly correlated.' },
  { term: '80% Rule', abbr: '4/5', def: 'The US EEOC\'s "four-fifths rule": if the selection rate for one group is less than 80% of the highest group\'s rate, the process is presumed to have adverse impact and may be unlawful.' },
];

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.5, ease: [0.22, 1, 0.36, 1] } }),
};

export default function Glossary() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen pt-20 pb-20 px-6">
      <div className="mx-auto max-w-4xl">

        <div className="py-12 border-b-2 mb-10" style={{ borderColor: 'var(--color-border)' }}>
          <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--color-ink-muted)', fontFamily: 'var(--font-mono)' }}>Reference</p>
          <h1 className="text-5xl md:text-6xl font-black tracking-tight leading-tight mb-4" style={{ fontFamily: 'var(--font-sans)', color: 'var(--color-ink)' }}>
            Glossary
          </h1>
          <p className="text-base" style={{ color: 'var(--color-ink-mid)' }}>
            Every term you'll see in the audit, explained plainly.
          </p>
        </div>

        <div className="space-y-3">
          {TERMS.map((t, i) => (
            <motion.div key={t.term} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-20px' }} custom={i} variants={fadeUp}
              className="rounded-xl border-2 p-6 card-shadow transition-all hover:-translate-y-0.5 hover:card-shadow-lg"
              style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}>
              <div className="flex items-start gap-4">
                <span className="shrink-0 text-xs font-black px-2.5 py-1.5 rounded-lg mt-0.5"
                  style={{ background: 'var(--color-amber-light)', color: 'var(--color-amber-dark)', fontFamily: 'var(--font-mono)' }}>
                  {t.abbr}
                </span>
                <div>
                  <h3 className="text-base font-black mb-1.5" style={{ color: 'var(--color-ink)' }}>{t.term}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--color-ink-mid)' }}>{t.def}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
