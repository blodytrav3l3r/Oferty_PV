# Kalkulacje ofert i Protected Zone Excela

- **Stan kodu:** HEAD `5ab15ac0`
- **Data przeglądu:** 2026-11-06
- **Zakres:** potwierdzone implementacją formuły Rury, Studnie/PRECO i transportu oraz chronione kontrakty tabeli Excel studni i importu/eksportu XLSX.
- **Status QA:** audyt źródeł i istniejących testów; testów nie uruchamiano w ramach przygotowania dokumentu.

`FACT` oznacza zachowanie widoczne w kodzie lub testach. `INFERENCE` to ostrożny wniosek z implementacji. `UNKNOWN` wskazuje brak wystarczającego dowodu albo brak potwierdzonej reguły biznesowej. Wzory poniżej opisują implementację, nie zatwierdzenie handlowej polityki cenowej.

## 1. Zaokrąglanie kwot

### Wejście i wynik

- **FACT:** frontend i backend udostępniają `roundMoney(value)`. Wartość jest konwertowana przez `Number`; `NaN`, nieskończoność i wartości niekonwertowalne dają `0`. Pozostałe kwoty są zaokrąglane do dwóch miejsc metodą half-up od zera; `Number.EPSILON` koryguje część błędów reprezentacji binarnej (`public/js/shared/formatters.js:17-22`; `src/utils/money.ts:15-22`).
- **FACT:** kalkulatory i zapis oferty używają tę funkcję jako SSoT; niektóre skrypty zawierają równoważny fallback wyłącznie dla sandboxów testowych bez załadowanego formattera (`public/js/studnie/actionsWellPricing.js:6-14`; `public/js/rury/transport.js:12-20`; `public/js/rury/offerCrud.js:6-14`; `public/js/studnie/offerPricingCalc.js:8-16`).
- **FACT:** testy kwot sprawdzają przypadki half-up, wartości niefinitywne, maksymalnie dwa miejsca i zgodność fallbacków (`tests/moneyRounding.test.ts:9-38`; `tests/frontend/moneyRounding.test.ts:23-78`).

### Kolejność ma znaczenie

- **FACT:** konkretne kalkulatory zaokrąglają w różnych punktach: niektóre zaokrąglają cenę pozycji przed mnożeniem przez ilość, inne zaokrąglają wynik pozycji, sumę, VAT i brutto osobno. Dalsze sekcje opisują wyłącznie kolejność widoczną w danej ścieżce.
- **UNKNOWN:** nie ma tu dowodu na jedną globalną regułę „zaokrąglaj wyłącznie na końcu”. Nie wolno jej dopisywać do opisów kalkulacji ani zmieniać kolejności bez testu parytetu.

## 2. Rury — pozycje i suma zapisywanej oferty

### Dane wejściowe i wynik zapisu

- **FACT:** `saveOffer()` wymaga numeru oferty i co najmniej jednej pozycji. Dla pozycji używa `unitPrice`, `discount`, `quantity` oraz wyniku `calculateTransportDistributionStandalone`; oblicza koszt kursu jako `transportKm × transportRate`, koszt łączny na podstawie liczby kursów, a przy `transportSeparate` dodaje koszt transportu jako osobną pozycję do netto (`public/js/rury/offerCrud.js:48-80`).
- **FACT — wzór tej ścieżki:** `lineNetto = roundMoney((unitPrice × (1 − discount / 100) + transportPerUnit) × quantity)`. `totalNetto` to suma zaokrąglonych wierszy; gdy transport osobny — dodatkowo `roundMoney(transportCost)`; następnie suma jest zaokrąglana ponownie. `totalBrutto = roundMoney(totalNetto × 1.23)` (`public/js/rury/offerCrud.js:63-80,133-140`).
- **FACT:** zapisana oferta przechowuje także pozycje wejściowe, `transportMode`, `transportSeparate`, `transportCount`, `transportCost`, `transportCostPerTrip`, `totalNetto` i `totalBrutto` (`public/js/rury/offerCrud.js:129-140`).
- **FACT:** testy pokrywają zapis CRUD, kontrolę wersji i duplikowanie; testy osobnej pozycji transportu sprawdzają jej tryb i eksportową prezentację (`tests/offers/ruryCrud.test.ts:111-119,222-274,389-462`; `tests/ruryTransportSeparate.test.ts:1-180`).

