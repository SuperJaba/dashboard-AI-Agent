#!/bin/bash
set -e

# Load local .env if present
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/.env" ]; then
    # Load only valid env keys, ignoring comments
    export $(grep -v '^#' "$SCRIPT_DIR/.env" | xargs -d '\n') 2>/dev/null || true
fi

TARGET_HOST="${1:-${REMOTE_HOST:-root@omv2}}"
OPSRAMP_ENABLED="${OPSRAMP_ENABLED:-false}"
OPSRAMP_ENDPOINT="${OPSRAMP_ENDPOINT:-}"
OPSRAMP_TOKEN="${OPSRAMP_TOKEN:-}"
OPSRAMP_INSTALL_AGENT="${OPSRAMP_INSTALL_AGENT:-false}"

echo "========================================================"
echo " Deploying Monitoring Stack to ${TARGET_HOST}"
echo " OpsRamp Remote Write Enabled: ${OPSRAMP_ENABLED}"
echo "========================================================"

ssh -o StrictHostKeyChecking=no "${TARGET_HOST}" bash -s <<EOF
set -e

echo "--> 1. Checking / Installing Docker..."
if ! command -v docker &> /dev/null; then
    apt-get update
    apt-get install -y ca-certificates curl gnupg
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg || true
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=\$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \$(. /etc/os-release && echo "\$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

echo "--> 2. Preparing directory structure in /opt/monitoring..."
mkdir -p /opt/monitoring/prometheus
mkdir -p /opt/monitoring/grafana/provisioning/dashboards
mkdir -p /opt/monitoring/grafana/dashboards
mkdir -p /opt/monitoring/grafana/provisioning/datasources

echo "--> 3. Configuring docker-compose.yml..."
cat << 'COMPOSE' > /opt/monitoring/docker-compose.yml
services:
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.retention.time=15d'
    ports:
      - "9090:9090"
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    ports:
      - "3000:3000"
    volumes:
      - ./grafana/provisioning:/etc/grafana/provisioning
      - ./grafana/dashboards:/etc/grafana/dashboards
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    restart: unless-stopped

  node_exporter:
    image: prom/node-exporter:latest
    container_name: node_exporter
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.rootfs=/rootfs'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)(\$\$|/)'
    ports:
      - "9100:9100"
    restart: unless-stopped
COMPOSE

echo "--> 4. Configuring Prometheus (with optional OpsRamp integration)..."
cat << 'PROM' > /opt/monitoring/prometheus/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    monitor: 'dashboard-remote'
    environment: 'production'

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'node_exporter'
    static_configs:
      - targets: ['node_exporter:9100']

  - job_name: 'grafana'
    static_configs:
      - targets: ['grafana:3000']
    metrics_path: '/metrics'
PROM

# Append OpsRamp Remote-Write if enabled
if [ "${OPSRAMP_ENABLED}" = "true" ] && [ -n "${OPSRAMP_ENDPOINT}" ]; then
    echo "--> Configuring OpsRamp remote_write streaming..."
    cat << 'OPSRAMP_CONF' >> /opt/monitoring/prometheus/prometheus.yml

remote_write:
  - url: "${OPSRAMP_ENDPOINT}"
    bearer_token: "${OPSRAMP_TOKEN}"
    queue_config:
      max_samples_per_send: 1000
      max_shards: 10
      capacity: 2500
    write_relabel_configs:
      - action: keep
        source_labels: [__name__]
        regex: ".*"
OPSRAMP_CONF
fi

echo "--> 5. Provisioning Grafana dashboards and datasources..."
cat << 'DASH_YML' > /opt/monitoring/grafana/provisioning/dashboards/dashboards.yml
apiVersion: 1

providers:
  - name: 'default'
    orgId: 1
    folder: 'General'
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /etc/grafana/dashboards
DASH_YML

cat << 'DASH_JSON' > /opt/monitoring/grafana/dashboards/api-monitoring.json
{
  "title": "Remote System & API Monitoring",
  "tags": ["api", "production", "opsramp"],
  "timezone": "browser",
  "refresh": "15s",
  "panels": [
    {
      "title": "CPU Usage (%)",
      "type": "timeseries",
      "targets": [
        {
          "expr": "100 - (avg by (instance) (rate(node_cpu_seconds_total{mode='idle'}[1m])) * 100)",
          "legendFormat": "{{instance}} CPU"
        }
      ],
      "gridPos": {"x": 0, "y": 0, "w": 12, "h": 8}
    },
    {
      "title": "Memory Usage (%)",
      "type": "timeseries",
      "targets": [
        {
          "expr": "100 * (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes))",
          "legendFormat": "{{instance}} Memory"
        }
      ],
      "gridPos": {"x": 12, "y": 0, "w": 12, "h": 8}
    }
  ]
}
DASH_JSON

cat << 'DS_YML' > /opt/monitoring/grafana/provisioning/datasources/datasources.yml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
DS_YML

# Optional native OpsRamp Agent installer if requested
if [ "${OPSRAMP_INSTALL_AGENT}" = "true" ] && [ -n "${OPSRAMP_TOKEN}" ]; then
    echo "--> Installing native OpsRamp Agent on host..."
    if ! command -v opsramp-agent &> /dev/null; then
        curl -sSL "${OPSRAMP_ENDPOINT%/api*}/agent/installer?token=${OPSRAMP_TOKEN}" | bash || true
    fi
fi

echo "--> 6. Launching Monitoring Stack with Docker Compose..."
cd /opt/monitoring
docker compose pull --quiet || true
docker compose up -d --remove-orphans

echo "--> 7. Stack status:"
docker compose ps

EOF

echo "========================================================"
echo " Deployment to ${TARGET_HOST} finished successfully!"
echo " Grafana URL:    http://${TARGET_HOST#*@}:3000"
echo " Prometheus URL: http://${TARGET_HOST#*@}:9090"
if [ "${OPSRAMP_ENABLED}" = "true" ]; then
    echo " OpsRamp Forwarding: ACTIVE -> ${OPSRAMP_ENDPOINT}"
fi
echo "========================================================"
