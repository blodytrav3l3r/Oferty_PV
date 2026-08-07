# Implementation Plan: Pierwszy poprawny, wdrożony model AI/ML

## Overview

Cel: doprowadzić pipeline ML (telemetry → FeatureExtractor → TrainingPipeline → AiModel → mlDualRanking) do stanu, w którym pierwszy **poprawny** model zostanie wytrenowany, zwalidowany i wdrożony jako aktywny. Po wyczyszczeniu wszystkich tabel AI/ML system startuje od zera — plan definiuje etapy zbierania danych, progi, kryteria wdrożenia oraz ścieżkę diagnostyczną, gdy AUC nie rośnie.

Plan NIE zakłada zmian w kodzie na start — wykorzystuje istniejące mechanizmy (cron 15 min, endpointy `/ai/health`, `/ai/ml-status`, `/ai/models`, `/ai/train`, `/ai/feature-importance`, dashboard `mlHealthDashboard`/`aiDashboard`). Ewentualne zmiany (nowe cechy, wpływ AI) są wskazane jako decyzje na późniejszych punktach kontrolnych.

## Realne progi (zweryfikowane w kodzie)

Źródło: `src/services/ml/trainingConfig.ts`, `src/config/mlConstants.ts`, `src/services/ml/TrainingPipeline.ts`, `src/services/ml/ModelRegistry.ts`, `src/services/ml/SelfEvaluation.ts`.

| Parametr                       | Wartość                       | Znaczenie                                                                                 |
| ------------------------------ | ----------------------------- | ----------------------------------------------------------------------------------------- |
| `minFeatureCountForTraining`   | **100**                       | minimalna liczba wektorów w `AiFeature` do pierwszego treningu                            |
| `minNewRecordsForTraining`     | **50**                        | minimalna liczba NOWYCH wektorów od ostatniego treningu do kolejnego treningu (auto)      |
| `deployAucImprovement`         | **0**                         | każdy nowy model z AUC >= bestAuc jest wdrażany                                           |
| Pierwszy model (`bestAuc < 0`) | **wdrażany zawsze**           | przy braku modelu gate AUC jest otwarty — nawet AUC=0.5 zostanie wdrożone automatycznie   |
| `rollbackAucThreshold`         | **0.65**                      | sliding AUC < 0.65 → auto-rollback; rocAuc aktywnego < 0.65 → promote najlepszego         |
| `minHoursSinceLastTrain`       | 4                             | limit częstotliwości treningu w SelfEvaluation (cykl 24h) — **nie dotyczy** cronga 15-min |
| `TRAINING_BATCH_SIZE`          | 2000                          | sliding window: najnowsze 2000 wektorów                                                   |
| Split train/val                | 80/20                         | val = **najnowsze 20%** okna (chronologiczny)                                             |
| `FEATURE_NAMES`                | 24 cechy (v6)                 | predict wymaga dokładnie 24 (inaczej 400 `FEATURE_COUNT_MISMATCH`)                        |
| Cron                           | 15 min trening, 24h self-eval | `src/utils/cronService.ts`                                                                |
| `resyncLabels` limit           | 500                           | re-synchronizacja etykiet obejmuje tylko 500 najnowszych rekordów telemetrii              |
| `wells_ai_influence`           | 80 (obecnie)                  | po wdrożeniu model od razu wpływa na ranking produkcyjny                                  |

### Ważne niuanse (wpływają na interpretację metryk)

1. **Pierwszy model wdroży się automatycznie** nawet ze słabym AUC (gate otwarty). To nie jest "poprawny model" — to dopiero baseline. "Poprawność" definiujemy jako AUC >= 0.65 na walidacji (próg rollbacku) przy sensownej liczbie próbek walidacyjnych.
2. **AUC na małym val secie jest hałaśliwe**: przy 100 wektorach val = 20 próbek → AUC o wysokiej wariancji (przedział ufności rzędu ±0.1). Dopiero ~200+ wektorów (val >= 40) daje stabilną estymację.
3. **Sliding AUC jest pusty do czasu użycia AI w rankingu**: `recordPredictionResult` wywoływane tylko z `/ai/reward`, gdy `wasAiRanked && scoreBefore !== undefined`. Dopóki model nie jest aktywny i AI nie wpływa na wybór, auto-rollback nie ma danych.
4. **Etykiety zależą od feedbacku**: `resyncLabels` ustawia REJECTED/MODIFIED tylko gdy `wasRejected`/`wasModified`. Jeśli użytkownicy nie odrzucają/modyfikują, klasa negatywna nie powstaje → model degeneruje się do predykcji ~1.0 (AUC 0.5).
5. **`trainingEligible: true` ustawiane zawsze** przy zapisie telemetrii (`telemetryService.ts:134`) — każdy rekord z `dn` + `wellType` przechodzi do ekstrakcji.

