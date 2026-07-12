# Plan splitów JS — Oferty PV

Cel: sprowadzić wszystkie pliki JS poniżej 500L (lub EXEMPT)
Metoda: move-only, global functions → podfoldery + barrel, HTML script tagi

## Faza 1: studnie/ (największe pliki)

### 1. pricelistManager.js ~1966L → 5 submodułów

- Sekcje: ZAKŁADKI/LISTA (2-298) | PEHD/KATEGORIE/EDYCJA (300-611) | CRUD/RESET (612-918) | IMPORT/EXPORT (919-1376) | INIT/PRECO (1377-1966)
- Oczekiwane: ~400L barrel + ~350L × 5

### 2. wellManager.js ~1928L → 4 submoduły

- Parametry globalne | CRUD studni | Wycena | Breakdowany cenowe

### 3. offer/offerSummary.js ~1680L → 4 submoduły

- Render podsumowania | Totale | Notatki | PRECO

### 4. wellSolver.js ~1510L → 3 submoduły

- Solver OT | Auto-select | Walidacja luzów

### 5. wellTransitions.js ~1448L → 3 submoduły

- CRUD przejść | Edycja inline | Rysowanie

### 6. order/orderKartaBudowy.js ~1237L → 2 submoduły

### 7. excel/excelClipboard.js ~1154L → 3 submoduły

### 8. wellUI.js ~1211L → 3 submoduły

### 9. excel/excelRenderer.js ~1137L → 3 submoduły

### 10. wellDiagram.js ~921L → 2 submoduły

### 11. printManager.js ~910L → 2 submoduły

### 12. offerPrintManager.js ~862L → 2 submoduły

## Faza 2: rury/

### 13. orderManager.js ~1190L → 4 submoduły

### 14. offerItems.js ~1121L → 4 submoduły

## Faza 3: spa/

### 15. zlecenia.js ~1259L → 3 submoduły

## Quality Gates (po każdym spliście)

- `node -c <plik>` dla każdego nowego pliku
- `npm run typecheck` (backend TS)
- `npm run lint`
- `npm run test:quick`
- `npm run format:check`
- `graphify update .`
- Commit Conventional Commits
