/**
 * T5.2, T5.3 & T5.5 — Model Router with Fallback & Circuit Breaker
 * Routes low/medium tasks to local LM Studio (10.10.10.30:1234)
 * and high complexity tasks to AGY / Cloud.
 */

import { scoreComplexity } from './complexityScorer.js';
import { getProvider } from './providers/index.js';
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

/**
 * Selects the optimal model routing tier based on prompt complexity and health.
 *
 * @param {string} prompt
 * @param {object} [context]
 * @returns {object}
 */
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

/**
 * Executes prompt completion using the routed provider with automatic fallback.
 *
 * @param {string} prompt
 * @param {object} [context]
 * @param {object} [opts]
 * @returns {Promise<{
 *   text: string,
 *   usage: object,
 *   model: string,
 *   provider: string,
 *   durationMs: number,
 *   route: object,
 *   fallbackOccurred: boolean
 * }>}
 */
export async function executeRoutedPrompt(prompt, context = {}, opts = {}) {
  const route = selectModelRoute(prompt, context);

  if (route.provider === 'lm-studio') {
    const localProvider = getProvider('lm-studio');
    try {
      const result = await localProvider.complete(prompt, {
        ...opts,
        model: route.model,
      });
      localCircuitBreaker.recordSuccess();
      return {
        ...result,
        route,
        fallbackOccurred: false,
      };
    } catch (primaryErr) {
      logger.warn({ err: primaryErr.message, model: route.model }, 'Primary local model failed, trying fallback model');
      localCircuitBreaker.recordFailure();

      // Try local fallback model if configured
      if (route.fallbackModel) {
        try {
          const fallbackResult = await localProvider.complete(prompt, {
            ...opts,
            model: route.fallbackModel,
          });
          localCircuitBreaker.recordSuccess();
          return {
            ...fallbackResult,
            route,
            fallbackOccurred: true,
            fallbackReason: 'primary_local_failed',
          };
        } catch (fallbackErr) {
          logger.warn({ err: fallbackErr.message }, 'Local fallback model also failed, escalating to AGY cloud');
          localCircuitBreaker.recordFailure();
        }
      }

      // Escalate to AGY cloud
      const agyProvider = getProvider('agy');
      const agyResult = await agyProvider.complete(prompt, {
        ...opts,
        model: CLOUD_MODEL,
      });
      return {
        ...agyResult,
        route,
        fallbackOccurred: true,
        fallbackReason: 'local_providers_failed',
      };
    }
  }

  // AGY Cloud Route
  const agyProvider = getProvider('agy');
  const result = await agyProvider.complete(prompt, {
    ...opts,
    model: route.model || CLOUD_MODEL,
  });

  return {
    ...result,
    route,
    fallbackOccurred: Boolean(route.fallbackReason),
  };
}
