# ADR-008: Modularyzacja frontendu — Opcja A (IIFE + window.*, reorganizacja strukturalna)

**Status:** Zaakceptowany
**Data:** 2026-08-14
**Autor:** Plan modernizacji 2026-08-14 (K2)

## Kontekst

Faza 4 planu modernizacji zakłada poprawę granic modułów frontendu. Frontend to 212 plików JS
(`public/js/`), 657 unikalnych globali (`window.*`), ładowanych jako klasyczne `<script>` (studnie:
149, rury: 44, app.html). Stopniowa konwersja pojedynczych plików na ES modules jest niemożliwa:
klasyczny `<script>` nie może `import` z ES module, a module nie współdzielą globali z klasycznymi
skryptami.

Dependency map (`scripts/frontend-deps.mjs`, krok 4.0) potwierdza:

- **212 plików, 657 globali** — pełna konwersja = przepisanie całego łańcucha w jednym kroku.
- **Duplikaty globali między rury/studnie** (`clearOfferForm`, `createOrderFromOffer`,
  `finalizeOrderFromOffer`, `getOrdersForOffer`, `pendingOrderCreationData`, `generateOfferNotes`,
  `handlePrintClick`, `updateOrderSelectionCount`, `renderOrderModeBanner`, `showSection` itd.) —
  to **świadoma izolacja domenowa** (rury i studnie nigdy nie ładują się razem), zgodna z planem
  pkt 9 („usuwanie duplikacji między rury/studnie, gdzie izoluje domenę" — nie usuwać).
- **Global konfliktowy** `toggleCard` definiowany w 3 plikach (`app.js`, `shared/ui.js`,
  `studnie/globals.js`) — realny kandydat do ujednolicenia przy reorganizacji.

## Decyzja

**Opcja A** — pozostać przy klasycznych skryptach + IIFE + jawny `window.*`, wykonać tylko
reorganizację strukturalną i testy logiki przez vm. **Opcja B odrzucona.**

## Uzasadnienie

1. **Koszt/ryzyko Opcji B nieproporcjonalny:** 657 globali × konwersja łańcucha = jeden commit
   przepisujący ~40 000 LOC ze zmianą semantyki ładowania (ESM jest leniwy, klasyczne skrypty
   sekwencyjne). Każdy `import` cykliczny = błąd runtime. Wymaga pełnego E2E dla każdego modułu.
2. **Zero korzyści użytkownika:** przeglądarka i tak serwuje pojedyncze pliki; brak bundlingu
   (ADR-005 wycofał Vite). ESM nie skraca czasu ładowania bez bundlera.
3. **ADR-002 już przesądza architekturę:** Vanilla JS + IIFE pattern jest świadomą decyzją.
4. **Testowalność osiągalna bez konwersji:** czyste funkcje (precoCalcCore, ringOptimizer, solver,
   productHelpers) są już testowane przez `vm` — wzorzec sprawdzony w `tests/studnie/*`.
5. **Reorganizacja strukturalna (Opcja A)** — konsolidacja konfliktowych globali, wydzielenie
   czystych funkcji do testowania, dokumentacja kolejności skryptów — daje mierzalną poprawę bez
   ryzyka regresji.

## Konsekwencje

- Frontend pozostaje klasycznymi skryptami; każdy nowy global jawnie na `window.*`.
- Konfliktowe globals (`toggleCard`, `clearOfferForm`, `showSection`) konsolidowane plik-po-pliku
  przy okazji prac w danym module (nie w osobnym „refaktorze modularyzacji").
- Testy logiki przez `vm` (wzorzec `tests/studnie/`) — nie testy DOM.
- Kolejność `<script>` jest częścią kontraktu; zmiany kolejności tylko z dependency map.

## Alternatywy odrzucone

| Alternatywa            | Powód odrzucenia                                                                    |
| ---------------------- | ----------------------------------------------------------------------------------- |
| Opcja B (ESM)          | 657 globali, cykliczne importy, pełne przepisanie łańcucha, brak bundlera (ADR-005) |
| Bundler (Vite/Webpack) | Sprzeczny z ADR-005 (Express serwuje statyczne pliki), wymaga build stepu w prod    |
