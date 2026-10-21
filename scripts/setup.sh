#!/bin/bash
set -e

echo "Checking for Docker..."
if ! command -v docker &> /dev/null; then
    echo "Docker not found. Installing..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh || sh get-docker.sh
else
    echo "Docker is already installed."
fi

mkdir -p ~/prometheus-grafana/grafana/dashboards
mkdir -p ~/prometheus-grafana/grafana/provisioning/dashboards
mkdir -p ~/prometheus-grafana/prometheus

echo "Writing docker-compose.yml..."
cat << 'EOF' > ~/prometheus-grafana/docker-compose.yml
version: '3'

services:
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
    ports:
      - "9090:9090"
    restart: unless-stopped
    network_mode: host

  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    ports:
      - "3000:3000"
    volumes:
      - ./grafana/provisioning:/etc/grafana/provisioning
      - ./grafana/dashboards:/var/lib/grafana/dashboards
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    restart: unless-stopped
EOF

echo "Writing prometheus.yml..."
cat << 'EOF' > ~/prometheus-grafana/prometheus/prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
EOF

echo "Writing Grafana provisioning config..."
cat << 'EOF' > ~/prometheus-grafana/grafana/provisioning/dashboards/dashboards.yml
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
      path: /var/lib/grafana/dashboards
EOF

echo "Writing Grafana dashboard JSON..."
cat << 'EOF' > ~/prometheus-grafana/grafana/dashboards/api-dashboard.json
{
  "dashboard": {
    "title": "API Monitoring",
    "tags": ["api", "production"],
    "timezone": "browser",
    "refresh": "30s",
    "panels": [
      {
        "title": "Request Rate",
        "type": "stat",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total[5m]))"
          }
        ],
        "gridPos": {"x": 0, "y": 0, "w": 12, "h": 8}
      }
    ]
  }
}
EOF

cd ~/prometheus-grafana
echo "Starting containers..."
docker compose up -d || docker-compose up -d
echo "Done!"
