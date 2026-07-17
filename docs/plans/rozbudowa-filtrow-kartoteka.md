# Plan finalny: Filtry daty i użytkownika w Kartotece

## 1. Cel

Dodać do paska filtrów Kartoteki (`/kartoteka`) dwa nowe mechanizmy wyszukiwania:

- **Filtr użytkownika** — wybór opiekuna oferty z listy + szybki przycisk "Moje"
- **Filtr daty** — presety czasowe (Dzisiaj, 7 dni, 30 dni, Ten miesiąc) + zakres własny (od–do)

Oba działają równolegle (AND) z istniejącymi filtrami (typ oferty, status zamówienia, wyszukiwanie tekstowe).

---

## 2. Decyzje architektoniczne

| Decyzja             | Wybór                                                       | Uzasadnienie                                                                                                                             |
| ------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Miejsce filtrowania | **Client-side**                                             | Backend zwraca pełną listę (300-1000 ofert). YAGNI na filtrowanie serwerowe.                                                             |
| Lokalizacja logiki  | **Metody w `PVSalesUI`** (nie osobna klasa)                 | `PVSalesUI` ma już 1800 linii, ale +80 linii metod nie pogarsza sytuacji. Osobna klasa to abstrakcja bez realnej korzyści dla 2 filtrów. |
| Stan filtrów        | **`this.filters`** — jeden obiekt zamiast rozproszonych pól | Spójność, łatwość resetu, jedna prawda.                                                                                                  |
| Pole daty           | `offer.createdAt` (ISO string)                              | Dostępne we wszystkich ofertach, już używane w `renderOffersList()`.                                                                     |
| Pole użytkownika    | `offer.userId` (ID z DB)                                    | Rozpoznawane przez `globalUsersMap`. Fallback: `offer.lastEditedBy`.                                                                     |
| Porównanie dat      | **Lokalne `getFullYear/getMonth/getDate`**                  | Zamiast `toISOString()` — eliminacja buga strefy czasowej UTC vs PL.                                                                     |
| Styl UI             | **Pill buttony** (kafelki) + stylizowany select             | Spójność z istniejącymi filtrami typu (Wszystkie/Rury/Studnie).                                                                          |
| Eventy              | **`kartotekaInit.js`** — bez inline onclick                 | Czysty HTML, łatwiejsze debugowanie.                                                                                                     |
| `date.mode`         | **Pole w stanie** (nie pochodna)                            | Prostota. `_getDateMode()` to abstrakcja oszczędzająca 0 linii kodu.                                                                     |

---

## 3. Pliki do modyfikacji

| #   | Plik                                  | Zmiana                                          | Linie |
| --- | ------------------------------------- | ----------------------------------------------- | ----- |
| 1   | `public/kartoteka.html`               | Dodanie HTML filtrów (bez inline onclick)       | ~40   |
| 2   | `public/js/sales/pvSalesUi.js`        | Stan + 6 metod + refaktor `filterLocalOffers()` | ~80   |
| 3   | `public/js/sales/kartotekaInit.js`    | Podpięcie eventów                               | ~25   |
| 4   | `tests/sales/kartotekaFilter.test.ts` | Testy matcherów                                 | ~110  |

**Backend**: brak zmian. **CSS**: brak zmian.

---

## 4. `public/kartoteka.html` — UI filtrów

Po sekcji status filter (ok. linia 251), przed przyciskiem compact mode:

```html
<!-- Divider -->
<div style="width:1px; height:24px; background:var(--border-glass)"></div>

<!-- User Filter -->
<div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap">
    <span
        style="font-size:0.75rem; color:var(--text-muted); font-weight:600; text-transform:uppercase; letter-spacing:0.3px;"
        >Opiekun:</span
    >
    <button
        class="btn btn-sm btn-secondary"
        id="pv-my-offers-btn"
        style="border-radius:20px; padding:0.35rem 0.9rem; font-size:0.75rem;"
    >
        <i data-lucide="user-check"></i> Moje
    </button>
    <select
        id="pv-user-filter"
        class="btn btn-sm"
        style="border-radius:20px; padding:0.35rem 0.9rem; font-size:0.75rem; appearance:none; -webkit-appearance:none; cursor:pointer; background:var(--bg-glass); border:1px solid var(--border-glass); color:var(--text-primary); min-width:130px;"
    >
        <option value="">Wszyscy</option>
    </select>
</div>

<!-- Divider -->
<div style="width:1px; height:24px; background:var(--border-glass)"></div>

<!-- Date Filter -->
<div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap">
    <span
        style="font-size:0.75rem; color:var(--text-muted); font-weight:600; text-transform:uppercase; letter-spacing:0.3px;"
        >Data:</span
    >
    <button
        class="btn btn-sm pv-date-preset-btn"
        data-date-range="today"
        style="border-radius:20px; padding:0.35rem 0.7rem; font-size:0.72rem;"
    >
        Dzisiaj
    </button>
    <button
        class="btn btn-sm btn-secondary pv-date-preset-btn"
        data-date-range="7d"
        style="border-radius:20px; padding:0.35rem 0.7rem; font-size:0.72rem;"
    >
        7 dni
    </button>
    <button
        class="btn btn-sm btn-secondary pv-date-preset-btn"
        data-date-range="30d"
        style="border-radius:20px; padding:0.35rem 0.7rem; font-size:0.72rem;"
    >
        30 dni
    </button>
    <button
        class="btn btn-sm btn-secondary pv-date-preset-btn"
        data-date-range="month"
        style="border-radius:20px; padding:0.35rem 0.7rem; font-size:0.72rem;"
    >
        Ten miesiąc
    </button>
    <button
        class="btn btn-sm btn-secondary"
        id="pv-date-range-btn"
        style="border-radius:20px; padding:0.35rem 0.7rem; font-size:0.72rem;"
    >
        <i data-lucide="calendar"></i> Zakres
    </button>
    <span id="pv-date-range-wrap" style="display:none; gap:0.4rem; align-items:center;">
        <input
            type="date"
            id="pv-date-from"
            class="form-input form-input-sm"
            style="font-size:0.78rem; width:135px;"
        />
        <span style="color:var(--text-muted); font-size:0.75rem;">–</span>
        <input
            type="date"
            id="pv-date-to"
            class="form-input form-input-sm"
            style="font-size:0.78rem; width:135px;"
        />
    </span>
    <button
        class="btn btn-sm btn-secondary"
        id="pv-clear-filters-btn"
        style="border-radius:20px; padding:0.35rem 0.7rem; font-size:0.72rem;"
    >
        <i data-lucide="x"></i> Wyczyść
    </button>
</div>
```

Bez `onclick` w HTML. Wszystkie ID-elementy do targetowania eventów.

---

## 5. `public/js/sales/pvSalesUi.js` — logika

### 5a. Stan w konstruktorze

Po `this.currentTypeFilter = 'all'` (linia 12):

```js
this.filters = {
    user: '', // '' = wszyscy, lub userId
    myOffers: false, // czy aktywny przycisk "Moje"
    date: {
        mode: 'none', // 'none' | 'preset' | 'range'
        preset: '', // '' | 'today' | '7d' | '30d' | 'month'
        from: '', // YYYY-MM-DD
        to: '' // YYYY-MM-DD
    }
};
```

### 5b. Matchery — metody `PVSalesUI`

```js
offerMatchesUser(offer, selectedUserId) {
    if (!selectedUserId) return true;
    const uid = offer.userId || offer.lastEditedBy || '';
    return uid === selectedUserId;
}

offerMatchesDate(offer, dateFilter, boundaries) {
    if (dateFilter.mode === 'none') return true;
    if (!offer.createdAt) return false;
    const d = new Date(offer.createdAt);
    if (isNaN(d.getTime())) return false;

    if (dateFilter.mode === 'preset') {
        const ts = d.getTime();
        switch (dateFilter.preset) {
            case 'today':
                return ts >= boundaries.today.getTime() && ts < boundaries.todayEnd.getTime();
            case '7d':
                return ts >= boundaries.weekAgo.getTime();
            case '30d':
                return ts >= boundaries.monthAgo.getTime();
            case 'month': {
                const dLocal = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                const monthStart = new Date(boundaries.today.getFullYear(), boundaries.today.getMonth(), 1);
                const monthEnd = new Date(boundaries.today.getFullYear(), boundaries.today.getMonth() + 1, 1);
                return dLocal.getTime() >= monthStart.getTime() && dLocal.getTime() < monthEnd.getTime();
            }
        }
        return true;
    }

    if (dateFilter.from || dateFilter.to) {
        const dateStr = this._formatLocalDate(offer.createdAt);
        if (!dateStr) return false;
        if (dateFilter.from && dateStr < dateFilter.from) return false;
        if (dateFilter.to && dateStr > dateFilter.to) return false;
    }
    return true;
}

_formatLocalDate(dateInput) {
    try {
        const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
        if (isNaN(d.getTime())) return null;
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    } catch {
        return null;
    }
}
```

