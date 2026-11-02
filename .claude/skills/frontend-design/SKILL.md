---
name: frontend-design
description: Design polished React 19 UI components using Tailwind v4 and Framer Motion.
---

# Frontend Design Guidelines

Guidelines for building cohesive, modern UI components in the dashboard.

## Design System & Theme

- **Color Tokens**: Use CSS variables from `src/index.css` (`--bg-surface`, `--bg-surface-hover`, `--glass-border`, `--glass-shadow`, `--text-main`, `--text-muted`).
- **Styling**: Tailwind CSS v4 utility classes. Prefer inline utility classes with glassmorphism effects (`backdrop-blur-md`, subtle borders `border-white/10`).
- **Typography**: Inter for body, Outfit for headers.
- **Icons**: Lucide React (`lucide-react`) exclusively. Keep icon sizes consistent (`w-4 h-4` for compact buttons, `w-5 h-5` for cards).

## Component Structure

1. Keep layout logic separated from data fetching.
2. Ensure empty states and loading skeletons match the glass card theme.
3. Add subtle hover and active feedback (`transition-colors duration-200`, `active:scale-[0.98]`).
