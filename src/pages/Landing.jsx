import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import AnimatedCounter from '../components/AnimatedCounter';

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.65, ease: [0.22, 1, 0.36, 1] },
  }),
};

const STATS = [
  { value: 78, suffix: '%', label: 'of AI hiring systems show measurable bias', color: 'var(--color-biased)' },
  { value: 80, suffix: '%', label: 'legal disparate impact threshold (the 80% rule)', color: 'var(--color-amber)' },
  { value: 3,  suffix: '×', label: 'higher denial rate for underrepresented groups', color: 'var(--color-ink)' },
];

const METHODS = [
  {
    num: 'A',
    title: 'Dataset Bias Auditor',
    desc: 'Counterfactual probing, slice-based evaluation, proxy detection via mutual information, disparate impact ratios.',
    tags: ['Counterfactual', 'Slice Eval', 'Proxy Detection'],
  },
  {
    num: 'B',
    title: 'Model Behavior Analyzer',
    desc: 'Black-box synthetic probe pairs, SHAP TreeExplainer + KernelExplainer, t-test significance per attribute.',
    tags: ['SHAP', 'Probing', 'T-Test'],
  },
];

const STEPS = [
  { n: '01', title: 'Upload', desc: 'CSV, JSON, or XLSX' },
  { n: '02', title: 'Classify', desc: 'Gemini parses columns' },
  { n: '03', title: 'Audit',   desc: '3-layer detection' },
  { n: '04', title: 'Report',  desc: 'Plain-English output' },
];

