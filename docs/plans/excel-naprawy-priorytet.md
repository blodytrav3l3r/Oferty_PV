# Plan: Excel — P0/P1/P2 + szybkość N=2000 + jakość kodu

**Wersja:** 2026-10-15 (rew. A po recenzji zewnętrznej 8,5/10) · **Status:** do realizacji porcjami
**Kontekst:** HEAD po Fazie 2 (`e66f7af`) + mikro-PR (`1d1dc3e`) + fix CI (`3826ed0`). Audyty: E-107–E-113 w `docs/plans/_active-evidence.md`.
**Fakty bazowe:** realne max = 3 studnie/ofertę (N=2000 laboratoryjne); virtual ON (5k: 300s→4,9s); kontrakt L0/L1/L2 (`excelChangeHandlers.js:304-316`); inwarianty I-001/I-002/I-007.

> Uwagi recenzji (P0.1–P2, checkpointy A–F) uwzględnione poniżej jako twarde wymagania.
> Zweryfikowano lokalnie: `escapeHtmlAttr` koduje `"`→`&quot;`, `'`→`&#39;`
> (`shared/escapeHtml.js:19-21`); `deploy-production.needs` NIE zawiera axe
> (więc sam job w YAML ≠ blokada deploya); undo-gate N>100 (`excelUndo.js:107-109`).

---

## Batch 1 — P0: CI-gates + XSS + logger (3 OSOBNE PR-y, nie jeden pakiet)

Rozdzielenie ryzyk (P0.1): awaria testu XSS nie miesza się z logiką paste ani z CI.

### Krok 1.1. Job `excel-gates` w `.github/workflows/ci.yml` (blocking, jak axe)

```yaml
excel-gates:
  name: Excel — parity + golden + align (blokuje)
  runs-on: ubuntu-latest
  needs: test
  timeout-minutes: 15
  env:
    DATABASE_URL: 'file:./test-excel.sqlite?connection_limit=1&busy_timeout=30000'
    TEST_ADMIN_PASSWORD: test-admin-pass
    DEFAULT_ADMIN_PASSWORD: test-admin-pass
    PORT: '3000'
  steps:
    - uses: actions/checkout@v7
    - setup-node 22 + cache npm
    - npm ci
    - npx prisma generate
    - db push --skip-generate + npm run prisma:seed
    - npx playwright install --with-deps chromium
    - start serwera :3000 w tle (wzorzec load-quick):
        npm run build
        PORT=3000 NODE_ENV=test DATABASE_URL=... nohup node dist/server.js > excel-gates-server.log 2>&1 &
        poll curl -sf http://localhost:3000/health/ready 30x (FAIL, nie SKIP)
    - npm run test:parity          # exit 1 = rozjazd OFF vs ON
    - node tests/playwright/excelDomGolden.cjs   # BEZ --update (--update = autoryzacja stanu)
    - BASE_URL=http://localhost:3000 npm run test:alignment
    - stop serwera: kill $(cat pid) || true (if: always())
    - upload OUT (if: always(), 30d, warn):
        docs/plans/parity-excel-virtual-600.json
        docs/plans/golden-excel-dom-1200.json
        excel-gates-server.log
```

- Bez `paths-filter` (parity łamie też zmiana poza `excel*`, dowód E-111g).
- Rozważyć dopisanie `excel-gates` do `deploy-production.needs` (axe tam nie ma — decyzja przy PR).
- Koszt: ~6–9 min (bez 5k-OFF).

### P0.2 — gate musi RZECZYWIŚCIE blokować (checklista przed merge PR-a 1a)

- [ ] `deploy-production.needs` zawiera `excel-gates` (dziś zawiera m.in. `e2e-appname`, brak axe — sam YAML nie blokuje deploya).
- [ ] Protection rules gałęzi `main`: status `excel-gates` jako required (weryfikacja ręczna w GitHub Settings — nie da się z repo).
- [ ] Artefakty (`OUT JSON + server.log`) uploadowane także po FAIL wcześniejszego kroku (`if: always()`, wzorzec e2e-appname).
- [ ] Serwer i baza testowa izolowane (osobny plik `test-excel.sqlite`, osobny port/OUT) — zero dotyku prod/dev.
- [ ] Brak `/health/ready` = FAIL, nigdy SKIP (wzorzec `load-quick:440`).

### PR 1b. XSS `_excelErrorTitle` (osobny PR po 1a)

- Fix w `public/js/studnie/excelTableBody.js:18-24`: `escapeHtml(` → `escapeHtmlAttr(`,
  z guardem `typeof escapeHtmlAttr === function ? escapeHtmlAttr : escapeHtml`.
  UWAGA (P0.1): fallback NIE daje gwarancji w kontekście atrybutu — kontrakt `escapeHtmlAttr`
  zweryfikowany (`"`→`&quot;`, `'`→`&#39;`, `<`→`&lt;`); jeśli Attr niedostępny, test MUSI paść
  (fail-closed), nie cichy fallback. Zero nowych inline handlerów.
  Nie ruszać `:244` ani `_excelRowTitle` (podwójne escapowanie).
