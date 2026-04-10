# WITROS Oferty - Generator Ofert Handlowych

Aplikacja do generowania ofert handlowych dla systemów PV (fotowoltaika) i studni.

## 🚀 Technologie

- **Backend:** Node.js + Express + TypeScript
- **Baza danych:** SQLite + Prisma ORM
- **Frontend:** HTML + CSS + JavaScript (vanilla)
- **Testy:** Jest + Supertest

## 📦 Instalacja

```bash
npm install
npx prisma generate
```

## 🏃 Uruchomienie

### Development (z hot reload)
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

### Windows (batch)
```bash
start_node.bat          # Tylko Node.js
start_all.bat           # Node.js + Python AI Backend
```

## 🧪 Testy

```bash
npm test              # Uruchomienie testów
npm run test:watch    # Testy w trybie watch
npm run test -- --coverage  # Testy z coverage
```

## 📚 Skrypty

| Komenda | Opis |
|---------|------|
| `npm run dev` | Development server z hot reload |
| `npm run build` | Kompilacja TypeScript |
| `npm run build:watch` | Kompilacja w trybie watch |
| `npm start` | Uruchomienie serwera produkcyjnego |
| `npm test` | Uruchomienie testów |
| `npm run test:watch` | Testy w trybie watch |
| `npm run lint` | Linting kodu |
| `npm run lint:fix` | Automatyczne naprawianie błędów ESLint |
| `npm run format` | Formatowanie kodu Prettier |
| `npm run backup` | Backup bazy danych |
| `npm run prisma:generate` | Generowanie Prisma Client |
| `npm run prisma:migrate` | Migracja bazy danych |
| `npm run prisma:studio` | GUI do przeglądania bazy danych |

## 📁 Struktura projektu

```
Oferty_PV/
│
├── 📄 KONFIGURACJA
│   ├── package.json             # Zależności i skrypty
│   ├── tsconfig.json            # Konfiguracja TypeScript
│   ├── jest.config.ts           # Konfiguracja Jest
│   ├── .env.example             # Przykład zmiennych środowiskowych
│   ├── .gitignore               # Ignorowane pliki
│   ├── .eslintrc.js             # ESLint config
│   ├── .prettierrc              # Prettier config
│   ├── docker-compose.yml       # Docker Compose
│   └── Dockerfile               # Docker image
│
├── 📄 DOKUMENTACJA
│   ├── README.md                # Ten plik
│   ├── CHANGELOG.md             # Historia zmian
│   └── assets/INSTRUKCJA_SERWER.md  # Instrukcja serwera
│
├── 🚀 SERWER (TypeScript)
│   ├── server.ts                # Entry point - serwer Express
│   └── src/
│       ├── prismaClient.ts      # Klient Prisma ORM
│       ├── helpers.ts           # Funkcje pomocnicze
│       ├── db.ts                # Funkcje audytu i diff
│       ├── middleware/          # Express middleware
│       │   ├── auth.ts          # Autoryzacja i sesje
│       │   ├── security.ts      # Nagłówki bezpieczeństwa
│       │   └── rateLimiter.ts   # Ograniczanie żądań
│       ├── routes/              # Endpointy API
│       │   ├── auth.ts          # Logowanie, rejestracja
│       │   ├── users.ts         # Zarządzanie użytkownikami
│       │   ├── products.ts      # Produkty - rury
│       │   ├── productsStudnie.ts   # Produkty - studnie
│       │   ├── productsStudnieAuto.ts # Auto-select studnie
│       │   ├── offers.ts        # Oferty (rury + studnie)
│       │   ├── orders.ts        # Zamówienia i zlecenia
│       │   ├── clients.ts       # Klienci
│       │   ├── pv_marketplace.ts    # Rynek PV
│       │   ├── audit.ts         # Logi audytowe
│       │   ├── settings.ts      # Ustawienia systemu
│       │   └── telemetry.ts     # Telemetria AI
│       └── services/            # Logika biznesowa
│           └── antygrawity.ts   # Serwis antygrawitacyjny
│
├── 🗄️ BAZA DANYCH
│   ├── prisma/schema.prisma     # Schema Prisma ORM
│   ├── data/                    # Pliki SQLite
│   │   └── app_database.sqlite  # Główna baza danych
│   └── generated/prisma/        # Auto-generated Prisma Client
│
├── 🌐 FRONTEND
│   └── public/
│       ├── index.html           # Strona logowania
│       ├── app.html             # SPA App (iframe-based)
│       ├── studnie.html         # Moduł studnie (iframe)
│       ├── rury.html            # Moduł rury (iframe)
│       ├── kartoteka.html       # Kartoteka ofert (iframe)
│       ├── zlecenia.html        # Kartoteka zleceń (iframe)
│       ├── css/
│       │   ├── index.css        # Style strony logowania
│       │   ├── spa.css          # Style SPA
│       │   └── style.css        # Style główne
│       ├── js/
│       │   ├── shared/          # Wspólne moduły
│       │   │   ├── auth.js      # Autoryzacja
│       │   │   ├── formatters.js    # Formatery
│       │   │   └── ui.js        # Komponenty UI
│       │   ├── spa/             # SPA Router
│       │   │   └── router.js    # Router iframe-based
│       │   ├── studnie/         # Moduł studnie
│       │   └── pv/              # Moduł PV
│       └── templates/           # Szablony HTML do druku
│           ├── etykieta.html    # Etykieta produktu
│           ├── oferta_studnie.html  # Oferta studni
│           └── zlecenie.html    # Zlecenie produkcyjne
│
├── 🧪 TESTY
│   └── tests/
│       ├── setup.ts             # Setup testów
│       ├── auth.test.ts         # Testy autoryzacji
│       ├── health.test.ts       # Testy health check
│       ├── products.test.ts     # Testy produktów
│       ├── users.test.ts        # Testy użytkowników
│       └── offers.test.ts       # Testy ofert
│
├── 🛠️ SKRYPTY
│   └── scripts/
│       └── backup.ts            # Backup bazy danych
│
├── 📦 BUILD OUTPUT
│   └── dist/                    # Skompilowany JavaScript
│
├── 🐍 AI BACKEND (osobny projekt)
│   └── well_configurator_backend/  # Python + OR-Tools
│       ├── optimizer/           # Optymalizacja CP-SAT
│       ├── ml/                  # Machine Learning (ranker)
│       ├── database/            # Baza Python
│       └── api/                 # API Python
│
└── 📂 INNE
    ├── assets/                  # Pliki Excel (tabele, przejścia)
    ├── 1 Pliki przykładowe/     # Przykładowe pliki
    └── local_catalog.db         # Baza Python backend
```

