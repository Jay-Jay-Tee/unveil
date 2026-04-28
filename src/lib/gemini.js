/**
 * gemini.js - Report generation using Claude API.
 * Uses ONE single API call for the full report to avoid rate-limit cascades.
 * Falls back gracefully with retry logic.
 */

function hashString(s = '') {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) + s.charCodeAt(i);
    h |= 0;
  }
  return (h >>> 0).toString(36);
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callClaude(prompt, { maxTokens = 3000, retries = 2 } = {}) {
  let lastErr;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      // Exponential backoff: 8s, 16s
      const waitMs = 8000 * Math.pow(2, attempt - 1);
      await sleep(waitMs);
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 429 || response.status === 503) {
      const msg = data?.error?.message || `Rate limited (HTTP ${response.status})`;
      lastErr = new Error(msg);
      lastErr.retryable = true;
      // If the API tells us how long to wait, respect it (plus a buffer)
      const retryMatch = msg.match(/retry.*?(\d+)\s*s/i);
      if (retryMatch && attempt === 0) {
        const waitSec = Math.min(parseInt(retryMatch[1], 10) + 2, 30);
        await sleep(waitSec * 1000);
      }
      continue; // retry
    }

    if (!response.ok) {
      const msg = data?.error?.message || `HTTP ${response.status}`;
      const err = new Error(msg);
      err.retryable = false;
      throw err;
    }

    const text = data.content?.find(b => b.type === 'text')?.text;
    if (!text) throw new Error('No text in response.');
    return text;
  }

  throw lastErr || new Error('Request failed after retries.');
}

// -- Compact payloads to save input tokens ------------------------------

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

// -- Single unified prompt -----------------------------------------------

function buildFullReportPrompt(biasCompact, modelCompact, datasetName) {
  return `You are a bias compliance officer writing a full audit report for a non-technical reader.

Write a complete compliance report for the dataset "${datasetName}" with exactly these four sections. Use markdown headings (## Section Name) for each. Be thorough and specific - this is the FULL report, not a summary.

## Executive Summary
3-4 sentences. Plain English, no jargon. State what dataset was analyzed, what was found overall, and the most urgent issue.

## Critical Findings
One short paragraph (2-3 sentences) per column with verdict "BIASED" or "AMBIGUOUS". State the column name, worst-affected group, fairness ratio, and why it matters. If no issues, say so clearly.

## Proxy Risk
3-4 sentences. Identify columns with high proxy_strength or role=PROXY. Explain which sensitive attribute they encode and why removing the obvious column is not enough.

## Recommendations
Exactly 3 bullet points starting with "* ". One sentence each, action-oriented and specific to what's in this dataset.

Rules:
- A fairness ratio below 0.80 fails the legal 80% rule
- Say "sensitive attributes" instead of "PROTECTED"
- Reference the dataset as "${datasetName}"
- Do NOT add any preamble, intro, or closing remarks outside the four sections
- Write ALL four sections even if data is sparse

Dataset findings:
${JSON.stringify(biasCompact, null, 2)}

Model findings:
${JSON.stringify(modelCompact, null, 2)}`;
}

// -- Public API ----------------------------------------------------------

export async function generateAuditReport(biasReport, modelBiasReport, { forceRefresh = false, datasetName = null } = {}) {
  const biasCompact = compactBiasReport(biasReport);
  const modelCompact = compactModelReport(modelBiasReport);
  const name = datasetName || 'the dataset';

  const fingerprint = JSON.stringify({ b: biasCompact, m: modelCompact, d: name });
  const cacheKey = `unveil_report_${hashString(fingerprint)}`;

  if (!forceRefresh) {
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) return cached;
    } catch { }
  }

  const prompt = buildFullReportPrompt(biasCompact, modelCompact, name);
  const fullReport = await callClaude(prompt, { maxTokens: 3000, retries: 2 });

  try { sessionStorage.setItem(cacheKey, fullReport); } catch { }

  return fullReport;
}
