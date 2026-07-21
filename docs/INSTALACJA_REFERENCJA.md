# WITROS Oferty PV — Instalacja: Automatyzacja vs. Praca Ręczna

> **Cel dokumentu:** Kompletne rozdzielenie kroków automatycznych od manualnych w procesie uruchomienia systemu. Dla administratorów, deweloperów i wdrożeniowców.

---

## 1. KROKI RĘCZNE (wymagają interwencji człowieka)

### 1.1 Instalacja Node.js 20+ LTS

| Pole | Opis |
|------|------|
| **Co zrobić** | Pobrać instalator z https://nodejs.org (wersja LTS ≥20), uruchomić, przejść przez kreatora. |
| **Dlaczego ręczne** | Node.js to zależność systemowa, a nie biblioteka projektu. Żaden skrypt nie może zainstalować środowiska uruchomieniowego na maszynie użytkownika — wymaga uprawnień admina i akceptacji licencji. |
| **Konsekwencja pominięcia** | `install.bat` / `dev.bat` zwróci `[BŁAD] Brak Node.js` i zakończy działanie z kodem błędu 1. |
| **Weryfikacja** | `node --version` → v20.x.x lub nowszy |

### 1.2 Pobranie kodu źródłowego

| Pole | Opis |
|------|------|
| **Co zrobić** | `git clone https://github.com/blodytrav3l3r/Oferty_PV.git` (zalecane) LUB pobrać ZIP z GitHub i rozpakować. |
| **Dlaczego ręczne** | Skrypty uruchamiane są z wnętrza projektu — muszą już znajdować się na dysku. |
| **Konsekwencja pominięcia** | Nie ma kodu do uruchomienia. |
| **Weryfikacja** | Istnieje katalog z plikami `install.bat`, `package.json`, `src/`, `prisma/` |

### 1.3 Konfiguracja pliku `.env`

| Pole | Opis |
|------|------|
| **Co zrobić** | Skopiować `.env.example` → `.env`, a następnie edytować `.env` i ustawić `DEFAULT_ADMIN_PASSWORD`. |
| **Dlaczego ręczne** | Hasło administratora to sekret — nie może być przechowywany w repozytorium ani generowany automatycznie (ryzyko bezpieczeństwa). Również inne ustawienia (Sentry DSN, port itp.) są opcjonalne, ale ich wartości muszą pochodzić od administratora. |
| **Konsekwencja pominięcia** | Aplikacja uruchomi się, ale nie utworzy konta administratora (brak możliwości logowania). `install.bat` **nie** tworzy `.env` automatycznie. Skrypt `check-db.js` może przepuścić, ale endpoint logowania zwróci błąd. |
| **Weryfikacja** | Plik `.env` istnieje i zawiera `DEFAULT_ADMIN_PASSWORD=...` (min. 6 znaków) |

### 1.4 Ustawienie DEFAULT_ADMIN_PASSWORD

| Pole | Opis |
|------|------|
| **Co zrobić** | W pliku `.env` ustawić wartość `DEFAULT_ADMIN_PASSWORD` na co najmniej 6 znaków. |
| **Dlaczego ręczne** | Hasło musi być znane administratorowi. Automatyczne wygenerowanie i zapisanie gdzieś logów stanowi lukę bezpieczeństwa. |
| **Konsekwencja pominięcia** | Konto `admin` nie zostanie utworzone. Aplikacja będzie dostępna, ale nikt się nie zaloguje. Jedyna naprawa: ustaw hasło w `.env` i zrestartuj serwer. |
| **Weryfikacja** | Po pierwszym uruchomieniu: zaloguj się na `admin` / ustawione hasło → strona główna. |

### 1.5 Uruchomienie `install.bat` (trigger automatyzacji)

