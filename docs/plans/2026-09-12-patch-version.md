# P1 PATCH — plan: `version` w każdej produkcyjnej ścieżce PATCH (bez implementacji)

**Status:** CLOSED (`e7170c6`). `version` warunkowo w 5 ścieżkach PATCH, N → 200 → N → 409, testy 42/42. Backend, `assertDocLock`, `baseUpdatedAt`, migracje nietknięte.
**Cel:** Production PATCH bez `version` = brak normalnej ścieżki frontendowej. Dwa równoległe PATCH-e na tej samej wersji → pierwszy 200, drugi 409, bez utraty pierwszej zmiany.
**Poza zakresem:** `assertDocLock`, `baseUpdatedAt`, `clientVersion=null` (kompatybilność), migracje DB, batch-PUT, rury PATCH (brak callerów — patrz §3).

## 1. Fakty (audyt)

- Serwer ma gotowy predykat (`studnieOrders.crud.ts:433-458`, rury `:316-333`); ślepa gałąź (`:459-468`) tylko przy braku `version` w body.
- Frontend NIGDY nie wysyła `version` w PATCH: `patchSingleOrderStudnie` (`orderHelpers.js:245`) buduje `{...fields, baseUpdatedAt}`; callery `:530/:1122` nie dają `version`; fallback `:1140`, opiekun `:offerUserManager.js:41,104`, kartoteka `:kartotekaActions.js:651` — też bez.
- Obiekty zamówień `version` POSIADAJĄ (mapowanie GET `studnieOrders.crud.ts:118`, odczyt PATCH `:375`) — nic nie trzeba dociągać z API.
- Ochrona dziś = tylko `baseUpdatedAt` (read-then-write, nieatomowy) → równoległe PATCH-e z tym samym base: oba 200, drugi nadpisuje pierwszego.

## 2. Zmiana (5 miejsc, frontend only)

1. `orderHelpers.js:245` — centralnie: `version: typeof order.version === 'number' ? order.version : undefined` (obie ścieżki `:530/:1122` za darmo; brak version = stare zachowanie, bez crashu).
2. `orderCrud.js:1140` fallback — ta sama jedna linijka (martwy kod dziś, ale nie zostawiamy ślepej ścieżki).
3. `offerUserManager.js:41,104` — `version: linkedOrder.version` (guard typeof jak wyżej).
4. `kartotekaActions.js:651` — `version: linkedOrder.version` (guard typeof).
5. Rury PATCH: brak callerów w `public/js/rury` (helper `dataService.patch` nieużywany) — bez zmian; endpoint zostaje dla kompatybilności.

## 3. Testy

- Zachować `stale version → 409` (istniejące).
- Nowy: `version=N` → PATCH#1 200 (version N+1) → PATCH#2 z `version=N` → **409 + dane == po PATCH#1** (brak utraty pierwszej zmiany). Po jednym dla studni i rury (rury na poziomie endpointu, skoro brak callerów).
- Nowy: `patchSingleOrderStudnie` wysyła `version` (frontend, wzorzec `orderSingleSave.test.ts`).
- Nie testować ślepej ścieżki jako poprawnej — `clientVersion=null` zostaje wyłącznie kompatybilnością.

## 4. Weryfikacja

`typecheck` + `typecheck:frontend` + `lint` + `lint:frontend` + `node -c` zmienionych JS + testy + `format`. Bez zmian wersji. Bez commita automatycznego.
