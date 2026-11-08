---
name: db-migrate
description: Run and validate PostgreSQL migrations in scripts/migrate.js
disable-model-invocation: true
---

# Database Migration Skill

Executes and verifies PostgreSQL database migrations for the dashboard project.

## Workflow

1. **Verify Environment**:
   - Ensure `DATABASE_URL` is configured in `.env` (refer to `.env.example`).
   - Confirm PostgreSQL instance is reachable on the specified port.

2. **Inspect Migrations**:
   - Check pending migrations or schema changes defined in `scripts/migrate.js`.

3. **Execute Migration**:
   ```bash
   npm run db:migrate
   ```

4. **Validate Schema**:
   - Check standard tables exist: `users`, `servers`, `projects`, `settings`, `CLI_agents`.
   - Verify connection pool health and log any missing indices or constraints.
