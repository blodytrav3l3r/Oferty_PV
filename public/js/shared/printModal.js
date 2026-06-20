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

    function escapeHtml(s) {
        if (s === null || s === undefined) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function renderOfferSection(cfg) {
        if (!cfg || !cfg.id) return '';
        const idEsc = escapeHtml(cfg.id);
        const pdfAction = escapeHtml(cfg.actionPdf);
        const docxAction = escapeHtml(cfg.actionDocx);
        return `
            <div class="upm-section" data-section="offer">
                <div class="upm-section-header">
                    <h4 class="upm-title upm-title-offer">
                        <i data-lucide="file-text"></i> ${escapeHtml(cfg.title || 'Wydruk Oferty')}
                    </h4>
                    <p class="upm-desc">${escapeHtml(cfg.description || 'Wybierz format eksportu oferty:')}</p>
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
        const idEsc = escapeHtml(cfg.id);
        const pdfAction = escapeHtml(cfg.actionPdf);
        const docxAction = escapeHtml(cfg.actionDocx);
        const badge = cfg.badge ? `<span class="upm-badge">${escapeHtml(cfg.badge)}</span>` : '';
        return `
            <div class="upm-section" data-section="orderCurrent">
                <div class="upm-section-header">
                    <h4 class="upm-title upm-title-orderCurrent">
                        <i data-lucide="package"></i> ${escapeHtml(cfg.title || 'Oferta (stan bieżący zamówienia)')} ${badge}
                    </h4>
                    <p class="upm-desc">${escapeHtml(cfg.description || 'Drukuje aktualne pozycje z edycji zamówienia.')}</p>
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
        const pdfAction = escapeHtml(cfg.actionPdf);
        const docxAction = escapeHtml(cfg.actionDocx);
        const rows = cfg.orders.map(ord => {
            const idEsc = escapeHtml(ord.id);
            const ordNum = escapeHtml(ord.orderNumber || (ord.id ? ord.id.substring(0, 8) : '—'));
            const status = ord.status ? `<span class="upm-status upm-status-${escapeHtml(ord.status)}">${escapeHtml(ord.status)}</span>` : '';
            return `
                <div class="upm-row upm-row-orders">
                    <span class="upm-row-label" title="Zamówienie ${ordNum}">ZAM: ${ordNum}${status}</span>
                    <div class="upm-row-actions">
                        <button class="upm-btn-sm upm-btn-pdf" data-action="${pdfAction}" data-id="${idEsc}" data-format="pdf">PDF</button>
                        <button class="upm-btn-sm upm-btn-docx" data-action="${docxAction}" data-id="${idEsc}" data-format="docx">Word</button>
                    </div>
                </div>`;
        }).join('');
        return `
            <div class="upm-section" data-section="orders">
                <div class="upm-section-header">
                    <h4 class="upm-title upm-title-orders">
                        <i data-lucide="package"></i> ${escapeHtml(cfg.title || 'Wydruk Zamówienia')}
                    </h4>
                    <p class="upm-desc">${escapeHtml(cfg.description || 'Wybierz zamówienie i format:')}</p>
                </div>
                <div class="upm-orders-list">${rows}</div>
            </div>`;
    }

    function renderKartaSection(cfg) {
        if (!cfg || !Array.isArray(cfg.orders) || cfg.orders.length === 0) return '';
        const pdfAction = escapeHtml(cfg.actionPdf);
        const docxAction = escapeHtml(cfg.actionDocx);
        const rows = cfg.orders.map(ord => {
            const idEsc = escapeHtml(ord.id);
            const ordNum = escapeHtml(ord.orderNumber || (ord.id ? ord.id.substring(0, 8) : '—'));
            return `
                <div class="upm-row upm-row-karta">
                    <span class="upm-row-label" title="Karta Budowy ${ordNum}">KB: ${ordNum}</span>
                    <div class="upm-row-actions">
                        <button class="upm-btn-sm upm-btn-pdf" data-action="${pdfAction}" data-id="${idEsc}" data-format="pdf">PDF</button>
                        <button class="upm-btn-sm upm-btn-docx" data-action="${docxAction}" data-id="${idEsc}" data-format="docx">Word</button>
                    </div>
                </div>`;
        }).join('');
        return `
            <div class="upm-section" data-section="karta">
                <div class="upm-section-header">
                    <h4 class="upm-title upm-title-karta">
                        <i data-lucide="hard-hat"></i> ${escapeHtml(cfg.title || 'Wydruk Karty Budowy')}
                    </h4>
                    <p class="upm-desc">${escapeHtml(cfg.description || 'Wybierz zamówienie i format Karty Budowy:')}</p>
                </div>
                <div class="upm-orders-list">${rows}</div>
            </div>`;
    }

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
            /** @type {Function} */(window[action])(id, format);
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
            renderKartaSection(config.kartaSection);

        if (!sectionsHtml.trim()) {
            if (typeof showToast === 'function') showToast('Brak aktywnego dokumentu do wydruku', 'error');
            return;
        }

        const modalHtml = `
        <div id="${MODAL_ID}" class="upm-overlay">
            <div class="upm-modal" role="dialog" aria-modal="true" aria-labelledby="upm-modal-title">
                <div class="upm-header">
                    <div class="upm-header-text">
                        <h3 class="upm-modal-title" id="upm-modal-title">
                            <i data-lucide="printer"></i> ${escapeHtml(config.modalTitle || 'Wydruk Dokumentów')}
                        </h3>
                        ${config.subtitle ? `<p class="upm-modal-subtitle">${escapeHtml(config.subtitle)}</p>` : ''}
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
    };

    window.__upmShow = window.showUniversalPrintModal;
    window.__upmHelperShow = window.showUniversalPrintModal;
    window.__upmClose = close;
    document.addEventListener('click', function (ev) {
        const btn = ev.target.closest('[data-action="__upm_close"]');
        if (btn) close();
    });
})();
