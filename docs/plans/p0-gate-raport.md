# P0 GATE — raport zamykający (tokeny, coverage, manifest)

> Plan: `docs/plans/modernizacja-ui-cala-aplikacja.md` (§5 P0, definicja 100%).
> Wejście: `tests/studnie/themeTokensParity.test.ts`, `public/css/style.base.css`
> (`:root` = dark SSoT + `html[data-theme='light']`), `docs/plans/dom-manifest-baseline.json`,
> `docs/plans/faza1-inwentaryzacja.md`. Data: 2026-09-23. Bez commitów/pushy, bez DB/serwera.
> Niniejszy raport KOŃCZY P0 jako dokument (nie otwiera P1 — werdykt: NO-GO, patrz §9).

## 0. Fixy kontrastu dowiezione przed raportem (tokeny TYLKO)

6 par FAIL z fazy 1 §5 naprawionych EDYCJĄ WARTOŚCI tokenów w `public/css/style.base.css`
(zero geometrii, zero typografii, zero reguł komponentów, zero nowych tokenów).
Weryfikacja: `C:\Users\blody\AppData\Local\Temp\opencode\kontrast-verify.cjs` (czyta wartości
z pliku, nie zgaduje) — **11/11 ≥ 4,5:1** (7 par naprawionych + 4 regresyjne PASS).

| Para (faza1 §5)                             | Token (plik:linia po fixie)                                          | Przed → po      |
| ------------------------------------------- | -------------------------------------------------------------------- | --------------- |
| dark label muted → bg (`#111827`)           | `--text-muted` (`style.base.css:19`) `#64748b` → `#8a9cae`           | 3,73 → **6,29** |
| dark th muted → thead (`#1e2530`/`#1a2536`) | ten sam token                                                        | 3,24 → **5,47** |
| dark td muted → bg                          | ten sam token                                                        | 3,73 → **6,29** |
| dark btn-primary biały → accent             | `--accent` (`style.base.css:29`) `#6366f1` → `#5d60ee`               | 4,47 → **4,80** |
| light th muted → head (`#eaeef2`)           | `--text-muted` w light (`style.base.css:2197`) `#64748b` → `#52616f` | 4,08 → **5,46** |
| light badge-warn → warn-bg (`#fef3c7`)      | `--warn-strong` (`style.base.css:65`) `#996600` → `#8a5c00`          | 4,43 → **5,22** |

