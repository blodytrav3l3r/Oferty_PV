// @ts-check
/* ============================
   WITROS — Uniwersalny Modal Wydruku
   printModal.js
   Helper wspólny dla studni i rur.
   Renderuje modal z sekcjami:
   - OFERTA (bazowa oferta z offerId)
   - OFERTA (bieżący stan zamówienia) — widoczna w orderEditMode
   - ZAMÓWIENIA (related orders per id) — per wiersz PDF/Word
   - KARTY BUDOWY (per related order) — per wiersz PDF/Word

   Wykorzystuje event delegation — listener na body dispatchuje
   onclick na podstawie atrybutów data-action/data-id/data-format.

   Użycie z offerPrintManager.js (studnie):
       window.showUniversalPrintModal({
           modalTitle: 'Wydruk Dokumentów',
           offerSection: { id: offerId, actionPdf: 'exportOfferDirect_action', actionDocx: 'exportOfferDirect_action' },
           orderCurrentSection: { id: orderId, actionPdf: 'exportStudnieOrderAsOffer_action', actionDocx: 'exportStudnieOrderAsOffer_action' },
           ordersSection: { orders: [...], actionPdf: 'exportOrderDirect_action', actionDocx: 'exportOrderDirect_action' },
           kartaSection: { orders: [...], actionPdf: 'exportKartaDirect_action', actionDocx: 'exportKartaDirect_action' }
       });
   ============================ */

