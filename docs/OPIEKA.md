# Opieka nad ofertą — hub

**Wersja:** 1.49.2
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

- Status karty = **latest** follow-up wg `(contactedAt DESC, createdAt DESC, id DESC)`, nie `MAX(nextContactAt)`.
  Fizycznie z tabeli `latest_followup` (triggery `trg_fu_latest_*`, P1) — ta sama reguła co CTE;
  `followUpStats`/`searchUtils` liczą latest niezależnie (osobny kontrakt).
- Jeden wpis terminalny zamyka cykl; `reopen: true` startuje nowy cykl (limit DB 1 terminal na cykl, wyścig → 409).
- Zdrowie liczone na żądanie (`getFollowUpState` / `calculateFollowUpHealth`, progi D+1/D+3/D+7/D+14), bez crona/maili w v1.
- Daty: frontend ISO z offsetem → backend UTC → DB UTC → porównania w UTC.

## Endpointy

| Metoda | Trasa                                   | Rola                                                      |
| ------ | --------------------------------------- | --------------------------------------------------------- |
| GET    | `/api/care/summary?scope=`              | read, scope wg roli                                       |
| GET    | `/api/care/queue?scope=&status=…`       | read, scope wg roli                                       |
| POST   | `/api/offers/:kind/:id/followups`       | write (`canWriteDoc`)                                     |
| GET    | `/api/offers/:kind/:id/followups`       | read (timeline)                                           |
| GET    | `/api/care/panel?scope=&repId=`         | read, mailbox `repOwner ?? self`                          |
| GET    | `/api/care/sla?scope=`                  | read, próg efektywny + `source`                           |
| PUT    | `/api/care/sla`                         | zapis progu (global admin; `team` pro/admin; `user` self) |
| POST   | `/api/care/:kind/:id/snooze`            | write (`canWriteDoc`), pauza                              |
| POST   | `/api/care/:kind/:id/done`              | write (`canWriteDoc`), zakończenie                        |
| POST   | `/api/care/:kind/:id/reopen`            | write (`canWriteDoc`), wznowienie                         |
| GET    | `/api/care/notifications?scope=&repId=` | read, mailbox `repOwner ?? self`, sync w scope            |
| POST   | `/api/care/notifications/read`          | write, self-only                                          |
| POST   | `/api/care/notifications/:id/read`      | write, self-only (cudze id → 404)                         |

Autoryzacja: cookie `authToken` (HttpOnly). Pełna spec: Swagger `/api/docs`.

## Payload kolejki i powiadomień (Obiekt/kontakt)

`GET /queue`, `GET /panel.queue`, `GET /notifications` zwracają pola
pochodne ze snapshotu `offers_*.data` (bez migracji, `json_extract`):

| Pole            | Źródło                                                       | Uwagi                                                 |
| --------------- | ------------------------------------------------------------ | ----------------------------------------------------- |
| `investName`    | kolumna, fallback `$.investName`, `$.budowa`                 | label UI `Obiekt`, `null` → wiersz ukryty             |
| `investAddress` | `$.investAddress`                                            | label `Adres`, `null` → wiersz ukryty                 |
| `contactPerson` | `$.contactPerson`, fallback `$.clientContacts[0].name`       | label `Kontakt`, escapowany                           |
| `phone`         | `$.clientPhone`, fallback `$.clientContacts[0].phone`        | link `tel:` po sanitacji cyfr/`+`, brak → brak linku  |
| `email`         | `$.clientEmail`, fallback `$.clientContacts[0].email`        | link `mailto:` po walidacji, brak → brak linku        |
| `clientNumber`  | kolumna `offers_*/clientNumber`                              | L2 kafelka, `null` → bez prefixu                      |
| `ownerName`     | `users` po `offers_*.userId` (imię+nazwisko, fallback login) | L4 centrum / linia staff kolejki, brak → ukryte       |
| `authorName`    | `$.createdByUserName` z bloba (oryginalny autor)             | tylko kolejka: `• Przygotował`, gdy ≠ opiekun         |
| `value`         | rury `$.totalBrutto`, studnie guard 0-kolumny jak kolejka    | L1 kafelka, format kolejki (`PLN`), brak → `0,00 PLN` |

