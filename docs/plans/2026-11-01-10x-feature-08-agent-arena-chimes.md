# Feature 08: Side-by-Side Agent Arena Replay & Acoustic Mission Control Chimes — Plan Implementacji

> **For Claude / Antigravity:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:**
1. **Agent Arena:** Przycisk „Uruchom z innym agentem" na karcie ukończonego zadania — re-run tego samego promptu innym modelem w równoległym git worktree, wynik prezentowany w split-screen diff.
2. **Acoustic Chimes:** Subtelne dźwiękowe sygnały (Sci-Fi/Space chimes) dla: Task Completed, Build Failed, Awaiting Approval, Memory OOM — deweloper pracujący w tle słyszy co wymaga uwagi bez patrzenia na monitor.

**Architecture:**
- Agent Arena: `src/backend/arena/` — `arenaRunner.js` tworzy tymczasowy git worktree, uruchamia agenta z tym samym promptem, zbiera stdout, wywołuje `git diff` między worktree a wynikiem oryginału, zwraca unified diff.
- Acoustic: `src/hooks/useMissionChimes.ts` — React hook subskrybujący zdarzenia Socket.IO i odtwarzający odpowiedni dźwięk z `AudioContext` API (< 100ms latency, bez zewnętrznych plików audio — generowane syntezą WebAudio).

**Tech Stack:** `child_process`, `simple-git`, Web Audio API, Socket.IO, React, Tailwind CSS v4, Vitest.

---

### Task 1: ArenaRunner — parallel worktree re-run

**Files:**
- Create: `src/backend/arena/arenaRunner.js`
- Create: `src/backend/arena/arenaRunner.test.js`

**Step 1: Write the failing test** — `src/backend/arena/arenaRunner.test.js`:
- Test `createArenaRun({ originalTaskId, agentCmd, prompt, repoPath })` — mocki `execSync` i `spawn` — tworzy worktree, spawnuje agenta, zwraca `{ runId, arenaPath }`.
- Test `getArenaDiff(runId)` — wywołuje `git diff` między `repoPath` a `arenaPath`, zwraca unified diff string.
- Test `cleanupArena(runId)` — usuwa worktree i wpis z aktywnych aren.
- Test że `getActiveArenas()` zwraca listę `{ runId, agent, createdAt, status }`.

**Step 2: Run test to verify it fails**
`npm test -- src/backend/arena/arenaRunner.test.js --run`

**Step 3: Implement**
```js
// src/backend/arena/arenaRunner.js
import { execSync, spawn } from 'child_process';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

const activeArenas = new Map(); // runId -> { arenaPath, repoPath, proc, status }

export async function createArenaRun({ originalTaskId, agentCmd, prompt, repoPath }) {
  const runId = crypto.randomUUID();
  const branchName = `arena-${runId.slice(0, 8)}`;
  const arenaPath = path.join(os.tmpdir(), `arena-${branchName}`);

  // Tworzenie worktree z bieżącą gałęzią HEAD
  execSync(`git worktree add -b ${branchName} ${arenaPath} HEAD`, { cwd: repoPath });

  activeArenas.set(runId, { arenaPath, repoPath, status: 'running', branchName, agent: agentCmd });

  // Uruchomienie agenta asynchronicznie
  const proc = spawn(agentCmd, ['--print', prompt], {
    cwd: arenaPath, stdio: ['ignore', 'pipe', 'pipe']
  });

  proc.on('close', (code) => {
    const arena = activeArenas.get(runId);
    if (arena) arena.status = code === 0 ? 'done' : 'failed';
  });

  activeArenas.get(runId).proc = proc;
  return { runId, arenaPath };
}

export function getArenaDiff(runId) {
  const arena = activeArenas.get(runId);
  if (!arena) throw new Error(`Arena ${runId} not found`);
  try {
    return execSync(`git diff HEAD..${arena.branchName}`, {
      cwd: arena.repoPath, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024
    });
  } catch {
    return '';
  }
}

export function cleanupArena(runId) {
  const arena = activeArenas.get(runId);
  if (!arena) return;
  try {
    arena.proc?.kill('SIGTERM');
    execSync(`git worktree remove --force ${arena.arenaPath}`, { cwd: arena.repoPath });
    execSync(`git branch -D ${arena.branchName}`, { cwd: arena.repoPath });
  } catch { /* ignoruj */ }
  activeArenas.delete(runId);
}

export function getActiveArenas() {
  return Array.from(activeArenas.entries()).map(([id, a]) => ({
    runId: id, agent: a.agent, status: a.status, arenaPath: a.arenaPath
  }));
}
```

**Step 4: Run test to verify it passes**
`npm test -- src/backend/arena/arenaRunner.test.js --run`

**Step 5: Commit**
```bash
git add src/backend/arena/arenaRunner.js src/backend/arena/arenaRunner.test.js
git commit -m "feat(arena): add parallel worktree agent re-runner with diff comparison"
```

---

### Task 2: REST API — arenaRouter

**Files:**
- Create: `src/backend/arena/arenaRouter.js`
- Create: `src/backend/arena/arenaRouter.test.js`

**Endpoints:**
- `POST /api/arena/run` — body `{ taskId, agentCmd, prompt }` → zwraca `{ runId }`.
- `GET /api/arena/runs/:runId/diff` — zwraca unified diff.
- `GET /api/arena/runs` — lista aktywnych aren.
- `DELETE /api/arena/runs/:runId` — cleanup worktree.

