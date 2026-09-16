# E5 — Decyzja skalowania (na liczbach z E3)

Baza: `docs/plans/e3-perf.md` (baseline → po, 25/50/100 boundary).
Single-writer SQLite trzyma poprawność (busy=0, 5xx=0) kosztem latencji zapisów
(write p95 ~1 s, batch-10 p95 1,4–2,5 s). Odczyty zdrowe. DoD `P95 CRUD<500` FAIL
przed i po E3 — próg dotyczy mieszanego CRUD, nie samego writer-a.

## Decyzja: wariant A (zostać na SQLite), bez migracji

- Brak dowodu, że SQLite jest bottleneckiem poprawności — jest tylko wolniejszy
  na zapisach. Migracja do PostgreSQL (wariant C) odrzucona na dziś.
- Wariant B (kolejka/batch) warunkowo: jeśli sustained potwierdzi ogony zapisów
  jako problem UX, najpierw ścieżka batch/claim (mniej inwazyjna niż kolejka).

## Follow-up (osobne taski, nie część decyzji)

1. Flaga `--users 25/50/100` w `scripts/load-100.mjs` + sustained 15 min w CI.
2. Re-pomiar po E4 (refaktor nie zmienia logiki, ale potwierdza brak regresji perf).
3. Re-review C przy zmianie profilu (więcej writerów równolegle niż dziś).

## Status werdyktów (hipoteza z roadmapy: BEZ ZMIAN, do potwierdzenia sustained)

25 CONDITIONAL, 50/100 NO-GO — sustained z pkt 1 to potwierdzi lub zmieni.
