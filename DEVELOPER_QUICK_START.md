# Developer Quick Start

Rapid reference for common developer commands and workflows. For architectural context and onboarding, see [DEVELOPER_ONBOARDING.md](DEVELOPER_ONBOARDING.md).

## Quick Setup
```bash
git clone <repository-url>
cd dashboard
npm install
cp .env.example .env
npm run dev
```
Frontend runs at `http://localhost:5173`, backend API at `http://localhost:3001`.

## Essential Commands

| Command | Action |
|---|---|
| `npm run dev` | Start frontend and backend concurrently |
| `npm run dev:frontend` | Start Vite frontend only |
| `npm run dev:backend` | Start Express backend only |
| `npm run build` | Build production client bundle |
| `npm run preview` | Serve production build locally |
| `npm test` | Run Vitest unit tests |
| `npm run test:watch` | Run tests in interactive watch mode |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run lint` | Run Oxlint & ESLint checks |
| `npm run db:migrate` | Run database migrations |
| `npm run agent:worker` | Start local agent worker daemon for terminal tasks |

## Environment Variables
Key variables in `.env`:
- `DATABASE_URL`: PostgreSQL connection string (falls back to in-memory if unreachable).
- `JWT_SECRET`: Secret key for signing authentication tokens.
- `ENCRYPTION_KEY`: 32-character key for AES-256 password/credential encryption.
- `VITE_API_URL`: Optional frontend proxy target (defaults to `http://localhost:3001`).

## Adding a Feature

### Backend Domain (`src/backend/<domain>/`)
1. Create `<domain>Repository.js` using `safeQuery` from `../db.js`.
2. Create `<domain>Router.js` with Express router endpoints and auth middleware.
3. Register the router in `server.js`.
4. Add unit test `<domain>.test.js`.

### Frontend Component (`src/components/`)
1. Create component with TypeScript types and Tailwind CSS classes.
2. Hook into `useDashboardState` (`src/hooks/useDashboardState.ts`) for data and actions.
3. Add component test in `tests/` or alongside component.

## Troubleshooting
- **WSL Vitest Worker Timeout**: Run Vitest with `--no-file-parallelism` when operating on `/mnt/`.
- **Port Conflict**: Set `PORT=3002` in `.env` if 3001 is busy, or terminate the conflicting process.
- **Database Unavailable**: The server automatically activates an in-memory storage fallback. Check `DATABASE_URL` in `.env` for production database connection.
