# Claude Code Instructions

Refer to [AGENTS.md](AGENTS.md) for core repository guidelines, coding conventions, testing rules, and context pointers.

## Key Subsystem Architectures

### Real-Time Terminal (Socket.io)
- **Bidirectional events:**
  - Client → Server: `spawn_terminal`, `terminal_input`, `terminal_resize`
  - Server → Client: `terminal_data`, `terminal_exit`, `terminal_error`
- **Execution targets:** Remote SSH server, local agent worker (`npm run agent:worker`), or auto-detect.
- **Terminal UI:** `TerminalView.tsx` with Xterm.js and fit addon.

### API Client & Security
- **Client:** `src/shared/api-client/client.ts` with typed HTTP methods and Zod schema validation.
- **Auth:** JWT token stored in `localStorage`, attached via `Authorization: Bearer <token>` in `apiFetch`.
- **Sensitive fields (SSH passwords/keys):** Encrypted via AES-256 (`src/backend/utils/crypto.js`).
