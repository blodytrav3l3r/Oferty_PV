# S.O.K. — przewodnik po modułach i potwierdzonych przepływach

## Metadane

- **Status:** przewodnik oparty na kodzie UI, route’ach, dokumentacji i testach dostępnych na poprzednim HEAD; bieżąca zgodność modułów wymaga pełnej weryfikacji względem aktualnego UI/E2E.
- **HEAD poprzedniej weryfikacji treści:** `5ab15ac077d8eb94e66bcb08bac9d3c19d09f53f`.
- **Data poprzedniej weryfikacji treści:** 2026-11-06. Przewodnik nie został ponownie zweryfikowany w całości na HEAD `fe8bbb3bcba36304e355d37051e4afb310c1f143`.
- **Klasyfikacja:** `FACT` — potwierdzone w kodzie/teście/dokumentacji; `INFERENCE` — wniosek z faktów; `UNKNOWN` — brak wystarczającego dowodu.
- **Zakres:** sześć modułów SPA. Dokument nie zastępuje walidatorów, uprawnień backendu, zasad cenników ani procedur operacyjnych.

## Jak czytać ten przewodnik

Moduły są dostępne w powłoce SPA `app.html`; router tworzy dla nich iframe. Frontend pobiera dane przez API Express, a nie bezpośrednio z PostgreSQL. Źródła: [mapa runtime](../architecture/runtime-and-module-map.md), [frontend.md](../agents/frontend.md#L5-L9), [ADR-014 — granica iframe](../adr/ADR-014-iframe-boundary.md#L20-L45).

**Nie wszystkie moduły są dostępne dla każdej roli.** Poniżej role podaję tylko tam, gdzie potwierdza je middleware lub jawna kontrola UI. Samo ukrycie przycisku nie jest autoryzacją; uprawnienia endpointu rozstrzyga backend.

## Sugestie adresów w przeglądarce

S.O.K. ustawia `autocomplete="off"` dla pól firmy i adresów oraz dla kontrolek dodawanych dynamicznie. Przeglądarka może tę wskazówkę zignorować, a pytania o zapis adresu pochodzą z jej własnych ustawień. Aby wyłączyć zapisywanie i podpowiadanie adresów, zmień ustawienia profilu przeglądarki:

- **Chrome:** Ustawienia → Autouzupełnianie i hasła → Adresy i inne; wyłącz zapisywanie i uzupełnianie adresów. [Pomoc Chrome](https://support.google.com/chrome/answer/142893)
- **Microsoft Edge:** Ustawienia → Hasła i autouzupełnianie → Adresy i inne; wyłącz zapisywanie i uzupełnianie adresów. [Pomoc Edge](https://support.microsoft.com/en-us/edge/get-started-with-autofill-microsoft-edge)
- **Brave:** Ustawienia → Autofill and passwords → Addresses and more; wyłącz zapisywanie i uzupełnianie adresów. [Pomoc Brave](https://support.brave.app/hc/en-us/articles/360017906292-How-do-I-manage-autofill-settings)
- **Firefox:** Ustawienia → Prywatność i bezpieczeństwo → Adresy i inne; wyłącz zapisywanie i uzupełnianie adresów. [Pomoc Firefox](https://support.mozilla.org/en-US/kb/automatically-fill-your-address-web-forms)
- **Safari na Macu:** Safari → Ustawienia → Autouzupełnianie; wyłącz używanie danych z Kontaktów i pozostałe niepotrzebne opcje. [Podręcznik Safari](https://support.apple.com/guide/safari/ibrwa005/mac)
- **Safari na iPhonie/iPadzie:** Ustawienia → Aplikacje → Safari → Autouzupełnianie; wyłącz używanie danych kontaktowych i pozostałe niepotrzebne opcje. [Podręcznik iPhone’a](https://support.apple.com/guide/iphone/fill-in-forms-iphccfb450b7/ios)

Nazwy i położenie ustawień mogą się różnić zależnie od wersji i języka przeglądarki. Zmiana dotyczy całego profilu, nie tylko S.O.K. Wcześniej zapisane adresy pozostają w przeglądarce i trzeba je usunąć osobno w jej ustawieniach.

## Rury — `#/rury`

**Cel — FACT.** Moduł prowadzi kreator oferty rur, udostępnia sekcje oferty i cennika. HTML pokazuje kreator kroków 1–5 oraz sekcje builder, oferta i cennik: [rury.html](../../public/rury.html#L108-L145), [partials/rury/wizard-nav.html](../../public/partials/rury/wizard-nav.html#L1-L28).

**Potwierdzone funkcje.** Kod ładuje i zapisuje produkty/cennik, oferty i zamówienia rur; istnieje eksport PDF/DOCX oferty oraz eksport dokumentów zamówienia: [dataService.js](../../public/js/rury/dataService.js#L127-L222), [offerCrud.js](../../public/js/rury/offerCrud.js#L48-L160), [orderCrud.js](../../public/js/rury/orderCrud.js#L7-L21), [offerPrintManager.js](../../public/js/rury/offerPrintManager.js#L143-L161).

**Główne dane/API — FACT.** Cennik produktów: `/api/products`; oferty: `/api/offers-rury`; zamówienia: `/api/orders-rury`. Przykładowe trasy PDF/DOCX oferty są w managerze wydruku. Rejestracja API: [mountRoutes.ts](../../src/mountRoutes.ts#L109-L118), [offerPrintManager.js](../../public/js/rury/offerPrintManager.js#L143-L161).

**Role — FACT.** Odczyt produktów i operacje ofert/zamówień wymagają zalogowanej sesji zgodnie z route’ami. Zapis cennika produktów rur jest ograniczony do admina przez `requireAdmin`: [productsV2.ts](../../src/routes/productsV2.ts#L41-L85), [offers/crud.ts](../../src/routes/offers/crud.ts#L21-L35), [orders/ruryOrders.crud.ts](../../src/routes/orders/ruryOrders.crud.ts#L36-L48). **UNKNOWN:** szczegółowa matryca praw dla wszystkich działań kreatora nie jest tu enumerowana.

**Potwierdzony przepływ.** Kreator ma kroki 1–5; kod zapisu oferty jest w `saveOffer()`, a zapis zamówienia w `saveRuryOrder()`. Zakres pól i wymagane wartości wynikają z UI oraz walidacji, więc przewodnik nie dopowiada formularzowych kroków: [rury.html](../../public/rury.html#L127-L137), [offerCrud.js](../../public/js/rury/offerCrud.js#L48-L160), [orderCrud.js](../../public/js/rury/orderCrud.js#L291-L343).

**Ograniczenia i diagnostyka.** Cennik jest chronioną edycją admina. Moduł rur nie ma produkcyjnych zleceń PZ — jest to jawnie odnotowane w instrukcji frontendowej. Błąd ładowania danych cennika/ofert jest logowany przez `dataService`: [frontend.md](../agents/frontend.md#L45-L58), [dataService.js](../../public/js/rury/dataService.js#L127-L213).

**Testy źródłowe.** `tests/offers/ruryCrud.test.ts:1`, `tests/orders/ruryOrders.crud.test.ts:1`, `tests/ruryOrderExport.test.ts:1`, `tests/frontend/ruryWizardSingleAdvance.test.ts:1`, `tests/frontend/ruryProductHelpers.test.ts:1`.

## Studnie — `#/studnie`

**Cel — FACT.** Moduł udostępnia kreator studni z krokami: Dane klienta, Parametry studni, Oferta, Karta budowy i Zamówienie, a także sekcję cennika: [studnie.html](../../public/studnie.html#L188-L211), [studnie.html](../../public/studnie.html#L283-L306).

**Potwierdzone funkcje.** Konfiguracja studni i jej wizualizacja; odczyt/zapis ofert; odczyt/zapis cennika studni i PRECO; operacje na zleceniach produkcyjnych; edytor tabelaryczny Excel. Istnienie konfiguratora, podglądu, oferty, karty i zamówienia w UI potwierdza HTML. API/helpers: [offerApi.js](../../public/js/studnie/offerApi.js#L71-L107), [offerSave.js](../../public/js/studnie/offerSave.js#L120-L150), [uiHelpers.js](../../public/js/studnie/uiHelpers.js#L538-L657), [orderZleceniaData.js](../../public/js/studnie/orderZleceniaData.js#L8-L24).

**Główne dane/API — FACT.** Produkty studni: `/api/products-studnie`; PRECO: `/api/preco-pricing`; oferty: `/api/offers-studnie`; zamówienia studni: `/api/orders-studnie`; zlecenia produkcyjne: `/api/orders-studnie/production`. Rejestracja: [mountRoutes.ts](../../src/mountRoutes.ts#L110-L149); użycie w UI: [uiHelpers.js](../../public/js/studnie/uiHelpers.js#L538-L657), [offerApi.js](../../public/js/studnie/offerApi.js#L71-L107), [orderZleceniaData.js](../../public/js/studnie/orderZleceniaData.js#L8-L24).

**Role — FACT.** API oferty i zamówień wymaga uwierzytelnienia. Zapisy cennika studni i PRECO oraz operacje na wersjach cenników wymagają admina; odczyt pozycji cennika przez ofertę jest dostępny dla zalogowanej sesji. Źródła: [productsStudnieV2.ts](../../src/routes/productsStudnieV2.ts#L203-L250), [precoPricingV2.ts](../../src/routes/precoPricingV2.ts#L43-L88), [pricelistVersions.ts](../../src/routes/pricelistVersions.ts#L723-L736), [studnieCrud.ts](../../src/routes/offers/studnieCrud.ts#L312-L323).

**Potwierdzony przepływ.** UI pokazuje pięć kroków kreatora; warstwa zapisu oferty jest w `saveOfferStudnie()`. Szczegółowa kolejność wprowadzania danych nie jest tu opisywana poza nazwami kroków widocznymi w kodzie: [studnie.html](../../public/studnie.html#L188-L211), [offerSave.js](../../public/js/studnie/offerSave.js#L120-L150).

**Ograniczenia i diagnostyka.** Wiersze konfiguracji mogą mieć status ERROR/WARNING. Usunięcie oferty, zamówienia albo elementu powiązanego z produkcyjnym zleceniem PZ może zostać zablokowane odpowiedzią 403; opisany jest również pre-check UI. Edytor Excel jest chronionym obszarem — nie należy stosować ogólnego refaktoru bez testów wskazanych w regułach projektu: [offerHelpers.js](../../public/js/studnie/offerHelpers.js#L20-L45), [productionOrderGuard.ts](../../src/utils/productionOrderGuard.ts#L1-L43), [pzGuard.js](../../public/js/studnie/pzGuard.js#L1-L105), [frontend.md — Excel](../agents/frontend.md#L60-L83).

**Testy źródłowe.** `tests/offers/studnieCrud.test.ts:1`, `tests/orders/studnieSingleSave.test.ts:1`, `tests/studnie/excelDrilledRings.test.ts:1`, `tests/studnie/excelUndoLifecycle.test.ts:1`, `tests/studnie/excelRefreshContract.test.ts:1`, `tests/playwright/excelVisualGate.cjs:1`.

## Kartoteka — `#/kartoteka`

**Cel — FACT.** Kartoteka wyszukuje i wyświetla oferty oraz powiązane informacje o zamówieniach. Widok zawiera filtry dat/użytkownika, wyszukiwanie lokalne po tekście, listę ofert i toolbar import/eksport: [kartoteka.html](../../public/kartoteka.html#L162-L165), [kartoteka.html](../../public/kartoteka.html#L296-L406).

**Potwierdzone funkcje.** Wyszukiwanie po tekście, typie, zakresie dat, użytkowniku, statusie zamówienia i filtrze follow-up; dalsze strony wyników; otwieranie oferty/zamówienia i widok historii/audytu istnieją w kodzie UI: [kartotekaSearch.js](../../public/js/kartoteka/kartotekaSearch.js#L86-L154), [kartotekaActions.js](../../public/js/kartoteka/kartotekaActions.js#L150-L214), [kartotekaAudit.js](../../public/js/kartoteka/kartotekaAudit.js#L206-L269).

**Główne dane/API — FACT.** Wyniki ofert: `/api/offers/search`; szczegóły/relacje ofert i zamówień są pobierane przez odpowiednie prefiksy `/api/offers-*` i `/api/orders-*`; historia przez `/api/audit`; obsługa follow-up korzysta z `/api/offers-rury/.../followups` i `/api/care/...`. Import/eksport jest inicjalizowany z toolbaru kartoteki. Źródła: [kartotekaSearch.js](../../public/js/kartoteka/kartotekaSearch.js#L116-L190), [kartotekaActions.js](../../public/js/kartoteka/kartotekaActions.js#L52-L86), [kartotekaFollowUp.js](../../public/js/kartoteka/kartotekaFollowUp.js#L118-L175), [kartotekaAudit.js](../../public/js/kartoteka/kartotekaAudit.js#L206-L269), [kartotekaInit.js](../../public/js/kartoteka/kartotekaInit.js#L88-L96).

**Role — FACT.** Wyszukiwanie i odczyt historii wymagają uwierzytelnienia. Dostęp follow-up może zależeć od zakresu roli po stronie backendu. Flaga `feature_import_export_enabled` steruje modułem import/eksport; nie zakładaj, że toolbar będzie włączony w każdym środowisku: [search.ts](../../src/routes/offers/search.ts#L1-L35), [audit.ts](../../src/routes/audit.ts#L59-L75), [dashboard.js](../../public/js/shared/dashboard.js#L343-L380), [frontend.md — import/eksport](../agents/frontend.md#L84-L89).

**Potwierdzony przepływ.** Stan filtrów trafia do parametrów wyszukiwania, a kartoteka wykonuje request do `/api/offers/search`; wyniki są renderowane w liście. Dla filtra „Z zamówieniem” kod celowo pomija filtr dat — to zachowanie należy uwzględnić przy interpretacji wyników: [kartotekaSearch.js](../../public/js/kartoteka/kartotekaSearch.js#L74-L115), [kartotekaSearch.js](../../public/js/kartoteka/kartotekaSearch.js#L154-L190).

**Ograniczenia i diagnostyka.** Pierwsze zapytanie używa limitu 50 i może zwracać dalsze strony. Błąd HTTP 429 jest obsługiwany przez komunikat/licznik ponowienia; pozostałe błędy API pokazują stan błędu listy. Brak wyników nie oznacza błędu serwera: [kartotekaSearch.js](../../public/js/kartoteka/kartotekaSearch.js#L116-L169), [kartotekaSearch.js](../../public/js/kartoteka/kartotekaSearch.js#L182-L234), [kartotekaSearch.js](../../public/js/kartoteka/kartotekaSearch.js#L344-L371).

**Testy źródłowe.** `tests/sales/kartotekaFilter.test.ts:1`, `tests/kartoteka/kartotekaFilterOrders.test.ts:1`, `tests/kartoteka/followUpSubmit.test.ts:1`, `tests/kartoteka/followUpEdit.test.ts:1`, `tests/offers/followUpSearchRoute.test.ts:1`.

## Zlecenia — `#/zlecenia`

**Cel — FACT.** Ten moduł jest kartoteką zleceń produkcyjnych studni (PZ), nie ogólnym spisem wszystkich zamówień rur i studni. Strona nazywa się „Kartoteka Zleceń”, a wyszukiwanie używa `/api/orders-studnie/production/search`: [zlecenia.html](../../public/zlecenia.html#L7-L8), [zlecenia.js](../../public/js/spa/zlecenia.js#L244-L280).

**Potwierdzone funkcje.** Filtry dat, użytkownika, numeru zlecenia i numeru zamówienia; sortowanie, lista wyników, zaznaczanie wielu pozycji, liczniki wydruków, usuwanie pojedyncze i zbiorcze. Kod edycji otwiera moduł studni z parametrami edycji: [zlecenia.html](../../public/zlecenia.html#L158-L266), [zlecenia.html](../../public/zlecenia.html#L313-L397), [zlecenia.js](../../public/js/spa/zlecenia.js#L244-L339), [zlecenia.js](../../public/js/spa/zlecenia.js#L872-L1009).

**Główne dane/API — FACT.** Wyszukiwanie: `/api/orders-studnie/production/search`; odczyt użytkowników do filtra: `/api/users-for-assignment`; usuwanie pojedyncze/zbiorcze i liczniki wydruków używają `/api/orders-studnie/production/...`: [zlecenia.js](../../public/js/spa/zlecenia.js#L279-L280), [zlecenia.js](../../public/js/spa/zlecenia.js#L425-L425), [zlecenia.js](../../public/js/spa/zlecenia.js#L630-L642), [zlecenia.js](../../public/js/spa/zlecenia.js#L896-L965).

**Role — FACT.** Wyszukiwanie, edycja i usuwanie produkcyjnych zleceń wymaga zalogowanej sesji na route’ach backendu. W sprawdzonych trasach nie potwierdzono wymogu roli admin dla podstawowych operacji PZ. Źródła: [productionSearch.ts](../../src/routes/orders/productionSearch.ts#L21-L28), [production.ts](../../src/routes/orders/production.ts#L139-L145), [production.ts](../../src/routes/orders/production.ts#L975-L1048).

**Potwierdzony przepływ.** Przy inicjalizacji kod ustawia daty od/do na dziś, pobiera listę przez endpoint wyszukiwania, a akcja edycji zmienia hash na `#/studnie?...`: [zlecenia.js](../../public/js/spa/zlecenia.js#L50-L60), [zlecenia.js](../../public/js/spa/zlecenia.js#L92-L100), [zlecenia.js](../../public/js/spa/zlecenia.js#L279-L280), [zlecenia.js](../../public/js/spa/zlecenia.js#L1009-L1029).

**Ograniczenia i diagnostyka.** Wyniki są stronicowane; kod ładuje kolejne strony, gdy są dostępne. Usuwanie może zostać zablokowane dla PZ chronionych przez reguły produkcyjne; komunikat i warunki sprawdza backend — przy odmowie nie należy obchodzić blokady: [zlecenia.js](../../public/js/spa/zlecenia.js#L354-L416), [zlecenia.js](../../public/js/spa/zlecenia.js#L929-L1002), [production.ts](../../src/routes/orders/production.ts#L1031-L1085).

**Testy źródłowe.** `tests/frontend/zleceniaFilterAndActionBtn.test.ts:1`, `tests/frontend/zleceniaPrintCounts.test.ts:1`, `tests/productionSearchUtils.test.ts:1`, `tests/responsive/zlecenia.test.ts:1`.

## Cennik — `#/cennik`

**Cel — FACT.** Moduł hostuje widoki trzech typów cennika: **Rury**, **Studnie** i **PRECO**. Rury wyświetlają moduł rur; Studnie oraz PRECO korzystają z modułu studni, w którym PRECO jest osobną zakładką: [cennik.js](../../public/js/cennik/cennik.js#L5-L6), [cennik.js](../../public/js/cennik/cennik.js#L25-L26), [router.js](../../public/js/spa/router.js#L256-L259).

**Potwierdzone funkcje.** Przegląd/edycja danych cennika, eksport XLSX, wersje, szkice i przełączanie typu są widoczne w kodzie. Panel wersji zawiera operacje tworzenia szkicu, edycji, etykiety, porównania, zatwierdzania/aktywacji i eksportu; szczegóły tych akcji są admin-only w API: [pricelistVersions.ts](../../src/routes/pricelistVersions.ts#L112-L206), [pricelistVersions.ts](../../src/routes/pricelistVersions.ts#L299-L400), [pricelistVersions.ts](../../src/routes/pricelistVersions.ts#L428-L539), [pricelistVersions.ts](../../src/routes/pricelistVersions.ts#L655-L772).

**Główne dane/API — FACT.** Rury: `/api/products` i `/api/pricelist-versions`; Studnie: `/api/products-studnie` i `/api/pricelist-versions`; PRECO: `/api/preco-pricing` i `/api/pricelist-versions`. Cenniki ładowane do kalkulacji pobierane są jako aktywne: [dataService.js](../../public/js/rury/dataService.js#L127-L165), [pricelistInit.js](../../public/js/studnie/pricelistInit.js#L28-L40), [uiHelpers.js](../../public/js/studnie/uiHelpers.js#L538-L657), [mountRoutes.ts](../../src/mountRoutes.ts#L109-L150).

**Role — FACT.** Zapis edycji produktów rur, produktów studni i PRECO wymaga admina. Lista wersji, podsumowanie, tworzenie i modyfikowanie wersji oraz eksport wersji także mają `requireAdmin`; niektóre odczyty cenników/wierszy dla ofert są dostępne każdemu uwierzytelnionemu użytkownikowi. Źródła: [productsV2.ts](../../src/routes/productsV2.ts#L78-L85), [productsStudnieV2.ts](../../src/routes/productsStudnieV2.ts#L240-L248), [precoPricingV2.ts](../../src/routes/precoPricingV2.ts#L78-L88), [pricelistVersions.ts](../../src/routes/pricelistVersions.ts#L112-L120), [pricelistVersions.ts](../../src/routes/pricelistVersions.ts#L723-L736).

**Potwierdzony przepływ.** Typ cennika jest wybierany w szynie/panelu modułu; PRECO i Studnie współdzielą host studni, a wybór jest przekazywany do jego API UI. Nie opisuję dalszych kliknięć publikacji, ponieważ różne operacje wersji mają osobne warunki backendowe: [cennik.js](../../public/js/cennik/cennik.js#L178-L256), [router.js](../../public/js/spa/router.js#L790-L873).

**Ograniczenia i diagnostyka.** Operacje wersji i zapisy cenników są chronione rolą admin; API waliduje przejścia wersji i może odrzucić niedozwolony stan. Sama zmiana etykiety nie jest opisana jako zmiana numeru wersji — szczegóły tożsamości i numeracji określają testy/route’y wersji, nie etykieta w UI. Nie zmieniaj aktywności cennika ręcznie poza obsługiwanym panelem: [pricelistVersions.ts](../../src/routes/pricelistVersions.ts#L362-L400), [pricelistVersions.ts](../../src/routes/pricelistVersions.ts#L539-L655), [tests/pricelistVersions.labelOverride.test.ts](../../tests/pricelistVersions.labelOverride.test.ts#L1), [tests/pricelistVersions.state.test.ts](../../tests/pricelistVersions.state.test.ts#L1).

**Testy źródłowe.** `tests/pricelistVersions.approveRoute.test.ts:1`, `tests/pricelistVersions.cloneDraft.test.ts:1`, `tests/pricelistVersions.compare.test.ts:1`, `tests/pricelistVersions.exportShape.test.ts:1`, `tests/pricelistVersions.labelOverride.test.ts:1`, `tests/pricelistBootstrap.test.ts:1`, `tests/precoRangeValidation.test.ts:1`.

## Pulpit — `#/pulpit`

**Cel — FACT.** Pulpit jest główną stroną startową i osadzonym modułem `index.html?host=pulpit`. Wyświetla sekcje nawigacyjne, pracę/obsługę ofert, kolejkę opieki, powiadomienia, wskaźniki portfela i numery do odzysku; admin otrzymuje dodatkowe ustawienia systemowe i narzędzia administracyjne: [router.js](../../public/js/spa/router.js#L302-L310), [index.html](../../public/index.html#L321-L321), [index.html](../../public/index.html#L458-L620), [index.html](../../public/index.html#L694-L715).

**Potwierdzone funkcje.** Pulpit sprawdza sesję, pokazuje dane użytkownika, widgety opieki/follow-up, numery do odzysku, kafle wersji cenników admina i operacje administracyjne. UI zawiera również nawigację do pozostałych modułów: [dashboard.js](../../public/js/shared/dashboard.js#L440-L550), [dashboard.js](../../public/js/shared/dashboard.js#L270-L397), [index.html](../../public/index.html#L119-L158), [index.html](../../public/index.html#L821-L856).

**Główne dane/API — FACT.** Sesja: `/api/auth/me`; kolejka/powiadomienia/SLA: `/api/care`; statystyki follow-up: `/api/offers-rury/followups/stats`; numery do odzysku: `/api/orders-studnie/recycled`; admin: m.in. `/api/pricelist-versions/summary`, `/api/admin/sessions`, `/api/users`, `/api/settings/*`. Źródła: [dashboard.js](../../public/js/shared/dashboard.js#L253-L294), [dashboard.js](../../public/js/shared/dashboard.js#L343-L380), [dashboard.js](../../public/js/shared/dashboard.js#L477-L538), [mountRoutes.ts](../../src/mountRoutes.ts#L98-L157), [app.ts](../../src/app.ts#L209-L231).

**Role — FACT.** Pulpit wymaga aktywnej sesji. Sekcja `admin-panel`, kafle wersji i część funkcji ustawień są wyświetlane wyłącznie dla `user.role === 'admin'`; backend dodatkowo wymaga admina dla odpowiednich endpointów. Widget follow-up może ograniczyć zakres dozwolony dla roli — odmowa 403 czyści wskaźniki zamiast pozostawiać stare wartości: [dashboard.js](../../public/js/shared/dashboard.js#L477-L538), [dashboard.js](../../public/js/shared/dashboard.js#L343-L380), [pricelistVersions.ts](../../src/routes/pricelistVersions.ts#L289-L306), [admin.ts](../../src/routes/admin.ts#L16-L42).

**Potwierdzony przepływ.** Po uzyskaniu sesji pulpit renderuje użytkownika i ładuje widgety; w osadzonym trybie nawigacja ma zmieniać hash powłoki SPA. Szczegółowa obsługa poszczególnych kafli pozostaje w ich module: [dashboard.js](../../public/js/shared/dashboard.js#L209-L263), [dashboard.js](../../public/js/shared/dashboard.js#L440-L550), [dashboard.js](../../public/js/shared/dashboard.js#L144-L175).

**Ograniczenia i diagnostyka.** Kafelki cenników administratora są „fail-soft”: gdy API nie odpowie poprawnie, pozostają placeholdery. Brak aktywnej sesji kieruje do logowania; błąd przejściowy odczytu nie jest automatycznie dowodem wylogowania. Źródła: [dashboard.js](../../public/js/shared/dashboard.js#L209-L263), [dashboard.js](../../public/js/shared/dashboard.js#L493-L538).

**Testy źródłowe.** `tests/frontend/pulpitRoute.test.ts:1`, `tests/playwright/pulpit.spec.ts:1`, `tests/responsive/dashboard.test.ts:1`.

## Wspólne instrukcje i ograniczenia

- **Excel studni jest protected zone.** Zmiana w `excel*.js` wymaga jednej wąskiej poprawki, testów ukierunkowanych, E2E i ręcznej weryfikacji; bez ogólnego „cleanup”. Reguły edytora: [frontend.md](../agents/frontend.md#L60-L83), kontrakt UI: [UI_GUIDELINES.md](../UI_GUIDELINES.md#L345-L351).
- **Baza danych:** wszystkie serwerowe dane domenowe obsługuje PostgreSQL 18 przez Express/Prisma. Nie ma w tym przewodniku instrukcji łączenia aplikacji bezpośrednio z DB: [DATABASE.md](../DATABASE.md#L3-L25), [frontend.md](../agents/frontend.md#L7-L9).
- **Ceny i zapis ofert:** cena zapisana w ofercie nie zmienia się niejawnie; cena oferty pochodzi z wersji cennika przypiętej do oferty. Inwarianty: [SYSTEM_INVARIANTS.md](../SYSTEM_INVARIANTS.md#L7-L15), [SYSTEM_INVARIANTS.md](../SYSTEM_INVARIANTS.md#L161-L173).
- **Wszystkie moduły:** sesja wykorzystuje cookie `authToken` `HttpOnly`; przy braku ważnej sesji następuje przejście do logowania. Źródła: [auth.js](../../public/js/shared/auth.js#L3-L10), [router.js](../../public/js/spa/router.js#L895-L915).

## Otwarte niewiadome

- **UNKNOWN:** role i zakres danych mogą być węższe niż podstawowa wymagana sesja; trzeba sprawdzić middleware konkretnej ścieżki API.
- **UNKNOWN:** kompletne procedury użytkownika dla wszystkich formularzy, formatów wydruku i importów wymagają osobnych instrukcji opartych na pełnych testach UI/E2E.
- **UNKNOWN:** lista testów powyżej jest reprezentatywna, nie jest zapewnieniem pełnego pokrycia całego modułu.
