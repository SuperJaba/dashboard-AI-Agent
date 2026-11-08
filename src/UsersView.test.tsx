import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { apiClient } from './shared/api-client';
import { UsersView } from './UsersView';
import { ToastProvider } from './components/ToastProvider';

const renderComponent = () => render(
  <ToastProvider>
    <UsersView />
  </ToastProvider>
);

vi.mock('./shared/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockUsers = [
  { id: 1, username: 'admin', role: 'admin' },
  { id: 2, username: 'tester', role: 'user' },
];

describe('UsersView Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Ustawiamy token dla admina o id 1
    const fakePayload = btoa(JSON.stringify({ id: 1, username: 'admin', role: 'admin' }));
    localStorage.setItem('dashboard_token', `header.${fakePayload}.sig`);
    vi.mocked(apiClient.get).mockResolvedValue({ success: true, users: mockUsers });
  });

  it('renderuje nagłówek i listę użytkowników', async () => {
    renderComponent();

    expect(screen.getByText('Zarządzanie Użytkownikami')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('admin')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getAllByText('Administrator').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Użytkownik').length).toBeGreaterThan(0);
    });

    // Użytkownik z tokena powinien mieć etykietę 'Ty'
    expect(screen.getByText('Ty')).toBeInTheDocument();
  });

  it('pozwala otworzyć modal dodawania użytkownika i anulować go', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('admin')).toBeInTheDocument();
    });

    const addBtn = screen.getByRole('button', { name: /Dodaj użytkownika/i });
    fireEvent.click(addBtn);

    expect(screen.getByText('Nowy użytkownik')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('np. jan_kowalski')).toBeInTheDocument();

    const cancelBtn = screen.getByRole('button', { name: /Anuluj/i });
    fireEvent.click(cancelBtn);

    expect(screen.queryByText('Nowy użytkownik')).not.toBeInTheDocument();
  });

  it('tworzy nowego użytkownika przez formularz', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ success: true, user: { id: 3, username: 'nowy', role: 'user' } });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('admin')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Dodaj użytkownika/i }));

    fireEvent.change(screen.getByPlaceholderText('np. jan_kowalski'), {
      target: { value: 'nowy_pracownik' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'bezpiecznehaslo123' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Utwórz konto/i }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/api/users', {
        username: 'nowy_pracownik',
        password: 'bezpiecznehaslo123',
        role: 'user',
      });
    });
  });

  it('otwiera modal zmiany hasła dla wybranego użytkownika', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('tester')).toBeInTheDocument();
    });

    const hasloButtons = screen.getAllByRole('button', { name: /Hasło/i });
    fireEvent.click(hasloButtons[1]); // Przycisk dla drugiego usera (tester)

    expect(screen.getByText('Zmiana hasła: tester')).toBeInTheDocument();
  });

  it('blokuje usunięcie samego siebie (disabled przycisk)', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('admin')).toBeInTheDocument();
    });

    const usunButtons = screen.getAllByRole('button', { name: /Usuń/i });
    // Pierwszy użytkownik to 'admin' (czyli 'Ty'), przycisk powinien być disabled
    expect(usunButtons[0]).toBeDisabled();
    // Drugi użytkownik nie jest zalogowanym, przycisk jest aktywny
    expect(usunButtons[1]).not.toBeDisabled();
  });

  it('obsługuje błąd pobierania listy użytkowników', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('Brak uprawnień'));

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Brak uprawnień')).toBeInTheDocument();
    });
  });
});
