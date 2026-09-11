# Auto-dobór: przejścia na łączeniach kręgów (P1+P2, bez P3)

**Status:** plan zatwierdzony (GO — build), niezaimplementowany.
**Werdykt:** 9,8/10. Zakres domknięty. P3 odroczone do decyzji na danych po P1+P2.
**Data:** 2026-09-11.

## Twarde reguły (nie ruszać)

- **OT = containment korpusu rury** (dół..dół+DN w jednym segmencie).
- **Joint = walidacja względem strefy z zapasami** (osobna reguła).
- **`krag_ot` nie jest wyjątkiem od reguły jointów.**
- **`isMinimal` zostaje WARNING dla legalnego MIN-pass** — bez zmian semantyki, scoringu i DP.
- **Solver może tolerować suboptymalny układ, ale nigdy nie oznacza jako WARNING układu łamiącego twardą regułę geometryczną przejścia.**

## Twarde invarianty P2 (assertion/test contract)

- Po `excelOnPrzejscieChange` dla AUTO konfiguracja musi pochodzić z bieżących parametrów przejścia; nie wolno pozostawić starego auto-configu.
- MANUAL nie może uruchomić auto-solvera tylko dlatego, że zmieniła się geometria.

## Diagnoza (skrót)

1. OT wybierane po **środku** otworu (`center ∈ [start,end)`), walidacja jointów po **strefie** — rozjazd: joint w korpusie rury poza środkiem przechodzi.
2. Bypass `hasOTAbove && jointInBody` (`solverAutoSelect.js:838-844`) przepuszcza joint w korpusie, gdy segment wyżej to `krag_ot`. Triggeruje się tylko przy przecięciu korpusu (= niewykonalne) — do usunięcia.
3. Excel: `excelOnPrzejscieChange` (`excelChangeHandlers.js:160-164`) woła `_excelMarkAsManual` przed wszystkim, solver w ogóle nie startuje; stary stos zostaje przy nowej geometrii. W panelu głównym każda zmiana przejścia woła `autoSelectComponents(true)`.
4. DP (`ringOptimizer.js`) już liczy strefą — brak zmian w DP.

## P1.1 — wspólna geometria (nowy plik)

- Nowy `public/js/studnie/transitionZones.js`:
    - `getTransitionDn(pprod)` — SSoT DN dla dotkniętego flow (`split('/')[1]` → `parseFloat(dn)` → legacy `160`).
    - `getTransitionBody(pr, rzDna, resolveProd)` → `{ bottomMm, topMm, centerMm, dnMm }`.
    - `getTransitionZone(body, prod, mode)` — `'standard'` 300 / `'minimal'` 150 + `SAFETY_MARGIN` 15.
    - `segmentContainsBody(seg, body)` — `seg.start <= body.bottomMm && seg.end >= body.topMm`.
- Rejestracja `window.*`, wpis `public/js/types.d.ts`, `<script>` w `studnie.html` przed linią 355 (`wellConfigRules.js`), `?v=` = bieżąca `VERSION`.
- Poza zakresem: pozostałe 8 plików z własnym parsingiem DN (osobny task, nie ten).

## P1.2a — OT po korpusie (3× zamiana 1:1)

- `wellConfigRules.js:530` (`buildCandidateLayouts`), `diagramOtRings.js:135` (`checkSegmentHasHole`), `solverCore.js:113` (`applyDrilledRings`): `center ∈ [start,end)` → `segmentContainsBody()`.
- `applyDrilledRings` nie ma runtime callerów (tylko definicja + `window.*`) — zmiana zero-ryzyko, dla spójności.
- Przypadek `crossesJoint` dennica-krąg (`wellConfigRules.js:518-524`) bez zmian.
- Orientacja segmentów zweryfikowana: wszystkie 3 miejsca budują bottom-up w mm od dna — wspólny predykat bezpieczny.

## P1.2b — usunięcie bypassu OT

- Kasacja gałęzi `hasOTAbove && jointInBody` w `checkConflicts` (`solverAutoSelect.js:838-844`).

