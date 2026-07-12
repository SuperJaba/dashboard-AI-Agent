#!/bin/bash
cd "/home/seba/Documents/dashboard"
echo -e "\033[1;34m🚀 Initializing AI Agent (claude)...\033[0m"
echo -ne "\033[1;36m📡 Preparing environment: \033[0m"
for i in {1..20}; do
    echo -ne "█"
    sleep 0.1
done
echo -e " \033[1;32m[DONE]\033[0m"

echo -ne "\033[1;33m🔑 Authenticating with Gemini 3.1 Pro... \033[0m"
for i in {1..10}; do
    echo -ne "."
    sleep 0.15
done
echo -e " \033[1;32m[SUCCESS]\033[0m"

echo -e "\033[1;35m⏳ Booting agent engine. Please wait, this might take up to 15 seconds...\033[0m"
claude "Zrealizuj zadania z pliku .ai_tasks.md. Kiedy skończysz, oznacz je jako wykonane."
exec bash
