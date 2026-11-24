# Audyt dokumentacji i zależności SQLite

- **Zaktualizowano:** 2026-11-24
- **Repozytorium:** `blodytrav3l3r/Oferty_PV`
- **Baza kodu przeglądu:** HEAD `0aa625c2738b64d97f2cd24016bc599cd3f4afd6` (`main`), `VERSION` i `package.json`: `1.64.24`; szczegóły w sekcji z 2026-11-24.
- **Zakres najnowszego uzgodnienia:** kontrola lokalnych linków w aktywnej dokumentacji i ponowna weryfikacja kluczowych instrukcji; szczegóły oraz wyłączenia w sekcji 2026-11-24. Nie jest to walidacja runtime ani produkcji.
- **Status wdrożenia:** dokumentacja i lokalny checkout nie potwierdzają produkcyjnego cutoveru ani czystej instalacji Linux.
- **Źródła:** checkout, kod, konfiguracja, package scripts, testy oraz wyniki poleceń wskazanych niżej. Nie odpytano zdalnego CI ani środowiska produkcyjnego.

## Uzupełnienie dokumentacji — 2026-11-24

**FACT:** kod i konfigurację dokumentacji zweryfikowano na `main` / HEAD `0aa625c2738b64d97f2cd24016bc599cd3f4afd6`; `VERSION` i `package.json` wskazywały `1.64.24`. Walidator i test automatyzacji wersji uruchomiono ponownie po zmianach dokumentacji.

**FACT:** aktywne instrukcje poprawiono w miejscach, gdzie tekst wyglądał na bieżący, choć opisywał stan historyczny albo niezweryfikowany: instalacja Windows ma teraz wersję dokumentacji propagowaną z `VERSION`; walidacja PostgreSQL w `TECH_STACK.md` jest oznaczona datą i wydaniem; `errors-known.md` opisuje zakończony wybór PostgreSQL; runbook HTTPS nie deklaruje stanu zewnętrznego serwera; `OPIEKA.md` opisuje bieżące zapytania JSONB, SQL powiadomień i znaczniki ETag.

**FACT:** proces wydania opisuje wyłącznie istniejące komendy `release:patch`, `release:minor` i `release:major`, zakres aktualizacji wersji oraz osobne GO przed pushem. Linki z instrukcji cenników i opieki prowadzą do aktywnej dokumentacji albo są jawnie opisane jako historia.

**INFERENCE:** nagłówek wersji synchronizowany automatycznie z wydaniem nie potwierdza aktualności całej treści. Daty weryfikacji i numery przy historycznych wynikach pozostają związane z ich checkpointami.

**Zakres:** sprawdzono lokalne cele Markdown w 69 aktywnych plikach (README + docs), z wyłączeniem audytów, planów i dwóch zastąpionych ADR-ów SQLite. Twierdzenia techniczne w kluczowych instrukcjach porównano z kodem, konfiguracją i testami; nie jest to semantyczny audyt każdego akapitu. Nie wykonywano wdrożenia, testu czystej instalacji Linux, restore drill ani odczytu produkcyjnego środowiska.

## Checkpoint aktualności — 2026-11-22

**FACT:** checkout na początku przeglądu był czysty, branch `main`, HEAD `e582174efc6559917782b70f06c76764ee195170`, a `VERSION` i `package.json` wskazywały `1.64.17`. Wynik `npm run version:check` i sprawdzenia dokumentacji odnotowano w sekcji kontroli tego przeglądu. Lokalne odnośniki sprawdzono w indeksach; nie oznacza to weryfikacji wszystkich zewnętrznych URL ani semantyki każdej kotwicy.

**FACT:** stare punkty odniesienia `fe8bbb3b` / `1.56.6` oraz `5ab15ac0` w dalszej części tego pliku opisują datowane audyty historyczne, nie ten checkpoint. Zachowano je, żeby nie zmieniać dowodów z wcześniejszych audytów.

**FACT:** zaktualizowano ogólne workflow contributorów, korektę nieaktualnych wskazówek o hookach i kontroli frontendu oraz dodano indeksy ADR, przewodników agentów i planów. Nie zmieniano logiki aplikacji, konfiguracji, migracji ani wyników historycznych.

