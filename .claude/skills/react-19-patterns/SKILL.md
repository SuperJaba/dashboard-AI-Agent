---
name: react-19-patterns
description: Idiomatic React 19 conventions for hooks, optimistic updates, and component APIs.
---

# React 19 Patterns & Best Practices

Enforces modern React 19 idioms across the dashboard codebase.

## Core Rules

1. **No `forwardRef`**:
   - In React 19, `ref` is a standard prop. Do not wrap components with `React.forwardRef()`.
   ```tsx
   interface CardProps {
     title: string;
     ref?: React.Ref<HTMLDivElement>;
   }
   export function Card({ title, ref }: CardProps) {
     return <div ref={ref}>{title}</div>;
   }
   ```

2. **Optimistic Updates (`useOptimistic`)**:
   - For immediate UI updates on server state toggles (e.g. starting/stopping an agent or server in `ServerStats.tsx`), use `useOptimistic` to eliminate perceived latency before API response returns.

3. **Action Handling**:
   - Use `useActionState` and async transitions (`startTransition`) for form submissions and state mutations instead of manual `isLoading` boolean state pairs.

4. **Context Consumption**:
   - Use `use(Context)` instead of `useContext(Context)` when convenient, especially within conditional blocks or loops where supported.
