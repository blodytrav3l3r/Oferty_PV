// @ts-check
// Moduł wyszukiwania dla PV Sales UI
import { storageService } from '../shared/StorageService.js';

export default {
    async init() {
        if (this.initialized) return;

        try {
            const userStr = sessionStorage.getItem('user');
            if (!userStr) {
                this.initRetryCount++;
                if (this.initRetryCount > this.initRetryMax) {
                    logger.error('kartotekaUi', 'Przekroczono limit prób inicjalizacji');
                    return;
                }
                logger.info(
                    'kartotekaUi',
                    '[KartotekaUI] Czekam na dane użytkownika w sessionStorage (ponowienie ' +
                        this.initRetryCount +
                        '/' +
                        this.initRetryMax +
                        ')...'
                );
                setTimeout(() => this.init(), 500);
                return;
            }

            this.initRetryCount = 0;

            const user = JSON.parse(userStr);
            this.role = user.role || 'user';
            logger.info('kartotekaUi', 'Inicjalizacja dla użytkownika:', user.username);

            await storageService.init();
            if (typeof fetchGlobalUsers === 'function') await fetchGlobalUsers();
            await this.searchOffers(this.buildSearchParams(), true);
            this.renderResults();

            // Załaduj mapę zamówień w tle — nie blokuje renderowania
            this.notifyOrderMutation();

            this._startAutoRefresh();

            this.initialized = true;
            if (typeof window.initAdvancedFilterEvents === 'function') {
                window.initAdvancedFilterEvents(this);
            }
        } catch (error) {
            logger.error('kartotekaUi', 'Błąd inicjalizacji UI Sprzedaży:', error);
            const listDiv = document.getElementById('ka-offers-list');
            if (listDiv)
                listDiv.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--text-danger);">Błąd ładowania ofert: ${window.escapeHtml(error.message)}</div>`;
        }
    },

    async loadLocalOffers() {
        logger.info('kartotekaUi', 'loadLocalOffers: Delegowanie do searchOffers...');
        await this.searchOffers(this.buildSearchParams());
        this.notifyOrderMutation();
    },

    _startAutoRefresh() {
        this._stopAutoRefresh();
        this.autoRefreshInterval = setInterval(() => {
            if (!document.hidden) {
                this.searchOffers(this.buildSearchParams()).catch((e) =>
                    logger.error('kartotekaUi', 'Auto-refresh error:', e)
                );
            }
        }, 60000);
    },

    _stopAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = null;
        }
    },

    /**
     * Handler dla oninput na search box — debounce + sync UI
     */
    onSearchInput() {
        this._syncFilterUI();
        clearTimeout(this.searchDebounceTimer);
        this.searchDebounceTimer = setTimeout(() => {
            this.searchOffers(this.buildSearchParams());
        }, 300);
    },

    /**
     * Buduje parametry wyszukiwania z obecnego stanu filtrów
     */
    buildSearchParams() {
        const input = document.getElementById('ka-local-search-input');
        const q = input ? input.value.trim() : '';

        let dateFrom = '';
        let dateTo = '';
        if (this.filters.date.mode === 'preset') {
            const resolved = window.resolveDatePreset(this.filters.date.preset);
            dateFrom = resolved.from;
            dateTo = resolved.to;
        } else if (this.filters.date.mode === 'range') {
            dateFrom = this.filters.date.from;
            dateTo = this.filters.date.to;
        }

        const userId = this.filters.user;

        return {
            q,
            type: this.currentTypeFilter,
            dateFrom,
            dateTo,
            userId,
            orderStatus: this.currentFilter,
            limit: 50,
            sort: 'createdAt',
            order: 'desc'
        };
    },

    async searchOffers(params = {}, skipRender) {
        if (this.abortController) {
            this.abortController.abort();
        }
        this.abortController = new AbortController();

        this.isLoading = true;
        this.showLoadingSpinner();

        const headers =
            typeof authHeaders === 'function'
                ? authHeaders()
                : { 'Content-Type': 'application/json' };

        const isLoadMore = !!params.cursor;
        const qs = new URLSearchParams({
            q: params.q || '',
            type: params.type || 'all',
            dateFrom: params.dateFrom || '',
            dateTo: params.dateTo || '',
            userId: params.userId || '',
            orderStatus: params.orderStatus || 'all',
            limit: String(params.limit || 50),
            sort: params.sort || 'createdAt',
            order: params.order || 'desc',
            cursor: params.cursor || '',
            cursorId: params.cursorId || '',
            t: String(Date.now())
        }).toString();

        try {
            const resp = await fetch('/api/offers/search?' + qs, {
                headers,
                signal: this.abortController.signal
            });

            if (!resp.ok) {
                const errBody = await resp.json().catch(() => ({}));
                if (resp.status === 429 && Number(errBody.retryAfter) > 0) {
                    this.showError(
                        errBody.error || window.httpErrorMessage(429),
                        Number(errBody.retryAfter)
                    );
                    return;
                }
                throw new Error(errBody.error || window.httpErrorMessage(resp.status));
            }
            const json = await resp.json();

            if (isLoadMore) {
                this.searchResults.items = [...this.searchResults.items, ...(json.data || [])];
                this.searchResults.hasMore = json.hasMore;
                this.searchResults.nextCursor = json.nextCursor;
                this.searchResults.nextCursorId = json.nextCursorId;
            } else {
                this.searchResults = {
                    items: json.data || [],
                    totalCount: json.totalCount || 0,
                    hasMore: json.hasMore,
                    nextCursor: json.nextCursor,
                    nextCursorId: json.nextCursorId
                };
                // Po nowym wyszukiwaniu odśwież listę opiekunów
                this.populateUserFilter();
            }

            if (!skipRender) this.renderResults();
            this.updateOfferCounter(this.searchResults.items.length, this.searchResults.totalCount);
        } catch (error) {
            if (error.name === 'AbortError') return;
            logger.error('kartotekaUi', 'Błąd wyszukiwania ofert:', error);
            this.showError(error.message || 'Błąd sieci');
        } finally {
            this.isLoading = false;
        }
    },

    /**
     * Ładuje kolejną stronę wyników (cursor-based pagination)
     */
    async loadMore() {
        if (this.isLoading || !this.searchResults?.hasMore) return;

        const params = this.buildSearchParams();
        params.cursor = this.searchResults.nextCursor;
        params.cursorId = this.searchResults.nextCursorId;
        params.limit = 50;

        await this.searchOffers(params);
        this.notifyOrderMutation();
    },

    /**
     * Renderuje wyniki wyszukiwania do kontenera kart
     */
    renderResults() {
        const listDiv = document.getElementById('ka-offers-list');
        if (!listDiv) return;

        const items = this.searchResults?.items || [];

        if (items.length === 0) {
            listDiv.innerHTML =
                '<div style="text-align:center; padding:2rem; color:var(--text-muted); font-style:italic;">Brak ofert pasujących do filtrów.</div>';
            return;
        }

        listDiv.innerHTML = this.renderOffersList(items, true);
        this.attachActionListeners(listDiv);
        if (window.lucide) lucide.createIcons({ root: listDiv });

        if (this.searchResults?.hasMore) {
            listDiv.insertAdjacentHTML('beforeend', this.renderLoadMore());
            document
                .getElementById('ka-load-more-btn')
                ?.addEventListener('click', () => this.loadMore());
        }
    },

    /**
     * HTML przycisku "Pokaż więcej"
     */
    renderLoadMore() {
        const shown = this.searchResults?.items?.length || 0;
        const total = this.searchResults?.totalCount;
        const label =
            total != null ? 'Pokaż więcej (' + shown + ' z ' + total + ')' : 'Pokaż więcej';
        return (
            '<div class="load-more-container" style="text-align:center; padding:1rem;">' +
            '<button class="btn btn-sm btn-secondary" id="ka-load-more-btn">' +
            label +
            '</button></div>'
        );
    },

    /**
     * Wyświetla spinner ładowania
     */
    showLoadingSpinner() {
        const el = document.getElementById('ka-offers-list');
        if (!el) return;
        el.innerHTML =
            '<div style="text-align:center; padding:2rem; color:var(--text-muted);">' +
            '<i data-lucide="loader-2" class="spin" style="width:24px;height:24px;animation:spin 1s linear infinite;"></i>' +
            '<br/><span style="font-size: var(--fs-lg); margin-top:0.5rem; display:inline-block;">Ładowanie ofert...</span></div>';
        if (window.lucide) lucide.createIcons({ root: el });
    },

    /**
     * Aktualizuje licznik ofert pod listą (wzór: "Koniec listy — 5/5")
     */
    updateOfferCounter(shown, total) {
        const el = document.getElementById('ka-offer-count');
        if (!el) return;
        const hasMore = !!(this.searchResults && this.searchResults.hasMore);
        if (total != null && shown > 0 && !hasMore) {
            el.textContent = 'Koniec listy — ' + shown + '/' + total;
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    },

    /**
     * Wyświetla błąd w kontenerze listy. Przy 429 pokazuje licznik odliczający
     * czas pozostały do możliwej ponownej próby (retryAfter w sekundach).
     */
    showError(message, retryAfter) {
        const listDiv = document.getElementById('ka-offers-list');
        if (!listDiv) return;
        const hasCountdown = Number(retryAfter) > 0;
        let html =
            '<div style="text-align:center; padding:2rem; color:var(--text-danger);">' +
            '<strong>Błąd:</strong><br/>' +
            '<span style="font-size: var(--fs-lg); opacity:0.8;">' +
            window.escapeHtml(message) +
            '</span><br/>';
        if (hasCountdown) {
            html +=
                '<span id="ka-retry-countdown" style="font-size: var(--fs-lg); opacity:0.9; display:inline-block; margin-top:0.5rem;">' +
                'Ponów próbę za <strong>' +
                Math.ceil(retryAfter) +
                '</strong> s</span><br/>';
        }
        html +=
            '<button class="btn btn-sm btn-secondary" style="margin-top:1rem;" data-action="retry-search">' +
            '<i data-lucide="refresh-cw"></i> Odśwież</button></div>';
        listDiv.innerHTML = html;

        const retryBtn = listDiv.querySelector('[data-action="retry-search"]');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => this.searchOffers(this.buildSearchParams()));
            if (hasCountdown) retryBtn.disabled = true;
        }

        if (hasCountdown && retryBtn) {
            if (this._rateLimitTimer) clearInterval(this._rateLimitTimer);
            let sec = Math.ceil(retryAfter);
            this._rateLimitTimer = setInterval(() => {
                const el = document.getElementById('ka-retry-countdown');
                if (!el) {
                    clearInterval(this._rateLimitTimer);
                    this._rateLimitTimer = null;
                    return;
                }
                sec--;
                if (sec <= 0) {
                    clearInterval(this._rateLimitTimer);
                    this._rateLimitTimer = null;
                    el.textContent = 'Możesz spróbować ponownie.';
                    retryBtn.disabled = false;
                } else {
                    el.innerHTML = 'Ponów próbę za <strong>' + sec + '</strong> s';
                }
            }, 1000);
        }

        setTimeout(() => {
            if (window.lucide) lucide.createIcons();
        }, 50);
    },

    renderOffersList(offers, isLocalList) {
        return offers
            .map((offer) => {
                const { hasOrder, orders, order } = this.getOrderForOffer(offer);
                return window.buildOfferCardHtml(
                    offer,
                    hasOrder,
                    orders,
                    order,
                    this.role,
                    isLocalList
                );
            })
            .join('');
    }
};
