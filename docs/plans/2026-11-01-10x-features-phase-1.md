# 10x Features Phase 1 Implementation Plan

> **For Claude / Antigravity:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the high-impact "Do Now" quick wins and architecture foundations from the 10x Analysis (`docs/10x-features-session-1.md`): Global Emergency Kill-Switch & VRAM Purge, Interactive 1-Tap Mobile Approvals via Telegram, and Task Card Speedometer & Cost Telemetry.

**Architecture:**
- **Emergency Kill-Switch:** Centralized backend endpoint `POST /api/agents/emergency-stop` terminating active CLI agent subprocesses, aborting background tasks, triggering local LLM server unload/kill, and broadcasting `emergency:triggered` via WebSocket. Controlled by a dedicated header component `EmergencyPanicButton.tsx`.
- **Interactive Telegram Approvals:** Bi-directional Telegram Bot integration with `InlineKeyboardMarkup` action buttons (e.g. *Approve Deploy*, *Reject/Abort*) and a webhook handler `POST /api/notifications/telegram/webhook` for 1-tap mobile control without opening the desktop.
- **Task Speedometer & Token Cost Micro-Ticker:** Real-time metrics streaming tokens/sec, context gauge, and estimated inference cost directly inside `AgentsView` task cards.

**Tech Stack:** Express, Node.js `child_process`/`ps-list`, React 19, TypeScript, Vitest, Tailwind CSS v4, Socket.IO.

---

### Task 1: Backend Emergency Stop Service & Endpoint

**Files:**
- Create: `src/backend/agents/emergencyService.js`
- Modify: `src/backend/agents/agentsRouter.js`
- Test: `src/backend/agents/emergencyService.test.js`

**Step 1: Write the failing test**
Create test in `src/backend/agents/emergencyService.test.js`:
- Test that `triggerEmergencyStop()` terminates registered active background worker tasks.
- Test that it sends kill signals to spawned CLI agent processes.
- Test that it attempts to unload/stop active local LLM servers.
- Test that it returns a summary `{ success: true, terminatedTasks: N, killedProcesses: N, freedVram: true }`.

**Step 2: Run test to verify it fails**
Run: `npm test -- src/backend/agents/emergencyService.test.js --run`
Expected: FAIL with module not found.

**Step 3: Write minimal implementation**
Implement `emergencyService.js`:
- Integrate with `backgroundWorker` to cancel active jobs.
- Scan and kill child processes matching agent patterns (`claude`, `openclaude`, `antigravity`, `aider`).
- Call `llmServersRepository.getAll()` and stop active local servers.
- Add `POST /emergency-stop` in `agentsRouter.js`.

**Step 4: Run test to verify it passes**
Run: `npm test -- src/backend/agents/emergencyService.test.js --run`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/backend/agents/emergencyService.js src/backend/agents/agentsRouter.js src/backend/agents/emergencyService.test.js
git commit -m "feat(backend): implement emergency stop service and API endpoint"
```

---

### Task 2: Frontend Global Emergency Kill-Switch Button in Header

**Files:**
- Create: `src/components/EmergencyPanicButton.tsx`
- Modify: `src/App.tsx`
- Test: `src/components/EmergencyPanicButton.test.tsx`

**Step 1: Write the failing test**
Create test `src/components/EmergencyPanicButton.test.tsx`:
- Render button in idle state with warning styling (red/amber glow).
- Click prompts confirmation dialog (or double-click safety).
- Confirming triggers API call to `/api/agents/emergency-stop`.
- Renders toast or status notification with count of stopped agents and freed resources.

**Step 2: Run test to verify it fails**
Run: `npm test -- src/components/EmergencyPanicButton.test.tsx --run`
Expected: FAIL.

**Step 3: Implement minimal component and wire into App header**
- Implement `EmergencyPanicButton.tsx` with modal confirmation, loading spinner, and success badge.
- Place it in the upper right header of `App.tsx` next to server connection status.

**Step 4: Run test to verify it passes**
Run: `npm test -- src/components/EmergencyPanicButton.test.tsx --run`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/components/EmergencyPanicButton.tsx src/components/EmergencyPanicButton.test.tsx src/App.tsx
git commit -m "feat(ui): add global emergency panic kill-switch button to dashboard header"
```

