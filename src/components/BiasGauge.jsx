import { useEffect, useRef, useState } from 'react';
import { SEVERITY, DISPARATE_IMPACT_THRESHOLD } from '../lib/constants';

const RADIUS = 60;
const STROKE = 10;
const CENTER = RADIUS + STROKE;
const VIEW = (RADIUS + STROKE) * 2;

// Full semicircle arc from left (180deg) to right (0deg)
function describeArc(r) {
  const sx = CENTER - r;
  const sy = CENTER;
  const ex = CENTER + r;
  const ey = CENTER;
  return `M ${sx} ${sy} A ${r} ${r} 0 1 1 ${ex} ${ey}`;
}

// Semicircle arc length = pi * r
const ARC_LENGTH = Math.PI * RADIUS;
const DURATION = 1200;

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

export default function BiasGauge({ value, verdict }) {
  const svgRef = useRef(null);
  const arcRef = useRef(null);
  const rafRef = useRef(null);
  const startRef = useRef(null);
  const hasPlayedRef = useRef(false);
  const [displayValue, setDisplayValue] = useState(0);

  const clampedValue = Math.min(Math.max(value, 0), 1);
  const severityColor = SEVERITY[verdict]?.color ?? '#9CA3AF';
  const arcPath = describeArc(RADIUS);

  // Kick off the rAF sweep animation
  function startAnimation() {
    startRef.current = null;

    if (arcRef.current) {
      arcRef.current.setAttribute('stroke-dashoffset', String(ARC_LENGTH));
    }
    setDisplayValue(0);

    function tick(now) {
      if (!startRef.current) startRef.current = now;
      const elapsed = now - startRef.current;
      const progress = Math.min(elapsed / DURATION, 1);
      const eased = easeOutCubic(progress);
      const currentFraction = eased * clampedValue;

      const offset = ARC_LENGTH * (1 - currentFraction);
      if (arcRef.current) {
        arcRef.current.setAttribute('stroke-dashoffset', String(offset));
      }

      setDisplayValue(currentFraction);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
  }

  // IntersectionObserver — trigger animation when 50% visible, play once
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    // Reset to hidden on mount / value change
    hasPlayedRef.current = false;
    if (arcRef.current) {
      arcRef.current.setAttribute('stroke-dashoffset', String(ARC_LENGTH));
    }
    setDisplayValue(0);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasPlayedRef.current) {
          hasPlayedRef.current = true;
          observer.disconnect();
          startAnimation();
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(svgEl);

    return () => {
      observer.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [clampedValue]);

  // Threshold marker position
  const threshAngleDeg = 180 - DISPARATE_IMPACT_THRESHOLD * 180;
  const threshRad = (threshAngleDeg * Math.PI) / 180;
  const tInnerR = RADIUS - STROKE * 0.8;
  const tOuterR = RADIUS + STROKE * 0.8;
  const tix = CENTER + tInnerR * Math.cos(threshRad);
  const tiy = CENTER - tInnerR * Math.sin(threshRad);
  const tox = CENTER + tOuterR * Math.cos(threshRad);
  const toy = CENTER - tOuterR * Math.sin(threshRad);

  const labelR = RADIUS + STROKE + 14;
  const lx = CENTER + labelR * Math.cos(threshRad);
  const ly = CENTER - labelR * Math.sin(threshRad);

  return (
    <div className="flex flex-col items-center">
      <svg ref={svgRef} width={VIEW} height={CENTER + 12} viewBox={`0 0 ${VIEW} ${CENTER + 12}`}>
        {/* Background arc */}
        <path
          d={arcPath}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={STROKE}
          strokeLinecap="round"
        />

        {/* Value arc — animated via rAF triggered by IntersectionObserver */}
        <path
          ref={arcRef}
          d={arcPath}
          fill="none"
          stroke={severityColor}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={ARC_LENGTH}
          strokeDashoffset={ARC_LENGTH}
        />

        {/* Threshold marker line */}
        <line
          x1={tix} y1={tiy}
          x2={tox} y2={toy}
          stroke="#FF4040"
          strokeWidth={2}
          strokeDasharray="3 2"
        />

        {/* Threshold label */}
        <text
          x={lx}
          y={ly}
          textAnchor="middle"
          fill="#FF4040"
          fontSize="7"
          fontFamily="var(--font-mono)"
        >
          0.80
        </text>

        {/* Center value */}
        <text
          x={CENTER}
          y={CENTER - 10}
          textAnchor="middle"
          fill="white"
          fontSize="26"
          fontWeight="600"
          fontFamily="var(--font-mono)"
        >
          {displayValue.toFixed(2)}
        </text>

        {/* Sub-label */}
        <text
          x={CENTER}
          y={CENTER + 8}
          textAnchor="middle"
          fill="#6B7280"
          fontSize="8"
          fontFamily="var(--font-mono)"
        >
          Disparate Impact
        </text>
      </svg>
    </div>
  );
}
