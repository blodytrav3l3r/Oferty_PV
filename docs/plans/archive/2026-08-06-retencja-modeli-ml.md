# Plan: Retencja modeli ML (pruneOldModels) — limit wzrostu rejestru AiModel

Data: 2026-08-06 | Status: WDROŻONE | Tryb: wdrożenie po akceptacji

> **Wdrożone** (2026-08-06): funkcja zaimplementowana zgodnie z planem.
>
> - `ML_CONFIG.retention = { keepLast: 10, keepBest: 3 }` w `src/services/ml/trainingConfig.ts`
>   (`keepLast >= 2` gwarantuje działający rollback, `keepBest >= 1` gwarantuje cel `promoteBestModel`).
> - `ModelRegistry.pruneOldModels()` w `src/services/ml/ModelRegistry.ts` — zachowuje wszystkie
>   modele aktywne + top-`keepBest` wg `rocAUC` + ostatnie `keepLast` wg `createdAt` (oba zbiory
>   tylko dla bieżącej `FEATURE_VERSION`); reszta usuwana `deleteMany` partiami po 500 z guardem
>   `active: false`; metoda nigdy nie rzuca (błąd logowany). Wołane po każdym `saveModel`
>   i przy starcie serwera (`src/app.ts`, obok `cleanupAuditLogs`).
> - Endpoint `GET /ai/ml-status` zwraca `retention: { keepLast, keepBest }`
>   (`src/routes/telemetryAiMl.ts`); dashboard (`public/js/admin/aiDashboard.js`) pokazuje
>   `modelCount / (keepLast+keepBest)` w statCard "Liczba modeli".
> - Testy: `tests/ml/ModelRegistryPrune.test.ts` (6 przypadków: aktywny chroniony, top-AUC,
>   ostatnie chronione, stare featureVersion prunowane, edge < keepBest, zgodność sumy) — zielone;
>   `tests/ml/TrainingPipeline.test.ts` rozszerzony o mock `deleteMany` (bez regresji).
> - Dokumentacja: polityka retencji opisana w `docs/ARCHITECTURE.md`; `docs/API.md`
>   zaktualizowane o pole `retention` w odpowiedzi `/ai/ml-status`.

## 1. Cel i tło

Każdy trening przez saveModel() (src/services/ml/ModelRegistry.ts:50-109) dodaje wiersz do tabeli AiModel bez żadnej retencji. Baza gromadzi wszystkie modele — dashboard (public/js/admin/aiDashboard.js) i tak pokazuje tylko 20 najnowszych (listModels z limitem, ModelRegistry.ts:139). Cel: ograniczyć wzrost rejestru do rozsądnej liczby (aktywny + kilka najlepszych + kilka najnowszych), bez zmian w API ani schemacie DB.

## 2. Decyzje projektowe

| Decyzja                                                                                                                  | Zakres                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Semantyka retencji**                                                                                                   | Chronione: (1) wszystkie modele ctive=true, (2) top keepBest wg                                                                                                                                                                                                                                                                       |
| ocAuc (z metrics JSON; uszkodzone JSON traktowane jako auc=-1), (3) ostatnie keepLast wg createdAt desc. Reszta usuwana. |
| **Zakres ochrony**                                                                                                       | Zbiory chronione liczone globalnie (nie tylko dla bieżącego eatureVersion) — modele starych wersji cech są z natury stare (createdAt), więc i tak wypadają poza keepLast/keepBest i są prunowane. Zgodne z przypadkiem testowym „stare featureVersion prunowane".                                                                     |
| **Gdzie wołać prune**                                                                                                    | **Wewnątrz saveModel, po bloku $transaction** (wiersz ~102) — jeden punkt zaczepienia chroni wszystkich przyszłych callerów (zasada root-cause, DRY; dziś jedynym callerem jest TrainingPipeline.ts:184, ale nie chcemy wymagać pamiętania o prunie przy każdym nowym wywołaniu). Dodatkowo start w src/app.ts obok cleanupAuditLogs. |
| **Obsługa błędów**                                                                                                       | pruneOldModels() łapie błędy wewnętrznie (wzorzec cleanupAuditLogs, auditService.ts:139-176): loguje logger.error i zwraca 0. Nigdy nie rzuca — błąd prunowania nie może zepsuć zapisu modelu ani zablokować startu serwera.                                                                                                          |
| **Batch delete**                                                                                                         | deleteMany z id: { in: [...] } w paczkach po 500 (sprawdzony wzorzec z auditService — bezpieczny dla limitu zmiennych SQLite). Bez transakcji — identycznie jak cleanupAuditLogs.                                                                                                                                                     |
| **Dashboard**                                                                                                            | Serwer wystawia limity retencji w /ai/ml-status; frontend pokazuje je w tooltipie/subtytule statCard „Liczba modeli" (bez duplikowania configu w JS).                                                                                                                                                                                 |

## 3. Zakres zmian (pliki)

