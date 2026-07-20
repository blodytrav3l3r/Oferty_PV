# WITROS Oferty PV — Generator ofert handlowych

**Wersja:** 1.5.0  
**Stack:** Express + Prisma + SQLite + VanillaJS SPA + ML Pipeline  
**Licencja:** Własnościowa — szczegóły w pliku [LICENSE](LICENSE)  
**Autor:** WITROS

---

## Opis

WITROS Oferty PV to aplikacja webowa do generowania ofert handlowych dla branży fotowoltaicznej, rur i studni. Umożliwia zarządzanie produktami, klientami, tworzenie ofert (zarówno dla rur jak i studni), generowanie dokumentów PDF/DOCX, monitorowanie zamówień oraz inteligentne rankowanie rozwiązań (ML).

Aplikacja działa jako **Single Page Application (SPA)** z backendem Express.js i bazą SQLite. Przeznaczona do wdrożenia na lokalnym serwerze, VPS lub platformie Render.com.

---

## Spis treści

- [Instalacja na nowym urządzeniu](#instalacja-na-nowym-urządzeniu)
- [Konfiguracja (.env)](#konfiguracja-env)
- [Uruchomienie](#uruchomienie)
- [Skrypty startowe (.bat)](#skrypty-startowe-bat)
- [Komendy](#komendy)
- [Struktura projektu](#struktura-projektu)
- [Dokumentacja](#dokumentacja)
- [Contributing](#contributing)
- [Security](#security)
- [Licencja](#licencja)

---

## Instalacja na nowym urządzeniu

### Wymagania wstępne

| Składnik | Wersja minimalna | Pobierz                                                        |
| -------- | ---------------- | -------------------------------------------------------------- |
| Node.js  | 20.0.0           | [https://nodejs.org](https://nodejs.org) (wersja LTS)          |
| npm      | 9+               | Instaluje się automatycznie z Node.js                          |
| Git      | dowolna          | [https://git-scm.com](https://git-scm.com) (opcjonalnie)       |
| Python   | 3.10+            | Tylko jeśli używasz silnika konfiguratora studni (opcjonalnie) |

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
2. Rozpakuj w docelowym folderze (np. `C:\WITROS_Oferty`)
3. Otwórz terminal w tym folderze

#### 2. Uruchom instalator (Windows)

```powershell
.\install.bat
```

Instalator automatycznie:

- Sprawdzi wersję Node.js
- Utworzy plik `.env` z `.env.example` (jeśli nie istnieje)
- Zainstaluje zależności (`npm install`)
- Wygeneruje klienta Prisma (`npx prisma generate`)
- Uruchomi migracje bazy danych (`npx prisma migrate dev`)
- Zasieje dane początkowe (`npm run prisma:seed`)

#### 3. Ręczna instalacja (alternatywa)

Jeśli `install.bat` nie działa lub używasz systemu innego niż Windows:

```powershell
# 1. Zainstaluj zależności
npm install

# 2. Skopiuj i skonfiguruj zmienne środowiskowe
# Edytuj .env — ustaw DEFAULT_ADMIN_PASSWORD (wymagane!)
copy .env.example .env

# 3. Wygeneruj klienta Prisma
npx prisma generate

# 4. Uruchom migracje bazy danych
npx prisma migrate dev

# 5. Zasiej dane początkowe (produkty, cenniki)
npm run prisma:seed

# 6. Zbuduj projekt (TypeScript → JavaScript)
npm run build
```

> **Jeśli przenosisz bazę z innej instalacji:** pomiń krok 5 (seed) i po zbudowaniu projektu przywróć bazę z backupu (patrz sekcja [Przenoszenie bazy cenników z istniejącej instalacji](#przenoszenie-bazy-cenników-z-istniejącej-instalacji)).

#### 4. Uruchom serwer

**Tryb developerski (z hot-reload):**

```powershell
.\dev.bat
```

**Tryb produkcyjny:**

```powershell
.\start.bat
```

Aplikacja będzie dostępna pod adresem: **http://localhost:10000**

#### 5. Pierwsze logowanie

1. Otwórz przeglądarkę i wejdź na **http://localhost:10000**
2. Zaloguj się jako:
    - **Użytkownik:** `admin`
    - **Hasło:** ustawione w `DEFAULT_ADMIN_PASSWORD` w pliku `.env`
3. Po zalogowaniu możesz zmienić hasło w ustawieniach profilu

### Instalacja na Linux / VPS

```bash
# 1. Zainstaluj Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git

# 2. Sklonuj repozytorium
git clone https://github.com/blodytrav3l3r/Oferty_PV.git
cd Oferty_PV

# 3. Instalacja
npm install
cp .env.example .env
nano .env  # ustaw DEFAULT_ADMIN_PASSWORD
npx prisma generate
npx prisma migrate dev

# 4. Baza danych — opcje:
#    a) Zasiej dane początkowe (nowa instalacja):
npm run prisma:seed
#    b) LUB przywróć bazę z backupu z innego urządzenia:
#       npm run backup:restore -- data/backups/backup_*.sqlite

# 5. Zbuduj projekt
npm run build

# 6. Uruchom (zalecane przez PM2)
npm install -g pm2
pm2 start dist/server.js --name witros-oferty
pm2 save
pm2 startup
```

Aplikacja: **http://TWOJ_ADRES_IP:10000**

### Instalacja przez Docker

```bash
docker compose up --build -d
```

Aplikacja: **http://localhost:3000**

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

3. **Na nowym urządzeniu** wykonaj standardową instalację (kroki 1–4 z sekcji wyżej) — bez seedowania:

    ```powershell
    .\install.bat
    ```

4. **Zatrzymaj serwer** (jeśli działa).

5. **Przywróć bazę z backupu**:
    ```powershell
    npm run backup:restore -- data/backups/backup_2026-07-14_*.sqlite
    ```
    lub ręcznie:
    ```powershell
    copy /Y data\backups\backup_2026-07-14_*.sqlite data\app_database.sqlite
    ```

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
    curl http://localhost:10000/health
    ```
3. Zaloguj się i zweryfikuj:
    - Lista produktów i ceny są zgodne z poprzednią instalacją
    - Historia ofert jest dostępna
    - Klienci są na swoich miejscach

---

## Konfiguracja (.env)

| Zmienna                  | Opis                                               | Domyślnie                          | Wymagane |
| ------------------------ | -------------------------------------------------- | ---------------------------------- | -------- |
| `PORT`                   | Port serwera                                       | `10000`                            | Nie      |
| `HOST`                   | Adres nasłuchiwania (`0.0.0.0` = z sieci)          | `0.0.0.0`                          | Nie      |
| `NODE_ENV`               | Środowisko: `development` / `production`           | `production`                       | Nie      |
| `DEFAULT_ADMIN_PASSWORD` | Hasło administratora (przy pierwszym uruchomieniu) | —                                  | **Tak**  |
| `DATABASE_URL`           | Ścieżka do bazy SQLite                             | `file:../data/app_database.sqlite` | Nie      |
| `SENTRY_DSN`             | DSN Sentry do monitorowania błędów (opcjonalnie)   | —                                  | Nie      |

> **Ważne:** `DEFAULT_ADMIN_PASSWORD` jest wymagane tylko przy **pierwszym** uruchomieniu. Po utworzeniu konta admina zmiana hasła w `.env` nie wpływa na istniejące konto.

---

## Uruchomienie

### Tryb developerski

```powershell
npm run dev
```

- Backend: `http://localhost:3000` (hot-reload)
- Frontend: `http://localhost:5173` (Vite dev server)

### Tryb produkcyjny

```powershell
npm run build
npm start
```

Aplikacja: `http://localhost:10000`

---

## Skrypty startowe (.bat)

Projekt zawiera wygodne skrypty dla systemu Windows:

| Skrypt        | Opis                                                                 |
| ------------- | -------------------------------------------------------------------- |
| `start.bat`   | Uruchamia serwer produkcyjny (`node dist/server.js`)                 |
| `dev.bat`     | Uruchamia serwer deweloperski z hot-reload                           |
| `build.bat`   | Buduje projekt (TypeScript + frontend)                               |
| `install.bat` | Instaluje wszystkie zależności i przygotowuje bazę danych            |
| `prod.bat`    | Uruchamia serwer produkcyjny z przekierowaniem portów (zaawansowane) |

---

## Komendy

### Podstawowe

| Komenda         | Opis                                                           |
| --------------- | -------------------------------------------------------------- |
| `npm run dev`   | Uruchom w trybie developerskim (backend + frontend równolegle) |
| `npm run build` | Zbuduj backend (TypeScript → JavaScript)                       |
| `npm start`     | Uruchom w trybie produkcyjnym (`node dist/server.js`)          |
| `npm test`      | Uruchom testy (Jest)                                           |

### Backend

| Komenda               | Opis                                       |
| --------------------- | ------------------------------------------ |
| `npm run dev:backend` | Uruchom backend z hot-reload (ts-node-dev) |
| `npm run typecheck`   | Sprawdź typy TypeScript                    |
| `npm run lint`        | ESLint dla backendu                        |
| `npm run lint:fix`    | ESLint z automatyczną naprawą              |

### Frontend

| Komenda                  | Opis                    |
| ------------------------ | ----------------------- |
| `npm run dev:frontend`   | Uruchom Vite dev server |
| `npm run build:frontend` | Zbuduj frontend (Vite)  |

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
| `npm run backup:restore`        | Przywróć bazę z pliku backupu     |
| `npm run backup:install-cron`   | Zainstaluj cron backupu (Windows) |
| `npm run backup:uninstall-cron` | Odinstaluj cron backupu (Windows) |

### Inne

| Komenda                | Opis                                      |
| ---------------------- | ----------------------------------------- |
| `npm run validate`     | Pełna walidacja: typecheck + lint + testy |
| `npm run format`       | Formatuj kod (Prettier)                   |
| `npm run format:check` | Sprawdź formatowanie                      |
| `npm run release`      | Utwórz release (nowa wersja + changelog)  |

---

## Struktura projektu

```
Oferty_PV/
├── server.ts                  # Entry point Express
├── src/                       # Backend (TypeScript)
│   ├── routes/                # Endpointy API (auth, produkty, oferty, zamówienia, klienci, telemetry)
│   │   ├── offers/            # CRUD ofert (rury + studnie)
│   │   ├── orders/            # Zamówienia, zlecenia
│   │   └── telemetryAiMl.ts   # Endpointy ML (predict, reward, train, rollback)
│   ├── services/              # Logika biznesowa
│   │   ├── ml/                # AI/ML Pipeline (7 plików: FeatureExtractor, AcceptanceModel, itp.)
│   │   ├── pdfGenerator.ts    # Generowanie PDF (Puppeteer)
│   │   ├── docx/              # Generowanie MS Word
│   │   └── auditService.ts    # Service audytu
│   ├── middleware/            # Autoryzacja, bezpieczeństwo, rate limiting
│   ├── validators/            # Schematy walidacji Zod
│   ├── utils/                 # Narzędzia (logger, helpers)
│   └── types/                 # Typy TypeScript
├── public/                    # Frontend (Vanilla JS SPA)
│   ├── app.html               # Shell SPA (jedyny entry point)
│   ├── studnie.html           # Moduł studnie (iframe)
│   ├── rury.html              # Moduł rury (iframe)
│   ├── js/                    # Skrypty JS
│   │   ├── shared/            # auth, ui, icons, clientManager, dashboard
│   │   ├── studnie/           # WellManager, solver, ruleEngine, ML hooks
│   │   ├── rury/              # OfferItems, offerSummary, PEHD
│   │   ├── sales/             # PV marketplace, kartoteka, import/export
│   │   └── spa/               # Router SPA
│   ├── css/                   # Style CSS
│   └── templates/             # Szablony do druku
├── prisma/                    # Schema + migracje Prisma
│   └── schema.prisma
├── data/                      # Baza SQLite + pliki seed
├── tests/                     # Testy (Jest)
│   ├── ml/                    # Testy pipeline'u ML
│   ├── studnie/               # Testy modułu studnie
│   └── ...
├── docs/                      # Dokumentacja
│   ├── adr/                   # Decyzje architektoniczne
│   ├── import-export/         # Dokumentacja modułu import/eksport
│   └── ...
├── scripts/                   # Skrypty narzędziowe (backup, migracja)
├── # well_configurator_backend/ — usunięty
├── .github/                   # CODE_OF_CONDUCT, CI/CD
├── *.bat                      # Skrypty startowe Windows
├── Dockerfile                 # Obraz Docker
├── docker-compose.yml         # Orkiestracja Docker
└── render.yaml                # Konfiguracja Render.com
```

---

## Dokumentacja API

Po uruchomieniu serwera dokumentacja Swagger/OpenAPI dostępna jest pod adresem:

- **Swagger UI:** `/api/docs`
- **JSON spec:** `/api/docs.json`

---

## AI/ML Pipeline (wersja 1.5.0+)

System zawiera zintegrowany pipeline uczenia maszynowego do rankowania rozwiązań:

- **Model:** Logistic Regression w czystym TypeScript (bez zależności zewnętrznych)
- **Dual-ranking:** `Final = 0.6 × Technical + 0.4 × AI × 100` z 5% exploracją
- **Trenowanie:** Cron co 15 minut (`TrainingPipeline`)
- **Samoocena:** Cron co 24h (`SelfEvaluation`)
- **Forgetting curve:** Wykładniczy zanik λ=0.01 (~69 dni półtrwania dla nieużywanych danych)
- **Auto-rollback:** Gdy ROC-AUC < 0.65
- **Endpointy:** `/api/ml/predict`, `/api/ml/reward`, `/api/ml/status`, `/api/ml/models`, `/api/ml/train`, `/api/ml/rollback`

---

## Contributing

Projekt używa prostego workflow — wszystko na `main`. Szczegóły w [CONTRIBUTING.md](CONTRIBUTING.md).

Zgłoszenia błędów i propozycje funkcji przyjmujemy przez [GitHub Issues](https://github.com/blodytrav3l3r/Oferty_PV/issues).

---

## Security

Bezpieczeństwo projektu jest priorytetem. Jeśli znajdziesz podatność:

1. **Nie otwieraj publicznego issue** — zgłoś ją prywatnie
2. Wyślij szczegóły na **blodytrav3l3r@gmail.com** (odpowiedź w ciągu 48h)
3. Możesz też otworzyć [GitHub Advisory](https://github.com/blodytrav3l3r/Oferty_PV/security/advisories)

Pełna polityka bezpieczeństwa: [docs/SECURITY.md](docs/SECURITY.md)

---

## Licencja

Własnościowa — szczegóły w pliku [LICENSE](LICENSE).

Komercyjne wykorzystanie wymaga pisemnej zgody Autora.
Zobacz [LICENSE](LICENSE) albo skontaktuj się przez blodytrav3l3r@gmail.com.
