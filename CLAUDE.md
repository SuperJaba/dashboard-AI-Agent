# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

### Development & Build
```bash
npm run dev              # Start frontend + backend concurrently (Vite on 5173, Express on 3001)
npm run dev:frontend    # Start Vite frontend only
npm run dev:backend     # Start Express backend only
npm run build           # Build production bundle with Vite
npm run preview         # Preview production build locally
```

### Testing
```bash
npm test                # Run unit tests once (Vitest)
npm run test:watch      # Run tests in watch mode
npm run test:ui         # Run tests with UI dashboard
npm run test:e2e        # Run Playwright E2E tests
```

### Database & Linting
```bash
npm run db:migrate      # Run PostgreSQL migrations
npm run lint            # Run Oxlint/ESLint (no errors expected)
```

### Agent Operations
```bash
npm run agent:worker    # Start local agent worker daemon
```

## Project Structure

```
dashboard/
├── server.js                 # Express API entry point with Socket.io for real-time terminal
├── src/
│   ├── App.tsx               # Main React component (dashboard layout + project/server views)
│   ├── main.tsx              # React entry point
│   ├── hooks/
│   │   └── useDashboardState.ts  # Central state management hook for all dashboard data
│   ├── backend/              # Backend domain modules (all in src/backend/)
│   │   ├── auth/             # JWT authentication, user registration/login
│   │   ├── db.js             # PostgreSQL pool with in-memory fallback
│   │   ├── projects/         # Project management, analysis, deployments
│   │   ├── servers/          # Server registry, stats scanning, devil tools integration
│   │   ├── agents/           # CLI agent configurations, background worker daemon
│   │   ├── widgets/          # Custom executor widget parameters
│   │   ├── settings/         # LLM credentials & dashboard parameters (encrypted)
│   │   ├── git/              # Git operations service
│   │   ├── llmServers/       # LLM server management
│   │   └── utils/            # Crypto utilities, SSH formatting
│   ├── components/           # Reusable React components
│   ├── TerminalView.tsx      # Draggable/resizable terminal with Socket.io real-time data
│   ├── AnalyticsPanel.tsx    # Project statistics dashboard
│   ├── AgentsView.tsx        # CLI agent management interface
│   ├── TilesView.tsx         # Dashboard grid view for projects
│   └── shared/
│       ├── api-client/       # Generic API client with JWT auth, Zod schemas
│       └── config.ts         # API configuration
├── public/                   # Static assets
├── tests/                    # Playwright E2E test suite
├── playwright/               # Playwright test specs
└── docs/                     # Architecture & tutorial documentation
```

## Key Patterns

### Domain-Driven Backend Modules
The backend uses a modular architecture with each domain having its own repository file in `src/backend/{domain}/`. All modules use the shared PostgreSQL pool from `src/backend/db.js` with automatic fallback to in-memory storage.

**Pattern:** Each module exports:
- Repository functions (get, create, update, delete)
- Router integration in respective `*Router.js` files
- Database operations via `safeQuery()` wrapper for type safety

### API Client & Authentication
- **Generic client:** `src/shared/api-client/client.ts` provides typed HTTP methods (get, post, put, patch, delete) with automatic error handling
- **JWT auth:** Token stored in localStorage, auto-injected via `apiFetch` wrapper on all requests
- **Schemas:** Zod schemas in `schemas.ts` for validation of API responses

### State Management
- **Centralized hook:** `useDashboardState()` in `src/hooks/useDashboardState.ts` manages all application state
- All components import and destructure from this single hook
- State includes: projects, servers, agents, terminal configs, LLM settings, task management

### Real-time Terminal (Socket.io)
The terminal uses Socket.io for bidirectional communication:
- **Client → Server:** `spawn_terminal`, `terminal_input`, `terminal_resize` events
- **Server → Client:** `terminal_data`, `terminal_exit`, `terminal_error` events
- **Worker support:** Local agent workers registered via WebSocket handshake, can handle terminal sessions

### Terminal Implementation
`TerminalView.tsx` uses:
- **Xterm.js** for terminal emulation with fit addon
- **Draggable/resizeable** floating panel
- **Execution target selection:** remote server, local worker, or auto-detect
- Socket.io connection with JWT auth from localStorage

## How to Navigate & Find Specific Functionality

### Finding API Endpoints
1. Check `server.js` for Express route definitions (lines ~295-320)
2. Each module has a router: `src/backend/{domain}/*Router.js`
3. OpenAPI spec at `docs/openapi.yaml`

### Database Operations
- All DB operations go through `src/backend/db.js` → `safeQuery()` wrapper
- Repository functions in each domain folder use the pool from db.js
- Migration function: `migrate()` in db.js

### Components & Props
- **App.tsx:** Main layout with sidebar navigation + project/server views
- **TerminalView:** Config object with command, args, cwd, env; onClose callback
- **useDashboardState:** All state variables exported from this hook

## Testing Files
- **Unit tests:** Vitest config in `vite.config.ts` (lines 25-38)
- **E2E tests:** `tests/full_test_suite.js` runs Playwright suite
- **Integration tests:** Supertest for API endpoints via CI workflow

## CodeGraph Usage
This repo has a `.codegraph/` directory. Use:
```bash
codegraph explore "<symbol names or question>"
```
or the MCP tool `codegraph_explore` to get verbatim source + call paths before reading files.

## Important Notes

- **Language:** UI labels are in Polish (Polish strings throughout components)
- **Tailwind v4:** Uses new `@tailwindcss/postcss` plugin, no separate tailwind.config.js
- **Database fallback:** PostgreSQL unavailable → automatic in-memory store activation
- **SSH encryption:** Passwords encrypted with AES-256 via `src/backend/utils/crypto.js`
- **Devil CLI:** Optional server execution target using devil CLI for remote commands
## Context Pointers (Disclosed Reference)
Consult these documents on demand when working on specific subsystems:
- **API Spec & Route Definitions**: [`docs/openapi.yaml`](docs/openapi.yaml) or [`docs/API_DOCUMENTATION.md`](docs/API_DOCUMENTATION.md)
- **C4 Architecture & System Boundaries**: [`docs/C4_ARCHITECTURE.md`](docs/C4_ARCHITECTURE.md)
- **Widget Creation & Registration**: [`docs/TUTORIAL_ADD_WIDGET.md`](docs/TUTORIAL_ADD_WIDGET.md)
- **Automated SSH & Remote Execution**: [`agent-ssh-con.md`](agent-ssh-con.md)

## MemPalace Protocol
- **Search-Before-Answer:** Always check the memory palace (`mempalace_search` / `mempalace_kg_query`) when asked about past sessions, decisions, architectural choices, or previous bug resolutions before guessing.
- **Verbatim Recall:** Maintain high fidelity by quoting verbatim drawer contents retrieved from MemPalace.
- **Session Continuity:** Record notable architectural updates and fixes via MemPalace tools (`mempalace_diary_write`).
