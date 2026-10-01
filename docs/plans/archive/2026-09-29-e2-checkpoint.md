# E2 checkpoint — P0 pricing + numeric safety (prod fixy, testy GREEN)

## Fixy (reject, nie clamp)

- FE rabaty: `assertDiscountPct`/`readDiscountPct` w `actionsWellPricing.js`;
  `applyDiscount` strict-throw, `updateDiscount` parsuje numeryczny string z DOM (`actionsWellDiscounts.js`).
  Decyzja: THROW w obu warstwach (renderery bez try/catch — corrupt fail-loud zamiast złej ceny;
  brak klucza → 0 wstecznie). Komentarz w kodzie.
- BE Zod: jawny `discount` 0–100 finite w `wellComponentSchema`/`wellDataSchema` (`offerSchemas.ts`);
  `nullishDiscount` + `.finite()` w `orderSchemas.ts` (wagi/ceny >100 nadal legalne).
- AI batch: `features z.number().finite()` (400), dwufazowo score non-finite → 422 `NON_FINITE_SCORE`
  przed jakimkolwiek cache/rankingiem; zatruty cache = miss (`telemetryAiMl.ts`).
- Solver: isFinite guard rzędnych/requiredMm, ta sama ścieżka reject (`solverAutoSelect.js:89-109`).

## Bramy (FACT)

- Nowe: discountContract 67/67, solverFiniteGuard 9/9, aiFinite 9/9 (razem 108 z telemetryAiMl).
- `test:quick:lite`: 366 suit / 3906 testów PASS, 5 skip. `typecheck` BE+FE, `lint` BE+FE,
  `version:check` 1.33.0, `prices:verify` (z E1) — GREEN.
- Logika valid nietknięta (0/50/100 liczą jak dotąd; valid AI 200+cache+ranking bez zmian).

## Backlog z E2

- `offerDiscountsPopup.js:149` pisze `wellDiscounts` bezpośrednio (`parseFloat||0`) — obejście kontraktu,
  do ujednolicenia w E4.

## Decyzja bramki

E2: SUCCESS. STOP — E3 (FK lifecycle, logAudit inventory, orphan decisions) wymaga GO.
