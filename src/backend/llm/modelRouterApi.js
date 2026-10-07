import { Router } from 'express';
import {
  getRoutingStats,
  checkUnslothStatus,
  executeRoutedPrompt,
  recordRoutingCall,
  resetRoutingStats,
  selectModelRoute,
  localCircuitBreaker
} from './modelRouter.js';
import { logger } from '../utils/logger.js';

export const modelRouterApi = Router();

/**
 * GET /api/llm/routing-stats
 * Returns live model routing metrics, circuit breaker status, and recent call history.
 */
modelRouterApi.get('/routing-stats', async (_req, res) => {
  try {
    await checkUnslothStatus();
    const stats = getRoutingStats();
    return res.json(stats);
  } catch (err) {
    logger.error({ err: err.message }, 'Failed to get routing stats');
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * POST /api/llm/route-prompt
 * Evaluates prompt complexity, executes it via the routed model, and returns results + telemetry.
 */
modelRouterApi.post('/route-prompt', async (req, res) => {
  const { prompt, context = {}, dryRun = false } = req.body || {};

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Field "prompt" is required and must be a string' });
  }

  try {
    if (dryRun) {
      const decision = selectModelRoute(prompt, context);
      return res.json({
        dryRun: true,
        route: decision,
        circuitBreaker: localCircuitBreaker.state,
      });
    }

    const result = await executeRoutedPrompt(prompt, context);
    return res.json({
      success: true,
      result,
      stats: getRoutingStats()
    });
  } catch (err) {
    logger.error({ err: err.message, prompt: prompt.slice(0, 50) }, 'Failed to execute routed prompt');
    return res.status(502).json({ error: err.message });
  }
});

/**
 * POST /api/llm/record-call
 * Allows external workers or agents to record an executed LLM call into live telemetry.
 */
modelRouterApi.post('/record-call', (req, res) => {
  const {
    tier = 'low',
    provider = 'lm-studio',
    model,
    durationMs = 0,
    success = true,
    fallbackOccurred = false,
    fallbackReason = null,
    promptPreview = ''
  } = req.body || {};

  try {
    recordRoutingCall({
      tier,
      provider,
      model,
      durationMs,
      success,
      fallbackOccurred,
      fallbackReason,
      promptPreview
    });

    return res.status(201).json({
      success: true,
      stats: getRoutingStats()
    });
  } catch (err) {
    logger.error({ err: err.message }, 'Failed to record external LLM call');
    return res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/llm/reset-stats
 * Resets telemetry counters (useful for testing or daily reset).
 */
modelRouterApi.post('/reset-stats', (_req, res) => {
  resetRoutingStats();
  return res.json({ success: true, stats: getRoutingStats() });
});
