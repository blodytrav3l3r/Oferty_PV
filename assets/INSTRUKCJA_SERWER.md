# 🚀 WITROS Oferty — Instrukcja uruchomienia serwera przez Internet

## Spis treści
1. [Wymagania](#1-wymagania)
2. [Uruchomienie lokalne](#2-uruchomienie-lokalne)
3. [Udostępnienie przez Internet](#3-udostępnienie-przez-internet)
   - Opcja A: VPS (serwer w chmurze)
   - Opcja B: Tunel (ngrok / Cloudflare Tunnel)
   - Opcja C: Własny router (przekierowanie portów)
4. [Zabezpieczenia](#4-zabezpieczenia)
5. [Automatyczny restart serwera](#5-automatyczny-restart-serwera)
6. [Rozwiązywanie problemów](#6-rozwiązywanie-problemów)

---

## 1. Wymagania

| Składnik | Wersja | Opis |
|----------|--------|------|
| **Node.js** | 18+ | [https://nodejs.org](https://nodejs.org) — pobierz wersję LTS |
| **npm** | 9+ | Instaluje się automatycznie z Node.js |
| **Git** (opcjonalnie) | dowolna | Do pobierania aktualizacji |

### Sprawdzenie czy Node.js jest zainstalowany:
```powershell
node --version
npm --version
```

---

## 2. Uruchomienie lokalne

### Krok 1: Zainstaluj zależności
Otwórz terminal w folderze projektu (`d:\Antigravity`) i wykonaj:
```powershell
cd d:\Antigravity
npm install
```

### Krok 2: Uruchom serwer
```powershell
npm start
```

Powinien pojawić się komunikat:
```
  🚀 WITROS Oferty — serwer działa na:
     http://localhost:3000
     Dane zapisywane w: d:\Antigravity\data
```

### Krok 3: Otwórz aplikację
W przeglądarce wejdź na: **http://localhost:3000**

> ⚠️ Na tym etapie aplikacja działa tylko na Twoim komputerze. Aby udostępnić ją przez Internet, przejdź do następnego rozdziału.

---

## 3. Udostępnienie przez Internet

### Opcja A: Serwer VPS w chmurze (ZALECANA)

To najlepsza opcja na stałe — aplikacja działa 24/7 niezależnie od Twojego komputera.

#### Popularne usługi VPS:
| Usługa | Cena od | Strona |
|--------|---------|--------|
| **Mikr.us** 🇵🇱 | ~30 PLN/rok | [mikr.us](https://mikr.us) |
| **OVH** 🇵🇱 | ~20 PLN/mies. | [ovh.pl](https://www.ovh.pl) |
| **Hetzner** | ~€4/mies. | [hetzner.com](https://hetzner.com) |
| **DigitalOcean** | $6/mies. | [digitalocean.com](https://digitalocean.com) |
| **Oracle Cloud** | **DARMOWY** (free tier) | [cloud.oracle.com](https://cloud.oracle.com) |

#### Krok po kroku na VPS (Ubuntu/Debian):

**1. Połącz się z serwerem przez SSH:**
```bash
ssh root@TWOJ_ADRES_IP
```

**2. Zainstaluj Node.js:**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**3. Skopiuj pliki aplikacji na serwer:**

Na swoim komputerze (Windows) wykonaj w PowerShell:
```powershell
scp -r d:\Antigravity root@TWOJ_ADRES_IP:/home/witros/
```

Lub użyj programu **WinSCP** (graficzny interfejs do przesyłania plików):
- Połącz się z serwerem
- Przeciągnij cały folder `Antigravity` do `/home/witros/`

**4. Na serwerze zainstaluj zależności i uruchom:**
```bash
cd /home/witros
npm install
npm start
```

**5. Otwórz w przeglądarce:**
```
http://TWOJ_ADRES_IP:3000
```

---

### Opcja B: Tunel (szybki sposób, bez VPS-a)

Tunel pozwala udostępnić aplikację z Twojego komputera przez Internet **bez konfiguracji routera**.

#### Wariant 1: ngrok (najprostszy)

**1. Pobierz ngrok:** [https://ngrok.com/download](https://ngrok.com/download)

**2. Załóż darmowe konto** i skopiuj swój token autoryzacyjny.

**3. Uruchom serwer:**
```powershell
cd d:\Antigravity
npm start
```

**4. W osobnym terminalu uruchom ngrok:**
```powershell
ngrok http 3000
```

**5. Skopiuj wygenerowany adres**, np:
```
https://abc123.ngrok-free.app
```
Ten adres możesz wysłać komukolwiek — będzie działał dopóki ngrok jest uruchomiony.

#### Wariant 2: Cloudflare Tunnel (darmowy, stabilniejszy)

**1. Pobierz cloudflared:** [https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)

**2. Szybki tunel (bez konfiguracji):**
```powershell
cloudflared tunnel --url http://localhost:3000
```

Otrzymasz adres `https://xyz.trycloudflare.com`.

---

### Opcja C: Przekierowanie portów na routerze

> ⚠️ Ta opcja wymaga stałego adresu IP lub usługi Dynamic DNS (np. no-ip.com).

**1. Sprawdź swój adres IP w sieci lokalnej:**
```powershell
ipconfig
```
Zapisz **adres IPv4** (np. `192.168.1.105`).

**2. Wejdź w ustawienia routera** (zazwyczaj `http://192.168.1.1`).

**3. Znajdź sekcję** „Port Forwarding" / „Przekierowanie portów".

**4. Dodaj regułę:**
| Pole | Wartość |
|------|---------|
| Port zewnętrzny | `3000` |
| Port wewnętrzny | `3000` |
| Adres IP | `192.168.1.105` (Twój komputer) |
| Protokół | TCP |

**5. Sprawdź swój publiczny adres IP:**
Wejdź na [https://whatismyip.com](https://whatismyip.com) i skopiuj adres.

**6. Aplikacja będzie dostępna pod:**
```
http://TWOJ_PUBLICZNY_IP:3000
```

**7. (Opcjonalnie) Dynamic DNS:**
Jeśli Twój operator zmienia adres IP, załóż konto na [https://www.noip.com](https://www.noip.com) i skonfiguruj aktualizację DNS — dzięki temu będziesz miał stały adres typu `mojaapka.ddns.net`.

---

## 4. Zabezpieczenia

### Zmiana portu (zalecane):
Uruchom serwer na innym porcie:
```powershell
$env:PORT=8080; node server.js
```
Lub na Linuxie:
```bash
PORT=8080 node server.js
```

### Firewall na Windows:
Zezwól na ruch przychodzący na wybranym porcie:
```powershell
New-NetFirewallRule -DisplayName "WITROS Serwer" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
```

### Firewall na Linux (VPS):
```bash
sudo ufw allow 3000/tcp
```

### HTTPS (szyfrowane połączenie):
Na VPS-ie najłatwiej użyć **Nginx** jako reverse proxy z certyfikatem Let's Encrypt:

```bash
# Zainstaluj Nginx i Certbot
sudo apt install -y nginx certbot python3-certbot-nginx

# Konfiguracja Nginx (/etc/nginx/sites-available/witros)
server {
    listen 80;
    server_name twojadomena.pl;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

# Aktywuj konfigurację
sudo ln -s /etc/nginx/sites-available/witros /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Wygeneruj certyfikat SSL (darmowy)
sudo certbot --nginx -d twojadomena.pl
```

Po tym aplikacja będzie dostępna pod: `https://twojadomena.pl`

---

## 5. Automatyczny restart serwera

### Na Windows — Task Scheduler:

1. Otwórz **Harmonogram zadań** (`taskschd.msc`)
2. Utwórz nowe zadanie:
   - **Wyzwalacz:** Przy uruchomieniu komputera
   - **Akcja:** Uruchom program
   - **Program:** `node`
   - **Argumenty:** `server.js`
   - **Katalog startowy:** `d:\Antigravity`

### Na Linux (VPS) — PM2 (ZALECANE):

**1. Zainstaluj PM2:**
```bash
sudo npm install -g pm2
```

**2. Uruchom aplikację przez PM2:**
```bash
cd /home/witros
pm2 start server.js --name "witros"
```

**3. Zapisz konfigurację do autostartu:**
```bash
pm2 save
pm2 startup
```

Teraz serwer automatycznie uruchomi się po restarcie VPS-a.

**Przydatne komendy PM2:**
```bash
pm2 list              # Lista procesów
pm2 logs witros       # Logi aplikacji
pm2 restart witros    # Restart
pm2 stop witros       # Zatrzymaj
pm2 monit             # Monitor w czasie rzeczywistym
```

### Na Linux — systemd (alternatywa):
Utwórz plik `/etc/systemd/system/witros.service`:
```ini
[Unit]
Description=WITROS Oferty
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/home/witros
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

Aktywuj:
```bash
sudo systemctl enable witros
sudo systemctl start witros
sudo systemctl status witros
```

---

## 6. Rozwiązywanie problemów

| Problem | Rozwiązanie |
|---------|-------------|
| `npm install` nie działa | Sprawdź czy Node.js jest zainstalowany: `node --version` |
| Port 3000 jest zajęty | Zmień port: `PORT=8080 node server.js` |
| Brak dostępu z zewnątrz | Sprawdź firewall i przekierowanie portów |
| Strona się nie ładuje | Sprawdź logi: `pm2 logs witros` lub w terminalu |
| Dane się nie zapisują | Sprawdź uprawnienia do folderu `data/` |
| ngrok wyłącza się | Darmowy plan ma limit czasu — rozważ VPS |

### Sprawdzenie czy port jest otwarty:
```bash
# Z innego komputera:
curl http://TWOJ_ADRES_IP:3000
```

### Backup danych:
Wszystkie dane aplikacji znajdują się w folderze `data/`:
```
data/
├── products.json          # Cennik
├── products_default.json  # Cennik domyślny (do resetu)
├── offers.json            # Zapisane oferty
└── clients.json           # Baza klientów
```

Regularnie kopiuj ten folder w bezpieczne miejsce!

---

> 💡 **Podsumowanie:** Najszybszy start to **ngrok** (5 minut). Najlepsza opcja na stałe to **VPS + PM2 + Nginx + HTTPS**. Najtańsza opcja to **Oracle Cloud Free Tier** (darmowy VPS na zawsze).
