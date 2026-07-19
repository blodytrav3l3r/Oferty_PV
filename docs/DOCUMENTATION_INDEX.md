# Dokumentacja Projektu — WITROS Oferty PV

**Ostatnia aktualizacja:** 2026-07-19
**Suma plików:** 43 (dokumentacja projektu) + 7 (konfiguracyjne)

---

## 1. Pliki konfiguracyjne w katalogu głównym (root)

Pliki konfiguracyjne i instrukcje dla deweloperów i agentów AI.

| Plik              | Opis                                                                                                                       |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `README.md`       | Główny plik README projektu — opis, instalacja, konfiguracja, komendy, struktura                                           |
| `CONTRIBUTING.md` | Zasady pracy dla deweloperów — branch main, conventional commits, release flow, testy, formatowanie                        |
| `AGENTS.md`       | Konwencje i instrukcje dla agentów AI (OpenCode, Claude, Cursor itp.) — stack, filozofia pracy, czystość kodu, znane błędy |
| `CLAUDE.md`       | Konfiguracja i instrukcje dla Claude Code / Hermes Agent                                                                   |
| `CHANGELOG.md`    | Historia zmian w projekcie — generowana automatycznie przez standard-version                                               |

---

## 2. Dokumentacja główna (`docs/`)

| Plik                          | Opis                                                                                            |
| ----------------------------- | ----------------------------------------------------------------------------------------------- |
| `docs/README.md`              | Streszczenie projektu — tech stack, szybki start, moduły, architektura                          |
| `docs/ARCHITECTURE.md`        | Architektura systemu — backend/frontend, SPA, iframe, ML Pipeline, przepływ danych              |
| `docs/ARCHITECTURE-SKILLS.md` | Architektura systemu skills (Hermes) — manifest, router, katalog, zależności                    |
| `docs/API.md`                 | Dokumentacja endpointów REST API — publiczne, auth, oferty, produkty, studnie, rury, zamówienia |
| `docs/DATABASE.md`            | Schemat bazy danych SQLite — tabele, relacje, indeksy, migracje, seedowanie                     |
| `docs/COMPONENTS.md`          | Katalog komponentów CSS/UI — design tokens, komponenty, responsywność                           |
| `docs/SECURITY.md`            | Bezpieczeństwo — autoryzacja, CSP, Helmet, XSS, audyt, sesje                                    |
| `docs/TECH_STACK.md`          | Stos technologiczny — licencje pakietów npm (MIT, Apache-2.0, ISC itd.)                         |
| `docs/DEPLOYMENT.md`          | Wdrożenie — zmienne środowiskowe, Docker, VPS, Render, domena, SSL                              |
| `docs/VERSIONING.md`          | Wersjonowanie — Semantic Versioning 2.0.0, Single Source of Truth (VERSION)                     |
| `docs/RELEASE_PROCESS.md`     | Proces wydawniczy — krok po kroku, release scripts, tagowanie, cache-bust                       |
| `docs/BACKUP_RESTORE.md`      | Backup i restore bazy danych SQLite — ręczny, automatyczny, harmonogram                         |
| `docs/GIT_COMMIT_FLOW.md`     | Instrukcja profesjonalnego commita Git — sprawdzanie, staging, conventional commits             |
| `docs/INSTRUKCJA_SERWER.md`   | Instrukcja uruchomienia serwera przez Internet — VPS, ZeroTier/Render, instalacja, konfiguracja |
| `docs/errors-known.md`        | Znane błędy i rozwiązania — seed timeout, SQLITE_BUSY, XSS, TDZ, CSP itd.                       |
| `docs/RAPORT_MODERNIZACJI.md` | Raport modernizacji projektu — lista zmian, naprawy testów, refaktoryzacja                      |
| `docs/AUDIT.md`               | Raport audytu projektu — struktura katalogów, analiza kodu, zalecenia                           |
| `docs/AUDIT_AI.md`            | Audyt modułu Telemetry AI (Learning Engine) — architektura, działanie, bezpieczeństwo           |
| `docs/AUDIT_TELEMETRY.md`     | Audyt modułu Telemetry AI — architektura, stos technologiczny, analiza                          |

---

## 3. Architecture Decision Records (`docs/adr/`)

| Plik                                 | Opis                                                   |
| ------------------------------------ | ------------------------------------------------------ |
| `docs/adr/ADR-001-sqlite.md`         | ADR-001: SQLite jako produkcyjna baza danych           |
| `docs/adr/ADR-002-vanilla-js.md`     | ADR-002: Vanilla JS SPA (bez frameworka frontendowego) |
| `docs/adr/ADR-003-vite.md`           | ADR-003: Vite jako bundler frontendu                   |
| `docs/adr/ADR-004-express-prisma.md` | ADR-004: Express + Prisma na backendzie                |

