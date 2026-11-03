/**
 * T5.2, T5.3 & T5.5 — Model Router with Fallback & Circuit Breaker
 * Routes low/medium tasks to local LM Studio (10.10.10.30:1234)
 * and high complexity tasks to AGY / Cloud.
 *
 * Architecture Pattern: Circuit breaker for graceful degradation from local fallback
 * to cloud provider when local services are unavailable.
 */

import { scoreComplexity } from './complexityScorer.js';
import { getProvider } from './providers/index.js';
import { logger } from '../utils/logger.js';
import { safeQuery } from '../db.js';

// ============================================================
// Configuration Constants
// ============================================================
const LOCAL_URL = process.env.LLM_LOCAL_URL || 'http://10.10.10.30:1234/v1';
const LOCAL_PRIMARY = process.env.LLM_LOCAL_MODEL || 'openai/gpt-oss-20b';
const LOCAL_FALLBACK = process.env.LLM_FALLBACK_MODEL || 'granite-4.0-micro';
const CLOUD_MODEL = process.env.LLM_CLOUD_MODEL || 'agy-gemini-pro';

/**
 * CircuitBreaker pattern implementation for local model reliability.
 *
 * State machine: CLOSED (normal) → OPEN (failures exceeded threshold) → HALF_OPEN (testing recovery)
 * Prevents cascading failures when local LM Studio is down.
 */
class CircuitBreaker {
  constructor(threshold = 3, resetTimeoutMs = 60_000) {
    this.threshold = threshold; // Number of failures before opening circuit
    this.resetTimeoutMs = resetTimeoutMs; // Wait time before retrying
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
    return true; // HALF_OPEN state allows testing
  }
}

// Global circuit breaker instance for local LM Studio reliability
export const localCircuitBreaker = new CircuitBreaker(3, 60_000);

/**
 * In-memory telemetry metrics for model routing statistics.
 * Tracks task distribution between local and cloud providers.
 */
const statsState = {
  localTasks: 0,
  cloudTasks: 0,
  totalLocalLatencyMs: 0,
  totalCloudLatencyMs: 0,
  fallbackCount: 0,
};

/**
 * Records task execution metrics for telemetry and billing.
 *
 * @param {object} opts - Task execution options
 * @param {'low'|'medium'|'high'} opts.tier - Task complexity tier
 * @param {number} opts.durationMs - Execution duration in milliseconds
 * @param {boolean} [opts.fallback=false] - Whether fallback was triggered
 */
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

/**
 * Gets in-memory router statistics for real-time monitoring.
 *
 * @returns {object} Router telemetry metrics
 */
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

/**
 * Aggregates router statistics from database with real-time metrics.
 * Combines historical task data from agent_tasks table with live telemetry.
 *
 * @param {object} [opts] - Optional overrides for active models/endpoint
 * @param {string} [opts.activeLocalModel] - Override for local model name
 * @param {string} [opts.activeEndpoint] - Override for local endpoint URL
 * @returns {Promise<object>} Combined database and real-time router stats
 */
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

        // Determine if task used local or cloud model based on model/agent name
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

        // Calculate duration from database timestamps if not present
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

  // Combine database and real-time metrics
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

/**
 * Resets the circuit breaker and returns current router statistics.
 * Useful for testing or after successful recovery from failure.
 *
 * @returns {object} Router statistics after reset
 */
export function resetRouterCircuitBreaker() {
  localCircuitBreaker.reset();
  return getRouterStats();
}

/**
 * Selects the optimal model routing tier based on prompt complexity and health.
 * Uses T5 scoring algorithm to determine if task should run locally or in cloud.
 *
 * @param {string} prompt - The task prompt to evaluate
 * @param {object} [context] - Additional context (e.g., file count, complexity hints)
 * @returns {object} Routing decision with tier, provider, model, and endpoint details
 */
export function selectModelRoute(prompt, context = {}) {
  const complexity = scoreComplexity(prompt, context);

  // High complexity tasks always route to AGY / Cloud provider
  if (complexity === 'high') {
    return {
      tier: 'high',
      provider: 'agy',
      model: CLOUD_MODEL,
      endpoint: 'cloud',
      complexity,
    };
  }

  // Low or medium complexity tasks route to local LM Studio
  // Check if circuit breaker allows local (respects reliability guarantees)
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
 * Implements cascading failure recovery: local primary → local fallback → cloud AGY.
 *
 * @param {string} prompt - The task prompt to complete
 * @param {object} [context] - Additional context for routing decisions
 * @param {object} [opts] - Optional completion options (temperature, max_tokens, etc.)
 * @returns {Promise<{
 *   text: string,
 *   usage: object,
 *   model: string,
 *   provider: string,
 *   durationMs: number,
 *   route: object,
 *   fallbackOccurred: boolean
 * }>} - Completion result with routing metadata and fallback status
 */
export async function executeRoutedPrompt(prompt, context = {}, opts = {}) {
  const route = selectModelRoute(prompt, context);
  const startTime = Date.now();

  if (route.provider === 'lm-studio') {
    const localProvider = getProvider('lm-studio');
    try {
      // Attempt primary local model first
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

      // Try local fallback model if configured (graceful degradation)
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

      // Escalate to AGY cloud when all local providers fail
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

  // AGY Cloud Route (direct cloud execution)
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
