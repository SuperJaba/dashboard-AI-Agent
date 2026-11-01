import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import * as repo from './pipelineRepository.js';
import { safeQuery, inMemoryStore, migrate } from '../db.js';

describe('pipelineRepository', () => {
  beforeAll(async () => {
    try {
      await migrate();
    } catch {}
  });

  beforeEach(async () => {
    // Clear test tables in memory
    if (inMemoryStore) {
      inMemoryStore.pipelines = [];
      inMemoryStore.pipeline_runs = [];
      inMemoryStore.pipeline_artifacts = [];
    }
    try {
      await safeQuery('DELETE FROM pipeline_artifacts');
      await safeQuery('DELETE FROM pipeline_runs');
      await safeQuery('DELETE FROM pipelines');
    } catch {}
  });

  it('creates and retrieves a pipeline with steps', async () => {
    const steps = [
      { id: 'step-arch', name: 'Architect', agent: 'claude', role: 'Architect', prompt: 'Create spec' },
      { id: 'step-code', name: 'Coder', agent: 'gemini', role: 'Coder', dependsOn: ['step-arch'], prompt: 'Implement code' }
    ];

    const created = await repo.createPipeline({
      name: 'Full Feature Delivery Pipeline',
      description: 'End-to-end multi-agent pipeline',
      steps
    });

    expect(created).toBeDefined();
    expect(created.id).toBeDefined();
    expect(created.name).toBe('Full Feature Delivery Pipeline');
    expect(created.status).toBe('idle');
    expect(created.steps).toHaveLength(2);
    expect(created.steps[0].id).toBe('step-arch');

    const fetched = await repo.getPipeline(created.id);
    expect(fetched).toBeDefined();
    expect(fetched.id).toBe(created.id);
    expect(fetched.steps).toEqual(steps);
  });

  it('lists existing pipelines', async () => {
    await repo.createPipeline({ name: 'Pipeline A', steps: [] });
    await repo.createPipeline({ name: 'Pipeline B', steps: [] });

    const list = await repo.listPipelines();
    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(list.some(p => p.name === 'Pipeline A')).toBe(true);
    expect(list.some(p => p.name === 'Pipeline B')).toBe(true);
  });

  it('updates pipeline status', async () => {
    const pipeline = await repo.createPipeline({ name: 'Status Check', steps: [] });
    const updated = await repo.updatePipelineStatus(pipeline.id, 'running');
    expect(updated.status).toBe('running');

    const fetched = await repo.getPipeline(pipeline.id);
    expect(fetched.status).toBe('running');
  });

  it('creates and updates pipeline runs', async () => {
    const pipeline = await repo.createPipeline({ name: 'Run Check', steps: [] });
    const run = await repo.createRun(pipeline.id);

    expect(run).toBeDefined();
    expect(run.id).toBeDefined();
    expect(run.pipeline_id).toBe(pipeline.id);
    expect(run.status).toBe('queued');

    const updatedRun = await repo.updateRunStatus(run.id, 'completed');
    expect(updatedRun.status).toBe('completed');
  });

  it('saves and retrieves pipeline artifacts', async () => {
    const pipeline = await repo.createPipeline({ name: 'Artifact Check', steps: [] });
    const run = await repo.createRun(pipeline.id);

    const artifact = await repo.saveArtifact(run.id, 'step-arch', {
      type: 'spec',
      content: '# Spec Document\nRequirements and boundaries.'
    });

    expect(artifact).toBeDefined();
    expect(artifact.id).toBeDefined();

    const stepArtifacts = await repo.getArtifactsForStep(run.id, 'step-arch');
    expect(stepArtifacts).toHaveLength(1);
    expect(stepArtifacts[0].type).toBe('spec');
    expect(stepArtifacts[0].content).toContain('# Spec Document');

    const allArtifacts = await repo.getArtifactsForRun(run.id);
    expect(allArtifacts).toHaveLength(1);
  });
});
