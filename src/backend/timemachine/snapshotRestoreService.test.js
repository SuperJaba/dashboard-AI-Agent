import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import * as snapshotService from './snapshotService.js';
import * as restoreService from './snapshotRestoreService.js';

describe('snapshotRestoreService', () => {
  let tmpDir;
  let testFile;
  let sessionId;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'timemachine-restore-test-'));
    testFile = path.join(tmpDir, 'sample.txt');
    fs.writeFileSync(testFile, 'initial content line 1\ninitial content line 2\n', 'utf-8');

    sessionId = await snapshotService.startSession('test-agent', tmpDir, { watch: false });
  });

  afterEach(async () => {
    await snapshotService.stopSession(sessionId);
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  it('rolls back a file mutation to a target event sequence', async () => {
    const originalContent = fs.readFileSync(testFile, 'utf-8');

    // Mutation 1
    const mutatedContent1 = 'initial content line 1\nmodified line 2 (v1)\n';
    fs.writeFileSync(testFile, mutatedContent1, 'utf-8');
    const ev1 = await snapshotService.recordFileWrite(sessionId, testFile, originalContent, mutatedContent1);

    // Mutation 2
    const mutatedContent2 = 'initial content line 1\nmodified line 2 (v2)\nadded line 3\n';
    fs.writeFileSync(testFile, mutatedContent2, 'utf-8');
    await snapshotService.recordFileWrite(sessionId, testFile, mutatedContent1, mutatedContent2);

    expect(fs.readFileSync(testFile, 'utf-8')).toBe(mutatedContent2);

    // Rollback to ev1 (reverting mutation 2)
    const results = await restoreService.rollbackToEvent(sessionId, ev1.seq);
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('reverted');
    expect(fs.readFileSync(testFile, 'utf-8')).toBe(mutatedContent1);
  });

  it('safely skips bash_cmd events during rollback without throwing', async () => {
    await snapshotService.recordBashCmd(sessionId, 'rm -rf /tmp/fake', 0);

    const results = await restoreService.rollbackToEvent(sessionId, 0);
    expect(results).toEqual([]);
  });

  it('rolls back to an ISO timestamp cutoff point', async () => {
    const originalContent = fs.readFileSync(testFile, 'utf-8');

    // Record baseline event
    const baseline = await snapshotService.recordFileWrite(sessionId, testFile, '', originalContent);
    const cutoffIso = new Date(Number(baseline.seq)).toISOString();

    // Subsequent mutation after cutoff
    const mutatedContent = 'rewritten content\n';
    fs.writeFileSync(testFile, mutatedContent, 'utf-8');
    await snapshotService.recordFileWrite(sessionId, testFile, originalContent, mutatedContent);

    // Rollback to cutoff point
    const results = await restoreService.rollbackToTimestamp(sessionId, cutoffIso);
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('reverted');
    expect(fs.readFileSync(testFile, 'utf-8')).toBe(originalContent);
  });
});
