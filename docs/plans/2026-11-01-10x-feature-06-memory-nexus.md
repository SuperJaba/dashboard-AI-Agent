# Feature 06: Unified Cross-Agent Knowledge & Memory Nexus — Plan Implementacji

> **For Claude / Antigravity:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Centralny persistent memory plane łączący wszystkie środowiska agentów. Gdy Claude Code odkryje subtelny bug w schemacie bazy danych, Antigravity, OpenClaude i Gemini na projekcie B natychmiast absorbują tę lekcję. Agenci przestają popełniać te same błędy w różnych sesjach.

**Architecture:**
- Backend: `src/backend/memory/` — `memoryRepository.js` (SQLite store z wektorową warstwą), `memoryService.js` (operacje: save, search, consolidate, expire), `memoryRouter.js` (REST API).
- Integracja z istniejącymi MCP tools: `agentmemory` (memory_save, memory_recall) i `mempalace` (mempalace_add_drawer, mempalace_search) — backend będzie operował na tych narzędziach przez CLI bridge, gdy są dostępne, lub własną SQLite jako fallback.
- Broadcast: Socket.IO `memory:saved` gdy nowa lekcja zostaje dodana — agenci mogą subskrybować i pobierać kontekst w czasie rzeczywistym.
- Frontend: `src/components/MemoryNexusPanel.tsx` — przegląd zapisanych lekcji z filtrowaniem po agencie/projekcie, ręczne dodawanie/usuwanie wpisów, wskaźnik aktywności memory.

**Tech Stack:** `better-sqlite3` (in-memory fallback lub SQLite), `@xenova/transformers` lub prosty TF-IDF dla semantycznego rankingu, Socket.IO, Express, Vitest.

---

### Task 1: MemoryRepository — persistent store

**Files:**
- Create: `src/backend/memory/memoryRepository.js`
- Create: `src/backend/memory/memoryRepository.test.js`
- Modify: `src/backend/db.js` — tabela `agent_memories (id, agent, project, category, content, tags, created_at, access_count)`

**Step 1: Write the failing test** — `src/backend/memory/memoryRepository.test.js`:
- Test `saveMemory({ agent, project, category, content, tags[] })` → zwraca `{ id, content, tags }`.
- Test `searchMemories(query, { agent?, project?, limit })` → zwraca posortowane wyniki (pełnotekstowe LIKE lub FTS5).
- Test `getRecentMemories(limit)` → top N po `created_at DESC`.
- Test `deleteMemory(id)` → poprawne usunięcie.
- Test `incrementAccessCount(id)` → pole `access_count` rośnie.

**Step 2: Run test to verify it fails**
`npm test -- src/backend/memory/memoryRepository.test.js --run`

**Step 3: Implement**
```js
// src/backend/memory/memoryRepository.js
import { safeQuery } from '../db.js';
import crypto from 'crypto';

export async function saveMemory({ agent, project, category, content, tags = [] }) {
  const id = crypto.randomUUID();
  await safeQuery(
    'INSERT INTO agent_memories (id, agent, project, category, content, tags, created_at, access_count) VALUES (?,?,?,?,?,?,?,0)',
    [id, agent, project ?? 'global', category ?? 'general', content, JSON.stringify(tags), new Date().toISOString()]
  );
  return getMemory(id);
}

export async function getMemory(id) {
  const rows = await safeQuery('SELECT * FROM agent_memories WHERE id=?', [id]);
  if (!rows[0]) return null;
  return { ...rows[0], tags: JSON.parse(rows[0].tags || '[]') };
}

export async function searchMemories(query, { agent, project, limit = 20 } = {}) {
  const conditions = ['content LIKE ?'];
  const params = [`%${query}%`];
  if (agent) { conditions.push('agent=?'); params.push(agent); }
  if (project) { conditions.push('project=?'); params.push(project); }
  params.push(limit);
  const rows = await safeQuery(
    `SELECT * FROM agent_memories WHERE ${conditions.join(' AND ')} ORDER BY access_count DESC, created_at DESC LIMIT ?`,
    params
  );
  return rows.map(r => ({ ...r, tags: JSON.parse(r.tags || '[]') }));
}

export async function getRecentMemories(limit = 50) {
  const rows = await safeQuery('SELECT * FROM agent_memories ORDER BY created_at DESC LIMIT ?', [limit]);
  return rows.map(r => ({ ...r, tags: JSON.parse(r.tags || '[]') }));
}

export async function deleteMemory(id) {
  await safeQuery('DELETE FROM agent_memories WHERE id=?', [id]);
}

export async function incrementAccessCount(id) {
  await safeQuery('UPDATE agent_memories SET access_count = access_count + 1 WHERE id=?', [id]);
}
```

