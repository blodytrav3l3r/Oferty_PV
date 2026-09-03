# Plan: eliminacja fallbacków O(n²) (indexOf w pętlach)

**Data:** 2026-09-03
**Status:** wykonany 2026-09-03 (4 pliki, +27/−14)
**Wykonanie:** STOP-warunek wykrył dziurę — `_excelWellIndexById` nie był budowany przy otwarciu modala (mutacje panelu głównego), więc naprawa rebuildu weszła w diff (`excelModal.js` +3). Sort: brak `wells.sort` w repo — invariant trywialnie spełniony. Test vm `excelEmptyRowAlignment` dostał mapę SSoT. Weryfikacja: 18/18 Jest, lint 0 errors, typecheck clean, benchmark backend bez regresji.
**Źródło:** pytanie „czy gdzieś korzystamy z O(n²)” + weryfikacja kodu 2026-09-03
**Recenzja:** uwagi z review uwzględnione (kontrakt O(1), invariant Map, diagnostyka braku wpisu, benchmark = brak regresji); runda 2: MUST braku wpisu tylko jako defensive path + szacunek ~10–20 linii; runda 3: duplikat id = kolizja Mapy + assert unikalności

## 1. Cel

Usunąć resztkowe ścieżki O(n²) oparte o `wells.indexOf()` w renderze Excel/wirtualizacji, tak by jedyną ścieżką był lookup O(1) z Mapy. Bez zmian zachowania, bez nowych abstrakcji.

## 2. Stan aktualny (zweryfikowany w kodzie)

| Miejsce                                      | Kod                                                                                         | Ocena                                               |
| -------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `public/js/studnie/excelTableBody.js:78`     | `tabWells.forEach` + `_excelWellIndexById.get(well.id)` z fallbackiem `wells.indexOf(well)` | O(n²) tylko gdy Mapy brak; w praktyce Map zbudowana |
| `public/js/studnie/excelTableBody.js:755`    | identyczny wzorzec w odświeżaniu kolorów duplikatów                                         | jak wyżej                                           |
| `public/js/studnie/wellVirtual.js:364-372`   | `getWellIndexById(w.id)` z fallbackiem `wells.indexOf(w)` w pętli `tm.map`                  | O(n²) tylko gdy brak `getWellIndexById`             |
| `public/js/studnie/excelTableManager.js:818` | już Map O(N+K), komentarz `ponytail:`                                                       | naprawione, nie ruszać                              |
| `public/js/studnie/excelHelpers.js:256`      | `__resCache` dla `resolveEffectiveProduct`                                                  | naprawione, nie ruszać                              |

Wniosek z benchmarku: `scripts/benchmark-excel-a2.mjs:298` — Map daje ~84% gain przy 10k na samym lookup. Reszta `indexOf` w repo to lookupi na stringach/małych tablicach typów (np. `actionsTiles.js:88-89`, `displayUnits.js:82`) oraz `find` po `well.config` (N < 20) — pomijalne, poza zakresem.

## 3. Zakres planu (tylko to)

1. `excelTableBody.js:74-78` i `:751-755` — twarda zależność od `_excelWellIndexById`, brak fallbacku do `indexOf`.
2. `wellVirtual.js:364-372` — twarda zależność od `getWellIndexById`, brak fallbacku do `indexOf`.
3. Nic więcej. Żadnych nowych Map, żadnych nowych modułów.

## 4. Kroki (po odblokowaniu, kolejno)

### Krok 1: `excelTableBody.js` — SSoT z Mapy

- Sprawdzić, gdzie `_excelWellIndexById` jest budowana/czyszczona (grep: `excelTableBody.js`, `excelState.js`, callerzy `_excelRenderTbody`).
- Jeśli budowana per-render — wyciągnąć budowę przed oba `forEach` (linie ~42 i ~750), jedna Mapa na render.
- Zamienić:
    ```js
    const wIdx =
        typeof _excelWellIndexById !== 'undefined' && _excelWellIndexById.has(well.id)
            ? _excelWellIndexById.get(well.id)
            : wells.indexOf(well);
    ```
    na:
    ```js
    const wIdx = _excelWellIndexById.get(well.id);
    ```
    Brak wpisu to naruszenie invariantu (rozdział 5), nie normalna ścieżka: w dev — `console.warn` z `well.id` (istniejący mechanizm diagnostyczny, bez rzucania w produkcji); w produkcji — pominięcie wiersza jak dziś przy `!row`. Nigdy `indexOf`.
- Oba miejsca (render tbody ~74 i refresh dup ~751) ta sama zmiana.

### Krok 2: `wellVirtual.js` — SSoT z `getWellIndexById`

- Sprawdzić definicję `getWellIndexById` (grep `public/js/studnie/`): co robi przy braku id / braku Mapy.
- MUST: `getWellIndexById(id)` musi być O(1) w każdej ścieżce produkcyjnej — `Map.get(id)`, bez wewnętrznego `wells.indexOf()` ani innego liniowego lookupu po `wells`. Jeśli helper ma wewnętrzny fallback liniowy, usunąć go w ramach tego kroku (ten sam diff, bez nowych modułów). W przeciwnym razie usunięcie `indexOf()` z `wellVirtual.js` przeniosłoby O(n²) poziom niżej.
- Zamienić fallback:
    ```js
    const getIdx =
        typeof getWellIndexById === 'function'
            ? function (w) {
                  return w && w.id != null ? getWellIndexById(w.id) : -1;
              }
            : function (w) {
                  return wells.indexOf(w);
              };
    ```
    na bezpośrednie wołanie `getWellIndexById`, brak gałęzi `indexOf`.
