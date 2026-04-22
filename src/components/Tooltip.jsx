import { useState } from 'react';

export default function Tooltip({ text, children, position = 'top' }) {
  const [show, setShow] = useState(false);
  if (!text) return children;

  const posStyles = {
    top:    { bottom: '110%', left: '50%', transform: 'translateX(-50%)' },
    bottom: { top: '110%', left: '50%', transform: 'translateX(-50%)' },
    left:   { right: '110%', top: '50%', transform: 'translateY(-50%)' },
    right:  { left: '110%', top: '50%', transform: 'translateY(-50%)' },
  };

  return (
    <div className="relative inline-block" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div className="absolute z-50 w-56 text-xs leading-relaxed px-3 py-2.5 rounded-lg pointer-events-none shadow-xl"
          style={{ ...posStyles[position], background: 'var(--color-ink)', color: 'rgba(255,255,255,0.85)', fontFamily: 'var(--font-sans)' }}>
          {text}
        </div>
      )}
    </div>
  );
}
