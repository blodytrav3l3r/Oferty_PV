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

## Baseline throttle-x4 Faza 1 (2026-10-15, BUILD MODE F1 docs-only, zero kodu prod)

Scope: odczyt PERF_BASELINE + F1 JSON + naglowki 4 harnessow. Bez zmian public/js, src, prisma. Historia E-001..E-015, E-005a, E-100..E-106 nietknieta. Nowe ID E-200+ rozlaczne.

## Ledger Faza 1

| ID    | Twierdzenie                                                                                                              | Dowod                                                                          | Status     |
| ----- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | ---------- |
| E-200 | DEFAULT ON TRUE, OFF tylko via param lub localStorage, bramy parity 31/31 + bench                                        | docs/PERF_BASELINE.md:6-22                                                     | VERIFIED   |
| E-201 | Baseline 1k/5k: ON 0.6 s vs OFF 6.4 s / 32 s, DOM 12k vs 139k / 679k                                                     | docs/PERF_BASELINE.md:24-35                                                    | VERIFIED   |
| E-202 | F1 JSON 1200: fixture 1200 seed 20260912, cold 5 + warm 5, cold openMs 530, warm openMs 468, sticky dominuje 156/151 ms  | docs/plans/baseline-excel-open-1200-f1.json:2-9, cold:155, warm:161            | VERIFIED   |
| E-203 | Parity: OFF vs ON ten sam scenariusz, SSoT wells+undo, N 600, macierz render/scroll/edit/undo + F2/F3                    | tests/playwright/excelVirtualParity.cjs:1-16, N :16, launch :424-427           | VERIFIED   |
| E-204 | Bench: OFF vs ON 1k/5k, open/modal/DOM/scroll/edit                                                                       | tests/playwright/excelVirtualBench.cjs:1-9, launch :106-109                    | VERIFIED   |
| E-205 | Golden: kontrakt DOM view-only, SHA-256 thead+tbody per tab x6, OUT golden-excel-dom-1200.json, update tylko autoryzacja | tests/playwright/excelDomGolden.cjs:1-15, OUT :24, launch :121-124             | VERIFIED   |
| E-206 | OpenPerf: fixture 1200, cold 5 swiezy kontekst + warm 5 close-reopen, OUT baseline-excel-open-1200-f1.json               | tests/playwright/excelOpenPerf.cjs:1-16, OUT :26, RUNS :24-25, launch :174-177 | VERIFIED   |
| E-207 | CHROME_PATH env fallback we wszystkich 4 (process.env.CHROME_PATH lub wbudowany headless-shell)                          | parity :29-31, bench :22-24, golden :38-40, openPerf :38-40                    | VERIFIED   |
| E-208 | throttle-x4 BRAK w kodzie: launch args tylko no-sandbox + disable-setuid-sandbox, grep throttle/CPU zero trafien         | 4x launch (E-203..E-206), grep tests/playwright                                | VERIFIED   |
| E-209 | disable-gpu BRAK w kodzie: grep zero trafien w tests/playwright                                                          | launch args jw.                                                                | VERIFIED   |
| E-210 | Npm aliasy: test:parity + test:bench istnieja; golden/openPerf tylko direct node, brak aliasu                            | package.json:20-21                                                             | VERIFIED   |
| E-211 | Repro F2 z throttle-x4 + disable-gpu: HYPOTHESIS, F1 bez runtime, harnessy nie uruchomione                               | brak logu wykonania                                                            | HYPOTHESIS |

## Repro baseline (F2 target, GO baseline-throttle-x4)

Wymaga: backend na localhost:3000 (kazdy harness). CHROME_PATH: jesli env pusty, harness uzywa wbudowanego headless-shell; jawny override: SET CHROME_PATH=sciezka przed node.

1. npm run test:parity [tests/playwright/excelVirtualParity.cjs]
2. npm run test:bench [tests/playwright/excelVirtualBench.cjs]
3. node tests/playwright/excelDomGolden.cjs [porownanie; z flaga --update tylko autoryzacja nowego stanu]
4. node tests/playwright/excelOpenPerf.cjs [zapis docs/plans/baseline-excel-open-1200-f1.json]
   F2 dopisuje (kod harnessow, nie F1): args + disable-gpu + CDP setCPUThrottlingRate rate 4; wtedy powyzsze 4 komendy sa pelnym repro throttle-x4.

## Checkpoint Faza 1

CLAIM: ledger F1 dopisany append-only, kod prod nietkniety. EVIDENCE: ta sekcja E-200..E-211 + pliki:linie w kolumnie Dowod. REPRODUCTION: odczyt 6 plikow (PERF_BASELINE, F1 JSON, 4 naglowki + 4 launch + package.json), grep throttle/CPU/disable-gpu/CHROME_PATH. BEFORE: _active-evidence.md 70 linii (F0+F1+P0.0). AFTER: + ta sekcja. CHANGE: docs-only. TESTS: brak runtime w F1 (E-211 HYPOTHESIS czeka na F2). DIFF: git diff -- docs/plans/_active-evidence.md. COMMIT: brak (Faza 1 zwraca artefakt, nie commituje). VERIFIED: YES dla E-200..E-210, NO dla E-211.
Gotowosc do Fazy 2: TAK. Faza 2 = dopisac throttle-x4 + disable-gpu do 4 harnessow, odpalic 4 komendy repro, mediany do JSON, potem GO na kod.

## GO-2 throttle-x4 wrapper (2026-10-15, BUILD MODE GO-2 docs-only, zero kodu prod)

Scope: dopisane na koncu, historia E-001..E-015, E-005a, E-100..E-106, E-200..E-211 nietknieta. Nowe ID E-107 (jedno, rozlaczne - E-100+ zajete przez P0.0, E-200+ przez Faze 1). Kod prod nietkniety, harnessy nietkniete (to robi architect/builder).

## Ledger GO-2

