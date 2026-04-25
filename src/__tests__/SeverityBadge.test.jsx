import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SeverityBadge from '../components/SeverityBadge';

describe('SeverityBadge', () => {
  describe('when rendered with a "type" prop', () => {
    it('shows "Protected" for PROTECTED type', () => {
      render(<SeverityBadge type="PROTECTED" />);
      expect(screen.getByText('Protected')).toBeInTheDocument();
    });

    it('shows "Outcome" for OUTCOME type', () => {
      render(<SeverityBadge type="OUTCOME" />);
      expect(screen.getByText('Outcome')).toBeInTheDocument();
    });

    it('shows "Ambiguous" for AMBIGUOUS type', () => {
      render(<SeverityBadge type="AMBIGUOUS" />);
      expect(screen.getByText('Ambiguous')).toBeInTheDocument();
    });

    it('shows "Neutral" for NEUTRAL type', () => {
      render(<SeverityBadge type="NEUTRAL" />);
      expect(screen.getByText('Neutral')).toBeInTheDocument();
    });
  });

  describe('when rendered with a "verdict" prop', () => {
    it('shows "Biased" for BIASED verdict', () => {
      render(<SeverityBadge verdict="BIASED" />);
      expect(screen.getByText('Biased')).toBeInTheDocument();
    });

    it('shows "Ambiguous" for AMBIGUOUS verdict', () => {
      render(<SeverityBadge verdict="AMBIGUOUS" />);
      expect(screen.getByText('Ambiguous')).toBeInTheDocument();
    });

    it('shows "Clean" for CLEAN verdict', () => {
      render(<SeverityBadge verdict="CLEAN" />);
      expect(screen.getByText('Clean')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('renders nothing when neither type nor verdict is given', () => {
      const { container } = render(<SeverityBadge />);
      expect(container.firstChild).toBeNull();
    });

    it('renders nothing for an unknown type', () => {
      const { container } = render(<SeverityBadge type="WHATEVER" />);
      expect(container.firstChild).toBeNull();
    });

    it('renders nothing for an unknown verdict', () => {
      const { container } = render(<SeverityBadge verdict="TOTALLY_CLEAN" />);
      expect(container.firstChild).toBeNull();
    });

    it('prefers "type" over "verdict" when both are provided', () => {
      render(<SeverityBadge type="PROTECTED" verdict="BIASED" />);
      expect(screen.getByText('Protected')).toBeInTheDocument();
      expect(screen.queryByText('Biased')).not.toBeInTheDocument();
    });
  });
});
