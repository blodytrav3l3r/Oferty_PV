# Wdrożenie — S.O.K. — System Ofert i Kalkulacji

**Wersja:** 1.19.4  
**Stack:** Express + Prisma + SQLite + VanillaJS SPA + ML Pipeline  
**Ostatnia aktualizacja:** 2026-08-01

> **Aktualizacje produkcyjne** (backup, migracje addytywne, rollback) opisuje [DEPLOY_UPDATE.md](DEPLOY_UPDATE.md).

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
| `COOKIE_SECURE`          | Wymuszenie `Secure` flagi na ciastku sesji         | Nie*     | `true`                                  |
| `TRUST_PROXY`            | Liczba reverse proxy przed aplikacją (1 lub 2)     | Nie      | `1`                                     |

> \* `COOKIE_SECURE=true` jest wymagane, gdy aplikacja jest serwowana przez HTTPS
> w trybie innym niż `production` (w `production` flaga jest wymuszana automatycznie).

---

## 2. Wdrożenie lokalne (Windows/Linux)

### Wymagania

- Node.js >= 22.13 (rekomendowane LTS 22.x / 24.x)
- npm

### Instalacja

```bash
git clone https://github.com/blodytrav3l3r/Oferty_PV.git
cd Oferty_PV
npm ci
cp .env.example .env
# edytuj .env — ustaw DEFAULT_ADMIN_PASSWORD
npx prisma generate
npx prisma migrate deploy
# (baza legacy utworzona przez db push, bez _prisma_migrations:
#  npx prisma db push --skip-generate --accept-data-loss)
npm run prisma:seed
npm run build
# Linux: po surowym `npm run build` (bez build.sh) skopiuj klienta Prisma:
mkdir -p dist/generated && cp -r generated/prisma dist/generated/
```

### Uruchomienie

```bash
npm start
```

Serwer dostępny pod adresem: `http://localhost:3000`

### Skrypty startowe

Projekt zawiera wygodne skrypty startowe:

- **Windows:** `start.bat` — uruchamia serwer w oknie konsoli
- **Instalator:** `install.bat` — automatyzuje `npm ci`, `prisma generate`, seed i build

---

## 3. Docker

### Dockerfile

Plik `Dockerfile` buduje obraz na bazie `node:22-slim`. Wykonuje:

1. Instalację OpenSSL (wymagany przez Prisma)
2. `npm ci` (wszystkie zależności — bez `npm prune --production`; devDeps są potrzebne w runtime do seedowania i `migrate deploy`)
3. `npx prisma generate` (generacja klienta)
4. `npm run build` (kompilacja TypeScript)
5. Symlink `dist/generated` → `generated` (klient Prisma)
6. Konfigurację katalogu `/var/data` dla bazy danych

### docker-compose.yml

```yaml
version: '3.8'
services:
    app:
        build: .
        container_name: sok-oferty
        restart: unless-stopped
        ports:
            - '3000:10000'
        environment:
            - NODE_ENV=production
            - PORT=10000
            - HOST=0.0.0.0
        volumes:
            - ./data:/var/data
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

networks:
    sok-network:
        driver: bridge
```

> **Bind mount zamiast named volume:** serwis używa `./data:/var/data` — baza i backupy
> są widoczne na hoście, więc backup/restore działają identycznie jak na bare-metal
> (`npm run backup` / `npm run restore` wprost na hoście). Zakaz `docker compose down -v`.

### Uruchomienie

```bash
docker compose up --build -d
```

Aplikacja dostępna pod: `http://localhost:3000`

### Migracja wolumenu `witros_data` → katalog `data` (bind mount)

> **KRYTYCZNE:** wolumen zawiera bazę SQLite. Zmiana lokalizacji bez migracji = nowy
> PUSTY katalog = seed pustej bazy (pozorowana utrata danych). Postępuj ściśle wg
> poniższych kroków — NIGDY nie używaj `docker compose down -v` przy tej operacji.

1. Pre-check: `docker compose ps` (aplikacja działa), `git status` czyste,
   `docker network inspect witros-network` — jeśli na sieci są OBCE kontenery
   (zewnętrzny proxy), NIE zmieniaj nazwy sieci (wróć do `witros-network`).
2. Czysty shutdown (SQLite WAL → checkpoint do `app_database.sqlite`):
   `docker compose down` (bez `-v`).
3. Utwórz katalog bind mount: `mkdir data`.
4. Skopiuj dane:
   `docker run --rm -v witros_data:/from -v "<absolutna_sciezka>/data":/to alpine:3.20 sh -c "cp -a /from/. /to/"`
5. **Weryfikacja kopii (obowiązkowo):**
    ```
    docker run --rm -v witros_data:/from alpine:3.20 sh -c "sha256sum /from/app_database.sqlite"
    docker run --rm -v <absolutna_sciezka>/data:/to alpine:3.20 sh -c "sha256sum /to/app_database.sqlite"
    ```
    → identyczne sumy; `ls -la data/` zawiera `app_database.sqlite` (+ `-wal`/`-shm`).
6. Zaktualizuj pliki (docker-compose.yml / docs) i uruchom:
   `docker compose up -d --build`.
