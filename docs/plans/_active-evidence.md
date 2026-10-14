# F0+F1 Evidence Ledger - opieka: mine-team-all, read vs write (docs-only, 2026-10-11)

Scope: read-only audyt plus kontrakt 4 widokow. Bez zmian src, schema.prisma, migracji. Nadrzedny inwariant: I-003 (ownership.ts, canWriteDoc, fail-closed).

## Ledger

| ID     | Twierdzenie                                                                                                                                 | Dowod                                                                                                                                                                                              | Status                            |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| E-001  | mine to owner plus shares                                                                                                                   | careService.ts:168-172 (col rowna uid OR shareCond EXISTS document_shares), followUpStats.ts:39-48 (userId IN allowed OR id IN sharedIds)                                                          | VERIFIED                          |
| E-002  | team to pro lub admin, me plus subUsers plus shares                                                                                         | careService.ts:124-131, followUpStats.ts:189-192, roleFilter.ts:20-23 i 73-76                                                                                                                      | VERIFIED                          |
| E-003  | all to tylko admin, brak filtra                                                                                                             | careService.ts:120-122, followUpStats.ts:185-188, roleFilter.ts:16-17                                                                                                                              | VERIFIED                          |
| E-004  | read via shares, write bez shares: shared to read-only                                                                                      | ownerCond doklada EXISTS shareCond do odczytu (careService.ts:153-183), a canWriteDoc zna tylko owner i pro-parent, brak galezi shares (ownership.ts:27-34)                                        | VERIFIED                          |
| E-005  | canReadDoc nie zna shares, a SQL scope tak: mozliwy rozjazd lista vs GET                                                                    | ownership.ts:9-15 (tylko owner, pro-parent, admin) kontra E-001                                                                                                                                    | VERIFIED (domknięta przez E-005a) |
| E-005a | GET followups share→200, POST share→403: odbiorca czyta timeline, zapisu brak                                                               | followUps.ts:441 (`canReadWithShare` → GET 200 dla share) kontra :144 (`canWriteDoc` → POST 403 dla share)                                                                                         | VERIFIED                          |
| E-006  | dedup kluczem para offerKind plus offerId, latest to rn 1, licznik DISTINCT                                                                 | careService.ts:211-213 (ROW_NUMBER PARTITION BY offerKind offerId), careService.ts:269 (COUNT DISTINCT)                                                                                            | VERIFIED                          |
| E-007  | repId tylko zweza w obrebie scope, nigdy nie poszerza, fail-closed 403                                                                      | resolveRepOwner (careService.ts:141-147), ownerCond narrowOwner doklada AND (careService.ts:165-183), followUpStats.ts:198-208                                                                     | VERIFIED                          |
| E-008  | follow-up scope via EXISTS, nie JOIN                                                                                                        | careService.ts:187-189, followUpStats.ts:211                                                                                                                                                       | VERIFIED                          |
| E-009  | ETag panelu uniewaznia grant plus revoke shares (COUNT plus MAX rowid TEXT)                                                                 | careService.ts:500-521 (kolumna l: CAST COUNT AS TEXT plus MAX rowid), care.ts:204 (ETag per mailbox repOwner ?? user.id), test careEtagOwner.test.ts grant plus revoke                            | VERIFIED                          |
| E-010  | FE loading: showLoading plus clearLoading (aria-busy plus status), znika po renderze                                                        | carePanel.js:168-200 (showLoading plus clearLoading), :1730 plus :1756 (loadCarePanel plus finally), test carePanel.test.ts loading aria-busy plus status                                          | VERIFIED                          |
| E-011  | mailbox per rep: list per mailbox repOwner ?? self, zapis self-only, zgodne OPIEKA plus SECURITY plus ADR-015                               | care.ts:246-269 i 601-612 (list per mailbox), careService.ts:861-862 (sync self-only, odczyt per mailbox), docs OPIEKA.md plus SECURITY.md plus ADR-015                                            | VERIFIED                          |
| E-012  | sync z repOwner zwraca skipped rep-preview bez INSERT plus DELETE; ETag best-effort loguje debug; brak wiersza SLA loguje warn plus default | careService.ts:895 (skipped rep-preview), care.ts:210 (logger.debug ETag), careService.ts:683 (logger.warn SLA default 24 plus 7 plus 72)                                                          | VERIFIED                          |
| E-015  | R2A: unreadCount capped 101 bez full scan; retencja dalej tylko read; opt-lock SLA 409                                                      | careService.ts (CARE_UNREAD_CAP, LIMIT 101), followUpCareNotif.test.ts (granice + raw 502), care.ts (slaUpdatedAt, 409 Progi), followUpCareSlaScopes.test.ts (opt-lock)                            | VERIFIED                          |
| E-013  | R3: marker m ETag (schema plus migracja plus followUps plus careService-ETag plus careEtagOwner)                                            | schema.prisma:423-425, migrations/20261012000000 (ADD COLUMN + backfill), followUps.ts:108-115 + :193 + :328, careService.ts:524-551 (guarded m, slot 13.), careEtagOwner.test.ts (edit→ETag inny) | VERIFIED                          |
| E-014  | R2: hasOverflow plus badge 99+ (cap tylko prezentacja; unreadCount capped 101)                                                              | care.ts:269 (panel) plus :614 (notifications), carePanel.js:294 plus :299 plus :443-451 plus :1724 plus :1784, followUpCareNotifRoutes.test.ts:80-91, frontend carePanel.test.ts:1718-1775         | VERIFIED                          |

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
- H-2: ~~team u pro zawiera shared podwladnych czy tylko wlasne shared.~~ VERIFIED: tylko wlasne shared viewera (shareCond na sharedWithUserId to user.id) plus owned zespolu — careService.ts:170 plus :186-188, followUpStats.ts:36-50 (sharedIds to getSharedIdsForUser user.id). Z repId: owned repa plus wlasne shared viewera na ofertach repa (AND col to narrowOwner), nie shared repa.
- H-3: ~~all u admina z narrowOwner repId pokazuje tez shared tego repa czy tylko owned.~~ VERIFIED: tylko owned repa — careService.ts:172-173 (all plus narrowOwner to sam col to narrowOwner, bez shareCond), followUpStats.ts:34-35 (allowedIds null plus narrow to userId to narrow).
- H-4: ~~pro bez subUsers widzi w mine tylko shares (careService.ts:177: puste ids to sam shareCond).~~ REJECTED jako sformułowana: pusty zespół to nadal owner (własne oferty) plus shares, nie same shares — `mine` to owner plus shares (E-001), nie sam shareCond.

