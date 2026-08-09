# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands
- **Install dependencies**: `npm install`
- **Run development servers**: `npm run dev` (frontend + backend)
  - `npm run dev:frontend` – Vite only
  - `npm run dev:backend` – Express only
- **Build for production**: `npm run build`
- **Preview production bundle**: `npm run preview`
- **Run tests**:
  - Unit & integration: `npm test`
  - Watch mode: `npm run test:watch`
  - UI tests: `npm run test:ui`
  - End‑to‑end (Python): `npm run test:e2e`
  - AI autotests: `npm run autotest`
- **Database migrations**: `npm run db:migrate`
- **Linting**: `npm run lint` (Oxlint + ESLint)

## High‑Level Architecture
The project is a full‑stack dashboard built with React, TypeScript, Vite on the frontend and Express 5 with Socket.io for real‑time interactions. A PostgreSQL database stores all persistent data.
- **Frontend**: `src/App.tsx` orchestrates routing; entry point `src/main.tsx`. UI components live under `src/components/`; reusable hooks in `src/hooks/`; static assets in `src/assets/`.
- **Backend API**: `server.js` starts the Express server. All routes are prefixed with `/api/*` and implemented in modules under `src/backend/`: authentication (`auth/`), servers, projects, agents, LLM integrations, widgets, settings, git utilities, and database access via `db.js`.
- **Real‑time terminal**: Socket.io is used to expose an interactive shell; the frontend connects through a dedicated component.
- **Testing**: Vitest for unit tests, Supertest for API integration, Playwright for browser E2E, plus Python scripts in `tests/`.

## Development Notes
- Environment variables are defined in `.env`; key ones include `DATABASE_URL`, `JWT_SECRET`, and `ENCRYPTION_KEY`.
- Tailwind CSS v4 is configured via PostCSS; no separate tailwind.config.js.
- LLM API keys must be supplied as the camelCase field `apiKey`.

## Scripts Reference (from package.json)
```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:frontend\" \"npm run dev:backend\"",
    "dev:frontend": "vite --config vite.config.ts",
    "dev:backend": "node server.js",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest watch",
    "lint": "oxlint . --config oxlint.json"
  }
}
```

## Key Files to Inspect for Architecture Understanding
- `src/backend/auth/` – JWT and bcrypt logic.
- `src/backend/agents/` – AI agent configuration and execution flow.
- `src/backend/llmServers/` – LLM integration handling API keys.
- `src/components/TerminalShell.tsx` – Socket.io client for terminal.

---
**Note:** This CLAUDE.md is intended to give Claude Code a quick overview of the project's structure and common commands. It avoids redundant details that can be discovered by browsing files directly.