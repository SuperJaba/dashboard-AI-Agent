import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { schedulerService, TASK_PRESETS } from './schedulerService.js';
import { schedulerRouter } from './schedulerRouter.js';
import * as schedulerRepo from './schedulerRepository.js';

describe('SchedulerService', () => {
  beforeEach(() => {
    schedulerService.stopAll();
    schedulerService.runningTasks.clear();
  });

  afterEach(() => {
    schedulerService.stopAll();
  });

  it('validates cron expressions properly', () => {
    expect(schedulerService.validateCron('0 3 * * *')).toBe(true);
    expect(schedulerService.validateCron('*/15 * * * *')).toBe(true);
    expect(schedulerService.validateCron('invalid-cron')).toBe(false);
    expect(schedulerService.validateCron('')).toBe(false);
    expect(schedulerService.validateCron(null)).toBe(false);
  });

  it('returns task presets with Polish descriptions', () => {
    const presets = schedulerService.getPresets();
    expect(presets.length).toBeGreaterThanOrEqual(3);
    const npmAudit = presets.find(p => p.type === 'npm_audit');
    expect(npmAudit).toBeDefined();
    expect(npmAudit?.name).toBe('Nocny audyt bezpieczeństwa');
  });

  it('schedules and stops jobs correctly', () => {
    const task = {
      id: 999,
      name: 'Test Task',
      cron_expression: '0 4 * * *',
      enabled: true
    };

    const job = schedulerService.scheduleJob(task);
    expect(job).not.toBeNull();
    expect(schedulerService.cronJobs.has(999)).toBe(true);

    schedulerService.stopJob(999);
    expect(schedulerService.cronJobs.has(999)).toBe(false);
  });

  it('refuses to schedule disabled tasks or invalid cron', () => {
    const disabledTask = { id: 100, enabled: false, cron_expression: '0 0 * * *' };
    expect(schedulerService.scheduleJob(disabledTask)).toBeNull();

    const invalidCronTask = { id: 101, enabled: true, cron_expression: 'not a cron' };
    expect(schedulerService.scheduleJob(invalidCronTask)).toBeNull();
  });

  it('runs a task successfully and updates repo status', async () => {
    const fakeTask = {
      id: 888,
      name: 'Echo Test',
      task_type: 'custom_command',
      command: 'node -e "console.log(\'Echo Output\')"',
      cron_expression: '0 0 * * *',
      enabled: true
    };

    vi.spyOn(schedulerRepo, 'getScheduledTaskById').mockResolvedValue(fakeTask);
    const recordSpy = vi.spyOn(schedulerRepo, 'recordTaskRun').mockResolvedValue({
      ...fakeTask,
      last_status: 'success',
      last_output: 'Echo Output'
    });

    const result = await schedulerService.runTask(888);
    expect(result.success).toBe(true);
    expect(result.status).toBe('success');
    expect(result.output).toContain('Echo Output');
    expect(recordSpy).toHaveBeenCalled();
  });

  it('prevents concurrent executions of the same task', async () => {
    schedulerService.runningTasks.add(777);
    vi.spyOn(schedulerRepo, 'getScheduledTaskById').mockResolvedValue({
      id: 777,
      name: 'Running Task',
      command: 'node -e "console.log(1)"'
    });

    const res = await schedulerService.runTask(777);
    expect(res.status).toBe('running');
    expect(res.message).toContain('jest już w trakcie wykonywania');
  });
});

describe('SchedulerRouter HTTP API', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/scheduler', schedulerRouter);
  });

  it('GET /api/scheduler/presets returns list of presets', async () => {
    const res = await request(app).get('/api/scheduler/presets');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.presets)).toBe(true);
    expect(res.body.presets.length).toBeGreaterThan(0);
  });

  it('GET /api/scheduler/tasks returns task list with runtime flags', async () => {
    const res = await request(app).get('/api/scheduler/tasks');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.tasks)).toBe(true);
  });

  it('POST /api/scheduler/tasks rejects invalid data', async () => {
    const missingName = await request(app).post('/api/scheduler/tasks').send({
      cron_expression: '0 0 * * *'
    });
    expect(missingName.status).toBe(400);
    expect(missingName.body.error).toContain('Nazwa zadania jest wymagana');

    const invalidCron = await request(app).post('/api/scheduler/tasks').send({
      name: 'Bad Cron Task',
      cron_expression: 'invalid'
    });
    expect(invalidCron.status).toBe(400);
    expect(invalidCron.body.error).toContain('Nieprawidłowe wyrażenie harmonogramu');
  });

  it('POST /api/scheduler/tasks creates a task and returns 201', async () => {
    const res = await request(app).post('/api/scheduler/tasks').send({
      name: 'Nowe zadanie testowe',
      task_type: 'custom_command',
      command: 'echo "hello"',
      cron_expression: '0 12 * * *',
      enabled: true
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.task.name).toBe('Nowe zadanie testowe');
  });

  it('PATCH /api/scheduler/tasks/:id/toggle toggles task enabled state', async () => {
    const tasksRes = await request(app).get('/api/scheduler/tasks');
    const firstTask = tasksRes.body.tasks[0];
    if (!firstTask) return;

    const toggleRes = await request(app)
      .patch(`/api/scheduler/tasks/${firstTask.id}/toggle`)
      .send({ enabled: !firstTask.enabled });

    expect(toggleRes.status).toBe(200);
    expect(toggleRes.body.success).toBe(true);
    expect(toggleRes.body.task.enabled).toBe(!firstTask.enabled);
  });

  it('POST /api/scheduler/tasks/:id/run manually executes task', async () => {
    const tasksRes = await request(app).get('/api/scheduler/tasks');
    const firstTask = tasksRes.body.tasks[0];
    if (!firstTask) return;

    vi.spyOn(schedulerService, 'runTask').mockResolvedValue({
      success: true,
      status: 'success',
      output: 'Ręczne uruchomienie zakończone pomyślnie'
    });

    const runRes = await request(app).post(`/api/scheduler/tasks/${firstTask.id}/run`);
    expect(runRes.status).toBe(200);
    expect(runRes.body.success).toBe(true);
  });

  it('DELETE /api/scheduler/tasks/:id deletes task and returns 200', async () => {
    // Create a temporary task to delete
    const createRes = await request(app).post('/api/scheduler/tasks').send({
      name: 'Do usunięcia',
      cron_expression: '0 0 * * *'
    });
    const tempId = createRes.body.task.id;

    const delRes = await request(app).delete(`/api/scheduler/tasks/${tempId}`);
    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);
  });
});
