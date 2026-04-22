import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

const links = [
  { to: '/', label: 'Home' },
  { to: '/upload', label: 'Upload' },
  { to: '/audit/dataset', label: 'Dataset Audit' },
  { to: '/audit/model', label: 'Model Audit' },
  { to: '/report', label: 'Report' },
];

export default function Navbar() {
  const { pathname } = useLocation();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border-subtle bg-bg/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2.5 group">
          <motion.div
            className="h-9 w-9 rounded-xl bg-gradient-to-br from-accent to-accent-dark flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow"
            whileHover={{ scale: 1.05 }}
          >
            <span className="text-sm font-bold text-white">⚖️</span>
          </motion.div>
          <span className="font-[family-name:var(--font-heading)] text-xl font-bold bg-gradient-to-r from-accent to-secondary bg-clip-text text-transparent">
            UnbiasedAI
          </span>
        </Link>

        <div className="flex items-center gap-6">
          {links.map(({ to, label }) => {
            const isActive = pathname === to;
            return (
              <motion.div
                key={to}
                className="relative"
                whileHover={{ y: -2 }}
              >
                <Link
                  to={to}
                  className={`text-sm font-medium transition-all ${
                    isActive
                      ? 'text-accent'
                      : 'text-text-secondary hover:text-accent'
                  }`}
                >
                  {label}
                </Link>
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute inset-x-0 -bottom-1 h-0.5 bg-gradient-to-r from-accent to-secondary rounded-full"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