**Step 4: Run test to verify it passes**
`npm test -- src/backend/memory/memoryRepository.test.js --run`

**Step 5: Commit**
```bash
git add src/backend/memory/memoryRepository.js src/backend/memory/memoryRepository.test.js src/backend/db.js
git commit -m "feat(memory): add agent memory repository with fulltext search and access tracking"
```

---

### Task 2: MemoryService — broadcast i cross-agent sync

**Files:**
- Create: `src/backend/memory/memoryService.js`
- Create: `src/backend/memory/memoryService.test.js`

**Step 1: Write the failing test**:
- Test `rememberLesson({ agent, project, category, content, tags }, { io })` — zapisuje w repo I emituje `memory:saved` przez socket mock.
- Test `recallContext(query, opts)` — wrappuje `searchMemories` i zwiększa `access_count` dla każdego zwróconego wyniku.
- Test `consolidate({ daysOld, minAccessCount })` — usuwa stare, rzadko używane wpisy (housekeeping).
- Test `formatAsSystemPromptAddition(memories)` — formatuje listę lekcji jako string do wstrzyknięcia w system prompt agenta.

**Step 3: Implement**
```js
// src/backend/memory/memoryService.js
import * as repo from './memoryRepository.js';

export async function rememberLesson({ agent, project, category, content, tags }, { io } = {}) {
  const memory = await repo.saveMemory({ agent, project, category, content, tags });
  io?.emit('memory:saved', { id: memory.id, agent, project, category, preview: content.slice(0, 100) });
  return memory;
}

export async function recallContext(query, opts = {}) {
  const results = await repo.searchMemories(query, opts);
  await Promise.all(results.map(r => repo.incrementAccessCount(r.id)));
  return results;
}

export async function consolidate({ daysOld = 30, minAccessCount = 1 } = {}) {
  const cutoff = new Date(Date.now() - daysOld * 86400 * 1000).toISOString();
  const stale = await repo.safeQuery?.(
    'SELECT id FROM agent_memories WHERE created_at < ? AND access_count < ?',
    [cutoff, minAccessCount]
  ) ?? [];
  for (const row of stale) await repo.deleteMemory(row.id);
  return { deleted: stale.length };
}

export function formatAsSystemPromptAddition(memories) {
  if (!memories.length) return '';
  const lines = memories.map(m =>
    `- [${m.agent}][${m.category}] ${m.content}`
  );
  return `\n\n## Accumulated Agent Knowledge (${memories.length} lessons)\n${lines.join('\n')}`;
}
```

**Step 5: Commit**
```bash
git commit -m "feat(memory): add memory service with cross-agent broadcast and system prompt injection"
```

---

### Task 3: REST API — memoryRouter

**Files:**
- Create: `src/backend/memory/memoryRouter.js`
- Create: `src/backend/memory/memoryRouter.test.js`

**Endpoints:**
- `GET /api/memory?q=<query>&agent=<agent>` — wyszukiwanie lekcji.
- `POST /api/memory` — ręczne dodanie `{ agent, project, category, content, tags }`.
- `DELETE /api/memory/:id` — usunięcie wpisu.
- `POST /api/memory/consolidate` — wyzwolenie housekeepingu.
- `GET /api/memory/recent` — ostatnie N wpisów.

**Step 5: Commit**
```bash
git commit -m "feat(memory): add REST API for cross-agent memory nexus CRUD and search"
```

---

### Task 4: Frontend — MemoryNexusPanel

**Files:**
- Create: `src/components/MemoryNexusPanel.tsx`
- Create: `src/components/MemoryNexusPanel.test.tsx`
- Modify: `src/App.tsx` — zakładka „Pamięć Agentów"

**Co renderuje:**
- Wyszukiwarka lekcji z filtrem agenta i projektu.
- Karta każdej lekcji: `[agent]` `[category]` preview treści, tagi, liczba odwołań.
- Przycisk „+ Dodaj lekcję" (modal).
- Live badge: „+1 nowa lekcja" gdy `memory:saved` przez Socket.IO.
- Przycisk „Konsolidacja" — wywołuje housekeeping.

**Step 5: Commit**
```bash
git commit -m "feat(ui): add Memory Nexus panel with live updates, search, and manual lesson management"
```
