# Dashboard 📊

A modern, full-stack dashboard for orchestrating local and remote AI developer agents, managing servers via SSH, tracking project tasks, executing real-time terminal sessions, and configuring LLM backends.

## 🎯 Key Capabilities
- **AI Agent Orchestration**: Deploy and monitor autonomous agents (Antigravity, Claude Code, Aider) locally or remotely with hybrid execution target switching.
- **Intelligent Model Routing**: Dynamic task complexity scoring, routing ~80–85% routine tasks to local LM Studio instances with sub-500ms latency and zero API cost, and high-complexity tasks to cloud LLMs (AGY / Gemini Pro), backed by an automatic Circuit Breaker.
- **Interactive Terminal**: Real-time terminal shells powered by Socket.io, `node-pty`, and Xterm.js.
- **Server & SSH Management**: Monitor remote server stats (CPU, RAM, Disk) and run automated or interactive tasks.
- **Project & Git Integration**: Git branch management, visual diffs, staging, committing, and task tracking.
- **LLM Server Management**: Centralized management of LLM endpoints, credentials, models, and parameters.
- **Extensible Widgets**: Custom shell-command widgets with timeseries, number, and status visualizers.

## 🛠️ Tech Stack
| Layer | Technologies |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS v4 (`@tailwindcss/postcss`), Lucide Icons |
| **Backend** | Node.js, Express 5, Socket.io, `node-pty` |
| **Database** | PostgreSQL with automatic in-memory fallback |
| **Testing** | Vitest, Playwright E2E, Supertest |
| **Metrics** | Prometheus endpoint (`/metrics`) and Grafana integration |

## 📦 Quick Start

### 1. Setup & Install
```bash
git clone <repository-url>
cd dashboard
npm install
cp .env.example .env
```

Configure `.env`:
```env
DATABASE_URL=postgres://username:password@localhost:5432/dashboard
# Minimum 32 characters in production; fallback keys are strictly rejected on startup in production (NODE_ENV=production)
JWT_SECRET=your_super_secret_jwt_token_key_min_32_chars
ENCRYPTION_KEY=32_character_long_secret_key_here
```

### 2. Run Development
```bash
npm run dev
```
- Frontend UI: `http://localhost:5173`
- Backend API: `http://localhost:3001`

### 3. Verify
```bash
npm test            # Run Vitest test suite
npm run lint        # Check Oxlint & ESLint rules
npm run build       # Build production bundle into dist/
```

## 🧠 Intelligent Model Routing & Circuit Breaker

The dashboard incorporates an automated multi-tier LLM routing architecture designed to balance task quality, response latency, and operational costs:

```
                      ┌─────────────────────────┐
                      │    Incoming AI Task     │
                      └────────────┬────────────┘
                                   │
                                   ▼
                      ┌─────────────────────────┐
                      │ Task Complexity Scorer  │
                      │ (Length, files, keywords)│
                      └────────────┬────────────┘
                                   │
                  ┌────────────────┴────────────────┐
                  │                                 │
     Low / Medium Complexity (~80–85%)    High Complexity (~15–20%)
                  │                                 │
                  ▼                                 │
         [ Circuit Breaker ]                        │
         /                 \                        │
   Closed / Half-Open      Open (Failover)          │
         │                         \                │
         ▼                          ▼               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│ Local LM Studio         │     │ AGY / Cloud LLM         │
│ Host: 10.10.10.30:1234  │     │ Model: Gemini Pro       │
│ Model: gpt-oss-20b      │     │ Latency: ~1450ms        │
│ Fallback: granite-micro │     │ Complex reasoning,      │
│ Latency: ~380ms (<500ms)│     │ architecture, audits    │
│ Cost: $0.00             │     └─────────────────────────┘
└─────────────────────────┘
```

### 1. Routing Tiers & Target Workloads
* **Low / Medium Tier (~80–85% of tasks)**:
  * **Provider & Models:** Local LM Studio endpoint (`http://10.10.10.30:1234/v1`) running `openai/gpt-oss-20b` (or `qwen3.8-whittle-moe-27b`) with `granite-4.0-micro` as local fallback.
  * **Performance & Cost:** Sub-500ms latency (average ~380ms) and zero API billing cost.
  * **Use Cases:** Routine code generation, single-function implementations, CRUD operations, test suite generation, regex, parsers, and schema validation.
