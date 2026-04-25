/**
 * designTokens.js
 * Centralized design system for UnbiasedAI
 * Colors, animations, spacing, typography configuration
 */

export const colors = {
  // Primary gradient
  primary: {
    accent: '#FF6B5B',
    accentLight: '#FFE8E4',
    accentDark: '#E64D3D',
  },

  // Secondary gradient
  secondary: {
    teal: '#1FCEC6',
    tealLight: '#D4FBF7',
    tealDark: '#0FA89F',
  },

  // Status colors
  status: {
    biased: '#FF6B5B',     // Red - bias detected
    ambiguous: '#FFA500',  // Orange - unclear
    clean: '#00D99F',      // Green - no bias
  },

  // Lime accent
  lime: '#CAFF00',

  // Text colors
  text: {
    primary: '#1a1a1a',
    secondary: '#666666',
    muted: '#999999',
  },

  // Backgrounds
  bg: {
    primary: '#FAFAF7',
    dark: '#F5F5F0',
    card: '#FFFFFF',
  },

  // Borders
  border: {
    subtle: 'rgba(0, 0, 0, 0.08)',
    light: 'rgba(0, 0, 0, 0.12)',
  },
};

export const animations = {
  // Easing functions
  easing: {
    standard: [0.22, 1, 0.36, 1],
    smooth: [0.4, 0, 0.2, 1],
    bounce: [0.34, 1.56, 0.64, 1],
    elastic: [0.68, -0.55, 0.265, 1.55],
  },

  // Duration presets (ms)
  duration: {
    instant: 150,
    fast: 300,
    base: 600,
    slow: 1000,
  },

  // Transition presets
  transition: {
    fast: { duration: 300, ease: [0.22, 1, 0.36, 1] },
    base: { duration: 600, ease: [0.22, 1, 0.36, 1] },
    slow: { duration: 1000, ease: [0.22, 1, 0.36, 1] },
    bounce: { duration: 500, ease: [0.34, 1.56, 0.64, 1] },
  },

  // Framer Motion variants
  variants: {
    fadeUp: {
      hidden: { opacity: 0, y: 30 },
      visible: (i = 0) => ({
        opacity: 1,
        y: 0,
        transition: {
          delay: i * 0.12,
          duration: 0.6,
          ease: [0.22, 1, 0.36, 1],
        },
      }),
    },
    fadeIn: {
      hidden: { opacity: 0 },
      visible: (i = 0) => ({
        opacity: 1,
        transition: {
          delay: i * 0.1,
          duration: 0.5,
          ease: [0.22, 1, 0.36, 1],
        },
      }),
    },
    slideUp: {
      hidden: { opacity: 0, y: 20 },
      visible: (i = 0) => ({
        opacity: 1,
        y: 0,
        transition: {
          delay: i * 0.08,
          duration: 0.5,
          ease: [0.22, 1, 0.36, 1],
        },
      }),
    },
    slideInFromLeft: {
      hidden: { opacity: 0, x: -40 },
      visible: (i = 0) => ({
        opacity: 1,
        x: 0,
        transition: {
          delay: i * 0.1,
          duration: 0.6,
          ease: [0.22, 1, 0.36, 1],
        },
      }),
    },
    popIn: {
      hidden: { opacity: 0, scale: 0.8 },
      visible: (i = 0) => ({
        opacity: 1,
        scale: 1,
        transition: {
          delay: i * 0.08,
          duration: 0.4,
          ease: [0.34, 1.56, 0.64, 1],
        },
      }),
    },
  },
};

export const spacing = {
  xs: '0.25rem',
  sm: '0.5rem',
  md: '1rem',
  lg: '1.5rem',
  xl: '2rem',
  '2xl': '3rem',
  '3xl': '4rem',
};

export const typography = {
  headingFont: "'DM Serif Display', serif",
  monoFont: "'IBM Plex Mono', monospace",
};

export default {
  colors,
  animations,
  spacing,
  typography,
};
