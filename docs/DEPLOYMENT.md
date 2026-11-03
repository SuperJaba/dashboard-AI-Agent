# Deployment & Infrastructure (CT8.pl & Multi-Deploy)

Automated deployment system for the Dashboard application with support for:
- **Single Server Deployment**: CT8.pl production server via Phusion Passenger
- **Multi-SERVER Deployment**: Simultaneous deployment to multiple targets (CT8, OMV, custom servers)
- **Process Lifecycle Management**: Automatic kill/restart of hung processes during deployment
- **Real-time Monitoring**: WebSocket-based progress tracking and log streaming

**Deployment Architecture Overview:**
```
┌─────────────────┐     Deploy Script     ┌──────────────────────┐
│  Local Dev      │────────────────────→ │ Remote Server         │
│  Environment    │                       │ (CT8.pl / OMV)        │
└─────────────────┘                       └──────────────────────┘
       │                                       │
       │ Build & Package                      │ Deploy via SSH
       ↓                                       ↓
   ┌─────────┐                         ┌──────────────┐
   │ dist/   │                         │ Passenger     │
   │ backend │                         │ Node.js App   │
   └─────────┘                         └──────────────┘
```

**Deployment Flow:**
1. Pre-deployment validation (SSH, auth, tools)
2. Remote server preparation (directories, database schema)
3. Frontend build (Vite) + optional tests
4. Backend packaging & upload (tar.gz)
5. Frontend asset deployment
6. Remote .env configuration
7. Dependency installation with caching
8. Database migrations (optional, destructive by default)
9. File permissions setup
10. Application restart via Phusion Passenger
11. Deployment verification (health checks)

## Target Environment (CT8.pl Production)

**Deployment Architecture Overview:**
```
┌─────────────────┐     Deploy Script     ┌──────────────────────┐
│  Local Dev      │────────────────────→ │ Remote Server         │
│  Environment    │                       │ (CT8.pl / OMV)        │
└─────────────────┘                       └──────────────────────┘
       │                                       │
       │ Build & Package                      │ Deploy via SSH
       ↓                                       ↓
   ┌─────────┐                         ┌──────────────┐
   │ dist/   │                         │ Passenger     │
   │ backend │                         │ Node.js App   │
   └─────────┘                         └──────────────┘
```

**Deployment Flow:**
1. Pre-deployment validation (SSH, auth, tools)
2. Remote server preparation (directories, database schema)
3. Frontend build (Vite) + optional tests
4. Backend packaging & upload (tar.gz)
5. Frontend asset deployment
6. Remote .env configuration
7. Dependency installation with caching
8. Database migrations (optional, destructive by default)
9. File permissions setup
10. Application restart via Phusion Passenger
11. Deployment verification (health checks)

| Parameter | Value |
| :--- | :--- |
| **Host** | `s1.ct8.pl` (port 22) / Alias `jagger2` in `~/.ssh/config` |
| **User** | `jagger2` |
| **Domain** | `dashboard.jagger2.ct8.pl` |
| **App Path** | `domains/dashboard.jagger2.ct8.pl/public_nodejs` |
| **Public Assets** | `domains/dashboard.jagger2.ct8.pl/public_nodejs/public` (served directly by Nginx) |
| **Runtime** | Node.js 22 LTS under Phusion Passenger (configured via Devil) |
| **Process Control** | `touch tmp/restart.txt && devil www restart dashboard.jagger2.ct8.pl` |

---

## SSH Configuration (`~/.ssh/config`)

The SSH target `jagger2` is configured in `~/.ssh/config` for non-interactive and batch execution:

```ssh-config
Host jagger2
    HostName s1.ct8.pl
    Port 22
    User jagger2
    IdentityFile ~/.ssh/id_ed25519_antigravity
    IdentitiesOnly yes
    BatchMode yes
    StrictHostKeyChecking accept-new
    ConnectTimeout 10
```

All remote SSH administration and diagnostics commands can directly invoke `ssh jagger2 "<COMMAND>"`.

---

## Multi-Deploy Architecture

