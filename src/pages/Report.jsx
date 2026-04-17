import { motion } from 'framer-motion';

const SPARKLE_ICON = (
  <svg className="h-8 w-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
  </svg>
);

const PREVIEW_SECTIONS = [
  {
    heading: '1. EXECUTIVE SUMMARY',
    body: 'The dataset under review exhibits statistically significant disparate impact across two protected attributes: sex and race. Both fail the legal 80% rule threshold of 0.80, indicating systemic bias in outcome distribution. Immediate remediation is recommended before any model trained on this data is deployed to production.',
  },
  {
    heading: '2. CRITICAL FINDINGS',
    body: 'Sex: The disparate impact score of 0.62 is well below the 0.80 legal threshold. Female applicants receive positive outcomes at a rate of 61% compared to 83% for male applicants \u2014 a 22 percentage point gap. The false negative rate for the female group (21%) is nearly three times that of the male group (8%), suggesting the data systematically under-represents positive outcomes for women.\n\nRace: With a disparate impact score of 0.71, racial bias is present across all non-white demographic groups. The \u201cOther\u201d category shows the lowest positive rate at 61% and the highest false positive rate at 22%, indicating compounding disadvantage for minority populations.',
  },
  {
    heading: '3. PROXY RISK ANALYSIS',
    body: 'The \u201crelationship\u201d feature has the highest SHAP importance (0.31) and is a confirmed proxy for sex. This means even if the sex column were removed from model training, the model would still learn gender-based patterns through the relationship feature. Similarly, \u201coccupation\u201d (SHAP importance 0.11) acts as a secondary proxy for sex. Together, these proxy features account for 42% of model decision weight \u2014 a significant indirect discrimination pathway.',
  },
  {
    heading: '4. RECOMMENDATIONS',
    body: '\u2022 Remove or re-encode the \u201crelationship\u201d feature before model training, as it serves primarily as a gender proxy and contributes disproportionate decision weight.\n\u2022 Apply bias mitigation techniques (e.g., reweighing or disparate impact remover) to the sex and race attributes before any downstream model training.\n\u2022 Establish ongoing monitoring with automated disparate impact checks at a threshold of 0.80, triggered on every data pipeline refresh.',
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function Report() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen pt-24 px-6 pb-20"
    >
      <div className="mx-auto max-w-4xl">
        <h1 className="font-[family-name:var(--font-heading)] text-4xl text-white mb-2">
          AI Compliance Report
        </h1>
        <p className="text-gray-400 mb-10">
          Gemini-generated plain-English audit report for non-technical stakeholders.
        </p>

        {/* Explanation card */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="flex flex-col items-center rounded-xl border border-border-subtle bg-bg-card p-12 text-center mb-8"
        >
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10">
            {SPARKLE_ICON}
          </div>
          <h2 className="font-[family-name:var(--font-heading)] text-2xl text-white mb-4">
            AI Narrative Report
          </h2>
          <p className="max-w-2xl text-sm text-gray-400 leading-relaxed">
            This module uses Gemini 2.0 Flash to convert the bias analysis into a plain-English
            compliance report readable by non-technical stakeholders — no data science background
            required. Live generation is disabled in this demo due to regional API billing
            restrictions, but the integration is fully built and functional.
          </p>
        </motion.div>

        {/* Static preview card */}
        <motion.div
          initial="hidden"
          animate="visible"
          custom={1}
          variants={fadeUp}
          className="relative rounded-xl border border-border-subtle overflow-hidden"
        >
          {/* Overlay banner */}
          <div className="absolute inset-0 z-10 flex items-start justify-center pointer-events-none">
            <div className="mt-6 flex items-center gap-2 rounded-full border border-accent/30 bg-bg/90 backdrop-blur-sm px-5 py-2">
              <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-xs font-semibold text-accent tracking-wide uppercase">
                Preview — Live Output Disabled
              </span>
            </div>
          </div>

          {/* Dimmed preview content */}
          <div className="bg-bg-card px-8 py-10 opacity-50">
            {/* Gemini header bar */}
            <div className="flex items-center gap-3 border-b border-border-subtle pb-4 mb-6">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
                <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-white">Gemini AI Report</span>
              <span className="ml-auto inline-block h-2 w-2 rounded-full bg-clean animate-pulse" />
            </div>

            {/* Report sections */}
            <div className="space-y-6 font-[family-name:var(--font-mono)] text-sm leading-relaxed text-gray-500">
              {PREVIEW_SECTIONS.map((section) => (
                <div key={section.heading}>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                    {section.heading}
                  </h4>
                  <p className="whitespace-pre-wrap">{section.body}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
