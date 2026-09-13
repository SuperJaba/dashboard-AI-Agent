# Dashboard 📊

A full-stack, modern dashboard application built with React, TypeScript, Vite, and Express. This dashboard provides a comprehensive platform for monitoring servers, managing projects, executing AI agents, real-time terminal interactions, and LLM server management.

---

## 🎯 Key Features

### **Core Functionality**
- ✅ **Authentication & Security**: JWT-based authentication with bcrypt password hashing
- ✅ **Real-time Terminal**: Interactive terminal shells powered by Socket.io with process control
- ✅ **Server Management**: Monitor server statistics and perform remote operations via SSH
- ✅ **Project Management**: Organize and manage local projects, branches, and tasks (Git integration)
- ✅ **LLM Server Configuration**: Manage LLM server configurations, API keys, and model settings
- ✅ **AI Agents Deployment**: Deploy and manage autonomous AI agents with terminal capabilities
- ✅ **Real-time Monitoring**: Prometheus metrics collection with Grafana visualization
- ✅ **Custom Widgets**: Monitor arbitrary commands and metrics across servers

### **Technical Highlights**
- ✅ **Database Persistence**: PostgreSQL-backed persistence for all entities
- ✅ **Responsive UI**: Modern, responsive interface with Tailwind CSS v4 and Framer Motion animations
- ✅ **Type Safety**: Full TypeScript coverage with strict type checking
- ✅ **Performance Optimized**: Source maps disabled in production, chunk size monitoring
- ✅ **Comprehensive Testing**: Vitest, Playwright E2E tests, and automated AI testing

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19 + TypeScript + Vite + Tailwind CSS v4 |
| **Backend** | Node.js + Express 5 + Socket.io |
| **Database** | PostgreSQL with JSONB support for flexible data storage |
| **Styling** | Tailwind CSS v4 (postcss-based) + Vanilla CSS with CSS variables |
| **Testing** | Vitest, Playwright, Supertest |
| **Monitoring** | Prometheus + Grafana |
| **State Management** | React hooks (useState, useEffect, startTransition) |
| **Build Tools** | Vite, TypeScript compiler, Oxlint |
| **API Client** | Custom fetch wrapper with JWT token injection |

---

## 📦 Quick Start

### Prerequisites
- ✅ **Node.js** v18 or higher
- ✅ **PostgreSQL** (running locally or remotely configured)
- ✅ **npm** or **yarn**

### Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd dashboard
   npm install
   ```

2. **Configure environment variables** (`.env`):
   ```env
   DATABASE_URL=postgres://username:***@localhost:5432/dashboard
   JWT_SECRET=your_super_secret_jwt_token_key
   ENCRYPTION_KEY=32_character_long_secret_key_here
   ```

3. **Start development servers**:
   ```bash
   npm run dev
   ```
   - Frontend: `http://localhost:5173`
   - Backend API: `http://localhost:3001`

### Production Build

```bash
npm run build          # Compile TypeScript and bundle with Vite
npm run preview        # Preview production build locally
```

---

## 📂 Project Structure

