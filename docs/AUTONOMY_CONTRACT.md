# Kontrakt autonomii agenta (S.O.K.)

Obowiązuje od 2026-09-12. Zmiana kontraktu wyłącznie za jawną zgodą użytkownika.

## Tiers

| Tier         | Zakres                                                                                                    | Tryb                                  |
| ------------ | --------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| 🟢 Autonomia | read-only audyty, testy, docs, małe fixy z zielonym `test:quick`, re-run pomiarów, commity docs/test-only | działanie + raport ex post, bez pusha |
| 🟡 Batch GO  | implementacje P1/P2, nowe plany, commity kodu                                                             | jedno GO na paczkę                    |
| 🔴 Osobne GO | push, restart/migracje/seed, progi ML, prod DB, operacje destrukcyjne w gicie                             | zawsze jawna zgoda                    |

## Twarde invarianty (niezależne od tieru)

1. GO na plan ≠ GO na kod. Raport przed commitem kodu.
2. Brak operacji na live DB poza zatwierdzonym drillem (fail-closed target, `--yes` tylko z `RESTORE_DB_PATH`).
3. Drill process nie startuje bez jawnego drill ENV (zweryfikowanego przed spawnem).
4. Progi ML i etykiety tylko na podstawie danych, nigdy na oko.
5. Wiarygodne negatywy bez sztucznych REJECT-ów.
6. Żadnego fallbacku do domyślnego `DATABASE_URL`.
7. Kryterium STOP z audytu przerywa paczkę natychmiast (NO-GO zamiast naprawiania w locie).

## Definicja „małego fixa" (🟢)

Jeden obszar, istniejący mechanizm, testy pokrywają zmianę, pełne `test:quick` zielone, diff do wglądu w raporcie. Wszystko inne → 🟡.
