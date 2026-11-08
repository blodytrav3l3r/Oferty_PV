# Tech Stack — stos technologiczny

**Wersja:** 1.56.8  
**Ostatnia aktualizacja:** 2026-11-05

## Licencje — podsumowanie

> Źródło prawdy: [`THIRD-PARTY-NOTICES.md`](../THIRD-PARTY-NOTICES.md) w root projektu,
> generowany przez `npm run licenses:generate` z `package-lock.json` oraz zasobów
> `public/`. Ten dokument nie powtarza liczb pakietów — liczy je generator.

Podział zakresów:

- **Produkcyjne** — trafiają do obrazu Docker i artefaktu wdrożenia; wymagają zachowania
  not i tekstów licencji.
- **Deweloperskie/testowe** — tylko lokalnie i w CI; nie są przedmiotem dystrybucji.
- **Vendored** — SheetJS (`public/vendor/xlsx.full.min.js`), font Inter
  (`public/css/fonts/`) i subset ikon Lucide (`public/js/shared/iconsSlim.js`);
  teksty licencji w `public/licenses/`.

| Rodzaj                  | Licencje obecne w drzewie                                        | Wymóg przy dystrybucji                                            |
| ----------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------- |
| Permisywne              | MIT, ISC, BSD-2/3-Clause, BSD, MIT-0, 0BSD, BlueOak-1.0.0        | Zachowaj notę i tekst licencji (MIT-0, 0BSD, BlueOak — bez noty). |
| Permisywne z NOTICE     | Apache-2.0                                                       | Tekst licencji + `NOTICE`, jeśli pakiet go zawiera.               |
| Dualne — wybór licencji | `MIT OR CC0-1.0`, `MIT OR Apache-2.0`, `MIT OR GPL-3.0-or-later` | Projekt korzysta ze ścieżki MIT; bez obowiązków copyleft.         |
| Złożone                 | `MIT AND Zlib`                                                   | Spełnij oba warunki (nota MIT i nota Zlib).                       |
| Słabe copyleft          | MPL-2.0                                                          | Dotyczy tylko zmodyfikowanych plików MPL; obecnie wyłącznie dev.  |
| Treści / dane           | CC-BY-3.0, CC-BY-4.0                                             | Podaj autora i źródło.                                            |
| Domena publiczna        | CC0-1.0                                                          | Brak obowiązku atrybucji.                                         |

**Brak licencji GPL, AGPL i LGPL w pakietach produkcyjnych.** Jedyny wyjątek to
`jszip` z dual-license `MIT OR GPL-3.0-or-later` — projekt korzysta ze ścieżki MIT.
MPL-2.0 dotyczy wyłącznie `@axe-core/playwright` i `axe-core` (dev), które nie trafiają
do artefaktu runtime.

Szczegóły, pełna lista pakietów `[prod]`/`[dev]`, status plików NOTICE i pakiety bez
pliku `LICENSE` w dystrybucji: [`THIRD-PARTY-NOTICES.md`](../THIRD-PARTY-NOTICES.md).

---

## Główne technologie

