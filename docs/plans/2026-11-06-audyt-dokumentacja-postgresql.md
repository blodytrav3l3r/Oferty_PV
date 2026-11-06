# Plan — audyt SQLite i kompletna dokumentacja S.O.K.

- Data rozpoczęcia: 2026-11-06
- Bazowy HEAD: `5ab15ac077d8eb94e66bcb08bac9d3c19d09f53f`
- Zakres: audyt niezależności PostgreSQL/SQLite oraz dokumentacja S.O.K. zgodna z bieżącym kodem.
- Tryb: dokumentacja i audyt; brak dostępu do produkcyjnej bazy, brak migracji/seedów, brak restartu i push.
- Status: audyt PostgreSQL/SQLite i dokumentacja bazowa zakończone. Przegląd próbek API i pełny QA wykonane; kompletne route-by-route API, instrukcje każdego formularza/importu/wydruku, świeża instalacja Linux i production cutover pozostają osobnymi, jawnie oznaczonymi zakresami.

## D0 — Stan początkowy

**Weryfikowane źródła:** Git, Prisma, `package.json`, konfiguracja Docker/CI, istniejące docs, testy i bieżące wyniki.

**Potwierdzone:** branch `main`, HEAD `5ab15ac0`; ostatnie commity `5ab15ac0`, `84f9a805`, `60a203c2`, `e6cf731e`, `81a68d1a`. Worktree zawiera niezależne modyfikacje `.hermes/`, `docs/audits/full-system-audit/` i planu archiwalnego; muszą pozostać nietknięte i poza naszym zakresem.

**Potwierdzone:** Prisma provider `postgresql`, adapter `@prisma/adapter-pg`, migracje w `prisma/migrations-postgresql`; PostgreSQL 18 w Docker/Compose/CI; źródło cenników świeżej instalacji `data/pricelists/active-pricelists.json`. Bieżący schema ma 47 modeli. Aktywne SQLite API/runtime/installer zależności nie wykryto; pozostają negatywne guardy i historyczne treści. Test `tests/scripts/postgresOnlySurface.test.cjs` wcześniej PASS (raport poprzedniej sesji; uruchom ponownie tylko gdy potrzebne).

**Ograniczenia:** czysta instalacja Linux i produkcyjny cutover nie są potwierdzone. GitHub API Check Runs dla bieżącego SHA zostały później odczytane osobno i zapisane w końcowym checkpointcie poniżej.

## D1 — Weryfikacja pozostałości SQLite

1. Sklasyfikować pozostałe aktywne dopasowania jako guard/test/history/false-positive.
2. Sprawdzić pliki wykonywalne, zależności, CI, instalatory, backup/restore i ścieżki testów.
3. Nie usuwać testów/filtrów blokujących powrót SQLite ani historii Git.
4. Usuwać runtime SQLite tylko jeśli potwierdzi się konsument; dla zmiany dodać regresję i uruchomić adekwatne testy.

**Weryfikacja:** `npm run test:installer-linux` (w tym PG-only surface), inspekcja lockfile i `git diff`.

## D2 — PostgreSQL, Prisma i dane

1. Udokumentować provider, adapter, konfigurację URL/schema, kanoniczną historię migracji, tabele/relacje i testowe środowisko.
2. Oznaczyć jako ryzyka do osobnego projektu: tekstowe timestampy/JSON, relacje i drift schematu; nie zmieniać schematu bez parity planu.
3. Opisać wyłącznie aktywny pakiet cenników, role, backup/restore i ograniczenia operacyjne.

**Weryfikacja:** zgodność twierdzeń z `schema.prisma`, `prisma.config.ts`, SQL, skryptami i testami; bez połączenia do live DB.

## D3 — Mapa aplikacji i kontraktów

1. Utworzyć czytelny indeks dokumentacji oraz mapę SPA: route → HTML/iframe → moduł.
2. Uzupełnić mapę API na poziomie zarejestrowanych grup/route files i odnośników do szczegółowego `docs/API.md`; nie wymyślać payloadów.
3. Udokumentować granicę browser → Express → service/Prisma → PostgreSQL oraz istotne kontrakty local draft/iframe.

