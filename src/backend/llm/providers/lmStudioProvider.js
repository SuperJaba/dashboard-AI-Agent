import { BaseProvider } from './baseProvider.js';
import fetch from 'node-fetch';

/**
 * LM Studio Provider Adapter (OpenAI-compatible REST API).
 * Connects to local LM Studio server (default: http://10.10.10.30:1234/v1).
 */
export class LmStudioProvider extends BaseProvider {
  /**
   * @param {object} [options]
   * @param {string} [options.baseUrl] - Base API URL
   * @param {string} [options.defaultModel] - Default model name
   * @param {number} [options.defaultTimeoutMs] - Default timeout in ms
   * @param {Function} [options.fetcher] - Custom fetch implementation
   */
  constructor(options = {}) {
    super('lm-studio', options);
    this.baseUrl = (options.baseUrl || process.env.LLM_LOCAL_URL || 'http://10.10.10.30:1234/v1').replace(/\/+$/, '');
    this.defaultModel = options.defaultModel || process.env.LLM_LOCAL_MODEL || 'openai/gpt-oss-20b';
    this.defaultTimeoutMs = options.defaultTimeoutMs || 30_000;
    this.fetcher = options.fetcher || fetch;
  }

  /**
   * Executes chat completion on LM Studio OpenAI-compatible endpoint.
   *
   * @param {string} prompt
   * @param {object} [opts]
   * @returns {Promise<{
   *   text: string,
   *   usage: { promptTokens: number, completionTokens: number, totalTokens: number },
   *   model: string,
   *   provider: string,
   *   durationMs: number
   * }>}
   */
  async complete(prompt, opts = {}) {
    const startTime = Date.now();
    const model = opts.model || this.defaultModel;
    const temperature = opts.temperature ?? 0.7;
    const maxTokens = opts.maxTokens ?? 2048;
    const timeoutMs = opts.timeoutMs ?? this.defaultTimeoutMs;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const url = `${this.baseUrl}/chat/completions`;
      const response = await this.fetcher(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(opts.apiKey ? { Authorization: `Bearer ${opts.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature,
          max_tokens: maxTokens,
        }),
        signal: opts.signal || controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`LM Studio HTTP ${response.status}: ${errorText || response.statusText}`);
      }

      const data = await response.json();
      const text = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || '';
      const usage = {
        promptTokens: data?.usage?.prompt_tokens ?? 0,
        completionTokens: data?.usage?.completion_tokens ?? 0,
        totalTokens: data?.usage?.total_tokens ?? 0,
      };

      const durationMs = Date.now() - startTime;

      return {
        text,
        usage,
        model: data?.model || model,
        provider: this.name,
        durationMs,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
