import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

/**
 * AnimatedCounter - Animates a number from 0 to target
 * Used in Landing page stats for visual impact
 */
export default function AnimatedCounter({ target, duration = 2, isMono = false }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const increment = target / (duration * 60); // 60 frames per second
    const interval = setInterval(() => {
      start += increment;
      if (start >= target) {
        setCount(target);
        clearInterval(interval);
      } else {
        setCount(Math.floor(start));
      }
    }, 1000 / 60);

    return () => clearInterval(interval);
  }, [target, duration]);

  const fontClass = isMono ? 'font-[family-name:var(--font-mono)]' : '';

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className={fontClass}
    >
      {count}
    </motion.span>
  );
}
