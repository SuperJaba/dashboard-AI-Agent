/**
 * T5.1 — Task Complexity Scorer
 * Evaluates prompt/task difficulty and returns 'low', 'medium', or 'high'.
 */

const HIGH_COMPLEXITY_KEYWORDS = [
  'architecture', 'architektur', 'refactor', 'refaktor',
  'redesign', 'migracj', 'migration', 'distributed', 'rozproszon',
  'deadlock', 'concurrency', 'współbieżn', 'security audit', 'audyt bezpieczeństwa',
  'deep reasoning', 'benchmark', 'optymalizac', 'performance optimization'
];

const MEDIUM_COMPLEXITY_KEYWORDS = [
  'test', 'implement', 'stwórz', 'dodaj funkcję', 'add feature',
  'endpoint', 'api', 'schema', 'schemat', 'walidacja', 'validation',
  'komponent', 'component', 'regex', 'parser', 'database query'
];

export function scoreComplexity(prompt = '', context = {}) {
  const text = String(prompt).toLowerCase();
  const length = text.length;

  // 1. Length check: very long instructions usually have heavy context
  if (length > 2500 || (context.filesCount && context.filesCount > 5)) {
    return 'high';
  }

  // 2. High keyword check
  for (const kw of HIGH_COMPLEXITY_KEYWORDS) {
    if (text.includes(kw)) {
      return 'high';
    }
  }

  // 3. Medium check
  if (length > 500 || (context.filesCount && context.filesCount > 1)) {
    return 'medium';
  }

  for (const kw of MEDIUM_COMPLEXITY_KEYWORDS) {
    if (text.includes(kw)) {
      return 'medium';
    }
  }

  return 'low';
}
