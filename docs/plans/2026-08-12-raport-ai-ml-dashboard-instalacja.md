# Raport naprawczy: AI/ML Dashboard po instalacji (2026-08-12)

## 1. Przebieg instalacji

Wykonano pełną instalację przez `install.bat` (Node.js v24.15.0, npm v11.12.1):

1. `init-env.mjs` — utworzono `.env` (wygenerowano losowe hasło admina).
2. `npm ci` — zainstalowano 1104 pakietów (OK, tylko ostrzeżenia deprecacji).
3. `npx prisma generate` — klient wygenerowany do `generated/prisma` (OK).
4. `npx prisma migrate deploy` — 12 migracji zastosowanych (OK).
5. **Seed (`npx ts-node prisma\seed.ts`) — BŁĄD** — awaria na tworzeniu modelu ML.
6. `npx tsc --noEmit` — typecheck (OK).

## 2. Przyczyna błędu (root cause)

Komunikat w przeglądarce: **„Błąd serwera — nie udało się pobrać danych"** (AI/ML Dashboard).

Frontend (`public/js/admin/aiDashboard.js`) mapuje status HTTP ≠ 200/401/403/503 na
`{error:'server'}` (`fetchJson` w `public/js/shared/ui.js:754`). Wszystkie endpointy
`/api/telemetry/ai/*` zwracały **500**, bo kod ML odwoływał się do kolumn, których
**nie było w bazie** — `schema.prisma` i migracje były rozjechane.

### Konkretny łańcuch przyczynowy

1. `prisma/schema.prisma` definiuje kolumny, których **żadna migracja nie dodawała**:
   - `AiModel.featureVersion` (schema.prisma:637)
   - `AiFeature.dennicaHeight`, `AiFeature.kinetaType` (schema.prisma:605-606)
   - `ai_telemetry_logs.kineta` (schema.prisma:44)
2. Kod ML ich używa na każdej operacji: `ModelRegistry.ts` (`where: { featureVersion }`,
   `prisma.aiModel.create` z `featureVersion`), `FeatureExtractor.ts`
   (`kinetaType`, `dennicaHeight`), `TrainingPipeline.ts`.
3. `npx prisma migrate deploy` przechodził „pomyślnie", bo 12 migracji w repo nie zawiera
   tych kolumn → baza pozostawała niekompletna.
4. **Seed** padał na `prisma.aiModel.create()` (`prisma/seed.ts:216`) z błędem
   **P2022 `The column featureVersion does not exist`** — więc startowy model ML
   nigdy nie powstawał.
5. Bez modelu i przy braku kolumn wszystkie endpointy AI/ML kończyły się wyjątkiem
   (Prisma P2022) → **500** → dashboard pokazywał „Błąd serwera".

### Błąd dodatkowy w seedzie

`prisma/seed.ts:216` używa globalnego klienta `prisma.aiModel.create()` zamiast `tx`
(wewnątrz `prisma.$transaction`). Przy awarii tej linii transakcja nie wycofywała
częściowo wgranych produktów — ponowny seed z `--force` wpadał w konflikt
unikalności (P2002 na `ProductsRury.id`).

## 3. Procedura naprawcza (wdrożona)

### Krok 1 — Nowa migracja `prisma/migrations/20260812000000_ai_ml_schema_fix/`

Utworzono migrację, która uzupełnia brakujące kolumny i porządkuje indeks `AiModel`:

