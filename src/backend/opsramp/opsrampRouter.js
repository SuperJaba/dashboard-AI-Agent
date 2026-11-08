import { Router } from 'express';
import fetch from 'node-fetch';

export const opsrampRouter = Router();

// Fallback in-memory state for development / standalone mode without Docker
const localFallbackState = {
  tenant: {
    id: process.env.OPSRAMP_TENANT_ID || 'client_mock_corp_01',
    name: 'Corp AI Infrastructure (Mock Sandbox)',
    status: 'ACTIVE',
    region: 'eu-central-1',
    mode: 'MOCK_SANDBOX'
  },
  gateway: {
    status: 'ONLINE',
    version: 'v14.2.0-mock',
    ipAddress: '172.28.0.5',
    lastHeartbeat: new Date().toISOString(),
    scrapedEndpoints: 4,
    metricsPushedPerMin: 1240
  },
  aiopsStats: {
    rawEventsCount: 2480,
    correlatedIncidentsCount: 4,
    noiseReductionRate: 98.4,
    meanTimeToDetectSeconds: 14
  },
  resources: [
    {
      id: 'res-pg-01',
      name: 'postgres-dashboard',
      type: 'Database (PostgreSQL 18)',
      environment: 'Docker Container',
      ip: '172.28.0.2',
      status: 'WARNING',
      cpuUsage: '14.2%',
      memoryUsage: '84.8%',
      lastSeen: new Date().toISOString()
    },
    {
      id: 'res-llm-01',
      name: 'llama_proxy',
      type: 'AI Inference Gateway (Qwen 3.5 4B)',
      environment: 'Docker Container',
      ip: '172.28.0.3',
      status: 'WARNING',
      cpuUsage: '72.1%',
      memoryUsage: '62.4%',
      lastSeen: new Date().toISOString()
    },
    {
      id: 'res-prom-01',
      name: 'prometheus',
      type: 'Metrics Engine',
      environment: 'Docker Container',
      ip: '172.28.0.4',
      status: 'HEALTHY',
      cpuUsage: '3.5%',
      memoryUsage: '18.1%',
      lastSeen: new Date().toISOString()
    },
    {
      id: 'res-graf-01',
      name: 'grafana',
      type: 'Observability UI',
      environment: 'Docker Container',
      ip: '172.28.0.6',
      status: 'HEALTHY',
      cpuUsage: '1.8%',
      memoryUsage: '12.0%',
      lastSeen: new Date().toISOString()
    },
    {
      id: 'res-node-01',
      name: 'dashboard-backend',
      type: 'Node.js Express / Socket.IO',
      environment: 'Local Host',
      ip: '127.0.0.1:3001',
      status: 'HEALTHY',
      cpuUsage: '4.2%',
      memoryUsage: '35.0%',
      lastSeen: new Date().toISOString()
    }
  ],
  alerts: [
    {
      id: 'OPS-1094',
      subject: 'PostgreSQL Memory Allocation Exceeded 80% Threshold',
      resource: 'postgres-dashboard',
      resourceType: 'Database',
      severity: 'critical',
      state: 'active',
      deduplicatedCount: 64,
      aiCorrelationReason: 'High swap pressure correlated with concurrent table indexing and vector memory spikes.',
      firstSeen: new Date(Date.now() - 32 * 60 * 1000).toISOString(),
      lastSeen: new Date().toISOString()
    },
    {
      id: 'OPS-1089',
      subject: 'Llama Inference P99 Latency Degradation (>650ms)',
      resource: 'llama_proxy',
      resourceType: 'AI Engine',
      severity: 'warning',
      state: 'active',
      deduplicatedCount: 28,
      aiCorrelationReason: 'Spike in token generation length correlated with multi-agent concurrent prompt batching.',
      firstSeen: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
      lastSeen: new Date().toISOString()
    },
    {
      id: 'OPS-1072',
      subject: 'Docker Host Ephemeral Volume Usage > 75%',
      resource: 'docker-host',
      resourceType: 'Host Storage',
      severity: 'warning',
      state: 'acknowledged',
      deduplicatedCount: 12,
      aiCorrelationReason: 'Build artifact accumulation in temp workspaces.',
      firstSeen: new Date(Date.now() - 140 * 60 * 1000).toISOString(),
      lastSeen: new Date(Date.now() - 40 * 60 * 1000).toISOString()
    },
    {
      id: 'OPS-1051',
      subject: 'Synthetic Health Probe Check Passed',
      resource: 'dashboard-backend',
      resourceType: 'API Endpoint',
      severity: 'info',
      state: 'resolved',
      deduplicatedCount: 310,
      aiCorrelationReason: '200 OK across all synthetic canary probes.',
      firstSeen: new Date(Date.now() - 360 * 60 * 1000).toISOString(),
      lastSeen: new Date().toISOString()
    }
  ]
};

function getOpsRampConfig() {
  const isMock = process.env.OPSRAMP_MOCK_MODE !== 'false';
  const tenantId = process.env.OPSRAMP_TENANT_ID || 'client_mock_corp_01';
  const serverUrl = process.env.OPSRAMP_SERVER_URL || 'http://localhost:8085';
  const token = process.env.OPSRAMP_TOKEN || 'mock_opsramp_token_xyz123';
  return { isMock, tenantId, serverUrl, token };
}