## P1.3 — komunikat + anty-bypass (bez zmiany semantyki)

- Odrębny komunikat dla kolizji w strefie minimalnej (np. `Kolizja otworu Z=… ze złączami (strefa minimalna)`).
- **Gate DONE:** sprawdzić, czy `recalculateWellErrors` (live walidator) nie degraduje tego ERROR do WARNING przy re-renderze. Test E powinien przejść przez pełny końcowy flow walidacji/renderu, jeśli architektura pozwala.

## P2 — przebudowa `excelOnPrzejscieChange` (kontrakt)

- Snapshot → zapis modelu (jak dziś), potem rozgałęzienie:
    - pole geometryczne (`rzednaWlaczenia`, `productId`) + AUTO (`autoSelect !== false`, `!autoLocked`, rzędne kompletne) → `_excelAutoSelectForWell(wIdx)`, **bez** `_excelMarkAsManual` (wzór: `excelOnRzednaChange`);
    - w przeciwnym razie dzisiejsza ścieżka manual (markAsManual + preview + debouncedRefresh).
- To samo dla `excelOnPrzejscieTypeChange` (zmienia productId/DN = geometria). Sam `angle` bez zmian.
- Ścieżka paste-quiet nietknięta (batch solve w `doneCallback`).

## Testy (obowiązkowe)

Nowy `tests/studnie/transitionZoneJoints.test.ts` (harness vm jak `excelDrilledRings.test.ts`):

- **A:** korpus w segmencie → OT tak.
- **B (regresja starego błędu, obowiązkowy na stałe):** środek w segmencie, korpus wystaje → OT nie.
- **C:** korpus równo na granicach (`bottom==start && top==end`) → OT tak; `bottom<start` / `top>end` → nie.
- **D:** korpus tnie joint → `checkConflicts.valid === false`.
- **E (anty-bypass):** `krag_ot` nad jointem w strefie → nadal FAIL, przez pełny flow walidacji.
- Test kontraktu P2 (vm stubs): AUTO+geometria → solver wołany, `autoSelect` nietknięty; MANUAL → solver nie wołany; sam angle → solver nie wołany.

Weryfikacja: `npx jest tests/studnie/transitionZoneJoints`, `npm run test:frontend`, `npm run typecheck:frontend`, `npm run lint:frontend`, `npm run format`, `npm run version:check`. Po implementacji wpis `docs/errors-known.md` #48.

## Bramka P3

Dopiero po P1+P2: zbierać `ERROR Kolizja…` z realnych ofert. P3 (DP świadomy dziur) tylko jeśli dane pokażą wyczerpanie top-20 DP jako istotną przyczynę resztkową.

## Addendum wdrożeniowe (2026-09-11)

- **Ujednolicenie resolution (P1.1+):** KROK3 resolve'uje produkt przejścia globalnie (`getStudnieProductById` → fallback `availProducts`), jak OT i ścieżka redukcyjna (`solverAutoSelect.js:1053`). Wcześniej niedostępny produkt dawał phantom DN160/0 zapasów w walidacji przy realnym DN w OT. Dla produktów dostępnych bez zmian.
- **Propagacja odrzuceń (P1.3):** `solve()` zlicza odrzucenia przez strefę minimalną (`holeRejectCount/Msg` na tablicy kandydatów); finalny ERROR to `Kolizja otworu Z=… (strefa minimalna)` zamiast generycznego "Nie znaleziono…", gdy ostatni stage tak odrzucał.
- **Goldeny:** 5 przypadków z przejściami w `solverEquivalence.golden.json` zmieniono świadomie — fixture używa GRP-1000 (DN1000, niedostępny w magazynie); przy spójnej geometrii joint nieuchronnie wchodzi w strefę minimalną (kursy ≤1000 vs strefa ~1330), więc poprawna odpowiedź to ERROR, nie pozorne OT. Przypadki 0prz bez zmian. Harnessy `solverEquivalence` i `excelDrilledRings` ładują `transitionZones.js` (jak `studnie.html`).