**FACT:** `docs/README.md` i nowo dodane indeksy katalogów są nawigacją do dokumentów, nie potwierdzeniem ich kompletności. Statusy instalacji produkcyjnej/Linux, restore drill, RPO/RTO, ostatnie zdalne CI oraz pełna zgodność UI/E2E nadal wymagają odrębnych dowodów.

**INFERENCE:** największe ryzyko jakościowe dokumentacji to mieszanie aktualnych wskazówek i checkpointów z prawdziwymi, ale historycznymi raportami. Data/SHA przy twierdzeniu operacyjnym powinny określać jego zakres; brak aktualnego dowodu oznacza `UNKNOWN`, nie „w trakcie” ani „gotowe”.

**UNKNOWN:** niniejszy przegląd nie potwierdza działania aplikacji na aktualnym HEAD, czystej instalacji Linux, produkcyjnego cutoveru/restore, ani wyniku zdalnego CI.

**TODO:** docelowe RPO/RTO wymagają decyzji właściciela operacji i restore drill na izolowanym celu. W tym przeglądzie nie wykonano połączenia do produkcyjnej bazy, migracji, backupu ani restore.

**Kontrole tego przeglądu:** po zmianach zapisano wyniki `npm run version:check`, walidacji formatowania dokumentów i lokalnych linków oraz `git diff --check` w końcowej sekcji. Pełnych testów aplikacji nie uruchamiano, ponieważ zmiany dotyczą wyłącznie dokumentacji.

**Wyniki końcowe (2026-11-22):** `npm run version:check` PASS (`1.64.17`); Prettier `--check` PASS dla 20 zmienionych dokumentów; sprawdzenie lokalnych celów Markdown PASS dla tych 20 plików (bez kontroli zewnętrznych URL i kotwic); `git diff --check` PASS. Nie uruchamiano testów aplikacji ani pełnego `npm run validate` — nie zmieniano kodu ani konfiguracji.

**Graphify:** indeks odpowiadał commitowi `cb361eb` z 2026-11-03, a nie HEAD `e582174e`; wynik wykorzystano wyłącznie nawigacyjnie. Twierdzenia o bieżącym stanie potwierdzano ponownie w plikach, konfiguracji i skryptach aktualnego checkoutu.

## Poprzedni checkpoint — 2026-11-07

Poniższe wyniki zachowują zakres i chwilowy stan z 2026-11-07. Nie należy ich interpretować jako dowodu stanu HEAD z 2026-11-22.

**FACT (w tamtym checkpointcie):** branch `main`, HEAD `fe8bbb3bcba36304e355d37051e4afb310c1f143`, `VERSION` i `package.json` `1.56.6`; `npm run version:check` zakończył się sukcesem. Lokalnie sprawdzono cele linków w `docs/README.md`, bez weryfikacji URL zewnętrznych i kotwic.

**FACT (kod i konfiguracja sprawdzone wtedy):** Prisma używała providera PostgreSQL, klient `@prisma/adapter-pg`, `prisma.config.ts` wskazywał `prisma/migrations-postgresql/`, a workflow Docker deklarował PostgreSQL 18. To nie potwierdza konfiguracji zewnętrznego serwera.

**Zakres API (statyczny, niepełny):** licznik wykrył 205 literalnych rejestracji (196 `router.*` w `src/routes/**/*.ts`, 9 `app.*` w `src/app.ts`/`src/mountRoutes.ts`). Dokumentacja miała przed poprawkami 197 wierszy metod w tabelach i 17 opisowych nagłówków endpointów; dodano trzy odczyty Opieki (`GET /api/care/queue`, `/api/care/panel`, `/api/care/notifications`) i zapisano 200 wierszy tabel. Wtedy wykryto też anonimowe `POST /api/auth/logout`, którego wcześniejsza uwaga o trasach publicznych nie obejmowała. Liczby nie są porównaniem unikalnych tras z powodu mountów, aliasów i grupowania; pełnej kontroli semantycznej każdej trasy nie wykonano.

**FACT (parametry potwierdzone w `src/routes/care.ts`):** `/api/care/queue` i `/api/care/panel` przyjmowały `scope`, `cursor`, `limit`, `hidePaused`, `from`, `to`, `repId`; `/api/care/notifications` przyjmowało `scope`, `unreadOnly`, `limit`, `repId`. W raporcie odnotowano poprawienie przykładu w `docs/OPIEKA.md`.