export default function Landing() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col justify-center pt-24 px-6 overflow-hidden">
        {/* Big decorative number */}
        <div className="pointer-events-none absolute right-[-2%] top-[8%] text-[28vw] font-black leading-none select-none"
          style={{ color: 'var(--color-bg-warm)', fontFamily: 'var(--font-sans)', zIndex: 0 }}>
          AI
        </div>

        {/* Floating badge */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, duration: 0.7, ease: [0.22,1,0.36,1] }}
          className="relative z-10 mb-8 inline-flex items-center gap-2.5 self-start"
        >
          <span className="flex h-2 w-2 rounded-full animate-pulse-ring" style={{ background: 'var(--color-green)' }} />
          <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--color-ink-mid)', fontFamily: 'var(--font-mono)' }}>
            GDSC Hackathon · Responsible AI Track
          </span>
        </motion.div>

        <div className="relative z-10 max-w-5xl">
          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8, ease: [0.22,1,0.36,1] }}
            className="text-[clamp(3rem,8vw,7rem)] leading-[1.0] font-black tracking-tight"
            style={{ fontFamily: 'var(--font-sans)', color: 'var(--color-ink)' }}
          >
            Algorithmic<br />
            <span className="relative inline-block">
              <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 400, fontSize: '1.05em', color: 'var(--color-amber-dark)' }}>bias</span>
              <motion.span
                className="absolute bottom-2 left-0 h-1 rounded-full"
                style={{ background: 'var(--color-amber)', originX: 0 }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 1.0, duration: 0.8, ease: [0.22,1,0.36,1] }}
              />
            </span>{' '}
            detected,<br />measured,<br />
            <span style={{ color: 'var(--color-biased)' }}>fixed.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.7, ease: [0.22,1,0.36,1] }}
            className="mt-8 text-lg leading-relaxed max-w-xl"
            style={{ color: 'var(--color-ink-mid)' }}
          >
            Upload your dataset. Three-layer analysis — counterfactual probing,
            slice evaluation, and SHAP explainability — surfaces bias in minutes.
            Gemini generates the compliance report.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75, duration: 0.7, ease: [0.22,1,0.36,1] }}
            className="mt-10 flex flex-wrap gap-4"
          >
            <Link to="/upload"
              className="group relative overflow-hidden inline-flex items-center gap-2 px-8 py-4 text-sm font-bold rounded-lg transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ background: 'var(--color-ink)', color: '#fff' }}
            >
              <span>Start Auditing</span>
              <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
            <Link to="/upload"
              className="inline-flex items-center gap-2 px-8 py-4 text-sm font-bold rounded-lg border-2 transition-all hover:opacity-70"
              style={{ borderColor: 'var(--color-border-strong)', color: 'var(--color-ink)' }}
            >
              Try with UCI Adult
            </Link>
          </motion.div>
        </div>

        {/* Scroll cue */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4 }}
          className="absolute bottom-10 left-6 flex items-center gap-3 z-10"
        >
          <div className="w-px h-10 opacity-30" style={{ background: 'var(--color-ink)' }} />
          <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--color-ink-muted)', fontFamily: 'var(--font-mono)' }}>
            Scroll
          </span>
        </motion.div>
      </section>

      {/* ── STATS STRIP ─────────────────────────────────────── */}
      <section className="border-y-2 py-16 px-6" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-warm)' }}>
        <div className="mx-auto max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-8 md:divide-x" style={{ '--tw-divide-opacity': 1 }}>
          {STATS.map((stat, i) => (
            <motion.div
              key={i}
              initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i} variants={fadeUp}
              className="flex flex-col items-start px-8 first:pl-0"
            >
              <div className="text-6xl font-black leading-none mb-3" style={{ fontFamily: 'var(--font-sans)', color: stat.color }}>
                {mounted ? <><AnimatedCounter target={stat.value} duration={2} isMono={false} />{stat.suffix}</> : `${stat.value}${stat.suffix}`}
              </div>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--color-ink-mid)' }}>{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── TWO SYSTEMS ─────────────────────────────────────── */}
      <section className="py-28 px-6">
        <div className="mx-auto max-w-5xl">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="mb-16">
            <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: 'var(--color-ink-muted)', fontFamily: 'var(--font-mono)' }}>
              Two-Part System
            </p>
            <h2 className="text-5xl md:text-6xl font-black tracking-tight leading-tight" style={{ fontFamily: 'var(--font-sans)', color: 'var(--color-ink)' }}>
              Every attack surface<br />
              <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 400, color: 'var(--color-amber-dark)' }}>covered.</span>
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6">
            {METHODS.map((m, i) => (
              <motion.div
                key={i}
                initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }} custom={i} variants={fadeUp}
                className="relative rounded-2xl p-8 border-2 card-shadow overflow-hidden group transition-all hover:-translate-y-1 hover:card-shadow-lg"
                style={{ background: i === 0 ? 'var(--color-ink)' : 'var(--color-bg-card)', borderColor: i === 0 ? 'var(--color-ink)' : 'var(--color-border)' }}
              >
                <div className="absolute top-6 right-6 text-6xl font-black opacity-10 leading-none select-none" style={{ fontFamily: 'var(--font-sans)', color: i === 0 ? '#fff' : 'var(--color-ink)' }}>
                  {m.num}
                </div>
                <div className="relative">
                  <div className="inline-flex items-center gap-2 mb-5">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-md" style={{ background: i === 0 ? 'rgba(255,255,255,0.1)' : 'var(--color-amber-light)', color: i === 0 ? '#fff' : 'var(--color-amber-dark)', fontFamily: 'var(--font-mono)' }}>
                      PART {m.num}
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold mb-3 leading-tight" style={{ color: i === 0 ? '#fff' : 'var(--color-ink)' }}>
                    {m.title}
                  </h3>
                  <p className="text-sm leading-relaxed mb-5" style={{ color: i === 0 ? 'rgba(255,255,255,0.65)' : 'var(--color-ink-mid)' }}>
                    {m.desc}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {m.tags.map(tag => (
                      <span key={tag} className="text-[11px] font-semibold px-2.5 py-1 rounded-md" style={{ background: i === 0 ? 'rgba(255,255,255,0.1)' : 'var(--color-bg-warm)', color: i === 0 ? 'rgba(255,255,255,0.8)' : 'var(--color-ink-mid)', fontFamily: 'var(--font-mono)' }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────── */}
      <section className="py-28 px-6 border-t-2" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-warm)' }}>
        <div className="mx-auto max-w-5xl">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="mb-16">
            <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: 'var(--color-ink-muted)', fontFamily: 'var(--font-mono)' }}>
              How It Works
            </p>
            <h2 className="text-5xl font-black tracking-tight" style={{ fontFamily: 'var(--font-sans)', color: 'var(--color-ink)' }}>
              Four steps.<br />
              <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 400, color: 'var(--color-amber-dark)' }}>Instant clarity.</span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {STEPS.map((s, i) => (
              <motion.div
                key={i}
                initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i} variants={fadeUp}
                className="relative"
              >
                <div className="text-[10px] font-bold tracking-widest mb-3" style={{ color: 'var(--color-amber)', fontFamily: 'var(--font-mono)' }}>
                  {s.n}
                </div>
                <div className="text-2xl font-black mb-1" style={{ color: 'var(--color-ink)' }}>{s.title}</div>
                <div className="text-sm" style={{ color: 'var(--color-ink-mid)' }}>{s.desc}</div>
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute right-0 top-8 w-px h-8 opacity-20" style={{ background: 'var(--color-ink)' }} />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────── */}
      <section className="py-28 px-6">
        <div className="mx-auto max-w-5xl">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
            className="relative rounded-3xl p-12 md:p-16 overflow-hidden"
            style={{ background: 'var(--color-ink)' }}
          >
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl opacity-10" style={{ background: 'var(--color-amber)', transform: 'translate(30%, -30%)' }} />
            <p className="text-xs font-semibold tracking-widest uppercase mb-6" style={{ color: 'var(--color-amber)', fontFamily: 'var(--font-mono)' }}>
              Ready to audit?
            </p>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight leading-tight text-white mb-8">
              Find bias before<br />
              <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 400, fontSize: '1.05em' }}>it finds you.</span>
            </h2>
            <Link to="/upload"
              className="inline-flex items-center gap-2.5 px-8 py-4 text-sm font-bold rounded-lg transition-all hover:opacity-90"
              style={{ background: 'var(--color-amber)', color: 'var(--color-ink)' }}
            >
              Upload Dataset — it's free
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <footer className="border-t-2 py-8 px-6" style={{ borderColor: 'var(--color-border)' }}>
        <div className="mx-auto max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-xs font-semibold" style={{ color: 'var(--color-ink-muted)', fontFamily: 'var(--font-mono)' }}>
            GDSC Hackathon 2026 — UnbiasedAI
          </span>
          <span className="text-xs" style={{ color: 'var(--color-ink-faint)' }}>
            Making AI fair for everyone
          </span>
        </div>
      </footer>
    </div>
  );
}
