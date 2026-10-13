# CARE P0 — optymalizacja Opieki nad ofertami (plan wykonawczy)

Stan: P0.1 DONE. Decyzje: P0 etapami, P1 po bramce pomiarowej, 90D bez zmian,
throttle syncu w requeście (ADR-015), bez workera/crona/Postgresa.
Baza: `main` @ `4343551` (v1.43.0). Sasiedni SSoT: `opieka-monitoring-przypomnienia-p0.md`.

## P0.1-BASELINE — DONE (2026-10-14)

Metoda: syntetyczne SQLite (schemat 1:1 przez `prisma db push`, seed
deterministyczny mulberry32, ~1.5 follow-up/ofertę), pomiar per-op prosto
na `careService.ts` (ts-node, PrismaClient na pliku bench, user admin,
scope=all = worst case). Prod DB nietknięta. Skrypty w Temp (poza repo).

| op (mediana ms)         | 400 ofert | 5 000    | 20 000   | ekstrapolacja 1M (INFERENCE) |
| ----------------------- | --------- | -------- | -------- | ---------------------------- |
| `getCareEtagInput`      | 1         | 3        | 17       | ~0.9 s                       |
| `getCareSummary`        | 4         | 39       | 177      | ~9 s                         |
| `getCareQueue` p1       | 16        | 74       | 274      | ~14 s                        |
| `syncCareNotifications` | 8         | 85       | 355      | ~18 s                        |
| `listCareNotifications` | 1         | 1        | 1        | ~płasko (capped)             |
| **suma ≈ GET /panel**   | **~30**   | **~200** | **~824** | **~40 s**                    |

Wzrost w przybliżeniu liniowy (20k/400 = 50× danych → summary 44×, sync 44×,
queue 17×). Wniosek: przy 1M świeży `/panel` liczy się dziesiątkami sekund,
a polling × userzy × karty dokłada write-per-read na jednego writera SQLite.

Testy bazowe: `careSyncLoad` + `careEtagOwner` + `followUpQueueSql` — 21/21 PASS.

Evidence ledger:

| ID    | Twierdzenie                         | Dowód                                        | Status     |
| ----- | ----------------------------------- | -------------------------------------------- | ---------- |
| E-001 | Kolejka stronicowana keyset, 50/str | `careService.ts:90-113`, `carePanel.js:5`    | VERIFIED   |
| E-002 | Sync zapisuje na każdym odczycie    | `care.ts:241`, `careService.ts:1101-1156`    | VERIFIED   |
| E-003 | ETag MAX-storm przed 304            | `careService.ts:566-593`, bench etag 1→17 ms | VERIFIED   |
| E-004 | Skalowanie ~liniowe do 20k          | bench 400/5k/20k wyżej                       | VERIFIED   |
| E-005 | 1M = dziesiątki sekund/panel        | ekstrapolacja liniowa                        | HYPOTHESIS |

## P0.2-ETAG — DONE jako pomiar + macierz (bez zmian kodu prod)

Per-agregat na 20k (MAX a–m): wszystko ≤4 ms, covering index
(`idx_followups_offer_contacted`, `idx_offers_updated`, …); łącznie 17 ms
= 2 roundtripy + JS. Wniosek: agregaty tanie dzięki indeksom — brak
optymalizacji kodu (rozdzielenie zapytania `m` to celowy guard legacy DB).
Macierz unieważnień zablokowana testem `careEtagMarkers.test.ts` (5/5):
nowy follow-up→a/b/m, snooze→c, sync→d, odczyt→e, cudzy odczyt nie rusza
mojego e, nowa oferta→f, edycja→j, share→l, SLA→h.

## P0.3-SYNC-THROTTLE — DONE

Throttle per skrzynka w requeście (`CARE_SYNC_THROTTLE_MS = 60 s`,
`careService.ts`): serializacja współbieżnych + skip świeżo po udanym
syncu (`skipped: 'throttled'`), fail nie stempluje, rep-preview omija.
Efekt na 20k: `sync_hot` 362 ms → 0 ms (3/3 runy). FE: suffix dopiski
tylko dla `rep-preview`. Testy `careSyncLoad.test.ts` 5/5 (3 nowe,
RED-dyskryminacja strukturalna: stary kod nie ma ścieżki `throttled`).
Tradeoff: świeżość powiadomień ≤60 s (suplement ADR-015 w P0.5).

## P0.4-QUEUE — DONE (count), enrich SKIP z pomiaru

Count przepisany bez CTE `latest` (oferty + care_states, ten sam predykat
pauzy): 232 ms → 3 ms na 20k (~77×), `totalCount` dokładny — zero zmian
kontraktu (brak `hasMore`, FE/API nietknięte). Testy parzystości
mine/all/hidePaused w `followUpQueueSql.test.ts` (16/16).
Enrich `json_extract` po LIMIT: pomiar na kopii z `data=NULL` dał tylko
~14% (191 vs 222 ms) — dominuje sort okna, nie enrich. SKIP (słaby
stosunek zysk/ryzyko kursora); sort okna to temat bramki P1.

## P0.5-VERIFY (następny)

## P0.3-SYNC-THROTTLE

Throttle per skrzynka w requeście (ADR-015, Suplement z datą). Definicje:
fail ≠ done (retry dozwolony), współbieżność (single-flight), restart
(zapomnienie znacznika = pełny sync, bezpieczne), rep-preview bez zmian.
NO-GO: zgubione powiadomienie / race / zapis do cudzej skrzynki.

## P0.4-QUEUE

Enrich `json_extract` po LIMIT (2 fazy, ta sama kolejność + cursor +
scope). Capped `totalCount` + `hasMore` dopiero po audycie konsumentów
(API.md + Swagger). NO-GO: rozjazd summary/kolejka, zmiana kursora,
cap prezentowany jako dokładny total.

## P0.5-VERIFY

`version:check` + `validate` + `format`, docs (`OPIEKA.md`, suplement
ADR-015, `API.md`, `DATABASE.md`, `PERF_BASELINE.md`), raport przed/po,
osobna decyzja GO/NO-GO dla P1.

## Bramka P1

`latest_followup` + triggery oraz partial index tylko gdy benchmark po P0
wykaże dominujący koszt CTE `latest` / konkretnego zapytania. Mapa zapisów
follow-upów: wyłącznie `followUps.ts:114,197,332,402` (brak bulk) — gotowe.