| ID    | Twierdzenie                                                                                                                                                       | Dowod                                                                                                                                                                                                                                                                                                                                                                               | Status   |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| E-107 | HEAD to 4ed4eab chore(release): 1.46.0 (drift od E-100 6fdb3a0); decyzja GO-2: wrapper THROTTLE_X4=1 + --disable-gpu + CHROME_PATH z env + OUT *-throttle-x4.json | git rev-parse HEAD = 4ed4eab98f759f3c84da9971ee69624709dd3e88; git log --oneline -5 = 4ed4eab/385c4f7/5fa63e0/c633590/b083626; 6fdb3a0 w historii (git log --all); grep THROTTLE/throttle/setCPUThrottling/disable-gpu w tests/playwright/*.cjs = zero trafien (wrapper niezaimplementowany, czeka na architect/builder); CHROME_PATH env pusty (fallback headless-shell per E-207) | VERIFIED |

## Repro throttle-x4 (F2 target, czeka na architect/builder)

Wymaga: backend na localhost:3000; wrapper w 4 harnessach: process.env.THROTTLE_X4 === "1" doklada --disable-gpu do launch args + CDP Emulation.setCPUThrottlingRate rate 4; CHROME_PATH z env (pusty = wbudowany headless-shell per E-207); OUT obok baseline, bez nadpisywania F1 (*-throttle-x4.json).

1. $env:THROTTLE_X4=1; npm run test:parity [tests/playwright/excelVirtualParity.cjs -> OUT *-throttle-x4.json]
2. $env:THROTTLE_X4=1; npm run test:bench [tests/playwright/excelVirtualBench.cjs -> OUT *-throttle-x4.json]
3. $env:THROTTLE_X4=1; node tests/playwright/excelDomGolden.cjs [porownanie; OUT golden-excel-dom-1200-throttle-x4.json]
4. $env:THROTTLE_X4=1; node tests/playwright/excelOpenPerf.cjs [zapis baseline-excel-open-1200-f1-throttle-x4.json, bez nadpisywania F1 JSON]
   Bez THROTTLE_X4=1 harnessy zachowuja sie jak dzis (F1 baseline, E-211).

## Checkpoint GO-2

- CLAIM: ledger GO-2 dopisany append-only (E-107), historia nietknieta, kod prod + harnessy nietkniete.
- EVIDENCE: ta sekcja E-107; HEAD 4ed4eab98f759f3c84da9971ee69624709dd3e88; drift E-100 6fdb3a0 nadal w historii.
- REPRODUCTION: git rev-parse HEAD, git log --oneline -5, git status --short --branch (M docs/plans/_active-evidence.md, ?? docs/plans/P0.0-baseline-excel.md), grep THROTTLE/disable-gpu zero, echo CHROME_PATH pusty (2026-10-15, EXIT 0).
- BEFORE: HEAD 4ed4eab, E-211 HYPOTHESIS (repro F2 bez runtime).
- AFTER: tylko docs/plans/_active-evidence.md modified (sekcja GO-2); kod prod + harnessy bez zmian.
- CHANGE: append-only, E-107 VERIFIED.
- TESTS: brak runtime w GO-2-docs (validate/test:quick nie uruchamiane; docs-only). E-211 nadal HYPOTHESIS do odpalenia 4 komend po wrapperze.
- DIFF: git diff -- docs/plans/_active-evidence.md.
- COMMIT: brak (zadanie: nie commituj, nie pushuj).
- VERIFIED: YES dla E-107.

## Diagnoza login-500 (2026-10-15, BUILD MODE diagnoza, docs-only, zero kodu)

Scope: dopisane na koncu, historia E-001 do E-015, E-005a, E-100 do E-106, E-200 do E-211, E-107 nietknieta. Nowe ID E-108, jedno, rozlaczne. Kod prod plus harnessy nietkniete tym dopiskiem. Bez commita, bez pusha.

## Ledger E-108

| ID     | Twierdzenie                                                                                              | Dowod                                                                                                                                                                                                       | Status     |
| ------ | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| E-108a | Symptom: POST /api/auth/login 500, GET /health 200, brak OUT z danymi 0 z 4 harnessow                    | zgloszenie sesji: OUT 0 z 4, login 500 blokuje repro throttle-x4; brak logu serwera w repo                                                                                                                  | HYPOTHESIS |
| E-108b | Zamrozone: HEAD 4ed4eab chore(release) 1.46.0, log -3 4ed4eab/385c4f7/5fa63e0                            | git rev-parse HEAD daje 4ed4eab98f759f3c84da9971ee69624709dd3e88, git log --oneline -3 z 2026-10-15                                                                                                         | VERIFIED   |
| E-108c | Zamrozone: version check PASS 1.46.0 we wszystkich zrodlach                                              | npm run version check: VERSION plus package.json plus package-lock plus CHANGELOG plus bat plus README plus docs plus HTML v daje 1.46.0, status Spojne                                                     | VERIFIED   |
| E-108d | Zamrozone: wrapper throttle DONE w worktree, uncommitted: throttleHelper plus 5 harnessow M              | git status: M _active-evidence plus 5 harnessow parity bench golden openPerf perfBaseline, nowe throttleHelper plus P0.0 plan; grep THROTTLE_X4 daje throttleHelper 12 21 35 plus parity 716 plus bench 208 | VERIFIED   |
| E-108e | Przyczyna P1: env lub DATABASE_URL lub JWT brak albo zly, login 500 a health 200                         | brak odczytu env i logu w sesji docs-only, do weryfikacji krokiem D2                                                                                                                                        | HYPOTHESIS |
| E-108f | Przyczyna P2: dryf schematu DB, migrate status, baza legacy db-push bez historii, login query 500        | brak prisma migrate status w sesji, do weryfikacji krokiem D3                                                                                                                                               | HYPOTHESIS |
| E-108g | Przyczyna P3: brak seeda admina, users pusty albo zle haslo, login 500 lub 401 maskowany jako 500        | brak odczytu seed w sesji, do weryfikacji krokiem D4                                                                                                                                                        | HYPOTHESIS |
| E-108h | Przyczyna P4: regresja kodu auth po 385c4f7 albo 5fa63e0, validator albo service rzuca na kazdym loginie | brak stack trace z logu serwera, do weryfikacji krokiem D1 plus D5                                                                                                                                          | HYPOTHESIS |

## Plan diagnozy D1-D5, kolejnosc, read-first, zero kodu

1. D1 log serwera: odpalic backend na localhost 3000, spisac stack trace POST login 500 plus potwierdzic GET health 200.
2. D2 env: sprawdzic istnienie env, DATABASE_URL, JWT secret, haslo admina, bez wklejania sekretow, porownac z env example.
3. D3 prisma status: npx prisma migrate status plus read-only select count z users, wykryc baze legacy db-push vs migrate deploy.
4. D4 seed: jesli users pusty to sciezka ensure-db albo seed z docs, potem retry login.
5. D5 repro curl: curl POST login plus GET health, zapisac kody plus body bez hasla, potem decyzja GO na repro throttle-x4 z E-211.
   Bez D1-D5 brak zmiany statusu E-108a plus E-108e plus E-108f plus E-108g plus E-108h z HYPOTHESIS na VERIFIED albo REJECTED.

## Checkpoint E-108

- CLAIM: dopisek E-108 append-only, historia nietknieta, kod plus harnessy nietkniete tym dopiskiem.
- EVIDENCE: ta sekcja E-108a do E-108h; HEAD 4ed4eab98f759f3c84da9971ee69624709dd3e88; version check PASS 1.46.0; status worktree jak w E-108d.
- REPRODUCTION: git log --oneline -3, git status --short --branch, git rev-parse HEAD, npm run version check, grep THROTTLE_X4, z 2026-10-15.
- BEFORE: _active-evidence.md 133 linie, koniec E-107; worktree M 6 plus nowe 2, wrapper throttle w toku.
- AFTER: tylko docs/plans/_active-evidence.md plus ta sekcja; kod prod plus harnessy bez zmian tym dopiskiem.
- CHANGE: append-only, E-108, 3x VERIFIED zamrozone plus 1x HYPOTHESIS symptom plus 4x HYPOTHESIS przyczyny.
- TESTS: brak runtime w diagnozie-docs, validate i test quick nie uruchamiane, docs-only. D1-D5 czeka na runtime.
- DIFF: git diff -- docs/plans/_active-evidence.md.
- COMMIT: brak, zadanie mowi nie commituj, nie pushuj.
- VERIFIED: YES dla E-108b plus E-108c plus E-108d; NO dla E-108a plus E-108e plus E-108f plus E-108g plus E-108h.

## Decyzja haslo testowe dev (2026-10-15, BUILD MODE docs-only, zero kodu)

Scope: dopisane na koncu, historia E-001..E-015, E-005a, E-100..E-106, E-200..E-211, E-107, E-108 nietknieta. Nowe ID E-109, jedno, rozlaczne. Tylko ten plik. Nie dotyka .env ani DB ani harnessow. Bez commita, bez pusha.

## Ledger E-109

| ID    | Twierdzenie                                                                                                                                                                                                     | Dowod                                                                                                            | Status     |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------- |
| E-109 | Decyzja uzytkownika: haslo testowe anim123456 na czas dev/testow (wersja z 2026-10-15); zakres tylko lokalny .env + hash admina w lokalnej SQLite, NIGDY prod/commit; do potwierdzenia login-200 przez buildera | decyzja sesji 2026-10-15; brak zmiany .env/DB/harnessow tym dopiskiem; weryfikacja: login-200 runtime u buildera | HYPOTHESIS |

## Checkpoint E-109

- CLAIM: dopisek E-109 append-only, historia nietknieta, .env + DB + harnessy nietkniete tym dopiskiem.
- EVIDENCE: ta sekcja E-109; decyzja sesji 2026-10-15 (haslo testowe dev, zakres lokalny .env + SQLite, NIGDY prod/commit).
- REPRODUCTION: odczyt docs/plans/_active-evidence.md koniec; brak runtime w tym dopisku (docs-only).
- BEFORE: koniec E-108; .env + DB + harnessy bez zmian.
- AFTER: tylko docs/plans/_active-evidence.md + ta sekcja; .env + DB + harnessy bez zmian tym dopiskiem.
- CHANGE: append-only, E-109 1x HYPOTHESIS.
- TESTS: brak runtime w docs; potwierdzenie login-200 po stronie buildera (D5 z E-108).
- DIFF: git diff -- docs/plans/_active-evidence.md.
- COMMIT: brak, zadanie mowi nie commituj.
- VERIFIED: NO (czeka na login-200 u buildera).

## Start Fazy 2 (2026-10-15, BUILD MODE Faza 2, docs-only, zero kodu)

Scope: dopisane na koncu, historia E-001..E-015, E-005a, E-100..E-106, E-200..E-211, E-107, E-108, E-109 nietknieta. Nowe ID E-110, rozlaczne. Tylko ten plik docs. Nie dotyka kodu prod, harnessow, .env ani DB. Bez commita, bez pusha.

## Ledger E-110

| ID     | Twierdzenie                                                                                                           | Dowod                                                                                  | Status     |
| ------ | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------- |
| E-110a | Start Fazy 2: Batch GO, jeden PR laczacy A + dedup + E-half                                                           | decyzja sesji 2026-10-15; brak kodu tym dopiskiem                                      | HYPOTHESIS |
| E-110b | Zakres plikow: public/js/excelModal.js + public/js/excelChangeHandlers.js + testy (parity/bench/golden/openPerf)      | decyzja sesji; kod nietkniety tym dopiskiem                                            | HYPOTHESIS |
| E-110c | Zamrozone decyzje: edit-sync + race 800 + L0 sync; warianty B/D odrzucone                                             | decyzja sesji 2026-10-15; do weryfikacji diffem PR Fazy 2                              | HYPOTHESIS |
| E-110d | Metryki bramki PR: key-to-paint P95 down + zero longtask>50ms@50 + bench +15% pod throttle-x4 + Golden + Parity GREEN | bramka sesji 2026-10-15; do potwierdzenia artefaktami runtime (OUT *-throttle-x4.json) | HYPOTHESIS |
| E-110e | Wlasciciele plikow: builder = excelModal.js, general = excelChangeHandlers.js, explore = testy/harnessy               | podzial sesji 2026-10-15; bez zmian kodu tym dopiskiem                                 | HYPOTHESIS |

## Checkpoint E-110

- CLAIM: dopisek E-110 append-only, historia nietknieta, kod + harnessy + .env + DB nietkniete tym dopiskiem.
- EVIDENCE: ta sekcja E-110a..E-110e; decyzje + zakres + bramka + wlasciciele z zadania sesji 2026-10-15.
- REPRODUCTION: odczyt docs/plans/_active-evidence.md koniec (E-109); brak runtime w tym dopisku (docs-only).
- BEFORE: koniec E-109; kod + harnessy + .env + DB bez zmian.
- AFTER: tylko docs/plans/_active-evidence.md + ta sekcja; kod + harnessy + .env + DB bez zmian tym dopiskiem.
- CHANGE: append-only, E-110 5x HYPOTHESIS (start Batch GO + zakres + decyzje + bramka + wlasciciele).
- TESTS: brak runtime w docs; bramka czeka na PR Fazy 2 (key-paint P95, longtask, bench throttle-x4, Golden + Parity).
- DIFF: git diff -- docs/plans/_active-evidence.md.
- COMMIT: brak, zadanie mowi nie commituj.
- VERIFIED: NO (czeka na jeden PR A + dedup + E-half + artefakty bramki).

## CI FAIL E2E - spojnosc nazwy aplikacji (2026-10-15, BUILD MODE diagnoza CI, docs-only, zero kodu)

Scope: dopisane na koncu, historia E-001..E-015, E-005a, E-100..E-106, E-200..E-211, E-107, E-108, E-109, E-110 nietknieta. Nowe ID E-111, rozlaczne. Tylko ten plik docs. Nie dotyka kodu prod, harnessow, .env ani DB. Bez commita, bez pusha.

## Ledger E-111

| ID     | Twierdzenie                                                                                                                                  | Dowod                                                                                                                      | Status     |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------- |
| E-111a | Symptom: CI FAIL E2E-spojnosc nazwy aplikacji na commicie e66f7af; bilans 1 FAIL / 13 PASS / 2 skipped; job FAIL po 2m                       | zgloszenie sesji 2026-10-15 (commit e66f7af); brak logu CI w repo w tym dopisku; do weryfikacji zakladka Checks i log joba | HYPOTHESIS |
| E-111b | Zamrozone: 13 jobow zielonych, w tym Test / Typecheck / Lint / Load / Smoke / Axe / Migrate                                                  | zgloszenie sesji 2026-10-15; brak artefaktu logu w tym dopisku; do potwierdzenia lista jobow z runa e66f7af                | HYPOTHESIS |
| E-111c | Hipoteza H-flaky: FAIL jednorazowy albo timeout albo runner, do weryfikacji re-run joba bez zmian kodu                                       | brak re-runa w sesji docs-only; krok P2 planu                                                                              | HYPOTHESIS |
| E-111d | Hipoteza H-mismatch: rozjazd nazwy aplikacji (APP_NAME vs title vs cache-bust vs docs), FAIL deterministyczny, do weryfikacji logiem asercji | brak logu asercji w sesji; krok P1 planu                                                                                   | HYPOTHESIS |
| E-111e | Hipoteza H-infra: srodowisko CI (artefakt albo cache albo serwis), do weryfikacji logiem setup plus re-run na czysto                         | brak logu setup w sesji; krok P1-P2 planu                                                                                  | HYPOTHESIS |
| E-111f | Plan: P1 repro lokalne, P2 logi, P3 fix albo retest; bez zmiany statusu E-111a..E-111e bez dowodu                                            | decyzja sesji 2026-10-15; brak runtime w tym dopisku (docs-only)                                                           | HYPOTHESIS |

## Plan P1-P3 (kolejnosc, read-first, zero kodu tym dopiskiem)

1. P1 repro lokalne: wyciagnac nazwe kroku plus asercje z workflow E2E, odpalic ten sam test lokalnie na HEAD e66f7af, zapisac PASS albo FAIL plus komunikat asercji.
2. P2 logi: pobrac log joba FAIL (2m) plus liste 13 PASS i 2 skipped z runa e66f7af; rozstrzygnac H-flaky (zielony re-run) vs H-mismatch (ta sama asercja lokalnie) vs H-infra (blad setup albo runner).
3. P3 fix albo retest: przy H-mismatch minimalny fix nazwy plus version:check plus validate; przy H-flaky albo H-infra sam re-run; dopisac wynik jako E-111g (VERIFIED albo REJECTED per hipoteza).
   Bez P1-P3 brak zmiany statusu E-111a..E-111e z HYPOTHESIS na VERIFIED albo REJECTED.

## Checkpoint E-111

- CLAIM: dopisek E-111 append-only, historia nietknieta, kod plus harnessy plus .env plus DB nietkniete tym dopiskiem.
- EVIDENCE: ta sekcja E-111a..E-111f; commit e66f7af plus bilans 1/13/2 plus job 2m ze zgloszenia sesji 2026-10-15 (bez logu CI w repo).
- REPRODUCTION: odczyt docs/plans/_active-evidence.md koniec (E-110, 228 linii); brak runtime w tym dopisku (docs-only).
- BEFORE: koniec E-110; kod plus harnessy plus .env plus DB bez zmian.
- AFTER: tylko docs/plans/_active-evidence.md plus ta sekcja; kod plus harnessy plus .env plus DB bez zmian tym dopiskiem.
- CHANGE: append-only, E-111 6x HYPOTHESIS (symptom plus zamrozone plus 3 hipotezy plus plan).
- TESTS: brak runtime w docs; P1-P3 czeka (repro lokalne, logi, fix albo retest plus E-111g).
- DIFF: git diff -- docs/plans/_active-evidence.md.
- COMMIT: brak, zadanie mowi nie commituj.
- VERIFIED: NO (czeka na log joba FAIL plus re-run plus E-111g).

## E-111g FIX VERIFIED (2026-10-15, BUILD MODE)

| ID     | Twierdzenie                                                                                                                                                      | Dowod                                                                                           | Status   |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------- |
| E-111g | Root cause: harness fallback anim123456 odrzucany przez guard leaked-secret (auth.ts:366-374); CI job e2e-appname bez TEST_ADMIN_PASSWORD = deterministyczny 401 | repro lokalne: FATAL Login failed 401 bez env; PASS T1-T6 z TEST_ADMIN_PASSWORD=test-admin-pass | VERIFIED |
| E-111h | Fix: TEST_ADMIN_PASSWORD + DEFAULT_ADMIN_PASSWORD = test-admin-pass w jobie e2e-appname (wzorzec z 3 innych jobow CI)                                            | .github/workflows/ci.yml e2e-appname env; brak zwiazku z e66f7af (diff 0 w powierzchni checka)  | VERIFIED |

## Start mikro-PR Batch GO (2026-10-15, BUILD MODE docs-only, zero kodu)

Scope: dopisane na koncu, historia E-001..E-015, E-005a, E-100..E-106, E-200..E-211, E-107, E-108, E-109, E-110, E-111, E-111g..E-111h nietknieta. Nowe ID E-112, rozlaczne. Tylko ten plik docs. Nie dotyka kodu prod, harnessow, .env ani DB. Bez commita, bez pusha.

## Ledger E-112

| ID     | Twierdzenie                                                                               | Dowod                                                                                        | Status     |
| ------ | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------- |
| E-112a | (1) same-tab guard excelTabs.js:45 - wyjscie przy tym samym tabie, zero przeladowania     | decyzja sesji 2026-10-15; kod nietkniety tym dopiskiem; do weryfikacji diffem mikro-PR       | HYPOTHESIS |
| E-112b | (2) select early-return wariant bezpieczny excelModal.js:706 - skip DOM, keep schedule    | decyzja sesji 2026-10-15; wariant ryzykowny (drop schedule) odrzucony; do weryfikacji diffem | HYPOTHESIS |
| E-112c | (3) autofit-cache excelTableRenderer.js:491 - cache szerokosci, uniewaznienie przy danych | decyzja sesji 2026-10-15; kod nietkniety; do weryfikacji diffem + bench                      | HYPOTHESIS |
| E-112d | recalc-skip ODROCZONY - poza zakresem mikro-PR, czeka na wynik cache                      | decyzja sesji 2026-10-15; brak kodu tym dopiskiem                                            | HYPOTHESIS |
| E-112e | C-lite ODLOZONE - poza zakresem mikro-PR                                                  | decyzja sesji 2026-10-15; brak kodu tym dopiskiem                                            | HYPOTHESIS |
| E-112f | gate mikro-PR: parity GREEN + golden GREEN + unit PASS + re-run S2+S3                     | bramka sesji 2026-10-15; do potwierdzenia artefaktami runtime po PR                          | HYPOTHESIS |
| E-112g | BLOCKi reviewera jako checklista: I-001 + I-002 + I-007 + XSS + undo                      | lista ponizej; kazdy BLOCK = STOP bez merge                                                  | HYPOTHESIS |

## Gate mikro-PR (kolejnosc, po kodzie PR)

1. unit PASS (szybkie, bez serwera).
2. parity GREEN: npm run test:parity (scenariusz OFF vs ON, SSoT wells+undo).
3. golden GREEN: node tests/playwright/excelDomGolden.cjs (bez --update; update tylko za autoryzacja nowego stanu).
4. re-run S2+S3 (scenariusze select + autofit z planu PR) - potwierdzenie braku regresji sciezek z E-112a..E-112c.
   Bez 1-4 brak GO na merge mikro-PR.

## BLOCKi reviewera - checklista STOP bez merge

- [ ] I-001 ownership: guard nie rozszerza odczytu ani zapisu, fail-closed 403 przy watpliwosci.
- [ ] I-002 zakres: zmiana tylko 3 punkty (excelTabs.js:45, excelModal.js:706, excelTableRenderer.js:491), zero dotyku schema/migracji/auth.
- [ ] I-007 rozliczenia: cache/guard nie zmienia cen ani sum, parity kwot bez roznic.
- [ ] XSS: kazda interpolacja do innerHTML przez escapeHtml, atrybuty przez escapeHtmlAttr, brak nowych inline handlerow.
- [ ] undo: kazda sciezka edycji odwracalna, SSoT wells+undo zielony w parity.

## Checkpoint E-112

- CLAIM: dopisek E-112 append-only, historia nietknieta, kod + harnessy + .env + DB nietkniete tym dopiskiem.
- EVIDENCE: ta sekcja E-112a..E-112g; decyzje + zakres 3 punktow + gate + BLOCKi z zadania sesji 2026-10-15.
- REPRODUCTION: odczyt docs/plans/_active-evidence.md koniec (E-111h, 270 linii); brak runtime w tym dopisku (docs-only).
- BEFORE: koniec E-111h; kod + harnessy + .env + DB bez zmian.
- AFTER: tylko docs/plans/_active-evidence.md + ta sekcja; kod + harnessy + .env + DB bez zmian tym dopiskiem.
- CHANGE: append-only, E-112 7x HYPOTHESIS (3x zakres + 2x odroczone + gate + BLOCKi).
- TESTS: brak runtime w docs; gate czeka na PR (unit + parity + golden + re-run S2+S3).
- DIFF: git diff -- docs/plans/_active-evidence.md.
- COMMIT: brak, zadanie mowi nie commituj.
- VERIFIED: NO (czeka na mikro-PR + artefakty gate + odhaczenie BLOCKow).

## Finalizacja mikro-PR switch-select-autofit (2026-10-15, BUILD MODE, BEZ PUSH)

Scope: dopisane na koncu, historia E-001..E-015, E-005a, E-100..E-106, E-200..E-211, E-107..E-112, E-111g..E-111h nietknieta. Nowe ID E-113, rozlaczne.

## Ledger E-113

| ID     | Twierdzenie                                                                                                                                                                                                                                    | Dowod                                                                                                                                                                                             | Status   |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| E-113a | Zakres finalny: same-tab guard (excelTabs.js) + autofit-cache + invalidator w solver/paste; BEZ select early-return; BEZ recalc-skip                                                                                                           | diff: excelTabs.js (+3), excelTableRenderer.js (+28/-0 cache+klucz), excelAutoSelect.js (+2 invalidator x2), excelCopyPaste.js (+1 invalidator); excelModal.js nietkniety (early-return WYCOFANY) | VERIFIED |
| E-113b | Root-cause parity-FAIL: hash obejmowal transient __availCache (1 well, 116KB); fix strip kluczy `__*` w 5 miejscach hash w excelVirtualParity.cjs (test-only, prod nietkniety)                                                                 | diff tests/playwright/excelVirtualParity.cjs (5x replacer `__`); bisekcja mylaca - winny cache, nie guard; quiescence-eksperyment wycofany                                                        | VERIFIED |
| E-113c | Bramki: unit 43/43 (debounce/rzednaParity/transitionJoints/solverInvariants/mlGate), parity 31/31 x2, throttle-golden PASS, golden base odswiezony (--update po dryfie UI od 30.09, 9 linii SHA), bench-1000 ON openMs=1504/editMs=1211 zdrowe | artefakty: bench-excel-virtual-1000.json (nowy), golden-excel-dom-1200.json (base-update); validate EXIT w checkpoincie                                                                           | VERIFIED |
| E-113d | Histogram: real max=3 - N=2000 laboratoryjne (hang-2000-harness artefakt poza commitem, nie mergowany)                                                                                                                                         | docs/plans/hang-2000-harness-A-B.json untracked, poza zakresem add; excelHang2000.cjs untracked, poza commitem                                                                                    | VERIFIED |
| E-113e | Artefakt FAIL-runa parity-excel-virtual-600.json usuniety (untracked, nie z baseline); throttle-x4 tracked+modified pomiarem - zostawiony, nie commitowany                                                                                     | git ls-files pusty przed usunieciem; git status po: brak w worktree; throttle-x4 poza lista add                                                                                                   | VERIFIED |

## Checkpoint E-113

- CLAIM: mikro-PR finalny (E-113a..E-113e), brak select early-return, brak recalc-skip, brak debug-dumpow, brak .env/data w zmianach.
- EVIDENCE: diff 4 plikow prod + harness test-only; bench + golden artefakty; ta sekcja E-113.
- REPRODUCTION: git status --short + git ls-files (2026-10-15, przed commitem).
- BEFORE: 8 modified + 4 untracked (w tym artefakt FAIL-runa).
- AFTER: commit fix(studnie) zakresem: 4 prod + parity-harness + _active-evidence.md + golden + bench; throttle-x4 + hang-artefakty poza commitem.
- CHANGE: append-only, E-113 5x VERIFIED.
- TESTS: validate EXIT ponizej; flaky pricelistChunk-B2 tylko przy izolowanym PASS.
- DIFF: git status --short + diff --stat w raporcie.
- COMMIT: node scripts/commit.mjs (ponizej), BEZ push.
- VERIFIED: YES (po zielonym validate) / NO - patrz SHA lub STOP w raporcie.

## Start Batch 1 jako 3 osobne PR-y (2026-10-15, BUILD MODE docs-only, zero kodu)

Scope: dopisane na koncu, historia E-001..E-015, E-005a, E-100..E-106, E-200..E-211, E-107..E-113, E-111g..E-111h nietknieta. Nowe ID E-114, rozlaczne. Tylko ten plik docs. Nie dotyka kodu prod, harnessow, .env ani DB. Bez commita, bez pusha.

## Ledger E-114

| ID     | Twierdzenie                                                                                                              | Dowod                                                           | Status     |
| ------ | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- | ---------- |
| E-114a | PR 1a excel-gates CI: bramki excel (parity/golden/bench) jako gate CI, bez zmian prod                                    | decyzja sesji 2026-10-15; kod nietkniety tym dopiskiem          | HYPOTHESIS |
| E-114b | PR 1b XSS errorTitle: fix errorTitle przez escapeHtml/escapeHtmlAttr, bez nowych inline handlerow                        | decyzja sesji 2026-10-15; kod nietkniety; do weryfikacji diffem | HYPOTHESIS |
| E-114c | PR 1c logger catch: puste catch zamiana na logger (warn/debug), zero silent fail                                         | decyzja sesji 2026-10-15; kod nietkniety; do weryfikacji diffem | HYPOTHESIS |
| E-114d | Wlasciciele plikow: builder = .github/workflows/ci.yml (1a), general = excelTableBody + test (1b), explore = logger (1c) | podzial sesji 2026-10-15; bez zmian kodu tym dopiskiem          | HYPOTHESIS |
| E-114e | Kolejnosc: 3 osobne PR-y (1a, 1b, 1c), kazdy z wlasna bramka ponizej; brak laczenia w jeden PR                           | decyzja sesji 2026-10-15; merge kazdego tylko po swojej bramce  | HYPOTHESIS |

## Bramki per PR (po kodzie PR, przed merge)

- PR 1a (builder, ci.yml): version:check PASS + validate PASS + CI GREEN (w tym e2e-appname z TEST_ADMIN_PASSWORD, brak regresji E-111g/h).
- PR 1b (general, excelTableBody + test): lint:frontend PASS + unit PASS + escapeHtml/escapeHtmlAttr audyt (innerHTML + atrybuty) + parity GREEN + golden GREEN (bez --update).
- PR 1c (explore, logger): lint PASS + test:quick PASS + grep pustych catch zero + brak sekretow w logach (bez wyciekow .env/JWT/hasel).
  Bez bramki danego PR brak merge tego PR; PR-y niezalezne (FAIL jednego nie blokuje review pozostalych).

## Checkpoint E-114

- CLAIM: dopisek E-114 append-only, historia nietknieta, kod + harnessy + .env + DB nietkniete tym dopiskiem.
- EVIDENCE: ta sekcja E-114a..E-114e; start Batch 1 jako 3 PR-y + wlasciciele + bramki per PR z zadania sesji 2026-10-15.
- REPRODUCTION: odczyt docs/plans/_active-evidence.md koniec (E-113, 342 linie); brak runtime w tym dopisku (docs-only).
- BEFORE: koniec E-113; kod + harnessy + .env + DB bez zmian.
- AFTER: tylko docs/plans/_active-evidence.md + ta sekcja; kod + harnessy + .env + DB bez zmian tym dopiskiem.
- CHANGE: append-only, E-114 5x HYPOTHESIS (3x PR + wlasciciele + kolejnosc).
- TESTS: brak runtime w docs; bramki czekaja (1a CI, 1b XSS+parity+golden, 1c logger+quick).
- DIFF: git diff -- docs/plans/_active-evidence.md.
- COMMIT: brak, zadanie mowi nie commituj.
- VERIFIED: NO (czeka na 3 PR-y + artefakty bramek).

## E-114f statusy batch 1 (2026-10-15, BUILD MODE, BEZ PUSH)

| ID        | Twierdzenie                                     | Dowod                                                                                                                                                                          | Status   |
| --------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| E-114f-1a | PR 1a excel-gates CI zmergowany jako commit     | 7759c56b93b4bb8441c24501ceac4bfdb025baad chore(ci): job excel-gates parity golden align                                                                                        | VERIFIED |
| E-114f-1b | PR 1b XSS errorTitle fix zmergowany jako commit | c49c6fa20c8305570c79c536069d502800d47b82 fix(studnie): escapehtmlattr w tytule bledu excel; jest excelErrorTitleXss + excelBulkProgressXss GREEN + eslint excelTableBody GREEN | VERIFIED |
| E-114f-1c | PR 1c logger catch zmergowany jako commit       | 9b7ef227f3d2b72e2e4ad954432b0155d4038496 chore(studnie): logger warn w pustych catch excel; node --check x3 + eslint x3 GREEN + jest excelUndoLifecycle 7/7 GREEN              | VERIFIED |

## Checkpoint E-114f

- CLAIM: batch 1 (1a+1b+1c) skommitowany jako 3 osobne SHA, ledger dopisany append-only.
- EVIDENCE: ta sekcja E-114f; git log --oneline -4 (9b7ef22/c49c6fa/7759c56/46285d0).
- REPRODUCTION: git rev-parse HEAD x3 + jest + eslint + node --check (2026-10-15, EXIT 0).
- BEFORE: koniec E-114; 3 commity batch 1 w HEAD, ledger bez E-114f.
- AFTER: tylko docs/plans/_active-evidence.md + ta sekcja; kod batch 1 juz w HEAD.
- CHANGE: append-only, E-114f 3x VERIFIED.
- TESTS: bramek per PR jak w dowodach E-114f-1a..1c.
- DIFF: git diff -- docs/plans/_active-evidence.md.
- COMMIT: node scripts/commit.mjs docs(studnie) (ponizej), BEZ push.
- VERIFIED: YES.

## Start Batch 2 (paste-6->1 + DupColors-inc + updateSummary-cache) (2026-10-15, BUILD MODE docs-only, zero kodu)

Scope: dopisane na koncu, historia E-001..E-015, E-005a, E-100..E-106, E-200..E-211, E-107..E-114, E-111g..E-111h, E-114f nietknieta. Nowe ID E-115, rozlaczne. Tylko ten plik docs. Nie dotyka kodu prod, harnessow, .env ani DB. Bez commita, bez pusha.

## Ledger E-115

| ID     | Twierdzenie                                                                                                                                                                                                                                                                          | Dowod                                                                                                                                                                             | Status     |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| E-115a | PR 2a paste-6->1: konsolidacja 6 sciezek paste w 1 (excelCopyPaste), wlasciciel builder                                                                                                                                                                                              | decyzja sesji 2026-10-15; kod nietkniety tym dopiskiem                                                                                                                            | HYPOTHESIS |
| E-115b | PR 2b DupColors-inc: inkrementalne kolory duplikatow zamiast full rescan (excelTableBody), wlasciciel general                                                                                                                                                                        | decyzja sesji 2026-10-15; kod nietkniety; do weryfikacji diffem                                                                                                                   | HYPOTHESIS |
| E-115c | PR 2c updateSummary-cache: cache podsumowania, uniewaznienie przy danych (wellUI), wlasciciel explore                                                                                                                                                                                | decyzja sesji 2026-10-15; kod nietkniety; do weryfikacji diffem                                                                                                                   | HYPOTHESIS |
| E-115d | Wlasciciele: builder = excelCopyPaste (2a), general = excelTableBody (2b), explore = wellUI (2c)                                                                                                                                                                                     | podzial sesji 2026-10-15; bez zmian kodu tym dopiskiem                                                                                                                            | HYPOTHESIS |
| E-115e | Kolejnosc: 3 osobne PR-y (2a, 2b, 2c), kazdy z wlasna bramka ponizej; brak laczenia w jeden PR                                                                                                                                                                                       | decyzja sesji 2026-10-15; merge kazdego tylko po swojej bramce                                                                                                                    | HYPOTHESIS |
| E-115f | Dead fast-path DupColors usuniety (window._pasteCtx nigdy nie istnial) - zawsze full-pass; harness excelHang2000.cjs env-only fail-fast; fingerprint parity AKCEPT z dlugiem lzejszej sygnatury; odchylenie od E-115e: 1 commit zamiast 3 (niezalezny review 6 agentow zamiast tego) | diff public/js/studnie/excelTableBody.js + tests/playwright/excelHang2000.cjs; unit excelRefreshContract+excelErrorRefresh+excelEditGuards 22/22; parity plain 31/31; ten dopisek | VERIFIED   |

## Bramki Batch 2 (po kodzie PR, przed merge)

- parity GREEN: npm run test:parity (OFF vs ON, SSoT wells+undo, w tym sciezki paste z 2a).
- golden GREEN: node tests/playwright/excelDomGolden.cjs (bez --update; update tylko za autoryzacja nowego stanu).
- bench: brak regresji vs baseline (OUT *-throttle-x4.json, open/modal/DOM/scroll/edit; 2b + 2c maja nie pogarszac).
- kwoty: parity kwot bez roznic (I-007; cache 2b/2c nie zmienia cen ani sum).
- longtask: zero longtask>50ms (2c celuje w drop; 2a/2b bez nowych).
  Bez 5/5 brak merge danego PR; PR-y niezalezne (FAIL jednego nie blokuje review pozostalych).

## BLOCKi reviewera - checklista STOP bez merge

- [ ] I-001 ownership: zmiana nie rozszerza odczytu ani zapisu, fail-closed 403 przy watpliwosci.
- [ ] I-002 zakres: kazdy PR tylko swoj plik (2a excelCopyPaste, 2b excelTableBody, 2c wellUI), zero dotyku schema/migracji/auth.
- [ ] I-007 rozliczenia: cache/konsolidacja nie zmienia cen ani sum, parity kwot bez roznic.
- [ ] XSS: kazda interpolacja do innerHTML przez escapeHtml, atrybuty przez escapeHtmlAttr, brak nowych inline handlerow.
- [ ] undo: kazda sciezka edycji/paste odwracalna, SSoT wells+undo zielony w parity.

## Checkpoint E-115

- CLAIM: dopisek E-115 append-only, historia nietknieta, kod + harnessy + .env + DB nietkniete tym dopiskiem.
- EVIDENCE: ta sekcja E-115a..E-115e; start Batch 2 (paste-6->1 + DupColors-inc + updateSummary-cache) + wlasciciele + bramki + BLOCKi z zadania sesji 2026-10-15.
- REPRODUCTION: odczyt docs/plans/_active-evidence.md koniec (E-114f, 397 linii); brak runtime w tym dopisku (docs-only).
- BEFORE: koniec E-114f; kod + harnessy + .env + DB bez zmian.
- AFTER: tylko docs/plans/_active-evidence.md + ta sekcja; kod + harnessy + .env + DB bez zmian tym dopiskiem.
- CHANGE: append-only, E-115 5x HYPOTHESIS (3x PR + wlasciciele + kolejnosc).
- TESTS: brak runtime w docs; bramki czekaja (parity + golden + bench + kwoty + longtask).
- DIFF: git diff -- docs/plans/_active-evidence.md.
- COMMIT: brak, zadanie mowi nie commituj.
- VERIFIED: NO (czeka na 3 PR-y + artefakty bramek + odhaczenie BLOCKow).

## Checkpoint E-115f

- CLAIM: E-115f append-only; (a) martwy fast-path DupColors usuniety - window._pasteCtx nigdy nie istnial, _excelRefreshDupColors zawsze full-pass; (b) harness excelHang2000.cjs env-only fail-fast (brak TEST_ADMIN_PASSWORD = throw, zero fallbacku); (c) fingerprint parity AKCEPT, dlug: lzejsza sygnatura pozniej; (d) odchylenie od E-115e: 1 commit zamiast 3 - niezalezny review 6 agentow zamiast tego.
- EVIDENCE: git diff -- public/js/studnie/excelTableBody.js (fast-path -109/+~10, tylko full-pass); tests/playwright/excelHang2000.cjs:114-117 env-only throw; parity plain 31/31 EXIT 0; unit 22/22 (contract+error+guards).
- REPRODUCTION: node --check obu plikow; npx eslint public/js/studnie/excelTableBody.js; npx jest tests/studnie/excelRefreshContract.test.ts tests/studnie/excelErrorRefresh.test.ts tests/studnie/excelEditGuards.test.ts; node tests/playwright/excelVirtualParity.cjs (plain, bez THROTTLE_X4).
- BEFORE: worktree z martwym fast-path w poprzednich commitach; E-115e wymagal 3 osobnych PR-ow.
- AFTER: fast-path usuniety, full-pass zawsze; E-115f dopisany append-only; historia E-001..E-115e nietknieta.
- CHANGE: append-only E-115f (1 wiersz ledger + ten checkpoint); kod: excelTableBody.js full-pass; harness: env-only login.
- TESTS: node --check 2/2 GREEN; eslint excelTableBody GREEN (harness .cjs poza zakresem lint/lint:frontend - brak regul tests/**/*.cjs, pre-existing); unit 22/22 GREEN; parity plain 31/31 GREEN.
- DIFF: git diff -- public/js/studnie/excelTableBody.js tests/playwright/excelHang2000.cjs docs/plans/_active-evidence.md (artefakty parity/hang poza commitem).
- COMMIT: node scripts/commit.mjs fix(studnie) (ponizej), BEZ push.
- VERIFIED: YES.

