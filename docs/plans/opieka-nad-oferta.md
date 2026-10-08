# Opieka nad ofertą — plan (NIE WYKONYWAĆ bez GO na kod)

Status: PLAN v2 po recenzji, implementacja czeka na GO per checkpoint (nie jeden GO na całość).
Decyzja architektoniczna: Kartoteka = centrum, Pulpit = agregat. Bez nowej głównej zakładki. Nazwa UI: „Opieka nad ofertą", widok: „Do kontaktu".

## 1. Evidence (FACT, zweryfikowane w kodzie)

| ID    | Twierdzenie                              | Dowód                                                                                                                                                            | Status   |
| ----- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| E-001 | Brak follow-up/reminder w DB/API/UI      | grep `followUp\|reminder\|nextContact` = 0 trafień domenowych; `schema.prisma` bez kolumn follow-up                                                              | VERIFIED |
| E-002 | Status karty derywowany, nie kolumna     | `src/utils/searchUtils.ts:189-208` (`WHERE EXISTS orders_*`), `public/kartoteka.html:200-221`, `kartotekaFilter.js:46-75`                                        | VERIFIED |
| E-003 | `state` oferty to tylko `draft\|final`   | `src/validators/offerSchemas.ts:71,147`, `ruryCrud.ts:104`, `crud.ts:56`                                                                                         | VERIFIED |
| E-004 | Relacja wygrana→zamówienie już istnieje  | `schema.prisma:382-412` (`orders_*_rel.offerId`), pozycje `:266-291`                                                                                             | VERIFIED |
| E-005 | Historia/audyt już istnieje              | kolumna `history` + `GET /api/audit/:type/:id` (`kartotekaAudit.js:206`, `kartotekaHistory.js:200-206`)                                                          | VERIFIED |
| E-006 | Notatki/kontakt w blobie + `clients_rel` | `src/types/offerData.ts:7-21,37-46`, `clients_rel.contact/phone/email` (`schema.prisma:250-264`)                                                                 | VERIFIED |
| E-007 | Standard kwot w projekcie to `Float`     | `schema.prisma` ~40× `Float` dla cen (`price`, `totalPrice`, `transportCost`), tech-debt Decimal odroczony (`docs/plans/archive/prisma-only-pricing.md:283-290`) | VERIFIED |

Wniosek: nowy moduł = warstwa nad istniejącym modelem, nie drugi CRM. Nie dublować ofert/klientów/zamówień/opiekunów.

## 2. Model danych (P0) — 1 tabela, enumy Prisma

```prisma
enum OfferFollowUpChannel { PHONE EMAIL SMS WHATSAPP MEETING OTHER }
enum OfferFollowUpResult { CONTACTED NO_ANSWER BUSY CALLBACK_REQUESTED WRONG_NUMBER }
enum OfferFollowUpOutcome { OPEN WON LOST_COMPETITION LOST_OTHER ABANDONED }

model OfferFollowUp {
  id              String               @id @default(cuid())
  offerKind       String               // "rury" | "studnie", walidacja w API (brak FK polimorficznego w SQLite)
  offerId         String
  createdByUserId String               // autor wpisu (nie mylić z opiekunem oferty — ownership istnieje osobno)
  createdAt       String?              // zapis rekordu, ISO-8601 UTC (konwencja projektu: daty jako String)
  contactedAt     String               // kiedy realnie nastąpił kontakt (może być wstecz: telefon 10:00, zapis 10:15)
  channel         OfferFollowUpChannel
  result          OfferFollowUpResult
  durationMin     Int?                 // Zod: int, 0..480
  note            String?
  nextContactAt   String?              // ISO-8601 UTC; frontend wysyła ISO z offsetem, backend normalizuje
  outcome         OfferFollowUpOutcome @default(OPEN)
  loseReason      String?
  competitor      String?
  competitorPrice Float?               // Float = standard projektu (E-007); Decimal to osobny tech-debt dla całości
  @@index([offerKind, offerId, contactedAt])
  @@index([createdByUserId, nextContactAt])
}
```

Semantyka `outcome` (maszyna stanów, kontrakt P0):

- `OPEN → WON | LOST_COMPETITION | LOST_OTHER | ABANDONED`; stany `WON/LOST_*/ABANDONED` = terminalne.
- Status karty = **`latest` follow-up wg `(contactedAt, createdAt)`** (nie `MAX(nextContactAt)` — to błąd: późniejszy zapis z wcześniejszą datą dałby zły termin). Jego `outcome` + jego `nextContactAt` + `EXISTS orders_*`.
- Ponowne otwarcie terminalnej = jawna akcja `reopen` (osobny wpis + audit), nigdy przypadkowy kolejny kontakt.
- Zamknięcie miękkie w v1: `loseReason` opcjonalne; od P2 twardy obowiązek przy `LOST_*`.