- Nowy test `tests/studnie/excelErrorTitleXss.test.ts` (wzorzec vm z `excelBulkProgressXss`):
  payload `" onmouseover="alert(1)` → brak żywego atrybutu, jest `&quot;`.
- Gate: RED przed fixem → GREEN po.

### Krok 1.3. `logger.warn` zamiast pustych `catch{}`

- Wzorzec guarda z `excelUndo.js:74-83` (`typeof logger … window.logger.warn`, cat + msg + `{wIdx,e}`).
- `_finishPaste` (`excelCopyPaste.js:415-548`): 13 punktów — finalizeAffected, recalc affected/sweep,
  dupColors, markDirty, refreshAll/updateSummary/wellsList/diagram, invalidateFiltered,
  `.catch` autoSelect po paście. `:437-439` silent-keep (kontrola przepływu).
- `excelChangeHandlers.js`: 9× warn (m.in. `:790` enforceOtRings, `:802` reliefPair, recalce);
  13× silent-keep (early-return, lookup-fallback, kosmetyka CSS).
- `calculationPipeline.js:56-65`: warn przy corrupt stats/recalc (nie kładzie ticka, ale loguje).
- Semantyka catch bez zmian (nadal swallow + warn). Zero danych użytkownika w logach.

### PR 1c. `logger.warn` (osobny PR po 1b — tylko obserwowalność, zero semantyki)

> (dotychczasowy krok 1.3 bez zmian treści; reguła: nie zmienia semantyki `catch`, logi bez danych użytkownika)

### Bramka Batch 1 (STOP przy RED) — per PR, nie per batch

`version:check` + `validate` + `lint:frontend` + `typecheck:frontend` + CI (w tym nowy job) + CodeQL GREEN.
Nowy `window.*`/`onclick` = STOP. Commit via `node scripts/commit.mjs`, push osobne GO.

---

## Batch 2 — P1: paste-perf (1 PR, kolejność krytyczna)

### Krok 2.1. Paste 6 renderów → 1 (`excelCopyPaste.js:364-549`)

- Batch model+dirty w quiet (`_excelPasteInProgress`), 1 snapshot undo, finalize raz.
- Kolejność NIETYKALNA (I-002): `_excelFinalizePasteAffected` → `recalculateWellErrors` → 1× `_excelRenderTable`.
- Kolory/strip/refreshAll jako faza tego samego ticku, nie osobne passy.
- I-007: paste ustawia MANUAL/autoLocked (bez tego ML nadpisze wklejone). I-001: zero `calcWellStats` w paście.

### Krok 2.2. `DupColors` inkrementalnie (`excelTableBody.js:894`)

- `Map<nazwa,count>` + `Map<nazwa,Set<dn>>` przyrostowo; przy paście tylko affected + bliźniaki nazwowe.
- Normalizacja nazwy i cross-DN (`otherDns`) IDENTYCZNE jak dziś. Full-pass tylko fallback.
- BLOCK: O(n²) lookup, nowy global, paint bez sticky, czytanie koloru jako statusu.

### Krok 2.3. Cache wag `updateSummary` (`wellUI.js:152`)

- Per-tick `Map<wellId,{weight,price,…}>`, `calculateOfferTotals` 1× per tick.
- Invalidator w `_excelClearResCache`/`_excelInvalidateFilteredIndexes` (wzór E-113a).
- `safeCalcWellStats` fallback zostaje; guard re-entrancy zostaje. Klucz min: `well.id+version+fingerprint(config)+pricelistVersionId`.

### P1.2 — kontrakt klucza cache (doprecyzowanie przed implementacją 2.3)

- Źródło każdej składowej klucza: `version` = licznik mutacji modelu (gdzie inkrementowany?),
  `fingerprint(config)` = funkcja + KOSZT (nie liczyć kosztownie przy każdym odczycie — budżet O(1) amortyzowanie),
  `pricelistVersionId` = aktywna wersja cennika (zmiana cennika MUSI invalidować).
- Invalidacja przy: zmianie cennika, konfiguracji, ręcznej edycji — macierz w teście.
- Cache NIGDY między ofertami (klucz zawiera offerId lub Map per otwarcie modala).
- Puste/zero/zaokrąglenia: test exact-value financjalny vs implementacja bez cache (nie tylko czas).
- Cache nie zmienia zasad kalkulacji — porównanie dokładnych wartości, nie czasów.

### Bramka Batch 2 (wszystkie PASS, inaczej revert całego PR)

unit → `test:parity` 31/31 → golden bez `--update` → bench throttle-x4 +15% → I-007 zero różnic kwot → zero longtask>50ms@50 → BLOCKi E-112g.

### P1.1 — metryki: czas to za mało (rejestruj rozłącznie, ten sam baseline)

