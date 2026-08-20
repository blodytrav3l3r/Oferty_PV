window.importExportToolbar = {
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
            '<div class="flex-gap-5-mb1">' +
            '<label class="flex-gap-3-lg"><input type="radio" name="' +
            inputId +
            '-entity" value="offer"' +
            (checked === 'offer' ? ' checked' : '') +
            '> Oferta</label>' +
            '<label class="flex-gap-3-lg"><input type="radio" name="' +
            inputId +
            '-entity" value="order"' +
            (checked === 'order' ? ' checked' : '') +
            '> Zamówienie</label>' +
            '</div>'
        );
    },

    _moduleTypeHtml(inputId, moduleParam) {
        const checked = moduleParam || 'rury';
        return (
            '<div class="flex-gap-5-mb1">' +
            '<label class="flex-gap-3-lg"><input type="radio" name="' +
            inputId +
            '-module" value="rury"' +
            (checked === 'rury' ? ' checked' : '') +
            '> Rury</label>' +
            '<label class="flex-gap-3-lg"><input type="radio" name="' +
            inputId +
            '-module" value="studnie"' +
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

    showExportXlsxDialog() {
        const uid = 'xlsx';
        this._createModal(
            'Eksport XLSX (zewn. system)',
            '<p class="fs-xl-sec-mb">Wybierz typ i podaj numer:</p>' +
                this._moduleTypeHtml(uid) +
                this._entityTypeHtml(uid, 'offer') +
                '<input type="text" id="ie-' +
                uid +
                '-number" placeholder="Numer oferty lub zamówienia" class="form-input w-100-mb-5" >' +
                '<div id="ie-' +
                uid +
                '-search-result" class="fs-lg-muted-mb5"></div>',
            'Eksportuj',
            async () => {
                const module = document.querySelector(
                    'input[name="' + uid + '-module"]:checked'
                ).value;
                const entity = document.querySelector(
                    'input[name="' + uid + '-entity"]:checked'
                ).value;
                const number = document.getElementById('ie-' + uid + '-number').value.trim();
                if (!number) {
                    await appAlert('Podaj numer', { type: 'warning' });
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
                    this._closeModal();

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
                    this._closeModal();

                    if (module === 'studnie') {
                        await StudnieExternalExportTemplate.generateAndDownload(offer.id);
                    } else {
                        await RuryExternalExportTemplate.generateAndDownload(offer.id);
                    }
                }
            }
        );
    },

    showExportJsonPopup() {
        const uid = 'json';
        this._createModal(
            'Eksport 1:1 (JSON)',
            '<p class="fs-xl-sec-mb">Wybierz typ i podaj numer:</p>' +
                this._moduleTypeHtml(uid) +
                this._entityTypeHtml(uid, 'offer') +
                '<input type="text" id="ie-' +
                uid +
                '-number" placeholder="Numer oferty lub zamówienia" class="form-input w-100-mb-5" >' +
                '<div id="ie-' +
                uid +
                '-search-result" class="fs-lg-muted-mb5"></div>',
            'Eksportuj',
            async () => {
                const module = document.querySelector(
                    'input[name="' + uid + '-module"]:checked'
                ).value;
                const entity = document.querySelector(
                    'input[name="' + uid + '-entity"]:checked'
                ).value;
                const number = document.getElementById('ie-' + uid + '-number').value.trim();
                if (!number) {
                    await appAlert('Podaj numer', { type: 'warning' });
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
                    this._closeModal();

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
                    this._closeModal();

                    if (module === 'studnie') {
                        await StudnieTransferJson.exportOffer(offer.id);
                    } else {
                        await RuryTransferJson.exportOffer(offer.id);
                    }
                }
            }
        );
    },

    showImportJsonDialog() {
        this._createModal(
            'Import 1:1 (JSON)',
            '<p class="fs-xl-sec-mb">Wybierz plik JSON wyeksportowany z innego urządzenia.</p>' +
                '<p style="color:var(--text-muted);font-size: var(--fs-md);margin:0 0 1rem 0;">Obsługiwane formaty: transfer oferty + zamówień oraz transfer zamówienia.</p>' +
                '<input type="file" id="ie-json-file-input" accept=".json" class="form-input block-w100-mb1" >' +
                '<div id="ie-json-progress" class="none-accent-lg">Importowanie...</div>',
            'Importuj',
            async () => {
                const input = document.getElementById('ie-json-file-input');
                if (!input.files || !input.files[0]) {
                    await appAlert('Wybierz plik JSON', { type: 'warning' });
                    return;
                }
                const progress = document.getElementById('ie-json-progress');
                progress.style.display = 'block';
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

                    this._closeModal();
                    if (result.skipped) {
                        await appAlert('Import pominiety.', { type: 'warning' });
                    } else if (result.success) {
                        await appAlert(
                            (preview.kind === 'witros-order-transfer'
                                ? 'Zamówienie'
                                : 'Oferta ' +
                                  (result.action === 'clone' ? 'sklonowana' : 'zaimportowana')) +
                                ' pomyslnie.',
                            { type: 'info' }
                        );
                    } else {
                        await appAlert('Blad: ' + (result.message || 'Nieznany blad'), {
                            type: 'warning'
                        });
                    }
                    if (window.kartotekaUI) {
                        window.kartotekaUI.loadLocalOffers();
                    }
                } catch (err) {
                    await appAlert('Blad: ' + err.message, { type: 'warning' });
                    progress.style.display = 'none';
                }
            }
        );
    },

    showImportXlsxDialog() {
        const uid = 'xlsx-import';
        this._createModal(
            'Import XLSX (zewn. system)',
            '<p class="fs-xl-sec-mb">Wybierz moduł i plik XLSX wyeksportowany z innego systemu.</p>' +
                this._moduleTypeHtml(uid) +
                '<input type="file" id="ie-' +
                uid +
                '-file-input" accept=".xlsx" class="form-input block-w100-mb1" >' +
                '<div id="ie-' +
                uid +
                '-progress" class="none-accent-lg">Importowanie...</div>',
            'Importuj',
            async () => {
                const module = document.querySelector(
                    'input[name="' + uid + '-module"]:checked'
                ).value;
                const input = document.getElementById('ie-' + uid + '-file-input');
                if (!input.files || !input.files[0]) {
                    await appAlert('Wybierz plik XLSX', { type: 'warning' });
                    return;
                }
                const progress = document.getElementById('ie-' + uid + '-progress');
                progress.style.display = 'block';
                try {
                    const parsed = await XlsxImportShared.parseExternalXlsx(input.files[0]);
                    const importer =
                        module === 'studnie'
                            ? window.StudnieExternalImport
                            : window.RuryExternalImport;

                    let imported = 0;
                    let skipped = 0;
                    const errors = [];
                    for (const offer of parsed.offers) {
                        const result = await importer.import(offer);
                        if (result.success) imported++;
                        else if (result.skipped) skipped++;
                        else errors.push((result.number || '?') + ': ' + result.message);
                    }

                    this._closeModal();
                    let message = 'Zaimportowano ofert: ' + imported + '.';
                    if (skipped) message += ' Pominieto: ' + skipped + '.';
                    if (errors.length) message += '\nBledy:\n' + errors.join('\n');
                    await appAlert(message, { type: errors.length ? 'warning' : 'info' });
                    if (window.kartotekaUI) {
                        window.kartotekaUI.loadLocalOffers();
                    }
                } catch (err) {
                    await appAlert('Blad: ' + err.message, { type: 'warning' });
                    progress.style.display = 'none';
                }
            }
        );
    },

    _createModal(title, content, confirmLabel, onConfirm, noFooter) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay js-modal-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', title);

        const box = document.createElement('div');
        box.className = 'modal';
        box.style.maxWidth = '520px';

        const header = document.createElement('div');
        header.className = 'modal-header';

        const h3 = document.createElement('h3');
        h3.textContent = title;
        header.appendChild(h3);

        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '&times;';
        closeBtn.className = 'btn-icon';
        closeBtn.style.fontSize = 'var(--fs-4xl)';
        closeBtn.style.lineHeight = '1';
        closeBtn.onclick = () => this._closeModal();
        header.appendChild(closeBtn);

        box.appendChild(header);

        if (noFooter) {
            const body = document.createElement('div');
            body.innerHTML = content;
            box.appendChild(body);
        } else {
            const body = document.createElement('div');
            body.className = 'ie-modal-body';
            body.innerHTML = content;
            box.appendChild(body);

            const footer = document.createElement('div');
            footer.className = 'modal-footer';
            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'btn btn-sm btn-secondary ie-btn-cancel';
            cancelBtn.textContent = 'Anuluj';
            cancelBtn.onclick = () => this._closeModal();
            footer.appendChild(cancelBtn);

            if (confirmLabel) {
                const confirmBtn = document.createElement('button');
                confirmBtn.className = 'btn btn-sm btn-primary ie-btn-confirm';
                confirmBtn.textContent = confirmLabel;
                confirmBtn.onclick = () => onConfirm && onConfirm();
                footer.appendChild(confirmBtn);
            }

            box.appendChild(footer);
        }

        overlay.appendChild(box);
        document.body.appendChild(overlay);
        /** @type {any} */ (overlay)._previousFocus = document.activeElement;

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this._closeModal();
        });
        if (typeof trapFocus === 'function') trapFocus(overlay);

        window.__ieModalOverlay = overlay;
        return overlay;
    },

    _closeModal() {
        if (window.__ieModalOverlay && window.__ieModalOverlay.parentNode) {
            if (typeof untrapFocus === 'function') untrapFocus(window.__ieModalOverlay);
            document.body.removeChild(window.__ieModalOverlay);
        }
        window.__ieModalOverlay = null;
    }
};
