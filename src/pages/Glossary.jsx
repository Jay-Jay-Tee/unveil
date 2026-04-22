import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import ExplainerModal from '../components/ExplainerModal';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  }),
};

const concepts = [
  {
    id: 'protected_bias',
    emoji: '🚫',
    title: 'Protected Bias',
    short: 'Discrimination based on protected attributes',
    category: 'Core Concepts',
  },
  {
    id: 'proxy',
    emoji: '🔗',
    title: 'Proxy Column',
    short: 'Feature correlated with protected attributes',
    category: 'Core Concepts',
  },
  {
    id: '80_rule',
    emoji: '⚖️',
    title: '80% Rule (Disparate Impact)',
    short: 'Legal threshold for discrimination (EEOC)',
    category: 'Legal',
  },
  {
    id: 'disparate_impact',
    emoji: '📊',
    title: 'Disparate Impact',
    short: 'Policy with disproportionate negative effect',
    category: 'Legal',
  },
  {
    id: 'shap',
    emoji: '🔍',
    title: 'SHAP (Feature Attribution)',
    short: 'Shows which features influenced predictions',
    category: 'Analytics',
  },
  {
    id: 'counterfactual',
    emoji: '🔄',
    title: 'Counterfactual Probe',
    short: 'Test: What if we changed this attribute?',
    category: 'Analytics',
  },
];

const categories = ['Core Concepts', 'Legal', 'Analytics'];

export default function Glossary() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showExplainer, setShowExplainer] = useState(null);

  const filtered = concepts.filter(c => {
    const matchesSearch = c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         c.short.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === null || c.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="min-h-screen pt-28 px-6 pb-20 bg-gradient-to-br from-white to-lime/3">
      {showExplainer && (
        <ExplainerModal topic={showExplainer} onClose={() => setShowExplainer(null)} />
      )}

      <div className="mx-auto max-w-5xl">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl px-8 py-10 mb-12 bg-gradient-to-r from-lime/10 to-secondary/10 border-2 border-border-light"
        >
          <h1 className="font-[family-name:var(--font-heading)] text-5xl text-text-primary mb-3 font-bold">AI Fairness Glossary</h1>
          <p className="text-lg text-text-secondary">
            Learn about bias, fairness, and compliance in AI. No data science degree required.
          </p>
        </motion.div>

        {/* Search bar */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <div className="relative">
            <input
              type="text"
              placeholder="Search concepts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-6 py-4 rounded-2xl border-2 border-border-light bg-white text-text-primary placeholder-text-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
            />
            <span className="absolute right-6 top-1/2 -translate-y-1/2 text-text-muted">🔍</span>
          </div>
        </motion.div>

        {/* Category filters */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-10 flex flex-wrap gap-2">
          {[{ id: null, label: 'All' }, ...categories.map(c => ({ id: c, label: c }))].map((cat) => (
            <motion.button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`px-5 py-2.5 rounded-lg font-semibold text-sm transition-all ${
                selectedCategory === cat.id
                  ? 'bg-gradient-to-r from-lime to-secondary text-white shadow-lg shadow-lime/30'
                  : 'bg-text-primary/5 text-text-primary hover:bg-text-primary/10'
              }`}
            >
              {cat.label}
            </motion.button>
          ))}
        </motion.div>

        {/* Concepts grid */}
        {filtered.length > 0 ? (
          <motion.div initial="hidden" animate="visible" className="grid gap-6 md:grid-cols-2">
            {filtered.map((concept, i) => (
              <motion.div
                key={concept.id}
                custom={i}
                variants={fadeUp}
                whileHover={{ scale: 1.02, y: -4 }}
                onClick={() => setShowExplainer(concept.id)}
                className="cursor-pointer group"
              >
                <div className="rounded-2xl border-2 border-border-light bg-white p-6 h-full hover:shadow-lg transition-all hover:border-lime">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="text-4xl">{concept.emoji}</div>
                    <div>
                      <span className="inline-block px-3 py-1 rounded-lg bg-lime/10 text-lime text-xs font-bold uppercase tracking-wider mb-2">
                        {concept.category}
                      </span>
                    </div>
                  </div>
                  <h3 className="font-[family-name:var(--font-heading)] text-xl font-bold text-text-primary mb-2">
                    {concept.title}
                  </h3>
                  <p className="text-sm text-text-secondary leading-relaxed mb-4">
                    {concept.short}
                  </p>
                  <div className="flex items-center gap-2 text-lime font-semibold text-sm group-hover:gap-3 transition-all">
                    <span>Learn more</span>
                    <span>→</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
            <p className="text-text-muted text-lg font-medium">No concepts match your search</p>
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory(null);
              }}
              className="mt-4 text-lime font-semibold hover:underline"
            >
              Clear filters
            </button>
          </motion.div>
        )}

        {/* Bottom CTA */}
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={10} className="mt-16 text-center">
          <div className="rounded-2xl bg-gradient-to-r from-accent/10 to-lime/10 border-2 border-border-light p-8">
            <h2 className="font-[family-name:var(--font-heading)] text-3xl text-text-primary mb-4 font-bold">
              Ready to audit?
            </h2>
            <p className="text-text-secondary mb-6 max-w-2xl mx-auto">
              Now that you understand the key concepts, upload your dataset to see how UnbiasedAI detects bias in real data.
            </p>
            <motion.button
              onClick={() => navigate('/upload')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="rounded-xl bg-gradient-to-r from-accent to-accent-dark px-8 py-4 text-sm font-bold text-white shadow-lg shadow-accent/30 transition-all hover:shadow-xl hover:-translate-y-1"
            >
              📊 Start Dataset Audit
            </motion.button>
          </div>
        </motion.div>

        {/* Footer nav */}
        <motion.div initial="hidden" whileInView="visible" className="mt-12 flex flex-col sm:flex-row gap-4 justify-center">
          <motion.button
            onClick={() => navigate('/')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="rounded-xl border-2 border-text-primary px-8 py-4 text-sm font-bold text-text-primary transition-all hover:border-accent hover:text-accent hover:bg-accent/5"
          >
            ← Back to Home
          </motion.button>
        </motion.div>
      </div>
    </motion.div>
  );
}
