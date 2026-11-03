import express from 'express';
import * as schedulerRepo from './schedulerRepository.js';
import { schedulerService } from './schedulerService.js';

export const schedulerRouter = express.Router();

/**
 * GET /api/scheduler/presets
 * Returns available predefined task presets.
 */
schedulerRouter.get('/presets', (req, res) => {
  res.json({ presets: schedulerService.getPresets() });
});

/**
 * GET /api/scheduler/tasks
 * Returns all configured scheduled tasks.
 */
schedulerRouter.get('/tasks', async (req, res) => {
  try {
    const tasks = await schedulerRepo.getScheduledTasks();
    const tasksWithRuntime = tasks.map(t => ({
      ...t,
      is_running: schedulerService.runningTasks.has(t.id),
      has_active_cron: schedulerService.cronJobs.has(t.id)
    }));
    res.json({ tasks: tasksWithRuntime });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/scheduler/tasks/:id
 * Returns a single scheduled task by ID.
 */
schedulerRouter.get('/tasks/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const task = await schedulerRepo.getScheduledTaskById(id);
    if (!task) {
      return res.status(404).json({ error: 'Zadanie nie zostało znalezione.' });
    }
    res.json({
      task: {
        ...task,
        is_running: schedulerService.runningTasks.has(task.id),
        has_active_cron: schedulerService.cronJobs.has(task.id)
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/scheduler/tasks
 * Creates a new scheduled task.
 */
schedulerRouter.post('/tasks', async (req, res) => {
  try {
    const { name, task_type, command, cron_expression, enabled = true } = req.body || {};

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Nazwa zadania jest wymagana.' });
    }

    if (!cron_expression || !schedulerService.validateCron(cron_expression)) {
      return res.status(400).json({ error: 'Nieprawidłowe wyrażenie harmonogramu cron (np. 0 3 * * *).' });
    }

    const newTask = await schedulerRepo.createScheduledTask({
      name: name.trim(),
      task_type: task_type || 'custom_command',
      command: command?.trim() || '',
      cron_expression: cron_expression.trim(),
      enabled: Boolean(enabled),
      last_status: 'idle'
    });

    if (newTask.enabled) {
      schedulerService.scheduleJob(newTask);
    }

    res.status(201).json({ success: true, task: newTask });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/scheduler/tasks/:id
 * Updates an existing scheduled task.
 */
schedulerRouter.put('/tasks/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await schedulerRepo.getScheduledTaskById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Zadanie nie zostało znalezione.' });
    }

    const { name, task_type, command, cron_expression, enabled } = req.body || {};

    const updatedCron = cron_expression !== undefined ? cron_expression.trim() : existing.cron_expression;
    if (!schedulerService.validateCron(updatedCron)) {
      return res.status(400).json({ error: 'Nieprawidłowe wyrażenie harmonogramu cron.' });
    }

    const updatedTask = await schedulerRepo.updateScheduledTask(id, {
      name: name !== undefined ? name.trim() : existing.name,
      task_type: task_type !== undefined ? task_type : existing.task_type,
      command: command !== undefined ? command.trim() : existing.command,
      cron_expression: updatedCron,
      enabled: enabled !== undefined ? Boolean(enabled) : existing.enabled
    });

    schedulerService.scheduleJob(updatedTask);

    res.json({ success: true, task: updatedTask });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/scheduler/tasks/:id/toggle
 * Toggles a task enabled/disabled state.
 */
schedulerRouter.patch('/tasks/:id/toggle', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await schedulerRepo.getScheduledTaskById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Zadanie nie zostało znalezione.' });
    }

    const targetEnabled = req.body?.enabled !== undefined ? Boolean(req.body.enabled) : !existing.enabled;
    const updated = await schedulerRepo.setScheduledTaskEnabled(id, targetEnabled);

    if (targetEnabled) {
      schedulerService.scheduleJob(updated);
    } else {
      schedulerService.stopJob(id);
    }

    res.json({ success: true, task: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/scheduler/tasks/:id
 * Deletes a scheduled task.
 */
schedulerRouter.delete('/tasks/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await schedulerRepo.getScheduledTaskById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Zadanie nie zostało znalezione.' });
    }

    schedulerService.stopJob(id);
    await schedulerRepo.deleteScheduledTask(id);

    res.json({ success: true, message: 'Zadanie zostało usunięte.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/scheduler/tasks/:id/run
 * Manually executes a scheduled task now.
 */
schedulerRouter.post('/tasks/:id/run', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await schedulerRepo.getScheduledTaskById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Zadanie nie zostało znalezione.' });
    }

    const result = await schedulerService.runTask(id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
