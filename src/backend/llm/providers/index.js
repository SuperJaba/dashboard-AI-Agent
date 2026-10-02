import { BaseProvider } from './baseProvider.js';
import { LmStudioProvider } from './lmStudioProvider.js';
import { AgyProvider } from './agyProvider.js';

export { BaseProvider, LmStudioProvider, AgyProvider };

const registry = new Map();

/**
 * Creates or retrieves a provider adapter instance.
 *
 * @param {'lm-studio'|'agy'|string} type - Provider type
 * @param {object} [options] - Configuration options
 * @returns {BaseProvider}
 */
export function createProvider(type, options = {}) {
  switch (type.toLowerCase()) {
    case 'lm-studio':
    case 'lmstudio':
    case 'local':
      return new LmStudioProvider(options);
    case 'agy':
    case 'cloud':
    case 'gemini':
      return new AgyProvider(options);
    default:
      throw new Error(`Unknown provider type: '${type}'. Supported types: 'lm-studio', 'agy'`);
  }
}

/**
 * Gets a cached singleton instance of a provider or creates it.
 *
 * @param {'lm-studio'|'agy'|string} type
 * @returns {BaseProvider}
 */
export function getProvider(type) {
  const key = type.toLowerCase();
  if (!registry.has(key)) {
    registry.set(key, createProvider(key));
  }
  return registry.get(key);
}

/**
 * Clears cached provider registry (useful in tests).
 */
export function clearProviderRegistry() {
  registry.clear();
}
