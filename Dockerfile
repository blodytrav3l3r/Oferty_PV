# Wybór obrazu bazowego (Node.js + Python na Debianie)
FROM node:18-slim

# Instalacja zależności systemowych dla Node (better-sqlite3) i Pythona (lightgbm, scikit-learn)
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    build-essential \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Ustawienie katalogu roboczego
WORKDIR /app

# --- KONFIGURACJA NODE.JS ---
COPY package*.json ./
RUN npm install

# --- KONFIGURACJA PYTHONA (AI BACKEND) ---
COPY well_configurator_backend/requirements.txt ./well_configurator_backend/
RUN pip3 install --no-cache-dir -r well_configurator_backend/requirements.txt

# Kopiowanie reszty plików projektu
COPY . .

# Skrypt startowy (uruchamia oba serwery)
RUN chmod +x render-start.sh

# Render wymaga, aby aplikacja słuchała na porcie zdefiniowanym w zmiennej środowiskowej $PORT
EXPOSE 3000

CMD ["./render-start.sh"]
