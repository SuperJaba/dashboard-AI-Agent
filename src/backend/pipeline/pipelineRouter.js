import { Router } from 'express';
import * as repo from './pipelineRepository.js';
import { runPipeline, abortRun, approveStep } from './pipelineRunner.js';

export const pipelineRouter = Router();

// GET /api/pipelines - list all pipelines
pipelineRouter.get('/', async (req, res) => {
  try {
    const pipelines = await repo.listPipelines();
    res.json(pipelines);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/pipelines - create a new pipeline
pipelineRouter.post('/', async (req, res) => {
  try {
    const { name, description = '', steps = [] } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Nazwa potoku (name) jest wymagana.' });
    }

    const created = await repo.createPipeline({
      name: name.trim(),
      description,
      steps: Array.isArray(steps) ? steps : []
    });

    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pipelines/:id - get single pipeline
pipelineRouter.get('/:id', async (req, res) => {
  try {
    const pipeline = await repo.getPipeline(req.params.id);
    if (!pipeline) {
      return res.status(404).json({ error: 'Nie znaleziono potoku.' });
    }
    res.json(pipeline);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/pipelines/:id/run - trigger a pipeline run
pipelineRouter.post('/:id/run', async (req, res) => {
  try {
    const pipeline = await repo.getPipeline(req.params.id);
    if (!pipeline) {
      return res.status(404).json({ error: 'Nie znaleziono potoku.' });
    }

    const io = req.app.get('io');
    const run = await repo.createRun(pipeline.id);

    // Fire-and-forget background execution
    runPipeline(pipeline.id, { io, runId: run.id }).catch(err => {
      console.error(`[Pipeline Error] Run ${run.id} failed:`, err);
    });

    res.json({ runId: run.id, status: 'queued' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/pipelines/:id/runs/:runId/approve - approve a paused step
pipelineRouter.post('/:id/runs/:runId/approve', (req, res) => {
  try {
    const { stepId } = req.body;
    const approved = approveStep(req.params.runId, stepId);
    res.json({ approved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/pipelines/:id/runs/:runId - abort run
pipelineRouter.delete('/:id/runs/:runId', (req, res) => {
  try {
    abortRun(req.params.runId);
    res.json({ aborted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pipelines/:id/runs/:runId/artifacts - get artifacts for run
pipelineRouter.get('/:id/runs/:runId/artifacts', async (req, res) => {
  try {
    const artifacts = await repo.getArtifactsForRun(req.params.runId);
    res.json(artifacts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default pipelineRouter;
