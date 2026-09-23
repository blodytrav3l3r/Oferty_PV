# Faza 1 — Inwentaryzacja renderowana (BASELINE) — raport

> Plan: `docs/plans/modernizacja-ui-cala-aplikacja.md` (§4, §7, §7c, §7d, §10b).
> Status: **dowody zebrane, P0 GATE nadal ZAMKNIĘTY** (brak GO na P1).
> Data: 2026-09-23. Bez commitów/pushy. Zero zmian logiki testów i kodu prod.

## 1. Środowisko i izolacja (potwierdzone)

- Serwer testowy: `http://localhost:3177`, DB: `I:\GitHub\Oferty_PV\prisma\data\e2e.sqlite`
  (seed z `prisma db push + db seed`, `DATABASE_URL=file:./data/e2e.sqlite`).
- Prod **nietknięty**: `:3000` (dev backend, PID 21452) pozostawiony w spokoju;
  `data/app_database.sqlite` nieużywany. Guard izolacji w skryptach (STOP przy innym porcie/DB).
- Tylko headless Chromium (`chromium.launch({ headless: true })`).

### 1a. Incydent środowiskowy (naprawa wywołania, nie logiki)

Pierwsze wywołanie `node tests/playwright/screenshotsBaseline.cjs --spawn` padło na
`npm run build`: `[copy-prisma-client] failed: EPIPE … dist\generated\prisma`
— przyczyną był **osierocony proces** `node dist\server.js` (PID 40812) trzymający lock
na `:3177` i plikach `dist/` (pozostałość po wcześniejszym uruchomieniu, nie z tego przebiegu).
Naprawa wyłącznie środowiskowa: `Stop-Process -Id 40812` (port **testowy**; `:3000` nietknięty),
retry przeszedł **6/6 PASS**. Logiki skryptu nie zmieniano.

### 1b. Luka pokrycia vs §4 planu

Skrypt `screenshotsBaseline.cjs --spawn` pokrywa **tylko 3 moduły × 2 viewporty**
(studnie/rury/kartoteka, 1280×800 + 390×844, bieżący motyw = dark). §4 wymaga:
1440×900, light + dark, pulpit, rury K1–K5, studnie K1–K5 + oferta + cennik + PZ,
kartoteka (+modale), zlecenia (+statystyki/tabela/modale), admin, Excel
(toolbar/tabela/modale), UPM/print, toasty. Uzupełniono autorskim one-shotem
(`C:\Users\blody\AppData\Local\Temp\opencode\faza1-contrast.cjs`, poza repo):
**5 stron × 2 motywy @1440×900** + pomiary computed-style. Nie pokryte nadal:
K1–K5 kroki, oferta, cennik, PZ, modale, toasty, dropdowny (otwarte), Excel modal,
UPM/print, admin — do dogrania przed P1 (osobne GO).

## 2. Screenshoty (16 plików)

Baseline (istniejący skrypt, 1280×800 + 390×844, dark):

- `tests/playwright/screenshots/baseline/studnie-desktop.png`
- `tests/playwright/screenshots/baseline/studnie-mobile.png`
- `tests/playwright/screenshots/baseline/rury-desktop.png`
- `tests/playwright/screenshots/baseline/rury-mobile.png`
- `tests/playwright/screenshots/baseline/kartoteka-desktop.png`
- `tests/playwright/screenshots/baseline/kartoteka-mobile.png`

Faza 1 (one-shot, 1440×900, oba motywy):

- `tests/playwright/screenshots/faza1/pulpit-dark-1440.png`
- `tests/playwright/screenshots/faza1/pulpit-light-1440.png`
- `tests/playwright/screenshots/faza1/studnie-dark-1440.png`
- `tests/playwright/screenshots/faza1/studnie-light-1440.png`
- `tests/playwright/screenshots/faza1/rury-dark-1440.png`
- `tests/playwright/screenshots/faza1/rury-light-1440.png`
- `tests/playwright/screenshots/faza1/kartoteka-dark-1440.png`
- `tests/playwright/screenshots/faza1/kartoteka-light-1440.png`
- `tests/playwright/screenshots/faza1/zlecenia-dark-1440.png`
- `tests/playwright/screenshots/faza1/zlecenia-light-1440.png`

Obserwacje z podglądu: dark = spójny głęboki granat; light = białe karty, czytelny;
**pasek filtrów kartoteki w light zachowuje ciemny gradient-wash** (patrz L8).

