import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { ConsoleVarsModal } from './ConsoleVarsModal';
import * as apiClient from '../shared/api-client';

describe('ConsoleVarsModal Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(apiClient, 'apiFetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        ip: 'http://127.0.0.1:8888/v1',
        model: 'unsloth/Qwen3.5-9B-MTP-GGUF',
        token: 'secret-token',
        exportCommands: {
          bash: 'export OPENAI_BASE_URL="http://127.0.0.1:8888/v1"',
          powershell: '$env:OPENAI_BASE_URL = "http://127.0.0.1:8888/v1"',
          env: 'OPENAI_BASE_URL=http://127.0.0.1:8888/v1'
        }
      })
    } as any);
  });

  it('renders nothing when isOpen is false', () => {
    render(<ConsoleVarsModal isOpen={false} onClose={() => {}} />);
    expect(screen.queryByText(/Zmienne Konsoli CLI Agenta/i)).toBeNull();
  });

  it('renders modal with fields and loads existing variables when isOpen is true', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        ip: 'http://127.0.0.1:8888/v1',
        model: 'unsloth/Qwen3.5-9B-MTP-GGUF',
        token: 'secret-token',
        exportCommands: {
          bash: 'export OPENAI_BASE_URL="http://127.0.0.1:8888/v1"',
          powershell: '$env:OPENAI_BASE_URL = "http://127.0.0.1:8888/v1"',
          env: 'OPENAI_BASE_URL=http://127.0.0.1:8888/v1'
        }
      })
    } as any);

    render(<ConsoleVarsModal isOpen={true} onClose={() => {}} />);

    expect(screen.getByText(/Zmienne Konsoli CLI Agenta/i)).toBeDefined();
    await waitFor(() => {
      const ipInput = screen.getByPlaceholderText(/127.0.0.1:8888/i) as HTMLInputElement;
      expect(ipInput.value).toBe('http://127.0.0.1:8888/v1');
    });

    expect(screen.getByText(/Testuj połączenie/i)).toBeDefined();
    expect(screen.getByText(/Zapisz do bazy danych/i)).toBeDefined();
  });

  it('switches export format tabs correctly', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        ip: 'http://127.0.0.1:8888/v1',
        model: 'unsloth/Qwen3.5-9B-MTP-GGUF',
        token: '',
        exportCommands: {
          bash: 'export OPENAI_BASE_URL="http://127.0.0.1:8888/v1"',
          powershell: '$env:OPENAI_BASE_URL = "http://127.0.0.1:8888/v1"',
          env: 'OPENAI_BASE_URL=http://127.0.0.1:8888/v1'
        }
      })
    } as any);

    render(<ConsoleVarsModal isOpen={true} onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText(/export OPENAI_BASE_URL/i)).toBeDefined();
    });

    const powershellTab = screen.getByRole('button', { name: /PowerShell/i });
    fireEvent.click(powershellTab);

    expect(screen.getByText(/\$env:OPENAI_BASE_URL/i)).toBeDefined();
  });

  it('handles save and triggers onSaved callback', async () => {
    const onSaved = vi.fn();
    const apiSpy = vi.spyOn(apiClient, 'apiFetch').mockImplementation(async (url, init?: any) => {
      if (init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            exportCommands: { bash: '', powershell: '', env: '' }
          })
        } as any;
      }
      return {
        ok: true,
        json: async () => ({
          ip: 'http://127.0.0.1:8888/v1',
          model: 'unsloth/Qwen3.5-9B-MTP-GGUF',
          token: ''
        })
      } as any;
    });

    render(<ConsoleVarsModal isOpen={true} onClose={() => {}} onSaved={onSaved} />);

    await waitFor(() => {
      expect(screen.getByText(/Zapisz do bazy danych/i)).toBeDefined();
    });

    const form = screen.getByRole('button', { name: /Zapisz do bazy danych/i }).closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(apiSpy).toHaveBeenCalledWith('/api/agents/console-vars', expect.objectContaining({ method: 'POST' }));
      expect(onSaved).toHaveBeenCalled();
    });
  });

  it('closes on Escape key press', () => {
    const onClose = vi.fn();
    render(<ConsoleVarsModal isOpen={true} onClose={onClose} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
