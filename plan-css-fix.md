# Plan naprawy 27 problemów CSS — Oferty PV

## Priorytety: ❌ krytyczne → ⚠️ ostrzeżenia → ℹ️ kosmetyka

---

### ❌ Krok 1: Dodaj brakującą zmienną `--shadow` do `:root`
**Pliki:** `public/css/style.css`
**Co zmienić:** Dodać `--shadow: var(--shadow-md);` do bloku `:root` (ok. linii 106, po `--shadow-lg`). `--shadow` jest używane w `.card` (473), `.product-dropdown` (1079), `.modal` (2229) ale nigdzie niezdefiniowane.
**Ryzyko:** Niskie — dodanie brakującej zmiennej, karty/dropdowny/modal zaczną wyświetlać cień.

### ❌ Krok 2: Dodaj brakujące `--bg` i `--text` do `:root` lub popraw w rury.css
**Pliki:** `public/css/rury.css`, `public/css/style.css`
**Co zmienić:** W rury.css (266,268) użyto `var(--bg)` i `var(--text)` — takich zmiennych nie ma. Dodać aliasy w `:root` style.css: `--bg: var(--bg-primary); --text: var(--text-primary);` albo zmienić w rury.css na `var(--bg-primary)` / `var(--text-primary)`.
**Ryzyko:** Niskie — edytor długości w rury przestanie być przezroczysty.

### ❌ Krok 3: Zdefiniuj klasę `.nav-btn` w style.css
**Pliki:** `public/css/style.css`
**Co zmienić:** W media query (style.css:2436) jest `.nav-btn { padding: 0.4rem 0.7rem; font-size: 0.78rem; }` ale `.nav-btn` nie ma nigdzie zdefiniowanej klasy bazowej. Dodać przed media query: `.nav-btn { display: inline-flex; align-items: center; gap: 0.45rem; padding: 0.35rem 0.8rem; cursor: pointer; border: none; background: none; color: var(--text-secondary); }`.
**Ryzyko:** Niskie — klasa używana tylko w HTML+JS, nadanie domyślnych stylów nie zepsuje istniejących .nav-tile.

### ❌ Krok 4: Ujednolić `.action-btn` — usunąć konflikt style.css vs zlecenia.css
**Pliki:** `public/css/style.css`, `public/css/zlecenia.css`
**Co zmienić:** style.css definiuje `.action-btn` jako mały kwadrat 34×34px, zlecenia.css jako przycisk z paddingiem. To dwa różne konteksty. Przemianować wersję ze zlecenia.css na `.action-btn-zlecenia` (lub `.small-action-btn`) i zostawić tylko w zlecenia.css.
**Ryzyko:** Średnie — trzeba sprawdzić HTML zleceń czy używa `.action-btn`.

### ❌ Krok 5: Ujednolić `.status-badge` — usunąć konflikt style.css vs zlecenia.css
**Pliki:** `public/css/style.css`, `public/css/zlecenia.css`
**Co zmienić:** style.css: border-radius:20px, padding:0.3rem 0.7rem; zlecenia.css: border-radius:10px, padding:0.35rem 0.8rem, box-shadow. Zrobić jedną definicję w style.css, a w zlecenia.css zostawić tylko rozszerzenia (`.status-draft` itp.) bez nadpisywania bazowego `.status-badge`.
**Ryzyko:** Średnie — może zmienić wygląd badge w zleceniach.

### ❌ Krok 6: Ujednolić `calc(100vh - X)` — header height
**Pliki:** `public/css/spa.css`, `public/css/studnie.css`, `public/css/style.css`
**Co zmienić:** Ustalić header-height = 57px (tyle ma `.header-inner` w style.css:264). W spa.css: zmienić 52px → 57px. W studnie.css: zmienić 58px → 57px. Dodać komentarz /* header-height: 57px */.
**Ryzyko:** Niskie-średnie — może przesunąć layout o 1-5px. Łatwo cofnąć.

---

### ⚠️ Krok 7: Usuń duplikację wizarda — usuń wizard z studnie.css, zostaw w style.css
**Pliki:** `public/css/studnie.css`
**Co zmienić:** Wizard (~500 linii) jest w całości skopiowany do studnie.css z drobną różnicą: `border: 2px solid var(--border)` (studnie:941) vs `var(--bg-tertiary)` (style:2807). Usunąć duplikację z studnie.css (linie ~890-1000). Różnicę w border naprawić na `var(--border)` w style.css lub dodać override w studnie.css jako 1-liner.
**Ryzyko:** Średnie — można przypadkiem usunąć za dużo. Trzeba precyzyjnie wyciąć.

### ⚠️ Krok 8: Usuń duplikat `.text-warn` z style.css
**Pliki:** `public/css/style.css`
**Co zmienić:** `.text-warn` zdefiniowany 2 razy: linia 163 i linia 610. Usunąć drugi (610).
**Ryzyko:** Minimalne — identyczne definicje.

### ⚠️ Krok 9: Przenieś utility klasy do style.css, usuń duplikaty z studnie.css i rury.css
**Pliki:** `public/css/studnie.css`, `public/css/rury.css`, `public/css/style.css`
**Co zmienić:** Klasy `.flex-wrap-start`, `.flex-1-180`, `.p-6-12` itp. są zduplikowane w studnie.css i rury.css. Dodać je raz w style.css (sekcja utilities), usunąć z obu modułów.
**Ryzyko:** Niskie — identyczne definicje, kolejność ładowania style.css jest pierwsza.

