# Baseline — orderManager.js

**Data:** 2026-07-12
**Stan:** przed splitem (T5)
**Wynik testów:** 1300/1300 ✅

---

## Fakty

| Metryka             | Wartość                     |
| ------------------- | --------------------------- |
| Linie               | 2739                        |
| Funkcje             | 46                          |
| `window.*` eksporty | 23 unikalne (26 przypisań)  |
| Pliki HTML ładujące | `studnie.html`, `rury.html` |

## window.* eksporty i konsumenci

| Eksport                              | Konsumenci              |
| ------------------------------------ | ----------------------- |
| `window.getOrdersForOffer`           | 5 plików                |
| `window.getOrderedWellIds`           | 0 (tylko definicja)     |
| `window.isWellOrdered`               | 2 pliki                 |
| `window.getOfferOrderProgress`       | 1 plik                  |
| `window.getOrderForWellId`           | 2 pliki                 |
| `window.wellDiscounts`               | 6 plików (także setter) |
| `window.isPreviewMode`               | 2 pliki (także setter)  |
| `window.applyPreviewLockUI`          | 1 plik                  |
| `window.saveCurrentOrder`            | 2 pliki                 |
| `window.saveOfferStudnie`            | 3 pliki                 |
| `window.loadOrderSnapshot`           | 1 plik                  |
| `window.saveOrderStudnie`            | 1 plik                  |
| `window.toggleCard`                  | 2 pliki                 |
| `window.syncSourceData`              | 0 (tylko definicja)     |
| `window.showKartaBudowyExportChoice` | 0 (tylko definicja)     |
| `window.exportKartaToPDF_action`     | 0 (tylko definicja)     |
| `window.exportKartaToWord_action`    | 0 (tylko definicja)     |
| `window.createOrderFromOffer`        | 0 (tylko definicja)     |
| `window.exitPreviewMode`             | 0 (tylko definicja)     |
| `window.deleteOrderStudnie`          | 0 (tylko definicja)     |

## Pełna lista funkcji (46)

