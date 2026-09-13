# Repository Guidelines

This document provides a quick reference for contributors working on this project.
It covers the folder layout, build and test commands, coding style rules, and how to submit changes.

## Project Structure & Module Organization
- **src/** – Main source code (JavaScript/TypeScript).
- **tests/** – Unit and integration tests. Test files mirror the structure of `src` and end with `.test.js` or `.spec.ts`.
- **assets/** – Static assets such as images, stylesheets, and JSON fixtures.
  
## Build, Test, and Development Commands
| Command | Purpose |
|---------|---------|
| Command | Purpose |
|---------|---------|
| `npm install` | Install dependencies. |
| `npm run dev` | Launch development server (Vite on 5173 + Express on 3001). |
| `npm run build` | Build client bundle via Vite (outputs to `dist/`). |
| `npm test` | Run the Vitest test suite. |
| `npm run test:e2e` | Run Playwright end-to-end tests. |
| `npm run lint` | Run ESLint and Oxlint checks. |

## Coding Style & Naming Conventions
- Indent with **2 spaces** (no tabs).
- Use **camelCase** for variables, functions, and props.
- Export modules using named exports; default exports are avoided unless a single primary value is exported.
- Run `npm run lint` to check ESLint/Oxlint rules.

## Testing Guidelines
- Tests use **Vitest** for unit/component tests and **Playwright** for E2E tests.
- Test files reside alongside modules or in `tests/` and mirror the structure of `src`.
- Ensure all tests pass before submitting changes (`npm test`).

## Commit & Pull Request Guidelines
- **Commit messages** follow the Conventional Commits format: `<type>[optional scope]: <subject>` (e.g., `feat(auth): add JWT support`).
- PR titles should mirror the first line of the commit message and include a short description. 
- Link any related issue with `Closes #<issue-number>`. Include screenshots or logs if UI changes are made.
  
## Agent‑Specific Instructions
Agents operating in this repository must respect these guidelines when creating or modifying files:
1. Do **not** alter existing tests unless the change is intentional.
2. When adding new modules, place them under `src/` and create corresponding test stubs.
3. Keep file names lowercase with hyphens (e.g., `user-profile.ts`).

## MemPalace Protocol
This repository leverages MemPalace for long-term project memory and cross-session knowledge continuity:
- **Search before answering:** When inquiring about past decisions, previous bugs/fixes, architecture discussions, or user preferences, call `mempalace_search` (or `mempalace_kg_query` for relational/temporal facts) before guessing.
- **Verbatim retrieval:** Quote verbatim drawer content retrieved from the memory palace rather than hallucinating or summarizing lossily.
- **Record continuity:** Significant architectural milestones, tricky bug fixes, or key setup decisions should be logged or updated in MemPalace (`mempalace_diary_write`, `mempalace_add_drawer`, or KG updates).

Feel free to raise questions in the repository discussions or open an issue for clarification.

<!-- CODEGRAPH_START -->
## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tool** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them, including dynamic-dispatch hops grep can't follow. Name a file or symbol in the query to read its current line-numbered source. If it's listed but deferred, load it by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` prints the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
<!-- CODEGRAPH_END -->
