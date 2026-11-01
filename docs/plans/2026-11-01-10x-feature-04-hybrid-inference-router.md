# Feature 04: Hybrid Local-Cloud Dynamic Inference Router — Plan Implementacji

> **For Claude / Antigravity:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rozbudowa istniejącego `modelRouter.js` i `complexityScorer.js` o dynamiczną, runtime-aware partycję promptów: proste wywołania (git status, formatowanie, lint) trafiają do lokalnego Qwen/Ollama (koszt: 0), złożone (refaktoring architektury, security audit, nowe funkcje) hot-swapują do Claude 3.7 Sonnet lub o3. Circuit breaker chroni przed rate-limitingiem i cold-startem lokalnych modeli.

**Architecture:**
- Istniejący `src/backend/llm/modelRouter.js` ma już `selectModelRoute(prompt)` i `localCircuitBreaker` — rozbudujemy o: runtime metrics feedback loop (tokens/s z ostatniego callów), context size estimator (tiktoken), cost tracker, oraz adaptive thresholds per-model.
- Nowy `src/backend/llm/inferenceRouter.js` — unified proxy z fallback chain: `local LM Studio` → `Ollama` → `OpenRouter` → `Anthropic Claude`.
- Frontend: rozbudowa istniejącego `ModelRoutingWidget.tsx` — dodanie live heatmapy użycia modeli, cost savings meter i timeline routingu.

**Tech Stack:** istniejący `modelRouter.js`, `complexityScorer.js`, `llmProxyRouter.js`, `ModelRoutingWidget.tsx`, `@dqbd/tiktoken` (lub `gpt-tokenizer`), Vitest.

---

### Task 1: Context Size Estimator

**Files:**
- Create: `src/backend/llm/contextEstimator.js`
- Create: `src/backend/llm/contextEstimator.test.js`

**Step 1: Write the failing test** — `src/backend/llm/contextEstimator.test.js`:
- Test `estimateTokens(text)` zwraca liczbę tokenów (± 10% vs tiktoken).
- Test `getContextFillRatio(text, maxContextWindow)` — np. `128000` tokenów → ratio `0.75`.
- Test że text > 90% max window zwraca `overflowRisk: true`.

**Step 2: Run test to verify it fails**
`npm test -- src/backend/llm/contextEstimator.test.js --run`

**Step 3: Implement**
```js
// src/backend/llm/contextEstimator.js
// Fallback tokenizer: ~4 chars per token (szybki, bez zależności)
export function estimateTokens(text) {
  return Math.ceil((text?.length ?? 0) / 4);
}

export function getContextFillRatio(text, maxContextWindow = 128000) {
  const tokens = estimateTokens(text);
  const ratio = tokens / maxContextWindow;
  return {
    tokens,
    ratio: Math.min(ratio, 1.0),
    overflowRisk: ratio > 0.9,
  };
}

export const CONTEXT_WINDOWS = {
  'claude-3-7-sonnet': 200000,
  'gpt-4o': 128000,
  'openai/gpt-oss-20b': 32000,
  'qwen-4b': 8000,
  'granite-4.0-micro': 4096,
};
```

**Step 4: Run test to verify it passes**
`npm test -- src/backend/llm/contextEstimator.test.js --run`

**Step 5: Commit**
```bash
git add src/backend/llm/contextEstimator.js src/backend/llm/contextEstimator.test.js
git commit -m "feat(llm): add context size estimator with token count and overflow detection"
```

---

### Task 2: Cost Tracker — akumulacja kosztów per task/model

**Files:**
- Create: `src/backend/llm/costTracker.js`
- Create: `src/backend/llm/costTracker.test.js`

**Step 1: Write the failing test**:
- Test `recordUsage(taskId, modelId, inputTokens, outputTokens)`.
- Test `getCostForTask(taskId)` zwraca `{ total_usd, model, tokens }`.
- Test `getCostSummary()` — ranking modeli po kosztach i liczbie wywołań.
- Test `isLocalModel(modelId)` → `true` dla `lm-studio/*` i `ollama/*` → koszt = $0.

**Step 2: Run test to verify it fails**
`npm test -- src/backend/llm/costTracker.test.js --run`