**Weryfikacja:** `public/js/spa/router.js`, `src/mountRoutes.ts`, `src/app.ts`, walidatory/route files, testy kontraktowe.

## D4 — Moduły i przepływy biznesowe

1. Uzupełnić nawigację do istniejących modułów i dokumentów; stworzyć brakujący przewodnik ofert/cenników/Excel/import-export/draftów/zleceń tylko tam, gdzie nie ma istniejącego SSoT.
2. Dla cen, snapshotów, wersjonowania, optimistic locking i draft CAS odsyłać do `SYSTEM_INVARIANTS.md` i testów.
3. Zachować Protected Zone Excela i nie zmieniać logiki.

**Weryfikacja:** źródła route/service/UI, inwarianty oraz wymienione testy regresyjne.

## D5 — Instalacja, wdrożenie i operacje

1. Zmapować istniejące instrukcje Windows/Linux/Docker, porty, wymagania, migracje, seed i aktywne cenniki.
2. Udokumentować status wsparcia i niepotwierdzone ścieżki osobno od procedur zweryfikowanych.
3. Uzupełnić operacyjny spis backup/restore/rollback/DR/monitoringu, linkując do istniejących runbooków.

**Weryfikacja:** README, instalatory, Dockerfile/Compose, systemd, backup/restore i dokumentacja; nie uruchamiać operacji bazodanowych.

## D6 — Bezpieczeństwo, testy i CI/CD

1. Zebrać role, sekrety, auth/session/CSRF, TLS i granice zaufania przez linki do istniejących SSoT.
2. Sporządzić katalog komend testowych i mapę workflow: trigger, blocking/non-blocking/conditional, lokalny odpowiednik i niepotwierdzone statusy.
3. Odróżniać `SUCCESS`, `FAILURE`, `SKIPPED`, `FLAKY`, `BLOCKING`, `NON-BLOCKING` na podstawie konfiguracji i wyników, nie założeń.

**Weryfikacja:** package scripts i `.github/workflows`; odczyt statusu CI, jeśli źródło dostępne.

## D7 — Kontrola końcowa

1. Zweryfikować wszystkie nowe twierdzenia/ścieżki względem HEAD oraz wszystkie Markdown linki lokalne.
2. Usunąć nieaktualne liczby/claims tylko po potwierdzeniu.
3. Uruchomić Prettier na naszych plikach, version check, `git diff --check` i adekwatne skan/testy PG-only.
4. Sprawdzić diff względem D0; nie stagingować/commitować cudzych plików. Push wymaga osobnego GO.
5. Zaktualizować status tego planu i `documentation-audit.md` jako końcowy checkpoint.

## Kryteria zakończenia

- Audyt SQLite ma klasyfikację i rozróżnia kod wykonywalny od guardów/historii.
- Nawigacja i mapy prowadzą do wszystkich istniejących SSoT bez pustych/duplikowanych dokumentów.
- Kluczowe architektury, biznes, API, instalacja, bezpieczeństwo, backup, testy i ograniczenia są opisane albo mają jawny `TODO/UNKNOWN` z właścicielem źródła.
- Weryfikacje i ograniczenia raportowane dokładnie; żaden production DB, seed, restart, commit/push bez odpowiedniego GO.

## Checkpoint 2026-11-06

### Zakończone