The deployment system supports simultaneous deployment to multiple targets:
- **CT8.pl** (`dashboard.jagger2.ct8.pl`) – Primary FreeBSD production server.
- **OMV** (`10.10.10.100`) – OpenMediaVault internal storage and Docker host.
- **Custom Servers** – Servers dynamically registered in the dashboard database (`/api/servers`).

Multi-deploy execution is orchestrated in parallel by `DeployService` (`src/backend/deploy/deployService.js`), which broadcasts real-time progress steps and target-tagged log streams over WebSocket (`/dashboard`).

---

## Process Management & Killing Hung Processes

During deployment or server operation, processes may become unresponsive due to network delays, build steps, or resource limits:

### 1. Aborting an Active Deployment
- **API**: `POST /api/deploy/abort` (requires `x-admin-role: true`)
- **UI**: Dedicated **`[ Ubij proces ]`** button appears in the deployment widget whenever `isDeploying` is active.
- **Mechanism**: Sends `SIGTERM` followed by `SIGKILL` to active deploy child processes (`deploy-ct8-optimized.sh`, `deploy-omv.sh`) and cleans up the active process map, immediately unlocking the deployment queue.

### 2. Killing Remote Hung Processes on CT8
- **API**: `POST /api/deploy/kill-remote` (body: `{ target: 'ct8' }`, requires `x-admin-role: true`)
- **UI**: **`[ Ubij procesy CT8 ]`** buttons available in the widget header, in the bottom action bar, and inside the full log console modal.
- **Remote Execution**:
  ```bash
  killall -9 node gitstatusd-freebsd-amd64 2>/dev/null || true
  touch ~/domains/dashboard.jagger2.ct8.pl/tmp/restart.txt
  devil www restart dashboard.jagger2.ct8.pl
  ```
- **Safe Log Cleaning**:
  ```bash
  ssh jagger2 "rm -rf ~/.npm/_logs/* ~/domains/*/logs/* 2>/dev/null || true"
  ```

---

## Critical CT8 / FreeBSD Environment Gotchas

1. **Non-Interactive Shells & `~/.bash_profile`:**
   Phusion Passenger spawns helper scripts using `bash -l -c "..."`. If `~/.bash_profile` contains an unconditional `exec zsh`, it corrupts Passenger spawn pipes. Always guard interactive shell switching:
   ```bash
   if [[ $- == *i* ]] && [ -x /usr/local/bin/zsh ]; then
     exec zsh
   fi
   ```

2. **Process and Thread Limits (`maxproc`):**
   FreeBSD shared hosting enforces strict per-user thread quotas (typically 20–32 threads). Tools like Powerlevel10k's `gitstatusd` spawn 32 threads by default, exhausting user quotas and causing `fork: Resource temporarily unavailable`. Ensure `gitstatusd` is disabled on CT8:
   ```bash
   export POWERLEVEL9K_DISABLE_GITSTATUS=true
   ```

3. **Pure JavaScript `bcryptjs` vs Native `bcrypt`:**
   Native compilation of C++ addons (`node-gyp`) during `npm install` fails due to resource limits and missing FreeBSD headers. The project uses pure JS `bcryptjs`.

4. **Synchronous Optional `node-pty` Loading:**
   Phusion Passenger's CommonJS loader `node-loader.js` cannot load an ESM dependency graph containing top-level `await` (`ERR_REQUIRE_ASYNC_MODULE`). Any optional packages like `node-pty` must be loaded synchronously via `createRequire(import.meta.url)`.

5. **Absolute Path `.env` Discovery:**
   Passenger starts Node processes with working directory `/` (root). All backend modules must load `.env` via `path.resolve(__dirname, '.../.env')` rather than defaulting to `process.cwd()`.

---

## Deployment Scripts

### deploy-ct8-optimized.sh (Main Production Script)

The primary deployment script for CT8.pl production environment. It handles the complete deployment lifecycle from validation to verification:

