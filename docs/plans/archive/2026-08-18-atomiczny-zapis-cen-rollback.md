# Plan: Naprawa okna niespójności w `saveDefaults()` (dual-write)

> **Data:** 2026-08-18
> **Plik:** docs/plans/2026-08-18-atomiczny-zapis-cen-rollback.md
> **Cel:** Zapis domyślnych cenników (plik JSON + `*_Default` + timestamp) jako operacja all-or-nothing.
> **Zakres:** `src/services/priceOverrideService.ts`, `tests/priceOverrideService.test.ts`, `AGENTS.md` (#45).

## Problem

`saveDefaults()` zapisuje plik przed transakcją DB. Upadek transakcji = plik nowszy niż baza (okno niespójności do restartu). Dodatkowo `settings.upsert` poza transakcją.

## Rozwiązanie

Kompensacja (rollback pliku przy błędzie transakcji) + `settings.upsert` wewnątrz `$transaction`. Crash pokrywa startowy self-heal (`app.ts:342`). `fsync` pominięty (YAGNI).

## Checkpointy

- [x] 1. Plan zapisany
- [x] 2. Serwis: `saveDefaults()` — oldContent, rollback w catch, `tx.settings.upsert` w transakcji
- [x] 3. Test: `txMock.settings` + asercja upsert w teście sukcesu
- [x] 4. Test: rollback przy padzie transakcji (renameSync ×2, treść = oldContent, rejects)
- [x] 5. Test: pad zapisu pliku = brak pracy DB (deleteMany/upsert nie wołane)
- [x] 6. AGENTS.md: wiersz #45 w tabeli błędów
- [x] 7. `npm run format`
- [x] 8. `npx tsc --noEmit`
- [x] 9. `npx jest tests/priceOverrideService.test.ts` → 10/10
- [x] 10. `npm run validate` → 128 suity, exit 0
- [x] 11. `npm run version:check` → spójne
- [x] 12. Commit `fix(settings): atomiczny zapis domyslnych cen (rollback pliku)` — `5db88ce`
- [ ] 13. `npm run release:patch` → 1.17.1 + tag
- [ ] 14. `npm run version:check` po release → EXIT 0
- [ ] 15. `git push --follow-tags`
- [ ] 16. Archiwizacja planu do `docs/plans/archive/`

## Matryca gwarancji

| Sytuacja                       | Stan po                                         | Mechanizm                 |
| ------------------------------ | ----------------------------------------------- | ------------------------- |
| Transakcja pada                | plik cofnięty + baza stara → spójne natychmiast | catch + rollback          |
| Zapis pliku pada               | baza nietknięta → spójne                        | file-first                |
| Crash po pliku, przed commitem | self-heal przy starcie dokonuje zapisu          | `restoreDefaultsFromJson` |
| Crash w trakcie commita        | atomowość SQLite → spójne lub self-heal         | SQLite + guard            |
