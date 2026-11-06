# Przepływy biznesowe ofert, cenników i wersji roboczych

- **Stan repozytorium:** `5ab15ac0`
- **Data audytu:** 2026-11-06
- **Klasy twierdzeń:** `FACT` = potwierdzone w bieżącym kodzie, testach lub dokumentacji; `INFERENCE` = wniosek z tych dowodów; `UNKNOWN` = zachowanie, którego nie da się potwierdzić z przejrzanych źródeł.

Ten przewodnik opisuje przepływ oferty Rury lub Studnie od wersji cennika przez zapis i powiązane zamówienie aż po eksport. Uzupełnia katalog endpointów w [`docs/API.md`](../API.md), inwarianty w [`docs/SYSTEM_INVARIANTS.md`](../SYSTEM_INVARIANTS.md) i zasady pakietu cenników instalacyjnych w [`docs/cutover/active-pricelists.md`](../cutover/active-pricelists.md). Nie jest specyfikacją kontraktów HTTP ani instrukcją administracji PostgreSQL.

## 1. Oferta i źródło cen

- **FACT:** Ceny używane do nowej oferty pochodzą z wersji cennika o stanie ACTIVE. Resolver wybiera zatwierdzoną wersję, której `effectiveFrom` nie jest późniejsze niż chwila odczytu; rozstrzyga po `effectiveFrom DESC`, następnie `seq DESC`. Brak aktywnej wersji daje brak wyniku, a błąd odczytu jest odróżniany od braku wersji (`src/services/pricelist/usage.ts:161-194,399-423`; `docs/SYSTEM_INVARIANTS.md:161-179`).
- **FACT:** `GET /api/products?source=active`, `GET /api/products-studnie?source=active` i `GET /api/preco-pricing?source=active` służą do odczytu aktywnego cennika dla kalkulatora; brak ACTIVE zwraca `409 NO_ACTIVE_VERSION`. Utworzenie nowej oferty bez ACTIVE także jest odrzucane; błąd odczytu cennika nie jest mapowany na „brak cennika” (`docs/API.md:191-210,219-236,423-425`; `tests/pricelistActiveSource.test.ts:320-329`).
- **FACT:** Widok edytora cennika ma inne zachowanie niż kalkulator: korzysta z kolejności DRAFT → ACTIVE → seed, a gdy w bazie nie ma wersji, może rozpocząć od danych fabrycznych. Zapis cennika trafia do wersji, zwykle do DRAFT; wskazanie `X-Pricelist-Version-Id` oznacza edycję jawnie wybranej wersji (`docs/API.md:191-210`; `src/routes/precoPricingV2.ts:41-78,86-124`).
- **FACT:** Cenniki Rury, Studnie i PRECO są wersjonowane. Dawne tabele LIVE i tabele `*_Default` są usunięte; `source=live` jest nieprawidłowe. PRECO ma własną trasę odczytu/zapisu i eksportu (`docs/API.md:191-210,219-236,423-448`; `src/routes/precoPricingV2.ts:41-78,86-124,149-220`).
- **INFERENCE:** PRECO jest osobnym składnikiem cennika Studnie wykorzystywanym przez kalkulację i może być eksportowany osobno lub razem z cennikiem studni. Zakres jego wpływu na konkretne pole ceny oferty należy weryfikować w dokumentacji domenowej kalkulatora; sam wykaz tras nie określa wzoru kalkulacji.

## 2. Zapis oferty i pochodzenie cen