### Granica tego wzoru

- **FACT:** renderer oferty pokazuje cenę pozycji po rabacie z doliczonym `pehdCostPerUnit` i `surcharge`, a następnie transport jednostkowy (`public/js/rury/offerRendering.js:82-89`). Podsumowanie UI uwzględnia te same dwa składniki (`public/js/rury/transport.js:190-211`).
- **FACT:** wzór zapisu `saveOffer()` w wskazanym miejscu dodaje do `unitPrice` rabat i transport, ale nie dodaje jawnie `pehdCostPerUnit` ani `surcharge` (`public/js/rury/offerCrud.js:72-80`).
- **UNKNOWN — do rozstrzygnięcia przed zmianą kalkulatora:** z tych fragmentów nie wynika, czy upstream zapisuje te dopłaty już wewnątrz `unitPrice`, czy istnieje rozjazd między wyświetleniem a zapisem. Nie dokumentować ich jako składnika zapisanego netto bez sprawdzenia miejsca budowania i normalizacji `currentOfferItems` oraz testu end-to-end.
- **UNKNOWN:** testy zebrane w tym audycie nie udowadniają dokładnego parytetu między `saveOffer`, renderowaniem, PDF/DOCX i XLSX dla wszystkich kombinacji rabatu, PEHD, dopłaty i osobnego transportu.

## 3. Rury — liczba kursów i podział kosztu

### Dane wejściowe

- **FACT:** limit to `MAX_TRANSPORT_WEIGHT = 24000 kg` na kurs. Tryb `full` liczy pełne kursy; `fractional` zwraca proporcję masy do limitu (`public/js/shared/constants.js:3-19`).
- **FACT:** dla pozycji standardowej kalkulator używa bieżących z cennika masy i limitu sztuk na transport; długość niestandardowa korzysta z masy i limitu pozycji. ID PEHD-3MM/4MM mapowane są do bazowych ID. Pozycji automatycznych, o wadze ≤ 0 lub ilości ≤ 0 nie wlicza się do kursów (`public/js/rury/transport.js:296-325`).

### Tryb pełny

- **FACT — wzór implementacji:** `maxByWeight = floor(24000 / weightPerPiece)`; `maxByCount = product.transport || maxByWeight`; `maxPerTransport = min(maxByWeight, maxByCount)`. Dla danego produktu liczba dedykowanych kursów to `floor(quantity / maxPerTransport) + (remainder > 0 ? 1 : 0)` (`public/js/rury/transport.js:327-351`).
- **FACT:** częściowe kursy różnych produktów trafiają do wspólnej funkcji bin packing. Sortuje ona części malejąco po wadze i dodaje kolejne części, jeśli suma nie przekroczy 24 000 kg. Zaoszczędzone kursy odejmuje od sumy dedykowanych (`public/js/shared/constants.js:38-80`; `public/js/rury/transport.js:353-374`).
- **FACT:** koszt kursu wynosi `km × stawka/km`. Dla trybu pełnego koszt łączny opiera się na kursach po konsolidacji; wliczany transport rozdziela się na produkty proporcjonalnie do łącznej masy, a potem na sztuki. Każda stawka per szt. jest zaokrąglana przez `roundMoney` (`public/js/rury/transport.js:64-70,108-147`).

### Tryb ułamkowy i osobna pozycja

- **FACT:** ułamkowa liczba kursów to `suma masy / 24000`; wyliczony koszt jest dzielony według udziału masy, a następnie liczby sztuk (`public/js/rury/transport.js:116-133`; `public/js/shared/constants.js:12-18`).
- **FACT:** przy `transportSeparate=true` dystrybucja kosztu jednostkowego zwraca pusty obiekt. Koszt kursów powinien w tej ścieżce być doliczony osobno przez zapis/podsumowanie, a nie do cen jednostkowych (`public/js/rury/transport.js:108-113`; `public/js/rury/offerCrud.js:78-80`). Test sprawdza toggle i brak podziału przy osobnej pozycji (`tests/frontend/transportSeparate.test.ts:73-96`).
- **FACT:** eksporter HTML odtwarza flagi transportu oferty na czas przeliczenia, a potem przywraca stan runtime (`public/js/rury/transport.js:160-174`; `public/js/rury/offerExports.js:87-101`).
- **UNKNOWN:** fallback w zapisie, podsumowaniu UI i eksporterach przy wadze zerowej, cenie kursu ≤ 0 lub brakującym produkcie nie jest tu opisany jako równoważny we wszystkich trybach; ich konkretne gałęzie należy testować oddzielnie.

