# P1 reward ownership — read-only plan (bez implementacji)

**Status:** CLOSED (`2b9f9fe`). Gate REJECT na ownerze targetu (single 403, batch FORBIDDEN), ACCEPT/MODIFY bez zmian, testy 23/23. DB/frontend/allowlista nietknięte.
**Problem:** `POST /ai/reward` i `/ai/reward-batch` (`telemetryAiMl.ts:184,327`) etykietują DOWOLNE `wellId` — jedyny check to istnienie wiersza telemetry (`processRewardItem`, `:251`). Brak sprawdzenia właściciela studni/sugestii vs nagradzający. Allowlista filtruje trening po właścicielu TELEMETRII, nie po autorze rewardu — obcy reward ląduje w trenowanych etykietach ofiary.

## 1. Fakty (audyt ścieżek)

- Single: `processRewardItem(data, req.user.id)` → `applyRewardItem` → `rewardCalculator.processAction` (log pod `userId` nagradzającego) + dla MODIFY/REJECT: flaga + `updateLabelByTelemetry` na sugestii (`:285-314`). Cel: `parentConfigId` albo pierwsza sugestia AUTO studni — bez owner-check.
- Batch: ta sama `applyRewardItem` per item (`:360`) — jeden punkt zaczepienia kryje oba endpointy.
- Legitymne flow (frontend): nagradzający == edytujący własną/współdzieloną ofertę (`mlRewardHooks`, `offerSave`, `orderCrud`). Cross-user REJECT dziś: 0 wystąpień (REJECTED=0 w prod).
- `wellId` może mieć wiersze wielu właścicieli (oferta współdzielona edytowana przez kilka osób).

## 2. Invariant docelowy

> Silny negatyw (REJECT, −1.0) wystawia wyłącznie ktoś z prawem zapisu do właściciela etykietowanej sugestii (`canWriteDoc` na ownerze targetu). Samo istnienie `wellId` nie jest autoryzacją. ACCEPT/MODIFY bez zmian (słabe sygnały, istniejące wolumeny, model współpracy).

## 3. Proponowana zmiana (tylko backend, SSoT)

1. W `applyRewardItem`, TYLKO gałąź REJECT, PRZED jakimkolwiek zapisem (także przed `aiRewardLog`): wyznacz `targetId` dokładnie tą samą logiką co etykietowanie (`parentConfigId`, else pierwsza sugestia AUTO) i sprawdź `canWriteDoc` na właścicielu TEGO rekordu (z pobranego wiersza, bez ponownego odczytu). Brak prawa → status `forbidden` (single: 403, batch: `rejected[]` z `FORBIDDEN`, wzorzec `WELL_NOT_FOUND`). **Invariant: owner sprawdzany = owner rekordu modyfikowanego później przez `updateLabelByTelemetry`.** Brak targetu = dotychczasowe zachowanie (bez etykiety).
2. Reward-log (`processAction`) dla odrzuconych: NIE zapisywać (brak śladu gamifikacyjnego za odrzucony sygnał) albo zapisywać z `applied:false` — decyzja: nie zapisywać, spójnie z `well-not-found` (dziś też bez zapisu).
3. ACCEPT: bez zmian (sliding-AUC i liczniki działają jak dotąd).
4. Bez zmian: schemat DB, wagi, dedup, limity, frontend, allowlista, progi.

## 4. Granice i residual

- Współdzielenie edycji (model) zostaje: owner/pro-parent/admin przechodzą; share-recipient (tylko read) straci możliwość REJECT — akceptowane, REJECT i tak dziś nie występuje.
- Wiele właścicieli jednego `wellId`: gate na właścicielu KONKRETNEGO targetu (sugestii), nie całego wellId — precyzyjniejsze i węższe.
- Atak przez ACCEPT (sliding-AUC): poza zakresem (słaby sygnał, rollback i tak wymaga progu; osobny temat gdyby wolumeny urosły).

## 5. Testy (przyszłe)

- Obcy REJECT na cudzą sugestię → 403, brak flagi, brak `aiRewardLog`, brak zmiany `AiFeature`.
- Własny REJECT → 200 jak dziś; MODIFY/ACCEPT bez zmian.
- Batch mieszany: własny applied + cudzy `FORBIDDEN` w `rejected[]`.
- Istniejące `telemetryAiMl` zielone (mock właściciela = req.user).

## 6. Weryfikacja (przyszła)

`typecheck` + `lint` + testy + `format`. Bez zmian wersji. Bez commita automatycznego.
