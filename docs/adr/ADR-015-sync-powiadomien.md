# ADR-015: Sync powiadomień opieki przy odczycie (GET z efektem ubocznym)

**Status:** Zaakceptowany
**Data:** 2026-10-10

## Kontekst

Centrum powiadomień opieki (`GET /api/care/notifications`) materializuje wiersze
w `care_notifications` przy każdym odczycie (sync: INSERT brakujących + auto-read
nieaktualnych). GET ma więc efekt uboczny w DB. Rozważano czysty odczyt (liczenie
na żywo bez tabeli) oraz osobny POST /sync.

## Decyzja

Sync przy odczycie zostaje:

- powiadomienie to pochodna stanu (jak badge), nie zdarzenie biznesowe — brak
  konsumentów poza skrzynką usera, brak webhooków, brak rozliczeń;
- brak schedulera w S.O.K. (celowo: SQLite single-node, ADR-001/ADR-012, zero
  cronów follow-up) — sync per-request zastępuje workera;
- idempotentny (unikalność przez sprawdzenie przed INSERT, rerun = 0 wstawek);
- pauza (snooze/done) i terminale nie generują; wygasły snooze wraca do kandydatów.

## Konsekwencje

- `GET /notifications` wykonuje zapisy — testy muszą to uwzględniać (asercje
  inserted/resolved, nie czysty SELECT);
- limit zapytań: sync = kandydaci + N×(check+insert) — przy tysiącach ofert
  przenieść do stronicowanego workera na żądanie (trigger: pomiar, nie opinia);
- eskalacja progowa liczona z `care_sla_config` (globalnej), nie per user.

## Triggery rewizyty

- Mierzalne spowolnienie GET (p95 z liczbami),
- potrzeba push/e-mail (wtedy kolejka + worker, nie sync przy odczycie),
- progi SLA per user / per zespół.

## Alternatywy odrzucone

| Alternatywa              | Powód odrzucenia                                                                  |
| ------------------------ | --------------------------------------------------------------------------------- |
| Czysty odczyt bez tabeli | Brak historii/odczytania (badge bez „przeczytane"), liczenie przy każdym pollingu |
| Osobny POST /sync        | Drugi round-trip co 60 s bez zysku; sync i tak musi biec przed listą              |
| Cron/worker              | Brak schedulera w projekcie; single-node SQLite, polling wystarcza                |

## Suplement 2026-10-11 (decyzja A+C: podgląd repa)

`repId` (`resolveRepOwner`, fail-closed 403) filtruje kolejkę/summary oraz
wybiera czytaną skrzynkę (`list` per mailbox `repOwner ?? self`, podgląd
read-only). Sync z `repOwner` nie wykonuje INSERT ani DELETE
w skrzynce zalogowanego (zero zapisów między skrzynkami); pełny sync bez filtra
zachowuje dotychczasowe zachowanie (INSERT + auto-read + retencja 90d/500).
Odrzucono: odczyt/zapis skrzynki repa (confused-deputy, I-003).

## Suplement 2026-10-11 (eskalacja z progu efektywnego, ADR-016)

Od ADR-016 eskalacja progowa liczona z progu efektywnego w scope requeścia
(`getEffectiveSla`: team/user z fallbackiem do globalnej), nie z samej
globalnej. CASE w `notifCandidates` bez zmian (SLA_BREACH przed ESCALATION).

## Suplement 2026-10-12 (fala R3+R2: ETag marker m + hasOverflow)

R2 VERIFIED (worktree dirty, bez commit): `hasOverflow` liczony z istniejącej
listy (`care.ts:269` panel, `care.ts:614` notifications — zero zmian SQL,
retencja/sync bez zmian); FE badge cap `99+` + stopka `+N więcej`
(`carePanel.js:294-299,443-451`, podpięcie `1729,1783`); testy
`followUpCareNotifRoutes.test.ts:80-91` (overflow true/false) i
`frontend/carePanel.test.ts:1718-1775` (badge 99+). Cap tylko prezentacja,
retencja/sync bez zmian; licznik `unreadCount` capped na 101
(`CARE_UNREAD_CAP=100` + 1, subquery `LIMIT 101` zamiast full COUNT —
`careService.ts`, test granic w `followUpCareNotif.test.ts`).
Bez wpływu na decyzję sync-przy-odczycie.

R3 VERIFIED (`76904fa`): marker `m = MAX(updatedAt)` w `getCareEtagInput`
(`careService.ts:524-551`, slot 13., guarded `m=null` na legacy DB);
POST/PUT bumpują `updatedAt` (`followUps.ts:108-119,193,328`, migracja
`20261012000000_care_followups_updatedAt`); test `careEtagOwner.test.ts`
(edit→ETag inny). Decyzja sync-przy-odczycie bez zmian.

## Suplement 2026-10-14 (P0.3: throttle syncu per skrzynka)

Sync zostaje w requeście (decyzja wyżej bez zmian — brak workera/crona),
ale nie na każdy odczyt: skip do 60 s po udanym syncu tej skrzynki
(`CARE_SYNC_THROTTLE_MS`, `careService.ts`, odpowiedź `skipped:
'throttled'`). Fail nie stempluje (retry dozwolony); współbieżne żądania
serializują się; restart procesu gubi znacznik = pełny sync (bezpieczne).
Świeżość powiadomień gorsza o ≤60 s (granica pollingu FE). Testy:
`careSyncLoad.test.ts` (skip bez statementów, fail-retry, wyścig a+b=N).