## Start Batch 3 test-only (Tab-focus testy + throttle-nightly + aliasy golden/openPerf) (2026-10-15, BUILD MODE docs-only, zero prod)

Scope: dopisane na koncu, historia E-001..E-015, E-005a, E-100..E-106, E-200..E-211, E-107..E-115, E-111g..E-111h, E-114f, E-115f nietknieta. Nowe ID E-116, rozlaczne. Tylko ten plik docs. Nie dotyka kodu prod, .env ani DB. Bez commita, bez pusha.

## Ledger E-116

| ID     | Twierdzenie                                                                                                                                                               | Dowod                                                                    | Status     |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------- |
| E-116a | PR 3a Tab-focus testy: nowy test test-only (focus/zakladki excel), bez zmian prod                                                                                         | decyzja sesji 2026-10-15; kod nietkniety tym dopiskiem                   | HYPOTHESIS |
| E-116b | PR 3b throttle-nightly: nocny job CI z THROTTLE_X4=1 (parity/bench/golden/openPerf pod throttle-x4), OUT *-throttle-x4.json bez nadpisywania F1                           | decyzja sesji 2026-10-15; kod nietkniety; do weryfikacji diffem          | HYPOTHESIS |
| E-116c | PR 3c aliasy golden/openPerf: npm aliasy test:golden + test:openperf (dotad tylko direct node), bez zmian prod                                                            | decyzja sesji 2026-10-15; E-210 brak aliasu; do weryfikacji package.json | HYPOTHESIS |
| E-116d | Zakres test-only, zero prod: tylko tests/playwright + tests/studnie + package.json (aliasy) + .github/workflows/ci.yml (nightly); brak src/public/js/schema/migracji/auth | decyzja sesji 2026-10-15; bez zmian kodu tym dopiskiem                   | HYPOTHESIS |
| E-116e | Kolejnosc: 3a + 3b + 3c jako Batch 3 (osobne PR-y albo 1 commit test-only), merge kazdego tylko po swojej bramce ponizej                                                  | decyzja sesji 2026-10-15; merge tylko po bramce                          | HYPOTHESIS |

