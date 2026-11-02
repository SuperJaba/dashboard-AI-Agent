---
name: a11y-audit
description: Audit dashboard components for WCAG 2.1 AA compliance and keyboard accessibility.
disable-model-invocation: true
---

# Accessibility Audit Skill

Audits React components for WCAG 2.1 AA compliance, ARIA markup, and keyboard operability.

## Checklist

1. **Keyboard Operability**:
   - Verify all interactive elements (buttons, tile cards, tabs) are reachable via `Tab` and activatable via `Enter`/`Space`.
   - Ensure the terminal emulator (`@xterm/xterm`) has a clear focus/escape mechanism so it does not trap focus indefinitely.

2. **Semantic Elements & ARIA**:
   - Check buttons have accessible names (especially icon-only buttons with `aria-label`).
   - Use `role="status"` or `aria-live="polite"` for dynamic server stat changes.

3. **Color Contrast**:
   - Ensure text against dark glass backgrounds (`--bg-surface`) meets 4.5:1 ratio for standard text and 3:1 for large text.

4. **Testing**:
   - Run existing accessibility test suite:
     ```bash
     npx vitest run src/__tests__/a11y.test.tsx
     ```
