# Feature 02: Multi-Agent Pipeline Orchestrator (Agent DAGs) — Plan Implementacji

> **For Claude / Antigravity:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Zbudować wizualny, deklaratywny orkiestrator potoku agentów (DAG), gdzie wyspecjalizowane agenty tworzą sztafetę: `Architect` ➔ `Coder` ➔ `Reviewer` ➔ `QA` ➔ `DevOps`, eliminując single-agent context bloat i zapewniając wielopoziomową weryfikację automatyczną.

**Architecture:**
- Backend: `src/backend/pipeline/` — `pipelineRepository.js`, `pipelineService.js`, `pipelineRunner.js` zarządzają definicją DAG (węzły, krawędzie, role agentów), kolejkowaniem kroków, przekazywaniem artefaktów między węzłami (artifact context chain), abortem/retry poszczególnych nodów i broadcastem statusów via Socket.IO `/dashboard`.
- Frontend: `src/components/pipeline-builder/` — ReactFlow (lub lightweight SVG) wizualny builder DAG osadzony w nowej zakładce „Pipeline" w `App.tsx`. Konfiguracja węzłów (agent, model, system prompt, weryfikatory wyjścia), drag & drop połączeń.
- Artefakty przekazywane między węzłami to typowane `PipelineArtifact`: `{ stepId, type: 'spec'|'code'|'diff'|'test_result'|'deploy_log', content, createdAt }`.
- Każdy węzeł po wykonaniu emituje Socket.IO `pipeline:step_done` i może opcjonalnie wymagać `human_approval` przed uruchomieniem następnego kroku.

**Tech Stack:** Express, node-cron, Socket.IO, ReactFlow (lub `@xyflow/react`), TypeScript, Vitest, Tailwind CSS v4, istniejące `backgroundWorker.js`, `agentsRouter.js`, `schedulerService.js`.

---

### Task 1: Schemat danych i repozytorium Pipeline

**Files:**
- Create: `src/backend/pipeline/pipelineRepository.js`
- Create: `src/backend/pipeline/pipelineRepository.test.js`
- Modify: `src/backend/db.js` — dodać inicjalizację tabel `pipelines`, `pipeline_steps`, `pipeline_runs`, `pipeline_artifacts`

**Step 1: Write the failing test** — `src/backend/pipeline/pipelineRepository.test.js`:
- Test `createPipeline({ name, steps })` zwraca pipeline z `id`, `steps`, `status: 'idle'`.
- Test `getPipeline(id)` zwraca poprawny obiekt z zagnieżdżonymi krokami.
- Test `createRun(pipelineId)` tworzy rekord `pipeline_runs` z `status: 'queued'`.
- Test `saveArtifact(runId, stepId, artifact)` i `getArtifactsForStep(runId, stepId)`.

**Step 2: Run test to verify it fails**
`npm test -- src/backend/pipeline/pipelineRepository.test.js --run`
Expected: FAIL — module not found.

**Step 3: Implement**
```js
// src/backend/pipeline/pipelineRepository.js
import { safeQuery } from '../db.js';

export async function createPipeline({ name, steps }) {
  const id = crypto.randomUUID();
  await safeQuery('INSERT INTO pipelines (id, name, steps_json, status) VALUES (?,?,?,?)',
    [id, name, JSON.stringify(steps), 'idle']);
  return getPipeline(id);
}

export async function getPipeline(id) { /* SELECT + JSON.parse(steps_json) */ }
export async function listPipelines() { /* SELECT all */ }
export async function updatePipelineStatus(id, status) { /* UPDATE */ }

export async function createRun(pipelineId) {
  const id = crypto.randomUUID();
  await safeQuery('INSERT INTO pipeline_runs (id, pipeline_id, status, started_at) VALUES (?,?,?,?)',
    [id, pipelineId, 'queued', new Date().toISOString()]);
  return { id, pipelineId, status: 'queued' };
}

export async function saveArtifact(runId, stepId, { type, content }) {
  const id = crypto.randomUUID();
  await safeQuery('INSERT INTO pipeline_artifacts (id, run_id, step_id, type, content, created_at) VALUES (?,?,?,?,?,?)',
    [id, runId, stepId, type, content, new Date().toISOString()]);
  return { id };
}

export async function getArtifactsForStep(runId, stepId) {
  return safeQuery('SELECT * FROM pipeline_artifacts WHERE run_id=? AND step_id=?', [runId, stepId]);
}
```