## 4. Studnie — cena komponentu, studni i oferty

### Cena składnika

- **FACT:** `getItemPriceBreakdown` dzieli cenę komponentu na bazę oraz jawnie liczone dopłaty. W zależności od elementu/konfiguracji dolicza PEHD, malowanie wewnętrzne i zewnętrzne, żelbet lub stal nierdzewną; wynik składników i ich sumy zaokrągla do dwóch miejsc (`public/js/studnie/actionsWellPricing.js:306-470`).
- **FACT:** cena bazowa elementu jest mnożona przez `1 − rabat/100`. Rabat wybierany jest według klasy komponentu, klasy obciążenia i hosta przejścia; E600/F900 bez jawnego wpisu dla danej klasy nie dziedziczy automatycznie rabatu D400. Testy pokazują te przypadki (`public/js/studnie/actionsWellPricing.js:49-75`; `tests/studnie/classDiscounts.test.ts:146-248,255-399`).
- **FACT:** dla kinety komponentu bazowego może wybrać się `cena1`, `cena2` lub `cena3` na podstawie zakresu wysokości dennicy; dopasowania są sprawdzane kolejno i zakresy obejmują granice (`public/js/studnie/actionsWellPricing.js:336-369`).
- **FACT:** dane wejściowe `calcWellStats(well)` obejmują konfigurację elementów, ilości, parametry studni, przejścia i rabaty. Funkcja sumuje ceny i masy elementów oraz liczy wysokość i pola używane w dalszych kalkulacjach (`public/js/studnie/actionsWellPricing.js:492-610`).
- **FACT:** przejścia mają rabat zależny od hosta. Dla przejść hostowanych przez krąg/krąg z otworem, które nie są `INSITU`, kalkulator może dobrać dopłatę wiercenia wg średnicy; dolicza też jawne `doplata`. W trybie zamrożonej ceny używa zapisanych cen przejścia/wiercenia (`public/js/studnie/actionsWellPricing.js:660-751`; parytet widoku: `tests/frontend/configPriceParity.test.ts:96-126`).

### Cena studni i sumy oferty

- **FACT:** `calcWellStats` zaokrągla wynik ceny, ceny bazowej i koszyków dennicy/nadbudowy na wyjściu. Jeśli PRECO zgłosi błąd, cena zwracana wynosi 0 wraz z polem `error`; konsumenci mogą pokazać błąd zamiast traktować go jako poprawną wycenę (`public/js/studnie/actionsWellPricing.js:735-756,906-930`; `tests/studnie/precoCalcError.test.ts:35-70`).
- **FACT:** `calculateOfferPricing` sumuje ceny i masy studni. Gdy oba parametry transportu są dodatnie, wyznacza koszt kursu jako `km × stawka`, liczbę kursów z masy i trybu oraz koszt łączny. W trybie edycji zamówienia korzysta z masy i trybu pierwotnej oferty, a następnie przypisuje jej koszt proporcjonalnie do aktualnej masy (`public/js/studnie/pricingCalculator.js:42-79`).
- **FACT:** wynik tej funkcji zawiera netto zaokrąglone na końcu, łączną masę, koszt transportu, dane studni do eksportu oraz flagę/identyfikatory studni z błędem wyceny (`public/js/studnie/pricingCalculator.js:42-58,165-207`).
- **UNKNOWN:** ta funkcja sama nie zwraca VAT ani brutto. Nie należy wyprowadzać ich stawki dla Studni z wzoru Rury bez sprawdzenia właściwego miejsca budowania oferty/eksportu.
- **FACT:** backend przy zapisie Studni wybiera wartość totalPrice według priorytetu `totalPrice → price → totalBrutto top-level → data.totalBrutto → data.totalPrice → 0`, a następnie stosuje `roundMoney` (`src/routes/offers/studnieCrud.ts:214-226`). Testy sprawdzają priorytet, kształt danych FE i brak/brudne wartości (`tests/offers/studnieTotalPrice.test.ts:7-24`).