Odłożenie (snooze): presety `+3d/+6d/+9d` + własna liczba dni (OK lub Enter),
limit 28 dni (`MAX_SNOOZE_DAYS`, BE zwraca 400 powyżej). Pauza blokuje cały
wiersz odłożeń. Undo podmienia akcje na `Odłożono o Xd` + `Cofnij` (reopen).

Karta kolejki i karta powiadomienia pokazują `Obiekt/Adres/Kontakt + tel:/mailto:`.
Dane w scope requesta (jak `clientName`); brak wiersza w blobie = `null`, nie 404.

## Centrum powiadomień (skrzynka za repem, decyzja 2026-10-11, zmiana kontraktu A+C)

Mailbox = `repOwner ?? user.id` (wybrany handlowiec albo własna).
`list` w `/panel` i `/notifications` czyta skrzynkę repa; `repId` waliduje
`resolveRepOwner` (user tylko siebie, pro siebie + subUsers, admin każdego,
fail-closed 403 — jak kolejka). ETag per mailbox (`getCareEtagInput` po repu).

Zasady bezpieczeństwa (I-003):

- Sync z `repOwner` NIE persistuje (zero INSERT/DELETE/retencji na cudzej
  skrzynki — podgląd nie brudzi; sprząta pełny sync właściciela).