Towarzyszące (spójność tokenu, też tylko wartości): `--accent-rgb` (`style.base.css:74`)
`99,102,241` → `93,96,238` (wash'e `rgba()` w tej samej rodzinie co nowy `--accent`).
Żaden FAIL nie wymagał geometrii — nic nie zostawiono.

Ujawnione trade-offy (do P1, nie blokery P0):

- `--accent` jest też kolorem TEKSTU w dark (~15 użyć `color: var(--accent)`). Przyciemnienie
  obniżyło te pary 3,97 → ~3,6–3,7 — były już poniżej 4,5 przed fixem (stan zastany, głównie
  duże teksty/UI). Docelowo tekst ma używać `--accent-text`, nie `--accent` (mapowanie P1).
- `.btn-primary:hover` używa `--accent-hover #818cf8` (jaśniejszy; biały tekst ~3,4) —
  stan hover nie był mierzony (matrix: Hover = luka), do pokrycia w P1.

## 1. Token inventory (liczby)

| Zbiór                                                      | Liczba                                                                                            | Źródło                                      |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Tokeny w `:root` (dark SSoT)                               | **206**                                                                                           | `style.base.css:3` (~blok `:root`)          |
| Definicje w blokach `html[data-theme='light']`             | **98**                                                                                            | ten sam plik (suma wszystkich bloków light) |
| Tokeny `:root` bez nadpisania light (pokryte listą SHARED) | **108**                                                                                           | skale, palety, rgb, washe, cmp, geometria   |
| Kontrakt `--excel-*`                                       | **19 zadeklarowanych / 19 używanych**                                                             | manifest + `excelThemeTokens.test.ts`       |
| Skala typografii                                           | **15 `fs-*` + 7 `fw-*`**                                                                          | SHARED, identyczne w obu motywach           |
| Manifest DOM                                               | 32 HTML, 243 JS, 409 id, 478 klas, 11 data-\*, 181 onclick, 513 getElementById, 217 querySelector | `dom-manifest-baseline.json`                |

Testy kontraktu (po fixach, wartości nie ruszają nazw): `themeTokensParity` 3/3,
`excelThemeTokens` 4/4, `excelDynamicCss` 3/3 — **10/10 PASS**.

## 2. LIGHT + DARK values (statusy i akcent — pełna tabela)

| Token                                                    | DARK (`:root`)                                            | LIGHT (`html[data-theme='light']`)                        |
| -------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------- |
| `--success` / `-hover` / `-bg` / `-bg-hover` / `-border` | `#10b981` / `#34d399` / `#0d2a20` / `#0f3328` / `#145d3a` | `#047857` / `#047857` / `#dcfce7` / `#bbf7d0` / `#86efac` |
| `--success-strong` / `-bg-soft`                          | `#006600` / `#e6f7e6`                                     | SHARED (ta sama wartość)                                  |
| `--danger` / `-hover` / `-bg` / `-bg-hover` / `-border`  | `#ef4444` / `#f87171` / `#3a1515` / `#251010` / `#7a3030` | `#dc2626` / `#b91c1c` / `#fee2e2` / `#fecaca` / `#fca5a5` |
| `--danger-strong` / `-bg-soft`                           | `#cc0000` / `#fce8e8`                                     | SHARED                                                    |
| `--warn` / `-hover` / `-bg` / `-border`                  | `#f59e0b` / `#fbbf24` / `#2d1a08` / `#5a3010`             | `#b45309` / `#b45309` / `#fef3c7` / `#fcd34d`             |
| `--warn-strong` / `-bg-soft` / `-bg-light`               | `#8a5c00` / `#fff3e0` / `#fffbeb` (po fixie §0)           | SHARED                                                    |
| `--blue` / `-hover`                                      | `#3b82f6` / `#60a5fa`                                     | `#2563eb` / `#1d4ed8`                                     |
| `--accent` / `-hover` / `-strong` / `-text` / `-bg`      | `#5d60ee` / `#818cf8` / `#4f46e5` / `#a5b4fc` / `#161640` | `#4f46e5` / `#4338ca` / `#4338ca` / `#4338ca` / `#eef2ff` |
| `--text-primary` / `-secondary` / `-muted`               | `slate-100` / `slate-400` / **`#8a9cae`**                 | `#0f172a` / `#475569` / **`#52616f`**                     |
| Rola info                                                | brak `--info-*`; info = rodzina `--blue-*`                | jw.                                                       |

## 3. Semantic mapping (rola → token)

Tekst: `text-primary/secondary/muted/heading`, `--accent-text`, `--*-strong` (teksty statusów
na pastelach), `--text-danger` (= `--danger`). Powierzchnie: `bg-primary/secondary/tertiary/
-deep/hover/tile/input/card/glass` + `--*-bg`. Bordury: `--border/border-glass/border-subtle`

- `--*-border`. Akcent: `--accent/accent-hover/accent-strong/accent-text/accent-bg(-hover)`.
  Niezgodność z konwencją (do P1, bez zmian w tej paczce): ~15 użyć `color: var(--accent)`
  (rolo powinien pełnić `--accent-text` w dark) oraz D8 — 4 bliskie tła dark
  (`bg-secondary/glass/tile/input`) i jasne `*-bg-soft` w korzeniu dark (do audytu użyć w P0/P3).

## 4. Coverage vs definicja 100% (6 kryteriów z planu)

1. Każdy nowy token semantyczny ma LIGHT + DARK — **OK (próżniowo)**: paczka nie dodała
   tokenów; istniejące: 98 z override + 108 ze SHARED, test parity PASS.
2. Każdy komponent używający roli korzysta z tokenu — **NIE**: 27 literałów hex w JS
   w 4 plikach (patrz §5).
3. Brak nowych hardcoded literals dla istniejących ról — **OK dla paczki** (zero nowych;
   resztki w §5 to stan zastany, nie regresja).
4. Brak gradientów/glass/washe poza wyjątkiem — **NIE**: resztki D4/D5 (patrz §5), decyzja = P3.
5. Brak tokenów zdefiniowanych lecz nieużywanych bez uzasadnienia — **CZĘŚCIOWO**: test
   pokrywa tylko martwe tokeny light-only (PASS); pełny orphan-skan `:root` nie istnieje — luka.
6. Brak komponentu korzystającego z legacy color zamiast tokenu — **NIE** (pliki z §5 + D6).

## 5. Orphan / hardcoded audit (resztki do P3)

- JS hardcoded hex (stan zastany): `shared/formatters.js` 16x (skala slate na sztywno),
  `admin/mlPanels.js` 5x, `studnie/excelTableRenderer.js` 5x, `import-export/shared/
xlsxImportShared.js` 1x (`#039`). Test `excelDynamicCss` PASS (allowlista), więc to
  resztki do przepisania na tokeny, nie naruszenia gate'a Excela.
- CSS: w `style.base.css` **0 hexów poza blokami tokenów** (czysto). Resztki gradient/glass:
  D4 (gradienty: `style.responsive.css:174-178,416-418,291-295,1116,1588/1595/1626`,
  `style.base.css:539-541,1712`, `style.utilities.css:644-648,809/826/846`,
  `studnie.css:1500,1638,4675,5037`, `printModal.css:34,187`, `studnie/modal.css:1041`)
  i D5 (blur: `style.responsive.css:184`, `zlecenia.css:386-387`, `studnie.css:1738-1739,
2014-2015`, `studnie/modal.css:132-133`, `printModal.css:29`) — do decyzji P3 (kasacja).
- D6: disabled/locked przez inline `opacity` w 12 miejscach JS (lista w fazie 1 §4) —
  brak klasy + wartości per motyw, do P1/P4.
- `baseline-P0.json` w `docs/plans/` to baseline WYDAJNOŚCIOWY (p50/p95 API), nie tokenowy —
  kolizja nazw z P0 planu; nie jest dowodem coverage.

## 6. Focus token — BRAK (D10)

Zero `--focus*` w CSS. Istnieje tylko globalne `*:focus-visible { outline: 2px solid
var(--accent); }` (`style.base.css:433`) bez pomiaru widoczności w obu motywach.
P0 GATE wymaga focus token — **do domknięcia przed GO** (propozycja: `--focus-ring`
per motyw; po przyciemnieniu `--accent` outline w dark do re-pomiaru).

## 7. Status mapping / typography mapping

- Status: pełne pary LIGHT+DARK w §2 (4 rodziny × tło/tekst/border) — **OK**.
- Typografia: `fs-3xs 0.55rem … fs-2xl 1rem, fs-3xl 1.1rem` + `fw-light 300 … fw-black 900`,
  SHARED (jedna wartość, oba motywy) — **OK**. Geometry Lock / Typography Lock nienaruszone
  (paczka nie zmienia rozmiarów ani wag).

## 8. Luki matrix (K1–K5, modale, toasty, Excel, UPM, admin)

Stan z fazy 1 §1b/§3 bez zmian: pokryte tylko 5 stron × 2 motywy (default states).
Niepokryte: kroki K1–K5 (rury i studnie), oferta, cennik, PZ, modale, toasty, otwarte
dropdowny, Excel modal, UPM/print, admin; stany hover/focus/active/disabled/selected/loading
w większości komórek matrix. **Luki muszą zostać dograne przed P1** (osobne GO na Fazę 1b).

## 9. Werdykt P0 GATE (per punkt → całość)

| Punkt GATE             | Werdykt                                             |
| ---------------------- | --------------------------------------------------- |
| token inventory        | **GO** (§1, liczby + manifest)                      |
| LIGHT values           | **GO** (§2)                                         |
| DARK values            | **GO** (§2, w tym fixy §0)                          |
| semantic mapping       | **GO z uwagą** (§3; `--accent`-jako-tekst do P1)    |
| token coverage = 100%  | **NO-GO** (§4: kryteria 2, 4, 5, 6)                 |
| orphan/hardcoded audit | **GO z uwagą** (zinwentaryzowane w §5, fix = P1/P3) |
| focus token            | **NO-GO** (§6: brak `--focus-*`)                    |
| status token mapping   | **GO** (§7)                                         |
| typography mapping     | **GO** (§7)                                         |

**Całość: NO-GO na P1.** Do domknięcia przed GO: (a) `--focus-*` + pomiary w obu motywach,
(b) przepisanie 27 hexów z JS na tokeny (kryteria 2/6), (c) decyzja P3 dla D4/D5 (kryterium 4),
(d) orphan-skan `:root` (kryterium 5), (e) dogranie luk matrix z §8. Kontrast WCAG dla
zmierzonych par: 11/11 ≥ 4,5:1 (dowód: skrypt z §0).
