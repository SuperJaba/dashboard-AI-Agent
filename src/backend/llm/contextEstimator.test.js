import { describe, it, expect } from 'vitest';
import { estimateTokens, getContextFillRatio, CONTEXT_WINDOWS } from './contextEstimator.js';

describe('contextEstimator', () => {
  it('estimates token count reasonably (~4 chars per token)', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('Hello world! How are you doing today?')).toBeGreaterThanOrEqual(8);
  });

  it('calculates context fill ratio and flags overflow risk correctly', () => {
    const textSmall = 'short prompt';
    const smallRes = getContextFillRatio(textSmall, 1000);
    expect(smallRes.tokens).toBe(Math.ceil(textSmall.length / 4));
    expect(smallRes.ratio).toBeLessThan(0.1);
    expect(smallRes.overflowRisk).toBe(false);

    // Prompt that takes 95% of 100 token window -> 95 tokens -> 380 chars
    const textLarge = 'x'.repeat(380);
    const largeRes = getContextFillRatio(textLarge, 100);
    expect(largeRes.tokens).toBe(95);
    expect(largeRes.ratio).toBe(0.95);
    expect(largeRes.overflowRisk).toBe(true);
  });

  it('exposes known context window sizes', () => {
    expect(CONTEXT_WINDOWS['claude-3-7-sonnet']).toBe(200000);
    expect(CONTEXT_WINDOWS['gpt-4o']).toBe(128000);
    expect(CONTEXT_WINDOWS['qwen-4b']).toBe(8000);
  });
});
