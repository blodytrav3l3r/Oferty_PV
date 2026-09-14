# ADR-011: Model uprawnień dokumentów — edycja i opiekun dla każdego zalogowanego

Data: 2026-09-14
Status: zaakceptowana (polityka istniejaca, udokumentowana w ramach planu modernizacji F0 POL-01)
Powiązane: `src/utils/ownership.ts` (`canEditDoc`, `canAssignDoc`, `canDeleteDoc`), baza błędów #40

## Kontekst

Oferty i zlecenia w S.O.K. pracują na wspólnej bazie handlowców. Powstalo pytanie, czy `canEditDoc` / `canAssignDoc` zwracające `true` dla każdego zalogowanego użytkownika to błąd, czy świadoma decyzja.

## Decyzja

To **świadoma polityka**, nie błąd:

- **Odczyt**: właścicielski (`canReadDoc`: owner / pro-parent / admin) + udostępnienia (share).
- **Edycja i zmiana opiekuna**: każdy zalogowany (`canEditDoc` / `canAssignDoc` → `!!user`). Zapis przechodzi przez ten sam `versionedWrite` (409 przy konflikcie) — brak ścieżki bypass.
- **Usuwanie**: wyłącznie właścicielskie (`canDeleteDoc` = `canWriteDoc`) — operacja nieodwracalna, świadomie NIE otwierana dla wszystkich.
- **Legacy NULL**: `canWriteDoc` / `canReadDoc` zwracają `false` dla `docUserId = null` u nie-admina (baza błędów #40) — nie-admin nie nadpisze rekordu bez właściciela.

## Konsekwencje

Zmiana tej polityki (np. edycja tylko dla właściciela) wymagałaby osobnej decyzji ADR i migracji procesu sprzedaży. Do tego czasu: nie „naprawiać" `canEditDoc` — testy regresyjne mają chronić obecne zachowanie.