// GET /api/opsramp/status
opsrampRouter.get('/status', async (req, res) => {
  const { isMock, _tenantId, serverUrl, token } = getOpsRampConfig();

  try {
    const response = await fetch(`${serverUrl}/health`, {
      headers: { 'Authorization': `Bearer ${token}` },
      timeout: 2000
    });

    if (response.ok) {
      const data = await response.json();
      return res.json({
        enabled: true,
        mockMode: isMock,
        connection: 'CONNECTED_DOCKER_MOCK',
        serverUrl,
        ...data
      });
    }
  } catch {
    // Docker mock server container might be offline or dev mode
  }

  // Standalone fallback
  return res.json({
    enabled: true,
    mockMode: isMock,
    connection: 'FALLBACK_LOCAL_SIMULATOR',
    tenant: localFallbackState.tenant,
    gateway: {
      ...localFallbackState.gateway,
      lastHeartbeat: new Date().toISOString()
    },
    aiops: localFallbackState.aiopsStats
  });
});

// GET /api/opsramp/alerts
opsrampRouter.get('/alerts', async (req, res) => {
  const { tenantId, serverUrl, token } = getOpsRampConfig();
  const severity = req.query.severity;

  try {
    const query = severity ? `?severity=${severity}` : '';
    const response = await fetch(`${serverUrl}/api/v7/tenants/${tenantId}/alerts${query}`, {
      headers: { 'Authorization': `Bearer ${token}` },
      timeout: 2000
    });
    if (response.ok) {
      const data = await response.json();
      return res.json(data);
    }
  } catch {
    // Fallback
  }

  let results = [...localFallbackState.alerts];
  if (severity && severity !== 'all') {
    results = results.filter(a => a.severity.toLowerCase() === severity.toLowerCase());
  }

  return res.json({
    total: results.length,
    alerts: results,
    aiopsReduction: localFallbackState.aiopsStats
  });
});

// POST /api/opsramp/alerts/:id/acknowledge
opsrampRouter.post('/alerts/:id/acknowledge', async (req, res) => {
  const { tenantId, serverUrl, token } = getOpsRampConfig();
  const alertId = req.params.id;

  try {
    const response = await fetch(`${serverUrl}/api/v7/tenants/${tenantId}/alerts/${alertId}/acknowledge`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      timeout: 2000
    });
    if (response.ok) {
      const data = await response.json();
      return res.json(data);
    }
  } catch {
    // Fallback
  }

  const alert = localFallbackState.alerts.find(a => a.id === alertId);
  if (alert) {
    alert.state = 'acknowledged';
    return res.json({ success: true, alert });
  }

  return res.status(404).json({ error: `Alert ${alertId} not found` });
});

// POST /api/opsramp/alerts/:id/resolve
opsrampRouter.post('/alerts/:id/resolve', async (req, res) => {
  const { tenantId, serverUrl, token } = getOpsRampConfig();
  const alertId = req.params.id;

  try {
    const response = await fetch(`${serverUrl}/api/v7/tenants/${tenantId}/alerts/${alertId}/resolve`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      timeout: 2000
    });
    if (response.ok) {
      const data = await response.json();
      return res.json(data);
    }
  } catch {
    // Fallback
  }

  const alert = localFallbackState.alerts.find(a => a.id === alertId);
  if (alert) {
    alert.state = 'resolved';
    return res.json({ success: true, alert });
  }

  return res.status(404).json({ error: `Alert ${alertId} not found` });
});

// GET /api/opsramp/resources
opsrampRouter.get('/resources', async (req, res) => {
  const { tenantId, serverUrl, token } = getOpsRampConfig();

  try {
    const response = await fetch(`${serverUrl}/api/v7/tenants/${tenantId}/resources`, {
      headers: { 'Authorization': `Bearer ${token}` },
      timeout: 2000
    });
    if (response.ok) {
      const data = await response.json();
      return res.json(data);
    }
  } catch {
    // Fallback
  }

  return res.json({
    total: localFallbackState.resources.length,
    resources: localFallbackState.resources
  });
});

// POST /api/opsramp/simulate-alert
opsrampRouter.post('/simulate-alert', async (req, res) => {
  const { tenantId, serverUrl, token } = getOpsRampConfig();
  const body = req.body || {};

  try {
    const response = await fetch(`${serverUrl}/api/v7/tenants/${tenantId}/alerts/simulate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(body),
      timeout: 2000
    });
    if (response.ok) {
      const data = await response.json();
      return res.status(201).json(data);
    }
  } catch {
    // Fallback
  }

  const newAlert = {
    id: `OPS-${Math.floor(1000 + Math.random() * 9000)}`,
    subject: body.subject || 'Simulated AI Agent Memory & Latency Anomaly',
    resource: body.resource || 'cli-agent-worker',
    resourceType: body.resourceType || 'AI Worker',
    severity: body.severity || 'warning',
    state: 'active',
    deduplicatedCount: Math.floor(Math.random() * 15) + 1,
    aiCorrelationReason: body.reason || 'Detected concurrent high prompt queue and token degradation.',
    firstSeen: new Date().toISOString(),
    lastSeen: new Date().toISOString()
  };

  localFallbackState.alerts.unshift(newAlert);
  localFallbackState.aiopsStats.rawEventsCount += 24;

  return res.status(201).json({ success: true, alert: newAlert });
});
