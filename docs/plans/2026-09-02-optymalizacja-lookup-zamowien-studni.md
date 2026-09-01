# Plan: Optymalizacja wyszukiwania zamówień w liście studni (O(N) -> O(1))

Data: 2026-09-02
Status: w realizacji
Dotyczy: `public/js/studnie/orderHelpers.js`
Powiązane: `docs/plans/2026-09-02-studnie-lista-virtual-visual-safe.md`

## Cel

Wyeliminować różnicę wydajnościową i przycinanie listy studni przy istniejącym zamówieniu / edycji zamówienia.

## Przyczyna problemu

Podczas renderowania każdej karty wirtualnej w `wellUIHelpers._wellBuildCardHtml` wywoływana jest funkcja `getOrderForWellId(w.id, offerId)` oraz `isWellOrdered(w)`.
Przed optymalizacją, przy każdej karcie pętla przeszukiwała tablicę `ordersStudnie` oraz zagnieżdżoną tablicę `order.wells` za pomocą `find()` i `some()`.
Dla 1000 studni i 5 zamówień dawało to **5 000 000 porównań stringów przy każdym ticku przewijania**.

## Rozwiązanie

Użycie lekkiej pamięci podręcznej (Map / Set) w `orderHelpers.js`, unieważnianej automatycznie przy zmianie `ordersStudnie` lub mutacji zamówień:

1. `_orderedWellIdsCache`: `Map<offerId, Set<wellId>>` — szybki zestaw zamówionych ID.
2. `_wellToOrderMapCache`: `Map<wellId, Order>` — natychmiastowy lookup zamówienia dla studni O(1).

## Weryfikacja

1. Test Playwright w przeglądarce (Playwright Chromium) dla 1000 studni (porównanie ms/render przed i po).
2. Pełna walidacja pakietem skryptów projektu (`typecheck`, `typecheck:frontend`, `lint`, `encoding:check`, `version:check`).
