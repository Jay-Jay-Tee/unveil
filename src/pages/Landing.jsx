import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function Landing() {
  return (
    <div className="bg-surface text-on-surface min-h-screen">
      {/* Navbar */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-surface border-b border-outline/10 backdrop-blur-sm">
        <nav className="flex justify-between items-center px-8 py-5 max-w-6xl mx-auto w-full">
          <div className="text-2xl font-bold" style={{ fontFamily: 'var(--font-sans)' }}>UnbiasedAI</div>
          <div className="flex items-center gap-4">
            <Link to="/glossary" className="text-sm font-bold px-5 py-2 bg-bg-ink text-white rounded-lg hover:opacity-90 transition-colors">Glossary</Link>
            <Link to="/upload" className="text-sm font-bold px-5 py-2 bg-bg-ink text-white rounded-lg hover:opacity-90 transition-colors">Start Audit</Link>
          </div>
        </nav>
      </header>

      <main className="pt-28">
        {/* Hero */}
        <section className="max-w-6xl mx-auto px-6 py-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.8 }}
          >
            <h1 className="text-5xl md:text-6xl font-black leading-tight mb-6" style={{ fontFamily: 'var(--font-sans)' }}>
              Detect algorithmic bias
              <br />
              before it costs you.
            </h1>
            <p className="text-xl text-on-surface-variant mb-10 max-w-2xl mx-auto leading-relaxed">
              Upload your dataset or model. We'll audit it for bias across protected attributes using counterfactual analysis, disparate impact detection, and SHAP explainability.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Link
                to="/upload"
                className="px-8 py-3 bg-bg-ink text-white font-bold rounded-lg hover:bg-on-surface transition-colors text-lg"
              >
                Upload Dataset
              </Link>
              <a
                href="#metrics"
                className="px-8 py-3 border-2 border-outline text-on-surface font-bold rounded-lg hover:bg-surface-container transition-colors text-lg"
              >
                Learn More
              </a>
            </div>
          </motion.div>
        </section>

        {/* Key Metrics */}
        <section id="metrics" className="bg-surface-container-low py-20">
          <div className="max-w-6xl mx-auto px-6">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              className="text-center mb-16"
            >
              <h2 className="text-4xl font-black mb-4" style={{ fontFamily: 'var(--font-sans)' }}>
                Comprehensive Bias Detection
              </h2>
              <p className="text-lg text-on-surface-variant max-w-2xl mx-auto">
                Three-layer analysis covers dataset bias, model behavior, and real-world impact.
              </p>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              className="grid md:grid-cols-3 gap-8"
            >
              {[
                {
                  title: 'Dataset Analysis',
                  desc: 'Disparate impact ratios, parity gaps, and slice-level bias metrics across protected attributes.',
                },
                {
                  title: 'Model Audit',
                  desc: 'Counterfactual probing, SHAP explainability, and t-test significance testing.',
                },
                {
                  title: 'Compliance Report',
                  desc: 'Plain-English findings and actionable recommendations from Gemini AI.',
                },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  custom={i}
                  variants={fadeUp}
                  className="bg-surface-container-highest border border-outline/20 rounded-2xl p-8 hover:shadow-lg transition-all"
                >
                  <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                  <p className="text-on-surface-variant leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Stats */}
        <section className="max-w-6xl mx-auto px-6 py-20">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="grid md:grid-cols-3 gap-12 text-center"
          >
            {[
              { num: '60%+', label: 'AI hiring systems demonstrate measurable gender bias' },
              { num: '80%', label: 'legal disparate impact threshold (EEOC rule)' },
              { num: '2-3×', label: 'higher denial rates for underrepresented groups' },
            ].map((stat, i) => (
              <motion.div key={i} custom={i} variants={fadeUp}>
                <div className="text-5xl font-black text-accent-dark mb-3">{stat.num}</div>
                <p className="text-on-surface-variant">{stat.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* How It Works */}
        <section className="bg-surface-container-low py-20">
          <div className="max-w-6xl mx-auto px-6">
            <motion.h2
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-4xl font-black text-center mb-16"
              style={{ fontFamily: 'var(--font-sans)' }}
            >
              Four Steps to Audit
            </motion.h2>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="grid md:grid-cols-4 gap-6"
            >
              {[
                { num: '1', title: 'Upload', desc: 'CSV, JSON, or XLSX' },
                { num: '2', title: 'Classify', desc: 'Gemini parses columns' },
                { num: '3', title: 'Audit', desc: '3-layer analysis' },
                { num: '4', title: 'Report', desc: 'Plain-English output' },
              ].map((step, i) => (
                <motion.div
                  key={i}
                  custom={i}
                  variants={fadeUp}
                  className="text-center"
                >
                  <div className="w-14 h-14 rounded-full bg-accent-light text-accent-dark flex items-center justify-center font-bold text-xl mx-auto mb-4">
                    {step.num}
                  </div>
                  <h3 className="font-bold text-lg mb-2">{step.title}</h3>
                  <p className="text-on-surface-variant">{step.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-6xl mx-auto px-6 py-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-4xl font-black mb-6" style={{ fontFamily: 'var(--font-sans)' }}>
              Ready to audit?
            </h2>
            <p className="text-xl text-on-surface-variant mb-8 max-w-2xl mx-auto">
              Start with the included UCI Adult dataset, or upload your own CSV. Takes 2-3 minutes.
            </p>
            <Link
              to="/upload"
              className="inline-block px-10 py-4 bg-bg-ink text-white font-bold text-lg rounded-lg hover:bg-on-surface transition-colors"
            >
              Start Auditing Now
            </Link>
          </motion.div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-bg-ink text-white border-t border-on-surface/20 py-12">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <p className="text-on-surface-variant mb-2">UnbiasedAI — Algorithmic Integrity</p>
          <p className="text-sm text-on-surface-variant">
            Making AI fair for everyone · Solution Challenge 2026
          </p>
        </div>
      </footer>
    </div>
  );
}