- Czas całej operacji paste; czas przeliczenia modelu; czas renderowania DOM;
  liczba renderów i wywołań kalkulacji; czas do odzyskania interaktywności;
  poprawność końcowych wartości i podsumowań (osobna asercja, nie czas).
- Porównanie ZAWSZE: ten sam baseline + fixture + wersja przeglądarki + throttle.
  Bez tego próg `+15%` daje fałszywe poczucie bezpieczeństwa.

---

## Batch 3 — test-only (1 PR, zero prod)

### Krok 3.1. Testy Tab-fokus

- Tab-klawisz nie istnieje jako handler (natywny focus przeglądarki) — testuj łańcuch
  focusin → `excelSelectRow` (wzorzec `tests/frontend/excelArrowNav.test.ts`, prawdziwe pliki jednym evalem):
  Tab, Shift+Tab, Tab na ostatniej komórce, focus-trap modala.

### Krok 3.2. Throttle-nightly (`.github/workflows/excel-throttle-nightly.yml`)

```yaml
on:
    schedule: [{ cron: '0 3 * * *' }] # po load-nightly (02:00)
    workflow_dispatch:
jobs:
    throttle-x4: (timeout 30, THROTTLE_X4=1, BENCH_NS 1000 [+5000])
        parity + bench + golden → upload *-throttle-x4.json (30d)
```

- Advisory (jak e2e-extended) dopóki pomiary stabilne; brakujące aliasy golden/openPerf (E-210).

---

## Batch 4 — P2 (osobne PR-y, kolejność rosnące ryzyko)

### P1.3 — rozdział odpowiedzialności undo (Batch 2 vs Batch 4)

- Batch 2: korzysta Z ISTNIEJĄCEGO poprawnego mechanizmu snapshotu (1 snapshot/paste),
  optymalizuje tylko przebieg wklejania. Bez zmian formatu historii.
- Batch 4: zmienia STRATEGIĘ historii (patch-batch, N>100, diff/dirty-flag).
- NIGDY równolegle: nowe batchowanie renderów + nowy format undo w jednym PR = nierozstrzygalna regresja.

1. **undo-paste** — 1 snapshot/całe wklejenie, batch>100 reset w `doneCallback`; N>100 nigdy full-clone (toast, nie silent). STOP: parity wells+undo GREEN.
2. **full-clone-open** — `structuredClone(wells)` tylko N≤100; powyżej dirty-flag/diff. STOP: golden SHA stabilne.
3. **god-file-split** — wytnij `buildRow + rowTitle + dupMap` z `excelTableBody.js` (999 linii) jako czyste funkcje. STOP: `typecheck:frontend`, NEW globals = 0, ESM.
4. **N=2000** — tylko jeśli histogram prod pokaże P99>300 (dziś max=3 — laboratoryjne, nie blokuje merge).
   P2: próg P99 wymaga definicji operacyjnej ZANIM stanie się bramką: metryka
   (wellCount/ofertę), jednostka, populacja (oferty z jakiego okresu/statusu),
   okres pomiaru. Bez tego to życzenie, nie kryterium.
5. **Jakość** — `npm run format` + lint; pre-existing Prettier-fail odnotować, nie `--write` na ślepo.
   Podział god-file (`excelTableBody.js`) dopiero PO stabilizacji funkcjonalności —
   sama liczba linii nie uzasadnia refaktoryzacji.

---

## Checkpointy A–F (kolejność rekomendowana)

1. **A — stan bazowy:** HEAD, czysty worktree, istniejące testy, golden + baseline jako punkt odniesienia.
2. **B — CI i XSS:** test RED → fix kontekstu atrybutu → GREEN; weryfikacja gate + protection rules.
3. **C — logowanie:** tylko obserwowalność, bez semantyki `catch`; logi bez danych użytkownika.
4. **D — paste:** jedna zmiana naraz (rendery → duplikaty → cache), po każdej regresja + metryki P1.1.
5. **E — testy i pomiary:** Tab-focus, golden, parity, throttle-x4, nocne artefakty (początkowo advisory).
6. **F — P2:** undo/clone/refaktor w osobnych PR-ach, tylko po bramkach STOP.

---

## Guardrails globalne (każdy batch)

- I-001/I-002/I-007 czytać przed zmianą logiki; zmiana inwariantu tylko za jawną decyzją.
- `npm run version:check` przed każdym commitem/pushem (bez wyjątków).
- Commity: `node scripts/commit.mjs "typ(scope): opis"`. Push: osobne GO.
- XSS: treść → `escapeHtml`, atrybut → `escapeHtmlAttr`, zero nowych inline handlerów.
- Żadnego destrukcyjnego gita bez snapshotu (Tier A).

## Sukces

- [ ] Batch 1: CI-gates GREEN + XSS RED→GREEN + logi w paście/solverze
- [ ] Batch 2: paste ~2–3s (z 8–14s), parity+golden GREEN, bench +15%
- [ ] Batch 3: Tab-testy + nocny throttle artefakt
- [ ] Batch 4: 3× osobny PR z bramką STOP każdy