| Pole | Opis |
|------|------|
| **Co zrobić** | Otworzyć terminal w katalogu projektu, wpisać `.\install.bat` i nacisnąć Enter. |
| **Dlaczego ręczne** | To jest punkt startowy dla całego łańcucha automatyzacji. Musi być zainicjowany przez człowieka. |
| **Konsekwencja pominięcia** | Żaden krok automatyczny nie zostanie wykonany (npm install, prisma generate, seed, typecheck). |
| **Weryfikacja** | Skrypt wypisze na końcu `[OK]` dla każdego kroku. |

### 1.6 (Opcjonalne) Zmiana hasła administratora po pierwszym logowaniu

| Pole | Opis |
|------|------|
| **Co zrobić** | Zalogować się → ustawienia profilu → zmienić hasło. |
| **Dlaczego ręczne** | Polityka bezpieczeństwa — hasło domyślne powinno być zmienione, ale to decyzja admina. |
| **Konsekwencja pominięcia** | Domyślne hasło z `.env` pozostaje aktywne. Jeśli `.env` wycieknie, konto jest zagrożone. |

### 1.7 (Opcjonalne) Konfiguracja Sentry DSN

| Pole | Opis |
|------|------|
| **Co zrobić** | W `.env` ustawić `SENTRY_DSN=https://...@...`.ingest.us.sentry.io/...`. |
| **Dlaczego ręczne** | Wymaga konta na sentry.io, utworzenia projektu i pobrania klucza DSN. |
| **Konsekwencja pominięcia** | Sentry wyłączony — błędy backendu nie są raportowane (logi tylko w plikach `server.log` / `server-err.log`). |

### 1.8 (Opcjonalne) Instalacja cron-a backupu

| Pole | Opis |
|------|------|
| **Co zrobić** | Uruchomić terminal jako Administrator: `npm run backup:install-cron`. |
| **Dlaczego ręczne** | Tworzenie zadania w harmonogramie Windows wymaga uprawnień administracyjnych i zgody użytkownika na cykliczne wykonywanie skryptu. |
| **Konsekwencja pominięcia** | Backup wykonuje się tylko ręcznie (`npm run backup`). Automatyczny backup codziennie o 02:00 nie zostanie uruchomiony. |

### 1.9 (Opcjonalne) Uruchomienie przez Docker

| Pole | Opis |
|------|------|
| **Co zrobić** | Zainstalować Docker Desktop, uruchomić: `docker compose up --build -d`. |
| **Dlaczego ręczne** | Docker to zależność systemowa (jak Node.js). Wymaga instalacji, konfiguracji i akceptacji licencji. |
| **Konsekwencja pominięcia** | Aplikacja uruchamiana natywnie (`.bat` / `.sh`). |



---

## 2. KROKI AUTOMATYCZNE (wykonują się bez interwencji)

### 2.1 `install.bat` / `install.sh` — Instalacja środowiska

| Pole | Opis |
|------|------|
| **Wyzwalacz** | Uruchomienie `.\install.bat` (Windows) lub `bash install.sh` (Linux) przez użytkownika. |
| **Co robi wewnętrznie** | 1. Sprawdza Node.js 20+ (`node --version`)\ 2. Sprawdza npm (`npm --version`)\ 3. Sprawdza Git (opcjonalnie, nie blokuje)\ 4. Weryfikuje strukturę katalogów (`src/`, `prisma/`)\ 5. Uruchamia `npm ci` (jeśli `package-lock.json` istnieje) lub `npm install`\ 6. Generuje Prisma Client (`npx prisma generate`)\ 7. Migruje schemat bazy (`npx prisma migrate deploy` z fallback `db push`)\ 8. Seed danych początkowych (`npx ts-node prisma/seed.ts`)\ 9. Typecheck (`npx tsc --noEmit`) |
| **Weryfikacja przez użytkownika** | Komunikat `Instalacja zakonczona` na końcu. Brak czerwonych `[BŁAD]`. |

### 2.2 `dev.bat` / `dev.sh` — Uruchomienie developerskie

| Pole | Opis |
|------|------|
| **Wyzwalacz** | Uruchomienie `.\dev.bat` lub `bash dev.sh`. |
| **Co robi wewnętrznie** | 1. Sprawdza Node.js\ 2. Sprawdza `package.json`\ 3. Jeśli brak `node_modules` → `npm install` (auto-instalacja)\ 4. Jeśli brak Prisma Client → `npx prisma generate` (auto-generacja)\ 5. Sprawdza schemat DB przez `node scripts/check-db.js` — jeśli brak tabel → `npx prisma db push`\ 6. Sprawdza port 3000 (PowerShell `Get-NetTCPConnection`), pyta czy zabić proces\ 7. Uruchamia `npm run dev` (backed + frontend równolegle) |
| **Weryfikacja przez użytkownika** | Aplikacja działa na `http://localhost:3000`. Backend: `http://localhost:3000/health` → `200 OK`. |

