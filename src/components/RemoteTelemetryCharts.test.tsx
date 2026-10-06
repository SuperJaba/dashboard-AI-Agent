import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RemoteTelemetryCharts } from './RemoteTelemetryCharts';

describe('RemoteTelemetryCharts Component', () => {
  it('renders header, live stream badge, and chart sections', () => {
    render(
      <RemoteTelemetryCharts
        cpuLoadPercent={34}
        memoryUsagePercent={62}
        cores={8}
        appsCount={5}
        uptimeHours={48}
      />
    );

    expect(screen.getByText(/Natywna Telemetria Serwera & Wykresy Systemowe/i)).toBeInTheDocument();
    expect(screen.getByText(/Live Stream SSH/i)).toBeInTheDocument();
    expect(screen.getByText(/Obciążenie CPU & Pamięć RAM/i)).toBeInTheDocument();
    expect(screen.getByText(/Procesy & Zadania w Tle/i)).toBeInTheDocument();
    expect(screen.getByText(/Latencja SSH \(ms\) & Przepustowość/i)).toBeInTheDocument();
    expect(screen.getByText(/Śr\. CPU: 34% · RAM: 62%/i)).toBeInTheDocument();
    expect(screen.getByText(/8 Cores · 5 App\(s\)/i)).toBeInTheDocument();
  });
});
