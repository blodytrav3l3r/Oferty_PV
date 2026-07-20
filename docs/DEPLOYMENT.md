# Wdrożenie — WITROS Oferty PV

**Wersja:** 1.8.0  
**Stack:** Express + Prisma + SQLite + VanillaJS SPA + ML Pipeline

---

## 1. Zmienne środowiskowe

Przed wdrożeniem skonfiguruj plik `.env` (lub zmienne środowiskowe na platformie).

| Zmienna                  | Opis                                               | Wymagane | Przykład                                |
| ------------------------ | -------------------------------------------------- | -------- | --------------------------------------- |
| `PORT`                   | Port serwera                                       | Nie      | `10000`                                 |
| `HOST`                   | Adres nasłuchiwania                                | Nie      | `0.0.0.0`                               |
| `NODE_ENV`               | Środowisko: `development` / `production`           | Nie      | `production`                            |
| `DEFAULT_ADMIN_PASSWORD` | Hasło administratora (tylko pierwsze uruchomienie) | **Tak**  | `bezpieczne-haslo-123`                  |
| `DATABASE_URL`           | Ścieżka do bazy SQLite                             | Nie      | `file:../data/app_database.sqlite`      |
| `SENTRY_DSN`             | DSN Sentry do monitorowania błędów                 | Nie      | `https://...@o....ingest.sentry.io/...` |

---

## 2. Wdrożenie lokalne (Windows/Linux)

### Wymagania

- Node.js >= 20.0.0
- npm

### Instalacja

```bash
git clone https://github.com/blodytrav3l3r/Oferty_PV.git
cd Oferty_PV
npm install
cp .env.example .env
# edytuj .env — ustaw DEFAULT_ADMIN_PASSWORD
npx prisma generate
npx prisma migrate dev
npm run prisma:seed
npm run build
```

### Uruchomienie

```bash
npm start
```

Serwer dostępny pod adresem: `http://localhost:10000`

### Skrypty startowe

Projekt zawiera wygodne skrypty startowe:

- **Windows:** `start.bat` — uruchamia serwer w oknie konsoli
- **Linux/Mac:** `start.sh` — uruchamia serwer w shellu
- **Uniwersalny (Windows):** `start_node.bat` — uruchamia przez `node dist/server.js`
- **Multi (Windows):** `start_all.bat` — backup + start

---

## 3. Docker

### Dockerfile

Plik `Dockerfile` buduje obraz na bazie `node:22-slim`. Wykonuje:

1. Instalację OpenSSL (wymagany przez Prisma)
2. `npm install` (wszystkie zależności)
3. `npx prisma generate` (generacja klienta)
4. `npm run build` (kompilacja TypeScript)
5. `npm prune --production` (usunięcie zależności dev)
6. Konfigurację katalogu `/var/data` dla bazy danych

### docker-compose.yml

```yaml
version: '3.8'
services:
    app:
        build: .
        container_name: witros-oferty
        restart: unless-stopped
        ports:
            - '3000:10000'
        environment:
            - NODE_ENV=production
            - PORT=10000
            - HOST=0.0.0.0
        volumes:
            - witros_data:/var/data
        healthcheck:
            test:
                [
                    'CMD',
                    'node',
                    '-e',
                    "require('http').get('http://localhost:10000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"
                ]
            interval: 30s
            timeout: 10s
            retries: 3
            start_period: 10s

volumes:
    witros_data:

networks:
    witros-network:
        driver: bridge
```

### Uruchomienie

```bash
docker compose up --build -d
```

Aplikacja dostępna pod: `http://localhost:3000`

### Health check

Docker ma wbudowany HEALTHCHECK:

```
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD node -e "require('http').get('http://localhost:10000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"
```

---

## 4. Render.com

### Wdrożenie przez Blueprint

1. W dashboardzie Render.com: **New → Blueprint**
2. Wybierz repozytorium `blodytrav3l3r/Oferty_PV`
3. Render automatycznie odczyta `render.yaml`:
    - Web Service z Node.js
    - Persistent Disk (1 GB) w `/var/data`
    - Region: Oregon
    - Plan: Starter (darmowy)

### render.yaml

```yaml
services:
    - type: web
      name: witros-oferty
      runtime: node
      plan: starter
      buildCommand: npm ci && npx prisma generate && npm run build && ln -sf ../generated dist/generated
      startCommand: npx prisma db push --skip-generate && node dist/server.js
      healthCheckPath: /health
      envVars:
          - key: NODE_ENV
            value: production
          - key: DATABASE_URL
            value: file:/var/data/app_database.sqlite
          - key: DEFAULT_ADMIN_PASSWORD
            sync: false # ustaw ręcznie w dashboardzie
```

