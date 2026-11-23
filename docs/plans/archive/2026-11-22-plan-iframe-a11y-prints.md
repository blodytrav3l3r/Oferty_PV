# Plan poprawy: iframe, dostępność i zgodność wydruków

## Primary goal

Użytkownicy mają otrzymywać przewidywalną nawigację między modułami, dostępne kluczowe przepływy aplikacji oraz ten sam poprawny dokument zlecenia niezależnie od wybranej drogi wydruku.

## Zakres i stan bazowy

Plan obejmuje wyłącznie trzy obszary wskazane w audycie: interfejs powłoka SPA–moduły iframe, dostępność kluczowych modułów i stanów oraz zgodność wydruków zleceń. Nie obejmuje usuwania iframe, przebudowy modułów, nowych funkcji biznesowych, zmian w licznikach bez osobnej diagnozy ani ogólnego refaktoru.

Audyt był statyczny. Nie uruchamiano testów ani aplikacji i nie sprawdzano urządzeń produkcyjnych. Przed implementacją wykonawca ponownie sprawdzi bieżący kod, testy, branch i dokumentację, ponieważ ten plan nie zastępuje dowodu z runtime.

## Faza 0 — odkrycie dokumentacji i istniejących kontraktów

**How this serves the primary goal:** wyznacza zachowania już wspierane przez aplikację i zapobiega przypadkowemu zastąpieniu działających interfejsów.

### Ustalenia z przeglądu

- ADR-014 zachowuje iframe same-origin i wymaga jawnego kontraktu; nie uzasadnia migracji całej komunikacji na `postMessage` ani usunięcia ramek.
- `SpaRouterApi` jest zadeklarowany w `public/js/types.d.ts:128-159`. Istniejące wywołania obejmują m.in. `showSection`, `navigate`, `openOfferInModule`, `refreshModule` i `refreshProductionOrders`.
- `public/js/spa/router.js:1172-1220` rozpoznaje konkretne API modułów potomnych podczas odświeżania. Kontrakt i deklaracje można rozszerzać tylko wtedy, gdy jest to konieczne i jawnie typowane. Test wzorcowy: `tests/frontend/iframeContract.test.ts:7-50`.
- Standardy a11y są zebrane w `docs/UI_GUIDELINES.md`, m.in. kontrast 4.5:1, focus widoczny, semantyczne kontrolki, etykiety i obsługa reduced motion.
- `tests/playwright/a11yAxe.spec.ts:5-195` używa `@axe-core/playwright`, lecz sprawdza wybrane widoki i stany. Playwright korzysta z własnego serwera i izolowanego PostgreSQL zgodnie z `docs/agents/testing.md` oraz `playwright.config.ts`.
- Wydruki kartoteki pobierają świeży zapisany rekord, a edytor zapisuje zmiany przed pobraniem i wydrukiem. Wzorce testowe: `tests/frontend/zleceniaPrintFresh.test.ts`, `tests/frontend/printManagerSaveBeforePrint.test.ts` oraz `tests/frontend/productionOrderCrossReferencesPrint.test.ts`.

### Dozwolone wzorce i antywzorce

- Korzystać z istniejących `SpaRouterApi`, typowanych kontraktów `__sok*`, `AxeBuilder`, Playwright oraz istniejących builderów dokumentów.
- Nie dodawać globali `window.*` ani nowych publicznych metod bez koniecznej decyzji projektowej, typowania i testu kontraktu.
- Nie zmieniać iframe na `postMessage`, nie dodawać `sandbox`, nie migrować Studni/Rur do nowego frameworka.
- Nie uznawać samego axe za pełny dowód dostępności; uwzględniać klawiaturę, focus, etykiety i stany interaktywne.
- Nie używać danych z listy jako awaryjnego źródła wydruku, jeśli nie udało się pobrać aktualnego zapisu serwerowego.
- Testy Playwright uruchamiać tylko wobec izolowanej bazy i serwera testowego, nigdy wobec danych użytkownika lub produkcji.

## Faza 1 — ograniczenie sprzężenia powłoki SPA z modułami

**How this serves the primary goal:** awaria lub zmiana jednego modułu będzie łatwiejsza do diagnozowania i mniej podatna na niezamierzone skutki w pozostałych modułach.

### Zadania

