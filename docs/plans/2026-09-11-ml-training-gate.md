# Bramka treningu ML: `shouldTrain()` + retencja `AiTrainingRun` (F1+F2, F3 osobno)

**Status:** Zaimplementowane (F1+F2). Testy: 49/49 w `TrainingPipeline` + `trainingGate`, 102/102 w pokrewnych suitach ML/telemetrii, typecheck + lint czyste.
**Lekcja z implementacji:** gate w `run()` MUSI leżeć wewnątrz `try` — early return przed `try` omijał `finally` (martwy mutex, kaskada `already_running`); wykryte przez testy.
Zakres zamknięty — nie rozszerzać o Learning Engine ani jakościowe gate'y ML.

## 0. Etap 0 — diagnoza pre-implementacyjna (read-only, przed kodem)

Cel: diagnostyka, czy trening przy obecnej skali danych w ogóle przechodzi. Wynik **nie blokuje F1+F2** (bug pamięci + waste istnieją niezależnie) — decyzja „F1+F2 bez zmian" jest niezależna od wyniku; Etap 0 decyduje tylko o otwarciu follow-upu kalibracji progów (§8a). Zanotuj pełny obraz (nie samo „SUCCESS w ostatnich 30 dniach", bo pipeline może być mimo to martwy): ostatni SUCCESS, liczby SUCCESS/FAILED/SKIPPED, czas od SUCCESS, liczbę kwalifikujących features, rozkład labeli.

Zapytania (kopia produkcyjnej bazy, Prisma Studio lub sqlite3 — zero zapisów):

```sql
SELECT label, COUNT(*) FROM AiFeature GROUP BY label;
SELECT status, COUNT(*), MAX(startedAt) FROM AiTrainingRun GROUP BY status;
SELECT COUNT(*) FROM ai_telemetry_logs;
```

Macierz decyzji:

| Wariant | Obraz danych                 | Decyzja                                                                    |
| ------- | ---------------------------- | -------------------------------------------------------------------------- |
| A       | regularne SUCCESS            | F1+F2 bez zmian                                                            |
| B       | tylko `SKIPPED` / `FAILED_*` | F1+F2 + zanotuj dominujący `reason` (wskazówka, który guard dusi pipeline) |
| C       | zero prób lub `AiFeature` ~0 | F1+F2 nadal (bug + retencja) + otwórz follow-up kalibracji progów (§8a)    |

## 1. Problem

- Cron `mlTrainingPipeline` co 15 min (`src/utils/cronService.ts:43`) woła `TrainingPipeline.run()` bez `force`.
- Każde wywołanie wykonuje ciężką pracę (`extractAndStore()`, `resyncLabels()`, `resyncFeatures()` w `TrainingPipeline.ts:298-305`), a dopiero potem guardy zwracają `SKIPPED`.
- Każde wywołanie (też `SKIPPED`) zapisuje wiersz `AiTrainingRun` → 96 wierszy/dobę, ~35k/rok, bez pruna.
- `lastTrainedAt` to pole in-memory (`TrainingPipeline.ts:198`) — po restarcie serwera = `null`, więc `newCount = features.length` (całe okno) i bramka nowych danych przepuszcza wszystko. Harmonogram uczenia nie ma trwałej pamięci (bug P0/P1 jakościowy).
- `minHoursSinceLastTrain: 4` pilnuje tylko ścieżki `SelfEvaluation.runDaily()`, cron go omija — dwa triggery, dwie rozjazdowe decyzje.

## 2. Decyzje (SSoT)

- **D1. `shouldTrain()` to read-only pre-flight gate, nie lock.** Mutex w `run()` zostaje autorytatywnym zabezpieczeniem. `run()` po `acquire()` robi tani re-check **tylko** `too_soon` z DB (bez wiersza `AiTrainingRun` przy odrzuceniu). Re-check counta pomijany świadomie (dane tylko przybywają; guardraile deploy chronią).
- **D2. `lastSuccessAt` = czas zakończenia ostatniego `AiTrainingRun.status = SUCCESS`.** Kolumna: `finishedAt`, fallback `startedAt` dla wierszy legacy bez `finishedAt`. Semantyka SLA: minimum 4h **od zakończonego** treningu. Brak wiersza SUCCESS → `null` → `too_soon = false`, wymagane ≥50 kwalifikujących (jawny first-run). Przy implementacji zweryfikować, że `finishedAt` jest ustawiane przy zakończeniu **każdej** rzeczywistej próby (`SUCCESS`/`FAILED_*`/split-guard — dziś wszystko przechodzi przez `finish()`, `TrainingPipeline.ts:244-280`); `lastSuccessAt` czyta wyłącznie wiersze `status = SUCCESS`.
- **D3. SSoT definicji danych:** nowa `countEligibleNewFeatures(since)` w `trainingUsers.ts`, używana przez `shouldTrain()` i `run()` (zastępuje inline-count w `run():362-375`). Definicja bez zmian: `AiFeature.createdAt > since` + filtr allowlisty. `NO_FEEDBACK` odpada dopiero w `loadAndNormalizeFeatures()` — semantyka modelu nietknięta.
- **D4. Force poza bramką:** bramka żyje w callerach (cron, self-eval), nie w `run()`. `POST /ai/train` → `run(true)` omija bramkę z konstrukcji.
- **D5. Semantyka audytu:** `AiTrainingRun` = rzeczywista próba treningu, nie sprawdzenie harmonogramu.
- **D6. Retencja:** tylko `keepLastRuns = 100` w `ML_CONFIG.retention`, bez klauzuli wieku. Bez archiwizacji compliance.
- **D7. Kadencja:** cron treningu 15 min → 4h. Ruch docelowy: 96 potencjalnych ciężkich wywołań pipeline'u/dobę → 6 lekkich cronowych pre-flight checks/dobę + 1 istniejący dzienny check SelfEvaluation; ciężki pipeline tylko po `ok`.