## Bramki Batch 3 (po kodzie, przed merge)

- jest GREEN: Tab-focus (3a) + throttle-nightly sciezka (3b) + golden/openPerf via aliasy (3c) - npx jest sciezki batch 3.
- CI YAML parse: .github/workflows/ci.yml parsuje sie (yaml.safe_load / npx --check workflow), zero bledow skladni po dopisaniu throttle-nightly.
- cron skladnia: schedule throttle-nightly to poprawny cron (5-polowy, nocne okno), bez kolizji z istniejacymi jobami.
  Bez 3/3 brak merge danego PR; PR-y niezalezne (FAIL jednego nie blokuje review pozostalych).

## Checkpoint E-116

- CLAIM: dopisek E-116 append-only, historia nietknieta, kod prod + .env + DB nietkniete tym dopiskiem.
- EVIDENCE: ta sekcja E-116a..E-116e; start Batch 3 test-only (Tab-focus + throttle-nightly + aliasy golden/openPerf) + bramki z zadania sesji 2026-10-15.
- REPRODUCTION: odczyt docs/plans/_active-evidence.md koniec (E-115f, 455 linii); brak runtime w tym dopisku (docs-only).
- BEFORE: koniec E-115f; kod prod + .env + DB bez zmian.
- AFTER: tylko docs/plans/_active-evidence.md + ta sekcja; kod prod + .env + DB bez zmian tym dopiskiem.
- CHANGE: append-only, E-116 5x HYPOTHESIS (Tab-focus + throttle-nightly + aliasy + zakres test-only + kolejnosc).
- TESTS: brak runtime w docs; bramki czekaja (jest GREEN + CI YAML parse + cron skladnia).
- DIFF: git diff -- docs/plans/_active-evidence.md.
- COMMIT: brak, zadanie mowi nie commituj.
- VERIFIED: NO (czeka na PR-y Batch 3 + artefakty bramek).

