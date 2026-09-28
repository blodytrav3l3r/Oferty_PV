# E2E classification — co blokuje release (2026-09-28)

**Status:** DONE (klasyfikacja jawna, test `workflowStatus` P2.3).

| Job            | Klasyfikacja | Mechanizm                                  | Uzasadnienie                                              |
| -------------- | ------------ | ------------------------------------------ | --------------------------------------------------------- |
| `e2e-smoke`    | BLOCKING     | brak `continue-on-error`, w `needs` deploy | Core flow oferty musi przejść; fail = stop release        |
| `e2e-appname`  | BLOCKING     | retry 1x (flaky infra), potem fail         | Spójność nazwy; retry tylko na spawn, nie na asercje      |
| `axe-a11y`     | BLOCKING     | critical/serious failują                   | minor/moderate raportowane, nie failują (kom. P1.7)       |
| `e2e-extended` | ADVISORY     | `continue-on-error: true` (jawne)          | Draft/excel/partial scenariusze regresyjne; fail = raport |
| `load-quick`   | BLOCKING     | brak serwera = FAIL (P1.1)                 | Serwer budowany lokalnie — brak startu to realny błąd     |

Zasady: advisory NIE może promować do `needs` deploy; zmiana ADVISORY → BLOCKING
wymaga najpierw zielonego kwartału w raportach. `continue-on-error` bez wpisu
w tej tabeli = błąd (test `workflowStatus` P2.3 wylicza dozwolone).