## 3. F1 — bramka decyzyjna

1. `TrainingPipeline.shouldTrain(): Promise<{ok:true} | {ok:false, reason}>`, kolejność od najtańszego: `already_running` → `too_soon` → `insufficient_new_data`.
2. `countEligibleNewFeatures(since: string | null)` w `trainingUsers.ts` (D3). `since = null` liczy całe okno (first-run).
3. `runMlTraining()` (`cronService.ts:174`) i `SelfEvaluation.runDaily()` (`SelfEvaluation.ts:83-84`) wołają `shouldTrain()` przed `run()`. In-memory `lastRunAt` w `SelfEvaluation` może zostać (dodatkowy bezpiecznik), decyzja z DB jest rozstrzygająca.
4. `run()`: po `acquire()` re-check `too_soon` z DB; odrzucenie = wczesny `return` bez wiersza.
5. Cron: `15*60*1000` → `4*60*60*1000` (`cronService.ts:43`).
6. Indeks: `idx_aifeatures_created` istnieje (`schema.prisma:656`) — brak migracji.

## 4. F2 — ciężka praca po gate + retencja

1. W `run()`: bramka nowych danych (przez `countEligibleNewFeatures`) **przed** `extractAndStore()/resyncLabels()/resyncFeatures()`.
2. Podział skip (D5):

| Sytuacja                               | `AiTrainingRun` |
| -------------------------------------- | --------------- |
| `already_running`                      | ❌              |
| `too_soon` (w tym re-check po mutexie) | ❌              |
| `insufficient_new_data`                | ❌              |
| split guard                            | ✅              |
| brak balansu klas                      | ✅              |
| `FAILED_*`                             | ✅              |

3. `pruneTrainingRuns()` (keep last 100, deterministycznie `startedAt DESC, id DESC` — stabilny klucz przy identycznych timestampach), wołany z nowego `dailyHousekeeping` w `cronService` (24h, obok `ftsConsistencyCheck`). Nie w `saveModel()`. `pruneOldModels` bez zmian.

## 5. F3 — osobny etap: strukturalny status bramki

- `GET /ai/ml-status` += `trainingGate: { newSinceLastTrain, minNewData, minHoursSinceLastTrain, hoursSinceLastTrain, eligible, reason, nextEligibleAt }` (liczone przez `countEligibleNewFeatures()` — ten sam SSoT). Frontend tylko prezentuje, zero logiki decyzyjnej.

## 6. Testy

1. `too_soon` (granica 3h59 → skip, 4h00 → ok).
2. `insufficient_new_data` (granica 49 → skip, 50 → ok).
3. `OK` (≥50 + ≥4h).
4. Pre-flight skip nie tworzy wiersza `AiTrainingRun`.
5. First-run: brak SUCCESS → `too_soon=false`, ≥50 → ok.
6. Allowlista: 100 nowych, 40 kwalifikujących → `insufficient_new_data`.
7. Force: `run(true)` omija bramkę (trenuje mimo `too_soon`/mało danych).
8. **Restart persistence (integracyjny, obowiązkowy regresyjny):** wiersz SUCCESS w DB → nowa instancja `TrainingPipeline` → `shouldTrain()` czyta `lastSuccessAt` z DB → `too_soon`.
9. `already_running`: mutex zajęty → `shouldTrain()` zwraca `{ok:false, reason:'already_running'}`.
10. Kontrakt re-checku (bez wielowątkowości): caller A `OK` → `acquire`, caller B po `acquire` widzi świeży SUCCESS → wczesny `return` bez wiersza `AiTrainingRun`.

## 7. Weryfikacja

`npm run typecheck` + `npm run lint` + `npm run test:quick` + `npm run format`. Przed commitem jak zwykle `npm run version:check` (bez zmian wersji w tym zadaniu).

## 8. Non-goals (świadomie poza zakresem)

- Gate'y jakościowe (per klasa, różnorodność, drift-trigger) — przyszłość, nie ten refactor.
- Zmiana semantyki `NO_FEEDBACK`, guardraili deploy, state machine, rollbacku, allowlisty.
- Archiwizacja `AiTrainingRun` poza tabelą operacyjną.

## 8a. Follow-up warunkowy: kalibracja progów pod skalę (POZA tym planem)

Trigger otwarcia: Etap 0 wariant C albo 60 dni bez SUCCESS po wdrożeniu F1+F2.
Zawartość (osobny plan, osobna decyzja): porównanie tempa spływu danych (oznaczonych studni/tydzień) z progami `minFeatureCountForTraining: 100`, `minNewRecordsForTraining: 50`, `minDatasetForSplit: 300` (`trainingConfig.ts`); ewentualne niższe progi startowe przy zachowaniu guardraila AUC. Bez tego model może stać niewytrenowany niezależnie od bramki — to największy czynnik użyteczności ML w tym projekcie.

## 9. Ocena użyteczności dla projektu: 9/10

- +1: naprawa trwałej pamięci bramki (P0/P1), koniec 96 ciężkich ticków/dobę, koniec wzrostu `AiTrainingRun` bez pruna. Ryzyko regresji niskie.
- −1: plan nie odpowiada, czy pipeline przy tej skali danych w ogóle trenuje (progi 50/100/300 vs kilku użytkowników). Domyka to Etap 0 (diagnoza) + F3 (widoczność `trainingGate` na dashboardzie) + ewentualny follow-up §8a.