```
dashboard/
├── src/
│   ├── App.tsx                          # Main React component
│   ├── main.tsx                         # React entry point
│   ├── backend/                         # Backend modules
│   │   ├── auth/                        # Authentication & JWT
│   │   │   ├── authRouter.js            # Auth endpoints (login, logout)
│   │   │   └── authRepository.js        # Auth data operations
│   │   ├── servers/                     # Server management
│   │   │   ├── serversRouter.js         # Server CRUD endpoints
│   │   │   ├── serversRepository.js     # Server data operations
│   │   ├── projects/                    # Project management
│   │   │   ├── projectsRouter.js        # Project CRUD + Git integration
│   │   │   └── projectsRepository.js    # Project data operations
│   │   ├── agents/                      # AI agent configurations
│   │   │   ├── agentsRouter.js          # Agent deployment endpoints
│   │   │   └── agentsRepository.js      # Agent lifecycle management
│   │   ├── llmServers/                  # LLM integration
│   │   │   ├── serversRouter.js         # LLM server configuration
│   │   │   └── serversRepository.js     # API key & model management
│   │   ├── widgets/                     # Custom widgets
│   │   │   └── widgetsRouter.js         # Widget command execution
│   │   ├── settings/                    # Dashboard settings
│   │   │   └── settingsRouter.js        # Settings CRUD endpoints
│   │   ├── git/                         # Git operations
│   │   │   └── gitService.js            # Git API & local commands
│   │   └── db.js                        # Database connection (pg.Pool)
│   ├── components/                      # Reusable React components
│   │   ├── TerminalView.tsx             # Interactive terminal interface
│   │   ├── LlmServerManager.tsx         # LLM server management UI
│   │   ├── AgentsView.tsx               # AI agents deployment panel
│   │   ├── ServerStats.tsx              # Real-time server statistics
│   │   ├── TilesView.tsx                # Dashboard tile grid layout
│   │   └── CustomWidgets.tsx            # Custom widget rendering
│   ├── hooks/                           # Custom React hooks
│   ├── shared/                          # Shared utilities
│   │   ├── api-client/                  # API client & error handling
│   │   ├── types/                       # TypeScript type definitions
│   │   └── constants/                   # App-wide constants
│   └── assets/                          # Static assets (images, fonts)
├── server.js                            # Express server entry point
├── index.html                           # HTML template
├── package.json                         # Dependencies & scripts
├── tsconfig.json                        # TypeScript configuration
├── vite.config.ts                       # Vite build configuration
├── postcss.config.js                    # PostCSS configuration
├── eslint.config.cjs                    # ESLint configuration
├── .env.example                         # Environment variables template
├── .gitignore                           # Git ignore patterns
├── docker-compose.yml                   # Docker Compose setup
└── tests/                               # Test suites
    ├── frontend/                        # Frontend unit tests (Vitest)
    └── e2e/                             # E2E tests (Playwright)
```

---

## 🚀 Available Scripts

### Development
```bash
npm run dev              # Start frontend + backend concurrently
npm run dev:frontend     # Start Vite frontend only (port 5173)
npm run dev:backend      # Start Express backend only (port 3001)
```

### Building & Production
```bash
npm run build            # Compile TypeScript and bundle with Vite
npm run preview          # Preview production build locally
```

### Testing
```bash
npm test                 # Run unit tests once (Vitest)
npm run test:watch       # Run tests in watch mode
npm run test:ui          # Run tests with UI dashboard
npm run test:e2e         # Run end-to-end tests (Playwright - Python)
npm run autotest         # Run automated AI tests
npm run ci-tdd           # Run CI/TDD bot tests
```

### Database & Quality
```bash
npm run db:migrate       # Run database migrations
npm run lint             # Run Oxlint & ESLint
npm run format           # Format code with Prettier
```

---

## 🔐 Authentication Flow

The application uses **JWT (JSON Web Token)** authentication:

1. **Login**: Users authenticate via `/api/auth/login` endpoint
2. **Token Generation**: JWT token created with bcrypt-hashed password
3. **Token Storage**: Tokens stored in `localStorage` under key `dashboard_token`
4. **API Requests**: All API requests automatically include JWT via `apiFetch` wrapper
5. **Security**: Passwords hashed using bcrypt before storage in PostgreSQL

### Authentication Endpoints
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user info

---

## 📊 API Integration

The frontend communicates with the backend via REST APIs. Key endpoints:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/` | POST, GET | Authentication (login/logout) |
| `/api/servers/` | CRUD | Server management (register, delete, edit) |
| `/api/projects/` | CRUD | Project management with Git integration |
| `/api/agents/` | CRUD | AI agent deployment and lifecycle management |
| `/api/llmServers/` | CRUD | LLM server configuration and API key management |
| `/api/widgets/` | CRUD | Custom widget configuration and command execution |

### API Client Features
- ✅ Generic request function with URL formatting
- ✅ Automatic query parameter handling
- ✅ JWT token injection via `apiFetch` wrapper
- ✅ Strongly typed response handling
- ✅ Comprehensive error handling with `ApiError` class

---

## 🧪 Testing Coverage

This project includes comprehensive test coverage:

### Test Types
- **Unit Tests**: Vitest for component and utility testing
- **Integration Tests**: Supertest for API endpoint testing  
- **E2E Tests**: Playwright for browser-based end-to-end testing
- **Python Tests**: Full end-to-end test suite in `tests/full_test_suite.js`

### Running Tests
```bash
# Run all tests
npm test
npm run test:e2e

