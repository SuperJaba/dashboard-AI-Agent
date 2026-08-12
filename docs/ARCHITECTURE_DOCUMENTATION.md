# Dashboard Architecture Documentation

This document provides comprehensive architecture documentation for the Dashboard application.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Diagrams](#architecture-diagrams)
3. [Component Breakdown](#component-breakdown)
4. [Data Flow](#data-flow)
5. [Security Architecture](#security-architecture)
6. [Deployment Considerations](#deployment-considerations)

---

## System Overview

### High-Level Architecture

The Dashboard is a **full-stack React application** with the following key characteristics:

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT SIDE (React + TypeScript)        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   App.tsx     │  │TerminalView  │  │ LlmServerManager │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
│         │                  │                    │            │
│         └──────────────────┼────────────────────┘            │
│                            ▼                                │
│                 ┌──────────────────┐                        │
│                 │    API Client     │                        │
│                 └────────┬─────────┘                        │
└──────────────────────────┼──────────────────────────────────┘
                           │ HTTPS/REST
                           ▼
┌──────────────────────────┴──────────────────────────────────┐
│                    SERVER SIDE (Node.js + Express)          │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐    │
│  │   Auth      │  │   Projects  │  │   LLM Servers    │    │
│  │  Router     │  │  Router     │  │   Router         │    │
│  └──────┬──────┘  └──────┬──────┘  └────────┬─────────┘    │
│         │                 │                  │              │
│         └─────────────────┼──────────────────┘             │
│                           ▼                               │
│                    ┌───────────────┐                      │
│                    │   PostgreSQL   │                      │
│                    │  (PostgreSQL)  │                      │
│                    └───────────────┘                      │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack Summary

| Layer | Technologies |
|-------|--------------|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS v4 |
| **Backend** | Node.js, Express 5, Socket.io |
| **Database** | PostgreSQL with JSONB support |
| **Styling** | Tailwind CSS v4 + Vanilla CSS |
| **Testing** | Vitest, Playwright, Supertest |
| **Monitoring** | Prometheus, Grafana |

---

## Architecture Diagrams

### C4 Context Diagram

```mermaid
C4Context
    title System Context diagram for Dashboard
    
    Person(user, "User", "Developer/admin using the dashboard.")
    System(dashboard, "Dashboard System", "Manages projects, runs AI agents, monitors metrics.")
    
    System_Ext(llm, "LLM Providers", "External AI models (OpenAI, Anthropic, Ollama)")
    System_Ext(git, "GitHub / Git", "Version control and CI/CD pipelines")
    System_Ext(prometheus, "Prometheus & Grafana", "System monitoring and metrics visualization")
    
    Rel(user, dashboard, "Uses", "HTTPS")
    Rel(dashboard, llm, "Sends prompts to", "REST/HTTPS")
    Rel(dashboard, git, "Reads status and manages", "CLI/SSH")
    Rel(dashboard, prometheus, "Exposes and reads metrics", "HTTP")
```

### C4 Container Diagram

```mermaid
C4Container
    title Container diagram for Dashboard System
    
    Person(user, "User", "A developer or admin using the dashboard.")
    
    System_Boundary(dashboard, "Dashboard System") {
        Container(spa, "Single Page Application", "React, TypeScript, Vite", "Provides the dashboard UI and terminal interface.")
        Container(api, "Backend API", "Node.js, Express", "Handles business logic, auth, and agent coordination.")
        ContainerDb(db, "Database", "PostgreSQL", "Stores projects, servers, agent configurations, and settings.")
        Container(socket, "WebSocket Server", "Socket.io", "Manages real-time terminal sessions and data streams.")
    }
    
    Rel(user, spa, "Visits", "HTTPS")
    Rel(spa, api, "Makes API calls to", "JSON/HTTPS")
    Rel(spa, socket, "Connects to terminal via", "WSS")
    Rel(api, db, "Reads from and writes to", "SQL")
    Rel(socket, api, "Spawns PTY processes via", "Internal")
```

### C4 Component Diagram (Backend API)

```mermaid
C4Component
    title Component diagram for Backend API
    
    ContainerBoundary(api, "Backend API") {
        Component(auth, "Auth Router", "Express Router", "Handles JWT authentication and middleware.")
        Component(projects, "Projects Router", "Express Router", "Manages project CRUD, Git ops, and task analysis.")
        Component(agents, "Agents Router", "Express Router", "Manages AI CLI agents and terminal deployments.")
        Component(servers, "Servers Router", "Express Router", "Handles LLM server configuration management.")
        Component(widgets, "Widgets Router", "Express Router", "Executes shell commands for custom widgets.")
        Component(db_module, "Database Module", "pg Pool", "Handles PostgreSQL connections and queries.")
    }
    
    Rel(projects, db_module, "Uses")
    Rel(agents, db_module, "Uses")
    Rel(auth, db_module, "Uses")
    Rel(servers, db_module, "Uses")
    Rel(widgets, db_module, "Uses")
```

---

## Component Breakdown

### Frontend Components

#### Core Application Components
- **`App.tsx`**: Main application component - manages global state and routing
- **`main.tsx`**: React entry point - renders App with providers
- **`Login.tsx`**: Authentication form with validation

#### Terminal & Agent Management
- **`TerminalView.tsx`**: Interactive terminal with process control, output streaming, and history
- **`AgentsView.tsx`**: AI agent deployment panel with lifecycle management
- **`LlmServerManager.tsx`**: LLM server configuration interface

#### Monitoring & Analytics
- **`ServerStats.tsx`**: Real-time server statistics display with charts
- **`AnalyticsPanel.tsx`**: Usage analytics and metrics visualization
- **`CustomWidgets.tsx`**: Custom widget rendering engine supporting number, text, and chart types

#### Layout Components
- **`TilesView.tsx`**: Dashboard tile grid layout system
- **`ServerStats.tsx`**: Real-time server statistics display

### Backend Modules

#### Authentication Module (`auth/`)
- **`authRouter.js`**: Express routes for login, logout, user info
- **`authRepository.js`**: Database operations for user management
- Implements JWT authentication with bcrypt password hashing

#### Server Management Module (`servers/`)
- **`serversRouter.js`**: CRUD endpoints for LLM servers
- **`serversRepository.js`**: API key management and model configuration
- Handles SSH password encryption using AES-256

#### Project Management Module (`projects/`)
- **`projectsRouter.js`**: Project CRUD with Git integration
- **`projectsRepository.js`**: Branch tracking, task management (JSONB)
- Integrates with GitHub API for project analysis

#### AI Agents Module (`agents/`)
- **`agentsRouter.js`**: Agent deployment endpoints
- **`agentsRepository.js`**: Lifecycle management and activity tracking
- Supports local and remote SSH deployments

#### Widget Management Module (`widgets/`)
- **`widgetsRouter.js`**: Custom widget command execution
- Supports `number`, `text`, and `chart` widget types

---

## Data Flow

### Authentication Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend (Login.tsx)
    participant A as API Client
    participant S as Backend (authRouter.js)
    participant D as Database

    U->>F: Enter credentials
    F->>A: POST /api/auth/login
    A->>S: Forward request
    S->>D: Verify credentials & hash password
    D-->>S: User found/invalid
    S-->>A: JWT token or error
    A-->>F: Response data
    F->>U: Display login success/failure
```

### Project Management Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend (ProjectsView)
    participant A as API Client
    participant S as Backend (projectsRouter.js)
    participant G as Git Service
    participant D as Database

    U->>F: Select/create project
    F->>A: POST /api/projects
    A->>S: Create project request
    S->>G: Fetch project info via Git API
    S->>D: Save project data
    D-->>S: Project saved
    S-->>A: Success response
    A-->>F: Project created
    F->>U: Display project list
```

### LLM Server Configuration Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend (LlmServerManager)
    participant A as API Client
    participant S as Backend (serversRouter.js)
    participant D as Database

    U->>F: Add/edit server
    F->>A: POST /api/servers with config
    A->>S: Save server configuration
    S->>D: Store with encrypted SSH password
    D-->>S: Server saved
    S-->>A: Success
    A-->>F: Server added
```

---

## Security Architecture

### Authentication & Authorization

1. **JWT Tokens**: All authentication uses JWT tokens with expiration
2. **Token Storage**: Tokens stored in `localStorage` (browser-based)
3. **Password Hashing**: bcrypt with salt rounds configured for security
4. **API Protection**: All routes protected by JWT middleware

### Data Security

- **SSH Password Encryption**: AES-256 encryption for remote SSH passwords
- **Environment Variables**: Sensitive data stored in `.env` (never committed)
- **CORS Configuration**: Restricted to specific origins in production

### API Security

- **Rate Limiting**: 100 requests per minute per IP
- **Input Validation**: Request body validation on all endpoints
- **Error Handling**: Generic error responses to prevent information leakage

---

## Deployment Considerations

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Disable source maps in build configuration
- [ ] Configure proper CORS origins
- [ ] Set up HTTPS/TLS certificates
- [ ] Configure production database connection
- [ ] Enable monitoring and logging
- [ ] Set up backup strategy for PostgreSQL

### Environment Variables for Production

```env
NODE_ENV=production
DATABASE_URL=postgres://user:pass@prod-db:5432/dashboard
JWT_SECRET=<strong-production-secret-key>
ENCRYPTION_KEY=<32-character-production-key>
VITE_API_URL=https://api.yourdomain.com
SOCKET_IO_PORT=3001
```

### Scaling Considerations

- **Stateless Backend**: Express API can be scaled horizontally
- **Database Read Replicas**: Use for read-heavy operations
- **CDN for Static Assets**: Serve React bundles via CDN
- **WebSocket Load Balancing**: Required for real-time terminal sessions

---

## Database Schema Overview

### Core Tables

1. **`users`** - User accounts and authentication data
2. **`servers`** - LLM server configurations
3. **`projects`** - Project definitions with Git integration
4. **`agents`** - AI agent deployments
5. **`settings`** - Global dashboard settings
6. **`widgets`** - Custom widget configurations

### Special Features

- **JSONB Support**: Flexible data storage for tasks, metadata
- **Full-Text Search**: Indexing for efficient queries
- **Connection Pooling**: Optimized PostgreSQL connection management

---

**Last Updated**: 2026-08-12  
**Version**: 1.0.0
