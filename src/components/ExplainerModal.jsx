import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * ExplainerModal - Pop-up explaining complex bias concepts
 * Shows definition, example, and visual representation
 * Topics: protected_bias, proxy, 80_rule, shap, disparate_impact, etc.
 */
export default function ExplainerModal({ topic, onClose }) {
  const [expanded, setExpanded] = useState(false);

  const explainers = {
    protected_bias: {
      icon: '🚫',
      title: 'Protected Bias',
      definition: 'When an AI model discriminates based on legally-protected attributes like gender, race, age, or disability.',
      example: 'A hiring model approves 89% of male candidates but only 61% of female candidates.',
      visual: (
        <div className="flex gap-4 mt-4 text-center">
          <div className="flex-1 p-3 rounded-lg bg-green-50 border border-green-200">
            <div className="text-2xl mb-1">👨</div>
            <div className="font-bold text-green-700">Men: 89%</div>
            <div className="text-xs text-green-600">Approved</div>
          </div>
          <div className="flex-1 p-3 rounded-lg bg-red-50 border border-red-200">
            <div className="text-2xl mb-1">👩</div>
            <div className="font-bold text-red-700">Women: 61%</div>
            <div className="text-xs text-red-600">Approved</div>
          </div>
        </div>
      ),
      action: '⚠️ This violates the 80% Rule',
    },

    proxy: {
      icon: '🔗',
      title: 'Proxy Column',
      definition: 'A feature that isn\'t protected itself, but is strongly correlated with a protected attribute.',
      example: '"Zip code" correlates with race due to residential segregation. Using zip code lets the model discriminate indirectly.',
      visual: (
        <div className="mt-4 space-y-2 text-xs font-mono">
          <div className="p-2 rounded bg-accent/10 border border-accent/30">
            zip_code → region → demographic → BIAS
          </div>
          <div className="p-2 rounded bg-text-muted/5">
            ✓ Removing "race" won't help if "zip_code" is used!
          </div>
        </div>
      ),
      action: '🔍 Our system detects proxies automatically',
    },

    '80_rule': {
      icon: '⚖️',
      title: '80% Rule (Disparate Impact Threshold)',
      definition: 'A legal framework by the EEOC. If a protected group\'s selection rate falls below 80% of the highest group\'s rate, discrimination is presumptively present.',
      example: 'Women approved at 61%, Men at 89%. → 61÷89 = 0.685 = **68.5%** (Below 80% threshold = BIASED)',
      visual: (
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-6 bg-green-400 rounded" style={{ width: '89%' }} />
            <span className="text-xs font-bold">89% (baseline)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-6 bg-red-400 rounded" style={{ width: '61%' }} />
            <span className="text-xs font-bold">61% (protected group)</span>
          </div>
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-text-muted/20">
            <div className="flex-1 h-6 bg-yellow-300 rounded" style={{ width: '80%' }} />
            <span className="text-xs font-bold">80% threshold (FAIL if below)</span>
          </div>
        </div>
      ),
      action: '⚖️ Legally recognized standard for fair hiring/lending',
    },

    shap: {
      icon: '🔍',
      title: 'SHAP (Feature Attribution)',
      definition: 'Shows which features most influenced the model\'s decision for each prediction.',
      example: 'For a loan rejection: "age" pushed -0.4, "income" pushed +0.3, etc. Combined = final decision.',
      visual: (
        <div className="mt-4 space-y-2">
          {['Age', 'Income', 'Employment', 'Credit'].map((feat, i) => (
            <div key={feat} className="flex items-center gap-2">
              <div className="text-xs font-bold w-16">{feat}</div>
              <div
                className={`h-4 rounded ${i % 2 === 0 ? 'bg-red-300' : 'bg-green-300'}`}
                style={{ width: `${60 - i * 15}%` }}
              />
              <span className="text-xs font-mono">{(0.4 - i * 0.1).toFixed(2)}</span>
            </div>
          ))}
        </div>
      ),
      action: '💡 Identify which features drive biased outcomes',
    },

    disparate_impact: {
      icon: '📊',
      title: 'Disparate Impact',
      definition: 'An outcome where a policy or practice has a disproportionate negative effect on a protected group.',
      example: 'A credit scoring model rejects 40% of applicants from one zip code vs. 10% from another (due to proxy for race).',
      visual: (
        <div className="mt-4 p-3 rounded-lg bg-accent/5 border border-accent/30">
          <div className="text-xs mb-2 font-bold">Rejection Rates</div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="text-xs font-bold w-24">Urban area:</div>
              <div className="flex-1 h-3 bg-green-300 rounded" style={{ width: '10%' }} />
              <span className="text-xs">10%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-xs font-bold w-24">Rural area:</div>
              <div className="flex-1 h-3 bg-red-300 rounded" style={{ width: '40%' }} />
              <span className="text-xs">40%</span>
            </div>
          </div>
        </div>
      ),
      action: '⚠️ Evidence of systemic bias that needs fixing',
    },

    counterfactual: {
      icon: '🔄',
      title: 'Counterfactual Probe',
      definition: 'We test: "What if we changed this person\'s gender/race/age?" Does the model\'s decision change?',
      example: 'Original: Loan approved (40yo Male, $80k income). Flip gender to Female: Loan rejected (same income). → Model is using gender!',
      visual: (
        <div className="mt-4 space-y-2">
          <div className="p-2 rounded bg-green-50 border border-green-200 text-xs">
            <div className="font-bold text-green-700">✓ Original: APPROVED</div>
            <div className="text-green-600">Age: 40 | Gender: Male | Income: $80k</div>
          </div>
          <div className="text-center font-bold text-text-muted">↓ Flip Gender</div>
          <div className="p-2 rounded bg-red-50 border border-red-200 text-xs">
            <div className="font-bold text-red-700">✗ After flip: REJECTED</div>
            <div className="text-red-600">Age: 40 | Gender: Female | Income: $80k</div>
          </div>
          <div className="mt-2 p-2 rounded bg-accent/10 text-xs font-bold text-accent">
            🚩 Model is discriminating on gender!
          </div>
        </div>
      ),
      action: '🔬 Model-agnostic bias detection (works with any ML model)',
    },
  };

  const info = explainers[topic] || explainers.protected_bias;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.9, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 10 }}
        onClick={(e) => e.stopPropagation()}
        className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden border border-border-light"
      >
        {/* Top accent */}
        <div className="h-1 bg-gradient-to-r from-accent via-secondary to-lime" />

        {/* Content */}
        <div className="p-8">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="text-4xl">{info.icon}</div>
            <button
              onClick={onClose}
              className="text-text-muted hover:text-text-primary transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Title */}
          <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-text-primary mb-3">
            {info.title}
          </h2>

          {/* Definition */}
          <p className="text-sm text-text-secondary leading-relaxed mb-6 p-3 rounded-lg bg-text-primary/5">
            {info.definition}
          </p>

          {/* Example */}
          <motion.div
            initial={false}
            animate={{ height: expanded ? 'auto' : 0, opacity: expanded ? 1 : 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden mb-6"
          >
            <div className="mb-4 p-3 rounded-lg bg-accent/5 border border-accent/20">
              <p className="text-xs font-bold text-accent mb-2">📌 Real-world Example:</p>
              <p className="text-xs text-text-secondary leading-relaxed">{info.example}</p>
            </div>

            {/* Visual */}
            {info.visual}

            {/* Action */}
            <div className="mt-4 p-3 rounded-lg bg-secondary/5 border border-secondary/20 text-xs font-bold text-secondary">
              {info.action}
            </div>
          </motion.div>

          {/* Toggle button */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs font-bold text-accent hover:text-accent-dark transition-colors mb-6"
          >
            {expanded ? '▼ Hide example' : '▶ Show example'}
          </button>

          {/* Close button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClose}
            className="w-full px-4 py-2.5 rounded-lg bg-gradient-to-r from-accent to-accent-dark text-white font-bold text-sm hover:shadow-lg hover:shadow-accent/30 transition-all"
          >
            Got it! 👍
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
