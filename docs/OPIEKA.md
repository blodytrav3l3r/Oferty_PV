# Opieka nad ofertą — hub

**Wersja:** 1.41.2
**Ostatnia aktualizacja:** 2026-10-11

> Warstwa opieki nad istniejącym modelem ofert, nie drugi CRM.
> SSoT danych: `offer_follow_ups` (append-only) + `offers_*.userId` via `ownership.ts`.

## Wizja: 1 proces / 3 zakresy

Jeden proces opieki (kontakt → wynik → następny termin albo wynik terminalny),
trzy zakresy widoczności wymuszane w SQL przed agregacją:

| Zakres | Kto       | Znaczenie                                       |
| ------ | --------- | ----------------------------------------------- |
| `mine` | każdy     | własne oferty                                   |
| `team` | pro/admin | własne + oferty przypisanych sub-userów         |
| `all`  | admin     | wszystko; nie-admin dostaje 403 (nie downgrade) |

Share = read-only. Szczegóły: `docs/security/permission-matrix.md`.

## Role

| Rola    | Opieka                                                              |
| ------- | ------------------------------------------------------------------- |
| `ADMIN` | pełny dostęp, wszystkie zakresy, lock force, reopen bez ograniczeń  |
| `PRO`   | własne + sub-userzy (`team`), zapis kontaktu na swoich/przypisanych |
| `USER`  | tylko własne (`mine`), zapis kontaktu na własnych                   |

Zapis wymaga `canWriteDoc` (owner / pro-parent / admin); rekord bez właściciela = fail-closed.
Odczyt: `canReadDoc` / `canReadWithShare`. Usuwanie: `canDeleteDoc`.

## Flow

```
Pulpit (widget: liczniki + top wiersze)
  → Kolejka (GET /api/care/queue: overdue → dziś → termin ASC)
    → Kontakt (POST /api/offers/:kind/:id/followups: kanał + rezultat + notatka + nextContactAt)
      → WON / LOST_* / ABANDONED (outcome terminalny; ponowne otwarcie tylko jawnym reopen)
```

- Status karty = **latest** follow-up wg `(contactedAt, createdAt, id)`, nie `MAX(nextContactAt)`.
- Jeden wpis terminalny zamyka cykl; `reopen: true` startuje nowy cykl (limit DB 1 terminal na cykl, wyścig → 409).
- Zdrowie liczone na żądanie (`getFollowUpState` / `calculateFollowUpHealth`, progi D+1/D+3/D+7/D+14), bez crona/maili w v1.
- Daty: frontend ISO z offsetem → backend UTC → DB UTC → porównania w UTC.

## Endpointy

| Metoda | Trasa                             | Rola                  |
| ------ | --------------------------------- | --------------------- |
| GET    | `/api/care/summary?scope=`        | read, scope wg roli   |
| GET    | `/api/care/queue?scope=&status=…` | read, scope wg roli   |
| POST   | `/api/offers/:kind/:id/followups` | write (`canWriteDoc`) |
| GET    | `/api/offers/:kind/:id/followups` | read (timeline)       |
| GET    | `/api/care/notifications`         | read, skrzynka self   |
| POST   | `/api/care/notifications/read`    | write, self-only      |

Autoryzacja: cookie `authToken` (HttpOnly). Pełna spec: Swagger `/api/docs`.

## Centrum powiadomień (kontrakt A+C, decyzja 2026-10-11)

Mailbox = zawsze `userId` zalogowanego. `list` i `markRead` filtrują po self
(`care.ts:591`, `careService.ts:888-923`); cudze id → 404 / `{read:0}`.
Parametr `mailboxUserId` usunięty (martwy, ryzyko confused-deputy); skrzynka zawsze self.

`repId` to filtr podglądu, nie zmiana właściciela skrzynki:

- Kolejka i pilność idą za repem (`repOwner` AND w scope, fail-closed 403).
- Centrum pokazuje własną skrzynkę; banner FE informuje o podglądzie repa.
- Sync z `repOwner` NIE dopisuje do własnej skrzynki (zero INSERT/DELETE
  na podstawie ofert repa). Pełny sync bez filtra robi INSERT + auto-read
    - retencję (90d / cap 500) jak dotąd (ADR-015).
- Retencja: bez zmian zachowania; działa wyłącznie w pełnym syncu.
  Punkt kontroli: sync z filtrem nie może mieć efektów ubocznych w DB.

## Fix F4-krytyczne

- F2 narrow: filtr terminów tylko in-scope (AND), brak wycieku między zakresami.
- F6 audyt: prev-przed-write (odczyt stanu przed zapisem terminalu).
- F7 cursor: nieprawidłowy cursor w kolejce → 400 (nie 500), bez wycieku scope.
- F4 perRep: raport per-rep bez wierszy NULL (JOIN po ownership, brak sierot w agregacji).
- F3 lost: status LOST tylko z jawnego outcome LOST_* (nie z braku kontaktu).

## Linki

- [API](API.md) — kontrakt endpointów (Swagger `/api/docs` autorytatywny)
- [SECURITY](SECURITY.md) — sesje, role, macierz ról × zakres (§15)
- [COMPONENTS](COMPONENTS.md) — katalog komponentów UI (panel/kolejka wg `UI_GUIDELINES.md`)
- [Macierz uprawnień](security/permission-matrix.md) — per-trasa, SSoT `ownership.ts`
- [DATABASE](DATABASE.md) — model `offer_follow_ups`
- Plany: [opieka-nad-oferta](plans/opieka-nad-oferta.md) (follow-up, DONE), [monitoring P0](plans/opieka-monitoring-przypomnienia-p0.md) (care read-only, P0 DONE)
