import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useState } from 'react';
import AnimatedCounter from '../components/AnimatedCounter';
import ConfettiCanvas from '../components/ConfettiCanvas';

const stats = [
  { value: 78, label: 'of AI systems show measurable bias in hiring decisions', suffix: '%' },
  { value: 80, label: 'is the legal Disparate Impact threshold (the 80% rule)', suffix: ' rule' },
  { value: 3, label: 'higher false-negative rate for underrepresented groups', suffix: 'x' },
];

const features = [
  {
    title: 'Dataset Auditing',
    description: 'Detect disparate impact and parity gaps across every protected attribute in your training data.',
    icon: '📊',
    color: 'from-accent to-orange-400',
    bgColor: 'bg-accent/10',
  },
  {
    title: 'Model Probing',
    description: 'Counterfactual testing and SHAP analysis reveal what your model actually learned — including hidden proxies.',
    icon: '🔍',
    color: 'from-secondary to-teal-400',
    bgColor: 'bg-secondary/10',
  },
  {
    title: 'AI Compliance Report',
    description: 'Gemini generates a plain-English audit report that any compliance officer can understand. No data science degree required.',
    icon: '📋',
    color: 'from-lime to-green-400',
    bgColor: 'bg-lime/10',
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function Landing() {
  const [showConfetti, setShowConfetti] = useState(false);

  const handleCTAClick = () => {
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 3000);
  };

  return (
    <div className="min-h-screen overflow-hidden">
      {showConfetti && <ConfettiCanvas />}
      {/* Hero */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-6 pt-24 pb-12 text-center">
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute top-20 right-20 h-72 w-72 rounded-full bg-accent/15 blur-3xl opacity-60" />
        <div className="pointer-events-none absolute bottom-20 left-20 h-96 w-96 rounded-full bg-secondary/15 blur-3xl opacity-60" />

        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="relative mb-6 inline-flex items-center gap-2 rounded-full border border-border-light bg-accent/5 px-4 py-2 text-sm font-medium text-text-primary"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
          </span>
          Bias detection for the AI age
        </motion.div>

        <motion.h1
          initial="hidden"
          animate="visible"
          custom={1}
          variants={fadeUp}
          className="font-[family-name:var(--font-heading)] text-6xl leading-tight tracking-tight text-text-primary md:text-7xl lg:text-8xl font-bold"
        >
          Algorithmic Bias
          <br />
          <motion.span
            className="bg-gradient-to-r from-accent via-orange-500 to-secondary bg-clip-text text-transparent"
            animate={{ backgroundPosition: ['0% center', '100% center', '0% center'] }}
            transition={{ duration: 5, repeat: Infinity }}
          >
            Has Nowhere to Hide
          </motion.span>
        </motion.h1>

        <motion.p
          initial="hidden"
          animate="visible"
          custom={2}
          variants={fadeUp}
          className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-text-secondary"
        >
          Upload your dataset. UnbiasedAI runs disparate impact analysis, counterfactual probing,
          and SHAP explainability — then generates a plain-English compliance report.
          <span className="block mt-2 font-semibold text-accent">Three layers of coverage. Zero jargon.</span>
        </motion.p>

        <motion.div
          initial="hidden"
          animate="visible"
          custom={3}
          variants={fadeUp}
          className="mt-12 flex flex-col sm:flex-row items-center gap-4"
        >
          <Link
            to="/upload"
            onClick={handleCTAClick}
            className="group relative inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-accent to-accent-dark px-8 py-4 text-sm font-bold text-white transition-all hover:shadow-xl hover:shadow-accent/40 hover:-translate-y-1 active:translate-y-0 hover:scale-105"
          >
            🚀 Start Auditing
            <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
          <Link
            to="/upload"
            className="inline-flex items-center gap-2 rounded-xl border-2 border-text-primary px-8 py-4 text-sm font-bold text-text-primary transition-all hover:border-accent hover:text-accent hover:bg-accent/5 active:-translate-y-0.5"
          >
            📹 Try Demo
          </Link>
        </motion.div>

        <motion.div
          initial="hidden"
          animate="visible"
          custom={4}
          variants={fadeUp}
          className="mt-6"
        >
          <Link
            to="/upload"
            className="inline-flex items-center gap-2 text-sm font-medium text-text-secondary transition-all hover:text-accent hover:gap-3"
          >
            <span>⬇️</span>
            Try Demo — Upload adult.csv
          </Link>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1 }}
          className="absolute bottom-8 flex flex-col items-center gap-3 text-xs font-medium text-text-muted"
        >
          <span>Scroll for more</span>
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="text-lg"
          >
            ↓
          </motion.div>
        </motion.div>
      </section>

      {/* Stats strip */}
      <section className="relative border-y border-border-light bg-gradient-to-r from-accent/5 to-secondary/5 py-20 px-6">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-3">
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-50px' }}
              custom={i}
              variants={fadeUp}
              className="group rounded-xl bg-white/60 backdrop-blur p-6 transition-all hover:shadow-lg hover:bg-white hover:scale-105 cursor-pointer"
            >
              <div className="font-[family-name:var(--font-mono)] text-4xl font-bold bg-gradient-to-r from-accent to-secondary bg-clip-text text-transparent">
                <AnimatedCounter target={stat.value} duration={2.5} isMono={true} />{stat.suffix}
              </div>
              <p className="mt-3 text-sm font-medium text-text-secondary leading-relaxed">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-28 px-6">
        <div className="mx-auto max-w-5xl">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="text-center mb-16"
          >
            <h2 className="font-[family-name:var(--font-heading)] text-5xl text-text-primary md:text-6xl font-bold mb-4">
              Three Layers of Coverage
            </h2>
            <p className="text-text-secondary text-lg">Everything you need to ensure your AI is fair and compliant</p>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-3">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-30px' }}
                custom={i}
                variants={fadeUp}
                className="group relative rounded-2xl border border-border-light bg-white p-8 transition-all hover:shadow-xl hover:-translate-y-2"
              >
                {/* Gradient overlay on hover */}
                <div className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br ${feature.color} blur-xl`} style={{opacity: 0}} />

                <div className="relative">
                  <div className={`mb-4 inline-flex rounded-xl ${feature.bgColor} p-3 text-3xl`}>
                    {feature.icon}
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-text-primary">{feature.title}</h3>
                  <p className="text-sm leading-relaxed text-text-secondary">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-border-light bg-gradient-to-r from-secondary/5 to-lime/5 py-28 px-6">
        <div className="mx-auto max-w-5xl">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="text-center mb-16"
          >
            <h2 className="font-[family-name:var(--font-heading)] text-5xl text-text-primary md:text-6xl font-bold mb-4">
              How It Works
            </h2>
            <p className="text-text-secondary text-lg">Four simple steps to detect and report bias</p>
          </motion.div>

          <div className="flex flex-col md:flex-row items-center justify-center gap-3 md:gap-0">
            {[
              { step: '1️⃣', title: 'Upload', desc: 'CSV, JSON, XLSX' },
              { step: '2️⃣', title: 'Classify', desc: 'AI detection' },
              { step: '3️⃣', title: 'Audit', desc: 'Analyze bias' },
              { step: '4️⃣', title: 'Report', desc: 'Get insights' },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                custom={i}
                variants={fadeUp}
                className="flex items-center gap-3 md:gap-4"
              >
                <motion.div
                  className="flex flex-col items-center rounded-2xl border-2 border-accent bg-gradient-to-br from-accent/10 to-orange-100 px-6 py-6 text-center min-w-[160px] shadow-md"
                  whileHover={{ scale: 1.05, boxShadow: '0 20px 40px rgba(255, 107, 91, 0.3)' }}
                >
                  <span className="text-3xl mb-2">{item.step}</span>
                  <span className="font-bold text-text-primary">{item.title}</span>
                  <span className="text-xs text-text-secondary mt-1">{item.desc}</span>
                </motion.div>
                {i < 3 && (
                  <motion.svg
                    className="hidden h-6 w-6 text-accent md:block"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                    animate={{ x: [0, 4, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </motion.svg>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-28 px-6 text-center">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="mx-auto max-w-2xl"
        >
          <h2 className="font-[family-name:var(--font-heading)] text-5xl text-text-primary md:text-6xl font-bold mb-6">
            Ready to audit your data?
          </h2>
          <p className="text-text-secondary text-lg mb-8 leading-relaxed">
            Uncover hidden bias in your datasets and models before they cause real-world harm. Get started in seconds.
          </p>
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Link
              to="/upload"
              onClick={handleCTAClick}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-accent to-accent-dark px-8 py-4 text-sm font-bold text-white shadow-lg shadow-accent/30 transition-all hover:shadow-xl hover:shadow-accent/50 hover:scale-105"
            >
              Upload Dataset
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border-light py-12 px-6 text-center text-sm text-text-muted">
        <p className="font-medium">GDSC Hackathon 2026 · UnbiasedAI</p>
        <p className="mt-2 text-xs">Making AI fair and trustworthy for everyone</p>
      </footer>
    </div>
  );
}
