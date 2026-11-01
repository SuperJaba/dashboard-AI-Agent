import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runPipeline, abortRun, approveStep, topoSort } from './pipelineRunner.js';
import * as repo from './pipelineRepository.js';

describe('pipelineRunner', () => {
  let mockIo;

  beforeEach(() => {
    mockIo = {
      emit: vi.fn()
    };
  });

  describe('topoSort', () => {
    it('sorts independent and dependent steps in topological order', () => {
      const steps = [
        { id: 'qa', dependsOn: ['code'] },
        { id: 'arch', dependsOn: [] },
        { id: 'deploy', dependsOn: ['qa'] },
        { id: 'code', dependsOn: ['arch'] }
      ];

      const sorted = topoSort(steps);
      const ids = sorted.map(s => s.id);
      expect(ids.indexOf('arch')).toBeLessThan(ids.indexOf('code'));
      expect(ids.indexOf('code')).toBeLessThan(ids.indexOf('qa'));
      expect(ids.indexOf('qa')).toBeLessThan(ids.indexOf('deploy'));
    });

    it('throws error when cyclic dependency detected', () => {
      const steps = [
        { id: 'step-a', dependsOn: ['step-b'] },
        { id: 'step-b', dependsOn: ['step-a'] }
      ];

      expect(() => topoSort(steps)).toThrow(/cyclic/i);
    });
  });

  describe('runPipeline execution', () => {
    it('executes steps sequentially, collects artifacts and emits socket events', async () => {
      const pipeline = await repo.createPipeline({
        name: 'Runner Test Pipeline',
        steps: [
          { id: 's1', name: 'Architect', agent: 'claude', prompt: 'Create API spec', dependsOn: [] },
          { id: 's2', name: 'Coder', agent: 'gemini', prompt: 'Implement API', dependsOn: ['s1'], outputType: 'code' }
        ]
      });

      const executor = vi.fn()
        .mockResolvedValueOnce('SPEC ARTIFACT CONTENT')
        .mockResolvedValueOnce('CODE IMPLEMENTATION CONTENT');

      const runPromise = runPipeline(pipeline.id, { io: mockIo, executor });
      const runResult = await runPromise;

      expect(runResult).toBeDefined();
      expect(runResult.status).toBe('completed');
      expect(executor).toHaveBeenCalledTimes(2);

      // Verify socket events
      expect(mockIo.emit).toHaveBeenCalledWith('pipeline:step_started', expect.objectContaining({
        runId: runResult.id,
        stepId: 's1'
      }));
      expect(mockIo.emit).toHaveBeenCalledWith('pipeline:step_done', expect.objectContaining({
        runId: runResult.id,
        stepId: 's1',
        status: 'success'
      }));
      expect(mockIo.emit).toHaveBeenCalledWith('pipeline:run_done', expect.objectContaining({
        runId: runResult.id,
        status: 'completed'
      }));

      // Verify artifacts saved in repo
      const artifacts = await repo.getArtifactsForRun(runResult.id);
      expect(artifacts).toHaveLength(2);
      expect(artifacts[0].content).toBe('SPEC ARTIFACT CONTENT');
      expect(artifacts[1].content).toBe('CODE IMPLEMENTATION CONTENT');
    });

    it('pauses and waits for approval when requireApproval is true', async () => {
      const pipeline = await repo.createPipeline({
        name: 'Approval Pipeline',
        steps: [
          { id: 'plan', name: 'Planner', agent: 'claude', prompt: 'Draft plan' },
          { id: 'execute', name: 'Executor', agent: 'gemini', prompt: 'Run plan', requireApproval: true, dependsOn: ['plan'] }
        ]
      });

      const executor = vi.fn()
        .mockResolvedValueOnce('PLAN CONTENT')
        .mockResolvedValueOnce('EXECUTION CONTENT');

      let executionFinished = false;
      const runPromise = runPipeline(pipeline.id, { io: mockIo, executor }).then(res => {
        executionFinished = true;
        return res;
      });

      // Allow event loop to progress to approval pause
      await new Promise(r => setTimeout(r, 50));
      expect(executionFinished).toBe(false);
      expect(mockIo.emit).toHaveBeenCalledWith('pipeline:awaiting_approval', expect.objectContaining({
        stepId: 'execute'
      }));

      // Find the run id from repo
      const allPipelines = await repo.listPipelines();
      expect(allPipelines).toBeDefined();

      // Approve step
      const awaitingCall = mockIo.emit.mock.calls.find(c => c[0] === 'pipeline:awaiting_approval');
      const runId = awaitingCall[1].runId;
      approveStep(runId, 'execute');

      const completedRun = await runPromise;
      expect(completedRun.status).toBe('completed');
      expect(executionFinished).toBe(true);
    });

    it('allows aborting an in-progress pipeline run', async () => {
      const pipeline = await repo.createPipeline({
        name: 'Abort Pipeline',
        steps: [
          { id: 'long-step', name: 'Slow Coder', agent: 'gemini', prompt: 'Slow build' }
        ]
      });

      const executor = vi.fn().mockImplementation((step, inputs, { signal }) => {
        return new Promise((resolve, reject) => {
          signal?.addEventListener('abort', () => reject(new Error('Step aborted')));
          setTimeout(() => resolve('Finished'), 1000);
        });
      });

      const runPromise = runPipeline(pipeline.id, { io: mockIo, executor });

      await new Promise(r => setTimeout(r, 20));
      const startCall = mockIo.emit.mock.calls.find(c => c[0] === 'pipeline:step_started');
      const runId = startCall[1].runId;

      abortRun(runId);

      const abortedResult = await runPromise;
      expect(abortedResult.status).toBe('aborted');
      expect(mockIo.emit).toHaveBeenCalledWith('pipeline:run_aborted', expect.objectContaining({
        runId
      }));
    });
  });
});
