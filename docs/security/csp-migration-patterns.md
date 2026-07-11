# CSP Migration Patterns — Reference

> Dokument wzorcowy dla Sprint 3.4+.
> Oparte na pilotowej migracji 13 handlerów (Sprint 3.3).

## Spis treści

1. [Pattern 1 — CSS hover extraction](#pattern-1--css-hover-extraction)
2. [Pattern 2 — Event delegation z `data-action`](#pattern-2--event-delegation-z-data-action)
3. [Pattern 3 — DOM property assignment](#pattern-3--dom-property-assignment)
4. [Pattern 4 — Namespaced action map](#pattern-4--namespaced-action-map)
5. [Decision matrix](#decision-matrix)
6. [Definition of Done](#definition-of-done)

---

## Pattern 1 — CSS hover extraction

**Kiedy**: `onmouseenter`/`onmouseleave`/`onmouseover`/`onmouseout` modyfikujące `this.style`.

**Problem**: CSP blokuje inline event handlery, a hover efekty w `style` są nieutrzymywalne.

**Przed**:

```js
html += `<button class="user-select-btn"
  onmouseenter="this.style.borderColor='rgba(var(--accent-rgb),0.4)';this.style.background='rgba(var(--accent-rgb),0.1)'"
  onmouseleave="if(!this.classList.contains('selected')){this.style.borderColor='rgba(255,255,255,0.06)';this.style.background='rgba(255,255,255,0.03)'}">`;
```

**Po**:

```css
/* style.css */
.user-select-btn {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    transition: all 0.15s;
}
.user-select-btn:hover {
    background: rgba(var(--accent-rgb), 0.1);
    border-color: rgba(var(--accent-rgb), 0.4);
}
.user-select-btn.is-default,
.user-select-btn.is-default:hover {
    background: rgba(var(--accent-rgb), 0.15);
    border-color: rgba(var(--accent-rgb), 0.4);
}
```

```js
html += `<button class="user-select-btn${isDefault ? ' is-default' : ''}">`;
```

**Zalety**:

- CSP-compliant (zero inline handlerów)
- Szybszy (CSS `:hover` jest natywny)
- Mniej kodu
- `transition` działa płynniej

**Uwagi**:

- Stan `.selected` obsłużyć przez dodawanie/usuwanie klasy z JS
- Dla dynamicznych kolorów (RGB z CSS vars) użyć `rgba(var(--x), opacity)`

---

## Pattern 2 — Event delegation z `data-action`

**Kiedy**: `onclick`/`onchange`/`oninput` z wywołaniem funkcji (z parametrami lub bez).

**Problem**: Inline `onclick="fn(param)"` jest blokowany przez CSP i miesza logikę z HTML.

**Przed**:

```html
<button onclick="deleteUser('abc123')">Usuń</button>
<select onchange="updateSubUsers(this)">
    <option value="1">Opcja</option>
</select>
<input type="number" oninput="updateTempDiscount(0, this)" />
```

**Po**:

```html
<button data-action="deleteUser" data-user-id="abc123">Usuń</button>
<select data-action="updateSubUsers">
    <option value="1">Opcja</option>
</select>
<input type="number" data-action="discountInput" data-index="0" />
```

```js
// Rejestracja na poziomie dokumentu (działa dla dynamicznego HTML)
document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    switch (target.dataset.action) {
        case 'deleteUser':
            deleteUser(target.dataset.userId);
            break;
        case 'startEditUser':
            startEditUser(target.dataset.userId);
            break;
        case 'closeModal':
            closeModal();
            break;
        case 'applyItemDiscounts':
            applyItemDiscounts();
            break;
    }
});

// Dla onchange/oninput — osobne listenery
document.addEventListener('change', (e) => {
    const target = e.target.closest('[data-action="updateSubUsers"]');
    if (!target) return;
    updateSubUsers(target);
});

document.addEventListener('input', (e) => {
    const target = e.target.closest('[data-action="discountInput"]');
    if (!target) return;
    updateTempDiscount(parseInt(target.dataset.index), target);
});
```

**Zalety**:

- CSP-compliant
- Działa dla dynamicznie generowanego HTML (modale, listy)
- Separacja logiki od widoku
- Wydajny (jeden listener zamiast N)

**Uwagi**:

- `data-*` atrybuty zawsze string — parsować liczby (`parseInt`, `parseFloat`)
- Dla `escapeHtml` wartości: encode w momencie generowania HTML
- Jeśli element ma wiele akcji, wybrać najbardziej zewnętrzną (`closest`)

---

## Pattern 3 — DOM property assignment

**Kiedy**: `onload`/`onerror`/`onfocus` na elementach tworzonych dynamicznie (iframe, `document.write`, elementy poza głównym DOM).

**Problem**: Inline `onerror="fn()"` jest blokowany przez CSP. Nie można użyć delegacji, bo element jest w innym dokumencie.

**Przed**:

```js
printWin.document.write(`
  <img src="header.png" onload="window._hLoaded=true" onerror="window._hLoaded=true" />
`);
```

**Po**:

```js
printWin.document.write(`
  <img src="header.png" class="letterhead-header" />
`);
printWin.document.close();

const img = printWin.document.querySelector('.letterhead-header');
if (img) {
    if (img.complete && img.naturalWidth > 0) {
        printWin._hLoaded = true;
    } else {
        img.onload = () => {
            printWin._hLoaded = true;
        };
        img.onerror = () => {
            printWin._hLoaded = true;
        };
    }
}
```

**Zalety**:

- CSP-compliant (property assignment nie jest blokowany)
- Obsługa cache'u przez `complete`/`naturalWidth`

**Uwagi**:

- `complete` może być `true` nawet po błędzie — zawsze sprawdzać `naturalWidth > 0`
- Nie używać `img.complete` samego — to za mało
- Działa tylko dla elementów dostępnych przez DOM query (nie dla string template przed dodaniem do DOM)

---

## Pattern 4 — Namespaced action map

**Kiedy**: `onclick` bez parametrów, wiele różnych funkcji, prosty routing akcji.

**Problem**: Pattern 2 z `switch` rośnie liniowo. Dla małych plików OK, dla całej aplikacji potrzebny jest rejestr.

**Przed**:

```html
<button onclick="save()">Zapisz</button>
<button onclick="closeModal()">Zamknij</button>
<button onclick="togglePanel()">Panel</button>
```

**Po**:

```js
// Rejestr akcji — jeden plik, jeden obiekt
const actions = {
    save,
    closeModal,
    togglePanel,
    applyItemDiscounts
};

document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const fn = actions[target.dataset.action];
    if (fn) fn(target.dataset);
});
```

```html
<button data-action="save">Zapisz</button>
<button data-action="closeModal">Zamknij</button>
<button data-action="togglePanel">Panel</button>
```

**Zalety**:

- Nie trzeba rozbudowywać `switch` przy każdej nowej akcji
- Centralny rejestr — łatwo auditować
- Bezpieczny (tylko jawnie zarejestrowane funkcje)

**Uwagi**:

- **Nigdy** nie używać `window[action]()` — to otwiera XSS
- Funkcje w rejestrze muszą być zdefiniowane przed rejestracją
- Dla funkcji z parametrami użyć `target.dataset` i przekazać cały obiekt

---

## Decision matrix

| Jeśli handler                                         | Typ w inventory        | Wzorzec                                      |
| ----------------------------------------------------- | ---------------------- | -------------------------------------------- |
| `onmouseenter`/`onmouseleave` modyfikuje `this.style` | `CSS_HOVER`            | Pattern 1 — CSS `:hover`                     |
| `onmouseover`/`onmouseout` modyfikuje `this.style`    | `CSS_HOVER`            | Pattern 1 — CSS `:hover`                     |
| `onclick` z `fn()` (bez parametrów)                   | `REAL_CSP_HANDLER`     | Pattern 2 lub 4                              |
| `onclick` z `fn(${param})`                            | `REAL_CSP_HANDLER`     | Pattern 2 — `data-action` + `data-*`         |
| `onchange` z `fn(this)`                               | `REAL_CSP_HANDLER`     | Pattern 2 — delegacja `change`               |
| `oninput` z `fn(idx, this)`                           | `REAL_CSP_HANDLER`     | Pattern 2 — `data-index` + `input` delegacja |
| `onerror`/`onload` na `<img>` w `document.write`      | `REAL_CSP_HANDLER`     | Pattern 3 — property assignment + `complete` |
| `onerror`/`onload` na elementach w głównym DOM        | `REAL_CSP_HANDLER`     | Pattern 3 — property assignment              |
| `onfocus`/`onblur`                                    | `REAL_CSP_HANDLER`     | Pattern 3 — property assignment              |
| `onclick="this.select()"`                             | `STRING_TEMPLATE_ONLY` | Pattern 2 — delegacja `click`                |
| Template string generujący stałe HTML                 | `STRING_TEMPLATE_ONLY` | Ręczna ocena: migracja lub `IGNORE`          |
| Dynamiczny template HTML z `on*`                      | `STRING_TEMPLATE_ONLY` | Pattern 2 — `data-action` + delegacja        |
| Handler w martwym kodzie                              | `STRING_TEMPLATE_ONLY` | `IGNORE`                                     |
| Regex replacement (fałszywy alarm)                    | `REGEX_REPLACEMENT`    | `IGNORE` (automatycznie)                     |

---

## Definition of Done

Każda migracja pojedynczego handlera lub grupy w pliku musi spełniać:

### Code

- [ ] `grep -n 'onclick="' plik.js` — brak nowych inline handlerów w zmigrowanym pliku
- [ ] `grep -n 'onchange="' plik.js` — brak nowych inline handlerów w zmigrowanym pliku
- [ ] `grep -n 'oninput="' plik.js` — brak nowych inline handlerów w zmigrowanym pliku
- [ ] `grep -n 'onload="' plik.js` — brak nowych inline handlerów w zmigrowanym pliku
- [ ] `grep -n 'onerror="' plik.js` — brak nowych inline handlerów w zmigrowanym pliku
- [ ] `node -c plik.js` — składnia poprawna

### CI

- [ ] `npm run audit:csp:check` — PASS (0 nowych inline handlerów)
- [ ] `npm run typecheck` — PASS

### Runtime

- [ ] Funkcja działa manualnie według scenariusza testowego
- [ ] `logs/csp-violations.log` — brak fingerprintów z migrowanych handlerów

### Inventory

- [ ] `status: VERIFIED`
- [ ] `owner: <kto>`
- [ ] `targetSprint: 3.4`
- [ ] `migrationPR: #<numer>`
- [ ] `verified: <data>`