- Zachować guard `w.id == null → -1`.

### Krok 3: Weryfikacja (definicja DONE)

1. Brak `wells.indexOf()` w `excelTableBody.js` i `wellVirtual.js` (grep → zero wyników).
2. `_excelWellIndexById.get(id)` jest jedynym lookupem `well.id → indeks` w `excelTableBody.js`.
3. `getWellIndexById(id)` jest O(1) i nie posiada żadnego wewnętrznego fallbacku liniowego (inspekcja kodu helpera + grep na `indexOf`/`find` po `wells` wewnątrz).
4. Potwierdzony invariant: `_excelWellIndexById` mapuje `well.id → indeks w aktualnym wells[]`; każda mutacja zmieniająca kolejność/zawartość `wells[]` rebuilduje Mapę (MUST przed GO, patrz rozdział 5 — sort).
5. Brak wpisu w Map nie gubi poprawnego wiersza po cichu: dev `console.warn` z `well.id`, brak nowych wyjątków w produkcji. MUST: dla poprawnego `well.id` w normalnym przepływie brak wpisu nie może wystąpić — gałąź `undefined` to wyłącznie defensive error path. Weryfikacja dowodzi tego na prawidłowym datasecie (render bez warnów + assert `new Set(wells.map(w => w.id)).size === wells.length`, lub równoważna istniejąca diagnostyka), nie tylko obsługuje `undefined`.
6. Technicznie: `node -c` na oba pliki, `npm run lint:frontend` + `npm run typecheck:frontend` (naprawiać wyłącznie regresje z tego planu).
7. Benchmark: kryterium sukcesu to **brak regresji** przy 10k (render / virtual scroll, brak liniowego fallbacku), nie spektakularny zysk — happy path już dziś idzie przez `Map.get`, więc różnica może wynieść 1–2%. Baseline: `docs/plans/archive/2026-09-01-architektura-10k.md:207`, `docs/plans/archive/a2-benchmark-10k.md:20`.
8. Ręcznie: Excel 50/1000 wierszy — render, duplikaty nazw, wirtualizacja transportu bez błędów w konsoli.

## 5. Ryzyka

- **Invariant Map (MUST przed GO):** `_excelWellIndexById` mapuje `well.id → indeks w aktualnym wells[]`; sort nie może zmieniać kolejności `wells[]` bez rebuildu Mapy. Przed zmianą jednoznacznie ustalić, co jest sortowane: jeśli sort przestawia `wells[]`, Mapa po sorcie jest nieaktualna i `Map.get(id)` zwróci stary indeks (gorsze niż fallback — cichy zły wiersz zamiast wolnego dobrego). Jeśli sort działa wyłącznie na `filteredIndexes[]`, a `wells[]` zachowuje fizyczną kolejność — OK. Mitigacja: potwierdzić rebuild we wszystkich mutacjach (komentarz SSoT w `excelTableBody.js:73`); jeśli rebuildu gdzieś brak, plan STOP i najpierw naprawa rebuildu.
- **Brak wpisu w Map = invariant violation, nie normalna ścieżka:** ciche `return` ukryłoby błąd synchronizacji (wiersz znika bez śladu). Dlatego dev `console.warn` z `well.id`; brak rzucania w produkcji. MUST: brak wpisu nie może wystąpić dla poprawnego `well.id` w normalnym przepływie — `undefined` to wyłącznie defensive error path, a test na prawidłowym datasecie musi wykazać zero warnów. Fallback `indexOf` dawał pozorne bezpieczeństwo kosztem ukrytej ścieżki O(n²) — jego usunięcie jest lepsze, o ile invariant z punktu wyżej jest prawdziwy.
- `well.id` brak → `Map.get` daje `undefined` (warn + skip, defensive path). Duplikat `well.id` → kolizja Mapy (`map.set` nadpisuje) i potencjalnie błędny indeks dla jednego z wierszy — gorsze niż brak wpisu, bo bez warna. Normalny dataset musi gwarantować unikalność `well.id`; weryfikacja assertem z DONE pkt 5.

## 6. Czego NIE robić (YAGNI)

- Nie budować nowej infrastruktury indeksów, nie ruszać `excelHelpers.js:256` ani `excelTableManager.js:818`.
- Nie optymalizować `find` po `well.config` ani `indexOf` na typach/stringach — N za małe.
- Nie dotykać backendu (N+1 Prisma to osobny temat, baza błędów #9).

## 7. Szacunek

2 pliki, ~10–20 linii diff (zależnie od implementacji helpera `getWellIndexById` — czysty `Map.get` to dolna granica, fallback liniowy wewnątrz to górna). Weryfikacja ~30 min (lint + benchmark + ręczny render).