## Metryki do monitorowania

| Metryka                                                                            | Źródło                                                                     | Próg akceptacji                                              |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `telemetryCount` (ai_telemetry_logs)                                               | `/ai/health`                                                               | rośnie każdego dnia roboczego                                |
| `featureCount` (AiFeature)                                                         | `/ai/health`, `/ai/ml-status`                                              | >= 100 (brama treningu)                                      |
| Nowe wektory/dzień                                                                 | delta `featureCount`                                                       | >= 10/dzień roboczy (przy 50 nowych → trening co ~1 tydzień) |
| Dystrybucja etykiet (ACCEPTED vs REJECTED+MODIFIED)                                | SQL: `SELECT label, COUNT(*) FROM AiFeature GROUP BY label`                | obie klasy obecne; klasa mniejszościowa >= 15% próbek        |
| Jakość danych (`withFeatureSnapshotPct`, `withSolverSourcePct`, `withWellTypePct`) | `/ai/health` `dataQuality`                                                 | >= 95%                                                       |
| Liczba modeli / wersja aktywna                                                     | `/ai/ml-status`, `/ai/models`                                              | >= 1 po pierwszym treningu                                   |
| AUC walidacyjne (rocAuc) + accuracy/precision/recall/f1                            | `/ai/models` (metrics)                                                     | docelowo >= 0.65                                             |
| Sliding AUC                                                                        | logi `SelfEvaluation` (`[mlSelfEvaluation]`)                               | >= 0.65                                                      |
| `driftPct`                                                                         | `/ai/health`                                                               | < 20%                                                        |
| Przyczyna pominięcia treningu                                                      | logi `TrainingPipeline` / `CronService` (`[mlTraining] pomijam: <reason>`) | `insufficient_data:N` → N zbliża się do 100                  |

## Etapy

### Etap 0 — Baseline: potwierdzenie czystego startu (dzień 0)

Kryterium wejścia: tabele AI/ML wyczyszczone (ai_telemetry_logs, AiFeature, AiModel, aiRewardLog, ai_knowledge_base, ai_recommendations, ai_config_history, ai_telemetry_events, ai_transition_snapshots, ai_telemetry_versions), brak aktywnego modelu.

Działania:

1. Sprawdź `/api/telemetry/ai/ml-status` → `mlOnline: false`, `featureCount: 0`, `modelCount: 0`, `featureVersion: v6`.
2. Sprawdź `/api/telemetry/ai/health` → `telemetryCount: 0`, `dataQuality` puste.
3. Sprawdź logi serwera po starcie → `CronService` zarejestrował `mlTrainingPipeline` (15 min) i `mlSelfEvaluation` (24h); `runMlTraining` loguje `pomijam: insufficient_data:0`.
4. Zweryfikuj, że frontend wysyła kompletny payload: otwórz konsolę przeglądarki → Network → `/api/telemetry/ai/config` → payload zawiera `dennicaHeight`, `kineta`, `totalPrice`, `totalWeight`, `appliedSeals`, `featureSnapshot`.

Kryterium wyjścia (wszystkie):

- `mlOnline: false`, `featureCount: 0`
- Cron działa (logi co 15 min)
- Telemetria z przeglądarki dociera (payload kompletny, brak 400/500)

### Etap 1 — Weryfikacja zbierania danych (dzień 0–3)

Kryterium wejścia: Etap 0 zamknięty.

Działania (powtarzane raz dziennie, najlepiej po południu):

1. `featureCount` i `telemetryCount` — licz przyrost; przy 0 rekordów przez 2 dni robocze → problem z wywołaniem `telemetryRecordConfig` (sprawdź, czy solver/offerManager faktycznie go woła — logi/Network).
2. Dystrybucja etykiet: `SELECT label, COUNT(*) FROM AiFeature GROUP BY label` (przez Prisma Studio lub skrypt). Sprawdź, czy pojawiają się REJECTED/MODIFIED — one powstają dopiero po feedbacku (accept/reject/modify) przez `/ai/reward`.
3. Kompletność cech: dla próbki rekordów `AiFeature` sprawdź `ringCount > 0`, `totalPrice > 0`, `totalWeight > 0`, `dennicaHeight NOT NULL`, `kinetaType NOT NULL` (wszystkie wysyłane od 2026-08-06).
4. `dataQuality` z `/ai/health` — pct >= 95%.
5. Obserwuj logi `TrainingPipeline`: `Brak nowych rekordow do ekstrakcji` / `Wyodrebniono N feature vectors` — potwierdza działanie ekstraktora.

