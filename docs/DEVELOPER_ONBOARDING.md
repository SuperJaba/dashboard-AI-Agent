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
- Node.js v20+ (v18+ supported)
- PostgreSQL (optional: automatic fallback to in-memory store if offline)
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

### 3. Database Initialization (Optional)
If running a local PostgreSQL instance, initialize or migrate the database:
```bash
npm run migrate
```
*(The migration script automatically creates the database if it does not exist).*

### 4. Launch Development
```bash
npm run dev
```
Starts frontend on `http://localhost:5173` and backend API on `http://localhost:3001`.

## Verification & Testing
Before submitting changes, run:
```bash
npm test            # Run Vitest test suite
npm run test:sys    # Run system diagnostics native test suite
npm run lint        # Check Oxlint & ESLint (0 errors required)
npm run build       # Verify production TypeScript bundle builds cleanly
```

## Contribution & Deployment Workflow
1. Create a feature branch from `dev`: `git checkout -b feat/your-feature-name`.
2. Follow commit conventions: `<type>[optional scope]: <subject>` (Conventional Commits).
3. Ensure all tests and linting pass cleanly.
4. Open a Pull Request targeting `dev`.
5. Once merged into `dev`, promote changes to `master` via PR. Merging into `master` automatically triggers deployment to CT8.pl (see [DEPLOYMENT.md](DEPLOYMENT.md)).
