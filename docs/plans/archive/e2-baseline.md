# E2.0 — Baseline startowy E2

Punkt odniesienia dla E2 (DoD E2-D1) i E3 (kolumna BASELINE). Zebrane bez zmian kodu.

- HEAD: `5aad320` (E1: P0.1–P0.6 + migracja testów, push na main)
- `npm run version:check`: PASS (1.26.0 spójne we wszystkich źródłach)
- `npm run typecheck` + `typecheck:frontend`: PASS
- `npm run lint` + `lint:frontend`: PASS
- `npm run encoding:check`: OK (1767 plików, 0 błędów)
- `npm run test:quick:lite`: 225 suitów / 2639 testów PASS (po migracji testów E1)
- Worktree na starcie E2: czysty poza `docs/plans/2026-09-16-e2-e5-roadmap.md` (untracked)

Otwarte findings z E1 (do domknięcia w E2/E3):

- D1 restore drill fizyczny: UNVERIFIED (manualny, na izolowanej kopii dev)
- P1.* (draft, requestId, limity JSON, httpOnly, lock-GET, solver, DevOps): nie rozpoczęte
