/**
 * T5.2 & T5.5 — Model Router with Fallback & Circuit Breaker
 * Routes low/medium tasks to local LM Studio (10.10.10.30:1234)
 * and high complexity tasks to AGY / Cloud.
 */

import { scoreComplexity } from './complexityScorer.js';
import { logger } from '../utils/logger.js';

const LOCAL_URL = process.env.LLM_LOCAL_URL || 'http://10.10.10.30:1234/v1';
const LOCAL_PRIMARY = process.env.LLM_LOCAL_MODEL || 'openai/gpt-oss-20b';
const LOCAL_FALLBACK = process.env.LLM_FALLBACK_MODEL || 'granite-4.0-micro';
const CLOUD_MODEL = process.env.LLM_CLOUD_MODEL || 'agy-gemini-pro';

class CircuitBreaker {
  constructor(threshold = 3, resetTimeoutMs = 60_000) {
    this.threshold = threshold;
    this.resetTimeoutMs = resetTimeoutMs;
    this.failureCount = 0;
    this.state = 'CLOSED'; // 'CLOSED' | 'OPEN' | 'HALF_OPEN'
    this.nextAttempt = Date.now();
  }

  recordSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  recordFailure() {
    this.failureCount += 1;
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeoutMs;
      logger.warn({ failures: this.failureCount }, 'Model router circuit breaker opened');
    }
  }

  canAttempt() {
    if (this.state === 'CLOSED') return true;
    if (this.state === 'OPEN') {
      if (Date.now() >= this.nextAttempt) {
        this.state = 'HALF_OPEN';
        return true;
      }
      return false;
    }
    return true; // HALF_OPEN
  }
}

export const localCircuitBreaker = new CircuitBreaker(3, 60_000);

export function selectModelRoute(prompt, context = {}) {
  const complexity = scoreComplexity(prompt, context);

  // If high complexity -> direct to AGY / Cloud
  if (complexity === 'high') {
    return {
      tier: 'high',
      provider: 'agy',
      model: CLOUD_MODEL,
      endpoint: 'cloud',
      complexity,
    };
  }

  // Low or medium complexity -> route to local LM Studio
  // Check if circuit breaker allows local
  if (!localCircuitBreaker.canAttempt()) {
    logger.warn('Local LM Studio circuit breaker is OPEN, falling back to AGY');
    return {
      tier: complexity,
      provider: 'agy',
      model: CLOUD_MODEL,
      endpoint: 'cloud',
      fallbackReason: 'circuit_breaker_open',
      complexity,
    };
  }

  return {
    tier: complexity,
    provider: 'lm-studio',
    model: LOCAL_PRIMARY,
    fallbackModel: LOCAL_FALLBACK,
    endpoint: LOCAL_URL,
    complexity,
  };
}
