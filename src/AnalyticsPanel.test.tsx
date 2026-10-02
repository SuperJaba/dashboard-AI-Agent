import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnalyticsPanel } from './AnalyticsPanel';

describe('AnalyticsPanel', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        totalProjects: 1,
        techStats: [{ tech: 'Unknown', count: 1 }],
        avgComplete: 0
      })
    }));
  });

  it('calculates live stats directly from projects prop', () => {
    const projects = [
      { id: 1, name: 'Project 1', tech: 'React / Vite', complete: 50 },
      { id: 2, name: 'Project 2', tech: 'Node.js Express', complete: 100 }
    ];

    render(<AnalyticsPanel projects={projects} />);

    expect(screen.getByText('Total Projects')).toBeDefined();
    expect(screen.getByText('2')).toBeDefined();
    expect(screen.getByText('Global Progress')).toBeDefined();
    expect(screen.getByText('75%')).toBeDefined();
    expect(screen.getByText('Top Technology')).toBeDefined();
    // React / Vite or Node.js Express
    expect(screen.getByText(/React \/ Vite|Node\.js Express/)).toBeDefined();
  });

  it('prioritizes known technology over Unknown', () => {
    const projects = [
      { id: 1, name: 'Project 1', tech: 'Unknown', complete: 10 },
      { id: 2, name: 'Project 2', tech: 'React / Vite', complete: 20 }
    ];

    render(<AnalyticsPanel projects={projects} />);

    expect(screen.getByText('React / Vite')).toBeDefined();
  });

  it('updates project count when projects array changes', () => {
    const { rerender } = render(<AnalyticsPanel projects={[{ id: 1, name: 'P1', tech: 'Go', complete: 0 }]} />);
    expect(screen.getByText('1')).toBeDefined();

    rerender(<AnalyticsPanel projects={[
      { id: 1, name: 'P1', tech: 'Go', complete: 0 },
      { id: 2, name: 'P2', tech: 'Go', complete: 100 }
    ]} />);

    expect(screen.getByText('2')).toBeDefined();
    expect(screen.getByText('50%')).toBeDefined();
  });
});