- `ALTER TABLE "AiFeature" ADD COLUMN "dennicaHeight" REAL`
- `ALTER TABLE "AiFeature" ADD COLUMN "kinetaType" TEXT`
- `ALTER TABLE "AiModel" ADD COLUMN "featureVersion" TEXT`
- `ALTER TABLE "ai_telemetry_logs" ADD COLUMN "kineta" TEXT`
- Przebudowa `AiModel` z jawnym indeksem `AiModel_version_key` (UNIQUE) oraz
  przywróceniem `idx_aimodel_one_active` (wymuszenie „jeden aktywny model").

> Uwaga techniczna: nie wolno przebudowywać tabeli z `CONSTRAINT UNIQUE` na kolumnie —
> SQLite tworzy wtedy autoindex (`sqlite_autoindex_*`), którego Prisma nie kojarzy
> z nazwanym `AiModel_version_key` (rozjazd wykrywany przez `migrate diff`), a próba
> `DROP INDEX` takiego autoindexu kończy się **P3018** („index associated with UNIQUE
> or PRIMARY KEY constraint cannot be dropped"). Dlatego unikalność realizuje jawny
> `CREATE UNIQUE INDEX "AiModel_version_key"`.

### Krok 2 — Zastosowanie migracji i odtworzenie bazy

- W bazie instalacyjnej rozwiązano zawieszony wpis migracji
  (`prisma migrate resolve --applied`) i usunięto reliktowy wiersz rolled-back.
- Bazę odtworzono „od zera" (czysta instalacja): usunięcie `data/app_database.sqlite`,
  `migrate deploy` (13 migracji, w tym nowa — **bez błędów**), pełny seed.

### Krok 3 — Weryfikacja

- `npx prisma migrate diff --from-url ... --to-schema-datamodel` → **„This is an empty migration"**
  (baza w 100% zgodna ze schematem).
- Seed: ProductsRury 94, ProductsStudnie 677, PrecoKonfig 5, PrecoKinety 54,
  PrecoZakresy 179, **AiModel: 1 (startowy)**.
- `npx tsc --noEmit` → brak błędów.
- `npm run version:check` → wersja 1.13.4 spójna we wszystkich źródłach.

### Krok 4 — Testy aplikacji i AI/ML Dashboard

- `GET /health` → 200.
- Logowanie admin → 200.
- Wszystkie endpointy AI/ML **zwracają 200**:
  `/api/telemetry/ai/health`, `/ml-status`, `/knowledge/stats`, `/models`,
  `/feature-importance`, `/well-selections`, `/knowledge/patterns`, `/feature-schema`.
- `POST /api/telemetry/ai/train` → `{ trained: false, reason: "insufficient_data:0" }`
  (poprawny stan: brak danych treningowych na świeżej bazie).
- `POST /api/telemetry/ai/learning/run` → `{ processed: 0, patternsDetected: 0, ... }` (OK).
- **Test w przeglądarce (headless Puppeteer)** na `http://localhost:3000`:
  - logowanie admina,
  - sekcja **AI / ML Dashboard** renderuje pełną treść: Learning Engine, statystyki,
    ML Pipeline (**✓ Online**, model `v0.1.0-starter`, AUC 0.5000), Feature Importance,
    Studnie dobrane przez AI,
  - sekcja **Stan pipeline ML**: Telemetria, FeatureExtractor, Trening, Model, Predict
    (**Online**), Nagrody, Drift danych, Jakość danych,
  - **zero błędów w konsoli przeglądarki**.

## 4. Co zostało zmienione w repozytorium

```
prisma/migrations/20260812000000_ai_ml_schema_fix/migration.sql   (nowa migracja)
```

Jedyna zmiana w kodzie/strukturze repo to nowa migracja — rozwiązuje problem
„u podstaw": każda świeża instalacja (`install.bat` → `migrate deploy` → seed)
utworzy teraz kompletny model ML i działający AI/ML Dashboard.

## 5. Zapobieganie nawrotom (rekomendacje)

1. **Nie zmieniaj `schema.prisma` bez wygenerowania migracji** — po każdej zmianie
   schematu uruchom `npx prisma migrate dev --name <opis>` (dev) i dodaj migrację do
   commitów. Rozjazd schema ↔ migracje jest cichy: `migrate deploy` nie błądzi,
   a aplikacja pada dopiero w momencie odczytu/zapisu nowych kolumn.
2. **W `seed.ts` używaj `tx` zamiast globalnego `prisma` wewnątrz transakcji**
   (linia 216 `prisma.aiModel.create` → `tx.aiModel.create`) — zapobiega to
   częściowemu wgraniu danych i konfliktowi P2002 przy ponownym seedzie.
3. **Po każdej instalacji uruchom sanity-check AI/ML**:
   - `npm run ai:setup` (skrypt `setupAi.ts`) — potwierdza model ONLINE,
   - w przeglądarce: Pulpit admin → sekcja „AI / ML Dashboard" bez komunikatu
     „Błąd serwera".
4. **Przed `git push`** przeglądaj migracje razem ze zmianami kodu (`git status`):
   nowa migracja musi trafić do tego samego commita co kod jej używający.
5. Dla istniejących instalacji (już po pierwszym seedzie) wystarczy uruchomić
   `npx prisma migrate deploy` + ponowny seed, albo `install.bat --skip-seed`
   i dokończyć model poleceniem `npm run ai:setup`.

## 6. Komendy przydatne przy powtórce

```bash
install.bat                       # pełna instalacja (npm ci, prisma, seed)
start.bat                         # uruchomienie aplikacji (dev: http://localhost:3000)
npm run ai:setup                  # diagnostyka modułu AI/ML
npm run version:check             # spójność wersji (wymagane przed commit/push)
```