1. Zinwentaryzować wywołania routera do obiektów iframe, kolejność ładowania skryptów, interfejsy `__sok*` i wszystkie miejsca odświeżania/nawigacji. Każde użycie przypisać do konkretnego właściciela i testu.
2. Dla każdej funkcji kontraktu opisać parametry, wynik, warunek gotowości iframe, obsługę błędu i zachowanie przy braku API potomnego.
3. Zaprojektować minimalny, wewnętrzny adapter powłoki dla już istniejących metod modułów, tak by rozpoznawanie `AppZlecenia`, `AppKartoteka` i pozostałych globali nie było rozproszone po przepływach routera. Nie zmieniać publicznego zachowania ani nie dodawać nowego globalnego protokołu.
4. Utrzymać kontrakt `SpaRouterApi` i `__sok*` zgodny z ADR-014; zmiany typów, dokumentacji i testu kontraktowego wprowadzać w tym samym zakresie co implementację.
5. Rozszerzyć testy o brak API modułu, błąd odświeżenia, spóźnioną odpowiedź i szybkie przełączenie widoków. Sprawdzić, że błąd nie pokazuje pustej ramki jako udanego widoku i nie aktualizuje błędnego zaznaczenia nawigacji.

### Weryfikacja

- Testy `iframeContract`, `navGuard` oraz powiązane scenariusze Playwright.
- Przegląd statyczny: brak nowych nieopisanych globali; każde wywołanie child API ma właściciela i obsługę błędu.
- Test w przeglądarce dla nawigacji sukcesu, timeoutu, błędnego dokumentu, ponowienia i powrotu.

### Kryteria odbioru

- Powłoka nie zakłada gotowości modułu na podstawie samego upływu czasu.
- Nieudane odświeżenie modułu nie zostawia aplikacji w stanie fałszywego sukcesu.
- Istniejące deep-linki, guard niezapisanych zmian, cenniki oraz odświeżanie kartoteki i zleceń zachowują dotychczasowe działanie.

## Faza 2 — dostępność modułów i kluczowych stanów

**How this serves the primary goal:** użytkownicy klawiatury, technologii asystujących i różnych rozmiarów ekranu będą mogli wykonać te same kluczowe zadania bez pomijania błędów interfejsu.

### Zadania

1. Sporządzić macierz: moduł × rola/uprawnienia × stan. Objąć Pulpit/opiekę, Studnie, Rury, Kartotekę ofert, Zlecenia, Cennik oraz logowanie i wspólną nawigację.
2. Dla każdego modułu wskazać reprezentatywne ścieżki: widok początkowy, formularz edycji, modal, wyniki/wynik pusty, walidacja/błąd oraz stan ładowania. Role ograniczyć do faktycznie istniejących ról i uprawnień potwierdzonych w kodzie.
3. Rozszerzać `a11yAxe.spec.ts` etapami. Testy muszą wskazywać właściwy iframe i czekać na gotowy widok; użyć istniejących tagów `wcag2a` i `wcag2aa` oraz zachować blokowanie naruszeń serious/critical.
4. Dodać testy klawiatury i focusu tam, gdzie axe nie potwierdzi zachowania: wejście/wyjście z modalów, kolejność tabulacji, focus po błędzie walidacji, komunikaty live i działanie bez myszy.
5. Naprawiać wyłącznie naruszenia potwierdzone w objętych testem ścieżkach, zgodnie z tokenami oraz komponentami opisanymi w `docs/UI_GUIDELINES.md`. Zachować ochronę obszaru Excel.

### Weryfikacja

- Uruchamiać testy axe i klawiatury dla zmienionego modułu na izolowanym PostgreSQL.
- Użyć ręcznej checklisty z czytnikiem ekranu dla krytycznych przepływów i sprawdzić focus widoczny, kontrast, etykiety, nagłówki, błędy i reduced motion.
- Sprawdzić responsywność dla wymaganych szerokości, bez testowania samego DOM powłoki zamiast zawartości iframe.

### Kryteria odbioru

- Każdy moduł i reprezentatywny stan z macierzy ma automatyczny test albo jawnie opisaną ręczną kontrolę.
- Brak nowych naruszeń serious/critical axe w zatwierdzonych stanach.
- Kluczowe akcje da się wykonać z klawiatury, a focus pozostaje widoczny i logiczny.

## Faza 3 — spójność wydruku pojedynczego, wsadowego i z edytora

**How this serves the primary goal:** to samo zapisane zlecenie będzie miało zgodną treść na wydruku bez względu na sposób jego uruchomienia.

### Zadania

