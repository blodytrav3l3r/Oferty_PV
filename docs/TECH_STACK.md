# Tech Stack — stos technologiczny

**Ostatnia aktualizacja:** 2026-07-22

## Licencje — podsumowanie

| Licencja      | Liczba pakietów | Komercyjne użycie | Sprzedaż produktu |               Attribution                |
| ------------- | :-------------: | :---------------: | :---------------: | :--------------------------------------: |
| MIT           |       618       |      ✅ tak       |      ✅ tak       |               ✅ wymagane                |
| Apache-2.0    |       57        |      ✅ tak       |      ✅ tak       |               ✅ wymagane                |
| ISC           |       51        |      ✅ tak       |      ✅ tak       |               ✅ wymagane                |
| BSD-3-Clause  |       21        |      ✅ tak       |      ✅ tak       |               ✅ wymagane                |
| BSD-2-Clause  |       12        |      ✅ tak       |      ✅ tak       |               ✅ wymagane                |
| BlueOak-1.0.0 |       11        |      ✅ tak       |      ✅ tak       |               ✅ wymagane                |
| MPL-2.0       |        2        |      ✅ tak       |      ✅ tak       | ⚠ modyfikacje pliku muszą być opensource |
| CC-BY-4.0     |        1        |      ✅ tak       |      ✅ tak       |               ✅ wymagane                |
| Python-2.0    |        1        |      ✅ tak       |      ✅ tak       |                    —                     |
| 0BSD          |        1        |      ✅ tak       |      ✅ tak       |                    —                     |

**Brak licencji GPL, AGPL, LGPL copyleft** — wszystkie zależności są bezpieczne komercyjnie.

---

## Główne technologie

| Technologia      | Wersja   | Licencja      | Zastosowanie              | Link                                                       | Komercyjnie |
| ---------------- | -------- | ------------- | ------------------------- | ---------------------------------------------------------- | :---------: |
| Node.js          | ≥20.0.0  | MIT           | Środowisko uruchomieniowe | https://nodejs.org                                         |     ✅      |
| TypeScript       | ^6.0.2   | Apache-2.0    | Język programowania       | https://typescriptlang.org                                 |     ✅      |
| Express          | ^4.21.0  | MIT           | Framework backend         | https://expressjs.com                                      |     ✅      |
| Prisma           | ^6.0.0   | Apache-2.0    | ORM / baza danych         | https://prisma.io                                          |     ✅      |
| SQLite           | —        | Public Domain | Baza danych               | https://sqlite.org                                         |     ✅      |
| Vite             | ^8.0.14  | MIT           | Bundler frontend          | https://vitejs.dev                                         |     ✅      |
| Jest             | ^30.3.0  | MIT           | Testy                     | https://jestjs.io                                          |     ✅      |
| Puppeteer        | ^24.40.0 | Apache-2.0    | Generowanie PDF           | https://pptr.dev                                           |     ✅      |
| Sentry           | ^10.59.0 | MIT           | Monitoring błędów         | https://sentry.io                                          |     ✅      |
| Swagger          | ^6.3.0   | Apache-2.0    | Dokumentacja API          | https://swagger.io                                         |     ✅      |
| docx (npm)       | ^9.6.1   | MIT           | Generowanie DOCX          | https://docx.js.org                                        |     ✅      |
| Helmet           | ^8.1.0   | MIT           | Bezpieczeństwo HTTP       | https://helmetjs.github.io                                 |     ✅      |
| Zod              | ^4.3.6   | MIT           | Walidacja danych          | https://zod.dev                                            |     ✅      |
| ESLint           | ^9.39.4  | MIT           | Linter                    | https://eslint.org                                         |     ✅      |
| Prettier         | ^3.9.4   | MIT           | Formatter kodu            | https://prettier.io                                        |     ✅      |
| Husky            | ^9.1.7   | MIT           | Git hooks                 | https://typicode.github.io/husky                           |     ✅      |
| commitlint       | ^21.0.2  | MIT           | Walidacja commitów        | https://commitlint.js.org                                  |     ✅      |
| standard-version | ^9.5.0   | ISC           | Auto-wersjonowanie        | https://github.com/conventional-changelog/standard-version |     ✅      |

## Narzędzia CI/CD

| Narzędzie      | Licencja                 | Zastosowanie            | Komercyjnie |
| -------------- | ------------------------ | ----------------------- | :---------: |
| GitHub Actions | darmowe dla public repos | CI/CD pipeline          |     ✅      |
| Docker         | Apache-2.0               | Konteneryzacja          |     ✅      |
| Codecov        | MIT (action)             | Raporty pokrycia testów |     ✅      |

## Podsumowanie zgodności komercyjnej

**Wniosek**: Wszystkie technologie użyte w projekcie **mogą być używane komercyjnie** i **pozwalają na sprzedaż produktu**. Jedyny wymóg to zachowanie informacji o licencji (attribution) w dystrybucji — standardowe dla MIT/Apache/ISC/BSD.

> ⚠ MPL-2.0 (2 pakiety): wymaga opensourczenia modyfikacji danego pliku, ale nie wpływa na całość produktu. Dotyczy pakietów niskiego poziomu, nie modyfikowanych bezpośrednio.
