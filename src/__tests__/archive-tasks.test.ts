import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDashboardState } from '../hooks/useDashboardState';
import { apiClient } from '../shared/api-client';

vi.mock('../shared/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn()
  }
}));

describe('Archive Tasks Feature', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (apiClient.get as any).mockImplementation((url: string) => {
      if (url === '/api/projects') {
        return Promise.resolve([
          {
            id: 1,
            name: 'Demo Project',
            path: '/demo',
            complete: 50,
            tasks: [
              { id: 101, title: 'Task 1 (pending)', status: 'pending', meta: 'TODO' },
              { id: 102, title: 'Task 2 (completed)', status: 'completed', meta: 'TODO' },
              { id: 103, title: 'Task 3 (completed)', status: 'completed', meta: 'TODO' }
            ]
          }
        ]);
      }
      if (url === '/api/servers') return Promise.resolve([]);
      if (url === '/api/agents') return Promise.resolve([]);
      if (url === '/api/settings') return Promise.resolve({});
      return Promise.resolve([]);
    });
    (apiClient.put as any).mockResolvedValue({ success: true });
  });

  it('archives all completed tasks when none are selected', async () => {
    const { result } = renderHook(() => useDashboardState());

    // Wait for initial load
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.activeProject).not.toBeNull();
    expect(result.current.selectedTaskIds).toEqual([]);

    // Call archiveTasks with no selections
    await act(async () => {
      await result.current.archiveTasks();
    });

    expect(apiClient.put).toHaveBeenCalledWith(
      '/api/projects/1/tasks',
      expect.objectContaining({
        tasks: [
          { id: 101, title: 'Task 1 (pending)', status: 'pending', meta: 'TODO' },
          expect.objectContaining({ id: 102, status: 'archived' }),
          expect.objectContaining({ id: 103, status: 'archived' })
        ],
        complete: 0 // remaining 1 active task is pending, so 0/1 = 0%
      })
    );

    const updatedProject = result.current.projects.find(p => p.id === 1);
    expect(updatedProject?.tasks?.filter((t: any) => t.status === 'archived').length).toBe(2);
  });

  it('archives ONLY the selected completed tasks when specific completed tasks are selected', async () => {
    const { result } = renderHook(() => useDashboardState());

    await act(async () => {
      await Promise.resolve();
    });

    // Select only task 102 (completed) and task 101 (pending)
    act(() => {
      result.current.setSelectedTaskIds([101, 102]);
    });

    // Call archiveTasks
    await act(async () => {
      await result.current.archiveTasks();
    });

    // Task 102 should be archived, Task 103 should remain completed, Task 101 should remain pending
    expect(apiClient.put).toHaveBeenCalledWith(
      '/api/projects/1/tasks',
      expect.objectContaining({
        tasks: [
          { id: 101, title: 'Task 1 (pending)', status: 'pending', meta: 'TODO' },
          expect.objectContaining({ id: 102, status: 'archived' }),
          { id: 103, title: 'Task 3 (completed)', status: 'completed', meta: 'TODO' }
        ],
        complete: 50 // remaining active tasks: 101 (pending), 103 (completed) -> 1/2 = 50%
      })
    );

    // Selected task ID 102 should be removed, while 101 remains
    expect(result.current.selectedTaskIds).toEqual([101]);
  });

  it('restores an archived task back to completed', async () => {
    (apiClient.get as any).mockImplementation((url: string) => {
      if (url === '/api/projects') {
        return Promise.resolve([
          {
            id: 1,
            name: 'Demo Project',
            path: '/demo',
            complete: 0,
            tasks: [
              { id: 101, title: 'Task 1 (pending)', status: 'pending', meta: 'TODO' },
              { id: 102, title: 'Task 2 (archived)', status: 'archived', meta: 'TODO' }
            ]
          }
        ]);
      }
      if (url === '/api/settings') return Promise.resolve({});
      return Promise.resolve([]);
    });

    const { result } = renderHook(() => useDashboardState());

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await result.current.restoreTask(102);
    });

    expect(apiClient.put).toHaveBeenCalledWith(
      '/api/projects/1/tasks',
      expect.objectContaining({
        tasks: [
          { id: 101, title: 'Task 1 (pending)', status: 'pending', meta: 'TODO' },
          expect.objectContaining({ id: 102, status: 'completed' })
        ],
        complete: 50 // 1 completed out of 2 active tasks
      })
    );
  });
});
