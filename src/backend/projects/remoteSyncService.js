import fetch from 'node-fetch';
import * as projectsRepo from './projectsRepository.js';
import { updateTaskInWorkspaceFile } from './tasksSyncService.js';

/**
 * Fetch tasks from remote project management API.
 * Expected response format (JSON array):
 * [{ id?: string, title: string, status: 'pending'|'completed' }]
 */
export async function fetchRemoteTasks() {
  const apiUrl = process.env.REMOTE_API_URL;
  const token = process.env.REMOTE_API_TOKEN;
  if (!apiUrl) {
    throw new Error('REMOTE_API_URL is not set');
  }
  const response = await fetch(apiUrl, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!response.ok) {
    throw new Error(`Remote API error: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error('Remote API returned unexpected format');
  }
  return data.map(item => ({
    title: item.title?.trim() ?? '',
    status: item.status === 'completed' ? 'completed' : 'pending'
  })).filter(t => t.title);
}

/**
 * Synchronize remote tasks into the local project's task list.
 * It merges remote tasks with existing ones, adding new ones and updating statuses.
 */
export async function syncRemoteProjectTasks(projectId, _options = {}) {
  const projects = await projectsRepo.getProjects();
  const project = projects.find(p => p.id === parseInt(projectId, 10));
  if (!project) {
    throw new Error(`Project #${projectId} not found`);
  }

  const remoteTasks = await fetchRemoteTasks();
  const localTasks = Array.isArray(project.tasks) ? [...project.tasks] : [];

  const updatedInDb = [];
  const updatedInWorkspace = [];

  // Merge remote into local
  for (const rt of remoteTasks) {
    const existing = localTasks.find(t => t.title.toLowerCase() === rt.title.toLowerCase());
    if (!existing) {
      // New task from remote
      localTasks.push({
        id: Date.now() + Math.random(), // simple unique id
        title: rt.title,
        meta: 'remote',
        status: rt.status
      });
      updatedInDb.push({ title: rt.title, reason: 'Added from remote' });
    } else if (existing.status !== rt.status) {
      // Status changed remotely
      existing.status = rt.status;
      updatedInDb.push({ title: rt.title, reason: `Remote status ${rt.status}` });
    }

    // Optionally update workspace markdown if task became completed
    if (project.path && rt.status === 'completed') {
      const res = updateTaskInWorkspaceFile(project.path, rt.title, rt.status);
      if (res.updated) {
        updatedInWorkspace.push({ title: rt.title, file: res.file, status: rt.status });
      }
    }
  }

  const updatedProject = await projectsRepo.updateProject(projectId, { tasks: localTasks });

  return {
    success: true,
    projectId: parseInt(projectId, 10),
    projectName: project.name,
    updatedInDb,
    updatedInWorkspace,
    totalTasks: localTasks.length,
    completedTasks: localTasks.filter(t => t.status === 'completed').length,
    pendingTasks: localTasks.filter(t => t.status !== 'completed').length,
    project: updatedProject
  };
}

/**
 * Sync remote tasks for all projects.
 */
export async function syncAllRemoteProjects(options = {}) {
  const projects = await projectsRepo.getProjects();
  const results = [];
  for (const p of projects) {
    try {
      const res = await syncRemoteProjectTasks(p.id, options);
      results.push(res);
    } catch (err) {
      results.push({ success: false, projectId: p.id, projectName: p.name, error: err.message });
    }
  }
  return results;
}
