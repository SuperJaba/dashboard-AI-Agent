import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPrService, buildPrBody, pushBranchAndCreatePr } from './prService.js';

describe('Ghost Ops PR Service', () => {
  let mockFetch;
  let mockExec;

  beforeEach(() => {
    mockFetch = vi.fn();
    mockExec = vi.fn();
  });

  describe('buildPrBody', () => {
    it('generates structured Polish markdown body with root cause and fix output', () => {
      const body = buildPrBody({
        workflowName: 'Test & Lint Suite',
        runUrl: 'https://github.com/owner/repo/actions/runs/12345',
        errorSnippet: 'Error: Cannot find module ./missing.js',
        agentOutput: '1. Re-created missing module.\n2. Added unit tests.',
      });

      expect(body).toContain('## 🤖 Ghost Ops — Automatyczna Naprawa CI');
      expect(body).toContain('**Workflow:** Test & Lint Suite');
      expect(body).toContain('**Failed run:** https://github.com/owner/repo/actions/runs/12345');
      expect(body).toContain('### Pierwiastek Błędu (Root Cause)');
      expect(body).toContain('Error: Cannot find module ./missing.js');
      expect(body).toContain('### Wykonane naprawy');
      expect(body).toContain('1. Re-created missing module.');
    });

    it('handles empty/undefined fields gracefully with fallbacks and truncates long text', () => {
      const longError = 'E'.repeat(3000);
      const longOutput = 'O'.repeat(4000);

      const body = buildPrBody({
        workflowName: null,
        runUrl: null,
        errorSnippet: longError,
        agentOutput: longOutput,
      });

      expect(body).toContain('**Workflow:** Nieznany');
      expect(body).toContain('**Failed run:** Brak');
      expect(body).toContain('E'.repeat(1500));
      expect(body).not.toContain('E'.repeat(1501));
      expect(body).toContain('O'.repeat(2000));
      expect(body).not.toContain('O'.repeat(2001));
    });
  });

  describe('pushBranchAndCreatePr', () => {
    it('pushes branch to remote and creates pull request via GitHub REST API', async () => {
      mockExec.mockReturnValue(Buffer.from('Everything up-to-date'));
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          html_url: 'https://github.com/my-org/my-repo/pull/42',
          number: 42,
        }),
      });

      const prService = createPrService('ghp_test_token', {
        fetchFn: mockFetch,
        execFn: mockExec,
      });

      const result = await prService.pushBranchAndCreatePr(
        'my-org',
        'my-repo',
        'ghostops/fix-12345',
        'fix(ci): fix missing module in test suite',
        'Auto-generated PR body',
        { repoPath: '/media/seba/repo' }
      );

      expect(mockExec).toHaveBeenCalledWith('git push origin ghostops/fix-12345', {
        cwd: '/media/seba/repo',
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.github.com/repos/my-org/my-repo/pulls');
      expect(options.method).toBe('POST');
      expect(options.headers['Authorization']).toBe('Bearer ghp_test_token');
      expect(options.headers['User-Agent']).toBe('dashboard-ghostops');
      expect(options.headers['Content-Type']).toBe('application/json');

      const payload = JSON.parse(options.body);
      expect(payload).toEqual({
        title: 'fix(ci): fix missing module in test suite',
        body: 'Auto-generated PR body',
        head: 'ghostops/fix-12345',
        base: 'master',
      });

      expect(result).toEqual({
        prUrl: 'https://github.com/my-org/my-repo/pull/42',
        prNumber: 42,
      });
    });

    it('supports custom base branch option', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          html_url: 'https://github.com/owner/repo/pull/99',
          number: 99,
        }),
      });

      const prService = createPrService('token', {
        fetchFn: mockFetch,
        execFn: mockExec,
      });

      const result = await prService.pushBranchAndCreatePr(
        'owner',
        'repo',
        'ghostops/fix-99',
        'title',
        'body',
        { repoPath: '/repo', base: 'main' }
      );

      const [, options] = mockFetch.mock.calls[0];
      const payload = JSON.parse(options.body);
      expect(payload.base).toBe('main');
      expect(result.prNumber).toBe(99);
    });

    it('throws error if git push fails', async () => {
      mockExec.mockImplementation(() => {
        throw new Error('git push rejected: non-fast-forward');
      });

      const prService = createPrService('token', {
        fetchFn: mockFetch,
        execFn: mockExec,
      });

      await expect(
        prService.pushBranchAndCreatePr('owner', 'repo', 'branch', 'title', 'body')
      ).rejects.toThrow('git push rejected: non-fast-forward');

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('throws error if GitHub API returns non-200 status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity',
        text: async () => JSON.stringify({ message: 'A pull request already exists' }),
      });

      const prService = createPrService('token', {
        fetchFn: mockFetch,
        execFn: mockExec,
      });

      await expect(
        prService.pushBranchAndCreatePr('owner', 'repo', 'branch', 'title', 'body')
      ).rejects.toThrow(/Failed to create PR: 422 Unprocessable Entity/);
    });

    it('works with standalone pushBranchAndCreatePr function', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          html_url: 'https://github.com/owner/repo/pull/1',
          number: 1,
        }),
      });

      const result = await pushBranchAndCreatePr(
        'owner',
        'repo',
        'branch',
        'title',
        'body',
        {
          token: 'standalone_token',
          fetchFn: mockFetch,
          execFn: mockExec,
        }
      );

      expect(result.prNumber).toBe(1);
    });
  });
});
