import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import * as tracker from './costTracker.js';
import { safeQuery, inMemoryStore, migrate } from '../db.js';

describe('costTracker', () => {
  beforeAll(async () => {
    try {
      await migrate();
    } catch {}
  });

  beforeEach(async () => {
    if (inMemoryStore) inMemoryStore.llm_usage = [];
    try {
      await safeQuery('DELETE FROM llm_usage');
    } catch {}
  });

  it('identifies local zero-cost models correctly', () => {
    expect(tracker.isLocalModel('lm-studio/qwen-4b')).toBe(true);
    expect(tracker.isLocalModel('ollama/llama3')).toBe(true);
    expect(tracker.isLocalModel('qwen-4b')).toBe(true);
    expect(tracker.isLocalModel('claude-3-7-sonnet')).toBe(false);
    expect(tracker.isLocalModel('gpt-4o')).toBe(false);
  });

  it('calculates cost in USD based on input/output tokens', () => {
    // 0 for local
    expect(tracker.calculateCost('qwen-4b', 10000, 2000)).toBe(0);

    // claude-3-7-sonnet: 3.0 / 15.0 per 1M tokens
    // 1000 input = 0.003, 1000 output = 0.015 -> total 0.018
    const cost = tracker.calculateCost('claude-3-7-sonnet', 1000, 1000);
    expect(cost).toBeCloseTo(0.018, 5);
  });

  it('records LLM usage and retrieves cost per task', async () => {
    await tracker.recordUsage('task-101', 'claude-3-7-sonnet', 1000, 500);
    await tracker.recordUsage('task-101', 'qwen-4b', 2000, 1000);

    const taskCost = await tracker.getCostForTask('task-101');
    expect(taskCost).toBeDefined();
    expect(taskCost.calls).toBe(2);
    expect(taskCost.total_usd).toBeGreaterThan(0);
  });

  it('provides cost summary grouped by model', async () => {
    await tracker.recordUsage('task-1', 'claude-3-7-sonnet', 1000, 1000);
    await tracker.recordUsage('task-2', 'gpt-4o', 2000, 500);

    const summary = await tracker.getCostSummary();
    expect(Array.isArray(summary)).toBe(true);
    expect(summary.length).toBeGreaterThanOrEqual(2);
  });
});