| Plik                                                                            | Zmiana                                                                                                                                   |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| src/services/ml/trainingConfig.ts                                               | Dodać                                                                                                                                    |
| etention: { keepLast: 10, keepBest: 3 } do ML_CONFIG.                           |
| src/services/ml/ModelRegistry.ts                                                | Nowa metoda pruneOldModels(): Promise<number> (+ ewentualny prywatny helper parsowania AUC). Wywołanie w saveModel po transakcji.        |
| src/app.ts                                                                      | Wywołanie pruneOldModels() przy starcie, zaraz po cleanupAuditLogs() (wiersz ~344), w try/catch (wzorzec pozostałych bloków startowych). |
| src/routes/telemetryAiMl.ts                                                     | Dodać                                                                                                                                    |
| etention: { keepLast, keepBest } do odpowiedzi GET /ai/ml-status (~wiersz 389). |
| public/js/admin/aiDashboard.js                                                  | statCard „Liczba modeli" (~wiersz 344): wartość zostaje status.modelCount, subtytuł pokazuje limit retencji z status.retention.          |
| ests/ml/ModelRegistryPrune.test.ts                                              | Nowy plik testów regresyjnych (wzorzec mocków: ests/ml/TrainingPipeline.test.ts).                                                        |
| ests/ml/TrainingPipeline.test.ts                                                | Rozszerzyć mock iModel o deleteMany (inaczej prune wewnątrz saveModel łapie TypeError w teście — działa, ale generuje śmieciowy log).    |

## 4. Kroki implementacji

### Krok 1 — Config retencji (src/services/ml/trainingConfig.ts)

- Dodać do ML_CONFIG:
  `	s
retention: {
keepLast: 10,   // ile najnowszych modeli zawsze zostaje
keepBest: 3     // ile najlepszych wg rocAUC zawsze zostaje
}
`
- Ryzyko: brak. Zależności: brak.

### Krok 2 — ModelRegistry.pruneOldModels() (src/services/ml/ModelRegistry.ts)

