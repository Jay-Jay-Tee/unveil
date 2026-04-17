export const SEVERITY = {
  BIASED: { color: '#FF4040', bg: 'rgba(255,64,64,0.1)', label: 'BIASED' },
  AMBIGUOUS: { color: '#F5A623', bg: 'rgba(245,166,35,0.1)', label: 'AMBIGUOUS' },
  CLEAN: { color: '#2ECC8F', bg: 'rgba(46,204,143,0.1)', label: 'CLEAN' },
};

export const COLUMN_TYPES = {
  PROTECTED: { color: '#FF4040', label: 'PROTECTED' },
  NEUTRAL: { color: '#9CA3AF', label: 'NEUTRAL' },
  OUTCOME: { color: '#4D9EFF', label: 'OUTCOME' },
  AMBIGUOUS: { color: '#F5A623', label: 'AMBIGUOUS' },
};

export const DISPARATE_IMPACT_THRESHOLD = 0.8; // legal 80% rule
export const PARITY_GAP_THRESHOLD = 0.10; // 10pp flag

export const COLORS = {
  bg: '#0D0F14',
  bgCard: 'rgba(255, 255, 255, 0.05)',
  borderSubtle: 'rgba(255, 255, 255, 0.08)',
  accent: '#4D9EFF',
  biased: '#FF4040',
  ambiguous: '#F5A623',
  clean: '#2ECC8F',
};
