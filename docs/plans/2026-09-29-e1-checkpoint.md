# E1 checkpoint — regression baseline (496e9bd affected, prod untouched)

## Bramy (FACT, wykonane 2026-09-29)

- `typecheck` BE+FE: GREEN
- `lint` BE+FE: GREEN
- `npx prisma validate`: GREEN (schema valid)
- `prices:verify`: GREEN (rury=95, studnie=690, preco=5+54+179; LIVE = Default = plik)
- `check-legacy-db.js`: OK (baza migration-managed)
- `test:quick:lite`: 3829 passed / 5 skipped + 23 fail TYLKO w nowym RED-teście kontraktu
  (bez niego suite w całości zielony — stan jak przed E1)

## Nowe testy

- `tests/studnie/avrDeterminism.test.ts` (GREEN, commit): 2× solve identyczne + po busy-wait.
  Uwaga: PASS pod load testowym ≠ dowód braku nondeterminizmu na prod (okno 100 ms) — E4 usuwa wall-clock.
- `tests/studnie/discountContractRED.test.ts` (RED 7 pass / 23 fail, NIE commitowany — usunięty z drzewa):
  `100.000001` → ujemna cena, `Infinity` → `-Infinity`, `"NaN"` → NaN w cenie,
  ingestia zapisuje wszystko bez throw. Dowód P0 do E2 (reject, nie clamp).

## Decyzja bramki

E1: SUCCESS. Prod kod nietknięty. STOP — E2 (fix rabatów/AI/solver-guardy) wymaga GO.
