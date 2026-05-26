---
name: oferty-pv-patterns
description: Wzorce i konwencje projektowe dla WITROS Oferty PV — CSS, JS komponenty, architektura modułów
---

# Wzorce projektowe Oferty PV

## CSS Variable Naming Convention

Wszystkie zmienne CSS w `public/css/style.css` w bloku `:root`:

### Kolory tła
```
--bg-primary: #0a0e1a;       // główne tło strony
--bg-secondary: #111827;      // tło headerów, sidebarów
--bg-card: #111827;           // tło kart
--bg-glass: #141a2a;          // tło glassmorphism
--bg-tertiary: #1e2530;       // inputy, headery tabel
--bg-deep: #0d1520;           // darkniejsze panele (studnie)
--bg-hover: #1e1e4a;          // hover dla indygo elementów
--bg-tile: #1a2536;           // tła kafelków (studnie)
--bg-input: #1e2d42;          // tła inputów (studnie)
```

### Kolory tekstu
```
--text-primary: #f1f5f9;      // główny tekst
--text-secondary: #94a3b8;    // drugorzędny tekst
--text-muted: #64748b;        // najjaśniejszy tekst
--accent-text: #a5b4fc;       // tekst na aktywnych elementach
```

### Kolory akcentów
```
--accent: #6366f1;            // indygo — główny akcent
--accent-hover: #818cf8;      // hover akcentu
--accent-glow: #2e2b6e;       // glow efekt
--accent2: #8b5cf6;           // purpurowy (gradienty)
--accent-bg: #161640;         // tło aktywnych elementów
--accent-bg-hover: #22225a;
--accent-border: #4d4da0;
--accent-border-dim: #2e2e75;
```

### Kolory semantyczne
```
--success: #10b981;           // zielony
--success-bg: #0d2a20;
--success-bg-hover: #0f3328;
--danger: #ef4444;            // czerwony
--danger-hover: #f87171;
--danger-bg: #3a1515;
--danger-bg-hover: #251010;
--danger-border: #7a3030;
--warn: #f59e0b;              // żółty/amber
--warn-bg: #2d1a08;
--warn-border: #5a3010;
```

### Inne
```
--shadow-color: #080808;      // kolor cienia
--scrollbar-track: #0f172a;
--scrollbar-thumb: #3730a3;
--scrollbar-thumb-hover: #4f46e5;
--highlight-bg: #2d2510;      // 1m pipe highlight
```

## CSS Patterns

### Karta (Card)
```css
.card {
    background: var(--bg-card);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius, 12px);
    padding: 0.8rem 1rem;
    box-shadow: var(--shadow);
}
```

### Przycisk bazowy
```css
.btn-base {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    border-radius: var(--radius-sm, 8px);
    font: 500 0.8rem 'Inter', sans-serif;
    cursor: pointer;
    transition: var(--transition);
}
```

### Glassmorphism
```css
.glass {
    background: var(--bg-glass);
    backdrop-filter: blur(16px) saturate(1.2);
    border: 1px solid var(--border-glass);
}
```

### Sticky header / toolbar
```css
.sticky-bar {
    position: sticky;
    z-index: 40;
    background: var(--bg-secondary);
    padding: 0.3rem 0.6rem;
    border-bottom: 1px solid var(--border-glass);
}
```

## JS Patterns

### Zamiast inline style — użyj klasy CSS
```js
// ❌ ŹLE
element.style.color = '#34d399';
element.style.background = 'rgba(16,185,129,0.1)';

// ✅ DOBRZE
element.classList.add('text-success');
element.classList.add('bg-success-soft');
```

### Lista klas CSS dla dynamicznych kolorów
```css
.text-success { color: var(--success); }
.text-danger { color: var(--danger); }
.text-warn { color: var(--warn); }
.text-accent { color: var(--accent-hover); }

.bg-success-soft { background: var(--success-bg); }
.bg-danger-soft { background: var(--danger-bg); }
.bg-warn-soft { background: var(--warn-bg); }
.bg-hover { background: var(--bg-hover); }
```

### Toast notification
```js
// showToast(message, type)  gdzie type = 'success' | 'error' | 'info'
showToast('Zapisano pomyślnie', 'success');
```

### Confirm dialog
```js
const confirmed = await appConfirm('Czy na pewno chcesz usunąć?');
if (confirmed) { /* ... */ }
```

## Moduły — kolory akcentów

| Moduł | Hex akcentu | Zmienna `--nav-accent` | Zmienna `--nav-glow` |
|-------|-------------|----------------------|---------------------|
| Rury | `#6366f1` | `#6366f1` | `#0d2a20` |
| Studnie | `#10b981` | `#10b981` | `#0d2b22` |
| Kartoteka | `#f59e0b` | `#f59e0b` | — |
| Zlecenia | `#ec4899` | `#ec4899` | — |

Konfiguracja w `public/js/spa/router.js` (linie 27-64).

## Tile type colors (studnie)

```css
.tile[data-type='dennica']           { --tile-accent: #10b981; }
.tile[data-type='krag']              { --tile-accent: #6366f1; }
.tile[data-type='konus']             { --tile-accent: #f59e0b; }
.tile[data-type='plyta_din']         { --tile-accent: #ec4899; }
.tile[data-type='plyta_redukcyjna']  { --tile-accent: #8b5cf6; }
.tile[data-type='pierscien_odciazajacy'] { --tile-accent: #06b6d4; }
.tile[data-type='avr']               { --tile-accent: #64748b; }
.tile[data-type='uszczelka']         { --tile-accent: #84cc16; }
```

## Responsive breakpoints

| Breakpoint | Zmiana |
|-----------|--------|
| 1400px | Well app: 3 kolumny → 300px sidebar |
| 1200px | Well app: ukryj diagram, 2 kolumny |
| 1100px | Zlecenia: ukryj lewy panel |
| 900px | Well app: 1 kolumna |
| 860px | Offer cards: stack |
| 768px | Formularze 2-kolumnowe, mniejszy header |
| 700px | Landing page: karty stack, index: logo mniejsze |
| 480px | Bardzo kompaktowe widoki |

## Print

`@media print` w `style.css` (linia 2246) resetuje ciemny motyw na jasny.
Drukowanie przez `silentPrint(htmlString)` w `printManager.js`.
