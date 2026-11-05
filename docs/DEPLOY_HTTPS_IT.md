# Wdrożenie HTTPS na serwerze — instrukcja dla działu IT

Dokument opisuje docelową konfigurację transportu HTTPS dla S.O.K. (ADR-006).
Tryb awaryjny bez TLS opisuje ADR-017 (`HTTPS_ENABLED=false`) — sekcja 3C.

Zakres: konfiguracja serwera produkcyjnego. Nie zmienia logiki ofert, cen ani bazy.

> **Status bazy danych:** wymaganym silnikiem jest PostgreSQL 18. Migracja aplikacji
> i pełna weryfikacja CI/Compose trwają; poniższe kroki HTTPS nie oznaczają zgody
> ani gotowości do produkcyjnego cutoveru. Przed wdrożeniem wymagane są zielone
> bramki z `docs/DEPLOYMENT.md` i osobne GO na cutover.

---

## 1. Zanim cokolwiek zrobicie: ustalcie 5 faktów

Bez tych odpowiedzi nie da się wybrać wariantu. Nie zgadujcie — sprawdźcie na maszynie.

| #   | Pytanie                                                         | Jak sprawdzić                                                   |
| --- | --------------------------------------------------------------- | --------------------------------------------------------------- |
| 1   | System serwera                                                  | `uname -a` (Linux) / `winver` (Windows)                         |
| 2   | Jak działa aplikacja: Docker czy bezpośrednio (PM2/usługa/bat)? | `docker ps` oraz `pm2 list` / `services.msc`                    |
| 3   | Czy jest już reverse proxy (Caddy/Nginx)?                       | `caddy version`, `nginx -v`, `ss -ltnp \| grep -E ':(80\|443)'` |
| 4   | Czy serwer ma nazwę DNS, czy tylko IP?                          | `nslookup <nazwa>`; kto zarządza strefą DNS                     |
| 5   | Czy port 80 z zewnątrz jest osiągalny (dla Let's Encrypt)?      | test z innej maszyny / firewall                                 |

Dopiero potem wybierzcie wariant z sekcji 3.

---

## 2. Jak ma wyglądać poprawny ruch

```
przeglądarka --HTTPS 443--> Caddy/Nginx (TLS) --HTTP 127.0.0.1:3000--> Node/Express
```

Zasady, których nie wolno łamać:

- Node **nie** jest wystawiony do sieci — słucha tylko na `127.0.0.1:3000` (albo
  `0.0.0.0:10000` wewnątrz kontenera Docker, z mapowaniem `3000:10000`).
- Port 3000 **nie** jest otwarty w firewallu na świat.
- `X-Forwarded-Proto` ustawia proxy — aplikacja po nim rozpoznaje HTTPS (`trust proxy` = 1).
- `HTTPS_ENABLED` **nie może** być ustawione na `false` w trybie docelowym.
- Certyfikat musi być **zaufany przez przeglądarki klientów**. Self-signed bez
  wdrożenia CA do zaufanych = powrót do błędu `ERR_CERT_AUTHORITY_INVALID`
  i znowu „zapis oferty nie działa”.

---

## 3. Trzy warianty — wybierzcie jeden

### Wariant A — publiczna nazwa + Let's Encrypt (zalecany)

Wymaga: nazwa DNS wskazująca na serwer, port 80 osiągalny z internetu.

```bash
# 1. Instalacja Caddy (Debian/Ubuntu)
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy

# 2. Konfiguracja (plik z repo: Caddyfile)
sudo cp Caddyfile /etc/caddy/Caddyfile

# 3. Zmienne dla Caddy
sudo systemctl edit caddy
# w [Service] dopisz:
# Environment="DOMAIN=oferty.twojadomena.pl"
# Environment="EMAIL=it@twojadomena.pl"

# 4. Start
sudo systemctl daemon-reload
sudo systemctl enable --now caddy
sudo systemctl status caddy
```

Caddy sam pobierze i odnowi certyfikat. Nic więcej nie trzeba.

### Wariant B — tylko LAN, nazwa wewnętrzna + własny CA

Wymaga: serwer Certyfikacji (AD CS) albo Caddy z własnym CA, **oraz** wdrożenia
certyfikatu CA do zaufanych na wszystkich komputerach (GPO).

Wariant B1 — Caddy z własnym CA (najprościej):

```caddyfile
# /etc/caddy/Caddyfile — zamiast wpisu z repo
https://sok.firma.local {
    tls internal

    encode gzip
    header {
        Strict-Transport-Security "max-age=63072000; includeSubDomains"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "strict-origin-when-cross-origin"
    }
    reverse_proxy 127.0.0.1:3000 {
        header_up X-Forwarded-Proto {scheme}
    }
}
```

Potem **obowiązkowo**:

```bash
# wyeksportuj root CA Caddy
sudo cat /var/lib/caddy/.local/share/caddy/pki/authorities/local/root.crt
```

Ten plik (`root.crt`) wgraj przez GPO do `Zaufane główne urzędy certyfikacji`
na wszystkich stacjach. **Bez tego kroku użytkownicy znowu zobaczą
`ERR_CERT_AUTHORITY_INVALID`.**

Wariant B2 — certyfikat z AD CS: wygeneruj CSR, pobierz certyfikat, w Caddy użyj:

```caddyfile
tls /etc/caddy/sok.crt /etc/caddy/sok.key
```

(plus wdrożenie CA firmy przez GPO, jeśli jeszcze nie jest).

### Wariant C — awaryjny HTTP (ADR-017), tylko tymczasowo

Gdy nie ma nazwy DNS ani CA, a ludzie muszą pracować **teraz**:

1. W `.env` aplikacji (na serwerze):

    ```env
    HTTPS_ENABLED=false
    PUBLIC_BASE_URL=http://<faktyczny-adres>
    HOST=0.0.0.0          # tylko jeśli nie ma proxy przed aplikacją
    COOKIE_SECURE=false
    TRUST_PROXY=0         # brak proxy
    ```

2. Wyłączcie przekierowanie na proxy **albo** zatrzymajcie proxy i wystawcie port
   aplikacji bezpośrednio.
3. Restart aplikacji.
4. Sprawdźcie, że odpowiedź **nie ma** nagłówków `Strict-Transport-Security`
   i `upgrade-insecure-requests`:

    ```bash
    curl -sI http://<adres>:3000/ | grep -Ei 'strict-transport|content-security'
    ```

To jest tryb **nieszyfrowany**. Dopuszczalny wyłącznie w sieci LAN/VPN.
Nie jest trybem docelowym.

---

## 4. Wdrożenie nowej wersji aplikacji na serwerze

Zależnie od sposobu uruchomienia (ustalcie w kroku 1).

### 4.1 Docker

```bash
cd <katalog-projektu>
node scripts/deploy.mjs docker vX.Y.Z      # X.Y.Z = wersja z pliku VERSION
# równoważnie:
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 app
```

Zakazane: `docker compose down -v` — kasuje dane.

### 4.2 Linux + PM2

```bash
cd <katalog-projektu>
node scripts/deploy.mjs linux vX.Y.Z       # X.Y.Z = wersja z pliku VERSION
# równoważnie:
git fetch --tags && git checkout vX.Y.Z
npm ci
npx prisma migrate deploy
npm run build
node scripts/copy-prisma-client.mjs      # jeśli build był bez build.sh
pm2 reload ecosystem.config.cjs
pm2 status
```

### 4.3 Windows (usługa / `start.bat`)

```bat
node scripts\deploy.mjs windows vX.Y.Z
```

Skrypt zatrzymuje usługę, podmienia pliki, robi backup bazy, startuje i sprawdza health.

**Przed każdym deployem:** po zakończeniu migracji wykonaj i zweryfikuj backup
PostgreSQL przez `npm run backup`. Aplikacja łączy się przez jawny `DATABASE_URL`;
plik bazy nie znajduje się w katalogu projektu.

---

## 5. Konfiguracja `.env` po wdrożeniu (tryb HTTPS docelowy)

```env
NODE_ENV=production
HOST=127.0.0.1
PORT=3000
TRUST_PROXY=1
COOKIE_SECURE=true
PUBLIC_BASE_URL=https://sok.twojadomena.pl
# HTTPS_ENABLED nieustawione = true (HTTPS włączone). NIE ustawiaj false.
```

Po zmianie `.env` — restart aplikacji (bez restartu zmienne nie zadziałają).

---

## 6. Firewall

Linux (ufw):

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw deny 3000/tcp
sudo ufw status verbose
```

Windows: reguła przychodząca tylko 80 i 443; 3000 zablokowany.

Sprawdźcie, że z innej maszyny `http://<ip>:3000` **nie odpowiada**.

---

## 7. Weryfikacja — checklista odbioru

Wykonujcie po kolei; każde „NIE” = wdrożenie nieukończone.

### 7.1 Certyfikat

```bash
openssl s_client -connect sok.twojadomena.pl:443 -servername sok.twojadomena.pl </dev/null 2>/dev/null | openssl x509 -noout -subject -issuer -dates
```

- [ ] `issuer` to zaufany CA (Let's Encrypt / CA firmy), nie „self-signed”
- [ ] data ważności > 30 dni
- [ ] `curl -sI https://sok.twojadomena.pl | head -1` → `HTTP/2 200` lub `200`

### 7.2 Nagłówki

```bash
curl -sI https://sok.twojadomena.pl/ | grep -Ei 'strict-transport|content-security|x-content-type|referrer'
```

- [ ] jest `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- [ ] jest `Content-Security-Policy` z `upgrade-insecure-requests`
- [ ] jest `X-Content-Type-Options: nosniff`
- [ ] **brak** `upgrade-insecure-requests` tylko wtedy, gdy świadomie jedziecie
      wariantem C

### 7.3 Przekierowanie HTTP → HTTPS

```bash
curl -sI http://sok.twojadomena.pl/ | head -3
```

- [ ] `301`/`308` na `https://...`
- [ ] brak pętli (nie kończy się `too many redirects`)

### 7.4 Aplikacja

- [ ] `curl -s https://sok.twojadomena.pl/health/ready` → `{"status":"ok"...}`
- [ ] `curl -s https://sok.twojadomena.pl/api/version` → wersja `X.Y.Z` (ta sama co w `VERSION`)

### 7.5 Przeglądarka (na komputerze użytkownika, nie na serwerze)

- [ ] kłódka bez ostrzeżenia, certyfikat „zaufany”
- [ ] DevTools → Console: **zero** `ERR_CERT_AUTHORITY_INVALID`,
      `ERR_SSL_PROTOCOL_ERROR`, mixed content
- [ ] logowanie działa i **nie wylogowuje po odświeżeniu** (cookie `Secure` ustawione)
- [ ] zapis oferty studni → 200 i oferta widoczna po odświeżeniu
- [ ] zapis oferty rur → 200
- [ ] generowanie PDF działa (Puppeteer w kontenerze)
- [ ] Excel/kopiowanie do schowka działa (wymaga secure context — dlatego HTTPS)

### 7.6 Klienci w LAN

- [ ] na 2–3 różnych komputerach (Windows/Chrome/Edge/Firefox) brak ostrzeżenia
      o certyfikacie

---

## 8. Rozwiązywanie problemów

| Objaw                                                 | Przyczyna                                                          | Naprawa                                                                    |
| ----------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `ERR_CERT_AUTHORITY_INVALID`                          | certyfikat self-signed / CA niewdrożone do klientów                | wdróż `root.crt` przez GPO albo użyj Let's Encrypt                         |
| `ERR_SSL_PROTOCOL_ERROR`                              | przeglądarka idzie na HTTPS, a nic na 443 nie słucha               | napraw Caddy/Nginx albo przełącz na wariant C                              |
| Pętla przekierowań                                    | i proxy, i aplikacja przekierowują                                 | `TRUST_PROXY=1` i poprawne `X-Forwarded-Proto` w proxy                     |
| Logowanie „przechodzi”, ale sesja znika               | cookie `Secure` po HTTP albo brak `trust proxy`                    | `COOKIE_SECURE=true` tylko przy realnym HTTPS; sprawdź `X-Forwarded-Proto` |
| 502 Bad Gateway                                       | aplikacja nie działa / zły port                                    | `systemctl status sok`, `curl http://127.0.0.1:3000/health/ready`          |
| Strona ładuje się, ale zapis oferty „Failed to fetch” | CSP `upgrade-insecure-requests` przy HTTP albo blokada certyfikatu | sprawdź, czy `HTTPS_ENABLED` zgadza się z realnym transportem              |
| Certyfikat wygasł                                     | brak auto-odnawiania                                               | `systemctl status caddy`, `caddy list-certificates`, monitoring ważności   |

---

## 9. Rollback

```bash
node scripts/rollback.mjs <windows|linux|docker> <poprzedni-tag>
```

Rollback przywraca też backup bazy — **stracicie dane zapisane po deployu**.
Dlatego deploy tylko w oknie serwisowym.

---

## 10. Co zapisać w dokumentacji po wdrożeniu

- faktyczny adres aplikacji (nazwa + port + ścieżka),
- wariant TLS (A/B/C) i kto zarządza certyfikatem,
- data ważności certyfikatu i sposób odnawiania,
- gdzie leży CA (jeśli wariant B),
- kto ma dostęp SSH/RDP i gdzie są backupy,
- wynik checklisty z sekcji 7 z datą i podpisem.

---

## Uwaga o obecnym stanie

Na serwerze nie ma jeszcze wdrożonej bieżącej wersji z pliku `VERSION`, a repozytorium
nie ma automatycznego deployu — ktoś musi wykonać sekcję 4 ręcznie. Do tego czasu stary
błąd certyfikatu zostaje.

## Referencje

- ADR-006: `docs/adr/ADR-006-https-transport.md` (HTTPS — decyzja docelowa)
- ADR-017: `docs/adr/ADR-017-awaryjny-http-w-lan-za-vpn.md` (tryb awaryjny HTTP)
- Wdrożenie: `docs/DEPLOYMENT.md`, `docs/DEPLOY_UPDATE.md`
- Konfiguracja proxy: `Caddyfile`, `Caddyfile.dev`
- Testy: `tests/security.test.ts`, `tests/security/headers.test.ts`
