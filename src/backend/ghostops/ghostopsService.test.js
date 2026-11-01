import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGhostopsService } from './ghostopsService.js';
import { TASK_PRESETS } from '../scheduler/schedulerService.js';

describe('Ghost Ops Service & Scheduler Integration', () => {
  let mockCiMonitor;
  let mockReproService;
  let mockPrService;
  let mockTelegramNotifier;

  beforeEach(() => {
    mockCiMonitor = {
      getRecentFailures: vi.fn(),
      getJobLogs: vi.fn(),
    };
    mockReproService = {
      createWorktree: vi.fn(),
      runAgentFix: vi.fn(),
      cleanupWorktree: vi.fn(),
    };
    mockPrService = {
      buildPrBody: vi.fn((data) => `PR Body for ${data.workflowName}`),
      pushBranchAndCreatePr: vi.fn(),
    };
    mockTelegramNotifier = vi.fn();
  });

  describe('runCycle', () => {
    it('returns empty result when no CI failures exist', async () => {
      mockCiMonitor.getRecentFailures.mockResolvedValueOnce([]);

      const service = createGhostopsService({
        ciMonitor: mockCiMonitor,
        reproService: mockReproService,
        prService: mockPrService,
        repoPath: '/media/seba/repo',
        owner: 'test-org',
        repo: 'test-repo',
        telegramNotifier: mockTelegramNotifier,
      });

      const report = await service.runCycle(12);

      expect(mockCiMonitor.getRecentFailures).toHaveBeenCalledWith('test-org', 'test-repo', 12);
      expect(mockReproService.createWorktree).not.toHaveBeenCalled();
      expect(mockPrService.pushBranchAndCreatePr).not.toHaveBeenCalled();
      expect(mockTelegramNotifier).not.toHaveBeenCalled();

      expect(report.totalFailures).toBe(0);
      expect(report.successful).toBe(0);
      expect(report.failed).toBe(0);
      expect(report.runs).toEqual([]);
    });

    it('processes failed workflow: logs -> worktree -> agent fix -> PR -> cleanup -> telegram', async () => {
      mockCiMonitor.getRecentFailures.mockResolvedValueOnce([
        {
          workflowName: 'E2E Tests',
          runId: 555,
          headSha: 'headsha555',
          htmlUrl: 'https://github.com/test-org/test-repo/actions/runs/555',
          conclusion: 'failure',
        },
      ]);
      mockCiMonitor.getJobLogs.mockResolvedValueOnce('FAIL: timeout in login test');
      mockReproService.createWorktree.mockResolvedValueOnce('/tmp/worktree-555');
      mockReproService.runAgentFix.mockResolvedValueOnce('Fixed login timeout with retry logic');
      mockPrService.pushBranchAndCreatePr.mockResolvedValueOnce({
        prUrl: 'https://github.com/test-org/test-repo/pull/77',
        prNumber: 77,
      });

      const service = createGhostopsService({
        ciMonitor: mockCiMonitor,
        reproService: mockReproService,
        prService: mockPrService,
        repoPath: '/media/seba/repo',
        owner: 'test-org',
        repo: 'test-repo',
        telegramNotifier: mockTelegramNotifier,
      });

      const report = await service.runCycle(24);

      expect(mockCiMonitor.getJobLogs).toHaveBeenCalledWith('test-org', 'test-repo', 555);
      expect(mockReproService.createWorktree).toHaveBeenCalledWith(
        '/media/seba/repo',
        'headsha555',
        'ghostops/fix-555'
      );
      expect(mockReproService.runAgentFix).toHaveBeenCalledWith(
        '/tmp/worktree-555',
        'FAIL: timeout in login test'
      );
      expect(mockPrService.buildPrBody).toHaveBeenCalledWith({
        workflowName: 'E2E Tests',
        runUrl: 'https://github.com/test-org/test-repo/actions/runs/555',
        errorSnippet: 'FAIL: timeout in login test',
        agentOutput: 'Fixed login timeout with retry logic',
      });
      expect(mockPrService.pushBranchAndCreatePr).toHaveBeenCalledWith(
        'test-org',
        'test-repo',
        'ghostops/fix-555',
        expect.stringContaining('E2E Tests'),
        'PR Body for E2E Tests',
        expect.objectContaining({ repoPath: '/tmp/worktree-555' })
      );
      expect(mockReproService.cleanupWorktree).toHaveBeenCalledWith(
        '/media/seba/repo',
        '/tmp/worktree-555'
      );
      expect(mockTelegramNotifier).toHaveBeenCalledTimes(1);

      expect(report.totalFailures).toBe(1);
      expect(report.successful).toBe(1);
      expect(report.failed).toBe(0);
      expect(report.runs[0]).toMatchObject({
        runId: 555,
        status: 'success',
        prUrl: 'https://github.com/test-org/test-repo/pull/77',
        prNumber: 77,
      });

      const history = service.getHistory();
      expect(history.length).toBeGreaterThanOrEqual(1);
      expect(history[0].prNumber).toBe(77);
    });

    it('ensures cleanup is always executed in finally block even when agent fix throws', async () => {
      mockCiMonitor.getRecentFailures.mockResolvedValueOnce([
        {
          workflowName: 'Failing Build',
          runId: 888,
          headSha: 'headsha888',
          htmlUrl: 'https://github.com/test-org/test-repo/actions/runs/888',
          conclusion: 'failure',
        },
      ]);
      mockCiMonitor.getJobLogs.mockResolvedValueOnce('Build error');
      mockReproService.createWorktree.mockResolvedValueOnce('/tmp/worktree-888');
      mockReproService.runAgentFix.mockRejectedValueOnce(new Error('Agent process crashed'));

      const service = createGhostopsService({
        ciMonitor: mockCiMonitor,
        reproService: mockReproService,
        prService: mockPrService,
        repoPath: '/media/seba/repo',
        owner: 'test-org',
        repo: 'test-repo',
        telegramNotifier: mockTelegramNotifier,
      });

      const report = await service.runCycle(24);

      expect(mockReproService.cleanupWorktree).toHaveBeenCalledWith(
        '/media/seba/repo',
        '/tmp/worktree-888'
      );
      expect(mockPrService.pushBranchAndCreatePr).not.toHaveBeenCalled();
      expect(mockTelegramNotifier).not.toHaveBeenCalled();

      expect(report.totalFailures).toBe(1);
      expect(report.successful).toBe(0);
      expect(report.failed).toBe(1);
      expect(report.runs[0].status).toBe('error');
      expect(report.runs[0].error).toContain('Agent process crashed');
    });

    it('supports object-based telegramNotifier with sendTelegram method', async () => {
      const mockNotifierObj = {
        sendTelegram: vi.fn().mockResolvedValue({ success: true }),
      };

      mockCiMonitor.getRecentFailures.mockResolvedValueOnce([
        {
          workflowName: 'Lint Suite',
          runId: 999,
          headSha: 'headsha999',
          htmlUrl: 'https://github.com/org/repo/actions/runs/999',
          conclusion: 'failure',
        },
      ]);
      mockCiMonitor.getJobLogs.mockResolvedValueOnce('Lint failure');
      mockReproService.createWorktree.mockResolvedValueOnce('/tmp/worktree-999');
      mockReproService.runAgentFix.mockResolvedValueOnce('Lint fixed');
      mockPrService.pushBranchAndCreatePr.mockResolvedValueOnce({
        prUrl: 'https://github.com/org/repo/pull/999',
        prNumber: 999,
      });

      const service = createGhostopsService({
        ciMonitor: mockCiMonitor,
        reproService: mockReproService,
        prService: mockPrService,
        repoPath: '/repo',
        owner: 'org',
        repo: 'repo',
        telegramNotifier: mockNotifierObj,
      });

      await service.runCycle();

      expect(mockNotifierObj.sendTelegram).toHaveBeenCalledTimes(1);
      expect(mockNotifierObj.sendTelegram).toHaveBeenCalledWith(
        expect.anything(),
        'agent:completed',
        expect.objectContaining({
          workflowName: 'Lint Suite',
          prUrl: 'https://github.com/org/repo/pull/999',
          runId: 999,
        })
      );
    });
  });

  describe('Scheduler preset validation', () => {
    it('contains ghost_ops_nightly preset with 0 2 * * * cron', () => {
      const ghostOpsPreset = TASK_PRESETS.find((p) => p.type === 'ghost_ops_nightly');
      expect(ghostOpsPreset).toBeDefined();
      expect(ghostOpsPreset?.defaultCron).toBe('0 2 * * *');
      expect(ghostOpsPreset?.name).toContain('Ghost Ops');
    });
  });
});
