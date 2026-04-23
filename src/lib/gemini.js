const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY;

function isGeminiBusyError(status, message = '') {
  const msg = String(message).toLowerCase();
  return status === 503 || msg.includes('unavailable') || msg.includes('high demand') || msg.includes('overloaded');
}

function isGeminiQuotaError(status, message = '') {
  const msg = String(message).toLowerCase();
  return status === 429 || msg.includes('quota') || msg.includes('rate limit') || msg.includes('resource_exhausted');
}

function friendlyGeminiBusyMessage() {
  return 'Gemini is busy right now due to high demand. Please retry in about 30-60 seconds.';
}

function friendlyGeminiQuotaMessage() {
  return 'Gemini quota or rate limits were exceeded. Please wait a bit and try again. If this keeps happening, enable billing or upgrade your Gemini plan.';
}

export async function generateAuditReport(biasReport, modelBiasReport) {
  const cacheKey = 'gemini_report_' + JSON.stringify(biasReport).length;
  const cached = localStorage.getItem(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are a bias compliance officer writing an audit report for a non-technical compliance team. Write in plain English, no jargon. Structure your response in exactly 4 sections:

1. EXECUTIVE SUMMARY (3 sentences maximum)
2. CRITICAL FINDINGS (one paragraph per biased attribute)
3. PROXY RISK ANALYSIS (explain which features act as proxies and why this matters)
4. RECOMMENDATIONS (3 bullet points)

Dataset Bias Report:
${JSON.stringify(biasReport, null, 2)}

Model Behavior Report:
${JSON.stringify(modelBiasReport, null, 2)}

The legal threshold for disparate impact is 0.8. Any score below this fails the 80% rule.
Do not stop mid-sentence. Complete all 4 sections fully before ending.`
            }]
          }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 2048 }
        })
      }
    );

    const data = await response.json();
    console.log('[Gemini API] Full response:', JSON.stringify(data, null, 2));

    if (!response.ok) {
      const msg = data.error?.message ?? `HTTP ${response.status}: ${response.statusText}`;
      if (isGeminiQuotaError(response.status, msg)) {
        throw new Error(friendlyGeminiQuotaMessage());
      }
      if (isGeminiBusyError(response.status, msg)) {
        throw new Error(friendlyGeminiBusyMessage());
      }
      throw new Error(msg);
    }

    if (data.error) {
      const msg = data.error.message ?? JSON.stringify(data.error);
      if (isGeminiQuotaError(response.status, msg)) {
        throw new Error(friendlyGeminiQuotaMessage());
      }
      if (isGeminiBusyError(response.status, msg)) {
        throw new Error(friendlyGeminiBusyMessage());
      }
      throw new Error(msg);
    }

    if (!data.candidates || !data.candidates.length) {
      throw new Error(
        'No candidates in response. ' +
        (data.promptFeedback?.blockReason
          ? `Blocked: ${data.promptFeedback.blockReason}`
          : 'The API returned an empty result.')
      );
    }

    const text = data.candidates[0].content?.parts?.[0]?.text;
    if (!text) {
      throw new Error(
        'Candidate had no text content. finishReason: ' +
        (data.candidates[0].finishReason ?? 'unknown')
      );
    }

    localStorage.setItem(cacheKey, text);
    return text;
  } catch (err) {
    console.error('[Gemini API] Error:', err);
    throw err;
  }
}
