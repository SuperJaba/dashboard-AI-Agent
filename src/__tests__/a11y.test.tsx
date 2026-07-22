import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../App';
import { AuthWrapper } from '../Login';

describe('Accessibility (WCAG 2.1 AA) Auditing Suite', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([])
    });
    localStorage.clear();
  });

  describe('App Component Accessibility', () => {
    it('renders main navigation buttons with proper ARIA current state', () => {
      render(<App />);
      
      const dashboardNavBtn = screen.getByRole('button', { name: /Dashboard/i });
      const agentsNavBtn = screen.getByRole('button', { name: /Agenci AI/i });

      expect(dashboardNavBtn).toBeInTheDocument();
      expect(agentsNavBtn).toBeInTheDocument();
      expect(dashboardNavBtn).toHaveAttribute('aria-current', 'page');
    });

    it('renders expandable accordions with aria-expanded and aria-controls attributes', () => {
      render(<App />);

      const workspacesToggle = screen.getByRole('button', { name: /Workspaces/i });
      const remoteToggle = screen.getByRole('button', { name: /Remote/i });

      expect(workspacesToggle).toHaveAttribute('aria-expanded', 'true');
      expect(workspacesToggle).toHaveAttribute('aria-controls', 'workspaces-list');

      expect(remoteToggle).toHaveAttribute('aria-expanded', 'true');
      expect(remoteToggle).toHaveAttribute('aria-controls', 'remote-servers-list');
    });

    it('provides accessible labels for sidebar server configuration input fields', () => {
      render(<App />);

      expect(screen.getByLabelText(/Nazwa Serwera/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Lokalny Serwer API/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Model bazowy/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/API Key \(Opcjonalny\)/i)).toBeInTheDocument();
    });

    it('renders Add Server modal with proper dialog semantics when triggered', () => {
      render(<App />);

      const addServerButtons = screen.getAllByRole('button', { name: /Add Server/i });
      fireEvent.click(addServerButtons[0]);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'add-server-modal-title');
    });
  });

  describe('AuthWrapper / Login Component Accessibility', () => {
    it('associates form labels programmatically with inputs', async () => {
      render(
        <AuthWrapper>
          <div>Protected Content</div>
        </AuthWrapper>
      );

      expect(await screen.findByLabelText(/Nazwa użytkownika|Username/i)).toBeInTheDocument();
      expect(await screen.findByLabelText(/Hasło|Password/i)).toBeInTheDocument();
    });
  });
});