7. Weryfikacja: `docker ps` (kontener `sok-oferty` healthy), `curl localhost:3000/health`
   → 200, logowanie → istniejące oferty/zamówienia widoczne.
8. **Retencja:** NIE usuwaj `witros_data` przez minimum 2 cykle release.
   Usunięcie tylko po potwierdzeniu stabilności:
   `docker volume rm witros_data`.

### Health check

Docker ma wbudowany HEALTHCHECK:

```
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD node -e "require('http').get('http://localhost:10000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"
```

## 4. VPS (Linux)

> **HTTPS jest wymagane w produkcji.** Bez reverse proxy z TLS funkcje przeglądarki
> (clipboard, `window.open()` itp.) mogą być blokowane na HTTP. Zobacz
> [ADR-006](adr/ADR-006-https-transport.md) i konfigurację w `Caddyfile`.

### Wymagania

- Node.js >= 22.13 (rekomendowane LTS 22.x / 24.x)
- PM2 (opcjonalnie, do zarządzania procesem)
- Reverse proxy: Caddy (rekomendowany) lub Nginx

### Instalacja

```bash
# 1. Aktualizacja systemu
sudo apt update && sudo apt upgrade -y

# 2. Instalacja Node.js 22.x (LTS, >= 22.13)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Klonowanie repozytorium
git clone https://github.com/blodytrav3l3r/Oferty_PV.git
cd Oferty_PV

# 4. Instalacja zależności
npm ci

# 5. Konfiguracja
cp .env.example .env
nano .env  # ustaw DEFAULT_ADMIN_PASSWORD, PORT, COOKIE_SECURE=true

# 6. Przygotowanie bazy
npx prisma generate
npx prisma migrate deploy
# (baza legacy utworzona przez db push, bez _prisma_migrations:
#  npx prisma db push --skip-generate --accept-data-loss)
npm run prisma:seed

# 7. Budowa
npm run build
# Linux: po surowym `npm run build` (bez build.sh) skopiuj klienta Prisma:
mkdir -p dist/generated && cp -r generated/prisma dist/generated/

# 8. Uruchomienie przez PM2
npm install -g pm2
pm2 start dist/server.js --name sok-oferty
pm2 save
pm2 startup
```

> W produkcji serwer binduje się domyślnie do `127.0.0.1` — nie jest dostępny z sieci
> bezpośrednio. Jawnie ustawiony `HOST` (np. w Dockerze) ma pierwszeństwo.

### Caddy jako reverse proxy (rekomendowany)

```bash
sudo apt install caddy
export DOMAIN=twoja-domena.pl
export EMAIL=twoj@email.com
caddy run --config Caddyfile
```

Caddy automatycznie:

- wydaje certyfikat Let's Encrypt,
- odnawia certyfikat,
- przekierowuje HTTP → HTTPS,
- przekazuje ruch do `127.0.0.1:3000`.

### Nginx jako reverse proxy z Let's Encrypt

```bash
sudo apt install nginx certbot python3-certbot-nginx
```

```nginx
server {
    listen 80;
    server_name twoja-domena.pl;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo certbot --nginx -d twoja-domena.pl
```

---

## 5. Bezpieczeństwo w produkcji

| Obszar       | Zalecenie                                                  |
| ------------ | ---------------------------------------------------------- |
| HTTPS        | **Wymagane** — reverse proxy (Caddy/Nginx) z Let's Encrypt |
| Firewall     | Ogranicz dostęp do portu aplikacji (np. tylko localhost)   |
| Backup       | Skonfiguruj automatyczny backup bazy (cron / PM2)          |
| Monitoring   | Skonfiguruj Sentry (zmienna `SENTRY_DSN`)                  |
| PM2          | Użyj do zarządzania procesem i auto-restartu               |
| Aktualizacje | Regularnie aktualizuj npm (`npm audit`, `npm update`)      |

---

## 6. Backup bazy w produkcji

### Cron (Linux)

```bash
# Dodaj do crontab (codziennie o 3:00)
0 3 * * * cd /path/to/Oferty_PV && npm run backup >> /var/log/sok-oferty-backup.log 2>&1
```

### Task Scheduler (Windows)

```bash
npm run backup:install-cron
```

---

## 7. Weryfikacja po wdrożeniu (checklist)

Skonsolidowana checklista do wykonania ręcznie po wdrożeniu produkcyjnym przez
reverse proxy z HTTPS. Szczegóły konfiguracji proxy znajdują się w sekcji 4
powyżej — poniższa lista jest samowystarczalna dla wykonawcy, a wyniki odhacza
się również w `docs/baseline-https.md` oraz `docs/plans/archive/https-migration-plan.md`.

### 7.1 Deploy reverse proxy (HTTPS)

- [ ] DNS domeny propagowany — `dig`/`nslookup` zwraca adres IP serwera
- [ ] Porty 80 i 443 otwarte w firewallu
- [ ] Port aplikacji (domyślnie 3000) NIE jest wystawiony na świat — Node słucha na `127.0.0.1`

**Caddy:**