- Zapis (`markRead` single/bulk) zawsze self-only (guard `WHERE userId`);
  cudza skrzynka w FE jest read-only (brak przycisków odczytu i „Wyczyść
  wszystko", BE i tak broni 404).

FE: banner `Skrzynka: {rep} (podgląd read-only)` albo `moja skrzynka`
przy własnej; akcje widoczne tylko dla własnej.

## Modal opieki z kafelka (bez nawigacji)

Przycisk Kontakt/Zadzwoń w kafelku kolejki otwiera ten sam modal co kartoteka
(`openCareContactModal` → `kartotekaFollowUp.openFollowUpModal` z ctx na
prototypie mixina i `opts {title: numer, onSaved: refresh kolejki}`).
Mixin woła sam siebie przez `this.*`, więc goły kontekst rzuca TypeError
i modal nie wstaje — ctx MUSI dziedziczyć z mixina. `onSaved` zwraca promis
pełnego reloadu panelu (ETag zawiera `MAX(contactedAt)`, więc dane wracają
świeże). Furtka do pełnej kartoteki zostaje w menu ⋮ (`careOpenContact`,
handoff `?kontakt=` + sessionStorage).

## Odświeżanie centrum po zmianie repa

Zmiana repa ZMIENIA treść Centrum (skrzynka repa). Jak odróżnić brak
odświeżania od słusznie niezmienionej treści:

- Network: nowy fetch `/api/care/panel?...&repId={nowy}` (klucz ETag per rep
  i per mailbox) + `notifications.mailboxUserId = {nowy}` w body.
- Banner `.care-notif-preview` z nazwą skrzynki; `#care-sync-text` z nowym czasem.
- Stary banner albo `mailboxUserId` spoza repa = bug FE/BE.
- Cudza skrzynka: brak przycisków odczytu (read-only); własna: akcje widoczne.

## Graf przepływu Centrum

```text
FE carePanel.js (polling 60 s, backoff do 300 s)
├─ loadCarePanel → loadPanelPacket: GET /panel?scope&repId
│    If-None-Match per scope|range|rep → 304 stale / 200 render
├─ fallback legacy: /summary + /queue + /notifications (wszystkie z repId)
├─ renderNotifications: badge ← unreadCount (cap 99+), banner ← careRep,
│    karty (max 20) + stopka `+N więcej` (hasOverflow) + POST :id/read → markRead(user.id)
└─ clearNotifications: POST /read {ids} + fallback pojedynczych
BE care.ts: /panel (ETag per mailbox `repOwner ?? user.id`, COUNT||MAX(rowid)
  shares w haśle) i /notifications (sync self-only + list per mailbox
  `repOwner ?? user.id`),
  POST /read bulk/single (guard WHERE userId)
SERWIS careService.ts: notifCandidates (latest z tabeli `latest_followup`
+ CASE ntype:
  SLA_BREACH / ESCALATION / CALLBACK_DUE) → sync (INSERT OR IGNORE
  + auto-read + retencja 90d/500; z repOwner no-op; throttle 60 s per
  skrzynka od P0.3 — rerun w oknie zwraca `skipped: 'throttled'`)
  → list/markRead self
DB care_notifications(id, userId, offerKind, offerId, type, readAt, createdAt)
```

Znane rysy (nie bugi krytyczne): treść Centrum zależy od repa (mailbox
`repOwner ?? self`, kontrakt A+C); guard `panelLoading` gubi szybkie podwójne
kliknięcia; wyjątek w `renderSummary/renderQueue` blokuje `renderNotifications`;
ETag już unieważniają shares (COUNT + MAX(rowid) `document_shares`
w `getCareEtagInput`, `careService.ts:495-538`) — ślepa została edycja
follow-up w miejscu (POST bez dotknięcia znaczników ETag a/b).
Cap przepełnienia tylko prezentacja (R2, VERIFIED 2026-10-12): BE tnie listę,
licznik cały — `hasOverflow` w `/panel` (`care.ts:269`) i `/notifications`
(`care.ts:614`), FE badge `99+` + stopka `+N więcej`
(`carePanel.js:294-299,443-451`); retencja/sync bez zmian.
Marker `m` ETag (R3, VERIFIED 2026-10-12): `MAX(updatedAt)` follow-upów
(`careService.ts:524-551`, guarded — legacy DB daje `m=null` bez wywalania
ETag); POST/PUT bumpują `updatedAt` (`followUps.ts:108-119`) — edycja w miejscu
unieważnia 304, test w `careEtagOwner.test.ts`.

## Progi SLA (F8: default 24/7/72)

Brak wiersza `care_sla_config.global` = progi domyślne (`firstContactH: 24`,
`staleD: 7`, `escalationH: 72`) — opieka działa na pustej bazie. Uszkodzony
wiersz (wartość `< 1` lub nieliczbowa) = głośny błąd `INVALID_SLA_CONFIG`
(500), nie ciche maskowanie. Zapis przez `PUT /api/care/sla` waliduje zakresy
(Zod `min(1)`).

Próg efektywny (ADR-016, `getEffectiveSla` w `careService.ts:734-748`):
scope `team` u pro/admin bierze wiersz `('team', user.id)`, scope `mine`
bierze `('user', user.id)`, inaczej global. `GET /sla?scope=` i `GET /panel`
zwracają `source: global | team | user` (UI pokazuje, co edytuje).
Eskalacja i progi naruszeń liczone z progu efektywnego w scope requeścia
(CASE w `notifCandidates`: SLA_BREACH przed ESCALATION). Buckety zdrowia
stałe, niezależne od progu (`src/utils/careStatus.ts:40-46`): D+1 (`OVERDUE_D1`
do 2 dób), D+3 (`OVERDUE_D3` do 6 dób), D+7 (`OVERDUE_D7` do 13 dób),
D+14 (`OVERDUE_D14` powyżej).

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
- Plany: [opieka-nad-oferta](plans/archive/opieka-nad-oferta.md) (follow-up, DONE), [monitoring P0](plans/opieka-monitoring-przypomnienia-p0.md) (care read-only, P0 DONE)
