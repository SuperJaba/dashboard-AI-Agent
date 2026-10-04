import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FolderPickerDialog } from './FolderPickerDialog';
import { apiClient } from './shared/api-client';

vi.mock('./shared/api-client', () => ({
  apiClient: {
    get: vi.fn(),
  }
}));

describe('FolderPickerDialog Component', () => {
  const mockOnClose = vi.fn();
  const mockOnSelectFolder = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <FolderPickerDialog
        isOpen={false}
        onClose={mockOnClose}
        onSelectFolder={mockOnSelectFolder}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders dialog and loads initial directories and drives when isOpen is true', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      currentPath: 'F:\\AI-Agents\\dashboard',
      parentPath: 'F:\\AI-Agents',
      directories: [
        { name: 'src', path: 'F:\\AI-Agents\\dashboard\\src' },
        { name: 'tests', path: 'F:\\AI-Agents\\dashboard\\tests' }
      ],
      drives: ['C:\\', 'D:\\', 'F:\\']
    });

    render(
      <FolderPickerDialog
        isOpen={true}
        onClose={mockOnClose}
        onSelectFolder={mockOnSelectFolder}
      />
    );

    expect(screen.getByText('Wybierz folder projektu')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('src')).toBeInTheDocument();
      expect(screen.getByText('tests')).toBeInTheDocument();
    });

    // Check path input is editable and populated
    const pathInput = screen.getByLabelText('Ścieżka folderu') as HTMLInputElement;
    expect(pathInput).toBeInTheDocument();
    expect(pathInput.value).toBe('F:\\AI-Agents\\dashboard');

    // Check drive selector is present
    const driveSelect = screen.getByLabelText('Wybierz dysk') as HTMLSelectElement;
    expect(driveSelect).toBeInTheDocument();
    expect(driveSelect.value).toBe('F:\\');

    // Check "W górę" button is enabled
    const upButton = screen.getByTitle('Katalog w górę');
    expect(upButton).not.toBeDisabled();
  });

  it('allows user to edit path in input and navigate via "Przejdź" button', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({
        currentPath: 'F:\\AI-Agents',
        parentPath: 'F:\\',
        directories: [{ name: 'dashboard', path: 'F:\\AI-Agents\\dashboard' }],
        drives: ['C:\\', 'D:\\', 'F:\\']
      })
      .mockResolvedValueOnce({
        currentPath: 'C:\\Projects',
        parentPath: 'C:\\',
        directories: [{ name: 'MyApp', path: 'C:\\Projects\\MyApp' }],
        drives: ['C:\\', 'D:\\', 'F:\\']
      });

    render(
      <FolderPickerDialog
        isOpen={true}
        onClose={mockOnClose}
        onSelectFolder={mockOnSelectFolder}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('dashboard')).toBeInTheDocument();
    });

    const pathInput = screen.getByLabelText('Ścieżka folderu');
    fireEvent.change(pathInput, { target: { value: 'C:\\Projects' } });

    const goButton = screen.getByRole('button', { name: /Przejdź do ścieżki/i });
    fireEvent.click(goButton);

    await waitFor(() => {
      expect(screen.getByText('MyApp')).toBeInTheDocument();
    });

    expect(apiClient.get).toHaveBeenCalledWith('/api/fs/directories?path=C%3A%5CProjects');
  });

  it('allows switching drive using the drive selector dropdown', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({
        currentPath: 'F:\\AI-Agents',
        parentPath: 'F:\\',
        directories: [{ name: 'dashboard', path: 'F:\\AI-Agents\\dashboard' }],
        drives: ['C:\\', 'D:\\', 'F:\\']
      })
      .mockResolvedValueOnce({
        currentPath: 'D:\\',
        parentPath: 'DRIVES',
        directories: [{ name: 'Data', path: 'D:\\Data' }],
        drives: ['C:\\', 'D:\\', 'F:\\']
      });

    render(
      <FolderPickerDialog
        isOpen={true}
        onClose={mockOnClose}
        onSelectFolder={mockOnSelectFolder}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('dashboard')).toBeInTheDocument();
    });

    const driveSelect = screen.getByLabelText('Wybierz dysk');
    fireEvent.change(driveSelect, { target: { value: 'D:\\' } });

    await waitFor(() => {
      expect(screen.getByText('Data')).toBeInTheDocument();
    });

    expect(apiClient.get).toHaveBeenCalledWith('/api/fs/directories?path=D%3A%5C');
  });

  it('navigates up to DRIVES list when at drive root and clicking "W górę"', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({
        currentPath: 'F:\\',
        parentPath: 'DRIVES',
        directories: [{ name: 'AI-Agents', path: 'F:\\AI-Agents' }],
        drives: ['C:\\', 'D:\\', 'F:\\']
      })
      .mockResolvedValueOnce({
        currentPath: '',
        parentPath: null,
        directories: [
          { name: 'Dysk (C:)', path: 'C:\\', isDrive: true },
          { name: 'Dysk (D:)', path: 'D:\\', isDrive: true },
          { name: 'Dysk (F:)', path: 'F:\\', isDrive: true }
        ],
        drives: ['C:\\', 'D:\\', 'F:\\']
      });

    render(
      <FolderPickerDialog
        isOpen={true}
        onClose={mockOnClose}
        onSelectFolder={mockOnSelectFolder}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('AI-Agents')).toBeInTheDocument();
    });

    const upButton = screen.getByTitle('W górę (lista dysków)');
    fireEvent.click(upButton);

    await waitFor(() => {
      expect(screen.getByText('Dysk (C:)')).toBeInTheDocument();
      expect(screen.getByText('Dysk (D:)')).toBeInTheDocument();
      expect(screen.getByText('Dysk (F:)')).toBeInTheDocument();
    });

    expect(apiClient.get).toHaveBeenCalledWith('/api/fs/directories?path=DRIVES');
  });

  it('selects a folder and calls onSelectFolder on confirm', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      currentPath: 'F:\\AI-Agents',
      parentPath: 'F:\\',
      directories: [{ name: 'dashboard', path: 'F:\\AI-Agents\\dashboard' }],
      drives: ['F:\\']
    });

    render(
      <FolderPickerDialog
        isOpen={true}
        onClose={mockOnClose}
        onSelectFolder={mockOnSelectFolder}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('dashboard')).toBeInTheDocument();
    });

    // Click folder item to select it
    fireEvent.click(screen.getByText('dashboard'));

    const confirmButton = screen.getByRole('button', { name: /Wybierz ten folder/i });
    fireEvent.click(confirmButton);

    expect(mockOnSelectFolder).toHaveBeenCalledWith('F:\\AI-Agents\\dashboard', 'dashboard');
    expect(mockOnClose).toHaveBeenCalled();
  });
});
