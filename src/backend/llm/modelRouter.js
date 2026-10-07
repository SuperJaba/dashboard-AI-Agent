/**
 * T5.2, T5.3 & T5.5 — Model Router with Fallback & Circuit Breaker
 * Routes low/medium tasks to local LM Studio (10.10.10.30:1234)
 * and high complexity tasks to AGY / Cloud.
 */

import { scoreComplexity } from './complexityScorer.js';
import { getProvider } from './providers/index.js';
import { logger } from '../utils/logger.js';

const LOCAL_URL = process.env.LLM_LOCAL_URL || 'http://127.0.0.1:8888/v1';
const LOCAL_SERVER_NAME = process.env.LLM_LOCAL_NAME || 'Unsloth';
const LOCAL_PRIMARY = process.env.LLM_LOCAL_MODEL || 'unsloth/Qwen3.5-4B-MTP-GGUF';
const LOCAL_FALLBACK = process.env.LLM_FALLBACK_MODEL || 'granite-4.0-micro';
const CLOUD_MODEL = process.env.LLM_CLOUD_MODEL || 'AGY (Gemini Pro)';
const LOCAL_API_KEY = process.env.LLM_LOCAL_API_KEY || 'sk-unsloth-2c3bc42606e2f3af20c976a428dd764c';

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

// In-memory runtime telemetry store — strictly records actual live calls
const routingStats = {
  localTasks: 0,
  cloudTasks: 0,
  fallbackTasks: 0,
  totalLatencyLocalMs: 0,
  totalLatencyCloudMs: 0,
  localTokens: 0,
  cloudTokens: 0,
  totalPromptTokens: 0,
  totalCompletionTokens: 0,
  recentCalls: [],
};

/**
 * Records a routing invocation event in memory for live dashboard metrics.
 */
export function recordRoutingCall({
  tier = 'low',
  provider = 'lm-studio',
  model = LOCAL_PRIMARY,
  durationMs = 0,
  promptTokens = 0,
  completionTokens = 0,
  totalTokens = 0,
  success = true,
  fallbackOccurred = false,
  fallbackReason = null,
  promptPreview = ''
}) {
  const isLocal = provider === 'lm-studio';
  const tokens = totalTokens || (promptTokens + completionTokens);

  if (isLocal) {
    routingStats.localTasks += 1;
    routingStats.totalLatencyLocalMs += durationMs;
    routingStats.localTokens += tokens;
  } else {
    routingStats.cloudTasks += 1;
    routingStats.totalLatencyCloudMs += durationMs;
    routingStats.cloudTokens += tokens;
  }

  routingStats.totalPromptTokens += promptTokens;
  routingStats.totalCompletionTokens += completionTokens;

  if (fallbackOccurred) {
    routingStats.fallbackTasks += 1;
  }

  const record = {
    id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    tier,
    provider,
    model,
    durationMs,
    promptTokens,
    completionTokens,
    totalTokens: tokens,
    success,
    fallbackOccurred,
    fallbackReason,
    promptPreview: promptPreview.slice(0, 60)
  };

  routingStats.recentCalls.unshift(record);
  if (routingStats.recentCalls.length > 20) {
    routingStats.recentCalls.pop();
  }
}

let unslothCache = {
  online: true,
  status: 'Serving requests',
  contextLength: 98048,
  model: 'unsloth/Qwen3.5-4B-MTP-GGUF',
  monitorUrl: 'http://10.10.10.30:8888/api-monitor',
  lastCheck: 0
};

export async function checkUnslothStatus() {
  if (Date.now() - unslothCache.lastCheck < 15_000) {
    return unslothCache;
  }
  try {
    const res = await fetch('http://localhost:8888/props', { signal: AbortSignal.timeout(1500) });
    if (res.ok) {
      const data = await res.json();
      unslothCache = {
        online: true,
        status: data.is_sleeping ? 'Sleeping' : 'Serving requests',
        contextLength: data.default_generation_settings?.n_ctx || 98048,
        model: data.model_path || 'unsloth/Qwen3.5-4B-MTP-GGUF',
        monitorUrl: 'http://10.10.10.30:8888/api-monitor',
        lastCheck: Date.now()
      };
    }
  } catch {
    unslothCache.online = false;
    unslothCache.status = 'Offline';
    unslothCache.lastCheck = Date.now();
  }
  return unslothCache;
}

