import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * WalkthroughModal - First-time user onboarding guide
 * Shows 5-step walkthrough explaining the audit process
 */
export default function WalkthroughModal({ onComplete }) {
  const [step, setStep] = useState(0);
  const [hasSeenBefore, setHasSeenBefore] = useState(false);

  useEffect(() => {
    // Check localStorage to see if user has seen walkthrough
    const seen = localStorage.getItem('walkthrough_seen');
    if (seen) {
      setHasSeenBefore(true);
      onComplete?.();
    }
  }, [onComplete]);

  const steps = [
    {
      emoji: '👋',
      title: 'Welcome to UnbiasedAI',
      description: 'We help you detect hidden bias in AI systems before they harm real people.',
      highlight: '',
    },
    {
      emoji: '📊',
      title: 'Step 1: Upload',
      description: 'Start by uploading your dataset (CSV, JSON, or XLSX) or pre-trained model.',
      highlight: 'We\'ll analyze it in 3 stages.',
    },
    {
      emoji: '🔍',
      title: 'Step 2: Audit Dataset',
      description: 'We detect protected attributes, proxies, and disparate impact patterns in your data.',
      highlight: 'See which columns are biased at a glance.',
    },
    {
      emoji: '🤖',
      title: 'Step 3: Audit Model',
      description: 'Test your model with counterfactual probes and SHAP analysis to reveal what it actually learned.',
      highlight: 'Model-agnostic testing works with any ML model.',
    },
    {
      emoji: '📋',
      title: 'Ready? Let\'s Go!',
      description: 'Upload your first dataset now and get a plain-English compliance report powered by AI.',
      highlight: 'Takes 30-60 seconds. No expertise needed.',
    },
  ];

  if (hasSeenBefore) return null;

  const handleComplete = () => {
    localStorage.setItem('walkthrough_seen', 'true');
    onComplete?.();
  };

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const currentStep = steps[step];

  return (
    <AnimatePresence>
      <motion.div
        key="walkthrough-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleSkip}
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
      />
      <motion.div
        key="walkthrough-modal"
        initial={{ opacity: 0, scale: 0.8, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div className="relative max-w-md w-full">
          {/* Card */}
          <motion.div
            className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-border-light"
            initial={{ rotateX: 10 }}
            animate={{ rotateX: 0 }}
            transition={{ delay: 0.1 }}
          >
            {/* Top gradient accent */}
            <div className="h-1 bg-gradient-to-r from-accent via-secondary to-lime" />

            {/* Content */}
            <div className="p-8">
              {/* Step counter */}
              <div className="flex justify-between items-center mb-6">
                <span className="text-xs font-bold text-text-muted uppercase tracking-wider">
                  Step {step + 1} of {steps.length}
                </span>
                <button
                  onClick={handleSkip}
                  className="text-text-muted hover:text-text-primary transition-colors text-lg"
                >
                  ✕
                </button>
              </div>

              {/* Emoji animation */}
              <motion.div
                className="text-6xl mb-6"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {currentStep.emoji}
              </motion.div>

              {/* Title */}
              <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-text-primary mb-3">
                {currentStep.title}
              </h2>

              {/* Description */}
              <p className="text-sm text-text-secondary leading-relaxed mb-4">
                {currentStep.description}
              </p>

              {/* Highlight */}
              {currentStep.highlight && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="p-3 rounded-lg bg-accent/10 border border-accent/30 text-xs text-accent font-medium italic"
                >
                  💡 {currentStep.highlight}
                </motion.div>
              )}

              {/* Progress dots */}
              <div className="flex gap-2 my-8 justify-center">
                {steps.map((_, i) => (
                  <motion.button
                    key={i}
                    onClick={() => setStep(i)}
                    className={`h-2 rounded-full transition-all ${
                      i === step
                        ? 'bg-accent w-8'
                        : i < step
                        ? 'bg-accent/50 w-2'
                        : 'bg-border-light w-2'
                    }`}
                    whileHover={{ scale: 1.3 }}
                  />
                ))}
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleSkip}
                  className="flex-1 px-4 py-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-text-primary/5 transition-all font-medium text-sm"
                >
                  Skip
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleNext}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-accent to-accent-dark text-white font-bold text-sm hover:shadow-lg hover:shadow-accent/30 transition-all"
                >
                  {step === steps.length - 1 ? '🚀 Get Started' : 'Next →'}
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* Celebration confetti on last step */}
          {step === steps.length - 1 && (
            <motion.div
              className="absolute -top-20 -left-10"
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              ✨
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
