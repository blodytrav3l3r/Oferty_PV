# Plan naprawy błędów po audycie projektu — 2026-07-22

## Cel

Doprowadzić projekt do stanu, w którym:

- backend przechodzi `typecheck`, `lint` i szybkie testy bez ukrytych błędów,
- frontend przechodzi `npm run typecheck:frontend`,
- testy nie maskują awarii domenowych jako ostrzeżeń,
- krytyczne błędy inicjalizacji i audytu nie są połykane po cichu,
- pliki tekstowe nie zawierają uszkodzonych znaków `U+FFFD`.

## Zakres

Plan obejmuje błędy wykryte w audycie wykonanym w repozytorium `I:\GitHub\Oferty_PV`.

Nie obejmuje:

- przebudowy architektury aplikacji,
- zmian wersji/release,
- ręcznej edycji parametrów cache-busting `?v=`,
- refaktoryzacji niezwiązanej bezpośrednio z błędami.

## Priorytety napraw

### P0 — błędy krytyczne

#### 1. Propagacja błędu braku admina

**Plik:** `src/middleware/auth.ts`

**Problem:** `ensureAdminExists()` łapie błąd braku `DEFAULT_ADMIN_PASSWORD`, loguje go, ale nie przerywa startu aplikacji. `server.ts` może uruchomić serwer mimo braku konta administratora.

**Plan naprawy:**

1. W `ensureAdminExists()` po zalogowaniu błędu ponownie rzucić wyjątek.
2. W `server.ts` po błędzie `initApp()` zakończyć proces kodem `1`, zamiast kontynuować `app.listen()`.
3. Dodać lub zaktualizować test jednostkowy dla scenariusza braku `DEFAULT_ADMIN_PASSWORD`.

**Walidacja:**

- `npm.cmd run typecheck`
- test dla `ensureAdminExists()` / inicjalizacji aplikacji
- ręczna kontrola, że brak zmiennej środowiskowej blokuje start tylko wtedy, gdy admin nie istnieje

#### 2. Błąd runtime w nawigacji Excela

**Plik:** `public/js/studnie/excelCellNavigation.js`

**Problem:** w funkcji `_excelSkipDisabled()` druga pętla używa zmiennej `i` bez deklaracji.

**Plan naprawy:**

1. Dodać `let i` w drugiej pętli.
2. Uruchomić składniową walidację pliku.

**Walidacja:**

- `node -c public/js/studnie/excelCellNavigation.js`
- `npm.cmd run typecheck:frontend`

#### 3. Niedziałający zapis audit logów w testach

**Plik:** `src/services/auditService.ts`

**Problem:** testy emitują `prismaClient_1.default.$executeRaw is not a function`, co oznacza, że zapis audytu może być nieskuteczny przy mockowanym kliencie Prisma albo w określonych ścieżkach testowych.

**Plan naprawy:**

1. Sprawdzić mocki Prisma w testach zamówień.
2. Ujednolicić interfejs mocka tak, aby zawierał `$executeRaw` i `$queryRaw`.
3. Rozważyć wydzielenie zapisu audytu do metody łatwiejszej do mockowania.
4. Dodać asercję, że zapis audytu nie kończy się ukrytym błędem.

**Walidacja:**

- testy tras zamówień, które wywołują `logAudit()`
- `npm.cmd run test:quick`

### P1 — frontend typecheck

#### 4. Kolizje globalnego stanu między modułami Rury i Studnie

**Pliki:**

- `public/js/rury/orderEditMode.js`
- `public/js/rury/orderCrud.js`
- `public/js/rury/offerCrud.js`
- `public/js/studnie/globals.js`
- `public/js/studnie/orderCrud.js`

**Problem:** `typecheck:frontend` wykrywa redeklaracje globalnych nazw, m.in. `orderEditMode`, `pendingOrderCreationData`, `editingOfferCreatedByUserId`, `isSavingOffer`.

**Plan naprawy:**

1. Rozdzielić globalny stan po modułach:
    - `window.ruryOrderEditMode` / lokalny alias dla rur,
    - `window.studnieOrderEditMode` / lokalny alias dla studni.