Kryterium wyjścia:

- `featureCount > 0` i rośnie
- Obecne obie klasy etykiet (jeśli nie — to normalne na start, ale odnotuj; klasa negatywna potrzebna przed oceną AUC)
- `dataQuality` >= 95%
- Logi ekstrakcji potwierdzają działanie

### Etap 2 — Pierwszy trening i pierwszy model (próg 100 wektorów)

Kryterium wejścia: `featureCount >= 100` (brama `minFeatureCountForTraining`).

Co się stanie automatycznie:

- Cron co 15 min wywoła `trainingPipeline.run()` → ekstrakcja, `resyncLabels`, `resyncFeatures`, trening na 80% okna, walidacja na 20% (n=20), zapis modelu.
- **Gate wdrożenia otwarty** (`bestAuc < 0`) → model zostanie zapisany jako `active: true` z każdym AUC (także 0.5–0.6).
- `lastTrainedAt` ustawione; kolejne treningi wymagają >= 50 nowych wektorów.

Punkt kontrolny A — decyzja o wpływie na produkcję (KRYTYCZNY):

- Model staje się aktywny → `/ai/predict` i `mlDualRanking.js` zaczynają działać, a `wells_ai_influence=80` oznacza, że AI wpływa na ranking od razu.
- **Zalecenie**: przy pierwszym modelu z `rocAuc < 0.65` tymczasowo obniż `wells_ai_influence` do ~20–30 (ustawienie w `/api/telemetry/ai/settings`), żeby słaby baseline nie zaburzał doboru, a jednocześnie zbierać `scoreBefore` (dzięki `wasAiRanked`) do wypełnienia sliding AUC.
- Alternatywa (jeśli model od razu ma AUC >= 0.65): pozostaw influence = 80.

Działania weryfikacyjne po pierwszym treningu:

1. `/ai/ml-status` → `mlOnline: true`, `modelVersion`, `activeModelAuc`.
2. `/ai/models` → metryki: `rocAuc`, `accuracy`, `precision`, `recall`, `f1`, `trainSize`, `valSize`.
3. Logi: `Wytrenowano i wdrożono <version> (auc=<x>)`.

Kryterium wyjścia:

- Istnieje 1+ model w `AiModel`, jeden `active`
- Znany `rocAuc` pierwszego modelu i podjęta decyzja o `wells_ai_influence`

### Etap 3 — Stabilizacja: pierwszy POPRAWNY model (AUC >= 0.65)

Kryterium wejścia: Etap 2 zamknięty, model aktywny, zbierany feedback i sliding AUC.

Działania:

1. Obserwuj kolejne automatyczne treningi (co >= 50 nowych wektorów; przy tempie ~10–15/dzień roboczy to ~1 tydzień na kolejny trening). `deployAucImprovement=0` → każda poprawa AUC = auto-wdrożenie.
2. Śledź `rocAuc` w `/ai/models` — powinien rosnąć w miarę wzrostu liczby próbek (mniejszy val set → mniejszy szum).
3. Śledź sliding AUC w logach `[mlSelfEvaluation]` (cykl 24h) — to metryka "na żywo" jakości modelu na realnych decyzjach.
4. Sprawdź `feature-importance` (`/ai/feature-importance`) — które cechy niosą sygnał (wagi * zakres normalizacji); jeśli top cechy to szum (np. `season_num` dominuje), to sygnał do rozważenia nowych cech.

**Definicja "pierwszego poprawnego, wdrożonego modelu" (wszystkie warunki):**

- `rocAuc >= 0.65` (próg `rollbackAucThreshold` — model nie zostanie odrzucony przez self-eval)
- `valSize >= 30` (czyli `featureCount >= ~150`) — AUC na mniejszej próbce jest zbyt hałaśliwe, by uznać za wiarygodny
- Obie klasy etykiet w oknie treningowym (klasa mniejszościowa >= 15%)
- `sliding AUC >= 0.65` (jeśli dostępne) — brak auto-rollbacka w logach
- `driftPct < 20` w `/ai/health`
- Model `active` w bieżącej wersji cech (v6) i `mlOnline: true`

Kryterium wyjścia (sukces całego planu):

- Wszystkie powyższe warunki spełnione → model uznany za poprawny; influence można podnieść do 80 (jeśli był obniżony) i przejść do rutynowego monitorowania.

### Etap 4 — Diagnostyka: AUC nie rośnie / model nie przekracza 0.65

