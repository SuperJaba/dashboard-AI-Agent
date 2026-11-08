# Feature 03: Live Time-Travel Execution Player & Instant Rollback — Plan Implementacji

> **For Claude / Antigravity:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Każda mutacja pliku, komenda bash i git commit wykonane przez aktywnego agenta są streamowane do immutable session timeline. Użytkownik dostaje wizualny time-slider z możliwością 1-click rollback dowolnej mutacji lub przywrócenia środowiska do dowolnej sekundy przebiegu agenta.

**Architecture:**
- Backend: `src/backend/timemachine/` — `snapshotService.js` przechwytuje zdarzenia z `backgroundWorker` i procesów agentów (pliki otwarte via `fs.watch` + git diff snapshots), zapisuje je jako `SessionEvent` w lekkiej SQLite/in-memory store: `{ id, sessionId, seq, timestamp, type: 'file_write'|'file_delete'|'bash_cmd'|'git_commit', path?, diff?, cmdline? }`.
- Backend: `snapshotRestoreService.js` — dla `file_write`/`file_delete` trzyma stary content i wykonuje reverse patch. Dla `git_commit` wywołuje `git revert`. Dla `bash_cmd` loguje tylko (nie odwraca, bo side-effecty).
- Frontend: `src/components/TimeTravelPlayer.tsx` — timeline slider z listą zdarzeń, podglądem diff w panelu bocznym i przyciskiem „Cofnij do tego momentu".
- SSE / Socket.IO: każde zdarzenie `snapshot:event` jest pushowane na żywo do dashboardu.

**Tech Stack:** Express, `fs.watch`, `chokidar`, `diff` (npm), `simple-git`, Socket.IO, React, Tailwind CSS v4, Vitest.

---

### Task 1: SnapshotService — przechwytywanie zdarzeń sesji agenta

**Files:**
- Create: `src/backend/timemachine/snapshotService.js`
- Create: `src/backend/timemachine/snapshotService.test.js`

**Step 1: Write the failing test** — `src/backend/timemachine/snapshotService.test.js`:
- Test `startSession(agentName, workdir)` zwraca `sessionId` i inicjuje watcher.
- Test `recordFileWrite(sessionId, filePath, oldContent, newContent)` zapisuje SessionEvent z `type:'file_write'` i `diff` (unified diff string).
- Test `recordBashCmd(sessionId, cmdline, exitCode)` zapisuje SessionEvent z `type:'bash_cmd'`.
- Test `getEvents(sessionId)` zwraca posortowane eventy.
- Test `stopSession(sessionId)` zamyka watcher i finalizuje sesję.

**Step 2: Run test to verify it fails**
`npm test -- src/backend/timemachine/snapshotService.test.js --run`
Expected: FAIL.

**Step 3: Implement**
```js
// src/backend/timemachine/snapshotService.js
import chokidar from 'chokidar';
import { createPatch } from 'diff';
import fs from 'fs';
import { safeQuery } from '../db.js';

const activeSessions = new Map(); // sessionId -> { watcher, agentName }

export async function startSession(agentName, workdir) {
  const sessionId = crypto.randomUUID();
  const fileCache = new Map(); // path -> last known content

  const watcher = chokidar.watch(workdir, {
    ignored: /node_modules|\.git|dist|coverage/,
    persistent: true,
    ignoreInitial: true,
  });

  watcher.on('change', async (filePath) => {
    const newContent = fs.readFileSync(filePath, 'utf-8');
    const oldContent = fileCache.get(filePath) ?? '';
    fileCache.set(filePath, newContent);
    await recordFileWrite(sessionId, filePath, oldContent, newContent);
  });

  activeSessions.set(sessionId, { watcher, agentName });
  await safeQuery('INSERT INTO snapshot_sessions (id, agent_name, started_at) VALUES (?,?,?)',
    [sessionId, agentName, new Date().toISOString()]);
  return sessionId;
}

export async function recordFileWrite(sessionId, filePath, oldContent, newContent) {
  const diff = createPatch(filePath, oldContent, newContent);
  const id = crypto.randomUUID();
  await safeQuery(
    'INSERT INTO snapshot_events (id,session_id,seq,ts,type,path,diff) VALUES (?,?,?,?,?,?,?)',
    [id, sessionId, Date.now(), new Date().toISOString(), 'file_write', filePath, diff]
  );
  return { id, type: 'file_write', filePath, diff };
}

export async function recordBashCmd(sessionId, cmdline, exitCode) {
  const id = crypto.randomUUID();
  await safeQuery(
    'INSERT INTO snapshot_events (id,session_id,seq,ts,type,cmdline,exit_code) VALUES (?,?,?,?,?,?,?)',
    [id, sessionId, Date.now(), new Date().toISOString(), 'bash_cmd', cmdline, exitCode]
  );
}

export async function getEvents(sessionId) {
  return safeQuery('SELECT * FROM snapshot_events WHERE session_id=? ORDER BY seq ASC', [sessionId]);
}

export async function stopSession(sessionId) {
  const session = activeSessions.get(sessionId);
  if (session?.watcher) await session.watcher.close();
  activeSessions.delete(sessionId);
  await safeQuery('UPDATE snapshot_sessions SET ended_at=? WHERE id=?',
    [new Date().toISOString(), sessionId]);
}
```

