import { spawn } from 'child_process';
import * as repo from './pipelineRepository.js';

export const activeRuns = new Map();

/**
 * Topologically sorts DAG steps based on dependsOn arrays.
 * Throws an Error if a cycle is detected.
 */
export function topoSort(steps) {
  const inDegree = new Map();
  const graph = new Map();
  const stepMap = new Map();

  for (const step of steps) {
    stepMap.set(step.id, step);
    inDegree.set(step.id, 0);
    graph.set(step.id, []);
  }

  for (const step of steps) {
    const deps = step.dependsOn || [];
    for (const dep of deps) {
      if (graph.has(dep)) {
        graph.get(dep).push(step.id);
        inDegree.set(step.id, (inDegree.get(step.id) || 0) + 1);
      }
    }
  }

  const queue = [];
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) {
      queue.push(id);
    }
  }

  const result = [];
  while (queue.length > 0) {
    const currId = queue.shift();
    result.push(stepMap.get(currId));

    const neighbors = graph.get(currId) || [];
    for (const n of neighbors) {
      inDegree.set(n, inDegree.get(n) - 1);
      if (inDegree.get(n) === 0) {
        queue.push(n);
      }
    }
  }

  if (result.length !== steps.length) {
    throw new Error('Cyclic dependency detected in pipeline DAG');
  }

  return result;
}

/**
 * Default executor for agent steps when no custom executor is injected.
 */
async function defaultExecutor(step, inputArtifacts, { signal }) {
  return new Promise((resolve, reject) => {
    let accumulated = '';
    const promptContext = inputArtifacts.length > 0
      ? `\n\nContext Artifacts:\n` + inputArtifacts.map(a => `[${a.type} from ${a.step_id}]:\n${a.content}`).join('\n\n')
      : '';
    const fullPrompt = `${step.prompt || ''}${promptContext}`;

    const child = spawn('node', ['-e', `console.log(process.env.STEP_PROMPT || 'Completed step output')`], {
      env: { ...process.env, STEP_PROMPT: fullPrompt },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    if (signal) {
      signal.addEventListener('abort', () => {
        try { child.kill('SIGTERM'); } catch {}
        reject(new Error('Step execution aborted'));
      });
    }

    child.stdout.on('data', data => { accumulated += data.toString(); });
    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) {
        resolve(accumulated.trim() || 'Step executed successfully');
      } else {
        reject(new Error(`Agent process exited with code ${code}`));
      }
    });
  });
}

/**
 * Approves a paused step for a given runId and stepId.
 */
export function approveStep(runId, stepId) {
  const ctx = activeRuns.get(runId);
  if (!ctx) return false;
  const resolver = ctx.approvalResolvers.get(stepId);
  if (resolver) {
    ctx.approvalResolvers.delete(stepId);
    resolver();
    return true;
  }
  return false;
}

/**
 * Aborts an active pipeline run.
 */
export function abortRun(runId) {
  const ctx = activeRuns.get(runId);
  if (!ctx) return false;
  ctx.aborted = true;
  ctx.abortController.abort();

  // Reject any pending approvals
  for (const [, reject] of ctx.approvalRejecters.entries()) {
    reject(new Error('Pipeline run was aborted'));
  }
  ctx.approvalResolvers.clear();
  ctx.approvalRejecters.clear();
  return true;
}

/**
 * Executes a pipeline DAG run.
 */
export async function runPipeline(pipelineId, { io, executor = defaultExecutor, runId } = {}) {
  const pipeline = await repo.getPipeline(pipelineId);
  if (!pipeline) {
    throw new Error(`Pipeline ${pipelineId} not found`);
  }

  const stepsSorted = topoSort(pipeline.steps || []);
  const run = runId ? (await repo.getRun(runId) || { id: runId }) : await repo.createRun(pipelineId);
  await repo.updateRunStatus(run.id, 'running');

  const abortController = new AbortController();
  const runCtx = {
    id: run.id,
    aborted: false,
    abortController,
    approvalResolvers: new Map(),
    approvalRejecters: new Map()
  };
  activeRuns.set(run.id, runCtx);

  io?.emit('pipeline:run_started', { runId: run.id, pipelineId, totalSteps: stepsSorted.length });

  try {
    for (const step of stepsSorted) {
      if (runCtx.aborted) break;

      io?.emit('pipeline:step_started', {
        runId: run.id,
        stepId: step.id,
        agent: step.agent,
        name: step.name
      });

      if (step.requireApproval) {
        io?.emit('pipeline:awaiting_approval', {
          runId: run.id,
          stepId: step.id,
          name: step.name
        });

        await new Promise((resolve, reject) => {
          runCtx.approvalResolvers.set(step.id, resolve);
          runCtx.approvalRejecters.set(step.id, reject);
        });
      }

      if (runCtx.aborted) break;

      // Collect artifacts from dependencies
      const inputArtifacts = [];
      const deps = step.dependsOn || [];
      for (const depId of deps) {
        const arts = await repo.getArtifactsForStep(run.id, depId);
        inputArtifacts.push(...arts);
      }

      const result = await executor(step, inputArtifacts, { signal: runCtx.abortController.signal });

      const artifact = await repo.saveArtifact(run.id, step.id, {
        type: step.outputType || 'text',
        content: typeof result === 'string' ? result : JSON.stringify(result)
      });

      io?.emit('pipeline:step_done', {
        runId: run.id,
        stepId: step.id,
        status: 'success',
        artifactId: artifact.id
      });
    }

    if (runCtx.aborted) {
      await repo.updateRunStatus(run.id, 'aborted');
      io?.emit('pipeline:run_aborted', { runId: run.id });
      return { id: run.id, status: 'aborted' };
    }

    await repo.updateRunStatus(run.id, 'completed');
    io?.emit('pipeline:run_done', { runId: run.id, status: 'completed' });
    return { id: run.id, status: 'completed' };
  } catch (err) {
    if (runCtx.aborted || err.message?.includes('aborted')) {
      await repo.updateRunStatus(run.id, 'aborted');
      io?.emit('pipeline:run_aborted', { runId: run.id });
      return { id: run.id, status: 'aborted' };
    }

    await repo.updateRunStatus(run.id, 'failed', err.message);
    io?.emit('pipeline:run_failed', { runId: run.id, error: err.message });
    return { id: run.id, status: 'failed', error: err.message };
  } finally {
    activeRuns.delete(run.id);
  }
}