- Nowa metoda publiczna sync pruneOldModels(): Promise<number>:
    1. indMany({ select: { id, active, createdAt, metrics, featureVersion } }) — lekkie pola, bez weights/eatureMins/eatureMaxs.
    2. Zbiór chronionych ID:
        - wszystkie ctive === true (teoretycznie max 1 — partial unique idx_aimodel_one_active),
        - top keepBest wg
          ocAuc desc (parse metrics JSON; ry/catch → -1),
        - ostatnie keepLast wg createdAt desc (sort na kopii — reguła #15 z AGENTS.md: nie mutować wyniku Prisma).
    3. Kandydaci = wszystkie ID − chronione; jeśli puste →
       eturn 0.
    4. Usuwanie partiami po 500 (deleteMany { id: { in: chunk } }), sumowanie usuniętych.
    5. logger.info('ModelRegistry', 'Usunięto N modeli ...') (tylko gdy N > 0), całość w ry/catch → logger.error +
       eturn 0.
    6. Zwraca liczbę usuniętych.
- Wywołanie w saveModel PO bloku $transaction (po wierszu 102, przed finalnym logger.info):
  `	s
await this.pruneOldModels();
`
  (nie rzuca, więc nie zmienia kontraktu saveModel).
- Ryzyko: niskie. Zależności: Krok 1. Uwaga: listModels/getBestAuc/promoteBestModel bez zmian.

### Krok 3 — Start serwera (src/app.ts)

- Po wait cleanupAuditLogs(); (wiersz 344) dodać:
  `	s
try {
const { modelRegistry } = await import('./services/ml/ModelRegistry');
await modelRegistry.pruneOldModels();
} catch (e) { /* warn — nie blokuje startu */ }
`
  (try/catch dla bezpieczeństwa mimo wewnętrznej obsługi błędów; wzorzec pozostałych bloków, np. ensureFts5Schema).
- Ryzyko: niskie. Zależności: Krok 2.

### Krok 4 — Dashboard: limit retencji

- src/routes/telemetryAiMl.ts — w odpowiedzi GET /ai/ml-status (~wiersz 389) dodać:
  `	s
retention: { keepLast: ML_CONFIG.retention.keepLast, keepBest: ML_CONFIG.retention.keepBest }
`
  (import ML_CONFIG już istnieje w module — zweryfikować; ewentualnie dodać).
- public/js/admin/aiDashboard.js (~wiersz 344) — statCard „Liczba modeli":
    - wartość: bez zmian (status.modelCount || 0),
    - subtytuł: 'Limit retencji: ostatnie ' + (status.retention?.keepLast ?? 10) + ' + ' + (status.retention?.keepBest ?? 3) + ' najlepsze + aktywny' (fallback = wartości domyślne na wypadek starszego backendu).
- Ryzyko: niskie. Zależności: Krok 1 (config istnieje przed exposure).

### Krok 5 — Test regresyjny ( ests/ml/ModelRegistryPrune.test.ts)

- Wzorzec mocków jak w TrainingPipeline.test.ts:8-42:
    - jest.mock('../../src/prismaClient') z kontrolowalnymi iModel.findMany / iModel.deleteMany (+ create, indFirst dla kompatybilności),
    - jest.mock('../../src/utils/logger'),
    - modelRegistry importowany dynamicznie (wait import(...)).
- deleteMany mock zwraca { count: batch.length }; asercje na argumentach indMany/deleteMany (nie na realnej bazie — testy ML w projekcie nie używają prawdziwego SQLite, patrz TrainingPipeline.test.ts).
- Przypadki — patrz sekcja 5.

### Krok 6 — Aktualizacja istniejącego testu ( ests/ml/TrainingPipeline.test.ts)

- W mocku iModel (wiersze 23-30) dodać deleteMany: jest.fn<any>().mockResolvedValue({ count: 0 }) oraz skonfigurować indMany tak, by zwracał [] w teście „saveModel tworzy wpis w bazie" (prune nie usuwa nic, log czysty).

## 5. Plan testu ( ests/ml/ModelRegistryPrune.test.ts)

Dane pomocnicze: helper budujący rekord { id, version, active, createdAt, metrics: JSON.stringify({ rocAuc }), featureVersion }. Scenariusze (konfiguracja: keepLast=10, keepBest=3):

| #   | Przypadek                                 | Scenariusz                                                                  | Oczekiwanie                                                                                        |
| --- | ----------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 1   | **Aktywny chroniony**                     | 15 modeli, aktywny ma najniższe AUC i najstarszy createdAt                  | aktywny NIE w liście usuwanych; deleteMany bez jego id                                             |
| 2   | **Top-AUC chroniony**                     | 15 modeli, 3 z najwyższym AUC mają stare createdAt i ctive=false            | te 3 NIE usuwane; usunięte = pozostałe spoza keepLast                                              |
| 3   | **Ostatnie chronione**                    | 15 modeli, 10 najnowszych ma słabe AUC                                      | te 10 NIE usuwane (mimo słabego AUC)                                                               |
| 4   | **Stare featureVersion prunowane**        | model eatureVersion='v5' (stary), ctive=false, poza top-AUC i poza keepLast | usunięty; deleteMany zawiera jego id                                                               |
| 5   | **Edge: < keepBest rekordów**             | 2 modele (<= keepLast), różne AUC                                           | pruneOldModels() zwraca 0, deleteMany NIE wywołany                                                 |
| 6   | **Zgodność sumy**                         | 15 modeli bez nakładania zbiorów (aktywny + top3 + 10 ostatnich = 14)       | usunięte = 1, zwrócone 1                                                                           |
| 7   | (opcjonalnie) **Uszkodzony JSON metrics** | rekord z metrics='{invalid', wysokie AUC                                    | auc traktowane jako -1 — model nie chroniony przez top-AUC (ale może być chroniony przez keepLast) |

Uwaga: przypadek 5 pokrywa też scenariusz „<= keepLast rekordów" — zero usunięć, zero wywołań deleteMany.

## 6. Kolejność walidacji

Po każdym kroku (zalecany rytm):

1.

pm run typecheck — backend TS (Kroki 1-3, 5-6). 2.
pm run lint — backend (Kroki 1-3, 5-6). 3.
ode -c public/js/admin/aiDashboard.js +
pm run lint:frontend — Krok 4. 4.
px jest tests/ml/ModelRegistryPrune.test.ts — po Kroku 5; następnie
px jest tests/ml/TrainingPipeline.test.ts (Krok 6 — brak regresji). 5.
pm run format — przed commitem. 6. Finalnie
pm run validate (typecheck + lint + testy) +
pm run test:quick.

## 7. Ryzyka i mitygacje

- **Ryzyko**: prune usuwa model, na który wskazuje rollback (
  ollbackToPrevious bierze ostatni nieaktywny bieżącej wersji). — Mitygacja: keepLast=10 gwarantuje, że ostatnie nieaktywne modele zostają; ryzyko tylko przy >10 treningach bez aktywacji — zaakceptowane (rollback ma też SelfEvaluation.checkAndRollbackIfNeeded).
- **Ryzyko**: błąd prunowania psuje zapis modelu. — Mitygacja: wewnętrzny ry/catch +
  eturn 0, kontrakt saveModel bez zmian.
- **Ryzyko**: deleteMany z id in przekracza limit zmiennych SQLite. — Mitygacja: paczki po 500 (wzorzec cleanupAuditLogs).
- **Ryzyko**: usunięcie modelu z najwyższym AUC zmienia wynik getBestAuc(). — Mitygacja: top keepBest jest chroniony; getBestAuc i tak działa na bieżącej wersji cech, a najlepsze modele bieżącej wersji są zawsze w top-keepBest lub keepLast.

## 8. Kryteria sukcesu

- [ ] ML_CONFIG.retention istnieje i jest używany przez pruneOldModels.
- [ ] pruneOldModels() zwraca liczbę usuniętych, loguje logger.info, nie rzuca.
- [ ] Po saveModel i przy starcie aplikacji rejestr przycina się do ~aktywny + keepBest + keepLast.
- [ ] GET /ai/ml-status zwraca
      etention.{keepLast,keepBest}; statCard „Liczba modeli" pokazuje limit.
- [ ] Wszystkie przypadki testowe z sekcji 5 przechodzą; TrainingPipeline.test.ts bez regresji.
- [ ] pm run validate zielone.
