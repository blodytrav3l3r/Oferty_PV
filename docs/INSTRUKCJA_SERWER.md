# WITROS Oferty â€” Instrukcja uruchomienia serwera przez Internet

**Wersja:** 1.10.0

## Spis treĹ›ci

1. [Wymagania](#1-wymagania)
2. [Instalacja na nowym urzÄ…dzeniu](#2-instalacja-na-nowym-urzÄ…dzeniu)
3. [UdostÄ™pnienie przez Internet](#3-udostÄ™pnienie-przez-internet)
    - Opcja A: VPS (serwer w chmurze)
    - Opcja B: Tunel (ngrok / Cloudflare Tunnel)
    - Opcja C: WĹ‚asny router (przekierowanie portĂłw)
4. [Zabezpieczenia](#4-zabezpieczenia)
5. [Automatyczny restart serwera](#5-automatyczny-restart-serwera)
6. [RozwiÄ…zywanie problemĂłw](#6-rozwiÄ…zywanie-problemĂłw)

---

## 1. Wymagania

| SkĹ‚adnik             | Wersja  | Opis                                                             |
| --------------------- | ------- | ---------------------------------------------------------------- |
| **Node.js**           | 20+     | [https://nodejs.org](https://nodejs.org) â€” pobierz wersjÄ™ LTS |
| **npm**               | 9+      | Instaluje siÄ™ automatycznie z Node.js                           |
| **Git** (opcjonalnie) | dowolna | Do pobierania aktualizacji                                       |

### Sprawdzenie instalacji:

```powershell
node --version
npm --version
```

---

## 2. Instalacja na nowym urzÄ…dzeniu

### Szybki start (Windows)

```powershell
# 1. Pobierz projekt (Git lub ZIP)
git clone https://github.com/blodytrav3l3r/Oferty_PV.git
cd Oferty_PV

# 2. Uruchom instalator
.\install.bat

# 3. Edytuj plik .env â€” ustaw hasĹ‚o administratora
#    DEFAULT_ADMIN_PASSWORD=twoje-haslo

# 4. Uruchom serwer
.\start.bat
```

Aplikacja bÄ™dzie dostÄ™pna pod adresem: **http://localhost:3000**

> **Uwaga (HTTPS):** do pracy zdalnej **HTTPS jest wymagane** â€” bez niego funkcje
> przeglÄ…darek (clipboard, `window.open()` itp.) mogÄ… byÄ‡ blokowane na HTTP.
> Zobacz sekcjÄ™ [4. Zabezpieczenia](#4-zabezpieczenia) i
> [ADR-006](adr/ADR-006-https-transport.md).

### Instalacja rÄ™czna (dowolny system)

**Opcja A â€” nowa instalacja (z seedem danych poczÄ…tkowych):**

```bash
git clone https://github.com/blodytrav3l3r/Oferty_PV.git
cd Oferty_PV
npm install
cp .env.example .env
# edytuj .env â€” ustaw DEFAULT_ADMIN_PASSWORD
npx prisma generate
npx prisma migrate deploy
# (baza bez historii migracji/_prisma_migrations: npx prisma db push --skip-generate --accept-data-loss)
npm run prisma:seed
npm run build
npm start
```

**Opcja B â€” z istniejÄ…cÄ… bazÄ… cennikĂłw (przeniesiona z innego urzÄ…dzenia):**

```bash
git clone https://github.com/blodytrav3l3r/Oferty_PV.git
cd Oferty_PV
npm install
cp .env.example .env
nano .env  # ustaw DEFAULT_ADMIN_PASSWORD
npx prisma generate
npx prisma migrate deploy
# (baza bez historii migracji/_prisma_migrations: npx prisma db push --skip-generate --accept-data-loss)
npm run build
# PrzywrĂłÄ‡ bazÄ™ z backupu (pomiĹ„ seed):
npm run backup:restore -- data/backups/backup_*.sqlite
npm start
```

### Pierwsze logowanie

1. OtwĂłrz **http://localhost:10000**
2. Zaloguj siÄ™: `admin` / hasĹ‚o z `.env`
3. ZmieĹ„ hasĹ‚o w ustawieniach profilu

---

## 3. UdostÄ™pnienie przez Internet

### Opcja A: Serwer VPS w chmurze (ZALECANA)

Aplikacja dziaĹ‚a 24/7 niezaleĹĽnie od Twojego komputera.

#### Popularne usĹ‚ugi VPS:

| UsĹ‚uga              | Cena od                 | Strona                                       |
| -------------------- | ----------------------- | -------------------------------------------- |
| **Mikr.us** đź‡µđź‡± | ~30 PLN/rok             | [mikr.us](https://mikr.us)                   |
| **OVH** đź‡µđź‡±     | ~20 PLN/mies.           | [ovh.pl](https://www.ovh.pl)                 |
| **Hetzner**          | ~â‚¬4/mies.             | [hetzner.com](https://hetzner.com)           |
| **DigitalOcean**     | $6/mies.                | [digitalocean.com](https://digitalocean.com) |
| **Oracle Cloud**     | **DARMOWY** (free tier) | [cloud.oracle.com](https://cloud.oracle.com) |

#### Krok po kroku na VPS (Ubuntu/Debian):

**1. PoĹ‚Ä…cz siÄ™ przez SSH:**

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

Lub uĹĽyj **WinSCP** (graficzny klient SFTP).

**4. Zainstaluj i uruchom:**

```bash
cd /home/witros
npm install
cp .env.example .env
nano .env  # ustaw DEFAULT_ADMIN_PASSWORD
npx prisma generate
npx prisma migrate deploy
# (baza bez historii migracji/_prisma_migrations: npx prisma db push --skip-generate --accept-data-loss)
npm run build
# Opcja A: nowa instalacja
npm run prisma:seed
# Opcja B: jeĹ›li przenosisz bazÄ™ z innego urzÄ…dzenia â€” zamiast seed:
# npm run backup:restore -- data/backups/backup_*.sqlite
npm start
```

**5. OtwĂłrz w przeglÄ…darce:**

```
http://TWOJ_ADRES_IP:10000
```

---

### Opcja B: Tunel (szybki sposĂłb, bez VPS-a)

Tunel udostÄ™pnia aplikacjÄ™ z Twojego komputera przez Internet bez konfiguracji routera.

#### Wariant 1: ngrok (najprostszy)

```powershell
# 1. Pobierz ngrok: https://ngrok.com/download
# 2. ZaĹ‚ĂłĹĽ konto i pobierz token
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

### Opcja C: Przekierowanie portĂłw na routerze

> Wymaga staĹ‚ego adresu IP lub Dynamic DNS (np. no-ip.com).

```powershell
# SprawdĹş lokalny adres IP
ipconfig
# -> IPv4: 192.168.1.X
```

W routerze (http://192.168.1.1) â†’ Port Forwarding:

| Pole             | WartoĹ›Ä‡                      |
| ---------------- | ------------------------------ |
| Port zewnÄ™trzny | `10000`                        |
| Port wewnÄ™trzny | `10000`                        |
| Adres IP         | `192.168.1.X` (TwĂłj komputer) |
| ProtokĂłĹ‚       | TCP                            |

SprawdĹş publiczny IP: [https://whatismyip.com](https://whatismyip.com)

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

> **HTTPS jest wymagane w produkcji.** Bez reverse proxy z TLS funkcje przeglÄ…darki
> mogÄ… byÄ‡ blokowane na HTTP. W `.env` ustaw `COOKIE_SECURE=true`.

```bash
sudo apt install -y nginx certbot python3-certbot-nginx

# /etc/nginx/sites-available/witros
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

sudo ln -s /etc/nginx/sites-available/witros /etc/nginx/sites-enabled/
sudo certbot --nginx -d twojadomena.pl
```

### HTTPS przez Caddy (rekomendowany â€” automatyczny certyfikat)

```bash
sudo apt install caddy
export DOMAIN=twojadomena.pl
export EMAIL=twoj@email.com
caddy run --config Caddyfile
```

Caddy automatycznie wydaje i odnawia certyfikat Let's Encrypt oraz przekierowuje
HTTP â†’ HTTPS. Konfiguracja w pliku `Caddyfile` w katalogu projektu.

---

## 5. Automatyczny restart serwera

### Windows â€” Task Scheduler:

1. OtwĂłrz **Harmonogram zadaĹ„** (`taskschd.msc`)
2. UtwĂłrz zadanie:
    - Wyzwalacz: Przy uruchomieniu komputera
    - Akcja: Uruchom program
    - Program: `start.bat`
    - Katalog startowy: Ĺ›cieĹĽka do projektu

### Linux (VPS) â€” PM2 (ZALECANE):

```bash
npm install -g pm2
pm2 start dist/server.js --name "witros-oferty"
pm2 save
pm2 startup
```

Przydatne komendy:

```bash
pm2 list              # Lista procesĂłw
pm2 logs witros-oferty # Logi
pm2 restart witros-oferty
pm2 monit             # Monitor
```

---

## 6. RozwiÄ…zywanie problemĂłw

| Problem                     | RozwiÄ…zanie                                           |
| --------------------------- | ------------------------------------------------------ |
| `npm install` nie dziaĹ‚a   | SprawdĹş Node.js: `node --version`                     |
| Port zajÄ™ty                | ZmieĹ„ `PORT` w `.env`                                 |
| Brak dostÄ™pu z zewnÄ…trz   | SprawdĹş firewall i przekierowanie portĂłw             |
| Strona siÄ™ nie Ĺ‚aduje     | SprawdĹş logi: `pm2 logs witros-oferty`                |
| BĹ‚Ä…d bazy danych          | Uruchom `npm run prisma:reset` i `npm run prisma:seed` |
| BĹ‚Ä…d "Cannot find module" | Uruchom `npm run build`                                |

### Backup i przenoszenie danych:

```powershell
# Backup
npm run backup

# PrzywrĂłcenie backupu na nowym urzÄ…dzeniu:
npm run backup:restore -- data/backups/backup_*.sqlite
```

Baza SQLite to jeden plik `data/app_database.sqlite` â€” backup i przeniesienie na inne urzÄ…dzenie to kopiowanie tego pliku.

---

> **Podsumowanie:** Najszybszy start to **instalator (.bat) + ngrok** (5 minut). Najlepsza opcja na staĹ‚e to **VPS + PM2 + Nginx + HTTPS**. Darmowy VPS: **Oracle Cloud Free Tier**.