## Ledger E-116f - statusy Batch 3 (releaser, BEZ push)

Scope: dopisane na koncu, historia E-001..E-116e nietknieta. Tylko ten plik docs w tym dopisku.

| ID     | Twierdzenie                                                                                                                                                            | Dowod                                                                                                                                                                     | Status   |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| E-116f | Batch 3 releaser: Commit A test Tab-focus + Commit B throttle-nightly/aliasy + ten ledger docs; test 6/6 GREEN, YAML-parse OK, prettier fix, version:check 0, BEZ push | Commit A 4910fb9b067c5e625ccd9119c336ed98f9bf7089; Commit B 9fd3afbe7945850cc788c6ce37181a9631febd22; jest tests/frontend/excelTabFocus.test.ts 6/6; version:check EXIT 0 | VERIFIED |

## Checkpoint E-116f

- CLAIM: Batch 3 dowieziony w 3 commitach (test + ci + docs), zero prod, BEZ push.
- EVIDENCE: Commit A 4910fb9b067c5e625ccd9119c336ed98f9bf7089 (test); Commit B 9fd3afbe7945850cc788c6ce37181a9631febd22 (workflow + package.json); ten dopisek ledger.
- REPRODUCTION: npx jest tests/frontend/excelTabFocus.test.ts --no-coverage (6/6); npm run version:check (EXIT 0).
- BEFORE: prettier FAIL na tests/frontend/excelTabFocus.test.ts + docs/plans/_active-evidence.md; test 6/6 GREEN; YAML-parse OK.
- AFTER: prettier --write na 2 sciezkach; 3 commity test/ci/docs; worktree: parity/hang JSON poza commitem; push nie wykonany.
- CHANGE: append-only E-116f (1 wiersz ledger + ten checkpoint).
- TESTS: jest 6/6 GREEN; version:check EXIT 0; prettier write GREEN.
- DIFF: git diff -- docs/plans/_active-evidence.md.
- COMMIT: 3x node scripts/commit.mjs (test, chore, docs), BEZ push.
- VERIFIED: YES.

## Start Batch 4 P2 jako 3 osobne PR-y (2026-10-16, BUILD MODE docs-only, zero kodu)

Scope: dopisane na koncu, historia E-001..E-015, E-005a, E-100..E-106, E-200..E-211, E-107..E-116, E-111g..E-111h, E-114f, E-115f, E-116f nietknieta. Nowe ID E-117, rozlaczne. Tylko ten plik docs. Nie dotyka kodu prod, harnessow, .env ani DB. Bez commita, bez pusha.

## Ledger E-117

| ID     | Twierdzenie                                                                                                                                                                  | Dowod                                                           | Status     |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ---------- |
| E-117a | PR 4a undo-paste: odwracalnosc paste (kazda sciezka paste odwracalna, SSoT wells+undo), bez zmian cen/sum                                                                    | decyzja sesji 2026-10-16; kod nietkniety tym dopiskiem          | HYPOTHESIS |
| E-117b | PR 4b full-clone-open: pelny clone sciezki open (bez skrotow omijajacych init/ETag/SLA), bez regresji open/modal                                                             | decyzja sesji 2026-10-16; kod nietkniety; do weryfikacji diffem | HYPOTHESIS |
| E-117c | PR 4c god-split: podzial god-file na mniejsze moduly bez zmiany logiki (czysty split, zero zmian zachowania), NEW globals/inline = 0                                         | decyzja sesji 2026-10-16; kod nietkniety; do weryfikacji diffem | HYPOTHESIS |
| E-117d | Wlasciciele plikow: builder = 4a (public/js/studnie/excelCopyPaste.js + test undo), general = 4b (public/js/studnie/excelModal.js open/clone), explore = 4c (god-split plik) | podzial sesji 2026-10-16; bez zmian kodu tym dopiskiem          | HYPOTHESIS |
| E-117e | Kolejnosc: 3 osobne PR-y (4a, 4b, 4c), kazdy z wlasna bramka ponizej; brak laczenia w jeden PR; N=2000 ODROCZONE - real max=3 per E-113d (hang-2000 artefakt poza commitem)  | decyzja sesji 2026-10-16; merge kazdego tylko po swojej bramce  | HYPOTHESIS |

## Bramki per PR (po kodzie PR, przed merge)

- PR 4a (builder, undo-paste): unit PASS (undo lifecycle) + parity GREEN (paste/undo, SSoT wells+undo) + golden GREEN (bez --update) + kwoty bez roznic (I-007).
- PR 4b (general, full-clone-open): unit PASS + parity GREEN (sciezki open/clone) + bench brak regresji (open/modal vs baseline) + longtask zero >50ms.
- PR 4c (explore, god-split): lint PASS + typecheck PASS + unit PASS + parity GREEN + golden GREEN (bez --update) + zero nowych globali/inline + I-002 zakres (tylko split, zero zmian logiki).
  Bez bramki danego PR brak merge tego PR; PR-y niezalezne (FAIL jednego nie blokuje review pozostalych).

## Checkpoint E-117

- CLAIM: dopisek E-117 append-only, historia nietknieta, kod + harnessy + .env + DB nietkniete tym dopiskiem.
- EVIDENCE: ta sekcja E-117a..E-117e; start Batch 4 P2 jako 3 PR-y (4a undo-paste + 4b full-clone-open + 4c god-split, N=2000 odroczone real max=3) + wlasciciele + bramki per PR z zadania sesji 2026-10-16.
- REPRODUCTION: odczyt docs/plans/_active-evidence.md koniec (E-116f, 510 linii); brak runtime w tym dopisku (docs-only).
- BEFORE: koniec E-116f; kod + harnessy + .env + DB bez zmian.
- AFTER: tylko docs/plans/_active-evidence.md + ta sekcja; kod + harnessy + .env + DB bez zmian tym dopiskiem.
- CHANGE: append-only, E-117 5x HYPOTHESIS (3x PR + wlasciciele + kolejnosc z N=2000 odroczone).
- TESTS: brak runtime w docs; bramki czekaja (4a undo+parity+golden+kwoty, 4b parity+bench+longtask, 4c lint+typecheck+parity+golden).
- DIFF: git diff -- docs/plans/_active-evidence.md.
- COMMIT: brak, zadanie mowi nie commituj.
- VERIFIED: NO (czeka na 3 PR-y + artefakty bramek).

