import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { apiClient } from './shared/api-client';
import { OpsRampView } from './OpsRampView';

const mockStatus = {
  enabled: true,
  mockMode: true,
  connection: 'CONNECTED_DOCKER_MOCK',
  tenant: {
    id: 'client_mock_corp_01',
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
  aiops: {
    rawEventsCount: 2480,
    correlatedIncidentsCount: 4,
    noiseReductionRate: 98.4,
    meanTimeToDetectSeconds: 14
  }
};

const mockAlerts = {
  total: 2,
  alerts: [
    {
      id: 'OPS-1094',
      subject: 'PostgreSQL Memory Allocation Exceeded 80% Threshold',
      resource: 'postgres-dashboard',
      resourceType: 'Database',
      severity: 'critical',
      state: 'active',
      deduplicatedCount: 64,
      aiCorrelationReason: 'High swap pressure correlated with concurrent table indexing.',
      firstSeen: new Date().toISOString(),
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
      aiCorrelationReason: 'Multi-agent prompt queue backlog.',
      firstSeen: new Date().toISOString(),
      lastSeen: new Date().toISOString()
    }
  ]
};

const mockResources = {
  total: 2,
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
      type: 'AI Inference Gateway',
      environment: 'Docker Container',
      ip: '172.28.0.3',
      status: 'HEALTHY',
      cpuUsage: '32.1%',
      memoryUsage: '44.0%',
      lastSeen: new Date().toISOString()
    }
  ]
};

vi.mock('./shared/api-client', () => ({
  apiClient: {
    get: vi.fn((url: string) => {
      if (url === '/api/opsramp/status') return Promise.resolve(mockStatus);
      if (url.startsWith('/api/opsramp/alerts')) return Promise.resolve(mockAlerts);
      if (url.startsWith('/api/opsramp/resources')) return Promise.resolve(mockResources);
      return Promise.resolve({});
    }),
    post: vi.fn((url: string, _body?: any) => {
      if (url.includes('/ack') || url.includes('/acknowledge')) {
        return Promise.resolve({ success: true, alert: { id: 'OPS-1094', state: 'acknowledged' } });
      }
      if (url.includes('/resolve')) {
        return Promise.resolve({ success: true, alert: { id: 'OPS-1094', state: 'resolved' } });
      }
      if (url.includes('/simulate-alert')) {
        return Promise.resolve({
          success: true,
          alert: {
            id: 'OPS-9999',
            subject: 'Simulated Alert',
            resource: 'test-resource',
            resourceType: 'Test',
            severity: 'warning',
            state: 'active',
            deduplicatedCount: 1,
            aiCorrelationReason: 'Test correlation reason',
            firstSeen: new Date().toISOString(),
            lastSeen: new Date().toISOString()
          }
        });
      }
      return Promise.resolve({ success: true });
    })
  }
}));

describe('OpsRampView Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders header, tenant status, and AIOps KPI metrics', async () => {
    render(<OpsRampView />);

    expect(await screen.findByText(/HPE OpsRamp Observability & AIOps/i)).toBeInTheDocument();
    expect(screen.getByText(/Docker Mock Sandbox/i)).toBeInTheDocument();
    expect(screen.getByText(/98.4%/i)).toBeInTheDocument();
    expect(screen.getByText(/ONLINE/i)).toBeInTheDocument();
  });

  it('displays active AIOps alerts and discovered resources', async () => {
    render(<OpsRampView />);

    expect(await screen.findByText(/PostgreSQL Memory Allocation Exceeded 80% Threshold/i)).toBeInTheDocument();
    expect(screen.getByText(/Llama Inference P99 Latency Degradation/i)).toBeInTheDocument();
    expect(screen.getAllByText(/postgres-dashboard/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/llama_proxy/i).length).toBeGreaterThan(0);
  });

  it('allows acknowledging an active alert', async () => {
    render(<OpsRampView />);

    expect(await screen.findByText(/OPS-1094/i)).toBeInTheDocument();

    const ackButtons = screen.getAllByTitle(/Potwierdź przyjęcie/i);
    expect(ackButtons.length).toBeGreaterThan(0);

    fireEvent.click(ackButtons[0]);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(expect.stringContaining('/ack'));
    });
  });

  it('allows triggering simulated AIOps incident', async () => {
    render(<OpsRampView />);

    expect(await screen.findByText(/Zasymuluj Incydent AIOps/i)).toBeInTheDocument();

    const simulateButton = screen.getByRole('button', { name: /Zasymuluj Incydent AIOps/i });
    fireEvent.click(simulateButton);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/api/opsramp/simulate-alert', expect.any(Object));
    });
  });

  it('renders Grafana button and toggles live embed panel', async () => {
    render(<OpsRampView />);

    expect(await screen.findByText(/Otwórz Grafanę/i)).toBeInTheDocument();
    const grafanaLink = screen.getByTitle(/Otwórz Grafanę/i);
    expect(grafanaLink).toHaveAttribute('href', 'http://localhost:3000');

    const embedCheckbox = screen.getByLabelText(/Wykresy Grafana Live/i);
    expect(embedCheckbox).not.toBeChecked();

    fireEvent.click(embedCheckbox);

    expect(await screen.findByText(/Grafana Live Telemetry & Metrics/i)).toBeInTheDocument();
    expect(screen.getByTitle('Grafana Dashboard')).toBeInTheDocument();
  });
});
