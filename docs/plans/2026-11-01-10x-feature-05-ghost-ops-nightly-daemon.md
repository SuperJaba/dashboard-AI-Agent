# Feature 05: Ghost Ops — Autonomiczny Nocny Demon Samonaprawiający — Plan Implementacji

> **For Claude / Antigravity:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Demon działający w tle monitoruje telemetrię serwerów, logi Sentry i awarie GitHub CI. Po wykryciu anomalii lub przegranego cron/workflow: reprodukuje błąd w izolowanym git worktree, pisze zautomatyzowany test regresyjny, craft-uje fix, testuje go lokalnie i otwiera gotowy-do-merge PR z wyjaśnieniem.

**Architecture:**
- Backend: `src/backend/ghostops/` — `ghostopsService.js` (główna pętla monitorowania + orchestracja), `ciMonitor.js` (GitHub Actions API — failed workflows), `sentryMonitor.js` (Sentry REST API — nowe błędy), `reproService.js` (izolowany worktree + agent execution), `prService.js` (git branch + GitHub PR creation).
- Rozbudowa istniejącego `schedulerService.js` — dodać preset `ghost_ops_nightly` z cron `0 2 * * *`.
- Frontend: nowa sekcja „Ghost Ops" w `AnalyticsPanel.tsx` lub dedykowana zakładka — lista nocnych runów, status, link do otwartych PR.

**Tech Stack:** `simple-git`, GitHub REST API (via `@octokit/rest`), `node-cron` (już używany), `child_process` (do git worktree), Socket.IO, Vitest.

---

### Task 1: GitHub CI Monitor — wykrywanie failed workflows

**Files:**
- Create: `src/backend/ghostops/ciMonitor.js`
- Create: `src/backend/ghostops/ciMonitor.test.js`

**Step 1: Write the failing test** — `src/backend/ghostops/ciMonitor.test.js`:
- Mock `@octokit/rest` — test `getRecentFailures(owner, repo, hoursBack)` zwraca listę `{ workflowName, runId, headSha, failedJobs[], conclusion: 'failure' }`.
- Test że filtruje tylko `conclusion: 'failure'` lub `'timed_out'`.
- Test że zwraca pusty array gdy wszystkie przebiegi zielone.
- Test `getJobLogs(owner, repo, jobId)` zwraca string logów z pierwszym znakiem błędu (pierwsze 5000 znaków).

**Step 2: Run test to verify it fails**
`npm test -- src/backend/ghostops/ciMonitor.test.js --run`

**Step 3: Implement**
```js
// src/backend/ghostops/ciMonitor.js
import { Octokit } from '@octokit/rest';

export function createCiMonitor(token) {
  const octokit = new Octokit({ auth: token });

  async function getRecentFailures(owner, repo, hoursBack = 24) {
    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
    const { data } = await octokit.actions.listWorkflowRunsForRepo({
      owner, repo, created: `>=${since}`, per_page: 50
    });
    return data.workflow_runs
      .filter(r => ['failure', 'timed_out'].includes(r.conclusion))
      .map(r => ({
        workflowName: r.name,
        runId: r.id,
        headSha: r.head_sha,
        htmlUrl: r.html_url,
        conclusion: r.conclusion,
      }));
  }

  async function getJobLogs(owner, repo, runId) {
    try {
      const { data } = await octokit.actions.downloadWorkflowRunLogs({ owner, repo, run_id: runId });
      return typeof data === 'string' ? data.slice(0, 5000) : '';
    } catch {
      return '';
    }
  }

  return { getRecentFailures, getJobLogs };
}
```

**Step 4: Run test to verify it passes**
`npm test -- src/backend/ghostops/ciMonitor.test.js --run`

**Step 5: Commit**
```bash
git add src/backend/ghostops/ciMonitor.js src/backend/ghostops/ciMonitor.test.js
git commit -m "feat(ghostops): add GitHub CI failure monitor with workflow run detection"
```

---

### Task 2: ReproService — izolowany worktree i agent fix execution

**Files:**
- Create: `src/backend/ghostops/reproService.js`
- Create: `src/backend/ghostops/reproService.test.js`

**Step 1: Write the failing test**:
- Test `createWorktree(headSha, branchName)` wywołuje `git worktree add -b <branch> <path> <sha>`.
- Test `runAgentFix(worktreePath, errorContext, agentCmd)` spawnuje agenta z `errorContext` jako prompt, przechwytuje stdout.
- Test `cleanupWorktree(worktreePath)` usuwa worktree.
- Test że w razie błędu spawnowania agent-fix, cleanup jest wywoływany (finally blok).

**Step 2: Run test to verify it fails**
`npm test -- src/backend/ghostops/reproService.test.js --run`