### Po deployu

1. W dashboardzie Render → Environment → ustaw `DEFAULT_ADMIN_PASSWORD` (sekret)
2. Aplikacja uruchomi się z czystą bazą SQLite na Persistent Disk
3. Przy pierwszym uruchomieniu: produkty zostają zaseedowane, konto admin utworzone

---

## 5. VPS (Linux)

### Wymagania

- Node.js >= 20.0.0
- PM2 (opcjonalnie, do zarządzania procesem)

### Instalacja

```bash
# 1. Aktualizacja systemu
sudo apt update && sudo apt upgrade -y

# 2. Instalacja Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Klonowanie repozytorium
git clone https://github.com/blodytrav3l3r/Oferty_PV.git
cd Oferty_PV

# 4. Instalacja zależności
npm install

# 5. Konfiguracja
cp .env.example .env
nano .env  # ustaw DEFAULT_ADMIN_PASSWORD i PORT

# 6. Przygotowanie bazy
npx prisma generate
npx prisma migrate dev
npm run prisma:seed

# 7. Budowa
npm run build

# 8. Uruchomienie przez PM2
npm install -g pm2
pm2 start dist/server.js --name witros-oferty
pm2 save
pm2 startup
```

### Nginx jako reverse proxy (opcjonalnie)

```nginx
server {
    listen 80;
    server_name twoja-domena.pl;

    location / {
        proxy_pass http://localhost:10000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 6. Bezpieczeństwo w produkcji

| Obszar       | Zalecenie                                                |
| ------------ | -------------------------------------------------------- |
| HTTPS        | Użyj reverse proxy (Nginx/Caddy) z Let's Encrypt         |
| Firewall     | Ogranicz dostęp do portu aplikacji (np. tylko localhost) |
| Backup       | Skonfiguruj automatyczny backup bazy (cron / PM2)        |
| Monitoring   | Skonfiguruj Sentry (zmienna `SENTRY_DSN`)                |
| PM2          | Użyj do zarządzania procesem i auto-restartu             |
| Aktualizacje | Regularnie aktualizuj npm (`npm audit`, `npm update`)    |

---

## 7. Backup bazy w produkcji

### Cron (Linux)

```bash
# Dodaj do crontab (codziennie o 3:00)
0 3 * * * cd /path/to/Oferty_PV && npm run backup >> /var/log/witros-backup.log 2>&1
```

### Task Scheduler (Windows)

```bash
npm run backup:install-cron
```

---

## 8. Obsługa błędów — Sentry

Aby włączyć Sentry:

1. Załóż konto na [sentry.io](https://sentry.io)
2. Utwórz projekt Node.js
3. Ustaw zmienną `SENTRY_DSN` w `.env`:
    ```
    SENTRY_DSN=https://klucz@o123456.ingest.sentry.io/654321
    ```

Sentry będzie rejestrować:

- Nieobsłużone wyjątki
- Błędy 500
- Wydajność (opcjonalnie, traceSampleRate: 0.1)

---

_Ostatnia aktualizacja: 2026-07-20_

---

## 9. Przenoszenie bazy na inne urządzenie

Baza SQLite to pojedynczy plik — przeniesienie jej na nowe urządzenie jest prostą operacją kopiowania.

### Procedura

#### Na urządzeniu źródłowym (starym):

1. Zatrzymaj serwer (Ctrl+C)
2. Wykonaj backup:

    ```bash
    npm run backup
    ```

    Backup trafi do `data/backups/backup_<timestamp>.sqlite`.

3. Skopiuj plik backupu na nowe urządzenie (pendrive, SCP, chmura).

#### Na urządzeniu docelowym (nowym):

1. Zainstaluj aplikację według instrukcji w README (kroki 1–3, bez seedowania)
2. Zbuduj projekt: `npm run build`
3. Przywróć bazę:
    ```bash
    npm run backup:restore -- data/backups/backup_*.sqlite
    ```
    lub ręcznie:
    ```bash
    cp data/backups/backup_*.sqlite data/app_database.sqlite
    ```
4. Uruchom serwer: `npm start`

### Co gdy schemat bazy różni się między wersjami?

Po przeniesieniu bazy na nowe urządzenie z nowszą wersją aplikacji uruchom migrację:

```bash
npx prisma migrate deploy
```

Jeśli migracje nie są dostępne:

```bash
npx prisma db push --skip-generate
```

Prisma automatycznie dostosuje schemat do aktualnego stanu bez utraty danych.

### Weryfikacja

Po przywróceniu bazy sprawdź:

1. Endpoint `/health` zwraca `200 OK`
2. Lista produktów i ceny zgodne z oczekiwaniami
3. Historia ofert i klienci dostępni
