# Dashboard – Project Overview

## Quick‑start

The Dashboard is a single‑page application built with React, Vite and TypeScript that visualises real‑time metrics from our services.

- **Frontend:** Next.js (React 18) + TailwindCSS
- **Backend API:** FastAPI (Python) exposing REST endpoints under `/api/*`
- **Auth:** JWT based – see the updated authentication section below

---

## Authentication Flow

The project now uses a JWT‑based flow with an optional refresh token. The following endpoints are used for user management:

| Endpoint | Method | Description |
|--------|-------|-------------|
| `POST /api/auth/login` | **Login** <br>Payload: `{ email, password }`<br>Returns access and refresh tokens.<br>`Authorization: Bearer <access_token>` is required on subsequent requests. |
| `GET  /api/user/me`   | **Current User** <br>Requires the bearer token in the header.<br>Responds with user data (`id`, `name`, `role`). |
| `POST /api/auth/refresh` (optional) | **Refresh Token**<br>Accepts a refresh token and returns a new access token. |

*All routes are protected by the FastAPI dependency that validates the JWT before executing the handler.*

---

## Contributing

- Code style is enforced via ESLint + Prettier.
- All changes must pass `npm test` and include tests where appropriate.
- PRs should target the **main** branch; merge after a successful CI run.

---