## 5. Studnie — dodatki PRECO

### Wybór i suma

- **FACT:** `calcPrecoPricingPure(well, helpers)` potrzebuje tabeli PRECO dla DN studni i listy produktów Studnie. Brak całego obiektu PRECO zwraca pusty wynik; brak wpisu dla konkretnego DN ustawia błąd. Dla wkładki osadnika: `cenaDnoOsadnika + (wysokość_mm / 1000 × cenaPelnaWysMB)`; brak wymaganej ceny oznacza błąd (`public/js/studnie/precoCalcCore.js:90-145`; `tests/studnie/precoCalcError.test.ts:35-85`).
- **FACT:** w zwykłym trybie kalkulator usuwa przejścia bez rozpoznanej średnicy rury, klasyfikuje przepływ wg ręcznej flagi albo kąta (0°/360° = wylot, pozostałe = wlot), sortuje po średnicy malejąco z tie-breakiem kątem do 0/360 i wybiera dwa pierwsze jako główne; reszta to doloty (`public/js/studnie/precoCalcCore.js:152-224`).
- **FACT:** cena bazowa kinety wybierana jest z pierwszego wpisu kinety o DN ≥ największej średnicy głównej; jeżeli nie ma takiego wpisu, używany jest ostatni wpis. Skrzynki wchodzą od DN ≥ 500; ilość to `max(0, floor(DN/250) − 1)` pomnożone przez cenę skrzynki (`public/js/studnie/precoCalcCore.js:230-252,292-303`).
- **FACT:** dodatkowe koszty PRECO sumują dopłaty za kolejne wloty, zakresowe dopłaty spadku kinety i mufy, uniesienia, różnicę średnic redukcji, skrzynki oraz ewentualną wkładkę na pozostałą wysokość. Końcowe `suma` to suma tych pozycji i ceny bazowej (`public/js/studnie/precoCalcCore.js:255-479`).
- **FACT:** dopłaty z zakresów korzystają z pierwszego pasującego przedziału, z granicami włącznie. Jeżeli wartość przekracza maksymalny zakres, stosowany jest ostatni największy zakres; dobór grupy średnicy preferuje grupę obejmującą DN, a przy braku takiej — najbliższą większą (`public/js/studnie/precoCalcCore.js:3-49`).
- **FACT:** końcowa suma PRECO jest mnożona przez `1 − rabatPreco/100` i dodawana do koszyka ceny dennicy studni (`public/js/studnie/actionsWellPricing.js:708-734`). W tabeli pozycji oferta alokuje koszty bazowe PRECO do najniższej dennicy, a cenę liniową pełnej wkładki proporcjonalnie do części jej wysokości przypadającej na segment komponentu (`public/js/studnie/offerPricingCalc.js:121-169,171-218`).

### Przypadki brzegowe i zakres testów

- **FACT:** brak aktywnej ceny PRECO dla DN i niekompletny cennik osadnika nie mogą być cichym poprawnym `0 PLN`; kalkulator zwraca jawny błąd. Jest test pustego PRECO oraz kompletnego osadnika z wynikiem `920 + 0.5 × 1000 = 1420` (`tests/studnie/precoCalcError.test.ts:35-85`).
- **FACT:** zakresy z `max < min` lub `max = 0` są odrzucane; `min = max` może być poprawnym zakresem jednopunktowym, a rozłączne zakresy akceptowane (`tests/precoRangeValidation.test.ts:29-81`; walidacja UI: `tests/frontend/pricelistPrecoValidation.test.ts:53-126`).
- **UNKNOWN:** testy przywołane tutaj nie potwierdzają każdego wariantu hydraulicznego wyboru dwóch głównych wlotów, kaskady, uniesienia i redukcji względem reguł inżynierskich. Kod definiuje zachowanie programu; zgodność z zatwierdzonym cennikiem/specyfikacją produktu wymaga osobnych golden fixtures i akceptacji domenowej.

## 6. XLSX ofert i cenników

### Eksport oferty Rury