## 🔐 Autoryzacja

API wymaga autoryzacji przez sesje. Endpoint `/api/auth/login` służy do logowania.

## 🤖 Python AI Backend

Projekt zawiera również backend AI (`well_configurator_backend/`) napisany w Pythonie, który obsługuje:
- Konfigurację studni
- Optymalizację parametrów
- Generowanie konfiguracji produktów

### Uruchomienie AI Backend:
```bash
cd well_configurator_backend
pip install -r requirements.txt
python run.py
```

Lub użyj `start_all.bat` aby uruchomić oba serwery jednocześnie.

## 🗄️ Baza danych

Modele w Prisma:
- `users` - Użytkownicy systemu
- `sessions` - Sesje użytkowników
- `settings` - Ustawienia systemu (litera roku obrotowego)
- `offers_rel` - Oferty rur
- `offer_items_rel` - Pozycje ofert rur
- `offers_studnie_rel` - Oferty studni
- `offer_studnie_items_rel` - Pozycje ofert studni
- `clients_rel` - Klienci
- `orders_studnie_rel` - Zamówienia studni
- `production_orders_rel` - Zlecenia produkcyjne
- `products_rury_rel` - Produkty - rury
- `products_studnie_rel` - Produkty - studnie
- `order_counters` - Liczniki zamówień
- `production_order_counters` - Liczniki zleceń produkcyjnych
- `recycled_production_numbers` - Recykling numerów produkcyjnych
- `audit_logs` - Logi audytowe
- `ai_telemetry_logs` - Logi telemetryczne AI

## 📝 CHANGELOG

### v2.1.0 (2026-04-06)
- ✅ Eksport ofert do PDF (puppeteer)
- ✅ Eksport ofert do Word (.docx)
- ✅ Rozbudowane style do druku (@media print)
- ✅ Nowe zależności: puppeteer, docx
- ✅ Naprawa Python AI Backend (requests)

### v2.0.0 (2026-04-06)
- ✅ Migracja na TypeScript
- ✅ Prisma ORM zamiast better-sqlite3
- ✅ Nowa struktura projektu
- ✅ Testy w TypeScript
- ✅ Hot reload z ts-node-dev

### v1.0.0
- Pierwsza wersja z JavaScript i SQLite
