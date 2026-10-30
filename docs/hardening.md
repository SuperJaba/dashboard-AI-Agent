# Plan Hardeningu i Bezpieczeństwa Aplikacji (docs/hardening.md)

Dokument zawiera całościowy plan audytu, konfiguracji i wdrożenia mechanizmów obronnych (Security Hardening) dla środowiska backendowego i frontendowego Dashboard AI Agent.

---

## 1. Audyt Obecnego Stanu Bezpieczeństwa (Current Posture)

Na podstawie przeglądu architektury (`server.js`, `src/backend/`):

| Obszar | Stan obecny | Poziom ryzyka | Uwagi |
| :--- | :--- | :--- | :--- |
| **Helmet** | Brak aktywnego pakietu `helmet` lub brak pełnej konfiguracji CSP / HSTS / Permissions | 🔴 Wysoki | Brak ochrony przed wstrzykiwaniem skryptów (XSS) i osadzaniem w zewnętrznych ramkach |
| **CORS** | Domyślne `app.use(cors())` oraz Socket.IO `origin: '*'` zezwalające na dowolny origin | 🔴 Wysoki | Dowolna strona trzecia otwarta w przeglądarce może wykonywać żądania w imieniu zalogowanego użytkownika |
| **Rate Limiting** | `express-rate-limit` zainstalowany w `package.json`, używany jedynie lokalnie w `authRouter.js` | 🟠 Średni | Brak ochrony globalnej API, brak limitów na kosztownych operacjach (`/api/deploy`, `/api/git`, `/api/projects`) |
| **HSTS / HTTPS** | Brak nagłówka `Strict-Transport-Security` | 🟠 Średni | Ryzyko ataków SSL stripping i połączeń nieszyfrowanych |
| **Content-Type Security** | Ograniczenie rozmiaru `1mb`, ale brak ścisłej walidacji typu MIME `Content-Type` na żądaniach mutujących | 🟡 Niski / Średni | Potencjalne próby ominięcia parsera body lub Content-Type Confusion |
| **JWT Auth** | Podstawowa weryfikacja JWT bez rotacji tokenów i unieważniania (blacklist) | 🟡 Średni | Tokeny długożyjące (30 dni) dla workerów |

---

## 2. Kluczowe Fazy Wdrożenia

### Faza 1: Aktywny Helmet z pełną konfiguracją Content-Security-Policy (CSP)
**Cel:** Zapobieganie atakom Cross-Site Scripting (XSS), Clickjacking oraz data injection.

* **Zależność:** Instalacja pakietu `helmet` (lub rozbudowa defensywnego middleware `securityHeaders.js`).
* **Zalecana konfiguracja CSP dla Vite + XTerm + Socket.IO:**
  * `default-src`: `'self'`
  * `script-src`: `'self'` `'unsafe-inline'` `'unsafe-eval'` (niezbędne dla HMR deweloperskiego Vite oraz dynamicznych modułów)
  * `style-src`: `'self'` `'unsafe-inline'` https://fonts.googleapis.com (dla dynamicznych stylów Tailwind i XTerm.js)
  * `font-src`: `'self'` https://fonts.gstatic.com data:
  * `img-src`: `'self'` data: blob: https:
  * `connect-src`: `'self'` `ws:` `wss:` http://localhost:* https://dashboard.jagger2.ct8.pl (Socket.IO i API)
  * `frame-ancestors`: `'none'` (blokada osadzania w `<iframe>`)
  * `upgradeInsecureRequests`: aktywne w środowisku produkcyjnym (`NODE_ENV === 'production'`).
* **Dodatkowe nagłówki włączone przez Helmet:**
  * `xContentTypeOptions: true` (`nosniff`)
  * `xFrameOptions: { action: 'deny' }`
  * `xXssProtection: false` (zgodnie ze współczesnym standardem W3C, nagłówek wyłączony na rzecz CSP)
  * `referrerPolicy: { policy: 'strict-origin-when-cross-origin' }`
  * `dnsPrefetchControl: { allow: false }`

---

### Faza 2: CORS ze ścisłym Whitelistingiem
**Cel:** Blokada nieautoryzowanych wywołań cross-origin z niezaufanych domen.

* **Dozwolone originy (Whitelista):**
  * Środowisko lokalne: `http://localhost:5173`, `http://127.0.0.1:5173`, `http://localhost:3001`
  * Środowisko zdalne / produkcyjne: `https://dashboard.jagger2.ct8.pl`, `https://s1.ct8.pl`
  * Zmienna środowiskowa `ALLOWED_ORIGINS` umożliwiająca konfigurację dodatkowych domen bez modyfikacji kodu.
* **Implementacja w Express:**
  ```javascript
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
    : ['http://localhost:5173', 'http://127.0.0.1:5173', 'https://dashboard.jagger2.ct8.pl'];

  const corsOptions = {
    origin: (origin, callback) => {
      // Zezwalaj na żądania bez nagłówka Origin (np. curl, aplikacje CLI, workers)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('CORS Policy: Origin niedozwolony'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  };
  ```
