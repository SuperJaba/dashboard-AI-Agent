# Dashboard Web App Launcher

**Przesyłaj do `playwright screenshot`**: Najszybszy sposób na screenshot

## Wstęp

Dashboard to aplikacja webowa full-stack (React 19 + Express) uruchamiana przez Vite na porcie 5173.

Najlepsze narzędzie: `npx playwright screenshot` - natywne, szybkie, headless.

## Przesyłanie do `playwright screenshot`

```bash
# Screenshot z oczekiwaniem na załadowanie
npx playwright screenshot --browser chromium \
  http://localhost:5173 \
  /tmp/dashboard.png
```

## Alternatywa: `chromium-cli` (interaktywna sesja)

```bash
# Interaktywna sesja w Chromium (wymaga Chromium zainstalowane systemowo)
chromium-cli --url http://localhost:5173 --wait-load --interactive
```

**Uwaga:** `playwright screenshot` jest zalecane dla automatyzacji, `chromium-cli` dla interaktywnego przeglądania.

## Wymagania

- Node.js 18+
- Zainstalowane zależności (`npm install`)
- Opcjonalnie: `node-pty` dla terminalu SSH

## Budowanie

```bash
npm install
npm run build  # opcjonalne, dla produkcji
```

## Uruchamianie (ścieżka agenta)

```bash
# Sprawdź port
lsof -i :5173

# Najszybszy sposób: playwright screenshot
npx playwright screenshot --browser chromium \
  http://localhost:5173 \
  /tmp/dashboard.png

# Alternatywa: Chromium interaktywny
chromium-cli --url http://localhost:5173 --wait-load --interactive
```

## Uruchamianie (ścieżka człowieka)

```bash
npm run dev
```

Otwiera przeglądarkę na `http://localhost:5173`.

## Testowanie

```bash
npm test           # Vitest - jednostkowe testy
npm run test:e2e   # Playwright - e2e testy
```

## Gotychy

- **Port 5173 może być zajęty** - Vite automatycznie wybiera 5174 lub 5175
- **Backend wymaga portu 3001** - jeśli zajęty, użyj `npm run dev:frontend` tylko
- **node-pty** jest wymagane dla terminalu SSH - `npm install --save-optional node-pty`
- **Dev server może działać z poprzedniej sesji** - sprawdź aktualny port przed uruchomieniem

## Przykład: `playwright screenshot`

```bash
# Oczekiwane zachowanie:
# 1. Otwiera Chromium headless
# 2. Ładuje stronę na given URL
# 3. Oczekuje na networkidle
# 4. Zapisuje screenshot
# 5. Zamyka przeglądarkę

npx playwright screenshot --browser chromium \
  http://localhost:5173 \
  /tmp/dashboard.png
```

## Rozwiązywanie problemów

**Błąd: Port 5173/5174/5175 jest zajęty**
```bash
# Znajdź i zabij proces
lsof -i :5173 | grep LISTEN | awk '{print $2}' | xargs kill -9
```

**Błąd: Cannot find module 'node-pty'**
```bash
npm install --save-optional node-pty
```

**Dev server już działa**
```bash
# Sprawdź port
lsof -i :5173 -i :5174 -i :5175
# Uruchom playwright screenshot na odpowiednim porcie
```
