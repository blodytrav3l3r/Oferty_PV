# S.O.K. — Instrukcja uruchomienia serwera przez Internet

**Wersja:** 1.18.0

## Spis treści

1. [Wymagania](#1-wymagania)
2. [Instalacja na nowym urządzeniu](#2-instalacja-na-nowym-urządzeniu)
3. [Udostępnienie przez Internet](#3-udostępnienie-przez-internet)
    - Opcja A: VPS (serwer w chmurze)
    - Opcja B: Tunel (ngrok / Cloudflare Tunnel)
    - Opcja C: Własny router (przekierowanie portów)
4. [Zabezpieczenia](#4-zabezpieczenia)
5. [Automatyczny restart serwera](#5-automatyczny-restart-serwera)
6. [Rozwiązywanie problemów](#6-rozwiązywanie-problemów)

---

## 1. Wymagania

| Składnik              | Wersja   | Opis                                                                        |
| --------------------- | -------- | --------------------------------------------------------------------------- |
| **Node.js**           | >= 22.13 | [https://nodejs.org](https://nodejs.org) — pobierz wersję LTS (22.x / 24.x) |
| **npm**               | 9+       | Instaluje się automatycznie z Node.js                                       |
| **Git** (opcjonalnie) | dowolna  | Do pobierania aktualizacji                                                  |

### Sprawdzenie instalacji:

```powershell
node --version
npm --version
```

---

## 2. Instalacja na nowym urządzeniu

### Szybki start (Windows)

```powershell
# 1. Pobierz projekt (Git lub ZIP)
git clone https://github.com/blodytrav3l3r/Oferty_PV.git
cd Oferty_PV

# 2. Uruchom instalator
.\install.bat

# 3. Edytuj plik .env — ustaw hasło administratora
#    DEFAULT_ADMIN_PASSWORD=twoje-haslo

# 4. Uruchom serwer
.\start.bat
```

Aplikacja będzie dostępna pod adresem: **http://localhost:3000**

> **Uwaga (porty):** przykłady w tej instrukcji zakładają uruchomienie **bare-metal**
> (`start.bat` / `npm start`), gdzie aplikacja domyślnie nasłuchuje na porcie **3000**
> (zmienna `PORT` w `.env`). W Dockerze aplikacja w kontenerze nasłuchuje wewnętrznie
> na porcie **10000** (`PORT=10000` w `docker-compose.yml`), a `docker-compose.yml`
> mapuje `3000:10000` — na hoście Docker aplikacja dostępna jest na porcie **3000**.

> **Uwaga (HTTPS):** do pracy zdalnej **HTTPS jest wymagane** — bez niego funkcje
> przeglądarek (clipboard, `window.open()` itp.) mogą być blokowane na HTTP.
> Zobacz sekcję [4. Zabezpieczenia](#4-zabezpieczenia) i
> [ADR-006](adr/ADR-006-https-transport.md).

### Instalacja ręczna (dowolny system)

**Opcja A — nowa instalacja (z seedem danych początkowych):**

```bash
git clone https://github.com/blodytrav3l3r/Oferty_PV.git
cd Oferty_PV
npm ci
cp .env.example .env
# edytuj .env — ustaw DEFAULT_ADMIN_PASSWORD
npx prisma generate
npx prisma migrate deploy
# (baza legacy utworzona przez db push, bez _prisma_migrations: npx prisma db push --skip-generate --accept-data-loss)
npm run prisma:seed
npm run build
# Linux: po surowym `npm run build` (bez build.sh) skopiuj klienta Prisma:
mkdir -p dist/generated && cp -r generated/prisma dist/generated/
npm start
```

**Opcja B — z istniejącą bazą cenników (przeniesiona z innego urządzenia):**

```bash
git clone https://github.com/blodytrav3l3r/Oferty_PV.git
cd Oferty_PV
npm ci
cp .env.example .env
nano .env  # ustaw DEFAULT_ADMIN_PASSWORD
npx prisma generate
npx prisma migrate deploy
# (baza legacy utworzona przez db push, bez _prisma_migrations: npx prisma db push --skip-generate --accept-data-loss)
npm run build
# Linux: po surowym `npm run build` (bez build.sh) skopiuj klienta Prisma:
mkdir -p dist/generated && cp -r generated/prisma dist/generated/
# Przywróć bazę z backupu (pomiń seed):
npm run restore -- data/backups/backup_*.sqlite
npm start
```

### Pierwsze logowanie

1. Otwórz **http://localhost:3000**
2. Zaloguj się: `admin` / hasło z `.env`
3. Zmień hasło w ustawieniach profilu

---

## 3. Udostępnienie przez Internet

### Opcja A: Serwer VPS w chmurze (ZALECANA)

Aplikacja działa 24/7 niezależnie od Twojego komputera.

#### Popularne usługi VPS:

| Usługa           | Cena od                 | Strona                                       |
| ---------------- | ----------------------- | -------------------------------------------- |
| **Mikr.us** 🇵🇱   | ~30 PLN/rok             | [mikr.us](https://mikr.us)                   |
| **OVH** 🇵🇱       | ~20 PLN/mies.           | [ovh.pl](https://www.ovh.pl)                 |
| **Hetzner**      | ~€4/mies.               | [hetzner.com](https://hetzner.com)           |
| **DigitalOcean** | $6/mies.                | [digitalocean.com](https://digitalocean.com) |
| **Oracle Cloud** | **DARMOWY** (free tier) | [cloud.oracle.com](https://cloud.oracle.com) |

#### Krok po kroku na VPS (Ubuntu/Debian):

**1. Połącz się przez SSH:**

```bash
ssh root@TWOJ_ADRES_IP
```

**2. Zainstaluj Node.js 22 (LTS, >= 22.13):**

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git
```

**3. Skopiuj pliki na serwer (z lokalnego komputera):**

```powershell
scp -r Oferty_PV root@TWOJ_ADRES_IP:/home/sok-oferty/
```

Lub użyj **WinSCP** (graficzny klient SFTP).

**4. Zainstaluj i uruchom:**

```bash
cd /home/sok-oferty
npm ci
cp .env.example .env
nano .env  # ustaw DEFAULT_ADMIN_PASSWORD
npx prisma generate
npx prisma migrate deploy
# (baza legacy utworzona przez db push, bez _prisma_migrations: npx prisma db push --skip-generate --accept-data-loss)
npm run build
# Linux: po surowym `npm run build` (bez build.sh) skopiuj klienta Prisma:
mkdir -p dist/generated && cp -r generated/prisma dist/generated/
# Opcja A: nowa instalacja
npm run prisma:seed
# Opcja B: jeśli przenosisz bazę z innego urządzenia — zamiast seed:
# npm run restore -- data/backups/backup_*.sqlite
npm start
```

**5. Otwórz w przeglądarce:**

```
http://TWOJ_ADRES_IP:3000
```

---

### Opcja B: Tunel (szybki sposób, bez VPS-a)

Tunel udostępnia aplikację z Twojego komputera przez Internet bez konfiguracji routera.

#### Wariant 1: ngrok (najprostszy)

```powershell
# 1. Pobierz ngrok: https://ngrok.com/download
# 2. Załóż konto i pobierz token
# 3. Uruchom serwer
.\start.bat

# 4. W osobnym terminalu
ngrok http 3000
```

Otrzymasz adres: `https://abc123.ngrok-free.app`

#### Wariant 2: Cloudflare Tunnel (darmowy, stabilniejszy)

```powershell
# 1. Pobierz cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
# 2. Szybki tunel (bez konfiguracji):
cloudflared tunnel --url http://localhost:3000
```

Otrzymasz adres: `https://xyz.trycloudflare.com`

---

### Opcja C: Przekierowanie portów na routerze

> Wymaga stałego adresu IP lub Dynamic DNS (np. no-ip.com).

```powershell
# Sprawdź lokalny adres IP
ipconfig
# -> IPv4: 192.168.1.X
```

W routerze (http://192.168.1.1) → Port Forwarding:

| Pole            | Wartość                       |
| --------------- | ----------------------------- |
| Port zewnętrzny | `3000`                        |
| Port wewnętrzny | `3000`                        |
| Adres IP        | `192.168.1.X` (Twój komputer) |
| Protokół        | TCP                           |

Sprawdź publiczny IP: [https://whatismyip.com](https://whatismyip.com)

Aplikacja: `http://TWOJ_PUBLICZNY_IP:3000`

---

## 4. Zabezpieczenia

### Firewall na Windows:

```powershell
New-NetFirewallRule -DisplayName "S.O.K." -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
```

### Firewall na Linux (VPS):

```bash
sudo ufw allow 3000/tcp
```

### HTTPS przez Nginx + Let's Encrypt:

> **HTTPS jest wymagane w produkcji.** Bez reverse proxy z TLS funkcje przeglądarki
> mogą być blokowane na HTTP. W `.env` ustaw `COOKIE_SECURE=true`.

```bash
sudo apt install -y nginx certbot python3-certbot-nginx

# /etc/nginx/sites-available/sok-oferty
server {
    listen 80;
    server_name twojadomena.pl;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}

sudo ln -s /etc/nginx/sites-available/sok-oferty /etc/nginx/sites-enabled/
sudo certbot --nginx -d twojadomena.pl
```

### HTTPS przez Caddy (rekomendowany — automatyczny certyfikat)

```bash
sudo apt install caddy
export DOMAIN=twojadomena.pl
export EMAIL=twoj@email.com
caddy run --config Caddyfile
```

Caddy automatycznie wydaje i odnawia certyfikat Let's Encrypt oraz przekierowuje
HTTP → HTTPS. Konfiguracja w pliku `Caddyfile` w katalogu projektu.

---

## 5. Automatyczny restart serwera

### Windows — Task Scheduler:

1. Otwórz **Harmonogram zadań** (`taskschd.msc`)
2. Utwórz zadanie:
    - Wyzwalacz: Przy uruchomieniu komputera
    - Akcja: Uruchom program
    - Program: `start.bat`
    - Katalog startowy: ścieżka do projektu

### Linux (VPS) — PM2 (ZALECANE):

```bash
npm install -g pm2
pm2 start dist/server.js --name "sok-oferty"
pm2 save
pm2 startup
```

Przydatne komendy:

```bash
pm2 list              # Lista procesów
pm2 logs sok-oferty # Logi
pm2 restart sok-oferty
pm2 monit             # Monitor
```

---

## 6. Rozwiązywanie problemów

| Problem                   | Rozwiązanie                                            |
| ------------------------- | ------------------------------------------------------ |
| `npm install` nie działa  | Sprawdź Node.js: `node --version` (wymagane >= 22.13)  |
| Port zajęty               | Zmień `PORT` w `.env`                                  |
| Brak dostępu z zewnątrz   | Sprawdź firewall i przekierowanie portów               |
| Strona się nie ładuje     | Sprawdź logi: `pm2 logs sok-oferty`                    |
| Błąd bazy danych          | Uruchom `npm run prisma:reset` i `npm run prisma:seed` |
| Błąd "Cannot find module" | Uruchom `npm run build`                                |

### Backup i przenoszenie danych:

```powershell
# Backup
npm run backup

# Przywrócenie backupu na nowym urządzeniu:
npm run restore -- data/backups/backup_*.sqlite
```

Baza SQLite to jeden plik `data/app_database.sqlite` — backup i przeniesienie na inne urządzenie to kopiowanie tego pliku.

---

> **Podsumowanie:** Najszybszy start to **instalator (.bat) + ngrok** (5 minut). Najlepsza opcja na stałe to **VPS + PM2 + Nginx + HTTPS**. Darmowy VPS: **Oracle Cloud Free Tier**.
