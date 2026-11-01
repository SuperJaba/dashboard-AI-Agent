# Feature 07: Mobile PWA & Full Telegram 1-Tap Approvals — Plan Implementacji

> **For Claude / Antigravity:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Lekka responsywna PWA + integracja bota Telegram z push kartami przy ukończeniu milestona i żądaniu potwierdzenia. Deweloper zatwierdza deploy lub merge PR jednym kliknięciem z telefonu podczas spaceru. Eliminuje idle downtime agentów czekających na human input.

**Architecture:**
- PWA: `vite-plugin-pwa` → Service Worker z `manifest.json`, offline shell, Web Push Notifications.
- Telegram: istniejący `telegramAdapter.js` + nowy `telegramWebhookRouter.js` — bot z Inline Keyboard Buttons (`✅ Zatwierdź`, `❌ Odrzuć`), callback_query handler dispatchuje zdarzenia do `webhookDispatcher.js`.
- Backend `approvalGateway.js` — rejection/approval store z TTL: gdy agent wyemituje `approval:requested`, rejestruje pending approval z timeout (np. 30 min), resolves po odebraniu odpowiedzi (socket lub Telegram callback).
- Frontend: dedykowana strona `/mobile` — minimal dashboard z listą pending approvals i last agent status, zoptymalizowana pod 375px viewport.

**Tech Stack:** `vite-plugin-pwa`, `web-push`, Telegram Bot API, istniejące `notificationService.js`, `telegramAdapter.js`, `webhookDispatcher.js`, Express, Socket.IO.

---

### Task 1: ApprovalGateway — centralny mechanizm oczekiwania na decyzję

**Files:**
- Create: `src/backend/notifications/approvalGateway.js`
- Create: `src/backend/notifications/approvalGateway.test.js`

**Step 1: Write the failing test** — `src/backend/notifications/approvalGateway.test.js`:
- Test `requestApproval({ id, action, description, timeoutMs })` — zwraca Promise resolving z `{ approved: true }` lub `{ approved: false, reason }`.
- Test `approve(id)` — resolves pending promise.
- Test `reject(id, reason)` — resolves z `approved: false`.
- Test że po `timeoutMs` promise rejectuje z `{ approved: false, reason: 'timeout' }`.
- Test `getPendingApprovals()` — lista oczekujących.

**Step 2: Run test to verify it fails**
`npm test -- src/backend/notifications/approvalGateway.test.js --run`

**Step 3: Implement**
```js
// src/backend/notifications/approvalGateway.js
const pendingApprovals = new Map();
// Map<id, { resolve, reject, timeout, action, description, createdAt }>

export function requestApproval({ id, action, description, timeoutMs = 30 * 60 * 1000 }) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingApprovals.delete(id);
      resolve({ approved: false, reason: 'timeout' });
    }, timeoutMs);

    pendingApprovals.set(id, {
      resolve, reject, timer, action, description,
      createdAt: new Date().toISOString(),
    });
  });
}

export function approve(id) {
  const pending = pendingApprovals.get(id);
  if (!pending) return false;
  clearTimeout(pending.timer);
  pendingApprovals.delete(id);
  pending.resolve({ approved: true });
  return true;
}

export function reject(id, reason = 'rejected') {
  const pending = pendingApprovals.get(id);
  if (!pending) return false;
  clearTimeout(pending.timer);
  pendingApprovals.delete(id);
  pending.resolve({ approved: false, reason });
  return true;
}

export function getPendingApprovals() {
  return Array.from(pendingApprovals.entries()).map(([id, v]) => ({
    id, action: v.action, description: v.description, createdAt: v.createdAt
  }));
}
```

**Step 4: Run test to verify it passes**
`npm test -- src/backend/notifications/approvalGateway.test.js --run`

**Step 5: Commit**
```bash
git add src/backend/notifications/approvalGateway.js src/backend/notifications/approvalGateway.test.js
git commit -m "feat(notifications): add approval gateway with timeout-based pending approval resolution"
```

---

### Task 2: Telegram Webhook — inline buttons i callback handler

**Files:**
- Modify: `src/backend/notifications/adapters/telegramAdapter.js`
- Create: `src/backend/notifications/telegramWebhookRouter.js`
- Create: `src/backend/notifications/telegramWebhook.test.js`
- Modify: `src/backend/notifications/notificationsRouter.js` — mount webhook

**Step 1: Write the failing test** — `src/backend/notifications/telegramWebhook.test.js`:
- Test `createTelegramApprovalPayload(chatId, approvalId, action, description)` — zawiera `reply_markup.inline_keyboard` z `callback_data: 'approve:<approvalId>'` i `'reject:<approvalId>'`.
- Test `POST /api/notifications/telegram/webhook` z body `{ callback_query: { data: 'approve:abc123', from: { id: 1 } } }` → wywołuje `approvalGateway.approve('abc123')` → odpowiada Telegramowi `answerCallbackQuery`.
- Test `POST /api/notifications/telegram/webhook` z `callback_query.data: 'reject:abc123'` → wywołuje `approvalGateway.reject('abc123')`.
- Test że nieznany callback zwraca 200 (Telegram wymaga 200 zawsze).