- [ ] `caddy validate` — konfiguracja `Caddyfile` poprawna
- [ ] `caddy run --config Caddyfile` — uruchomiony, certyfikat Let's Encrypt wydany

**Nginx:**

- [ ] Konfiguracja serwera wg sekcji 4 (proxy_pass na `127.0.0.1:3000`)
- [ ] `sudo certbot --nginx -d twoja-domena.pl` — certyfikat wydany

### 7.2 Konfiguracja `.env`

- [ ] `COOKIE_SECURE=true` ustawione
- [ ] `HOST` nie jest ustawione na `0.0.0.0` (w produkcji domyślnie `127.0.0.1`)
- [ ] `TRUST_PROXY=1` (2 tylko przy łańcuchu Cloudflare → Nginx → App)

### 7.3 Kolejność startu

- [ ] Reverse proxy (Caddy/Nginx) uruchomione PRZED aplikacją Node
- [ ] `https://domena.pl/health` zwraca `200 OK`

### 7.4 Weryfikacja E2E w przeglądarce (przez HTTPS, DevTools)

- [ ] `window.isSecureContext === true` — w konsoli DevTools
- [ ] Brak mixed content — zakładki Console/Network/Security/Issues czyste
- [ ] `http://domena.pl` przekierowuje na HTTPS (301/308)
- [ ] Nagłówek HSTS obecny: `max-age=...`
- [ ] Po zalogowaniu ciastko sesji ma flagę `Secure` i `SameSite=Lax`
- [ ] Logowanie działa przez HTTPS
- [ ] `/api/*` działa przez HTTPS
- [ ] Iframe (rury, studnie) działają
- [ ] Clipboard copy/paste działa
- [ ] Excel copy/paste zakresu działa
- [ ] Drukowanie oferty działa
- [ ] `window.open` (print) działa
- [ ] Generowanie/pobieranie PDF/DOCX działa
- [ ] Upload XLSX (import) działa
- [ ] Wylogowanie działa — `clearCookie` z flagą `Secure` usuwa ciastko sesji

### 7.5 Macierz przeglądarek

- [ ] Przetestowano i odhaczono macierz w `docs/baseline-https.md` §4
      (Chrome, Edge, Firefox, Safari, Brave) — funkcje: logowanie, iframe,
      clipboard, Excel, drukowanie, `window.open`, PDF/DOCX, upload, storage

### 7.6 Zamknięcie wdrożenia

- [ ] Odhaczono checkboxy w `docs/baseline-https.md` §3 (Testy po migracji) i §4 (Macierz przeglądarek)
- [ ] Odhaczono kryteria manualne w `docs/plans/archive/https-migration-plan.md` §10 (Kryteria zakończenia)

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

    > **Uwaga (Linux):** po surowym `npm run build` (bez `build.sh`) skopiuj klienta Prisma:
    > `mkdir -p dist/generated && cp -r generated/prisma dist/generated/` — albo użyj `build.bat`/`build.sh`.

3. Przywróć bazę:
    ```bash
    npm run restore -- data/backups/backup_*.sqlite
    ```
    lub ręcznie:
    ```bash
    cp data/backups/backup_*.sqlite data/app_database.sqlite
    ```
4. **Zsynchronizuj schemat bazy** (wymagane — backup zawiera tylko dane, a nowsza
   wersja aplikacji może wymagać nowych tabel/indeksów):
    ```bash
    npx prisma migrate deploy
    ```
    > `npm run restore` synchronizuje schemat automatycznie; przy ręcznym `cp` ta
    > synchronizacja **nie zachodzi** i musi być uruchomiona jawnie.
5. Uruchom serwer: `npm start`

### Co gdy schemat bazy różni się między wersjami?

Po przeniesieniu bazy na nowe urządzenie z nowszą wersją aplikacji zsynchronizuj schemat.
Sposób zależy od historii bazy:

- **Baza z historią migracji** (istnieje tabela `_prisma_migrations`) — ścieżka domyślna:
    ```bash
    npx prisma migrate deploy
    ```
- **Baza legacy tworzona przez `db push`** (brak `_prisma_migrations`): `migrate deploy` NIE zadziała
  (próbowałby odtworzyć historię migracji na istniejących tabelach). Użyj:
    ```bash
    npx prisma db push --skip-generate --accept-data-loss
    ```
    Jak sprawdzić typ bazy: `npx prisma migrate status` — jeśli pokazuje migracje jako
    niezastosowane mimo działającej aplikacji, baza jest typu `db push`.

Prisma automatycznie dostosuje schemat do aktualnego stanu bez utraty danych.

> Migracja `20260815000000_baseline` dodaje 2 indeksy na `ai_telemetry_logs`
> (`idx_logs_well`, `idx_logs_source_well`) pod deduplikację telemetrii AI. Są one
> idempotentne i powstają automatycznie przez `migrate deploy` (definicje w `schema.prisma`).

### Weryfikacja

Po przywróceniu bazy sprawdź:

1. Endpoint `/health` zwraca `200 OK`
2. Lista produktów i ceny zgodne z oczekiwaniami
3. Historia ofert i klienci dostępni