- **FACT:** Oferty Rury i Studnie zapisują identyfikator użytej wersji w polu `pricelistVersionId`, poza głównym obiektem JSON oferty. Trasy usuwają wartość przesłaną w blobie i traktują kolumnę jako źródło prawdy (`src/routes/offers/ruryCrud.ts:395-405,459-504,742-750,836-879`; `src/routes/offers/studnieCrud.ts:831-834,887-904,1263-1267`).
- **FACT:** Tworzenie i aktualizacja ofert używają transakcji Prisma oraz zapisu z kontrolą wersji dokumentu. Ceny pieniężne zaokrąglane są przez `roundMoney`; wymaganie dla wszystkich kwot opisuje [`docs/MONEY_ROUNDING.md`](../MONEY_ROUNDING.md) (`src/routes/offers/ruryCrud.ts:459-533,836-920`; `src/routes/offers/studnieCrud.ts:914,1267`; `docs/SYSTEM_INVARIANTS.md:92-100`).
- **FACT:** Inwariant I-001 zabrania niejawnej zmiany zapisanej ceny przez odczyt, renderowanie, eksport lub zmianę cennika. I-009 wymaga zwiększenia wersji dokumentu po udanym zapisie; edycja z nieaktualną wersją nie może nadpisać nowszych danych (`docs/SYSTEM_INVARIANTS.md:7-14,92-100`; `tests/versionInvariant.test.ts:1`; `tests/offersContract.test.ts:1`).
- **FACT:** Istniejąca oferta zachowuje swoją pieczątkę wersji i zapisany snapshot cen; edycja nie wymaga, aby nowa aktywna wersja była dostępna. Jawne przeliczenie może awansować pieczątkę, ale tylko po walidacji wskazania bieżącej ACTIVE (`docs/SYSTEM_INVARIANTS.md:161-179`; `src/routes/offers/ruryCrud.ts:201-210,443-445,503-504,689-723,879`; `src/routes/offers/studnieCrud.ts:586-596,831-834,887-904,1025-1035,1123-1124,1263`).
- **FACT:** Duplikat oferty Rury tworzony jest jako szkic i kopiuje identyfikator cennika źródłowej oferty oraz zapisane wartości pozycji; wartości pieniężne są normalizowane przez `roundMoney` (`src/routes/offers/ruryCrud.ts:950-1059`).
- **INFERENCE:** Pieczątka identyfikuje pochodzenie cen, a nie zastępuje utrwalonych wartości oferty. Przy odtwarzaniu lub przenoszeniu danych trzeba zachować zarówno dokument i jego kwoty, jak i referencję do wersji, gdy istnieje.

## 3. Zamówienie i pieczątka cennika

- **FACT:** Zamówienia Rury i Studnie przechowują własne pole `pricelistVersionId`; przy tworzeniu jest ono wyznaczane na podstawie powiązanej oferty. Klient nie może narzucić pieczątki przez treść JSON zamówienia (`src/routes/orders/ruryOrders.crud.ts:70-98,206-272`; `src/routes/orders/studnieOrders.crud.ts:111-139,217-323`; `tests/orders/orderStamp.test.ts:153-193`).
- **FACT:** Aktualizacja istniejącego zamówienia bez pola pieczątki nie czyści zapisanej wartości; odpowiedni przypadek jest testowany (`tests/orders/orderStamp.test.ts:129-146`).
- **FACT — ważny fallback:** `loadOrderStamps` próbuje odczytać pieczątki powiązanych ofert. Jeśli odczyt pieczątki oferty się nie powiedzie, loguje błąd i wyznacza fallback z aktualnej aktywnej wersji. `stampForOrder` zwraca najpierw pieczątkę z mapy ofert, jeśli oferta została znaleziona; w przeciwnym razie zwraca fallback (`src/utils/orderStamp.ts:23-56`). To zachowanie nie dowodzi, że zapisane wartości zamówienia są przeliczane.
- **UNKNOWN:** Z przejrzanych tras i testów pieczątek nie wynika, czy każde pole cenowe zamówienia jest kopią oferty, czy może być później ręcznie zmieniane w interfejsie. Nie należy opisywać zamówień jako niezmiennych kopii wyceny bez osobnego audytu modelu i UI.

## 4. Excel, PDF, DOCX i wydruk łączony

- **FACT:** Eksporty pojedynczych ofert Rury i Studnie mają osobne trasy PDF i DOCX. Korzystają z generatorów dokumentów wskazujących ofertę po jej identyfikatorze (`src/routes/offers/exports.ts:17-58,74-116`). Inwariant I-008 wymaga zgodności wygenerowanego PDF ze snapshotem oferty (`docs/SYSTEM_INVARIANTS.md:83-90`).
- **FACT:** Wydruk łączony udostępnia osobne endpointy PDF i DOCX, które przekazują zwalidowane identyfikatory do generatorów (`src/routes/exportCombined.ts:61-105,136-154`; `src/services/combinedExport.ts:10-11`).
- **FACT:** Cenniki mogą być eksportowane do XLSX. Trasy obsługują eksport wersji aktywnej, szkicu lub danych fabrycznych; PRECO ma również wariant eksportu osobnego (`src/routes/productsV2.ts:158`; `src/routes/productsStudnieV2.ts:310`; `src/routes/precoPricingV2.ts:149-220`; `docs/API.md:219-236`). Interfejs transferu cenników informuje, że import/eksport działa na wersji zaznaczonej na osi; bez zaznaczenia wybiera szkic, a przy jego braku wersję obowiązującą (`public/js/shared/pricelistVersions.js:3371`).
- **FACT:** Import parserem XLSX cenników jest współdzielony przez przepływy Rury, Studnie i PRECO; walidacja oraz błędy importu mają testy parsera i UI (`public/js/shared/pricelistXlsx.js:2-7,117-140,213-230`; `tests/frontend/pricelistXlsx.test.ts:1,148,453`).
- **FACT:** Test ochrony przed formułami w eksporcie XLSX weryfikuje, że wartości wrażliwe nie stają się formułami (`tests/frontend/xlsxExportInjection.test.ts:2-4,29-35`).
- **INFERENCE:** Przed wydaniem należy traktować zgodność skoroszytów jako kontrakt: arkusze, nagłówki, typy komórek, reguły walidacji oraz bezpieczny zapis. Test parsera nie zastępuje testu zgodności kompletnego pliku z oczekiwanym wzorcem.

