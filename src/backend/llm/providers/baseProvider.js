/**
 * Base abstract class defining the unified LLM provider adapter interface.
 * All providers (LM Studio, AGY, etc.) must implement `complete(prompt, opts)`.
 */
export class BaseProvider {
  /**
   * @param {string} name - Provider identifier
   * @param {object} [options] - Provider configuration
   */
  constructor(name, options = {}) {
    if (new.target === BaseProvider) {
      throw new TypeError('Cannot construct BaseProvider instances directly');
    }
    this.name = name;
    this.options = options;
  }

  /**
   * Executes completion request against the provider.
   *
   * @param {string} prompt - Prompt text to generate completion for
   * @param {object} [opts] - Execution options
   * @param {string} [opts.model] - Target model name
   * @param {number} [opts.temperature] - Generation temperature (0.0 to 1.0)
   * @param {number} [opts.maxTokens] - Max generation tokens
   * @param {AbortSignal} [opts.signal] - Optional abort signal
   * @param {number} [opts.timeoutMs] - Request timeout in milliseconds
   * @returns {Promise<{
   *   text: string,
   *   usage: { promptTokens: number, completionTokens: number, totalTokens: number },
   *   model: string,
   *   provider: string,
   *   durationMs: number
   * }>}
   */
  async complete(prompt, opts = {}) { // eslint-disable-line no-unused-vars
    throw new Error(`complete() not implemented in provider '${this.name}'`);
  }
}
