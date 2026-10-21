#!/bin/bash
set -e

# ============================================================
#  Dashboard - Deployment Script for CT8.pl (Phusion Passenger)
#  Target: dashboard.jagger2.ct8.pl @ s1.ct8.pl
# ============================================================

REMOTE_USER="jagger2"
REM_HOST="s1.ct8.pl"
REMOTE_HOST="dashboard.jagger2.ct8.pl"

# Locate SSH Key (search for antigravity / antygravity key or user override)
if [ -n "$SSH_KEY" ] && [ -f "$SSH_KEY" ]; then
  ACTIVE_KEY="$SSH_KEY"
else
  ACTIVE_KEY=""
  for candidate in "$HOME/.ssh/id_ed25519_antigravity" "$HOME/.ssh/"*antygravity* "$HOME/.ssh/"*antigravity*; do
    for f in $candidate; do
      if [ -f "$f" ] && [[ ! "$f" =~ \.pub$ ]]; then
        ACTIVE_KEY="$f"
        break 2
      fi
    done
  done
fi

REMOTE_BASE="domains/$REMOTE_HOST"
REMOTE_APP="$REMOTE_BASE/public_nodejs"
REMOTE_PUBLIC="$REMOTE_APP/public"
REMOTE_LOGS="$REMOTE_BASE/logs"

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/../ && pwd)"

ENVIRONMENT="production"

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()    { echo -e "\n${CYAN}========================================${NC}\n${CYAN}  STEP $1: $2${NC}\n${CYAN}========================================${NC}"; }

# SSH and SCP command helpers using key authentication
SSH_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=15"

run_remote() {
  if [ -n "$ACTIVE_KEY" ]; then
    ssh -i "$ACTIVE_KEY" $SSH_OPTS "$REMOTE_USER@$REM_HOST" "$@"
  else
    ssh $SSH_OPTS "$REMOTE_USER@$REM_HOST" "$@"
  fi
}

copy_file() {
  if [ -n "$ACTIVE_KEY" ]; then
    scp -i "$ACTIVE_KEY" $SSH_OPTS "$1" "$2"
  else
    scp $SSH_OPTS "$1" "$2"
  fi
}

validate_environment() {
  log_step 0 "Pre-deployment Validation"

  if [ -z "$ACTIVE_KEY" ] || [ ! -f "$ACTIVE_KEY" ]; then
    log_error "SSH key not found in ~/.ssh/*antigravity*. Please set SSH_KEY environment variable."
    exit 1
  fi
  log_info "Using SSH Key: $ACTIVE_KEY"

  for cmd in ssh scp tar npm; do
    if ! command -v "$cmd" &>/dev/null; then
      log_error "Required local command '$cmd' is not installed"
      exit 1
    fi
    log_info "✓ Local command '$cmd' found"
  done

  [ ! -f "$PROJECT_DIR/package.json" ] && { log_error "package.json not found in $PROJECT_DIR"; exit 1; }
  [ ! -f "$PROJECT_DIR/server.js" ] && { log_error "server.js not found in $PROJECT_DIR"; exit 1; }
  [ ! -d "$PROJECT_DIR/src/backend" ] && { log_error "src/backend directory not found in $PROJECT_DIR"; exit 1; }

  log_info "Testing SSH connectivity to $REMOTE_USER@$REM_HOST..."
  if ! run_remote "uname -a" &>/dev/null; then
    log_error "Failed to connect to $REMOTE_USER@$REM_HOST via SSH"
    exit 1
  fi
  log_success "SSH connection established successfully"

  log_success "Pre-deployment validation passed"
}

kill_node_processes() {
  log_step "KILL" "Stopping Dashboard Node.js Processes"
  log_info "Stopping application processes on $REMOTE_HOST..."
  run_remote "pkill -f 'dashboard.jagger2.ct8.pl' || true"
  run_remote "pkill -9 -f 'dashboard.jagger2.ct8.pl' || true"
  log_success "Targeted dashboard processes stopped"
}

check_node_processes() {
  log_step "HEALTH" "Checking Remote Node.js Processes"
  log_info "Active Node.js processes for $REMOTE_USER on $REM_HOST:"
  echo -e "\n${CYAN}=== Active Processes ===${NC}"
  run_remote "ps aux | grep -E 'node|passenger' | grep -v grep || echo '  No active Node.js processes found'"
  echo -e "${CYAN}========================${NC}\n"
}

