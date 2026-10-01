# Developer Onboarding Guide

Welcome to the **Dashboard** project! This guide gets you up and running with your local development environment and introduces core codebase patterns.

## Tech Stack
- **Frontend**: React 19 (TypeScript) + Vite
- **Styling**: Tailwind CSS v4 (`@tailwindcss/postcss`)
- **Backend**: Node.js Express 5 + Socket.io (real-time terminal streaming)
- **Database**: PostgreSQL (with automatic in-memory fallback for offline dev)
- **Architecture**: Domain-driven modules under `src/backend/<domain>/`. See [DESIGN.md](DESIGN.md) and [C4 Architecture](docs/C4_ARCHITECTURE.md).

## Local Setup

### 1. Prerequisites
- Node.js v18+
- PostgreSQL (or rely on in-memory DB fallback for local UI testing)
- Git

### 2. Installation & Environment
```bash
git clone <repository-url>
cd dashboard
npm install
cp .env.example .env
```

Ensure `.env` contains:
```env
DATABASE_URL=postgres://username:password@localhost:5432/dashboard
JWT_SECRET=your_super_secret_jwt_token_key
ENCRYPTION_KEY=32_character_long_secret_key_here
```

### 3. Launch Development
```bash
npm run dev
```
Starts frontend on `http://localhost:5173` and backend API on `http://localhost:3001`.

## Verification & Testing
Before submitting changes, run:
```bash
npm test            # Run Vitest test suite
npm run lint        # Check Oxlint & ESLint (0 errors required)
npm run build       # Verify production TypeScript bundle builds cleanly
```

## First Contribution Workflow
1. Pick an issue or task from [tasks.md](tasks.md).
2. Create a branch: `git checkout -b feature/your-feature-name`.
3. Follow project conventions in [AGENTS.md](AGENTS.md).
4. Run `npm test` and `npm run lint`.
5. Submit PR with a concise description and verification evidence.
