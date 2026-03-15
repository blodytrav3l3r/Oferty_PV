#!/bin/bash

# 1. Uruchomienie backendu AI w tle
echo "🚀 Uruchamianie backendu AI (Python)..."
cd well_configurator_backend
uvicorn api.main:app --host 127.0.0.1 --port 8000 &
cd ..

# 2. Oczekiwanie momentu na start Pythona
sleep 5

# 3. Uruchomienie głównego serwera Node.js
# Port zostanie automatycznie pobrany ze zmiennej $PORT przez server.js
echo "🚀 Uruchamianie serwera głównego (Node.js)..."
npm start
