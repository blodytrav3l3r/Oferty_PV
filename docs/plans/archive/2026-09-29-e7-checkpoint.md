# E7 checkpoint — celowany `as any` (przyczyna, nie plaster)

## Przyczyna (FACT)

7× `(prisma/tx as any).document_shares` to martwy defens sprzed regeneracji klienta —
generated/prisma ma delegat, `shares.ts` i `users.ts:187` wołają bez casta i kompilują się.
Fix: zdjęcie castów (try/catch legacy zostają). Runtime 1:1.

## Zmiany

- ownership, offers crud ×2, studnieCrud, rury/studnieOrders crud: `tx/prisma.document_shares` typed.
- production.ts:257: jawny typ `ProductionOrdersBatchInput['data']` (req.body już waliduje Zod).
- Zostawione: tests/vm, `as unknown` (granica biblioteki), try/catch legacy DB.

## Bramy (FACT)

- `test:quick:lite`: 370 suit / 3966 PASS, 5 skip. `typecheck`, `lint`, `version:check` — GREEN.

## Decyzja bramki

E7: SUCCESS. STOP — E8 (UX tylko dotknięte ekrany) wymaga GO.