- **FACT:** `buildOfferXlsxRows()` buduje arkusz „Oferta” z danymi dokumentu, klienta, inwestycji, transportu, wierszami produktów oraz podsumowaniem netto, VAT 23%, brutto i masy (`public/js/rury/offerExportsHelpers.js:25-123`).
- **FACT:** w każdym wierszu eksportu ta funkcja liczy cenę po rabacie, dolicza `pehdCostPerUnit`, transport/szt, zaokrągla netto wiersza i brutto wiersza. Przy `transportSeparate` dodaje transport do sumy netto; podsumowanie VAT jest liczone od zaokrąglonego netto, a brutto jako netto plus zaokrąglony VAT (`public/js/rury/offerExportsHelpers.js:65-114`).
- **FACT:** ta kolejność różni się od widocznej ścieżki zapisu oferty w sekcji 2. Dostępne fragmenty nie rozstrzygają, czy różnica wynika z upstream wartości w `unitPrice`, więc nie wolno deklarować pełnego parytetu obliczeń zapisu i XLSX.

### Import cenników

- **FACT:** wspólny parser XLSX rozpoznaje opcjonalnie tylko pierwszy nie-techniczny arkusz dla Rury; dla Studni czyta wiele arkuszy. Nazwy zaczynające się od `_` są ignorowane. `PRECO_*` nie są pozycjami produktów; trafiają do osobnego `precoDataMap` tylko gdy caller jawnie włączy `includePreco` (`public/js/shared/pricelistXlsx.js:213-242`).
- **FACT:** parser mapuje nagłówki, normalizuje wiersze, konwertuje wartości numeryczne/boolean i raportuje błędy komórka/wiersz zamiast cichego pominięcia. Przykłady potwierdzają testy: pierwszy arkusz, `_Cennik`, łączenie DN*, PRECO jako osobny zestaw, puste arkusze i walidacja ID/nazwy (`public/js/shared/pricelistXlsx.js:84-211,213-242`; `tests/frontend/pricelistXlsx.test.ts:71-108,148-230,254-355,422-479`).
- **FACT:** eksport cennika studni może złączyć arkusze Studnie i PRECO z tego samego źródła; gdy PRECO brak, zostają arkusze Studni (`tests/pricelistExportLive.test.ts:196-258`; endpoint: `src/routes/productsStudnieV2.ts:310-394`).
- **FACT:** test XLSX security sprawdza, że wartości o prefiksach/formach formuł nie stają się formułami (`tests/frontend/xlsxExportInjection.test.ts:2-35`).
- **UNKNOWN:** nie opisano tu pełnej listy kolumn wszystkich arkuszy ofert i cenników. Kształt cenników wynika z parsera, projekcji serwera oraz plików fixture; nie używaj tego dokumentu jako specyfikacji szablonu XLSX.

## 7. Protected Zone Excel studni

### Dlaczego obszar jest chroniony

- **FACT:** reguły projektu kwalifikują moduły `excel*.js` jako Protected Zone. Zalecają jeden problem na diff, testy celowane, E2E i ręczną weryfikację; zabronione jest ogólne „sprzątanie Excela” (`docs/agents/frontend.md:19`).
- **FACT:** arkusz opiera tożsamość wiersza na `data-widx`; strukturalna zmiana musi resetować indeksy zależne od układu. Filtr ukrywa wiersze, które pomijają nawigacja/kopiowanie/wklejanie. Paste ma pracować cicho, wykonać jeden snapshot undo i jedną finalizację; błędy dopasowania są pokazywane w modalu, bez cichego auto-akceptowania (`docs/agents/frontend.md:60-82`; `public/js/studnie/excelCopyPaste.js:395-557`).
- **FACT:** nazwa studni nie jest kopiowana ani czyszczona, kolumny strukturalne są wyłączone z „zaznacz wszystko”; resetuje się stan selekcji zależny od układu. To warunki integralności danych, nie tylko detal wizualny (`docs/agents/frontend.md:70-82`; `public/js/studnie/excelState.js:529-560`).
- **FACT:** standard Excela ma testy mapowania/fasady, parytetu legacy vs virtual, zgodności pustego wiersza, błędów paste i integracji granic modułu (`tests/studnie/excelBoundaryIntegration.test.ts:19-125`; `tests/studnie/excelVirtualOracle.test.ts:7-188`; `tests/studnie/excelEmptyRowAlignment.test.ts:6-283`).
- **FACT:** blokujący gate CI uruchamia parytet trybów, Golden DOM bez aktualizacji snapshotu oraz align test (`.github/workflows/ci.yml:402-489`). Scripty są również dostępne jako `test:parity`, `test:golden` i `test:alignment` (`package.json:20-24`).

