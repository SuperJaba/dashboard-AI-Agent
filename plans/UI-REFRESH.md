# Plan Odświeżenia UI/UX & Theming (UI-REFRESH)

Dokument określa zakres, architekturę oraz harmonogram usprawnień wizualnych, interakcyjnych i dostępnościowych w Dashboardzie AI Agents.

---

## 1. Cele Główne
1. **Dopracowanie Themingu (Dark & Light Mode):** Eliminacja sztywnych kolorów (inline `color: 'white'`, `#0f172a`), pełne przejście na tokeny CSS (`var(--text-main)`, `var(--bg-surface)`).
2. **Globalny System Powiadomień (Toast Notifications):** Zastąpienie lokalnych `setTimeout` i prostych boksów alertów zunifikowanym, animowanym providerem toastów opartym o Framer Motion.
3. **Spójność Komponentów i Mikrointerakcji:** Ujednolicenie stylistyki modali, przycisków, badge'y statusowych i formularzy w całym ekosystemie (Tailwind v4).
4. **Dostępność i Ergonomia (WCAG 2.1 AA):** Zachowanie pełnej dostępności klawiaturowej, kontrastów barwnych, atrybutów ARIA oraz wsparcia dla `prefers-reduced-motion`.

---

## 2. Audyt Obecnego Stanu

### 2.1 Mocne Strony
- Nowoczesny **Dark Glassmorphism** (promieniste gradienty, subtelna siatka 24×24px, rozmycia `backdrop-filter: blur(20px)`).
- Ustrukturyzowane tokeny CSS w `:root` (`--primary: #4F46E5`, `--secondary: #38BDF8`, `--bg-color: #090d16`).
- Trwałość preferencji motywu (`localStorage` + baza danych PostgreSQL per-użytkownik).
- Pełna polska lokalizacja etykiet i komunikatów.
- Asynchroniczne ładowanie ciężkich podstron (`React.lazy` + `Suspense`).

### 2.2 Zidentyfikowane Długi i Obszary do Poprawy
- **Kontrast w Trybie Jasnym (`[data-theme="light"]`):** Niektóre modale i formularze mają sztywny kolor tekstu lub tła zamiast zmiennych CSS, co obniża czytelność w trybie `light`.
- **Lokalne powiadomienia o akcjach:** Każdy widok (`UsersView`, `App`, `LocalWorkerModal`) implementuje własny stan `actionSuccess` i `setTimeout(() => ..., 4000)`.
- **Elementy formularzy:** Różnice w paddingach i obramowaniach selectów oraz inputów pomiędzy starszymi a nowszymi widokami.
- **Responsywność tabel:** Tabele przy mniejszych rozdzielczościach wymagają lepszego zachowania kolumn i widoków kartowych dla urządzeń mobilnych.

---

## 3. Fazy Realizacji

### Faza 1: Ujednolicenie Tokenów i Pełna Obsługa Trybu Jasnego
- [x] Zastąpienie twardo zakodowanych kolorów (`color: 'white'`, `background: '#1e293b'`) tokenami `var(--text-main)`, `var(--bg-surface)` i `var(--border-color)` w:
  - `src/App.tsx` (modale ustawień, konfiguracji serwera, dodawania projektu)
  - `src/UsersView.tsx` (opcje selecta ról, modale haseł)
  - `src/components/ModelRoutingSettings.tsx`
  - `src/LocalWorkerModal.tsx`
- [x] Przetestowanie kontrastów tekstu w trybie `light` narzędziem do audytu a11y (WCAG AA min. 4.5:1).
- [x] Dopracowanie obramowań i cieni w `[data-theme="light"]` (`--glass-shadow`, `--glass-border`).

### Faza 2: Globalny System Toastów (Notification Provider)
- [x] Stworzenie `src/components/ToastProvider.tsx`:
  - Typy: `success`, `error`, `info`, `warning`.
  - Animowane wejście i wyjście za pomocą Framer Motion (`AnimatePresence`).
  - Możliwość zamykania kliknięciem, auto-dismiss (domyślnie 4s).
  - Wsparcie dla kolejkowania wielu toastów.
- [x] Udostępnienie hooka `useToast()` w całej aplikacji.
- [x] Migracja dotychczasowych komunikatów sukcesu/błędu w `UsersView`, `App`, `RepoStatus`, `ModelRoutingSettings` do `useToast()`.

### Faza 3: Ujednolicenie Komponentów Bazowych (UI Primitives)
- [x] Stworzenie spójnych komponentów bazowych lub klas pomocniczych Tailwind:
  - `Modal`: Zunifikowany szkielet okna modalnego (nagłówek z ikoną, treść, pasek akcji z przyciskami Anuluj/Zapisz).
  - `Badge`: Ustandaryzowane warianty ról i statusów (`primary`, `success`, `warning`, `danger`, `neutral`).
  - `FormField`: Kontener na etykietę, input/select oraz komunikat błędu walidacji.
- [x] Ujednolicenie mikrointerakcji na przyciskach (`active:scale-[0.98]`, płynny transition 150ms).

### Faza 4: Dostępność i Responsywność Mobilna
- [x] Weryfikacja pułapek fokusu (`focus trap`) we wszystkich modalach.
- [x] Dopracowanie paska bocznego na ekranach `< 768px` (wysuwany drawer z tłem overlay).
- [x] Poprawa responsywności tabeli użytkowników i listy projektów na wąskich ekranach (widok siatki / kart).

### Faza 5: Testy i Weryfikacja
- [x] Napisanie testów jednostkowych Vitest dla `ToastProvider` oraz nowych komponentów bazowych.
- [x] Uruchomienie pełnego audytu dostępności `npm test -- src/__tests__/a11y.test.tsx`.
- [x] Weryfikacja linterem `npm run lint` (0 błędów i 0 ostrzeżeń w Oxlint).
- [x] Test produkcyjnego buildu `npm run build`.

---

## 4. Wytyczne Techniczne i Konwencje
- **Język interfejsu:** Wyłącznie język polski (zgodnie z `AGENTS.md`).
- **Styling:** Tailwind CSS v4 via `@tailwindcss/postcss` oraz CSS Variables w `src/index.css`.
- **Ikony:** `lucide-react` (jednolity rozmiar 16-20px w akcjach, 24-28px w nagłówkach).
- **Animacje:** Subtelne, z poszanowaniem `@media (prefers-reduced-motion: reduce)`.
