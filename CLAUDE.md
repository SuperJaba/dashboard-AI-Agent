# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Commonly Used Commands

### Development & Build
- `npm run dev` - Start both frontend (Vite) and backend (Express) concurrently
- `npm run dev:frontend` - Run Vite dev server only
- `npm run dev:backend` - Run Express server only
- `npm run build` - Build production-ready frontend bundle
- `npm run lint` - Run Oxlint/ESLint on all source files
- `npm test` - Run Vitest unit tests (once)
- `npm run test:watch` - Run Vitest with watch mode
- `npm run test:ui` - Run Vitest with UI for visual debugging
- `npm run preview` - Preview production build from dist folder

### Database & Migration
- `npm run db:migrate` - Run PostgreSQL migrations
- Backend uses `src/backend/db.js` with automatic migration on startup
- In-memory fallback available if PostgreSQL unavailable

### Testing
- Unit tests: Vitest (Vitest + React Testing Library for components)
- Integration tests: Supertest covers all API endpoints
- E2E tests: Playwright (`npm run test:e2e`)
- CI pipeline: `npm run ci-tdd` (continuous integration with TDD bot)

### Git & Agents
- Initialize git in project directory: `npm run agent:worker` (local agent worker)
- Autotest script: `npm run autotest`
- Backend modules are organized by feature (auth, servers, projects, agents, etc.)

---

## High-Level Architecture

### Monorepo Structure
This is a **single unified monorepo** with frontend and backend sharing the same repository. Key characteristics:

- **Frontend**: React 19 + TypeScript + Vite, using Tailwind CSS v4
- **Backend**: Node.js + Express 5, Socket.io for real-time terminal shells
- **Database**: PostgreSQL with connection pooling via `pg.Pool`
- **Authentication**: JWT tokens stored in localStorage, passwords hashed with bcrypt

### Project Structure Overview

```
dashboard/
├── src/
│   ├── App.tsx                    # Main application component
│   ├── backend/                   # Express server and API routes
│   │   ├── auth/                  # Authentication endpoints (/login, /logout)
│   │   ├── servers/               # LLM server management (unsloth/AtomicChat)
│   │   ├── projects/              # Project CRUD operations
│   │   ├── agents/                # AI agent deployment & configuration
│   │   ├── settings/              # App-wide settings storage
│   │   ├── git/                   # Git integration for project analysis
│   │   └── db.js                  # Database connection pool + migrations
│   ├── frontend/                  # React components and views
│   ├── shared/                    # Shared utilities, API client, schemas
│   └── hooks/                     # Custom React hooks (useDashboardState)
├── package.json                   # Dependencies & npm scripts
└── README.md                      # Full project documentation
```

### Data Flow & Communication

1. **Frontend → Backend**: 
   - API calls via `apiClient` wrapper (attached JWT token to requests)
   - Uses Zod schemas for request validation (`src/shared/api-client/schemas`)

2. **Backend ↔ Database**:
   - PostgreSQL queries via `pool.query()` in `src/backend/db.js`
   - Repository pattern: each feature has a `*Repository.js` file

3. **Real-time Updates**:
   - Socket.io for live terminal shell updates and agent deployments
   - Frontend listens to socket events for dynamic UI updates

### Key Components

#### Backend (Express Server)
- **AuthRouter** (`src/backend/auth/authRouter.js`): JWT-based authentication with `/setup`, `/login`, `/check-setup`, `/refresh`, `/reset` endpoints
- **ServerRepository** (`src/backend/servers/serversRepository.js`): Manages LLM server configurations (host, model, API key), encrypts SSH passwords
- **ProjectRepository** (`src/backend/projects/projectsRepository.js`): CRUD operations for local project folders, tracks completion %, technology stack
- **AgentDeployment**: Supports both local worker and remote server deployment with SSH tunneling

#### Frontend (React)
- **useDashboardState** (`src/hooks/useDashboardState.ts`): Central state management hook handling projects, servers, agents, terminal configuration, task management
- **Terminal View**: Custom browser-based terminal using xterm.js for remote shell sessions
- **Settings Management**: Stores LLM server URL, API key, model name in database

### Database Schema (PostgreSQL)

#### `servers` table
```sql
id SERIAL PRIMARY KEY,
name VARCHAR(255),
host VARCHAR(255),
username VARCHAR(255),
port INTEGER DEFAULT 22,
provider VARCHAR(255) DEFAULT 'local',
url VARCHAR(512),
model VARCHAR(255),
api_key TEXT,
use_devil BOOLEAN DEFAULT false,
ssh_password TEXT (encrypted),
created_at TIMESTAMP,
updated_at TIMESTAMP
```

#### `projects` table
```sql
id SERIAL PRIMARY KEY,
name VARCHAR(255),
desc TEXT,
path VARCHAR(512),
branch VARCHAR(255) DEFAULT 'main',
tech VARCHAR(255),
complete INTEGER,
tasks JSONB (array of task objects),
created_at TIMESTAMP,
updated_at TIMESTAMP
```

#### `settings` table
```sql
key VARCHAR(255),
value TEXT
```

### LLM Server Configuration
- **Default**: AtomicChat server (unsloth/AtomicChat) at `http://127.0.0.1:1337/v1`
- **Custom LLM servers**: Users can add remote servers with API endpoints
- **Models**: Supports multiple models via Unsloth Zoo and Unsloth libraries

### Testing Strategy
- **Unit tests**: Component logic, utility functions, hooks (Vitest)
- **Integration tests**: API endpoint coverage with Supertest
- **E2E tests**: Full UI flows including agent deployment and terminal interaction (Playwright)

---

## Important Notes

1. **Environment Variables**: All secrets stored in `.env` file, never committed
2. **API Key Format**: Backend expects camelCase `apiKey` field in settings
3. **Terminal Mode**: Browser-based terminal toggle persists to localStorage
4. **Git Integration**: Projects can be analyzed for tasks via Git (`/api/init-git`, `/api/analyze`)
5. **SSH Setup**: Remote server deployment requires SSH key setup via `/api/servers/:id/setup-ssh`
