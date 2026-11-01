/**
 * T5.2, T5.3 & T5.5 — Model Router with Fallback & Circuit Breaker
 * Routes low/medium tasks to local LM Studio (10.10.10.30:1234)
 * and high complexity tasks to AGY / Cloud.
 */

import { scoreComplexity } from './complexityScorer.js';
import { getProvider } from './providers/index.js';
import { logger } from '../utils/logger.js';
import { safeQuery } from '../db.js';

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

  reset() {
    this.failureCount = 0;
    this.state = 'CLOSED';
    this.nextAttempt = Date.now();
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

// In-memory telemetry metrics for model routing
const statsState = {
  localTasks: 0,
  cloudTasks: 0,
  totalLocalLatencyMs: 0,
  totalCloudLatencyMs: 0,
  fallbackCount: 0,
};

export function recordTaskExecution({ tier, durationMs, fallback = false }) {
  if (tier === 'high' || tier === 'cloud') {
    statsState.cloudTasks += 1;
    statsState.totalCloudLatencyMs += durationMs;
  } else {
    statsState.localTasks += 1;
    statsState.totalLocalLatencyMs += durationMs;
  }
  if (fallback) {
    statsState.fallbackCount += 1;
  }
}

export function getRouterStats() {
  const avgLocalLatencyMs = statsState.localTasks > 0
    ? Math.round(statsState.totalLocalLatencyMs / statsState.localTasks)
    : 0;
  const avgCloudLatencyMs = statsState.cloudTasks > 0
    ? Math.round(statsState.totalCloudLatencyMs / statsState.cloudTasks)
    : 0;

  return {
    localTasks: statsState.localTasks,
    cloudTasks: statsState.cloudTasks,
    circuitBreakerState: localCircuitBreaker.state,
    primaryLocalModel: LOCAL_PRIMARY,
    fallbackLocalModel: LOCAL_FALLBACK,
    cloudModel: CLOUD_MODEL === 'agy-gemini-pro' ? 'AGY (Gemini Pro)' : CLOUD_MODEL,
    avgLocalLatencyMs,
    avgCloudLatencyMs,
    localEndpoint: LOCAL_URL,
    fallbackCount: statsState.fallbackCount,
  };
}

export async function getAggregatedRouterStats({ activeLocalModel, activeEndpoint } = {}) {
  let dbLocalTasks = 0;
  let dbCloudTasks = 0;
  let dbTotalLocalLatency = 0;
  let dbTotalCloudLatency = 0;

  try {
    const res = await safeQuery(
      `SELECT model, agent_name, duration_ms, created_at, updated_at, status 
       FROM agent_tasks 
       ORDER BY id DESC LIMIT 500`
    );

    if (res?.rows && Array.isArray(res.rows)) {
      for (const row of res.rows) {
        const rawModel = (row.model || '').toLowerCase();
        const rawAgent = (row.agent_name || '').toLowerCase();
        const activeModelLower = (activeLocalModel || '').toLowerCase();

        const isExplicitLocal = (activeModelLower && rawModel === activeModelLower) ||
          rawModel.includes('qwen') ||
          rawModel.includes('llama') ||
          rawModel.includes('granite') ||
          rawModel.includes('mistral') ||
          rawModel.includes('gguf') ||
          rawModel.includes('local') ||
          rawModel.includes('ollama') ||
          rawModel.includes('openai/gpt-oss-20b');

        const isExplicitCloud = rawModel.includes('gemini') ||
          rawModel.includes('claude') ||
          rawModel.includes('gpt-4') ||
          rawModel.includes('o1') ||
          rawModel.includes('o3') ||
          rawModel.includes('agy') ||
          rawModel.includes('anthropic') ||
          rawAgent.includes('agy') ||
          rawAgent.includes('antigravity');

        const isLocal = isExplicitLocal || (!isExplicitCloud && rawModel.length > 0 && !rawAgent.includes('claude'));

        let duration = row.duration_ms || 0;
        if (!duration && row.created_at && row.updated_at) {
          const diff = new Date(row.updated_at).getTime() - new Date(row.created_at).getTime();
          if (diff > 0 && diff < 86_400_000) {
            duration = diff;
          }
        }

        if (isLocal) {
          dbLocalTasks += 1;
          if (duration > 0) dbTotalLocalLatency += duration;
        } else {
          dbCloudTasks += 1;
          if (duration > 0) dbTotalCloudLatency += duration;
        }
      }
    }
  } catch (err) {
    logger.warn({ err: err.message }, 'Failed to aggregate router stats from agent_tasks');
  }

  const totalLocal = dbLocalTasks + statsState.localTasks;
  const totalCloud = dbCloudTasks + statsState.cloudTasks;
  const totalLocalLatency = dbTotalLocalLatency + statsState.totalLocalLatencyMs;
  const totalCloudLatency = dbTotalCloudLatency + statsState.totalCloudLatencyMs;

  const avgLocalLatencyMs = totalLocal > 0
    ? Math.round(totalLocalLatency / totalLocal)
    : 0;
  const avgCloudLatencyMs = totalCloud > 0
    ? Math.round(totalCloudLatency / totalCloud)
    : 0;

  return {
    localTasks: totalLocal,
    cloudTasks: totalCloud,
    circuitBreakerState: localCircuitBreaker.state,
    primaryLocalModel: activeLocalModel || LOCAL_PRIMARY,
    fallbackLocalModel: LOCAL_FALLBACK,
    cloudModel: CLOUD_MODEL === 'agy-gemini-pro' ? 'AGY (Gemini Pro)' : CLOUD_MODEL,
    avgLocalLatencyMs,
    avgCloudLatencyMs,
    localEndpoint: activeEndpoint || LOCAL_URL,
    fallbackCount: statsState.fallbackCount,
  };
}

export function resetRouterCircuitBreaker() {
  localCircuitBreaker.reset();
  return getRouterStats();
}

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
  const startTime = Date.now();

  if (route.provider === 'lm-studio') {
    const localProvider = getProvider('lm-studio');
    try {
      const result = await localProvider.complete(prompt, {
        ...opts,
        model: route.model,
      });
      localCircuitBreaker.recordSuccess();
      const durationMs = Date.now() - startTime;
      recordTaskExecution({ tier: route.tier, durationMs, fallback: false });
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
          const durationMs = Date.now() - startTime;
          recordTaskExecution({ tier: route.tier, durationMs, fallback: true });
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
      const durationMs = Date.now() - startTime;
      recordTaskExecution({ tier: 'cloud', durationMs, fallback: true });
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
  const durationMs = Date.now() - startTime;
  recordTaskExecution({ tier: 'high', durationMs, fallback: Boolean(route.fallbackReason) });

  return {
    ...result,
    route,
    fallbackOccurred: Boolean(route.fallbackReason),
  };
}