## 5. Aktywne cenniki przy instalacji i historyczne wersje

- **FACT:** Plik `data/pricelists/active-pricelists.json` zawiera po jednej zatwierdzonej aktywnej wersji Rury, Studnie i PRECO, wraz z pozycjami i koniecznymi aktywnymi override’ami. Nie obejmuje ofert, klientów, użytkowników ani historii wersji (`docs/cutover/active-pricelists.md:1-7`).
- **FACT:** Instalacja waliduje pakiet i jego SHA-256 przez `scripts/import-active-pricelists.ts`, po czym importuje cenniki; weryfikację wspiera `prices:verify` (`docs/cutover/active-pricelists.md:9-34`).
- **FACT:** Runtime wybiera wersję aktywną według statusu zatwierdzenia, czasu obowiązywania oraz numeru sekwencji, a więc repozytorium instalacyjne nie jest pełnym archiwum wersji (`src/services/pricelist/usage.ts:161-194`; `docs/cutover/active-pricelists.md:4-7`).
- **INFERENCE:** Nowa instalacja otrzymuje wyłącznie cenniki dostarczone w pakiecie. Nie odtworzy wcześniejszych historycznych wersji ani ofert, chyba że zostaną zaimportowane osobnym zatwierdzonym procesem danych.
- **UNKNOWN:** Sam przewodnik pakietu nie określa retencji historycznych wersji w działającej bazie, ich polityki archiwizacji ani procedury przywrócenia po awarii. Ustala to dokumentacja operacyjna i backup/restore.

## 6. Drafty, autosave i synchronizacja

- **FACT:** Draft jest roboczą kopią per użytkownik, kluczowaną przez `(userId, kind, docId)`; nie jest zapisem samej oferty ani zamówienia. Dostęp do draftu ogranicza identyfikator użytkownika z sesji (`src/services/drafts/draftService.ts:2-13,68-80`; `src/routes/drafts.ts:10,40-52`).
- **FACT:** Pierwszy zapis draftu może utworzyć wersję 1. Nadpisanie istniejącego wymaga `If-Match`; zapis używa compare-and-swap na `version`. Brak warunku daje `428 DRAFT_PRECONDITION_REQUIRED`, niezgodna wersja daje `409 DRAFT_CONFLICT`, a aktualizacja nieudana nie jest przedstawiana jako sukces (`src/services/drafts/draftService.ts:144-233`; `src/routes/drafts.ts:68-155`; `docs/SYSTEM_INVARIANTS.md:134-158`).
- **FACT:** Odpowiedź odczytu zwraca `ETag` z wersją. Drafty mają limit rozmiaru i limit liczby na użytkownika; wygasłe dane są usuwane przy odczycie/listowaniu lub przez housekeeping (`src/routes/drafts.ts:68-107,135-149`; `src/services/drafts/draftService.ts:54-80,144-177,247-255`).
- **FACT:** Konflikt synchronizacji nie powinien usuwać lokalnej kopii ani po cichu nadpisywać dokumentu; UI ma wymagać jawnego wyboru przy odzyskiwaniu (`docs/SYSTEM_INVARIANTS.md:134-158`).

## 7. Przypadki brzegowe i reakcje

