import { motion } from 'framer-motion';

/**
 * LoadingAnimation - Full-screen loading state during analysis
 * Shows animated progress indicator + current step
 */
export default function LoadingAnimation({ step = 1, totalSteps = 3, message = 'Analyzing...' }) {
  const steps = [
    { num: 1, label: 'Ingesting Dataset', emoji: '📥' },
    { num: 2, label: 'Classifying Columns', emoji: '🔍' },
    { num: 3, label: 'Detecting Bias', emoji: '⚠️' },
  ];

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-bg via-bg-card to-bg-dark backdrop-blur-sm z-50 flex items-center justify-center">
      {/* Animated background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-20 left-20 h-72 w-72 rounded-full bg-accent/10 blur-3xl"
          animate={{ x: [0, 20, 0], y: [0, -20, 0] }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        <motion.div
          className="absolute bottom-20 right-20 h-96 w-96 rounded-full bg-secondary/10 blur-3xl"
          animate={{ x: [0, -20, 0], y: [0, 20, 0] }}
          transition={{ duration: 10, repeat: Infinity }}
        />
      </div>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative text-center max-w-md px-6 z-10"
      >
        {/* Main progress indicator */}
        <motion.div
          className="mb-8 flex justify-center"
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        >
          <div className="relative w-24 h-24">
            {/* Outer ring */}
            <svg className="w-full h-full" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="rgba(255, 107, 91, 0.1)"
                strokeWidth="2"
              />
              <motion.circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="url(#gradient1)"
                strokeWidth="3"
                strokeLinecap="round"
                initial={{ strokeDashoffset: 282 }}
                animate={{ strokeDashoffset: 0 }}
                transition={{ duration: 2, repeat: Infinity }}
                strokeDasharray="282"
              />
              <defs>
                <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FF6B5B" />
                  <stop offset="100%" stopColor="#1FCEC6" />
                </linearGradient>
              </defs>
            </svg>

            {/* Center icon */}
            <motion.div
              className="absolute inset-0 flex items-center justify-center text-3xl"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {steps[step - 1]?.emoji || '⚙️'}
            </motion.div>
          </div>
        </motion.div>

        {/* Step label */}
        <motion.h2
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="font-[family-name:var(--font-heading)] text-3xl font-bold text-text-primary mb-2"
        >
          {steps[step - 1]?.label || 'Processing...'}
        </motion.h2>

        {/* Progress counter */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-sm font-medium text-text-secondary mb-8"
        >
          Step {step} of {totalSteps}
        </motion.p>

        {/* Step progress bar */}
        <div className="flex gap-2 mb-8 justify-center">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0.8 }}
              animate={{ scale: i < step ? 1 : 0.8 }}
              className={`h-2 rounded-full transition-all ${
                i < step
                  ? 'bg-gradient-to-r from-accent to-secondary w-4'
                  : 'bg-border-light w-2'
              }`}
            />
          ))}
        </div>

        {/* Helper text */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-xs text-text-muted"
        >
          This usually takes 30-60 seconds...
        </motion.p>

        {/* Animated dots */}
        <motion.div
          className="mt-6 flex justify-center gap-1"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 rounded-full bg-accent"
              animate={{ y: [0, -4, 0] }}
              transition={{
                duration: 0.6,
                repeat: Infinity,
                delay: i * 0.1,
              }}
            />
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}
