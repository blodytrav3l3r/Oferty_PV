// @ts-check
/**
 * @typedef {object} ImportExportToolbar
 * @property {string|null} hostId
 * @property {{rury:Set<string>,studnie:Set<string>}|null} _productIdSets
 * @property {(hostId:string)=>Promise<void>} init
 * @property {(number:string)=>{module:string,entity:string}|null} _detectFromNumber
 * @property {(number:string)=>Array<{offer:any,module:string}>} _findAnyOffer
 * @property {(number:string)=>Promise<Array<{order:any,module:string}>>} _findAnyOrder
 * @property {(number:string)=>Promise<{hint:{module:string,entity:string}|null,offers:Array<{offer:any,module:string}>,orders:Array<{order:any,module:string}>}>} _resolveByNumber
 * @property {(module:string)=>string} _moduleLabel
 * @property {(uid:string)=>void} _bindNumberHint
 * @property {(uid:string, modalId:string, handlers:{offer:(module:string,id:string)=>Promise<void>,order:(module:string,order:any)=>Promise<void>})=>Promise<void>} _confirmExportByNumber
 * @property {()=>Promise<{rury:Set<string>,studnie:Set<string>}|null>} _ensureProductIdSets
 * @property {(offerGroup:any, sets:{rury:Set<string>,studnie:Set<string>}|null)=>string} _detectImportModule
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
    _productIdSets: null,

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
            '<span style="font-size: var(--fs-base);color:var(--text-muted);font-weight: var(--fw-semibold);text-transform:uppercase;letter-spacing:0.3px;white-space:nowrap;"><i data-lucide="file-up" class="icon-14-mr4"></i>Import / Eksport</span>' +
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

    // Wykrywanie modułu i typu dokumentu z formatu numeru:
    // oferta rur OF/… (offerItemHelpers.js), oferta studni OS/… (globals.js),
    // zamówienie rur …/ZR/… (ruryOrders.crud.ts), zamówienie studni …/ZS/… (numbering.ts).
    // Custom numery po ręcznej edycji dają null — wtedy search-all poniżej.
    _detectFromNumber(number) {
        const nr = String(number || '')
            .trim()
            .toUpperCase();
        if (!nr) return null;
        if (nr.indexOf('OF/') === 0) return { module: 'rury', entity: 'offer' };
        if (nr.indexOf('OS/') === 0) return { module: 'studnie', entity: 'offer' };
        if (nr.indexOf('/ZR/') !== -1) return { module: 'rury', entity: 'order' };
        if (nr.indexOf('/ZS/') !== -1) return { module: 'studnie', entity: 'order' };
        return null;
    },

    _findAnyOffer(number) {
        const offers = XlsxImportShared.getLoadedOffers();
        return offers
            .filter((o) => o && (o.offer_number === number || o.number === number))
            .map((o) => ({ offer: o, module: o.type === 'studnia_oferta' ? 'studnie' : 'rury' }));
    },

    async _findAnyOrder(number) {
        const found = [];
        const seen = new Set();
        const push = (order, module) => {
            if (!order) return;
            const key = order.id || module + ':' + number;
            if (seen.has(key)) return;
            seen.add(key);
            found.push({ order, module });
        };
        const ordersMap = window.kartotekaUI && window.kartotekaUI.ordersMap;
        if (ordersMap) {
            for (const orders of ordersMap.values()) {
                for (const order of orders || []) {
                    if (order && order.orderNumber === number) {
                        push(order, order.offerStudnieId ? 'studnie' : 'rury');
                    }
                }
            }
        }
        const need = ['rury', 'studnie'].filter((m) => !found.some((f) => f.module === m));
        if (need.length && typeof JsonOfferTransfer !== 'undefined') {
            const results = await Promise.all(
                need.map((m) => JsonOfferTransfer.fetchOrderByNumber(m, number).catch(() => null))
            );
            results.forEach((order, i) => push(order, need[i]));
        }
        return found;
    },

    async _resolveByNumber(number) {
        const hint = this._detectFromNumber(number);
        const offers = this._findAnyOffer(number);
        const orders = await this._findAnyOrder(number);
        const rank = (module, entity) =>
            !hint || (module === hint.module && entity === hint.entity) ? 0 : 1;
        offers.sort((a, b) => rank(a.module, 'offer') - rank(b.module, 'offer'));
        orders.sort((a, b) => rank(a.module, 'order') - rank(b.module, 'order'));
        return { hint, offers, orders };
    },

    _moduleLabel(module) {
        return module === 'studnie' ? 'Studnie' : 'Rury';
    },

    _bindNumberHint(uid) {
        const numInput = document.getElementById('ie-' + uid + '-number');
        const hintEl = document.getElementById('ie-' + uid + '-detected');
        if (!numInput || !hintEl) return;
        const refresh = () => {
            const h = this._detectFromNumber(numInput.value);
            if (h) {
                hintEl.className = 'ie-detected-badge';
                hintEl.innerHTML =
                    '<i data-lucide="check-circle-2" class="icon-14"></i><span>Wykryto: <strong>' +
                    window.escapeHtml(this._moduleLabel(h.module)) +
                    '</strong> / ' +
                    (h.entity === 'order' ? 'Zamówienie' : 'Oferta') +
                    '</span>';
            } else if (numInput.value.trim().length > 0) {
                hintEl.className = 'ie-detected-badge ie-detected-badge--neutral';
                hintEl.innerHTML =
                    '<i data-lucide="search" class="icon-14"></i><span>Format niestandardowy — automatyczne szukanie w ofertach i zamówieniach</span>';
            } else {
                hintEl.className = 'ie-detected-badge ie-detected-badge--neutral';
                hintEl.innerHTML =
                    '<i data-lucide="info" class="icon-14"></i><span>Format dokumentu rozpoznawany automatycznie</span>';
            }
            if (window.lucide) lucide.createIcons({ root: hintEl });
        };
        numInput.addEventListener('input', refresh);
        refresh();
    },

    async _confirmExportByNumber(uid, modalId, handlers) {
        const input = document.getElementById('ie-' + uid + '-number');
        const number = input ? input.value.trim() : '';
        const resultEl = document.getElementById('ie-' + uid + '-search-result');
        if (!number) {
            await appAlert('Podaj numer oferty lub zamówienia.', {
                type: 'warning',
                title: 'Brak danych'
            });
            return;
        }
        const resolved = await this._resolveByNumber(number);
        const candidates = [];
        for (const { offer, module } of resolved.offers) {
            candidates.push({
                label:
                    'Oferta / ' +
                    this._moduleLabel(module) +
                    ': ' +
                    number +
                    ' (' +
                    (offer.clientName || 'brak klienta') +
                    ')',
                run: () => handlers.offer(module, offer.id)
            });
        }
        for (const { order, module } of resolved.orders) {
            candidates.push({
                label: 'Zamówienie / ' + this._moduleLabel(module) + ': ' + order.orderNumber,
                run: () => handlers.order(module, order)
            });
        }
        if (!candidates.length) {
            if (resultEl) {
                resultEl.innerHTML =
                    '<div class="ie-detected-badge ie-detected-badge--error"><i data-lucide="alert-circle" class="icon-14"></i>Nie znaleziono dokumentu o podanym numerze.</div>';
                if (window.lucide) lucide.createIcons({ root: resultEl });
            }
            return;
        }
        if (candidates.length > 1) {
            if (resultEl) {
                resultEl.innerHTML =
                    '<div style="font-size:var(--fs-sm);font-weight:var(--fw-medium);color:var(--text-secondary);margin-bottom:0.4rem;">Znaleziono kilka dokumentów — wybierz właściwy:</div>';
                const box = document.createElement('div');
                box.className = 'ie-candidate-box';
                for (const c of candidates) {
                    const b = document.createElement('button');
                    b.type = 'button';
                    b.className = 'ie-candidate-btn';
                    b.innerHTML =
                        '<span>' +
                        window.escapeHtml(c.label) +
                        '</span><i data-lucide="arrow-right" class="icon-14"></i>';
                    b.addEventListener('click', async () => {
                        b.disabled = true;
                        window.closeModal(modalId);
                        await c.run();
                    });
                    box.appendChild(b);
                }
                resultEl.appendChild(box);
                if (window.lucide) lucide.createIcons({ root: resultEl });
            }
            return;
        }
        if (resultEl) {
            resultEl.innerHTML =
                '<div class="ie-detected-badge"><i data-lucide="check" class="icon-14"></i><span>Znaleziono: ' +
                window.escapeHtml(candidates[0].label) +
                '</span></div>';
            if (window.lucide) lucide.createIcons({ root: resultEl });
        }
        window.closeModal(modalId);
        await candidates[0].run();
    },

    // Jednorazowy cache ID produktów do detekcji modułu importu XLSX (głosowanie
    // INDEKS_CZESCI). null gdy oba katalogi niedostępne — zostaje detekcja po TR-*.
    async _ensureProductIdSets() {
        if (this._productIdSets) return this._productIdSets;
        const headers =
            typeof authHeaders === 'function'
                ? authHeaders()
                : { 'Content-Type': 'application/json' };
        const fetchIds = async (url) => {
            try {
                const res = await fetch(url, { headers });
                if (!res.ok) return new Set();
                const json = await res.json();
                const list = json.data || [];
                return new Set(
                    list
                        .map((p) =>
                            String((p && p.id) || '')
                                .trim()
                                .toUpperCase()
                        )
                        .filter(Boolean)
                );
            } catch (_e) {
                return new Set();
            }
        };
        const [rury, studnie] = await Promise.all([
            fetchIds('/api/products'),
            fetchIds('/api/products-studnie')
        ]);
        if (rury.size || studnie.size) this._productIdSets = { rury, studnie };
        return this._productIdSets;
    },

    // Detekcja modułu grupy ofert z pliku zewnętrznego: marker transportu
    // TR-RURY/TR-STUDNIE rozstrzyga, potem większość INDEKS_CZESCI z katalogów.
    _detectImportModule(offerGroup, sets) {
        const rows = (offerGroup && offerGroup.rows) || [];
        let ruryTR = false;
        let studnieTR = false;
        let ruryVotes = 0;
        let studnieVotes = 0;
        for (const r of rows) {
            const idx = String(r['INDEKS_CZESCI'] || '')
                .trim()
                .toUpperCase();
            if (!idx) continue;
            if (idx === 'TR-RURY') {
                ruryTR = true;
                continue;
            }
            if (idx === 'TR-STUDNIE') {
                studnieTR = true;
                continue;
            }
            if (sets) {
                if (sets.rury.has(idx)) ruryVotes++;
                if (sets.studnie.has(idx)) studnieVotes++;
            }
        }
        if (ruryTR !== studnieTR) return ruryTR ? 'rury' : 'studnie';
        if (!sets || (ruryVotes === 0 && studnieVotes === 0) || ruryVotes === studnieVotes)
            return 'unknown';
        return ruryVotes > studnieVotes ? 'rury' : 'studnie';
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
            '<div class="modal modal--ie" role="document">' +
            '<div class="modal-header"><h3 id="' +
            titleId +
            '"><span class="modal-title-icon"><i data-lucide="' +
            icon +
            '" class="icon-sm"></i></span>' +
            window.escapeHtml(title) +
            '</h3><button type="button" class="btn-icon" aria-label="Zamknij" data-ie-close><i data-lucide="x" class="icon-14"></i></button></div>' +
            '<div class="modal-body">' +
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
            '<p style="margin:0;">Podaj numer dokumentu do wyeksportowania arkusza XLSX:</p>' +
            '<div id="ie-' +
            uid +
            '-detected"></div>' +
            '<div class="form-group"><label class="form-label-sm" for="ie-' +
            uid +
            '-number">Numer oferty lub zamówienia</label><input type="text" id="ie-' +
            uid +
            '-number" placeholder="np. OF/000001/XX/2026 lub ZS/..." class="form-input" style="width:100%"></div>' +
            '<div id="ie-' +
            uid +
            '-search-result"></div>';
        const footer =
            '<button type="button" class="btn btn-sm btn-secondary" data-ie-cancel>Anuluj</button>' +
            '<button type="button" class="btn btn-sm btn-primary" data-ie-confirm><i data-lucide="download" class="icon-14"></i>Eksportuj</button>';
        const html = this._ieModalHtml(modalId, titleId, title, body, footer);
        window.showModal({ id: modalId, titleId: titleId, html: html });
        this._bindIeModal(modalId, () =>
            this._confirmExportByNumber(uid, modalId, {
                offer: (module, id) =>
                    module === 'studnie'
                        ? StudnieExternalExportTemplate.generateAndDownload(id)
                        : RuryExternalExportTemplate.generateAndDownload(id),
                order: (module, order) =>
                    module === 'studnie'
                        ? StudnieExternalExportTemplate.generateAndDownloadOrder(order)
                        : RuryExternalExportTemplate.generateAndDownloadOrder(order)
            })
        );
        this._bindNumberHint(uid);
    },

    showExportJsonPopup() {
        const uid = 'json';
        const modalId = 'ie-export-json-modal';
        const titleId = 'ie-export-json-title';
        const title = 'Eksport 1:1 (JSON)';
        const body =
            '<p style="margin:0;">Podaj numer dokumentu do wyeksportowania pliku JSON:</p>' +
            '<div id="ie-' +
            uid +
            '-detected"></div>' +
            '<div class="form-group"><label class="form-label-sm" for="ie-' +
            uid +
            '-number">Numer oferty lub zamówienia</label><input type="text" id="ie-' +
            uid +
            '-number" placeholder="np. OF/000001/XX/2026 lub ZS/..." class="form-input" style="width:100%"></div>' +
            '<div id="ie-' +
            uid +
            '-search-result"></div>' +
            '<div class="ie-info-box"><i data-lucide="info" class="icon-14"></i><span>Plik JSON zawiera kompletną strukturę oferty wraz ze wszystkimi powiązanymi zamówieniami (transfer 1:1).</span></div>';
        const footer =
            '<button type="button" class="btn btn-sm btn-secondary" data-ie-cancel>Anuluj</button>' +
            '<button type="button" class="btn btn-sm btn-primary" data-ie-confirm><i data-lucide="file-down" class="icon-14"></i>Eksportuj</button>';
        const html = this._ieModalHtml(modalId, titleId, title, body, footer);
        window.showModal({ id: modalId, titleId: titleId, html: html });
        this._bindIeModal(modalId, () =>
            this._confirmExportByNumber(uid, modalId, {
                offer: (module, id) =>
                    module === 'studnie'
                        ? StudnieTransferJson.exportOffer(id)
                        : RuryTransferJson.exportOffer(id),
                order: (module, order) =>
                    module === 'studnie'
                        ? StudnieTransferJson.exportOrder(order.id)
                        : RuryTransferJson.exportOrder(order.id)
            })
        );
        this._bindNumberHint(uid);
    },

    showImportJsonDialog() {
        const modalId = 'ie-import-json-modal';
        const titleId = 'ie-import-json-title';
        const title = 'Import 1:1 (JSON)';
        const body =
            '<p style="margin:0;">Wybierz plik JSON wyeksportowany z innego urządzenia:</p>' +
            '<div class="ie-info-box"><i data-lucide="file-check" class="icon-14"></i><span>Automatycznie obsługuje transfer pojedynczego zamówienia oraz pełnej oferty z zamówieniami.</span></div>' +
            '<div class="form-group"><label class="form-label-sm" for="ie-json-file-input">Plik JSON</label><input type="file" id="ie-json-file-input" accept=".json" class="form-input" style="width:100%"></div>' +
            '<div id="ie-json-progress" class="ie-detected-badge" style="display:none;"><i data-lucide="loader" class="icon-14" style="animation:spin 0.8s linear infinite;"></i><span>Trwa importowanie danych...</span></div>';
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
            '<p style="margin:0;">Wybierz plik XLSX wyeksportowany z zewnętrznego systemu:</p>' +
            '<div class="ie-info-box"><i data-lucide="sparkles" class="icon-14"></i><span>Moduł (Rury / Studnie) rozpoznawany automatycznie na podstawie wierszy transportowych TR-* lub indeksów produktów.</span></div>' +
            '<div class="form-group"><label class="form-label-sm" for="ie-' +
            uid +
            '-file-input">Plik XLSX</label><input type="file" id="ie-' +
            uid +
            '-file-input" accept=".xlsx,.xls" class="form-input" style="width:100%"></div>' +
            '<div id="ie-' +
            uid +
            '-progress" class="ie-detected-badge" style="display:none;"><i data-lucide="loader" class="icon-14" style="animation:spin 0.8s linear infinite;"></i><span>Trwa przetwarzanie arkusza...</span></div>';
        const footer =
            '<button type="button" class="btn btn-sm btn-secondary" data-ie-cancel>Anuluj</button>' +
            '<button type="button" class="btn btn-sm btn-primary" data-ie-confirm><i data-lucide="upload" class="icon-14"></i>Importuj</button>';
        const html = this._ieModalHtml(modalId, titleId, title, body, footer);
        window.showModal({ id: modalId, titleId: titleId, html: html });
        this._bindIeModal(modalId, async () => {
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
                const sets = await this._ensureProductIdSets();
                let importedRury = 0;
                let importedStudnie = 0;
                let skipped = 0;
                const errors = [];
                const unknownNums = [];
                for (const offer of parsed.offers) {
                    const module = this._detectImportModule(offer, sets);
                    if (module === 'unknown') {
                        unknownNums.push(offer.number || '?');
                        continue;
                    }
                    const importer =
                        module === 'studnie'
                            ? window.StudnieExternalImport
                            : window.RuryExternalImport;
                    if (!importer || typeof importer.import !== 'function') {
                        throw new Error('Importer dla modułu ' + module + ' jest niedostępny.');
                    }
                    const result = await importer.import(offer);
                    if (result.success) {
                        if (module === 'studnie') importedStudnie++;
                        else importedRury++;
                    } else if (result.skipped) skipped++;
                    else errors.push((result.number || '?') + ': ' + result.message);
                }
                window.closeModal(modalId);
                let message =
                    'Zaimportowano ofert: Rury ' +
                    importedRury +
                    ', Studnie ' +
                    importedStudnie +
                    '.';
                if (skipped) message += ' Pominięto: ' + skipped + '.';
                if (unknownNums.length)
                    message +=
                        '\nNierozpoznany moduł (pominięto): ' +
                        unknownNums.join(', ') +
                        ' — brak wiersza TR-RURY/TR-STUDNIE i brak indeksów z cennika.';
                if (errors.length) message += '\nBłędy:\n' + errors.join('\n');
                await appAlert(message, {
                    type: errors.length ? 'warning' : 'info',
                    title: errors.length ? 'Import z błędami' : 'Import zakończony'
                });
                if (window.kartotekaUI) {
                    window.kartotekaUI.loadLocalOffers();
                }
            } catch (err) {
                await appAlert('Błąd: ' + /** @type {any} */ (err.message || String(err)), {
                    type: 'warning',
                    title: 'Błąd importu'
                });
                progress.style.display = 'none';
                if (confirmBtn) confirmBtn.disabled = false;
            }
        });
    }
});