(function () {
    const MODAL_ID = 'universal-print-modal';

    function close() {
        const m = document.getElementById(MODAL_ID);
        if (m) m.remove();
    }

    function renderOfferSection(cfg) {
        if (!cfg || !cfg.id) return '';
        const idEsc = window.escapeHtml(cfg.id);
        const pdfAction = window.escapeHtml(cfg.actionPdf);
        const docxAction = window.escapeHtml(cfg.actionDocx);
        return `
            <div class="upm-section" data-section="offer">
                <div class="upm-section-header">
                    <h4 class="upm-title upm-title-offer">
                        <i data-lucide="file-text"></i> ${window.escapeHtml(cfg.title || 'Wydruk Oferty')}
                    </h4>
                    <p class="upm-desc">${window.escapeHtml(cfg.description || 'Wybierz format eksportu oferty:')}</p>
                </div>
                <div class="upm-actions">
                    <button class="upm-btn upm-btn-pdf" data-action="${pdfAction}" data-id="${idEsc}" data-format="pdf">
                        <span class="upm-btn-icon"><i data-lucide="file-text"></i></span> PDF
                    </button>
                    <button class="upm-btn upm-btn-docx" data-action="${docxAction}" data-id="${idEsc}" data-format="docx">
                        <span class="upm-btn-icon"><i data-lucide="edit"></i></span> Word
                    </button>
                </div>
            </div>`;
    }

    function renderOrderCurrentSection(cfg) {
        if (!cfg || !cfg.id) return '';
        const idEsc = window.escapeHtml(cfg.id);
        const pdfAction = window.escapeHtml(cfg.actionPdf);
        const docxAction = window.escapeHtml(cfg.actionDocx);
        const badge = cfg.badge
            ? `<span class="upm-badge">${window.escapeHtml(cfg.badge)}</span>`
            : '';
        return `
            <div class="upm-section" data-section="orderCurrent">
                <div class="upm-section-header">
                    <h4 class="upm-title upm-title-orderCurrent">
                        <i data-lucide="package"></i> ${window.escapeHtml(cfg.title || 'Oferta (stan bieżący zamówienia)')} ${badge}
                    </h4>
                    <p class="upm-desc">${window.escapeHtml(cfg.description || 'Drukuje aktualne pozycje z edycji zamówienia.')}</p>
                </div>
                <div class="upm-actions">
                    <button class="upm-btn upm-btn-pdf" data-action="${pdfAction}" data-id="${idEsc}" data-format="pdf">
                        <span class="upm-btn-icon"><i data-lucide="file-text"></i></span> PDF
                    </button>
                    <button class="upm-btn upm-btn-docx" data-action="${docxAction}" data-id="${idEsc}" data-format="docx">
                        <span class="upm-btn-icon"><i data-lucide="edit"></i></span> Word
                    </button>
                </div>
            </div>`;
    }

    function renderOrdersSection(cfg) {
        if (!cfg || !Array.isArray(cfg.orders) || cfg.orders.length === 0) return '';
        const pdfAction = window.escapeHtml(cfg.actionPdf);
        const docxAction = window.escapeHtml(cfg.actionDocx);
        const rows = cfg.orders
            .map((ord) => {
                const idEsc = window.escapeHtml(ord.id);
                const ordNum = window.escapeHtml(
                    ord.orderNumber || (ord.id ? ord.id.substring(0, 8) : '—')
                );
                const status = ord.status
                    ? `<span class="upm-status upm-status-${window.escapeHtml(ord.status)}">${window.escapeHtml(ord.status)}</span>`
                    : '';
                return `
                <div class="upm-row upm-row-orders">
                    <span class="upm-row-label" title="Zamówienie ${ordNum}">ZAM: ${ordNum}${status}</span>
                    <div class="upm-row-actions">
                        <button class="upm-btn-sm upm-btn-pdf" data-action="${pdfAction}" data-id="${idEsc}" data-format="pdf">PDF</button>
                        <button class="upm-btn-sm upm-btn-docx" data-action="${docxAction}" data-id="${idEsc}" data-format="docx">Word</button>
                    </div>
                </div>`;
            })
            .join('');
        return `
            <div class="upm-section" data-section="orders">
                <div class="upm-section-header">
                    <h4 class="upm-title upm-title-orders">
                        <i data-lucide="package"></i> ${window.escapeHtml(cfg.title || 'Wydruk Zamówienia')}
                    </h4>
                    <p class="upm-desc">${window.escapeHtml(cfg.description || 'Wybierz zamówienie i format:')}</p>
                </div>
                <div class="upm-orders-list">${rows}</div>
            </div>`;
    }

    function renderKartaSection(cfg) {
        if (!cfg || !Array.isArray(cfg.orders) || cfg.orders.length === 0) return '';
        const pdfAction = window.escapeHtml(cfg.actionPdf);
        const docxAction = window.escapeHtml(cfg.actionDocx);
        const rows = cfg.orders
            .map((ord) => {
                const idEsc = window.escapeHtml(ord.id);
                const ordNum = window.escapeHtml(
                    ord.orderNumber || (ord.id ? ord.id.substring(0, 8) : '—')
                );
                return `
                <div class="upm-row upm-row-karta">
                    <span class="upm-row-label" title="Karta Budowy ${ordNum}">KB: ${ordNum}</span>
                    <div class="upm-row-actions">
                        <button class="upm-btn-sm upm-btn-pdf" data-action="${pdfAction}" data-id="${idEsc}" data-format="pdf">PDF</button>
                        <button class="upm-btn-sm upm-btn-docx" data-action="${docxAction}" data-id="${idEsc}" data-format="docx">Word</button>
                    </div>
                </div>`;
            })
            .join('');
        return `
            <div class="upm-section" data-section="karta">
                <div class="upm-section-header">
                    <h4 class="upm-title upm-title-karta">
                        <i data-lucide="hard-hat"></i> ${window.escapeHtml(cfg.title || 'Wydruk Karty Budowy')}
                    </h4>
                    <p class="upm-desc">${window.escapeHtml(cfg.description || 'Wybierz zamówienie i format Karty Budowy:')}</p>
                </div>
                <div class="upm-orders-list">${rows}</div>
            </div>`;
    }

    function renderCombinedFilters() {
        const canFilterUsers =
            typeof currentUser !== 'undefined' &&
            currentUser &&
            (currentUser.role === 'admin' || currentUser.role === 'pro');
        const userField = canFilterUsers
            ? `<label class="upm-combined-field">
                        <span>Użytkownik</span>
                        <select class="upm-combined-select" data-combined-filter="userId">
                            <option value="">Wszyscy użytkownicy</option>
                        </select>
                    </label>`
            : '';
        return `
            <div class="upm-combined-filters">
                <label class="upm-combined-field">
                    <span>Numer oferty / klient</span>
                    <input type="text" class="upm-combined-select" data-combined-filter="q" placeholder="Szukaj..." />
                </label>
                <label class="upm-combined-field">
                    <span>Data od</span>
                    <input type="date" class="upm-combined-select" data-combined-filter="dateFrom" />
                </label>
                <label class="upm-combined-field">
                    <span>Data do</span>
                    <input type="date" class="upm-combined-select" data-combined-filter="dateTo" />
                </label>
                ${userField}
                <button class="upm-btn upm-btn-sm" data-action="combinedFilter_action" type="button">
                    Filtruj
                </button>
            </div>`;
    }

    function renderCombinedSection(cfg) {
        if (!cfg) return '';
        return `
            <div class="upm-section" data-section="combined">
                <div class="upm-section-header">
                    <h4 class="upm-title upm-title-combined">
                        <i data-lucide="files"></i> ${window.escapeHtml(cfg.title || 'Wydruk łączny')}
                    </h4>
                    <p class="upm-desc">${window.escapeHtml(cfg.description || 'Połącz ofertę rur i studni w jeden plik:')}</p>
                </div>
                ${renderCombinedFilters()}
                <div class="upm-combined-form">
                    <label class="upm-combined-field">
                        <span>Oferta rur</span>
                        <select class="upm-combined-select" data-combined-field="rury">
                            <option value="">Ładowanie...</option>
                        </select>
                    </label>
                    <label class="upm-combined-field">
                        <span>Oferta studni</span>
                        <select class="upm-combined-select" data-combined-field="studnie">
                            <option value="">Ładowanie...</option>
                        </select>
                    </label>
                    <label class="upm-combined-field">
                        <span>Format</span>
                        <select class="upm-combined-select" data-combined-field="format">
                            <option value="pdf">PDF</option>
                            <option value="docx">Word (DOCX)</option>
                        </select>
                    </label>
                    <button class="upm-btn upm-btn-combined" data-action="combinedExport_action" type="button">
                        <span class="upm-btn-icon"><i data-lucide="files"></i></span> Eksportuj
                    </button>
                </div>
            </div>`;
    }

    function offerOptionLabel(item, key) {
        const num = item[key] || item.title || item.id || '—';
        const datePart = item.createdAt ? ` (${String(item.createdAt).slice(0, 10)})` : '';
        return `${num}${datePart}`;
    }

    function fillSelect(select, items, currentId, labelKey) {
        select.innerHTML = '';
        if (!items.length) {
            const emptyOpt = document.createElement('option');
            emptyOpt.value = '';
            emptyOpt.textContent = 'Brak ofert';
            select.appendChild(emptyOpt);
            return;
        }
        for (const item of items) {
            const opt = document.createElement('option');
            opt.value = item.id;
            opt.textContent = offerOptionLabel(item, labelKey);
            select.appendChild(opt);
        }
        if (currentId && items.some((item) => item.id === currentId)) {
            select.value = currentId;
        }
    }

    async function fetchOfferList(url) {
        if (typeof fetch !== 'function') return [];
        const headers = typeof authHeaders === 'function' ? authHeaders() : {};
        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        return Array.isArray(json.data) ? json.data : [];
    }

    function readCombinedFilters(modal) {
        const getVal = (name) =>
            modal.querySelector(`[data-combined-filter="${name}"]`)?.value?.trim() || '';
        return {
            q: getVal('q'),
            dateFrom: getVal('dateFrom'),
            dateTo: getVal('dateTo'),
            userId: getVal('userId')
        };
    }

    function buildSearchUrl(type, filters) {
        const params = new URLSearchParams();
        params.set('type', type);
        params.set('limit', '100');
        if (filters.q) params.set('q', filters.q);
        if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
        if (filters.dateTo) params.set('dateTo', filters.dateTo);
        if (filters.userId) params.set('userId', filters.userId);
        return `/api/offers/search?${params.toString()}`;
    }

    async function populateUserFilter(modal) {
        const userSel = modal.querySelector('[data-combined-filter="userId"]');
        if (!userSel || userSel.options.length > 1) return;
        if (typeof fetch !== 'function') return;
        const headers = typeof authHeaders === 'function' ? authHeaders() : {};
        const res = await fetch('/api/users-for-assignment', { headers });
        if (!res.ok) return;
        const json = await res.json();
        const users = Array.isArray(json.data) ? json.data : [];
        for (const u of users) {
            const opt = document.createElement('option');
            opt.value = u.id;
            const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || u.id;
            opt.textContent = name;
            userSel.appendChild(opt);
        }
    }

    async function populateCombinedSection(modal, cfg) {
        if (!modal || !cfg) return;
        const rurySel = modal.querySelector('[data-combined-field="rury"]');
        const studnieSel = modal.querySelector('[data-combined-field="studnie"]');
        if (!rurySel || !studnieSel) return;

        const showFallback = (select) => {
            if (select.options.length === 1 && select.options[0].value === '') {
                select.options[0].textContent = 'Brak danych';
            }
        };

        try {
            const filters = readCombinedFilters(modal);
            const [ruryOffers, studnieOffers] = await Promise.all([
                fetchOfferList(buildSearchUrl('offer', filters)),
                fetchOfferList(buildSearchUrl('studnia_oferta', filters))
            ]);
            fillSelect(rurySel, ruryOffers, cfg.currentRuryId || '', 'number');
            fillSelect(studnieSel, studnieOffers, cfg.currentStudnieId || '', 'number');
            await populateUserFilter(modal);
        } catch (e) {
            if (typeof logger !== 'undefined') {
                logger.error('printModal', 'Błąd ładowania list ofert (wydruk łączny)', e);
            }
            showFallback(rurySel);
            showFallback(studnieSel);
        }
    }

    window.combinedFilter_action = async function () {
        const modal = document.getElementById(MODAL_ID);
        if (!modal) return;
        const rurySel = modal.querySelector('[data-combined-field="rury"]');
        const studnieSel = modal.querySelector('[data-combined-field="studnie"]');
        const cfg = window.__upmCombinedCfg || {};
        cfg.currentRuryId = rurySel?.value || cfg.currentRuryId || '';
        cfg.currentStudnieId = studnieSel?.value || cfg.currentStudnieId || '';
        await populateCombinedSection(modal, cfg);
    };

    async function combinedExport_action() {
        const modal = document.getElementById(MODAL_ID);
        if (!modal) return;
        const ruryId = modal.querySelector('[data-combined-field="rury"]')?.value?.trim();
        const studnieId = modal.querySelector('[data-combined-field="studnie"]')?.value?.trim();
        const format = modal.querySelector('[data-combined-field="format"]')?.value || 'pdf';

        if (!ruryId || !studnieId) {
            if (typeof showToast === 'function')
                showToast('Wybierz ofertę rur i ofertę studni', 'error');
            return;
        }
        if (format !== 'pdf' && format !== 'docx') {
            if (typeof showToast === 'function')
                showToast('Nieobsługiwany format eksportu', 'error');
            return;
        }

        try {
            if (typeof showToast === 'function') {
                showToast(`Generowanie wydruku łącznego (${format.toUpperCase()})...`, 'info');
            }
            const res = await fetch(`/api/export-combined/${format}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(typeof authHeaders === 'function' ? authHeaders() : {})
                },
                body: JSON.stringify({ offerRuryId: ruryId, offerStudnieId: studnieId })
            });
            if (!res.ok) {
                const errText = await res.text().catch(() => res.statusText);
                throw new Error(`Eksport łączny (${res.status}): ${errText.slice(0, 200)}`);
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `oferta_laczna_${ruryId.substring(0, 8)}_${studnieId.substring(0, 8)}.${format}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            if (typeof showToast === 'function') showToast('Pobrano wydruk łączny', 'success');
        } catch (err) {
            if (typeof logger !== 'undefined') {
                logger.error('printModal', 'combinedExport_action error:', err);
            }
            if (typeof showToast === 'function') {
                showToast(
                    'Błąd eksportu łącznego: ' + (err instanceof Error ? err.message : err),
                    'error'
                );
            }
        }
    }
    window.combinedExport_action = combinedExport_action;

    function handleClick(ev) {
        const btn = ev.target.closest('[data-action]');
        if (!btn) return;
        const modal = document.getElementById(MODAL_ID);
        if (!modal || !modal.contains(btn)) return;
        const action = btn.getAttribute('data-action') || '';
        if (action === '__upm_close') return;
        const id = btn.getAttribute('data-id');
        const format = btn.getAttribute('data-format');
        if (typeof window[action] !== 'function') {
            logger.error('printModal', 'printModal: brak globalnej funkcji', action);
            if (typeof showToast === 'function') showToast('Akcja eksportu niedostępna', 'error');
            return;
        }
        try {
            /** @type {Function} */ (window[action])(id, format);
        } catch (e) {
            logger.error('printModal', 'printModal: błąd wywołania', action, e);
        }
    }

    if (typeof document !== 'undefined' && !window.__upmListenerInstalled) {
        document.addEventListener('click', handleClick);
        window.__upmListenerInstalled = true;
    }

    window.showUniversalPrintModal = function (config) {
        config = config || {};
        const existing = document.getElementById(MODAL_ID);
        if (existing) existing.remove();

        const sectionsHtml =
            renderOfferSection(config.offerSection) +
            renderOrderCurrentSection(config.orderCurrentSection) +
            renderOrdersSection(config.ordersSection) +
            renderKartaSection(config.kartaSection) +
            renderCombinedSection(config.combinedSection);

        if (!sectionsHtml.trim()) {
            if (typeof showToast === 'function')
                showToast('Brak aktywnego dokumentu do wydruku', 'error');
            return;
        }

        const modalHtml = `
        <div id="${MODAL_ID}" class="upm-overlay">
            <div class="upm-modal" role="dialog" aria-modal="true" aria-labelledby="upm-modal-title">
                <div class="upm-header">
                    <div class="upm-header-text">
                        <h3 class="upm-modal-title" id="upm-modal-title">
                            <i data-lucide="printer"></i> ${window.escapeHtml(config.modalTitle || 'Wydruk Dokumentów')}
                        </h3>
                        ${config.subtitle ? `<p class="upm-modal-subtitle">${window.escapeHtml(config.subtitle)}</p>` : ''}
                    </div>
                    <button class="upm-close" data-action="__upm_close" type="button" aria-label="Zamknij">
                        <i data-lucide="x"></i>
                    </button>
                </div>
                <div class="upm-body">${sectionsHtml}</div>
                <div class="upm-footer">
                    <button class="upm-btn-secondary" data-action="__upm_close" type="button">Zamknij</button>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        if (typeof window.lucide !== 'undefined') window.lucide.createIcons();
        if (config.combinedSection) {
            window.__upmCombinedCfg = config.combinedSection;
            populateCombinedSection(document.getElementById(MODAL_ID), config.combinedSection);
        }
    };

    window.__upmHelperShow = window.showUniversalPrintModal;
    document.addEventListener('click', function (ev) {
        const btn = ev.target.closest('[data-action="__upm_close"]');
        if (btn) close();
    });
})();
