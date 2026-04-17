import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const stats = [
  { value: '78%', label: 'of AI systems show measurable bias in hiring decisions' },
  { value: '0.80', label: 'is the legal Disparate Impact threshold (the 80% rule)' },
  { value: '3x', label: 'higher false-negative rate for underrepresented groups' },
];

const features = [
  {
    title: 'Dataset Auditing',
    description: 'Detect disparate impact and parity gaps across every protected attribute in your training data.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    title: 'Model Probing',
    description: 'Counterfactual testing and SHAP analysis reveal what your model actually learned — including hidden proxies.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
      </svg>
    ),
  },
  {
    title: 'AI Compliance Report',
    description: 'Gemini generates a plain-English audit report that any compliance officer can understand. No data science degree required.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.15, duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function Landing() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-6 text-center">
        {/* Radial glow */}
        <div className="pointer-events-none absolute top-1/4 left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/5 blur-3xl" />

        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-border-subtle bg-bg-card px-4 py-1.5 text-sm text-gray-400"
        >
          <span className="h-2 w-2 rounded-full bg-biased animate-pulse" />
          Bias detection for the AI age
        </motion.div>

        <motion.h1
          initial="hidden"
          animate="visible"
          custom={1}
          variants={fadeUp}
          className="font-[family-name:var(--font-heading)] text-5xl leading-tight tracking-tight text-white md:text-7xl lg:text-8xl"
        >
          Algorithmic Bias
          <br />
          <span className="bg-gradient-to-r from-accent to-clean bg-clip-text text-transparent">
            Has Nowhere to Hide
          </span>
        </motion.h1>

        <motion.p
          initial="hidden"
          animate="visible"
          custom={2}
          variants={fadeUp}
          className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-400"
        >
          Upload your dataset. UnbiasedAI runs disparate impact analysis, counterfactual probing,
          and SHAP explainability — then generates a plain-English compliance report.
          Three layers of coverage. Zero jargon.
        </motion.p>

        <motion.div
          initial="hidden"
          animate="visible"
          custom={3}
          variants={fadeUp}
          className="mt-10 flex items-center gap-4"
        >
          <Link
            to="/upload"
            className="group relative inline-flex items-center gap-2 rounded-lg bg-accent px-8 py-3.5 text-sm font-semibold text-bg transition-all hover:bg-accent/90 hover:shadow-lg hover:shadow-accent/20"
          >
            Start Auditing
            <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
          <Link
            to="/audit/dataset"
            className="inline-flex items-center gap-2 rounded-lg border border-border-subtle px-8 py-3.5 text-sm text-gray-300 transition-all hover:border-gray-600 hover:text-white"
          >
            View Demo
          </Link>
        </motion.div>

        <motion.div
          initial="hidden"
          animate="visible"
          custom={4}
          variants={fadeUp}
          className="mt-4"
        >
          <Link
            to="/audit/dataset"
            className="inline-flex items-center gap-2 text-sm text-gray-500 transition-colors hover:text-accent"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M10.875 12h-1.5m1.5 0c.621 0 1.125.504 1.125 1.125M12 12h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125" />
            </svg>
            Try Live Demo — UCI Adult Dataset
          </Link>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 1 }}
          className="absolute bottom-4 flex flex-col items-center gap-2 text-xs text-gray-600"
        >
          <span>Scroll</span>
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="h-6 w-4 rounded-full border border-gray-700 flex items-start justify-center pt-1"
          >
            <div className="h-1.5 w-0.5 rounded-full bg-gray-600" />
          </motion.div>
        </motion.div>
      </section>

      {/* Stats strip */}
      <section className="border-y border-border-subtle bg-bg-card/50 py-16">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 px-6 md:grid-cols-3">
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-50px' }}
              custom={i}
              variants={fadeUp}
              className="text-center"
            >
              <div className="font-[family-name:var(--font-mono)] text-4xl font-bold text-accent">
                {stat.value}
              </div>
              <p className="mt-2 text-sm text-gray-400">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6">
        <div className="mx-auto max-w-5xl">
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="font-[family-name:var(--font-heading)] text-3xl text-white md:text-4xl text-center mb-16"
          >
            Three Layers of Coverage
          </motion.h2>

          <div className="grid gap-6 md:grid-cols-3">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-30px' }}
                custom={i}
                variants={fadeUp}
                className="group rounded-xl border border-border-subtle bg-bg-card p-6 transition-colors hover:border-accent/30"
              >
                <div className="mb-4 inline-flex rounded-lg bg-accent/10 p-3 text-accent">
                  {feature.icon}
                </div>
                <h3 className="mb-2 text-lg font-semibold text-white">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-gray-400">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pipeline diagram */}
      <section className="border-t border-border-subtle py-24 px-6">
        <div className="mx-auto max-w-4xl text-center">
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="font-[family-name:var(--font-heading)] text-3xl text-white md:text-4xl mb-12"
          >
            How It Works
          </motion.h2>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={1}
            variants={fadeUp}
            className="flex flex-col items-center gap-4 md:flex-row md:justify-center"
          >
            {[
              { step: '01', title: 'Upload', desc: 'CSV, JSON, or XLSX' },
              { step: '02', title: 'Classify', desc: 'AI column detection' },
              { step: '03', title: 'Audit', desc: 'Bias & fairness metrics' },
              { step: '04', title: 'Report', desc: 'Plain-English findings' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="flex flex-col items-center rounded-xl border border-border-subtle bg-bg-card px-6 py-5 text-center min-w-[140px]">
                  <span className="font-[family-name:var(--font-mono)] text-xs text-accent">{item.step}</span>
                  <span className="mt-1 font-semibold text-white">{item.title}</span>
                  <span className="mt-1 text-xs text-gray-500">{item.desc}</span>
                </div>
                {i < 3 && (
                  <svg className="hidden h-4 w-8 text-gray-700 md:block" fill="none" viewBox="0 0 32 16" stroke="currentColor" strokeWidth={1}>
                    <path d="M0 8h28m0 0l-6-6m6 6l-6 6" />
                  </svg>
                )}
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border-subtle py-24 px-6 text-center">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
        >
          <h2 className="font-[family-name:var(--font-heading)] text-3xl text-white md:text-4xl">
            Ready to audit your data?
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-gray-400">
            Uncover hidden bias in your datasets and models before they cause real-world harm.
          </p>
          <Link
            to="/upload"
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-accent px-8 py-3.5 text-sm font-semibold text-bg transition-all hover:bg-accent/90"
          >
            Upload Dataset
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border-subtle py-8 px-6 text-center text-xs text-gray-600">
        GDSC Hackathon 2026 &middot; UnbiasedAI
      </footer>
    </div>
  );
}
