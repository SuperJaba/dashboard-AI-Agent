import { describe, it, expect } from 'vitest';
import { scoreComplexity } from './complexityScorer.js';
import { selectModelRoute, localCircuitBreaker } from './modelRouter.js';

describe('T5 Model Routing', () => {
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
      const lowRoute = selectModelRoute('Wypisz listę plików');
      expect(lowRoute.provider).toBe('lm-studio');
      expect(lowRoute.model).toBe('unsloth/Qwen3.5-4B-MTP-GGUF');
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
});
