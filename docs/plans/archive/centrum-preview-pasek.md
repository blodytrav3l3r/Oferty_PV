# Pasek podglądu alertów repa — kompletny plan naprawy

Status: PLAN (decyzja: NIE ruszać skrzynki, NIE opcja B). Podstawa: kontrakt A+C
(`docs/OPIEKA.md`, ADR-015 suplement), werdykt z backupu
(`docs/plans/centrum-weryfikacja-adam-klos.md`): skrzynka zawsze self, zero
zanieczyszczenia, kolejka/pilność za repem.

## Problem (nie bug BE, luka UX)

Przy wybranym repu (np. Dawid: 1 oferta OS/000010) kolejka pokazuje JEGO
ofertę, a Centrum — MOJE 4 alerty (OS/000001,2,3,8, właściciel `usr_admin`).
Użytkownik oczekuje wglądu w alerty repa. Odczyt cudzej skrzynki (opcja B)
odrzucony: confused-deputy, I-003.

## Cel

Pasek podglądu w trybie `careRep`: liczniki pilności REPA (read-only) +
click-through do jego kolejki. Własna skrzynka zostaje, oznaczona bannerem
(już jest: `care-notif-preview`). Zero INSERT/UPDATE/DELETE, zero migracji,
zero nowej powierzchni authz.

## Kontrakt (decyzje zamrożone)

1. Źródło liczników Faza 1: istniejący `/panel?scope&repId` — `summary`
   (`noContact/due/openOk/won/lost`) + `queue.totalCount`. ZERO zmian BE.
2. Faza 2 (warunkowa): dedykowany lekki `GET /care/rep-preview` —
   `SELECT ntype, COUNT(*) FROM (notifCandidates)` — tylko jeśli kubełki
   summary okażą się niewystarczające. Reuse `notifCandidates`, `ownerCond`,
   `resolveRepOwner` (403 zostaje). Bez sync/mailbox/retencji.
3. Liczniki ZAWSZE z serwera (`summary`/`totalCount`), NIGDY z `queueCache`
   ani DOM (limit strony 50 kłamie przy >50 ofertach).
4. Trzy stany paska: `loading / empty / error(stale)` (`data-state`); przy
   zmianie repa czyścić liczby przed fetchem. Błąd kolejki ≠ pusta kolejka.
5. ETag: panelowy już per rep (`[user,scope,from,to,repOwner,...]`); przed
   Fazą 2 zweryfikować ślepe punkty (edycja outcome w miejscu, shares,
   cursor/limit) testami, nie opinią.
6. Polling: 1 fetch/tick jak dziś; brak N×pollów; koszt CTE zmierzyć
   (`EXPLAIN QUERY PLAN` + licznik statementów) przed Fazą 2.

## Faza A: kontrakt docs-only

- `docs/OPIEKA.md`: sekcja paska (źródło liczników, stany, click-through).
- `docs/security/permission-matrix.md`: wiersze `summary/queue` + `repId`.
- `docs/adr/ADR-015-sync-powiadomien.md`: Suplement 2 (liczniki bez sync).
- Bramki: `version:check`, `format`, commit `docs`.

## Faza B: testy RED

1. Liczniki paska = `summary` repa (seed: rep z N DUE → pasek N, nie 50).
2. Zero INSERT przy preview (licznik wierszy `care_notifications` stały).
3. Obcy rep → 403, pasek w stan `error`, brak resztek po poprzednim repu.
4. ETag per rep (A≠B, brak fałszywego 304; zmiana danych repa → nowy ETag).
5. Commit testów osobno. STOP: test GREEN od początku = przebuduj asercję.

## Faza C: backend (TYLKO Faza 2, warunkowa)

- Wejście: dowód, że kubełki summary nie wystarczają + EXPLAIN czysty.
- ≤3 pliki, thin wrapper na `notifCandidates`, Zod reuse, ETag bez `d,e`
  (maxima własnej skrzynki) lub brak ETag + polling 15–30 s.
- STOP: potrzeba sync/mailbox/retencji/nowej tabeli → poza zakres.

## Faza D: FE (`public/js/care/carePanel.js` only)

- Fetch preview (Faza 1: istniejący `/panel`; Faza 2: nowy endpoint),
  render `textContent`, `addEventListener`, zero `window.*`/`onclick`,
  `escapeHtml` przy labelu repa, `lucide.createIcons({root})` po wstrzyknięciu.
- Składnia: `node -c`, `lint:frontend`, `typecheck:frontend`.

## Bramki (każda faza)

`version:check` → `validate` → `format` → `commit.mjs`. Push osobne GO.
STOP: destrukcyjny git, migracja/seed/restart bez GO, zmiana I-001–I-012
bez decyzji, test GREEN-od-początku jako „dowód", scope-creep do opcji B.

## Evidence Ledger

| ID    | Twierdzenie                                         | Dowód                                                          | Status                           |
| ----- | --------------------------------------------------- | -------------------------------------------------------------- | -------------------------------- |
| E-001 | Skrzynka zawsze self; rep nie wchodzi do odczytu    | `src/routes/care.ts:591`                                       | VERIFIED                         |
| E-002 | Sync z repOwner = zero writes                       | `src/services/careService.ts:838` (`if repOwner return {0,0}`) | VERIFIED                         |
| E-003 | repId = AND w scope, fail-closed 403                | `src/services/careService.ts:148-154,177-186`                  | VERIFIED                         |
| E-004 | `notifCandidates` istnieje, jedyny wołający to sync | agenci recon                                                   | UNVERIFIED (F0 do potwierdzenia) |
| E-005 | Ślepe punkty ETag (outcome-edycja, shares, cursor)  | agenci recon                                                   | HYPOTHESIS (testy w Fazie B)     |
| E-006 | Liczniki FE z cache kłamią przy >50 ofertach        | agenci recon                                                   | HYPOTHESIS (test w Fazie B)      |

## Success Criteria

- [ ] Pasek pokazuje pilność REPA, nie właściciela; klik prowadzi do jego kolejki.
- [ ] Własna skrzynka nietknięta (dowód: delta wierszy 0 w teście).
- [ ] 403/stany/błędy jawne, zero cichych zer i resztek po zmianie repa.
- [ ] Diff: Faza 1 = 1 plik FE + testy; Faza 2 (jeśli w ogóle) ≤3 pliki BE.
