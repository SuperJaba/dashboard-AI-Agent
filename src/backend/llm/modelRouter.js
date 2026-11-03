/**
 * T5.2, T5.3 & T5.5 — Model Router with Fallback & Circuit Breaker
 * Routes low/medium tasks to local LM Studio / Unsloth (10.10.10.30:1234 / 127.0.0.1:8888)
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
const LOCAL_URL = process.env.LLM_LOCAL_URL || 'http://127.0.0.1:8888/v1';
const LOCAL_SERVER_NAME = process.env.LLM_LOCAL_NAME || 'Unsloth';
const LOCAL_PRIMARY = process.env.LLM_LOCAL_MODEL || 'openai/gpt-oss-20b';
const LOCAL_FALLBACK = process.env.LLM_FALLBACK_MODEL || 'granite-4.0-micro';
const CLOUD_MODEL = process.env.LLM_CLOUD_MODEL || 'AGY (Gemini Pro)';
const LOCAL_API_KEY = process.env.LLM_LOCAL_API_KEY || 'sk-unsloth-2c3bc42606e2f3af20c976a428dd764c';

/**
 * CircuitBreaker pattern implementation for local model reliability.
 *
 * State machine: CLOSED (normal) → OPEN (failures exceeded threshold) → HALF_OPEN (testing recovery)
 * Prevents cascading failures when local model server is down.
 */
class CircuitBreaker {
  constructor(threshold = 3, resetTimeoutMs = 60_000) {
    this.threshold = threshold;
    this.resetTimeoutMs = resetTimeoutMs;
    this.failureCount = 0;
    this.state = 'CLOSED'; // 'CLOSED' | 'OPEN' | 'HALF_OPEN'
    this.lastFailureTime = null;
  }

  recordSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
    this.lastFailureTime = null;
  }

  recordFailure() {
    this.failureCount += 1;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      logger.warn(
        { failureCount: this.failureCount, threshold: this.threshold },
        'Circuit breaker tripped to OPEN state for local LLM'
      );
    }
  }

  canAttempt() {
    if (this.state === 'CLOSED') return true;
    if (this.state === 'OPEN') {
      const elapsed = Date.now() - (this.lastFailureTime || 0);
      if (elapsed >= this.resetTimeoutMs) {
        this.state = 'HALF_OPEN';
        logger.info('Circuit breaker entering HALF_OPEN state (probing local LLM)');
        return true;
      }
      return false;
    }
    // HALF_OPEN
    return true;
  }

  reset() {
    this.recordSuccess();
  }
}

// Global circuit breaker instance for local LM Studio / Unsloth reliability
export const localCircuitBreaker = new CircuitBreaker(3, 60_000);

/**
 * In-memory telemetry metrics for model routing statistics.
 * Tracks task distribution between local and cloud providers.
 */
