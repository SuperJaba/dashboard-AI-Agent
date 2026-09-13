# Repository Guidelines

This document provides a quick reference for contributors working on this project.
It covers the folder layout, build and test commands, coding style rules, and how to submit changes.

## Project Structure & Module Organization
- **src/** – Main source code (JavaScript/TypeScript).
- **tests/** – Unit and integration tests. Test files mirror the structure of `src` and end with `.test.js` or `.spec.ts`.
- **assets/** – Static assets such as images, stylesheets, and JSON fixtures.
  
## Key Environment Gotchas
- **UI Language:** Labels and messages in UI components are in Polish.
- **Database Fallback:** `src/backend/db.js` automatically falls back to an in-memory store if PostgreSQL is unavailable.
- **Port Mapping:** Development uses Vite on port 5173 (proxies API requests) and Express API on port 3001.
- **Styling:** Uses Tailwind CSS v4 via `@tailwindcss/postcss` (no `tailwind.config.js`).

## Context Pointers (Disclosed Reference)
Consult these references on demand when handling specific subsystem tasks:
- **API Spec & Route Definitions**: [`docs/openapi.yaml`](docs/openapi.yaml) or [`docs/API_DOCUMENTATION.md`](docs/API_DOCUMENTATION.md)
- **C4 Architecture & Service Boundaries**: [`docs/C4_ARCHITECTURE.md`](docs/C4_ARCHITECTURE.md)
- **Widget Creation & Registration**: [`docs/TUTORIAL_ADD_WIDGET.md`](docs/TUTORIAL_ADD_WIDGET.md)
- **Automated SSH & Remote Execution**: [`docs/agent-ssh-con.md`](docs/agent-ssh-con.md)


## Coding & Architectural Conventions
- Indent with **2 spaces** (no tabs).
- Use **camelCase** for variables, functions, and props; name files in **kebab-case** (e.g. `user-profile.ts`).
- Prefer **named exports** over default exports.
- **Backend Architecture:** Follow the domain repository pattern in `src/backend/{domain}/` using the `safeQuery()` wrapper.
- **Central State:** State is centralized in `src/hooks/useDashboardState.ts`.

## Testing & Verification
- Unit & component tests: Vitest (`npm test`).
- End-to-end tests: Playwright (`npm run test:e2e`).
- Preserve existing test suites; author new test stubs alongside new or modified modules in `src/` or `tests/`.
- Ensure all tests and linter (`npm run lint`) pass cleanly before concluding tasks.

## Commit Guidelines
- Follow Conventional Commits: `<type>[optional scope]: <subject>` (e.g., `feat(auth): add JWT support`).

<!-- CODEGRAPH_START -->
## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tool** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them, including dynamic-dispatch hops grep can't follow. Name a file or symbol in the query to read its current line-numbered source. If it's listed but deferred, load it by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` prints the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
<!-- CODEGRAPH_END -->