### 2.3 `build.bat` / `build.sh` — Budowanie produkcyjne

| Pole | Opis |
|------|------|
| **Wyzwalacz** | Uruchomienie `.\build.bat` lub `bash build.sh`. |
| **Co robi wewnętrznie** | 1. Sprawdza Node.js\ 2. `npm ci` jeśli brak `node_modules`\ 3. `npx prisma generate`\ 4. `npx tsc` (kompilacja TypeScript)\ 5. `npm run build:frontend` jeśli istnieje `vite.config.js` |
| **Weryfikacja przez użytkownika** | Komunikat `Build zakonczony`. Plik `dist/server.js` istnieje. |

### 2.4 `prod.bat` / `prod.sh` — Uruchomienie produkcyjne

| Pole | Opis |
|------|------|
| **Wyzwalacz** | Uruchomienie `.\prod.bat` lub `bash prod.sh`. |
| **Co robi wewnętrznie** | 1. Sprawdza Node.js\ 2. Jeśli brak `dist/server.js` → uruchamia `build.bat` (auto-build)\ 3. Sprawdza port 3000, pyta czy zabić proces\ 4. Tworzy `data/` jeśli nie istnieje\ 5. Uruchamia `npm start` (`node dist/server.js`) |
| **Weryfikacja przez użytkownika** | Aplikacja na `http://localhost:3000/health` → `200 OK`. |

### 2.5 `start.bat` — Uniwersalny starter

| Pole | Opis |
|------|------|
| **Wyzwalacz** | Uruchomienie `.\start.bat`. |
| **Co robi wewnętrznie** | Łączy logikę `dev.bat` + `install.bat`: sprawdza Node.js, auto-instaluje `node_modules`, auto-generuje Prisma Client, sprawdza schemat DB, sprawdza port 3000, uruchamia `npm run dev`. |
| **Weryfikacja przez użytkownika** | Aplikacja na `http://localhost:3000`. |

### 2.6 Release (standard-version)

| Pole | Opis |
|------|------|
| **Wyzwalacz** | `npm run release` (lub `:patch`, `:minor`, `:major`) |
| **Co robi wewnętrznie** | 1. `standard-version` analizuje commity → określa typ wersji\ 2. Bumpuje `package.json` (przez standard-version)\ 3. Bumpuje `VERSION` (przez `scripts/version-updater.mjs`)\ 4. **Hook postbump:** uruchamia `auto-cache-bust.mjs` → podmienia `?v=` we wszystkich plikach HTML\ 5. **Hook postbump:** uruchamia `auto-docs-version.mjs` → podmienia wersję w `docs/*.md`\ 6. Generuje `CHANGELOG.md`\ 7. Tworzy commit `chore(release): X.Y.Z` + tag `vX.Y.Z` |
| **Weryfikacja przez użytkownika** | `git log --oneline -3` → ostatni commit to `chore(release): ...` z tagiem. `cat VERSION` → nowa wersja. |

### 2.7 Backup (`npm run backup`)

