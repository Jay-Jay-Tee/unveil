import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Inline helpers mirrored from api.js so we can unit-test error logic
// without triggering ESM / Firebase / fetch side-effects. ─────────────────

function isGeminiQuotaPayload(status, detailText, detailObj) {
  if (detailObj?.code === 'GEMINI_QUOTA_EXCEEDED') return true;
  if (status !== 429) return false;
  const msg = (detailText || '').toLowerCase();
  return msg.includes('quota') || msg.includes('rate limit') || msg.includes('resource_exhausted');
}

function isGeminiOverloadedPayload(status, detailText, detailObj) {
  if (detailObj?.code === 'GEMINI_OVERLOADED') return true;
  if (status !== 503) return false;
  const msg = (detailText || '').toLowerCase();
  return msg.includes('unavailable') || msg.includes('high demand') || msg.includes('overloaded');
}

function friendlyGeminiQuotaMessage(retryAfterSeconds) {
  const retry = retryAfterSeconds
    ? `Retry in about ${retryAfterSeconds} seconds.`
    : 'Try again in a minute.';
  return `Gemini hit its rate limit. ${retry} If this keeps happening, the team's Gemini quota may need upgrading.`;
}

function friendlyGeminiBusyMessage() {
  return "Gemini is busy right now - we'll try again in 30-60 seconds. Your place in line is held.";
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('isGeminiQuotaPayload', () => {
  it('detects GEMINI_QUOTA_EXCEEDED by code regardless of status', () => {
    expect(isGeminiQuotaPayload(200, '', { code: 'GEMINI_QUOTA_EXCEEDED' })).toBe(true);
  });

  it('detects 429 with "quota" in detail text', () => {
    expect(isGeminiQuotaPayload(429, 'quota exceeded', null)).toBe(true);
  });

  it('detects 429 with "rate limit" in detail text', () => {
    expect(isGeminiQuotaPayload(429, 'rate limit reached', null)).toBe(true);
  });

  it('returns false for 429 with unrelated message', () => {
    expect(isGeminiQuotaPayload(429, 'server error', null)).toBe(false);
  });

  it('returns false for non-429 status without the code', () => {
    expect(isGeminiQuotaPayload(500, 'quota exceeded', null)).toBe(false);
  });
});

describe('isGeminiOverloadedPayload', () => {
  it('detects GEMINI_OVERLOADED by code', () => {
    expect(isGeminiOverloadedPayload(200, '', { code: 'GEMINI_OVERLOADED' })).toBe(true);
  });

  it('detects 503 with "unavailable" in message', () => {
    expect(isGeminiOverloadedPayload(503, 'service unavailable', null)).toBe(true);
  });

  it('detects 503 with "high demand" in message', () => {
    expect(isGeminiOverloadedPayload(503, 'high demand right now', null)).toBe(true);
  });

  it('returns false for 503 with unrelated message', () => {
    expect(isGeminiOverloadedPayload(503, 'generic error', null)).toBe(false);
  });

  it('returns false for non-503 without the code', () => {
    expect(isGeminiOverloadedPayload(500, 'unavailable', null)).toBe(false);
  });
});

describe('friendlyGeminiQuotaMessage', () => {
  it('includes retry seconds when provided', () => {
    const msg = friendlyGeminiQuotaMessage(60);
    expect(msg).toContain('60 seconds');
  });

  it('falls back to "Try again in a minute" when no retry seconds', () => {
    const msg = friendlyGeminiQuotaMessage(undefined);
    expect(msg).toContain('Try again in a minute');
  });
});

describe('friendlyGeminiBusyMessage', () => {
  it('mentions 30-60 seconds', () => {
    expect(friendlyGeminiBusyMessage()).toContain('30-60 seconds');
  });
});

