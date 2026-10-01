# Walkthrough - Remote Dashboard with Local WebSocket Agent Workers

Prace zostały zrealizowane na dwóch osobnych gałęziach Git zgodnie z zapotrzebowaniem:

1. **`feat/websocket-agent-worker`**: Wdrożenie demona połączeniowego WebSocket WSS dla lokalnego agenta oraz obsługa przekazywania sesji PTY w zdalnym backendzie (`server.js`).
2. **`feat/hybrid-agent-target-ui`**: Wdrożenie w interfejsie użytkownika React (`TerminalView.tsx`) wyboru docelowego miejsca wykonania komend agentów (*Local Worker* vs *Remote Server* vs *Auto*).

---

## Wykonane Zmiany

### 1. Lokalny Worker Agent CLI (`scripts/local-agent-worker.js`)
- Utworzono lekki skrypt Node.js łączący się przez wyjściowe gniazdo `socket.io-client` do zdalnego serwera Dashboardu.
- Obsługuje lokalne wywołanie `node-pty` na komputerze dewelopera dla agentów CLI (`agy`, `openclaude`, `aider`, `claude`, shell).
- Uruchamianie lokalnie komendą:
  ```bash
  npm run agent:worker
  # Lub z podaniem adresu i tokena zdalnego serwera:
  DASHBOARD_SERVER_URL="https://s1.ct8.pl" DASHBOARD_TOKEN="twój_token" npm run agent:worker
  ```

### 2. Obsługa gniazd i przekierowań w Zdalnym Backendzie (`server.js`)
- Dodano mapę połączonych lokalnych workerów `activeWorkers`.
- Zaimplementowano punkt końcowy REST API `/api/agents/workers` pobierający listę aktywnych maszyn lokalnych.
- Przytrzymano i zmodyfikowano obsługę zdarzenia `spawn_terminal` – jeśli jest połączony lokalny worker (lub wybrany tryb `worker`), zdalny Dashboard przekazuje instrukcję uruchomienia komendy do lokalnego komputera i strumieniuje `stdout`/`stdin` w czasie rzeczywistym.

### 3. Hybrydowy Selektor UI w Interfejsie Terminala (`src/TerminalView.tsx`)
- W nagłówku okna Live Agent Terminal dodano przełącznik **Target**:
  - `⚡ Auto` – automatyczne użycie lokalnego workera, jeśli jest podłączony, a w przeciwnym razie serwera zdalnego.
  - `💻 Local Worker` – wymuszenie wykonania PTY na lokalnej masynie dewelopera.
  - `🌐 Remote Server` – wykonanie PTY bezpośrednio na serwerze zdalnym (VPS / CT8).

### 4. Testy Jednostkowe i Integracyjne (`src/local-agent-worker.test.js`)
- Utworzono testy dla rejestracji lokalnego workera przez WSS oraz dwukierunkowej komunikacji PTY.
- **Wszystkie 34 testy w projekcie przechodzą pomyślnie** (`npm test`).

---

## Weryfikacja i Wyniki Testów

```bash
> npm test

 RUN  v4.1.10 /path/to/dashboard

 ✓ src/local-agent-worker.test.js (2 tests) 55ms
 ✓ src/TerminalView.test.tsx (1 test) 119ms
 ✓ server.test.js (10 tests) 65ms
 ✓ src/AgentsView.integration.test.tsx (5 tests) 459ms
 ...
 Test Files  10 passed (10)
      Tests  34 passed (34)
```

---

## Historia Gałęzi Git
- `feat/websocket-agent-worker` (`ef01a80`): Zaimplementowano demona workera i logikę w `server.js`.
- `feat/hybrid-agent-target-ui` (`ad21330`): Dodano hybrydowy selektor w interfejsie użytkownika React.