2. Zachować kompatybilność dla istniejących wywołań, jeśli HTML lub starszy kod używa `window.orderEditMode`.
3. Dla zmiennych współdzielonych tylko w obrębie modułu dopisać prefiksy domenowe, np. `ruryPendingOrderCreationData`, `studniePendingOrderCreationData`.
4. Po zmianie wyszukać wszystkie użycia starych nazw i poprawić tylko powiązane ścieżki.

**Walidacja:**

- `npm.cmd run typecheck:frontend`
- `node -c` dla zmienionych plików JS
- szybki test ręczny: wejście w tryb edycji zamówienia dla rur i studni

#### 5. Nieznana funkcja parsera wklejania

**Plik:** `public/js/studnie/excelTableManager.js`

**Problem:** `_excelPasteCreateWells()` wywołuje `_excelParsePasteData()`, której TypeScript nie znajduje.

**Plan naprawy:**

1. Ustalić, czy funkcja istnieje pod inną nazwą lub w innym pliku.
2. Jeśli istnieje globalnie, jawnie zarejestrować ją na `window` i dodać lokalny dostęp zgodny z obecnym stylem projektu.
3. Jeśli nie istnieje, wydzielić parser z istniejącej logiki paste/copy i użyć go w jednym miejscu.

**Walidacja:**

- `node -c public/js/studnie/excelTableManager.js`
- test ręczny wklejania danych do pustego wiersza
- `npm.cmd run typecheck:frontend`

#### 6. Typy elementów DOM w zamówieniu rur

**Plik:** `public/js/rury/orderSummary.js`

**Problem:** przypisania do `.value` i `.onchange` są wykonywane na typie `Element`, przez co `typecheck:frontend` zgłasza błędy.

**Plan naprawy:**

1. Dodać lokalne sprawdzenia `instanceof HTMLInputElement`.
2. Przypisywać `String(totalPipeQty)` do `.value`.
3. Zachować obecną logikę aktualizacji ZT bez zmiany zachowania.

**Walidacja:**

- `node -c public/js/rury/orderSummary.js`
- `npm.cmd run typecheck:frontend`

#### 7. Miksiny `PVSalesUI` niewidoczne dla typecheck

**Plik:** `public/js/sales/pvSalesUi.js`

**Problem:** konstruktor wywołuje `this.init()`, ale metoda jest dodawana przez `Object.assign()` po deklaracji klasy.

**Plan naprawy:**

1. Dodać minimalną deklarację metody `init()` w klasie, która deleguje do prototypu po domiksowaniu, albo przebudować kolejność inicjalizacji.
2. Preferować rozwiązanie minimalne bez przepisywania całego modułu.
3. Sprawdzić, czy `pvSalesSearch.init()` nadal działa jako właściwa implementacja.

**Walidacja:**

- `npm.cmd run typecheck:frontend`
- test ręczny otwarcia Kartoteki

### P2 — testy i jakość sygnału

#### 8. Test masowej walidacji maskuje błędy domenowe

**Plik:** `tests/studnie/massiveValidation.test.ts`

**Problem:** raport wskazuje `232` przypadki bez wyniku i skuteczność `47%`, ale suite przechodzi, bo ostrzeżenia nie są asercjami.

**Plan naprawy:**

1. Ustalić próg akceptacji dla skuteczności solvera.
2. Zamienić krytyczne warunki z `console.warn()` + `expect(true).toBe(true)` na realne asercje.
3. Jeśli część przypadków jest znana i akceptowalna, oznaczyć je jawnie jako `expectedFailure`.
4. Dodać krótkie podsumowanie w teście, które rozróżnia ostrzeżenia od błędów blokujących.

**Walidacja:**

- `npm.cmd run test:quick`
- ewentualnie osobny test `npx jest tests/studnie/massiveValidation.test.ts --no-coverage`

#### 9. Wyciek uchwytów po testach

**Pliki do sprawdzenia:**

