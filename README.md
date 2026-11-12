# S.O.K. — System Ofert i Kalkulacji

<div align="center" style="background:#111827;border-radius:22px;padding:16px;margin:16px 0">
    <img src="public/images/logo-sok.svg" alt="S.O.K. — System Ofert i Kalkulacji" width="480" />
</div>

**Wersja:** 1.57.0  
**Stack:** Express + Prisma 7 + PostgreSQL 18 + VanillaJS SPA + ML Pipeline<br>
**Licencja:** Własnościowa — szczegóły w pliku [LICENSE](LICENSE)  
**Autor:** Łukasz Kobyłka

---

## Opis

S.O.K. — System Ofert i Kalkulacji to aplikacja webowa do generowania ofert handlowych dla branży kanalizacyjnej — studni oraz rur betonowych do kanalizacji i odwodnienia dróg. Umożliwia zarządzanie produktami, klientami, tworzenie ofert (zarówno dla rur jak i studni), generowanie dokumentów PDF/DOCX, monitorowanie zamówień oraz inteligentne rankowanie rozwiązań (ML).

Nazwa aplikacji wyświetlana na pulpicie i stronie logowania: **S.O.K. (System Ofert i Kalkulacji)** (rebranding z 2026-08-09, commit `a4b853f`).

Aplikacja działa jako **Single Page Application (SPA)** z backendem Express.js i PostgreSQL 18 jako jedyną bazą runtime oraz testów. Wydanie 1.56.4 przeszło lokalne bramki PostgreSQL 18, w tym integracyjne i health check. Wdrożenie produkcyjne wymaga osobnej akceptacji, backup/restore planu oraz walidacji docelowego serwera Linux. Szczegóły: [docs/DATABASE.md](docs/DATABASE.md) i [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

---

## Spis treści

- [Instalacja na nowym urządzeniu](#instalacja-na-nowym-urządzeniu)
- [Konfiguracja (.env)](#konfiguracja-env)
- [Uruchomienie](#uruchomienie)
- [Aktualizacja aplikacji (deploy)](#aktualizacja-aplikacji-deploy)
- [Skrypty startowe (.bat)](#skrypty-startowe-bat)
- [Komendy](#komendy)
- [Struktura projektu](#struktura-projektu)
- [Dokumentacja API](#dokumentacja-api)
- [AI/ML Pipeline](#aiml-pipeline)
- [Contributing](#contributing)
- [Code of Conduct](#code-of-conduct)
- [Security](#security)
- [Dokumentacja techniczna i operacyjna](docs/README.md)
- [Licencja](#licencja)

---

## Instalacja na nowym urządzeniu

### Wymagania wstępne

| Składnik       | Wersja minimalna | Użycie                                                                                             |
| -------------- | ---------------- | -------------------------------------------------------------------------------------------------- |
| Docker Desktop | aktualna         | Instalacja nowego komputera Windows; backend WSL 2 dla PostgreSQL 18 Compose                       |
| Node.js        | >= 22.13         | Tylko rozwój lokalny bez Compose; [nodejs.org](https://nodejs.org) (rekomendowane LTS 22.x / 24.x) |
| npm            | 9+               | Tylko rozwój lokalny; instaluje się automatycznie z Node.js                                        |
| Git            | dowolna          | Opcjonalnie do pobierania i aktualizacji źródeł; [git-scm.com](https://git-scm.com)                |
| PostgreSQL     | 18.x             | Dostarczany w Compose dla instalacji nowego komputera; lokalny serwer wymagany tylko poza Compose  |
| Python         | 3.10+            | Opcjonalnie — walidacja plików Excel w pre-commit                                                  |

**Sprawdź zainstalowane wersje:**

```powershell
node --version
npm --version
git --version
```

### Krok po kroku

#### 1. Pobierz projekt

**Opcja A — przez Git (zalecane do aktualizacji):**

```powershell
git clone https://github.com/blodytrav3l3r/Oferty_PV.git
cd Oferty_PV
```

**Opcja B — z archiwum ZIP:**

1. Pobierz ZIP z [https://github.com/blodytrav3l3r/Oferty_PV](https://github.com/blodytrav3l3r/Oferty_PV)
2. Rozpakuj w folderze swojego użytkownika (np. `%USERPROFILE%\SOK_Oferty`, nie w `Program Files`)
3. Otwórz terminal w tym folderze

#### 2. Windows — lokalne testy

Dwukrotnie kliknij `install-new-pc.bat`. Host nie musi mieć Node.js ani PostgreSQL: instalator przygotowuje Docker Desktop, uruchamia PostgreSQL 18 w Compose, stosuje migracje i seed, a potem otwiera S.O.K. pod `http://localhost:3000`. Pliki bazy są w zarządzanym wolumenie Dockera, poza folderem aplikacji. Ten wariant służy do testów na Windows 10/11, nie do serwerowego wdrożenia ani dystrybucji Docker Desktop z S.O.K.

Po udanej instalacji używaj `start-docker.bat`, aby uruchomić istniejące kontenery PostgreSQL i S.O.K. Launcher wymaga znacznika zakończonej instalacji, który instalator zapisuje dopiero po imporcie aktywnych cenników z pakietu w repozytorium i przejściu health checku. Nie tworzy nowej bazy, nie importuje cenników ani nie resetuje wolumenów. Przy pierwszej instalacji lub jej wznowieniu użyj `install-new-pc.bat`.

Instalator tworzy lokalne sekrety i ogranicza ACL pliku `.env`. Pierwsze hasło administratora otworzy w Notatniku w pliku `data/install-admin-password.txt`; zmień je po pierwszym logowaniu. Instalator nie kasuje istniejących wolumenów. Jeśli Windows musi włączyć WSL 2, pojawi się prośba UAC i może być potrzebny restart. Docker Desktop wymaga akceptacji warunków przy pierwszym uruchomieniu; komercyjne użycie w większych organizacjach może wymagać płatnej subskrypcji.

Instalator automatycznie waliduje i importuje trzy zatwierdzone aktywne cenniki z `data/pricelists/active-pricelists.json` po migracjach PostgreSQL i przed uruchomieniem serwera. Nie wymaga starego komputera, eksportu ani ręcznego wskazywania pliku. Pakiet zawiera 1023 pozycje i sumę SHA-256 weryfikowaną przez importer.

`install.bat` pozostaje instalatorem developerskim z zależnościami Node.js; nie służy do nowego komputera bez przygotowanej bazy. Jeśli poprzednia instalacja została przerwana po utworzeniu wolumenu, wznowienie wymaga `install-new-pc.bat -ResumeExistingVolume`, potwierdzenia `RESUME` oraz osobnej zgody `MIGRATE AND SEED` na migracje i seed w istniejącej bazie.

**Status:** lokalne działanie S.O.K. na PostgreSQL 18 zostało zweryfikowane. Ta instalacja Windows służy do testów i nie jest dowodem poprawnego produkcyjnego wdrożenia.

#### 3. Linux — serwer firmowy

Docelowy wariant działa na Ubuntu lub Debianie z Docker Engine i wtyczką Docker Compose z oficjalnego repozytorium Docker. Nie używa Docker Desktop ani jego subskrypcji. PostgreSQL 18 działa w lokalnym wolumenie Compose; baza nie jest publikowana na sieć.

Docker Engine i PostgreSQL są używane na licencjach open source bez opłaty za komercyjne użycie. Instalator nie dołącza Docker Desktop. To nie obejmuje kosztu systemu operacyjnego, sprzętu, domeny, certyfikatu od zewnętrznego dostawcy ani ewentualnego wsparcia. Przed sprzedażą S.O.K. trzeba osobno zamknąć przegląd licencji i praw do wszystkich składników aplikacji; lista zależności znajduje się w [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

1. Przygotuj pełny folder S.O.K. na serwerze; pakiet aktywnych cenników jest dołączony do `data/pricelists/`.
2. Uruchom instalację jako administrator: `sudo bash install-linux-server.sh`.
3. Instalator automatycznie zweryfikuje checksum pakietu, zaimportuje trzy aktywne cenniki do PostgreSQL i uruchomi S.O.K. po kontroli gotowości.
4. Przy nowej konfiguracji `.env` pierwsze hasło administratora znajdziesz w `~/.config/sok/install-admin-password.txt`; zmień je po pierwszym logowaniu. Przy zachowanym `.env` instalator nie zgaduje bieżącego hasła — użyj istniejących danych logowania.
5. S.O.K. będzie nasłuchiwał lokalnie na serwerze pod `http://127.0.0.1:3000`. Aby użytkownicy firmowi mogli łączyć się z innych komputerów, skonfiguruj reverse proxy HTTPS i firmowy DNS zgodnie z [instrukcją HTTPS](docs/DEPLOY_HTTPS_IT.md). Nie otwieraj portu PostgreSQL ani socketu Dockera. Nie instaluj operatorów S.O.K. do grupy `docker` — dostęp do niej daje uprawnienia równoważne administratorowi.

Instalator Linux wymaga Ubuntu/Debian z systemd i dostępu do oficjalnych repozytoriów pakietów. Nie usuwa istniejących baz ani wolumenów; istniejący wolumen musi być oznaczony jako należący do projektu Compose S.O.K., a wznowienie wymaga `--resume-existing-volume`, wpisania `RESUME` i osobnego `MIGRATE AND SEED`. Wymaga też zachowanego `.env` z hasłami tej bazy. Uruchomienie z `--help` pokazuje składnię.

**Status wdrożenia:** instalator Linux jest zaimplementowany, ale czysta instalacja end-to-end na Ubuntu/Debian nie została jeszcze potwierdzona. Przed produkcją zweryfikuj instalację, backup/restore i przepływy ofert na docelowym serwerze; produkcyjny cutover wymaga osobnego GO.

#### 4. Ręczna instalacja developerska (alternatywa)

Jeśli `install.bat` nie działa lub używasz systemu innego niż Windows:

```powershell
# 1. Zainstaluj zależności
npm ci

# 2. Skopiuj i skonfiguruj zmienne środowiskowe
# Edytuj .env — ustaw DEFAULT_ADMIN_PASSWORD (wymagane!)
copy .env.example .env
# (lub: node scripts/init-env.mjs — wygeneruje losowe hasło admina i zapisze w .env)

# 3. Wygeneruj klienta Prisma
npx prisma generate

# 4. Zsynchronizuj schemat bazy danych
npx prisma migrate deploy

# 5. Zasiej dane początkowe (produkty, cenniki)
npm run prisma:seed

# 6. Zbuduj projekt (TypeScript → JavaScript)
npm run build
```

> **Nowa instalacja:** zachowywane są zatwierdzone aktywne cenniki z dołączonego pakietu; pozostałe dane aplikacji zaczynają jako świeży stan. Szczegóły opisuje [pakiet aktywnych cenników](docs/cutover/active-pricelists.md).

#### 4. Uruchom serwer

Na Windows do pracy nad kodem i testów wybierz [plik BAT odpowiedni do trybu pracy](#skrypty-startowe-bat). Użyj `start-dev.bat`, aby przygotować również bazę testową do testów i pushu. Przy ręcznej konfiguracji połączenia aplikacji z PostgreSQL w `.env` użyj:

```powershell
.\start.bat              # Tryb developerski (domyślnie, z hot-reload)
.\start.bat --prod       # Tryb produkcyjny
```

`dev.bat` to alias do `start.bat` — działa identycznie (zachowany dla kompatybilności).

Aplikacja będzie dostępna pod adresem: **http://localhost:3000**

> **Uwaga (Docker):** Przy uruchomieniu przez `docker compose up --build -d` aplikacja wewnątrz kontenera nasłuchuje na porcie **10000** (`PORT=10000` w `docker-compose.yml`), a `docker-compose.yml` mapuje go `3000:10000` (host:kontener) — z hosta Docker aplikacja dostępna jest na porcie **3000**. W razie potrzeby zmień mapowanie portów w `docker-compose.yml`.

#### 5. Pierwsze logowanie

1. Otwórz przeglądarkę i wejdź na **http://localhost:3000**
2. Zaloguj się jako:
    - **Użytkownik:** `admin`
    - **Hasło:** ustawione w `DEFAULT_ADMIN_PASSWORD` w pliku `.env`
      (instalatory `install.bat` / `install.sh` — przez `scripts/init-env.mjs` —
      automatycznie generują losowe hasło i zapisują je w `.env`, jeśli w pliku
      jest puste lub równe domyślnej wartości `CHANGE_ME_PLEASE`)
3. Po zalogowaniu możesz zmienić hasło w ustawieniach profilu

### Instalacja na Linux / VPS

**Wariant A — instalator bash (zalecany):**

```bash
# 1. Zainstaluj Node.js 22.x (LTS, >= 22.13)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git

# 2. Sklonuj repozytorium
git clone https://github.com/blodytrav3l3r/Oferty_PV.git
cd Oferty_PV

# 3. Instalacja (odpowiednik install.bat: .env + npm ci + prisma + seed)
bash install.sh

# 4. Uruchom — tryb deweloperski lub produkcyjny
bash dev.sh    # Development (hot-reload)
bash prod.sh   # Production (npm start; automatycznie buduje dist, jeśli brak)
```

Instalatory developerskie `install.sh` i `install.bat` wygenerują losowe hasło
administratora, zastosują wersjonowane migracje PostgreSQL i uruchomią seed.
Wymagają jawnego `DATABASE_URL` wskazującego PostgreSQL 18. Do instalacji
serwerowej użyj `install-linux-server.sh`, który konfiguruje Compose i
kontrolowany bootstrap PostgreSQL.

**Wariant B — kroki ręczne:**

```bash
# 1. Zainstaluj Node.js 22.x (LTS, >= 22.13)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git

# 2. Sklonuj repozytorium
git clone https://github.com/blodytrav3l3r/Oferty_PV.git
cd Oferty_PV

# 3. Instalacja
npm ci
cp .env.example .env
nano .env  # ustaw DEFAULT_ADMIN_PASSWORD
npx prisma generate
npx prisma migrate deploy

# 4. Baza danych — opcje:
#    a) Zasiej dane początkowe (nowa instalacja):
npm run prisma:seed
#    b) Dla świeżej bazy zaimportuj zatwierdzone aktywne cenniki przed startem:
npx ts-node scripts/import-active-pricelists.ts data/pricelists/active-pricelists.json --apply

# 5. Zbuduj projekt
npm run build
#    Linux: po surowym `npm run build` (bez build.sh) skopiuj klienta Prisma:
mkdir -p dist/generated && cp -r generated/prisma-postgres dist/generated/
#    (build.bat/build.sh robią to automatycznie)

# 6. Uruchom (zalecane przez PM2)
npm install -g pm2
pm2 start dist/server.js --name sok-oferty
pm2 save
pm2 startup
```

Aplikacja: **http://TWOJ_ADRES_IP:3000**

### Instalacja przez Docker

```bash
docker compose build app
docker compose up -d postgres
docker compose run --rm db-bootstrap
docker compose up -d app
```

Aplikacja: **http://localhost:3000** (port zgodny z konfiguracją w `.env`)

---

### Przenoszenie aktywnych cenników

Przy przejściu ze starszej instalacji zachowuj wyłącznie aktualnie aktywne cenniki rur, studni i PRECO. Oferty, klienci, użytkownicy, sesje, zamówienia, logi, drafty i historia wersji nie są przenoszone. Pełny backup starej bazy nie jest formatem migracji PostgreSQL.

Instalatory Windows i Linux walidują checksum pakietu aktywnych cenników i importują go po migracjach oraz seedzie, a przed pierwszym startem serwera. Szczegóły formatu, liczników i kolejności opisuje [pakiet aktywnych cenników](docs/cutover/active-pricelists.md).

Procedury produkcyjnej nie uruchamiaj bez odrębnego GO na cutover. Lokalna walidacja PG18 jest zielona; przed ruchem produkcyjnym zweryfikuj procedurę na docelowym serwerze, w tym restore drill oraz logowanie, zapisy ofert i eksporty.

### Aktualizacja istniejącej instalacji

Aplikacja używa jednej kanonicznej historii migracji PostgreSQL. Aktualizację wykonuj przez zweryfikowany backup PostgreSQL, `npm ci`, kontrolowany bootstrap/migracje i smoke test. Nie używaj `prisma db push`, nie kopiuj plików bazy i nie stosuj narzędzi legacy do istniejącej bazy. Szczegóły opisuje [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Konfiguracja (.env)

| Zmienna                  | Opis                                                                                                              | Domyślnie                                                   | Wymagane        |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | --------------- |
| `PORT`                   | Port serwera                                                                                                      | `3000`                                                      | Nie             |
| `HOST`                   | Adres nasłuchiwania. W produkcji domyślnie `127.0.0.1` (tylko loopback); `0.0.0.0` tylko w Dockerze/osobnym proxy | `127.0.0.1` (prod) / `0.0.0.0` (dev)                        | Nie             |
| `NODE_ENV`               | Środowisko: `development` / `production` (production ustawiają skrypty startowe)                                  | `development`                                               | Nie             |
| `DEFAULT_ADMIN_PASSWORD` | Hasło administratora (przy pierwszym uruchomieniu)                                                                | —                                                           | **Tak**         |
| `DATABASE_URL`           | Jawny URL roli runtime PostgreSQL 18; wymagany przez runtime i CLI                                                | `postgresql://user:secret@localhost:5432/sok?schema=public` | **Tak**         |
| `MIGRATION_DATABASE_URL` | Połączenie PostgreSQL roli migratora; tylko migracje i kontrolowane granty                                        | Z secret managera / `.env`                                  | **Tak**         |
| `BACKUP_DATABASE_URL`    | Połączenie PostgreSQL roli backupu z prawami odczytu                                                              | Z secret managera / `.env`                                  | **Tak**         |
| `POSTGRES_DB`            | Nazwa bazy w Docker Compose                                                                                       | `sok`                                                       | Tak dla Compose |
| `POSTGRES_USER`          | Rola inicjalizacyjna PostgreSQL; nie używaj jej jako roli runtime produkcji                                       | `sok_bootstrap`                                             | Tak dla Compose |
| `POSTGRES_PASSWORD`      | Hasło roli inicjalizacyjnej PostgreSQL                                                                            | z secret managera                                           | Tak dla Compose |
| `SENTRY_DSN`             | DSN Sentry do monitorowania błędów (opcjonalnie)                                                                  | —                                                           | Nie             |
| `COOKIE_SECURE`          | Wymusza flagę `Secure` na ciastku sesji                                                                           | `true` gdy `NODE_ENV=production`                            | Nie             |
| `TRUST_PROXY`            | Liczba reverse proxy przed aplikacją (Caddy/Nginx = 1, Cloudflare→Nginx→App = 2)                                  | `1`                                                         | Nie             |
| `PUBLIC_BASE_URL`        | Publiczny origin (np. `https://oferty.example.pl`) używany przy przekierowaniu HTTP→HTTPS                         | — (fallback: zwalidowany `Host`)                            | Nie             |
| `APP_NAME`               | Nazwa aplikacji (tytuły stron, branding)                                                                          | `S.O.K.`                                                    | Nie             |
| `APP_SUBTITLE`           | Podtytuł aplikacji (aria-label logo, wydruki)                                                                     | `System Ofert i Kalkulacji`                                 | Nie             |

> **Ważne:** `DEFAULT_ADMIN_PASSWORD` jest wymagane tylko przy **pierwszym** uruchomieniu. Po utworzeniu konta admina zmiana hasła w `.env` nie wpływa na istniejące konto.

### HTTPS / Reverse proxy (produkcja)

W środowisku produkcyjnym aplikacja jest serwowana przez **HTTPS** za pośrednictwem reverse proxy (Caddy/Nginx z certyfikatem Let's Encrypt). Node/Express pozostaje wewnętrznym serwerem HTTP nasłuchującym na `127.0.0.1:3000` (w trybie `production` bind do `127.0.0.1` jest domyślny — port nie jest dostępny z sieci).

- Przykładowa konfiguracja Caddy: [`Caddyfile`](Caddyfile) (produkcja) i [`Caddyfile.dev`](Caddyfile.dev) (lokalny HTTPS z mkcert).
- Przy serwowaniu przez HTTPS ustaw `COOKIE_SECURE=true` w `.env` — wymusi flagę `Secure` na ciastku sesji (w `production` jest to domyślne).
- W trybie `production` aktywne są automatycznie: HSTS, przekierowanie HTTP→HTTPS (na podstawie `X-Forwarded-Proto`), nagłówki bezpieczeństwa Helmet.
- Przekierowanie HTTP→HTTPS buduje adres z `PUBLIC_BASE_URL` (jeśli ustawione), inaczej z nagłówka `Host` po walidacji — nieprawidłowy `Host` bez `PUBLIC_BASE_URL` skutkuje pominięciem przekierowania (ochrona przed open-redirect).
- Szczegóły: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) oraz [docs/SECURITY.md](docs/SECURITY.md).

---

## Uruchomienie

### Tryb developerski na Windowsie

```powershell
.\start-dev.bat
```

Launcher uruchamia backend z hot-reload na natywnej bazie `sok_dev` oraz testowy PostgreSQL w Docker Compose. Docker jest wymagany tylko dla testowej bazy; usługa pozostaje uruchomiona po zamknięciu aplikacji. Domyślny port aplikacji to `3000`; jeśli jest zajęty, launcher wybierze pierwszy wolny port do `3100` i wypisze adres. Sprawdź `/health` pod wskazanym adresem.

Przy ręcznie przygotowanym środowisku można uruchomić sam backend przez `npm run dev`; ta komenda nie uruchamia testowej bazy.

### Krótka ścieżka: praca lokalna → commit → push

1. Upewnij się, że `.env` zawiera lokalne ustawienia `POSTGRES_TEST_*` z `.env.example`. Uruchom `start-dev.bat` i sprawdź `/health` pod adresem wypisanym przez launcher.
2. Przed commitem sprawdź `git branch --show-current`, `git status --short` oraz `git diff` i `git diff --staged`. Do commita dodaj tylko pliki związane ze zmianą.
3. Uruchom wymagane bramy:

    ```powershell
    npm run version:check
    npm run validate
    npm run format
    npm run encoding:check
    ```

4. Zacommituj przez helper, zachowując format `typ(scope): opis`, np. `node scripts/commit.mjs "docs(docs): lokalny workflow"`.
5. Push wymaga osobnego, jawnego GO dla dokładnego celu `remote/branch` i wskazanych commitów. Po GO wykonaj push bez omijania hooków, sprawdź kod procesu przez `$LASTEXITCODE`, a następnie `git status -sb`.

Szczegóły: [kontrakt autonomii](docs/AUTONOMY_CONTRACT.md) i [referencja komend](docs/agents/commands.md).

### Tryb produkcyjny

```powershell
npm run build
npm start
```

> **Uwaga (Linux):** po surowym `npm run build` (bez `build.sh`) skopiuj klienta Prisma do `dist/`:
> `mkdir -p dist/generated && cp -r generated/prisma-postgres dist/generated/` — albo użyj `build.bat`/`build.sh`, które robią to automatycznie.

Aplikacja: domyślnie `http://localhost:3000`; `start-dev.bat` wybierze port 3001–3100, gdy port 3000 jest zajęty (lokalnie; w produkcji przez HTTPS — patrz sekcja [HTTPS / Reverse proxy](#https--reverse-proxy-produkcja)).

---

## Aktualizacja aplikacji (deploy)

Aktualizacje produkcyjnej wersji (na której pracują pracownicy) wykonuje się w **oknie
serwisowym** — bezpieczny proces z backupem, migracjami addytywnymi i rollbackiem opisuje
**[docs/DEPLOY_UPDATE.md](docs/DEPLOY_UPDATE.md)**.

Skrót:

```powershell
node scripts/deploy.mjs <windows|linux|docker> vX.Y.Z --dry-run   # podgląd
node scripts/deploy.mjs <windows|linux|docker> vX.Y.Z              # deploy
node scripts/rollback.mjs <windows|linux|docker> vX.Y.Z            # powrót do poprzedniej wersji
npm run deploy:check                                               # smoke check /health
```

---

## Skrypty startowe (.bat)

| Kiedy użyć                           | Plik                             | Warstwa | Co robi                                                                                                                | Zmienia stan                                                                             |
| ------------------------------------ | -------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Pierwsza instalacja na PC            | `install-new-pc.bat`             | L1      | Przygotowuje Docker Desktop, PostgreSQL 18 i S.O.K. na Windows 10/11.                                                  | Konfiguruje Docker; nie usuwa wolumenów.                                                 |
| Instalacja dev bez Dockera           | `install.bat`                    | L1      | Tworzy `.env`, instaluje zależności, generuje klienta Prisma, migruje i seeduje bazę. Opcja `--skip-seed` pomija seed. | Zapisuje `.env`; migruje i seeduje bazę z `DATABASE_URL`.                                |
| Kolejny start z Dockerem             | `start-docker.bat`               | L2      | Zalecany start istniejącej instalacji Docker Compose; zachowuje dane wolumenu.                                         | Przebudowuje obraz aplikacji.                                                            |
| Wewnętrznie przez `start-docker.bat` | `start-postgres.bat`             | L1      | Sprawdza Docker CLI, daemon, konfigurację Compose i wolumen, potem `compose up --detach --build --wait`.               | Przebudowuje kontenery; danych nie resetuje.                                             |
| Praca nad kodem i testami            | `start-dev.bat`                  | L2      | Uruchamia kod z repozytorium, auto-reload i osobny testowy PostgreSQL w Dockerze.                                      | Startuje testowy PostgreSQL Compose na porcie `55440`.                                   |
| Praca bez bazy testowej              | `start-native.bat`               | L1      | Uruchamia kod z repozytorium na przygotowanej lokalnej bazie PostgreSQL; pomija migracje/seed.                         | Uruchamia serwer na przygotowanej bazie.                                                 |
| Ręczny start na bazie z `.env`       | `start.bat`                      | L1      | Preflight Node.js, zależności i klienta Prisma, `ensure-db.bat`, kontrola portu 3000, watchdog do 5 restartów.         | Może zmigrować lub seedować bazę; może zatrzymać proces na porcie 3000 po potwierdzeniu. |
| Skrót trybu developerskiego          | `dev.bat`                        | L2      | Wywołuje `start.bat --dev`.                                                                                            | Jak `start.bat`.                                                                         |
| Skrót trybu produkcyjnego            | `prod.bat`                       | L2      | Wywołuje `start.bat --prod`.                                                                                           | Jak `start.bat`.                                                                         |
| Wewnętrznie przez `start.bat`        | `scripts/ensure-db.bat`          | L3      | Sprawdza starą instancję serwera, `check-db.js`, `prisma migrate deploy` lub seed (do 3 prób).                         | Migruje lub seeduje bazę.                                                                |
| Build produkcyjny                    | `build.bat`                      | L1      | Wywołuje `npm run build` i weryfikuje `dist\server.js`.                                                                | Usuwa i odtwarza `dist`.                                                                 |
| Wdrożenie wersji                     | `deploy.bat`                     | L1      | Wywołuje `scripts/deploy.mjs`; `--dry-run` pokazuje plan.                                                              | Zmienia wskazane wdrożenie.                                                              |
| Powrót do poprzedniej wersji         | `rollback.bat`                   | L1      | Wywołuje `scripts/rollback.mjs`.                                                                                       | Przywraca wersję; może odtworzyć bazę z kopii.                                           |
| Utwardzenie lokalnych uprawnień      | `scripts/harden-local-perms.bat` | L3      | Ogranicza ACL `.env` i `data\` do właściciela, SYSTEM i Administratorów; `--restore-dir` przywraca snapshot.           | Zmienia ACL plików.                                                                      |

Oba tryby wymagają Node.js z npm, zależności zainstalowanych przez `npm ci` i wcześniej przygotowanego lokalnego zestawu PostgreSQL 18 w `data/perf/sok-native-pg18-*` z bazą `sok_dev`. Korzystają z tej samej lokalnej bazy, sprawdzają jej gotowość i pomijają migracje oraz seed. `start-dev.bat` dodatkowo uruchamia izolowaną bazę testową Compose na porcie `55440`; Docker Desktop musi działać, a `.env` musi zawierać `POSTGRES_TEST_*`. Baza testowa pozostaje dostępna po zamknięciu S.O.K.; zatrzymasz ją poleceniem `docker compose -f docker-compose.postgres-test.yml stop postgres-test`. Port aplikacji domyślnie wynosi `3000`; gdy jest zajęty, launcher wybiera pierwszy wolny port do `3100` i wypisuje adres. Przy zmianie trybu zatrzymaj najpierw poprzednią instancję.

`start.bat` jest osobnym, ręcznym trybem: używa `DATABASE_URL` z `.env`, a `ensure-db.bat` może wykonać migracje lub seed. `start-native.bat` sam konfiguruje połączenie z przygotowaną lokalną bazą i pomija migracje oraz seed. `dev.bat` i `prod.bat` pozostają skrótami do trybów `start.bat`.

Kolumna „Warstwa": L1 to plik uruchamiany przez użytkownika (banner, pytania, `pause`), L2 to skrót bez logiki, L3 to wewnętrzny helper bez `pause` i bez bannera. Konfiguracja AI/ML: `npm run ai:setup`.

---

## Komendy

### Podstawowe

| Komenda                          | Opis                                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------------------- |
| `npm run dev`                    | Uruchom backend w trybie developerskim (ts-node-dev; Express serwuje też frontend, ADR-005) |
| `npm run build`                  | Zbuduj backend (TypeScript → JavaScript)                                                    |
| `npm run minify:css`             | Minifikuj arkusze CSS (też w `prestart`)                                                    |
| `npm run bundle:scripts`         | Zbundluj skrypty (`esbuild`)                                                                |
| `npm run commit`                 | Helper commita (Conventional Commits, UTF-8 bez mojibake)                                   |
| `npm start`                      | Uruchom w trybie produkcyjnym (`node dist/server.js`)                                       |
| `npm test`                       | Uruchom testy (Jest z pokryciem)                                                            |
| `npm run test:quick`             | Uruchom szybkie testy (bez pokrycia)                                                        |
| `npm run test:quick:lite`        | Szybkie testy bez migracji (pre-push)                                                       |
| `npm run test:git-safety`        | Testy warstwy Git Safety (pre-push)                                                         |
| `npm run test:frontend`          | Testy frontendowe (Jest)                                                                    |
| `npm run test:e2e`               | Testy E2E (Playwright)                                                                      |
| `npm run test:axe`               | Testy dostępności a11y (Axe + Playwright)                                                   |
| `npm run test:watch`             | Uruchom testy w trybie watch                                                                |
| `npm run test:alignment`         | Test regresyjny Playwright (wyrównanie kolumn Excel)                                        |
| `npm run test:e2e-appname`       | E2E: spójność nazwy aplikacji (Playwright)                                                  |
| `npm run test:e2e-appname:spawn` | E2E: jw. z własnym buildem serwera (`--spawn`)                                              |

### Backend

| Komenda               | Opis                                       |
| --------------------- | ------------------------------------------ |
| `npm run dev:backend` | Uruchom backend z hot-reload (ts-node-dev) |
| `npm run build:watch` | Kompiluj backend w trybie watch (`tsc -w`) |
| `npm run typecheck`   | Sprawdź typy TypeScript (backend)          |
| `npm run lint`        | ESLint dla backendu                        |
| `npm run lint:fix`    | ESLint z automatyczną naprawą              |

### Frontend

| Komenda                      | Opis                               |
| ---------------------------- | ---------------------------------- |
| `npm run typecheck:frontend` | Sprawdź typy TypeScript (frontend) |
| `npm run lint:frontend`      | ESLint dla kodu frontendowego      |

### Baza danych (Prisma)

| Komenda                   | Opis                                               |
| ------------------------- | -------------------------------------------------- |
| `npm run prisma:generate` | Generuj klienta Prisma                             |
| `npm run prisma:migrate`  | Utwórz migrację dev                                |
| `npm run prisma:deploy`   | Zastosuj migracje w produkcji                      |
| `npm run prisma:seed`     | Zasiej dane początkowe                             |
| `npm run prisma:studio`   | Otwórz Prisma Studio (UI bazy)                     |
| `npm run prisma:reset`    | Reset bazy danych                                  |
| `npm run prisma:status`   | Status migracji                                    |
| `npm run export:seed`     | Eksport cenników z wersji DB do `data/seed_*.json` |

### AI/ML

| Komenda            | Opis                                    |
| ------------------ | --------------------------------------- |
| `npm run ai:setup` | Diagnostyka i konfiguracja modułu AI/ML |

### Benchmark

| Komenda                   | Opis                                               |
| ------------------------- | -------------------------------------------------- |
| `npm run benchmark`       | Uruchom benchmark (skrypt `scripts/benchmark.mjs`) |
| `npm run benchmark:quick` | Uruchom benchmark skrócony (10 iteracji)           |

### Backup i przenoszenie bazy

| Komenda                         | Opis                                                                             |
| ------------------------------- | -------------------------------------------------------------------------------- |
| `npm run backup`                | Wykonaj backup PostgreSQL w formacie custom `pg_dump` (`.dump`)                  |
| `npm run backup:check`          | Sprawdź świeżość ostatniego backupu (exit 1 = brak lub > 26 h)                   |
| `npm run restore <plik.dump>`   | Restore PostgreSQL; ustaw `RESTORE_DB_URL` w env, nie przekazuj URL/hasła w argv |
| `npm run backup:install-cron`   | Zainstaluj cron backupu (Windows)                                                |
| `npm run backup:uninstall-cron` | Odinstaluj cron backupu (Windows)                                                |

### Wersjonowanie

| Komenda                 | Opis                                                                                                                               |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `npm run version:check` | Sprawdź spójność wersji we wszystkich źródłach (VERSION, package.json, CHANGELOG, *.bat, HTML `?v=`, markery `**Wersja:**` w docs) |
| `npm run version:patch` | Podbij wersję patch                                                                                                                |
| `npm run version:minor` | Podbij wersję minor                                                                                                                |
| `npm run version:major` | Podbij wersję major                                                                                                                |
| `npm run version:bump`  | Podbij wersję (typ z argumentu)                                                                                                    |

### Nazwa aplikacji i skill CLI

| Komenda                           | Opis                                        |
| --------------------------------- | ------------------------------------------- |
| `npm run appname:check`           | Sprawdź spójność nazwy aplikacji (pre-push) |
| `npm run skills:build`            | Oblicz koszt budowy skilli                  |
| `npm run skills:stats`            | Statystyki skilli                           |
| `npm run skills:validate`         | Walidacja manifestów skilli                 |
| `npm run skills:cost`             | Koszt tokenów skilli                        |
| `npm run skills:deps`             | Zależności między skillami                  |
| `npm run skills:capabilities`     | Lista zdolności skilli                      |
| `npm run skills:plan`             | Plan skilli                                 |
| `npm run skills:feedback-record`  | Rejestrowanie feedbacku                     |
| `npm run skills:feedback-show`    | Prezentacja feedbacku                       |
| `npm run skills:provider-resolve` | Rozwiąż providera skilli                    |
| `npm run skills:utility-recalc`   | Ponowne przeliczenie utility                |

### Git Safety

| Komenda                      | Opis                                          |
| ---------------------------- | --------------------------------------------- |
| `npm run git:safety`         | CLI warstwy Git Safety                        |
| `npm run git:safety:list`    | Lista snapshotów L1 (odzyskiwanie bez `fsck`) |
| `npm run git:safety:inspect` | Podgląd snapshotu                             |
| `npm run git:safety:verify`  | Weryfikacja snapshotu przed destrukcją Tier A |
| `npm run git:safety:restore` | Odzyskaj worktree ze snapshotu (`--force`)    |

**Gdzie żyje numer wersji (pełna lista):**

Wersja jest synchronizowana automatycznie podczas release (hook `postbump` w `.versionrc.json`). **Nie zmieniaj ręcznie** — poniższa lista służy weryfikacji spójności (`npm run version:check`) i kontroli, czy nic nie zostało pominięte:

| #   | Lokalizacja                                                          | Automat (release)               |
| --- | -------------------------------------------------------------------- | ------------------------------- |
| 1   | `VERSION` (root) — źródło prawdy                                     | `standard-version` (bumpFiles)  |
| 2   | `package.json` → `version`                                           | `standard-version` (bumpFiles)  |
| 3   | `package-lock.json` → `version` (root)                               | `standard-version` (bumpFiles)  |
| 4   | `CHANGELOG.md` (nagłówki wersji)                                     | `standard-version` (infile)     |
| 5   | `public/*.html` + `public/templates/*.html` → `?v=X.Y.Z`             | `scripts/auto-cache-bust.mjs`   |
| 6   | `*.bat` (start, install, build, setup-ai, ensure-db) → `APP_VERSION` | `scripts/auto-bat-version.mjs`  |
| 7   | `README.md` + `docs/*.md` → `**Wersja:**` itd.                       | `scripts/auto-docs-version.mjs` |
| 8   | `docs/API.md` przykłady JSON (`"version"`/`"dbVersion"`)             | `scripts/auto-docs-version.mjs` |

**Nieedytowalne ręcznie (tylko przez release):** `VERSION`, `?v=` w HTML, wersje w `.bat`, `**Wersja:**` w docs.

### Release

| Komenda                 | Opis                                               |
| ----------------------- | -------------------------------------------------- |
| `npm run release`       | Utwórz release — auto patch/minor/major z commitów |
| `npm run release:patch` | Wymuś release typu patch                           |
| `npm run release:minor` | Wymuś release typu minor                           |
| `npm run release:major` | Wymuś release typu major                           |
| `npm run release:dry`   | Podgląd changeloga bez zapisywania                 |
| `npm run release:first` | Pierwszy release (pomija semver)                   |

### Deploy i aktualizacje

| Komenda                | Opis                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| `npm run deploy`       | Bezpieczny deploy produkcji (`node scripts/deploy.mjs <windows\|linux\|docker> vX.Y.Z`)    |
| `npm run rollback`     | Powrót do poprzedniej wersji (`node scripts/rollback.mjs <windows\|linux\|docker> vX.Y.Z`) |
| `npm run deploy:check` | Smoke check /health po deploy (`node scripts/post-deploy-check.mjs`)                       |

Szczegóły procesu aktualizacji produkcyjnej (backup, migracje addytywne, rollback): [docs/DEPLOY_UPDATE.md](docs/DEPLOY_UPDATE.md).

### Licencje

| Komenda                     | Opis                                                                                           |
| --------------------------- | ---------------------------------------------------------------------------------------------- |
| `npm run licenses:generate` | Generuj `THIRD-PARTY-NOTICES.md` (pakiety z `package-lock.json` + zasoby vendored z `public/`) |
| `npm run licenses:check`    | Sprawdź aktualność `THIRD-PARTY-NOTICES.md` (część `validate`)                                 |

### Walidacja i kodowanie

| Komenda                   | Opis                                                                                                                                      |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run validate`        | Pełna walidacja: typecheck (backend+frontend) + lint (backend+frontend) + appname:check + licenses:check + collisions:check + testy dymne |
| `npm run format`          | Formatuj kod (Prettier)                                                                                                                   |
| `npm run format:check`    | Sprawdź formatowanie                                                                                                                      |
| `npm run encoding:check`  | Sprawdź kodowanie plików (UTF-8 bez BOM, ASCII dla .bat)                                                                                  |
| `npm run encoding:fix`    | Napraw kodowanie plików                                                                                                                   |
| `npm run encoding:staged` | Sprawdź kodowanie tylko plików staged (git)                                                                                               |

---

## Struktura projektu

```
Oferty_PV/
├── server.ts                  # Entry point Express
├── src/                       # Backend (TypeScript)
│   ├── routes/                # Endpointy API
│   │   ├── offers/            # CRUD ofert (rury + studnie)
│   │   ├── orders/            # Zamówienia, zlecenia
│   │   ├── productsV2.ts      # CRUD produktów (rury)
│   │   ├── productsStudnieV2.ts # CRUD produktów (studnie)
│   │   ├── clients/           # Klienci (index.ts, contacts.ts)
│   │   ├── settings.ts        # Ustawienia systemowe
│   │   ├── audit.ts           # Logi audytowe
│   │   ├── featureFlags.ts    # Flagi funkcjonalne
│   │   ├── exportCombined.ts  # Łączny eksport PDF/DOCX
│   │   ├── precoPricingV2.ts  # Cenniki Preco
│   │   ├── pricelistVersions.ts # Wersje cenników (admin, lock per typ)
│   │   └── telemetryAiMl.ts   # Endpointy ML (predict, reward, train, rollback)
│   ├── services/              # Logika biznesowa
│   │   ├── ml/                # AI/ML Pipeline
│   │   ├── pdf/               # Generowanie PDF (Puppeteer)
│   │   ├── docx/              # Generowanie MS Word
│   │   ├── telemetry/         # Telemetria AI (learning engine)
│   │   └── auditService.ts    # Service audytu
│   ├── constants/appMeta.ts   # APP_NAME — SSoT nazwy aplikacji
│   ├── version.ts             # getVersion() — VERSION jako SSoT
│   ├── middleware/            # Autoryzacja, bezpieczeństwo, rate limiting
│   ├── validators/            # Schematy walidacji Zod
│   ├── utils/                 # Narzędzia (logger, helpers, productionOrderGuard)
│   └── types/                 # Typy TypeScript
├── public/                    # Frontend (Vanilla JS SPA; liczby plików: docs/agents/metrics.md)
│   ├── app.html               # Shell SPA (jedyny entry point, router hash)
│   ├── index.html             # Pulpit / Dashboard
│   ├── studnie.html           # Moduł studnie (iframe w app.html)
│   ├── rury.html              # Moduł rury (iframe w app.html)
│   ├── kartoteka.html         # Kartoteka ofert i zamówień
│   ├── zlecenia.html          # Zlecenia produkcyjne (PZ)
│   ├── js/                    # Skrypty JS
│   │   ├── shared/            # 45 plików: auth, ui, icons, headerUser, toast, modalCore, StorageService
│   │   ├── studnie/           # 150 plików: WellManager, solver, ruleEngine, ML hooks, Excel (28 modułów excel*.js)
│   │   ├── rury/              # 30 plików: OfferItems, offerSummary, PEHD
│   │   ├── kartoteka/         # 9 plików: kartotekaActions, kartotekaUi, kartotekaInit
│   │   ├── import-export/     # 12 plików: toolbar.js + rury/studnie/shared (XLSX + JSON 1:1)
│   │   ├── admin/             # 7 plików: AI dashboard, aiDashboard
│   │   └── spa/               # 4 pliki: router.js, navGuard
│   ├── css/                   # 13 arkuszy źródłowych + 2 w css/studnie/ (modal.css, offer.css)
│   ├── images/                # logo-sok.svg, letterhead-*.png, b-mark.png, ce-mark.png
│   ├── licenses/              # Teksty licencji zasobów vendored (Apache-2.0, OFL, Lucide)
│   ├── partials/              # Partiale HTML (header, rury/*, studnie/*) ładowane przez partialLoader
│   └── templates/             # 5 szablonów: ofertaRury/Studnie, kartaBudowy, zlecenie, etykieta
├── prisma/                    # Schema + migracje Prisma
│   ├── schema.prisma          # Definicja schematu PostgreSQL
│   └── migrations-postgresql/ # Kanoniczna historia migracji PostgreSQL
├── data/                      # Pliki aplikacji, cenników bazowych i backupów PostgreSQL
│   └── seed_*.json            # Fabryczne cenniki dla świeżej instalacji
├── tests/                     # Testy (Jest + Playwright)
│   ├── ml/                    # Testy pipeline'u ML
│   ├── studnie/               # Testy modułu studnie (Excel, solver, pzGuard)
│   ├── sales/                 # Testy kartoteki (filtry, batch, search)
│   ├── playwright/            # Testy Playwright (alignment, appName, a11y, smoke)
│   └── ...
├── docs/                      # Dokumentacja
│   ├── adr/                   # Decyzje architektoniczne (ADR-001..017)
│   ├── plans/                 # Plany i taski (+ archive/ — 161 archiwalnych)
│   ├── import-export/         # Dokumentacja modułu import/eksport
│   └── ...                    # ARCHITECTURE, DATABASE, API, SECURITY, COMPONENTS, UI_GUIDELINES
├── scripts/                   # Skrypty narzędziowe
│   ├── backup.ts              # Backup PostgreSQL przez pg_dump custom archive
│   ├── restore-db.js          # Przywracanie przez pg_restore do jawnie wskazanego celu
│   ├── check-db.js            # Kontrola PostgreSQL i migracji
│   ├── check-version.mjs      # Weryfikacja spójności wersji (VERSION ↔ package.json ↔ CHANGELOG ↔ *.bat ↔ HTML ?v= ↔ docs)
│   ├── check-appname.cjs      # Sprawdzanie nazwy aplikacji (pre-push, APP_NAME SSoT)
│   ├── check-global-collisions.mjs # Kolizje globali window.* (shared vs studnie)
│   ├── auto-cache-bust.mjs    # Cache-bust ?v= w HTML przy release
│   ├── auto-docs-version.mjs  # Wersje w README/docs przy release
│   ├── auto-bat-version.mjs   # Wersje w *.bat przy release
│   ├── bump-version.mjs       # Podbijanie wersji (patch/minor/major)
│   ├── bundle-scripts.mjs     # Bundling JS studnie/rury (esbuild)
│   ├── minify-css.mjs         # Minifikacja CSS (prestart)
│   ├── copy-prisma-client.mjs # Kopiowanie generated/prisma-postgres → dist/generated
│   ├── encoding-integrity.js  # Sprawdzanie kodowania UTF-8 + mojibake
│   ├── skill-cli.mjs          # Skill CLI (build cost, stats, capabilities)
│   ├── export-settings-to-seed.mjs # Eksport cenników z tabel DB do data/seed_*.json
│   ├── deploy-core.cjs        # Rdzeń deploy/rollback (testowalny, kroki per target)
│   ├── deploy.mjs / rollback.mjs / post-deploy-check.mjs # Deploy produkcyjny
│   └── ...                    # benchmark.mjs, generate-licenses.mjs, init-env.mjs
├── .github/                   # CI/CD, CODE_OF_CONDUCT
├── .husky/                    # Git hooks (pre-push, commit-msg)
├── *.bat / *.sh               # Skrypty startowe (start, dev, install, build)
├── eslint.config.mjs          # Konfiguracja ESLint (flat config)
├── tsconfig.json              # TypeScript (backend)
├── tsconfig.frontend.json     # TypeScript (frontend)
├── jest.config.ts             # Konfiguracja Jest
├── .prettierrc                # Konfiguracja Prettier
├── .editorconfig              # Konfiguracja edytora
├── .nvmrc                     # Wersja Node.js dla nvm
├── .versionrc.json            # Konfiguracja standard-version
├── Dockerfile                 # Obraz Docker
├── docker-compose.yml         # Orkiestracja Docker
├── Caddyfile                  # Reverse proxy (HTTPS, produkcja)
└── Caddyfile.dev              # Reverse proxy (lokalny HTTPS, mkcert)
```

---

## Dokumentacja API

Po uruchomieniu serwera dokumentacja Swagger/OpenAPI dostępna jest pod adresem:

- **Swagger UI:** `/api/docs`
- **JSON spec:** `/api/docs.json`

---

## AI/ML Pipeline

System zawiera zintegrowany pipeline uczenia maszynowego do rankowania rozwiązań:

- **Model:** Logistic Regression w czystym TypeScript (bez zależności zewnętrznych)
- **Dual-ranking:** `Final = 0.6 × Technical + 0.4 × AI × 100` z 5% exploracją
- **Learning Engine:** Zbieranie telemetrii, Knowledge Base, Preference Engine, Pattern Detector
- **Trenowanie:** Cron co 15 minut (`TrainingPipeline`)
- **Samoocena:** Cron co 24h (`SelfEvaluation`)
- **Paradygmat:** feedback-based learning (decyzje użytkownika + reward + samoocena AUC), nie reinforcement learning — brak state/action/policy/update rule
- **Forgetting curve:** Wykładniczy zanik λ=0.01 (~69 dni półtrwania dla nieużywanych danych)
- **Auto-rollback:** Gdy ROC-AUC < 0.65
- **Endpointy:** `/api/ml/predict`, `/api/ml/reward`, `/api/ml/status`, `/api/ml/models`, `/api/ml/train`, `/api/ml/rollback`, `/api/telemetry-ai/*`, `/api/telemetry-ai-dashboard/*`

---

## Contributing

Projekt używa prostego workflow — wszystko na `main`. Szczegóły w [CONTRIBUTING.md](CONTRIBUTING.md).

Zgłoszenia błędów i propozycje funkcji przyjmujemy przez [GitHub Issues](https://github.com/blodytrav3l3r/Oferty_PV/issues).

---

## Code of Conduct

Oczekujemy przestrzegania naszego [Kodeksu postępowania](.github/CODE_OF_CONDUCT.md) (Contributor Covenant 2.1) we wszystkich przestrzeniach projektu — repozytorium, issue trackerze, PR-ach i dyskusjach.

---

## Security

Bezpieczeństwo projektu jest priorytetem. Jeśli znajdziesz podatność:

1. **Nie otwieraj publicznego issue** — zgłoś ją prywatnie
2. Wyślij szczegóły na **blodytrav3l3r@gmail.com** (odpowiedź w ciągu 48h)
3. Możesz też otworzyć [GitHub Advisory](https://github.com/blodytrav3l3r/Oferty_PV/security/advisories)

Pełna polityka bezpieczeństwa: [docs/SECURITY.md](docs/SECURITY.md) oraz [.github/SECURITY.md](.github/SECURITY.md) (proces zgłaszania podatności).

---

## Licencja

Własnościowa — szczegóły w pliku [LICENSE](LICENSE).

Komercyjne wykorzystanie wymaga pisemnej zgody Autora.
Zobacz [LICENSE](LICENSE) albo skontaktuj się przez blodytrav3l3r@gmail.com.

Lista zależności i licencji oprogramowania firm trzecich: [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
Podział na pakiety produkcyjne `[prod]` i deweloperskie `[dev]`, status NOTICE oraz
teksty licencji zasobów vendored: `public/licenses/` (dostępne pod `/licenses/`).
