import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncRemoteProjectTasks } from './remoteSyncService.js';

// Mock dependencies
vi.mock('../projectsRepository.js', () => {
  return {
    getProjects: vi.fn(),
    updateProject: vi.fn()
  };
});

vi.mock('./tasksSyncService.js', () => {
  return {
    updateTaskInWorkspaceFile: vi.fn(() => ({ updated: false }))
  };
});

vi.mock('node-fetch', () => {
  return {
    default: vi.fn()
  };
});

const { getProjects, updateProject } = await import('../projectsRepository.js');
const { updateTaskInWorkspaceFile } = await import('./tasksSyncService.js');
const fetch = (await import('node-fetch')).default;

describe('syncRemoteProjectTasks', () => {
  const mockProject = {
    id: 1,
    name: 'TestProj',
    path: '/tmp/project',
    tasks: []
  };

  beforeEach(() => {
    vi.resetAllMocks();
    process.env.REMOTE_API_URL = 'https://example.com/api/tasks';
    process.env.REMOTE_API_TOKEN = 'test-token';
    // Mock project repo
    (getProjects as any).mockResolvedValue([mockProject]);
    (updateProject as any).mockImplementation((id, data) => {
      return Promise.resolve({ ...mockProject, ...data });
    });
  });

  it('adds new remote tasks to local project', async () => {
    // Remote returns a single pending task
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => [{ title: 'Task A', status: 'pending' }]
    });

    const res = await syncRemoteProjectTasks(1);
    expect(res.success).toBe(true);
    expect(res.totalTasks).toBe(1);
    expect(res.pendingTasks).toBe(1);
    expect(res.updatedInDb).toHaveLength(1);
    expect(res.updatedInDb[0].title).toBe('Task A');
    expect(res.updatedInDb[0].reason).toBe('Added from remote');
    // No workspace updates expected in this test environment
    expect(res.updatedInWorkspace).toHaveLength(0);
  });

  it('updates status of existing task based on remote', async () => {
    // Local project already has a pending task
    const localTask = {
      id: 100,
      title: 'Task B',
      meta: 'local',
      status: 'pending'
    };
    mockProject.tasks = [localTask];

    // Remote reports the same task as completed
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => [{ title: 'Task B', status: 'completed' }]
    });

    const res = await syncRemoteProjectTasks(1);
    expect(res.success).toBe(true);
    expect(res.totalTasks).toBe(1);
    expect(res.completedTasks).toBe(1);
    expect(res.updatedInDb).toHaveLength(1);
    expect(res.updatedInDb[0].title).toBe('Task B');
    expect(res.updatedInDb[0].reason).toBe('Remote status completed');
  });
});