| Sytuacja                                                        | Potwierdzone zachowanie                                                    | Dowód                                                                                                                      |
| --------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Brak wersji ACTIVE przy odczycie cen lub tworzeniu nowej oferty | Jawny `409 NO_ACTIVE_VERSION`; bez powrotu do dawnego źródła LIVE.         | `docs/API.md:191-210`; `tests/pricelistActiveSource.test.ts:320-329`                                                       |
| Błąd odczytu cennika                                            | Odrębny `503 PRICELIST_UNAVAILABLE`, nie pozorny brak ACTIVE.              | `docs/SYSTEM_INVARIANTS.md:173-175`; `src/services/pricelist/usage.ts:399-423`                                             |
| Edycja już zapisanej oferty, gdy nie ma nowej ACTIVE            | Zachowuje własną pieczątkę i snapshot; nowa ACTIVE nie jest wymagana.      | `docs/SYSTEM_INVARIANTS.md:166-168`; `src/routes/offers/ruryCrud.ts:443-445`; `src/routes/offers/studnieCrud.ts:1123-1124` |
| Konflikt wersji oferty                                          | Zapis nie może nadpisać nowszej wersji dokumentu.                          | `docs/SYSTEM_INVARIANTS.md:92-100`; `tests/versionInvariant.test.ts:1`                                                     |
| Nieaktualny/brak `If-Match` draftu                              | Jawny konflikt albo wymaganie warunku; brak cichego zapisu.                | `src/routes/drafts.ts:90-124`; `tests/drafts/draftsRoutes.test.ts:80-130`                                                  |
| Brak pieczątki powiązanej oferty przy tworzeniu zamówienia      | Resolver może użyć pieczątki aktualnej ACTIVE jako fallback.               | `src/utils/orderStamp.ts:42-56`                                                                                            |
| Wartość zaczynająca się od `=`, `+`, `-` lub `@` w XLSX         | Test sprawdza brak formuł w generowanym arkuszu.                           | `tests/frontend/xlsxExportInjection.test.ts:2-4,29-35`                                                                     |
| Instalacja na pustej bazie                                      | Pakiet dostarcza trzy bieżące wersje cenników, nie historię ani dokumenty. | `docs/cutover/active-pricelists.md:1-10`                                                                                   |

## 8. Istniejące testy regresji

Poniższe pliki testów są już w repozytorium; lista jest mapą do istniejących zabezpieczeń, nie stwierdzeniem, że każdy test wykonano w ramach tego audytu.

| Zakres                                                      | Istniejące testy                                                                                                                                                        |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ceny aktywne, brak ACTIVE, pieczątki ofert                  | `tests/pricelistActiveSource.test.ts:1`, `tests/offersPricelistStamp.test.ts:1`, `tests/pricelistVersions.publish.test.ts:1`                                            |
| Kontrakt zapisu ofert, wersjonowanie, ceny i kształt danych | `tests/offersContract.test.ts:1`, `tests/offers.crud.test.ts:1`, `tests/offerDecimalShape.test.ts:1`, `tests/versionInvariant.test.ts:1`                                |
| PRECO i eksport wersji cennika                              | `tests/pricelistVersions.precoResolver.test.ts:1`, `tests/pricelistVersions.exportShape.test.ts:1`, `tests/pricelistExportLive.test.ts:1`                               |
| Zamówienia i pieczątki                                      | `tests/orders/orderStamp.test.ts:1`, `tests/orders/ruryOrders.crud.test.ts:1`, `tests/orders/studnieSingleSave.test.ts:1`                                               |
| Wydruk łączony                                              | `tests/exportCombined.test.ts:1`, `tests/exportCombined.toctou.test.ts:1`, `tests/exportCombined.toctouRoute.test.ts:1`                                                 |
| Draft CAS, trasy i wyścigi odczytu                          | `tests/drafts/casConcurrency.test.ts:1`, `tests/drafts/draftsRoutes.test.ts:1`, `tests/drafts/draftReadRace.test.ts:1`, `tests/frontend/draftSync.test.ts:1`            |
| Import/eksport XLSX i bezpieczeństwo wartości               | `tests/frontend/pricelistXlsx.test.ts:1`, `tests/frontend/xlsxImportStrict.test.ts:1`, `tests/frontend/xlsxExportInjection.test.ts:1`, `tests/excelMigration.test.ts:1` |

## 9. Otwarte punkty dokumentacyjne

- **UNKNOWN:** Szczegółowy wzór wyceny Rury, Studnie i wpływ poszczególnych arkuszy PRECO nie zostały tu opisane; wymaga to audytu kalkulatorów frontendowych i ich testów parytetu.
- **UNKNOWN:** Polityka retencji historycznych wersji cenników i kompletna procedura odtworzenia cenników historycznych z kopii zapasowej nie wynika z pakietu instalacyjnego.
- **UNKNOWN:** Zakres ręcznej edycji kwot w zamówieniu oraz synchronizacja zmian oferty do już utworzonych zamówień wymagają osobnego audytu UI i reguł domenowych.
- **INFERENCE:** Ta dokumentacja powinna pozostać powiązana z inwariantami, testami PostgreSQL i procedurami backup/restore, aby zmiana instalatora lub schematu nie rozminęła się z procesem biznesowym.