## 3. Component matrix (wypełniona po screenshotach + computed-style)

Legenda: ✓ = zmierzone/zinspektowane, — = niepokryte (luka, patrz §1b),
✗ = zmierzony FAIL WCAG (szczegóły §5).

| Component | Light | Dark | Default | Hover | Focus | Active | Disabled | Selected | Loading |
| --------- | ----- | ---- | ------- | ----- | ----- | ------ | -------- | -------- | ------- |
| Button    | ✓     | ✓✗   | ✓       | —     | —     | —      | —        | —        | —       |
| Tile      | ✓     | ✓    | ✓       | —     | —     | —      | —        | —        | —       |
| Input     | ✓     | ✓    | ✓       | —     | —     | —      | —        | —        | —       |
| Modal     | —     | —    | —       | —     | —     | —      | —        | —        | —       |
| Table     | ✓     | ✓✗   | ✓       | —     | —     | —      | —        | —        | —       |
| Toast     | —     | —    | —       | —     | —     | —      | —        | —        | —       |
| Dropdown  | —     | —    | —       | —     | —     | —      | —        | —        | —       |
| Excel     | —     | —    | —       | —     | —     | —      | —        | —        | —       |

Uwagi do matrix:

- Button dark ✗ = `.btn-primary` biały na `--accent #6366f1` → **4,47:1** (FAIL graniczny).
- Table dark ✗ = komórki/nagłówki w `--text-muted` → **3,24–3,73:1** (FAIL).
- Focus globalnie istnieje (`*:focus-visible { outline: 2px solid var(--accent); }`,
  `public/css/style.base.css:433`), ale **nie mierzono widoczności w obu motywach** — luka.
- Disabled/locked realizowane są w większości przez **inline `opacity`** w JS (§6, D6) —
  brak klasy + wartości per motyw.
- Excel: kontrakt `--excel-*` zinwentaryzowany w manifeście (19 zadeklarowanych,
  19 używanych), brak pomiarów wizualnych (modal nieotwierany) — luka.
- Toast/Dropdown/Modal: selektory nieznalezione w statycznych widokach — luka (§1b).

## 4. Lista D — problemy DARK (D1–Dn, z plik:linia)

- **D1 — label-e formularzy poniżej AA.** `--text-muted` (`slate-500 #64748b`)
  na `--bg-secondary #111827` → **3,73:1** (pomiar: studnie-dark, rury-dark,
  selektor `label, .wizard-param-label, .form-label`).
  Token: `public/css/style.base.css:18`; tło: `public/css/style.base.css:6`.
- **D2 — tekst tabel poniżej AA.** `tbody td` i `thead th` w muted na ciemnym →
  **3,24–3,73:1** (pomiar: zlecenia-dark, pulpit-dark).
  Token: `public/css/style.base.css:18`; tła tabel: `public/css/zlecenia.css`
  (nadpisania light: linie 765–771; odpowiednik dark do audytu w P0).
- **D3 — `.btn-primary` graniczny FAIL.** Biały tekst na `--accent #6366f1` →
  **4,47:1** (pomiar: pulpit-dark, studnie-dark, rury-dark).
  Token: `public/css/style.base.css:28`.
- **D4 — pozostałe gradienty/washe (do decyzji P0: kasacja → `bg-secondary` + `border`).**
  `public/css/style.responsive.css:174-178` (`.kartoteka-filter-bar` gradient —
  **bez odpowiednika light, szary wash widoczny w light**),
  `:416-418` (shimmer `::after`), `:291-295` (aktywne filtry kartoteki),
  `:1116` (wash `bg-hover → accent-bg`), `:1588/:1595/:1626` (gradienty ofertowe);
  `public/css/style.base.css:539-541` (logo-gradient), `:1712` (`.cat-header` wash);
  `public/css/style.utilities.css:644-648` (tile wash), `:809/:826/:846` (selected);
  `public/css/studnie.css:1500` (`.well-ctrl-btn--primary`), `:1638`
  (`.fs-type-btn.active`), `:4675` (CTA), `:5037` (danger wash);
  `public/css/printModal.css:34` (`.upm-modal` dark), `:187` (border-image),
  `:547` już tylko light; `public/css/studnie/modal.css:1041`.
