import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  normalizeTitle,
  extractChecklistItems,
  updateTaskInWorkspaceFile,
  syncProjectTasks
} from './tasksSyncService.js';
import * as projectsRepo from './projectsRepository.js';

describe('tasksSyncService', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tasks-sync-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  describe('normalizeTitle', () => {
    it('normalizes extra spaces and case', () => {
      expect(normalizeTitle('   Add  User   Authentication   ')).toBe('add user authentication');
      expect(normalizeTitle('')).toBe('');
      expect(normalizeTitle(null)).toBe('');
    });
  });

  describe('extractChecklistItems', () => {
    it('extracts pending and completed checklist items from markdown', () => {
      const mdContent = `# Project Tasks\n- [ ] First task\n* [x] Second task\n1. [X] Third task\nNormal line`;
      const mdPath = path.join(tmpDir, 'README.md');
      fs.writeFileSync(mdPath, mdContent, 'utf8');

      const items = extractChecklistItems(mdPath, tmpDir);
      expect(items.length).toBe(3);
      expect(items[0].title).toBe('First task');
      expect(items[0].isCompleted).toBe(false);
      expect(items[0].status).toBe('pending');

      expect(items[1].title).toBe('Second task');
      expect(items[1].isCompleted).toBe(true);
      expect(items[1].status).toBe('completed');

      expect(items[2].title).toBe('Third task');
      expect(items[2].isCompleted).toBe(true);
      expect(items[2].status).toBe('completed');
    });
  });

  describe('updateTaskInWorkspaceFile', () => {
    it('updates [ ] to [x] when marked completed', () => {
      const mdContent = `- [ ] Setup database\n- [ ] Write documentation`;
      const mdPath = path.join(tmpDir, 'TODO.md');
      fs.writeFileSync(mdPath, mdContent, 'utf8');

      const result = updateTaskInWorkspaceFile(tmpDir, 'Setup database', 'completed', 'TODO.md');
      expect(result.updated).toBe(true);

      const updatedContent = fs.readFileSync(mdPath, 'utf8');
      expect(updatedContent).toContain('- [x] Setup database');
      expect(updatedContent).toContain('- [ ] Write documentation');
    });

    it('updates [x] to [ ] when marked pending', () => {
      const mdContent = `- [x] Setup database\n- [ ] Write documentation`;
      const mdPath = path.join(tmpDir, 'TODO.md');
      fs.writeFileSync(mdPath, mdContent, 'utf8');

      const result = updateTaskInWorkspaceFile(tmpDir, 'Setup database', 'pending', 'TODO.md');
      expect(result.updated).toBe(true);

      const updatedContent = fs.readFileSync(mdPath, 'utf8');
      expect(updatedContent).toContain('- [ ] Setup database');
    });

    it('returns updated: false if task title not found in any markdown file', () => {
      const mdContent = `- [ ] Setup database`;
      const mdPath = path.join(tmpDir, 'TODO.md');
      fs.writeFileSync(mdPath, mdContent, 'utf8');

      const result = updateTaskInWorkspaceFile(tmpDir, 'Non-existent task', 'completed', 'TODO.md');
      expect(result.updated).toBe(false);
    });
  });

  describe('syncProjectTasks', () => {
    it('syncs DB tasks to workspace and workspace tasks to DB', async () => {
      const mdContent = `- [ ] DB was completed, workspace was pending\n- [x] Workspace was completed, DB was pending`;
      const mdPath = path.join(tmpDir, 'README.md');
      fs.writeFileSync(mdPath, mdContent, 'utf8');

      const mockProject = {
        id: 42,
        name: 'Test Project',
        path: tmpDir,
        tasks: [
          { id: 1, title: 'DB was completed, workspace was pending', status: 'completed', meta: 'README.md' },
          { id: 2, title: 'Workspace was completed, DB was pending', status: 'pending', meta: 'README.md' }
        ]
      };

      vi.spyOn(projectsRepo, 'getProjects').mockResolvedValue([mockProject]);
      const updateProjectSpy = vi.spyOn(projectsRepo, 'updateProject').mockImplementation(async (id, data) => {
        return { ...mockProject, ...data };
      });

      const res = await syncProjectTasks(42);
      expect(res.success).toBe(true);
      expect(res.updatedInWorkspace.length).toBe(1);
      expect(res.updatedInWorkspace[0].title).toBe('DB was completed, workspace was pending');

      expect(res.updatedInDb.length).toBe(1);
      expect(res.updatedInDb[0].title).toBe('Workspace was completed, DB was pending');

      // Check that the file on disk was updated to [x]
      const diskContent = fs.readFileSync(mdPath, 'utf8');
      expect(diskContent).toContain('- [x] DB was completed, workspace was pending');

      // Check that updateProject was called with both tasks completed (100%)
      expect(updateProjectSpy).toHaveBeenCalledWith(42, expect.objectContaining({
        complete: 100
      }));
    });
  });
});
