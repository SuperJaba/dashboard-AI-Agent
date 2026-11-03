import { describe, it, expect, beforeEach } from 'vitest';
import { scoreComplexity } from './complexityScorer.js';
import {
  selectModelRoute,
  localCircuitBreaker,
  getRouterStats,
  resetRouterCircuitBreaker,
  recordTaskExecution,
} from './modelRouter.js';

describe('T5 Model Routing', () => {
  beforeEach(() => {
    resetRouterCircuitBreaker();
  });

  describe('scoreComplexity', () => {
    it('rates simple questions as low', () => {
      expect(scoreComplexity('Jakie mamy dzisiaj zadania?')).toBe('low');
      expect(scoreComplexity('Format this json')).toBe('low');
    });

    it('rates feature/endpoint development as medium', () => {
      expect(scoreComplexity('Stwórz nowy endpoint i schemat walidacji')).toBe('medium');
      expect(scoreComplexity('Napisz test do serwisu')).toBe('medium');
    });

    it('rates refactoring and architectural tasks as high', () => {
      expect(scoreComplexity('Przeprowadź refaktoryzację architektury mikroserwisów')).toBe('high');
      expect(scoreComplexity('Security audit and performance optimization')).toBe('high');
    });

    it('rates very long prompts as high', () => {
      const longPrompt = 'a'.repeat(3000);
      expect(scoreComplexity(longPrompt)).toBe('high');
    });
  });

  describe('selectModelRoute', () => {
    it('routes low and medium tasks to LM Studio local models', () => {
      const expectedModel = process.env.LLM_LOCAL_MODEL || 'openai/gpt-oss-20b';
      const lowRoute = selectModelRoute('Wypisz listę plików');
      expect(lowRoute.provider).toBe('lm-studio');
      expect(lowRoute.model).toBe(expectedModel);
      expect(lowRoute.fallbackModel).toBe('granite-4.0-micro');

      const medRoute = selectModelRoute('Dodaj komponent walidacji formularza');
      expect(medRoute.provider).toBe('lm-studio');
    });

    it('routes high complexity tasks to AGY / Cloud', () => {
      const highRoute = selectModelRoute('Zaprojektuj architekturę rozproszoną i rozwiąż concurrency deadlock');
      expect(highRoute.provider).toBe('agy');
      expect(highRoute.tier).toBe('high');
    });

    it('falls back to AGY if circuit breaker is open', () => {
      localCircuitBreaker.recordFailure();
      localCircuitBreaker.recordFailure();
      localCircuitBreaker.recordFailure();

      const route = selectModelRoute('Proste zapytanie');
      expect(route.provider).toBe('agy');
      expect(route.fallbackReason).toBe('circuit_breaker_open');

      localCircuitBreaker.recordSuccess();
    });
  });

  describe('getRouterStats and telemetry tracking', () => {
    it('returns initial default statistics and circuit state', () => {
      const stats = getRouterStats();
      expect(stats.circuitBreakerState).toBe('CLOSED');
      expect(stats.primaryLocalModel).toBe(process.env.LLM_LOCAL_MODEL || 'openai/gpt-oss-20b');
      expect(stats.fallbackLocalModel).toBe('granite-4.0-micro');
      expect(stats.localTasks).toBeGreaterThanOrEqual(0);
    });

    it('records local and cloud task execution metrics accurately', () => {
      const before = getRouterStats();
      recordTaskExecution({ tier: 'low', durationMs: 250 });
      recordTaskExecution({ tier: 'high', durationMs: 1200 });

      const after = getRouterStats();
      expect(after.localTasks).toBe(before.localTasks + 1);
      expect(after.cloudTasks).toBe(before.cloudTasks + 1);
    });

    it('resets circuit breaker status via resetRouterCircuitBreaker', () => {
      localCircuitBreaker.recordFailure();
      localCircuitBreaker.recordFailure();
      localCircuitBreaker.recordFailure();
      expect(localCircuitBreaker.state).toBe('OPEN');

      const stats = resetRouterCircuitBreaker();
      expect(stats.circuitBreakerState).toBe('CLOSED');
      expect(localCircuitBreaker.state).toBe('CLOSED');
    });
  });
});
