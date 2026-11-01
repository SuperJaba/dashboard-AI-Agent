import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  startSession,
  recordFileWrite,
  recordBashCmd,
  getEvents,
  stopSession,
  getActiveSession,
  activeSessions
} from './snapshotService.js';
import { safeQuery, inMemoryStore, migrate } from '../db.js';

describe('snapshotService', () => {
  let testDir;

  beforeAll(async () => {
    try {
      await migrate();
    } catch {}
  });

  beforeEach(async () => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'timemachine-unit-'));
    if (inMemoryStore) {
      inMemoryStore.snapshot_sessions = [];
      inMemoryStore.snapshot_events = [];
    }
    try {
      await safeQuery('DELETE FROM snapshot_events');
      await safeQuery('DELETE FROM snapshot_sessions');
    } catch {}
  });

  afterEach(async () => {
    for (const [sessionId] of activeSessions) {
      await stopSession(sessionId);
    }
    if (testDir && fs.existsSync(testDir)) {
      try {
        fs.rmSync(testDir, { recursive: true, force: true });
      } catch {}
    }
  });

  it('startSession(agentName, workdir) returns sessionId and starts tracking', async () => {
    const sessionId = await startSession('agent-smith', testDir);

    expect(sessionId).toBeDefined();
    expect(typeof sessionId).toBe('string');
    expect(sessionId.length).toBeGreaterThan(0);

    const active = getActiveSession(sessionId);
    expect(active).toBeDefined();
    expect(active.agentName).toBe('agent-smith');
    expect(active.watcher).toBeDefined();

    const { rows } = await safeQuery('SELECT * FROM snapshot_sessions WHERE id = ?', [sessionId]);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(sessionId);
    expect(rows[0].agent_name).toBe('agent-smith');
  });

  it('recordFileWrite(sessionId, filePath, oldContent, newContent) creates unified diff and saves file_write event', async () => {
    const sessionId = await startSession('agent-smith', testDir);
    const filePath = path.join(testDir, 'index.js');
    const oldContent = 'const a = 1;\n';
    const newContent = 'const a = 2;\nconsole.log(a);\n';

    const event = await recordFileWrite(sessionId, filePath, oldContent, newContent);

    expect(event).toBeDefined();
    expect(event.id).toBeDefined();
    expect(event.type).toBe('file_write');
    expect(event.diff).toContain('-const a = 1;');
    expect(event.diff).toContain('+const a = 2;');
    expect(event.diff).toContain('+console.log(a);');

    const events = await getEvents(sessionId);
    expect(events).toHaveLength(1);
    expect(events[0].id).toBe(event.id);
    expect(events[0].type).toBe('file_write');
    expect(events[0].path).toBe(filePath);
    expect(events[0].diff).toBe(event.diff);
  });

  it('recordBashCmd(sessionId, cmdline, exitCode) saves event with type bash_cmd', async () => {
    const sessionId = await startSession('agent-neo', testDir);

    const event = await recordBashCmd(sessionId, 'npm test', 0);

    expect(event).toBeDefined();
    expect(event.type).toBe('bash_cmd');
    expect(event.cmdline).toBe('npm test');
    expect(event.exit_code).toBe(0);

    const events = await getEvents(sessionId);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('bash_cmd');
    expect(events[0].cmdline).toBe('npm test');
    expect(events[0].exit_code).toBe(0);
  });

  it('getEvents(sessionId) returns all recorded events sorted by timestamp/seq', async () => {
    const sessionId = await startSession('agent-trinity', testDir);

    await recordBashCmd(sessionId, 'git status', 0);
    await new Promise(r => setTimeout(r, 10));
    await recordFileWrite(sessionId, 'file1.txt', 'old', 'new');
    await new Promise(r => setTimeout(r, 10));
    await recordBashCmd(sessionId, 'npm run build', 1);

    const events = await getEvents(sessionId);
    expect(events).toHaveLength(3);
    expect(events[0].type).toBe('bash_cmd');
    expect(events[0].cmdline).toBe('git status');
    expect(events[1].type).toBe('file_write');
    expect(events[2].type).toBe('bash_cmd');
    expect(events[2].cmdline).toBe('npm run build');

    const seqs = events.map(e => Number(e.seq));
    expect(seqs[0]).toBeLessThanOrEqual(seqs[1]);
    expect(seqs[1]).toBeLessThanOrEqual(seqs[2]);
  });

  it('stopSession(sessionId) closes watcher and cleans active session', async () => {
    const sessionId = await startSession('agent-morpheus', testDir);
    expect(getActiveSession(sessionId)).toBeDefined();

    await stopSession(sessionId);

    expect(getActiveSession(sessionId)).toBeUndefined();
    expect(activeSessions.has(sessionId)).toBe(false);

    const { rows } = await safeQuery('SELECT * FROM snapshot_sessions WHERE id = ?', [sessionId]);
    expect(rows).toHaveLength(1);
    const sessionRow = rows[0];
    const stoppedTime = sessionRow.stopped_at || sessionRow.ended_at;
    expect(stoppedTime).toBeDefined();
    expect(new Date(stoppedTime).getTime()).toBeGreaterThan(0);
  });

  it('captures live file changes via chokidar watcher', async () => {
    const sessionId = await startSession('agent-watcher', testDir);
    const testFile = path.join(testDir, 'watched.txt');

    // Initial write
    fs.writeFileSync(testFile, 'line 1\n');

    // Wait for watcher readiness
    await new Promise(r => setTimeout(r, 150));

    // Modify file
    fs.writeFileSync(testFile, 'line 1\nline 2\n');

    // Wait for event to be captured
    let found = false;
    for (let i = 0; i < 25; i++) {
      await new Promise(r => setTimeout(r, 100));
      const events = await getEvents(sessionId);
      const match = events.find(e => e.type === 'file_write' && e.path === testFile);
      if (match) {
        found = true;
        expect(match.diff).toContain('+line 2');
        break;
      }
    }

    expect(found).toBe(true);
  });
});
