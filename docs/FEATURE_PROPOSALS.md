# Propozycje Nowych Funkcji i Architektury (Feature Proposals & Roadmap Backlog)

Dokument zawiera zestawienie szczegółowych propozycji rozwoju aplikacji **Dashboard**, uwzględniających zarządzanie serwerami przez **Ansible**, zaawansowaną automatyzację agentów AI, narzędzia DevOps, obserwowalność oraz bezpieczeństwo.

---

## Spis Treści

1. [Orkiestracja i Zarządzanie Serwerami przez Ansible](#1-orkiestracja-i-zarządzanie-serwerami-przez-ansible)
2. [Zaawansowane Przepływy Pracy Agentów AI (Agentic Workflows)](#2-zaawansowane-przepływy-pracy-agentów-ai-agentic-workflows)
3. [Narzędzia DevOps & Administracja CT8/VPS](#3-narzędzia-devops--administracja-ct8vps)
4. [Obserwowalność, Logi i System Powiadomień](#4-obserwowalność-logi-i-system-powiadomień)
5. [Bezpieczeństwo, Kontrola Dostępu i Audyt](#5-bezpieczeństwo-kontrola-dostępu-i-audyt)
6. [Tabela Podsumowująca i Wycena Złożoności](#6-tabela-podsumowująca-i-wycena-złożoności)

---

## 1. Orkiestracja i Zarządzanie Serwerami przez Ansible

Przejście z doraźnych skryptów Bash wykonywanych po SSH na deklaratywną orkiestrację Ansible (agentless).

```mermaid
flowchart LR
    UI["Frontend (React 19)<br/>Wybór Playbooka i Serwerów"] -->|POST /api/ansible/run| API["Backend (Express 5)"]
    DB[("PostgreSQL<br/>Tabela servers")] -->|JSON Export| Inv["Ansible Dynamic Inventory"]
    API -->|ansible-playbook| Runner["Ansible Runner Engine"]
    Runner -->|SSH Execution| S1["Serwery VPS (Ubuntu/Debian)"]
    Runner -->|SSH Execution (User Space)| S2["Hosting CT8.pl (FreeBSD/Passenger)"]
    Runner -->|Stdout Stream / Socket.IO| Term["UI Terminal / Task Progress<br/>(OK / CHANGED / FAILED)"]
```

### Koncepcja architektoniczna
* **Ansible Dynamic Inventory**:
  * Backend udostępnia endpoint `/api/ansible/inventory` lub skrypt inventory generujący strukturę grup i hostów w formacie JSON bezpośrednio z bazy PostgreSQL (`src/backend/servers/`).
  * Grupowanie maszyn wg tagów: `[production]`, `[vps]`, `[ct8]`, `[homelab]`.
* **Katalog Playbooków (`ansible/playbooks/`)**:
  * `ping.yml`: Błyskawiczny test łączności i dostępności modułów Python na serwerach.
  * `deploy-dashboard.yml`: Wdrożenie kodu, instalacja zależności, migracje bazy i reload aplikacji (`tmp/restart.txt`).
  * `system-update.yml`: Bezpieczna aktualizacja pakietów systemowych (`apt update && apt upgrade`) na maszynach z uprawnieniami `sudo`.
  * `backup-db.yml`: Zrzut baz danych PostgreSQL/MySQL i pobranie archiwów.
  * `setup-docker-host.yml`: Automatyczny provisioning nowego serwera VPS (instalacja Docker, Compose, firewall UFW).
  * `ct8-maintenance.yml`: Czyszczenie starych logów, sprawdzanie limitów dyskowych na hostingu CT8.
* **Interfejs w Dashboardzie**:
  * Zakładka **Ansible Orchestrator**: wybór serwera/grupy, wybór playbooka, formularz na zmienne (`extra-vars`).
  * Wizualny podgląd postępu zadań (Task-by-task: zielony `ok`, żółty `changed`, czerwony `failed`) z opcją przełączenia na surowy kolorowy output terminala xterm.js w czasie rzeczywistym.

---

## 2. Zaawansowane Przepływy Pracy Agentów AI (Agentic Workflows)

Rozwinięcie obecnego modułu agentów (`src/AgentsView.tsx`, `src/backend/agents/`) w kierunku autonomicznej i bezpiecznej automatyzacji.

### 2.1. Harmonogram Zadań Agentów (Agent Cron / Task Scheduler)
* **Problem:** Obecnie uruchomienie agenta wymaga manualnego wywołania w UI.
* **Rozwiązanie:** Mechanizm zlecania zadań cyklicznych oparty na `node-cron`:
  * *Przykłady zadań:* Nocny audyt bezpieczeństwa repozytorium (`npm audit`), weryfikacja logów błędów z ostatnich 24h, automatyczne generowanie podsumowania zadań w `tasks.md`.
  * Konfiguracja harmonogramu z poziomu UI (np. "W każdy poniedziałek o 03:00").

### 2.2. Human-in-the-Loop: Bramka Akceptacji Ryzykownych Akcji (Approval Gate)
* **Problem:** Agent mający dostęp do powłoki serwera może wykonać destrukcyjne polecenie (`rm -rf`, `git push --force`, usunięcie tabeli).
* **Rozwiązanie:** Mechanizm przechwytywania poleceń (command interceptor):
  * Wykrycie ryzykownych wzorców wstrzymuje wykonanie procesu i wysyła event WebSocket do przeglądarki.
  * Wyświetlenie modalu: *"Agent chce wykonać polecenie: `DROP TABLE old_data;`. Czy zezwalasz? [Zatwierdź / Odrzuć]"*.

### 2.3. Multi-Agent Pipeline (Łańcuchy Zadań)
* **Koncepcja:** Możliwość tworzenia sekwencji agentów o wyspecjalizowanych rolach:
  1. **Agent 1 (Researcher / Analityk):** Przegląda problem, zbiera logi i przygotowuje plan.
  2. **Agent 2 (Programista):** Generuje kod lub skrypt naprawczy na podstawie planu Agenta 1.
  3. **Agent 3 (Tester / Reviewer):** Uruchamia testy jednostkowe i linter, raportując sukces lub cofając zmiany.

### 2.4. Długoterminowa Pamięć i Baza Wiedzy (Agent Memory / RAG)
* **Koncepcja:** Indeksowanie historii commitów, specyfikacji OpenAPI i logów architektury w bazie PostgreSQL (np. z wykorzystaniem rozszerzenia wektorowego lub indeksu pełnotekstowego).
* **Korzyść:** Agenci nie tracą kontekstu pomiędzy osobnymi zadaniami i znają specyfikę repozytorium (np. regułę języka polskiego w UI, fallback in-memory bazy).

---

## 3. Narzędzia DevOps & Administracja CT8/VPS

Ułatwienia operacyjne dla administratorów i developerów eliminujące konieczność otwierania osobnego klienta SSH/FTP.

### 3.1. Zdalny Menedżer Plików (Remote SFTP / File Explorer)
* **Koncepcja:** Drzewo katalogów w UI pozwalające na:
  * Przeglądanie struktury plików na serwerach CT8 i VPS.
  * Szybki podgląd i edycję plików konfiguracyjnych (np. `.env`, `ecosystem.config.js`, `nginx.conf`).
  * Upload/download plików bezpośrednio przez protokół SFTP/SSH.

### 3.2. Przycisk "One-Click Deploy to CT8" w UI
* **Koncepcja:** Dedykowany kafelek/widok wdrożeniowy:
  * Wywołanie `scripts/deploy-ct8-optimized.sh` bezpośrednio z aplikacji lub przez API GitHub Actions (`workflow_dispatch`).
  * Podgląd statusu ostatniego deployu (czas trwania, commit ID, wynik testu `/health`).
  * Przycisk natychmiastowego reloadu instancji Passenger (`POST /api/servers/ct8/restart` $\rightarrow$ `touch tmp/restart.txt`).

### 3.3. Zarządzanie Kopiami Zapasowymi (Backup & Restore Manager)
* **Koncepcja:**
  * Wykonywanie kopii bazy PostgreSQL (`pg_dump`) jednym kliknięciem.
  * Archiwizacja katalogu `uploads/` lub plików konfiguracyjnych do pliku `.tar.gz`.
  * Lista dostępnych backupów z możliwością pobrania na dysk lokalny lub przywrócenia jednym kliknięciem.

### 3.4. Monitor Uptime & Ważności Certyfikatów SSL
* **Koncepcja:**
  * Okresowe odpytywanie endpointów HTTP/HTTPS (np. co 60 sekund).
  * Wykres latencji odpowiedzi (Response Time ms) w czasie.
  * Sprawdzanie daty ważności certyfikatów SSL domen (`dashboard.jagger2.ct8.pl`) z powiadomieniem w UI na 14 dni przed wygaśnięciem.

---

## 4. Obserwowalność, Logi i System Powiadomień

### 4.1. Centralna Przeglądarka Logów (Live Log Viewer)
* **Koncepcja:** Widok strumieniujący logi aplikacji w czasie rzeczywistym:
  * Logi Node.js / Express (Pino / format JSON).
  * Logi serwera CT8 (katalog `domains/dashboard.jagger2.ct8.pl/logs/error.log`).
  * Filtry: poziom (`DEBUG`, `INFO`, `WARN`, `ERROR`), filtrowanie po module, wyszukiwarka fraz (regex), funkcja pauzy i auto-scroll.

### 4.2. Notyfikacje Zewnętrzne (Telegram / Discord / Slack)
* **Koncepcja:** Rozszerzenie modułu webhooków (`src/backend/webhooks/`) o predefiniowane szablony powiadomień:
  * Alert o awarii serwera (brak odpowiedzi na healthcheck).
  * Raport z zakończenia wdrożenia na CT8 (sukces / błąd w CI/CD).
  * Powiadomienie o zakończeniu długiego zadania przez Agenta AI.

### 4.3. Wykrywanie Anomalii Metryk (Anomaly & Threshold Alerts)
* **Koncepcja:** Automatyczne reguły monitorujące zbierane metryki Prometheus:
  * Zużycie RAM > 85% przez ponad 5 minut.
  * Zużycie CPU > 90%.
  * Nagły skok błędów HTTP 5xx w API (>5 błędów na minutę).

---

## 5. Bezpieczeństwo, Kontrola Dostępu i Audyt

### 5.1. Uwierzytelnianie Dwuskładnikowe (2FA / TOTP)
* **Koncepcja:** Możliwość włączenia 2FA w profilu użytkownika (zgodne z Google Authenticator, Authy, 1Password):
  * Generowanie kodu QR przy konfiguracji.
  * Weryfikacja 6-cyfrowego tokena TOTP przy logowaniu.

### 5.2. Role i Uprawnienia (Role-Based Access Control - RBAC)
* **Role użytkowników:**
  * **Admin:** Pełny dostęp (uruchamianie agentów, terminal SSH, wdrażanie, edycja serwerów).
  * **Operator:** Uruchamianie zdefiniowanych playbooków i widgetów, bez edycji konfiguracji systemowej.
  * **Viewer:** Tylko podgląd kafelków, wykresów metryk i logów (brak dostępu do powłoki PTY).

### 5.3. Nagrywanie i Rejestracja Sesji Terminala (Audit Log)
* **Koncepcja:** Archiwizacja sesji terminalowych otwieranych w `xterm.js`:
  * Zapis historii wpisywanych poleceń z dokładnym czasem i tożsamością użytkownika/agenta.
  * Opcja eksportu sesji do standardu `asciinema` lub zwykłego pliku tekstowego.

### 5.4. Personalizacja i Motyw (Dark / Light Mode & Tile Preferences)
* **Koncepcja:** Pełne wsparcie dla przełącznika motywu (Dark / Light mode) oparte o Tailwind CSS v4.
* Zapisywanie widoczności i kolejności kafelków dashboardu w bazie danych per użytkownik.

---

## 6. Tabela Podsumowująca i Wycena Złożoności

| Nr | Funkcja | Kategoria | Szacowany Nakład | Wpływ na Wartość Projektu |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Ansible Orchestrator & Playbooks** | Zarządzanie Serwerami | Średni (3-4 dni) | **Bardzo wysoki** (standaryzacja orkiestracji) |
| **2** | **One-Click Deploy do CT8 w UI** | DevOps / Delivery | Niski (1 dzień) | **Wysoki** (wygoda i natychmiastowy feedback) |
| **3** | **Harmonogram zadań agentów (Cron)** | Agenci AI | Średni (2 dni) | **Wysoki** (autonomiczna praca w tle) |
| **4** | **Powiadomienia Telegram/Discord** | Alerty & Integracje | Niski (1 dzień) | **Średni/Wysoki** (mobilna kontrola stanu) |
| **5** | **Zdalny menedżer plików (SFTP Browser)**| DevOps / Narzędzia | Średni/Duży (3-5 dni) | **Wysoki** (edycja configów bez terminala) |
| **6** | **Live Log Viewer (CT8 + API)** | Obserwowalność | Niski/Średni (2 dni) | **Wysoki** (szybki debug produkcji) |
| **7** | **Bramka zatwierdzeń (Human-in-the-loop)**| Bezpieczeństwo AI | Średni (2 dni) | **Bardzo wysoki** (ochrona przed awarią) |
| **8** | **Uwierzytelnianie 2FA (TOTP)** | Bezpieczeństwo | Niski/Średni (1-2 dni) | **Wysoki** (ochrona panelu administracyjnego)|
| **9** | **Backup & Restore Manager (DB & Pliki)**| DevOps / Dane | Niski/Średni (1-2 dni) | **Bardzo wysoki** (bezpieczeństwo danych) |
| **10**| **Monitor Uptime & SSL** | Monitoring | Niski (1 dzień) | **Średni** (prewencja wygaśnięcia certyfikatów)|

---

*Plan sporządzono do dyskusji i wyboru modułów do wdrożenia.*
