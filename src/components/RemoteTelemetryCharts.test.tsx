import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RemoteTelemetryCharts } from './RemoteTelemetryCharts';

// Helper functions for testing different time ranges
function testTimeRange15m() {
  const { unmount } = render(
    <RemoteTelemetryCharts
      cpuLoadPercent={34}
      memoryUsagePercent={62}
      cores={8}
      appsCount={5}
      uptimeHours={48}
    />
  );

  // Click on 15m button (index 0)
  const buttons = screen.getAllByRole('button');
  fireEvent.click(buttons[0]);

  // Verify time range buttons render correctly
  const newButtons = screen.getAllByRole('button');
  expect(newButtons[0]).toHaveTextContent('15m');

  // Verify data renders without errors (charts should be visible)
  expect(screen.getByText(/Obciążenie CPU & Pamięć RAM/i)).toBeInTheDocument();
  expect(screen.getByText(/Procesy & Zadania w Tle/i)).toBeInTheDocument();
  expect(screen.getByText(/Latencja SSH \(ms\) & Przepustowość/i)).toBeInTheDocument();

  unmount();
}

function testTimeRange1h() {
  const { unmount } = render(
    <RemoteTelemetryCharts
      cpuLoadPercent={34}
      memoryUsagePercent={62}
      cores={8}
      appsCount={5}
      uptimeHours={48}
    />
  );

  // Click on 1h button (index 1)
  const buttons = screen.getAllByRole('button');
  fireEvent.click(buttons[1]);

  // Verify time range buttons render correctly
  const newButtons = screen.getAllByRole('button');
  expect(newButtons[1]).toHaveTextContent('1h');

  // Verify data renders without errors (charts should be visible)
  expect(screen.getByText(/Obciążenie CPU & Pamięć RAM/i)).toBeInTheDocument();
  expect(screen.getByText(/Procesy & Zadania w Tle/i)).toBeInTheDocument();
  expect(screen.getByText(/Latencja SSH \(ms\) & Przepustowość/i)).toBeInTheDocument();

  unmount();
}

function testTimeRange6h() {
  const { unmount } = render(
    <RemoteTelemetryCharts
      cpuLoadPercent={34}
      memoryUsagePercent={62}
      cores={8}
      appsCount={5}
      uptimeHours={48}
    />
  );

  // Click on 6h button (index 2)
  const buttons = screen.getAllByRole('button');
  fireEvent.click(buttons[2]);

  // Verify time range buttons render correctly
  const newButtons = screen.getAllByRole('button');
  expect(newButtons[2]).toHaveTextContent('6h');

  // Verify data renders without errors (charts should be visible)
  expect(screen.getByText(/Obciążenie CPU & Pamięć RAM/i)).toBeInTheDocument();
  expect(screen.getByText(/Procesy & Zadania w Tle/i)).toBeInTheDocument();
  expect(screen.getByText(/Latencja SSH \(ms\) & Przepustowość/i)).toBeInTheDocument();

  unmount();
}

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

  it('clicking 15m button sets active state correctly', () => {
    const { unmount } = render(
      <RemoteTelemetryCharts
        cpuLoadPercent={34}
        memoryUsagePercent={62}
        cores={8}
        appsCount={5}
        uptimeHours={48}
      />
    );

    // Check that 1h is initially active (aria-pressed or visual style)
    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toHaveTextContent('15m');
    expect(buttons[1]).toHaveTextContent('1h');
    expect(buttons[2]).toHaveTextContent('6h');

    // Click on 15m button
    fireEvent.click(buttons[0]);

    // Verify 15m is now active (should have primary background color in inline style)
    const buttonsAfterClick = screen.getAllByRole('button');
    expect(buttonsAfterClick[0]).toHaveTextContent('15m');
    // Active button should have "var(--primary" in its style attribute
    const activeButtonStyle = buttonsAfterClick[0].getAttribute('style');
    expect(activeButtonStyle?.includes('--primary')).toBe(true);

    unmount();
  });

  it('clicking 6h button sets active state correctly', () => {
    const { unmount } = render(
      <RemoteTelemetryCharts
        cpuLoadPercent={34}
        memoryUsagePercent={62}
        cores={8}
        appsCount={5}
        uptimeHours={48}
      />
    );

    // Click on 6h button
    fireEvent.click(screen.getByText('6h'));

    // Verify 6h is now active (should have primary background color in inline style)
    const buttonsAfterClick = screen.getAllByRole('button');
    expect(buttonsAfterClick[2]).toHaveTextContent('6h');
    // Active button should have "var(--primary" in its style attribute
    const activeButtonStyle = buttonsAfterClick[2].getAttribute('style');
    expect(activeButtonStyle?.includes('--primary')).toBe(true);

    unmount();
  });

  it('renders correct data without errors for all time ranges', () => {
    testTimeRange15m();
    testTimeRange1h();
    testTimeRange6h();
  });
});
