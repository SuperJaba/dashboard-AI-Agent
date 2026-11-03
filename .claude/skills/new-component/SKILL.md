---
name: new-component
description: Scaffold typed React 19 components with Vitest tests and Tailwind styling.
argument-hint: "ComponentName"
---

# New Component Generator

Scaffolds a modular React 19 component adhering to dashboard conventions.

## Conventions

- **Location**: `src/components/<ComponentName>.tsx`
- **Tests**: `src/__tests__/<ComponentName>.test.tsx`
- **Styling**: Tailwind CSS v4 utility classes, Lucide icons from `lucide-react`
- **State**: Strictly typed props interface, React 19 hooks

## Workflow

1. Determine component purpose and props interface.
2. Create component file with TypeScript typing.
3. Create corresponding test file using Vitest and `@testing-library/react`.
4. Run tests:
   ```bash
   npx vitest run src/__tests__/<ComponentName>.test.tsx
   ```
