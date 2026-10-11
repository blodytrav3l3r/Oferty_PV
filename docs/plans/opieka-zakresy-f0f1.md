# Opieka — zakresy F0–F4 (paczka docs-only, nie archiwum)

Kontynuacja po `docs/plans/opieka-nad-oferta.md` (checkpoint `5ed0d25`, push 2026-10-08).
Nowa paczka: audyt zakresów (kto widzi czyje oferty/follow-upy) + kontrakt widoków.
GO tej paczki obejmuje **tylko F0+F1 docs-only**. F2–F4 opisane dla kontekstu, wymagają osobnych GO.

## Źródła (Evidence-first)

- FACT: role `admin | pro | user` (`src/validators/authSchema.ts`, `src/middleware/auth.ts:requireAdmin`).
- FACT: ownership `src/utils/ownership.ts` (`canWriteDoc`, pro widzi `subUsers`), filtry `src/utils/roleFilter.ts`, zakresy w `src/services/careService.ts` (`mine/team`, `scope=all` tylko admin, shares przez `EXISTS document_shares`).
- FACT: inwarianty I-003 (cudze zasoby), I-010 (CSRF), I-011 (brak diagnostyki), I-012 (audit) z `docs/SYSTEM_INVARIANTS.md`.
- UNVERIFIED: `docs/AUTONOMY_CONTRACT.md` **nie istnieje w repo** (glob `**/*AUTONOMY*` pusty) — do czasu odtworzenia obowiązuje tabela Tierów z `AGENTS.md` (docs/testy = zielone autonomicznie, kod = batch GO, push = osobne GO).

## F0 — Audyt zakresów (read-only)

- Cel: macierz **endpoint × ADMIN / PRO / USER / share** dla ścieżek opieki: `POST/GET /api/offers/:kind/:id/followups`, `GET /api/offers/search` (filtry LOS), `GET /followups/stats`, widget Pulpitu, timeline Kartoteki.
- Metoda: kod + testy + runtime (logowanie czterema rolami na dev DB). Jeden grep ≠ dowód na brak (reguła NEGATIVE CLAIMS).
- Wejście: snapshot stanu (`git status`, HEAD), lista endpointów z `src/mountRoutes.ts` + `src/routes/care.ts`.
- Wyjście: macierz wypełniona statusami `VERIFIED / HYPOTHESIS / REJECTED` + lista findingów z dowodem (plik:linia, komenda repro).
- STOP: jakakolwiek edycja kodu, dotknięcie prod DB, zmiana inwariantu bez decyzji.

## F1 — Kontrakt widoków (docs-only)

- Cel: semantyka czterech zakresów na istniejących mechanizmach (nic nowego bez VERIFIED z F0):
    - **portfel** = `mine` (własne oferty, każdy zalogowany),
    - **zespół** = `team` (własne + `subUsers`, tylko pro/admin, inaczej 403 jak w `careService.ts`),
    - **udostępnione** = rekordy z `document_shares` dla `sharedWithUserId` (read, bez eskalacji do write),
    - **firma** = wszystko, tylko admin (`scope=all`, fail-closed dla reszty).
- Wejście: wyjście F0 (macierz VERIFIED).
- Wyjście: sekcja kontraktu w tym pliku (append) + reguły 403/404 (404 na mismatch typu, 403 na brak dostępu — bez wycieku istnienia cudzego rekordu).
- STOP: implementacja przed VERIFIED z F0; nowy mechanizm dostępu zamiast reuse `ownership.ts` / `roleFilter.ts`.

## F2 — UX (spec, bez kodu w tej paczce)

- Cel: specyfikacja `zadania na dziś` (overdue + due today, sort: overdue → dziś → `nextContactAt ASC`) i toggles `portfel / zespół / udostępnione / firma` widoczne per rola (user: portfel + udostępnione; pro: + zespół; admin: + firma).
- Wejście: kontrakt F1.
- Wyjście: spec w `docs/plans/` + lista plików UI do ruszenia w przyszłym GO (Kartoteka, widget Pulpitu).
- STOP: kodowanie w tej paczce.

## F3 — Regresja (spec zestawu)

- Cel: zestaw regresji do przyszłego GO na kod: IDOR (cudzy `offerId` → 403, nie 404-wyciek), brak wycieku przez `stats`/liczniki (agregaty w scope, fail-closed), dedup timeline (append-only, brak UPDATE/DELETE), liczniki widgetu zgodne z `search totalCount`.
- Bramy obowiązkowe: `npm run version:check` (rozjazd = blokada), `npm run validate`, `npm run format`, commit tylko `node scripts/commit.mjs`.
- Wejście: F1 + istniejące testy zielone (`test:quick`).
- Wyjście: lista przypadków testowych z komendami repro.
- STOP: zielony test od początku jako "dowód naprawy" (wymagany RED→GREEN na regresji).

## F4 — Backend warunkowy (poza tą paczką)

- Warunek wejścia: F0–F3 VERIFIED + **osobne GO na kod** (GO-na-plan ≠ GO-na-kod).
- Limit: **≤3 pliki** backendu, reuse `ownership.ts` / `roleFilter.ts` / `careService.ts`; nowy plik tylko za jawną zgodą.
- Wyjście: implementacja + testy regresji z F3 + commit przez `commit.mjs`.
- STOP: przekroczenie limitu plików, zmiana inwariantu I-001–I-012 bez decyzji, push bez osobnego GO (Tier czerwony).

## Reguły paczki

- GO na plan ≠ GO na kod. Push = zawsze osobne GO. STOP przerywa paczkę natychmiast.
- Commity docs-only tej paczki: `node scripts/commit.mjs`, bez pusha.

## Decyzja F4-krytyczne (2026-10-11, append)

- TERAZ: F2 narrow (scope AND, wyciek miedzy zakresami, I-003) + F6 audyt (prev-przed-write, I-012).
- DLACZEGO: oba CRITICAL (bezpieczenstwo/audyt), maly diff (≤3 pliki BE), RED potwierdzony (`careF0Silent.test.ts` 8/8 FAIL).
- ODKLADAM: F1/F3/F5/F7/F8 (HIGH/MED, fallback/UX/liczniki) — osobna paczka, nie blokuja F4.
- BRAMA: fixy F2+F6 → GREEN F2+F6 w `careF0Silent` + `test:quick` + e2e → commit `commit.mjs`, bez pusha.
- DOWOD: `tests/offers/careF0Silent.test.ts:113-124` (F2), `:163-170` (F6); ledger `_active-evidence.md` E-004/E-007.

## Decyzja F7+F4+F3 (2026-10-11, append, batch GO)

- TERAZ: F7+F4+F3 — małe, bezpieczne, zero decyzji produktowej; RED proof czeka (FAIL najpierw, potem GREEN).
- DLACZEGO: mały diff BE (reuse istniejących filtrów/scope), fail-closed bez zmiany semantyki, test regresji dowodzi naprawy.
- DEFERRED: F1/F5/F8 — fail-open vs fail-closed to decyzja produktowa (ciche `[]` / best-effort 200 / silent DEFAULT mogą być zamierzone), nie technikaliom.
- DEFERRED: UX toggles (portfel/zespół/udostępnione/firma) — osobna paczka frontend, po kontrakcie F1.
- BRAMA: GREEN F7+F4+F3 + `test:quick` → werdykt o commicie; bez pusha (Tier czerwony).
