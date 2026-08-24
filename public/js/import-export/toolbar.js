// @ts-check
/**
 * @typedef {object} ImportExportToolbar
 * @property {string|null} hostId
 * @property {(hostId:string)=>Promise<void>} init
 * @property {(inputId:string, entityParam?:string)=>string} _entityTypeHtml
 * @property {(inputId:string, moduleParam?:string)=>string} _moduleTypeHtml
 * @property {(number:string, module:string)=>Promise<any>} _findOrderByNumber
 * @property {(number:string, module:string)=>any} _findOfferByNumber
 * @property {(number:string, module:string, resultEl:HTMLElement)=>void} _offerNotFoundHint
 * @property {(modalId:string, titleId:string, title:string, bodyHtml:string, footerHtml:string)=>string} _ieModalHtml
 * @property {(modalId:string, onConfirm?:()=>Promise<void>)=>void} _bindIeModal
 * @property {()=>void} showExportXlsxDialog
 * @property {()=>void} showExportJsonPopup
 * @property {()=>void} showImportJsonDialog
 * @property {()=>void} showImportXlsxDialog
 */
/** @type {ImportExportToolbar} */
window.importExportToolbar = /** @type {any} */ ({
    hostId: null,

    async init(hostId) {
        this.hostId = hostId;
        const enabled = await ImportExportFeatureFlag.isEnabled();
        if (!enabled) return;

        const host = document.getElementById(hostId);
        if (!host) return;

        if (host.dataset.ieInitialized === '1') return;
        host.dataset.ieInitialized = '1';

        host.innerHTML =
            '<div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;padding:0.8rem 1rem;margin-bottom:0.8rem;background:var(--bg-glass);border:1px solid var(--border-glass);border-radius:var(--radius-sm);">' +
            '<span style="font-size: var(--fs-base);color:var(--text-muted);font-weight: var(--fw-semibold);text-transform:uppercase;letter-spacing:0.3px;white-space:nowrap;"><i data-lucide="file-up" style="width:14px;height:14px;margin-right:4px;"></i>Import / Eksport</span>' +
            '<button class="btn btn-sm btn-secondary" id="ie-btn-export-xlsx"><i data-lucide="download" class="icon-14"></i>Eksport XLSX (zewn.)</button>' +
            '<button class="btn btn-sm btn-secondary" id="ie-btn-export-json"><i data-lucide="file-down" class="icon-14"></i>Eksport 1:1 (JSON)</button>' +
            '<button class="btn btn-sm btn-secondary" id="ie-btn-import-xlsx"><i data-lucide="upload" class="icon-14"></i>Import XLSX (zewn.)</button>' +
            '<button class="btn btn-sm btn-secondary" id="ie-btn-import-json"><i data-lucide="file-up" class="icon-14"></i>Import 1:1 (JSON)</button>' +
            '</div>';

        document.getElementById('ie-btn-export-xlsx').onclick = () => this.showExportXlsxDialog();
        document.getElementById('ie-btn-export-json').onclick = () => this.showExportJsonPopup();
        document.getElementById('ie-btn-import-json').onclick = () => this.showImportJsonDialog();
        document.getElementById('ie-btn-import-xlsx').onclick = () => this.showImportXlsxDialog();

        if (window.lucide) lucide.createIcons({ root: host });
    },

    _entityTypeHtml(inputId, entityParam) {
        const checked = entityParam || 'offer';
        return (
            '<div class="form-group" style="display:flex;gap:0.6rem;margin-bottom:0.9rem;flex-wrap:wrap;">' +
            '<label style="display:inline-flex;align-items:center;gap:0.4rem;cursor:pointer;font:var(--fw-medium) var(--fs-md) \'Inter\',sans-serif;color:var(--text-secondary);padding:0.32rem 0.7rem;border:1px solid var(--border-glass);border-radius:var(--radius-pill);background:var(--bg-tertiary);transition:border-color .15s,background .15s;"><input type="radio" name="' +
            inputId +
            '-entity" value="offer" style="accent-color:var(--accent);"' +
            (checked === 'offer' ? ' checked' : '') +
            '> Oferta</label>' +
            '<label style="display:inline-flex;align-items:center;gap:0.4rem;cursor:pointer;font:var(--fw-medium) var(--fs-md) \'Inter\',sans-serif;color:var(--text-secondary);padding:0.32rem 0.7rem;border:1px solid var(--border-glass);border-radius:var(--radius-pill);background:var(--bg-tertiary);transition:border-color .15s,background .15s;"><input type="radio" name="' +
            inputId +
            '-entity" value="order" style="accent-color:var(--accent);"' +
            (checked === 'order' ? ' checked' : '') +
            '> Zamówienie</label>' +
            '</div>'
        );
    },

    _moduleTypeHtml(inputId, moduleParam) {
        const checked = moduleParam || 'rury';
        return (
            '<div class="form-group" style="display:flex;gap:0.6rem;margin-bottom:0.9rem;flex-wrap:wrap;">' +
            '<label style="display:inline-flex;align-items:center;gap:0.4rem;cursor:pointer;font:var(--fw-medium) var(--fs-md) \'Inter\',sans-serif;color:var(--text-secondary);padding:0.32rem 0.7rem;border:1px solid var(--border-glass);border-radius:var(--radius-pill);background:var(--bg-tertiary);transition:border-color .15s,background .15s;"><input type="radio" name="' +
            inputId +
            '-module" value="rury" style="accent-color:var(--accent);"' +
            (checked === 'rury' ? ' checked' : '') +
            '> Rury</label>' +
            '<label style="display:inline-flex;align-items:center;gap:0.4rem;cursor:pointer;font:var(--fw-medium) var(--fs-md) \'Inter\',sans-serif;color:var(--text-secondary);padding:0.32rem 0.7rem;border:1px solid var(--border-glass);border-radius:var(--radius-pill);background:var(--bg-tertiary);transition:border-color .15s,background .15s;"><input type="radio" name="' +
            inputId +
            '-module" value="studnie" style="accent-color:var(--accent);"' +
            (checked === 'studnie' ? ' checked' : '') +
            '> Studnie</label>' +
            '</div>'
        );
    },

    async _findOrderByNumber(number, module) {
        const ordersMap = window.kartotekaUI && window.kartotekaUI.ordersMap;
        if (ordersMap) {
            for (const orders of ordersMap.values()) {
                for (const order of orders) {
                    if (order.orderNumber === number) {
                        const isStudnie = !!order.offerStudnieId;
                        if (module === 'studnie' && isStudnie) return order;
                        if (module === 'rury' && !isStudnie) return order;
                    }
                }
            }
        }
        return await JsonOfferTransfer.fetchOrderByNumber(module, number);
    },

    _findOfferByNumber(number, module) {
        const offers = XlsxImportShared.getLoadedOffers();
        return offers.find(
            (o) =>
                (o.offer_number === number || o.number === number) &&
                (module === 'rury' ? o.type !== 'studnia_oferta' : o.type === 'studnia_oferta')
        );
    },

    _offerNotFoundHint(number, module, resultEl) {
        const otherModule = module === 'rury' ? 'studnie' : 'rury';
        const other = this._findOfferByNumber(number, otherModule);
        if (other) {
            const moduleName = module === 'rury' ? 'Rury' : 'Studnie';
            const otherName = otherModule === 'rury' ? 'Rury' : 'Studnie';
            resultEl.textContent =
                'Nie znaleziono w module ' +
                moduleName +
                '. Znaleziono w module ' +
                otherName +
                ' — zmień wybór modułu.';
        } else {
            resultEl.textContent = 'Nie znaleziono oferty.';
        }
    },

    _ieModalHtml(modalId, titleId, title, bodyHtml, footerHtml) {
        const iconMap = {
            'ie-export-xlsx-modal': 'download',
            'ie-export-json-modal': 'file-down',
            'ie-import-xlsx-modal': 'upload',
            'ie-import-json-modal': 'file-up'
        };
        const icon = iconMap[modalId] || 'file-up';
        return (
            '<div class="modal" role="document">' +
            '<div class="modal-header"><h3 id="' +
            titleId +
            '" style="display:flex;align-items:center;gap:0.5rem;font:var(--fw-bold) var(--fs-2xl) \'Inter\',sans-serif;color:var(--text-primary);"><i data-lucide="' +
            icon +
            '" class="icon-sm" style="color:var(--accent);"></i>' +
            window.escapeHtml(title) +
            '</h3><button type="button" class="btn-icon" aria-label="Zamknij" data-ie-close><i data-lucide="x" class="icon-14"></i></button></div>' +
            '<div class="modal-body" style="font:var(--fw-normal) var(--fs-md) \'Inter\',sans-serif;">' +
            bodyHtml +
            '</div>' +
            (footerHtml ? '<div class="modal-footer">' + footerHtml + '</div>' : '') +
            '</div>'
        );
    },

    _bindIeModal(modalId, onConfirm) {
        const overlay = document.getElementById(modalId);
        if (!overlay) return;
        const closeBtn = overlay.querySelector('[data-ie-close]');
        if (closeBtn) closeBtn.addEventListener('click', () => window.closeModal(modalId));
        const cancelBtn = overlay.querySelector('[data-ie-cancel]');
        if (cancelBtn) cancelBtn.addEventListener('click', () => window.closeModal(modalId));
        const confirmBtn = overlay.querySelector('[data-ie-confirm]');
        if (confirmBtn && onConfirm) {
            confirmBtn.addEventListener('click', async () => {
                confirmBtn.disabled = true;
                try {
                    await onConfirm();
                } finally {
                    confirmBtn.disabled = false;
                }
            });
        }
        if (window.lucide) lucide.createIcons({ root: overlay });
        const numInput = /** @type {HTMLInputElement|null} */ (
            overlay.querySelector('input[id^="ie-"]')
        );
        if (numInput) {
            numInput.addEventListener('keydown', (/** @type {KeyboardEvent} */ e) => {
                if (e.key === 'Enter' && confirmBtn) confirmBtn.click();
            });
            setTimeout(() => numInput.focus(), 50);
        }
    },

    showExportXlsxDialog() {
        const uid = 'xlsx';
        const modalId = 'ie-export-xlsx-modal';
        const titleId = 'ie-export-xlsx-title';
        const title = 'Eksport XLSX (zewn. system)';
        const body =
            '<p style="color:var(--text-secondary);margin:0 0 0.9rem 0;font:var(--fw-normal) var(--fs-lg) \'Inter\',sans-serif;line-height:1.5;">Wybierz typ i podaj numer dokumentu:</p>' +
            this._moduleTypeHtml(uid) +
            this._entityTypeHtml(uid, 'offer') +
            '<div class="form-group"><label class="form-label-sm" for="ie-' +
            uid +
            '-number">Numer oferty lub zamówienia</label><input type="text" id="ie-' +
            uid +
            '-number" placeholder="np. OF-2026/001" class="form-input" style="width:100%"></div>' +
            '<div id="ie-' +
            uid +
            '-search-result" style="min-height:1.3rem;color:var(--text-muted);font:var(--fw-medium) var(--fs-sm) \'Inter\',sans-serif;margin-top:0.45rem;line-height:1.4;"></div>';
        const footer =
            '<button type="button" class="btn btn-sm btn-secondary" data-ie-cancel>Anuluj</button>' +
            '<button type="button" class="btn btn-sm btn-primary" data-ie-confirm><i data-lucide="download" class="icon-14"></i>Eksportuj</button>';
        const html = this._ieModalHtml(modalId, titleId, title, body, footer);
        window.showModal({ id: modalId, titleId: titleId, html: html });
        this._bindIeModal(modalId, async () => {
            const module = document.querySelector('input[name="' + uid + '-module"]:checked').value;
            const entity = document.querySelector('input[name="' + uid + '-entity"]:checked').value;
            const input = document.getElementById('ie-' + uid + '-number');
            const number = input ? input.value.trim() : '';
            if (!number) {
                await appAlert('Podaj numer oferty lub zamówienia.', {
                    type: 'warning',
                    title: 'Brak danych'
                });
                return;
            }
            const resultEl = document.getElementById('ie-' + uid + '-search-result');
            if (entity === 'order') {
                const order = await this._findOrderByNumber(number, module);
                if (!order) {
                    resultEl.textContent = 'Nie znaleziono zamówienia.';
                    return;
                }
                resultEl.textContent = 'Znaleziono: ' + order.orderNumber;
                window.closeModal(modalId);
                if (module === 'studnie') {
                    await StudnieExternalExportTemplate.generateAndDownloadOrder(order);
                } else {
                    await RuryExternalExportTemplate.generateAndDownloadOrder(order);
                }
            } else {
                const offer = this._findOfferByNumber(number, module);
                if (!offer) {
                    this._offerNotFoundHint(number, module, resultEl);
                    return;
                }
                resultEl.textContent =
                    'Znaleziono: ' +
                    (offer.offer_number || offer.number) +
                    ' (' +
                    (offer.clientName || 'brak klienta') +
                    ')';
                window.closeModal(modalId);
                if (module === 'studnie') {
                    await StudnieExternalExportTemplate.generateAndDownload(offer.id);
                } else {
                    await RuryExternalExportTemplate.generateAndDownload(offer.id);
                }
            }
        });
    },

    showExportJsonPopup() {
        const uid = 'json';
        const modalId = 'ie-export-json-modal';
        const titleId = 'ie-export-json-title';
        const title = 'Eksport 1:1 (JSON)';
        const body =
            '<p style="color:var(--text-secondary);margin:0 0 0.9rem 0;font:var(--fw-normal) var(--fs-lg) \'Inter\',sans-serif;line-height:1.5;">Wybierz typ i podaj numer dokumentu:</p>' +
            this._moduleTypeHtml(uid) +
            this._entityTypeHtml(uid, 'offer') +
            '<div class="form-group"><label class="form-label-sm" for="ie-' +
            uid +
            '-number">Numer oferty lub zamówienia</label><input type="text" id="ie-' +
            uid +
            '-number" placeholder="np. OF-2026/001" class="form-input" style="width:100%"></div>' +
            '<div id="ie-' +
            uid +
            '-search-result" style="min-height:1.3rem;color:var(--text-muted);font:var(--fw-medium) var(--fs-sm) \'Inter\',sans-serif;margin-top:0.45rem;line-height:1.4;"></div>' +
            '<p style="color:var(--text-muted);font:var(--fw-normal) var(--fs-xs) \'Inter\',sans-serif;margin:0.7rem 0 0 0;display:flex;align-items:center;gap:0.35rem;line-height:1.4;"><i data-lucide="info" class="icon-14" style="color:var(--accent);flex-shrink:0;"></i> Plik JSON zawiera ofertę wraz z zamówieniami (transfer 1:1).</p>';
        const footer =
            '<button type="button" class="btn btn-sm btn-secondary" data-ie-cancel>Anuluj</button>' +
            '<button type="button" class="btn btn-sm btn-primary" data-ie-confirm><i data-lucide="file-down" class="icon-14"></i>Eksportuj</button>';
        const html = this._ieModalHtml(modalId, titleId, title, body, footer);
        window.showModal({ id: modalId, titleId: titleId, html: html });
        this._bindIeModal(modalId, async () => {
            const module = document.querySelector('input[name="' + uid + '-module"]:checked').value;
            const entity = document.querySelector('input[name="' + uid + '-entity"]:checked').value;
            const input = document.getElementById('ie-' + uid + '-number');
            const number = input ? input.value.trim() : '';
            if (!number) {
                await appAlert('Podaj numer oferty lub zamówienia.', {
                    type: 'warning',
                    title: 'Brak danych'
                });
                return;
            }
            const resultEl = document.getElementById('ie-' + uid + '-search-result');
            if (entity === 'order') {
                const order = await this._findOrderByNumber(number, module);
                if (!order) {
                    resultEl.textContent = 'Nie znaleziono zamówienia.';
                    return;
                }
                resultEl.textContent = 'Znaleziono: ' + order.orderNumber;
                window.closeModal(modalId);
                if (module === 'studnie') {
                    await StudnieTransferJson.exportOrder(order.id);
                } else {
                    await RuryTransferJson.exportOrder(order.id);
                }
            } else {
                const offer = this._findOfferByNumber(number, module);
                if (!offer) {
                    this._offerNotFoundHint(number, module, resultEl);
                    return;
                }
                resultEl.textContent =
                    'Znaleziono: ' +
                    (offer.offer_number || offer.number) +
                    ' (' +
                    (offer.clientName || 'brak klienta') +
                    ')';
                window.closeModal(modalId);
                if (module === 'studnie') {
                    await StudnieTransferJson.exportOffer(offer.id);
                } else {
                    await RuryTransferJson.exportOffer(offer.id);
                }
            }
        });
    },

    showImportJsonDialog() {
        const modalId = 'ie-import-json-modal';
        const titleId = 'ie-import-json-title';
        const title = 'Import 1:1 (JSON)';
        const body =
            '<p style="color:var(--text-primary);margin:0 0 0.5rem 0;font:var(--fw-medium) var(--fs-lg) \'Inter\',sans-serif;line-height:1.5;">Wybierz plik JSON wyeksportowany z innego urządzenia.</p>' +
            '<p style="color:var(--text-muted);font:var(--fw-normal) var(--fs-sm) \'Inter\',sans-serif;margin:0 0 0.9rem 0;line-height:1.45;">Obsługiwane formaty: transfer oferty + zamówień oraz transfer zamówienia.</p>' +
            '<div class="form-group"><label class="form-label-sm" for="ie-json-file-input">Plik JSON</label><input type="file" id="ie-json-file-input" accept=".json" class="form-input" style="width:100%"></div>' +
            '<div id="ie-json-progress" style="display:none;color:var(--accent);font:var(--fw-medium) var(--fs-sm) \'Inter\',sans-serif;margin-top:0.55rem;align-items:center;gap:0.4rem;"><i data-lucide="loader" class="icon-14" style="animation:spin 0.8s linear infinite;"></i> Importowanie...</div>';
        const footer =
            '<button type="button" class="btn btn-sm btn-secondary" data-ie-cancel>Anuluj</button>' +
            '<button type="button" class="btn btn-sm btn-primary" data-ie-confirm><i data-lucide="upload" class="icon-14"></i>Importuj</button>';
        const html = this._ieModalHtml(modalId, titleId, title, body, footer);
        window.showModal({ id: modalId, titleId: titleId, html: html });
        this._bindIeModal(modalId, async () => {
            const input = document.getElementById('ie-json-file-input');
            if (!input || !input.files || !input.files[0]) {
                await appAlert('Wybierz plik JSON do importu.', {
                    type: 'warning',
                    title: 'Brak pliku'
                });
                return;
            }
            const progress = document.getElementById('ie-json-progress');
            progress.style.display = 'block';
            const confirmBtn = document.querySelector('#' + modalId + ' [data-ie-confirm]');
            if (confirmBtn) confirmBtn.disabled = true;
            try {
                let result;
                const file = input.files[0];
                const preview = await JsonOfferTransfer.readFile(file);
                if (preview.kind === 'witros-order-transfer') {
                    if (preview.module === 'studnie') {
                        result = await StudnieTransferJson.importOrder(file);
                    } else {
                        result = await RuryTransferJson.importOrder(file);
                    }
                } else {
                    if (preview.module === 'studnie') {
                        result = await StudnieTransferJson.importOffer(file);
                    } else {
                        result = await RuryTransferJson.importOffer(file);
                    }
                }
                window.closeModal(modalId);
                if (result.skipped) {
                    await appAlert('Import pominięty — oferta już istnieje.', {
                        type: 'warning',
                        title: 'Pominięto'
                    });
                } else if (result.success) {
                    await appAlert(
                        (preview.kind === 'witros-order-transfer'
                            ? 'Zamówienie'
                            : 'Oferta ' +
                              (result.action === 'clone' ? 'sklonowana' : 'zaimportowana')) +
                            ' pomyślnie.',
                        { type: 'info', title: 'Import zakończony' }
                    );
                } else {
                    await appAlert('Błąd: ' + (result.message || 'Nieznany błąd'), {
                        type: 'warning',
                        title: 'Błąd importu'
                    });
                }
                if (window.kartotekaUI) {
                    window.kartotekaUI.loadLocalOffers();
                }
            } catch (err) {
                await appAlert('Błąd: ' + (err.message || String(err)), {
                    type: 'warning',
                    title: 'Błąd importu'
                });
                progress.style.display = 'none';
                if (confirmBtn) confirmBtn.disabled = false;
            }
        });
    },

    showImportXlsxDialog() {
        const uid = 'xlsx-import';
        const modalId = 'ie-import-xlsx-modal';
        const titleId = 'ie-import-xlsx-title';
        const title = 'Import XLSX (zewn. system)';
        const body =
            '<p style="color:var(--text-primary);margin:0 0 0.9rem 0;font:var(--fw-medium) var(--fs-lg) \'Inter\',sans-serif;line-height:1.5;">Wybierz moduł i plik XLSX wyeksportowany z zewnętrznego systemu.</p>' +
            this._moduleTypeHtml(uid) +
            '<div class="form-group"><label class="form-label-sm" for="ie-' +
            uid +
            '-file-input">Plik XLSX</label><input type="file" id="ie-' +
            uid +
            '-file-input" accept=".xlsx,.xls" class="form-input" style="width:100%"></div>' +
            '<div id="ie-' +
            uid +
            '-progress" style="display:none;color:var(--accent);font:var(--fw-medium) var(--fs-sm) \'Inter\',sans-serif;margin-top:0.55rem;align-items:center;gap:0.4rem;"><i data-lucide="loader" class="icon-14" style="animation:spin 0.8s linear infinite;"></i> Importowanie...</div>';
        const footer =
            '<button type="button" class="btn btn-sm btn-secondary" data-ie-cancel>Anuluj</button>' +
            '<button type="button" class="btn btn-sm btn-primary" data-ie-confirm><i data-lucide="upload" class="icon-14"></i>Importuj</button>';
        const html = this._ieModalHtml(modalId, titleId, title, body, footer);
        window.showModal({ id: modalId, titleId: titleId, html: html });
        this._bindIeModal(modalId, async () => {
            const moduleEl = document.querySelector('input[name="' + uid + '-module"]:checked');
            const module = moduleEl ? moduleEl.value : 'rury';
            const input = document.getElementById('ie-' + uid + '-file-input');
            if (!input || !input.files || !input.files[0]) {
                await appAlert('Wybierz plik XLSX do importu.', {
                    type: 'warning',
                    title: 'Brak pliku'
                });
                return;
            }
            const progress = document.getElementById('ie-' + uid + '-progress');
            progress.style.display = 'block';
            const confirmBtn = document.querySelector('#' + modalId + ' [data-ie-confirm]');
            if (confirmBtn) confirmBtn.disabled = true;
            try {
                const parsed = await XlsxImportShared.parseExternalXlsx(input.files[0]);
                const importer =
                    module === 'studnie' ? window.StudnieExternalImport : window.RuryExternalImport;
                if (!importer || typeof importer.import !== 'function') {
                    throw new Error('Importer dla modułu ' + module + ' jest niedostępny.');
                }
                let imported = 0;
                let skipped = 0;
                const errors = [];
                for (const offer of parsed.offers) {
                    const result = await importer.import(offer);
                    if (result.success) imported++;
                    else if (result.skipped) skipped++;
                    else errors.push((result.number || '?') + ': ' + result.message);
                }
                window.closeModal(modalId);
                let message = 'Zaimportowano ofert: ' + imported + '.';
                if (skipped) message += ' Pominięto: ' + skipped + '.';
                if (errors.length) message += '\nBłędy:\n' + errors.join('\n');
                await appAlert(message, {
                    type: errors.length ? 'warning' : 'info',
                    title: errors.length ? 'Import z błędami' : 'Import zakończony'
                });
                if (window.kartotekaUI) {
                    window.kartotekaUI.loadLocalOffers();
                }
            } catch (err) {
                await appAlert('Błąd: ' + /** @type {any} */ ((err).message || String(err)), {
                    type: 'warning',
                    title: 'Błąd importu'
                });
                progress.style.display = 'none';
                if (confirmBtn) confirmBtn.disabled = false;
            }
        });
    }
});
