# Repository Guidelines

This document provides a quick reference for contributors working on this project.
It covers the folder layout, build and test commands, coding style rules, and how to submit changes.

## Project Structure & Module Organization
- **src/** – Main source code (JavaScript/TypeScript). Backend uses CommonJS (`import` from `./db.js`), frontend uses ES modules (`import` from 'react').
- **tests/** – Unit and integration tests. Test files mirror the structure of `src` and end with `.test.js` or `.spec.ts`. E2E tests in `tests/full_test_suite.js`.
- **assets/** – Static assets such as images, stylesheets, and JSON fixtures.
- **scripts/** – Utility scripts (migrations, workers, test runners).

## Build, Test, and Development Commands
| Command | Purpose | Notes |
|---------|---------|-------|
| `npm install` | Install dependencies | Run once after cloning |
| `npm run dev` | Start frontend + backend concurrently | Runs `vite` and `node server.js` together |
| `npm run dev:frontend` | Start only Vite dev server | Port 5173 by default |
| `npm run dev:backend` | Start only Express backend | Port 3001 by default |
| `npm run build` | Build production frontend | Outputs to `dist/` (React) |
| `npm run lint` | Run ESLint on source files | Excludes `dist/**` |
| `npm test` | Run Vitest tests once | Generates coverage in `coverage/` |
| `npm test:watch` | Run tests in watch mode | Interactive debugging |
| `npm test:ui` | Run tests with Vitest UI | Visual feedback |
| `npm run preview` | Preview production build | Serves `dist/` statically |
| `npm run test:e2e` | Run Playwright E2E tests | Requires `NODE_ENV=test` |
| `npm run db:migrate` | Run database migrations | Via `scripts/migrate.js` |

## Coding Style & Naming Conventions
- **Indentation**: 2 spaces (no tabs).
- **Frontend (TypeScript/JSX)**: camelCase for variables, functions, props. Named exports preferred over default.
- **Backend (Node/CommonJS)**: camelCase for functions, kebab-case for file names (`projectsRepository.js`).
- **Environment variables**: `DB_*`, `JWT_SECRET`, `PORT` – prefixed with service name or purpose.
- **Module naming**: Backend uses `.js` (CommonJS), frontend uses `.tsx`/`.ts` (ES modules).
- **Error handling**: Return JSON `{ error: '...' }` for errors, never throw unhandled exceptions in handlers.

## Testing Guidelines
- Tests use **Vitest** with **jsdom** environment for React components.
- Backend tests use **supertest** for Express routes.
- Test files should be placed alongside the module they test (e.g., `src/backend/projects/` → `tests/backend/projects/`).
- Coverage target: **50%** minimum, aim for **60%** on critical paths. Run `npm test -- --coverage` to view reports.
- Frontend component tests use **@testing-library/react** and **@testing-library/jest-dom**.
- E2E tests use **Playwright** in `tests/full_test_suite.js`.

## Database & Environment Setup
- PostgreSQL database required. Default connection via `server.js`:
  ```
  DB_USER: postgres
  DB_HOST: 127.0.0.1
  DB_NAME: dashboard
  DB_PASSWORD: postgres
  DB_PORT: 5432
  ```
- Environment variables stored in `.env` file (never commit). Required for backend: `JWT_SECRET`, `DB_*`.
- Run `npm run db:migrate` to initialize database tables.

## Pitfalls & Gotchas
1. **Backend uses CommonJS imports** (`from './db.js'`) despite ES module syntax – verify compatibility.
2. **Port 3001** is reserved for backend API; frontend proxies `/api` to it in `vite.config.ts`.
3. **Coverage target is realistic at ~50-60%** due to large codebase (2181 lines); don't aim for 80% which is unattainable without duplicating tests.
4. **Socket.io authentication** uses fallback token `'fallback-super-secret-key-123'` in dev mode – ensure workers are registered via `npm run dev`.
5. **Terminal PTY spawning** requires shell executable (`bash`, `git-bash`) to exist at runtime – test on target OS.
6. **`dist/` directory** is ignored by Vite coverage (see `vite.config.ts` `ignored:` pattern).
7. **Test timeout is 30s** (`vitest.config.ts:37`) – long-running tests may need adjustment.

## Commit & Pull Request Guidelines
- **Commit messages** follow Conventional Commits: `<type>[scope]: <subject>` (e.g., `feat(auth): add JWT support`).
- **PR titles** mirror the first line of the commit message with short description.
- Link related issues with `Closes #<issue-number>`.
- Include screenshots/logs for UI changes or backend behavior modifications.

## Agent-Specific Instructions
Agents operating in this repository must respect these guidelines when creating or modifying files:
1. Do **not** alter existing tests unless the change is intentional and verified.
2. When adding new modules, place them under `src/` and create corresponding test stubs in `tests/`.
3. Keep file names lowercase with hyphens (e.g., `user-profile.ts`, `projectsRepository.js`).
4. Backend modules use `.js` (CommonJS), frontend uses `.tsx`/`.ts` (ES modules).
5. Never commit `.env` or secrets – they're in `.gitignore`.

Feel free to raise questions in the repository discussions or open an issue for clarification.
