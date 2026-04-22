import { motion } from 'framer-motion';
import { useState } from 'react';

/**
 * ErrorState - Beautiful error display component
 * Shows friendly error message + collapsible technical details + retry button
 */
export default function ErrorState({ error, onRetry, title = 'Oops! Something went wrong' }) {
  const [showDetails, setShowDetails] = useState(false);

  const isNetworkError = error?.message?.includes('network') || error?.message?.includes('fetch');
  const isValidationError = error?.message?.includes('format') || error?.message?.includes('invalid');

  let icon = '❌';
  let suggestion = 'Please try again or contact support.';

  if (isNetworkError) {
    icon = '📡';
    suggestion = 'Your connection dropped. Check your internet and try again.';
  } else if (isValidationError) {
    icon = '📋';
    suggestion = 'This file format isn\'t supported. We accept CSV, JSON, and XLSX.';
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-bg/80 via-bg-card/50 to-bg-dark/80 backdrop-blur-md z-40 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative max-w-md w-full"
      >
        {/* Error card */}
        <div className="bg-white rounded-2xl border border-border-light shadow-2xl overflow-hidden">
          {/* Gradient top accent */}
          <div className="h-1 bg-gradient-to-r from-accent via-orange-500 to-secondary" />

          <div className="p-8">
            {/* Icon */}
            <motion.div
              className="text-5xl mb-4"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {icon}
            </motion.div>

            {/* Title */}
            <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-text-primary mb-2">
              {title}
            </h2>

            {/* Suggestion */}
            <p className="text-sm text-text-secondary mb-6 leading-relaxed">
              {suggestion}
            </p>

            {/* Error message preview */}
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ delay: 0.2 }}
              className="mb-6 p-3 rounded-lg bg-accent/5 border border-accent/20"
            >
              <p className="text-xs font-mono text-text-muted line-clamp-2">
                {error?.message || 'Unknown error'}
              </p>
            </motion.div>

            {/* Collapsible details */}
            <motion.div
              initial={false}
              animate={{ height: showDetails ? 'auto' : 0, opacity: showDetails ? 1 : 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden mb-6"
            >
              <div className="p-3 bg-text-muted/5 rounded-lg border border-text-muted/10">
                <p className="text-xs font-mono text-text-muted whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                  {error?.stack || error?.toString() || 'No additional details'}
                </p>
              </div>
            </motion.div>

            {/* Toggle details button */}
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs font-medium text-text-muted hover:text-accent transition-colors mb-6"
            >
              {showDetails ? '▼ Hide' : '▶ Show'} technical details
            </button>

            {/* Action buttons */}
            <div className="flex gap-3">
              {onRetry && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onRetry}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-accent to-accent-dark text-white font-semibold text-sm hover:shadow-lg hover:shadow-accent/30 transition-all"
                >
                  🔄 Try Again
                </motion.button>
              )}

              <motion.a
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                href="mailto:support@unbiased-ai.dev"
                className="flex-1 px-4 py-2.5 rounded-lg border-2 border-accent text-accent font-semibold text-sm hover:bg-accent/5 transition-all"
              >
                📧 Contact Support
              </motion.a>
            </div>

            {/* Helpful links */}
            <div className="mt-6 pt-6 border-t border-border-light text-center">
              <p className="text-xs text-text-muted mb-2">Need help?</p>
              <a href="/glossary" className="text-xs font-medium text-accent hover:underline">
                📖 View Glossary
              </a>
            </div>
          </div>
        </div>

        {/* Background decoration */}
        <div className="absolute -z-10 inset-0">
          <motion.div
            className="absolute top-0 right-0 w-40 h-40 bg-accent/5 rounded-full blur-3xl"
            animate={{ x: [0, 10, 0], y: [0, -10, 0] }}
            transition={{ duration: 6, repeat: Infinity }}
          />
        </div>
      </motion.div>
    </div>
  );
}
