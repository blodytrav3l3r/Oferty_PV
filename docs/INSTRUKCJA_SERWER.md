# WITROS Oferty — Instrukcja uruchomienia serwera przez Internet

**Wersja:** 1.5.0

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

| Składnik              | Wersja  | Opis                                                          |
| --------------------- | ------- | ------------------------------------------------------------- |
| **Node.js**           | 20+     | [https://nodejs.org](https://nodejs.org) — pobierz wersję LTS |
| **npm**               | 9+      | Instaluje się automatycznie z Node.js                         |
| **Git** (opcjonalnie) | dowolna | Do pobierania aktualizacji                                    |

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

Aplikacja będzie dostępna pod adresem: **http://localhost:10000**

### Instalacja ręczna (dowolny system)

**Opcja A — nowa instalacja (z seedem danych początkowych):**

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
npm start
```

**Opcja B — z istniejącą bazą cenników (przeniesiona z innego urządzenia):**

```bash
git clone https://github.com/blodytrav3l3r/Oferty_PV.git
cd Oferty_PV
npm install
cp .env.example .env
nano .env  # ustaw DEFAULT_ADMIN_PASSWORD
npx prisma generate
npx prisma migrate dev
npm run build
# Przywróć bazę z backupu (pomiń seed):
npm run backup:restore -- data/backups/backup_*.sqlite
npm start
```

### Pierwsze logowanie

1. Otwórz **http://localhost:10000**
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

**2. Zainstaluj Node.js 20:**

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git
```

**3. Skopiuj pliki na serwer (z lokalnego komputera):**

```powershell
scp -r Oferty_PV root@TWOJ_ADRES_IP:/home/witros/
```

Lub użyj **WinSCP** (graficzny klient SFTP).

**4. Zainstaluj i uruchom:**

```bash
cd /home/witros
npm install
cp .env.example .env
nano .env  # ustaw DEFAULT_ADMIN_PASSWORD
npx prisma generate
npx prisma migrate dev
npm run build
# Opcja A: nowa instalacja
npm run prisma:seed
# Opcja B: jeśli przenosisz bazę z innego urządzenia — zamiast seed:
# npm run backup:restore -- data/backups/backup_*.sqlite
npm start
```

**5. Otwórz w przeglądarce:**

```
http://TWOJ_ADRES_IP:10000
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
ngrok http 10000
```

Otrzymasz adres: `https://abc123.ngrok-free.app`

#### Wariant 2: Cloudflare Tunnel (darmowy, stabilniejszy)

```powershell
# 1. Pobierz cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
# 2. Szybki tunel (bez konfiguracji):
cloudflared tunnel --url http://localhost:10000
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
| Port zewnętrzny | `10000`                       |
| Port wewnętrzny | `10000`                       |
| Adres IP        | `192.168.1.X` (Twój komputer) |
| Protokół        | TCP                           |

Sprawdź publiczny IP: [https://whatismyip.com](https://whatismyip.com)

Aplikacja: `http://TWOJ_PUBLICZNY_IP:10000`

---

## 4. Zabezpieczenia

### Firewall na Windows:

```powershell
New-NetFirewallRule -DisplayName "WITROS Oferty" -Direction Inbound -LocalPort 10000 -Protocol TCP -Action Allow
```

### Firewall na Linux (VPS):

```bash
sudo ufw allow 10000/tcp
```

### HTTPS przez Nginx + Let's Encrypt:

```bash
sudo apt install -y nginx certbot python3-certbot-nginx

# /etc/nginx/sites-available/witros
server {
    listen 80;
    server_name twojadomena.pl;
    location / {
        proxy_pass http://localhost:10000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}

sudo ln -s /etc/nginx/sites-available/witros /etc/nginx/sites-enabled/
sudo certbot --nginx -d twojadomena.pl
```

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
pm2 start dist/server.js --name "witros-oferty"
pm2 save
pm2 startup
```

Przydatne komendy:

```bash
pm2 list              # Lista procesów
pm2 logs witros-oferty # Logi
pm2 restart witros-oferty
pm2 monit             # Monitor
```

---

## 6. Rozwiązywanie problemów

| Problem                   | Rozwiązanie                                            |
| ------------------------- | ------------------------------------------------------ |
| `npm install` nie działa  | Sprawdź Node.js: `node --version`                      |
| Port zajęty               | Zmień `PORT` w `.env`                                  |
| Brak dostępu z zewnątrz   | Sprawdź firewall i przekierowanie portów               |
| Strona się nie ładuje     | Sprawdź logi: `pm2 logs witros-oferty`                 |
| Błąd bazy danych          | Uruchom `npm run prisma:reset` i `npm run prisma:seed` |
| Błąd "Cannot find module" | Uruchom `npm run build`                                |

### Backup i przenoszenie danych:

```powershell
# Backup
npm run backup

# Przywrócenie backupu na nowym urządzeniu:
npm run backup:restore -- data/backups/backup_*.sqlite
```

Baza SQLite to jeden plik `data/app_database.sqlite` — backup i przeniesienie na inne urządzenie to kopiowanie tego pliku.

---

> **Podsumowanie:** Najszybszy start to **instalator (.bat) + ngrok** (5 minut). Najlepsza opcja na stałe to **VPS + PM2 + Nginx + HTTPS**. Darmowy VPS: **Oracle Cloud Free Tier**.
