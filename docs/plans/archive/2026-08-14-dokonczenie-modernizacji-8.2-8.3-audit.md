# Plan: Dokończenie modernizacji — 8.2 baseline migracji, 8.3 flaky detection, npm audit fix

> Status: **W TRAKCIE** — Faza C zakończona i zacommitowana (54f055e); A1 GATE #1 ✓, A2 GATE #2 ✓, A3/A4/A4.5 zielone; skrypty A1/A5 napisane.
> Data: 2026-08-14
> Rewizja: **v4.9** (v4.8 + korekty z implementacji: (1) Prisma 6.19.3 — `migrate diff` używa `--from-schema-datasource`/`--to-schema-datamodel` zamiast `--from-database`/`--to-schema`; (2) GATE #1 i A5 guard #3 **FTS5-aware** — tabele FTS5 (`offers_search_fts*`) tworzone runtime przez `ensureFts5Schema()` (src/utils/fts5Sync.ts) NIE istnieją w schema.prisma (Prisma nie obsługuje FTS5) i są oczekiwaną różnicą na każdej bazie po auto-heal — diff nigdy nie będzie pusty, filtr w `scripts/prisma-diff-utils.mjs`; (3) A3 wymaga **izolowanego projektu** (baseline po 14 starych migracjach = `CREATE TABLE` na istniejących = błąd deploy — test musi kopiować baseline do `tests/tmp/`); (4) **skrypt A5 `db-to-migrations.mjs` powstaje razem z testami A4** (test A4 go woła) — korekta sekwencji: A5 skrypt przed A4.6; (5) `db-to-migrations.mjs` przyjmuje opcjonalny katalog projektu (`tests/tmp` izolacja); (6) backup pre-baseline w skrypcie trafia do `data/backups/` w katalogu projektu)
> Powiązany plan: `docs/plans/2026-08-14-modernizacja-testy-stabilizacja.md` (fazy 8.2/8.3 odłożone).

## Kontekst techniczny (ustalone fakty — zweryfikowane)

| Fakt                                 | Wartość                                                                                                                             |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Baza prod `data/app_database.sqlite` | typ **`db push`**, **brak** `_prisma_migrations`                                                                                    |
| Pliki `-wal` / `-shm` w `data/`      | ⚠️ baza **otwarta przez aktywny proces** (backend działa) — `VACUUM INTO` bezpieczny przy aktywnym połączeniu; restart nie wymagany |
| `data/tmp_shadow.sqlite` (606KB)     | pozostałość po `migrate diff` — **ignorowana przez git** (`data/*.sqlite*`), ale zostaje śmieć na dysku; cleanup wymagany           |
| Migracje w repo                      | 14 katalogów (od `20260611000000_init` do `20260814000000_pz_element_key`)                                                          |
| `install.bat`                        | `migrate deploy` → fallback `db push --accept-data-loss` (linie 119–125) — **tylko instalacyjny bootstrap**                         |
| `ensure-db.bat`                      | zawsze `db push --skip-generate --accept-data-loss` (linia 35) — **start/prod path**                                                |
| Auto-heal w `src/app.ts`             | indeksy telemetrii (363–366), feature-flag (390) — istnieją **tylko** z powodu ograniczeń `db push`                                 |
| Prisma                               | `^6.0.0` — `migrate resolve --applied` dostępne; `WITHOUT ROWID` w schemacie: **brak**                                              |
| Jest                                 | 30.4.2 — **`--json --outputFile` wbudowane** (potwierdzone w help); `jest-junit` NIEPOTRZEBNY                                       |
| `scripts/restore-db.js`              | ✅ istnieje (`npm run restore`) — testowalny                                                                                        |
| Backup                               | `npm run backup` → `VACUUM INTO` → `data/backups/`                                                                                  |
| CI actions                           | `checkout@v7`, `setup-node@v6` — **już użyte** w istniejącym `ci.yml` (potwierdzone, nie zmieniam)                                  |
| Audit                                | 4 fixy non-major (`body-parser`, `nanoid`, `ip-address`, `js-yaml`), `puppeteer` = major (nie w tym planie)                         |

**Cel:** squash migracji do 1 baseline, konwersja prod przez `migrate resolve --applied` (addytywna — tylko metadane), flaky detection w CI (report, nie blokuje), zamknięcie podatności non-major.

**Nadrzędna zasada:** po konwersji produkcja jest zarządzana przez `prisma migrate deploy`; `db push` **nie może automatycznie ratować** nieudanego deploymentu migracji w ścieżce startowej.

**Model migracji produkcyjnej (weryfikowany w tej kolejności):**

```
PROD = schema ──GATE#1──→ baseline ──GATE#2──→ test legacy conversion ──→ test future migration
   ──→ BACKUP ──→ resolve --applied ──→ migrate status ──→ smoke test ──→ migration-managed PROD
```

---

## Faza C — npm audit fix (najpierw: małe, bezpieczne)

### C1. `npm audit fix` (bez `--force` — tylko non-major)

- Spodziewany efekt: `body-parser` 1.20.5→1.20.6+, `nanoid` (przez docx), `ip-address` (przez socks), `js-yaml` → 4.3.1+

### C1.5. Reprodukowalność lockfile — sekwencja z `prisma generate`

```
npm audit fix
→ npm ci                          (świeże node_modules z lockfile)
→ npx prisma generate             (BEZ TEGO: brak generated/prisma → validate padnie)
→ npm audit --omit=dev            (końcowy stan ZAINSTALOWANYCH deps)
→ npm run validate                (typecheck + lint + test:quick)
```

- **KROK WSTĘPNY (C1.5b):** zatrzymać backend (zamknąć proces node serwera) **PRZED** `npm ci`/`generate` — pliki WAL potwierdzone otwarte; inaczej EPERM na node_modules / DLL query engine.
- **EPERM risk:** jeśli mimo zatrzymania EPERM — ponowny `npm ci` po pełnym stopie; **NIE maskować** (validate wychwyci braki). Jedyny krok z realną szansą na ręczną interwencję.
- **Ryzyko/mitigacja:** żadna z tych deps nie jest w gorącej ścieżce; validate przed i po.

### C2. Test regresyjny `tests/security/bodyParserLimit.test.ts` — kontrakt z DWÓCH stron

- `supertest` + `express` z `bodyParser.json({ limit: '1kb' })`
- **Oba przypadki:** payload `< limit` → `200`, payload `> limit` → `413`
- Test nie przechodzi przypadkiem przez błędnie skonfigurowany endpoint (regresja CWE-1123977 = limit cicho wyłączony)
- **Weryfikacja:** `node -c`, test zielony, `npm run lint`

### C3. Pominięte: `puppeteer` major bump (25.7.0) — **nie w tym planie**

- To bump semver-major zależności e2e/PDF; wymaga osobnej weryfikacji testów Playwright. Świadoma decyzja — nie robić `audit fix --force` tylko dla "0 vulnerabilities".

### R11 (v4.6) — jednoznaczny DoD C1

- **DoD:** `npm audit --omit=dev` → **0 unresolved non-major advisory** + **jawna lista zaakceptowanych wyjątków**: `puppeteer` major = świadomie odroczony (osobny plan). Unika sytuacji "audit → 1 vuln → uznana za major → plan 'zielony'".

**Commit:** `chore(deps): aktualizacja podatnych zależności non-major`

---

## Faza A — 8.2 Baseline + konwersja db push → migrations

### A1. Weryfikacja zgodności schematu z bazą (GATE #1 — twardy STOP)

```
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code
```

- **Kryterium (v4.9 — FTS5-aware):** diff musi być pusty **po wykluczeniu tabel FTS5** (`offers_search_fts*`). FTS5 to VIRTUAL TABLE tworzona runtime przez `ensureFts5Schema()` (src/utils/fts5Sync.ts) — Prisma NIE obsługuje FTS5 w schema.prisma, więc te 6 tabel (`offers_search_fts`, `_config`, `_content`, `_data`, `_docsize`, `_idx`) SĄ oczekiwaną różnicą na każdej bazie po auto-heal. **Diff bez filtra NIGDY nie będzie pusty** (wykryte w implementacji 2026-08-14). Filtr: `scripts/prisma-diff-utils.mjs` (`nonFts5Changes`).
- **Uwaga (v4.9):** Prisma 6.19.3 usunęło `--from-database`/`--to-schema` — odpowiedniki: `--from-schema-datasource` (baza z datasource) / `--to-schema-datamodel`.
- **Uwaga:** A1 NIE jest w 100% read-only — `migrate diff` tworzy shadow DB (`tmp_shadow.sqlite`). Świadome; po diff **cleanup** `data/tmp_shadow.sqlite`.
- **Weryfikacja:** skrypt automatyczny `scripts/migrate-diff-check.mjs` (wrap CLI, raportuje pusty/niepusty, exit code, usuwa shadow) + test fixture
- **Ryzyko:** wykrycie dryfu = zmiana zakresu; dokumentować znalezione różnice

### A2. Generacja baseline (squash) + GATE #2 (formalny, niezależny od A1)

```
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/20260815000000_baseline/migration.sql
```

**GATE #2 — baseline musi reprezentować aktualną bazę (nie tylko diff A1):**

```
PROD DB ──diff──→ schema.prisma ──(A1)──→ PUSTY (poza FTS5)
baseline.sql ──→ świeża DB → migrate deploy ──diff──→ schema.prisma ──→ PUSTY
```

- **Jawna weryfikacja SQLite-specific w `migration.sql`** (nie tylko przez diff): indeksy (w tym auto-heal `idx_logs_well`/`idx_logs_source_well`), unique constraints, foreign keys, wartości domyślne, typy SQLite, kolejność tworzenia tabel zależnych. (`WITHOUT ROWID` — nie występuje w schemacie, nie dotyczy.) **Uwaga (v4.9):** baseline NIE zawiera tabel FTS5 (poprawne — FTS5 tworzone runtime).
- **Kryterium:** baseline = pełny DDL obecnego schematu; oba diffy (A1 + GATE A2) puste (A1 poza FTS5).
- **Weryfikacja wykonana (v4.9):** GATE #2 zielony — baseline na świeżej bazie → `migrate deploy` (1 migracja) → `No difference detected` (exit 0). Baseline: 37 tabel, 62 indeksy, indeksy telemetrii na miejscu.

### A2a. COMMIT 1 — baseline + testy (stare migracje NADAL istnieją)

- Dodanie `prisma/migrations/20260815000000_baseline/migration.sql` + testy A3/A4/A4.5. (**A4.6 NIE w tym commicie** — zależy od R1/R1b, patrz niżej.)
- Stare 14 migracji zostają → punkt diagnostyczny: porównaj `stare→schema` vs `baseline→schema` zanim cokolwiek skasuję.

### A5. Skrypt konwersji — `scripts/db-to-migrations.mjs` (v4.9: powstaje RAZEM z testami A4 — A4 test go woła; PRZED usunięciem starych migracji)

- Przyjmuje: ścieżkę bazy (default `data/app_database.sqlite`) + nazwę migracji baseline + opcjonalny **katalog projektu** (v4.9 — izolacja `tests/tmp/` dla testów; default = root repo)
- **Hard guards — skrypt ODMOWIĄ działania przy:**
    1. baza nie istnieje → `ERROR: database does not exist`
    2. baseline nie istnieje → `ERROR: migration does not exist`
    3. diff ≠ puste **poza FTS5** (v4.9 — ten sam filtr `nonFts5Changes` co GATE #1) → `ERROR: database schema differs from Prisma schema — REFUSING TO RESOLVE`
    4. `_prisma_migrations` już istnieje → STOP (baza częściowo migration-managed — nie ślepe `resolve --applied`)
- **Mechanizm env (kluczowe):** `prisma migrate resolve` czyta bazę z **env**, nie z argumentu → skrypt spawnuje CLI z `env: { ...process.env, DATABASE_URL: 'file:' + path.resolve(dbPath) }` + sanity (resolved path istnieje)
- **Własny backup z jednoznaczną nazwą:** `backup_pre_baseline_<timestamp>.sqlite` przez `VACUUM INTO` — NIE kruche `ren` z wildcardem; trafia do `<katalog_projektu>/data/backups/`
- **Cleanup shadow DB** po operacji (`data/tmp_shadow.sqlite`)
- Kroki (atomowy proces operacyjny): backup → diff sanity (pusty, hard guard) → `migrate resolve --applied` → `migrate status` raport
- **Weryfikacja:** pokryta testami A4/A4.5; `node -c`

**Status (v4.9):** ✅ napisany i przetestowany end-to-end (A4 zielony).

### A2b. COMMIT 3 — usunięcie 14 starych katalogów migracji

- **Dopiero po zielonych testach A3/A4/A4.5/A4.6** (git zachowuje historię — to bezpieczne; squash konieczny, bo init+baseline na końcu = `CREATE TABLE` na istniejących = błąd deploy)
- **Dokumentacja:** _„Usunięcie katalogów starych migracji jest zmianą historii Prisma, ale nie zmianą historii Git"_ — Prisma będzie znała tylko `20260815000000_baseline`; to zamierzone i prawidłowe.

### A3. Test automatyczny baseline — `tests/migrations/baseline.test.ts`

Scenariusz — **izolowany projekt Prisma** w `tests/tmp/<name>/` (v4.9 — korekta z implementacji: baseline po 14 starych migracjach w katalogu repo = `CREATE TABLE` na istniejących = błąd deploy; test kopiuje baseline do temp projektu z własnym `prisma.config.ts` i `DATABASE_URL`):

1. `prisma migrate deploy` → exit 0 (TYLKO baseline, 1 migracja)
2. `_prisma_migrations` istnieje, zawiera `20260815000000_baseline` jako `finished`
3. `migrate diff --from-schema-datasource --to-schema-datamodel` → puste (baza == schemat po deploy)
4. **Weryfikacja:** test zielony, działa w CI i lokalnie
5. Cleanup: `tests/tmp/` ignorowane przez git (`.gitignore`), usuwane w `finally` (z retry — Windows lock na `-shm`/`-wal`)

**Status (v4.9):** ✅ zielony.

### A4. Test automatyczny konwersji legacy — `tests/migrations/legacyConversion.test.ts`

Scenariusz (symulacja bazy db-push, bez dotykania prod i repo — izolowany projekt `tests/tmp/`):

1. Temp baza → `prisma db push` (tworzy tabele bez `_prisma_migrations`)
2. Wstaw rekordy testowe (ProductsRury, offers_rel po 1)
3. Uruchom `scripts/db-to-migrations.mjs <baza> <baseline> <katalog_projektu>` → wykona `migrate resolve --applied 20260815000000_baseline`
4. Asercje: `_prisma_migrations` utworzona, baseline `finished`, rekordy **nietknięte** (checksum liczników przed/po)
5. **Dodatkowo:** `migrate deploy` PO `resolve --applied` → `migrate status` = "database schema is up to date"
6. **Weryfikacja:** test zielony

**Status (v4.9):** ✅ zielony.

### A4.5. Test przyszłego workflow — `tests/migrations/futureMigration.test.ts` (najcenniejszy dodatek)

Scenariusz (legacy → baseline → KOLEJNA migracja) — **izolowany projekt Prisma:**

- Test NIE modyfikuje `prisma/migrations/` w repo. Tworzy **tymczasowy katalog projektu Prisma**:

```
tests/tmp/future-migration/
├── prisma/
│   ├── schema.prisma                      (kopia produkcyjnego schematu)
│   └── migrations/
│       ├── baseline/                      (kopia baseline)
│       └── 20260816xxxxxx_test_migration/ (dodaje kolumnę testową)
```

- Test używa workdir na temp katalog + osobny `DATABASE_URL`
- Kroki:
    1. Temp baza → `db push` (na schema z temp) + insert danych
    2. `resolve --applied baseline`
    3. `migrate deploy` → testowa migracja wykonana
    4. `migrate status` = "up to date"
    5. Asercje: nowa kolumna istnieje, dane legacy **nietknięte**
- Zyski: repo nietknięte, deterministyczny, bezpieczny dla równoległego wykonania, prosty cleanup
- Testuje najważniejszy scenariusz produkcyjny: "stara baza oznaczona jako posiadająca baseline, a następna migracja normalnie się stosuje".

**Status (v4.9):** ✅ zielony.

### R1/R1b. (v4.6) `restore-db.js` — docelowa semantyka PRZED A4.6 (MUST CHANGE #4)

- **R1:** `scripts/restore-db.js` woła `migrate deploy` (nie `db push`), z flagą `--yes` (pomija readline "tak/nie").
- **R1b:** aktualizacja WARN w `restore-db.js:40` — `[WARN] Uruchom recznie: npx prisma db push --accept-data-loss` → `[WARN] Uruchom recznie: npx prisma migrate deploy`.
- **Dlaczego przed A4.6:** A4.6 testuje NOWĄ semantykę `restore-db.js` (`--yes` + `migrate deploy`). Jeśli R1/R1b byłoby dopiero w A6 (jak w v4.5), test A4.6 (w commicie A2a) padłby na aktualnym `restore-db.js` (db push, brak `--yes`). Przeniesienie R1/R1b + A4.6 do wspólnego commit 2 czyni test spójnym z kodem.
- **Commit 2 (v4.6):** `chore(deploy): restore-db.js migrate deploy + --yes + test roundtrip` (R1/R1b + A4.6).

### A4.6. Test rollback — `tests/migrations/restoreRoundtrip.test.ts`

Weryfikuje model backupów v4.6 (M1): **pre-baseline = backup techniczny konwersji (legacy restore)**, **post-baseline = normalny backup produkcyjny (`migrate deploy`)**:

**Scenariusz 1 (legacy / pre-baseline — restore PRZEZ kopię pliku, NIE przez `restore-db.js`):** temp DB `db push` + dane → backup (`VACUUM INTO`) → delete wiersza → **przywrócenie przez kopię pliku** (procedura legacy; schemat już w bazie) → dane wracają (checksum przed/po). Dodatkowo asercja strażnika: `restore-db.js --yes` na legacy backupie kończy się **kontrolowanym błędem** (`migrate deploy` fail — brak `_prisma_migrations`) — dowód, że R1 nie nadaje się do legacy.
**Scenariusz 2 (migration-managed / post-baseline):** temp DB `migrate deploy` (baseline) + dane → backup → delete → `restore-db.js --yes` → asercja: dane wracają, `_prisma_migrations` **przetrwała**, `prisma migrate status` = up to date.

### A6. Konwersja realnej bazy prod (jedyne dotknięcie prod — KROK MANUALNY)

**A6.0. Backup pre-baseline (v4.6 = BACKUP TECHNICZNY KONWERSJI, nie zwykły backup produkcyjny)** — tworzony **przez sam skrypt** (`db-to-migrations.mjs`) z jednoznaczną nazwą `backup_pre_baseline_<ts>.sqlite`. Wykonywany **PRZED** `resolve --applied`, więc **NIE posiada `_prisma_migrations`**. Przeznaczenie: **awaryjne cofnięcie PROCESU KONWERSJI (A6)** — nie jest celem standardowego `npm run restore` (który po R1 robi `migrate deploy`).

**A6.1. Konwersja (atomowa) — z zatrzymanym backendem (R8):**

```
1. backup pre-baseline (może przy aktywnym backendzie — VACUUM INTO live-safe)
2. smoke pre-check (aplikacja działa, logowanie OK)
3. STOP backend
4. node scripts/db-to-migrations.mjs data/app_database.sqlite 20260815000000_baseline
   → wewnątrz: backup-pre → diff sanity (pusty, hard guard) → migrate resolve --applied → migrate status raport
5. PRAGMA integrity_check → migrate status → START backend → smoke post-check
```

- **Dlaczego STOP przed `resolve` (R8, v4.6):** `resolve --applied` to **zapis metadanych** (`_prisma_migrations`), nie tylko odczyt. Jednorazowa operacja przejścia prod na nowy model migracji bez równoległego procesu aplikacji = prostsza sytuacja operacyjna. Koszt: kilka minut.

**A6.2. Weryfikacja:**

- `prisma migrate status` = "database schema is up to date", 1 migracja applied
- **`PRAGMA integrity_check;` → oczekiwane `ok`** (tani dodatkowy gate — liczba tabel, liczba rekordów w krytycznych tabelach, `_prisma_migrations`, integralność)
- Aplikacja startuje (`npm run dev:backend`), smoke test logowania

**A6.3. Backup post-baseline (v4.6 = NORMALNY backup produkcyjny):** `npm run backup` (osobny plik, porównywalny z pre-baseline). **PO konwersji posiada `_prisma_migrations`** → jedyne docelowe źródło rollbacku produkcyjnego przez `npm run restore --yes` → `migrate deploy` (R3b).

**A6.4. Cleanup:** `data/tmp_shadow.sqlite` (może zostać odtworzony przez diff sanity)

- **Wording:** `migrate resolve --applied` **nie wykonuje SQL z baseline na istniejących tabelach**; aktualizuje stan historii migracji Prisma.
- **R1 (restore-db.js):** po konwersji `scripts/restore-db.js` woła `migrate deploy` (nie `db push`), z flagą `--yes` (pomija readline "tak/nie"). **(Wykonane w commit 2 — PRZED A4.6, patrz sekcja R1/R1b.)**
- **R1b (restore-db.js:40):** aktualizacja komunikatu WARN w bloku catch — `[WARN] Uruchom recznie: npx prisma db push --accept-data-loss` → `[WARN] Uruchom recznie: npx prisma migrate deploy` (spójność z R1).
- **R3 (v4.6 — podział M1):**
    - **R3a (rollback KONWERSJI, pre-baseline):** `backup_pre_baseline` = backup techniczny bez `_prisma_migrations`. Przywracanie: **kopia pliku** (schemat legacy już w bazie) → opcjonalnie `npx prisma db push --accept-data-loss` dla pewności. **NIE przez `npm run restore`** (od R1 używa `migrate deploy` — na legacy bazie `CREATE TABLE` na istniejących = fail).
    - **R3b (rollback PRODUKCYJNY, post-baseline):** `npm run restore --yes data/backups/backup_<ts>.sqlite` (PO konwersji, migration-managed) → `migrate deploy` (schemat z migracji) → dane z backupu nietknięte → `prisma migrate status` = up to date.
- **Ryzyko:** minimalne — `resolve` dotyka tylko metadanych; rollback konwersji przez R3a (kopia pre-baseline), rollback produkcyjny przez R3b (post-baseline) — każdy zweryfikowany testem A4.6 (scenariusze 1 i 2).

### A7. Aktualizacja skryptów startowych (DOPIERO po udanym A6)

**A7a. (wczesna faza) — zostaje jak jest:** `scripts/ensure-db.bat:35` bez zmian, dopóki prod nie jest skonwertowana.

**A7b. (po udanym A6) — rozróżnienie instalacja vs start/prod:**

- **`scripts/ensure-db.bat` (START/PROD):** twardy `migrate deploy` bez fallbacku:

```
migrate deploy
     ↓
  sukces → OK
     ↓
  błąd  → STOP + log + explicit errorlevel 1
```

- **`install.bat` (INSTALACJA):** fallback `db push` **warunkowany legacy db-push** — patrz korekta v4.1 poniżej. `db push` NIGDY nie wraca do ścieżki startowej.
- `db push` poza tym: development, testy CI, procedura awaryjna RĘCZNA (udokumentowana w `docs/DEPLOYMENT.md`).
- **Manual smoke test `install.bat`:** czysta maszyna / czysta DB → `install.bat` → `migrate deploy` → seed → aplikacja startuje.
- **Weryfikacja:** `ensure-db.bat`/`install.bat` na maszynie testowej; CI test job zostaje na `db push` (szybsze dla pustej bazy testowej).

**Korekta v4.1 — `install.bat` sekcja 8 (potwierdzona analizą):**

Obecny kod (`install.bat:116-126`) warunkuje `migrate deploy` od `if exist migration_lock.toml` — a plik **jest w repo** (`prisma/migrations/migration_lock.toml` istnieje, `provider = "sqlite"`), więc gałąź z fallbackiem `db push` jest wykonywana **zawsze** i nie sprawdza pustości bazy. Po squashu na świeżej bazie `migrate deploy` zadziała (baseline utworzy tabele), ale fallback nadal może zamaskować błąd deploymentu.

Fallback istniał dla bazy **legacy db-push** (tabele + dane, brak `_prisma_migrations`): `migrate deploy` widzi baseline jako pending → próbuje `CREATE TABLE` na istniejących → fail. Scenariusz: `install.bat --skip-seed` + restore starego backupu sprzed konwersji.

Korekta — fallback **tylko gdy baza jest faktycznie legacy db-push** (brak `_prisma_migrations`). **Guard w OSOBNYM skrypcie `scripts/check-legacy-db.js`** (wzorzec `check-db.js`) — NIE inline `node -e` w .bat, bo podwójne cudzysłowy wewnątrz `node -e "..."` są kończone przez cmd.exe na pierwszym wewnętrznym `"` (kruchy quoting). Skrypt zwraca: exit 0 = baza migration-managed (`_prisma_migrations` istnieje), exit 1 = legacy db-push (brak `_prisma_migrations`).

```bat
REM 8. Schema DB
call npx prisma migrate deploy
if errorlevel 1 (
    REM Tylko legacy db-push baza bez historii migracji -> db push awaryjny
    call node scripts/check-legacy-db.js
    if errorlevel 1 (
        echo [INFO] Baza legacy db-push - awaryjny db push
        call npx prisma db push --skip-generate --accept-data-loss
    ) else (
        echo [BLAD] migrate deploy nie powiodl sie na bazie migration-managed.
        pause
        exit /b 1
    )
)
```

- `db push` **tylko gdy:** `migrate deploy` fail ORAZ brak `_prisma_migrations` (baza legacy — nie ma historii do respektowania).
- **Baza migration-managed + deploy fail → STOP** (nie maskuje problemu).
- Po konwersji (A6) każda normalna ścieżka (start, świeża instalacja, restore nowego backupu) działa przez `migrate deploy` bez `db push`.

**`scripts/ensure-db.bat:33-47` (start/prod)** — jak w v4, bez zmian merytorycznych: gałąź exit 1 → `migrate deploy`, fail → STOP; fallback `db push` usunięty. (`check-db.js` nadal rozróżnia pusta/seed vs brak tabel.)

**Korekta v4.2 — dwuznaczny exit 1 w `check-db.js`:** `check-db.js` zwraca exit 1 **dla braku tabel LUB braku indeksów** (`idx_logs_well`/`idx_logs_source_well`). Po przejściu `ensure-db.bat` na `migrate deploy`: brak tabel → deploy tworzy z baseline ✅; brak indeksów → `migrate deploy` nic nie zrobi (wszystko applied) → pętla check_loop (3 próby) → błąd ⚠️. **Mitigacja:** A2 GATE #2 gwarantuje, że baseline **zawiera indeksy telemetrii** (`migration.sql` — jawna weryfikacja SQLite-specific); po udanym `migrate deploy` indeksy istnieją → `check-db` exit 0. Brak zmian w kodzie `check-db.js` (indeksy są w baseline, nie w check-db).

**D1. (v4.4) Smoke A7b — dwa scenariusze (po A6):**

- Świeża baza: `scripts/ensure-db.bat` → `migrate deploy` (baseline) → seed → exit 0.
- Migration-managed: `scripts/ensure-db.bat` → `check-db` exit 0 → szybki exit (bez re-deploy).

**D2. (v4.4) CONTRIBUTING — krok aktualizacji:** sekcja "Aktualizacja schematu" → ścieżka `migrate deploy`; awaryjny `db push` = TYLKO legacy (ręcznie, `--accept-data-loss`). Doprecyzować wg tego planu.

**A7c. (v4.5) `install.sh:76-85` — korekta jak install.bat (Linux installer):**

Ta sama luka co w `install.bat`: fallback `db push` uruchamiany **zawsze** przy istniejącym `migration_lock.toml`, nie sprawdza typu bazy. Korekta — reuse `scripts/check-legacy-db.js` (Node jest dostępny na Linuxie przez installer; **zero nowych plików .sh**):

```sh
if [ -f "prisma/migrations/migration_lock.toml" ]; then
    log STEP "  prisma migrate deploy..."
    npx prisma migrate deploy || {
        if node scripts/check-legacy-db.js; then
            log WARN "Baza migration-managed + deploy fail - STOP"
            exit 1
        fi
        warn "Baza legacy db-push - awaryjny db push"
        npx prisma db push --skip-generate --accept-data-loss
    }
else
    log STEP "  brak migrations - db push"
    npx prisma db push --skip-generate --accept-data-loss
fi
```

- **`migration-managed + deploy fail → STOP`** (exit 1); fallback `db push` tylko dla legacy db-push.
- **Weryfikacja:** `bash -n install.sh` + smoke na czystej bazie + smoke na legacy backup.

**A7d. (v4.5) `scripts/docker-entrypoint.sh:33` — Docker PROD → `migrate deploy`:**

`docker-entrypoint.sh` jest produkcyjną ścieżką startową kontenera (job `docker-build` + `deploy-production` w `ci.yml`, Render) — **obecnie `db push` bezwarunkowo co start** (linia 33). Zmiana: `npx prisma db push --skip-generate` → `npx prisma migrate deploy`, z zachowaniem kolejności:

```
migrate-preco (linie 27-29) → migrate deploy (33) → symlink DB (37-39) → check-db + seed (43-53)
```

- **Brak fallbacku** — kontenery efemeryczne: świeży wolumen → baseline tworzy schemat; migrowany wolumen → no-op. Legacy db-push wolumen (sprzed A6) → rollback ręczny (R3a — kopia pre-baseline).
- **L1/L5 (v4.8 — korekta lokalizacji z v4.7):** aktualizacja komentarzy po przejściu na `migrate deploy`:
    - `scripts/docker-entrypoint.sh:24` — `echo "...zostanie utworzona przez prisma db push."` → "migrate deploy"
    - `scripts/docker-entrypoint.sh:27` — komentarz "przed prisma db push usuwa stare tabele" → "przed migrate deploy" (konsekwencja A7d, opcjonalne)
    - `Dockerfile:32` — komentarz "i db push (docker-entrypoint.sh)" → "i migrate deploy (docker-entrypoint.sh)"
    - (NOTA: to NIE Dockerfile:24 — tam jest `# Budujemy projekt`; tekst "zostanie utworzona przez prisma db push" jest w `docker-entrypoint.sh:24`. Korekta z v4.7.)
    - Zero impaktu na build — tylko komentarze/echo.
- **Weryfikacja:** job `docker-build` health check + manual `docker run` ze świeżym wolumenem → `migrate status` = up to date.

**A7e. (v4.5) `dev.sh:84-85` — jawne stwierdzenie (bez zmiany kodu):**
Linux dev ścieżka (`dev.sh`) **świadomie zostaje na `db push`** (dev dozwolony per plan); produkcja i instalacja = `migrate deploy`. Dopisać do A7b: "Linux dev (`dev.sh`) zostaje na `db push` — szybsze dla iteracji; produkcja i instalacja = `migrate deploy`."

**Spójność z CONTRIBUTING:** awaryjny `db push` na legacy db-push bazie pozostaje **ręczną procedurą** (`npx prisma db push --skip-generate --accept-data-loss`), nie automatycznym fallbackiem — doprecyzować w sekcji "Aktualizacja istniejącej instalacji".

**D3. (v4.5) Dokumentacja — aktualizacja wzmianek o fallbacku `db push`:**

Po A6 (po konwersji prod) zaktualizować sekcje "Aktualizacja istniejącej instalacji / typ bazy" — nowe sformułowanie: _"ścieżka domyślna = `migrate deploy`; `db push` tylko dla baz legacy (bez `_prisma_migrations`), ręcznie, `--accept-data-loss`"_. Zakres:

| Plik                                      | Zakres                                                         |
| ----------------------------------------- | -------------------------------------------------------------- |
| `README.md`                               | linie 91, 113-114, 174, 193-194, 266, 270-271, 323-335         |
| `CONTRIBUTING.md`                         | 129-141 (D2 już; uzupełnić o `install.sh`/`docker-entrypoint`) |
| `AGENTS.md`                               | 347                                                            |
| `CLAUDE.md`                               | 67-71, 222 (check-db exit 1 → `migrate deploy`)                |
| `docs/DEPLOYMENT.md`                      | 45-46, 77, 201-202, 418, 431-445 (już w scope)                 |
| `docs/INSTRUKCJA_SERWER.md`               | 79-80, 97-98, 162-163                                          |
| `docs/INSTALACJA_REFERENCJA.md`           | 104, 136, 179, 234-238, 307-308, 407                           |
| `docs/BACKUP_RESTORE.md`                  | 33, 47-49, 65, 81                                              |
| `docs/DATABASE.md`                        | 576, 634                                                       |
| `docs/SECURITY.md`                        | 289                                                            |
| `docs/instalacja-przenoszenie-systemu.md` | 8, 190-214, 237, 339-377, 410                                  |

- **Nie zmieniać markerów wersji** (tylko treść); po edycjach: `npm run version:check` EXIT=0, `npm run format`, `npm run encoding:check`.
- **Weryfikacja:** grep `db push` w docs → tylko dozwolone legacy/awaryjne konteksty.

### A8. (Opcjonalne, dokumentacja) Auto-heal cleanup

- Nie usuwać kodu z `app.ts` teraz (czysty zakres; najpierw stabilny migration workflow, potem osobny `chore(prisma): remove legacy db push auto-heal`).
- Dopisać komentarz w `app.ts:362`: auto-heal można wyciąć po pełnym przejściu na migracje.

**Commity (rozdzielone, v4.9 — 8-9):**

- `chore(deps): aktualizacja podatnych zależności non-major` ✅ 54f055e (C1 + C2)
- `chore(prisma): baseline migracji + skrypty konwersji + testy` (A2a + A5 skrypt + A3/A4/A4.5 — **v4.9: skrypt A5 w commicie 1**, bo test A4 go woła)
- `chore(deploy): restore-db.js migrate deploy + --yes + test roundtrip` (R1/R1b + A4.6 — **M4: przed A2b**)
- `chore(prisma): usunięcie starych migracji po weryfikacji baseline` (A2b)
- `ci(ci): repeat test job + flaky compare (report mode)` + `test(ci): flakyCompare fixture` (B)
- `chore(deploy): migrate deploy jako jedyna ścieżka w ensure-db` (A7b — dopiero po A6)
- `chore(deploy): migrate deploy w install.sh i docker-entrypoint` (A7c + A7d + A7e — po A6)
- `docs(deploy): aktualizacja dokumentacji po konwersji` (D3: ~11 plików)

---

## Faza B — 8.3 Flaky detection (repeat job w CI, report nie blokuje)

### B1. Reporter — wbudowany `jest --json` (BEZ `jest-junit`)

- **Rezygnacja z `jest-junit`:** wbudowane `jest --json --outputFile=...` (potwierdzone w Jest 30.4.2) — zero nowych zależności, zero ryzyka kompatybilności
- `jest.config.ts` — **bez zmian** (niepotrzebne dodatkowe reporters)
- **Weryfikacja:** `npx jest --no-coverage --json --outputFile=tmp/test.json --silent` tworzy plik JSON; lokalny `npm test` bez zmian

### B2. Skrypt porównawczy — `scripts/flaky-compare.mjs` (parsuje JSON)

- Wejście: 3 ścieżki JSON (`jest --json` output)
- Grupuje przypadki po kluczu unikalności: `testFilePath + assertionResults[].fullName + (location?.line || '')` (pełny kontekst lokalizacji wymaga flagi `--testLocationInResults` w komendach `jest`)
- **M2 (v4.6) — integralność raportu ≠ wynik testów:** walidacja struktury NIE zależy od `results.success` (Jest ustawia `success:false`, gdy jakikolwiek test fail — to NORMALNE; wymóg `success=true` uznałby run z flaky faiłem za INFRA FAIL i uniemożliwiłby wykrycie flaky):
    ```
    INTEGRALNOŚĆ (INFRA FAIL): plik istnieje + JSON parsuje + ma testResults + numTotalTests > 0
    → po integralności: analiza assertionResults[].status (passed/failed/pending/skipped)
    ```
- **Kategorie (v4.6):**
    - `INFRA FAIL` — brak pliku / nieparsowalny JSON / brak wymaganych pól / `numTotalTests == 0`
    - `FLAKY` — test obecny we wszystkich 3 runach, statusy RÓŻNE (fail vs pass między przebiegami)
    - `STABLE FAIL` — fail ×3 (to NIE flaky)
    - `STABLE PASS` — pass ×3
    - `MISSING / INCONSISTENT` (osobna kategoria, nie flaky) — test obecny tylko w 1-2 z 3 runów (test discovery, conditional test, worker crash, timeout infra — cenna informacja diagnostyczna)
- Wyjście: lista flaky (test, przebiegi, ile razy fail) + sekcja missing/inconsistent; exit 0 zawsze (raport)
- **Weryfikacja:** test `tests/scripts/flakyCompare.test.ts` — fixture: 3 JSON (2× pass, 1× fail) → flaky; 3× pass → brak; 3× fail → brak; warianty ze `skipped`, `pending`, `missing`, `numTotalTests == 0` (INFRA FAIL); run z `success:false` (flaky fail) → FLAKY, NIE INFRA FAIL

### B3. Job w CI — `.github/workflows/ci.yml` (osobny plik per run + hard verification)

```yaml
flaky-detect:
    name: Flaky test detection (3x)
    runs-on: ubuntu-latest
    needs: [test]
    if: always() && github.event_name == 'push' && github.ref == 'refs/heads/main'
    continue-on-error: true
    env:
        DATABASE_URL: 'file:./test-ci.sqlite?connection_limit=1&busy_timeout=30000'
    steps:
        - uses: actions/checkout@v7
        - uses: actions/setup-node@v6
          with:
              node-version: '22'
              cache: 'npm'
        - run: npm ci
        - run: npx prisma generate
        - run: npx prisma db push --skip-generate
        - run: npx jest --no-coverage --json --outputFile=junit/run1.json --testLocationInResults --silent
        - run: npx jest --no-coverage --json --outputFile=junit/run2.json --testLocationInResults --silent
        - run: npx jest --no-coverage --json --outputFile=junit/run3.json --testLocationInResults --silent
        - run: node scripts/flaky-compare.mjs junit/run1.json junit/run2.json junit/run3.json
        - uses: actions/upload-artifact@v4
          with:
              name: flaky-report
              path: junit/
              retention-days: 30
```

- **M3 (v4.6) — niezależność od wyniku joba `test`:** `if: always() && github.event_name == 'push' && ...` — detektor uruchamia się **TAKŻE, gdy job `test` zakończy się porażką** (np. flaky test spowodował fail). W v4.5 sam warunek `github.event_name == 'push'` (bez `always()`) powodował, że przy padniętym `test` job `flaky-detect` w ogóle nie startował — dokładnie wtedy, gdy miał wykryć flaky. `continue-on-error: true` — raport nie blokuje merge (zgodnie z modelem report-only).
- **Osobny plik per run** — jawnie gwarantuje `run1 ≠ run2 ≠ run3` (inaczej nadpisanie)
- **DB prep (P3):** `npx prisma db push --skip-generate` na świeżej `test-ci.sqlite` (jak job `test`) — flaky job nie wymaga migracji, tylko schematu
- **Hard verification (F1, v4.6):** `flaky-compare.mjs` wymaga **integralnego raportu** (plik istnieje + JSON parsuje + `testResults` + `numTotalTests > 0`). Brak pliku / niekompletny JSON → `INFRA FAIL` → exit 1 (job failed, NIE "no flaky"). **`results.success` NIE jest sprawdzane** (run z failami ma `success:false` — normalne).
- **Definicja (F1, v4.6):** wspólny fail we wszystkich 3 → `STABLE FAIL`; fail w podzbiorze runów → `FLAKY`; obecność w 1-2 z 3 runów → `MISSING / INCONSISTENT`
- **NIE blokuje** merge (report-only); awaria infrastrukturalna (np. `npm ci`) ≠ znaleziony flaky
- Job ma własne `npm ci` (izolowane środowiska GH Actions); koszt ~3× testów akceptowalny
- 3× = detektor oczywistych problemów, nie statystyczny dowód — świadomy kompromis na start
- **Weryfikacja:** push na `main` → job uruchamia się (także przy failed `test`), artifact `flaky-report` z listą

**P5 (v4.4):** nowe testy (A3/A4/A4.5/A4.6/bodyParserLimit) leżą w `tests/**/*.test.ts` → `npm test` (job CI) uruchamia je automatycznie. Zmiana `ci.yml` dotyczy **tylko** joba `flaky-detect`.

**Commity:** `ci(ci): repeat test job + flaky compare (report mode)` + `test(ci): flakyCompare fixture`

---

## Kolejność wykonania i walidacja końcowa

```
C (audit fix → npm ci → prisma generate → audit --omit=dev → validate) + C2 ✅ COMMIT 54f055e
↓
A1 GATE #1 (PROD=schemat poza FTS5, twardy STOP) + cleanup shadow ✅
↓
A2 generacja baseline + GATE #2 + weryfikacja SQLite-specific ✅
↓
A2a COMMIT 1: baseline + skrypty A1/A5 (migrate-diff-check, db-to-migrations, prisma-diff-utils) + testy A3/A4/A4.5 ✅ (testy zielone; commit pending)
↓
R1/R1b restore-db.js (migrate deploy + --yes + WARN) + A4.6 COMMIT 2 [M4]
↓
A2b COMMIT 3: usunięcie 14 starych migracji (po zielonych A3/A4/A4.5/A4.6)
↓
B (flaky: B1 JSON, B2 flaky-compare [F1 integralność≠success, MISSING/INCONSISTENT], B3 if always() + osobne pliki)
↓
A6 konwersja PROD (R8: backup live → smoke pre → STOP backend → resolve → integrity → status → START → smoke; backup-pre w skrypcie, backup-post po)
↓
A7b (install.bat: fallback db push tylko dla legacy db-push; scripts/ensure-db.bat: twardy migrate deploy) + smoke install.bat
↓
A7c (install.sh: guard legacy + STOP) + bash -n
↓
A7d (docker-entrypoint.sh → migrate deploy) + docker-build health check
↓
A7e (dev.sh: zostaje na db push, tylko docs)
↓
D3 dokumentacja (~11 plików) + version:check/format/encoding:check
↓
Dokumentacja "Production DB migration baseline established"
```

**A7b następuje DOPIERO po udanym A6.** Produkcyjna ścieżka po zakończeniu:

```
PROD db push
↓ A1 schema verification
↓ backup pre-baseline (w skrypcie) — BACKUP TECHNICZNY KONWERSJI (R3a: rollback awaryjny przez kopię pliku)
↓ smoke pre-check → STOP backend (R8)
↓ resolve --applied
↓ migrate status + PRAGMA integrity_check → START backend → smoke post-check
↓ backup post-baseline (npm run backup) — NORMALNY backup produkcyjny (R3b: restore → migrate deploy)
↓ A7b/A7c/A7d: wszystkie ścieżki startowe → migrate deploy
   ├─ Windows: scripts/ensure-db.bat, install.bat (fallback legacy)
   ├─ Linux:   install.sh (guard legacy), dev.sh (db push — dev świadomie)
   └─ Docker:  scripts/docker-entrypoint.sh (migrate deploy, brak fallbacku)
```

Po każdym commicie:

1. `npm run validate` (typecheck + lint + test:quick)
2. `npm run format`
3. `npm run version:check` (obowiązkowe, wersja bez zmian — tylko walidacja)
4. `npm run encoding:check`
5. Commit przez `node scripts/commit.mjs`

---

## Ryzyka i mitigacje (najważniejsze)

| Ryzyko                                            | Mitigacja                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dryf schema vs baza prod                          | **A1 GATE #1** (diff pusty, twardy STOP) + **A2 GATE #2** (baseline→fresh→schema pusty) — dwa niezależne dowody                                                                                                                                                                                                                                                                                                |
| Utrata danych przy konwersji                      | `resolve --applied` nie dotyka danych + backup **pre-baseline w skrypcie, jednoznaczna nazwa** + testy A4/A4.5 weryfikują zachowanie danych + **A4.6 weryfikuje restore**                                                                                                                                                                                                                                      |
| Baseline niekompletny (auto-heal indeksy)         | A2 GATE #2 + jawna weryfikacja SQLite-specific w `migration.sql`                                                                                                                                                                                                                                                                                                                                               |
| Utrata indeksów po konwersji (edge case L2)       | `ensure-db.bat` z `migrate deploy` → no-op (baseline applied) → `check-db` exit 1 (brak indeksów) → pętla 3× → FAIL. **Mitigacja:** baseline zawiera indeksy (GATE #2); jeśli mimo to znikną (ręczne `DROP INDEX`, uszkodzenie): **restart serwera** uruchamia auto-heal w `app.ts:362-366` (idempotentne `CREATE INDEX IF NOT EXISTS`) → indeksy wracają → `check-db` exit 0. Ryzyko: bardzo niski edge case. |
| Next migration po konwersji się nie stosuje       | test A4.5 (legacy → baseline → future migration → deploy → status), izolowany projekt Prisma                                                                                                                                                                                                                                                                                                                   |
| Fallback `db push` ukrywa problem migracji        | **A7b (korekta v4.4)** — start/prod: `scripts/ensure-db.bat` → `migrate deploy` jedyna ścieżka; fallback w `install.bat` warunkowany legacy db-push (brak `_prisma_migrations`); `install.bat` zawsze w gałęzi migrate deploy (lockfile w repo)                                                                                                                                                                |
| Docker prod zostaje na `db push` po A6            | **A7d** — `scripts/docker-entrypoint.sh` → `migrate deploy`; weryfikacja job `docker-build` health check                                                                                                                                                                                                                                                                                                       |
| Linux installer maskuje fail deploy               | **A7c** — `install.sh` guard legacy (`check-legacy-db.js`) + STOP dla migration-managed                                                                                                                                                                                                                                                                                                                        |
| Docs prowadzą w błąd po konwersji                 | **D3** — aktualizacja ~11 plików docs + `version:check`/`format`/`encoding:check`                                                                                                                                                                                                                                                                                                                              |
| Skrypt konwersji działa na złej bazie             | **A5 hard guards** (brak DB, brak baseline, non-empty diff, `_prisma_migrations` istnieje) + **env DATABASE_URL** (path.resolve)                                                                                                                                                                                                                                                                               |
| `prisma generate` EPERM (DLL w użyciu)            | **C1.5b** — zatrzymać backend PRZED `npm ci`/`generate` (WAL potwierdzone otwarte); EPERM → ponowny `npm ci` po pełnym stopie                                                                                                                                                                                                                                                                                  |
| `migrate diff` tworzy shadow DB                   | cleanup `data/tmp_shadow.sqlite` w A1/A5/A6 (plik ignorowany przez git, ale zostaje na dysku)                                                                                                                                                                                                                                                                                                                  |
| Rollback po konwersji nie działa                  | **v4.6 M1/R3a/R3b:** pre-baseline (bez `_prisma_migrations`) = backup techniczny, rollback przez **kopię pliku** (nie `npm run restore`); post-baseline = normalny backup produkcyjny → `npm run restore --yes` → `migrate deploy`. Oba zweryfikowane testem A4.6 (scenariusze 1 i 2)                                                                                                                          |
| Nowe instalacje po squash                         | A3 (migrate deploy na pustej bazie) + manual smoke `install.bat` (A7b)                                                                                                                                                                                                                                                                                                                                         |
| Usunięcie starych migracji za wcześnie            | A2a → A5 → A2b — usunięcie dopiero po zielonych testach (A3/A4/A4.5/A4.6)                                                                                                                                                                                                                                                                                                                                      |
| Pliki JUnit/JSON nadpisane przez kolejne runy     | **B3 osobny plik per run + hard verification (`test -f` ×3)**                                                                                                                                                                                                                                                                                                                                                  |
| Flaky job spowalnia CI                            | report-mode, `continue-on-error`, test job bez zmian; 3× świadomy kompromis                                                                                                                                                                                                                                                                                                                                    |
| `npm audit fix` zmienia lockfile                  | C1.5: `npm ci` + `prisma generate` + `npm audit --omit=dev` PO install + `npm run validate`                                                                                                                                                                                                                                                                                                                    |
| puppeteer vuln zostaje                            | świadoma decyzja — major bump osobno                                                                                                                                                                                                                                                                                                                                                                           |
| A4.5 modyfikuje repo                              | izolowany temp projekt Prisma (`tests/tmp/future-migration/`), `--schema` na temp                                                                                                                                                                                                                                                                                                                              |
| `restore-db.js` woła `db push` po konwersji       | **R1/R1b (commit 2, przed A4.6)** — `scripts/restore-db.js` → `migrate deploy` + `--yes`; rollback produkcyjny przez `npm run restore --yes` (R3b), konwersji przez R3a (kopia pre-baseline)                                                                                                                                                                                                                   |
| Flaky job myli awarię infra z flaky               | **F1 (v4.6)** — `flaky-compare.mjs` rozdziela `INFRA FAIL` (brak/uszkodzony JSON, `numTotalTests==0`) od `FLAKY` (fail w podzbiorze runów); integralność raportu ≠ `results.success` (run z failem ma `success:false` — normalne)                                                                                                                                                                              |
| Flaky job nie uruchamia się przy padniętym `test` | **M3 (v4.6)** — `if: always() && ...` — detektor startuje TAKŻE gdy job `test` failed (właśnie wtedy, gdy flaky)                                                                                                                                                                                                                                                                                               |

---

## Zakres (summary)

- 3 fazy: C (audit), A (baseline 8.2), B (flaky 8.3)
- **~25–28 plików** (nie sztywna liczba): testy (bodyParserLimit, baseline, legacyConversion, futureMigration, restoreRoundtrip, flakyCompare), skrypty (migrate-diff-check, db-to-migrations, flaky-compare, check-legacy-db, **restore-db.js [R1/R1b]**), jest.config.ts (prawdopodobnie bez zmian — JSON wbudowany), ci.yml, **scripts/ensure-db.bat**, install.bat, **install.sh [A7c]**, **scripts/docker-entrypoint.sh [A7d]**, **dev.sh [A7e, docs-only]**, migration baseline, docs: **README, CONTRIBUTING, AGENTS.md, CLAUDE.md, DEPLOYMENT, INSTRUKCJA_SERWER, INSTALACJA_REFERENCJA, BACKUP_RESTORE, DATABASE, SECURITY, instalacja-przenoszenie-systemu [D3]**
- 8-10 commitów wg Conventional Commits (v4.6: commit 2 = R1/R1b + A4.6, przed A5)
- Wersja aplikacji: **bez zmian** (1.14.2) — plan nie wymaga release
- Po A6 dokumentacja: **"Production DB migration baseline established"** — baza prod przeszła z `db push-managed` na `migration-managed`

---

## Definition of Done (P6 — go/no-go per fazę)

- [x] **C (audit, v4.6 R11):** `npm audit --omit=dev` → 0 unresolved non-major advisory; jawna lista wyjątków: `puppeteer` major = odroczony; test `bodyParserLimit` zielony; `npm run validate` przechodzi (commit 54f055e)
- [x] **A (baseline 8.2, v4.9):** GATE #1 (diff `--from-schema-datasource` pusty **poza FTS5**) OK; GATE #2 (baseline SQLite-specific + indeksy) OK; A2a + A5 skrypt commited (c1db1b6); R1/R1b + A4.6 commited (**przed A2b**, M4 — cf445e3); A5 hard guards (w tym FTS5-aware) OK; 14 starych migracji usunięte (A2b — fd6f095); A4.6 scenariusz 1 (legacy/pre-baseline — kopia pliku) ORAZ scenariusz 2 (migration-managed/post-baseline — `restore-db.js --yes`) OK; A6 prod: `migrate status` = up to date, `PRAGMA integrity_check` = ok, smoke OK (R8: STOP backend przed `resolve`) ✅ **Production DB migration baseline established**
- [x] **A7b (deploy):** `scripts/ensure-db.bat` twardy `migrate deploy`; `install.bat` fallback `db push` tylko dla legacy; `restore-db.js` → `migrate deploy` + `--yes` (R1/R1b); R3a (rollback konwersji — kopia pre-baseline) + R3b (rollback produkcyjny — `npm run restore --yes` post-baseline) (f999dc1)
- [x] **A7c (Linux):** `install.sh` guard legacy + STOP dla migration-managed; `bash -n install.sh` OK (f999dc1)
- [x] **A7d (Docker):** `scripts/docker-entrypoint.sh` → `migrate deploy`; job `docker-build` health check zielony (f999dc1 — health check na następnym push na main)
- [x] **A7e (dev):** `dev.sh` świadomie na `db push` (udokumentowane, bez zmiany kodu)
- [x] **D3 (docs):** 11 plików zaktualizowanych; `version:check`/`format`/`encoding:check` EXIT=0 (d673b9a)
- [x] **B (flaky 8.3, v4.6 M2/M3):** job `flaky-detect` z `if: always() && push && main` + `continue-on-error` (uruchamia się też przy failed `test`); `flaky-compare.mjs` z F1 (integralność struktury, NIE `results.success`; kategorie INFRA FAIL / FLAKY / STABLE FAIL / STABLE PASS / MISSING-INCONSISTENT) + kontrakt JSON (F2); raport na artifact `flaky-report` (fa0fd5c + e409fdf)
- [x] **P5:** nowe testy (A3/A4/A4.5/A4.6/bodyParserLimit/flakyCompare) uruchamiane automatycznie przez `npm test` w CI
- [x] **Wersja 1.14.2 bez zmian**; `npm run version:check` EXIT=0; `npm run encoding:check` EXIT=0
