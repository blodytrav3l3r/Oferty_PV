# E5 — Decyzja skalowania (na liczbach z E3)

> **Status: COMPLETED.** Decyzja wiążąca (wariant A); plik zostaje w root, bo `.github/workflows/load-nightly.yml` się do niego odwołuje.

Baza: `docs/plans/archive/e3-perf.md` (baseline → po, 25/50/100 boundary).
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

## Re-measurement po E4 — 2026-09-16 (bez commita, bez zmian kodu)

E4 był zero-logic-change (split bajtowo identyczny, goldeny solverEquivalence
nietknięte) — wpływ perf ~nil z konstrukcji. Brak podstaw do atrybucji
jakiejkolwiek zmiany liczb do E4; re-pomiar potwierdza jedynie brak regresji,
nie poprawę.

### Oba zbiory liczb (źródło: `docs/plans/archive/e3-perf.md`)

- Stare (§3, duża DB ~1,3 GB, `--quick` mix 100 userów): write p95 ~0,9–1,1 s,
  batch-10 p95 1,4–2,5 s, DoD `P95 CRUD<500` FAIL, busyΔ 0, 5xx 0.
- Nowe (§7, świeży seed `loadtest_e3.sqlite`, `--quick` 60 s):
  `--users 25` p95 CRUD 64,7 ms, `--users 50` p95 CRUD 85,8 ms,
  `--users 100` p95 CRUD 230,7 ms; DoD PASS we wszystkich trzech,
  0 błędów (5xx/fail 0), busyDelta 0.

### Interpretacja różnicy (warunki, nie regresja ani cud)

Różnica to inne warunki, nie zmiana kodu: świeży mały seed (94 rury /
689 studnie, brak oferty studni → worker PDF idle, `pdfB=0`) vs duża
produkcyjna DB 1,3 GB; krótki steady 60 s (mała kolejka single-writera,
dbAvg 0,15–0,21 ms) vs stan z §3. Trend wewnątrz §7 (64,7 → 85,8 → 230,7 ms
wraz z liczbą piszących) jest spójny z tezą z §3 o serializacji zapisów —
po prostu na małej bazie i krótkim oknie mieści się pod progiem 500 ms.

### Re-review C (na tych liczbach)

PostgreSQL NIE jest potrzebny: żaden pomiar (§3 ani §7) nie pokazuje
bottlenecka poprawności (busyΔ 0, 5xx 0, odczyty zdrowe). Ogony zapisów
na dużej DB (§3: write ~1 s, batch 1,4–2,5 s) to problem latencji kolejki
single-writera, nie silnikowy. Potwierdzony wariant A (zostać na SQLite);
wariant B (batch/claim) warunkowo, jeśli sustained na realnej DB potwierdzi
ogony jako problem UX; wariant C odrzucony na dziś.

### Zrewidowane werdykty (warunkowe — do potwierdzenia sustained + real DB)

- 25: CONDITIONAL GO — quick PASS 64,7 ms; warunek: sustained 15 min + realna DB zamiast seedowej.
- 50: CONDITIONAL GO — quick PASS 85,8 ms; warunek: sustained 15 min + realna DB zamiast seedowej.
- 100: CONDITIONAL (bez GO na produkcję) — quick PASS 230,7 ms, ale stromy wzrost 85,8 → 230,7 ms + ogony §3 na dużej DB (1,4–2,5 s); warunek: sustained 15 min + realna DB zamiast seedowej.

### Luki dowodowe (jawne NIE-wykonane)

- Sustained 15 min lokalnie (`--sustained`, także pełny steady 300 s) — NIE WYKONANO (pokrywa job `load-sustained` dispatch/nightly).
- Pomiar PDF/export-pdf — N/A (świeży seed bez oferty studni, worker idle).
- Load na realnej dużej DB (~1,3 GB) z `--users 25/50/100` — NIE WYKONANO (wszystkie §7 na świeżym seedzie).
