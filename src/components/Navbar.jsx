import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useState } from 'react';

const links = [
  { to: '/', label: 'Home', step: 0 },
  { to: '/upload', label: 'Upload', step: 1 },
  { to: '/audit/dataset', label: 'Dataset Audit', step: 2 },
  { to: '/audit/model', label: 'Model Audit', step: 3 },
  { to: '/report', label: 'Report', step: 4 },
  { to: '/glossary', label: 'Glossary', step: 5 },
];

export default function Navbar() {
  const { pathname } = useLocation();
  const [showHelp, setShowHelp] = useState(false);

  // Get current step from pathname
  const currentLink = links.find(l => l.to === pathname);
  const currentStep = currentLink?.step ?? 0;
  const totalSteps = links.length - 1;

  // Breadcrumb items (only show after home)
  const breadcrumbs = currentStep > 0 ? links.slice(1, currentStep + 1) : [];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border-subtle bg-gradient-to-b from-bg via-bg/95 to-bg/90 backdrop-blur-2xl shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group flex-shrink-0">
          <motion.div
            className="h-9 w-9 rounded-xl bg-gradient-to-br from-accent to-accent-dark flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow"
            whileHover={{ scale: 1.05 }}
          >
            <span className="text-sm font-bold text-white">⚖️</span>
          </motion.div>
          <span className="font-[family-name:var(--font-heading)] text-lg font-bold bg-gradient-to-r from-accent to-secondary bg-clip-text text-transparent hidden sm:inline">
            UnbiasedAI
          </span>
        </Link>

        {/* Breadcrumb Progress (for audit flow) */}
        {currentStep > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="hidden md:flex items-center gap-2 text-xs text-text-muted flex-1 justify-center px-4"
          >
            {breadcrumbs.map((item, idx) => (
              <motion.div
                key={item.to}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="flex items-center gap-2"
              >
                <span className="text-text-secondary font-medium">{item.label}</span>
                {idx < breadcrumbs.length - 1 && (
                  <span className="text-accent/50">→</span>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Right side: Nav links + Help + New Audit */}
        <div className="flex items-center gap-4">
          {/* Help button */}
          <motion.button
            onClick={() => setShowHelp(!showHelp)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="relative flex items-center justify-center w-9 h-9 rounded-lg text-text-secondary hover:text-accent hover:bg-accent/5 transition-all"
            title="Help & Glossary"
          >
            <span className="text-lg">❓</span>
            {showHelp && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full right-0 mt-2 w-48 bg-white border border-border-light rounded-lg shadow-lg p-3 text-left z-50"
              >
                <p className="text-xs font-bold text-text-primary mb-2">Need help?</p>
                <ul className="text-xs text-text-secondary space-y-1 mb-3">
                  <li>• <strong>Protected Bias:</strong> Model discriminates based on protected attributes</li>
                  <li>• <strong>Proxy Column:</strong> Feature correlated with protected attributes</li>
                  <li>• <strong>80% Rule:</strong> Legal threshold for disparate impact</li>
                  <li>• <strong>SHAP:</strong> Shows which features influenced predictions</li>
                </ul>
                <Link
                  to="/glossary"
                  className="block w-full text-center text-xs font-semibold px-3 py-1.5 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-all"
                  onClick={() => setShowHelp(false)}
                >
                  View Full Glossary →
                </Link>
              </motion.div>
            )}
          </motion.button>

          {/* New Audit button */}
          {currentStep > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Link
                to="/upload"
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-all"
              >
                ↻ New Audit
              </Link>
            </motion.div>
          )}

          {/* Step counter (mobile) */}
          {currentStep > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="md:hidden flex items-center gap-1 text-xs font-medium text-text-muted"
            >
              <span>{currentStep}</span>
              <span className="text-text-muted/50">/</span>
              <span>{totalSteps}</span>
            </motion.div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {currentStep > 0 && (
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: (currentStep / totalSteps) * 100 / 100 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-accent via-secondary to-lime origin-left"
          style={{ width: `${(currentStep / totalSteps) * 100}%` }}
        />
      )}
    </nav>
  );
}