- D0: stan Git, HEAD i zmiany użytkownika zinwentaryzowane. `main` i `origin/main` = `5ab15ac0`; niezależne zmiany `.hermes/` i niepowiązane audyty/plany pozostawiono poza zakresem.
- D1: static scan PG-only guard zaliczony. Brak aktywnego SQLite runtime; pełny indeks wszystkich śledzonych wierszy HEAD: `docs/audits/SQLITE_REFERENCES_HEAD_5AB15AC0.md` (563 dopasowania wzorca / 127 plików, z false positives i historycznym audytem). `npm ls` nie wykazał adaptera/drivera SQLite, śledzone artefakty DB SQLite: 0.
- D2: udokumentowano PostgreSQL 18, migracje, backup i ryzyka hardeningu z linkami do dokumentacji producenta. Nie wykonano operacji DB.
- D3: dodano indeks dokumentacji, mapę SPA/API, przewodnik modułów i diagramy przepływów.
- D3: dodatkowy niezależny przegląd próbek API znalazł brakujące `POST /api/telemetry/draft-failure`, `POST /api/pricelist-versions/:id/cancel-schedule`, `POST /api/pricelist-versions/:id/active` i `POST /api/pricelist-versions/active/reset`; wpisy dodano do `docs/API.md`. Opis Swagger skorygowano: w kodzie adnotacje `@openapi` występują w ograniczonej liczbie i specyfikacja jest częściowa. Pełna kontrola wszystkich tras pozostaje otwarta.
- D4: dodano przewodniki ofert/cenników/draftów oraz kalkulacji/Excel; niepotwierdzone reguły oznaczono `UNKNOWN`.
- D5/D6: istniejące runbooki powiązano z nową macierzą testów/CI. GitHub API Check Runs dla SHA `5ab15ac0` o 06:07 UTC zwróciły 15 `success`, 1 `skipped` (`Deploy — produkcja`), bez `failure` i bez aktywnych jobów; deploy produkcyjny nie został wykonany.
- Skorygowano sprzeczny opis `source=live` w `docs/API.md`; testy źródłowe potwierdzają `422 INVALID_SOURCE`.
- Skorygowano liczbę modeli w `docs/ARCHITECTURE.md` z 56 do 47.

### Kontrole wykonane

- `npm run test:installer-linux`: PASS polityk Windows/Linux, recovery inicjalnej migracji i PG-only scan (310 runtime files); Bash-only check `SKIP` — Bash niedostępny.
- `npm run version:check`: PASS (1.56.5).
- Prettier na plikach audytu i `git diff --check`: PASS.
- Lokalny link checker plików: PASS; zewnętrzne URL i anchor fragments nie były sprawdzane sieciowo.
- Dwie suite API nie uruchomiły testów: brak `POSTGRES_TEST_URL` (0 testów). Nie łączono się z bazą.
- Niezależny QA pierwszej wersji dokumentów: brak P0/P1; zgłoszono luki P2 dla pełnych walkthrough, API route-by-route i parity. Walkthrough modułów rozszerzono; parytet/wzory i UNKNOWN opisano osobno.
- Niezależny QA końcowej wersji: indeks SQLite zgodny dokładnie z HEAD (563 dopasowania/127 plików); lokalne ścieżki i kotwice w 7 sprawdzonych dokumentach działają. Poprawiono oba diagramy odpowiedzi, aby przechodziły z trasy przez warstwę Express API. Brak P0/P1; URL zewnętrzne nie były sprawdzane.
- Niezależny read-only przegląd API i przewodnika: sześć głównych modułów jest ujętych, ale instrukcje krok-po-kroku są niepełne; katalog `docs/API.md` obejmuje główne grupy, ale nie każdą z około 100 tras i nie opisuje wszędzie pełnej polityki/kształtu walidacji.

### Otwarte / niepotwierdzone

- Pełne porównanie każdego method/path, authZ, walidatora, request/response i OpenAPI ze wszystkimi route files i testami.
- Krok-po-kroku każdego formularza, importu/eksportu i wydruku; obecny przewodnik modułów mapuje funkcje, ale nie wszystkie sekwencje UI.
- Ręczne rozstrzygnięcie różnicy zapisu/eksportu (PEHD/surcharge/VAT), akceptacja reguł PRECO oraz parytet wyników; bez zmiany logiki.
- E2E, integracyjne PostgreSQL i `npm run validate` wymagają jawnego `POSTGRES_TEST_URL`; nie wykonano ich.
- Czysta instalacja Linux, produkcyjny cutover, DR drill i wartości RPO/RTO wymagają dedykowanego hosta/decyzji właściciela.
- Końcowy niezależny QA został wykonany; pozostałe powyżej ograniczenia są poza potwierdzonym zakresem tej paczki.

Nie wykonano commit/push, migracji/seedów, restartu ani zmian DB. Wstępne zmiany użytkownika pozostały nietknięte.