1. Zmapować pola dokumentu do źródła danych dla kartoteki (pojedynczo/wsadowo) i edytora (zapis → pobranie zapisu → wydruk). Rozdzielić różnice opakowania, tytułu i podziału stron od różnic w treści.
2. Ustalić kanoniczny wynik/mapowanie dla jednego zapisanego rekordu i używać istniejących builderów pojedynczych oraz wsadowych. Nie tworzyć osobnych reguł mapowania tych samych pól dla każdej ścieżki.
3. Uzupełnić testy tabelaryczne porównujące znormalizowaną treść stron: element i wymiary, kąty, uwagi, powiązane numery zleceń, powłoki/kinety, transport oraz dane nagłówka. Osobno porównać etykiety.
4. Pokryć przypadki błędne: błąd odczytu jednego rekordu blokuje cały wsad i wskazuje numer; błąd zapisu w edytorze blokuje wydruk; brakujące/niepoprawne dane nie są zastępowane kopią z pamięci.
5. Sprawdzić nazwy plików i podział wsadu jako metadane/obudowę dokumentu, nie jako treść rekordu.
6. Zachować obecne reguły liczników wydruków. Interpretacja `window.print()` i potwierdzenia dialogu systemowego nie powinna być zmieniana bez osobnej decyzji po ustaleniu ograniczeń przeglądarki.

### Weryfikacja

- Rozszerzyć `zleceniaPrintFresh.test.ts`, `printManagerSaveBeforePrint.test.ts` i `productionOrderCrossReferencesPrint.test.ts` zamiast duplikować istniejące testy.
- Wykonać przeglądarkowy test na bezpiecznych danych testowych: pojedynczy wydruk, batch z kilkoma różnymi elementami oraz wydruk po edycji i zapisie.
- Porównać tekst/strukturę wygenerowanych stron dla tego samego zapisanego zlecenia; odrębnie sprawdzić paginację i tytuły.

### Kryteria odbioru

- Dla tego samego zapisanego zlecenia treść pojedyncza, wsadowa i z edytora jest zgodna w polach domenowych.
- Wsadowy wydruk nie drukuje częściowego pakietu, jeśli pobranie choć jednego zlecenia się nie powiedzie.
- Wydruk z edytora odpowiada danym po udanym zapisie; błąd zapisu uniemożliwia druk.
- Brak zmiany semantyki liczników bez osobnego uzgodnienia.

## Faza 4 — integracja, przegląd i wydanie

**How this serves the primary goal:** potwierdza, że trzy usprawnienia współistnieją, a nie tylko przechodzą osobne testy.

### Zadania i weryfikacja

- Przegląd kodu i testów pod kątem ograniczenia zakresu, kontraktów iframe, prywatności danych testowych i dostępności.
- Uruchomić właściwe testy warstwowe po każdej fazie; pełną walidację uruchomić tylko wtedy, gdy łączny zakres okaże się przekrojowy lub wysokiego ryzyka, zgodnie z `docs/agents/testing.md`.
- W CI sprawdzić testy zmienionych modułów, accessibility, testy wydruków i wymagane bramy; status dla aktualnej gałęzi musi być sprawdzony, nie zakładany.
- Raport końcowy ma rozdzielić fakty z testów automatycznych, wyniki kontroli przeglądarkowej i nierozstrzygnięte ograniczenia środowiska.

### Kryteria odbioru

- Każda zmiana zachowania ma test regresyjny w tym samym zestawie zmian.
- Wszystkie kryteria faz 1–3 są spełnione; nie ma nieuzgodnionych zmian poza zakresem.
- Wynik CI i przeglądarkowej weryfikacji jest udokumentowany dla konkretnego commita.

## Poza zakresem

- Usunięcie iframe lub migracja całej komunikacji na `postMessage`.
- Przepisanie Studni, Rur lub Excela, zmiana funkcji domenowych i porządkowanie niezwiązanego kodu.
- Zmiana logiki liczników wydruków albo dodawanie nowych drukarek/formatów bez osobnego polecenia.
- Potwierdzanie gotowości produkcyjnej, backup/restore lub infrastruktury Linux — to osobny plan operacyjny.

## Decyzje wymagające zgody przed implementacją

- Ten plan nie jest zgodą na implementację; kontrakt autonomii wymaga osobnej zgody na paczkę P1/P2.
- Jeśli inwentaryzacja wykaże potrzebę nowego publicznego globalu/interfejsu iframe, usunięcia istniejącej metody, zmiany semantyki licznika lub rozszerzenia macierzy poza istniejące role, wykonawca ma opisać konkretną zmianę i jej skutek, a następnie uzyskać zgodę przed implementacją tego punktu.
