# WITROS Oferty PV — Generator ofert handlowych

**Wersja:** 1.4.0  
**Stack:** Express + Prisma + SQLite + VanillaJS SPA  
**Licencja:** ISC  
**Autor:** WITROS

---

## Opis

WITROS Oferty PV to aplikacja webowa do generowania ofert handlowych dla branży fotowoltaicznej, rur i studni. Umożliwia zarządzanie produktami, klientami, tworzenie ofert (zarówno dla rur jak i studni), generowanie dokumentów PDF/DOCX oraz monitorowanie zamówień.

Aplikacja działa jako **Single Page Application (SPA)** z backendem Express.js i bazą SQLite. Przeznaczona do wdrożenia na lokalnym serwerze, VPS lub platformie Render.com.

---

## Wymagania

- **Node.js** >= 20.0.0 (zgodnie z `package.json` i `.nvmrc`)
- **npm** (menedżer pakietów)
- **Git** (opcjonalnie, do klonowania repozytorium)

---

## Instalacja

```bash
# 1. Sklonuj repozytorium
git clone https://github.com/blodytrav3l3r/Oferty_PV.git
cd Oferty_PV

# 2. Zainstaluj zależności
npm install

# 3. Skopiuj i skonfiguruj zmienne środowiskowe
cp .env.example .env
# Edytuj .env — ustaw DEFAULT_ADMIN_PASSWORD (wymagane!)

# 4. Wygeneruj klienta Prisma
npx prisma generate

# 5. Uruchom migracje bazy danych
npx prisma migrate dev

# 6. Zasiej dane początkowe (produkty, cenniki)
npm run prisma:seed

# 7. Zbuduj projekt
npm run build
```

---

## Zmienne środowiskowe (.env)

| Zmienna                  | Opis                                               | Domyślnie                          | Wymagane |
| ------------------------ | -------------------------------------------------- | ---------------------------------- | -------- |
| `PORT`                   | Port serwera                                       | `10000`                            | Nie      |
| `HOST`                   | Adres nasłuchiwania                                | `0.0.0.0`                          | Nie      |
| `NODE_ENV`               | Środowisko: `development` / `production`           | `production`                       | Nie      |
| `DEFAULT_ADMIN_PASSWORD` | Hasło administratora (przy pierwszym uruchomieniu) | —                                  | **Tak**  |
| `DATABASE_URL`           | Ścieżka do bazy SQLite                             | `file:../data/app_database.sqlite` | Nie      |
| `SENTRY_DSN`             | DSN Sentry do monitorowania błędów (opcjonalnie)   | —                                  | Nie      |

---

## Komendy

### Podstawowe

| Komenda         | Opis                                                           |
| --------------- | -------------------------------------------------------------- |
| `npm run dev`   | Uruchom w trybie developerskim (backend + frontend równolegle) |
| `npm run build` | Zbuduj backend (TypeScript → JavaScript)                       |
| `npm start`     | Uruchom w trybie produkcyjnym (`node dist/server.js`)          |
| `npm test`      | Uruchom testy z pokryciem (Jest)                               |

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
| `npm run lint:frontend`  | ESLint dla frontendu    |

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

### Backup

| Komenda                         | Opis                              |
| ------------------------------- | --------------------------------- |
| `npm run backup`                | Wykonaj backup bazy SQLite        |
| `npm run backup:install-cron`   | Zainstaluj cron backupu (Windows) |
| `npm run backup:uninstall-cron` | Odinstaluj cron backupu (Windows) |

### Inne

| Komenda                | Opis                                      |
| ---------------------- | ----------------------------------------- |
| `npm run validate`     | Pełna walidacja: typecheck + lint + testy |
| `npm run format`       | Formatuj kod (Prettier)                   |
| `npm run format:check` | Sprawdź formatowanie                      |

---

## Uruchomienie

### Tryb developerski

```bash
npm run dev
```

Backend: `http://localhost:3000`  
Frontend: `http://localhost:5173` (Vite)

### Tryb produkcyjny

```bash
npm run build
npm start
```

Aplikacja: `http://localhost:10000`

### Docker

```bash
docker compose up --build
```

Aplikacja: `http://localhost:3000`

---

## Dokumentacja API

Po uruchomieniu serwera dokumentacja Swagger/OpenAPI dostępna jest pod adresem:

- **Swagger UI:** `/api/docs`
- **JSON spec:** `/api/docs.json`

---

## Contributing

Projekt używa prostego workflow — wszystko na `main`. Szczegóły w [CONTRIBUTING.md](CONTRIBUTING.md).

Zgłoszenia błędów i propozycje funkcji przyjmujemy przez [GitHub Issues](https://github.com/blodytrav3l3r/Oferty_PV/issues).

Dependabot aktualizuje zależności automatycznie — merguj PRy przez "Squash and merge".

---

## Security

Bezpieczeństwo projektu jest priorytetem. Jeśli znajdziesz podatność:

1. **Nie otwieraj publicznego issue** — zgłoś ją prywatnie
2. Wyślij szczegóły na **blodytrav3l3r@witros.pl** (odpowiedź w ciągu 48h)
3. Możesz też otworzyć [GitHub Advisory](https://github.com/blodytrav3l3r/Oferty_PV/security/advisories)

Pełna polityka bezpieczeństwa: [.github/SECURITY.md](.github/SECURITY.md)

Wspierane wersje: obecnie **v1.x** (najnowsza).

---

## Struktura projektu

```
Oferty_PV/
├── src/                    # Backend (TypeScript)
│   ├── middleware/         # Autoryzacja, bezpieczeństwo, rate limiting
│   ├── routes/            # Endpointy API (auth, produkty, oferty, zamówienia, klienci)
│   ├── services/          # Logika biznesowa (audyt, cenniki, PDF)
│   ├── utils/             # Narzędzia (logger, helpers)
│   ├── validators/        # Schematy walidacji Zod
│   └── types/             # Typy TypeScript
├── public/                # Frontend (Vanilla JS SPA)
│   ├── js/                # Skrypty JS
│   ├── css/               # Style CSS
│   └── *.html             # Widoki SPA
├── prisma/                # Schema + migracje Prisma
├── data/                  # Baza SQLite + pliki seed
├── scripts/               # Skrypty narzędziowe (backup, migracja, deploy)
├── tests/                 # Testy (Jest)
├── docs/                  # Dokumentacja
└── .github/workflows/     # CI/CD
```

---

## Licencja

ISC — szczegóły w pliku `package.json`.
