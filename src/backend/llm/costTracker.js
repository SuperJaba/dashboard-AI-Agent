import { safeQuery } from '../db.js';

// Model pricing in USD per 1,000,000 tokens (input / output)
export const MODEL_PRICING = {
  'claude-3-7-sonnet': { input: 3.0, output: 15.0 },
  'claude-3-5-sonnet': { input: 3.0, output: 15.0 },
  'claude-3-5-haiku': { input: 0.8, output: 4.0 },
  'claude-3-5-haiku-20241022': { input: 0.8, output: 4.0 },
  'gpt-4o': { input: 5.0, output: 15.0 },
  'o3': { input: 10.0, output: 40.0 },
  'openai/gpt-oss-20b': { input: 0, output: 0 },
  'qwen-4b': { input: 0, output: 0 },
  'granite-4.0-micro': { input: 0, output: 0 },
};

export function isLocalModel(modelId) {
  if (!modelId) return false;
  return (
    modelId.startsWith('lm-studio/') ||
    modelId.startsWith('ollama/') ||
    MODEL_PRICING[modelId]?.input === 0
  );
}

export function calculateCost(modelId, inputTokens = 0, outputTokens = 0) {
  if (isLocalModel(modelId)) return 0;
  const pricing = MODEL_PRICING[modelId] ?? { input: 0, output: 0 };
  return (pricing.input * (inputTokens || 0) + pricing.output * (outputTokens || 0)) / 1_000_000;
}

export async function recordUsage(taskId, modelId, inputTokens = 0, outputTokens = 0) {
  const costUsd = calculateCost(modelId, inputTokens, outputTokens);
  await safeQuery(
    'INSERT INTO llm_usage (task_id, model_id, input_tokens, output_tokens, cost_usd, ts) VALUES (?, ?, ?, ?, ?, ?)',
    [taskId, modelId, inputTokens, outputTokens, costUsd, new Date().toISOString()]
  );
  return { costUsd };
}

export async function getCostForTask(taskId) {
  const { rows } = await safeQuery('SELECT * FROM llm_usage WHERE task_id = ?', [taskId]);
  const rowsList = rows || [];
  const total_usd = rowsList.reduce((sum, r) => sum + (Number(r.cost_usd) || 0), 0);
  return { total_usd, calls: rowsList.length, rows: rowsList };
}

export async function getCostSummary() {
  const { rows } = await safeQuery(
    'SELECT model_id, COUNT(*) as calls, SUM(input_tokens) as total_input, SUM(output_tokens) as total_output, SUM(cost_usd) as total_cost FROM llm_usage GROUP BY model_id ORDER BY total_cost DESC'
  );
  return rows || [];
}
