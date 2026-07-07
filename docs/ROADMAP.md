# Plan rozwoju — WITROS Oferty PV

**Wersja:** 1.5.0  
**Horyzont:** Q3–Q4 2026

---

## Priorytety strategiczne

### 1. Wersjonowanie i wydania

| Zadanie                                              | Status       | Priorytet |
| ---------------------------------------------------- | ------------ | --------- |
| Utworzenie pliku VERSION jako jedynego źródła wersji | ⏳ Planowane | Wysoki    |
| Konfiguracja standard-version / semantic-release     | ⏳ Planowane | Wysoki    |
| Dodanie tagów git dla wydań                          | ⏳ Planowane | Wysoki    |
| Automatyzacja changeloga (conventional-changelog)    | ⏳ Planowane | Średni    |

### 2. CI/CD — rozbudowa

| Zadanie                                      | Status       | Priorytet |
| -------------------------------------------- | ------------ | --------- |
| Automatyczny deploy na Render z CI           | ⏳ Planowane | Wysoki    |
| Testy w pipeline (obecnie działa)            | ✔ Działa     | —         |
| CodeQL (obecnie działa)                      | ✔ Działa     | —         |
| Dodanie automatycznego tagowania wersji w CI | ⏳ Planowane | Średni    |
| Slack/Discord notifications o buildzie       | ⏳ Planowane | Niski     |

### 3. Testy — zwiększenie pokrycia

| Zadanie                            | Status       | Priorytet |
| ---------------------------------- | ------------ | --------- |
| Testy E2E z Playwright/Cypress     | ⏳ Planowane | Wysoki    |
| Testy frontendu (Vanilla JS)       | ⏳ Planowane | Wysoki    |
| Testy integracyjne API (rozbudowa) | ⏳ Planowane | Średni    |
| Testy wydajnościowe (k6/artillery) | ⏳ Planowane | Niski     |
| Automatyzacja testów w CI          | ✔ Działa     | —         |

### 4. Dokumentacja

| Zadanie                                        | Status       | Priorytet |
| ---------------------------------------------- | ------------ | --------- |
| README.md w głównym katalogu                   | ✔ Zrobione   | —         |
| Dokumentacja API (Swagger)                     | ✔ Działa     | —         |
| AUDIT.md — raport audytu                       | ✔ Zrobione   | —         |
| TECH_STACK.md — analiza stosu technologicznego | ✔ Zrobione   | —         |
| Dokumentacja wdrożenia (Docker, Render, VPS)   | ✔ Zrobione   | —         |
| RAPORT_MODERNIZACJI.md                         | ✔ Zrobione   | —         |
| Instrukcja użytkownika                         | ⏳ Planowane | Średni    |

---

## Planowane funkcjonalności

### Q3 2026

1. **Wielojęzyczność (i18n)**
    - Obsługa języków: polski (domyślny), angielski
    - Przechowywanie preferencji językowej użytkownika

2. ~~**Eksport CSV/Excel**~~
    - ~~Eksport listy ofert i zamówień do formatów .xlsx i .csv~~
    - ~~Użycie biblioteki exceljs lub podobnej~~
    - ✅ Zrealizowane: eksport XLSX dla rur i studni przez `public/js/import-export/` (SheetJS)

3. **Dashboard statystyk**
    - Widok z wykresami: liczba ofert, wartość, statusy
    - Filtrowanie po dacie

4. **Poprawa backupu**
    - Dodanie skryptu restore-db.js
    - Wersjonowanie bazy przez PRAGMA user_version

### Q4 2026

5. **Rozszerzone role użytkowników**
    - role: admin, manager, user, viewer
    - Szczegółowe uprawnienia per zasób

6. **API tokeny**
    - Tokeny API dla integracji zewnętrznych
    - Webhooki dla zdarzeń (nowa oferta, zmiana statusu)

7. **Tryb offline / PWA**
    - Service Worker dla wsparcia offline
    - Cacheowanie danych w IndexedDB

8. **Migracja do PostgreSQL (opcjonalnie)**
    - Przygotowanie schematu dla PostgreSQL
    - Wsparcie dla Prisma multi-provider

---

## Backlog techniczny

| Obszar         | Zadanie                                         | Priorytet |
| -------------- | ----------------------------------------------- | --------- |
| Bezpieczeństwo | Regularne `npm audit` w CI                      | Wysoki    |
| Bezpieczeństwo | CSRF ochrona (obecnie w planach)                | Średni    |
| Backend        | Logowanie błędów do pliku (oprócz konsoli)      | Średni    |
| Backend        | Cache warstwy API (Redis)                       | Niski     |
| Frontend       | Modernizacja do React/Vue (opcjonalnie)         | Niski     |
| Frontend       | Responsywność — testy na urządzeniach mobilnych | Średni    |
| DevOps         | Monitoring (Sentry + UptimeRobot)               | Średni    |

---

## Cele długoterminowe

- **Wersja 3.0.0** — migracja do PostgreSQL, React frontend, API v2
- **Wersja 4.0.0** — system subskrypcji, SaaS-ready, wielodzierżawa
- **Open Source** — publikacja na GitHub jako projekt open source z licencją MIT

---

_Ostatnia aktualizacja: 2026-06-30_
