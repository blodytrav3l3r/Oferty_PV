# E4 checkpoint — determinizm + UX safety + ID (bez migracji)

## Fixy

- AVR: `AVR_MAX_ITERATIONS = 1000` zamiast wall-clock 100 ms (pomiar: pełne przeszukanie ≤20 węzłów,
  50× zapasu, wynik identyczny). Explore: seedowany `mulberry32`, `explorationSeed` w logu/telemetrii/wyniku.
- UX: `appConfirm` przed removeWellComponent/clearWellConfig/qty<=0 (async callerzy w offerSvgDrag);
  double-submit guard w wellNotesModal; popup rabatów przez `applyDiscount` (throw → toast, brak zapisu).
- ID: `crypto.randomUUID` w auditService/clients/studnieCrud (test 10k, 0 kolizji).
- offer_number śledztwo (read-only): offers_rel 4 + studnie 3, zero duplikatów/NULL/pustych —
  UNIQUE możliwy, ale dopiero po sondzie prod DB (nullable → partial unique).

## Bramy (FACT)

- Nowe/rozszerzone: avrDeterminism (3× + load + gate budżetu + replay), uxSafety 9/9.
- `test:quick:lite`: 368 suit / 3924 PASS, 5 skip. `typecheck` BE+FE, `lint` BE+FE,
  `version:check` — GREEN.

## Decyzja bramki

E4: SUCCESS. STOP — E5 (walidacja pricelist/audit-ID, E5.5 security gate) wymaga GO.