### 5c. Metody sterujące

```js
setUserFilter(userId) {
    this.filters.user = userId || '';
    this.filters.myOffers = false;
    this.filterLocalOffers();
}

toggleMyOffers() {
    if (this.filters.myOffers) {
        this.filters.myOffers = false;
        this.filters.user = '';
    } else {
        this.filters.myOffers = true;
        this.filters.user = window.currentUser?.id || window.currentUser?.username || '';
    }
    this.filterLocalOffers();
}

setDatePreset(preset) {
    if (this.filters.date.mode === 'preset' && this.filters.date.preset === preset) {
        this.filters.date.mode = 'none';
        this.filters.date.preset = '';
    } else {
        this.filters.date.mode = 'preset';
        this.filters.date.preset = preset;
    }
    this.filters.date.from = '';
    this.filters.date.to = '';
    this.filterLocalOffers();
}

toggleDateRange() {
    if (this.filters.date.mode === 'range') {
        this.filters.date.mode = 'none';
        this.filters.date.from = '';
        this.filters.date.to = '';
    } else {
        this.filters.date.mode = 'range';
        this.filters.date.preset = '';
    }
    this.filterLocalOffers();
}

onDateRangeChange(from, to) {
    this.filters.date.from = from || '';
    this.filters.date.to = to || '';
    this.filterLocalOffers();
}

clearFilters() {
    this.filters.user = '';
    this.filters.myOffers = false;
    this.filters.date.mode = 'none';
    this.filters.date.preset = '';
    this.filters.date.from = '';
    this.filters.date.to = '';
    this.filterLocalOffers();
}
```

### 5d. `_syncFilterUI()` — synchronizacja UI ze stanem

```js
_syncFilterUI() {
    // Status
    document.querySelectorAll('.pv-filter-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.filter === this.currentFilter);
        btn.classList.toggle('btn-secondary', btn.dataset.filter !== this.currentFilter);
    });
    // Typ
    document.querySelectorAll('.pv-type-filter-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.typeFilter === this.currentTypeFilter);
        btn.classList.toggle('btn-secondary', btn.dataset.typeFilter !== this.currentTypeFilter);
    });
    // User
    const sel = document.getElementById('pv-user-filter');
    if (sel) sel.value = this.filters.user;
    const myBtn = document.getElementById('pv-my-offers-btn');
    if (myBtn) {
        myBtn.classList.toggle('active', this.filters.myOffers);
        myBtn.classList.toggle('btn-secondary', !this.filters.myOffers);
    }
    // Date presety
    document.querySelectorAll('.pv-date-preset-btn').forEach((btn) => {
        const isActive = this.filters.date.mode === 'preset' && btn.dataset.dateRange === this.filters.date.preset;
        btn.classList.toggle('active', isActive);
        btn.classList.toggle('btn-secondary', !isActive);
    });
    // Date range
    const rangeBtn = document.getElementById('pv-date-range-btn');
    if (rangeBtn) {
        rangeBtn.classList.toggle('active', this.filters.date.mode === 'range');
        rangeBtn.classList.toggle('btn-secondary', this.filters.date.mode !== 'range');
    }
    const wrap = document.getElementById('pv-date-range-wrap');
    if (wrap) wrap.style.display = this.filters.date.mode === 'range' ? 'inline-flex' : 'none';
}
```

### 5e. `filterLocalOffers()` — refaktor

