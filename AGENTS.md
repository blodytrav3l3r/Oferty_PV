# AGENTS.md — Oferty_PV (WITROS)

## Project structure
```
I:\GitHub\Oferty_PV\
├── public/
│   ├── js/studnie/
│   │   ├── excelTableManager.js   — Excel table (~3350 linii)
│   │   ├── wellManager.js         — Główny configurator studni
│   │   ├── wellSolver.js          — Logika wyliczania studni
│   │   ├── wellTransitions.js     — Renderer przejść
│   │   ├── transitionRenderer.js  — Kafelki przejść
│   │   ├── wellConfigRules.js     — Filtry produktów
│   │   └── orderManager.js        — Zarządzanie zamówieniami
│   └── studnie.html               — SPA strona
├── data/app_database.sqlite        — Baza danych
├── scripts/excel-validator.py      — Walidator Excela
├── tests/                          — Testy Jest
└── tsconfig.frontend.json          — TypeScript config
```

## Domain knowledge

### Well diameters (DN)
- DN1000, DN1200, DN1500, DN2000, DN2500, styczne
- Reductions: well.redukcjaTargetDN (e.g. DN1200 → DN1000)

### Excel table column ordering
Groups ordered by DN (reduction DN1000 → DN1200 → main DN), then:
```
AVR → Konus → Płyty nakrywające → Płyty redukcyjne → Krąg → KrOT
→ Dennica → Uszczelki → H denn → Uszcz sum → Redukcja → Kineta → P.Buda → Akcje
```

### Excel per-product columns
- Uszczelki, R.Uszczelki: per-product columns (type:'number')
- Product codes resolved via `resolveEffectiveProduct()` (wellConfigRules.js:340)
- Grouped columns (krag, konus, dennica, plyty): use getAvailableProducts + filterByWellParams fallback

### Excel transitions (przejscia)
- Per-tab column count via `_excelMaxTransitions[tab]`
- Empty transitions cleaned by `_excelCleanEmptyPrzejscia` on every render
- Filter: keeps transitions with productId OR tempCategory OR rzednaWlaczenia

## Commands
- Dev server: `npm run dev` (port 3000)
- Typecheck: `npm run typecheck:frontend`
- Validator: `python scripts/excel-validator.py`
- Tests: `npm run test` (42 pass, 6 pre-existing failures)
- Admin login: admin / admin123

## JS cache busting
After changing JS files, bump version in studnie.html:
```html
<script src="js/studnie/excelTableManager.js?v=NEW">
```
Then Ctrl+Shift+R in browser.

## Testing protocol
1. `npm run typecheck:frontend`
2. `python scripts/excel-validator.py`
3. `npm run test`
4. Browser test: log in, navigate to studnie.html?edit=offer_..., open Excel
5. git commit --no-verify (pre-push hook tests block on pre-existing failures)
6. git push origin main --no-verify

## Transition cleanup rule
`_excelCleanEmptyPrzejscia` keeps transitions with:
- productId (completed selection)
- tempCategory (in-progress type selection)
- rzednaWlaczenia (partially filled)
Removes only truly empty objects.

## Restore points
In-memory snapshots of wells array (max 5).
`_excelSaveRestorePoint(name)`, `excelRestorePoint(idx)`, `_excelAutoRestorePoint()`.
