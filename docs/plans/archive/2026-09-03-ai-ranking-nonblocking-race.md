# P0: Nieblokujący AI ranking (race technical vs AI) — plan (NIEWYKONANY)

**Wersja:** 2026-09-03 (rev.1 po recenzji 9,2/10 → ~9,6/10) | **Status:** WYKONANE 2026-09-03 | **Priorytet:** P0

## Problem

`await window.rankCandidates(...)` w `solverAutoSelect.js:1171` blokuje auto-dobór.
Łańcuch sekwencyjny w `mlDualRanking.js` (665 → 675 → 482):

1. `getAiInfluencePct()` — fetch do 2 s, bez cache (przy braku override URL/localStorage),
2. `resolveFeatureVersion()` — fetch do 2 s,
3. `fetchAiScoresBatch()` — predict do 3 s + możliwy retry przy FEATURE_VERSION_MISMATCH.

Worst case na wolnym backendzie: ~7 s zamrożonego UI przed fallbackiem technicznym.
Normalnie: 1/10, auto-dobór: 4/10, worst-case UX: 5/10.

## Cel

Techniczny ranking natychmiast; AI dogrywa w tle tylko do telemetrii.
Semantyka bez zmian: shadow mode, `AUTO_AI` tylko przy realnej zmianie wyboru,
fallback `aiScore = -1` nietknięty, `wellSolver.js` i `solverAutoSelect.js` bez zmian
(cała zmiana wewnątrz `rankCandidates`).

## Twarde invariants (MUST — z recenzji 9,2/10)

1. **Budżet obejmuje CAŁY AI path** — race startuje PRZED `getAiInfluencePct()`
   i pokrywa metadata + predict. Zakazane: `await meta` przed `race`
   (inaczej do 4 s czekania przed wejściem w race).
2. **Po timeout zero czekania na AI** — po przegraniu race `rankCandidates()`
   nie może mieć żadnego późniejszego `await` zależnego od AI.
3. **Background AI pisze wyłącznie telemetry/evaluation state**
   (`recordAiRankDecision`, `scoreBefore` dla SelfEvaluation).
4. **Background completion NIGDY nie mutuje**: zatwierdzonej decyzji, `well`,
   DOM, stanu solvera ani oferty. `well._aiRankInfo` po dograniu tylko jeśli
   żaden observer/render nie reaguje na zmianę — zweryfikować testem.

## Kroki

1. **Cache metadanych — TTL 60 s** (`mlDualRanking.js`):
    - `getAiInfluencePct()`: `cachedInfluence = { value, expiresAt }`;
      pierwszy request fetch, kolejne 60 s cache, po TTL kolejny fetch.
      Bez nowego sprzężenia dashboard → ranking (hook odrzucony na P0).
    - `resolveFeatureVersion()` — flaga `_featureVersionFetched` już istnieje;
      zweryfikować, czy retry przy mismatch nie czyści cache agresywnie.
    - Efekt: 2. i kolejny auto-dobór = 0 fetchy meta. Pierwszy auto-dobór
      nadal chroniony invariantem 1 (race obejmuje metadata).
2. **Budżet czasowy całego bloku AI** (`rankCandidates`):
    - `Promise.race([aiPath(...), timeout(AI_RACE_BUDGET_MS)])`,
      `AI_RACE_BUDGET_MS = 800` (stała nazwana, nie magic number),
      gdzie `aiPath` = influence + featureVersion + predict.
    - Po przekroczeniu: `aiScoreMap` = wszystkie `-1` → czysty ranking techniczny
      natychmiast (istniejąca gałąź `aiScore < 0`).
3. **Dogranie w tle — struktura jawna**:
    - przegrany promise AI leci dalej (nie abortować); jego `.then()` robi
      WYŁĄCZNIE krok 3-telemetry (invarianty 3–4).
    - Guard: jeśli studnia / oferta zamknięta w międzyczasie — tylko telemetria,
      zero mutacji UI.
4. **Kill-switch**: `getAiInfluencePct()` już zwraca 0 przy OFF (wdrożone) —
   race nie dotyczy ścieżki OFF (early return przed fetchami).
5. **Testy** (`tests/studnie/`):
    - `slow AI never blocks rankCandidates and cannot mutate committed technical decision`:
      slow AI 5–7 s → `rankCandidates()` resolves < 900 ms; po dograniu AI:
      selection unchanged, brak drugiego rendera/decyzji solvera/zmiany oferty.
    - `fast backend → AI jak dziś` (regresja ścieżki normalnej).

## Poza zakresem (nie robić)

- Przebudowa `solverAutoSelect.js` / `wellSolver.js`.
- Pomiar burstu telemetrii przy bulk paste — celowo P1, PO P0
  (P0 usuwa potwierdzony problem sekund oczekiwania; burst wymaga
  najpierw pomiaru rzeczywistego zachowania, nie wyliczeń statycznych).
- Zwiększanie liczby cech, CV, częstszy trening (dopiero przy większym N).
- Cache `aiMlEnabled` na backendzie, backoff cronów (P2).

## Kolejność po P0

1. P1: monitoring jakości w `ml-status` (samples/pos/neg/ratio/baseline AUC).
2. P1: minimalny support w KnowledgeBase (wzór: N + confidence + support).
3. P2: cache flagi, backoff cronów. P3: CV/ewaluacja przy większym N.

## Walidacja po implementacji

`node -c` zmienionych plików, `typecheck:frontend`, `lint:frontend`,
szybkie testy Jest nowych przypadków, `npm run format`, `version:check` (bez bump).