```js
filterLocalOffers() {
    const input = document.getElementById('pv-local-search-input');
    const listDiv = document.getElementById('pv-local-offers-list');
    if (!input || !listDiv || !this.allLocalOffers) return;

    const query = input.value.trim().toLowerCase();

    // Boundaries liczone raz przed pętlą
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const boundaries = {
        today,
        todayEnd: new Date(today.getTime() + 86400000),
        weekAgo: new Date(today.getTime() - 6 * 86400000),
        monthAgo: new Date(today.getTime() - 29 * 86400000)
    };

    this._syncFilterUI();

    const filtered = this.allLocalOffers.filter((offer) => {
        if (this.currentTypeFilter !== 'all' && offer.type !== this.currentTypeFilter) return false;

        // Wyszukiwanie tekstowe
        const num = (offer.number || offer.title || offer.offerName || '').toLowerCase();
        const client = (offer.clientName || (offer.data && offer.data.clientName) || '').toLowerCase();
        const nip = (offer.clientNip || (offer.data && offer.data.clientNip) || '').toLowerCase();
        const budowa = (offer.investName || offer.budowa || (offer.data && (offer.data.investName || offer.data.budowa)) || '').toLowerCase();
        const userStr = (offer.userName || offer.lastEditedBy || (offer.data && offer.data.creatorName) || '').toLowerCase();
        const offerOrders = this.ordersMap.get(this.normalizeId(offer.id));
        const matchesOrderNumber = offerOrders && offerOrders.some((o) => {
            const on = o?.orderNumber || o?.data?.orderNumber || '';
            return on.toLowerCase().includes(query);
        });
        if (!(!query || num.includes(query) || client.includes(query) || nip.includes(query) || budowa.includes(query) || userStr.includes(query) || matchesOrderNumber))
            return false;

        // Status zamówienia
        if (this.currentFilter !== 'all') {
            const { hasOrder } = this.getOrderForOffer(offer);
            if (this.currentFilter === 'with_order' && !hasOrder) return false;
            if (this.currentFilter === 'without_order' && hasOrder) return false;
        }

        if (!this.offerMatchesUser(offer, this.filters.user)) return false;
        if (!this.offerMatchesDate(offer, this.filters.date, boundaries)) return false;
        return true;
    });

    if (filtered.length === 0) {
        listDiv.innerHTML = `<div style="text-align:center; padding: 2rem; color: var(--text-muted); font-style: italic;">Brak ofert pasujących do wyszukiwania.</div>`;
    } else {
        listDiv.innerHTML = this.renderOffersList(filtered, true);
        this.attachActionListeners(listDiv);
    }
    setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 0);
}
```

### 5f. `populateUserFilter()` — budowa selecta

```js
populateUserFilter() {
    const select = document.getElementById('pv-user-filter');
    if (!select) return;

    const userSet = new Map();
    for (const offer of this.allLocalOffers) {
        const uid = offer.userId || offer.lastEditedBy || '';
        if (!uid || userSet.has(uid)) continue;
        let displayName = uid;
        if (window.globalUsersMap && window.globalUsersMap.has(uid))
            displayName = window.globalUsersMap.get(uid);
        userSet.set(uid, displayName);
    }

    const sorted = [...userSet.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pl'));

    const prev = this.filters.user;
    select.innerHTML = '<option value="">Wszyscy</option>' +
        sorted.map(([id, name]) =>
            `<option value="${this.escapeHtml(id)}">${this.escapeHtml(name)}</option>`
        ).join('');

    if (prev && userSet.has(prev)) {
        select.value = prev;
    } else {
        // Wybrany user nie istnieje — dodaj opcję, żeby nie gubić stanu
        if (prev && window.globalUsersMap && window.globalUsersMap.has(prev)) {
            const displayName = window.globalUsersMap.get(prev);
            select.innerHTML += `<option value="${this.escapeHtml(prev)}">${this.escapeHtml(displayName)}</option>`;
            select.value = prev;
        } else {
            this.filters.user = '';
            this.filters.myOffers = false;
        }
    }
}
```

### 5g. `loadLocalOffers()` — wywołanie

Po linii `this.allLocalOffers = docs;` (linia 274):

```js
this.populateUserFilter();
```

---

## 6. `public/js/sales/kartotekaInit.js` — eventy

```js
function initAdvancedFilterEvents(ui) {
    if (!ui) return;

    const userSelect = document.getElementById('pv-user-filter');
    if (userSelect) {
        userSelect.addEventListener('change', () => ui.setUserFilter(userSelect.value));
    }

    document
        .getElementById('pv-my-offers-btn')
        ?.addEventListener('click', () => ui.toggleMyOffers());

    document.querySelectorAll('.pv-date-preset-btn').forEach((btn) => {
        btn.addEventListener('click', () => ui.setDatePreset(btn.dataset.dateRange));
    });

    document
        .getElementById('pv-date-range-btn')
        ?.addEventListener('click', () => ui.toggleDateRange());

    const dateFrom = document.getElementById('pv-date-from');
    const dateTo = document.getElementById('pv-date-to');
    if (dateFrom)
        dateFrom.addEventListener('change', () =>
            ui.onDateRangeChange(dateFrom.value, dateTo?.value || '')
        );
    if (dateTo)
        dateTo.addEventListener('change', () =>
            ui.onDateRangeChange(dateFrom?.value || '', dateTo.value)
        );

    document
        .getElementById('pv-clear-filters-btn')
        ?.addEventListener('click', () => ui.clearFilters());
}
```