# With coverage report
npm test -- --coverage
```

### Test Structure
```
tests/
├── frontend/
│   ├── components/
│   │   ├── TerminalView.test.tsx
│   │   ├── LlmServerManager.test.tsx
│   │   └── App.test.tsx
│   └── utils/
└── e2e/
    └── full_test_suite.js
```

---

## 🔧 Development Considerations

### Styling & Tailwind CSS v4
The project uses **Tailwind CSS v4** with the new `@tailwindcss/postcss` plugin. Configuration is handled via `postcss.config.js`. Tailwind directives are processed through PostCSS during the build process.

### API Key Format
The LLM Server management expects the API key field as **`apiKey`** (camelCase) instead of `api_key`. All forms have been updated to use this format.

### Performance Optimizations
- ✅ Source maps disabled in production builds
- ✅ Chunk sizes monitored with 1000 kB limit
- ✅ Strict TypeScript checking ensures type safety
- ✅ Debounced form inputs and optimized re-renders with `startTransition`

### Code Quality Standards
- ✅ Oxlint for ESLint-compatible linting
- ✅ TypeScript for static type checking
- ✅ Regular linting with `npm run lint`
- ✅ Prettier for code formatting

---

## 📚 Additional Documentation

| Document | Description |
|----------|-------------|
| **[docs/C4_ARCHITECTURE.md](./docs/C4_ARCHITECTURE.md)** | C4 Architecture Diagrams (Mermaid) - System architecture visualization |
| **[docs/TUTORIAL_ADD_WIDGET.md](./docs/TUTORIAL_ADD_WIDGET.md)** | Step-by-step guide for adding new Custom Widgets |
| **[DESIGN.md](./DESIGN.md)** | Architecture decisions and design patterns |
| **[DEVELOPER_ONBOARDING.md](./DEVELOPER_ONBOARDING.md)** | Detailed onboarding guide for new developers |
| **[ARCHITECTURE_VALUE_REPORT.md](./ARCHITECTURE_VALUE_REPORT.md)** | System architecture overview and value proposition |
| **[CONTEXT_MANAGEMENT.md](./CONTEXT_MANAGEMENT.md)** | Context management strategy |
| **[CLAUDE.md](./CLAUDE.md)** | Claude Code integration guide with LM Studio |
| **[AGENTS.md](./AGENTS.md)** | Repository guidelines for contributors |

---

## 🐳 Docker & Monitoring

The project includes Docker Compose configurations for:
- **PostgreSQL** database
- **Prometheus** metrics collection
- **Grafana** dashboard visualization

See `docker-compose.yml` for setup details.

### Prometheus Metrics
Available at `http://localhost:3001/metrics`

---

## 📝 License

This project is part of the AI-Agents dashboard initiative.

---

## 🤝 Contributing

Please follow the development workflow described in [DEVELOPER_ONBOARDING.md](./DEVELOPER_ONBOARDING.md):

1. **Create a feature branch**: `feature/your-feature-name`
2. **Ensure tests pass**: `npm test`
3. **Ensure code builds**: `npm run build`
4. **Open a Pull Request** with clear description
5. **Follow coding standards**: 2-space indentation, camelCase naming

### Code Review Checklist
- ✅ All new features have corresponding tests
- ✅ TypeScript types are properly defined
- ✅ ESLint passes without errors
- ✅ Git integration works correctly (if applicable)
- ✅ LLM server configuration is secure
- ✅ Authentication flow is implemented correctly

---

## 🐛 Known Issues & Limitations

- ⚠️ Some buttons may not have onClick handlers (UI-only decorations)
- ⚠️ Test coverage could be improved for new features
- ⚠️ WebSocket connections require proper server configuration

---

## 📞 Support & Resources

For questions or issues:
- Check [DEVELOPER_ONBOARDING.md](./DEVELOPER_ONBOARDING.md) for setup help
- Review [docs/C4_ARCHITECTURE.md](./docs/C4_ARCHITECTURE.md) for architecture details
- Examine test files for usage examples

---

**Last Updated**: 2026-08-12  
**Version**: 1.0.0  
**Status**: Production Ready ✅