| Pole | Opis |
|------|------|
| **Wyzwalacz** | `npm run backup` (ręcznie LUB automatycznie przez Windows Task Scheduler o 02:00) |
| **Co robi wewnętrznie** | 1. Sprawdza/ tworzy `data/backups/`\ 2. Wykonuje `VACUUM INTO` na SQLite — bezpieczny snapshot WAL-safe\ 3. Zapisuje plik `backup_YYYY-MM-DD_TIMESTAMP.sqlite`\ 4. Czyści stare backupy — zachowuje max 30 najnowszych |
| **Weryfikacja przez użytkownika** | Komunikat `[Backup] Utworzono: data/backups/backup_...`. Plik backupu istnieje. |

### 2.8 Przywracanie backupu (`npm run backup:restore`)

| Pole | Opis |
|------|------|
| **Wyzwalacz** | `npm run backup:restore -- data/backups/backup_*.sqlite` |
| **Co robi wewnętrznie** | 1. Waliduje, czy plik backupu istnieje\ 2. Pyta o potwierdzenie `Czy na pewno przywrócić backup? (tak/nie)`\ 3. Kopiuje plik backupu na `data/app_database.sqlite` (nadpisuje!) |
| **Weryfikacja przez użytkownika** | Komunikat `Baza przywrócona z: ...` |

### 2.9 Git Hooks (Husky)

| Hook | Wyzwalacz | Co robi |
|------|-----------|---------|
| **pre-commit** | `git commit` | Uruchamia `python scripts/excel-validator.py` + `npx lint-staged` (ESLint + Prettier + encoding check). Blokuje commit przy błędach. |
| **commit-msg** | `git commit` | Uruchamia `commitlint` — wymusza format Conventional Commits (`feat:`, `fix:`, `chore:`, itd.). |
| **post-commit** | Po `git commit` | Sprawdza spójność wersji (`npm run version:check`) — tylko ostrzeżenie, nie blokuje. |
| **pre-push** | `git push` | Sprawdza spójność wersji (`version:check`), TypeScript (`typecheck`), szybkie testy (`test:quick`). Blokuje push przy błędach. |

### 2.10 Docker (`docker compose up`)

| Pole | Opis |
|------|------|
| **Wyzwalacz** | `docker compose up --build -d` (ręcznie) |
| **Co robi wewnętrznie** | 1. Buduje obraz z `Dockerfile` (node:22-slim + openssl)\ 2. `npm install` w obrazie\ 3. `npx prisma generate` w obrazie\ 4. `npm run build` (tsc) w obrazie\ 5. `npm prune --production` + cache clean\ 6. Przy starcie kontenera: `docker-entrypoint.sh` → ustawia DATABASE_URL, migruje PRECO z 3 tabel do settings, `prisma db push`, uruchamia serwer\ 7. Healthcheck co 30s na `/health` |
| **Weryfikacja przez użytkownika** | `docker ps` → kontener `witros-oferty` działa. `curl http://localhost:3000/health` → 200. |

---

## 3. DRZEWKO DECYZYJNE

### Pytanie 1: Czy to nowe urządzenie?

```
Tak → Czy masz istniejącą bazę danych?
       ├── Nie → [ŚCIEŻKA A: FRESH INSTALL]
       │        1. Zainstaluj Node.js 20+ LTS
       │        2. git clone (lub ZIP)
       │        3. Skopiuj .env.example → .env, ustaw DEFAULT_ADMIN_PASSWORD
       │        4. Uruchom install.bat
       │        5. Uruchom dev.bat (lub prod.bat)
       │        6. Zaloguj się admin / <hasło>
       │
       └── Tak → [ŚCIEŻKA B: MIGRACJA BAZY]
                1. Zainstaluj Node.js 20+ LTS
                2. git clone (lub ZIP)
                3. Skopiuj .env.example → .env, ustaw DEFAULT_ADMIN_PASSWORD
                4. Uruchom install.bat
                5. ZATRZYMAJ serwer (jeśli działa)
                6. Skopiuj backup z starego urządzenia na nowe
                7. npm run backup:restore -- data/backups/backup_*.sqlite
                8. Uruchom dev.bat (lub prod.bat)
                9. Zaloguj się i zweryfikuj dane

Nie → To jest istniejąca instalacja → co chcesz zrobić?
       ├── Uruchomić aplikację?
       │   ├── dev.bat (tryb developerski, hot-reload)
       │   └── prod.bat (tryb produkcyjny, po buildzie)
       │
       ├── Zaktualizować kod?
       │   ├── git pull
       │   ├── install.bat (lub npm install)
       │   └── dev.bat / prod.bat
       │
       ├── Zrobić backup?
       │   └── npm run backup
       │
       ├── Zainstalować automatyczny backup?
       │   ├── Uruchom PowerShell jako Administrator
       │   └── npm run backup:install-cron
       │
       ├── Zrobić release?
       │   ├── npm run release:patch (lub :minor/:major)
       │   ├── git push --follow-tags
       │   └── GitHub automatycznie tworzy Release z tagu
       │
       └── Przenieść na nowe urządzenie?
           └── [ŚCIEŻKA B: MIGRACJA BAZY] — patrz wyżej
```