- **D5 — glass/blur pozostałości (do decyzji P0).**
  `public/css/style.responsive.css:184` (filter-bar `blur(10px)`),
  `public/css/zlecenia.css:386-387` (batch bar; komentarz P3 w pliku),
  `public/css/studnie.css:1738-1739` i `:2014-2015` (overlaye),
  `public/css/studnie/modal.css:132-133`, `public/css/printModal.css:29`.
- **D6 — disabled/locked przez inline `opacity` (brak klasy + wartości per motyw).**
  `public/js/rury/offerRendering.js:151,153`, `public/js/studnie/actionsConfigRender.js:136`,
  `public/js/studnie/pricelistManager.js:105`, `public/js/studnie/uiWellParams.js:273,320,331`,
  `public/js/studnie/excelWellActions.js:189`, `public/js/studnie/excelTabs.js:26`,
  `public/js/studnie/offerSummaryUI.js:76,116`, `public/js/studnie/offerWellComponents.js:295`,
  `public/js/studnie/wellUI.js:68`, `public/js/studnie/wellVirtual.js:397`,
  `public/js/studnie/wellUIHelpers.js:42`.
- **D7 — parity-gap selected:** `.fs-type-btn.active` biały tekst na gradiencie
  `accent-bg-hover → nav-glow-custom` (`public/css/studnie.css:1638-1641`) —
  w dark ciemne tła (OK), w light pastele `#e0e7ff → #eaeef2` + biały tekst (FAIL, patrz L8).
- **D8 — niespójne poziomy surface + jasne soft-tokeny w `:root` dark.**
  Cztery bliskie tła: `--bg-secondary #111827` (`style.base.css:6`),
  `--bg-glass #141a2a` (`:8`), `--bg-tile #1a2536` (`:12`), `--bg-input #1e2d42` (`:13`);
  jasne pastele w korzeniu dark: `--success-bg-soft #e6f7e6` (`:48`),
  `--danger-bg-soft #fce8e8` (`:57`), `--warn-bg-soft #fff3e0` (`:65`),
  `--warn-bg-light #fffbeb` (`:66`) — użycia do audytu w P0.
- **D9 — artefakt metody (nie werdykt):** `.ka-filter-btn.active` w kartotece-dark
  dał 1,00:1 (biały na białym) — element ma przezroczyste tło na gradiencie
  (`style.responsive.css:291`), blender teł nie widzi `background-image`.
  Wymaga weryfikacji ręcznej przed P1.
- **D10 — brak tokenu `--focus-*`.** Focus działa globalnie
  (`public/css/style.base.css:433-436`, `outline 2px --accent`), ale żaden komponent
  nie ma dedykowanego tokenu focus ani pomiaru widoczności w obu motywach —
  do domknięcia w P0 (P0 GATE wymaga focus token).

### Obserwacja light dopisana do §10a planu

- **L8 — `.kartoteka-filter-bar` w light zachowuje ciemny gradient-wash**
  (`public/css/style.responsive.css:166-178`, brak reguły `html[data-theme='light']`;
  widoczne na `faza1/kartoteka-light-1440.png`: szara belka filtrów na białej stronie).
  Fix w P3/P4, nie w Fazie 1.

## 5. Pomiary kontrastu WCAG (computed style, headless Chromium @1440×900)

Metoda: pierwszy widoczny element selektora (page + same-origin iframes),
`getComputedStyle().color`, tło przez alpha-blending łańcucha rodziców.
Progi: tekst zwykły ≥ 4,5:1, duży (≥18,66px bold / ≥24px) ≥ 3:1.
Werdykty poniżej dla tekstu zwykłego, chyba że oznaczono large.

