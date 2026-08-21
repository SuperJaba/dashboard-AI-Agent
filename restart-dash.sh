#!/bin/bash
    set -e

    # Ścieżka do katalogu głównego aplikacji na CT8
    APP_DIR="~/domains/dashboard.jagger2.ct8.pl"

    echo "🚀 Rozpoczynanie aktualizacji aplikacji Dashboard na CT8..."

    cd "$APP_DIR"

    # 1. Zbudowanie nowej wersji frontendu (z zachowaniem pomijania Chromium na FreeBSD)
    echo "📦 Budowanie paczki produkcyjnej (Vite)..."
    export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
    export PUPPETEER_SKIP_DOWNLOAD=true
    npm run build
    
    # 2. Skopiowanie nowo wygenerowanych plików statycznych (dist -> public / public_nodejs)
    echo "📂 Synchronizowanie plików statycznych..."
    cp -r "$APP_DIR/dist/"* "$APP_DIR/public/" 2>/dev/null || true
    cp -r "$APP_DIR/dist/"* "$APP_DIR/public_nodejs/public/" 2>/dev/null || true

    # 3. Ubicie starych wiszących procesów Node.js
    echo "🔪 Zakończenie starych procesów Node.js..."
    pkill -9 node || true

    # 4. Ponowne uruchomienie aplikacji w tle na zarezerwowanym porcie (56086)
    echo "▶ Uruchamianie nowego procesu Node.js (start.sh)..."
    nohup "$APP_DIR/start.sh" > "$APP_DIR/app.log" 2>&1 &

    sleep 2
    
     # 5. Weryfikacja statusu
    if pgrep -u jagger2 node > /dev/null; then
        echo "✅ Nowa wersja została pomyślnie uruchomiona!"
        echo "🌐 Sprawdź działanie na: http://dashboard.jagger2.ct8.pl"
    else
        echo "❌ Błąd uruchamiania! Sprawdź logi w: $APP_DIR/app.log"
        cat "$APP_DIR/app.log"
    fi