* **Implementacja w Socket.IO:** Zsynchronizowanie konfiguracji gniazd `io` z tą samą regułą whitelisty.

---

### Faza 3: Wielopoziomowy Rate Limiting (`express-rate-limit`)
**Cel:** Ochrona serwera przed atakami Brute Force, DoS oraz nadmiarowymi pętlami zapytań agentów.

1. **Global API Limiter:**
   * Zastosowanie dla wszystkich tras `/api/*` (z wyjątkiem webhooków i telemetryki SSE).
   * Limit: 300 żądań na 15 minut na dany adres IP.
   * Standardowe nagłówki RFC: `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`.
2. **Krytyczne Endpointy (Strict Limiter):**
   * `/api/deploy/*`, `/api/servers/execute`, `/api/git/commit`, `/api/git/push`:
   * Limit: 30 żądań na 10 minut na IP (zapobieganie przeciążeniu zdalnych maszyn SSH i procesów git).
3. **Pominięcie w środowisku testowym:**
   * `skip: () => process.env.NODE_ENV === 'test'` w celu uniknięcia fałszywych błędów w testach Vitest.

---

### Faza 4: Ścisłe HTTPS i HTTP Strict Transport Security (HSTS)
**Cel:** Zapewnienie integralności przesyłanych danych i wymuszenie szyfrowania SSL/TLS.

* **Nagłówek HSTS:**
  * Wartość produkcyjna: `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
  * Włączany wyłącznie przy `NODE_ENV === 'production'` lub za nagłówkiem `x-forwarded-proto === 'https'`.
* **Wymuszanie HTTPS (HTTPS Redirect Middleware):**
  * Jeśli żądanie przychodzi z nagłówkiem `x-forwarded-proto: http` na serwerze produkcyjnym, następuje natychmiastowe przekierowanie 301 na wersję `https://`.

---

### Faza 5: Bezpieczeństwo Content-Type i Walidacja MIME
**Cel:** Ochrona parserów body przed nieoczekiwanymi payloadami i manipulacjami typem zawartości.

* **Nagłówek `X-Content-Type-Options: nosniff`** na każdym żądaniu.
* **Strict Content-Type Guard Middleware:**
  * Dla metod mutujących stan (`POST`, `PUT`, `PATCH`):
  * Weryfikacja, czy nagłówek `Content-Type` zawiera `application/json` (lub `multipart/form-data` w przypadku uploadu plików).
  * Odrzucanie zapytań z pustym lub niespójnym typem zawartości kodem `415 Unsupported Media Type`.
* **Ochrona przed Payload Bombs:**
  * Utrzymanie limitu `1mb` dla parsera JSON (`express.json({ limit: '1mb' })`).

---

## 3. Plan Testów i Weryfikacji (TDD Matrix)

Każda zmiana musi być objęta testami automatycznymi w Vitest:

| Test Case | Plik testowy | Oczekiwany rezultat |
| :--- | :--- | :--- |
| **TC-SEC-01** Weryfikacja nagłówków bezpieczeństwa | `tests/security/headers.test.js` | Obecność nagłówków `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy` |
| **TC-SEC-02** Blokada CORS dla obcego origin | `tests/security/cors.test.js` | Żądanie z `Origin: http://evil-site.com` odrzucane z błędem CORS / brak nagłówka Access-Control |
| **TC-SEC-03** Przepuszczenie dozwolonego origin | `tests/security/cors.test.js` | Żądanie z `Origin: https://dashboard.jagger2.ct8.pl` zwraca `Access-Control-Allow-Origin` |
| **TC-SEC-04** Rate Limiter Globalny | `tests/security/ratelimit.test.js` | Przekroczenie limitu żądań zwraca status `429 Too Many Requests` |
| **TC-SEC-05** Content-Type Enforcer | `tests/security/content-type.test.js` | `POST /api/settings` z `Content-Type: text/plain` zwraca status `415` |
| **TC-SEC-06** HSTS w trybie produkcyjnym | `tests/security/headers.test.js` | Odpowiedź zawiera `Strict-Transport-Security` przy `NODE_ENV=production` |

---

## 4. Analiza Ryzyka i Plan Wycofania (Rollback Plan)

* **Ryzyko zbyt restrykcyjnego CSP:**
  * *Zagrożenie:* Zablokowanie połączenia Socket.IO w przeglądarce lub ładowania skryptów/stylów Vite.
  * *Mitygacja:* Zastosowanie CSP w trybie `Content-Security-Policy-Report-Only` w fazie przejściowej lub przetestowanie pełnego workflow z konsolą deweloperską.
* **Ryzyko zablokowania workerów przez CORS:**
  * *Zagrożenie:* CLI worker działający poza przeglądarką może nie przesyłać nagłówka `Origin`.
  * *Mitygacja:* Reguła CORS dopuszcza żądania, gdzie `!req.headers.origin` (żądania serwer-serwer i terminale CLI).
