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
