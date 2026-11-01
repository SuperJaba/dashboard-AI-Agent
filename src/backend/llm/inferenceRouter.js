import { scoreComplexity } from './complexityScorer.js';
import { selectModelRoute, localCircuitBreaker } from './modelRouter.js';
import { getContextFillRatio, CONTEXT_WINDOWS } from './contextEstimator.js';
import { calculateCost } from './costTracker.js';

export function route(prompt, opts = {}) {
  const complexity = scoreComplexity(prompt);
  const localLimit = opts.localLimit || CONTEXT_WINDOWS['qwen-4b'] || 8000;
  const { overflowRisk } = getContextFillRatio(prompt, localLimit);
  const isCircuitOpen = localCircuitBreaker.isOpen ? localCircuitBreaker.isOpen() : (localCircuitBreaker.state === 'OPEN');

  if (isCircuitOpen || overflowRisk || complexity === 'high') {
    const model = opts.cloudModel || process.env.LLM_CLOUD_MODEL || 'claude-3-5-haiku-20241022';
    const estimatedTokens = Math.ceil((prompt?.length || 0) / 4);
    const estimatedCostUsd = calculateCost(model, estimatedTokens, 500);

    const routingReason = overflowRisk
      ? 'context_overflow'
      : complexity === 'high'
      ? 'high_complexity'
      : 'circuit_open';

    return {
      tier: 'high',
      provider: 'anthropic',
      model,
      estimatedCostUsd,
      routingReason,
    };
  }

  const local = selectModelRoute(prompt);
  return {
    ...local,
    estimatedCostUsd: 0,
    routingReason: 'local_capable',
  };
}

export default route;
