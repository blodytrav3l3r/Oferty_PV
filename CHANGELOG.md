# CHANGELOG

Wszystkie znaczące zmiany w tym projekcie są dokumentowane w tym pliku.

---

## [1.0.0] — 2026-07-04

### Changed

- **Reset numeracji** — nowy start wersjonowania od 1.0.0. Poprzednie wydanie 2.0.0 zachowane w historii poniżej.

---

## [2.0.0] — 2026-06-30

### Added

- **Excel Table** — interaktywna tabela Excel z trybem Auto/Manual, dwukierunkową synchronizacją z konfiguratorem, pollingiem 200 ms, per-wiersz przełączaniem Auto/Manual oraz przyciskiem Run Auto.
- **Auto/Manual** — system automatycznego i ręcznego sterowania konfiguracją studni; każda ręczna zmiana przestawia wiersz w tryb MANUAL, przełączenie na Auto przywraca synchronizację z solverem.
- **Eksport PDF/DOCX** — pełny eksport ofert (studnie + rury) do formatów PDF (przez Puppeteer) i DOCX (przez docx.js) z kartą budowy i zamówieniem.
- **Prisma ORM** — migracja z raw SQL na Prisma ORM (SQLite) z automatycznymi migracjami, seedem, generacją typów i integracją z TypeScript.
- **System autoryzacji** — sesje oparte na cookie + bcrypt, role użytkowników (admin/user), ochrona endpointów middleware.
- **Cenniki** — zarządzanie cenami produktów (rury, studnie) z walidacją, edycją katalogów i synchronizacją z ofertami.
- **Kartoteka klientów** — zapis, wczytywanie i zarządzanie danymi klientów z poziomu kreatora ofert.
- **Backend API** — Express.js z pełną dokumentacją Swagger, walidacją Zod, Sentry, helmet, compression.
- **Offline bundle** — skrypt `build_offline_bundle.py` generujący dystrybucję offline (zip) wraz ze skryptami instalacyjnymi (install.sh / install.bat, start.sh / start.bat).
- **Git Hooks** — commitlint + husky + lint-staged dla zapewnienia jakości kodu i konwencjonalnych commitów.
- **CI/CD Pipeline** — GitHub Actions z lintem, typecheck, testami (Jest), budową Docker i health check.
- **Skrypty backupu** — automatyczny backup bazy danych z instalacją cron-a na Windows.

### Changed

- **Przebudowa frontendu** — migracja z pojedynczych stron na SPA z routingiem hash (#/studnie, #/rury, #/kartoteka) i nawigacją w headerze.
- **Ujednolicenie API** — wszystkie endpointy zwracają spójny format JSON, błędy przez error handler.
- **Wersja produkcyjna** — bump do v2.0.0 jako stabilne wydanie produkcyjne.

### Fixed

- Naprawiona nieskończona rekurencja w `_excelSyncAutoManualUI`.
- Poprawiony overlap layoutu (100vh-120 zamiast 100vh-60) dla dolnego paska nawigacji.
- Usunięcie licznika z przycisków Auto/Manual w Excel UI.
- Synchronizacja autoSelect z configSource — poprawiona dwukierunkowość.

### Performance

- Polling Excel: 5s → 200 ms dla real-time sync konfiguratora z Excelem.
- CSS panels width awareness 60px (zamiast 57) — eliminacja overlapu.

### Refactor

- Reorganizacja nagłówków Excel (H1/H2/H3) dla czytelniejszego układu Auto/Manual.
- Katalog `graphify-out` z reprezentacją grafu zależności projektu.

---

## [1.0.0] — 2026-05

### Added

- Pierwsze wydanie aplikacji WITROS Oferty PV.
- Generator ofert dla studni betonowych i żelbetowych.
- Generator ofert dla rur (betonowe, żelbetowe, jajowe).
- Podstawowy kreator ofert z kalkulacją kosztów.
- Eksport PDF przez Puppeteer.
- Panel administratora i użytkownika.

---

_Pełna historia commitów dostępna w repozytorium Git._
