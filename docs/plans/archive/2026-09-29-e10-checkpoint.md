# E10 checkpoint — validate+version, N+1 martwe, limit well-selections

## Fixy (bez zmian wyniku biznesowego)

- `validate` zaczyna od `version:check` (domyka lukę E7).
- `PUT /clients`: 63 → max 5 roundtripów (deleteMany + multi-row UPSERT w tej samej tx;
  guardy, NULL-owanie, ownerzy bez zmian). Test roundtripów.
- `reward-batch`: ~1000 findFirst → 3 findMany + 0 findFirst; zapisy per-item celowo
  (wspólny tx zmieniłby semantykę duplikatów). Test roundtripów.
- `well-selections`: `take: 500` (jedyny konsument: dashboard top-20, bez paginacji).

## Bramy (FACT)

- `test:quick:lite`: 378 suit / 4017 PASS, 5 skip. `typecheck`, `lint`, `version:check` — GREEN.

## Decyzja bramki

E10: SUCCESS. STOP — E11.1 (security users-enumeration) wymaga GO. Push po GO Tier 🔴.
