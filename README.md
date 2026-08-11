# S.O.K. — System Ofert i Kalkulacji

<div align="center" style="background:#111827;border-radius:22px;padding:16px;margin:16px 0">
    <img src="public/images/logo-sok.svg" alt="S.O.K. — System Ofert i Kalkulacji" width="480" />
</div>

**Wersja:** 1.13.1  
**Stack:** Express + Prisma + SQLite + VanillaJS SPA + ML Pipeline  
**Licencja:** Własnościowa — szczegóły w pliku [LICENSE](LICENSE)  
**Autor:** WITROS

---

## Opis

S.O.K. — System Ofert i Kalkulacji to aplikacja webowa do generowania ofert handlowych dla branży kanalizacyjnej — studni oraz rur betonowych do kanalizacji i odwodnienia dróg. Umożliwia zarządzanie produktami, klientami, tworzenie ofert (zarówno dla rur jak i studni), generowanie dokumentów PDF/DOCX, monitorowanie zamówień oraz inteligentne rankowanie rozwiązań (ML).

Nazwa aplikacji wyświetlana na pulpicie i stronie logowania: **S.O.K. (System Ofert i Kalkulacji)** (rebranding z 2026-08-09, commit `a4b853f`).

Aplikacja działa jako **Single Page Application (SPA)** z backendem Express.js i bazą SQLite. Przeznaczona do wdrożenia na lokalnym serwerze, VPS lub przez Docker.

---

## Spis treści

