# P1 checkpoint — uprawnienia, determinizm DP, FK (migracja zweryfikowana)

## Fixy

- P1a: `PUT /clients` DELETE cudzych tylko admin/pro-opiekun (canDeleteDoc, 403 przed zapisem;
  edycja współdzielona bez zmian — Wariant A); DELETE rur przez `canWriteDoc` (pro/share działa);
  heartbeat/release locków z guardem read-access (404, holder nie wycieka).
- P1b: DP na `DP_MAX_ITERATIONS` + deterministyczny greedy (koniec wall-clock);
  PRECO error propagowany do UI (badge, nie ciche 0); PZ-save mutex.
- P1c: migracja `20260929000000_fk_pricelist_version` (Restrict ×5, sonda sierot 0).
  Weryfikacja: backup → deploy na kopii OK → FK ENFORCED → deploy na realnej OK (7 wersji całe).
  offer_number UNIQUE i productionNumber: po sondzie prod (nie ruszane).

## Bramy (FACT)

- `test:quick:lite`: 374 suit / 3997 PASS, 5 skip. `typecheck` BE+FE, `lint` BE+FE,
  `version:check`, `migrate status` up-to-date (17) — GREEN.

## Decyzja bramki

P1: SUCCESS. STOP — push całości po GO Tier 🔴.
