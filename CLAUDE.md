# Claude Code Instructions

Refer to [AGENTS.md](AGENTS.md) for core repository guidelines, coding conventions, testing rules, CodeGraph usage, and context pointers.

<!-- CODEGRAPH_START -->
## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tool** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them, including dynamic-dispatch hops grep can't follow. Name a file or symbol in the query to read its current line-numbered source. If it's listed but deferred, load it by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` prints the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
<!-- CODEGRAPH_END -->

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
