# Instrukcja wdrożenia: naprawa AI/ML Dashboard (2026-08-12)

Dokument opisuje **pełną procedurę przeniesienia zmian do głównego projektu (repozytorium)**,
aby instalacja (`install.bat` → `start.bat`) kończyła się działającym systemem AI/ML Dashboard.
Zmiany dotyczą jednego nowego pliku migracji oraz zalecanego (niewymagającego rewizji kodu)
doprecyzowania seedu.

---

## 1. Co zostało zmienione (podsumowanie)

| Plik                                                              | Rodzaj              | Cel                                                                                                  |
| ----------------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------- |
| `prisma/migrations/20260812000000_ai_ml_schema_fix/migration.sql` | **NOWY**            | Uzupełnia rozjazd `schema.prisma` ↔ migracje: brakujące kolumny AI/ML + porządek indeksów `AiModel`. |
| `docs/plans/2026-08-12-raport-ai-ml-dashboard-instalacja.md`      | NOWY (dokumentacja) | Raport diagnostyczny i zapobiegawczy.                                                                |

**Brak zmian w istniejącym kodzie** — naprawa jest wyłącznie migracyjna.

---

## 2. Dlaczego to konieczne (skrót root cause)

- `schema.prisma` definiuje kolumny, których **żadna z 12 istniejących migracji nie dodawała**:
  `AiModel.featureVersion`, `AiFeature.dennicaHeight`, `AiFeature.kinetaType`, `ai_telemetry_logs.kineta`.
- `npx prisma migrate deploy` przechodził „pomyślnie" mimo rozjazdu → baza pozostawała niekompletna.
- Kod ML (`ModelRegistry`, `FeatureExtractor`, `TrainingPipeline`) odczytuje/zapisuje te kolumny →
  endpointy `/api/telemetry/ai/*` zwracały **500**, a `prisma/seed.ts:216` padał na
  **P2022 (The column `featureVersion` does not exist)** — startowy model ML nie powstawał.
- Frontend (`fetchJson` → `{error:'server'}`) pokazywał **„Błąd serwera — nie udało się pobrać danych"**.

---

## 3. Krok 1 — dodanie nowej migracji

Utwórz plik `prisma/migrations/20260812000000_ai_ml_schema_fix/migration.sql`
o dokładnie następującej treści:

```sql
-- =============================================================================
-- Migracja naprawcza: AI/ML schema fix
-- Dodaje kolumny, które istnieją w schema.prisma, ale nie zostały dodane
-- przez wcześniejsze migracje (rozjazd schema <=> migracje). Kolumny te są
-- używane przez moduły ML (ModelRegistry, FeatureExtractor, TrainingPipeline)
-- i bez nich endpointy /api/telemetry/ai/* zwracają 500, a AI/ML Dashboard
-- pokazuje "Błąd serwera — nie udało się pobrać danych".
--
-- UWAGA: unikalność AiModel.version realizujemy JAWNYM nazwanym indeksem
-- "AiModel_version_key". Niedozwolone jest przebudowanie tabeli z constraintem
-- UNIQUE na kolumnie — SQLite tworzy wtedy autoindex (sqlite_autoindex_*),
-- którego Prisma nie identyfikuje z "AiModel_version_key" i zgłasza rozjazd,
-- a próba DROP INDEX takiego autoindexu kończy się błędem P3018
-- ("index associated with UNIQUE or PRIMARY KEY constraint cannot be dropped").
-- =============================================================================

-- AlterTable
ALTER TABLE "AiFeature" ADD COLUMN "dennicaHeight" REAL;
ALTER TABLE "AiFeature" ADD COLUMN "kinetaType" TEXT;

-- AlterTable
ALTER TABLE "AiModel" ADD COLUMN "featureVersion" TEXT;

-- AlterTable
ALTER TABLE "ai_telemetry_logs" ADD COLUMN "kineta" TEXT;

-- RedefineTable: nadanie unikalności AiModel.version przez jawny nazwany
-- indeks (zamiast autoindexa z constraintu). W SQLite nie można dropnąć
-- autoindexa UNIQUE, dlatego przebudowujemy tabelę.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AiModel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "version" TEXT NOT NULL,
    "weights" TEXT NOT NULL,
    "bias" REAL NOT NULL,
    "metrics" TEXT NOT NULL,
    "features" TEXT NOT NULL,
    "featureMins" TEXT NOT NULL,
    "featureMaxs" TEXT NOT NULL,
    "trainingRows" INTEGER NOT NULL,
    "featureVersion" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TEXT NOT NULL
);
INSERT INTO "new_AiModel" ("active", "bias", "createdAt", "featureMaxs", "featureMins", "featureVersion", "features", "id", "metrics", "notes", "trainingRows", "version", "weights")
SELECT "active", "bias", "createdAt", "featureMaxs", "featureMins", "featureVersion", "features", "id", "metrics", "notes", "trainingRows", "version", "weights" FROM "AiModel";
DROP TABLE "AiModel";
ALTER TABLE "new_AiModel" RENAME TO "AiModel";
CREATE UNIQUE INDEX "AiModel_version_key" ON "AiModel"("version");
CREATE UNIQUE INDEX "idx_aimodel_one_active" ON "AiModel"("active") WHERE "active" = true;
CREATE INDEX "idx_aimodel_active" ON "AiModel"("active");
CREATE INDEX "idx_aimodel_created" ON "AiModel"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
```

