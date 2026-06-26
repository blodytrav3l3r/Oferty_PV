# AGENTS.md — Oferty_PV (WITROS)

TRYB KOMUNIKACJI: /caveman lite (zawsze). Komentarze w kodzie tylko po polsku. Odpowiedzi po polsku.
Bug → natychmiastowy fix, nie analiza. Złożone zadania (3+ pliki) → delegate_task z agentami.

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
├── docs/errors-known.md            — Katalog znanych błędów
└── tsconfig.frontend.json          — TypeScript config
```

## Domain knowledge

### Well diameters (DN)
- DN1000, DN1200, DN1500, DN2000, DN2500, styczne
- Reductions: well.redukcjaTargetDN (np. DN1200 → DN1000)

### Excel table column ordering
AVR → Konus → Płyty nakrywające → Płyty redukcyjne → Krąg → KrOT
→ Dennica → Uszczelki → H denn → Uszcz sum → Redukcja → Kineta → P.Buda → Akcje

### Excel per-product columns
- Uszczelki, R.Uszczelki: per-product (type:'number')
- Product codes via `resolveEffectiveProduct()` (wellConfigRules.js:340)
- Grouped columns: getAvailableProducts + filterByWellParams fallback

### Excel transitions (przejscia)
- Per-tab `_excelMaxTransitions[tab]`
- Cleanup: keeps productId OR tempCategory OR rzednaWlaczenia
- Type selection → tempCategory → render → DN dropdown enabled

## Operational Rules

### Token optimization
- `/caveman lite` — bez fillerów, uprzejmości, zbędnych zdań
- `execute_code` — batch 3+ tool calls z logiką
- `delegate_task` — równoległe dla złożonych zadań
- `read_file` z offset/limit — czytaj tylko potrzebne linie
- `search_files` zamiast grepa w terminalu

### Debugging
- Sprawdź `docs/errors-known.md` przed debugowaniem
- Sprawdź cache JS (Ctrl+Shift+R, bump wersji, nowa karta)
- Sprawdź konsolę przeglądarki przed pytaniem usera
- Przy nadpisaniu pliku: `git checkout -- <path>` + ponów patche

### Excel development
- Po każdej zmianie: `npm run typecheck:frontend` + browser test
- JS cache busting: bump `?v=X` w studnie.html + Ctrl+Shift+R
- Nie dispatchuj 2+ subagentów na ten sam plik równolegle
- Przed refaktorem Excela: utwórz tag git

## Frontend conventions
- **API**: `api.get|post|put|del()` z `shared/api.js` — NIE `fetch()`
- **Style**: `classList.add/remove` — NIE `element.style.xxx`
- **Lucide**: `lucide.createIcons({root})` po każdym `innerHTML`
- **Logger**: `window.logger.info|warn|error(tag, msg)` — NIE `console.log`
- **Toast**: `showToast(msg, type)` (success|error|info)
- **Confirm**: `appConfirm(msg)` → Promise<boolean>
- **Escape**: `escapeHtml(str)` przy interpolacji HTML
- **Auth header**: `x-auth-token` — NIE `Authorization: Bearer`

## Commands
| Komenda | Opis |
|---------|------|
| `npm run dev` | Dev server :3000 |
| `npm run typecheck:frontend` | TypeScript check frontendu |
| `npm run test` | Testy Jest (42 pass / 6 pre-existing FAIL) |
| `python scripts/excel-validator.py` | Walidacja Excela |
| `git commit --no-verify` | Commit (pre-push hook blokuje pre-existing) |
| `git push origin main --no-verify` | Push na GitHub |

## Testing protocol
1. `npm run typecheck:frontend`
2. `python scripts/excel-validator.py`
3. `npm run test`
4. Browser: log in admin/admin123, navigate to studnie.html?edit=offer_..., open Excel
5. git add + git commit --no-verify + git push origin main --no-verify

## Transition cleanup rule
`_excelCleanEmptyPrzejscia` keeps transitions with:
- productId (completed selection)
- tempCategory (in-progress type selection)
- rzednaWlaczenia (partially filled)
Removes only truly empty objects.

## Restore points
In-memory snapshots of wells array (max 5).
`_excelSaveRestorePoint(name)`, `excelRestorePoint(idx)`, `_excelAutoRestorePoint()`.

## Known test failures (pre-existing)
- `printDispatch.test.ts` — relatedOrders pattern change
- `studnieOrderExport.test.ts` — order structure change
- `ruryOrderExport.test.ts` — j.w.
- `pricelistService.test.ts`, `studnieOrderAsOffer.test.ts`, `i18n/comments.test.ts`
