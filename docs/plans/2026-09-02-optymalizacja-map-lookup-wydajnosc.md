# Plan: Wdrożenie szybkich Map dla optymalizacji wydajności w Studniach i Rurach

Data: 2026-09-02
Status: w realizacji
Dotyczy: `public/js/studnie/*`, `public/js/rury/*`

## Cel

Eliminacja wielokrotnych liniowych skanów tablic (`.find`, `.filter`, `.some`) w pętlach i przy każdym renderowaniu/przeliczaniu poprzez wdrożenie struktur `Map` i `Set` O(1).

## Fazy zmian:

1. **Faza 1 — Studnie**: Zastąpienie pętlowych `studnieProducts.find((p) => p.id === id)` przez `getStudnieProductById(id)` (`globals.js`).
2. **Faza 2 — Rury**: Utworzenie `productsById` (`Map<id, Product>`) oraz helpera `getRuryProductById(id)` w module rur.
3. **Faza 3 — PZ Guard**: Indeksacja `productionOrders` w `pzGuard.js` po `wellId` oraz `wellId_elementKey`.
4. **Faza 4 — Oferty**: Utworzenie `getOfferById(id)` (`Map<id, Offer>`) w `offerManager.js` (studnie) i `rury/offerCrudHelpers.js`.

## Weryfikacja

- `node -c` na zmienionych plikach JS.
- `npm run typecheck`, `npm run typecheck:frontend`, `npm run lint`, `npm run encoding:check`, `npm run version:check`, `npm run test:quick`.