> ⚠️ **Ważne (technika SQLite):**
>
> - Nazwa katalogu migracji musi być **nowsza niż `20260805100000_telemetry_well_dedup`**
>   (format `YYYYMMDDHHMMSS_opis`), aby `migrate deploy` zastosował ją po pozostałych.
> - Nie zastępuj `CREATE UNIQUE INDEX "AiModel_version_key"` constraintem UNIQUE —
>   SQLite utworzy wtedy autoindex, którego Prisma nie powiąże z `AiModel_version_key`
>   (objaw: `prisma migrate diff` zgłasza `DROP INDEX sqlite_autoindex_AiModel_2`),
>   a próba ręcznego `DROP INDEX` takiego indeksu kończy się **P3018**.

---

## 4. Krok 2 — zastosowanie na nowej instalacji (install.bat)

Ścieżka na świeżym repo (np. czysty klon z GitHuba) przechodzi **bez żadnych ręcznych
interwencji**:

```bash
install.bat
```

Instalator wykonuje: `npm ci` → `prisma generate` → `prisma migrate deploy` (13 migracji,
w tym nowa) → seed → typecheck. Zakończy się sukcesem z:

```
All migrations have been successfully applied.
AiModel: 1 (startowy)
```

Następnie:

```bash
start.bat
```

i w przeglądarce: **http://localhost:3000** → logowanie admina (hasło w `.env`) →
Pulpit admin → sekcja **„AI / ML Dashboard"** i **„Stan pipeline ML"**.

---

## 5. Krok 3 — zastosowanie na instalacji istniejącej (już po pierwszym seedzie)

Jeśli wcześniejsza instalacja zakończyła się błędem seedu (przy braku tej migracji),
zastosuj naprawę na istniejącej bazie:

```bash
# 1. Zastosowanie nowej migracji
npx prisma migrate deploy

# 2. Weryfikacja zgodności bazy ze schematem (oczekiwane: "This is an empty migration.")
npx prisma migrate diff --from-url "file:./data/app_database.sqlite" --to-schema-datamodel prisma\schema.prisma --script

# 3. Uzupełnienie startowego modelu ML (jeśli baza była przed-trenowana bez modelu)
npm run ai:setup
```