### ⚠️ Krok 10: Napraw override `.wizard-step.active` w rury.css
**Pliki:** `public/css/rury.css`
**Co zmienić:** rury.css:771-773 nadpisuje `.wizard-step.active { padding-bottom: 4rem; }`. Dodać klasę `.rury-wizard-step` lub zmienić na bardziej konkretny selektor, żeby nie nadpisywać globalnego.
**Ryzyko:** Niskie — rury potrzebuje więcej paddingu w wizardzie, to zamierzony override, ale brudny.

### ⚠️ Krok 11: Usuń duplikat `--pink` z `:root`
**Pliki:** `public/css/style.css`
**Co zmienić:** `--pink: #ec4899` zdefiniowane w linii 100 i 125. Usunąć linię 125 (zostawić tę z innymi kolorami akcentowymi).
**Ryzyko:** Minimalne — identyczne wartości.

### ⚠️ Krok 12: Usuń nadpisywanie `--radius-md` / `--radius-lg` z index.css
**Pliki:** `public/css/index.css`
**Co zmienić:** index.css:33-34 nadpisuje `--radius-md: 16px; --radius-lg: 24px;` — te same wartości co w style.css:121-122. Usunąć z index.css :root.
**Ryzyko:** Minimalne — identyczne wartości.

### ⚠️ Krok 13: Zamień `--accent-glow` na nowszy odpowiednik we wszystkich użyciach
**Pliki:** `public/css/style.css`, `public/css/index.css`
**Co zmienić:** `--accent-glow` (zdefiniowane w style:130 jako deprecated) używane w 7+ miejscach (style:643,648,758; index:143,210,258,453,461,608). Zamienić na `var(--shadow-color)` lub konkretny kolor `#2e2b6e` (obecna wartość) z komentarzem // TODO: replace with shadow-color.
**Ryzyko:** Niskie — wartość pozostaje ta sama, zmienia się tylko zmienna.

### ⚠️ Krok 14: Zredukuj `!important` — zacznij od `.btn-order-save` (12x)
**Pliki:** `public/css/style.css`
**Co zmienić:** `.btn-order-save` (681-692) ma 12x `!important`. Zwiększyć specyficzność selektora (np. `button.btn-order-save`) i usunąć `!important`. Zrobić to samo dla linii 695-699 (hover).
**Ryzyko:** Średnie — trzeba sprawdzić, czy nie ma konfliktów z innymi regułami. Najpierw zrobić `.btn-order-save`, potem resztę w osobnych krokach.

### ⚠️ Krok 15: Dodaj globalną klasę `.hidden` do style.css
**Pliki:** `public/css/style.css`
**Co zmienić:** `.hidden` istnieje tylko w index.css (1093-1095). Dodać `.\hidden { display: none !important; }` do style.css (po utility classes), żeby działała we wszystkich modułach.
**Ryzyko:** Minimalne — `.hidden` jako naked class nie konfliktuje z `.card-content.hidden` itp.

### ⚠️ Krok 16: Ogranicz `will-change: transform` — zostaw tylko tam gdzie potrzeba
**Pliki:** `public/css/style.css`, `public/css/index.css`, `public/css/studnie.css`
**Co zmienić:** `will-change: transform` w 3 miejscach: style.css:2768 (.wizard-step-dot), index.css:359 (.launch-icon), studnie.css:1990 (.prz-field-angle). W większości przypadków niepotrzebne — usuć z .wizard-step-dot i .launch-icon (nie animowane ciągle). Zostawić w .prz-field-angle.
**Ryzyko:** Niskie — will-change to tylko optymalizacja, jej brak nie psuje działania.

### ⚠️ Krok 17: Ujednolić używanie fallbacków w `var()` — dodać fallbacki wszędzie lub usunąć z rury.css
**Pliki:** `public/css/rury.css`
**Co zmienić:** rury.css:18 używa `var(--radius-md, 16px)` z fallbackiem. Reszta CSS nie używa fallbacków. Usunąć fallback `, 16px` dla spójności (zmienna i tak istnieje w :root).
**Ryzyko:** Minimalne.

---

### ℹ️ Krok 18: Usuń referencje do nieistniejącego `pehd.css` i innych brakujących plików
**Pliki:** wszystkie `.html`
**Co zmienić:** Sprawdzić `<link>` do `pehd.css` i innych nieistniejących CSS. Usunąć lub dodać komentarz.
**Ryzyko:** Minimalne.

### ℹ️ Krok 19: Dodaj brakujący CSS dla email (jeśli potrzebny)
**Pliki:** `public/css/email.css` (nowy) lub istniejący plik
**Co zmienić:** Jeśli są szablony email bez CSS — dodać podstawowe style inline.
**Ryzyko:** Niskie — nowy plik, nie wpływa na istniejący kod.

### ℹ️ Krok 20-27: Pozostałe drobne duplikacje
**Pliki:** różne
**Co zmienić:** Drobne czyszczenie — usunięcie komentarzy, pustych reguł, nieużywanych selektorów.
**Ryzyko:** Minimalne.

---

## Uwagi wykonawcze
- **Po każdym kroku:** `npm run typecheck:frontend && npm run test:quick`
- **Każdy krok = osobny commit** z komunikatem np. `fix(css): add missing --shadow variable`
- **Po commicie:** `npx graphify update` (jeśli dostępne)
- **Priorytet:** ❌ Kroki 1-6 → ⚠️ Kroki 7-17 → ℹ️ Kroki 18-20
