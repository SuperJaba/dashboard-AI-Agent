# Lista Zadań Projektu

## Skrypty i Środowisko Deweloperskie
- [x] NPM Script: dev:frontend (weryfikacja Vite i naprawa zależności i18next)
- [x] NPM Script: dev:backend (serwer Express API)
- [x] NPM Script: dev (jednoczesne uruchomienie frontendu i backendu)
- [x] NPM Script: build (kompilacja pakietu produkcyjnego Vite)
- [x] NPM Script: lint (weryfikacja Oxlint - 0 błędów i ostrzeżeń)
- [x] NPM Script: test (pełny zestaw 33 plików testowych Vitest)
- [x] NPM Script: test:sys (diagnostyka systemowa node --test)
- [x] NPM Script: test:e2e (testy end-to-end Playwright)
- [x] NPM Script: deploy:ct8 (optymalizacja i wdrożenie na serwer zdalny CT8)

## Funkcjonalności i Architektura
- [x] Dodać autoryzację do API (JWT i ochrona endpointów)
- [x] Przygotować endpointy analityczne i panel KPI (Recharts)
- [x] Opracować nowy widok kafelkowy w UI
- [x] Naprawić błąd z odświeżaniem tokenów
- [x] Izolacja przestrzeni Socket.IO (/pty i /dashboard)
- [x] Inteligentny dobór modelu LLM (Model Routing: LM Studio / AGY)
- [x] Internacjonalizacja i18n (język polski jako domyślny, obsługa angielskiego)
- [x] Synchronizacja zadań i auto-detekcja w projektach zdalnych
- [x] Flaga YOLO dla pomijania uprawnień przy uruchamianiu terminala

## Bezpieczeństwo i Hardening (Audyt 2026-10-30 - docs/SECURITY_AUDIT.md)
- [ ] [SEC-01] Usunięcie Auth Bypass w `/api/socket-info` (blokada wydawania 30-dniowych JWT niezalogowanym)
- [ ] [SEC-02] Zabezpieczenie resetu bazy użytkowników (usunięcie przycisku z `Login.tsx`, ochrona `POST /api/auth/reset` w produkcji)
- [ ] [SEC-03] Eliminacja arbitralnego SSRF w `/api/llm-proxy` (objęcie `authMiddleware`, walidacja i blokada adresów RFC1918/link-local)
- [ ] [SEC-04] Ochrona przed Command Injection w `gitService.js` (refaktoryzacja `execSync` na bezpieczną tablicę argumentów `execFileSync`)
- [ ] [SEC-05] Konfiguracja nagłówków bezpieczeństwa Content-Security-Policy (CSP) oraz HSTS w `securityHeaders.js`
- [ ] [SEC-06] Ścisła konfiguracja CORS (whitelist domen zamiast wildcarda `*` w Express i Socket.IO)
- [ ] [SEC-07] Wymuszenie bezpiecznego i trwałego `ENCRYPTION_KEY` w trybie produkcyjnym w `crypto.js`
- [ ] [SEC-08] Usunięcie akceptacji tokenu w query stringu (`?token=...`) w `authMiddleware.js`