## Ledger E-117f - finalizacja Batch 4 (releaser, BEZ push)

Scope: dopisane na koncu, historia E-001..E-117e nietknieta. Kod 4a/4b z worktree (diff ponizej), 4c tylko design bez kodu (odroczony).

| ID            | Twierdzenie                                                                              | Dowod                                                                                                                                                                                                                                                                                                                   | Status   |
| ------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| E-117f-4a     | PR 4a excelUndo.js guardy snapshot undo w trakcie paste DONE                             | diff public/js/studnie/excelUndo.js (+8/-0: 2x early-return per-cell/batch + 1x guard snapshot z idxs w trakcie flagi _excelPasteInProgress); node --check 2/2 + eslint 2/2 GREEN; jest excelUndoLifecycle 7/7 + excelPatchUndo 2/2 + excelPasteBulk 6/6 = 15/15 GREEN                                                  | VERIFIED |
| E-117f-4b     | PR 4b excelModal.js open-gate N<=100 DONE                                                | diff public/js/studnie/excelModal.js (+13/-1: clone tylko N<=100, flaga _excelOpenSnapshotSkipped + reset, toast przy >100 w Zamknij-bez-zapisu); node --check + eslint GREEN; parity 31/31 (E-117f-parity)                                                                                                             | VERIFIED |
| E-117f-parity | Parity plain 31/31 GREEN - guardy 4a/4b nie zmieniaja hashy OFF=ON                       | node --dns-result-order=ipv4first tests/playwright/excelVirtualParity.cjs (flaga DNS tylko na IPv4-bind 0.0.0.0 z .env, bez zmian kodu/env/serwera); PARITY OK; OUT docs/plans/parity-excel-virtual-600.json (untracked, poza commitem); hashe OFF=ON: edit 1335549096, undo 2759913017, paste 628354446, 3b 2960316020 | VERIFIED |
| E-117f-4c     | PR 4c god-split ODRACZONY - tylko design, brak kodu                                      | decyzja sesji 2026-10-16; git diff dla plikow 4c pusty (prod diff to tylko excelUndo.js + excelModal.js)                                                                                                                                                                                                                | VERIFIED |
| E-117f-debt   | Punkty 1-2 reviewera jako dlug follow-up, nie blokuja 4a/4b (pre-existing, out-of-scope) | lista reviewera z sesji; poza zakresem diff 4a/4b; do osobnego follow-up                                                                                                                                                                                                                                                | VERIFIED |

## Checkpoint E-117f

- CLAIM: Batch 4 zamkniety w 3 commitach (4a kod + 4b kod + docs E-117f), 4c odroczony bez kodu, BEZ push.
- EVIDENCE: diff --stat 4a/4b (excelUndo.js +8, excelModal.js +13/-1); ta sekcja E-117f; SHA w raporcie releasera.
- REPRODUCTION: node --check x2 + npx eslint x2 + npx jest 3 sciezki (15/15) + parity plain (31/31, PARITY OK) + npm run version:check (EXIT 0), 2026-10-16.
- BEFORE: worktree M 4 (ledger E-117 + throttle-x4 pomiar pre-existing + excelModal + excelUndo) + ?? 2 (hang JSON + parity JSON artefakty).
- AFTER: 3 commity (fix 4a, fix 4b, docs ledger); poza commitem: parity-excel-virtual-600-throttle-x4.json (M pre-existing pomiarem) + hang/parity JSON (untracked artefakty); push nie wykonany.
- CHANGE: append-only E-117f (5 wierszy + checkpoint); kod: excelUndo.js +8/-0, excelModal.js +13/-1.
- TESTS: node --check 2/2 GREEN; eslint 2/2 GREEN; jest 15/15 GREEN (7+2+6); parity plain 31/31 GREEN; version:check EXIT 0.
- DIFF: git diff HEAD -- docs/plans/_active-evidence.md (ten dopisek) + git diff HEAD -- public/js/studnie/excelUndo.js public/js/studnie/excelModal.js (4a/4b).
- COMMIT: 3x node scripts/commit.mjs (fix, fix, docs), BEZ push.
- VERIFIED: YES.

## Zamkniecie sesji E-118 (2026-10-16, BUILD MODE, tylko ten plik, BEZ COMMIT/BEZ PUSH)

Scope: dopisane na koncu, historia E-001..E-117f nietknieta. Nowe ID E-118, rozlaczne. Tylko ten plik. Nie dotyka kodu prod, harnessow, .env ani DB.

## Ledger E-118

| ID     | Twierdzenie                                                              | Dowod                                                                                                                      | Status   |
| ------ | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | -------- |
| E-118a | Sesja = 20 commitow od v1.46.0 (4ed4eab) do HEAD 4854099 (lista ponizej) | git log 4ed4eab..HEAD, 20 wierszy, 2026-10-16                                                                              | VERIFIED |
| E-118b | Push: HEAD == origin/main (4854099), tym dopiskiem BEZ commita/pusha     | rev-parse HEAD == rev-parse origin/main = 4854099711ee5675b0e35785178d7fb314ecc509; status main...origin/main in sync      | VERIFIED |
| E-118c | Worktree dirty: 1x M + 2x untracked (artefakty pomiarow, poza commitem)  | M parity-excel-virtual-600-throttle-x4.json (1064+/1030-); ?? hang-2000-harness-A-B.json; ?? parity-excel-virtual-600.json | VERIFIED |
| E-118d | Otwarte dlugi: 6 pozycji (lista ponizej), zaden nie blokuje zamkniecia   | E-113d + E-115f + E-117f-4c + E-117f-debt + E-117f-parity + E-118c                                                         | VERIFIED |

### Lista commitow sesji (git log 4ed4eab..HEAD, oldest-first)

- throttle/infra: 3956c09d37e98eab685ec1eb5d4d2245d0ef60d0 chore(deps): regeneracja third-party-notices
- throttle/infra: 1b12acb516791d51188ecc2639c32a601fc58b3a test(studnie): baseline throttle-x4 i wrapper pomiarowy
- throttle/infra: e66f7afc3fead055c7f29111a864800bce1b5047 fix(studnie): debounce preview i solvera w excel
- CI fix (E-111g/h): 3826ed09ea36d482dc9f40fe2cb03cfef4d5d203 fix(ci): haslo testowe w jobie e2e-appname
- mikro-PR (E-113): 1d1dc3e01a90057446aa7d65dec1810858460590 fix(studnie): mikro-opt switch-select-autofit
- mikro-PR docs: 46285d0d4b0dd6628797388171ef3077ad656dec docs(studnie): plan napraw priorytetowych z uwagami recenzji
- Batch 1 (E-114f): 7759c56b93b4bb8441c24501ceac4bfdb025baad chore(ci): job excel-gates parity golden align
- Batch 1 (E-114f): c49c6fa20c8305570c79c536069d502800d47b82 fix(studnie): escapehtmlattr w tytule bledu excel
- Batch 1 (E-114f): 9b7ef227f3d2b72e2e4ad954432b0155d4038496 chore(studnie): logger warn w pustych catch excel
- Batch 1 ledger: 959e02e62cbbdda5606b81b195286f60cca9306b docs(studnie): ledger e-114 statusy batch 1
- Batch 1 follow-up CI: a929531d4cdf1a0560831e47a70b802ec10ced1e fix(ci): guard chrome path i excel-gates w deploy needs
- Batch 1 follow-up XSS: 854dc3e852a64dc4afdc6a137b3eed76eaba3fc6 fix(studnie): lokalny escaper atrybutu w tytule bledu
- Batch 2 (E-115): 20bfc26591d4270767d246574b8a907b41292690 fix(studnie): paste jeden tick i cache podsumowania
- Batch 2 (E-115f): aced0a00f174f9ffb52d1e92ccbd7f4f77862121 fix(studnie): usuniecie martwego fast-path duplikatow
- Batch 3 (E-116f-A): 4910fb9b067c5e625ccd9119c336ed98f9bf7089 test(studnie): testy fokusu tab w excelu
- Batch 3 (E-116f-B): 9fd3afbe7945850cc788c6ce37181a9631febd22 chore(ci): nocny throttle excel i aliasy golden
- Batch 3 ledger: 979880b1c099d43a315f844700e6810aca1c057e docs(studnie): ledger e-116 statusy batch 3
- Batch 4 4a (E-117f): 975e36ecd5ebcaa486b97f90abbb24646c04b7f6 fix(studnie): guardy snapshot undo w trakcie paste
- Batch 4 4b (E-117f): 5a330dfacdacf9f76774c4db44922475171af6c5 fix(studnie): gate klona otwarcia excel do 100 studni
- Batch 4 ledger: 4854099711ee5675b0e35785178d7fb314ecc509 docs(studnie): ledger e-117 finalizacja batch 4
- Faza 1 (E-200..E-211) i starty Batch (E-114/E-115/E-116/E-117 docs-only): bez osobnych commitow, weszly w ledgery 959e02e/979880b/4854099.

### Otwarte dlugi (nie commituja sie tym dopiskiem)

1. M docs/plans/parity-excel-virtual-600-throttle-x4.json - pomiar pre-existing, poza commitem (E-113e, E-117f).
2. Untracked docs/plans/parity-excel-virtual-600.json (OUT parity plain 31/31 z E-117f-parity) - decyzja w nastepnej sesji: commit albo gitignore.
3. Untracked docs/plans/hang-2000-harness-A-B.json - artefakt laboratoryjny N=2000, real max=3 per E-113d, poza commitem.
4. PR 4c god-split ODRACZONY - tylko design (E-117f-4c), brak kodu.
5. Punkty 1-2 reviewera jako follow-up, nie blokowaly 4a/4b (E-117f-debt).
6. Fingerprint parity AKCEPT z dlugiem lzejszej sygnatury (E-115f).

### Next steps (nastepna sesja, kolejnosc)

1. Decyzja artefakty: commit vs gitignore vs usuniecie dla dlugow 1-3.
2. Follow-up: punkty 1-2 reviewera + lzejsza sygnatura fingerprint + god-split 4c (osobne PR-y).
3. Przed commitem: npm run version:check + npm run validate + npm run format.
4. Commit wylacznie przez node scripts/commit.mjs; push za osobnym GO (tier czerwony).
5. E-105/E-211: RED/bench throttle-x4 do domkniecia po decyzji wrappera (jesli wznowione).

## Checkpoint E-118