const statsState = {
  localTasks: 0,
  cloudTasks: 0,
  fallbackTasks: 0,
  totalLocalLatencyMs: 0,
  totalCloudLatencyMs: 0,
  localTokens: 0,
  cloudTokens: 0,
  totalPromptTokens: 0,
  totalCompletionTokens: 0,
  fallbackCount: 0,
  recentCalls: [],
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
    statsState.fallbackTasks += 1;
  }
}

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
    statsState.localTasks += 1;
    statsState.totalLocalLatencyMs += durationMs;
    statsState.localTokens += tokens;
  } else {
    statsState.cloudTasks += 1;
    statsState.totalCloudLatencyMs += durationMs;
    statsState.cloudTokens += tokens;
  }

  statsState.totalPromptTokens += promptTokens;
  statsState.totalCompletionTokens += completionTokens;

  if (fallbackOccurred) {
    statsState.fallbackCount += 1;
    statsState.fallbackTasks += 1;
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

  statsState.recentCalls.unshift(record);
  if (statsState.recentCalls.length > 20) {
    statsState.recentCalls.pop();
  }

  // Asynchronously persist to database (routing_calls and agent_tasks)
  safeQuery(
    `INSERT INTO routing_calls (id, tier, provider, model, duration_ms, prompt_tokens, completion_tokens, total_tokens, success, fallback_occurred, fallback_reason, prompt_preview, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())`,
    [
      record.id,
      tier,
      provider,
      model,
      durationMs,
      promptTokens,
      completionTokens,
      tokens,
      success,
      fallbackOccurred,
      fallbackReason,
      record.promptPreview
    ]
  ).catch(err => {
    logger.warn({ err: err.message }, 'Failed to persist routing call to routing_calls');
  });

  safeQuery(
    `INSERT INTO agent_tasks (agent_name, project_id, status, model, tokens_used, prompt_tokens, completion_tokens, duration_ms, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
    [
      'model_router',
      null,
      success ? 'completed' : 'failed',
      model,
      tokens,
      promptTokens,
      completionTokens,
      durationMs
    ]
  ).catch(err => {
    logger.warn({ err: err.message }, 'Failed to persist model routing task to agent_tasks');
  });
}

let unslothCache = {
  online: true,
  status: 'Serving requests',
  contextLength: 98048,
  model: LOCAL_PRIMARY,
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
        model: data.model_path || LOCAL_PRIMARY,
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
    localTokens: statsState.localTokens,
    cloudTokens: statsState.cloudTokens,
    totalPromptTokens: statsState.totalPromptTokens,
    totalCompletionTokens: statsState.totalCompletionTokens,
    fallbackTasks: statsState.fallbackTasks,
    circuitBreakerState: localCircuitBreaker.state,
    failureCount: localCircuitBreaker.failureCount,
    primaryLocalModel: unslothCache.model || LOCAL_PRIMARY,
    fallbackLocalModel: LOCAL_FALLBACK,
    cloudModel: CLOUD_MODEL === 'agy-gemini-pro' ? 'AGY (Gemini Pro)' : CLOUD_MODEL,
    localServerName: LOCAL_SERVER_NAME,
    localUrl: LOCAL_URL,
    localEndpoint: LOCAL_URL,
    avgLocalLatencyMs,
    avgCloudLatencyMs,
    fallbackCount: statsState.fallbackCount,
    recentCalls: statsState.recentCalls,
    unslothLive: unslothCache
  };
}

/**
 * Aggregates router statistics from database with real-time metrics.
 * Combines historical task data from agent_tasks and routing_calls tables with live telemetry.
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
  let dbRecentCalls = [];
  let dbLocalTokens = 0;
  let dbCloudTokens = 0;
  let dbPromptTokens = 0;
  let dbCompletionTokens = 0;

  try {
    const sResult = await safeQuery('SELECT url, model FROM servers WHERE provider = $1 AND is_active = true LIMIT 1', ['local']);
    if (sResult && sResult.rows && sResult.rows.length > 0) {
      activeEndpoint = activeEndpoint || sResult.rows[0].url;
      activeLocalModel = activeLocalModel || sResult.rows[0].model;
    }
  } catch (err) {
    logger.warn({ err: err.message }, 'Failed to fetch active server config for router stats');
  }

  try {
    const rcRes = await safeQuery(
      'SELECT id, tier, provider, model, duration_ms, prompt_tokens, completion_tokens, total_tokens, success, fallback_occurred, fallback_reason, prompt_preview, created_at FROM routing_calls ORDER BY created_at DESC LIMIT 20'
    );
    if (rcRes && rcRes.rows) {
      dbRecentCalls = rcRes.rows.map(r => ({
        id: r.id,
        timestamp: r.created_at,
        tier: r.tier,
        provider: r.provider,
        model: r.model,
        durationMs: parseInt(r.duration_ms, 10) || 0,
        promptTokens: parseInt(r.prompt_tokens, 10) || 0,
        completionTokens: parseInt(r.completion_tokens, 10) || 0,
        totalTokens: parseInt(r.total_tokens, 10) || 0,
        success: r.success === true || r.success === 'true',
        fallbackOccurred: r.fallback_occurred === true || r.fallback_occurred === 'true',
        fallbackReason: r.fallback_reason,
        promptPreview: r.prompt_preview || ''
      }));

      for (const r of rcRes.rows) {
        const isLocal = r.provider === 'lm-studio' || (!r.model?.toLowerCase().includes('gemini') && !r.model?.toLowerCase().includes('claude'));
        const tok = parseInt(r.total_tokens, 10) || 0;
        const pTok = parseInt(r.prompt_tokens, 10) || 0;
        const cTok = parseInt(r.completion_tokens, 10) || 0;
        if (isLocal) {
          dbLocalTokens += tok;
        } else {
          dbCloudTokens += tok;
        }
        dbPromptTokens += pTok;
        dbCompletionTokens += cTok;
      }
    }
  } catch (err) {
    logger.warn({ err: err.message }, 'Failed to fetch routing_calls history');
  }

  try {
    const tasksRes = await safeQuery('SELECT model, duration_ms, tokens_used FROM agent_tasks ORDER BY created_at DESC LIMIT 100');
    if (tasksRes && tasksRes.rows) {
      for (const row of tasksRes.rows) {
        const m = (row.model || '').toLowerCase();
        const duration = parseInt(row.duration_ms || '0', 10);
        const tok = parseInt(row.tokens_used || '0', 10);
        if (m.includes('gemini') || m.includes('claude') || m.includes('cloud') || m.includes('agy')) {
          dbCloudTasks += 1;
          if (duration > 0) dbTotalCloudLatency += duration;
          if (dbRecentCalls.length === 0 && tok > 0) dbCloudTokens += tok;
        } else if (m) {
          dbLocalTasks += 1;
          if (duration > 0) dbTotalLocalLatency += duration;
          if (dbRecentCalls.length === 0 && tok > 0) dbLocalTokens += tok;
        } else {
          dbCloudTasks += 1;
          if (duration > 0) dbTotalCloudLatency += duration;
          if (dbRecentCalls.length === 0 && tok > 0) dbCloudTokens += tok;
        }
      }
    }
  } catch (err) {
    logger.warn({ err: err.message }, 'Failed to aggregate router stats from agent_tasks');
  }

  const seenIds = new Set(statsState.recentCalls.map(c => c.id));
  const mergedRecentCalls = [
    ...statsState.recentCalls,
    ...dbRecentCalls.filter(c => !seenIds.has(c.id))
  ].slice(0, 20);

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

  const totalLocalTokens = dbLocalTokens + statsState.localTokens;
  const totalCloudTokens = dbCloudTokens + statsState.cloudTokens;
  const totalPrompt = dbPromptTokens + statsState.totalPromptTokens;
  const totalCompletion = dbCompletionTokens + statsState.totalCompletionTokens;

  return {
    localTasks: totalLocal,
    cloudTasks: totalCloud,
    localTokens: totalLocalTokens,
    cloudTokens: totalCloudTokens,
    totalPromptTokens: totalPrompt,
    totalCompletionTokens: totalCompletion,
    fallbackTasks: statsState.fallbackTasks,
    circuitBreakerState: localCircuitBreaker.state,
    failureCount: localCircuitBreaker.failureCount,
    primaryLocalModel: activeLocalModel || unslothCache.model || LOCAL_PRIMARY,
    fallbackLocalModel: LOCAL_FALLBACK,
    cloudModel: CLOUD_MODEL === 'agy-gemini-pro' ? 'AGY (Gemini Pro)' : CLOUD_MODEL,
    localServerName: LOCAL_SERVER_NAME,
    localUrl: activeEndpoint || LOCAL_URL,
    localEndpoint: activeEndpoint || LOCAL_URL,
    avgLocalLatencyMs,
    avgCloudLatencyMs,
    fallbackCount: statsState.fallbackCount,
    recentCalls: mergedRecentCalls,
    unslothLive: unslothCache
  };
}

export const getRoutingStats = getRouterStats;

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

export function resetRoutingStats() {
  statsState.localTasks = 0;
  statsState.cloudTasks = 0;
  statsState.fallbackTasks = 0;
  statsState.totalLocalLatencyMs = 0;
  statsState.totalCloudLatencyMs = 0;
  statsState.localTokens = 0;
  statsState.cloudTokens = 0;
  statsState.totalPromptTokens = 0;
  statsState.totalCompletionTokens = 0;
  statsState.fallbackCount = 0;
  statsState.recentCalls = [];
  localCircuitBreaker.recordSuccess();
}

/**
 * Selects the optimal model routing tier based on prompt complexity and health.
 * Uses T5 scoring algorithm to determine if task should run locally or in cloud.
 *
 * @param {string} prompt - The task prompt to evaluate
 * @param {object} [context] - Additional context (e.g., file count, complexity hints)
 * @returns {object} Routing decision with tier, provider, model, and endpoint details
 */
export function selectModelRoute(prompt = '', context = {}) {
  const complexity = scoreComplexity(prompt, context);

  if (complexity === 'high') {
    return {
      tier: 'high',
      provider: 'agy',
      model: CLOUD_MODEL,
      reason: 'Wysoka złożoność zadania (architektura / refactoring / długi prompt)',
      estimatedSavings: 0,
    };
  }

  // Low or medium complexity -> try local LM Studio / Unsloth
  if (!localCircuitBreaker.canAttempt()) {
    logger.warn('Circuit breaker OPEN/cooling down; diverting low/med task to Cloud');
    return {
      tier: complexity,
      provider: 'agy',
      model: CLOUD_MODEL,
      reason: 'Bezpiecznik obwodu lokalnego LLM otwarty (fallback do chmury)',
      fallbackReason: 'circuit_breaker_open',
      estimatedSavings: 0,
    };
  }

  return {
    tier: complexity,
    provider: 'lm-studio',
    model: LOCAL_PRIMARY,
    fallbackModel: LOCAL_FALLBACK,
    url: LOCAL_URL,
    apiKey: LOCAL_API_KEY,
    reason: `Lokalny model dopasowany do złożoności [${complexity}]`,
    estimatedSavings: complexity === 'low' ? 0.05 : 0.15,
  };
}

/**
 * Executes prompt completion using the routed provider with automatic fallback.
 * Implements cascading failure recovery: local primary → local fallback → cloud AGY.
 *
 * @param {string} prompt - The task prompt to complete
 * @param {object} [opts] - Execution and context options
 * @param {object} [opts.context] - Additional context for routing decisions
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
export async function executeRoutedPrompt(prompt, opts = {}) {
  const route = selectModelRoute(prompt, opts.context);
  const startTime = Date.now();

  if (route.provider === 'lm-studio') {
    try {
      const provider = getProvider('lm-studio');
      const result = await (provider.complete ? provider.complete(prompt, {
        ...opts,
        model: route.model,
      }) : provider.generate(prompt, {
        ...opts,
        model: route.model,
      }));
      localCircuitBreaker.recordSuccess();
      const durationMs = Date.now() - startTime;
      recordTaskExecution({ tier: route.tier, durationMs, fallback: false });
      recordRoutingCall({
        tier: route.tier,
        provider: 'lm-studio',
        model: route.model,
        durationMs,
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
        provider: 'lm-studio',
        fallbackOccurred: false,
      };
    } catch (err) {
      localCircuitBreaker.recordFailure();
      logger.warn(
        { err: err.message, model: route.model },
        'Primary local model failed, attempting local fallback model'
      );

      // Attempt fallback local model
      if (route.fallbackModel) {
        try {
          const provider = getProvider('lm-studio');
          const fallbackResult = await (provider.complete ? provider.complete(prompt, {
            ...opts,
            model: route.fallbackModel,
          }) : provider.generate(prompt, {
            ...opts,
            model: route.fallbackModel,
          }));
          localCircuitBreaker.recordSuccess();
          const durationMs = Date.now() - startTime;
          recordTaskExecution({ tier: route.tier, durationMs, fallback: true });
          recordRoutingCall({
            tier: route.tier,
            provider: 'lm-studio',
            model: route.fallbackModel,
            durationMs,
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
            provider: 'lm-studio',
            fallbackOccurred: true,
            fallbackReason: 'primary_local_failed',
          };
        } catch (fallbackErr) {
          logger.error(
            { err: fallbackErr.message },
            'Local fallback model also failed, escalating to Cloud AGY'
          );
        }
      }

      // Final fallback: Cloud AGY
      const agyProvider = getProvider('agy');
      const agyResult = await (agyProvider.complete ? agyProvider.complete(prompt, {
        ...opts,
        model: CLOUD_MODEL,
      }) : agyProvider.generate(prompt, {
        ...opts,
        model: CLOUD_MODEL,
      }));
      const durationMs = Date.now() - startTime;
      recordTaskExecution({ tier: 'cloud', durationMs, fallback: true });
      recordRoutingCall({
        tier: 'high',
        provider: 'agy',
        model: CLOUD_MODEL,
        durationMs,
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
        provider: 'agy',
        fallbackOccurred: true,
        fallbackReason: 'local_providers_failed',
      };
    }
  }

  // Cloud AGY
  const provider = getProvider('agy');
  const result = await (provider.complete ? provider.complete(prompt, {
    ...opts,
    model: route.model || CLOUD_MODEL,
  }) : provider.generate(prompt, {
    ...opts,
    model: route.model || CLOUD_MODEL,
  }));
  const durationMs = Date.now() - startTime;
  recordTaskExecution({ tier: 'high', durationMs, fallback: Boolean(route.fallbackReason) });
  recordRoutingCall({
    tier: 'high',
    provider: 'agy',
    model: route.model || CLOUD_MODEL,
    durationMs,
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
    provider: 'agy',
    fallbackOccurred: Boolean(route.fallbackReason),
    fallbackReason: route.fallbackReason,
  };
}
