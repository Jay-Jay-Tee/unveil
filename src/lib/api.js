/**
 * api.js — Unveil frontend API client.
 *
 * Same backend endpoints as before. Main changes:
 *   1. Better error messages — structured with retry hints the Report page parses.
 *   2. Gemini calls get auto-retry with exponential backoff on 429/503.
 *   3. Report endpoint uses the chunked backend flow (no frontend change needed).
 */

import { mockSchemaMap, mockBiasReport, mockModelBiasReport } from './mockData';
import { getAuthToken } from './auth';

export const API_BASE = import.meta.env.VITE_API_URL || '/api';
const USE_MOCK_FALLBACK = import.meta.env.VITE_USE_MOCK !== 'false';
const REQUIRE_AUTH_FOR_ANALYSIS = import.meta.env.VITE_REQUIRE_AUTH_FOR_ANALYSIS !== 'false';

function makeAuthRequiredError(message = 'Sign in with Firebase to run backend analysis.') {
  const err = new Error(message);
  err.code = 'AUTH_REQUIRED';
  err.status = 401;
  err.retryable = false;
  return err;
}

async function buildAuthHeaders({ required = false } = {}) {
  const token = await getAuthToken();
  if (!token) {
    if (required) throw makeAuthRequiredError();
    return {};
  }
  return { Authorization: `Bearer ${token}` };
}

// ── Error classification ────────────────────────────────────────────────

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

function friendlyGeminiBusyMessage() {
  return "Gemini is busy right now — we'll try again in 30-60 seconds. Your place in line is held.";
}

function friendlyGeminiQuotaMessage(retryAfterSeconds) {
  const retry = retryAfterSeconds
    ? `Retry in about ${retryAfterSeconds} seconds.`
    : 'Try again in a minute.';
  return `Gemini hit its rate limit. ${retry} If this keeps happening, the team's Gemini quota may need upgrading.`;
}

async function toApiError(res) {
  const body = await res.json().catch(() => ({}));
  const detail = body?.detail;
  const detailObj = detail && typeof detail === 'object' ? detail : null;
  const detailText = typeof detail === 'string' ? detail : detailObj?.message;

  if (res.status === 401) {
    throw makeAuthRequiredError(detailText || 'Your session is missing or expired. Sign in again.');
  }

  if (isGeminiQuotaPayload(res.status, detailText, detailObj)) {
    const err = new Error(detailObj?.message || friendlyGeminiQuotaMessage(detailObj?.retry_after_seconds));
    err.retryable = true;
    err.retryAfter = detailObj?.retry_after_seconds;
    throw err;
  }
  if (isGeminiOverloadedPayload(res.status, detailText, detailObj)) {
    const err = new Error(detailObj?.message || friendlyGeminiBusyMessage());
    err.retryable = true;
    throw err;
  }
  throw new Error(detailText || `HTTP ${res.status}`);
}

// ── Health check ────────────────────────────────────────────────────────

export async function checkBackendHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Dataset analysis ────────────────────────────────────────────────────

export async function analyzeDataset(file) {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const authHeaders = await buildAuthHeaders({ required: REQUIRE_AUTH_FOR_ANALYSIS });
    const res = await fetch(`${API_BASE}/analyze/dataset`, {
      method: 'POST',
      headers: authHeaders,
      body: formData,
    });
    if (!res.ok) await toApiError(res);
    const data = await res.json();
    return {
      schemaMap: data.schema_map,
      proxyFlags: data.proxy_flags,
      biasReport: data.bias_report,
      datasetName: data.dataset_name,
      rowCount: data.row_count,
      columnCount: data.column_count,
      warnings: data.warnings || [],
      isMock: false,
    };
  } catch (err) {
    // Rate-limit errors propagate — the user needs to know
    if (err?.retryable || err?.code === 'AUTH_REQUIRED' || err?.status === 401) throw err;
    if (USE_MOCK_FALLBACK) {
      console.warn('[api] Backend unreachable — using mock data:', err.message);
      return {
        schemaMap: mockSchemaMap,
        proxyFlags: { proxy_columns: [] },
        biasReport: mockBiasReport,
        datasetName: file.name,
        rowCount: 48842,
        columnCount: 15,
        warnings: ['⚠ Backend offline — showing pre-computed demo results for UCI Adult.'],
        isMock: true,
      };
    }
    throw err;
  }
}

// ── Model analysis ──────────────────────────────────────────────────────

export async function analyzeModel(datasetFile, schemaMap, proxyFlags, modelFile = null, nProbes = 100) {
  const formData = new FormData();
  formData.append('dataset', datasetFile);
  formData.append('schema_map_json', JSON.stringify(schemaMap));
  formData.append('proxy_flags_json', JSON.stringify(proxyFlags));
  formData.append('n_probes', String(nProbes));
  if (modelFile) formData.append('model', modelFile);

  try {
    const authHeaders = await buildAuthHeaders({ required: REQUIRE_AUTH_FOR_ANALYSIS });
    const res = await fetch(`${API_BASE}/analyze/model`, {
      method: 'POST',
      headers: authHeaders,
      body: formData,
    });
    if (!res.ok) await toApiError(res);
    const data = await res.json();
    return {
      attributeResults: data.attribute_results,
      shapSummary: data.shap_summary,
      isMock: false,
    };
  } catch (err) {
    if (err?.retryable || err?.code === 'AUTH_REQUIRED' || err?.status === 401) throw err;
    if (USE_MOCK_FALLBACK) {
      console.warn('[api] Backend unreachable — using mock model data:', err.message);
      return {
        attributeResults: mockModelBiasReport.attribute_results,
        shapSummary: mockModelBiasReport.shap_summary,
        isMock: true,
      };
    }
    throw err;
  }
}

// ── Gemini report ───────────────────────────────────────────────────────

export async function generateGeminiReport(biasReport, modelBiasReport, { forceRefresh = false } = {}) {
  // 1. Try backend proxy first
  try {
    const authHeaders = await buildAuthHeaders({ required: REQUIRE_AUTH_FOR_ANALYSIS });
    const res = await fetch(`${API_BASE}/report/gemini`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({
        bias_report: biasReport,
        model_bias_report: modelBiasReport,
        force_refresh: forceRefresh,
      }),
      signal: AbortSignal.timeout(90000),  // 90s — chunked generation takes longer
    });

    if (res.ok) {
      const data = await res.json();
      return data.report_text;
    }
    await toApiError(res);
  } catch (backendErr) {
    if (backendErr?.code === 'AUTH_REQUIRED' || backendErr?.status === 401) {
      throw backendErr;
    }
    // 2. Fallback: direct browser-side Gemini call
    try {
      const { generateAuditReport } = await import('./gemini');
      return await generateAuditReport(biasReport, modelBiasReport, { forceRefresh });
    } catch (directErr) {
      // Prefer the more specific error message
      if (directErr?.retryable) throw directErr;
      if (backendErr?.retryable) throw backendErr;
      throw directErr || backendErr;
    }
  }
}
