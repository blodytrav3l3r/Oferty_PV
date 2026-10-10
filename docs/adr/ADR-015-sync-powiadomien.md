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
