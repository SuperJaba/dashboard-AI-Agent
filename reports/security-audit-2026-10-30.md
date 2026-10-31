# Security Audit Report - 2026-10-30

Pełny raport bezpieczeństwa i plan utwardzenia (Hardening) został zapisany w [docs/SECURITY_AUDIT.md](../docs/SECURITY_AUDIT.md).
Poniżej znajduje się podsumowanie zadań dodanych do backlogu:

## Zadania do wdrożenia (zgodnie z tasks.md):
- [x] Naprawa Auth Bypass w `/api/socket-info` (SEC-01)
- [x] Zabezpieczenie / usunięcie endpointu resetu bazy `POST /api/auth/reset` i przycisku w UI (SEC-02)
- [x] Eliminacja SSRF w `/api/llm-proxy` przez wymuszenie autoryzacji i walidację `x-target-url` (SEC-03)
- [x] Zabezpieczenie przed Command Injection w `gitService.js` za pomocą `execFileSync` (SEC-04)
- [x] Konfiguracja nagłówków Content-Security-Policy (CSP) oraz HSTS (SEC-05)
- [x] Ograniczenie dozwolonych źródeł CORS dla Express i Socket.IO (SEC-06)
- [x] Wymuszenie bezpiecznego `ENCRYPTION_KEY` w trybie produkcyjnym (SEC-07)
- [x] Wyłączenie przekazywania tokenów JWT w query stringu `?token=` (SEC-08)