prepare_remote() {
  log_step 1 "Preparing Remote Server Structure & Database Schema"
  run_remote "mkdir -p \$HOME/$REMOTE_APP \$HOME/$REMOTE_PUBLIC \$HOME/$REMOTE_LOGS \$HOME/$REMOTE_APP/tmp \$HOME/$REMOTE_APP/dist \$HOME/$REMOTE_APP/src/backend \$HOME/$REMOTE_APP/scripts"
  
  # Ensure dashboard schema exists on remote PostgreSQL and public tables are isolated
  run_remote "
    set -a
    if [ -f \"\$HOME/$REMOTE_APP/.env\" ]; then
      source \"\$HOME/$REMOTE_APP/.env\"
      if command -v psql &>/dev/null && [ -n \"\$PGDATABASE\" ]; then
        psql -q << 'EOF_SCHEMA'
CREATE SCHEMA IF NOT EXISTS dashboard;
DO \$\$
DECLARE
    tbl text;
    tables text[] := ARRAY['settings', 'projects', 'servers', 'cli_agents', 'custom_widgets', 'llm_servers', 'agents', 'user_settings'];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl)
           AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'dashboard' AND table_name = tbl) THEN
            EXECUTE format('ALTER TABLE public.%I SET SCHEMA dashboard', tbl);
        END IF;
    END LOOP;
END \$\$;
CREATE TABLE IF NOT EXISTS dashboard.users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL
);
EOF_SCHEMA
      fi
    fi
  "
  log_success "Remote directories and database schema verified"
}

build_frontend() {
  log_step 2 "Building Frontend (Vite)"
  cd "$PROJECT_DIR"

  if [ "$DO_RUN_TESTS" = true ]; then
    log_info "Running unit tests..."
    npm test
  fi

  log_info "Building production client bundle..."
  npm run build

  if [ ! -d "$PROJECT_DIR/dist" ] || [ ! -f "$PROJECT_DIR/dist/index.html" ]; then
    log_error "Frontend build failed: dist/index.html not found"
    exit 1
  fi
  log_success "Frontend built successfully"
}

copy_backend() {
  log_step 3 "Packaging and Copying Backend Files"
  local tmp_tar="/tmp/dashboard-backend-$$.tar.gz"

  cd "$PROJECT_DIR"

  # Ensure app.js entry point exists locally
  if [ ! -f "$PROJECT_DIR/app.js" ]; then
    cat << 'EOF_APP' > "$PROJECT_DIR/app.js"
// Phusion Passenger entry point for CT8 / production
import app from './server.js';

export default app;
EOF_APP
  fi

  local include_list=(
    package.json package-lock.json server.js app.js
    src/backend scripts
  )

  log_info "Creating backend archive..."
  tar -czf "$tmp_tar" --exclude="scripts/deploy*" "${include_list[@]}"

  log_info "Uploading backend archive to $REMOTE_HOST..."
  copy_file "$tmp_tar" "$REMOTE_USER@$REM_HOST:$REMOTE_APP/backend.tar.gz"

  log_info "Extracting backend files on remote server..."
  run_remote "cd \$HOME/$REMOTE_APP && tar -xzf backend.tar.gz && rm -f backend.tar.gz"

  rm -f "$tmp_tar"
  log_success "Backend files uploaded and extracted"
}

copy_frontend() {
  log_step 4 "Packaging and Copying Frontend Files"
  local tmp_tar="/tmp/dashboard-frontend-$$.tar.gz"

  cd "$PROJECT_DIR/dist"
  log_info "Creating frontend archive..."
  tar -czf "$tmp_tar" .

  log_info "Uploading frontend archive..."
  copy_file "$tmp_tar" "$REMOTE_USER@$REM_HOST:$REMOTE_APP/frontend.tar.gz"

  log_info "Deploying frontend assets to public and dist directories..."
  run_remote "cd \$HOME/$REMOTE_PUBLIC && tar -xzf \$HOME/$REMOTE_APP/frontend.tar.gz"
  run_remote "cd \$HOME/$REMOTE_APP/dist && tar -xzf \$HOME/$REMOTE_APP/frontend.tar.gz && rm -f \$HOME/$REMOTE_APP/frontend.tar.gz"

  # Copy static icons / favicon if present
  if [ -d "$PROJECT_DIR/public" ]; then
    log_info "Syncing public assets..."
    cd "$PROJECT_DIR/public"
    local public_tar="/tmp/dashboard-public-$$.tar.gz"
    tar -czf "$public_tar" .
    copy_file "$public_tar" "$REMOTE_USER@$REM_HOST:$REMOTE_APP/public_extra.tar.gz"
    run_remote "cd \$HOME/$REMOTE_PUBLIC && tar -xzf \$HOME/$REMOTE_APP/public_extra.tar.gz && rm -f \$HOME/$REMOTE_APP/public_extra.tar.gz"
    rm -f "$public_tar"
  fi

  rm -f "$tmp_tar"
  cd "$PROJECT_DIR"
  log_success "Frontend files deployed"
}