**Step 4: Run test to verify it passes**
`npm test -- src/backend/pipeline/pipelineRepository.test.js --run`

**Step 5: Commit**
```bash
git add src/backend/pipeline/pipelineRepository.js src/backend/pipeline/pipelineRepository.test.js src/backend/db.js
git commit -m "feat(pipeline): add pipeline and artifacts repository with DAG schema"
```

---

### Task 2: PipelineRunner — wykonywanie kroków DAG

**Files:**
- Create: `src/backend/pipeline/pipelineRunner.js`
- Create: `src/backend/pipeline/pipelineRunner.test.js`

**Step 1: Write the failing test** — `src/backend/pipeline/pipelineRunner.test.js`:
- Test `runPipeline(pipelineId, { io })`: kolejkuje kroki, wykonuje je sekwencyjnie (lub w topologicznym porządku DAG), każdy krok wywołuje `backgroundWorker`-like spawna z agentCLI i zapisuje wynik jako artefakt.
- Test że `pipeline:step_started` i `pipeline:step_done` są emitowane przez socket io mock.
- Test że pętla zatrzymuje się na kroku z `requireApproval: true` i emituje `pipeline:awaiting_approval`.
- Test że `abortRun(runId)` wysyła SIGTERM do aktywnego procesu kroku.

**Step 2: Run test to verify it fails**
`npm test -- src/backend/pipeline/pipelineRunner.test.js --run`

**Step 3: Implement**
```js
// src/backend/pipeline/pipelineRunner.js
import { spawn } from 'child_process';
import * as repo from './pipelineRepository.js';
import { getAgentCmd } from '../agents/backgroundWorker.js';

const activeRuns = new Map(); // runId -> { proc, aborted }

export async function runPipeline(pipelineId, { io }) {
  const pipeline = await repo.getPipeline(pipelineId);
  const run = await repo.createRun(pipelineId);
  const runCtx = { proc: null, aborted: false };
  activeRuns.set(run.id, runCtx);

  const stepsInOrder = topoSort(pipeline.steps); // topological sort by edges

  for (const step of stepsInOrder) {
    if (runCtx.aborted) break;

    io?.emit('pipeline:step_started', { runId: run.id, stepId: step.id, agent: step.agent });

    if (step.requireApproval) {
      io?.emit('pipeline:awaiting_approval', { runId: run.id, stepId: step.id });
      await waitForApproval(run.id, step.id); // resolves on socket event 'pipeline:approve'
    }

    const prevArtifacts = await collectInputArtifacts(run.id, step.dependsOn);
    const result = await executeStep(step, prevArtifacts, runCtx);

    await repo.saveArtifact(run.id, step.id, { type: step.outputType || 'text', content: result });
    io?.emit('pipeline:step_done', { runId: run.id, stepId: step.id, status: 'success' });
  }

  activeRuns.delete(run.id);
}

export function abortRun(runId) {
  const ctx = activeRuns.get(runId);
  if (ctx) { ctx.aborted = true; ctx.proc?.kill('SIGTERM'); }
}

function topoSort(steps) { /* Kahn's algorithm on step.dependsOn[] */ }
async function executeStep(step, prevArtifacts, ctx) { /* spawn agent CLI, stream stdout */ }
async function collectInputArtifacts(runId, dependsOn) { /* repo.getArtifactsForStep for each dep */ }
async function waitForApproval(runId, stepId) { /* event emitter promise */ }
```

**Step 4: Run test to verify it passes**
`npm test -- src/backend/pipeline/pipelineRunner.test.js --run`

