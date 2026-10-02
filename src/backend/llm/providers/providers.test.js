import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseProvider } from './baseProvider.js';
import { LmStudioProvider } from './lmStudioProvider.js';
import { AgyProvider } from './agyProvider.js';
import { createProvider, getProvider, clearProviderRegistry } from './index.js';
import { executeRoutedPrompt, localCircuitBreaker } from '../modelRouter.js';

describe('T5.3 Provider Adapter Interface', () => {
  beforeEach(() => {
    clearProviderRegistry();
    localCircuitBreaker.recordSuccess();
  });

  describe('BaseProvider', () => {
    it('throws error when trying to instantiate BaseProvider directly', () => {
      expect(() => new BaseProvider('test')).toThrow(TypeError);
    });

    it('throws error if subclass does not implement complete()', async () => {
      class IncompleteProvider extends BaseProvider {
        constructor() {
          super('incomplete');
        }
      }
      const provider = new IncompleteProvider();
      await expect(provider.complete('hello')).rejects.toThrow('not implemented');
    });
  });

  describe('LmStudioProvider', () => {
    it('sends correct payload to /chat/completions and returns structured result', async () => {
      const mockFetcher = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Witaj! W czym mogę pomóc?' } }],
          usage: { prompt_tokens: 12, completion_tokens: 18, total_tokens: 30 },
          model: 'openai/gpt-oss-20b',
        }),
      });

      const provider = new LmStudioProvider({
        baseUrl: 'http://127.0.0.1:1234/v1',
        defaultModel: 'openai/gpt-oss-20b',
        fetcher: mockFetcher,
      });

      const res = await provider.complete('Cześć, jak się masz?', { temperature: 0.5 });

      expect(mockFetcher).toHaveBeenCalledWith(
        'http://127.0.0.1:1234/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            model: 'openai/gpt-oss-20b',
            messages: [{ role: 'user', content: 'Cześć, jak się masz?' }],
            temperature: 0.5,
            max_tokens: 2048,
          }),
        })
      );

      expect(res.text).toBe('Witaj! W czym mogę pomóc?');
      expect(res.usage.totalTokens).toBe(30);
      expect(res.provider).toBe('lm-studio');
      expect(typeof res.durationMs).toBe('number');
    });

    it('throws when HTTP status is not ok', async () => {
      const mockFetcher = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      const provider = new LmStudioProvider({ fetcher: mockFetcher });
      await expect(provider.complete('test')).rejects.toThrow('LM Studio HTTP 500');
    });
  });

  describe('AgyProvider', () => {
    it('provides simulated response when no API key is set', async () => {
      const provider = new AgyProvider({ apiKey: '' });
      const res = await provider.complete('Refactor this architectural pattern');

      expect(res.text).toContain('[AGY Cloud Simulation');
      expect(res.provider).toBe('agy');
      expect(res.usage.promptTokens).toBeGreaterThan(0);
      expect(typeof res.durationMs).toBe('number');
    });

    it('calls cloud endpoint when API key is provided', async () => {
      const mockFetcher = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Cloud completion successful' } }],
          usage: { prompt_tokens: 50, completion_tokens: 100, total_tokens: 150 },
          model: 'agy-gemini-pro',
        }),
      });

      const provider = new AgyProvider({
        apiKey: 'test-agy-key',
        endpoint: 'https://api.antigravity.test/v1',
        fetcher: mockFetcher,
      });

      const res = await provider.complete('High complexity prompt');

      expect(mockFetcher).toHaveBeenCalledWith(
        'https://api.antigravity.test/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-agy-key',
          }),
        })
      );
      expect(res.text).toBe('Cloud completion successful');
      expect(res.provider).toBe('agy');
    });
  });

  describe('Provider Factory & Registry', () => {
    it('creates correct provider instances', () => {
      const local = createProvider('lm-studio');
      const agy = createProvider('agy');

      expect(local).toBeInstanceOf(LmStudioProvider);
      expect(agy).toBeInstanceOf(AgyProvider);
      expect(() => createProvider('unsupported')).toThrow('Unknown provider');
    });

    it('caches and reuses provider instances via getProvider', () => {
      const p1 = getProvider('lm-studio');
      const p2 = getProvider('lm-studio');
      expect(p1).toBe(p2);
    });
  });

  describe('executeRoutedPrompt Integration', () => {
    it('executes low complexity prompt through local provider', async () => {
      const localProvider = getProvider('lm-studio');
      vi.spyOn(localProvider, 'complete').mockResolvedValue({
        text: 'Local reply',
        usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
        model: 'openai/gpt-oss-20b',
        provider: 'lm-studio',
        durationMs: 50,
      });

      const res = await executeRoutedPrompt('Wypisz pliki w folderze');
      expect(res.text).toBe('Local reply');
      expect(res.route.provider).toBe('lm-studio');
      expect(res.fallbackOccurred).toBe(false);
    });

    it('automatically falls back to secondary model when primary fails', async () => {
      const localProvider = getProvider('lm-studio');
      vi.spyOn(localProvider, 'complete')
        .mockRejectedValueOnce(new Error('Connection timeout to primary model'))
        .mockResolvedValueOnce({
          text: 'Fallback local reply',
          usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
          model: 'granite-4.0-micro',
          provider: 'lm-studio',
          durationMs: 40,
        });

      const res = await executeRoutedPrompt('Pokaż status');
      expect(res.text).toBe('Fallback local reply');
      expect(res.fallbackOccurred).toBe(true);
      expect(res.fallbackReason).toBe('primary_local_failed');
    });

    it('escalates to AGY cloud when both local models fail', async () => {
      const localProvider = getProvider('lm-studio');
      vi.spyOn(localProvider, 'complete').mockRejectedValue(new Error('LM Studio unreachable'));

      const agyProvider = getProvider('agy');
      vi.spyOn(agyProvider, 'complete').mockResolvedValue({
        text: 'Cloud fallback reply',
        usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        model: 'agy-gemini-pro',
        provider: 'agy',
        durationMs: 120,
      });

      const res = await executeRoutedPrompt('Proste zadanie');
      expect(res.text).toBe('Cloud fallback reply');
      expect(res.provider).toBe('agy');
      expect(res.fallbackOccurred).toBe(true);
      expect(res.fallbackReason).toBe('local_providers_failed');
    });

    it('routes high complexity tasks directly to AGY cloud', async () => {
      const agyProvider = getProvider('agy');
      vi.spyOn(agyProvider, 'complete').mockResolvedValue({
        text: 'Deep architectural plan',
        usage: { promptTokens: 500, completionTokens: 300, totalTokens: 800 },
        model: 'agy-gemini-pro',
        provider: 'agy',
        durationMs: 450,
      });

      const res = await executeRoutedPrompt('Zaprojektuj architekturę rozproszoną i rozwiąż deadlock w klastrze bazodanowym');
      expect(res.text).toBe('Deep architectural plan');
      expect(res.route.tier).toBe('high');
      expect(res.route.provider).toBe('agy');
    });
  });
});
