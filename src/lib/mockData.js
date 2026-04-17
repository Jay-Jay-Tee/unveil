export const mockSchemaMap = {
  columns: [
    { name: 'age', type: 'NEUTRAL', proxies: ['relationship'] },
    { name: 'workclass', type: 'NEUTRAL', proxies: [] },
    { name: 'education', type: 'NEUTRAL', proxies: [] },
    { name: 'education-num', type: 'NEUTRAL', proxies: [] },
    { name: 'marital-status', type: 'NEUTRAL', proxies: ['relationship'] },
    { name: 'occupation', type: 'AMBIGUOUS', proxies: ['sex'] },
    { name: 'relationship', type: 'AMBIGUOUS', proxies: ['sex', 'marital-status'] },
    { name: 'race', type: 'PROTECTED', proxies: [] },
    { name: 'sex', type: 'PROTECTED', proxies: ['relationship', 'occupation'] },
    { name: 'capital-gain', type: 'NEUTRAL', proxies: [] },
    { name: 'capital-loss', type: 'NEUTRAL', proxies: [] },
    { name: 'hours-per-week', type: 'NEUTRAL', proxies: [] },
    { name: 'native-country', type: 'PROTECTED', proxies: [] },
    { name: 'income', type: 'OUTCOME', proxies: [] },
  ],
};

export const mockBiasReport = {
  column_results: [
    {
      name: 'sex',
      disparate_impact: 0.62,
      parity_gap: 0.22,
      p_value: 0.0001,
      verdict: 'BIASED',
      slices: [
        { group: 'Male', positive_rate: 0.83, fpr: 0.12, fnr: 0.08, count: 21790 },
        { group: 'Female', positive_rate: 0.61, fpr: 0.18, fnr: 0.21, count: 10771 },
      ],
    },
    {
      name: 'race',
      disparate_impact: 0.71,
      parity_gap: 0.14,
      p_value: 0.003,
      verdict: 'BIASED',
      slices: [
        { group: 'White', positive_rate: 0.79, fpr: 0.11, fnr: 0.09, count: 27816 },
        { group: 'Black', positive_rate: 0.65, fpr: 0.19, fnr: 0.16, count: 3124 },
        { group: 'Asian-Pac-Islander', positive_rate: 0.82, fpr: 0.09, fnr: 0.07, count: 1039 },
        { group: 'Other', positive_rate: 0.61, fpr: 0.22, fnr: 0.19, count: 271 },
      ],
    },
    {
      name: 'occupation',
      disparate_impact: 0.84,
      parity_gap: 0.06,
      p_value: 0.041,
      verdict: 'AMBIGUOUS',
      slices: [
        { group: 'Exec-managerial', positive_rate: 0.82, fpr: 0.08, fnr: 0.11, count: 4066 },
        { group: 'Tech-support', positive_rate: 0.74, fpr: 0.13, fnr: 0.14, count: 928 },
        { group: 'Craft-repair', positive_rate: 0.68, fpr: 0.16, fnr: 0.17, count: 4099 },
        { group: 'Other-service', positive_rate: 0.54, fpr: 0.21, fnr: 0.25, count: 3295 },
      ],
    },
    {
      name: 'native-country',
      disparate_impact: 0.91,
      parity_gap: 0.03,
      p_value: 0.18,
      verdict: 'CLEAN',
      slices: [
        { group: 'United-States', positive_rate: 0.76, fpr: 0.12, fnr: 0.11, count: 29170 },
        { group: 'Mexico', positive_rate: 0.73, fpr: 0.14, fnr: 0.13, count: 643 },
      ],
    },
  ],
};

export const mockModelBiasReport = {
  attribute_results: [
    { name: 'sex', mean_diff: 0.18, p_value: 0.0001, shap_rank: 3, verdict: 'BIASED' },
    { name: 'race', mean_diff: 0.12, p_value: 0.004, shap_rank: 7, verdict: 'BIASED' },
    { name: 'occupation', mean_diff: 0.07, p_value: 0.038, shap_rank: 5, verdict: 'AMBIGUOUS' },
    { name: 'native-country', mean_diff: 0.02, p_value: 0.21, shap_rank: 11, verdict: 'CLEAN' },
  ],
  shap_summary: [
    { feature: 'relationship', importance: 0.31, is_proxy: true, proxy_for: ['sex'] },
    { feature: 'capital-gain', importance: 0.27, is_proxy: false, proxy_for: [] },
    { feature: 'education-num', importance: 0.19, is_proxy: false, proxy_for: [] },
    { feature: 'age', importance: 0.14, is_proxy: false, proxy_for: [] },
    { feature: 'occupation', importance: 0.11, is_proxy: true, proxy_for: ['sex'] },
    { feature: 'hours-per-week', importance: 0.09, is_proxy: false, proxy_for: [] },
    { feature: 'sex', importance: 0.07, is_proxy: false, proxy_for: [] },
    { feature: 'capital-loss', importance: 0.06, is_proxy: false, proxy_for: [] },
    { feature: 'marital-status', importance: 0.05, is_proxy: false, proxy_for: [] },
    { feature: 'race', importance: 0.04, is_proxy: false, proxy_for: [] },
  ],
};