### Pytanie 2: Docker czy natywnie?

```
Chcesz uruchomić w Dockerze?
├── Tak → Docker Desktop zainstalowany?
│         ├── Tak → docker compose up --build -d
│         │         Aplikacja na http://localhost:3000
│         └── Nie → Zainstaluj Docker Desktop, potem docker compose up
│
└── Nie → Użyj dev.bat / prod.bat (ścieżka natywna)
```

### Pytanie 3: Produkcja czy development?

```
Cel instalacji:
├── Development (praca nad kodem)
│   ├── install.bat → dev.bat (hot-reload, backend + frontend)
│   ├── Backend: http://localhost:3000
│   ├── Frontend: http://localhost:5173 (Vite)
│   └── Zmiany w kodzie → auto-restart backendu
│
├── Lokalna produkcja (użytkowanie, nie kodowanie)
│   ├── install.bat → build.bat → prod.bat
│   └── Lub: install.bat → start.bat (robi wszystko auto)
│
└── Produkcja zdalna (Docker / VPS)
    ├── docker compose up --build -d
    └── Lub ręczne wdrożenie na VPS
```

---

## 4. ROZWIĄZYWANIE PROBLEMÓW

### 4.1 `npm install` / `npm ci` się nie udaje

| Objaw | Prawdopodobna przyczyna | Rozwiązanie |
|-------|------------------------|-------------|
| `ERR! code EINTEGRITY` | Uszkodzony package-lock.json | Usuń `node_modules` i `package-lock.json`, uruchom `npm install --no-audit --no-fund` |
| `ERR! code ENOENT` | Brak pliku | Sprawdź czy `package.json` istnieje. Uruchom w katalogu projektu. |
| Sieciowy timeout | Brak internetu / firewall | Sprawdź połączenie. Spróbuj `npm install --prefer-offline`. |
| `ERR! cb() never called` | Uszkodzony cache npm | `npm cache clean --force` → `npm install` |
| Błąd kompilacji (node-gyp) | Brak build tools | Dla Windows: `npm install --vs2015 --global windows-build-tools`. Dla Linux: `apt install build-essential`. |

### 4.2 `prisma generate` się nie udaje

| Objaw | Prawdopodobna przyczyna | Rozwiązanie |
|-------|------------------------|-------------|
| `Error: Can't find schema.prisma` | Brak pliku schematu | Sprawdź czy `prisma/schema.prisma` istnieje. |
| `Error: EACCES` | Brak uprawnień do katalogu `generated/` | Uruchom jako administrator (Windows) lub `sudo` (Linux). |
| `Error: ENOSPC` | Brak miejsca na dysku | Zwolnij miejsce (npm cache, node_modules, backupi). |
| `Error: spawn prisma ENOENT` | Prisma nie zainstalowana | `npm install prisma --save-dev` |

### 4.3 Port 3000 zajęty