---

### Task 3: Interactive Telegram Inline Action Buttons & Webhook Receiver

**Files:**
- Modify: `src/backend/notifications/adapters/telegramAdapter.js`
- Create: `src/backend/notifications/telegramWebhookRouter.js`
- Modify: `src/backend/notifications/notificationsRouter.js`
- Test: `src/backend/notifications/telegramWebhook.test.js`

**Step 1: Write the failing test**
Create `src/backend/notifications/telegramWebhook.test.js`:
- Test generating `reply_markup` with inline keyboard buttons for `deploy:approval_required` and `agent:approval_required`.
- Test handling incoming callback query `POST /api/notifications/telegram/webhook` with payload `{ callback_query: { data: 'approve:deploy:ct8' } }`.
- Test response message answering callback and triggering action dispatch.

**Step 2: Run test to verify it fails**
Run: `npm test -- src/backend/notifications/telegramWebhook.test.js --run`
Expected: FAIL.

**Step 3: Implement Telegram interactive payload & webhook router**
- Add `createTelegramApprovalPayload()` in `telegramAdapter.js` with buttons (`✅ Zatwierdź`, `❌ Odrzuć`).
- Implement `telegramWebhookRouter.js` to verify bot token and dispatch events to deployment/agent services.

**Step 4: Run test to verify it passes**
Run: `npm test -- src/backend/notifications/telegramWebhook.test.js --run`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/backend/notifications/adapters/telegramAdapter.js src/backend/notifications/telegramWebhookRouter.js src/backend/notifications/notificationsRouter.js src/backend/notifications/telegramWebhook.test.js
git commit -m "feat(notifications): add interactive 1-tap telegram approval buttons and webhook handler"
```

---

### Task 4: Task Speedometer & Real-Time Cost Telemetry Micro-Ticker

**Files:**
- Create: `src/components/TaskSpeedometer.tsx`
- Modify: `src/AgentsView.tsx`
- Test: `src/components/TaskSpeedometer.test.tsx`

**Step 1: Write the failing test**
Create `src/components/TaskSpeedometer.test.tsx`:
- Render speedometer given tokens per second, elapsed time, and total tokens.
- Displays calculated token cost (e.g. `$0.0024` or `0 zł (Lokalny Qwen)`).
- Warns with alert badge when context exceeds 80% of max window.

**Step 2: Run test to verify it fails**
Run: `npm test -- src/components/TaskSpeedometer.test.tsx --run`
Expected: FAIL.

**Step 3: Implement TaskSpeedometer component & integrate into Task Cards**
- Build `TaskSpeedometer.tsx` with animated pulse indicators and compact styling.
- Mount component inside `AgentsView.tsx` task execution cards.

**Step 4: Run test to verify it passes**
Run: `npm test -- src/components/TaskSpeedometer.test.tsx --run`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/components/TaskSpeedometer.tsx src/components/TaskSpeedometer.test.tsx src/AgentsView.tsx
git commit -m "feat(telemetry): add live task speedometer and cost micro-ticker to agent cards"
```

---

### Task 5: End-to-End Verification & Documentation Update

**Files:**
- Modify: `docs/10x-features-session-1.md`
- Run: Full lint and Vitest test suite (`npm run lint`, `npm test -- --run`)

**Step 1: Run full test suite & lint**
- Run: `npm test -- --run`
- Run: `npm run lint`

**Step 2: Update documentation status**
- Check off completed items in `docs/10x-features-session-1.md`.

**Step 3: Commit**
```bash
git add docs/10x-features-session-1.md
git commit -m "docs: update 10x features progress and implementation checklist"
```
