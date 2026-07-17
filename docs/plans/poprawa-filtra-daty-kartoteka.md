# Plan: Poprawa UX filtra daty (zakres własny)

## Problem

Kliknięcie "Zakres" rozwija w tym samym wierszu dwa inputy `<input type="date">` (2×135px = ~310px). Przepełnia to flex container z `flex-wrap: wrap` → cała sekcja daty przeskakuje do nowego wiersza. Efekt: brzydki, gwałtowny, nieprofesjonalny.

## Rozwiązanie: Popover zamiast inline expansion

Zamiast pokazywać inputy w tym samym flex wierszu, kliknięcie "Zakres" otwiera mały floating popover pod przyciskiem. Popover zawiera dwa inputy date + etykiety "Od" / "Do".

### Zalety

- Brak przesunięć layoutu — filter bar pozostaje stabilny
- 100% responsive (popover dostosowuje się pozycją)
- Niskie ryzyko — nie zmienia logiki filtrów, tylko UI

### Pliki do modyfikacji

| #   | Plik                               | Zmiana                                                                                                                                   |
| --- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `public/kartoteka.html`            | Usunąć `<span id="pv-date-range-wrap">` z sekcji date filter; dodać kontener `<div id="pv-date-popover">` poza filter barem (przed main) |
| 2   | `public/js/sales/kartotekaInit.js` | Dodać logikę pozycjonowania + zamykania popovera (click outside, Escape)                                                                 |
| 3   | `public/js/sales/pvSalesUi.js`     | Drobna aktualizacja `_syncFilterUI()` — zamiast show/hide date-range-wrap, obsługa klasy `.active` na przycisku Zakres + popover         |

### Backend/CSS/nowe pliki: brak

---

## Szczegóły implementacji

### HTML (`kartoteka.html`)

1. Z date filter section usunąć:

```html
<span id="pv-date-range-wrap" style="display:none; gap:0.4rem; align-items:center;">
    <input type="date" id="pv-date-from" ... />
    <span>–</span>
    <input type="date" id="pv-date-to" ... />
</span>
```

2. Dodać poza filter barem (np. przed `<section class="card pv-card">`):

```html
<div
    id="pv-date-popover"
    style="display:none; position:fixed; z-index:1000; background:var(--bg-card); border:1px solid var(--border-glass); border-radius:12px; padding:0.75rem 1rem; box-shadow:0 8px 32px rgba(0,0,0,0.3);"
>
    <div style="display:flex; gap:0.75rem; align-items:center;">
        <div style="display:flex; flex-direction:column; gap:0.25rem;">
            <label
                for="pv-date-from"
                style="font-size:0.65rem; color:var(--text-muted); font-weight:600; text-transform:uppercase;"
                >Od</label
            >
            <input
                type="date"
                id="pv-date-from"
                class="form-input form-input-sm"
                style="font-size:0.78rem; width:140px;"
            />
        </div>
        <div style="display:flex; flex-direction:column; gap:0.25rem;">
            <label
                for="pv-date-to"
                style="font-size:0.65rem; color:var(--text-muted); font-weight:600; text-transform:uppercase;"
                >Do</label
            >
            <input
                type="date"
                id="pv-date-to"
                class="form-input form-input-sm"
                style="font-size:0.78rem; width:140px;"
            />
        </div>
    </div>
</div>
```

### JS (`kartotekaInit.js`)

Zastąpić `initAdvancedFilterEvents` — logika "Zakres":

```js
function initAdvancedFilterEvents(ui) {
    // ... reszta bez zmian ...

    const rangeBtn = document.getElementById('pv-date-range-btn');
    const popover = document.getElementById('pv-date-popover');
    if (rangeBtn && popover) {
        rangeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = popover.style.display !== 'none';
            if (isOpen) {
                hideDatePopover(ui, popover);
            } else {
                showDatePopover(ui, popover, rangeBtn);
            }
        });
        // Click outside
        document.addEventListener('click', (e) => {
            if (popover.style.display === 'none') return;
            if (
                !popover.contains(e.target) &&
                e.target !== rangeBtn &&
                !rangeBtn.contains(e.target)
            ) {
                hideDatePopover(ui, popover);
            }
        });
        // Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && popover.style.display !== 'none') {
                hideDatePopover(ui, popover);
            }
        });
    }
    // ... reszta ...
}

function showDatePopover(ui, popover, anchor) {
    const rect = anchor.getBoundingClientRect();
    popover.style.display = 'block';
    popover.style.left = rect.left + 'px';
    popover.style.top = rect.bottom + 6 + 'px';
    popover.style.transformOrigin = 'top left';
    // Animation via CSS transition (dodane inline lub klasa)
    popover.style.opacity = '0';
    popover.style.transform = 'translateY(-4px)';
    requestAnimationFrame(() => {
        popover.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
        popover.style.opacity = '1';
        popover.style.transform = 'translateY(0)';
    });
    ui.filters.date.mode = 'range';
    ui.filters.date.preset = '';
    ui._syncFilterUI();
    ui.filterLocalOffers();
}

function hideDatePopover(ui, popover) {
    popover.style.display = 'none';
    popover.style.opacity = '';
    popover.style.transform = '';
    // Jeśli oba puste → wyłączamy tryb range
    const from = document.getElementById('pv-date-from');
    const to = document.getElementById('pv-date-to');
    if (from && to && !from.value && !to.value) {
        ui.filters.date.mode = 'none';
        ui._syncFilterUI();
        ui.filterLocalOffers();
    }
}
```

### JS (`pvSalesUi.js`)

W `_syncFilterUI()` — usunąć logikę dla `#pv-date-range-wrap`, zastąpić:

```js
const rangeBtn = document.getElementById('pv-date-range-btn');
if (rangeBtn) {
    rangeBtn.classList.toggle('active', this.filters.date.mode === 'range');
    rangeBtn.classList.toggle('btn-secondary', this.filters.date.mode !== 'range');
}
// Popover widocznością steruje JS kliknięcia, nie _syncFilterUI
```

---

## Zachowanie

1. Kliknięcie "Zakres" → popover pojawia się pod przyciskiem z płynną animacją
2. Popover zawiera inputy "Od" i "Do" z labelkami
3. Zmiana wartości w inputach → `ui.onDateRangeChange()` → aktualizacja filtrów (tak jak teraz)
4. Kliknięcie poza popoverem lub Escape → zamyka popover
5. Jeśli oba inputy puste przy zamknięciu → wyłącza tryb zakresu
6. Ponowne kliknięcie "Zakres" → zamyka popover
7. Kliknięcie "Wyczyść" → zamyka popover + resetuje wartości

## Ryzyka i testowanie

| Ryzyko                                     | Mitigacja                                                                                                                   |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Popover poza ekranem (scroll, krawędź)     | `position:fixed` + left/top dynamiczne. Dla wąskich ekranów można dodać `right` zamiast `left` jeśli anchor po prawej.      |
| Popover nie zamyka się przy zmianie filtra | `clearFilters()` i `setDatePreset()` już wyłączają `mode: 'range'`. Dodać `popover.style.display = 'none'` w tych metodach. |
| Lucide icons w popoverze                   | Nie ma — same inputy.                                                                                                       |
