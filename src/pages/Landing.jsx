import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAudit } from '../lib/AuditContext';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function Landing() {
  const { user, authReady } = useAudit();

  if (!authReady) {
    return <div style={{ background: 'var(--color-surface)', minHeight: '100vh' }} />;
  }

  return (
    <div style={{ background: 'var(--color-surface)', color: 'var(--color-on-surface)', minHeight: '100vh' }}>

      {/* Navbar */}
      <header className="fixed top-0 left-0 right-0 z-40 backdrop-blur-sm border-b"
        style={{ background: 'rgba(251, 246, 238, 0.85)', borderColor: 'var(--color-border)' }}>
        <nav className="flex justify-between items-center px-3 sm:px-5 py-3.5 w-full">

          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md flex items-center justify-center"
              style={{ background: 'var(--color-bg-ink)' }}>
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: '#fff' }}>
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>
            <span className="text-lg font-bold tracking-tight">Unveil</span>
          </Link>

          <div className="flex items-center gap-2">
            <Link to="/glossary" className="btn btn-ghost text-sm hidden sm:inline-flex">
              Glossary
            </Link>
            {user ? (
              <Link to="/dashboard" className="btn btn-primary text-sm">
                Dashboard →
              </Link>
            ) : (
              <>
                <Link to="/login" className="btn btn-ghost text-sm hidden sm:inline-flex">
                  Sign in
                </Link>
                <Link to="/upload" className="btn btn-primary text-sm">
                  Start auditing
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>

      <main className="pt-32">

        {/* Hero */}
        <section className="px-3 sm:px-5 pb-24 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.8 }}>

            <p className="text-label-mono mb-5 inline-flex items-center gap-2 px-3 py-1 rounded-full border"
              style={{ color: 'var(--color-accent-dark)', background: 'var(--color-accent-light)', borderColor: 'var(--color-accent)' }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--color-accent-dark)' }} />
              Audit datasets or models in under a minute
            </p>

            <h1 className="text-display-xl mb-6" style={{ color: 'var(--color-on-surface)' }}>
              Uncover the bias hiding<br />
              in your data.
            </h1>

            <p className="text-lg md:text-xl mb-10 max-w-2xl mx-auto leading-relaxed"
              style={{ color: 'var(--color-text-mid)' }}>
              Upload a dataset or model. Unveil finds unfair outcomes across sensitive attributes,
              explains what's driving them in plain English, and tells you what to do next.
            </p>

            <div className="flex gap-3 justify-center flex-wrap">
              <Link to="/upload" className="btn btn-primary text-base px-7 py-3.5">
                Upload a dataset
              </Link>
              <a href="#how" className="btn btn-secondary text-base px-7 py-3.5">
                How it works
              </a>
            </div>

            <p className="text-xs mt-6" style={{ color: 'var(--color-text-mid)' }}>
              No signup required to try · UCI Adult sample pre-loaded
            </p>
          </motion.div>
        </section>

        {/* Feature grid */}
        <section className="py-20" style={{ background: 'var(--color-surface-container-low)' }}>
          <div className="px-3 sm:px-5 max-w-7xl mx-auto">
            <motion.div
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
              className="text-center mb-14"
            >
              <p className="text-label-mono mb-3" style={{ color: 'var(--color-text-mid)' }}>
                Three layers, one audit
              </p>
              <h2 className="text-display-lg" style={{ color: 'var(--color-on-surface)' }}>
                What Unveil actually checks
              </h2>
            </motion.div>

            <motion.div
              initial="hidden" whileInView="visible" viewport={{ once: true }}
              className="grid md:grid-cols-3 gap-6"
            >
              {[
                {
                  icon: null,
                  title: 'Dataset fairness',
                  desc: 'Approval gaps, disparate impact ratios, and per-group breakdowns for every sensitive attribute. Numbers, not vibes.',
                },
                {
                  icon: null,
                  title: 'Proxy detection',
                  desc: "Catches columns that quietly encode a sensitive attribute - zip code for race, relationship for sex. Removing the obvious column isn't enough.",
                },
                {
                  icon: null,
                  title: 'Model behavior',
                  desc: 'Black-box probing + SHAP explainability. See which features are actually driving decisions and whether any of them are proxies.',
                },
              ].map((item, i) => (
                <motion.div
                  key={item.title} custom={i} variants={fadeUp}
                  className="rounded-2xl p-7 border card-shadow"
                  style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}
                >
                  <h3 className="text-xl font-bold mb-2.5">{item.title}</h3>
                  <p className="leading-relaxed" style={{ color: 'var(--color-text-mid)' }}>{item.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Stats strip */}
        <section className="px-3 sm:px-5 py-20">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
            className="grid md:grid-cols-3 gap-8 text-center"
          >
            {[
              { num: '80%', label: 'The legal fairness threshold - the EEOC four-fifths rule' },
              { num: '60%+', label: 'Of AI hiring systems demonstrate measurable gender bias' },
              { num: '2-3×', label: 'Higher denial rates for underrepresented groups in lending' },
            ].map((stat, i) => (
              <motion.div key={stat.num} custom={i} variants={fadeUp}>
                <div className="text-display-lg mb-2" style={{ color: 'var(--color-accent-dark)' }}>{stat.num}</div>
                <p className="leading-relaxed" style={{ color: 'var(--color-text-mid)' }}>{stat.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* How it works */}
        <section id="how" className="py-20" style={{ background: 'var(--color-surface-container-low)' }}>
          <div className="px-3 sm:px-5 max-w-7xl mx-auto">
            <motion.div
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
              className="text-center mb-14"
            >
              <p className="text-label-mono mb-3" style={{ color: 'var(--color-text-mid)' }}>
                How it works
              </p>
              <h2 className="text-display-lg" style={{ color: 'var(--color-on-surface)' }}>
                Four steps to a compliance report
              </h2>
            </motion.div>

            <motion.div
              initial="hidden" whileInView="visible" viewport={{ once: true }}
              className="grid md:grid-cols-4 gap-6"
            >
              {[
                { n: '01', t: 'Upload', d: 'Drag in a CSV, JSON, or XLSX file. Or use our included UCI Adult sample.' },
                { n: '02', t: 'Classify', d: 'Unveil identifies sensitive attributes, targets, and potential proxies.' },
                { n: '03', t: 'Audit', d: 'Three-layer analysis: fairness gaps, proxy strength, and model SHAP behavior.' },
                { n: '04', t: 'Report', d: 'Plain-English compliance narrative - ready to share with a non-technical team.' },
              ].map((step, i) => (
                <motion.div key={step.n} custom={i} variants={fadeUp} className="text-center">
                  <div className="font-mono text-sm font-bold mb-3" style={{ color: 'var(--color-accent-dark)' }}>
                    {step.n}
                  </div>
                  <h3 className="font-bold text-lg mb-2">{step.t}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-mid)' }}>{step.d}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-3 sm:px-5 py-24 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8 }}>
            <h2 className="text-display-lg mb-5" style={{ color: 'var(--color-on-surface)' }}>
              Ready to see what's under the hood?
            </h2>
            <p className="text-lg max-w-2xl mx-auto mb-8" style={{ color: 'var(--color-text-mid)' }}>
              Audit a dataset you already have. Or try our included UCI Adult Income sample - a
              textbook example of gender and racial bias in income prediction.
            </p>
            <Link to="/upload" className="btn btn-primary text-base px-8 py-3.5">
              Start auditing →
            </Link>
          </motion.div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-10" style={{ background: 'var(--color-bg-ink)', color: '#fff', borderColor: 'var(--color-border-strong)' }}>
        <div className="px-3 sm:px-5 max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'var(--color-accent)' }}>
              <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--color-bg-ink)' }}>
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>
            <span className="font-bold">Unveil</span>
          </div>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Uncovering algorithmic bias · Build with AI Solution Challenge 
          </p>
        </div>
      </footer>
    </div>
  );
}

