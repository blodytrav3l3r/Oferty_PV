# P0 checkpoint — audyt post-E9 (4 bugi, w tym 3 własne)

## Fixy

- P0a render: wrappery `*Safe` w `actionsWellPricing.js` (kontrakt throw nietknięty),
  safe-swap w 17 plikach renderu (fallback 0% + badge `⚠`/flagi + warn, non-RangeError rethrow).
  Wpadka własna: bare `getItemAssessedPrice` w const → ReferenceError w sandboxie;
  fix typeof-guards, złapane przez `typecheck:frontend` + `excelHeaderProdCodes` (brama działa).
- P0b ensure: jedna `$transaction` per typ (create przed items), lock per-type + stały seq=1
  (P2002 → re-read ×3), `sha256(rows)` i `versionLabel` z serwisu. Reuse createDraft odrzucony:
  robi SCHEDULED (2 tx = okno partial zostaje).

## Bramy (FACT)

- `test:quick:lite`: 372 suit / 3976 PASS, 5 skip. `typecheck` BE+FE, `lint` BE+FE,
  `version:check` — GREEN. Nowe: renderCorrupt 7/7, ensure 4/4 (concurrent double-call → 1).

## Decyzja bramki

P0: SUCCESS. STOP — P1 (clients ownership, DP budżet, PRECO error-state, PZ guard, FK)
wymaga GO. Push całości po GO Tier 🔴.