- CLAIM: zamkniecie sesji dopisane append-only (E-118a..E-118d + listy + next steps), historia nietknieta.
- EVIDENCE: ta sekcja E-118; git log 4ed4eab..HEAD (20 SHA powyzszych); rev-parse HEAD == origin/main 4854099; status/diffstat/untracked jak w E-118c.
- REPRODUCTION: git log --oneline --decorate 4ed4eab..HEAD; rev-parse HEAD; rev-parse origin/main; status --short --branch; diff --stat (2026-10-16, EXIT 0).
- BEFORE: koniec E-117f (569 linii); HEAD 4854099 w sync z origin/main; worktree M 1 + ?? 2.
- AFTER: tylko docs/plans/_active-evidence.md + ta sekcja; kod + harnessy + .env + DB bez zmian tym dopiskiem.
- CHANGE: append-only, E-118 4x VERIFIED + next steps 1-5.
- TESTS: brak runtime tym dopiskiem (docs-only); bramki przed nastepnym commitem (next step 3).
- DIFF: git diff -- docs/plans/_active-evidence.md.
- COMMIT: brak (zadanie: zostaw do nastepnej sesji).
- VERIFIED: YES.

## Start B1 (2026-10-16, BUILD MODE docs-only, zero kodu)

Scope: dopisane na koncu, historia E-001..E-015, E-005a, E-100..E-106, E-200..E-211, E-107..E-118, E-111g..E-111h, E-114f, E-115f, E-116f, E-117f nietknieta. Nowe ID E-119, rozlaczne. Tylko ten plik docs. Nie dotyka kodu prod, harnessow, .env ani DB. Bez commita, bez pusha.

## Ledger E-119

| ID     | Twierdzenie                                                                                                                  | Dowod                                                     | Status     |
| ------ | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------- |
| E-119a | Start B1: hoist O(N) + pin-height + chunk/rowmap + overscan                                                                  | decyzja sesji 2026-10-16; kod nietkniety tym dopiskiem    | HYPOTHESIS |
| E-119b | LOADING w nastepnej rundzie, poza zakresem B1                                                                                | decyzja sesji 2026-10-16; brak kodu LOADING tym dopiskiem | HYPOTHESIS |
| E-119c | Wlasciciele: builder = tableBody/wellVirtual/state+flagi; general = studnie.css; explore = excelCopyPaste+excelVirtual.js:15 | podzial sesji 2026-10-16; bez zmian kodu tym dopiskiem    | HYPOTHESIS |
| E-119d | Zakaz buildera: BEZ excelCopyPaste ani excelVirtual.js (tylko explore je rusza)                                              | decyzja sesji 2026-10-16; do weryfikacji diffem B1        | HYPOTHESIS |
| E-119e | Kolejnosc: B1 przed LOADING; merge B1 tylko po bramkach ponizej                                                              | decyzja sesji 2026-10-16; LOADING czeka na runde po B1    | HYPOTHESIS |

## Bramki B1 (po kodzie, przed merge)

- parity GREEN: npm run test:parity (OFF vs ON, SSoT wells+undo).
- golden GREEN: node tests/playwright/excelDomGolden.cjs (bez --update; update tylko za autoryzacja nowego stanu).
- bench brak regresji vs baseline (open/modal/DOM/scroll/edit; hoist+overscan maja nie pogarszac).
- kwoty bez roznic (I-007; chunk/rowmap nie zmienia cen ani sum).
- longtask zero >50ms; lint+unit PASS sciezek B1.
  Bez 5/5 brak merge B1.

## Checkpoint E-119

- CLAIM: dopisek E-119 append-only, historia nietknieta, kod + harnessy + .env + DB nietkniete tym dopiskiem.
- EVIDENCE: ta sekcja E-119a..E-119e; start B1 (hoist O(N) + pin-height + chunk/rowmap + overscan; LOADING w nastepnej rundzie) + wlasciciele + zakaz + bramki z zadania sesji 2026-10-16.
- REPRODUCTION: odczyt docs/plans/_active-evidence.md koniec (E-118, 636 linii); brak runtime w tym dopisku (docs-only).
- BEFORE: koniec E-118; kod + harnessy + .env + DB bez zmian.
- AFTER: tylko docs/plans/_active-evidence.md + ta sekcja; kod + harnessy + .env + DB bez zmian tym dopiskiem.
- CHANGE: append-only, E-119 5x HYPOTHESIS (zakres B1 + LOADING odroczone + wlasciciele + zakaz + kolejnosc).
- TESTS: brak runtime w docs; bramki czekaja (parity + golden + bench + kwoty + longtask/lint/unit).
- DIFF: git diff -- docs/plans/_active-evidence.md.
- COMMIT: brak, zadanie mowi nie commituj.
- VERIFIED: NO (czeka na kod B1 + artefakty bramek).

## Finalizacja B1 (2026-10-16, BUILD MODE, BEZ PUSH)

Scope: dopisane na koncu, historia E-001..E-015, E-005a, E-100..E-106, E-200..E-211, E-107..E-119 (E-119a..E-119e) nietknieta. Nowe ID E-119f, rozlaczne.

## Ledger E-119f

| ID     | Twierdzenie                                                                                                                                                                                                                                                                                         | Dowod                                                                                                                                                                                                                                                                   | Status   |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| E-119f | Zakres B1: hoist renderu + flagi + pin wierszy + chunk/rowmap + overscan; golden-update autoryzowany (slice ~48->~68 + pin-height zmienia SHA x6; scroll-contract + sensitivity OK); bench BENCH_NS=1000 ON 862/1214 vs baseline 1504/1211 (brak regresji, prog +15%); LOADING odroczone do rundy 2 | diff: excelTableBody/wellVirtual/excelState/excelChangeHandlers/excelWellActions/excelModal/excelTabs/excelCopyPaste/excelVirtual/excelUndo + studnie.css; golden-excel-dom-1200.json SHA x6; bench-run 2026-10-16 (baseline JSON zrestorowany, pomiar nie commitowany) | VERIFIED |

## Checkpoint E-119f

- CLAIM: finalizacja B1 (E-119f), historia nietknieta, LOADING poza zakresem.
- EVIDENCE: ta sekcja E-119f; diff 11 plikow prod + golden; bench ON open -43% / edit +0,2% vs baseline.
- REPRODUCTION: $env:BENCH_NS="1000"; node tests/playwright/excelVirtualBench.cjs (2026-10-16, ON rows=68 openMs=862 editMs=1214).
- BEFORE: koniec Checkpoint E-119; worktree z kodem B1 + golden + ledger.
- AFTER: + ta sekcja; commit zakresem z zadania, BEZ push; bench JSON zrestorowany (poza commitem).
- CHANGE: append-only, E-119f 1x VERIFIED.
- TESTS: K1-K3 sesji B1 (check/eslint/unit/parity GREEN); version:check w kroku 3.
- DIFF: git diff -- docs/plans/_active-evidence.md.
- COMMIT: node scripts/commit.mjs "perf(studnie): hoist renderu i pin wierszy excel", BEZ push.
- VERIFIED: YES (po zielonym version:check w kroku 3).

## Start runda 2 LOADING-tint (2026-10-16, BUILD MODE docs-only, zero kodu)

Scope: dopisane na koncu, historia E-001..E-015, E-005a, E-100..E-106, E-200..E-211, E-107..E-119, E-111g..E-111h, E-114f, E-115f, E-116f, E-117f, E-119f nietknieta. Nowe ID E-120, rozlaczne. Tylko ten plik docs. Nie dotyka kodu prod, harnessow, .env ani DB. Bez commita, bez pusha.

## Ledger E-120

| ID     | Twierdzenie                                                                                        | Dowod                                                  | Status     |
| ------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ---------- |
| E-120a | Runda 2 LOADING-tint: klasa bez mutacji tla + spinner + aria-busy w finally                        | decyzja sesji 2026-10-16; kod nietkniety tym dopiskiem | HYPOTHESIS |
| E-120b | Wlasciciele: builder = tableBody, general = autoSelect, explore = css + test                       | podzial sesji 2026-10-16; bez zmian kodu tym dopiskiem | HYPOTHESIS |
| E-120c | Bramki: errorRefresh rozszerzone + parity GREEN + golden GREEN (bez --update) + aria (busy/status) | bramka sesji 2026-10-16; do potwierdzenia po rundzie 2 | HYPOTHESIS |
| E-120d | Kolejnosc: runda 2 po B1; merge tylko po bramkach E-120c                                           | decyzja sesji 2026-10-16; LOADING poza zakresem B1     | HYPOTHESIS |

## Checkpoint E-120

- CLAIM: dopisek E-120 append-only, historia nietknieta, kod + harnessy + .env + DB nietkniete tym dopiskiem.
- EVIDENCE: ta sekcja E-120a..E-120d; runda 2 LOADING-tint (klasa bez mutacji tla, spinner, aria-busy w finally) + wlasciciele + bramki z zadania sesji 2026-10-16.
- REPRODUCTION: odczyt docs/plans/_active-evidence.md koniec (E-119f, 695 linii); brak runtime w tym dopisku (docs-only).
- BEFORE: koniec E-119f; kod + harnessy + .env + DB bez zmian.
- AFTER: tylko docs/plans/_active-evidence.md + ta sekcja; kod + harnessy + .env + DB bez zmian tym dopiskiem.
- CHANGE: append-only, E-120 4x HYPOTHESIS (tint + wlasciciele + bramki + kolejnosc).
- TESTS: brak runtime w docs; bramki czekaja (errorRefresh rozszerzone + parity + golden + aria).
- DIFF: git diff -- docs/plans/_active-evidence.md.
- COMMIT: brak, zadanie mowi nie commituj.
- VERIFIED: NO (czeka na runde 2 + artefakty bramek).

## Finalizacja runda 2 LOADING (2026-10-16, BUILD MODE, BEZ PUSH)

Scope: dopisane na koncu, historia E-001..E-120d nietknieta. Nowe ID E-120f, rozlaczne.

## Ledger E-120f

| ID     | Twierdzenie                                                                                                                                                                                             | Dowod                                                                                   | Status   |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------- |
| E-120f | Zakres: tableBody tint-guard + helper _excelSetRowLoading + autoSelect set-clear finally + offerSave strip _excelLoading + css klasa-pulse + test +3; bramki GREEN, LOADING off w fixture = ten sam DOM | diff 4 pliki + test; jest 16-16 + invariants + gate; parity 31-31; golden OK bez update | VERIFIED |

## Checkpoint E-120f

- CLAIM: finalizacja rundy 2 LOADING (E-120f), strip w zapisie potwierdzony.
- EVIDENCE: ta sekcja E-120f; strip _excelLoading w stripWellRuntimeFields.
- REPRODUCTION: check + eslint + jest + parity + golden (2026-10-16, EXIT 0).
- BEFORE: koniec Checkpoint E-120; worktree z kodem LOADING.
- AFTER: + ta sekcja; commit zakresem z zadania, BEZ push.
- CHANGE: append-only, E-120f 1x VERIFIED.
- TESTS: check-eslint-unit-parity-green; version-check w kroku 5.
- DIFF: git diff -- docs/plans/_active-evidence.md.
- COMMIT: scripts-commit feat-studnie loading, BEZ push.
- VERIFIED: YES (po zielonym version-check).

## Checkpoint E-121 (S4 cenniki: shadow sum, F1, F2, budżety)