**Step 5: Commit**
```bash
git add src/backend/pipeline/pipelineRunner.js src/backend/pipeline/pipelineRunner.test.js
git commit -m "feat(pipeline): implement DAG pipeline runner with step sequencing, artifacts and abort"
```

---

### Task 3: REST API — pipelineRouter

**Files:**
- Create: `src/backend/pipeline/pipelineRouter.js`
- Create: `src/backend/pipeline/pipelineRouter.test.js`
- Modify: `src/backend/server.js` (lub główny `app.js`) — zarejestrować `pipelineRouter` pod `/api/pipelines`

**Step 1: Write the failing test**
- `GET /api/pipelines` — lista pipeline z `id`, `name`, `status`.
- `POST /api/pipelines` — tworzenie nowego DAG, walidacja `{ name, steps[] }`.
- `POST /api/pipelines/:id/run` — uruchomienie — zwraca `{ runId }`.
- `DELETE /api/pipelines/:id/runs/:runId` — abort uruchomionego run.
- `GET /api/pipelines/:id/runs/:runId/artifacts` — lista artefaktów kroku.

**Step 2: Run test to verify it fails**
`npm test -- src/backend/pipeline/pipelineRouter.test.js --run`

**Step 3: Implement**
```js
// src/backend/pipeline/pipelineRouter.js
import { Router } from 'express';
import * as repo from './pipelineRepository.js';
import { runPipeline, abortRun } from './pipelineRunner.js';

const router = Router();

router.get('/', async (req, res) => { res.json(await repo.listPipelines()); });
router.post('/', async (req, res) => { /* validate, create, return */ });
router.post('/:id/run', async (req, res) => {
  const io = req.app.get('io');
  const { id } = await runPipeline(req.params.id, { io });
  res.json({ runId: id });
});
router.delete('/:id/runs/:runId', (req, res) => {
  abortRun(req.params.runId);
  res.json({ aborted: true });
});
router.get('/:id/runs/:runId/artifacts', async (req, res) => { /* repo.getArtifactsForStep */ });

export default router;
```

**Step 4: Run test to verify it passes**
`npm test -- src/backend/pipeline/pipelineRouter.test.js --run`

**Step 5: Commit**
```bash
git add src/backend/pipeline/pipelineRouter.js src/backend/pipeline/pipelineRouter.test.js
git commit -m "feat(pipeline): add REST API router for pipeline CRUD and run management"
```

---

### Task 4: Frontend — Panel Pipeline Builder (zakładka w App.tsx)

**Files:**
- Create: `src/components/PipelineBuilder.tsx`
- Create: `src/components/PipelineBuilder.test.tsx`
- Modify: `src/App.tsx` — dodać zakładkę „Pipeline" w głównej nawigacji

**Step 1: Write the failing test**
- Renderuje listę pipeline z przyciskami „Uruchom" i „Edytuj".
- Kliknięcie „Uruchom" wywołuje `POST /api/pipelines/:id/run`.
- Kliknięcie „Zatwierdź krok" gdy `pipeline:awaiting_approval` emituje odpowiedź przez socket.
- Wyświetla postęp kroków (zielony = done, żółty = running, czerwony = failed, fioletowy = awaiting_approval).

**Step 2: Run test to verify it fails**
`npm test -- src/components/PipelineBuilder.test.tsx --run`

**Step 3: Implement** — Komponent z listą pipeline i wizualnym timeline kroków (prosty vertical stepper bez zależności od ReactFlow w pierwszej iteracji). Wizualny DAG builder jako opcjonalne rozszerzenie.

**Step 4: Run test to verify it passes**
`npm test -- src/components/PipelineBuilder.test.tsx --run`

**Step 5: Commit**
```bash
git add src/components/PipelineBuilder.tsx src/components/PipelineBuilder.test.tsx src/App.tsx
git commit -m "feat(ui): add Pipeline Builder panel with step status visualization and approval controls"
```

---

### Task 5: Weryfikacja E2E i dokumentacja

```bash
npm test -- --run && npm run lint
git add docs/10x-features-session-1.md
git commit -m "docs: mark Agent DAG Pipeline as implemented"
```