**Step 4: Run test to verify it passes**
`npm test -- src/backend/timemachine/snapshotService.test.js --run`

**Step 5: Commit**
```bash
git add src/backend/timemachine/snapshotService.js src/backend/timemachine/snapshotService.test.js src/backend/db.js
git commit -m "feat(timemachine): add session snapshot service with chokidar file watcher and event store"
```

---

### Task 2: SnapshotRestoreService — odwracanie mutacji

**Files:**
- Create: `src/backend/timemachine/snapshotRestoreService.js`
- Create: `src/backend/timemachine/snapshotRestoreService.test.js`

**Step 1: Write the failing test**:
- Test `rollbackToEvent(sessionId, targetEventSeq)` — dla pliku: przywraca `oldContent` (patch reverse).
- Test nie próbuje odwracać `bash_cmd` (loguje ostrzeżenie i pomija).
- Test `rollbackToTimestamp(sessionId, isoTimestamp)` — wywołuje `rollbackToEvent` dla ostatniego eventu przed podanym timestamp.

**Step 2: Run test to verify it fails**
`npm test -- src/backend/timemachine/snapshotRestoreService.test.js --run`

**Step 3: Implement**
```js
// src/backend/timemachine/snapshotRestoreService.js
import { applyPatch, reversePatch, parsePatch } from 'diff';
import fs from 'fs';
import * as repo from './snapshotService.js';

export async function rollbackToEvent(sessionId, targetEventSeq) {
  const events = await repo.getEvents(sessionId);
  // Get all file_write events AFTER targetEventSeq and reverse them in descending order
  const toRevert = events
    .filter(e => e.type === 'file_write' && e.seq > targetEventSeq)
    .sort((a, b) => b.seq - a.seq);

  const results = [];
  for (const ev of toRevert) {
    try {
      const parsed = parsePatch(ev.diff);
      const currentContent = fs.readFileSync(ev.path, 'utf-8');
      const reverted = applyPatch(currentContent, reversePatch(parsed[0]));
      if (reverted !== false) {
        fs.writeFileSync(ev.path, reverted, 'utf-8');
        results.push({ path: ev.path, status: 'reverted' });
      } else {
        results.push({ path: ev.path, status: 'conflict' });
      }
    } catch (e) {
      results.push({ path: ev.path, status: 'error', error: e.message });
    }
  }
  return results;
}

export async function rollbackToTimestamp(sessionId, isoTimestamp) {
  const events = await repo.getEvents(sessionId);
  const cutoff = new Date(isoTimestamp).getTime();
  const target = events.filter(e => new Date(e.ts).getTime() <= cutoff).at(-1);
  if (!target) return [];
  return rollbackToEvent(sessionId, target.seq);
}
```

**Step 4: Run test to verify it passes**
`npm test -- src/backend/timemachine/snapshotRestoreService.test.js --run`

**Step 5: Commit**
```bash
git add src/backend/timemachine/snapshotRestoreService.js src/backend/timemachine/snapshotRestoreService.test.js
git commit -m "feat(timemachine): implement snapshot restore service with diff reverse-patch rollback"
```

---

### Task 3: REST API — timemachineRouter

**Files:**
- Create: `src/backend/timemachine/timemachineRouter.js`
- Create: `src/backend/timemachine/timemachineRouter.test.js`

**Endpoints:**
- `GET /api/timemachine/sessions` — lista sesji agentów.
- `GET /api/timemachine/sessions/:id/events` — timeline zdarzeń.
- `POST /api/timemachine/sessions/:id/rollback` — body `{ seq }` lub `{ timestamp }`.

**Step 1: Write the failing test** → **Step 5: Commit**
```bash
git commit -m "feat(timemachine): add REST API router for session events and rollback"
```

---

### Task 4: Frontend — TimeTravelPlayer komponent

**Files:**
- Create: `src/components/TimeTravelPlayer.tsx`
- Create: `src/components/TimeTravelPlayer.test.tsx`

**Co renderuje:**
- Dropdown wyboru sesji agenta.
- Pionowy timeline (lista zdarzeń) z ikonami: ✏️ file_write, ⚡ bash_cmd, 🔀 git_commit.
- Kliknięcie zdarzenia otwiera diff viewer (unified diff snippet) w panelu bocznym.
- Przycisk „Cofnij do tego miejsca" z potwierdzeniem — wywołuje `POST /api/timemachine/sessions/:id/rollback`.
- Live: Socket.IO nasłuchuje `snapshot:event` i dołącza na żywo do timeline.

**Step 1–5 (TDD): test → fail → implement → pass → commit**
```bash
git commit -m "feat(ui): add time-travel player with live event timeline and 1-click rollback"
```