| Objaw | Prawdopodobna przyczyna | Rozwiązanie |
|-------|------------------------|-------------|
| `[UWAGA] Port 3000 uzywany przez PID X` | Inna aplikacja (lub stary proces) używa portu | W `dev.bat` / `prod.bat`: wpisz `T` (Tak) by zabić proces. Ręcznie: `netstat -ano \| findstr :3000` → znajdź PID → `taskkill /PID <PID> /F` |
| `EADDRINUSE` przy starcie | To samo | Zmień PORT w `.env` na inny (np. 3001). |

### 4.4 Aplikacja się nie uruchamia

| Objaw | Prawdopodobna przyczyna | Rozwiązanie |
|-------|------------------------|-------------|
| Pusta strona / błąd 500 | Brak `.env` | Sprawdź czy plik istnieje. Skopiuj `.env.example → .env`. |
| `Error:秘密` | Nieprawidłowa DATABASE_URL | Sprawdź `DATABASE_URL` w `.env`. Domyślnie: `file:../data/app_database.sqlite?connection_limit=1&busy_timeout=30000` |
| `Cannot find module '...'` | Brak `node_modules` | Uruchom `npm install` lub `install.bat`. |
| `sqllite: not such table` | Nie zrobiono migracji | `npx prisma db push --skip-generate` |
| 401 przy logowaniu | Złe hasło | Sprawdź `DEFAULT_ADMIN_PASSWORD` w `.env`. Jeśli konto istnieje, zmień hasło w bazie lub usuń konto by utworzyć nowe. |
| Komunikat o błędzie w `server.log` | Błąd wewnętrzny | Otwórz plik `server.log` lub `server-err.log` w katalogu projektu. |

### 4.5 Seed się nie udaje (przy pierwszej instalacji)

| Objaw | Prawdopodobna przyczyna | Rozwiązanie |
|-------|------------------------|-------------|
| Seed nie wykonany (cichy fail) | `install.bat` nie pokazuje błędu seed (przekierowanie `>nul 2>nul`) | Uruchom ręcznie: `npx ts-node prisma/seed.ts` i zobacz błędy. |
| `Timeout` podczas seed | Zbyt dużo danych SQLite | `install.bat` już dzieli seed na paczki (25 na transakcję). Jeśli timeout: zwiększ `busy_timeout` w DATABASE_URL. |
| Brak produktów po instalacji | Seed pominięty | `npm run prisma:seed` ręcznie. |

### 4.6 Husky blokuje commita

| Objaw | Prawdopodobna przyczyna | Rozwiązanie |
|-------|------------------------|-------------|
| `commitlint` odrzuca | Zły format wiadomości | Użyj formatu: `typ(scope): opis` (np. `feat(rury): dodanie sortowania`) |
| Excel validator blokuje | Niezgodność z planem Excel | Napisz zgodny kod lub użyj obejścia: `git -c core.hooksPath=/dev/null commit -m "..."` |
| Testy / typecheck blokują push | Błędy w kodzie | Napraw błędy przed pushem. Użyj `npm run validate` lokalnie by sprawdzić. |

### 4.7 Docker nie działa

| Objaw | Prawdopodobna przyczyna | Rozwiązanie |
|-------|------------------------|-------------|
| `docker: command not found` | Brak Docker CLI | Zainstaluj Docker Desktop |
| Port 3000 już zajęty | Inny serwer | Zatrzymaj inny proces lub zmień mapowanie portów w `docker-compose.yml` (np. `'3001:10000'`) |
| Baza nie utworzona | Brak wolumenu | Sprawdź: `docker volume ls`. Jeśli brak: `docker compose down -v && docker compose up --build` |
| Healthcheck failing | Aplikacja nie startuje | `docker logs witros-oferty` zobacz błędy. |

### 4.8 Release się nie udaje

| Objaw | Prawdopodobna przyczyna | Rozwiązanie |
|-------|------------------------|-------------|
| `standard-version: command not found` | Brak zależności | `npm install` (standard-version jest devDependency) |
| `postbump` hook nie działa | Brak pliku `auto-cache-bust.mjs` | Sprawdź czy `scripts/auto-cache-bust.mjs` istnieje. |
| Git tag już istnieje | Release już zrobiony | `npm run release:patch` wymusi podbicie patch o 1. Możesz też użyć `--release-as patch --prerelease` |
| Niezgoda wersji | Ręczna edycja VERSION lub package.json | `npm run version:check` wskaże rozbieżności. Użyj `npm run release:patch` by zsynchronizować. |