**Deployment Flow:**
```
1. Pre-deployment Validation → 2. Prepare Remote Server → 3. Build Frontend → 
4. Package Backend → 5. Deploy Frontend → 6. Configure .env → 7. Install Dependencies → 
8. Run Migrations (optional) → 9. Set Permissions → 10. Restart App → 11. Verify Deployment
```

**Features:**
- ✅ Pre-deployment validation (SSH connectivity, authentication, required tools)
- ✅ Automatic SSH key discovery or password fallback
- ✅ Backend archive creation (excludes tests, CI scripts, dev artifacts)
- ✅ Package-lock.json hash-based dependency caching
- ✅ Remote .env configuration with security defaults
- ✅ Phusion Passenger restart via `tmp/restart.txt` marker
- ✅ Comprehensive deployment verification (health, metrics, main URL)

**Available Options:**
| Option | Description |
|--------|-------------|
| `--skip-build` | Skip local Vite build (requires existing dist/) |
| `--run-tests` | Run unit tests before deployment |
| `--force-install` | Force remote npm install even if package-lock hash matches |
| `--force-migrate` | Run destructive migrate.js database migration |
| `--kill` | Stop targeted dashboard Node.js processes on CT8 |
| `--health-check` | Check active processes and HTTP health endpoint |

**Authentication Methods:**
1. **SSH Key** (recommended): Place key in `~/.ssh/*antigravity*` or set `SSH_KEY` env var
2. **Password**: Set `CT8_PASSWORD` env var or place password in `docs/pass.txt`
3. **SSH Config**: Use SSH alias `jagger2` from `~/.ssh/config`

**Deployment Architecture:**
```
┌─────────────────┐     Deploy Script     ┌──────────────────────┐
│  Local Dev      │────────────────────→ │ Remote Server         │
│  Environment    │                       │ (CT8.pl / OMV)        │
└─────────────────┘                       └──────────────────────┘
       │                                       │
       │ Build & Package                      │ Deploy via SSH
       ↓                                       ↓
   ┌─────────┐                         ┌──────────────┐
   │ dist/   │                         │ Passenger     │
   │ backend │                         │ Node.js App   │
   └─────────┘                         └──────────────┘
```

- **OpenMediaVault Deploy**: [`scripts/deploy-omv.sh`](../scripts/deploy-omv.sh)
- **Legacy Deploy**: [`scripts/deploy-dashboard.sh`](../scripts/deploy-dashboard.sh)

### Manual Execution

```bash
# Using SSH config alias / key
./scripts/deploy-ct8-optimized.sh production

# Multi-deploy from CLI or API
curl -X POST http://localhost:3001/api/deploy/start \
  -H "x-admin-role: true" \
  -H "x-deploy-confirm: DEPLOY_CT8" \
  -H "Content-Type: application/json" \
  -d '{"environment":"production","targets":["ct8","omv"]}'
```

### Available Options

| Option | Description |
|--------|-------------|
| `--skip-build` | Skip local Vite build (requires existing dist/) |
| `--run-tests` | Run unit tests before deployment |
| `--force-install` | Force remote npm install even if package-lock hash matches |
| `--force-migrate` | Run destructive migrate.js database migration |
| `--kill` | Stop targeted dashboard Node.js processes on CT8 |
| `--health-check` | Check active processes and HTTP health endpoint |

### Authentication Methods

The script supports multiple authentication methods:
1. **SSH Key** (recommended): Place key in `~/.ssh/*antigravity*` or set `SSH_KEY` env var
2. **Password**: Set `CT8_PASSWORD` env var or place password in `docs/pass.txt`
3. **SSH Config**: Use SSH alias `jagger2` from `~/.ssh/config`

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CT8_USER` | `jagger2` | Remote SSH user |
| `CT8_REM_HOST` | `s1.ct8.pl` | Remote host (SSH) |
| `CT8_HOST` | `dashboard.jagger2.ct8.pl` | Target domain |

---

## Automated CI/CD Pipeline

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
> **Safety Guard**: `scripts/migrate.js` explicitly protects the `projects` and `servers` tables from being dropped or truncated during migration reruns.