**Step 2: Run test to verify it fails**
`npm test -- src/backend/notifications/telegramWebhook.test.js --run`

**Step 3: Implement**
W `telegramAdapter.js` dodać:
```js
export function createTelegramApprovalPayload(chatId, approvalId, action, description) {
  return {
    chat_id: chatId,
    text: [
      `🔔 *Wymagane Zatwierdzenie*`,
      ``,
      `• *Akcja:* \`${action}\``,
      `• *Opis:* ${description}`,
      `• *Czas:* ${new Date().toLocaleString('pl-PL')}`,
    ].join('\n'),
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[
        { text: '✅ Zatwierdź', callback_data: `approve:${approvalId}` },
        { text: '❌ Odrzuć', callback_data: `reject:${approvalId}` },
      ]],
    },
  };
}
```

`telegramWebhookRouter.js` — odbiera callback_query, parsuje `approve:id` / `reject:id`, wywołuje `approvalGateway`, odpowiada `answerCallbackQuery` do Telegram API.

**Step 5: Commit**
```bash
git commit -m "feat(notifications): add interactive telegram inline button approvals and webhook handler"
```

---

### Task 3: Web Push Notifications (PWA)

**Files:**
- Create: `src/backend/notifications/webPushRouter.js`
- Create: `src/backend/notifications/webPushRouter.test.js`
- Modify: `vite.config.ts` — dodać `vite-plugin-pwa`
- Create: `public/sw.js` (Service Worker template — generowany przez PWA plugin)
- Create: `public/manifest.json`

**Step 1: Write the failing test** — `src/backend/notifications/webPushRouter.test.js`:
- Test `POST /api/notifications/push/subscribe` z `{ endpoint, keys }` → zapisuje subskrypcję.
- Test `POST /api/notifications/push/send` z `{ title, body, data }` → wywołuje `web-push.sendNotification()` na wszystkich subskrypcjach.
- Test że niedziałające subskrypcje (HTTP 410) są usuwane.

**Step 3: Implement — `webPushRouter.js`**
```js
import webPush from 'web-push';
import { safeQuery } from '../db.js';
import { Router } from 'express';

const router = Router();
// VAPID keys — generować: webPush.generateVAPIDKeys()
webPush.setVapidDetails(
  'mailto:admin@dashboard.local',
  process.env.VAPID_PUBLIC_KEY ?? '',
  process.env.VAPID_PRIVATE_KEY ?? ''
);

router.post('/subscribe', async (req, res) => {
  const { endpoint, keys } = req.body;
  await safeQuery('INSERT OR REPLACE INTO push_subscriptions (endpoint, keys_json) VALUES (?,?)',
    [endpoint, JSON.stringify(keys)]);
  res.json({ subscribed: true });
});

router.post('/send', async (req, res) => {
  const { title, body, data } = req.body;
  const subs = await safeQuery('SELECT * FROM push_subscriptions');
  const payload = JSON.stringify({ title, body, data });
  const results = await Promise.allSettled(subs.map(async (s) => {
    try {
      await webPush.sendNotification({ endpoint: s.endpoint, keys: JSON.parse(s.keys_json) }, payload);
    } catch (e) {
      if (e.statusCode === 410) {
        await safeQuery('DELETE FROM push_subscriptions WHERE endpoint=?', [s.endpoint]);
      }
    }
  }));
  res.json({ sent: results.filter(r => r.status === 'fulfilled').length });
});

export default router;
```

**Step 5: Commit**
```bash
git add src/backend/notifications/webPushRouter.js src/backend/notifications/webPushRouter.test.js vite.config.ts public/manifest.json
git commit -m "feat(pwa): add web push notification backend with VAPID and subscription management"
```

---

### Task 4: Frontend — strona /mobile i komponent ApprovalQueue

**Files:**
- Create: `src/MobileDashboard.tsx`
- Create: `src/MobileDashboard.test.tsx`
- Modify: `src/App.tsx` — route `/mobile`

**Co renderuje `/mobile`:**
- Lista pending approvals z przyciski „Zatwierdź" / „Odrzuć" (via `POST /api/notifications/approvals/:id/decide`).
- Status ostatnich 3 agentów (ostatni task, status, timestamp).
- Przycisk „Włącz powiadomienia push" → rejestracja Service Worker + subskrypcja.
- Minimalistyczny layout (dark, 375px, dotykowy).

**Step 5: Commit**
```bash
git commit -m "feat(ui): add mobile dashboard with approval queue and PWA push notification opt-in"
```
