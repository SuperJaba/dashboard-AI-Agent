# Deployment & Infrastructure (CT8.pl & Multi-Deploy)

Deploy target architecture, automated delivery pipeline, multi-server deployment, and process lifecycle management for the Dashboard application.

## Target Environment (CT8.pl Production)

| Parameter | Value |
| :--- | :--- |
| **Host** | `s1.ct8.pl` (port 22) / Alias `jagger2` in `~/.ssh/config` |
| **User** | `jagger2` |
| **Domain** | `dashboard.jagger2.ct8.pl` |
| **App Path** | `domains/dashboard.jagger2.ct8.pl/public_nodejs` |
| **Public Assets** | `domains/dashboard.jagger2.ct8.pl/public_nodejs/public` (served directly by Nginx) |
| **Runtime** | Node.js 22 LTS under Phusion Passenger (configured via Devil) |
| **Process Control** | `touch tmp/restart.txt && devil www restart dashboard.jagger2.ct8.pl` |

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

- **Optimized Deploy (CI & Manual)**: [`scripts/deploy-ct8-optimized.sh`](../scripts/deploy-ct8-optimized.sh)
  - Packages and uploads production backend files.
  - Skips redundant remote builds when `SKIP_FRONTEND_BUILD="true"` and pre-built `dist/` is present.
  - Runs `npm install --omit=dev --omit=optional` on remote host.
  - Runs database migrations via `scripts/migrate.js`.
  - Touches `tmp/restart.txt` and performs health check on `https://dashboard.jagger2.ct8.pl/health`.
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
