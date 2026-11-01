/**
 * Fallback tokenizer: ~4 chars per token (fast, deterministic and lightweight)
 */
export function estimateTokens(text) {
  if (!text || typeof text !== 'string') return 0;
  return Math.ceil(text.length / 4);
}

export function getContextFillRatio(text, maxContextWindow = 128000) {
  const tokens = estimateTokens(text);
  const ratio = maxContextWindow > 0 ? tokens / maxContextWindow : 1;
  return {
    tokens,
    ratio: Math.min(ratio, 1.0),
    overflowRisk: ratio > 0.9,
  };
}

export const CONTEXT_WINDOWS = {
  'claude-3-7-sonnet': 200000,
  'claude-3-5-haiku': 200000,
  'gpt-4o': 128000,
  'openai/gpt-oss-20b': 32000,
  'qwen-4b': 8000,
  'granite-4.0-micro': 4096,
};
