import { BaseProvider } from './baseProvider.js';
import fetch from 'node-fetch';

/**
 * AGY Cloud Provider Adapter.
 * Connects to Google Antigravity / Gemini Cloud or configured cloud endpoint.
 */
export class AgyProvider extends BaseProvider {
  /**
   * @param {object} [options]
   * @param {string} [options.endpoint] - Cloud API endpoint
   * @param {string} [options.apiKey] - API key (or process.env.AGY_API_KEY / process.env.GEMINI_API_KEY)
   * @param {string} [options.defaultModel] - Default cloud model
   * @param {number} [options.defaultTimeoutMs] - Default timeout in ms
   * @param {Function} [options.fetcher] - Custom fetch implementation
   */
  constructor(options = {}) {
    super('agy', options);
    this.endpoint = (options.endpoint || process.env.AGY_ENDPOINT || 'https://api.antigravity.google/v1').replace(/\/+$/, '');
    this.apiKey = options.apiKey || process.env.AGY_API_KEY || process.env.GEMINI_API_KEY || '';
    this.defaultModel = options.defaultModel || process.env.LLM_CLOUD_MODEL || 'agy-gemini-pro';
    this.defaultTimeoutMs = options.defaultTimeoutMs || 45_000;
    this.fetcher = options.fetcher || fetch;
  }

  /**
   * Executes completion request against AGY Cloud service.
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
    const maxTokens = opts.maxTokens ?? 4096;
    const apiKey = opts.apiKey || this.apiKey;
    const timeoutMs = opts.timeoutMs ?? this.defaultTimeoutMs;

    // If no real API key is configured and not using a local mock endpoint,
    // generate a structured simulated response for development / fallback continuity
    if (!apiKey && !opts.forceRemote) {
      const estimatedTokens = Math.max(1, Math.ceil(prompt.length / 4));
      return {
        text: `[AGY Cloud Simulation — ${model}] Response generated for prompt: ${prompt.slice(0, 80)}...`,
        usage: {
          promptTokens: estimatedTokens,
          completionTokens: 25,
          totalTokens: estimatedTokens + 25,
        },
        model,
        provider: this.name,
        durationMs: Date.now() - startTime,
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const url = `${this.endpoint}/chat/completions`;
      const response = await this.fetcher(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
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
        throw new Error(`AGY Cloud HTTP ${response.status}: ${errorText || response.statusText}`);
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
