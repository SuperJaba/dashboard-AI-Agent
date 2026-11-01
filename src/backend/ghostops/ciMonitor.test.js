import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCiMonitor, getRecentFailures, getJobLogs } from './ciMonitor.js';

describe('Ghost Ops CI Monitor', () => {
  let mockFetch;

  beforeEach(() => {
    mockFetch = vi.fn();
  });

  describe('getRecentFailures', () => {
    it('queries GitHub Actions API with headers and returns failed and timed_out runs', async () => {
      const mockRunsResponse = {
        total_count: 3,
        workflow_runs: [
          {
            id: 101,
            name: 'CI / Test',
            head_sha: 'abc1234',
            html_url: 'https://github.com/owner/repo/actions/runs/101',
            conclusion: 'failure',
            status: 'completed',
          },
          {
            id: 102,
            name: 'Nightly E2E',
            head_sha: 'def5678',
            html_url: 'https://github.com/owner/repo/actions/runs/102',
            conclusion: 'timed_out',
            status: 'completed',
          },
          {
            id: 103,
            name: 'Lint & Format',
            head_sha: '7890xyz',
            html_url: 'https://github.com/owner/repo/actions/runs/103',
            conclusion: 'success',
            status: 'completed',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRunsResponse,
      });

      const monitor = createCiMonitor('ghp_test_token_123', { fetchFn: mockFetch });
      const failures = await monitor.getRecentFailures('my-org', 'my-repo', 12);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('https://api.github.com/repos/my-org/my-repo/actions/runs');
      expect(url).toContain('per_page=50');
      expect(options.headers['Authorization']).toBe('Bearer ghp_test_token_123');
      expect(options.headers['User-Agent']).toBe('dashboard-ghostops');

      expect(failures).toHaveLength(2);
      expect(failures[0]).toEqual({
        workflowName: 'CI / Test',
        runId: 101,
        headSha: 'abc1234',
        htmlUrl: 'https://github.com/owner/repo/actions/runs/101',
        conclusion: 'failure',
      });
      expect(failures[1]).toEqual({
        workflowName: 'Nightly E2E',
        runId: 102,
        headSha: 'def5678',
        htmlUrl: 'https://github.com/owner/repo/actions/runs/102',
        conclusion: 'timed_out',
      });
    });

    it('returns empty array when all runs succeeded', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          total_count: 1,
          workflow_runs: [
            {
              id: 200,
              name: 'Build',
              head_sha: 'sha200',
              html_url: 'https://github.com/owner/repo/actions/runs/200',
              conclusion: 'success',
            },
          ],
        }),
      });

      const monitor = createCiMonitor('token', { fetchFn: mockFetch });
      const failures = await monitor.getRecentFailures('owner', 'repo', 24);
      expect(failures).toEqual([]);
    });

    it('returns empty array on non-ok response or network error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const monitor = createCiMonitor('token', { fetchFn: mockFetch });
      const failures = await monitor.getRecentFailures('owner', 'repo');
      expect(failures).toEqual([]);

      mockFetch.mockRejectedValueOnce(new Error('Network offline'));
      const failureOnThrow = await monitor.getRecentFailures('owner', 'repo');
      expect(failureOnThrow).toEqual([]);
    });

    it('works with standalone getRecentFailures helper', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          workflow_runs: [
            {
              id: 301,
              name: 'Standalone Test',
              head_sha: 'sha301',
              html_url: 'https://github.com/owner/repo/actions/runs/301',
              conclusion: 'failure',
            },
          ],
        }),
      });

      const failures = await getRecentFailures('owner', 'repo', 6, {
        token: 'token_standalone',
        fetchFn: mockFetch,
      });
      expect(failures).toHaveLength(1);
      expect(failures[0].runId).toBe(301);
    });
  });

  describe('getJobLogs', () => {
    it('returns log excerpt up to 5000 characters', async () => {
      const longLog = 'A'.repeat(6000);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => longLog,
      });

      const monitor = createCiMonitor('token', { fetchFn: mockFetch });
      const logs = await monitor.getJobLogs('owner', 'repo', 999);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.github.com/repos/owner/repo/actions/runs/999/logs');
      expect(options.headers['User-Agent']).toBe('dashboard-ghostops');
      expect(logs.length).toBe(5000);
      expect(logs).toBe('A'.repeat(5000));
    });

    it('returns empty string if logs fetch fails or returns non-ok', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const monitor = createCiMonitor('token', { fetchFn: mockFetch });
      const logs = await monitor.getJobLogs('owner', 'repo', 404);
      expect(logs).toBe('');

      mockFetch.mockRejectedValueOnce(new Error('Stream failed'));
      const logsError = await monitor.getJobLogs('owner', 'repo', 500);
      expect(logsError).toBe('');
    });

    it('works with standalone getJobLogs helper', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => 'Error: vitest failed with 1 error',
      });

      const logs = await getJobLogs('owner', 'repo', 123, {
        token: 'token_standalone',
        fetchFn: mockFetch,
      });
      expect(logs).toBe('Error: vitest failed with 1 error');
    });
  });
});