Kryterium wejścia: min. 4 tygodnie od Etapu 2 (lub `featureCount >= 500`) i `rocAuc < 0.65` w kolejnych modelach.

Checklista diagnostyczna (w tej kolejności):

1. **Dystrybucja etykiet** (najczęstsza przyczyna): `SELECT label, COUNT(*) FROM AiFeature GROUP BY label`.
    - Brak REJECTED/MODIFIED → model nie ma klasy negatywnej → AUC degeneracyjne 0.5. Sprawdź, czy frontend wysyła feedback (`/ai/reward` z akcjami REJECT/MODIFY) i czy `resyncLabels` je łapie (limit 500 — przy >500 wektorach starsze mogą mieć złe etykiety; `resyncFeatures` nie naprawia etykiet).
    - Działanie: poprawić obieg feedbacku (to zmiana w kodzie — osobny task).
2. **Jakość danych**: `dataQuality` pct < 95 → brak `featureSnapshot`/`solverSource`/`wellType` → cechy puste (0) → model nie ma sygnału. Sprawdź `extractProductId` (stringi vs obiekty) i czy `allComponentIds` nie jest puste.
3. **Cechy bez wariancji**: sprawdź w `AiFeature` min/max dla `ringCount`, `totalPrice`, `dennicaHeight` — jeśli stałe (np. wszystkie studnie identyczne DN), model nie ma czego się nauczyć. `normalize()` przy range=0 zwraca 0 (cecha martwa).
4. **Szum w val secie**: `valSize < 30` → AUC niestabilne; nie oceniaj modelu przed ~150 wektorami. Sprawdź `trainSize`/`valSize` w metrykach.
5. **Sygnatury błędów w logach**: `auc_insufficient` (model nie bije bestAuc — normalne przy słabym baseline), `error:*` (błędy ekstrakcji — patrz stack), `insufficient_new_data` (za wolny przyrost).
6. **Sliding AUC pusty** → AI nie ma wpływu na decyzje (`wasAiRanked` false) — model nie dostaje sprzężenia zwrotnego. Wymaga, by `mlDualRanking.js` faktycznie wywoływał predict i by `scoreBefore` był wysyłany w `/ai/reward`.
7. **Ostatnia deska ratunku — nowe cechy**: `rzDna` (payload `rzDna`), `terminationType` (`well.zakonczenie`), `dennicaMaterial` (`featureSnapshot.dennicaMaterial`) są już zbierane w telemetrii, ale NIEUŻYWANE (brak w `FEATURE_NAMES`). Wprowadzenie ich = bump `FEATURE_VERSION` do v7 + rozszerzenie `FEATURE_NAMES`/`oneHotEncode`/`buildFeatureVector` (zmiana w kodzie, osobny task). Uwaga: zmiana wersji cech czyści sliding AUC (zapisane w `SelfEvaluation`) i unieważnia stare modele — robić tylko przy realnym braku postępu, nie profilaktycznie.

Kryterium wyjścia:

- Zidentyfikowana przyczyna (1–7) i podjęta decyzja: naprawa feedbacku / jakości danych / dodanie cech — każda jako osobny task z własnym planem.

### Etap 5 — Decyzja: auto-cron vs ręczne monitorowanie

Stan faktyczny: auto-cron JUŻ działa (trening co 15 min z bramkami 100/50, self-eval co 24h z auto-rollbackiem). Nie ma potrzeby budowania nowego mechanizmu.

Rekomendacja (minimalny nakład):

- **Ręczne monitorowanie** = istniejący dashboard (`mlHealthDashboard` — karty Stan pipeline ML) + `/ai/ml-status` + `/ai/models` + logi. Wystarczy zaglądać 2× w tygodniu w Etapach 1–3.
- **Jedyna rzecz niewidoczna w dashboardzie**: dystrybucja etykiet (brak karty). Sprawdzaj ją kwerendą SQL przy każdym punkcie kontrolnym.
- Dodatkowy mechanizm (opcjonalnie, później — osobny task): alert/log, gdy `rocAuc` aktywnego < 0.65 lub brak nowych rekordów przez N dni. Nie jest wymagany do osiągnięcia celu.

## Testowanie / weryfikacja (bez zmian w kodzie)

| Co                           | Jak                                                                                                                  |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Pipeline działa end-to-end   | Logi `[mlTraining] nowy model ... AUC=...` / `pomijam: <reason>`                                                     |
| Endpointy odpowiadają        | `GET /api/telemetry/ai/ml-status`, `/api/telemetry/ai/health`, `/api/telemetry/ai/models` (admin)                    |
| Ręczny trening na żądanie    | `POST /api/telemetry/ai/train` (admin) — z `force=true`, przydatne tuż po osiągnięciu progu 100 (nie czekać na cron) |
| Ręczna aktywacja najlepszego | `POST /api/telemetry/ai/models/:id/activate` (admin) — gdy auto-wdrożenie zawiedzie                                  |
| Jakość danych                | `dataQuality` z `/ai/health` + SQL na `AiFeature`                                                                    |