**Walidacja lokalna (2026-11-07):** `npm run validate` zakończył się kodem 0 na świeżej, izolowanej bazie PostgreSQL 18 `sok_test`: 586 suite’ów PASS / 2 SKIP, 5 817 testów PASS / 4 SKIP. Migracje dotyczyły schematów testowych; zwykła baza aplikacji i produkcja nie były używane. `prices:verify` poprawnie zwrócił `SKIP` dla pustego schematu.

**GitHub Actions — chwilowy odczyt (2026-11-07, 12:12 UTC, SHA `fe8bbb3bcba36304e355d37051e4afb310c1f143`):** `Typecheck (tsc)`, `Lint (ESLint + Prettier)` i `Analyze (javascript-typescript)` były zakończone sukcesem; `Test (Jest)` pozostawał `in_progress`. To nie był pełny wynik CI ani dowód wdrożenia. [Workflow CI](https://github.com/blodytrav3l3r/Oferty_PV/actions/runs/42370292127) · [CodeQL](https://github.com/blodytrav3l3r/Oferty_PV/actions/runs/42370292162).

**UNKNOWN/TODO (w tamtym przeglądzie):** czysta instalacja Linux i produkcyjny cutover nie były potwierdzone; wymagania RPO/RTO oczekiwały decyzji operatora i restore drill. Zachowano jako ograniczenia wymagające nowego dowodu.

## Ocena dokumentacji

- **Przed aktualizacją: 5/10.** Pokrycie szerokie i ograniczenia częściowo jawne, ale aktualne metadane były niezgodne z HEAD, workflow contributorów przeczył `AGENTS.md`, a kluczowym katalogom brakowało indeksów.
- **Po aktualizacji: 7/10.** Poprawiono sprzeczne aktywne instrukcje, oddzielono bieżący checkpoint od historycznych SHA/wyników, dopisano indeksy ADR/agentów/planów i sprostowano wybrane twierdzenia operacyjne na podstawie kodu. Nadal brakuje pełnej weryfikacji semantycznej wszystkich dokumentów, statusu 24 niesarchiwizowanych planów, procedur UI w przeglądarce, bieżącego wyniku CI i dowodów z serwera Linux/produkcji.

Ocena 7/10 dotyczy jakości dokumentacji po tym ograniczonym przeglądzie, a nie kompletności produktu ani gotowości operacyjnej.

## Raport bazowy — stan na HEAD 5ab15ac0

Poniższe ustalenia, inwentarz, macierz pokrycia i wyniki weryfikacji opisują audyt wykonany 2026-11-06 na SHA `5ab15ac077d8eb94e66bcb08bac9d3c19d09f53f`. Traktuj je jako historyczne, dopóki nie zostaną ponownie sprawdzone na aktualnym HEAD.

## Podsumowanie raportu bazowego

**FACT:** provider Prisma to PostgreSQL, klient używa `@prisma/adapter-pg`, a Prisma kieruje do kanonicznych migracji `prisma/migrations-postgresql/` (`prisma/schema.prisma:7-12`, `prisma.config.ts:4-12`, `src/prismaClient.ts:4-18`). Docker/Compose i workflows używają PostgreSQL 18; instalatory przygotowują tę bazę. Świeża instalacja importuje zatwierdzony pakiet `data/pricelists/active-pricelists.json`.

**VERIFIED (2026-11-06):** `npm run test:installer-linux` zakończył się kodem 0. Przeszły polityki Windows/Linux, kontrola recovery przerwanej inicjalnej migracji i `tests/scripts/postgresOnlySurface.test.cjs` dla 310 runtime plików. Test składni/pomocy wymagający Bash był `SKIP`, bo Bash nie jest dostępny w tym środowisku. Jest to skan regresyjny, nie dowód działania aplikacji w czystym Linux.

**Wniosek ograniczony:** w zbadanych aktywnych ścieżkach nie ma zależności wykonawczej od SQLite. Historyczne teksty i negatywne testy nie dowodzą, że repo nie zawiera żadnego ciągu `sqlite`; historyczne decyzje nie powinny być przepisywane ani traktowane jako konfiguracja runtime.

Archiwalny inwentarz `SQLITE_REFERENCES_HEAD_5AB15AC0.md` zawiera 563 dopasowania tekstowe w 127 plikach. Raport `SQLITE_POSTGRESQL_CLEANUP_AUDIT.md` dotyczy stanu na `81a68d1a`. Oba szczegółowe raporty pozostają w lokalnym archiwum projektu.

## Mapa zależności i pozostałości SQLite

| Klasyfikacja                                         | Lokalizacje / przykłady                                                                                                                                                              | Zastosowanie                                                                                                                  | Decyzja i ryzyko                                                                                                                                     |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ACTIVE — nie znaleziono w sprawdzonych ścieżkach** | `src/`, `prisma/schema.prisma`, `prisma.config.ts`, `prisma/migrations-postgresql/`, `server.ts`, instalatory, Docker/Compose                                                        | Runtime PostgreSQL przez PrismaPg; migracje PostgreSQL                                                                        | Brak wykrytego aktywnego SQLite API, providera, drivera lub konfiguracji. Ograniczenie: nie jest to formalny dowód każdego środowiska produkcyjnego. |
| **TEST**                                             | `tests/prismaClient.requiresDatabaseUrl.test.ts:41,58-59`; `tests/scripts/postgresOnlySurface.test.cjs:34-79`; `tests/restoreGuards.test.ts:15,127`; `tests/ci/e2eIsolation.test.ts` | Sprawdza odrzucanie SQLite/ścieżek lokalnych i blokuje powrót do dwóch silników                                               | Zachować. To testy negatywne i regresyjne, a nie testy działające na SQLite.                                                                         |
| **CONFIG / GUARD**                                   | `scripts/check-appname.cjs:102`; `scripts/encoding-integrity.js:29`; `scripts/migrate-diff-check.mjs:36`; reguły ignore/lint/tsconfig                                                | Odrzucanie albo ignorowanie niepożądanych plików/zmian SQLite                                                                 | Zachować. Usunięcie mogłoby osłabić ochronę repo przed artefaktami lub zmianami providera.                                                           |
| **OBSOLETE / historia decyzji**                      | `docs/adr/ADR-001-sqlite.md`; `docs/adr/ADR-012-single-node-sqlite.md`; historyczne audyty/plany/changelog                                                                           | Opis superseded decyzji i historii                                                                                            | Oznaczyć jako historyczne; nie usuwać historii bez osobnej potrzeby. Bieżący standard jest w `docs/DATABASE.md`.                                     |
| **OBSOLETE / usunięte z bieżącego drzewa**           | stare migracje SQLite i jednorazowy eksporter migracyjny                                                                                                                             | Nie są runtime ani częścią świeżej instalacji; nie znajdują się w bieżącym repozytorium według konfiguracji i inwentarza HEAD | Nie odtwarzać. Historia Git pozostaje niezmieniana.                                                                                                  |
| **FALSE POSITIVE / metadane zależności**             | metadane opcjonalnego peer dependency w `package-lock.json` (Prisma ecosystem)                                                                                                       | Opis peer dependency nie jest aktywnym pakietem runtime                                                                       | Nie edytować lockfile ręcznie. Weryfikować drzewo npm zamiast klasyfikować tekst metadanych jako użycie.                                             |
| **UNKNOWN**                                          | dowolne środowisko produkcyjne poza lokalnie kontrolowanym repo                                                                                                                      | Nie wykonano inspekcji zewnętrznych serwerów/obrazów ani danych operatora                                                     | Przed cutoverem sprawdzić własny deployment i wykonać backup/restore drill.                                                                          |

### Weryfikacja powierzchni zależności

- Prisma: `provider = "postgresql"`; adapter `PrismaPg`; URL PostgreSQL walidowany bez domyślnego fallbacku.
- Migracje: tylko kanoniczna ścieżka `prisma/migrations-postgresql/`; bazowa migracja tworzy schemat, kolejne wprowadzają PostgreSQL-specific trigger/index invariants.
- Instalacja: oba warianty używają zatwierdzonego JSON aktywnych cenników; źródło: `scripts/import-active-pricelists.ts`, `install-linux-server.sh`, `scripts/setup-new-pc.ps1` oraz `docs/cutover/active-pricelists.md`.
- Backup/restore: `pg_dump`/`pg_restore` i archiwum PostgreSQL; `scripts/backup.ts`, `scripts/restore-db.js`, test odtworzenia `tests/migrations/restoreRoundtrip.test.ts`.
- CI: PostgreSQL 18 w `.github/workflows/ci.yml`, `.github/workflows/postgres-docker.yml` i `.github/workflows/release.yml`.
- Frontend nie łączy się bezpośrednio z DB; ścieżka danych idzie przez Express API (`docs/agents/frontend.md`, `src/app.ts`, `src/mountRoutes.ts`).

## Inwentaryzacja dokumentacji i decyzje

| Źródło                                                                                                                                             | Zakres                                  | Ocena / decyzja                                                                                                                                                                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `README.md`, `docs/instalacja-krok-po-kroku-dla-laika.md`, `docs/instalacja-przenoszenie-systemu.md`                                               | Start, instalacja i przenoszenie        | Zachować jako instrukcje operatora; nowy `docs/README.md` zapewnia nawigację.                                                                                                                                                                            |
| `docs/ARCHITECTURE.md`, `docs/agents/backend.md`, `docs/agents/frontend.md`, `docs/adr/ADR-002-*`, `ADR-004-*`, `ADR-005-*`, `ADR-014-*`           | Monolit Express/SPA/iframe/Prisma       | Zachować i uzupełnić o mapę tras. Nie zmieniać decyzji o SPA ani serwerze.                                                                                                                                                                               |
| `docs/DATABASE.md`, `docs/agents/database.md`, `docs/cutover/active-pricelists.md`                                                                 | PostgreSQL, migracje, cenniki           | SSoT DB/cutover; zachować.                                                                                                                                                                                                                               |
| `docs/API.md`                                                                                                                                      | Opisane grupy endpointów i kontrakty    | Rozbudowany dokument; zachować. Przed dopisaniem nowego kontraktu sprawdzić route, validator i test. `GET /api/docs.json` udostępnia wygenerowaną specyfikację (`src/app.ts:249-252`).                                                                   |
| `docs/SYSTEM_INVARIANTS.md`, `docs/MONEY_ROUNDING.md`, `docs/CENNIKI-INSTRUKCJA-ADMINA.md`, `docs/OPIEKA.md`, `docs/import-export/ARCHITECTURE.md` | Reguły domenowe i użytkowe              | SSoT do linkowania; uzupełnić brakujące połączenia przepływów bez dublowania wzorów.                                                                                                                                                                     |
| `docs/SECURITY.md`, `docs/security/permission-matrix.md`                                                                                           | Zabezpieczenia i role                   | SSoT bezpieczeństwa; linkować z runbooków.                                                                                                                                                                                                               |
| `docs/DEPLOYMENT.md`, `docs/DEPLOY_UPDATE.md`, `docs/DEPLOY_HTTPS_IT.md`, `docs/DATABASE.md`                                                       | Wdrożenie, aktualizacje, backup/restore | Zachować jako operacyjne SSoT; status Linux i produkcji raportować oddzielnie od testu lokalnego.                                                                                                                                                        |
| `.github/workflows/*.yml`, `package.json`, `docs/agents/testing.md`                                                                                | Testy i automatyzacja                   | Konfiguracja jest prawdą dla triggerów; macierz testów ma być indeksem, nie zastępować YAML.                                                                                                                                                             |
| `docs/audits/`, `docs/plans/`, `docs/adr/ADR-001-sqlite.md`, `ADR-012-single-node-sqlite.md`                                                       | Audyty, plany i decyzje historyczne     | Zachować historię; oznaczać superseded/archival. Dokumenty z 2026-11-06 nie mogą przedstawiać ich jako bieżącej konfiguracji. Nie znaleziono odrębnego, wskazanego commitem artefaktu „Wersji Bazowej”; dla tego audytu źródłem stanu jest HEAD powyżej. |

## Mapa pokrycia zakresu

| Zakres                               | Aktualny SSoT                                                                                                                                                                     | Status na HEAD                                                                                                                                                                                                                                                                               |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Architektura frontend/backend/DB     | `ARCHITECTURE.md`, `DATABASE.md`, [mapa runtime](architecture/runtime-and-module-map.md), [diagramy przepływów](architecture/data-flows.md)                                       | **FACT/INFERENCE**; diagramy opisują potwierdzone warstwy i wybrane przepływy, nie każdą trasę.                                                                                                                                                                                              |
| Kontrakty API                        | `API.md`, `/api/docs.json`, [mapa prefix→router](architecture/runtime-and-module-map.md)                                                                                          | **PARTIAL**: niezależny przegląd tras znalazł i uzupełnił 4 brakujące endpointy (telemetria draft-failure i 3 operacje wersji cenników) oraz skorygował opis częściowego OpenAPI. Nie wykonano pełnej, każdej metody/ścieżki, authZ, walidatora i payloadu weryfikacji wszystkich ~100 tras. |
| Oferty, cenniki, wersjonowanie, ceny | `SYSTEM_INVARIANTS.md`, `API.md`, `MONEY_ROUNDING.md`, [przepływy](business-logic/offer-pricelist-draft-flows.md), [kalkulacje i Excel](business-logic/calculations-and-excel.md) | **FACT/INFERENCE/UNKNOWN**; wzory i luki są rozdzielone, pozostają pytania o parity i akceptację domenową.                                                                                                                                                                                   |
| Excel/import/eksport                 | `import-export/ARCHITECTURE.md`, `agents/frontend.md`, `contracts/excel-boundary.json`, [kalkulacje i Excel](business-logic/calculations-and-excel.md)                            | **FACT/UNKNOWN**; wzory i wybrane kształty są potwierdzone, pełna lista szablonów oraz końcowy parity pozostają poza zakresem.                                                                                                                                                               |
| PostgreSQL/Prisma/migracje           | `DATABASE.md`, `agents/database.md`, schema i migracje                                                                                                                            | **FACT**; drift należy potwierdzić na czystej bazie PostgreSQL 18.                                                                                                                                                                                                                           |
| Instalacja i wdrożenie               | README, instalatory, `DEPLOYMENT.md`, `DEPLOY_UPDATE.md`                                                                                                                          | Windows/Compose istnieją; czysty Linux i produkcyjny cutover **UNKNOWN / niepotwierdzone**.                                                                                                                                                                                                  |
| Bezpieczeństwo                       | `SECURITY.md`, `agents/security.md`, `permission-matrix.md`                                                                                                                       | **FACT** dla opisanego kodu; stan zewnętrznego serwera **UNKNOWN**.                                                                                                                                                                                                                          |
| Backup/DR                            | `DATABASE.md`, `DEPLOYMENT.md`, backup scripts                                                                                                                                    | Mechanizmy opisane; docelowe RPO/RTO nieustalone (**TODO**). Listing archiwum nie zastępuje restore drill.                                                                                                                                                                                   |
| Testy i CI/CD                        | `agents/testing.md`, workflows, nowa [macierz PostgreSQL i CI](testing/postgres-install-ci-matrix.md)                                                                             | Trigger/status jobów zależny od YAML; status zdalnych Check Runs dla SHA `5ab15ac0` zweryfikowany o 2026-11-06 06:07 UTC: 15 sukcesów, 1 pominięty deploy produkcji; brak failure/in_progress w odczytanej kolekcji.                                                                         |
| Użytkowanie modułów                  | [Przewodnik sześciu modułów](user-guide/modules-and-workflows.md), HTML/JS, API i inwarianty                                                                                      | **PARTIAL**: funkcje, źródła i ograniczenia są opisane; krok-po-kroku dla wszystkich formularzy/importów/wydruków pozostaje **TODO** i wymaga pełnego audytu UI/E2E.                                                                                                                         |

## Luki i ryzyka pozostawione jawnie

1. **PostgreSQL schema hardening — INFERENCE/RISK:** część dat i snapshotów w `prisma/schema.prisma` pozostaje tekstem/serializowanymi danymi, a niektóre relacje domenowe nie są jawnie znormalizowane. To nie jest zależność SQLite. Każda zmiana typów/relacji wymaga osobnego projektu z analizą kompatybilności danych, kontraktów JSON, migracji, backfillu i parytetu.
2. **Linux fresh-install — UNKNOWN:** istnienie skryptu i testu polityki nie dowodzi end-to-end instalacji na czystym Linuxie. Potrzebny izolowany host/test VM, PostgreSQL 18, Compose/systemd i smoke przebiegu.
3. **Production cutover — UNKNOWN:** repo nie jest dowodem ustawienia sekretów, backupu, TLS i stanu serwera produkcyjnego.
4. **CI status — VERIFIED w chwili odczytu, może się zmienić:** GitHub Check Runs dla SHA `5ab15ac0` o 2026-11-06 06:07 UTC zwróciły 16 pozycji: 15 zakończonych sukcesem i 1 `skipped` (`Deploy — produkcja (main)`), bez `failure` ani zadań `in_progress`. To nie dowodzi deploymentu — produkcja została pominięta. Osobny workflow PostgreSQL Docker nie pojawił się w tej kolekcji. [CI run](https://github.com/blodytrav3l3r/Oferty_PV/actions/runs/42168183394) · [CodeQL](https://github.com/blodytrav3l3r/Oferty_PV/actions/runs/42168183525).
5. **Kompletność instrukcji użytkownika — TODO:** niezależny QA potwierdził pokrycie sześciu modułów, ale przewodnik nie podaje krok-po-kroku dla tworzenia/zapisu/zamówień/wydruków w Rurach i Studniach, filtrów/importu/eksportu kartoteki, operacji Zleceń, procesu wersji cennika ani administracji pulpitu. Dodać te procedury na podstawie pełnego UI/E2E, bez domysłów.
6. **API route-by-route — TODO:** przegląd próbek znalazł i poprawił cztery pominięte endpointy; kompletny katalog każdej metody, authZ, walidacji, statusu i kształtu żądania/odpowiedzi dla wszystkich tras nadal wymaga osobnej macierzy.
7. **RPO/RTO — TODO:** wartości wymagają decyzji właściciela operacji i testu odtworzenia.
8. **Kontrakt iframe — RISK:** ADR-014 zabrania bezpośrednich wywołań metod modułu z parenta, a bieżący router zawiera takie wywołania nawigacyjne (`public/js/spa/router.js:620-625,790-873`). Mapa runtime opisuje oba fakty; należy zaktualizować ADR lub kod w osobnym, zatwierdzonym zadaniu i dodać test kontraktu. Nie zmieniono tu zachowania UI.

### Wzorzec PostgreSQL 18 do przyszłych zmian schematu

**VERIFIED — dokumentacja producenta:** PostgreSQL 18 udostępnia typy `date`, `timestamp` i `timestamp with time zone`, dokładne `numeric/decimal`, a reguły integralności w postaci `CHECK`, `NOT NULL`, `UNIQUE`, `PRIMARY KEY` i `FOREIGN KEY`. Zalecenia do ewentualnego hardeningu muszą być oceniane przy zachowaniu serializacji Prisma/JSON i kompatybilności istniejącego API; obecny tekstowy timestamp nie zostaje automatycznie uznany za błąd bez oceny semantyki pola.

- [PostgreSQL 18 — Constraints](https://www.postgresql.org/docs/18/ddl-constraints.html)
- [PostgreSQL 18 — Date/Time Types](https://www.postgresql.org/docs/18/datatype-datetime.html)
- [PostgreSQL 18 — Numeric Types](https://www.postgresql.org/docs/18/datatype-numeric.html)
- [PostgreSQL 18 — SQL Dump](https://www.postgresql.org/docs/18/backup-dump.html)

## Weryfikacja tej dokumentacji

- **PASS:** Prettier `--write`, następnie `--check` na plikach zmienionych w tym audycie.
- **PASS:** `git diff --check`.
- **PASS:** własny lokalny link checker rozwiązał Markdown ścieżki do istniejących plików w zmienionych dokumentach; zewnętrzne URL i fragmenty nagłówków nie były weryfikowane sieciowo.
- **PASS:** `npm run version:check` potwierdził spójność 1.56.5.
- **PASS:** `npm run test:installer-linux` — testy polityk Windows/Linux, recovery i PostgreSQL-only surface; **SKIP** tylko kontrole wymagające Bash.
- **NOT RUN:** `npx jest --runInBand --no-coverage tests/pricelistExportLive.test.ts tests/pricelistWriteTargetRoutes.test.ts` zatrzymał się przed uruchomieniem testów, bo środowisko nie ma `POSTGRES_TEST_URL` (2 suite failed setup, 0 tests). Nie łączono się z bazą i nie wykonano zmian.
- **NOT RUN:** pełne `npm run validate`, E2E, build i integracyjne migracje PostgreSQL — brak jawnego URL do izolowanej testowej bazy. Nie ustawiono fallbacku i nie użyto live DB.
- **NOT RUN:** migracje, seedy, backup/restore live, restart, deployment lub inne operacje produkcyjne.
