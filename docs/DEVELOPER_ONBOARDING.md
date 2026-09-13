# Developer Onboarding Guide

Welcome to the **Dashboard** project! This guide gets you up and running with your local development environment and introduces core conventions.

---

## 🛠️ Tech Stack & Key Characteristics
- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS v4
- **Backend:** Node.js Express 5 + Socket.io (real-time terminal streaming)
- **Database:** PostgreSQL with automatic in-memory fallback
- **Architecture Reference:** [`docs/C4_ARCHITECTURE.md`](docs/C4_ARCHITECTURE.md)

---

## ⚙️ Quick Start Setup

### 1. Prerequisites
- **Node.js** v20+
- **PostgreSQL** (optional: automatic fallback to in-memory store if offline)
- **Git**

### 2. Installation
```bash
# Clone and install dependencies
git clone <repo-url> && cd dashboard
npm install

# Configure environment
cp .env.example .env

# Start dev server (Vite on 5173 + Express API on 3001)
npm run dev
```

---

## 🧪 Verification & Testing

Before creating a commit or PR, verify that all test suites pass:

```bash
npm test            # Run Vitest unit & integration tests
npm run lint        # Run Oxlint / ESLint rules
npm run build       # Verify Vite production bundle compiles
```

---

## 📋 Contribution Workflow

1. Create a feature branch: `git checkout -b feat/your-feature-name`
2. Follow commit conventions: `feat(scope): Subject in imperative mood`
3. Ensure all tests and linting pass cleanly.
4. Open a Pull Request targeting `dev`.
