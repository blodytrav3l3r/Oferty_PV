// @ts-check
// Moduł filtrów dla PV Sales UI

export default {
    filterLocalOffers() {
        this._syncFilterUI();
        this.searchOffers(this.buildSearchParams());
    },

    setFilterLocalOffers(filterType) {
        this.currentFilter = filterType;

        document.querySelectorAll('.pv-filter-btn').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.filter === filterType);
            if (btn.dataset.filter === filterType) {
                btn.classList.remove('btn-secondary');
            } else {
                btn.classList.add('btn-secondary');
            }
        });

        this.updateFilterCount();
        this.searchOffers(this.buildSearchParams());
    },

    setTypeFilter(typeFilter) {
        this.currentTypeFilter = typeFilter;
        this.updateFilterCount();
        this.searchOffers(this.buildSearchParams());
    },

    _syncFilterUI() {
        document.querySelectorAll('.pv-filter-btn').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.filter === this.currentFilter);
            btn.classList.toggle('btn-secondary', btn.dataset.filter !== this.currentFilter);
        });
        document.querySelectorAll('.pv-type-filter-btn').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.typeFilter === this.currentTypeFilter);
            btn.classList.toggle(
                'btn-secondary',
                btn.dataset.typeFilter !== this.currentTypeFilter
            );
        });
        const sel = document.getElementById('pv-user-filter');
        if (sel) sel.value = this.filters.user;
        document.querySelectorAll('.pv-date-preset-btn').forEach((btn) => {
            const isActive =
                this.filters.date.mode === 'preset' &&
                btn.dataset.dateRange === this.filters.date.preset;
            btn.classList.toggle('active', isActive);
            btn.classList.toggle('btn-secondary', !isActive);
        });
        this.updateFilterCount();
    },

    /**
     * Aktualizuje licznik aktywnych filtrów przy przycisku "Wyczyść filtry (N)".
     */
    updateFilterCount() {
        const input = document.getElementById('pv-local-search-input');
        const q = input ? input.value.trim() : '';
        const dateActive =
            this.filters.date.mode === 'preset' || this.filters.date.mode === 'range';
        const count =
            (q ? 1 : 0) +
            (this.currentTypeFilter !== 'all' ? 1 : 0) +
            (this.currentFilter !== 'all' ? 1 : 0) +
            (this.filters.user ? 1 : 0) +
            (dateActive ? 1 : 0);
        const btn = document.getElementById('pv-clear-filters');
        if (btn) btn.textContent = 'Wyczyść filtry (' + count + ')';
    },

    /**
     * Zeruje wszystkie filtry kartoteki (typ, status, opiekun, data, szukaj).
     */
    clearAllFilters() {
        this.currentFilter = 'all';
        this.currentTypeFilter = 'all';
        this.filters.user = '';
        this.filters.date = { mode: 'none', preset: '', from: '', to: '' };

        const searchInput = document.getElementById('pv-local-search-input');
        if (searchInput) searchInput.value = '';
        const dateFrom = document.getElementById('pv-date-from');
        const dateTo = document.getElementById('pv-date-to');
        if (dateFrom) dateFrom.value = '';
        if (dateTo) dateTo.value = '';

        this._syncFilterUI();
        this.searchOffers(this.buildSearchParams());
    },

    setUserFilter(userId) {
        this.filters.user = userId || '';
        this._syncFilterUI();
        this.searchOffers(this.buildSearchParams());
    },

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
        this._syncFilterUI();
        this.searchOffers(this.buildSearchParams());
    },

    onDateRangeChange(from, to) {
        if (from || to) {
            this.filters.date.mode = 'range';
            this.filters.date.preset = '';
        } else {
            this.filters.date.mode = 'none';
        }
        // Granice zakresu liczone lokalnie i konwertowane do UTC (tak jak presety),
        // aby backend porównywał createdAt (UTC ISO) bez dryfu strefy czasowej.
        this.filters.date.from = this._toIsoBound(from, false);
        this.filters.date.to = this._toIsoBound(to, true);
        this._syncFilterUI();
        this.searchOffers(this.buildSearchParams());
    },

    /**
     * Konwertuje YYYY-MM-DD (lokalna data z input[type=date]) na granicę ISO w UTC.
     * isEnd=true → północ następnego dnia (górna granica wyłączna).
     */
    _toIsoBound(dateStr, isEnd) {
        if (!dateStr) return '';
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
        if (!m) return dateStr;
        const y = Number(m[1]);
        const mo = Number(m[2]);
        const d = Number(m[3]) + (isEnd ? 1 : 0);
        return new Date(y, mo - 1, d).toISOString();
    },

    populateUserFilter() {
        const select = document.getElementById('pv-user-filter');
        if (!select) return;

        const offers = this.searchResults?.items || [];
        const userSet = new Map();
        for (const offer of offers) {
            const uid = offer.userId || offer.lastEditedBy || '';
            if (!uid || uid === '' || userSet.has(uid)) continue;
            let displayName = uid;
            if (window.globalUsersMap && window.globalUsersMap.has(uid))
                displayName = window.globalUsersMap.get(uid);
            userSet.set(uid, displayName);
        }

        const sorted = [...userSet.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pl'));

        const prev = this.filters.user;
        select.innerHTML =
            '<option value="">Użytkownik: wszyscy</option>' +
            sorted
                .map(
                    ([id, name]) =>
                        `<option value="${window.escapeHtml(id)}">${window.escapeHtml(name)}</option>`
                )
                .join('');

        if (prev && userSet.has(prev)) {
            select.value = prev;
        } else if (prev) {
            let displayName = prev;
            if (window.globalUsersMap && window.globalUsersMap.has(prev))
                displayName = window.globalUsersMap.get(prev);
            select.innerHTML += `<option value="${window.escapeHtml(prev)}">${window.escapeHtml(displayName)}</option>`;
            select.value = prev;
        } else {
            this.filters.user = '';
        }
    }
};
