# Claude Code Instructions

Refer to [AGENTS.md](AGENTS.md) for core repository guidelines, commands, testing rules, CodeGraph, and MemPalace protocols.

## Key Architecture Patterns

### Domain-Driven Backend (`src/backend/<domain>/`)
- Each domain contains its repository and router (e.g., `projectsRepository.js`, `projectsRouter.js`).
- Database access uses `safeQuery()` via shared pool in `src/backend/db.js` with automatic in-memory fallback.
- Express router registration occurs in `server.js`.

### Frontend State Management
- `useDashboardState` (`src/hooks/useDashboardState.ts`) is the single source of truth for dashboard state.
- Components destructure state and handlers from this hook; avoid creating parallel global state.
- UI strings are in Polish across dashboard components.

### Real-Time Terminal (Socket.io)
- **Bidirectional events:**
  - Client → Server: `spawn_terminal`, `terminal_input`, `terminal_resize`
  - Server → Client: `terminal_data`, `terminal_exit`, `terminal_error`
- **Execution targets:** Remote SSH server, local agent worker (`npm run agent:worker`), or auto-detect.
- **Terminal UI:** `TerminalView.tsx` with Xterm.js and fit addon.

### API Client & Security
- Client: `src/shared/api-client/client.ts` with typed HTTP methods and Zod schema validation.
- Auth: JWT token stored in `localStorage`, attached via `Authorization: Bearer <token>` in `apiFetch`.
- Sensitive fields (SSH passwords/keys): Encrypted via AES-256 (`src/backend/utils/crypto.js`).
- Styling: Tailwind CSS v4 using `@tailwindcss/postcss` (no `tailwind.config.js`).
