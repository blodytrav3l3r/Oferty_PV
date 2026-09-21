# ADR-011: Model uprawnień dokumentów — zapis właścicielski (P0.1)

Data: 2026-09-14
Status: zrewidowana 2026-09-21 — pierwotna polityka „edycja dla każdego zalogowanego" zastąpiona P0.1
Powiązane: `src/utils/ownership.ts` (`canWriteDoc`, `assertWriteAccess`, `resolveAssignUserId`), baza błędów #40

## Kontekst

Oferty i zlecenia w S.O.K. pracują na wspólnej bazie handlowców. Pierwotnie `canEditDoc` / `canAssignDoc` zwracały `true` dla każdego zalogowanego użytkownika. W ramach P0.1 zapis zawężono do właścicielskiego.

## Decyzja

- **Odczyt**: właścicielski (`canReadDoc`: owner / pro-parent / admin) + udostępnienia (share).
- **Zapis i zmiana opiekuna**: właścicielskie (`canWriteDoc` / `assertWriteAccess` / `resolveAssignUserId` względem STAREGO i NOWEGO właściciela) — nie-admin nie podrzuci dokumentu obcemu.
- **Usuwanie**: wyłącznie właścicielskie (`canDeleteDoc` = `canWriteDoc`) — operacja nieodwracalna.
- **Legacy NULL**: `canWriteDoc` / `canReadDoc` zwracają `false` dla `docUserId = null` u nie-admina (baza błędów #40) — nie-admin nie nadpisze rekordu bez właściciela.
- `canEditDoc` / `canAssignDoc` / `resolveEditUserId` to **DEPRECATED** shimy (locki/numbering) — nie używać w zapisach dokumentów (`ownership.ts:110–146`).

## Konsekwencje

Zmiana tej polityki wymaga osobnej decyzji ADR. Nie „naprawiać" `canWriteDoc` w stronę otwierania — testy regresyjne chronią obecne zachowanie.