### Zakres i braki dowodowe

- **INFERENCE:** każda zmiana w virtual table, paste, selekcji, szerokości kolumn, pustym wierszu, solverze lub odświeżaniu może zmienić powiązanie komórki z modelem albo treść zapisywanej studni; testy kształtu DOM same nie wystarczą do weryfikacji tego łańcucha.
- **UNKNOWN:** ten przewodnik nie odtwarza pełnego modelu kolumn dla każdej średnicy, wariantu redukcji i stycznej. Dla zmian layoutu korzystaj z `excelColumns.js`, `excelReductionColumns.js`, `excelEmptyRowAlignment.test.ts` i aktualnych golden artifacts.
- **UNKNOWN:** wymienienie gate’ów i testów nie jest dowodem, że przeszły dla obecnego HEAD; sprawdź ich wykonanie w CI przed zmianą lub wydaniem.

## 8. Testy jako mapa, nie wynik wykonania

Wymienione testy istnieją w repozytorium. Nie uruchomiono ich podczas tego przeglądu; nie oznacza to PASS.

| Zakres                                                    | Testy do uruchomienia po zmianie                                                                                                                                        |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Round half-up, wartości krawędziowe i zgodność fallbacków | `tests/moneyRounding.test.ts`; `tests/frontend/moneyRounding.test.ts`                                                                                                   |
| Rabaty klasowe i rabaty hosta przejścia                   | `tests/studnie/classDiscounts.test.ts`; `tests/studnie/discountContract.test.ts`                                                                                        |
| PRECO missing/error, zakresy, parser i PRECO UI           | `tests/studnie/precoCalcError.test.ts`; `tests/precoRangeValidation.test.ts`; `tests/frontend/pricelistPrecoValidation.test.ts`; `tests/frontend/pricelistXlsx.test.ts` |
| Transport wliczony/osobny                                 | `tests/frontend/transportSeparate.test.ts`; `tests/ruryTransportSeparate.test.ts`                                                                                       |
| Parytet konfiguracji i tryb zamrożonej ceny               | `tests/frontend/configPriceParity.test.ts`; `tests/frontend/offerFreeze.test.ts`                                                                                        |
| Kształt, parytet i alignment tabeli Excel                 | `tests/studnie/excelBoundaryIntegration.test.ts`; `tests/studnie/excelVirtualOracle.test.ts`; `tests/studnie/excelEmptyRowAlignment.test.ts`; CI Excel gates            |
| XLSX import i eksport                                     | `tests/frontend/pricelistXlsx.test.ts`; `tests/frontend/xlsxImportStrict.test.ts`; `tests/frontend/xlsxExportInjection.test.ts`; `tests/pricelistExportLive.test.ts`    |

## 9. Punkty wymagające rozstrzygnięcia domenowego

1. Czy `unitPrice` Rury zawiera już PEHD i `surcharge`, skoro renderer dodaje je jawnie, a ścieżki zapisu i części eksportów nie robią tego wprost? Dowód do zbadania: builder pozycji oferty oraz golden test tej samej oferty dla UI, zapisu i eksportu.
2. Która kolejność VAT/rounding jest wiążąca, gdy brutto `roundMoney(netto × 1.23)` (zapis Rury) różni się od `roundMoney(netto + roundMoney(netto × 0.23))` (XLSX)? Wskazane implementacje: `public/js/rury/offerCrud.js:133-140` i `public/js/rury/offerExportsHelpers.js:104-114`.
3. Czy reguły PRECO wyboru głównych przejść, kaskad, zakresów i skrzynek mają aktualną akceptację produktową? Testy potwierdzają implementację tylko w częściach; wymagane fixtures referencyjne od właściciela cennika.
4. Czy wszystkie ścieżki wydruku/eksportu używają tych samych snapshotów kwot co zapis oferty? Bez testu parity nie należy deklarować tego jako faktu.
