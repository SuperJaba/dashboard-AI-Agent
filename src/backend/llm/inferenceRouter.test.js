import { describe, it, expect, beforeEach } from 'vitest';
import { route } from './inferenceRouter.js';
import { localCircuitBreaker } from './modelRouter.js';

describe('inferenceRouter', () => {
  beforeEach(() => {
    // Reset circuit breaker
    localCircuitBreaker.consecutiveFailures = 0;
    localCircuitBreaker.state = 'CLOSED';
    localCircuitBreaker.lastFailureTime = null;
  });

  it('routes simple low-complexity prompts to local provider with zero estimated cost', () => {
    const res = route('git status');
    expect(res).toBeDefined();
    expect(res.estimatedCostUsd).toBe(0);
    expect(res.routingReason).toBe('local_capable');
    expect(res.provider).toBe('lm-studio');
  });

  it('routes high complexity prompt to cloud model', () => {
    const complexPrompt = 'Zaprojektuj pełną rozproszoną architekturę CQRS z Kafka i Kubernetes z analizą bezpieczeństwa, diagramami architektonicznymi i refaktoryzacją całego systemu.';
    const res = route(complexPrompt);

    expect(res.provider).toBe('anthropic');
    expect(res.routingReason).toBe('high_complexity');
    expect(res.estimatedCostUsd).toBeGreaterThan(0);
  });

  it('falls back to cloud when local circuit breaker is open', () => {
    // Trip the breaker
    localCircuitBreaker.recordFailure();
    localCircuitBreaker.recordFailure();
    localCircuitBreaker.recordFailure();
    expect(localCircuitBreaker.isOpen()).toBe(true);

    const res = route('git status');
    expect(res.provider).toBe('anthropic');
    expect(res.routingReason).toBe('circuit_open');
  });

  it('routes to cloud when context size exceeds local model limit', () => {
    // 35,000 characters -> ~8,750 tokens, exceeding qwen-4b 8,000 token window
    const giantPrompt = 'format this code: ' + 'x'.repeat(35000);
    const res = route(giantPrompt);

    expect(res.provider).toBe('anthropic');
    expect(res.routingReason).toBe('context_overflow');
  });
});
