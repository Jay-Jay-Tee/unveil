/**
 * gemini.js — Browser-side Gemini client (fallback when backend is offline).
 *
 * Main changes vs old version:
 *   1. Report is generated in 4 sections instead of one call — if one section
 *      hits a rate limit, we still ship the others.
 *   2. Each section has its own max_output_tokens budget (no more cut-offs).
 *   3. Auto-retry with exponential backoff on transient errors.
 *   4. Cache by content hash so regeneration is free.
 */

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const MODEL = 'gemini-2.5-flash';

function hashString(s = '') {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) + s.charCodeAt(i);
    h |= 0;
  }
  return (h >>> 0).toString(36);
}

function isRetryable(status, message = '') {
  const m = String(message).toLowerCase();
  if (status === 429 || status === 503) return true;
  return m.includes('quota') || m.includes('rate limit') || m.includes('overloaded')
      || m.includes('unavailable') || m.includes('resource_exhausted');
}

function parseRetryAfter(message = '') {
  const m = String(message).match(/retry(?:\s+in|delay)?[^0-9]*(\d+(?:\.\d+)?)\s*s/i);
  return m ? Math.max(1, Math.ceil(parseFloat(m[1]))) : null;
}

async function callGemini(prompt, { maxTokens = 2048, attempt = 0 } = {}) {
  if (!GEMINI_KEY) throw new Error('VITE_GEMINI_API_KEY is not set.');

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: maxTokens },
      }),
    }
  );

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data?.error?.message || `HTTP ${res.status}`;
    if (isRetryable(res.status, msg) && attempt < 2) {
      const retryAfter = parseRetryAfter(msg) ?? (2 ** attempt + 1);
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      return callGemini(prompt, { maxTokens, attempt: attempt + 1 });
    }
    const err = new Error(msg);
    err.retryable = isRetryable(res.status, msg);
    err.retryAfter = parseRetryAfter(msg);
    throw err;
  }

  if (!data.candidates?.length) {
    const reason = data.promptFeedback?.blockReason
      ? `Blocked: ${data.promptFeedback.blockReason}`
      : 'Empty response.';
    throw new Error(`Gemini returned no candidates. ${reason}`);
  }

  const text = data.candidates[0].content?.parts?.[0]?.text;
  const finishReason = data.candidates[0].finishReason || 'STOP';
  if (!text) throw new Error(`Candidate had no text. finishReason: ${finishReason}`);

  // MAX_TOKENS is not a hard failure — we return what we got with a note
  if (finishReason === 'MAX_TOKENS') {
    return text + '\n\n*(section truncated — regenerate if needed)*';
  }
  return text;
}

// ── Compact payloads to save input tokens ──────────────────────────────

function compactBiasReport(br) {
  if (!br) return {};
  const cols = (br.column_results || []).map((c) => ({
    name: c.name,
    role: c.role || 'PROTECTED',
    fairness_ratio: c.disparate_impact,
    approval_gap: c.parity_gap,
    p_value: c.p_value,
    verdict: c.verdict,
    proxy_strength: c.proxy_strength,
    proxy_targets: c.proxy_targets,
    worst_group: pickWorstGroup(c.slices),
  }));
  return { dataset: br.dataset, summary: br.summary, columns: cols };
}

function compactModelReport(mr) {
  if (!mr) return {};
  return {
    attributes: mr.attribute_results || [],
    top_shap_features: (mr.shap_summary || []).slice(0, 10),
  };
}

function pickWorstGroup(slices) {
  if (!slices?.length) return null;
  const worst = slices.reduce((a, b) => (a.positive_rate < b.positive_rate ? a : b));
  return { group: worst.group, approval_rate: worst.positive_rate, n: worst.count };
}

// ── Section prompts ─────────────────────────────────────────────────────

const SECTION_PROMPTS = {
  'Executive Summary': (bias, model) => `You're a bias compliance officer writing for a non-technical reader.
Write ONLY the EXECUTIVE SUMMARY (3-4 sentences, plain English, no jargon, no heading).

Dataset findings:
${JSON.stringify(bias, null, 2)}

Model findings:
${JSON.stringify(model, null, 2)}

A fairness ratio below 0.80 fails the legal 80% rule. Don't use the word "PROTECTED" — say "sensitive attributes" instead.`,

  'Critical Findings': (bias, model) => `Write ONLY the CRITICAL FINDINGS section — one short paragraph (2-3 sentences) per "Unfair" or "Borderline" column. State the column name, worst-affected group, fairness ratio, and why it matters. No section heading.

Dataset findings:
${JSON.stringify(bias, null, 2)}

Model findings:
${JSON.stringify(model, null, 2)}`,

  'Proxy Risk': (bias) => `Write ONLY the PROXY RISK section in 3-4 sentences plain English. Identify any columns with high proxy_strength or role=PROXY, explain which sensitive attribute they stand in for, and explain why just removing the sensitive column isn't enough. No heading.

Dataset findings:
${JSON.stringify(bias, null, 2)}`,

  'Recommendations': (bias, model) => `Write ONLY the RECOMMENDATIONS section as 3 bullet points starting with "* ". Each one sentence, action-oriented, specific to what's in the data below.

Dataset findings:
${JSON.stringify(bias, null, 2)}

Model findings:
${JSON.stringify(model, null, 2)}`,
};

const SECTION_TOKEN_BUDGET = {
  'Executive Summary': 512,
  'Critical Findings': 2048,
  'Proxy Risk': 1024,
  'Recommendations': 768,
};

// ── Public API ──────────────────────────────────────────────────────────

async function generateSections(biasCompact, modelCompact) {
  const sections = [];
  let firstError = null;

  for (const [heading, promptFn] of Object.entries(SECTION_PROMPTS)) {
    try {
      const prompt = promptFn(biasCompact, modelCompact);
      const text = await callGemini(prompt, { maxTokens: SECTION_TOKEN_BUDGET[heading] });
      sections.push(`## ${heading}\n\n${text.trim()}`);
    } catch (err) {
      console.error(`[gemini] section '${heading}' failed:`, err);
      sections.push(`## ${heading}\n\n*(Couldn't generate this section — ${err.message || 'error'})*`);
      if (!firstError) firstError = err;
    }
  }

  return { sections, firstError };
}

export async function generateAuditReport(biasReport, modelBiasReport, { forceRefresh = false } = {}) {
  const biasCompact = compactBiasReport(biasReport);
  const modelCompact = compactModelReport(modelBiasReport);

  const fingerprint = JSON.stringify({ b: biasCompact, m: modelCompact });
  const cacheKey = `unveil_report_${hashString(fingerprint)}`;

  if (!forceRefresh) {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) return cached;
    } catch {}
  }

  const { sections, firstError } = await generateSections(biasCompact, modelCompact);

  const fullReport = sections.join('\n\n');

  // Only cache if we got a real result from every section (no error placeholders)
  const allSucceeded = !firstError;
  if (allSucceeded) {
    try { localStorage.setItem(cacheKey, fullReport); } catch {}
  }

  // If every section failed, surface the error
  const allFailed = sections.every((s) => s.includes("(Couldn't generate"));
  if (allFailed && firstError) throw firstError;

  return fullReport;
}
