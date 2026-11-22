# Rejestr decyzji architektonicznych

Ten spis ułatwia wybór aktywnej decyzji. Pełny kontekst, konsekwencje i ewentualne zastąpienie opisuje każdy ADR. Jeśli status w tabeli różni się od pliku ADR, obowiązuje status w ADR.

| ADR                                          | Temat                             | Status skrócony                                        |
| -------------------------------------------- | --------------------------------- | ------------------------------------------------------ |
| [001](ADR-001-sqlite.md)                     | SQLite jako baza produkcyjna      | Zastąpiony; historyczny                                |
| [002](ADR-002-vanilla-js.md)                 | Vanilla JS SPA                    | Zaakceptowany                                          |
| [003](ADR-003-vite.md)                       | Vite jako dev server              | Zastąpiony przez ADR-005                               |
| [004](ADR-004-express-prisma.md)             | Express + Prisma                  | Zaakceptowany; wybór SQLite zastąpiony PostgreSQL      |
| [005](ADR-005-express-jedyny-serwer.md)      | Express jako jedyny serwer        | Zaakceptowany                                          |
| [006](ADR-006-https-transport.md)            | HTTPS przez reverse proxy         | Zaakceptowany; wyjątek awaryjny opisuje ADR-017        |
| [007](ADR-007-unified-pricing.md)            | Ujednolicony system cenników      | Zaakceptowany                                          |
| [008](ADR-008-frontend-modularyzacja.md)     | Modularyzacja frontendu           | Zaakceptowany; przeczytaj późniejsze doprecyzowanie    |
| [009](ADR-009-mapa-produktow.md)             | Mapa produktów studni             | Zaakceptowany                                          |
| [010](ADR-010-transport-zamowien.md)         | Transport zamówień studni         | Zaakceptowany                                          |
| [011](ADR-011-model-uprawnien-dokumentow.md) | Uprawnienia dokumentów            | Pierwotna polityka zrewidowana                         |
| [012](ADR-012-single-node-sqlite.md)         | Ograniczenia SQLite single-node   | Zastąpiony; historyczny                                |
| [013](ADR-013-paleta-kolorow.md)             | Paleta dark/light i WCAG          | Zaakceptowany                                          |
| [014](ADR-014-iframe-boundary.md)            | Granica iframe modułów SPA        | Zaakceptowany                                          |
| [015](ADR-015-sync-powiadomien.md)           | Synchronizacja powiadomień opieki | Zaakceptowany; część założeń o SQLite jest historyczna |
| [016](ADR-016-sla-per-zespol.md)             | Progi SLA per zespół/użytkownik   | Zaakceptowany                                          |
| [017](ADR-017-awaryjny-http-w-lan-za-vpn.md) | Awaryjny HTTP w LAN za VPN        | Zaakceptowany jako wyjątek operacyjny od ADR-006       |

## Aktualny kierunek

- Baza danych: PostgreSQL 18 — [`DATABASE.md`](../DATABASE.md).
- Serwer aplikacji: Express; frontend: Vanilla JS SPA — [ADR-005](ADR-005-express-jedyny-serwer.md) i [ADR-002](ADR-002-vanilla-js.md).
- Historia decyzji SQLite i Vite pozostaje dla kontekstu; nie jest instrukcją aktywnego runtime.
