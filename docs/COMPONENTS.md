# Katalog Komponentów — WITROS Oferty PV

> Wersja: 1.0 | Data: 2026-06-20 | Źródło: analiza CSS (`public/css/`)

---

## 1. Design Tokens (zmienne CSS)

Wszystkie zmienne zdefiniowane w `:root` w `public/css/style.css`.

### Kolory

```css
/* Tła */
--bg-primary: #0a0e1a;
--bg-secondary: #111827;
--bg-card: #111827;
--bg-glass: #141a2a;
--bg-tertiary: #1e2530;
--bg-deep: #0d1520;
--bg-hover: #1e1e4a;
--bg-tile: #1a2536;
--bg-input: #1e2d42;

/* Tekst */
--text-primary: #f1f5f9;
--text-secondary: #94a3b8;
--text-muted: #64748b;

/* Akcenty */
--accent: #6366f1;       /* indigo */
--success: #10b981;      /* zielony */
--danger: #ef4444;       /* czerwony */
--warn: #f59e0b;         /* żółty */
--blue: #3b82f6;         /* niebieski */
--pink: #ec4899;         /* różowy (moduł zleceń) */
```

### Moduły — kolory akcentów

| Moduł | Klasa | `--logo-start` | `--logo-end` |
|-------|-------|---------------|-------------|
| Rury | `.logo-rury` | `--accent` (#6366f1) | `--accent2` (#8b5cf6) |
| Studnie | `.logo-studnie` | `--success` (#10b981) | `--success-hover` (#34d399) |
| Kartoteka | `.logo-kartoteka` | `--warn` (#f59e0b) | `--warn-hover` (#fbbf24) |
| Zlecenia | `.logo-zlecenia` | `--pink` (#ec4899) | `--pink-hover` (#f472b6) |

### Layout

```css
--radius: 12px;       /* główny */
--radius-sm: 8px;     /* mały */
--radius-md: 16px;    /* średni */
--radius-lg: 24px;    /* duży */

--transition: background-color 0.25s, border-color 0.25s, box-shadow 0.25s, transform 0.25s cubic-bezier(...);

--shadow-sm: 0 2px 8px rgba(0,0,0,0.1);
--shadow-md: 0 4px 16px var(--shadow-color);
--shadow-lg: 0 8px 32px var(--shadow-color);
```

---

## 2. Header / Nawigacja

### `.header`

Sticky top bar, tło `--bg-secondary`, border-bottom, z-index 100.
```html
<header class="header">
  <div class="header-inner">
    <div class="header-left">...</div>
    <div class="header-center">...</div>
    <div class="header-right">...</div>
  </div>
</header>
```
**Responsywność:** 700px → flex wrap, 480px → centrowanie.

### `.logo`

Gradientowy tekst (accent→accent2) z ikoną SVG, font-weight 800.
```html
<div class="logo">
  <svg>...</svg>
  <span>WITROS Oferty</span>
</div>
```
Palety: `.logo-rury`, `.logo-studnie`, `.logo-kartoteka`, `.logo-zlecenia`.

### `.nav-tile`

Kafelkowe przyciski nawigacji w headerze. **Kluczowy wzorzec UI.**

| Stan | Wygląd |
|------|--------|
| Default | `border: 1px solid var(--border)`, tło `--border-glass` |
| Hover | `translateY(-2px)`, `box-shadow` |
| `.active` | kolor `--nav-accent` (zmienny per moduł), podkreślenie `::after` |
| `focus-visible` | outline 2px accent |

```html
<a class="nav-tile" href="/rury">
  <span class="nav-tile-icon">${renderIcon('pipe')}</span>
  <span class="nav-tile-text">RURY</span>
</a>
```
**Responsywność:** 700px → `.nav-tile-text` hidden (tylko ikony).

---

## 3. Karty (Cards)

### `.card` / `.card-sm`

Podstawowy kontener blokowy, tło `--bg-card`, border, radius.

```html
<div class="card">
  <div class="card-title">
    <span>Tytuł</span>
    <span class="badge">3</span>
  </div>
  <div class="card-content">...</div>
</div>

<!-- kompakt -->
<div class="card card-sm">
  <div class="card-title-sm">Tytuł</div>
</div>
```

| Wariant | Padding |
|---------|---------|
| `.card` | `0.8rem 1rem` |
| `.card-sm` | `0.6rem 0.8rem` |
| `.card-compact` | `0.7rem 1rem !important` |

### `.card-header-row`

Flex row space-between z marginesem dolnym.
```html
<div class="card-header-row">
  <h3>Tytuł</h3>
  <button class="btn btn-sm btn-primary">Akcja</button>
</div>
```

### `.user-role` / `.role-admin` / `.role-pro` / `.role-user`

Oznaczenia ról użytkownika — inline badge z kolorem.

| Rola | Klasa | Kolor |
|------|-------|-------|
| Admin | `.role-admin` | czerwony `--danger` |
| Pro | `.role-pro` | żółty `--warn` |
| User | `.role-user` | zielony `--success` |

---

## 4. Przyciski (Buttons)

### `.btn` (bazowy)

```html
<button class="btn btn-primary">Zapisz</button>
<button class="btn btn-secondary">Anuluj</button>
<button class="btn btn-danger">Usuń</button>
<button class="btn btn-success">Akceptuj</button>
<button class="btn btn-sm">Mały</button>
```

| Wariant | Tło | Kolor tekstu |
|---------|-----|--------------|
| `.btn-primary` | gradient `accent→accent2` | #fff |
| `.btn-secondary` | `--bg-glass` | `--text-secondary` |
| `.btn-danger` | `--danger-bg` | `--danger` |
| `.btn-success` | `--success-bg` | `--success` |
| `.btn-sm` | padding `0.35rem 0.7rem` | font 0.75rem |
| `.btn:disabled` | opacity 0.5, grayscale | — |

### `.btn-icon`

Okrągły przycisk z ikoną (tylko ikona, bez tekstu).

```html
<button class="btn-icon" onclick="edit()">${renderIcon('pencil')}</button>
```

### `.btn-order-save`

Specjalny przycisk zapisu oferty — zielony, z `!important` (do refaktora).

### `.action-btn` / `.action-btn-edit` / `.action-btn-delete`

Akcyjne przyciski w tabelach (tło `--bg-tertiary`, hover `--danger`/`--accent`).

```html
<button class="action-btn action-btn-edit">Edytuj</button>
<button class="action-btn action-btn-delete">Usuń</button>
```

---

## 5. Formularze

### `.form-group` / `.form-label`

```html
<div class="form-group">
  <label class="form-label">Nazwa</label>
  <input class="form-input" placeholder="Wpisz nazwę...">
</div>
```

**Kompakt:** `.form-group-sm` (margin-bottom 0.4rem), `.form-label-sm` (0.68rem, uppercase).

### `.form-input` / `.form-select` / `.form-textarea`

Wspólne style inputów.

| Wariant | Zastosowanie |
|---------|-------------|
| `.form-input` | text, number, email, etc. |
| `.form-select` | `<select>` z custom strzałką SVG |
| `.form-textarea` | `<textarea>` z resize vertical |
| `.form-input-sm` | kompakt: padding 0.35rem 0.55rem, font 0.8rem |

Focus: border-color → accent, box-shadow z glow.

### Grid formularzy

```html
<div class="form-row form-row-2">
  <div class="form-group">...</div>
  <div class="form-group">...</div>
</div>
```

| Klasa | Kolumny |
|-------|---------|
| `.form-row-2` | 1fr 1fr |
| `.form-row-3` | 1fr 1fr 1fr |
| `.form-row-4` | 1fr 1fr 1fr 1fr |

### `.edit-input`

Input inline-editable (tabela konfiguracyjna studni). Bez spinnerów number.

```html
<input class="edit-input" type="number" step="0.01" value="1.5">
```

### `.search-box`

Input z ikoną wyszukiwania.

```html
<div class="search-box">
  ${renderIcon('search')}
  <input class="form-input" placeholder="Szukaj...">
</div>
```

---

## 6. Tabele

### `.table-wrap`

Overflow-x auto wrapper dla tabel.

### Tabela bazowa

```html
<div class="table-wrap">
  <table>
    <thead>
      <tr><th>Kolumna</th></tr>
    </thead>
    <tbody>
      <tr><td>Wartość</td></tr>
    </tbody>
  </table>
</div>
```

- `thead th`: sticky header, uppercase, `--text-muted`, padding 0.25rem 0.4rem
- `tbody td`: padding 0.2rem 0.4rem, font 0.78rem
- `tbody tr:hover`: `--bg-hover`
- Scrollbar: custom thin (8px) `--scrollbar-track`/`--scrollbar-thumb`

### `.well-row-header` / `.well-details-row`

Rozwijane wiersze w tabeli ofert.

```html
<tr class="well-row-header" onclick="toggleWell(this)">
  <td>Nazwa studni</td>
</tr>
<tr class="well-details-row hidden">
  <td colspan="5">
    <div class="well-details-container">
      <div class="well-details-grid">...</div>
    </div>
  </td>
</tr>
```

### `.editable`

Klikana komórka w tabeli.

```html
<span class="editable" onclick="editCell(this)">1.5</span>
```

---

## 7. Badge / Tagi / Statusy

### `.badge` (w `.card-title`)

`font 0.7rem`, padding 0.15rem 0.5rem, border-radius 20px, `--bg-hover` + `--accent-hover`.

```html
<span class="badge">${count}</span>
```

### `.status-badge` (moduł zleceń)

Badge statusu oferty z SVG ikoną.

```html
<span class="status-badge status-draft">
  ${renderIcon('file-text')} Szkic
</span>
```

| Wariant | Kolor |
|---------|-------|
| `.status-draft` | `--warn` |
| `.status-accepted` | `--success` |

### `.cat-header`

Nagłówek kategorii w katalogu produktów.

```html
<div class="cat-header">
  ${renderIcon('folder')} Kategoria
  <span class="cat-count">(5)</span>
</div>
```

---

## 8. Modal / Overlay (JS-driven)

Brak dedykowanej klasy CSS `.modal` w plikach CSS — modal budowany inline w JS z:
- `const overlay = document.createElement('div')` z `position: fixed; z-index: 1000;`
- `const modal = overlay.querySelector('.modal-content')` lub inline HTML

**Wzorzec z kodu JS:**
```javascript
const overlay = Object.assign(document.createElement('div'), {
    style: `position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:1000;
            display:flex;align-items:center;justify-content:center;`
});
const modal = document.createElement('div');
modal.style = `background:var(--bg-card);padding:1.5rem;border-radius:var(--radius-md);
               max-width:500px;width:90%;max-height:80vh;overflow-y:auto;`;
```
**Sugestia refaktora:** dodać klasę `.modal-overlay` / `.modal-content` do CSS.

---

## 9. Tile / Kafelki

### `.tile` (w studnie.css)

Podstawowy kafelek w kreatorze studni.

```html
<div class="tile ${selected ? 'selected' : ''}" onclick="selectTile(this)">
  <div class="tile-icon">${icon}</div>
  <div class="tile-label">Nazwa</div>
  <div class="tile-price">${price} zł</div>
</div>
```

### `.param-tile`

Kafelek parametru (np. wymiary studni).

### `.well-list-item` / `.offer-list-item`

Elementy listy w sidebarze.

---

## 10. Zakładki (Tabs)

### `.catalog-tabs` / `.catalog-tab`

Zakładki katalogu produktów.

```html
<div class="catalog-tabs">
  <button class="catalog-tab active">Wszystkie</button>
  <button class="catalog-tab">Kategoria A</button>
  <button class="catalog-tab">Kategoria B</button>
</div>
```

### `.zlecenia-filter-tab` (moduł zleceń)

Filtry statusu zamówień.

---

## 11. Katalog produktów (Product Catalog)

### `.product-catalog`

Główny kontener katalogu.

### `.catalog-list`

Lista produktów jako flex column.

### `.catalog-diam-header`

Nagłówek grupy (np. "DN 1000") z zielonym akcentem `--success`.

### `.catalog-item-row`

Wiersz produktu z hoverem.

```html
<div class="catalog-item-row ${is1m ? 'catalog-item-1m' : ''}">
  <span class="catalog-item-row-name">Nazwa</span>
  <span class="catalog-item-row-meta">info</span>
  <span class="catalog-item-row-price">100 zł</span>
  <button class="catalog-item-add">+</button>
</div>
```

### `.catalog-item-1m`

Podświetlony wiersz (produkt z magazynu WŁ).

---

## 12. Oferty (Offer Cards)

### `.offer-card`

Karta oferty w dashboardzie.

```html
<div class="offer-card ${selected ? 'selected' : ''}">
  <div class="offer-card-content">
    <div class="offer-icon-wrapper">${icon}</div>
    <div class="offer-title-section">
      <div class="offer-title">OF-2024/001</div>
      <div class="offer-client">Klient</div>
    </div>
    <div class="offer-price-section">
      <div class="offer-price">15 000 zł</div>
    </div>
  </div>
</div>
```

### `.offer-status-indicator`

Status oferty (`.has-order` / `.no-order`).

---

## 13. Layout aplikacji (Studnie)

### `.well-app-layout`

3-kolumnowy grid: Diagram | Centrum | Lista studni.

```css
grid-template-columns: 350px 1fr 350px;
```

| Breakpoint | Zmiana |
|------------|--------|
| 1400px | 300px → 1fr → 300px |
| 1200px | 1fr → 240px (diagram hidden) |
| 900px | 1fr (wszystko w kolumnie) |

### `.well-app-layout.intro-mode`

Tryb wprowadzania — 1 kolumna, bez diagramu/sidebara.

### `.well-diagram-panel`

Panel diagramu SVG studni (lewa kolumna).

### `.wells-sidebar`

Lista studni (prawa kolumna).

### `.well-center-column`

Scrollowana zawartość centralna.

---

## 14. Auth / Login

### `.login-box` (index.css)

Karta logowania.

```html
<div class="login-box card">
  <h3>Logowanie</h3>
  <input type="text" placeholder="Użytkownik">
  <input type="password" placeholder="Hasło">
  <button class="login-btn">Zaloguj</button>
</div>
```

---

## 15. Zlecenia (Orders)

### `.zlecenia-page`

Kontener strony zleceń.

### `.zlecenia-stat-card`

Karta statystyk z hover glow.

### `.zlecenia-table`

Specyficzna tabela dla zleceń (inne style niż bazowa).

### `.zlecenia-batch-bar`

Batch action bar (zaznaczanie wielu zleceń).

### `.order-num` / `.order-num-missing`

Numer zamówienia (wyróżniony / brakujący).

### `.person-badge` / `.person-handler` / `.person-creator`

Oznaczenie osoby odpowiedzialnej / autora oferty.

---

## 16. Utility

### Tekst

| Klasa | Właściwość |
|-------|-----------|
| `.text-accent` | color: `--accent` |
| `.text-success` | color: `--success` |
| `.text-danger` | color: `--danger` |
| `.text-warn` | color: `--warn` |
| `.text-right` | text-align: right |
| `.text-center` | text-align: center |
| `.text-nowrap` | white-space: nowrap |
| `.fs-075-nowrap` | font 0.75rem + nowrap |
| `.fs-065-nowrap` | font 0.65rem + nowrap |

### Tło

| Klasa | Właściwość |
|-------|-----------|
| `.bg-accent` | background: `--accent` |
| `.bg-success` | background: `--success` |
| `.bg-danger` | background: `--danger` |
| `.bg-warn` | background: `--warn` |
| `.bg-glass` | background: `--bg-glass` |
| `.bg-success-bg` | background: `--success-bg` |
| `.bg-danger-bg` | background: `--danger-bg` |

### Border

| Klasa | Właściwość |
|-------|-----------|
| `.border-accent` | border-color: `--accent` |
| `.border-success` | border-color: `--success` |
| `.border-danger` | border-color: `--danger` |
| `.border-warn` | border-color: `--warn` |

### Gap / Margin / Padding

| Klasa | Wartość |
|-------|---------|
| `.gap-1` | gap: 0.25rem |
| `.gap-2` | gap: 0.5rem |
| `.gap-3` | gap: 0.75rem |
| `.gap-4` | gap: 1rem |
| `.mb-0` | margin-bottom: 0 |
| `.mb-1` | margin-bottom: 1rem |

---

## 17. Scrollbar

Custom scrollbar dla całej aplikacji:

```css
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: #0f172a; }
::-webkit-scrollbar-thumb { background: #3730a3; border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: #4f46e5; }
html { scrollbar-width: thin; scrollbar-color: #3730a3 #0f172a; }
```

**Firefox:** używa `scrollbar-width: thin` z tymi samymi kolorami.

---

## 18. Print

### `printModal.css` — style dla podglądu wydruku

Zawiera style dla modalnego podglądu PDF/DOCX przed wydrukiem (ukrycie nagłówka, sidebarów, dostosowanie szerokości).

---

## 19. Animacje

| Animacja | Właściwość |
|----------|-----------|
| `fadeIn` | opacity 0→1, translateY 8px→0 (0.35s ease) |
| `slideDown` | opacity 0→1, translateY -5px→0 (0.2s ease-out) |
| `bgShift` | powolna rotacja tła (loop) |

Stosowane przez `.section.active`, `.well-details-container`, `.product-catalog`.

---

## 20. Responsywność — mapowanie

| Breakpoint | Gdzie | Zmiana |
|------------|-------|--------|
| 1400px | well-app-layout | 350→300px sidebar |
| 1200px | well-app-layout | ukryj diagram, 2 kolumny |
| 900px | well-app-layout | 1 kolumna |
| 768px | form-row-* | (grid zachowany, ale mniejsze paddingi) |
| 700px | header | flex wrap, nav-tile-text hidden |
| 480px | header | centrowanie, logo span hidden |

---

*Ostatnia aktualizacja: 2026-06-20*
