import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import App from '../App';
import { AuthWrapper } from '../Login';
import { PreferencesProvider } from '../preferences/PreferencesContext';

describe('Accessibility (WCAG 2.1 AA) Auditing Suite', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      let data: any = [];
      if (url && typeof url === 'string' && url.includes('/api/settings')) {
        data = {};
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(data)
      });
    });
    localStorage.clear();
  });

  describe('App Component Accessibility', () => {
    it('renders main navigation buttons with proper ARIA current state', async () => {
      await act(async () => {
        render(<PreferencesProvider><App /></PreferencesProvider>);
      });
      
      const dashboardNavBtn = screen.getByRole('button', { name: /^Dashboard$/i });
      const agentsNavBtn = screen.getByRole('button', { name: /Agenci AI/i });

      expect(dashboardNavBtn).toBeInTheDocument();
      expect(agentsNavBtn).toBeInTheDocument();
      expect(dashboardNavBtn).toHaveAttribute('aria-current', 'page');
    });

    it('renders expandable accordions with aria-expanded and aria-controls attributes', async () => {
      await act(async () => {
        render(<PreferencesProvider><App /></PreferencesProvider>);
      });

      const workspacesToggle = screen.getByRole('button', { name: /Workspaces/i });
      const remoteToggle = screen.getByRole('button', { name: /Remote/i });

      expect(workspacesToggle).toHaveAttribute('aria-expanded', 'true');
      expect(workspacesToggle).toHaveAttribute('aria-controls', 'workspaces-list');

      expect(remoteToggle).toHaveAttribute('aria-expanded', 'true');
      expect(remoteToggle).toHaveAttribute('aria-controls', 'remote-servers-list');
    });

    it('provides accessible labels for server configuration input fields in settings', async () => {
      await act(async () => {
        render(<PreferencesProvider><App /></PreferencesProvider>);
      });

      const settingsButton = screen.getByRole('button', { name: /Ustawienia|Settings/i });
      await act(async () => {
        fireEvent.click(settingsButton);
      });

      expect(screen.getByLabelText(/Nazwa Serwera/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Lokalny Serwer API/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Model bazowy/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/API Key \(Opcjonalny\)/i)).toBeInTheDocument();
    });

    it('renders Add Server modal with proper dialog semantics when triggered', async () => {
      await act(async () => {
        render(<PreferencesProvider><App /></PreferencesProvider>);
      });

      const addServerButtons = screen.getAllByRole('button', { name: /Add Server/i });
      await act(async () => {
        fireEvent.click(addServerButtons[0]);
      });

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'add-server-modal-title');
    });

    it('renders FolderPicker modal with proper dialog semantics when Add Project is triggered', async () => {
      await act(async () => {
        render(<PreferencesProvider><App /></PreferencesProvider>);
      });

      const addProjectButton = screen.getByRole('button', { name: /Add Project/i });
      await act(async () => {
        fireEvent.click(addProjectButton);
      });

      const dialog = await screen.findByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'folder-picker-title');
      expect(await screen.findByText('Wybierz folder projektu')).toBeInTheDocument();
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
