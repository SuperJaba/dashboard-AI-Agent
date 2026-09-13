import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  return {
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    execSync: vi.fn(),
    exec: vi.fn()
  };
});

vi.mock('fs', () => {
  return {
    default: {
      existsSync: mocks.existsSync,
      mkdirSync: mocks.mkdirSync
    },
    existsSync: mocks.existsSync,
    mkdirSync: mocks.mkdirSync
  };
});

vi.mock('child_process', () => {
  return {
    default: {
      execSync: mocks.execSync,
      exec: mocks.exec
    },
    execSync: mocks.execSync,
    exec: mocks.exec
  };
});

import * as gitService from './gitService.js';

describe('Git Service Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('resolveDirectory', () => {
    it('should return relative or absolute paths as resolved', () => {
      const resolved = gitService.resolveDirectory('/some/path');
      expect(resolved).toBeTruthy();
    });

    it('should expand tilde paths', () => {
      const resolved = gitService.resolveDirectory('~/my-project');
      expect(resolved).not.toContain('~');
    });
  });

  describe('isGitRepo', () => {
    it('should return true if .git exists', () => {
      mocks.existsSync.mockReturnValue(true);
      expect(gitService.isGitRepo('/mock/repo')).toBe(true);
    });

    it('should return false if .git does not exist', () => {
      mocks.existsSync.mockReturnValue(false);
      expect(gitService.isGitRepo('/mock/not-a-repo')).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('should return branch, changes and commits', () => {
      mocks.existsSync.mockReturnValue(true);
      mocks.execSync.mockImplementation((cmd) => {
        const cmdStr = String(cmd);
        if (cmdStr.includes('branch --show-current')) return 'main\n';
        if (cmdStr.includes('status -s')) return ' M file1.js\n?? file2.js\n';
        if (cmdStr.includes('log -n')) return 'abc1234|Initial commit|2 hours ago|Alice\n';
        return '';
      });

      const status = gitService.getStatus('/mock/repo');
      expect(status.branch).toBe('main');
      expect(status.changes.length).toBe(2);
      expect(status.commits.length).toBe(1);
      expect(status.commits[0].hash).toBe('abc1234');
    });
  });

  describe('getBranches', () => {
    it('should list local and remote branches', () => {
      mocks.existsSync.mockReturnValue(true);
      mocks.execSync.mockImplementation((cmd) => {
        const cmdStr = String(cmd);
        if (cmdStr.includes('branch --show-current')) return 'main\n';
        if (cmdStr.includes('branch -a')) return 'main|*\nfeature-1|\norigin/main|\norigin/HEAD|\n';
        return '';
      });

      const branches = gitService.getBranches('/mock/repo');
      expect(branches.current).toBe('main');
      expect(branches.local).toContain('main');
      expect(branches.local).toContain('feature-1');
      expect(branches.remote).toContain('origin/main');
      expect(branches.remote).not.toContain('origin/HEAD');
    });
  });

  describe('checkoutBranch', () => {
    it('should checkout an existing branch', () => {
      mocks.existsSync.mockReturnValue(true);
      mocks.execSync.mockReturnValue('feature-2\n');

      const result = gitService.checkoutBranch('/mock/repo', 'feature-2');
      expect(result.success).toBe(true);
      expect(result.current).toBe('feature-2');
    });

    it('should create and checkout a new branch when createNew is true', () => {
      mocks.existsSync.mockReturnValue(true);
      mocks.execSync.mockReturnValue('new-feature\n');

      const result = gitService.checkoutBranch('/mock/repo', 'new-feature', true);
      expect(result.success).toBe(true);
    });
  });

  describe('createBranch and deleteBranch', () => {
    it('should create a branch', () => {
      mocks.existsSync.mockReturnValue(true);
      mocks.execSync.mockReturnValue('');

      const result = gitService.createBranch('/mock/repo', 'hotfix-1');
      expect(result.success).toBe(true);
      expect(result.branch).toBe('hotfix-1');
    });

    it('should delete a branch', () => {
      mocks.existsSync.mockReturnValue(true);
      mocks.execSync.mockReturnValue('');

      const result = gitService.deleteBranch('/mock/repo', 'hotfix-1');
      expect(result.success).toBe(true);
      expect(result.branch).toBe('hotfix-1');
    });
  });

  describe('getDiff', () => {
    it('should return working tree diff and stats', () => {
      mocks.existsSync.mockReturnValue(true);
      mocks.execSync.mockImplementation((cmd) => {
        const cmdStr = String(cmd);
        if (cmdStr.includes('diff --stat')) return 'file.js | 2 +-\n1 file changed\n';
        if (cmdStr.includes('diff')) return '+ const x = 1;\n- const x = 0;\n';
        return '';
      });

      const diffRes = gitService.getDiff('/mock/repo', false);
      expect(diffRes.diff).toContain('+ const x = 1;');
      expect(diffRes.stat).toContain('1 file changed');
    });
  });

  describe('stageFiles and unstageFiles', () => {
    it('should stage specified files', () => {
      mocks.existsSync.mockReturnValue(true);
      mocks.execSync.mockReturnValue('');

      const res = gitService.stageFiles('/mock/repo', ['file1.js', 'file2.js']);
      expect(res.success).toBe(true);
      expect(res.staged).toEqual(['file1.js', 'file2.js']);
    });

    it('should unstage files', () => {
      mocks.existsSync.mockReturnValue(true);
      mocks.execSync.mockReturnValue('');

      const res = gitService.unstageFiles('/mock/repo', ['file1.js']);
      expect(res.success).toBe(true);
      expect(res.unstaged).toEqual(['file1.js']);
    });
  });

  describe('commitChanges', () => {
    it('should require a commit message', () => {
      mocks.existsSync.mockReturnValue(true);
      expect(() => gitService.commitChanges('/mock/repo', '')).toThrow('Commit message is required');
    });

    it('should commit with message', () => {
      mocks.existsSync.mockReturnValue(true);
      mocks.execSync.mockReturnValue('[main 1234567] test commit\n 1 file changed\n');

      const res = gitService.commitChanges('/mock/repo', 'test commit');
      expect(res.success).toBe(true);
    });
  });

  describe('pull, push, fetch', () => {
    it('should pull changes', () => {
      mocks.existsSync.mockReturnValue(true);
      mocks.execSync.mockReturnValue('Already up to date.\n');

      const res = gitService.pullChanges('/mock/repo');
      expect(res.success).toBe(true);
    });

    it('should push changes', () => {
      mocks.existsSync.mockReturnValue(true);
      mocks.execSync.mockReturnValue('Everything up-to-date\n');

      const res = gitService.pushChanges('/mock/repo');
      expect(res.success).toBe(true);
    });

    it('should fetch changes', () => {
      mocks.existsSync.mockReturnValue(true);
      mocks.execSync.mockReturnValue('');

      const res = gitService.fetchChanges('/mock/repo');
      expect(res.success).toBe(true);
    });
  });

  describe('cloneRepo', () => {
    it('should validate repository url and target directory', () => {
      expect(() => gitService.cloneRepo('', '/target')).toThrow('Repository URL is required');
      expect(() => gitService.cloneRepo('https://github.com/test/repo', '')).toThrow('Target directory is required');
    });

    it('should clone repository successfully', () => {
      mocks.existsSync.mockReturnValue(false);
      mocks.mkdirSync.mockReturnValue(undefined);
      mocks.execSync.mockReturnValue('Cloning into target...\n');

      const res = gitService.cloneRepo('https://github.com/test/repo.git', '/path/to/target');
      expect(res.success).toBe(true);
    });
  });
});
