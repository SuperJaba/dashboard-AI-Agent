# 🚀 Developer Onboarding Guide

Welcome to the **Dashboard** project! This guide is designed to get you up and running with your local development environment, introduce you to our codebase architecture, and prepare you for your first contributions.

---

## 🛠️ Tech Stack Overview

Our dashboard is built on a modern, modular stack:
* **Frontend**: React (TypeScript) + Vite
* **Styling**: Tailwind CSS v4 + PostCSS
* **Backend**: Node.js Express API + Socket.io (for real-time terminal shells)
* **Database**: PostgreSQL (relational storage for settings, projects, servers, and widgets)

---

## 🏗️ Codebase Architecture

We recently refactored our backend and frontend monoliths into clean, modular domain directories. Refer to [DESIGN.md](./DESIGN.md) for deep system diagrams. Here is the structure:

```
dashboard/
├── server.js                   # Main Entrypoint / Express Bootstrap
├── src/
│   ├── App.tsx                 # Core UI render layer (Stateless View)
│   ├── hooks/
│   │   └── useDashboardState.ts # Central React hook managing API actions & state
│   ├── backend/                # Domain-Driven Backend modules
│   │   ├── auth/               # User registration and JWT session auth
│   │   ├── settings/           # LLM credentials & dashboard parameters
│   │   ├── projects/           # Local workspaces, analysis, & deployments
│   │   ├── servers/            # Server registries, stats scanning, & devil tools
│   │   ├── widgets/            # Custom executor widget parameters
│   │   ├── agents/             # CLI AI agent tuning and configurations
│   │   ├── git/                # gitService.js encapsulating Git/CLI parser rules
│   │   ├── db.js               # Shared PostgreSQL pg.Pool wrapper
│   │   └── utils/              # Centralized crypto (AES-256) and ssh formatting
```

---

## ⚙️ Development Environment Setup

### 1. Prerequisites
Ensure you have the following installed locally:
* **Node.js** (v18+ recommended)
* **PostgreSQL** (running locally or accessible via configuration)
* **git** & **gh CLI** (GitHub commands)

### 2. Quick Start Configuration
1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```
2. Set up your local environment file (`.env`):
   ```env
   DATABASE_URL=postgres://username:password@localhost:5432/dashboard
   JWT_SECRET=your_super_secret_jwt_token_key
   ENCRYPTION_KEY=32_character_long_secret_key_here
   ```
3. Initialize the database schema and start the developer server:
   ```bash
   npm run dev
   ```
   This command starts the local frontend client on `http://localhost:5173` and boots the Express backend API on port `3001`.

---

## 🧪 Verification & Testing

Before staging any commits, always verify your changes against the compiler and test suites:

* **Verify Code Compiles**:
  ```bash
  npm run build
  ```
* **Run Unit & Integration Tests**:
  ```bash
  npm test
  ```

---

## 📂 Your First Contribution (Day 1-7 Checklist)

- [ ] **Setup**: Fork/Clone this repository and verify `npm test` runs successfully.
- [ ] **Explore**: Connect a mock PostgreSQL database and verify you can log in on the UI.
- [ ] **First Task**: Pick a task from the backlog (or look for the `good first issue` label).
- [ ] **Code**: Create a feature branch: `feature/your-feature-name`.
- [ ] **Verify**: Ensure the build succeeds and tests pass.
- [ ] **PR**: Open a Pull Request targeting the `master` branch. Add a clear description showing the verification steps.
