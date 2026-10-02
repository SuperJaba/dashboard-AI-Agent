---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [file-path] | [component-name]
description: Generate complete Vitest/Playwright tests for a specified source file or component.
---

# Generate Tests

Generate test suite for: $ARGUMENTS

## Environment Context
- Framework: Vitest (`vite.config.ts`), Supertest (API), Playwright (E2E)
- Mocks: `vi.fn()`, `vi.mock()`
- Target: If `$ARGUMENTS` is a file path, read it with `@$ARGUMENTS`; if a component name, search with Grep.

## Test Generation Workflow
1. **Analyze Interface**: Identify all exported functions, components, hooks, or endpoints and their signatures.
2. **Setup Isolation**: Mock external I/O (database queries, network fetch, child processes) with isolated mocks.
3. **Unit Tests (AAA Pattern)**:
   - **Arrange**: Set up deterministic inputs and mock return values.
   - **Act**: Invoke the target function, render the component, or execute the HTTP route.
   - **Assert**: Validate outputs, state mutations, and error handling for boundary cases.
4. **Integration Verification**: Ensure test file passes cleanly when executed with `npx vitest run <test-file>`.

## Project-Specific Guidance
- **React Components**: Test with Vitest and React Testing Library (`@testing-library/react`). Verify user interactions, renders, and DOM assertions.
- **Custom Hooks**: Test state transitions and return values with `renderHook` and `act`.
- **Backend API & Middleware**: Test Express endpoints with Vitest using supertest or route handler unit tests with mocked database queries (`safeQuery`).