Wywołanie w `PVSalesUI.init()` po `this.initialized = true;`:

```js
initAdvancedFilterEvents(this);
this.clearFilters();
this.filterLocalOffers();
```

---

## 7. Testy — `tests/sales/kartotekaFilter.test.ts`

### Funkcje testowe

```ts
function offerMatchesUser(
    offer: { userId?: string; lastEditedBy?: string },
    selectedUserId: string
): boolean {
    if (!selectedUserId) return true;
    const uid = offer.userId || offer.lastEditedBy || '';
    return uid === selectedUserId;
}

function offerMatchesDate(
    offer: { createdAt?: string | null },
    dateFilter: { mode: string; preset: string; from: string; to: string },
    boundaries: { today: Date; todayEnd: Date; weekAgo: Date; monthAgo: Date }
): boolean {
    if (dateFilter.mode === 'none') return true;
    if (!offer.createdAt) return false;
    const d = new Date(offer.createdAt);
    if (isNaN(d.getTime())) return false;
    const ts = d.getTime();

    if (dateFilter.mode === 'preset') {
        switch (dateFilter.preset) {
            case 'today':
                return ts >= boundaries.today.getTime() && ts < boundaries.todayEnd.getTime();
            case '7d':
                return ts >= boundaries.weekAgo.getTime();
            case '30d':
                return ts >= boundaries.monthAgo.getTime();
            case 'month': {
                const dLocal = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                const monthStart = new Date(
                    boundaries.today.getFullYear(),
                    boundaries.today.getMonth(),
                    1
                );
                const monthEnd = new Date(
                    boundaries.today.getFullYear(),
                    boundaries.today.getMonth() + 1,
                    1
                );
                return (
                    dLocal.getTime() >= monthStart.getTime() &&
                    dLocal.getTime() < monthEnd.getTime()
                );
            }
        }
        return true;
    }

    if (dateFilter.from || dateFilter.to) {
        const dd = new Date(offer.createdAt!);
        if (isNaN(dd.getTime())) return false;
        const y = dd.getFullYear();
        const m = String(dd.getMonth() + 1).padStart(2, '0');
        const day = String(dd.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${day}`;
        if (dateFilter.from && dateStr < dateFilter.from) return false;
        if (dateFilter.to && dateStr > dateFilter.to) return false;
    }
    return true;
}
```

### Testy użytkownika

```ts
describe('offerMatchesUser', () => {
    it('pusty = brak filtra', () => expect(offerMatchesUser({ userId: 'u1' }, '')).toBe(true));
    it('dopasowanie po userId', () => expect(offerMatchesUser({ userId: 'u1' }, 'u1')).toBe(true));
    it('brak dopasowania', () => expect(offerMatchesUser({ userId: 'u1' }, 'u2')).toBe(false));
    it('fallback lastEditedBy', () =>
        expect(offerMatchesUser({ lastEditedBy: 'u3' }, 'u3')).toBe(true));
    it('userId > lastEditedBy', () => {
        expect(offerMatchesUser({ userId: 'u1', lastEditedBy: 'u2' }, 'u1')).toBe(true);
        expect(offerMatchesUser({ userId: 'u1', lastEditedBy: 'u2' }, 'u2')).toBe(false);
    });
    it('brak userId i lastEditedBy', () => expect(offerMatchesUser({}, 'u1')).toBe(false));
});
```

### Testy daty

```ts
describe('offerMatchesDate', () => {
    const b = {
        today: new Date(2026, 6, 17),
        todayEnd: new Date(2026, 6, 18),
        weekAgo: new Date(2026, 6, 11),
        monthAgo: new Date(2026, 5, 18)
    };

    it('mode=none = brak filtra', () =>
        expect(
            offerMatchesDate(
                { createdAt: '2026-07-17' },
                { mode: 'none', preset: '', from: '', to: '' },
                b
            )
        ).toBe(true));
    it('today: dopasowuje', () =>
        expect(
            offerMatchesDate(
                { createdAt: new Date(2026, 6, 17, 10, 30).toISOString() },
                { mode: 'preset', preset: 'today', from: '', to: '' },
                b
            )
        ).toBe(true));
    it('today: odrzuca wczoraj', () =>
        expect(
            offerMatchesDate(
                { createdAt: new Date(2026, 6, 16, 23, 59).toISOString() },
                { mode: 'preset', preset: 'today', from: '', to: '' },
                b
            )
        ).toBe(false));
    it('7d: dopasowuje sprzed 6 dni', () =>
        expect(
            offerMatchesDate(
                { createdAt: new Date(2026, 6, 11, 0, 0).toISOString() },
                { mode: 'preset', preset: '7d', from: '', to: '' },
                b
            )
        ).toBe(true));
    it('7d: odrzuca sprzed 7 dni', () =>
        expect(
            offerMatchesDate(
                { createdAt: new Date(2026, 6, 10, 23, 59).toISOString() },
                { mode: 'preset', preset: '7d', from: '', to: '' },
                b
            )
        ).toBe(false));
    it('30d: dopasowuje sprzed 29 dni', () =>
        expect(
            offerMatchesDate(
                { createdAt: new Date(2026, 5, 18, 0, 0).toISOString() },
                { mode: 'preset', preset: '30d', from: '', to: '' },
                b
            )
        ).toBe(true));
    it('30d: odrzuca sprzed 30 dni', () =>
        expect(
            offerMatchesDate(
                { createdAt: new Date(2026, 5, 17, 0, 0).toISOString() },
                { mode: 'preset', preset: '30d', from: '', to: '' },
                b
            )
        ).toBe(false));
    it('month: w bieżącym', () =>
        expect(
            offerMatchesDate(
                { createdAt: new Date(2026, 6, 1).toISOString() },
                { mode: 'preset', preset: 'month', from: '', to: '' },
                b
            )
        ).toBe(true));
    it('month: poza', () =>
        expect(
            offerMatchesDate(
                { createdAt: new Date(2026, 5, 30).toISOString() },
                { mode: 'preset', preset: 'month', from: '', to: '' },
                b
            )
        ).toBe(false));
    it('month: grudzień auto-wrap', () => {
        const db = {
            today: new Date(2026, 11, 15),
            todayEnd: new Date(2026, 11, 16),
            weekAgo: new Date(2026, 11, 9),
            monthAgo: new Date(2026, 10, 16)
        };
        expect(
            offerMatchesDate(
                { createdAt: new Date(2026, 11, 10).toISOString() },
                { mode: 'preset', preset: 'month', from: '', to: '' },
                db
            )
        ).toBe(true);
    });
    it('range: w przedziale', () =>
        expect(
            offerMatchesDate(
                { createdAt: '2026-07-15T12:00' },
                { mode: 'range', preset: '', from: '2026-07-14', to: '2026-07-16' },
                b
            )
        ).toBe(true));
    it('range: from==to', () =>
        expect(
            offerMatchesDate(
                { createdAt: '2026-07-17T12:00' },
                { mode: 'range', preset: '', from: '2026-07-17', to: '2026-07-17' },
                b
            )
        ).toBe(true));
    it('range: poza', () =>
        expect(
            offerMatchesDate(
                { createdAt: '2026-07-10T12:00' },
                { mode: 'range', preset: '', from: '2026-07-14', to: '2026-07-16' },
                b
            )
        ).toBe(false));
    it('range: dateFrom > dateTo', () =>
        expect(
            offerMatchesDate(
                { createdAt: '2026-07-15T12:00' },
                { mode: 'range', preset: '', from: '2026-07-20', to: '2026-07-14' },
                b
            )
        ).toBe(false));
    it('null createdAt', () =>
        expect(
            offerMatchesDate(
                { createdAt: null },
                { mode: 'preset', preset: 'today', from: '', to: '' },
                b
            )
        ).toBe(false));
    it('invalid string', () =>
        expect(
            offerMatchesDate(
                { createdAt: 'bad' },
                { mode: 'preset', preset: 'today', from: '', to: '' },
                b
            )
        ).toBe(false));
    it('granica: 00:00 w zakresie', () =>
        expect(
            offerMatchesDate(
                { createdAt: new Date(2026, 6, 17, 0, 0).toISOString() },
                { mode: 'preset', preset: 'today', from: '', to: '' },
                b
            )
        ).toBe(true));
    it('granica: 23:59 w zakresie', () =>
        expect(
            offerMatchesDate(
                { createdAt: new Date(2026, 6, 17, 23, 59).toISOString() },
                { mode: 'preset', preset: 'today', from: '', to: '' },
                b
            )
        ).toBe(true));
    it('29 lutego', () => {
        const lb = {
            today: new Date(2024, 1, 29),
            todayEnd: new Date(2024, 2, 1),
            weekAgo: new Date(2024, 1, 23),
            monthAgo: new Date(2024, 0, 31)
        };
        expect(
            offerMatchesDate(
                { createdAt: new Date(2024, 1, 29, 12).toISOString() },
                { mode: 'preset', preset: 'today', from: '', to: '' },
                lb
            )
        ).toBe(true);
    });
    it('DST 2026-03-29', () => {
        const db = {
            today: new Date(2026, 2, 29),
            todayEnd: new Date(2026, 2, 30),
            weekAgo: new Date(2026, 2, 23),
            monthAgo: new Date(2026, 1, 28)
        };
        expect(
            offerMatchesDate(
                { createdAt: new Date('2026-03-29T01:30:00Z').toISOString() },
                { mode: 'preset', preset: 'today', from: '', to: '' },
                db
            )
        ).toBe(true);
    });
});
```

---

## 8. Uwagi implementacyjne

### `offer.userId` vs `window.currentUser.id`

Przed implementacją sprawdzić w konsoli:

```js
console.log('offer.userId:', window.pvSalesUI?.allLocalOffers?.[0]?.userId);
console.log('currentUser:', window.currentUser);
```

Jeśli `userId` to username a nie ID — dostosować `toggleMyOffers()`.

### XSS

`escapeHtml()` już istnieje w `PVSalesUI` (linia 24). Używać w `populateUserFilter()` przy interpolacji nazw użytkowników do `innerHTML`.

### Lucide icons

Po `listDiv.innerHTML = ...` wywołać `setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 0);`

### Semantyka presetów

Dni kalendarzowe, nie `24h`:

- "7 dni": dziś + 6 dni wstecz = 7 dni kalendarzowych
- "30 dni": dziś + 29 dni wstecz = 30 dni kalendarzowych

Do potwierdzenia z biznesem przed wdrożeniem.

---

## 9. Podsumowanie

| Co                                          | Gdzie                     | Linie |
| ------------------------------------------- | ------------------------- | ----- |
| HTML filtrów                                | `kartoteka.html`          | ~40   |
| Stan `this.filters` w konstruktorze         | `pvSalesUi.js:12`         | 7     |
| `offerMatchesUser()`                        | `pvSalesUi.js`            | 5     |
| `offerMatchesDate()` + `_formatLocalDate()` | `pvSalesUi.js`            | 35    |
| Metody sterujące (6)                        | `pvSalesUi.js`            | 45    |
| `_syncFilterUI()`                           | `pvSalesUi.js`            | 28    |
| Refaktor `filterLocalOffers()`              | `pvSalesUi.js`            | 50    |
| `populateUserFilter()`                      | `pvSalesUi.js`            | 22    |
| `initAdvancedFilterEvents()`                | `kartotekaInit.js`        | 18    |
| Testy (40)                                  | `kartotekaFilter.test.ts` | 110   |

**Backend**: brak zmian. **CSS**: brak zmian. **Nowe pliki**: 0.

**Łącznie**: ~360 linii. Czas implementacji: ~1 dzień.

---

## 10. Ryzyka

| Ryzyko                                | Mitigacja                                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------------------------- |
| `offer.userId` typ ≠ `currentUser.id` | Weryfikacja w konsoli przed implementacją                                                   |
| `toISOString()` UTC bug               | Wyeliminowany — `_formatLocalDate()` używa lokalnych `getFullYear/getMonth/getDate`         |
| `localeCompare` bez 'pl'              | `localeCompare(name, 'pl')` w `populateUserFilter()`                                        |
| Stan rozjeżdża się z DOM              | `_syncFilterUI()` wołany na początku `filterLocalOffers()` — odświeża UI przed filtrowaniem |
| Utrata filtra usera przy refresh      | `populateUserFilter()` dodaje nieobecnego usera jako opcję zamiast resetować stan           |
| `pvSalesUi.js` rozmiar (1812 → ~1890) | Limit 500 linii jest już dawno przekroczony. Refaktor całej klasy to osobny task.           |
