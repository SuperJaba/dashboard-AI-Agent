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
| `npm run test:watch` | Run tests in watch mode | Interactive debugging |
| `npm run test:ui` | Run tests with Vitest UI | Visual feedback |
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
3. **Coverage target is realistic at ~50-60%** due to large codebase (31,000+ lines); don't aim for 80% which is unattainable without duplicating tests.
4. **Socket.io authentication** uses fallback token `'fallback-super-secret-key-123'` in dev mode – ensure workers are registered via `npm run dev`.
5. **Terminal PTY spawning** requires shell executable (`bash`, `git-bash`) to exist at runtime – test on target OS.
6. **`dist/` directory** is ignored by Vite coverage (see `vite.config.ts` `ignored:` pattern).
7. **Test timeout is 30s** (`vitest.config.ts:37`) – long-running tests may need adjustment.

## Codebase Statistics

### Language Distribution
- **JavaScript**: 53 files, ~7,363 lines (24%)
- **TypeScript/TSX**: 70 files, ~8,693 lines (16% + 11%)
- **HTML/XML**: 17 files, ~6,644 lines (21%)
- **JSON**: 38 files, ~2,407 lines (8%)
- **Bash**: 28 files, ~2,300 lines (7%)
- **YAML**: 13 files, ~363 lines (1%)

### Total Codebase
- **Total Lines of Code**: ~31,167
- **Comment Lines**: ~3,472 (7.6%)
- **File Count**: 323 tracked files

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
6. **Coverage reports** (`coverage/`) are auto-generated and should not be committed.
7. **Claude/Agent skills** in `.hermes/skills/` are configuration files, not tracked in git.

## Useful Commands for Agents

### Code Analysis
```bash
# Quick LOC count (excluding node_modules, dist, etc.)
pygount --folders-to-skip="node_modules,dist,build,coverage" .

# Get file-by-file breakdown
pygount --suffix=ts,tsx,js --folders-to-skip="node_modules,dist" . | sort -t$'\t' -k3 -nr
```

### Testing & Debugging
```bash
# Run tests with coverage report
npm test -- --coverage --reporters=default

# Start dev server in watch mode
npm run dev:backend & npm run dev:frontend

# Preview production build
npm run preview -- --host 0.0.0.0
```

### Git Operations
```bash
# Check git status (untracked files only)
git status --porcelain

# Add specific files to staging
git add <file1> <file2> ...

# Commit with conventional messages
git commit -m "feat(auth): add JWT support"

# Push to origin
git push origin feat/add-comprehensive-tests
```

## Additional Resources
- **CLAUDE.md** – Detailed guidance for Claude Code agent
- **README.md** – Full project documentation and setup instructions
- **.cursorrules** – Cursor editor-specific guidelines (if available)

Feel free to raise questions in the repository discussions or open an issue for clarification.