- `src/utils/cronService.ts`
- `tests/telemetryRoutes.test.ts`
- testy inicjalizujące aplikację Express

**Problem:** Jest raportuje worker, który nie wyszedł czysto. Najbardziej prawdopodobne źródło to timery/cron bez pełnego teardown.

**Plan naprawy:**

1. Uruchomić testy z `--detectOpenHandles`.
2. Sprawdzić, które timery pozostają aktywne.
3. Dodać `unref()` dla timerów cyklicznych, jeśli nie powinny trzymać procesu.
4. Uzupełnić `afterEach()` / `afterAll()` o czyszczenie `cronService`.

**Walidacja:**

- `npm.cmd run test:quick -- --detectOpenHandles`
- `npm.cmd run test:quick`

### P3 — kodowanie i higiena

#### 10. Uszkodzone znaki `U+FFFD`

**Pliki:**

- `scripts/migrate-settings-to-tables.ts`
- `scripts/migration-validate.mjs`
- `scripts/reverse-migration-to-settings.mjs`
- pliki HTML w `coverage/`

**Problem:** `encoding:check` raportuje uszkodzone znaki. W `coverage/` są to artefakty, ale w `scripts/` to realne pliki źródłowe.

**Plan naprawy:**

1. Poprawić uszkodzone komentarze i komunikaty w trzech skryptach w `scripts/`.
2. Nie naprawiać ręcznie `coverage/`, jeśli katalog jest artefaktem generowanym.
3. Rozważyć wykluczenie `coverage/` ze sprawdzania encodingu, jeśli raport ma dotyczyć tylko źródeł.

**Walidacja:**

- `npm.cmd run encoding:check`
- `npm.cmd run typecheck`

#### 11. Nadmiarowe `innerHTML` i inline handlers

**Pliki do późniejszego audytu:**

- `public/js/shared/clientManager.js`
- `public/js/studnie/orderZleceniaForm.js`
- `public/js/studnie/wellTransitions.js`
- `public/js/shared/ui.js`

**Problem:** projekt używa dużo `innerHTML` i częściowo inline handlerów. Część jest bezpieczna dzięki `escapeHtml()`, ale są miejsca wymagające osobnego przeglądu XSS/CSP.

**Plan naprawy:**

1. Najpierw naprawić blokujące błędy P0/P1.
2. Następnie zrobić osobny audyt tylko pod XSS:
    - interpolacje do `innerHTML`,
    - inline `onclick`,
    - `opts.html` przekazywane do modal/overlay.
3. Dla dynamicznych danych użytkownika wymusić `escapeHtml()`.

**Walidacja:**

- wyszukiwanie `rg -n "innerHTML|insertAdjacentHTML|onclick=" public/js`
- testy ręczne formularzy z tekstem zawierającym znaki HTML

## Kolejność wykonania

1. Naprawić P0: admin startup, `excelCellNavigation`, audit mock/logowanie.
2. Uruchomić `npm.cmd run typecheck`, `node -c` dla zmienionych JS i wybrane testy.
3. Naprawić P1 do pełnego przejścia `npm.cmd run typecheck:frontend`.
4. Uruchomić pełne `npm.cmd run validate`.
5. Naprawić P2, aby testy nie maskowały realnych awarii.
6. Poprawić P3: encoding i audyt `innerHTML`.
7. Na końcu uruchomić `npm.cmd run format`.

## Komendy kontrolne

```powershell
npm.cmd run typecheck
npm.cmd run typecheck:frontend
npm.cmd run lint
npm.cmd run lint:frontend
npm.cmd run test:quick
npm.cmd run encoding:check
npm.cmd run format
```

## Kryteria zakończenia

- `npm.cmd run validate` kończy się sukcesem.
- `npm.cmd run encoding:check` nie raportuje uszkodzonych znaków w plikach źródłowych.
- Brak komunikatu Jest o wycieku uchwytów.
- Test masowej walidacji studni ma jawne progi sukcesu lub jawnie opisane oczekiwane wyjątki.
- Start produkcyjny nie kontynuuje pracy po krytycznym błędzie inicjalizacji.
