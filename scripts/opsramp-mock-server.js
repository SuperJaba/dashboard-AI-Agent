/**
 * OpsRamp Mock Server
 * Simulates OpsRamp SaaS / Gateway REST API endpoints and AIOps event ingestion.
 * Uses native Node.js HTTP module (zero dependencies).
 */

import http from 'http';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8085;
const TENANT_ID = process.env.TENANT_ID || 'client_mock_corp_01';

// Initial state for mocked OpsRamp tenant
let mockState = {
  tenant: {
    id: TENANT_ID,
    name: 'Corp AI Infrastructure (Mock Tenant)',
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
      environment: 'Local / Container Host',
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

const server = http.createServer((req, res) => {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-opsramp-token');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  let body = '';
  req.on('data', chunk => {
    body += chunk;
  });

  req.on('end', () => {
    let parsedBody = {};
    if (body) {
      try {
        parsedBody = JSON.parse(body);
      } catch (e) {
        // Plain text or metrics push payload
        parsedBody = { raw: body };
      }
    }

    // Health / Status
    if (pathname === '/health' || pathname.endsWith('/health')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        status: 'UP',
        mockMode: true,
        tenant: mockState.tenant,
        gateway: {
          ...mockState.gateway,
          lastHeartbeat: new Date().toISOString()
        },
        aiops: mockState.aiopsStats
      }));
    }

    // Tenant info & overview
    if (pathname.includes('/tenants') && (pathname.endsWith('/overview') || pathname.endsWith('/status'))) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        tenant: mockState.tenant,
        gateway: mockState.gateway,
        aiops: mockState.aiopsStats
      }));
    }

    // List Alerts
    if (pathname.includes('/alerts') && req.method === 'GET') {
      const severityFilter = url.searchParams.get('severity');
      let results = [...mockState.alerts];
      if (severityFilter && severityFilter !== 'all') {
        results = results.filter(a => a.severity.toLowerCase() === severityFilter.toLowerCase());
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        total: results.length,
        alerts: results,
        aiopsReduction: mockState.aiopsStats
      }));
    }

    // Acknowledge Alert
    const ackMatch = pathname.match(/\/alerts\/([^/]+)\/acknowledge/);
    if (ackMatch && req.method === 'POST') {
      const alertId = ackMatch[1];
      const targetAlert = mockState.alerts.find(a => a.id === alertId);
      if (targetAlert) {
        targetAlert.state = 'acknowledged';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, alert: targetAlert }));
      }
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: `Alert ${alertId} not found` }));
    }

    // Resolve Alert
    const resolveMatch = pathname.match(/\/alerts\/([^/]+)\/resolve/);
    if (resolveMatch && req.method === 'POST') {
      const alertId = resolveMatch[1];
      const targetAlert = mockState.alerts.find(a => a.id === alertId);
      if (targetAlert) {
        targetAlert.state = 'resolved';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, alert: targetAlert }));
      }
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: `Alert ${alertId} not found` }));
    }

    // Trigger / Simulate new alert
    if (pathname.includes('/alerts/simulate') && req.method === 'POST') {
      const newAlert = {
        id: `OPS-${Math.floor(1000 + Math.random() * 9000)}`,
        subject: parsedBody.subject || 'Simulated AI Agent Execution Anomaly',
        resource: parsedBody.resource || 'cli-agent-worker',
        resourceType: parsedBody.resourceType || 'AI Worker',
        severity: parsedBody.severity || 'warning',
        state: 'active',
        deduplicatedCount: Math.floor(Math.random() * 15) + 1,
        aiCorrelationReason: parsedBody.reason || 'Triggered via OpsRamp simulation API for testing real-time ingestion.',
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString()
      };
      mockState.alerts.unshift(newAlert);
      mockState.aiopsStats.rawEventsCount += 24;
      res.writeHead(201, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, alert: newAlert }));
    }

    // Discovered Resources
    if (pathname.includes('/resources') && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        total: mockState.resources.length,
        resources: mockState.resources
      }));
    }

    // Prometheus Remote Write Ingestion Mock
    if (pathname.includes('/metrics') && req.method === 'POST') {
      mockState.aiopsStats.rawEventsCount += 5;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'success', ingestedCount: 15 }));
    }

    // Default Fallback
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      message: 'OpsRamp Mock Server API',
      tenantId: TENANT_ID,
      version: 'v7-mock',
      endpoints: [
        'GET /health',
        'GET /api/v7/tenants/:tenantId/overview',
        'GET /api/v7/tenants/:tenantId/alerts',
        'POST /api/v7/tenants/:tenantId/alerts/:id/acknowledge',
        'POST /api/v7/tenants/:tenantId/alerts/:id/resolve',
        'POST /api/v7/tenants/:tenantId/alerts/simulate',
        'GET /api/v7/tenants/:tenantId/resources',
        'POST /api/v1/metrics/prometheus/push'
      ]
    }));
  });
});

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`🚀 OpsRamp Mock Server running on http://localhost:${PORT}`);
    console.log(`   Tenant ID: ${TENANT_ID}`);
  });
}

export { server, mockState };