### 4.9 Backup / Restore problemy

| Objaw | Prawdopodobna przyczyna | Rozwiązanie |
|-------|------------------------|-------------|
| `VACUUM INTO` error | Baza używana, SQLite locked | Zaczekaj. Zamknij inne procesy. Uruchom ponownie. |
| Brak backupów | Cron nie zainstalowany | Zainstaluj: `npm run backup:install-cron` jako Administrator. |
| Restore pyta ale nie robi | Kopiowanie nieudane | Sprawdź uprawnienia do pliku `data/app_database.sqlite`. Ręczne: `copy /Y data\backups\backup_*.sqlite data\app_database.sqlite` |

---

## 5. PODSUMOWANIE: MAPA AUTOMATYZACJI

```
                            ┌──────────────────┐
                            │  UŻYTKOWNIK (RĘCZNIE) │
                            │  - Node.js 20+       │
                            │  - git clone / ZIP   │
                            │  - .env + hasło      │
                            │  - wybór ścieżki     │
                            └────────┬─────────┘
                                     │ uruchamia
                                     ▼
                           ┌────────────────────┐
                           │   install.bat       │ ◄── automatyzacja
                           │  ┌─ node check      │
                           │  ├─ npm install     │
                           │  ├─ prisma generate │
                           │  ├─ migrate db      │
                           │  ├─ seed data       │
                           │  └─ typecheck       │
                           └────────┬───────────┘
                                    │ potem
                    ┌───────────────┼────────────────┐
                    ▼               ▼                 ▼
            ┌──────────┐   ┌─────────────┐   ┌─────────────────┐
            │ dev.bat  │   │  prod.bat   │   │ docker-compose   │
            │(hot-reload)│  │ (production)│   │ (konteneryzacja) │
            └──────────┘   └─────────────┘   └─────────────────┘
                                    │
                    ┌───────────────┼────────────────┐
                    ▼               ▼                 ▼
            ┌──────────┐   ┌─────────────┐   ┌─────────────────┐
            │npm run    │   │ npm run     │   │ Husky hooks     │
            │backup     │   │ release     │   │(pre-commit/push)│
            └──────────┘   └─────────────┘   └─────────────────┘
```

**Wszystkie skrypty startowe** (`dev.bat`, `prod.bat`, `start.bat`) są **idempotentne** — można je uruchomić wielokrotnie. Same uzupełnią brakujące elementy (`node_modules`, `generated/prisma`, migracje bazy).

---

## 6. SZYBKI CHEAT SHEET

| Sytuacja | Komenda / Akcja | Automatyczne? |
|----------|----------------|---------------|
| Nowa instalacja (Windows) | `.\install.bat` → `.\dev.bat` | Głównie TAK (poza Node.js + .env) |
| Nowa instalacja (Linux) | `bash install.sh` → `bash dev.sh` | Głównie TAK |
| Migracja bazy z innego PC | `.\install.bat` → `npm run backup:restore -- backup.sqlite` | Częściowo |
| Tylko uruchomienie (dev) | `.\dev.bat` | TAK (auto-naprawia braki) |
| Tylko uruchomienie (prod) | `.\prod.bat` | TAK |
| Backup ręczny | `npm run backup` | TAK |
| Backup automatyczny | `npm run backup:install-cron` (jako Admin) | Ręczna instalacja, potem auto |
| Przywrócenie backupu | `npm run backup:restore -- <plik>` | TAK (z potwierdzeniem) |
| Release nowej wersji | `npm run release:patch` → `git push --follow-tags` | TAK (bump + changelog + tag) |
| Docker | `docker compose up --build -d` | TAK (wewnątrz kontenera) |
| Deploy Docker | docker compose up --build -d | TAK (wewnątrz kontenera) |
