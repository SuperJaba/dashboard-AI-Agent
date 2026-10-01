# Repository Guidelines

## Project Structure
- `src/` – Application source code (React frontend and Express backend domain modules).
- `tests/` – Unit and integration tests (mirroring `src/`, ending with `.test.ts` / `.spec.ts`).
- `assets/` – Static images, styles, and fixtures.

## Commands
| Command | Purpose |
|---|---|
| `npm run dev` | Launch Vite (5173) + Express (3001) concurrently. |
| `npm run build` | Build production client bundle via Vite into `dist/`. |
| `npm test` | Run Vitest test suite. On WSL (`/mnt/`), append `--no-file-parallelism` to avoid thread timeouts. |
| `npm run test:e2e` | Run Playwright end-to-end tests. |
| `npm run lint` | Run ESLint and Oxlint checks (0 errors/warnings required). |

## Code & Naming Conventions
- 2 spaces indentation.
- camelCase for variables, functions, and properties.
- PascalCase for React components and TypeScript types.
- kebab-case for file names (e.g. `user-profile.ts`).
- Named exports preferred over default exports.

## Agent Guidelines
1. **Preserve existing tests**: Update existing tests only when intentionally altering tested behavior.
2. **Module placement**: Place new business logic under `src/backend/<domain>/` or `src/components/`, adding test stubs alongside or in `tests/`.
3. **Pre-commit verification**: Verify changes with `npm test` and `npm run lint` before completing tasks.
4. **Conventional Commits**: Format commit messages as `<type>[optional scope]: <subject>` (e.g., `feat(auth): add JWT support`).

## MemPalace Protocol
- **Search before answering:** Call `mempalace_search` (or `mempalace_kg_query` for relational/temporal facts) for past decisions, bug fixes, or architecture discussions before guessing.
- **Verbatim retrieval:** Quote verbatim drawer content retrieved from the memory palace.
- **Record continuity:** Log significant architectural milestones or fixes with `mempalace_diary_write` or `mempalace_add_drawer`.

<!-- CODEGRAPH_START -->
## CodeGraph
In repositories indexed by CodeGraph (a `.codegraph/` directory exists at root), consult it before grep/find:
- **MCP tool**: `codegraph_explore` answers symbol queries, verbatim source, and call paths in one call.
- **Shell**: `codegraph explore "<symbol names or question>"`.
Skip CodeGraph if `.codegraph/` is absent.
<!-- CODEGRAPH_END -->