**Step 3: Implement**
```js
// src/backend/llm/costTracker.js
import { safeQuery } from '../db.js';

// Ceny za milion tokenów (input/output) w USD
export const MODEL_PRICING = {
  'claude-3-7-sonnet': { input: 3.0, output: 15.0 },
  'claude-3-5-haiku': { input: 0.8, output: 4.0 },
  'gpt-4o': { input: 5.0, output: 15.0 },
  'o3': { input: 10.0, output: 40.0 },
  'openai/gpt-oss-20b': { input: 0, output: 0 }, // lokalny
  'qwen-4b': { input: 0, output: 0 }, // lokalny
  'granite-4.0-micro': { input: 0, output: 0 }, // lokalny
};

export function isLocalModel(modelId) {
  return (
    modelId?.startsWith('lm-studio/') ||
    modelId?.startsWith('ollama/') ||
    MODEL_PRICING[modelId]?.input === 0
  );
}

export function calculateCost(modelId, inputTokens, outputTokens) {
  const pricing = MODEL_PRICING[modelId] ?? { input: 0, output: 0 };
  return (pricing.input * inputTokens + pricing.output * outputTokens) / 1_000_000;
}

export async function recordUsage(taskId, modelId, inputTokens, outputTokens) {
  const costUsd = calculateCost(modelId, inputTokens, outputTokens);
  await safeQuery(
    'INSERT INTO llm_usage (task_id, model_id, input_tokens, output_tokens, cost_usd, ts) VALUES (?,?,?,?,?,?)',
    [taskId, modelId, inputTokens, outputTokens, costUsd, new Date().toISOString()]
  );
  return { costUsd };
}

export async function getCostForTask(taskId) {
  const rows = await safeQuery('SELECT * FROM llm_usage WHERE task_id=?', [taskId]);
  const total_usd = rows.reduce((sum, r) => sum + (r.cost_usd || 0), 0);
  return { total_usd, calls: rows.length, rows };
}

export async function getCostSummary() {
  return safeQuery(
    'SELECT model_id, COUNT(*) as calls, SUM(input_tokens) as total_input, SUM(output_tokens) as total_output, SUM(cost_usd) as total_cost FROM llm_usage GROUP BY model_id ORDER BY total_cost DESC'
  );
}
```

**Step 4: Run test to verify it passes**
`npm test -- src/backend/llm/costTracker.test.js --run`

**Step 5: Commit**
```bash
git add src/backend/llm/costTracker.js src/backend/llm/costTracker.test.js src/backend/db.js
git commit -m "feat(llm): add cost tracker with per-task and per-model billing accumulation"
```

---

### Task 3: Rozbudowa inferenceRouter — fallback chain i adaptive thresholds

**Files:**
- Create: `src/backend/llm/inferenceRouter.js`
- Create: `src/backend/llm/inferenceRouter.test.js`
- Modify: `src/backend/llm/modelRouter.js` — zintegrować `contextEstimator` i `costTracker` w `selectModelRoute()`

**Step 1: Write the failing test** — `src/backend/llm/inferenceRouter.test.js`:
- Test `route(prompt, opts)` — dla short prompt → `provider: 'lm-studio'`.
- Test że gdy local circuit breaker jest open → fallback do cloud (`provider: 'anthropic'`).
- Test że gdy `contextFillRatio > 0.85` (za duży kontekst dla lokalnego) → cloud.
- Test że wynik zawiera `{ provider, model, estimatedCostUsd, routingReason }`.

**Step 2: Run test to verify it fails**
`npm test -- src/backend/llm/inferenceRouter.test.js --run`

**Step 3: Implement**
```js
// src/backend/llm/inferenceRouter.js
import { scoreComplexity } from './complexityScorer.js';
import { selectModelRoute, localCircuitBreaker } from './modelRouter.js';
import { getContextFillRatio } from './contextEstimator.js';
import { calculateCost } from './costTracker.js';

export function route(prompt, opts = {}) {
  const complexity = scoreComplexity(prompt);
  const { ratio, overflowRisk } = getContextFillRatio(prompt);
  const localOk = !localCircuitBreaker.isOpen() && !overflowRisk;

  if (!localOk || complexity === 'high') {
    const model = opts.cloudModel ?? process.env.LLM_CLOUD_MODEL ?? 'claude-3-5-haiku-20241022';
    return {
      provider: 'anthropic',
      model,
      estimatedCostUsd: calculateCost(model, Math.ceil(prompt.length / 4), 500),
      routingReason: overflowRisk ? 'context_overflow' : complexity === 'high' ? 'high_complexity' : 'circuit_open',
    };
  }

  const local = selectModelRoute(prompt);
  return {
    ...local,
    estimatedCostUsd: 0,
    routingReason: 'local_capable',
  };
}
```

**Step 4: Run test to verify it passes**
`npm test -- src/backend/llm/inferenceRouter.test.js --run`

**Step 5: Commit**
```bash
git add src/backend/llm/inferenceRouter.js src/backend/llm/inferenceRouter.test.js src/backend/llm/modelRouter.js
git commit -m "feat(llm): implement unified inference router with fallback chain and adaptive context routing"
```

---

### Task 4: Frontend — rozbudowa ModelRoutingWidget.tsx

**Files:**
- Modify: `src/components/ModelRoutingWidget.tsx`
- Modify: `src/components/ModelRoutingWidget.test.tsx`

**Co dodać:**
- Sekcja „Oszczędności dzisiaj": `$X.XX zaoszczędzono przez routing lokalny`.
- Live ticker: ostatnia trasa `Local Qwen ✅ (low, $0.00)` lub `Claude 3.5 Haiku ⚡ (high, $0.012)`.
- Pasek kosztów tygodniowych.

**Step 1–5 (TDD) → Commit**
```bash
git commit -m "feat(ui): enhance ModelRoutingWidget with cost savings meter and live routing ticker"
```
