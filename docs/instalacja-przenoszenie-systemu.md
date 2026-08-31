# Instalacja i przenoszenie systemu S.O.K. — System Ofert i Kalkulacji

> **Plik:** docs/instalacja-przenoszenie-systemu.md
> **Wersja:** 1.22.0
> **Cel:** Kompleksowa instrukcja instalacji, przenoszenia i backupu systemu
> **Status:** dokument odzwierciedla **aktualny, wdrożony stan** systemu (1.19.4) —
> sekcje instalacji/aktualizacji opisują działające mechanizmy
> (`install.bat` z `migrate deploy` + fallback `db push` dla baz legacy), nie plany przyszłe.

---

## Spis treści

1. [Architektura systemu](#1-architektura-systemu)
2. [Wymagania systemowe](#2-wymagania-systemowe)
3. [Instalacja na nowym komputerze (Windows)](#3-instalacja-na-nowym-komputerze-windows)
4. [Instalacja na nowym komputerze z przeniesieniem bazy](#4-instalacja-z-przeniesieniem-bazy)
5. [Instalacja przez Docker](#5-instalacja-przez-docker)
6. [Backup i przywracanie](#6-backup-i-przywracanie)
7. [Aktualizacja systemu](#7-aktualizacja-systemu)
8. [Co jest automatyczne vs ręczne](#8-automatyczne-vs-ręczne)
9. [Zmienne środowiskowe](#9-zmienne-środowiskowe)
10. [Rozwiązywanie problemów](#10-rozwiązywanie-problemów)
11. [Ściągawka](#11-ściągawka)

---

## 1. Architektura systemu

```
┌─────────────────────────────────────────────────────────┐
│           S.O.K. — System Ofert i Kalkulacji            │
├─────────────────┬───────────────────┬───────────────────┤
│   Backend        │   Frontend         │   Baza danych     │
│   Express 4.21   │   Vanilla JS SPA   │   SQLite          │
│   TypeScript     │   serwowany z public/ │   (1 plik)    │
│   Port 3000      │   przez Express    │   data/*.sqlite   │
│                  │   (dev i prod)     │                   │
├─────────────────┴───────────────────┴───────────────────┤
│   Dodatkowo: Puppeteer (PDF), docx (DOCX), Sentry (logs)│
│   Opcjonalnie: Python 3.10+ (well_configurator_backend/) │
└─────────────────────────────────────────────────────────┘
```

### Komponenty:

| Komponent       | Technologia                       | Rola                                                        |
| --------------- | --------------------------------- | ----------------------------------------------------------- |
| **Backend**     | TypeScript + Express 4.21         | API, logika biznesowa, generowanie PDF/DOCX                 |
| **Frontend**    | Vanilla JS (ES2020), bez bundlera | UI w iframe'ach, serwowany wprost przez Express z `public/` |
| **Baza danych** | SQLite przez Prisma 6             | Jeden plik `data/app_database.sqlite`                       |
| **ORM**         | Prisma 6                          | Migracje, seed, zapytania                                   |
| **PDF**         | Puppeteer 24                      | Generowanie dokumentów PDF (Chromium ~300 MB)               |
| **DOCX**        | docx 9                            | Generowanie dokumentów Word                                 |
| **Monitoring**  | Sentry 10 (opcjonalnie)           | Zbieranie błędów                                            |

---

## 2. Wymagania systemowe

### Minimalne:

| Zasób        | Wymaganie                                                  |
| ------------ | ---------------------------------------------------------- |
| **System**   | Windows 10/11, Linux (Ubuntu 20+), macOS 12+               |
| **Node.js**  | >= 22.13 LTS (rekomendowane 22.x / 24.x)                   |
| **npm**      | >= 9.0.0 (dołączony do Node.js)                            |
| **RAM**      | 512 MB (1 GB zalecane)                                     |
| **Dysk**     | ~500 MB wolnego miejsca (w tym Chromium ~300 MB)           |
| **Internet** | Tylko przy pierwszej instalacji                            |
| **Git**      | Opcjonalnie (do pobierania aktualizacji)                   |
| **Python**   | Opcjonalnie (3.10+ tylko dla walidacji Excel w pre-commit) |

### Dla Docker:

- Docker Desktop (Windows) lub Docker Engine (Linux)
- Obraz: node:22-slim (~150 MB)
- Wolumen: `sok_data:/var/data` (trwałość bazy)

---

## 3. Instalacja na nowym komputerze (Windows)

### Szybki start (5 kroków):

```
1. Zainstaluj Node.js >= 22.13 LTS z https://nodejs.org
2. git clone https://github.com/blodytrav3l3r/Oferty_PV.git
   (lub Download ZIP → rozpakuj)
3. Skopiuj .env.example → .env, ustaw DEFAULT_ADMIN_PASSWORD
4. Kliknij 2x na install.bat
5. Kliknij 2x na dev.bat
   → Otwórz http://localhost:3000
```

### Krok 1: Node.js

```powershell
# Pobierz z: https://nodejs.org (wersja LTS, lewa strona, zielony przycisk)
# Uruchom instalator → "Next" aż do końca
# Sprawdź:
node --version   # → v22.13.x lub nowszy
npm --version    # → 9.x lub nowszy
```

### Krok 2: Pobranie kodu

```powershell
# Opcja A — Git (zalecane do aktualizacji):
git clone https://github.com/blodytrav3l3r/Oferty_PV.git
cd Oferty_PV

# Opcja B — ZIP (prostsze):
# 1. Otwórz https://github.com/blodytrav3l3r/Oferty_PV
# 2. Kliknij "Code" → "Download ZIP"
# 3. Rozpakuj do wybranego folderu
```

### Krok 3: Konfiguracja

```powershell
# Skopiuj szablon konfiguracji:
copy .env.example .env

# Edytuj .env Notatnikiem — ZMIEŃ HASŁO:
# DEFAULT_ADMIN_PASSWORD=twoje_wlasne_haslo
```

### Krok 4: Instalator

```powershell
# Uruchom (wolno — 2-5 minut):
.\install.bat
```

Co robi instalator:

1. ✅ Sprawdza Node.js >= 22.13
2. ✅ Sprawdza npm
3. ✅ Sprawdza Git (opcjonalny)
4. ✅ Sprawdza strukturę katalogów (src/, prisma/)
5. ✅ Pobiera biblioteki (npm ci / npm install)
6. ✅ Generuje Prisma Client
7. ✅ Wykonuje migracje bazy danych
8. ✅ Wgrywa dane początkowe (seed)
9. ✅ Sprawdza typy TypeScript

### Krok 5: Uruchomienie

```powershell
# Dewelopersko (hot-reload, polecane do codziennej pracy):
.\dev.bat

# lub produkcyjnie (szybsze, bez debugowania):
.\build.bat   # najpierw zbuduj
.\prod.bat    # potem uruchom
```

Po uruchomieniu `dev.bat`:

- Aplikacja: **http://localhost:3000**
- Backend API: **http://localhost:3000/health**
- Logowanie: **admin** / hasło z `.env`

---

## 4. Instalacja z przeniesieniem bazy

Gdy masz już dane na starym komputerze i chcesz je przenieść.

### Na starym komputerze:

```powershell
# 1. Zrób backup bazy (WAL-safe, spójny snapshot):
npm run backup

# 2. Znajdź plik backupu:
#    → data/backups/backup_YYYY-MM-DD_TIMESTAMP.sqlite

# 3. Skopiuj na pendrive / przez sieć / chmurę
```

### Na nowym komputerze:

```powershell
# 1. Wykonaj standardową instalację (Kroki 1-3 z Sekcji 3)
# 2. Uruchom instalator z pominięciem seeda:
.\install.bat --skip-seed
#    Instalator zainstaluje biblioteki, wygeneruje Prisma Client i zsynchronizuje
#    schemat bazy (migrate deploy; fallback db push tylko dla baz legacy bez
#    _prisma_migrations).

# 3. Skopiuj plik backupu do data/backups/

# 4. Przywróć bazę:
npm run restore -- data/backups/backup_*.sqlite
# System zapyta: "Czy na pewno?" → wpisz "tak"

# 5. Uruchom:
.\dev.bat
```

> **Wariant ręczny (bez `install.bat`):** `npm ci`, `npx prisma generate`, następnie
> `npx prisma migrate deploy` (domyślnie). Dla bazy legacy z backupu, która nie ma
> tabeli `_prisma_migrations`, `prisma migrate deploy` NIE zadziała — użyj wtedy
> `npx prisma db push --skip-generate --accept-data-loss`.

### Przeniesienie samych cen (bez ofert/zamówień)

Gdy chcesz przenieść **tylko niestandardowe ceny domyślne** (rury, studnie, preco), bez bazy danych:

```powershell
# 1. Stare urządzenie — wygeneruj snapshot domyślnych cenników:
npm run prices:export
#    → tworzy/aktualizuje data/price_defaults.json (to samo robi przycisk
#      "Zapisz domyślne" w Ustawieniach)

# 2. Skopiuj plik na nowe urządzenie:
#    data/price_defaults.json

# 3. Nowe urządzenie — po instalacji przywróć ceny (walidacja + raport różnic):
npm run prices:import
#    lub ze wskazanego pliku:
npm run prices:import -- data/price_defaults.json
```

> **Automatycznie:** serwer przy starcie odczytuje `data/price_defaults.json`
> (lub ścieżkę ze zmiennej `PRICE_DEFAULTS_PATH`) i przywraca ceny, jeśli to plik
> migawki domyślnych cenników — nie trzeba wtedy wołać `prices:import` ręcznie.

### ⚠️ Uwagi przy przenoszeniu:

| Kwestia            | Zalecenie                                                                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Wersja systemu** | Powinna być taka sama na obu komputerach (sprawdź `VERSION`)                                                                                                                          |
| **Różne wersje**   | Po restore uruchom `install.bat --skip-seed` — zaktualizuje schemat bazy                                                                                                              |
| **Typ bazy**       | Baza z backupu może być legacy (utworzona przez `db push`) — nie ma tabeli `_prisma_migrations`; na niej `migrate deploy` zawodzi, użyj `db push`. Nowe/świeże bazy: `migrate deploy` |
| **Migracje**       | `migrate deploy` (domyślnie) lub `db push` (legacy) doda brakujące tabele i indeksy (w tym `idx_logs_well` / `idx_logs_source_well`), nie usunie danych                               |
| **Bezpieczeństwo** | Po przeniesieniu zmień hasło admina w panelu użytkownika                                                                                                                              |

---

## 5. Instalacja przez Docker

```powershell
# 1. Zainstaluj Docker Desktop (https://docker.com)
# 2. Otwórz terminal w folderze projektu
# 3. Uruchom:
docker compose up --build -d

# 4. Aplikacja na: http://localhost:3000
# 5. Logowanie: admin / hasło ustawione w DEFAULT_ADMIN_PASSWORD (wymagane jawnie w .env przed docker compose up)
```

### Co Docker robi automatycznie:

1. Buduje obraz z node:22-slim
2. Uruchamia `docker-entrypoint.sh`, który:
    - Ustawia `DATABASE_URL` na `/var/data/app_database.sqlite`
    - Wykonuje `prisma migrate deploy` (aktualizacja schematu)
    - Seeduje pustą bazę (jeśli potrzebne)
    - Uruchamia `npm start` (serwer produkcyjny)
3. Montuje wolumen `sok_data:/var/data` (baza trwała)
4. Healthcheck co 30s na `/health`

> **Ceny domyślne w Dockerze:** snapshot `data/price_defaults.json` umieszczony w katalogu
> `./data` na hoście jest widoczny w kontenerze jako `/var/data/price_defaults.json`
> i automatycznie przywracany przy starcie (jeśli ustawisz `PRICE_DEFAULTS_PATH`
> na tę ścieżkę w `docker-compose.yml` / `.env`).

### Docker — komendy:

```powershell
# Uruchom
docker compose up -d

# Zatrzymaj
docker compose down

# Zobacz logi
docker compose logs -f

# Zrestartuj
docker compose restart

# Usuń wszystko (RAZEM Z BAZĄ!)
docker compose down -v
```

### ⚠️ Docker — zmienne środowiskowe:

Docker czyta `.env` z projektu. Jeśli chcesz zmienić hasło:

1. Edytuj `.env` i zmień `DEFAULT_ADMIN_PASSWORD`
2. Zrestartuj: `docker compose restart`

---

## 6. Backup i przywracanie

### Backup bazy:

```powershell
# Utwórz kopię bezpieczeństwa (WAL-safe przez VACUUM INTO):
npm run backup

# Backup trafia do: data/backups/backup_YYYY-MM-DD_TIMESTAMP.sqlite
# System zachowuje max 30 kopii, najstarsze usuwa automatycznie
```

### Przywracanie z backupu:

```powershell
# Przywróć bazę z backupu:
npm run restore -- data/backups/backup_NAZWA_PLIKU.sqlite

# System zapyta o potwierdzenie — wpisz "tak"
```

### Automatyczny backup (Windows):

```powershell
# Instalacja codziennego backupu o 02:00 (URUCHOM JAKO ADMINISTRATOR):
npm run backup:install-cron

# Usunięcie zadania:
npm run backup:uninstall-cron
```

### Struktura backupów:

```
data/
├── app_database.sqlite          ← Główna baza (aktywna)
├── backups/
│   ├── backup_2026-07-20_123456.sqlite   ← Backup z 20 lipca
│   ├── backup_2026-07-19_123456.sqlite   ← Backup z 19 lipca
│   └── ...                                ← Max 30 kopii
└── backup/                               ← Stary katalog (starsza metoda)
```

### 💡 Dobre praktyki backupu:

| Częstotliwość            | Co backupować        | Jak                                   |
| ------------------------ | -------------------- | ------------------------------------- |
| **Codziennie**           | Baza SQLite          | `npm run backup` (automat przez cron) |
| **Przed aktualizacją**   | Baza SQLite          | Ręcznie: `npm run backup`             |
| **Ręcznie (co tydzień)** | Cały folder projektu | Kopiuj cały katalog na pendrive       |

---

## 7. Aktualizacja systemu

### Standardowa aktualizacja:

```powershell
# 1. Backup (ZAWSZE najpierw!):
npm run backup

# 2. Pobierz nowy kod:
git pull

# 3. Zainstaluj ewentualne nowe biblioteki:
npm ci

# 4. Zaktualizuj schemat bazy — sposób zależy od typu bazy:
#    - domyślnie (baza z historią migracji / świeża):
npx prisma migrate deploy
#    - baza legacy tworzona przez db push (brak _prisma_migrations):
#      npx prisma db push --skip-generate --accept-data-loss
#    Jak sprawdzić typ: npx prisma migrate status — jeśli pokazuje migracje
#    jako niezastosowane mimo działającej aplikacji, baza jest typu db push.

# 5. Jeśli były zmiany w seedzie (opcjonalnie):
npm run prisma:seed

# 6. Uruchom:
.\dev.bat
```

> **Indeksy i FTS5:** od wersji 1.10.0 `scripts/check-db.js` sprawdza również wymagane
> indeksy deduplikacji telemetrii (`idx_logs_well`, `idx_logs_source_well`) — ich brak
> kończy się kodem wyjścia 1, a `start.bat`/`dev.sh` uruchamiają `migrate deploy`. Przy starcie
> serwera indeksy są też naprawiane automatycznie (auto-heal w `src/app.ts`), a brakująca
> tabela FTS5 (`offers_search_fts`) tworzona jest przez `src/utils/fts5Sync.ts`
> (z backfillem ofert).

### Użycie `install.bat` zamiast ręcznych kroków:

```powershell
git pull
.\install.bat           # robi wszystko za Ciebie
.\dev.bat
```

### Co jeśli migracja wymaga ręcznej interwencji:

```powershell
# Sprawdź status migracji:
npx prisma migrate status

# Jeśli są oczekujące migracje (baza z historią _prisma_migrations):
npx prisma migrate deploy

# Dla baz legacy tworzonych przez db push (brak _prisma_migrations) — migrate deploy NIE zadziała:
npx prisma db push --skip-generate --accept-data-loss
```

### Aktualizacja wersji (release):

```powershell
# Automatyczne podbicie wersji (patch/minor/major):
npm run release:patch   # Małe poprawki (1.9.0 → 1.9.1)
npm run release:minor   # Nowe funkcje (1.9.0 → 1.10.0)
npm run release:major   # Zmiany przełamujące (1.9.0 → 2.0.0)

# To robi automatycznie:
# 1. Podbija VERSION i package.json
# 2. Aktualizuje CHANGELOG.md
# 3. Podmienia ?v= we wszystkich HTML (cache-bust)
# 4. Tworzy commit + tag git

# Wyślij tag na GitHub:
git push --follow-tags
```

---

## 8. Co jest automatyczne vs ręczne

| Czynność                               | Automatyczne | Ręczne | Uwagi                                                        |
| -------------------------------------- | :----------: | :----: | ------------------------------------------------------------ |
| Instalacja Node.js >= 22.13            |              |   ✅   | Pobrać z https://nodejs.org                                  |
| Pobranie kodu (git clone / ZIP)        |              |   ✅   | GitHub → Code → Download ZIP                                 |
| Kopiowanie .env.example → .env         |              |   ✅   | `copy .env.example .env`                                     |
| Ustawienie DEFAULT_ADMIN_PASSWORD      |              |   ✅   | Edycja .env                                                  |
| Instalacja npm dependencies            |      ✅      |        | `install.bat` → npm ci                                       |
| Generowanie Prisma Client              |      ✅      |        | `install.bat` → prisma generate                              |
| Migracja bazy danych                   |      ✅      |        | `install.bat` → prisma migrate deploy (db push tylko legacy) |
| Seed danych początkowych               |      ✅      |        | `install.bat` → prisma/seed.ts (opcjonalnie)                 |
| Typecheck TypeScript                   |      ✅      |        | `install.bat` → tsc --noEmit                                 |
| Budowa (TS→JS)                         |      ✅      |        | `build.bat` → tsc                                            |
| Uruchomienie serwera dev               |      ✅      |        | `dev.bat` → npm run dev                                      |
| Uruchomienie serwera prod              |      ✅      |        | `prod.bat` → npm start                                       |
| Port check (3000)                      |      ✅      |        | PowerShell Get-NetTCPConnection                              |
| Backup bazy                            |      ✅      |        | `npm run backup` (VACUUM INTO)                               |
| Przywracanie backupu                   |              |   ✅   | `npm run restore -- <file>`                                  |
| Automatyczny backup cron               |              |   ✅   | `npm run backup:install-cron` (jako Admin)                   |
| Aktualizacja z gita                    |              |   ✅   | `git pull`                                                   |
| Release (wersja + changelog + tag)     |      ✅      |        | `npm run release:patch`                                      |
| Cache-bust assetów (?v=)               |      ✅      |        | Hook postbump w standard-version                             |
| Git hooks (Husky pre-push, pre-commit) |      ✅      |        | Automatycznie przy commit/push                               |
| Docker deploy                          |              |   ✅   | `docker compose up --build -d`                               |
| Zmiana hasła admina                    |              |   ✅   | W panelu użytkownika po 1. logowaniu                         |

### Podsumowanie:

**Musisz zrobić ręcznie (4 kroki):**

1. Zainstalować Node.js
2. Pobrać kod (git clone lub ZIP)
3. Skopiować .env.example → .env i ustawić hasło
4. Uruchomić `install.bat` (to triggeruje wszystko inne)

**Resztę robią skrypty.**

---

## 9. Zmienne środowiskowe

### Plik .env:

```env
# Port serwera (dla Docker: 10000, lokalnie może być 3000)
PORT=10000

# Adres nasłuchiwania (0.0.0.0 = dostępny z sieci)
HOST=0.0.0.0

# Tryb pracy
NODE_ENV=production

# HASŁO ADMINISTRATORA (WYMAGANE przy 1. uruchomieniu!)
DEFAULT_ADMIN_PASSWORD=twoje_haslo

# Monitorowanie błędów (opcjonalnie, pusty = wyłączony)
SENTRY_DSN=

# Ścieżka do bazy SQLite
DATABASE_URL=file:../data/app_database.sqlite?connection_limit=1&busy_timeout=30000

# Ścieżka do pliku migawki domyślnych cenników (opcjonalnie; domyślnie data/price_defaults.json)
# Dla Docker: PRICE_DEFAULTS_PATH=/var/data/price_defaults.json (plik w wolumenie ./data)
PRICE_DEFAULTS_PATH=
```

### Zmienne dla różnych środowisk:

| Zmienna                  |  Lokalnie (dev)  |            Docker             |
| ------------------------ | :--------------: | :---------------------------: |
| `PORT`                   |  10000 lub 3000  |             10000             |
| `HOST`                   |     0.0.0.0      |            0.0.0.0            |
| `NODE_ENV`               |   development    |          production           |
| `DEFAULT_ADMIN_PASSWORD` |   **Wymagane**   |         **Wymagane**          |
| `DATABASE_URL`           | file:../data/... |      file:/var/data/...       |
| `PRICE_DEFAULTS_PATH`    |  (opcjonalnie)   | /var/data/price_defaults.json |

---

## 10. Rozwiązywanie problemów

### [BŁĄD] Brak Node.js

**Przyczyna:** Nie zainstalowano Node.js >= 22.13.

**Rozwiązanie:** Pobierz z https://nodejs.org (LTS) i zainstaluj.

### npm install nie działa

**Przyczyna:** Brak internetu, antywirus blokuje, za stary Node.js.

**Rozwiązanie:**

```powershell
node --version          # Sprawdź wersję (musi być >= 22.13)
npm --version           # Sprawdź npm
# Wyłącz antywirus na czas instalacji
# Uruchom jako Administrator
```

### Port 3000 zajęty

**Przyczyna:** Inna aplikacja używa tego portu.

**Rozwiązanie:** dev.bat zapyta "Zwolnić port?" → wpisz **T** (tak) i Enter.

### prisma generate nie powiódł się

**Przyczyna:** Brak uprawnień zapisu, brak miejsca na dysku.

**Rozwiązanie:**

```powershell
# Sprawdź miejsce na dysku
# Uruchom terminal jako Administrator
npx prisma generate
```

### Aplikacja się nie uruchamia

**Przyczyna:** Brak pliku .env, błędne hasło, uszkodzona baza.

**Rozwiązanie:**

1. Sprawdź czy `.env` istnieje
2. Sprawdź czy `DEFAULT_ADMIN_PASSWORD` jest ustawione
3. Usuń `data/app_database.sqlite` i uruchom `install.bat` ponownie

### "Cannot find module" — brak modułu

**Przyczyna:** Niekompletna instalacja lub build.

**Rozwiązanie:**

```powershell
.\build.bat    # Przebuduj projekt
```

### Puppeteer / Chromium nie działa

**Przyczyna:** Brak zależności systemowych dla Chromium.

**Rozwiązanie (Linux):**

```bash
sudo apt install -y chromium-browser
# lub
npx puppeteer install
```

### Git hooks (Husky) blokują commita

**Przyczyna:** Husky pre-commit/pre-push sprawdza kod.

**Rozwiązanie:**

```powershell
# Obejście (jeśli pilnie potrzebujesz commita):
git -c core.hooksPath=/dev/null commit -m "opis"
```

### Docker — błąd "Cannot connect to the Docker daemon"

**Przyczyna:** Docker Desktop nie jest uruchomiony.

**Rozwiązanie:** Uruchom Docker Desktop z menu Start.

### AI / ML Dashboard — "Brak dostępu" / "Nie można pobrać danych"

**Przyczyna:**

1. Zalogowano na konto użytkownika bez roli `admin` (dashboardy AI/ML są dostępne wyłącznie dla administratora).
2. Świeżo przeniesiona baza danych nie zawiera jeszcze zarejestrowanych zapytań telemetrii ani wytrenowanego modelu ML.

**Rozwiązanie:**

1. Zaloguj się na konto administratora (`admin` i hasło podane w `.env` jako `DEFAULT_ADMIN_PASSWORD`).
2. Upewnij się, że w nagłówku aplikacji po zalogowaniu widnieje etykieta **ADMIN**.
3. W panelu AI kliknij przycisk **"Uruchom uczenie (Manual Run)"** lub **"Trenuj nowy model ML"**, aby zasilić bazę wiedzy i utworzyć pierwszy model ML.

---

## 11. Ściągawka

### 10 najważniejszych komend:

| #   | Komenda                       | Co robi                                     |
| --- | ----------------------------- | ------------------------------------------- |
| 1   | `.\install.bat`               | Instalacja (RAZ po pobraniu)                |
| 2   | `.\dev.bat`                   | Uruchomienie (ZAWSZE do pracy)              |
| 3   | `npm run backup`              | Kopia bezpieczeństwa bazy                   |
| 4   | `npm run restore -- <plik>`   | Przywróć bazę z kopii                       |
| 5   | `npm run backup:install-cron` | Automatyczny backup codziennie o 02:00      |
| 6   | `git pull`                    | Pobierz aktualizacje                        |
| 7   | `.\build.bat`                 | Zbuduj wersję produkcyjną                   |
| 8   | `.\prod.bat`                  | Uruchom wersję produkcyjną                  |
| 9   | `npm run test:quick`          | Szybkie testy (sprawdź czy wszystko działa) |
| 10  | `npm run validate`            | Pełna walidacja (typecheck + lint + test)   |

### Komendy cen:

| Komenda                          | Co robi                                                        |
| -------------------------------- | -------------------------------------------------------------- |
| `npm run prices:export`          | Zapis domyślnych cenników do `data/price_defaults.json` (CLI)  |
| `npm run prices:import`          | Restore cenników z `price_defaults.json` (walidacja + raport)  |
| `npm run cleanup:legacy-pricing` | Usuwa legacy klucze cennikowe z `settings` (dry-run domyślnie) |

### Główne pliki i katalogi:

| Ścieżka                    | Opis                                                    |
| -------------------------- | ------------------------------------------------------- |
| `data/app_database.sqlite` | **BAZA DANYCH** — najważniejszy plik                    |
| `data/backups/`            | Kopie bezpieczeństwa bazy                               |
| `.env`                     | Konfiguracja (hasło, port, itp.)                        |
| `.env.example`             | Szablon konfiguracji                                    |
| `install.bat`              | Instalator                                              |
| `dev.bat`                  | Uruchomienie deweloperskie                              |
| `start.bat`                | Uruchomienie (to samo co dev.bat)                       |
| `build.bat`                | Budowa produkcyjna                                      |
| `prod.bat`                 | Uruchomienie produkcyjne                                |
| `scripts/backup.ts`        | Skrypt backupu                                          |
| `scripts/restore-db.js`    | Skrypt przywracania                                     |
| `scripts/check-db.js`      | Weryfikacja schematu bazy (tabele, indeksy dedup, dane) |
| `src/utils/fts5Sync.ts`    | Auto-tworzenie tabeli FTS5 wyszukiwarki ofert           |
| `prisma/seed.ts`           | Dane początkowe                                         |
| `prisma/migrations/`       | Migracje schematu bazy                                  |
| `docs/`                    | Dokumentacja                                            |
| `VERSION`                  | Aktualna wersja systemu                                 |

---

> **Dokumentacja wygenerowana na podstawie analizy kodu źródłowego i skryptów instalacyjnych**
> Ostatnia aktualizacja: 2026-08-24
> Projekt: https://github.com/blodytrav3l3r/Oferty_PV
