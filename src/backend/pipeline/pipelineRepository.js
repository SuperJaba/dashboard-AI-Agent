import crypto from 'crypto';
import { safeQuery } from '../db.js';

function parsePipelineRow(row) {
  if (!row) return null;
  let steps = [];
  try {
    steps = typeof row.steps_json === 'string' ? JSON.parse(row.steps_json) : (row.steps_json || []);
  } catch {
    steps = [];
  }
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    steps,
    status: row.status || 'idle',
    createdAt: row.created_at
  };
}

export async function createPipeline({ name, description = '', steps = [] }) {
  const id = crypto.randomUUID();
  const stepsJson = JSON.stringify(steps);
  const { rows } = await safeQuery(
    'INSERT INTO pipelines (id, name, description, steps_json, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [id, name, description, stepsJson, 'idle']
  );
  return parsePipelineRow(rows[0]) || { id, name, description, steps, status: 'idle' };
}

export async function getPipeline(id) {
  const { rows } = await safeQuery('SELECT * FROM pipelines WHERE id = $1', [id]);
  return parsePipelineRow(rows[0]);
}

export async function listPipelines() {
  const { rows } = await safeQuery('SELECT * FROM pipelines ORDER BY created_at DESC');
  return rows.map(parsePipelineRow).filter(Boolean);
}

export async function updatePipelineStatus(id, status) {
  const { rows } = await safeQuery(
    'UPDATE pipelines SET status = $1 WHERE id = $2 RETURNING *',
    [status, id]
  );
  return parsePipelineRow(rows[0]) || { id, status };
}

export async function createRun(pipelineId) {
  const id = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  const { rows } = await safeQuery(
    'INSERT INTO pipeline_runs (id, pipeline_id, status, started_at) VALUES ($1, $2, $3, $4) RETURNING *',
    [id, pipelineId, 'queued', startedAt]
  );
  return rows[0] || { id, pipeline_id: pipelineId, status: 'queued', started_at: startedAt };
}

export async function getRun(runId) {
  const { rows } = await safeQuery('SELECT * FROM pipeline_runs WHERE id = $1', [runId]);
  return rows[0] || null;
}

export async function updateRunStatus(runId, status, error = null) {
  if (error !== null && error !== undefined) {
    const { rows } = await safeQuery(
      'UPDATE pipeline_runs SET status = $1, error = $2 WHERE id = $3 RETURNING *',
      [status, error, runId]
    );
    return rows[0] || { id: runId, status, error };
  }
  const { rows } = await safeQuery(
    'UPDATE pipeline_runs SET status = $1 WHERE id = $2 RETURNING *',
    [status, runId]
  );
  return rows[0] || { id: runId, status };
}

export async function saveArtifact(runId, stepId, { type, content }) {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const { rows } = await safeQuery(
    'INSERT INTO pipeline_artifacts (id, run_id, step_id, type, content, created_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
    [id, runId, stepId, type, content, createdAt]
  );
  return rows[0] || { id, run_id: runId, step_id: stepId, type, content, created_at: createdAt };
}

export async function getArtifactsForStep(runId, stepId) {
  const { rows } = await safeQuery(
    'SELECT * FROM pipeline_artifacts WHERE run_id = $1 AND step_id = $2 ORDER BY created_at ASC',
    [runId, stepId]
  );
  return rows;
}

export async function getArtifactsForRun(runId) {
  const { rows } = await safeQuery(
    'SELECT * FROM pipeline_artifacts WHERE run_id = $1 ORDER BY created_at ASC',
    [runId]
  );
  return rows;
}