## P0.0 baseline Excel (2026-10-14, BUILD MODE P0.0 only, docs-only)

Scope: dopisane na koncu, historia E-001..E-015+E-005a nietknieta. Nowe ID E-100+ rozlaczne (zajete E-001..E-015, E-005a per odczyt 2026-10-14). Kod prod nietkniety.

## Ledger P0.0

| ID    | Twierdzenie                                                                                                       | Dowod                                                                                                                      | Status     |
| ----- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------- |
| E-100 | HEAD to 6fdb3a0 fix(studnie): parity excel manual paste ceny naglowki xss                                         | `git rev-parse HEAD` = 6fdb3a0209dafa8c700ebd0bb6ef9277221d4778; `git log --oneline -3` (6fdb3a0/d6d1737/ac09a47)          | VERIFIED   |
| E-101 | branch main ahead 1, tracked clean, 1 untracked plan P0.0                                                         | `git status`: main...origin/main [ahead 1], ?? docs/plans/P0.0-baseline-excel.md, zero modified                            | VERIFIED   |
| E-102 | diff tracked pusty (brak cudzych zmian w worktree)                                                                | `git diff HEAD --stat` pusty; `git diff --stat` pusty (2026-10-14)                                                         | VERIFIED   |
| E-103 | plan P0.0 istnieje: v1.0, Q1-Q3 zamrozone, 4 warunki, bramka 8/8, STOP przed P0.1                                 | docs/plans/P0.0-baseline-excel.md (55 linii): :4 HEAD 6fdb3a0, :5 STOP przed P0.1, :9-11 Q1-Q3, :23-27 warunki, :36 bramka | VERIFIED   |
| E-104 | nowe ID E-100+ rozlaczne, zero kolizji z historia                                                                 | historia zajmuje E-001..E-015 + E-005a; E-100+ poza zakresem                                                               | VERIFIED   |
| E-105 | mapowanie Zod wejscie-vs-zapisane + RED z wlasciwego powodu + macierze (regresja/cache/rozliczenia/perf) wykonane | brak artefaktu wykonania w planie (tylko spec :15-16, :36); brak FAIL log, brak bench artefaktu                            | HYPOTHESIS |
| E-106 | P0.0 pozwala na zmiany kodu prod / przejscie do P0.1                                                              | plan :5 STOP przed P0.1, :15 P0.0 GO reszta czeka na bramki, :55 bez nich brak GO na P0.1                                  | REJECTED   |

## Checkpoint P0.0

- CLAIM: ledger P0.0 dopisany na koncu _active-evidence.md, historia nietknieta, kod prod nietkniety.
- EVIDENCE: docs/plans/_active-evidence.md (sekcja P0.0, E-100..E-106); docs/plans/P0.0-baseline-excel.md:4-5,9-11,23-27,36,55; HEAD 6fdb3a0209dafa8c700ebd0bb6ef9277221d4778.
- REPRODUCTION: git rev-parse HEAD, git status --short --branch, git diff HEAD --stat, git log --oneline -3 (2026-10-14, EXIT 0).
- BEFORE: HEAD 6fdb3a0, main...origin/main [ahead 1], tracked clean, untracked docs/plans/P0.0-baseline-excel.md.
- AFTER: tylko _active-evidence.md modified (sekcja P0.0); kod prod bez zmian.
- CHANGE: append-only, E-100..E-106 (5x VERIFIED, 1x HYPOTHESIS, 1x REJECTED).
- TESTS: brak runtime w P0.0-docs (validate/test:quick nie uruchamiane; docs-only, zero zmian kodu). E-105 HYPOTHESIS czeka na RED/bench.
- DIFF: git diff -- docs/plans/_active-evidence.md (ponizej w raporcie).
- COMMIT: brak (zadanie: zwroc diff, nie commituj).
- VERIFIED: YES dla E-100..E-104, NO dla E-105 (HYPOTHESIS), REJECTED E-106.
