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

        this.searchOffers(this.buildSearchParams());
    },

    setTypeFilter(typeFilter) {
        this.currentTypeFilter = typeFilter;
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
        const myBtn = document.getElementById('pv-my-offers-btn');
        if (myBtn) {
            myBtn.classList.toggle('active', this.filters.myOffers);
            myBtn.classList.toggle('btn-secondary', !this.filters.myOffers);
        }
        document.querySelectorAll('.pv-date-preset-btn').forEach((btn) => {
            const isActive =
                this.filters.date.mode === 'preset' &&
                btn.dataset.dateRange === this.filters.date.preset;
            btn.classList.toggle('active', isActive);
            btn.classList.toggle('btn-secondary', !isActive);
        });
        const rangeBtn = document.getElementById('pv-date-range-btn');
        if (rangeBtn) {
            rangeBtn.classList.toggle('active', this.filters.date.mode === 'range');
            rangeBtn.classList.toggle('btn-secondary', this.filters.date.mode !== 'range');
        }
    },

    setUserFilter(userId) {
        this.filters.user = userId || '';
        this.filters.myOffers = false;
        this.searchOffers(this.buildSearchParams());
    },

    toggleMyOffers() {
        if (this.filters.myOffers) {
            this.filters.myOffers = false;
            this.filters.user = '';
        } else {
            this.filters.myOffers = true;
            const uid = window.currentUser?.id || window.currentUser?.username || '';
            this.filters.user = uid;
        }
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
        this._closeDatePopover();
        this.searchOffers(this.buildSearchParams());
    },

    toggleDateRange() {
        if (this.filters.date.mode === 'range') {
            this.filters.date.mode = 'none';
            this.filters.date.from = '';
            this.filters.date.to = '';
        } else {
            this.filters.date.mode = 'range';
            this.filters.date.preset = '';
        }
        this.searchOffers(this.buildSearchParams());
    },

    onDateRangeChange(from, to) {
        if (from || to) {
            this.filters.date.mode = 'range';
            this.filters.date.preset = '';
        } else {
            this.filters.date.mode = 'none';
        }
        this.filters.date.from = from || '';
        this.filters.date.to = to || '';
        this.searchOffers(this.buildSearchParams());
    },

    clearFilters() {
        this.filters.user = '';
        this.filters.myOffers = false;
        this.filters.date.mode = 'none';
        this.filters.date.preset = '';
        this.filters.date.from = '';
        this.filters.date.to = '';
        this._closeDatePopover();
        this.searchOffers(this.buildSearchParams());
    },

    _closeDatePopover() {
        const popover = document.getElementById('pv-date-popover');
        if (popover) popover.style.display = 'none';
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
            '<option value="">Wszyscy</option>' +
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
            this.filters.myOffers = false;
        }
    }
};
