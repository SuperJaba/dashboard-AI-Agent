# Feature Plan – Resetowanie hasła użytkownika (FA‑code + e‑mail, ważność 4‑8 h)

## 1️⃣ Cel
Umożliwić użytkownikowi odzyskanie dostępu przy pomocy jednorazowego kodu weryfikacyjnego (FA‑code) wysyłanego na podany adres e‑mail. Kod jest ważny **od 4 h do 8 h** (domyślnie 6 h).

## 2️⃣ Backend – API i logika

| Endpoint | Metoda | Payload | Działanie |
|----------|--------|---------|-----------|
| **`/api/auth/forgot-password`** | **POST** | `{ email: string }` | 1️⃣ Wyszukuje użytkownika po e‑mailu (bez podawania, czy konto istnieje).\n2️⃣ Generuje losowy kod (≥ 6 znaków alfanumerycznych).\n3️⃣ Hashuje kod (`bcrypt` 12 rounds) i zapisuje rekord w tabeli **`password_resets`** (id, userId, codeHash, expiresAt, createdAt).\n4️⃣ Wysyła e‑mail z szablonem (kod + link do `/reset-password?email=…`). |
| **`/api/auth/reset-password`** | **POST** | `{ email: string, code: string, newPassword: string }` | 1️⃣ Pobiera rekord `password_resets` dla podanego `email`.\n2️⃣ `bcrypt.compare(code, codeHash)`.\n3️⃣ Sprawdza, czy `expiresAt > now`.\n4️⃣ Jeśli OK → hashuje `newPassword` i aktualizuje `users.password`.\n5️⃣ Usuwa/oznacza rekord jako użyty. |

### Model `PasswordReset`
```ts
export interface PasswordReset {
  id: string;          // UUID
  userId: string;      // FK → users.id
  codeHash: string;    // bcrypt hash
  expiresAt: Date;     // now + expiryMs
  createdAt: Date;
}
```

### Konfiguracja (`src/backend/config.ts`)
```ts
export const PASSWORD_RESET_EXPIRY_MS = 6 * 60 * 60 * 1000; // 6 h (można ustawić 4‑8 h)
```

### Rate‑limit
`express-rate-limit` na `/forgot-password`: **max 5 żądań / IP / godzina**.

### Audyt
Logi (`audit.log`) → `action: password_reset_requested` / `action: password_reset_completed`, `userId`, `timestamp`. **Nie zapisujemy kodu ani hasła**.

## 3️⃣ Frontend – UI/UX

| Strona | Komponent | Opis |
|--------|-----------|------|
| **Forgot Password** (`/reset-password-request`) | `ForgotPasswordForm` | Pole **e‑mail**, przycisk **Wyślij kod**. Po sukcesie:„Wysłaliśmy kod na podany e‑mail (ważny 4‑8 h)”. |
| **Reset Password** (`/reset-password`) | `ResetPasswordForm` | Pola **Kod**, **Nowe hasło**, **Powtórz hasło**. Walidacja po stronie klienta (hasło ≥ 8 znaków, co najmniej 1 mała, 1 wielka, 1 liczba). Po sukcesie → przekierowanie do logowania z komunikatem „Hasło zostało zmienione”. |
| **Success** | – | Strona potwierdzająca zmianę hasła. |

Komponenty bazują na istniejących `Form`, `Input`, `Button` w `src/components/`.

## 4️⃣ E‑mail – szablon
`src/backend/email/templates/passwordReset.html`
- Powitanie (opcjonalnie imię).\n- **Kod** wyświetlony w monospaced.\n- Link: `https://dashboard.example.com/reset-password?email={email}`.\n- Informacja: “Kod ważny przez **6 h**”.\n- Ostrzeżenie: “Jeśli nie prosiłeś o reset, zignoruj tę wiadomość”.

Wysyłka przy pomocy istniejącego `emailService.sendMail(to, subject, html)`.

## 5️⃣ Baza danych – migracja
```sql
CREATE TABLE password_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_password_resets_user_id ON password_resets(user_id);
```
- Dodaj plik migracji `scripts/migrations/20231104_add_password_resets.sql`.

## 6️⃣ Testy
### Unit (src/__tests__/auth/)
- `forgotPassword.test.ts` – generowanie kodu, zapis w DB, wywołanie `emailService`.
- `resetPassword.test.ts` – prawidłowy kod → zmiana hasła; kod po wygaśnięciu → 400; nieprawidłowy kod → 400.

### E2E (Playwright)
1. Wypełnij formularz “Zapomniałem hasła”.\n2. Przechwyć e‑mail w mocku (np. `maildev`).\n3. Otwórz link, wpisz kod i nowe hasło.\n4. Zaloguj się nowym hasłem – oczekiwany sukces.

## 7️⃣ Bezpieczeństwo & compliance
| Zasada | Implementacja |
|--------|----------------|
| **Nie ujawniać** | Odpowiedź zawsze: “Jeśli konto istnieje, wysłaliśmy instrukcje”. |
| **Hashowanie kodu** | `bcrypt` – nigdy nie przechowujemy kodu w czystej postaci. |
| **Rate‑limit** | Ograniczenie brute‑force. |
| **TLS** | Endpointy dostępne wyłącznie przez HTTPS (już skonfigurowane). |
| **Audyt** | Logi nie zawierają kodu ani hasła. |

## 8️⃣ Dokumentacja
- `docs/API_PASSWORD_RESET.md` – opis endpointów, przykłady `cURL`.\n- `docs/SECURITY.md` – sekcja *Password reset flow*.\n- `CHANGELOG.md` – wpis: `feat(auth): add email‑based password reset with expiring FA‑code (4‑8 h)`.

## 9️⃣ Roadmap (2‑dni sprint)
| Dzień | Zadania |
|------|----------|
| **1** | Migracja DB + model `PasswordReset`; implementacja endpointów; szablon e‑mail. |
| **2** | Frontend: `ForgotPasswordForm`, `ResetPasswordForm`, routing; konfiguracja `PASSWORD_RESET_EXPIRY_MS` i rate‑limit. |
| **3** | Unit tests + `npm test` w CI. |
| **4** | E2E Playwright tests, weryfikacja pełnego flow. |
| **5** | Code review, lint, CI pass; deploy na staging (`npm run deploy:ct8`). |
| **6** | Aktualizacja dokumentacji, `CHANGELOG.md`; merge do `dev` → tag `v0.1.2`. |

## 10️⃣ Wdrożenie
1. **Branch**: `feature/password-reset`.\n2. **Pull Request**: `feat(auth): email‑based password reset`.\n3. **CI**: `npm run test && npm run lint`.\n4. **Merge** → `dev` → `release` → tag `v0.1.2`.

---

*Plan zapisany w* `plans/password_reset_plan.md`.
