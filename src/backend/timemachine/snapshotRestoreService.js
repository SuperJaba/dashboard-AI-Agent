import fs from 'fs';
import { parsePatch, reversePatch, applyPatch } from 'diff';
import * as snapshotService from './snapshotService.js';

/**
 * Rolls back all file modifications after targetEventSeq in descending order.
 */
export async function rollbackToEvent(sessionId, targetEventSeq = 0) {
  const events = await snapshotService.getEvents(sessionId);
  const targetSeqNum = typeof targetEventSeq === 'number' ? targetEventSeq : (Number(targetEventSeq) || 0);

  // Filter only file_write events that occurred strictly after targetEventSeq
  const toRevert = events
    .filter(e => e.type === 'file_write' && (Number(e.seq) || 0) > targetSeqNum)
    .sort((a, b) => (Number(b.seq) || 0) - (Number(a.seq) || 0));

  const results = [];
  for (const ev of toRevert) {
    if (!ev.path || !ev.diff) continue;

    try {
      if (!fs.existsSync(ev.path)) {
        results.push({ path: ev.path, status: 'missing' });
        continue;
      }

      const parsed = parsePatch(ev.diff);
      if (!parsed || parsed.length === 0) {
        results.push({ path: ev.path, status: 'invalid_patch' });
        continue;
      }

      const currentContent = fs.readFileSync(ev.path, 'utf-8');
      const reversedDiff = reversePatch(parsed[0]);
      const reverted = applyPatch(currentContent, reversedDiff);

      if (reverted !== false) {
        fs.writeFileSync(ev.path, reverted, 'utf-8');
        results.push({ path: ev.path, status: 'reverted' });
      } else {
        results.push({ path: ev.path, status: 'conflict' });
      }
    } catch (err) {
      results.push({ path: ev.path, status: 'error', error: err.message });
    }
  }

  return results;
}

/**
 * Rolls back session to a specific ISO timestamp cutoff point.
 */
export async function rollbackToTimestamp(sessionId, isoTimestamp) {
  const events = await snapshotService.getEvents(sessionId);
  const cutoff = new Date(isoTimestamp).getTime();

  // Find last event on or before cutoff using seq (millisecond epoch timestamp)
  const target = events
    .filter(e => (Number(e.seq) || 0) <= cutoff)
    .sort((a, b) => (Number(a.seq) || 0) - (Number(b.seq) || 0))
    .at(-1);

  const targetSeq = target ? Number(target.seq) : 0;
  return rollbackToEvent(sessionId, targetSeq);
}
