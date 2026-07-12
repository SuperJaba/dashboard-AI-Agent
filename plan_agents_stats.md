# Implementation Plan: Dashboard Improvements

## Goal Description
The objective is to complete the integration of local AI agents into the dashboard, introduce system statistics monitoring for remote servers, and improve general LLM and Agent configurations.

## User Review Required
Please review the proposed UI changes and confirm if the placement of the new "Agents" view and "System Stats" section aligns with your vision.

## Open Questions
- Do we want the System Stats (RAM/CPU/Disk) to be polled periodically (e.g., via WebSocket or interval polling), or fetched on-demand when the remote server view is opened?

---

## Proposed Changes

### App.tsx Navigation and View Routing
We will update `App.tsx` to handle routing between the main dashboard and the new `AgentsView`.

#### [MODIFY] src/App.tsx
- Add a new "Local Agents" button in the sidebar under a new section.
- Add `activeView` state to toggle between `dashboard` and `agents`.
- Render `<AgentsView />` when `activeView === 'agents'`.
- Import the `Bot` icon from `lucide-react` for the Agents button.

### System Statistics for Remote Servers
Implement a mechanism to fetch and display CPU, RAM, and Disk usage for remote servers.

#### [MODIFY] server.js
- Add an API endpoint `GET /api/servers/:id/stats` that executes SSH commands (`free -m`, `df -h`, `top -bn1` or `mpstat`) on the remote server to gather stats.

#### [MODIFY] src/App.tsx (or create ServerStats.tsx)
- Create a UI component to display these stats in the remote server view.

### General LLM/Agent Configuration Improvements
Enhance the existing settings to support per-agent overrides or advanced settings.

#### [MODIFY] server.js
- Extend the `cli_agents` table or settings table to store more granular LLM configs (model name, temperature, max tokens).

#### [MODIFY] src/AgentsView.tsx
- Add UI fields to edit these advanced configurations per local agent.

---

## Verification Plan

### Automated Tests
Run vitest to ensure no existing tests are broken.
```bash
npm run test
```

### Manual Verification
1. Click the "Local Agents" button in the sidebar. Verify the `AgentsView` renders correctly.
2. Select a remote server. Verify that the System Stats load and display correct metrics.
3. Edit an agent's configuration. Verify the settings are saved and retrieved correctly.

## Git Workflow
Before beginning the implementation, we will perform the following Git operations:
1. Commit current changes on the current branch.
2. Create a PR to master (or merge directly if PR isn't necessary/available via CLI).
3. Checkout a new branch for these new features (e.g., `feature/agents-stats`).
## Tasks
- [x] Update App.tsx with AgentsView navigation
- [ ] Implement System Stats API in server.js
- [ ] Render System Stats in App.tsx remote view
- [ ] Store LLM config in DB
- [ ] Create config UI in AgentsView
- [ ] Implement full user authentication (login view, sessions, passwords) /skill auth-implementation-patterns
- [ ] Deploy dashboard to a remote server
- [ ] Integrate Git repositories directly into the dashboard
- [ ] Implement remote coding capabilities (containers / GitHub workspaces)
- [ ] Generate Dashboard-specific SSH keys for Agent remote access and store in DB
  - **Workflow dla zdalnego agenta w razie błędu braku klucza (BatchMode=yes fails):**
    1. Wykrycie błędu autoryzacji z serwerem.
    2. Propozycja pracy na kodzie lokalnym (np. repo z gita).
    3. Po wyrażeniu zgody: wygenerowanie nowego klucza lokalnie dla Agenta (`ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_antigravity -N ""`).
    4. Wygenerowanie i przekazanie użytkownikowi komendy `ssh-copy-id` do przeklejenia w jego interaktywnym terminalu (ponieważ Agent nie obsłuży promptu o hasło).
    5. Po potwierdzeniu `ssh-copy-id` przez usera – powrót do automatycznego połączenia (`-i ~/.ssh/id_ed25519_antigravity`).
- [ ] Poprawić logikę dodawania/parsowania zadań w plikach md (obsługa błędnych znaków nowej linii)