> Jeśli seed wcześniej „utknął" w połowie (produkty wgrane, brak AiModel) i próba
> `npx ts-node prisma\seed.ts --force` zgłasza P2002, usuń bazę i odtwórz ją czysto
> (tylko gdy nie ma danych użytkownika):
>
> ```bash
> del data\app_database.sqlite data\app_database.sqlite-wal data\app_database.sqlite-shm
> npx prisma migrate deploy
> npx ts-node prisma\seed.ts
> ```

---

## 6. Zalecana (opcjonalna) poprawka seedu — `prisma/seed.ts`

Wewnątrz `prisma.$transaction` (linia ~216) seed używa globalnego klienta `prisma.aiModel.create`
zamiast kontekstu transakcji `tx`. Skutek uboczny: wyjątek z tej linii **nie wycofuje**
częściowo wgranych produktów → przy ponownym seedzie konflikt unikalności P2002.

**Zalecana zmiana (1 wiersz):**

```ts
// przed:
await prisma.aiModel.create({ ... });

// po:
await tx.aiModel.create({ ... });
```

To nie jest blokadą poprawnej instalacji (krok 5 wystarcza), ale podnosi spójność
transakcyjną seedu i zapobiega dziwnym stanom przy `--force`.

---

## 7. Weryfikacja po wdrożeniu (checklist)

| #   | Sprawdzenie                                                                                                                | Oczekiwany wynik                                          |
| --- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 1   | `npx prisma migrate diff --from-url "file:./data/app_database.sqlite" --to-schema-datamodel prisma\schema.prisma --script` | `This is an empty migration.`                             |
| 2   | `npx tsc --noEmit`                                                                                                         | brak błędów                                               |
| 3   | `npm run version:check`                                                                                                    | wersja 1.13.4 spójna we wszystkich źródłach               |
| 4   | `npm run ai:setup`                                                                                                         | `Status ML: ONLINE`, `Wersja modelu ML: v0.1.0-starter`   |
| 5   | `GET /api/telemetry/ai/health` (po zalogowaniu admina)                                                                     | 200, `mlOnline: true`                                     |
| 6   | `GET /api/telemetry/ai/ml-status`                                                                                          | 200, `modelVersion: v0.1.0-starter`, `featureVersion: v6` |
| 7   | `GET /api/telemetry/ai/knowledge/stats`                                                                                    | 200, obiekt statystyk                                     |
| 8   | Przeglądarka → Pulpit admin → AI / ML Dashboard                                                                            | sekcje renderują się, brak „Błąd serwera"                 |
| 9   | Konsola przeglądarki (F12)                                                                                                 | zero błędów JS                                            |

---

## 8. Commity (konwencja projektu)

Zmiany należy zakomitować z migracją i raportem w jednym, **konwencjonalnym** commicie
(scope z dozwolonej listy — np. `telemetry`):

```bash
node scripts/commit.mjs "fix(telemetry): migracja uzupelniajaca schemat AI/ML (featureVersion, kineta, dennicaHeight)"
node scripts/commit.mjs "docs(docs): raport naprawczy i instrukcja wdroznia AI/ML Dashboard"
```

Przed commitem obowiązkowo: `npm run version:check` + `npm run validate`.

---

## 9. Zapobieganie nawrotom (reguły trwałe)

1. **Każda zmiana `schema.prisma` = nowa migracja** (`npx prisma migrate dev --name ...`)
   dodana do tego samego commita co kod jej używający. Rozjazd schema ↔ migracje jest
   cichy dla `migrate deploy`, a objawia się dopiero w runtime (500 / P2022).
2. **Wewnątrz `prisma.$transaction` zawsze używaj `tx`, nie globalnego `prisma`**
   (seed.ts:216 oraz każdy nowy kod transakcyjny).
3. **Po instalacji sanity-check AI/ML:** `npm run ai:setup` + otwarcie dashboardu.
4. **Przed `git push`:** `git status` — każda nowa migracja musi być w repo razem z kodem.
