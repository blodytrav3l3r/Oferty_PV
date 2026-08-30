# Tech Stack — stos technologiczny

**Wersja:** 1.20.0  
**Ostatnia aktualizacja:** 2026-08-24

## Licencje — podsumowanie

> Źródło prawdy: `THIRD-PARTY-NOTICES.md` w root projektu (generowany automatycznie przez `npm run licenses:generate` z `package-lock.json`).

| Licencja                | Liczba pakietów | Komercyjne użycie | Sprzedaż produktu |    Attribution     |
| ----------------------- | :-------------: | :---------------: | :---------------: | :----------------: |
| MIT                     |       965       |      ✅ tak       |      ✅ tak       |    ✅ wymagane     |
| ISC                     |       100       |      ✅ tak       |      ✅ tak       |    ✅ wymagane     |
| Apache-2.0              |       63        |      ✅ tak       |      ✅ tak       |    ✅ wymagane     |
| BSD-3-Clause            |       20        |      ✅ tak       |      ✅ tak       |    ✅ wymagane     |
| BSD-2-Clause            |       20        |      ✅ tak       |      ✅ tak       |    ✅ wymagane     |
| BlueOak-1.0.0           |       16        |      ✅ tak       |      ✅ tak       |    ✅ wymagane     |
| MIT OR CC0-1.0          |       14        |      ✅ tak       |      ✅ tak       |    ✅ wymagane     |
| MPL-2.0                 |        2        |   ⚠ file-level    |      ✅ tak       |    ✅ wymagane     |
| MIT-0                   |        1        |      ✅ tak       |      ✅ tak       |         —          |
| Python-2.0              |        1        |      ✅ tak       |      ✅ tak       |         —          |
| CC-BY-4.0               |        1        |      ✅ tak       |      ✅ tak       |    ✅ wymagane     |
| BSD                     |        1        |      ✅ tak       |      ✅ tak       |    ✅ wymagane     |
| MIT OR Apache-2.0       |        1        |      ✅ tak       |      ✅ tak       |    ✅ wymagane     |
| MIT OR GPL-3.0-or-later |        1        |    ⚠ wybór MIT    |    ⚠ wybór MIT    | ⚠ zależy od wyboru |
| MIT AND Zlib            |        1        |      ✅ tak       |      ✅ tak       |    ✅ wymagane     |
| CC-BY-3.0               |        1        |      ✅ tak       |      ✅ tak       |    ✅ wymagane     |
| CC0-1.0                 |        1        |      ✅ tak       |      ✅ tak       |         —          |
| 0BSD                    |        1        |      ✅ tak       |      ✅ tak       |         —          |

**Brak czystych licencji GPL, AGPL, LGPL copyleft** — wszystkie zależności są bezpieczne komercyjnie. Jedyny wyjątek to `jszip@3.10.1` z dual-license `MIT OR GPL-3.0-or-later` — wybór licencji należy do dewelopera; przy wyborze MIT nie ma obowiązków copyleft.

---

## Główne technologie

| Technologia      | Wersja   | Licencja      | Zastosowanie              | Link                                                       | Komercyjnie |
| ---------------- | -------- | ------------- | ------------------------- | ---------------------------------------------------------- | :---------: |
| Node.js          | ≥22.13   | MIT           | Środowisko uruchomieniowe | https://nodejs.org                                         |     ✅      |
| TypeScript       | ^6.0.2   | Apache-2.0    | Język programowania       | https://typescriptlang.org                                 |     ✅      |
| Express          | ^4.22.2  | MIT           | Framework backend         | https://expressjs.com                                      |     ✅      |
| Prisma           | ^6.0.0   | Apache-2.0    | ORM / baza danych         | https://prisma.io                                          |     ✅      |
| SQLite           | —        | Public Domain | Baza danych               | https://sqlite.org                                         |     ✅      |
| Jest             | ^30.3.0  | MIT           | Testy                     | https://jestjs.io                                          |     ✅      |
| Puppeteer        | ^24.43.1 | Apache-2.0    | Generowanie PDF           | https://pptr.dev                                           |     ✅      |
| Sentry           | ^10.59.0 | MIT           | Monitoring błędów         | https://sentry.io                                          |     ✅      |
| Swagger          | ^6.3.0   | Apache-2.0    | Dokumentacja API          | https://swagger.io                                         |     ✅      |
| docx (npm)       | ^9.6.1   | MIT           | Generowanie DOCX          | https://docx.js.org                                        |     ✅      |
| Helmet           | ^8.1.0   | MIT           | Bezpieczeństwo HTTP       | https://helmetjs.github.io                                 |     ✅      |
| Zod              | ^4.3.6   | MIT           | Walidacja danych          | https://zod.dev                                            |     ✅      |
| ESLint           | ^10.8.1  | MIT           | Linter                    | https://eslint.org                                         |     ✅      |
| Prettier         | ^3.9.4   | MIT           | Formatter kodu            | https://prettier.io                                        |     ✅      |
| Husky            | ^9.1.7   | MIT           | Git hooks                 | https://typicode.github.io/husky                           |     ✅      |
| commitlint       | ^21.1.0  | MIT           | Walidacja commitów        | https://commitlint.js.org                                  |     ✅      |
| standard-version | ^9.5.0   | ISC           | Auto-wersjonowanie        | https://github.com/conventional-changelog/standard-version |     ✅      |
| esbuild          | ^0.28.2  | MIT           | Bundling JS               | https://esbuild.github.io                                  |     ✅      |
| Playwright       | ^1.62.1  | Apache-2.0    | E2E / a11y                | https://playwright.dev                                     |     ✅      |

## Narzędzia CI/CD

| Narzędzie      | Licencja                 | Zastosowanie            | Komercyjnie |
| -------------- | ------------------------ | ----------------------- | :---------: |
| GitHub Actions | darmowe dla public repos | CI/CD pipeline          |     ✅      |
| Docker         | Apache-2.0               | Konteneryzacja          |     ✅      |
| Codecov        | MIT (action)             | Raporty pokrycia testów |     ✅      |

## Podsumowanie zgodności komercyjnej

**Wniosek**: Wszystkie technologie użyte w projekcie **mogą być używane komercyjnie** i **pozwalają na sprzedaż produktu**. Jedyny wymóg to zachowanie informacji o licencji (attribution) w dystrybucji — standardowe dla MIT/Apache/ISC/BSD.

> ⚠ MPL-2.0 (2 pakiety): wymaga opensourczenia modyfikacji danego pliku, ale nie wpływa na całość produktu. Dotyczy pakietów niskiego poziomu, nie modyfikowanych bezpośrednio.

## Telemetria AI — deduplikacja

Telemetria AI deduplikuje identyczne zapisy konfiguracji studni, żeby nie zawyżać
hitCount/confidence wzorców i nie mnożyć próbek treningowych ML:

- **Backend** (`src/services/telemetry/telemetryService.ts`): dla źródła `AUTO_JS`
  `recordConfig` porównuje kanoniczny `featureSnapshot` + posortowane `allComponentIds`
  (`_dedupKey`) i przy identycznym wpisie robi `update` (lastUsedAt/usageCount/kontekst
  oferty) zamiast `create`. Wspierane indeksami `idx_logs_well` / `idx_logs_source_well`.
- **Frontend** (`public/js/studnie/telemetryBridge.js`, `public/js/studnie/offerSave.js`):
  sesyjna mapa dedup (fingerprint treści + wyceny studni) oraz wysyłka tylko zmienionych
  studni przy zapisie oferty.

Szczegóły: [ARCHITECTURE.md](ARCHITECTURE.md)
