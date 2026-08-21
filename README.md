# Dashboard 📊

A full-stack, modern dashboard application built with React, TypeScript, Vite, and Express. This dashboard provides a comprehensive platform for monitoring servers, managing projects, executing AI agents, and real-time terminal interactions.

## 🎯 Features

- **Authentication & Security**: JWT-based authentication with bcrypt password hashing
- **Real-time Terminal**: Interactive terminal shells powered by Socket.io
- **Server Management**: Monitor server statistics and perform remote operations
- **Project Management**: Organize and manage local projects and deployments
- **LLM Integration**: Manage LLM server configurations and API keys
- **Monitoring**: Prometheus metrics and Grafana dashboards for system observability
- **Database**: PostgreSQL-backed persistence for all entities
- **Responsive UI**: Modern, responsive interface with Tailwind CSS and Framer Motion animations
- **Testing**: Comprehensive test suite with Vitest, Playwright, and E2E tests

## 🛠️ Tech Stack

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS v4
- **Backend**: Node.js + Express 5 + Socket.io
- **Database**: PostgreSQL
- **Styling**: Tailwind CSS v4 (postcss-based) + Vanilla CSS with CSS variables
- **Testing**: Vitest, Playwright, Supertest
- **Monitoring**: Prometheus + Grafana
- **State Management**: React hooks (useState)
- **Build Tools**: Vite, TypeScript compiler, Oxlint

## 📦 Quick Start

### Prerequisites
- **Node.js** v18 or higher
- **PostgreSQL** (running locally or remotely configured)
- **npm** or **yarn**

### Installation

1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables (`.env`):
   ```env
   DATABASE_URL=postgres://username:password@localhost:5432/dashboard
   JWT_SECRET=your_super_secret_jwt_token_key
   ENCRYPTION_KEY=32_character_long_secret_key_here
   ```

3. Start development servers:
   ```bash
   npm run dev
   ```
   - Frontend: `http://localhost:5173`
   - Backend API: `http://localhost:3001`

## 📂 Project Structure

```
dashboard/
├── src/
│   ├── App.tsx                 # Main React component
│   ├── main.tsx                # React entry point
│   ├── backend/                # Backend modules
│   │   ├── auth/               # Authentication & JWT
│   │   ├── servers/            # Server management
│   │   ├── projects/           # Project management
│   │   ├── agents/             # AI agent configurations
│   │   ├── llmServers/         # LLM integration
│   │   ├── widgets/            # Custom widgets
│   │   ├── settings/           # Dashboard settings
│   │   ├── git/                # Git operations
│   │   └── db.js               # Database connection
│   ├── components/             # Reusable React components
│   ├── hooks/                  # Custom React hooks
│   └── assets/                 # Static assets
├── server.js                   # Express server entry point
├── public/                     # Public static files
├── tests/                      # End-to-end tests
├── playwright/                 # Playwright test specs
├── grafana/                    # Grafana dashboard configs
└── prometheus/                 # Prometheus configuration
```

## 🚀 Available Scripts

### Development
```bash
npm run dev              # Start frontend + backend concurrently
npm run dev:frontend    # Start Vite frontend only
npm run dev:backend     # Start Express backend only
```

### Building & Production
```bash
npm run build           # Compile TypeScript and bundle with Vite
npm run preview         # Preview production build locally
```

### Testing
```bash
npm test                # Run unit tests once
npm run test:watch      # Run tests in watch mode
npm run test:ui         # Run tests with UI dashboard
npm run test:e2e        # Run end-to-end tests (Python)
npm run autotest        # Run automated AI tests
npm run ci-tdd          # Run CI/TDD bot tests
```

### Database & Linting
```bash
npm run db:migrate      # Run database migrations
npm run lint            # Run Oxlint & ESLint
```

## 🔐 Authentication

The application uses JWT (JSON Web Token) authentication:
- Tokens are generated on login and stored in localStorage
- All API requests automatically include the JWT token via the `apiFetch` wrapper
- Passwords are hashed using bcrypt before storage

## 📊 API Integration

The frontend communicates with the backend via REST APIs. Key endpoints:
- `/api/auth/` - Authentication (login/logout)
- `/api/servers/` - Server management
- `/api/projects/` - Project management
- `/api/agents/` - Agent configurations
- `/api/llmServers/` - LLM server settings
- `/api/widgets/` - Widget parameters

## 🧪 Testing

This project includes comprehensive test coverage:
- **Unit Tests**: Vitest for component and utility testing
- **Integration Tests**: Supertest for API endpoint testing
- **E2E Tests**: Playwright for browser-based testing
- **Python Tests**: Full end-to-end test suite

Run all tests:
```bash
npm test
npm run test:e2e
```

## 🔧 Development Considerations

### Styling & Tailwind CSS v4
The project uses **Tailwind CSS v4** with the new `@tailwindcss/postcss` plugin. Configuration is handled via `postcss.config.js` (no separate tailwind.config.js needed). Tailwind directives are processed through PostCSS during the build process.

### API Key Format
The LLM Server management expects the API key field as **`apiKey`** (camelCase) instead of `api_key`. All forms have been updated to use this format.

### Performance
- Source maps are disabled in production builds
- Chunk sizes are monitored with a 1000 kB limit
- Strict TypeScript checking ensures type safety

### Code Quality
- Oxlint for ESLint-compatible linting
- TypeScript for static type checking
- Regular linting with `npm run lint`

## 📚 Additional Documentation

- [**docs/openapi.yaml**](./docs/openapi.yaml) - OpenAPI 3.0 API Specification
- [**docs/C4_ARCHITECTURE.md**](./docs/C4_ARCHITECTURE.md) - C4 Architecture Diagrams (Mermaid)
- [**docs/TUTORIAL_ADD_WIDGET.md**](./docs/TUTORIAL_ADD_WIDGET.md) - Step-by-step guide for adding new Custom Widgets
- [**DESIGN.md**](./DESIGN.md) - Architecture decisions and design patterns
- [**DEVELOPER_ONBOARDING.md**](./DEVELOPER_ONBOARDING.md) - Detailed onboarding guide for new developers
- [**ARCHITECTURE_VALUE_REPORT.md**](./ARCHITECTURE_VALUE_REPORT.md) - System architecture overview
- [**CONTEXT_MANAGEMENT.md**](./CONTEXT_MANAGEMENT.md) - Context management strategy

## 🐳 Docker & Monitoring

The project includes Docker Compose configurations for:
- PostgreSQL database
- Prometheus metrics collection
- Grafana dashboard visualization

See `docker-compose.yml` for setup details.

## 📝 License

This project is part of the AI-Agents dashboard initiative.

## 🤝 Contributing

Please follow the development workflow described in [DEVELOPER_ONBOARDING.md](./DEVELOPER_ONBOARDING.md).

1. Create a feature branch: `feature/your-feature-name`
2. Ensure tests pass: `npm test`
3. Ensure code builds: `npm run build`
4. Open a Pull Request with clear description
