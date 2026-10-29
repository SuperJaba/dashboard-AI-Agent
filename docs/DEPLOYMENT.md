# Deployment to CT8.pl

Deploy target and automated delivery pipeline for the Dashboard application.

## Target Environment

| Parameter | Value |
| :--- | :--- |
| **Host** | `s1.ct8.pl` (port 22) |
| **User** | `jagger2` |
| **Domain** | `dashboard.jagger2.ct8.pl` |
| **App Path** | `domains/dashboard.jagger2.ct8.pl/public_nodejs` |
| **Public Assets** | `domains/dashboard.jagger2.ct8.pl/public_nodejs/public` |
| **Runtime** | Node.js 22+ under Phusion Passenger (managed by CT8) |
| **Process Control** | `touch tmp/restart.txt` triggers Passenger reload |

## Authentication Resolution

Deployment scripts evaluate credentials in the following order:

1. `CT8_PASSWORD` environment variable (used by GitHub Actions CI/CD).
2. SSH Key (`$SSH_KEY` or `~/.ssh/id_ed25519_antigravity`, `~/.ssh/*antigravity*`).
3. Local file: `docs/pass.txt` (gitignored).
4. Sibling workspace fallback: `../invoice-splitter/docs/pass.txt`.

## Deployment Scripts

- **Optimized Deploy (CI & Manual)**: [`scripts/deploy-ct8-optimized.sh`](../scripts/deploy-ct8-optimized.sh)
  - Packages and uploads production backend files.
  - Skips redundant remote builds when `SKIP_FRONTEND_BUILD="true"` and pre-built `dist/` is present.
  - Generates `.env.production` on remote host if missing.
  - Runs database migrations via `scripts/migrate.js`.
  - Touches `tmp/restart.txt` and performs health check on `https://dashboard.jagger2.ct8.pl/health`.
- **Legacy Deploy**: [`scripts/deploy-dashboard.sh`](../scripts/deploy-dashboard.sh)
  - Full synchronous deploy script.

### Manual Execution

```bash
# Using SSH key
./scripts/deploy-ct8-optimized.sh production

# Using environment password
CT8_PASSWORD="secret" ./scripts/deploy-ct8-optimized.sh production
```

## Automated CI/CD Pipeline

The GitHub Actions workflow in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) manages the deployment lifecycle:

- **Trigger on Push**: Pushes to `master` automatically run tests, build the frontend bundle, and deploy to CT8.
- **Trigger on Dispatch**: Manual workflow dispatch with `deploy: true` option.
- **Concurrency**: `cancel-in-progress: false` on `master` to prevent half-finished deploys.
- **Required Secrets**: `CT8_PASSWORD` in repository GitHub Secrets.

## Database Migrations

Run database migrations against the configured PostgreSQL instance:

```bash
npm run migrate
```

`scripts/migrate.js` connects via administrative databases (`postgres`/`template1`) and automatically creates the target database if it does not already exist before applying schema and domain table migrations.
