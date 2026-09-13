# Developer Quick Start Guide

This guide provides a quick overview of how to get started with the Dashboard application as a developer.

---

## Prerequisites Checklist

Before starting development, ensure you have:

- ✅ **Node.js** v18+ installed (`node --version`)
- ✅ **npm** or **yarn** package manager
- ✅ **PostgreSQL** database running locally or via Docker
- ✅ **Git** for version control
- ✅ Basic understanding of React, TypeScript, and Node.js

---

## 1. Clone Repository

```bash
git clone <repository-url>
cd dashboard
```

---

## 2. Install Dependencies

```bash
npm install
```

This will install all frontend (React/TypeScript), backend (Node/Express), and testing dependencies.

---

## 3. Configure Environment Variables

### Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

### Required Environment Variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgres://user:pass@localhost:5432/dashboard` |
| `JWT_SECRET` | Secret key for JWT token generation | `your-super-secret-jwt-key-12345` |
| `ENCRYPTION_KEY` | 32-character key for password encryption | `abcdefghijklmnopqrstuvwxyz123456` |

### Optional Environment Variables:

```env
# Development mode (allows hot-reloading)
NODE_ENV=development

# API proxy settings
VITE_API_URL=http://localhost:3001

# Socket.io configuration
SOCKET_IO_PORT=3001
```

---

## 4. Set Up Database

### Option A: Using PostgreSQL directly

Create the database manually:

```sql
CREATE DATABASE dashboard;
-- Then update DATABASE_URL in .env
```

### Option B: Using Docker Compose

```bash
docker-compose up -d postgres
```

The database will be initialized automatically on first run.

### Run Database Migrations:

```bash
npm run db:migrate
```

This creates all necessary tables and seed data.

---

## 5. Start Development Servers

### Option A: Both servers concurrently (recommended)

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3001`

### Option B: Separate servers

**Frontend only:**
```bash
npm run dev:frontend
```

**Backend only:**
```bash
npm run dev:backend
```

---

## 6. Test the Application

1. **Open browser**: Navigate to `http://localhost:5173`
2. **Login**: Use test credentials (check `tests/` folder for sample data)
3. **Explore**: Try adding servers, projects, and agents

---

## 7. Development Workflow

### Creating a New Feature

1. **Create feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Write tests first** (TDD):
   ```bash
   npm run test:watch
   ```

3. **Implement the feature**:
   - Update backend routes (`src/backend/*/router.js`)
   - Add frontend components (`src/frontend/*`)
   - Update API client if needed (`src/shared/api-client/client.ts`)

4. **Run tests**:
   ```bash
   npm test
   npm run lint
   ```

5. **Build to verify**:
   ```bash
   npm run build
   ```

6. **Commit and push**:
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   git push origin feature/your-feature-name
   ```

7. **Open Pull Request** with detailed description

### Code Standards

- **Indentation**: 2 spaces (no tabs)
- **Naming**: camelCase for variables/functions, PascalCase for components/types
- **File naming**: kebab-case (e.g., `my-feature.tsx`)
- **Comments**: JSDoc style for functions and components

---

## Common Development Tasks

### Adding a New API Endpoint

1. Create route file: `src/backend/feature/route.js`
2. Add endpoint to Express server in `server.js`
3. Implement logic in repository file
4. Test with Postman or browser

### Creating a New Component

1. Create file: `src/components/FeatureName.tsx`
2. Define component with TypeScript types
3. Add to main App component (or route)
4. Style with Tailwind CSS classes

### Adding Database Tables

1. Update schema in `server.js` initDB() function
2. Run migrations: `npm run db:migrate`
3. Test with pgAdmin or psql

---

## Debugging Tips

### Backend Debugging

```bash
# Enable verbose logging
NODE_ENV=development npm run dev:backend

# Check logs in terminal
tail -f /path/to/server.log
```

### Frontend Debugging

- **React DevTools**: Install browser extension
- **Console errors**: Open DevTools (F12) → Console tab
- **Network requests**: DevTools → Network tab to see API calls

### Database Debugging

```bash
# Connect to database
psql postgres://user:pass@localhost:5432/dashboard

# Query specific table
SELECT * FROM projects;
```

---

## Useful Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both servers |
| `npm run build` | Build production version |
| `npm test` | Run unit tests |
| `npm run lint` | Check code quality |
| `npm run db:migrate` | Run database migrations |
| `npm run preview` | Preview production build |

---

## Troubleshooting

### Common Issues

**Issue**: "Cannot find module 'react'"
- **Solution**: `npm install` in project root

**Issue**: Port already in use
- **Solution**: Change port in `.env` or kill process: `kill -9 <PID>`

**Issue**: Database connection failed
- **Solution**: Check PostgreSQL is running, verify DATABASE_URL in `.env`

**Issue**: TypeScript errors on build
- **Solution**: Run `npm run lint` to check for errors, fix them before building

---

## Resources

- **React Documentation**: https://react.dev
- **TypeScript Handbook**: https://www.typescriptlang.org/docs/
- **Express.js Guide**: https://expressjs.com/en/guide/routing.html
- **Tailwind CSS**: https://tailwindcss.com/docs

---

**Last Updated**: 2026-08-12  
**Version**: 1.0.0
