import PV_SyncManager from './PV_SyncManager.js';
import PV_MarketplaceManager from './PV_MarketplaceManager.js';
import { storageService } from '../shared/StorageService.js';

class PVSalesUI {
    constructor() {
        this.syncManager = null;
        this.marketplaceManager = null;
        this.isSyncUpToDate = true; // Zainicjalizuj optymistycznie
        
        this.init();
    }

    async init() {
        if (this.syncManager) return; // Już zainicjalizowane

        try {
            const userStr = sessionStorage.getItem('user');
            if (!userStr) {
                console.log('[PVSalesUI] Czekam na dane użytkownika w sessionStorage (ponowienie za 500ms)...');
                setTimeout(() => this.init(), 500);
                return;
            }

            const user = JSON.parse(userStr);
            console.log('[PVSalesUI] Inicjalizacja dla użytkownika:', user.username);

            // Inicjalizacja menedżerów bazy
            this.syncManager = new PV_SyncManager(user);
            await this.syncManager.initDatabase();
            this.syncManager.startSync();

            this.marketplaceManager = new PV_MarketplaceManager(this.syncManager);

            // Inicjalizacja StorageService
            await storageService.init(this.syncManager);

            // Nasłuchiwanie statusu synchronizacji
            window.addEventListener('pv-sync-status-changed', (e) => {
                // Dla "Klaster" wystarczy nam synchronizacja z prywatną bazą usera na serwerze
                this.isSyncUpToDate = e.detail.syncIsUpToDate;
                
                // Jeśli jesteśmy w trakcie wyświetlania listy, odśwież ją by pokazać "Klaster"
                const activeSection = document.querySelector('.section.active');
                if (activeSection && activeSection.id === 'section-sales') {
                    this.loadLocalOffers();
                }
            });

            // Przypisanie event listenerów do formularzy szukania
            this.attachEventListeners();

            // Renderowanie początkowych danych
            await this.loadLocalOffers();

            // Nasłuchiwanie zmian w bazie by na żywo aktualizować UI
            this.listenForChanges();

        } catch (error) {
            console.error('[PVSalesUI] Błąd inicjalizacji UI Sprzedaży:', error);
            const listDiv = document.getElementById('pv-local-offers-list');
            if (listDiv) listDiv.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--text-danger);">Błąd ładowania ofert: ${error.message}</div>`;
        }
    }

    attachEventListeners() {
        const searchBtn = document.getElementById('pv-global-search-btn');
        const searchInput = document.getElementById('pv-global-search-input');

        if (searchBtn && searchInput) {
            searchBtn.addEventListener('click', () => {
                this.performGlobalSearch(searchInput.value);
            });

            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.performGlobalSearch(searchInput.value);
                }
            });
        }
    }

    async loadLocalOffers() {
        const listDiv = document.getElementById('pv-local-offers-list');
        if (!listDiv) return;

        try {
            // Pobieramy oferty przez StorageService
            const docs = await storageService.getOffers();

            if (docs.length === 0) {
                listDiv.innerHTML = `<div style="text-align:center; padding: 2rem; color: var(--text-muted); font-style: italic;">Nie masz jeszcze żadnych zapisanych ofert.</div>`;
                return;
            }

            listDiv.innerHTML = this.renderOffersList(docs, true);
            this.attachActionListeners(listDiv);

        } catch (error) {
            console.error('[PVSalesUI] Błąd pobierania lokalnych ofert:', error);
            listDiv.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--text-danger);">Błąd komunikacji z PouchDB.</div>`;
        }
    }

    async performGlobalSearch(query) {
        const resultsDiv = document.getElementById('pv-global-search-results');
        if (!resultsDiv) return;

        if (!query.trim()) {
            resultsDiv.innerHTML = `<div style="grid-column: 1/-1; text-align:center; color: var(--text-muted); padding: 2rem; font-style: italic;">Wpisz frazę wyszukiwania.</div>`;
            return;
        }

        resultsDiv.innerHTML = `<div style="grid-column: 1/-1; text-align:center; color: var(--text-muted); padding: 2rem;">Wyszukiwanie w Klastrze...</div>`;

        try {
            // Wywołanie API Endpointu /api/pv-marketplace/search (BackendGateway)
            const response = await fetch('/api/pv-marketplace/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: query })
            });

            if (!response.ok) throw new Error(`API Error: ${response.status}`);

            const data = await response.json();
            const docs = data.docs || [];

            if (docs.length === 0) {
                resultsDiv.innerHTML = `<div style="grid-column: 1/-1; text-align:center; color: var(--text-muted); padding: 2rem; font-style: italic;">Brak pasujących wyników.</div>`;
                return;
            }

            resultsDiv.innerHTML = this.renderOffersList(docs, false);

        } catch (error) {
            console.error('[PVSalesUI] Błąd wyszukiwania globalnego:', error);
            resultsDiv.innerHTML = `<div style="grid-column: 1/-1; text-align:center; color: var(--text-danger); padding: 2rem;">Wystąpił błąd podczas wyszukiwania.</div>`;
        }
    }

    renderOffersList(offers, isLocalList) {
        return offers.map(offer => {
            const revNum = offer._rev ? parseInt(offer._rev.split('-')[0]) : 0;
            const isAdminOrPro = this.syncManager && (this.syncManager.role === 'admin' || this.syncManager.role === 'pro');
            
            // Oferta jest zsynchronizowana jeśli:
            // 1. Pochodzi z listy globalnej (isLocalList = false)
            // 2. Ma numer rewizji > 1
            // 3. Jest Adminem/Pro
            // 4. NOWOŚĆ: Baza jest "up to date" (wszystko co było lokalnie zostało wysłane)
            const isSynced = !isLocalList || revNum > 1 || isAdminOrPro || (this.isSyncUpToDate && revNum > 0); 
            
            const localBadge = `<span style="background: rgba(52, 211, 153, 0.1); color: #34d399; padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(52, 211, 153, 0.3);">💾 Lokalnie</span>`;
            const remoteBadge = isSynced 
                ? `<span style="background: rgba(59, 130, 246, 0.1); color: #60a5fa; padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(59, 130, 246, 0.3);">☁️ Klaster</span>`
                : `<span style="background: rgba(245, 158, 11, 0.1); color: #fbbf24; padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(245, 158, 11, 0.3);">⏳ Sync...</span>`;

            const dateStr = offer.createdAt ? new Date(offer.createdAt).toLocaleDateString('pl-PL') : '—';
            
            let priceVal = offer.totalNetto || offer.totalBrutto || 0;
            if (!priceVal && offer.data) {
                if (offer.data.summary) priceVal = offer.data.summary.totalValue || offer.data.summary.totalNetto || offer.data.summary.totalBrutto || 0;
                else if (offer.data.costSummary) priceVal = offer.data.costSummary.totalValue || 0;
                else priceVal = offer.data.totalNetto || offer.data.totalBrutto || 0;
            }
            if (!priceVal && offer.price) priceVal = offer.price;

            const isWell = offer.type === 'studnia_oferta';
            const icon = isWell ? '🏗️' : '🔧';
            
            let itemCount = 0;
            if (isWell) {
                itemCount = offer.wells ? offer.wells.length : (offer.data && offer.data.wells ? offer.data.wells.length : 0);
            } else {
                itemCount = offer.items ? offer.items.length : (offer.data && offer.data.items ? offer.data.items.length : 0);
            }

            const clientInfo = offer.clientName || (offer.data && offer.data.clientName) || 'Brak danych';
            
            return `
                <div class="card offer-list-item" style="padding: 0.8rem 1.2rem; border-radius: 8px; border: 1px solid var(--border-glass); background: var(--bg-card); display: flex; align-items: center; gap: 1.5rem; justify-content: space-between;">
                    
                    <div style="display: flex; align-items: center; gap: 1rem; flex: 2; min-width: 0;">
                        <div style="font-size: 1.5rem; opacity: 0.7;">${icon}</div>
                        <div style="min-width: 0;">
                            <div style="font-weight: 700; font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${offer.number || offer.title || 'Oferta'}">
                                ${offer.number || offer.title || offer.offerName || 'Oferta bez numeru'}
                            </div>
                            <div style="font-size: 0.75rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                👤 ${clientInfo}
                            </div>
                        </div>
                    </div>

                    <div style="flex: 1; min-width: 100px; display: flex; flex-direction: column; align-items: center;">
                        <div style="font-weight: 700; color: var(--accent-light); font-size: 1.1rem;">
                            ${typeof formatCurrency === 'function' ? formatCurrency(priceVal) : priceVal.toFixed(2) + ' PLN'} <span style="font-size: 0.6rem; opacity: 0.7;">netto</span>
                        </div>
                        <div style="font-size: 0.7rem; color: var(--text-muted);">
                            📦 ${itemCount} ${isWell ? 'studni' : 'poz.'} | 📅 ${dateStr}
                        </div>
                    </div>

                    <div style="flex: 1; display: flex; gap: 0.4rem; justify-content: center; flex-wrap: wrap;">
                        ${isLocalList ? localBadge : ''}
                        ${remoteBadge}
                    </div>

                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        ${isLocalList ? `
                            <button class="btn btn-sm btn-primary btn-edit-pv-offer" data-id="${offer._id}" data-type="${offer.type}" style="padding: 0.4rem 1rem;">Edytuj</button>
                            ${(offer.history && offer.history.length > 0) ? `<button class="btn btn-sm btn-secondary btn-history-pv-offer" data-id="${offer._id}" data-type="${offer.type}" title="Historia zmian" style="padding: 0.4rem 0.6rem;">⏳</button>` : ''}
                            ${offer.clientPhone ? `<a href="tel:${offer.clientPhone}" class="btn btn-sm" style="background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3); color: #34d399; text-decoration: none; padding: 0.4rem 0.6rem;">📞</a>` : ''}
                            <button class="btn btn-sm btn-delete-pv-offer" data-id="${offer._id}" data-rev="${offer._rev}" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; padding: 0.4rem 0.6rem;" title="Usuń ofertę">✕</button>
                        ` : `
                            <button class="btn btn-sm btn-primary btn-view-pv-offer" data-id="${offer._id}" style="padding: 0.4rem 1rem;">Szczegóły</button>
                        `}
                    </div>
                </div>
            `;
        }).join('');
    }

    attachActionListeners(container) {
        // Edit Action
        container.querySelectorAll('.btn-edit-pv-offer').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const btnEl = e.target.closest('button');
                const id = btnEl.getAttribute('data-id');
                const type = btnEl.getAttribute('data-type');
                const currentPage = window.location.pathname.split('/').pop() || 'index.html';

                if (type === 'studnia_oferta' && currentPage !== 'studnie.html') {
                    window.location.href = `studnie.html?edit=${id}`;
                    return;
                } else if (type === 'offer' && currentPage !== 'rury.html') {
                    window.location.href = `rury.html?edit=${id}`;
                    return;
                }

                try {
                    const doc = await this.marketplaceManager.localOffers.get(id);
                    this.openOfferForEdit(doc, id, type);
                } catch (err) {
                    console.error('[PVSalesUI] Błąd pobierania do edycji:', err);
                }
            });
        });

        // History Action
        container.querySelectorAll('.btn-history-pv-offer').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const btnEl = e.target.closest('button');
                const id = btnEl.getAttribute('data-id');
                this.showOfferHistoryUnified(id);
            });
        });

        // Delete Action
        container.querySelectorAll('.btn-delete-pv-offer').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const btnEl = e.target.closest('button');
                const id = btnEl.getAttribute('data-id');
                const rev = btnEl.getAttribute('data-rev');
                
                await this.deleteOfferWithConfirmation(id, rev);
            });
        });
    }

    async deleteOfferWithConfirmation(id, rev) {
        if (!confirm('UWAGA!\nCzy na pewno chcesz USUNĄĆ tę ofertę?\n\nOferta zostanie trwale usunięta z Twojej bazy lokalnej ORAZ z serwera głównego (po synchronizacji).')) {
            return;
        }

        try {
            await storageService.deleteOffer(id, rev);
            if (typeof window.showToast === 'function') {
                window.showToast('Oferta została usunięta.', 'success');
            }
            // Lista zostanie automatycznie odświeżona prze listenForChanges()
        } catch (error) {
            console.error('[PVSalesUI] Błąd podczas usuwania:', error);
            if (typeof window.showToast === 'function') {
                window.showToast('Błąd podczas usuwania oferty.', 'error');
            }
        }
    }

    openOfferForEdit(doc, id, type) {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        
        const targetBtnId = type === 'studnia_oferta' ? 'nav-builder' : 'nav-offer';
        const targetSectionId = type === 'studnia_oferta' ? 'section-builder' : 'section-offer';
        
        const homeBtn = document.getElementById(targetBtnId);
        const homeSection = document.getElementById(targetSectionId);
        
        if(homeBtn && homeSection) {
            homeBtn.classList.add('active');
            homeSection.classList.add('active');

            if (type === 'offer' && typeof window.loadSavedOfferData === 'function') {
                window.loadSavedOfferData(doc, id);
                if(typeof window.showToast === 'function') window.showToast('Oferta załadowana do edycji');
            } else if (type === 'studnia_oferta' && typeof window.loadSavedOfferStudnie === 'function') {
                window.loadSavedOfferStudnie(doc, id);
                if(typeof window.showToast === 'function') window.showToast('Oferta Studni załadowana');
            }
        }
    }

    async showOfferHistoryUnified(id) {
        try {
            const offer = await storageService.getOfferById(id);
            if (!offer || !offer.history || offer.history.length === 0) {
                if (typeof window.showToast === 'function') window.showToast('Brak historii dla tej oferty', 'info');
                return;
            }

            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay';
            overlay.id = 'offer-history-modal';

            const formatter = typeof window.fmt === 'function' ? window.fmt : (val) => (val || 0).toFixed(2).replace('.', ',');

            let historyHtml = offer.history.map((h, i) => {
                const nextState = i === offer.history.length - 1 ? offer : offer.history[i + 1];
                const priceDiff = (nextState.totalBrutto || 0) - (h.totalBrutto || 0);

                let diffHtml = '';
                if (Math.abs(priceDiff) > 0.01) {
                    if (priceDiff > 0) {
                        diffHtml = `<span style="color:var(--danger); font-size:0.8rem; font-weight:700;">+${formatter(priceDiff)} PLN</span>`;
                    } else {
                        diffHtml = `<span style="color:var(--success); font-size:0.8rem; font-weight:700;">${formatter(priceDiff)} PLN</span>`;
                    }
                } else {
                    diffHtml = `<span style="color:var(--text-muted); font-size:0.8rem;">Bez zmian</span>`;
                }

                const itemCount = h.wells ? h.wells.length : (h.items ? h.items.length : 0);
                const unitName = h.type === 'studnia_oferta' ? 'studni' : 'poz.';

                return `
                    <div style="background:var(--bg-glass); border:1px solid var(--border-glass); border-radius:8px; padding:1rem; margin-bottom:0.8rem;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem; border-bottom:1px dashed var(--border-glass); padding-bottom:0.4rem;">
                            <strong style="color:var(--text-primary);">${new Date(h.updatedAt).toLocaleString()}</strong>
                            <div style="text-align:right;">
                                <div style="font-size:0.75rem; color:var(--text-muted);">Zapisana przez: <strong style="color:var(--text-secondary);">${h.lastEditedBy || h.userName || '—'}</strong></div>
                                <div style="font-size:0.75rem; color:var(--text-muted);">Nadpisana przez: <strong style="color:var(--accent);">${nextState.lastEditedBy || nextState.userName || '—'}</strong></div>
                            </div>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <div>
                                <div style="font-size:0.85rem; color:var(--text-secondary);">Wersja przed zmianą</div>
                                <div style="font-size:1.1rem; font-weight:700;">💰 ${formatter(h.totalBrutto || 0)} PLN</div>
                                <div style="font-size:0.8rem; color:var(--text-muted);">${unitName}: ${itemCount}</div>
                            </div>
                            <div style="text-align:right;">
                                <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:0.2rem;">Różnica do kolejnej wersji:</div>
                                ${diffHtml}
                                <div style="margin-top:0.6rem;">
                                    <button class="btn btn-sm btn-secondary" onclick="window.pvSalesUI.restoreOfferVersionUnified('${id}', ${i})">Przywróć tę wersję</button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).reverse().join('');

            overlay.innerHTML = `
                <div class="modal" style="max-width:800px; width:95%; border-radius:12px; max-height:90vh; display:flex; flex-direction:column;">
                    <div class="modal-header" style="border-bottom:1px solid var(--border); padding-bottom:0.8rem;">
                        <h3 style="font-weight:700;">⏳ Historia zmian oferty: ${offer.number}</h3>
                        <button class="btn-icon" onclick="typeof closeModal === 'function' ? closeModal() : this.closest('.modal-overlay').remove()">✕</button>
                    </div>
                    <div style="padding:1rem 0; overflow-y:auto; flex:1;">
                        ${historyHtml}
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
            overlay.classList.add('active');
            overlay.addEventListener('click', e => { if (e.target === overlay) { if(typeof window.closeModal === 'function') window.closeModal(); else overlay.remove(); } });

        } catch (error) {
            console.error('[PVSalesUI] Błąd wyświetlania historii:', error);
            if (typeof window.showToast === 'function') window.showToast('Błąd pobierania historii', 'error');
        }
    }

    async restoreOfferVersionUnified(offerId, historyIndex) {
        try {
            const offer = await storageService.getOfferById(offerId);
            if (!offer || !offer.history || !offer.history[historyIndex]) return;

            const snapshot = offer.history[historyIndex];
            const type = offer.type;
            const currentPage = window.location.pathname.split('/').pop() || 'index.html';

            // Check if we need to redirect
            const isStudnia = type === 'studnia_oferta';
            const isRuryPage = currentPage === 'rury.html';
            const isStudniePage = currentPage === 'studnie.html';

            if (isStudnia && !isStudniePage) {
                // Redirect to studnie.html with restoration data
                // For simplicity, we redirect for regular edit which will load latest, 
                // but to restore a SPECIFIC version across pages we'd need more complex state.
                // For now, let's redirect to edit and the user can pick the version there if needed, 
                // or we just switch and then the user can restore from history ON the correct page.
                if (confirm('Aby przywrócić tę wersję studni, musisz przejść do zakładki STUDNIE. Przejść teraz?')) {
                    window.location.href = `studnie.html?edit=${offerId}&restore=${historyIndex}`;
                }
                return;
            } else if (!isStudnia && !isRuryPage) {
                if (confirm('Aby przywrócić tę wersję oferty rur, musisz przejść do zakładki RURY. Przejść teraz?')) {
                    window.location.href = `rury.html?edit=${offerId}&restore=${historyIndex}`;
                }
                return;
            }

            // If we are on the correct page, restore directly
            if (isStudnia && typeof window.loadSavedOfferStudnie === 'function') {
                window.loadSavedOfferStudnie(snapshot);
            } else if (!isStudnia && typeof window.loadSavedOfferData === 'function') {
                window.loadSavedOfferData(snapshot, offerId);
            }

            if (typeof window.closeModal === 'function') window.closeModal();
            if (typeof window.showSection === 'function') {
                window.showSection(isStudnia ? 'builder' : 'offer');
            } else {
                const navId = isStudnia ? 'nav-builder' : 'nav-offer';
                const btn = document.getElementById(navId);
                if (btn) btn.click();
            }
            
            if (typeof window.showToast === 'function') window.showToast('Poprzednia wersja wczytana do formularza.', 'success');

        } catch (error) {
            console.error('[PVSalesUI] Błąd przywracania wersji:', error);
            if (typeof window.showToast === 'function') window.showToast('Błąd przywracania wersji', 'error');
        }
    }

    listenForChanges() {
        if (!this.marketplaceManager || !this.marketplaceManager.localOffers) return;

        this.marketplaceManager.localOffers.changes({
            since: 'now',
            live: true,
            include_docs: true
        }).on('change', () => {
            console.log('[PVSalesUI] Wykryto zmianę w lokalnym PouchDB, odświeżam listę ofert.');
            this.loadLocalOffers();
        }).on('error', (err) => {
            console.error('[PVSalesUI] Błąd na nasłuchiwaniu zmian PouchDB:', err);
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const navSales = document.getElementById('nav-sales');
    if(navSales) {
       window.pvSalesUI = new PVSalesUI();
       navSales.addEventListener('click', () => {
           if (window.pvSalesUI) {
               if (!window.pvSalesUI.syncManager) {
                   window.pvSalesUI.init();
               } else {
                   window.pvSalesUI.loadLocalOffers();
               }
           }
       });
    }
});