| #   | Para (tekst → tło)               | Motyw | Stosunek | Próg | Werdykt                 | Tokeny (plik:linia)         |
| --- | -------------------------------- | ----- | -------- | ---- | ----------------------- | --------------------------- |
| 1   | body primary → bg                | dark  | 17,58    | 4,5  | PASS                    | `style.base.css:5,16`       |
| 2   | body primary → bg                | light | 16,77    | 4,5  | PASS                    | `style.base.css:2174,2193`  |
| 3   | nav-tile → tło                   | dark  | 5,71     | 4,5  | PASS                    | `style.base.css:17`         |
| 4   | nav-tile → tło                   | light | 7,58     | 4,5  | PASS                    | `style.base.css:2194`       |
| 5   | nav-tile active → tło            | dark  | 5,25     | 4,5  | PASS                    | `style.base.css:29,33`      |
| 6   | nav-tile active → tło            | light | 7,90     | 4,5  | PASS                    | `style.base.css:2206`       |
| 7   | form-label muted → bg            | dark  | **3,73** | 4,5  | **FAIL** (D1)           | `style.base.css:18`         |
| 8   | form-label muted → bg            | light | 4,76     | 4,5  | PASS                    | `style.base.css:2195`       |
| 9   | form-input tekst → bg-input      | dark  | 12,70    | 4,5  | PASS                    | `style.base.css:13,16`      |
| 10  | form-input tekst → bg-input      | light | 17,85    | 4,5  | PASS                    | `style.base.css:2182,2193`  |
| 11  | btn-primary biały → accent       | dark  | **4,47** | 4,5  | **FAIL** graniczny (D3) | `style.base.css:28`         |
| 12  | btn-primary biały → accent       | light | 6,29     | 4,5  | PASS                    | `style.base.css:2242`       |
| 13  | table th muted → tło             | dark  | **3,24** | 4,5  | **FAIL** (D2)           | `style.base.css:18`         |
| 14  | table th muted → tło             | light | **4,08** | 4,5  | **FAIL** graniczny      | `style.base.css:2195`       |
| 15  | table td muted → tło             | dark  | **3,73** | 4,5  | **FAIL** (D2)           | `style.base.css:18`         |
| 16  | table td → tło                   | light | 7,58     | 4,5  | PASS                    | `style.base.css:2194`       |
| 17  | badge-warn → warn-bg             | dark  | 9,96     | 4,5  | PASS                    | `style.base.css:60,62`      |
| 18  | badge-warn `#996600` → `#fef3c7` | light | **4,43** | 4,5  | **FAIL** graniczny      | `style.base.css:2246,2222`  |
| 19  | btn-danger → danger-bg           | dark  | 5,85     | 4,5  | PASS                    | pomiar pulpit-dark          |
| 20  | btn-danger `#cc0000` → `#fee2e2` | light | 4,82     | 4,5  | PASS                    | `style.base.css:2256?,2219` |

Bilans: **20 par (10 dark + 10 light) → PASS 14, FAIL 6**
(dark: D1, D2×2, D3; light: th 4,08, badge-warn 4,43).
Fullerenowe dane per strona w `C:\Users\blody\AppData\Local\Temp\opencode\faza1-ALL.json`
(artefakt roboczy, poza repo; do odtworzenia skryptem `faza1-contrast.cjs` z `ONLY`).

## 6. DOM Contract Manifest (§7c)

- Plik: `docs/plans/dom-manifest-baseline.json` (jedyny nowy plik w repo z tej fazy).
- Liczniki: 32 pliki HTML, 243 JS, **409 id, 478 klas, 11 data-\*, 181 onclick,**
  **513 getElementById, 217 querySelector, kontrakt `--excel-*`: 19 zadeklarowanych / 19 używanych**.
- Generator: `C:\Users\blody\AppData\Local\Temp\opencode\dom-manifest.cjs` (one-shot, poza repo).
- Zasada diff: każda różnica po paczce = uzasadnienie + GO.

## 7. Baseline console/network (§7c)

Z 10 przejść (5 stron × 2 motywy, izolacja §1): **0 console errors, 0 failed requests,
0 odpowiedzi HTTP ≥ 400**. Jeden timeout nawigacji `rury/light` (30 s) minął po
powtórce z limitem 60 s — przyczyna po stronie wydajności startu serwera testowego,
nie aplikacji (kolejne 9 przejść czyste). Nowe błędy console/network po paczkach = blokada GO.

## 8. Test parity dark ↔ light (§7d, wstępnie)

Każdy mierzony komponent ma odpowiednik w obu motywach (matrix §3).
Wykryte asymetrie do wyrównania w P0–P8: D7/L8 (selected/filtry), D3 (primary w dark
słabszy niż w light 4,47 vs 6,29), D1 vs L-ok (muted w dark FAIL, w light PASS).

## 9. Wniosek Fazy 1

Dowody zebrane: 16 screenshotów, matrix 8×2 (+ stany: w większości luki),
9 wpisów D + 1 wpis L8, 20 par WCAG (14 PASS / 6 FAIL), manifest (409/478/513/217,
excel 19/19), console/network 0/0. **P0 GATE: brak GO na P1** — najpierw luki §1b
(K-roki, oferta, cennik, PZ, modale, toasty, dropdowny, Excel modal, UPM/print, admin)
oraz jawne GO użytkownika.
