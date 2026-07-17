window.PvImportExportToolbar = {
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
            '<div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;padding:0.8rem 1rem;margin-bottom:1.5rem;background:var(--bg-glass);border:1px solid var(--border-glass);border-radius:var(--radius-sm);">' +
            '<span style="font-size:0.75rem;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.3px;white-space:nowrap;"><i data-lucide="file-up" style="width:14px;height:14px;margin-right:4px;"></i>Import / Eksport</span>' +
            '<button class="btn btn-sm btn-secondary" id="ie-btn-export-xlsx"><i data-lucide="download" style="width:14px;height:14px;"></i>Eksport XLSX (zewn.)</button>' +
            '<button class="btn btn-sm btn-secondary" id="ie-btn-export-json"><i data-lucide="file-down" style="width:14px;height:14px;"></i>Eksport 1:1 (JSON)</button>' +
            '<button class="btn btn-sm btn-secondary" id="ie-btn-import-json"><i data-lucide="file-up" style="width:14px;height:14px;"></i>Import 1:1 (JSON)</button>' +
            '</div>';

        document.getElementById('ie-btn-export-xlsx').onclick = () => this.showExportXlsxDialog();
        document.getElementById('ie-btn-export-json').onclick = () => this.showExportJsonPopup();
        document.getElementById('ie-btn-import-json').onclick = () => this.showImportJsonDialog();

        if (window.lucide) lucide.createIcons({ root: host });
    },

    _entityTypeHtml(inputId, entityParam) {
        const checked = entityParam || 'offer';
        return (
            '<div style="display:flex;gap:0.5rem;margin-bottom:1rem;">' +
            '<label style="display:flex;align-items:center;gap:0.3rem;cursor:pointer;color:var(--text-secondary);font-size:0.85rem;"><input type="radio" name="' +
            inputId +
            '-entity" value="offer"' +
            (checked === 'offer' ? ' checked' : '') +
            '> Oferta</label>' +
            '<label style="display:flex;align-items:center;gap:0.3rem;cursor:pointer;color:var(--text-secondary);font-size:0.85rem;"><input type="radio" name="' +
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
            '<div style="display:flex;gap:0.5rem;margin-bottom:1rem;">' +
            '<label style="display:flex;align-items:center;gap:0.3rem;cursor:pointer;color:var(--text-secondary);font-size:0.85rem;"><input type="radio" name="' +
            inputId +
            '-module" value="rury"' +
            (checked === 'rury' ? ' checked' : '') +
            '> Rury</label>' +
            '<label style="display:flex;align-items:center;gap:0.3rem;cursor:pointer;color:var(--text-secondary);font-size:0.85rem;"><input type="radio" name="' +
            inputId +
            '-module" value="studnie"' +
            (checked === 'studnie' ? ' checked' : '') +
            '> Studnie</label>' +
            '</div>'
        );
    },

    async _findOrderByNumber(number, module) {
        const ordersMap = window.pvSalesUI && window.pvSalesUI.ordersMap;
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
        const offers = window.pvSalesUI && window.pvSalesUI.allLocalOffers;
        if (!offers) return null;
        return offers.find(
            (o) =>
                (o.offer_number === number || o.number === number) &&
                (module === 'rury' ? o.type !== 'studnia_oferta' : o.type === 'studnia_oferta')
        );
    },

    showExportXlsxDialog() {
        const uid = 'xlsx';
        const modal = this._createModal(
            'Eksport XLSX (zewn. system)',
            '<p style="color:var(--text-secondary);font-size:0.9rem;margin:0 0 1rem 0;">Wybierz typ i podaj numer:</p>' +
                this._moduleTypeHtml(uid) +
                this._entityTypeHtml(uid, 'offer') +
                '<input type="text" id="ie-' +
                uid +
                '-number" placeholder="Numer oferty lub zamówienia" class="form-input" style="width:100%;margin-bottom:0.5rem;">' +
                '<div id="ie-' +
                uid +
                '-search-result" style="font-size:0.85rem;color:var(--text-muted);margin-bottom:0.5rem;"></div>',
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
                    alert('Podaj numer');
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
                        resultEl.textContent = 'Nie znaleziono oferty.';
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
        const modal = this._createModal(
            'Eksport 1:1 (JSON)',
            '<p style="color:var(--text-secondary);font-size:0.9rem;margin:0 0 1rem 0;">Wybierz typ i podaj numer:</p>' +
                this._moduleTypeHtml(uid) +
                this._entityTypeHtml(uid, 'offer') +
                '<input type="text" id="ie-' +
                uid +
                '-number" placeholder="Numer oferty lub zamówienia" class="form-input" style="width:100%;margin-bottom:0.5rem;">' +
                '<div id="ie-' +
                uid +
                '-search-result" style="font-size:0.85rem;color:var(--text-muted);margin-bottom:0.5rem;"></div>',
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
                    alert('Podaj numer');
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
                        resultEl.textContent = 'Nie znaleziono oferty.';
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
        const modal = this._createModal(
            'Import 1:1 (JSON)',
            '<p style="color:var(--text-secondary);font-size:0.9rem;margin:0 0 1rem 0;">Wybierz plik JSON wyeksportowany z innego urządzenia.</p>' +
                '<p style="color:var(--text-muted);font-size:0.8rem;margin:0 0 1rem 0;">Obsługiwane formaty: witros-offer-transfer (oferta+zamówienia), witros-order-transfer (zamówienie).</p>' +
                '<input type="file" id="ie-json-file-input" accept=".json" class="form-input" style="display:block;margin-bottom:1rem;width:100%;">' +
                '<div id="ie-json-progress" style="display:none;color:var(--accent);font-size:0.85rem;">Importowanie...</div>',
            'Importuj',
            async () => {
                const input = document.getElementById('ie-json-file-input');
                if (!input.files || !input.files[0]) {
                    alert('Wybierz plik JSON');
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
                        alert('Import pominiety.');
                    } else if (result.success) {
                        alert(
                            (preview.kind === 'witros-order-transfer'
                                ? 'Zamówienie'
                                : 'Oferta ' +
                                  (result.action === 'clone' ? 'sklonowana' : 'zaimportowana')) +
                                ' pomyslnie.'
                        );
                    } else {
                        alert('Blad: ' + (result.message || 'Nieznany blad'));
                    }
                    if (window.pvSalesUI) {
                        window.pvSalesUI.loadLocalOffers();
                    }
                } catch (err) {
                    alert('Blad: ' + err.message);
                    progress.style.display = 'none';
                }
            }
        );
    },

    _createModal(title, content, confirmLabel, onConfirm, noFooter) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';

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
        closeBtn.style.fontSize = '1.3rem';
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

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this._closeModal();
        });

        window.__ieModalOverlay = overlay;
        return overlay;
    },

    _closeModal() {
        if (window.__ieModalOverlay && window.__ieModalOverlay.parentNode) {
            document.body.removeChild(window.__ieModalOverlay);
        }
        window.__ieModalOverlay = null;
    }
};
