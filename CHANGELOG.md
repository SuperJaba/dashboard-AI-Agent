# Changelog

Wszystkie istotne zmiany w tym projekcie są dokumentowane w tym pliku zgodnie ze standardem [Keep a Changelog](https://keepachangelog.com/pl/1.0.0/) oraz [Conventional Commits](https://www.conventionalcommits.org/).

## [Unreleased] - 2026-11-04

### Dodano (Added)
- **Moduł Zarządzania Użytkownikami (`UsersView`):**
  - Tabela użytkowników z podglądem ról (`Administrator`, `Użytkownik`) i dat rejestracji.
  - Modal dodawania nowego użytkownika z walidacją formularza (nazwa użytkownika, hasło min. 8 znaków, rola).
  - Modal zmiany hasła (bezpośredni reset przez admina lub z podaniem dotychczasowego hasła przez użytkownika).
  - Modal bezpiecznego usuwania konta z blokadą samobójczego usunięcia aktywnego konta.
  - Ochrona tras API przez middleware `requireAdmin` (`/api/users/*`).
- **Globalny System Toastów (`ToastProvider` & `useToast`):**
  - Animowane powiadomienia typu `success`, `error`, `warning`, `info` oparte o Framer Motion.
  - Automatyczne wygaszanie z konfigurowalnym czasem trwania i możliwością ręcznego zamknięcia.
  - Dedykowany hook `useToast` oraz wydzielony kontekst `ToastContext` zgodny z React Fast Refresh.
  - Rejestracja `ToastProvider` w głównym drzewie aplikacji `src/main.tsx`.
- **Dostępność (a11y):**
  - Pełne wsparcie dla atrybutów WAI-ARIA w modalach zarządzania użytkownikami (`role="dialog"`, `aria-modal`, `aria-labelledby`, `role="alert"`).

### Zmieniono (Changed)
- **Architektura Themingu i Tokenów CSS:**
  - Wycofano sztywne kolory heksadecymalne w `LocalWorkerModal.tsx` i `UsersView.tsx` na rzecz semantycznych zmiennych CSS (`--bg-surface`, `--text-main`, `--role-admin-*`, `--role-user-*`, `--success-light`, `--danger-light`).
  - Ujednolicono kontrast i czytelność elementów interfejsu w trybie jasnym (`[data-theme="light"]`).
