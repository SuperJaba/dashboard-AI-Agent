import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TimeTravelPlayer } from './TimeTravelPlayer';
import { apiClient } from '../shared/api-client';

vi.mock('../shared/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('TimeTravelPlayer', () => {
  const sampleSessions = [
    { id: 'sess-1', agent_name: 'Claude Architect', started_at: '2026-11-01T04:00:00Z' },
    { id: 'sess-2', agent_name: 'Gemini Coder', started_at: '2026-11-01T04:30:00Z' }
  ];

  const sampleEvents = [
    {
      id: 'ev-1',
      session_id: 'sess-1',
      seq: '100',
      ts: '2026-11-01T04:01:00Z',
      type: 'bash_cmd',
      cmdline: 'npm test',
      exit_code: 0
    },
    {
      id: 'ev-2',
      session_id: 'sess-1',
      seq: '200',
      ts: '2026-11-01T04:02:00Z',
      type: 'file_write',
      path: '/workspace/src/index.js',
      diff: '@@ -1 +1 @@\n-old code\n+new code'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url === '/api/timemachine/sessions') {
        return Promise.resolve(sampleSessions);
      }
      if (url.includes('/events')) {
        return Promise.resolve(sampleEvents);
      }
      return Promise.resolve([]);
    });
  });

  it('renders sessions and events timeline', async () => {
    render(<TimeTravelPlayer />);

    await waitFor(() => {
      expect(screen.getByText(/wehikuł czasu/i)).toBeInTheDocument();
      expect(screen.getByText(/npm test/i)).toBeInTheDocument();
      expect(screen.getAllByText(/src\/index\.js/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('displays unified diff preview when file_write event is clicked', async () => {
    render(<TimeTravelPlayer />);

    await waitFor(() => {
      expect(screen.getAllByText(/src\/index\.js/i).length).toBeGreaterThanOrEqual(1);
    });

    const fileEvent = screen.getAllByText(/src\/index\.js/i)[0];
    fireEvent.click(fileEvent);

    expect(screen.getByText(/-old code/i)).toBeInTheDocument();
    expect(screen.getByText(/\+new code/i)).toBeInTheDocument();
  });

  it('triggers rollback when clicking "Cofnij do tego momentu"', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      success: true,
      revertedFiles: [{ path: '/workspace/src/index.js', status: 'reverted' }]
    });

    render(<TimeTravelPlayer />);

    await waitFor(() => {
      expect(screen.getAllByText(/src\/index\.js/i).length).toBeGreaterThanOrEqual(1);
    });

    const rollbackButtons = screen.getAllByRole('button', { name: /cofnij do tego momentu|rollback/i });
    expect(rollbackButtons.length).toBeGreaterThanOrEqual(1);

    fireEvent.click(rollbackButtons[0]);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        expect.stringContaining('/rollback'),
        expect.objectContaining({ seq: expect.anything() })
      );
    });
  });
});