## Ryzyka i mitigacje

| Ryzyko                                                                                     | Wpływ                                                         | Mitigacja                                                                                          |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **Pierwszy model (AUC 0.5–0.6) wdrożony automatycznie wpływa na produkcję** (influence=80) | Zły ranking studni                                            | Punkt kontrolny A: obniżyć influence do 20–30 do czasu AUC >= 0.65 (ustawienie istnieje, bez kodu) |
| Brak klasy negatywnej (feedback nie dociera)                                               | AUC degeneracyjne 0.5, model przewiduje ~1.0                  | Diagnostyka Etap 4.1; weryfikacja `/ai/reward` i `resyncLabels` na starcie                         |
| AUC na małym val secie (n=20 przy 100 wektorach)                                           | Fałszywa ocena jakości                                        | Nie oceniać modelu przed `valSize >= 30`; obserwować trend, nie pojedynczy punkt                   |
| Sliding AUC pusty (AI nie używane w rankingu)                                              | Brak auto-rollbacka / brak sygnału degradacji                 | Upewnić się, że `wasAiRanked` + `scoreBefore` są wysyłane po wdrożeniu modelu                      |
| `resyncLabels` limit 500                                                                   | Starsze wektory z niepoprawnymi etykietami przy >500 próbkach | Okresowo weryfikować dystrybucję etykiet; przy przekroczeniu limitu rozważyć pętlę (osobny task)   |
| Zero nowych rekordów (telemetria nie wywoływana)                                           | Pipeline nigdy nie ruszy                                      | Etap 1.1 — weryfikacja wywołań `telemetryRecordConfig` w solver/offerManager                       |
| Zmiana `FEATURE_VERSION` przedwcześnie                                                     | Czyści sliding AUC i unieważnia modele                        | Nowe cechy (rzDna/terminationType/dennicaMaterial) tylko po diagnozie Etapu 4.7                    |

## Kryteria sukcesu (definicja celu)

- [ ] `featureCount >= 100` i pierwszy model zapisany w `AiModel` (Etap 2)
- [ ] `rocAuc >= 0.65` na walidacji przy `valSize >= 30` (Etap 3)
- [ ] Obie klasy etykiet w oknie treningowym (klasa mniejszościowa >= 15%)
- [ ] Sliding AUC >= 0.65 — brak auto-rollbacka w logach
- [ ] `driftPct < 20`, `dataQuality >= 95%`
- [ ] Model `active` w v6, `mlOnline: true`, predict działa (brak 503/400)
- [ ] Świadoma decyzja o `wells_ai_influence` (podniesione do 80 lub celowo obniżone)

## Harmonogram orientacyjny

Założenie: ~10–15 rekordów telemetrii dziennie roboczym (biuro, ofertowanie studni). Przy braku ruchu czasy się wydłużają.

| Etap                 | Czas                                    | Warunek przejścia                           |
| -------------------- | --------------------------------------- | ------------------------------------------- |
| 0 — Baseline         | dzień 0                                 | czyste tabele, cron działa                  |
| 1 — Zbieranie danych | dni 0–3                                 | `featureCount > 0`, etykiety, jakość >= 95% |
| 2 — Pierwszy model   | ~dni 8–12 (100 wektorów)                | 1+ model aktywny, decyzja o influence       |
| 3 — Poprawny model   | ~dni 20–40 (150+ wektorów, AUC >= 0.65) | wszystkie kryteria sukcesu                  |
| 4 — Diagnostyka      | tylko jeśli brak postępu po ~4 tyg.     | zidentyfikowana przyczyna + osobne taski    |

## Decyzje do podjęcia po drodze (nie kod, ale wymagają zgody)

1. **Punkt kontrolny A (Etap 2)**: czy obniżyć `wells_ai_influence` do 20–30 przy pierwszym słabym modelu, czy zostawić 80.
2. **Punkt kontrolny B (Etap 3/4)**: kiedy wprowadzić nowe cechy (rzDna, terminationType, dennicaMaterial) — rekomendacja: dopiero gdy Etap 4.1–4.6 wykluczy inne przyczyny (min. 4 tygodnie danych).
3. **Punkt kontrolny C (Etap 5)**: czy wdrożyć alert monitorujący (log/powiadomienie) — opcjonalnie, nie blokuje celu.