---

## 4. Plany i propozycje (`docs/plans/`)

| Plik                                     | Opis                                            |
| ---------------------------------------- | ----------------------------------------------- |
| `docs/plans/REFACTOR_PLAN.md`            | Plan refaktoryzacji kodu                        |
| `docs/plans/REFACTOR_EXCEL_PLAN.md`      | Plan refaktoryzacji modułu Excel                |
| `docs/plans/PLAN_NAPRAWY_v3.md`          | Plan naprawy wersji 3 — lista błędów i poprawek |
| `docs/plans/PLAN_KROK8_VAR_LET.md`       | Plan naprawy krok 8 — var/let/const w kodzie    |
| `docs/plans/FIX_AI_ML_MODULE.md`         | Plan naprawy modułu ML/AI                       |
| `docs/plans/FIX_AI_LEARNING_ENGINE.md`   | Plan naprawy Learning Engine                    |
| `docs/plans/excel-column-hiding-plan.md` | Plan ukrywania kolumn w Excelu                  |
| `docs/plans/skalowanie-kartoteki.md`     | Plan skalowania modułu kartoteki ofert          |
| `docs/plans/skalowanie-zlecenia.md`      | Plan skalowania modułu zleceń/zamówień          |

---

## 5. Import/Eksport (`docs/import-export/`)

| Plik                                  | Opis                                                               |
| ------------------------------------- | ------------------------------------------------------------------ |
| `docs/import-export/ARCHITECTURE.md`  | Architektura importu/eksportu ofert — XLSX, JSON 1:1, feature flag |
| `docs/import-export/REMOVAL-GUIDE.md` | Instrukcja usunięcia modułu import/eksport — 6 kroków, zależności  |

---

## 6. Audit trail (`docs/audits/`)

| Plik                                                         | Opis                                                                        |
| ------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `docs/audits/seed-studnie-audit-2026-07-05.md`               | Audyt pliku seed_studnie.json — 676 produktów, polskie/angielskie nazwy pól |
| `docs/audits/seed-studnie-audit-ids.txt`                     | Lista ID produktów z audytu seed                                            |
| `docs/audits/seed-studnie-audit-2026-07-05-affected-ids.txt` | ID produktów dotkniętych błędem w seed                                      |

---

## 7. Baseline (`docs/baseline/`)

| Plik                                      | Opis                                                   |
| ----------------------------------------- | ------------------------------------------------------ |
| `docs/baseline/wellActions-baseline.json` | Baseline danych dla akcji studni (testy regresyjne)    |
| `docs/baseline/wellManager-baseline.json` | Baseline danych dla managera studni (testy regresyjne) |

---

## 8. Dokumentacja generowana automatycznie

| Plik | Opis | Generowane przez |
|------|------|------------------|
| `docs/diagrams/erd.md` | Diagram ERD bazy danych z relacjami między modelami | `prisma-erd-generator` (`npm run docs:erd`) |
| `docs/api-reference/` | **Katalog** — API Reference backendu (TypeDoc) z opisami klas, funkcji, interfejsów | `typedoc` (`npm run docs:typedoc`) |

---

## 9. Nowe pliki dokumentacji (utworzone 2026-07-19)

| Plik | Opis |
|------|------|
| `docs/DOCUMENTATION_INDEX.md` | **Ten plik** — kompletny indeks dokumentacji projektu |
| `docs/DOCUMENTATION_GAPS.md` | Analiza luk w dokumentacji — co jest dobrze opisane, czego brakuje |
| `docs/DOC_CONVENTIONS.md` | Konwencje tworzenia dokumentacji — język, encoding, szablon, lokalizacja |

---

## Podsumowanie

| Kategoria | Liczba plików |
|-----------|:-------------:|
| Pliki konfiguracyjne (root) | 5 |
| Dokumentacja główna (`docs/`) | 20 |
| ADR (`docs/adr/`) | 4 |
| Plany (`docs/plans/`) | 9 |
| Import/Eksport (`docs/import-export/`) | 2 |
| Audit trail (`docs/audits/`) | 3 |
| Baseline (`docs/baseline/`) | 2 |
| Dokumentacja generowana automatycznie | 1 katalog + 1 plik |
| Nowe pliki dokumentacji | 3 |
| **Razem (projekt)** | **~50** |
