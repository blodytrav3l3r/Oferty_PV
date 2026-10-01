# P2 checkpoint — hardening jawny + confirmy (bez zmian semantyki valid)

## Fixy

- `.finite()` jawne: reward dn/scoreBefore/scoreAfter, rankingScore/confidenceScore
  (zod v4 i tak odrzuca — to strażnik kontraktu, nie fix luki).
- `WELL_NOT_FOUND` 400 → 404 (celowo) + harness S8 i komentarze FE poza zakresem (do okazji).
- `logger.warn` w 2 cichych catch (locks best-effort, settings magazyn); version.ts cicho celowo
  (Docker bez repo, moduł zero-dep).
- `confirm()` → `appConfirm` (shareModal, pricelistVersions pvConfirm, dashboard) z fallbackami.

## Bramy (FACT)

- `test:quick:lite`: 376 suit / 4009 PASS, 5 skip. `typecheck` BE+FE, `lint` BE+FE,
  `version:check` — GREEN.

## Backlog (ryzyko > zysk, nie ruszane)

- reward-batch N+1/partial (projekt batch-tx), masowy `.passthrough()` → strict,
  `offer_number` UNIQUE (sonda prod), pełny UX 1.33.1.

## Decyzja bramki

P2: SUCCESS. STOP — push całości po GO Tier 🔴.
