# E6 checkpoint — PR gate CI (lekki, ciężkie zostają na main)

## Zmiana

- Nowy job `pr-gate` w `ci.yml` (`if: pull_request`, `needs: [lint, typecheck]`):
  `version:check` + `prisma validate` + generate + `db push` + seed + `prices:verify`.
- Ciężkie bez zmian (tylko push→main): drift-check, migrate-deploy-verify, load-quick,
  docker-build, flaky-detect, deploy.
- Test strażniczy w `workflowStatus.test.ts` (pr-gate istnieje, blokujący).
- Wpadka: pierwszy komentarz zawierał token `load-quick` i złamał test semantyczny
  (indexOf) — naprawione rephrasem komentarza, nie testu.

## Bramy (FACT)

- `workflowStatus`: 11/11. YAML parsowalny, `pr-gate.if = pull_request`.
- `version:check` — GREEN (bez zmian wersji).

## Decyzja bramki

E6: SUCCESS. STOP — E7 (celowany `as any`) wymaga GO.