**Step 5: Commit**
```bash
git commit -m "feat(arena): add REST API for agent arena run management"
```

---

### Task 3: Frontend — AgentArenaButton i SplitDiffViewer

**Files:**
- Create: `src/components/AgentArenaButton.tsx`
- Create: `src/components/AgentArenaButton.test.tsx`
- Create: `src/components/SplitDiffViewer.tsx`
- Create: `src/components/SplitDiffViewer.test.tsx`
- Modify: `src/AgentsView.tsx` — dodać `AgentArenaButton` do kart ukończonych zadań

**Step 1: Write the failing test** — `src/components/AgentArenaButton.test.tsx`:
- Renderuje button „▶ Porównaj z..." tylko gdy task ma `status: 'completed'`.
- Kliknięcie otwiera dropdown z listą dostępnych agentów (claude, openclaude, antigravity, aider, gemini).
- Wybranie agenta wywołuje `POST /api/arena/run` z odpowiednim `agentCmd`.
- Po uruchomieniu pokazuje spinner „Arena uruchomiona...".
- Po zakończeniu (polling lub Socket.IO `arena:done`) renderuje `SplitDiffViewer`.

**`SplitDiffViewer.tsx` — co renderuje:**
- Dwie kolumny (oryginał vs Arena) z kolorowym syntax highlighting zmian (dodane linie zielone, usunięte czerwone).
- Podsumowanie: `+N / -M linii` zmienione.
- Przycisk „Zastosuj wynik areny" (kopiuje pliki z worktree do aktywnego projektu).

**Step 5: Commit**
```bash
git commit -m "feat(ui): add agent arena button and split diff viewer to completed task cards"
```

---

### Task 4: Mission Control Chimes (Web Audio API)

**Files:**
- Create: `src/hooks/useMissionChimes.ts`
- Create: `src/hooks/useMissionChimes.test.ts`
- Modify: `src/App.tsx` — zamontować hook raz globalnie

**Step 1: Write the failing test** — `src/hooks/useMissionChimes.test.ts`:
- Test `useMissionChimes({ enabled: true })` — mock `AudioContext` — subskrybuje socket events.
- Test że socket event `task:completed` powoduje wywołanie `audioCtx.createOscillator()` z `type: 'sine'` i odpowiednią częstotliwością.
- Test że socket event `build:failed` odtwarza chime z `type: 'sawtooth'` (niepokojący).
- Test że `enabled: false` → żaden dźwięk nie jest odtwarzany.
- Test że `useMissionChimes` eksponuje `{ enabled, setEnabled, playChime }`.

**Step 2: Run test to verify it fails**
`npm test -- src/hooks/useMissionChimes.test.ts --run`

**Step 3: Implement**
```ts
// src/hooks/useMissionChimes.ts
import { useEffect, useCallback, useRef, useState } from 'react';
import { useSocket } from './useDashboardSocket';

const CHIMES: Record<string, { freq: number; type: OscillatorType; duration: number }> = {
  'task:completed':          { freq: 523.25, type: 'sine',     duration: 0.4 },  // C5 — sukces
  'build:failed':            { freq: 220,    type: 'sawtooth', duration: 0.6 },  // A3 — alarm
  'approval:requested':      { freq: 659.25, type: 'triangle', duration: 0.3 },  // E5 — uwaga
  'emergency:triggered':     { freq: 880,    type: 'square',   duration: 1.0 },  // A5 — krytyczny
  'memory:saved':            { freq: 392,    type: 'sine',     duration: 0.2 },  // G4 — cichy info
};

export function useMissionChimes(opts: { enabled?: boolean } = {}) {
  const [enabled, setEnabled] = useState(opts.enabled ?? true);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const socket = useSocket();

  const playChime = useCallback((eventName: string) => {
    if (!enabled) return;
    const chime = CHIMES[eventName];
    if (!chime) return;
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    const ctx = audioCtxRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = chime.type;
    osc.frequency.value = chime.freq;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + chime.duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + chime.duration);
  }, [enabled]);

  useEffect(() => {
    if (!socket) return;
    const events = Object.keys(CHIMES);
    const handlers = events.map(ev => {
      const handler = () => playChime(ev);
      socket.on(ev, handler);
      return { ev, handler };
    });
    return () => {
      handlers.forEach(({ ev, handler }) => socket.off(ev, handler));
    };
  }, [socket, playChime]);

  return { enabled, setEnabled, playChime };
}
```

**Step 4: Run test to verify it passes**
`npm test -- src/hooks/useMissionChimes.test.ts --run`

**Step 5: Commit**
```bash
git add src/hooks/useMissionChimes.ts src/hooks/useMissionChimes.test.ts src/App.tsx
git commit -m "feat(audio): add mission control acoustic chimes via Web Audio API with socket event triggers"
```

---

### Task 5: Settings Toggle dla chimes + E2E

**Files:**
- Modify: `src/preferences/` — dodać preferencję `chimesEnabled` do userPreferences

**Co dodać:**
- Toggle „🔔 Dźwięki misji" w panelu ustawień (lub headerze).
- Preferencja persystowana przez `localStorage` lub backend `/api/settings`.

**Step 5: Commit**
```bash
git commit -m "feat(settings): add acoustic chimes enable/disable preference"
```
