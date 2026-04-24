/**
 * api.js — UnbiasedAI frontend API client
 *
 * All real analysis calls go through here.
 * If the backend is unreachable, falls back to mock data gracefully.
 */

import { mockSchemaMap, mockBiasReport, mockModelBiasReport } from './mockData';

// Change this to your deployed backend URL when hosting on Cloud Run / ngrok
export const API_BASE = import.meta.env.VITE_API_URL || '/api';

const USE_MOCK_FALLBACK = import.meta.env.VITE_USE_MOCK !== 'false';

function isGeminiOverloadedPayload(status, detailText, detailObj) {
  if (detailObj?.code === 'GEMINI_OVERLOADED') return true;
  if (status !== 503) return false;
  const msg = (detailText || '').toLowerCase();
  return msg.includes('unavailable') || msg.includes('high demand') || msg.includes('overloaded');
}

function isGeminiQuotaPayload(status, detailText, detailObj) {
  if (detailObj?.code === 'GEMINI_QUOTA_EXCEEDED') return true;
  if (status !== 429) return false;
  const msg = (detailText || '').toLowerCase();
  return msg.includes('quota') || msg.includes('rate limit') || msg.includes('resource_exhausted');
}

function friendlyGeminiBusyMessage() {
  return 'Gemini is busy right now due to high demand. Please retry in about 30-60 seconds.';
}

function friendlyGeminiQuotaMessage(retryAfterSeconds) {
  const retryText = retryAfterSeconds ? ` Please retry in about ${retryAfterSeconds} seconds.` : ' Please retry in a bit.';
  return `Gemini quota or rate limits were exceeded.${retryText} If this keeps happening, wait and try again later or enable billing / upgrade your Gemini plan.`;
}

async function toApiError(res) {
  const body = await res.json().catch(() => ({}));
  const detail = body?.detail;
  const detailObj = detail && typeof detail === 'object' ? detail : null;
  const detailText = typeof detail === 'string' ? detail : detailObj?.message;

  if (isGeminiQuotaPayload(res.status, detailText, detailObj)) {
    throw new Error(detailObj?.message || friendlyGeminiQuotaMessage(detailObj?.retry_after_seconds));
  }

  if (isGeminiOverloadedPayload(res.status, detailText, detailObj)) {
    throw new Error(detailObj?.message || friendlyGeminiBusyMessage());
  }

  throw new Error(detailText || `HTTP ${res.status}`);
}

// ─── health check ──────────────────────────────────────────────────────────

export async function checkBackendHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Part A: dataset analysis ──────────────────────────────────────────────

/**
 * Upload a dataset file and get back real bias analysis.
 * Returns { schemaMap, proxyFlags, biasReport, datasetName, rowCount, warnings }
 *
 * Falls back to mock data if backend is unreachable and USE_MOCK_FALLBACK=true.
 */
export async function analyzeDataset(file) {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch(`${API_BASE}/analyze/dataset`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      await toApiError(res);
    }

    const data = await res.json();

    return {
      schemaMap: data.schema_map,       // { columns: [{ name, type, proxies }] }
      proxyFlags: data.proxy_flags,
      biasReport: data.bias_report,     // { column_results: [...] }
      datasetName: data.dataset_name,
      rowCount: data.row_count,
      warnings: data.warnings || [],
      isMock: false,
    };
  } catch (err) {
    if (USE_MOCK_FALLBACK) {
      console.warn('[api] Backend unreachable — using mock data:', err.message);
      return {
        schemaMap: mockSchemaMap,
        proxyFlags: { proxy_columns: [] },
        biasReport: mockBiasReport,
        datasetName: file.name,
        rowCount: '~48,842',
        warnings: ['⚠ Backend offline — showing pre-computed demo results for UCI Adult dataset.'],
        isMock: true,
      };
    }
    throw err;
  }
}

// ─── Part B: model analysis ────────────────────────────────────────────────

/**
 * Run black-box probe + optional SHAP on a trained model.
 * schemaMap and proxyFlags come from analyzeDataset().
 * modelFile is optional — if not provided, uses the internal stub model.
 *
 * Returns { attributeResults, shapSummary }
 */
export async function analyzeModel(datasetFile, schemaMap, proxyFlags, modelFile = null, nProbes = 100) {
  const formData = new FormData();
  formData.append('dataset', datasetFile);
  formData.append('schema_map_json', JSON.stringify(schemaMap));
  formData.append('proxy_flags_json', JSON.stringify(proxyFlags));
  formData.append('n_probes', String(nProbes));
  if (modelFile) {
    formData.append('model', modelFile);
  }

  try {
    const res = await fetch(`${API_BASE}/analyze/model`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      await toApiError(res);
    }

    const data = await res.json();

    return {
      attributeResults: data.attribute_results,
      shapSummary: data.shap_summary,
      isMock: false,
    };
  } catch (err) {
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

// ─── Gemini report generation ──────────────────────────────────────────────

/**
 * Generate a plain-English audit narrative via Gemini.
 * Tries backend proxy first (avoids exposing API key in browser),
 * falls back to direct Gemini API call using VITE_GEMINI_API_KEY.
 */
export async function generateGeminiReport(biasReport, modelBiasReport, { forceRefresh = false } = {}) {
  let backendError = null;

  // 1. Try backend proxy (preferred — keeps API key server-side)
  try {
    const res = await fetch(`${API_BASE}/report/gemini`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bias_report: biasReport, model_bias_report: modelBiasReport }),
      signal: AbortSignal.timeout(35000),
    });

    if (res.ok) {
      const data = await res.json();
      return data.report_text;
    }
    await toApiError(res);
  } catch (err) {
    backendError = err;
    // Backend not available — fall through to direct call
  }

  // 2. Direct Gemini call (uses VITE_GEMINI_API_KEY from .env)
  try {
    const { generateAuditReport } = await import('./gemini');
    return await generateAuditReport(biasReport, modelBiasReport, { forceRefresh });
  } catch (directErr) {
    const combinedMsg = [backendError?.message, directErr?.message].filter(Boolean).join(' | ');
    const lower = combinedMsg.toLowerCase();
    if (lower.includes('quota') || lower.includes('rate limit') || lower.includes('resource_exhausted')) {
      throw new Error(friendlyGeminiQuotaMessage());
    }
    if (lower.includes('high demand') || lower.includes('unavailable')) {
      throw new Error(friendlyGeminiBusyMessage());
    }
    throw directErr;
  }
}
