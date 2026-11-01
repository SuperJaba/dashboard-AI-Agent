import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerEmergencyStop } from './emergencyService.js';
import * as db from '../db.js';
import * as llmServersRepo from '../llmServers/llmServersRepository.js';

vi.mock('../db.js', () => ({
  safeQuery: vi.fn(),
}));

vi.mock('../llmServers/llmServersRepository.js', () => ({
  getLlmServers: vi.fn(),
  updateLlmServerStatus: vi.fn(),
}));

describe('Emergency Stop Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('aborts active agent tasks in database', async () => {
    db.safeQuery.mockResolvedValueOnce({ rowCount: 3 }); // UPDATE agent_tasks
    llmServersRepo.getLlmServers.mockResolvedValueOnce([]);

    const result = await triggerEmergencyStop();

    expect(db.safeQuery).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE agent_tasks SET status = 'aborted'"),
      expect.anything()
    );
    expect(result.success).toBe(true);
    expect(result.terminatedTasks).toBe(3);
  });

  it('stops running background worker child processes', async () => {
    db.safeQuery.mockResolvedValueOnce({ rowCount: 0 });
    llmServersRepo.getLlmServers.mockResolvedValueOnce([]);

    const mockProc = {
      pid: 12345,
      kill: vi.fn(),
    };
    const mockActiveProcesses = new Map([['claude', mockProc]]);

    const result = await triggerEmergencyStop({ activeProcesses: mockActiveProcesses });

    expect(mockProc.kill).toHaveBeenCalledWith('SIGTERM');
    expect(mockActiveProcesses.size).toBe(0);
    expect(result.killedProcesses).toBe(1);
  });

  it('unloads active local LLM servers to free VRAM', async () => {
    db.safeQuery.mockResolvedValueOnce({ rowCount: 0 });
    llmServersRepo.getLlmServers.mockResolvedValueOnce([
      { id: 'srv-1', name: 'Local Qwen', is_local: 1, status: 'running', pid: 54321 }
    ]);
    llmServersRepo.updateLlmServerStatus.mockResolvedValueOnce({});

    const killSpy = vi.fn();
    const result = await triggerEmergencyStop({ processKiller: killSpy });

    expect(llmServersRepo.updateLlmServerStatus).toHaveBeenCalledWith('srv-1', 'stopped');
    expect(killSpy).toHaveBeenCalledWith(54321, 'SIGTERM');
    expect(result.freedVram).toBe(true);
  });

  it('emits emergency:triggered event over WebSocket when socket io is provided', async () => {
    db.safeQuery.mockResolvedValueOnce({ rowCount: 1 });
    llmServersRepo.getLlmServers.mockResolvedValueOnce([]);

    const mockIo = {
      emit: vi.fn(),
    };

    const result = await triggerEmergencyStop({ io: mockIo });

    expect(mockIo.emit).toHaveBeenCalledWith(
      'emergency:triggered',
      expect.objectContaining({
        success: true,
        terminatedTasks: 1,
      })
    );
    expect(result.success).toBe(true);
  });
});