configure_remote_env() {
  log_step 5 "Verifying Remote Environment Configuration (.env)"
  # Ensure remote .env exists and has required security keys and schema without overwriting DB credentials
  run_remote "
    ENV_FILE=\"\$HOME/$REMOTE_APP/.env\"
    if [ ! -f \"\$ENV_FILE\" ]; then
      echo 'NODE_ENV=production' > \"\$ENV_FILE\"
    fi
    grep -q 'DB_SCHEMA' \"\$ENV_FILE\" || echo 'DB_SCHEMA=dashboard' >> \"\$ENV_FILE\"
    grep -q 'JWT_SECRET' \"\$ENV_FILE\" || echo 'JWT_SECRET=super-secret-jwt-key-dashboard-production-ct8' >> \"\$ENV_FILE\"
    grep -q 'ENCRYPTION_KEY' \"\$ENV_FILE\" || echo 'ENCRYPTION_KEY=32_character_long_secret_encryption_key_123' >> \"\$ENV_FILE\"
    grep -q 'NODE_ENV' \"\$ENV_FILE\" || echo 'NODE_ENV=production' >> \"\$ENV_FILE\"
  "
  log_success "Remote .env verified"
}

install_dependencies() {
  log_step 6 "Installing Remote Dependencies"
  log_info "Running npm install (--omit=dev) with node24 runtime on remote..."
  run_remote "cd \$HOME/$REMOTE_APP && (command -v /usr/local/bin/npm24 &>/dev/null && /usr/local/bin/npm24 install --omit=dev || npm install --omit=dev)"
  log_success "Remote dependencies installed successfully"
}

run_migrations() {
  if [ "$FORCE_MIGRATE" = true ]; then
    log_step 7 "Running Database Migrations (--force-migrate)"
    log_warning "Caution: migrate.js resets tables!"
    run_remote "cd \$HOME/$REMOTE_APP && node scripts/migrate.js"
    log_success "Migrations finished"
  else
    log_info "Skipping destructive migrations. Database schema is initialized non-destructively by server.js (initDB)."
  fi
}

set_permissions() {
  log_step 8 "Setting Permissions"
  run_remote "chmod -R 755 \$HOME/$REMOTE_APP"
  run_remote "chmod -R 755 \$HOME/$REMOTE_PUBLIC"
  run_remote "[ -f \$HOME/$REMOTE_APP/.env ] && chmod 600 \$HOME/$REMOTE_APP/.env || true"
  log_success "Permissions applied"
}

restart_application() {
  log_step 9 "Restarting Application via Passenger"
  run_remote "mkdir -p \$HOME/$REMOTE_APP/tmp && touch \$HOME/$REMOTE_APP/tmp/restart.txt"
  run_remote "devil www restart $REMOTE_HOST"
  log_success "Application restart signal dispatched"
}

verify_deployment() {
  log_step 10 "Verifying Deployment"
  log_info "Waiting 8 seconds for Passenger worker to spin up..."
  sleep 8

  local health_code="0"
  local health_url="http://$REMOTE_HOST/health"
  local metrics_url="http://$REMOTE_HOST/metrics"
  local main_url="http://$REMOTE_HOST"
  local curl_cmd="curl -s -L"

  for i in 1 2 3; do
    health_code=$(run_remote "$curl_cmd -o /dev/null -w \"%{http_code}\" $health_url 2>/dev/null || echo '0'" || echo "0")
    if [ "$health_code" = "200" ]; then
      break
    fi
    log_info "Health check attempt $i/3 returned HTTP $health_code, retrying in 4s..."
    sleep 4
  done

  if [ "$health_code" = "200" ]; then
    log_success "✓ Health check (/health) passed: HTTP 200"
  else
    log_warning "⚠ Health check (/health) returned HTTP $health_code (checking /metrics fallback)"
    local metrics_code
    metrics_code=$(run_remote "$curl_cmd -o /dev/null -w \"%{http_code}\" $metrics_url 2>/dev/null || echo '0'" || echo "0")
    if [ "$metrics_code" = "200" ]; then
      log_success "✓ Metrics endpoint (/metrics) passed: HTTP 200"
    else
      log_error "✗ Metrics endpoint returned HTTP $metrics_code"
    fi
  fi

  local main_code
  main_code=$(run_remote "$curl_cmd -o /dev/null -w \"%{http_code}\" $main_url 2>/dev/null || echo '0'" || echo "0")
  if [ "$main_code" = "200" ]; then
    log_success "✓ Main web page ($main_url) accessible: HTTP 200"
  else
    log_warning "⚠ Main web page returned HTTP $main_code"
  fi

  if [ "$health_code" != "200" ] && [ "$main_code" != "200" ]; then
    log_info "Recent Passenger error logs:"
    run_remote "tail -n 35 \$HOME/$REMOTE_LOGS/error.log 2>/dev/null || true" || true
  fi

  log_info "Deployment verification completed"
}

main() {
  local do_kill=false
  local do_health=false
  local skip_build=false
  DO_RUN_TESTS=false
  FORCE_MIGRATE=false

  for arg in "$@"; do
    case "$arg" in
      --kill) do_kill=true ;;
      --health-check) do_health=true ;;
      --skip-build) skip_build=true ;;
      --run-tests) DO_RUN_TESTS=true ;;
      --force-migrate) FORCE_MIGRATE=true ;;
      production|staging|dev) ENVIRONMENT="$arg" ;;
    esac
  done

  if [ "$do_kill" = true ] && [ "$do_health" = false ]; then
    echo -e "${BLUE}\n  Dashboard - Stop Node.js Processes\n  Target: $REMOTE_HOST\n${NC}"
    validate_environment
    kill_node_processes
    exit 0
  fi

  if [ "$do_health" = true ] && [ "$do_kill" = false ]; then
    echo -e "${BLUE}\n  Dashboard - Health Check\n  Target: $REMOTE_HOST\n${NC}"
    validate_environment
    check_node_processes
    exit 0
  fi

  if [ "$do_kill" = true ] && [ "$do_health" = true ]; then
    echo -e "${BLUE}\n  Dashboard - Kill & Health Check\n  Target: $REMOTE_HOST\n${NC}"
    validate_environment
    kill_node_processes
    echo ""
    check_node_processes
    exit 0
  fi

  echo -e "${BLUE}"
  echo "============================================================"
  echo "  Dashboard - Deployment to CT8.pl"
  echo "  Environment: $ENVIRONMENT"
  echo "  Target Host: $REMOTE_HOST ($REM_HOST)"
  echo "  SSH Key:     ${ACTIVE_KEY:-default}"
  echo "============================================================"
  echo -e "${NC}"

  validate_environment
  prepare_remote
  if [ "$skip_build" = false ]; then
    build_frontend
  else
    log_info "Skipping frontend build (--skip-build requested)"
  fi
  copy_backend
  copy_frontend
  configure_remote_env
  install_dependencies
  run_migrations
  set_permissions
  restart_application
  verify_deployment

  echo -e "${BLUE}"
  echo "============================================================"
  echo "  DEPLOYMENT COMPLETE!"
  echo "============================================================"
  echo ""
  echo "  URL:         http://$REMOTE_HOST/"
  echo "  Health:      http://$REMOTE_HOST/health"
  echo "  Metrics:     http://$REMOTE_HOST/metrics"
  echo ""
  echo "  To inspect remote logs:"
  echo "    ssh -i $ACTIVE_KEY $REMOTE_USER@$REM_HOST 'tail -f domains/$REMOTE_HOST/logs/error.log'"
  echo ""
  echo "  To restart remote application:"
  echo "    ssh -i $ACTIVE_KEY $REMOTE_USER@$REM_HOST 'devil www restart $REMOTE_HOST'"
  echo "============================================================"
  echo -e "${NC}"
}

main "$@"
