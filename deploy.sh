#!/bin/bash
set -e

echo "Deploying Prometheus + Grafana stack to omv2..."

ssh root@omv2<< 'EOF'
set -e

# 1. Instalacja Dockera (jeśli nie istnieje)
if ! command -v docker &> /dev/null; then
    apt-get update
    apt-get install -y ca-certificates curl gnupg
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg || true
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

# 2. Przygotowanie struktury katalogów
mkdir -p /opt/monitoring/prometheus
mkdir -p /opt/monitoring/grafana/provisioning/dashboards
mkdir -p /opt/monitoring/grafana/dashboards
mkdir -p /opt/monitoring/grafana/provisioning/datasources

# 3. Konfiguracja docker-compose.yml
cat << 'COMPOSE' > /opt/monitoring/docker-compose.yml
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
COMPOSE

# 4. Konfiguracja prometheus.yml
cat << 'PROM' > /opt/monitoring/prometheus/prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
PROM

# 5. Provisioning dashboardów Grafany
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

# 6. Utworzenie wygenerowanego dashboardu
cat << 'DASH_JSON' > /opt/monitoring/grafana/dashboards/api-monitoring.json
{
  "title": "API Monitoring",
  "tags": ["api", "production"],
  "timezone": "browser",
  "refresh": "30s",
  "panels": [
    {
      "title": "Request Rate",
      "type": "graph",
      "targets": [
        {
          "expr": "sum(rate(http_requests_total[5m])) by (service)",
          "legendFormat": "{{service}}"
        }
      ],
      "gridPos": {"x": 0, "y": 0, "w": 12, "h": 8}
    }
  ]
}
DASH_JSON

# 7. Provisioning źródła danych
cat << 'DS_YML' > /opt/monitoring/grafana/provisioning/datasources/datasources.yml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
DS_YML

# 8. Uruchomienie kontenerów
cd /opt/monitoring
docker compose up -d
EOF

echo "Deployment initiated successfully!"
