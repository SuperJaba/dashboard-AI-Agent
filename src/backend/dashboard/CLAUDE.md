# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architektura i Kluczowe Subsystemy

### 🚀 Proces Wdrożenia (Deployment System)
System wdrożeniowy jest centralnym elementem repozytorium, zarządzającym procesami deploymentu aplikacji na środowisko CT8 (`*.jagger2.ct8.pl`). Główna logika znajduje się w klasie `DeployService` (`src/backend/deploy/deployService.js`), która orkistruje cały cykl życia wdrożenia:

1.  **Identyfikacja Aplikacji:** Metoda `getDeployableApps()` skanuje repozytorium i katalogi projektów, aby zebrać listę dostępnych aplikacji (np. Dashboard, Invoice Splitter).
2.  **Kontrola Stanu:** Klasa utrzymuje stan wdrożenia (`this.state`: 'IDLE', 'RUNNING', 'SUCCESS', 'FAILED') oraz logi dla każdego docelowego celu (`targetStates`).
3.  **Wykonanie Wdrożenia:** Metoda `startDeploy()` uruchamia procesy asynchronicznie na wszystkich wybranych celach (domyślnie `ct8`), używając `Promise.allSettled()`.
4.  **Logika Celów:** Proces jest podzielony na sekwencyjne kroki (`STEP 0` do `STEP 4`) wewnątrz metody `runSingleTarget()`, co symuluje złożone operacje infrastrukturalne (np. walidacja poświadczeń, wysyłanie plików, migracja DB).
5.  **Komunikacja:** Wykorzystywany jest Socket.io (`this.broadcast(...)`) do przekazywania statusów i logów w czasie rzeczywistym do interfejsu użytkownika (Terminal UI).

### 🛡️ Warstwa API i Bezpieczeństwo (API Client & Security)
Cała komunikacja z zewnętrznymi usługami odbywa się przez moduł `src/shared/api-client/client.ts`. Kluczowe aspekty to:

*   **Walidacja Promptów:** Wszystkie prompty przechodzące do LLM muszą być walidowane za pomocą schematu `SecurePromptSchema` (`src/shared/api-client/schemas.ts`). Ten mechanizm blokuje znane wzorce iniekcji (np. `/ignore previous instructions/i`) na poziomie kodu, zanim trafią one do modelu językowego.
*   **Obsługa Błędów:** Definicja `ApiError` (`src/shared/api-client/error.ts`) zapewnia ujednolicony sposób obsługi błędów API, rozróżniając błędy sieciowe (status 0) od błędów serwera z kodami biznesowymi.

### 🧠 Routing Modelu LLM
Logika decyzyjna o wyborze modelu i dostawcy jest scentralizowana w `src/backend/llm/modelRouter.js`:

*   **`selectModelRoute(prompt, context)`:** Określa optymalny poziom (tier) routingu na podstawie złożoności promptu (`scoreComplexity`).
*   **Mechanizm Awaryjny (Circuit Breaker):** Użycie `localCircuitBreaker` zapewnia odporność systemu. W przypadku zbyt wielu błędów lokalnego modelu, router automatycznie przechodzi w stan 'OPEN', wymuszając użycie chmurowego dostawcy AGY/Gemini Pro.
*   **Fallback:** Implementacja obsługuje sekwencyjny fallback: Lokalny Model $\rightarrow$ Lokalny Fallback Model $\rightarrow$ Chmura (AGY).

## Procesy Rozwojowe i Testowanie

### 🛠️ Komendy deweloperskie
Poniższe komendy są kluczowe dla pracy w tym projekcie:

*   **Uruchomienie aplikacji:** `npm run dev` lub `yarn dev` (zależnie od konfiguracji).
*   **Testy jednostkowe:** Używaj schematów testowych z katalogu `src/__tests__` (np. `npx jest src/shared/api-client/schemas.test.ts`).
*   **Linting & Formatowanie:** Exekutuj linter na całym projekcie, aby utrzymać spójność kodu.

### 📚 Structure Overview
Leżące w bazie wiedzy schematy (Zod) definiują structure danych dla:
*   `ProjectSchema`: Reprezentuje projekt deweloperski (ID, name, path, branch).
*   `AgentSchema`: Définiuje agentów systemowych.
*   `SettingsSchema`: Zarządza globalnymi ustawieniami LLM i API.

---
**Co zostało pominięte:** Zgodnie z wytycznymi, nie uwzględniono ogólnych praktyk deweloperskich ani listy każdego pliku/komponentu, ponieważ są one łatwo dostępne poprzez eksplorację kodu (np. `codegraph_explore`).