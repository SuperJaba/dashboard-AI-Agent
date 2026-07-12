import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DashboardTiles } from './TilesView';

describe('DashboardTiles', () => {
  const mockProjects = [
    { id: 1, name: 'Project Alpha', status: 'active', updatedAt: '2026-07-12', path: '/home/seba/alpha', tasks: [] },
    { id: 2, name: 'Project Beta', status: 'inactive', updatedAt: '2026-07-11', path: '/home/seba/beta', tasks: [] }
  ];

  it('renders projects correctly', () => {
    render(<DashboardTiles projects={mockProjects} onProjectClick={() => {}} />);
    
    expect(screen.getByText('Project Alpha')).toBeInTheDocument();
    expect(screen.getByText('Project Beta')).toBeInTheDocument();
    expect(screen.getByText('alpha')).toBeInTheDocument(); // Checking if path split works
  });

  it('calls onProjectClick when a tile is clicked', () => {
    const handleClick = vi.fn();
    render(<DashboardTiles projects={mockProjects} onProjectClick={handleClick} />);
    
    const tileAlpha = screen.getByText('Project Alpha').closest('.tile');
    if (tileAlpha) {
      fireEvent.click(tileAlpha);
    }
    
    expect(handleClick).toHaveBeenCalledWith(1);
  });
});
