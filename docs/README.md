# Dashboard – Project Overview

## Quick‑start

The Dashboard is a single‑page application built with React, Vite and TypeScript that visualises real‑time metrics from our services.

- **Frontend:** React 19 + Vite + TypeScript + Tailwind CSS v4
- **Backend API:** Node.js Express 5 + Socket.io exposing REST endpoints under `/api/*` and real-time terminal streams
- **Auth:** JWT-based authentication middleware in `src/backend/auth/`
- **Database:** PostgreSQL with automatic in-memory fallback

---

## Authentication Flow

The project uses a JWT-based flow. The following endpoints are used for user management:

| Endpoint | Method | Description |
|--------|-------|-------------|
| `POST /api/auth/login` | **Login** <br>Payload: `{ email, password }`<br>Returns access token.<br>`Authorization: Bearer <token>` is required on subsequent requests. |
| `POST /api/auth/register` | **Register** <br>Payload: `{ email, password, name }`<br>Registers a new user and returns JWT token. |
| `GET  /api/auth/me` | **Current User** <br>Requires the bearer token in the header.<br>Responds with user session data. |

*Routes are protected by Express JWT auth middleware (`src/backend/auth/authMiddleware.js`).*

---

## Contributing

- Code style is enforced via ESLint + Prettier.
- All changes must pass `npm test` and include tests where appropriate.
- PRs should target the **main** branch; merge after a successful CI run.

---