| #   | Funkcja                            | Odpowiedzialność                  | Kategoria    |
| --- | ---------------------------------- | --------------------------------- | ------------ |
| 1   | `loadOrdersStudnie`                | Ładowanie zamówień z API          | CRUD         |
| 2   | `saveOrdersDataStudnie`            | Zapis danych zamówienia           | CRUD         |
| 3   | `getOrdersForOffer`                | Pobranie zamówień dla oferty      | State        |
| 4   | `getOrderedWellIds`                | ID studni zamówionych             | State        |
| 5   | `isWellOrdered`                    | Sprawdzenie czy studnia zamówiona | State        |
| 6   | `getOfferOrderProgress`            | Postęp zamówienia                 | State        |
| 7   | `getOrderForWellId`                | Zamówienie dla studni             | State        |
| 8   | `createOrderFromOffer`             | Utworzenie zamówienia z oferty    | CRUD         |
| 9   | `_resetKartaBudowyForm`            | Reset formularza                  | Karta budowy |
| 10  | `_calcTransportCosts`              | Obliczenie kosztów transportu     | Karta budowy |
| 11  | `_displayTransportCost`            | Wyświetlenie kosztów transportu   | Karta budowy |
| 12  | `_detectWellParams`                | Wykrycie parametrów studni        | Karta budowy |
| 13  | `_applyDetectedParams`             | Zastosowanie parametrów           | Karta budowy |
| 14  | `_getExistingKartaBudowyData`      | Pobranie istniejących danych      | Karta budowy |
| 15  | `_applyExistingKartaBudowyData`    | Zastosowanie istniejących danych  | Karta budowy |
| 16  | `_generateDefaultUwagi`            | Generowanie domyślnych uwag       | Karta budowy |
| 17  | `initKartaBudowyStep4`             | Inicjalizacja kroku 4             | Karta budowy |
| 18  | `step4NextAction`                  | Akcja "Dalej" w kroku 4           | Karta budowy |
| 19  | `getKartaBudowyCopyOrders`         | Zamówienia do kopiowania          | Karta budowy |
| 20  | `showKartaBudowyCopyPicker`        | Picker kopiowania                 | Karta budowy |
| 21  | `renderKartaBudowyCopyOptions`     | Render opcji kopiowania           | Karta budowy |
| 22  | `copyKartaBudowyFromOrder`         | Kopiowanie karty budowy           | Karta budowy |
| 23  | `applyCopiedKartaBudowyData`       | Aplikacja skopiowanych danych     | Karta budowy |
| 24  | `mergeCopiedCustomPrzejscia`       | Scalanie przejść po kopii         | Karta budowy |
| 25  | `collectKartaBudowyDataStep4`      | Kolekcja danych krok 4            | Karta budowy |
| 26  | `handlePrzejsciaZamowioneChange`   | Zmiana przejść zamówionych        | Przejścia    |
| 27  | `buildOfferPrzejsciaTypes`         | Budowa typów przejść              | Przejścia    |
| 28  | `renderPrzejsciaDetailsTable`      | Render tabeli przejść             | Przejścia    |
| 29  | `updatePrzejscieDnOptions`         | Aktualizacja DN opcji             | Przejścia    |
| 30  | `buildPrzejscieRowHTML`            | Budowa wiersza przejścia          | Przejścia    |
| 31  | `updatePrzejscieSelectStyle`       | Styl selecta przejścia            | Przejścia    |
| 32  | `addCustomPrzejscieRow`            | Dodanie wiersza przejścia         | Przejścia    |
| 33  | `removePrzejscieRow`               | Usunięcie wiersza przejścia       | Przejścia    |
| 34  | `_syncCustomRowsFromDOM`           | Synchronizacja DOM→dane           | Przejścia    |
| 35  | `collectPrzejsciaDetailsFromTable` | Kolekcja detali z tabeli          | Przejścia    |
| 36  | `finalizeOrderFromOffer`           | Finalizacja zamówienia            | CRUD         |
| 37  | `collectSelectedWellsForOrder`     | Kolekcja wybranych studni         | CRUD         |
| 38  | `saveOrderStudnie`                 | Zapis zamówienia studni           | CRUD         |
| 39  | `freezeWellPrices`                 | Zamrożenie cen studni             | CRUD         |
| 40  | `deleteOrderStudnie`               | Usunięcie zamówienia              | CRUD         |
| 41  | `getOrderChanges`                  | Zmiany w zamówieniu               | State        |
| 42  | `getCurrentOfferOrder`             | Aktualne zamówienie oferty        | State        |
| 43  | `enterOrderEditMode`               | Wejście w tryb edycji             | Order        |
| 44  | `loadOrderSnapshot`                | Załadowanie snapshota             | CRUD         |
| 45  | `renderOrderModeBanner`            | Banner trybu zamówienia           | UI           |
| 46  | `saveCurrentOrder`                 | Zapis bieżącego zamówienia        | CRUD         |
| 47  | `syncSourceData`                   | Synchronizacja danych źródłowych  | State        |

## Kategorie (proponowany split)

| Kategoria               | Liczba funkcji | Szac. linii | Plik docelowy               |
| ----------------------- | :------------: | :---------: | --------------------------- |
| Karta budowy (krok 4+5) |       17       |    ~800     | `orderKartaBudowy.js`       |
| Przejścia               |       10       |    ~500     | `orderPrzejscia.js`         |
| CRUD (save/load/delete) |       10       |    ~600     | `orderCrud.js`              |
| State (gettery)         |       8        |    ~200     | `orderState.js`             |
| UI/Order mode           |       2        |    ~150     | zostaje w `orderManager.js` |

## Test coverage

| Obszar             | Testy | Pokrycie |
| ------------------ | :---: | :------: |
| `orderManager.js`  |   0   |    0%    |
| `orderZlecenia.js` |   0   |    0%    |
