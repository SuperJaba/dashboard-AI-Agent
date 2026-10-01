# Dashboard 📊

A modern, full-stack dashboard for orchestrating local and remote AI developer agents, managing servers via SSH, tracking project tasks, executing real-time terminal sessions, and configuring LLM backends.

## 🎯 Key Capabilities
- **AI Agent Orchestration**: Deploy and monitor autonomous agents (Antigravity, Claude Code, Aider) locally or remotely with hybrid execution target switching.
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
JWT_SECRET=your_super_secret_jwt_token_key
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

## 📂 Architecture Overview
```
dashboard/
├── server.js               # Express server entry point & Socket.io handler
├── src/
│   ├── App.tsx             # Main React view layout
│   ├── components/         # UI components (TerminalView, AgentsView, etc.)
│   ├── hooks/              # Central state hook (useDashboardState.ts)
│   ├── backend/            # Domain-driven backend modules
│   │   ├── auth/           # JWT auth and bcrypt hashing
│   │   ├── projects/       # Projects and Git operations
│   │   ├── servers/        # Remote server registry and SSH execution
│   │   ├── agents/         # AI agent configurations and worker management
│   │   ├── llmServers/     # LLM provider configurations
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