**Step 3: Implement**
```js
// src/backend/ghostops/reproService.js
import { execSync, spawn } from 'child_process';
import path from 'path';
import os from 'os';

export async function createWorktree(repoPath, headSha, branchName) {
  const worktreePath = path.join(os.tmpdir(), `ghostops-${branchName}-${Date.now()}`);
  execSync(`git worktree add -b ${branchName} ${worktreePath} ${headSha}`, { cwd: repoPath });
  return worktreePath;
}

export async function runAgentFix(worktreePath, errorContext, agentCmd = 'claude') {
  const prompt = `Fixing CI failure. Error context:\n${errorContext}\n\nAnalyze the error, write a failing regression test, then fix the code to make it pass.`;
  return new Promise((resolve, reject) => {
    const proc = spawn(agentCmd, ['--print', prompt], {
      cwd: worktreePath, stdio: ['ignore', 'pipe', 'pipe']
    });
    let output = '';
    proc.stdout.on('data', d => { output += d.toString(); });
    proc.on('close', code => code === 0 ? resolve(output) : reject(new Error(`Agent exited ${code}`)));
  });
}

export function cleanupWorktree(repoPath, worktreePath) {
  try {
    execSync(`git worktree remove --force ${worktreePath}`, { cwd: repoPath });
  } catch { /* ignoruj błędy cleanup */ }
}
```

**Step 4: Run test to verify it passes**
`npm test -- src/backend/ghostops/reproService.test.js --run`

**Step 5: Commit**
```bash
git add src/backend/ghostops/reproService.js src/backend/ghostops/reproService.test.js
git commit -m "feat(ghostops): add isolated git worktree reproduction and agent fix execution"
```

---

### Task 3: PrService — tworzenie brancha i GitHub PR

**Files:**
- Create: `src/backend/ghostops/prService.js`
- Create: `src/backend/ghostops/prService.test.js`

**Step 1: Write the failing test**:
- Test `pushBranchAndCreatePr(owner, repo, branchName, title, body)` — mock Octokit — wywołuje `git push` i `octokit.pulls.create()`.
- Test że `body` zawiera link do failed workflow run i sekcję "Root Cause".
- Test że zwraca `{ prUrl, prNumber }`.

**Step 3: Implement**
```js
// src/backend/ghostops/prService.js
import { Octokit } from '@octokit/rest';
import { execSync } from 'child_process';

export function createPrService(token) {
  const octokit = new Octokit({ auth: token });

  async function pushBranchAndCreatePr(owner, repo, branchName, title, body, { repoPath } = {}) {
    execSync(`git push origin ${branchName}`, { cwd: repoPath });
    const { data } = await octokit.pulls.create({
      owner, repo, title, body, head: branchName, base: 'master',
    });
    return { prUrl: data.html_url, prNumber: data.number };
  }

  function buildPrBody({ workflowName, runUrl, errorSnippet, agentOutput }) {
    return [
      `## 🤖 Ghost Ops — Automatyczna Naprawa CI`,
      ``,
      `**Workflow:** ${workflowName}`,
      `**Failed run:** ${runUrl}`,
      ``,
      `### Pierwiastek Błędu (Root Cause)`,
      `\`\`\``,
      errorSnippet?.slice(0, 1500) ?? 'Brak logów',
      `\`\`\``,
      ``,
      `### Wykonane naprawy`,
      agentOutput?.slice(0, 2000) ?? '',
    ].join('\n');
  }

  return { pushBranchAndCreatePr, buildPrBody };
}
```

**Step 5: Commit**
```bash
git commit -m "feat(ghostops): add PR service for automated branch push and GitHub PR creation"
```

---

### Task 4: GhostopsService — główna pętla i integracja ze Scheduler

**Files:**
- Create: `src/backend/ghostops/ghostopsService.js`
- Create: `src/backend/ghostops/ghostopsService.test.js`
- Modify: `src/backend/scheduler/schedulerService.js` — dodać preset `ghost_ops_nightly`

**Step 1: Write the failing test**:
- Test `runGhostOpsCycle(config)` — integracyjny: mockuje `ciMonitor`, `reproService`, `prService` — weryfikuje że dla każdego failure wykona: getJobLogs → createWorktree → runAgentFix → pushBranch+createPr → cleanupWorktree.
- Test że Telegram notification jest wysyłany po sukcesie: `agent:completed` z linkiem do PR.
- Test że w razie błędu w agentFix, cleanup jest wywoływany (bez crashu głównej pętli).

**Step 5: Commit**
```bash
git commit -m "feat(ghostops): implement main ghost ops cycle with CI monitor, repro, and PR creation"
```

---

### Task 5: Frontend — Ghost Ops Panel

**Files:**
- Create: `src/components/GhostOpsPanel.tsx`
- Create: `src/components/GhostOpsPanel.test.tsx`
- Modify: `src/App.tsx` — dodać zakładkę „Ghost Ops"

**Co renderuje:**
- Status: „Ostatni run: 01.11.2026 02:00" + wyniki (np. „2 błędy wykryte, 2 PR otwarte").
- Lista nocnych runów z linkami do PR i statusem (otwarte/zamknięte/merge).
- Przycisk „Uruchom teraz" (ręczne wywołanie `POST /api/ghostops/run`).

**Step 5: Commit**
```bash
git commit -m "feat(ui): add Ghost Ops panel with nightly run history and manual trigger"
```
