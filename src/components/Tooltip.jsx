/**
 * Tooltip.jsx
 * Location: src/components/Tooltip.jsx
 *
 * Reusable hover tooltip. Wrap any element with it:
 *   <Tooltip text="Plain-English explanation">
 *     <span>Technical term</span>
 *   </Tooltip>
 */

import { useState } from 'react';

export default function Tooltip({ text, children, position = 'top' }) {
  const [visible, setVisible] = useState(false);

  const positionClasses = {
    top:    'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left:   'right-full top-1/2 -translate-y-1/2 mr-2',
    right:  'left-full top-1/2 -translate-y-1/2 ml-2',
  }[position] ?? 'bottom-full left-1/2 -translate-x-1/2 mb-2';

  return (
    <span
      className="relative inline-flex items-center cursor-help"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span
          className={`absolute z-50 w-64 rounded-lg border border-white/10 bg-[#1A1C23] px-3 py-2 text-xs text-gray-300 leading-relaxed shadow-2xl pointer-events-none ${positionClasses}`}
        >
          {text}
        </span>
      )}
    </span>
  );
}