* **High Tier (~15–20% of tasks)**:
  * **Provider & Models:** Cloud AGY (`AGY (Gemini Pro)`).
  * **Performance:** Average latency ~1450ms with deep contextual reasoning.
  * **Use Cases:** Cross-file architectural redesigns, complex refactoring, concurrency & deadlock resolution, multi-file security audits, and large prompts (>2500 characters or >5 modified files).

### 2. Complexity Scoring Engine
Located at [`src/backend/llm/complexityScorer.js`](src/backend/llm/complexityScorer.js):
* **Prompt & Context Volume:** Flags prompts > 2,500 characters or tasks touching > 5 files directly as `high`. Tasks with > 500 characters or > 1 file are evaluated as at least `medium`.
* **Domain Keywords:** Evaluates high-impact keywords (`architecture`, `refactor`, `migration`, `distributed`, `concurrency`, `deadlock`, `security audit`, `benchmark`) versus medium-complexity keywords (`test`, `implement`, `endpoint`, `api`, `schema`, `validation`, `component`, `regex`).

### 3. Failover & Circuit Breaker
Located at [`src/backend/llm/modelRouter.js`](src/backend/llm/modelRouter.js):
* **State Machine:** Operates with standard `CLOSED`, `OPEN`, and `HALF_OPEN` states.
* **Failure Threshold:** After 3 consecutive network or execution errors from the local LM Studio instance, the circuit transitions to `OPEN`.
* **Automatic Cloud Failover:** When open, all queries automatically bypass the local host and fail over seamlessly to AGY/Cloud.
* **Cooldown & Recovery:** After a 60-second cooldown timeout, the circuit enters `HALF_OPEN` to test local host availability with a trial request before resuming full local routing.

### 4. Telemetry & Live UI Widget
Located at [`src/components/ModelRoutingWidget.tsx`](src/components/ModelRoutingWidget.tsx):
* Visualizes task distribution ratios (e.g. 84% local vs. 16% cloud), live circuit breaker status (`CLOSED`/`OPEN`), active model identifiers, and comparative latency metrics directly on the dashboard.

## 📂 Architecture Overview
```
dashboard/
├── server.js               # Express server entry point & Socket.io handler
├── src/
│   ├── App.tsx             # Main React view layout
│   ├── components/         # UI components (TerminalView, ModelRoutingWidget, etc.)
│   ├── hooks/              # Central state hooks (useDashboardState.ts, useDashboardSocket.ts)
│   ├── backend/            # Domain-driven backend modules
│   │   ├── auth/           # JWT auth and bcrypt hashing
│   │   ├── projects/       # Projects and Git operations
│   │   ├── servers/        # Remote server registry and SSH execution
│   │   ├── agents/         # AI agent configurations and worker management
│   │   ├── llm/            # Model router, complexity scorer & circuit breaker
│   │   ├── llmServers/     # LLM provider configurations
│   │   ├── socket/         # Namespaced WebSocket handlers (dashboard, PTY)
│   │   ├── widgets/        # Custom executor widgets
│   │   └── db.js           # PostgreSQL pool with in-memory fallback
│   └── shared/             # API client, types, and constants
├── tests/                  # Unit and E2E test suites
└── docs/                   # Extended architecture and tutorial documentation
```

## 📚 Documentation
- [AGENTS.md](AGENTS.md) — Contributor rules, agent guidelines, and CodeGraph usage.
- [CLAUDE.md](CLAUDE.md) — Guidance and architecture patterns for Claude Code.
- [DEVELOPER_ONBOARDING.md](DEVELOPER_ONBOARDING.md) — Guide for new developers.
- [DEVELOPER_QUICK_START.md](DEVELOPER_QUICK_START.md) — Command cheat-sheet and workflows.
- [DESIGN.md](DESIGN.md) — System design decisions and data flow.
- [CONTEXT_MANAGEMENT.md](CONTEXT_MANAGEMENT.md) — Context-passing protocol for AI agents.
- [docs/C4_ARCHITECTURE.md](docs/C4_ARCHITECTURE.md) — C4 model architecture diagrams.
- [docs/MCP-SYS-TOOLS.md](docs/MCP-SYS-TOOLS.md) — System tools & infrastructure MCP servers catalog.
- [docs/TUTORIAL_ADD_WIDGET.md](docs/TUTORIAL_ADD_WIDGET.md) — How to add custom executor widgets.
- [agent-ssh-con.md](agent-ssh-con.md) — Remote SSH connection guide.
- [SECURITY.md](SECURITY.md) — Security policy and credential protection.
