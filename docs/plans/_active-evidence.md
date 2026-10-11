# F0+F1 Evidence Ledger - opieka: mine-team-all, read vs write (docs-only, 2026-10-11)

Scope: read-only audyt plus kontrakt 4 widokow. Bez zmian src, schema.prisma, migracji. Nadrzedny inwariant: I-003 (ownership.ts, canWriteDoc, fail-closed).

## Ledger

| ID     | Twierdzenie                                                                   | Dowod                                                                                                                                                       | Status           |
| ------ | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| E-001  | mine to owner plus shares                                                     | careService.ts:168-172 (col rowna uid OR shareCond EXISTS document_shares), followUpStats.ts:39-48 (userId IN allowed OR id IN sharedIds)                   | VERIFIED         |
| E-002  | team to pro lub admin, me plus subUsers plus shares                           | careService.ts:124-131, followUpStats.ts:189-192, roleFilter.ts:20-23 i 73-76                                                                               | VERIFIED         |
| E-003  | all to tylko admin, brak filtra                                               | careService.ts:120-122, followUpStats.ts:185-188, roleFilter.ts:16-17                                                                                       | VERIFIED         |
| E-004  | read via shares, write bez shares: shared to read-only                        | ownerCond doklada EXISTS shareCond do odczytu (careService.ts:153-183), a canWriteDoc zna tylko owner i pro-parent, brak galezi shares (ownership.ts:27-34) | VERIFIED         |
| E-005  | canReadDoc nie zna shares, a SQL scope tak: mozliwy rozjazd lista vs GET      | ownership.ts:9-15 (tylko owner, pro-parent, admin) kontra E-001                                                                                             | HYPOTHESIS do F3 |
| E-005a | GET followups share→200, POST share→403: odbiorca czyta timeline, zapisu brak | followUps.ts:421 (`canReadWithShare` → GET 200 dla share) kontra :126 (`canWriteDoc` → POST 403 dla share)                                                  | VERIFIED         |
| E-006  | dedup kluczem para offerKind plus offerId, latest to rn 1, licznik DISTINCT   | careService.ts:211-213 (ROW_NUMBER PARTITION BY offerKind offerId), careService.ts:269 (COUNT DISTINCT)                                                     | VERIFIED         |
| E-007  | repId tylko zweza w obrebie scope, nigdy nie poszerza, fail-closed 403        | resolveRepOwner (careService.ts:141-147), ownerCond narrowOwner doklada AND (careService.ts:165-183), followUpStats.ts:198-208                              | VERIFIED         |
| E-008  | follow-up scope via EXISTS, nie JOIN                                          | careService.ts:187-189, followUpStats.ts:211                                                                                                                | VERIFIED         |

## Finalny kontrakt 4 widokow (propozycja F1, bez zmian kodu)

1. owner: oferty gdzie userId to ja. visibility owner. canWrite true.
2. team (tylko pro i admin): oferty gdzie userId IN (ja plus subUsers). visibility team. canWrite true tylko gdy canWriteDoc, inaczej false.
3. shared: oferty gdzie document_shares wskazuje mnie. visibility shared. canWrite zawsze false (read-only, z E-004).
4. company (tylko admin): scope all, brak filtra. visibility company. canWrite true.
5. Mapowanie starych scope: mine to owner plus shared (stan obecny, E-001). team to owner plus team plus shared (E-002). all to company (E-003).
6. Dedup i kolejnosc: klucz (offerKind, offerId), wiersz z latest rn 1 (E-006), sort bucketWeight, next, offerKind, offerId. Liczniki COUNT DISTINCT jak careService.ts:269.
7. DTO: wiersz niesie visibility (owner-team-shared-company) i canWrite (bool z canWriteDoc). Pierszenstwo wyswietlania: owner przed team przed shared. Zapis: canWrite false to ukrycie akcji plus 403 z backendu (I-003), nigdy silent downgrade. repId zweza w obrebie widoku (E-007).

## HYPOTHESIS do F3 (runtime, nie static)

- H-1 (z E-005): ~~GET followups oferty shared daje 200 czy 403 dla odbiorcy. Jesli 403, lista pokazuje wiersz bez timeline: decyzja F3 to dolaczyc shares do canReadDoc albo odfiltrowac akcje.~~ VERIFIED-zamknięta przez E-005a: GET daje 200 (`canReadWithShare`), więc wiersz z listy ma timeline; zapis zostaje 403 (`canWriteDoc`).
- H-2: team u pro zawiera shared podwladnych czy tylko wlasne shared.
- H-3: all u admina z narrowOwner repId pokazuje tez shared tego repa czy tylko owned.
- H-4: ~~pro bez subUsers widzi w mine tylko shares (careService.ts:177: puste ids to sam shareCond).~~ REJECTED jako sformułowana: pusty zespół to nadal owner (własne oferty) plus shares, nie same shares — `mine` to owner plus shares (E-001), nie sam shareCond.
