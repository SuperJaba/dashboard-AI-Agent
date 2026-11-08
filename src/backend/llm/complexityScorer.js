/**
 * T5.1 — Task Complexity Scorer
 * Evaluates prompt/task difficulty and returns 'low', 'medium', or 'high'.
 *
 * Algorithm: Multi-stage keyword matching with length-based thresholds.
 * - High complexity (>2500 chars OR high keywords): Direct to cloud AGY/Gemini Pro
 * - Medium complexity (>500 chars OR medium keywords): Local LM Studio (primary)
 * - Low complexity: Simple local queries
 *
 * Circuit Breaker Integration: High-complexity tasks bypass circuit breaker
 * and always use cloud provider for reliability.
 */

// ============================================================
// T5 Scoring Algorithm Configuration
// ============================================================
// Keywords indicating complex architectural/technical tasks requiring cloud LLM
const HIGH_COMPLEXITY_KEYWORDS = [
  'architecture', 'architektur', 'refactor', 'refaktor',
  'redesign', 'migracj', 'migration', 'distributed', 'rozproszon',
  'deadlock', 'concurrency', 'współbieżn', 'security audit', 'audyt bezpieczeństwa',
  'deep reasoning', 'benchmark', 'optymalizac', 'performance optimization'
];

// Keywords indicating implementation tasks suitable for local LM Studio
const MEDIUM_COMPLEXITY_KEYWORDS = [
  'test', 'implement', 'stwórz', 'dodaj funkcję', 'add feature',
  'endpoint', 'api', 'schema', 'schemat', 'walidacja', 'validation',
  'komponent', 'component', 'regex', 'parser', 'database query'
];

/**
 * Evaluates prompt complexity using T5 scoring algorithm.
 *
 * Scoring Logic (in order):
 * 1. Length threshold: >2500 chars or >5 files → HIGH
 * 2. High keyword match → HIGH (architectural tasks)
 * 3. Length threshold: >500 chars or >1 file → MEDIUM
 * 4. Medium keyword match → MEDIUM (implementation tasks)
 * 5. Default: LOW (simple queries)
 *
 * @param {string} prompt - The task prompt to evaluate complexity
 * @param {object} [context] - Optional context with filesCount for length-based scoring
 * @returns {'low'|'medium'|'high'} Complexity tier classification
 */
export function scoreComplexity(prompt = '', context = {}) {
  const text = String(prompt).toLowerCase();
  const length = text.length;

  // Stage 1: Very long instructions require cloud LLM for context handling
  if (length > 2500 || (context.filesCount && context.filesCount > 5)) {
    return 'high';
  }

  // Stage 2: High complexity keywords indicate architectural work
  for (const kw of HIGH_COMPLEXITY_KEYWORDS) {
    if (text.includes(kw)) {
      return 'high';
    }
  }

  // Stage 3: Medium length or multiple files indicates implementation work
  if (length > 500 || (context.filesCount && context.filesCount > 1)) {
    return 'medium';
  }

  // Stage 4: Medium complexity keywords
  for (const kw of MEDIUM_COMPLEXITY_KEYWORDS) {
    if (text.includes(kw)) {
      return 'medium';
    }
  }

  // Default classification: simple queries handled locally
  return 'low';
}
