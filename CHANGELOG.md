# Changelog

All significant changes to this project are documented in this file following the [Keep a Changelog](https://keepachangelog.com/pl/1.0.0/) and [Conventional Commits](https://www.conventionalcommits.org/) standards.

## [v0.1.0] - 2026-11-04

### Added
- UI overhaul: dark/light theming using CSS tokens, removal of hard‑coded colors.
- User Management module with role‑based tables, add‑user and password‑reset modals, admin route protection.
- Global Toast notification system built with Framer Motion, hook `useToast`.
- Accessibility improvements (ARIA attributes, WCAG AA contrast) for modals and forms.
- Agent worker reverse‑tunnel documentation and CLI task sync.
- DB fallback and comprehensive connection/auth error handling for CI environments.
- Updated documentation in `AGENTS.md` for SSH daemon detachment, SSE token exception, polymorphic routing.

### Changed
- Refactored theming architecture: switched from hard‑coded hex colors to CSS variables (`var(--text-main)`, `var(--bg-surface)`).
- Unified component styling across Light and Dark modes.
- Consolidated environment variable loading in `src/backend/utils/crypto.js`.

## [Unreleased]

### Added
- (future changes)

### Changed
- (future changes)