- [Instalacja na nowym urządzeniu](#instalacja-na-nowym-urządzeniu)
- [Konfiguracja (.env)](#konfiguracja-env)
- [Uruchomienie](#uruchomienie)
- [Skrypty startowe (.bat)](#skrypty-startowe-bat)
- [Komendy](#komendy)
- [Struktura projektu](#struktura-projektu)
- [Dokumentacja API](#dokumentacja-api)
- [AI/ML Pipeline](#aiml-pipeline)
- [Contributing](#contributing)
- [Code of Conduct](#code-of-conduct)
- [Security](#security)
- [Licencja](#licencja)

---

## Instalacja na nowym urządzeniu

### Wymagania wstępne

| Składnik | Wersja minimalna | Pobierz                                                                                                                            |
| -------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Node.js  | >= 22.13         | [https://nodejs.org](https://nodejs.org) (rekomendowane LTS 22.x / 24.x)                                                          |
| npm      | 9+               | Instaluje się automatycznie z Node.js                                                                                              |
| Git      | dowolna          | [https://git-scm.com](https://git-scm.com) (opcjonalnie)                                                                           |
| Python   | 3.10+            | Opcjonalnie — tylko do walidacji Excel w pre-commit (`scripts/excel-validator.py`); instalacja i uruchomienie NIE wymagają Pythona |

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
2. Rozpakuj w docelowym folderze (np. `C:\SOK_Oferty`)
3. Otwórz terminal w tym folderze

#### 2. Uruchom instalator (Windows)

```powershell
.\install.bat
```

Instalator automatycznie:

- Sprawdzi i zweryfikuje wersję Node.js (>= 22.13)
- Utworzy plik `.env` z `.env.example` (jeśli nie istnieje)
- Zainstaluje zależności (`npm ci` — jeśli istnieje `package-lock.json`)
- Wygeneruje klienta Prisma (`npx prisma generate`)
- Zsynchronizuje schemat bazy danych (`npx prisma migrate deploy` z fallbackiem `npx prisma db push --skip-generate --accept-data-loss` dla baz bez historii migracji)
- Zasieje dane początkowe (`npm run prisma:seed`) lub pominie z `--skip-seed`
- Przy pierwszym uruchomieniu serwera automatycznie odczyta plik `data/price_defaults.json`
  (jeśli istnieje) zawierający snapshot domyślnych cenników

#### 3. Ręczna instalacja (alternatywa)

Jeśli `install.bat` nie działa lub używasz systemu innego niż Windows:

```powershell
# 1. Zainstaluj zależności
npm ci

# 2. Skopiuj i skonfiguruj zmienne środowiskowe
# Edytuj .env — ustaw DEFAULT_ADMIN_PASSWORD (wymagane!)
copy .env.example .env

# 3. Wygeneruj klienta Prisma
npx prisma generate

# 4. Zsynchronizuj schemat bazy danych
npx prisma migrate deploy
# (baza bez historii migracji/_prisma_migrations: npx prisma db push --skip-generate --accept-data-loss)

# 5. Zasiej dane początkowe (produkty, cenniki)
npm run prisma:seed

# 6. Zbuduj projekt (TypeScript → JavaScript)
npm run build
```

> **Jeśli przenosisz bazę z innej instalacji:** użyj `.\install.bat --skip-seed` (pomija seed), a po instalacji przywróć bazę z backupu `npm run restore data/backups/backup_*.sqlite` (patrz sekcja [Przenoszenie bazy cenników z istniejącej instalacji](#przenoszenie-bazy-cenników-z-istniejącej-instalacji)).

#### 4. Uruchom serwer

Aplikację uruchamiasz przez `start.bat` (główne wejście):

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
3. Po zalogowaniu możesz zmienić hasło w ustawieniach profilu

### Instalacja na Linux / VPS

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
# (baza bez historii migracji/_prisma_migrations: npx prisma db push --skip-generate --accept-data-loss)

# 4. Baza danych — opcje:
#    a) Zasiej dane początkowe (nowa instalacja):
npm run prisma:seed
#    b) LUB przywróć bazę z backupu z innego urządzenia (pomijając seed):
#       npm run restore data/backups/backup_*.sqlite

# 5. Zbuduj projekt
npm run build
#    Linux: po surowym `npm run build` (bez build.sh) skopiuj klienta Prisma:
mkdir -p dist/generated && cp -r generated/prisma dist/generated/
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
docker compose up --build -d
```

Aplikacja: **http://localhost:3000** (port zgodny z konfiguracją w `.env`)

---

### Przenoszenie bazy cenników z istniejącej instalacji

Jeśli masz już działającą instalację z wypełnioną bazą cen i produktów, możesz przenieść ją na nowe urządzenie — pozwala to pominąć proces seedowania i zachować wszystkie dane.

#### Krok po kroku:

1. **Na starym urządzeniu** wykonaj backup bazy danych:

    ```powershell
    npm run backup
    ```

    Backup zostanie zapisany w `data/backups/backup_<data>.sqlite`.

2. **Skopiuj plik backupu** na nowe urządzenie (przez USB, sieć, chmurę):

    ```
    data/backups/backup_2026-07-14_*.sqlite
    ```

3. **Na nowym urządzeniu** wykonaj instalację z pominięciem seedowania:

    ```powershell
    .\install.bat --skip-seed   # Windows
    bash install.sh --skip-seed  # Linux
    ```

    Flaga `--skip-seed` zapobiega nadpisaniu bazy danych początkowych, co byłoby sprzeczne z przywracaniem własnej bazy.

4. **Przywróć bazę z backupu**:

    ```powershell
    npm run restore data/backups/backup_2026-07-14_*.sqlite
    ```

    lub ręcznie:

    ```powershell
    copy /Y data\backups\backup_2026-07-14_*.sqlite data\app_database.sqlite
    npx prisma db push --skip-generate --accept-data-loss
    ```

    > **Uwaga:** `npm run restore` automatycznie synchronizuje schemat (tworzy brakujące
    > tabele i indeksy przez `db push`). Przy ręcznym kopiowaniu pliku bazy ta synchronizacja
    > **nie zachodzi** — po kopiowaniu uruchom `npx prisma db push --skip-generate --accept-data-loss`.

5. **Uruchom serwer**:

    ```powershell
    .\start.bat
    ```

6. **(opcjonalnie)** Jeśli chcesz przenieść również niestandardowe ceny domyślne (rury, studnie, preco),
   skopiuj plik `data/price_defaults.json` ze starego urządzenia do katalogu `data/` na nowym.
   Zostanie automatycznie przywrócony przy starcie serwera.

    > **Lżejsza alternatywa:** Jeśli potrzebujesz przenieść tylko ceny (bez ofert/zamówień),
    > wystarczy skopiować `data/price_defaults.json` i uruchomić `start.bat` — nie jest
    > potrzebny backup SQLite ani `--skip-seed`.

#### Co zawiera baza?

Plik `data/app_database.sqlite` przechowuje:

| Zawartość                | Opis                                        |
| ------------------------ | ------------------------------------------- |
| Produkty (rury, studnie) | Cenniki, kategorie, średnice, długości      |
| Ceny i stawki            | Bieżące ceny produktów i usług              |
| Klienci                  | Baza klientów z danymi kontaktowymi         |
| Oferty i zamówienia      | Historia ofert i zamówień                   |
| Użytkownicy i sesje      | Konta użytkowników i ich sesje logowania    |
| Konfiguracja systemu     | Ustawienia, flagi funkcjonalne, preferencje |
| Logi audytu              | Historia zmian w systemie                   |
| Dane ML/AI               | Modele, telemetria, rekomendacje rankowania |

> **Uwaga:** Po przeniesieniu bazy upewnij się, że hasło administratora (`DEFAULT_ADMIN_PASSWORD` w `.env`) jest zgodne z poprzednią instalacją — w przeciwnym razie zmień je w bazie lub utwórz nowe konto admina.

#### Weryfikacja po przeniesieniu

1. Uruchom serwer: `.\start.bat`
2. Sprawdź endpoint `/health`:
    ```powershell
    curl http://localhost:3000/health
    ```
3. Zaloguj się i zweryfikuj:
    - Lista produktów i ceny są zgodne z poprzednią instalacją
    - Historia ofert jest dostępna
    - Klienci są na swoich miejscach

---

## Konfiguracja (.env)

| Zmienna                  | Opis                                                                                                              | Domyślnie                            | Wymagane |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------ | -------- |
| `PORT`                   | Port serwera                                                                                                      | `3000`                               | Nie      |
| `HOST`                   | Adres nasłuchiwania. W produkcji domyślnie `127.0.0.1` (tylko loopback); `0.0.0.0` tylko w Dockerze/osobnym proxy | `127.0.0.1` (prod) / `0.0.0.0` (dev) | Nie      |
| `NODE_ENV`               | Środowisko: `development` / `production` (production ustawiają skrypty startowe)                                  | `development`                        | Nie      |
| `DEFAULT_ADMIN_PASSWORD` | Hasło administratora (przy pierwszym uruchomieniu)                                                                | —                                    | **Tak**  |
| `DATABASE_URL`           | Ścieżka do bazy SQLite                                                                                            | `file:../data/app_database.sqlite`   | Nie      |
| `SENTRY_DSN`             | DSN Sentry do monitorowania błędów (opcjonalnie)                                                                  | —                                    | Nie      |
| `COOKIE_SECURE`          | Wymusza flagę `Secure` na ciastku sesji                                                                           | `true` gdy `NODE_ENV=production`     | Nie      |
| `TRUST_PROXY`            | Liczba reverse proxy przed aplikacją (Caddy/Nginx = 1, Cloudflare→Nginx→App = 2)                                  | `1`                                  | Nie      |

> **Ważne:** `DEFAULT_ADMIN_PASSWORD` jest wymagane tylko przy **pierwszym** uruchomieniu. Po utworzeniu konta admina zmiana hasła w `.env` nie wpływa na istniejące konto.

### HTTPS / Reverse proxy (produkcja)

W środowisku produkcyjnym aplikacja jest serwowana przez **HTTPS** za pośrednictwem reverse proxy (Caddy/Nginx z certyfikatem Let's Encrypt). Node/Express pozostaje wewnętrznym serwerem HTTP nasłuchującym na `127.0.0.1:3000` (w trybie `production` bind do `127.0.0.1` jest domyślny — port nie jest dostępny z sieci).

- Przykładowa konfiguracja Caddy: [`Caddyfile`](Caddyfile) (produkcja) i [`Caddyfile.dev`](Caddyfile.dev) (lokalny HTTPS z mkcert).
- Przy serwowaniu przez HTTPS ustaw `COOKIE_SECURE=true` w `.env` — wymusi flagę `Secure` na ciastku sesji (w `production` jest to domyślne).
- W trybie `production` aktywne są automatycznie: HSTS, przekierowanie HTTP→HTTPS (na podstawie `X-Forwarded-Proto`), nagłówki bezpieczeństwa Helmet.
- Szczegóły: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) oraz [docs/SECURITY.md](docs/SECURITY.md).

---

## Uruchomienie

### Tryb developerski

```powershell
npm run dev
```

- Backend: `http://localhost:3000/health` (hot-reload)

### Tryb produkcyjny

```powershell
npm run build
npm start
```

> **Uwaga (Linux):** po surowym `npm run build` (bez `build.sh`) skopiuj klienta Prisma do `dist/`:
> `mkdir -p dist/generated && cp -r generated/prisma dist/generated/` — albo użyj `build.bat`/`build.sh`, które robią to automatycznie.

Aplikacja: `http://localhost:3000` (lokalnie; w produkcji przez HTTPS — patrz sekcja [HTTPS / Reverse proxy](#https--reverse-proxy-produkcja))

---

## Skrypty startowe (.bat)

Projekt zawiera wygodne skrypty dla systemu Windows:

| Skrypt        | Opis                                                                 |
| ------------- | -------------------------------------------------------------------- |
| `start.bat`   | Główne wejście: `start.bat` (dev, domyślnie) lub `start.bat --prod`  |
| `dev.bat`     | Alias do `start.bat` (zachowany dla kompatybilności)                 |
| `build.bat`   | Buduje TypeScript i kopiuje klienta Prisma (frontend nie jest budowany — vanilla JS, ADR-005)                    |
| `install.bat` | Instaluje zależności, konfiguruje bazę. `--skip-seed` pomija seed                                                  |
| `prod.bat`    | Alias: uruchamia `start.bat --prod` (bez przekierowania portów)                                                    |

---

## Komendy

### Podstawowe

| Komenda                  | Opis                                                           |
| ------------------------ | -------------------------------------------------------------- |
| `npm run dev`            | Uruchom w trybie developerskim (backend + frontend równolegle) |
| `npm run build`          | Zbuduj backend (TypeScript → JavaScript)                       |
| `npm start`              | Uruchom w trybie produkcyjnym (`node dist/server.js`)          |
| `npm test`               | Uruchom testy (Jest z pokryciem)                               |
| `npm run test:quick`     | Uruchom szybkie testy (bez pokrycia)                           |
| `npm run test:watch`     | Uruchom testy w trybie watch                                   |
| `npm run test:alignment` | Test regresyjny Playwright (wyrównanie kolumn Excel)           |

### Backend

| Komenda               | Opis                                       |
| --------------------- | ------------------------------------------ |
| `npm run dev:backend` | Uruchom backend z hot-reload (ts-node-dev) |
| `npm run typecheck`   | Sprawdź typy TypeScript (backend)          |
| `npm run lint`        | ESLint dla backendu                        |
| `npm run lint:fix`    | ESLint z automatyczną naprawą              |

### Frontend

| Komenda                      | Opis                               |
| ---------------------------- | ---------------------------------- |
| `npm run typecheck:frontend` | Sprawdź typy TypeScript (frontend) |
| `npm run lint:frontend`      | ESLint dla kodu frontendowego      |

### Baza danych (Prisma)

| Komenda                   | Opis                           |
| ------------------------- | ------------------------------ |
| `npm run prisma:generate` | Generuj klienta Prisma         |
| `npm run prisma:migrate`  | Utwórz migrację dev            |
| `npm run prisma:deploy`   | Zastosuj migracje w produkcji  |
| `npm run prisma:seed`     | Zasiej dane początkowe         |
| `npm run prisma:studio`   | Otwórz Prisma Studio (UI bazy) |
| `npm run prisma:reset`    | Reset bazy danych              |
| `npm run prisma:status`   | Status migracji                |

### Backup i przenoszenie bazy

| Komenda                         | Opis                              |
| ------------------------------- | --------------------------------- |
| `npm run backup`                | Wykonaj backup bazy SQLite        |
| `npm run restore`               | Przywróć bazę z pliku backupu     |
| `npm run backup:install-cron`   | Zainstaluj cron backupu (Windows) |
| `npm run backup:uninstall-cron` | Odinstaluj cron backupu (Windows) |

### Wersjonowanie

| Komenda                 | Opis                                                       |
| ----------------------- | ---------------------------------------------------------- |
| `npm run version:check` | Sprawdź spójność wersji (VERSION, package.json, CHANGELOG) |
| `npm run version:patch` | Podbij wersję patch                                        |
| `npm run version:minor` | Podbij wersję minor                                        |
| `npm run version:major` | Podbij wersję major                                        |
| `npm run version:bump`  | Podbij wersję (typ z argumentu)                            |

### Nazwa aplikacji i skill CLI

| Komenda                   | Opis                                        |
| ------------------------- | ------------------------------------------- |
| `npm run appname:check`   | Sprawdź spójność nazwy aplikacji (pre-push) |
| `npm run skills:build`    | Oblicz koszt budowy skilli                  |
| `npm run skills:stats`    | Statystyki skilli                           |
| `npm run skills:validate` | Walidacja manifestów skilli                 |
| `npm run skills:cost`     | Koszt tokenów skilli                        |
| `npm run skills:deps`     | Zależności między skillami                  |

**Gdzie żyje numer wersji (pełna lista):**

Wersja jest synchronizowana automatycznie podczas release (hook `postbump` w `.versionrc.json`). **Nie zmieniaj ręcznie** — poniższa lista służy weryfikacji spójności (`npm run version:check`) i kontroli, czy nic nie zostało pominięte:

| #   | Lokalizacja                                                | Automat (release)               |
| --- | ---------------------------------------------------------- | ------------------------------- |
| 1   | `VERSION` (root) — źródło prawdy                           | `standard-version` (bumpFiles)  |
| 2   | `package.json` → `version`                                 | `standard-version` (bumpFiles)  |
| 3   | `package-lock.json` → `version` (root)                     | `standard-version` (bumpFiles)  |
| 4   | `CHANGELOG.md` (nagłówki wersji)                           | `standard-version` (infile)     |
| 5   | `public/*.html` + `public/templates/*.html` → `?v=X.Y.Z`   | `scripts/auto-cache-bust.mjs`   |
| 6   | `*.bat` (start, install, build, ensure-db) → `APP_VERSION` | `scripts/auto-bat-version.mjs`  |
| 7   | `README.md` + `docs/*.md` → `**Wersja:**` itd.             | `scripts/auto-docs-version.mjs` |
| 8   | `docs/API.md` przykłady JSON (`"version"`/`"dbVersion"`)   | `scripts/auto-docs-version.mjs` |

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

### Walidacja i kodowanie

| Komenda                  | Opis                                                     |
| ------------------------ | -------------------------------------------------------- |
| `npm run validate`       | Pełna walidacja: typecheck + lint + testy                |
| `npm run format`         | Formatuj kod (Prettier)                                  |
| `npm run format:check`   | Sprawdź formatowanie                                     |
| `npm run encoding:check` | Sprawdź kodowanie plików (UTF-8 bez BOM, ASCII dla .bat) |
| `npm run encoding:fix`   | Napraw kodowanie plików                                  |

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
│   │   ├── clients.ts         # Baza klientów
│   │   ├── settings.ts        # Ustawienia systemowe
│   │   ├── audit.ts           # Logi audytowe
│   │   ├── featureFlags.ts    # Flagi funkcjonalne
│   │   ├── exportCombined.ts  # Łączny eksport PDF/DOCX
│   │   ├── precoPricingV2.ts  # Cenniki Preco
│   │   ├── priceOverrides.ts  # Nadpisania cen
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
├── public/                    # Frontend (Vanilla JS SPA)
│   ├── app.html               # Shell SPA (jedyny entry point)
│   ├── studnie.html           # Moduł studnie (iframe)
│   ├── rury.html              # Moduł rury (iframe)
│   ├── js/                    # Skrypty JS
│   │   ├── shared/            # auth, ui, icons, headerUser, clientManager, dashboard
│   │   ├── studnie/           # WellManager, solver, ruleEngine, ML hooks, Excel
│   │   ├── rury/              # OfferItems, offerSummary, PEHD
│   │   ├── kartoteka/         # Kartoteka ofert i zamówień (kartoteka*)
│   │   ├── import-export/     # Import/eksport XLSX + JSON 1:1 (toolbar.js)
│   │   ├── admin/             # Panel admina (AI dashboard)
│   │   └── spa/               # Router SPA (router.js)
│   ├── css/                   # Style CSS
│   └── templates/             # Szablony do druku
├── prisma/                    # Schema + migracje Prisma
│   └── schema.prisma
├── data/                      # Baza SQLite + pliki seed
├── tests/                     # Testy (Jest, Playwright)
│   ├── ml/                    # Testy pipeline'u ML
│   ├── studnie/               # Testy modułu studnie
│   ├── sales/                 # Testy kartoteki (filtry, batch, search)
│   ├── playwright/            # Testy Playwright (regresyjne)
│   └── ...
├── docs/                      # Dokumentacja
│   ├── adr/                   # Decyzje architektoniczne (ADR-001..007)
│   ├── plans/                 # Plany i taski (+ archive/)
│   ├── import-export/         # Dokumentacja modułu import/eksport
│   └── ...
├── scripts/                   # Skrypty narzędziowe
│   ├── backup.ts              # Backup bazy danych
│   ├── restore-db.js          # Przywracanie bazy z backupu
│   ├── check-db.js            # Weryfikacja schematu przy starcie
│   ├── check-version.mjs      # Weryfikacja spójności wersji
│   ├── check-appname.cjs      # Sprawdzanie nazwy aplikacji (pre-push)
│   ├── auto-cache-bust.mjs    # Cache-bust assetów przy release
│   ├── auto-docs-version.mjs  # Wersje w dokumentacji przy release
│   ├── auto-bat-version.mjs   # Wersje w .bat przy release
│   ├── bump-version.mjs       # Podbijanie wersji
│   ├── encoding-integrity.js  # Sprawdzanie kodowania UTF-8
│   ├── skill-cli.mjs          # Skill CLI (build cost, stats)
│   ├── export-settings-to-seed.mjs # Eksport ustawień do seed
│   └── ...
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