## 3. API (P0) — kontrakt

`POST /api/offers/:kind/:id/followups` (Zod strict, enumy jak wyżej):

1. validate `kind` ∈ {rury, studnie} → 400 przy innym,
2. load offer wg `kind` → 404 gdy brak / mismatch typu,
3. verify ownership/access (istniejący mechanizm, nie nowy) → 403,
4. `BEGIN: INSERT OfferFollowUp + INSERT audit; COMMIT` — atomowo, audit FAIL = całość FAIL,
5. odrzucenie zapisu na terminalnej bez flagi `reopen` → 409.

`GET /api/offers/:kind/:id/followups` — timeline (ta sama autoryzacja).
Rozszerzyć `GET /api/offers/search`: `followupStatus | overdueOnly | nextContactFrom/To`. Sort: `1. overdue 2. due today 3. nextContactAt ASC 4. latest activity DESC` (nie DESC — zaległości pierwsze).

## 4. UI (P1) — tylko Kartoteka + Pulpit

Kartoteka (`public/kartoteka.html`, `public/js/kartoteka/`):

- Filtr LOS obok istniejącego statusu zamówienia: `Wszystkie | Do kontaktu | W toku | Wygrane | Utracone`. `ORDER STATE ≠ SALES OUTCOME`, nie łączyć.
- Wiersz: badge losu + `przeterminowany N dni` + `Zapisz kontakt` (~30 s: kanał+rezultat+notatka+następny kontakt).
- Detail: sekcja `Opieka nad ofertą` + timeline (reuse `kartotekaHistory.js`).

Pulpit: widget `Opieka nad ofertami` — liczniki + top wiersze → `[Otwórz Kartotekę]`. P0 dostarcza tylko poprawne dane źródłowe; agregaty/KPI (konwersja, czas do 1. kontaktu, top konkurenci, utracona wartość) w P2/P3.

Wspólne: jedna funkcja domenowa `calculateFollowUpHealth(nextContactAt, now)` (progi D+1/D+3/D+7/D+14) używana przez API + Kartotekę + Pulpit. Bez crona/maili w v1 — zdrowie liczone na żądanie.

## 5. Czego NIE robić

Nowa główna zakładka; kolumna `status` na ofertach; osobne tabele per rury/studnie; drugi system opiekunów; UPDATE/DELETE historii; `Float→Decimal` tylko w tej tabeli (całość albo nic); nazwy `CRM/Follow-up/Leady` w UI; dashboard analytics w P0.

## 6. Bezpieczeństwo

Zod na wejściu (enumy, `durationMin` int 0..480, daty ISO), `escapeHtml` w timeline, ownership na poziomie oferty (opiekun swoje / kierownik+admin wszystkie), brak `reopen` bez uprawnień, rate-limit na POST, `node -c` + `typecheck` BE.

Timezone: frontend wysyła ISO z offsetem (`Europe/Warsaw`), backend normalizuje do UTC, DB UTC, porównania w UTC. Bez mieszania `browser local / server local / DB UTC` — wiszą na tym overdue i dashboard.

## 7. Testy (P0.8–P0.9, rozszerzone)

P0: migracja; POST rury; POST studnie; GET rury; GET studnie; ownership; unauthorized; nonexistent offer; kind-mismatch; invalid channel/outcome/nextContactAt; `durationMin` granice (-1, 3.5, 99999); XSS note; rate-limit; append-only (A+B równocześnie — oba zapisane); audit atomowy (audit FAIL = brak zapisu); reopen terminalnej bez flagi → 409; reopen z flagą → OPEN + audit.
Search: overdueOnly, nextContactFrom/To, followupStatus, ordering, brak follow-up, rury+studnie.
Regresja: istniejące search bez filtrów bez zmian; Kartoteka działa; statusy zamówień działają; endpointy ofert działają.

## 8. Checkpointy — osobne GO na każdy

- GO P0.1: snapshot + baseline (read-only, bez zmian).
- GO P0.2: schema + migracja `20261008000000_offer_follow_ups` + test migracji → commit. Model w schemacie: `offer_follow_ups` (konwencja małych nazw); daty String ISO-8601 UTC (konwencja projektu, nie DateTime).
- GO P0.3: POST/GET + walidacje + ownership + testy → commit.
- GO P0.4: audit atomowy + search + regresja → commit.
- GO P1: UI Kartoteki → commit. GO P2: widget Pulpit + twarde domknięcie. P3: analityka.

## 9. Następny krok

Czeka na GO P0.1. Push tylko za osobnym GO (Tier 🔴). Commit wyłącznie `node scripts/commit.mjs`.