export function getRoutingStats() {
  const avgLocalLatencyMs = routingStats.localTasks > 0
    ? Math.round(routingStats.totalLatencyLocalMs / routingStats.localTasks)
    : 0;

  const avgCloudLatencyMs = routingStats.cloudTasks > 0
    ? Math.round(routingStats.totalLatencyCloudMs / routingStats.cloudTasks)
    : 0;

  return {
    localTasks: routingStats.localTasks,
    cloudTasks: routingStats.cloudTasks,
    fallbackTasks: routingStats.fallbackTasks,
    circuitBreakerState: localCircuitBreaker.state,
    failureCount: localCircuitBreaker.failureCount,
    localServerName: LOCAL_SERVER_NAME,
    primaryLocalModel: unslothCache.model || LOCAL_PRIMARY,
    fallbackLocalModel: LOCAL_FALLBACK,
    cloudModel: CLOUD_MODEL,
    localUrl: LOCAL_URL,
    avgLocalLatencyMs,
    avgCloudLatencyMs,
    localTokens: routingStats.localTokens,
    cloudTokens: routingStats.cloudTokens,
    totalPromptTokens: routingStats.totalPromptTokens,
    totalCompletionTokens: routingStats.totalCompletionTokens,
    unslothLive: unslothCache,
    recentCalls: routingStats.recentCalls
  };
}

/**
 * Resets routing metrics (used in tests or administrative resets).
 */
export function resetRoutingStats() {
  routingStats.localTasks = 0;
  routingStats.cloudTasks = 0;
  routingStats.fallbackTasks = 0;
  routingStats.totalLatencyLocalMs = 0;
  routingStats.totalLatencyCloudMs = 0;
  routingStats.localTokens = 0;
  routingStats.cloudTokens = 0;
  routingStats.totalPromptTokens = 0;
  routingStats.totalCompletionTokens = 0;
  routingStats.recentCalls = [];
  localCircuitBreaker.recordSuccess();
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

  if (route.provider === 'lm-studio') {
    const localProvider = getProvider('lm-studio');
    try {
      const result = await localProvider.complete(prompt, {
        apiKey: opts.apiKey || LOCAL_API_KEY,
        ...opts,
        model: route.model,
      });
      localCircuitBreaker.recordSuccess();
      recordRoutingCall({
        tier: route.tier,
        provider: 'lm-studio',
        model: route.model,
        durationMs: Math.round(result.durationMs || 0),
        promptTokens: result.usage?.promptTokens || 0,
        completionTokens: result.usage?.completionTokens || 0,
        totalTokens: result.usage?.totalTokens || 0,
        success: true,
        fallbackOccurred: false,
        promptPreview: prompt
      });
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
            apiKey: opts.apiKey || LOCAL_API_KEY,
            ...opts,
            model: route.fallbackModel,
          });
          localCircuitBreaker.recordSuccess();
          recordRoutingCall({
            tier: route.tier,
            provider: 'lm-studio',
            model: route.fallbackModel,
            durationMs: Math.round(fallbackResult.durationMs || 0),
            promptTokens: fallbackResult.usage?.promptTokens || 0,
            completionTokens: fallbackResult.usage?.completionTokens || 0,
            totalTokens: fallbackResult.usage?.totalTokens || 0,
            success: true,
            fallbackOccurred: true,
            fallbackReason: 'primary_local_failed',
            promptPreview: prompt
          });
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
      recordRoutingCall({
        tier: 'high',
        provider: 'agy',
        model: CLOUD_MODEL,
        durationMs: Math.round(agyResult.durationMs || 0),
        promptTokens: agyResult.usage?.promptTokens || 0,
        completionTokens: agyResult.usage?.completionTokens || 0,
        totalTokens: agyResult.usage?.totalTokens || 0,
        success: true,
        fallbackOccurred: true,
        fallbackReason: 'local_providers_failed',
        promptPreview: prompt
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

  recordRoutingCall({
    tier: 'high',
    provider: 'agy',
    model: route.model || CLOUD_MODEL,
    durationMs: Math.round(result.durationMs || 0),
    promptTokens: result.usage?.promptTokens || 0,
    completionTokens: result.usage?.completionTokens || 0,
    totalTokens: result.usage?.totalTokens || 0,
    success: true,
    fallbackOccurred: Boolean(route.fallbackReason),
    fallbackReason: route.fallbackReason,
    promptPreview: prompt
  });

  return {
    ...result,
    route,
    fallbackOccurred: Boolean(route.fallbackReason),
  };
}