- CLAIM: N+1 listy wersji usunięte (4 groupBy na całą listę), shadow suma studni tylko loguje różnicę, indeksy F2 obecne w schemacie i zmierzone EXPLAIN, budżety 8.2 zmierzone na fixture.
- EVIDENCE: `src/services/pricelist/usage.ts` (`countUsageBatch`), `src/routes/pricelistVersions.ts` (GET `/`), `src/services/pricelist/shadowSum.ts`, `src/routes/offers/studnieCrud.ts` (POST/PUT), `prisma/schema.prisma` (4 indeksy), `prisma/migrations/20261021130000_pricelist_version_idx/migration.sql`, `scripts/seed-pricelist-perf.ts`.
- REPRODUCTION: `npm run perf:pricelist -- --reseed` → EXPLAIN 4/4 PASS (COVERING INDEX), summary p95 4.6 ms / checks 371.5 ms / lista 10.9 ms (budżety 200/500/300), batch usage = 5 zapytań dla 400 wersji; `npx jest tests/pricelistShadowSum.test.ts tests/pricelistVersions.summary.test.ts tests/pricelistVersions.f2.test.ts --runInBand` → 24/24 PASS.
- BEFORE: lista = 4× count na wersję (N+1), brak indeksów `pricelistVersionId`, brak shadow sum, brak fixture/budżetów.
- AFTER: 4 groupBy na listę + mapa; shadow `{stored, wellsExportTotal, delta}` w logu (bez 422); indeksy w schemacie + migracja; fixture poza repo (`data/perf/`, gitignore).
- CHANGE: +2 test suites (shadow, batch contract), 1 skrypt perf; brak zmian kontraktu HTTP poza liczbą zapytań.
- TESTS: `npm run test:quick` 510/511 suites PASS (1 fail = znany flaky `tests/orders/claimIdempotencyHttp.test.ts`, solo 5/5 PASS); typecheck, eslint, format:check, version:check, encoding:check bez ERROR.
- DIFF: 9 plików śledzonych + 3 nowe (shadow, test, skrypt) + migracja.
- COMMIT: `9640a3c feat(api): cenniki s4 shadow sum, indeksy i budzety` (bez pusha).
- DEPLOY: backup `backup_2026-10-21_1792579184054.sqlite` (SHA-256 `efd66832…`), `migrate deploy` → `20261021130000_pricelist_version_idx` applied, `migrate status` = up to date, 4/4 indeksy obecne w `sqlite_master`, preflight EXIT 0, serwer `/health` 200.
- VERIFIED: YES (kod, pomiar, migracja wdrożona).

## Checkpoint E-122 (S5 cenniki: cel zapisu, liczniki O3)

- CLAIM: zapis cennika ma przelacznik `PRICELIST_WRITE_TARGET` (default `draft` = S5), sciezka `draft` zapisuje do najnowszego DRAFT (albo tworzy nowy), a kazdy udany zapis LIVE trafia do `audit_logs` (`entityType=pricelist_live`, `action=LIVE_WRITE`/`PATCH_LIVE_WRITE`/`DELETE_LIVE_WRITE`) i do `/metrics`; fallback `?source=active -> live` ma licznik per typ; w trybie draft endpointy LIVE PATCH/DELETE zwracaja 409 `LIVE_READ_ONLY`.
- EVIDENCE: `src/services/pricelist/writeTarget.ts`, `src/services/pricelist/usage.ts` (`pricingFromVersion`), `src/services/precoPricing.ts` (`flattenPrecoRows`), `src/routes/productsV2.ts`, `src/routes/productsStudnieV2.ts`, `src/routes/precoPricingV2.ts`, `src/utils/metrics.ts`, `src/routes/audit.ts`, `.env.example`, `tests/pricelistWriteTarget.test.ts`, `tests/productsV2.test.ts`.
- REPRODUCTION: `npx jest tests/pricelistWriteTarget.test.ts tests/productsV2.test.ts tests/pricingFinite.test.ts tests/pricelistActiveSource.test.ts tests/pricelistExportLive.test.ts --runInBand` -> 71/71 PASS; `npm run test:quick` -> 511/512 suites PASS (1 znany flake `claimIdempotencyHttp`, solo PASS 5/5); `npm run test:e2e-pricelist-preview:spawn` PASS; `npm run test:e2e` 26/27 PASS (1 flake smoke: iframe, solo 3/3 PASS); typecheck/eslint/format:check/version:check/encoding:check bez ERROR.
- BEFORE: PUT zawsze LIVE, brak audytu LIVE, brak licznikow, brak flagi.
- AFTER: default `draft`, sciezka draft + odczyt edytora DRAFT -> ACTIVE -> LIVE, audyt LIVE_WRITE/PATCH/DELETE, metryki `pricelist.liveWrites/fallbacks`, `pricelist_live` w allowliscie audytu, `LIVE_READ_ONLY` na PATCH/DELETE rury/studnie/preco; rollback = `PRICELIST_WRITE_TARGET=live`.
- CHANGE: +1 serwis, +1 test suite, guardy LIVE_READ_ONLY i audyt PATCH/DELETE, pin env `live` w testach legacy; bez zmian schematu.
- TESTS: j.w.; e2e pricelist PASS; pelny e2e 26/27 (znany flake).
- DIFF: 12 plikow sledzonych + 2 nowe.
- COMMIT: `fe1fb66` (`feat(api): cenniki s5 draft default i live read-only`).
- VERIFIED: YES — kod, testy i e2e zielone; restart dev wykonany, push/release po jawnym GO.

## Checkpoint E-123 (S5-close: dzienny check O3 + sygnał szkicu + testy tras)

- CLAIM: S5 ma dzienny check „dokładnie 1 aktywna/typ” (CLI + cron), edytory rury/studnie/PRECO pokazują cel zapisu („Zapisz szkic” + toast), a trasy studnie/preco oraz alias eksportu `source=live -> draft` mają testy regresyjne.
- EVIDENCE: `src/services/pricelist/health.ts`, `scripts/check-pricelist-health.ts`, `src/utils/cronService.ts`, `package.json` (`pricelist:health`), `src/routes/productsV2.ts`, `src/routes/productsStudnieV2.ts`, `src/routes/precoPricingV2.ts` (`X-Pricelist-Write-Target`), `public/js/rury/dataService.js`, `public/js/rury/pricelistUi.js`, `public/js/studnie/uiHelpers.js`, `public/js/studnie/pricelistState.js`, `public/js/studnie/pricelistSaveReset.js`, `public/js/studnie/pricelistPreco.js`, `tests/pricelistHealth.test.ts`, `tests/pricelistWriteTargetRoutes.test.ts`.
- REPRODUCTION: `npm run pricelist:health` -> OK (rury/studnie/preco po 1 ACTIVE, `LIVE_WRITE 24h=0`); `npx jest tests/pricelistHealth.test.ts tests/pricelistWriteTargetRoutes.test.ts --runInBand` -> 13/13 PASS; `npm run validate` -> PASS (5092 testy, 514 suites; `version/typecheck/lint/test:quick/collisions/ratchet/prices:verify`).
- BEFORE: brak dziennego checku „1 aktywna/typ”; edytor nie odróżniał zapisu szkicu od LIVE; brak testów tras studnie/preco w trybie draft.
- AFTER: `pricelist:health` (exit 2 przy naruszeniu, `--require-zero-live-writes` dla O3), cron `pricelistHealth` co 24h (log only, bez auto-healu), nagłówek `X-Pricelist-Write-Target`, etykiety/toasty „Zapisz szkic”, jawny `409 NO_DRAFT_VERSION` dla aliasu eksportu.
- CHANGE: +2 pliki produkcyjne (health + CLI), +2 testy, cron +3 pliki tras + 6 plików FE; bez zmian schematu i bez nowych zależności.
- TESTS: j.w.; `npm run test:axe` -> 5/5 PASS; `npm run test:e2e-pricelist-preview:spawn` -> PASS; `npm run test:e2e` -> 26/27 (znany flake `smokeOfferFlow`, solo 3/3 PASS); `npm run format` + `format:check`/`encoding:check` bez ERROR.
- DIFF: 14 plików śledzonych + 4 nowe (w tym `THIRD-PARTY-NOTICES.md` — odświeżona data generatora).
- COMMIT: `2000f0a` (`feat(api): cenniki s5 close health check i sygnal szkicu`); `31e8bf0` (odświeżenie `THIRD-PARTY-NOTICES.md`).
- VERIFIED: YES — check na realnej bazie OK, testy i pełny `validate` zielone; `test:e2e` ma tylko znany flake iframe (solo PASS); push/release po jawnym GO.

## Checkpoint E-124 (release 1.48.0 + fix cache-bust dla nowych HTML)

- CLAIM: S4/S5/S5-close wypchnięte na `origin/main` i opublikowane jako release `v1.48.0`; przy okazji naprawiony root cause cache-bustingu — `auto-cache-bust.mjs` miał hardcoded listę HTML, więc `public/cenniki.html` (i `benchmark-tm.html`) zostały w `?v=1.47.0` i `version:check` blokował release.
- EVIDENCE: `scripts/auto-cache-bust.mjs` (dynamiczne wykrywanie `public/*.html` + `public/templates/*.html`, zgodnie z `scripts/check-version.mjs`), `public/cenniki.html`, `public/benchmark-tm.html`, `VERSION`, `CHANGELOG.md`.
- REPRODUCTION: `npm run release:minor` (przed fixem) → `✗ HTML: public\cenniki.html → 1.47.0 (≠ VERSION 1.48.0)`; po fixie → `✓ Spójne — wersja zgodna we wszystkich źródłach`; `gh release list` → `v1.48.0` na GitHubie.
- BEFORE: `HTML_FILES` = 9 plików hardcoded; `cenniki.html`/`benchmark-tm.html` poza zakresem; release potrafił wyjść z niespójnym `?v=`.
- AFTER: wykrywanie HTML dynamiczne (13 plików, te same katalogi co w `check-version.mjs`); release 1.48.0 zawiera `cenniki.html` w `?v=1.48.0`; `version:check` PASS.
- ADNOTACJA (2026-10-25, E-125): `public/cenniki.html` został usunięty w `95b64e6` (`refactor(ui): usuniecie centrum cennikow ze spa`). Wpis pozostaje jako dowód historyczny release 1.48.0 — nie kasować; stan bieżący: plik nie istnieje.
- CHANGE: +1 skrypt (lista → skan katalogów), 2 pliki HTML zcache-bustowane, bump 1.47.0 → 1.48.0 (CHANGELOG/VERSION/package.json/.bat/docs/HTML).
- TESTS: `npm run validate` PASS (przed release); `npm run version:check` PASS po fixie i po release; pre-push hook zielony (git-safety 23/23, test:quick PASS) przy obu pushach.
- DIFF: 1 skrypt + 2 HTML + 34 pliki release.
- COMMIT: `5031db4` (`fix(config): cache bust dla wszystkich plikow public html`), `131abe5` (`chore(release): 1.48.0`), tag `v1.48.0`, GitHub Release `v1.48.0`.
- VERIFIED: YES — kod, wersje i release zweryfikowane; do wykonania pozostaje wdrożenie 1.48.0 na serwerze (pull + restart), od którego liczy się okno O3.