| Technologia        | Wersja   | Licencja           | Zastosowanie                               | Link                                                        | Komercyjnie |
| ------------------ | -------- | ------------------ | ------------------------------------------ | ----------------------------------------------------------- | :---------: |
| Node.js            | ≥22.13   | MIT                | Środowisko uruchomieniowe                  | https://nodejs.org                                          |     ✅      |
| TypeScript         | ^6.0.2   | Apache-2.0         | Język programowania                        | https://typescriptlang.org                                  |     ✅      |
| Express            | ^4.22.3  | MIT                | Framework backend                          | https://expressjs.com                                       |     ✅      |
| Prisma             | 7.10.1   | Apache-2.0         | ORM / baza danych                          | https://prisma.io                                           |     ✅      |
| PostgreSQL         | 18.x     | PostgreSQL License | Jedyny runtime i provider testów aplikacji | https://www.postgresql.org                                  |     ✅      |
| Jest               | 30.4.2   | MIT                | Testy                                      | https://jestjs.io                                           |     ✅      |
| Puppeteer          | ^25.16.0 | Apache-2.0         | Generowanie PDF                            | https://pptr.dev                                            |     ✅      |
| Sentry             | ^10.59.0 | MIT                | Monitoring błędów                          | https://sentry.io                                           |     ✅      |
| swagger-jsdoc      | ^6.3.0   | MIT                | Dokumentacja API                           | https://swagger.io                                          |     ✅      |
| docx (npm)         | ^9.6.1   | MIT                | Generowanie DOCX                           | https://docx.js.org                                         |     ✅      |
| Helmet             | ^8.3.0   | MIT                | Bezpieczeństwo HTTP                        | https://helmetjs.github.io                                  |     ✅      |
| bcryptjs           | ^3.0.3   | BSD-3-Clause       | Haszowanie haseł                           | https://github.com/dcodeIO/bcrypt.js                        |     ✅      |
| compression        | ^1.8.2   | MIT                | Kompresja HTTP                             | https://expressjs.com/en/resources/middleware/compression   |     ✅      |
| cookie-parser      | ^1.4.7   | MIT                | Ciastka sesji                              | https://expressjs.com/en/resources/middleware/cookie-parser |     ✅      |
| dotenv             | ^17.4.1  | BSD-2-Clause       | Zmienne .env                               | https://github.com/motdotla/dotenv                          |     ✅      |
| swagger-ui-express | ^5.0.1   | MIT                | UI dokumentacji API                        | https://swagger.io                                          |     ✅      |
| Zod                | ^4.3.6   | MIT                | Walidacja danych                           | https://zod.dev                                             |     ✅      |
| ESLint             | ^10.8.1  | MIT                | Linter                                     | https://eslint.org                                          |     ✅      |
| Prettier           | ^3.9.4   | MIT                | Formatter kodu                             | https://prettier.io                                         |     ✅      |
| Husky              | ^9.1.7   | MIT                | Git hooks                                  | https://typicode.github.io/husky                            |     ✅      |
| commitlint         | ^21.2.3  | MIT                | Walidacja commitów                         | https://commitlint.js.org                                   |     ✅      |
| standard-version   | ^9.5.0   | ISC                | Auto-wersjonowanie                         | https://github.com/conventional-changelog/standard-version  |     ✅      |
| esbuild            | ^0.28.2  | MIT                | Bundling JS                                | https://esbuild.github.io                                   |     ✅      |
| Playwright         | ^1.62.1  | Apache-2.0         | E2E / a11y                                 | https://playwright.dev                                      |     ✅      |

PostgreSQL 18 jest jedynym wspieranym silnikiem runtime, testów i instalatorów.
Świeże instalacje importują aktywne cenniki z wersjonowanego pakietu S.O.K.
Lokalna walidacja PostgreSQL 18 jest zakończona; ograniczenia produkcyjnego rollout’u i Linux opisuje
[DEPLOYMENT.md](DEPLOYMENT.md).

## Zasoby frontendowe (vendored)

| Zasób                      | Wersja / zakres             | Licencja            | Plik licencji w repo              |
| -------------------------- | --------------------------- | ------------------- | --------------------------------- |
| SheetJS Community Edition  | `xlsx.full.min.js` (0.20.3) | Apache-2.0          | `public/licenses/APACHE-2.0.txt`  |
| Inter (font, subset woff2) | wagi 300–900, 7 plików      | SIL OFL 1.1         | `public/licenses/SIL-OFL-1.1.txt` |
| Lucide (subset ikon SVG)   | `iconsSlim.js`              | ISC + MIT (Feather) | `public/licenses/ISC-Lucide.txt`  |

## Narzędzia CI/CD

| Narzędzie      | Licencja                 | Zastosowanie   | Komercyjnie |
| -------------- | ------------------------ | -------------- | :---------: |
| GitHub Actions | darmowe dla public repos | CI/CD pipeline |     ✅      |
| Docker         | Apache-2.0               | Konteneryzacja |     ✅      |

## Podsumowanie zgodności komercyjnej

**Wniosek**: Wszystkie technologie użyte w projekcie **mogą być używane komercyjnie** i
**pozwalają na sprzedaż produktu**. Wymóg to zachowanie informacji o licencji
(attribution) w dystrybucji — standardowe dla MIT/Apache/ISC/BSD.

> ⚠ MPL-2.0 (2 pakiety, wyłącznie dev): wymaga udostępnienia źródła zmodyfikowanych
> plików MPL, ale nie wpływa na całość produktu. Pakiety nie są modyfikowane.

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
