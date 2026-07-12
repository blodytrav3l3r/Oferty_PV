// @ts-check
/* ===== pvSalesAudit.js — audit/versioning mixin for PVSalesUI ===== */

export const pvSalesAuditMixin = {
    getAuditContextLabel(type) {
        if (type === 'order') return 'zamówienia';
        if (type === 'production_order') return 'zlecenia produkcyjnego';
        if (type === 'offer') return 'oferty rury';
        return 'oferty studni';
    },

    getAuditActionMeta(log) {
        const isDiff = log.newData && log.newData._diffMode === true;
        if (log.action === 'delete') {
            return {
                className: 'action-delete',
                icon: 'trash-2',
                label: 'Usunięto',
                tone: 'danger'
            };
        }
        if (log.action === 'create') {
            return {
                className: 'action-create',
                icon: 'sparkles',
                label: 'Utworzono',
                tone: 'create'
            };
        }
        if (isDiff) {
            return { className: 'action-diff', icon: 'pencil', label: 'Zmieniono', tone: 'diff' };
        }
        return { className: 'action-update', icon: 'save', label: 'Zapisano', tone: 'update' };
    },

    getAuditFieldLabel(key) {
        const labels = {
            totalBrutto: 'Wartość brutto',
            totalNetto: 'Wartość netto',
            totalTotalNetto: 'Wartość netto',
            originalTotalNetto: 'Pierwotna wartość netto',
            originalTotalTotalNetto: 'Pierwotna wartość netto',
            clientName: 'Klient',
            company: 'Firma',
            nip: 'NIP',
            contact: 'Kontakt',
            address: 'Adres',
            investName: 'Inwestycja',
            budowa: 'Budowa',
            userId: 'Opiekun',
            orderNumber: 'Numer zamówienia',
            offerNumber: 'Numer oferty',
            status: 'Status',
            state: 'Status',
            kartaBudowy: 'Karta budowy',
            transportType: 'Rodzaj transportu',
            paymentTerms: 'Warunki płatności',
            invoiceEmails: 'E-maile do faktury',
            efakturaEmails: 'E-faktura',
            wells: 'Studnie',
            wellsExport: 'Pozycje studni',
            products: 'Produkty',
            visiblePrzejsciaTypes: 'Widoczne typy przejść',
            originalSnapshot: 'Pierwotna migawka',
            transportKm: 'Kilometry transportu',
            transportRate: 'Stawka transportu',
            updatedAt: 'Ostatnia zmiana',
            createdAt: 'Utworzono',
            createdBy: 'Utworzył',
            totalWeight: 'Waga łączna',
            wellDiscounts: 'Rabaty studni'
        };
        return labels[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
    },

    formatAuditValue(value) {
        if (value === undefined || value === null || value === '') return 'brak';
        if (typeof value === 'number') {
            const formatter =
                typeof window.fmt === 'function'
                    ? window.fmt
                    : (val) =>
                          Number(val || 0)
                              .toFixed(2)
                              .replace('.', ',');
            return formatter(value);
        }
        if (typeof value === 'boolean') return value ? 'tak' : 'nie';
        if (Array.isArray(value)) return `${value.length} poz.`;
        if (typeof value === 'object') return 'zmieniono dane';
        return this.escapeHtml(value);
    },

    getAuditSnapshotTitle(data, type) {
        if (!data || typeof data !== 'object') return this.getAuditContextLabel(type);
        return (
            data.orderNumber ||
            data.offerNumber ||
            data.number ||
            data.offer_number ||
            data.clientName ||
            data.company ||
            this.getAuditContextLabel(type)
        );
    },

    getAuditSnapshotSummary(data, type) {
        if (!data || typeof data !== 'object') return 'Brak szczegółów w tym wpisie.';
        const parts = [];
        const money = data.totalBrutto || data.totalNetto || data.totalTotalNetto;
        if (money) parts.push(`wartość: ${this.formatAuditValue(Number(money))} PLN`);
        if (data.clientName || data.company)
            parts.push(`klient: ${this.escapeHtml(data.clientName || data.company)}`);
        if (data.orderNumber) parts.push(`zamówienie: ${this.escapeHtml(data.orderNumber)}`);
        if (data.offerNumber || data.number)
            parts.push(`oferta: ${this.escapeHtml(data.offerNumber || data.number)}`);
        if (type === 'order' && data.kartaBudowy) parts.push('zawiera kartę budowy');
        return parts.length ? parts.join(' • ') : 'Zapisano pełną migawkę dokumentu.';
    },

    getBusinessChanges(log) {
        const data = log.newData || {};
        const oldData = log.oldData || {};
        const keys = Object.keys(data).filter((key) => key !== '_diffMode');
        const priority = [
            'totalBrutto',
            'totalNetto',
            'totalTotalNetto',
            'clientName',
            'company',
            'orderNumber',
            'status',
            'state',
            'userId',
            'kartaBudowy',
            'wellsExport',
            'wells',
            'products'
        ];
        const orderedKeys = [
            ...priority.filter((key) => keys.includes(key)),
            ...keys.filter((key) => !priority.includes(key))
        ];
        return orderedKeys.slice(0, 6).map((key) => ({
            key,
            label: this.getAuditFieldLabel(key),
            oldValue: oldData[key],
            newValue: data[key]
        }));
    },

    renderAuditEntry(log, id, type) {
        const meta = this.getAuditActionMeta(log);
        const data = log.newData || {};
        const oldData = log.oldData || {};
        const isDiff = data._diffMode === true;
        const source = log.action === 'delete' ? oldData : data;
        const title = this.escapeHtml(this.getAuditSnapshotTitle(source, type));
        const summary = this.escapeHtml(this.getAuditSnapshotSummary(source, type));
        const date = log.createdAt ? new Date(log.createdAt).toLocaleString('pl-PL') : 'brak daty';
        const author = this.escapeHtml(log.userName || log.userId || 'System');

        let detailsHtml = '';
        if (isDiff) {
            const changes = this.getBusinessChanges(log);
            detailsHtml = changes.length
                ? changes
                      .map(
                          (change) => `
                    <div class="audit-change-row">
                        <span class="audit-change-name">${this.escapeHtml(change.label)}</span>
                        <span class="audit-change-values">
                            <span class="audit-old">${this.formatAuditValue(change.oldValue)}</span>
                            <i data-lucide="arrow-right"></i>
                            <span class="audit-new">${this.formatAuditValue(change.newValue)}</span>
                        </span>
                    </div>`
                      )
                      .join('')
                : '<div class="audit-muted">Zmieniono dokument, ale brak czytelnych pól do pokazania.</div>';
        } else if (log.action === 'delete') {
            detailsHtml =
                '<div class="audit-muted danger-text">Usunięto dokument. Migawka sprzed usunięcia jest dostępna w podglądzie.</div>';
        } else {
            detailsHtml = `<div class="audit-muted">${summary}</div>`;
        }

        const canRestore =
            log.action !== 'delete' && !isDiff && type !== 'order' && type !== 'production_order';
        const restoreBtn = canRestore
            ? `<button class="btn btn-sm btn-secondary restore-btn" data-action="restoreOfferVersion" data-entity-id="${id}" data-log-id="${log.id}" data-entity-type="${type}"><i data-lucide="refresh-cw"></i> Przywróć</button>`
            : '';
        const previewBtn = `<button class="btn btn-sm btn-secondary preview-btn" data-action="viewHistorySnapshot" data-entity-id="${id}" data-log-id="${log.id}" data-entity-type="${type}"><i data-lucide="eye"></i> Podgląd</button>`;

        return `
            <div class="audit-card ${meta.className}">
                <div class="audit-card-header">
                    <div class="audit-title-wrap">
                        <span class="audit-badge ${meta.tone}"><i data-lucide="${meta.icon}"></i> ${meta.label}</span>
                        <div>
                            <div class="audit-entry-title">${title}</div>
                            <div class="audit-entry-subtitle">${date} • ${author}</div>
                        </div>
                    </div>
                    <div class="audit-actions">${previewBtn}${restoreBtn}</div>
                </div>
                <div class="audit-card-body">${detailsHtml}</div>
            </div>`;
    },

    async showOfferHistoryUnified(id, type = 'studnia_oferta') {
        try {
            const headers =
                typeof authHeaders === 'function'
                    ? authHeaders()
                    : { 'Content-Type': 'application/json' };
            const res = await fetch(`/api/audit/${type}/${id}?limit=20&offset=0`, { headers });
            const json = await res.json();
            const logs = json.data || [];
            const total = json.total || 0;

            if (logs.length === 0) {
                if (typeof window.showToast === 'function')
                    window.showToast('Brak historii dla tego elementu', 'info');
                return;
            }

            const existing = document.getElementById('offer-history-modal');
            if (existing) existing.remove();

            const contextLabel = this.getAuditContextLabel(type);
            const historyHtml = logs.map((log) => this.renderAuditEntry(log, id, type)).join('');
            const loadMoreHtml =
                logs.length < total
                    ? `<div id="audit-load-more-wrap-kartoteka" class="audit-load-more-wrap">
                    <button class="load-more-btn" data-action="loadMoreAuditLogs" data-entity-type="${type}" data-entity-id="${id}" data-limit="20"><i data-lucide="scroll-text"></i> Pokaż starsze zmiany (${total - logs.length})</button>
                </div>`
                    : '';

            const overlayHtml = `
                <style>
                    .audit-modal-inner { width:100vw; height:100vh; max-width:none; max-height:none; display:flex; flex-direction:column; border-radius:0; background:#0f172a; border:0; box-shadow:none; overflow:hidden; }
                    .audit-modal-header { display:flex; justify-content:space-between; align-items:center; gap:1rem; padding:1rem 1.25rem; border-bottom:1px solid rgba(148,163,184,0.12); background:rgba(15,23,42,0.96); }
                    .audit-modal-header h3 { margin:0; color:var(--text-primary); font-size:1rem; display:flex; align-items:center; gap:0.55rem; }
                    .audit-modal-subtitle { color:var(--text-secondary); font-size:0.78rem; margin-top:0.18rem; }
                    .audit-list { padding:1rem 1.25rem 1.25rem; overflow-y:auto; }
                    .audit-card { position:relative; padding:0.9rem 1rem; margin-bottom:0.75rem; border-radius:8px; background:rgba(30,41,59,0.62); border:1px solid rgba(148,163,184,0.12); }
                    .audit-card::before { content:''; position:absolute; left:0; top:0; bottom:0; width:4px; }
                    .audit-card.action-create::before { background:var(--accent-hover); }
                    .audit-card.action-update::before { background:var(--success-hover); }
                    .audit-card.action-diff::before { background:var(--warn-hover); }
                    .audit-card.action-delete::before { background:var(--danger-hover); }
                    .audit-card-header { display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; margin-bottom:0.75rem; }
                    .audit-title-wrap { display:flex; align-items:flex-start; gap:0.7rem; min-width:0; }
                    .audit-badge { display:inline-flex; align-items:center; gap:0.35rem; height:28px; padding:0 0.6rem; border-radius:999px; font-size:0.72rem; font-weight:800; white-space:nowrap; }
                    .audit-badge i { width:13px; height:13px; }
                    .audit-badge.create { background:rgba(var(--accent-hover-rgb),0.14); color:var(--accent-text); border:1px solid rgba(var(--accent-hover-rgb),0.25); }
                    .audit-badge.update { background:rgba(var(--success-rgb),0.12); color:var(--success-hover); border:1px solid rgba(var(--success-rgb),0.22); }
                    .audit-badge.diff { background:rgba(var(--warn-rgb),0.12); color:var(--warn-hover); border:1px solid rgba(var(--warn-rgb),0.25); }
                    .audit-badge.danger { background:rgba(var(--danger-rgb),0.12); color:var(--danger-hover); border:1px solid rgba(var(--danger-rgb),0.25); }
                    .audit-entry-title { color:var(--text-primary); font-size:0.92rem; font-weight:750; line-height:1.25; }
                    .audit-entry-subtitle { color:var(--text-secondary); font-size:0.76rem; margin-top:0.2rem; }
                    .audit-card-body { display:flex; flex-direction:column; gap:0.45rem; padding-left:0.1rem; }
                    .audit-change-row { display:grid; grid-template-columns:minmax(130px,210px) 1fr; gap:0.75rem; align-items:center; padding:0.45rem 0.55rem; border-radius:7px; background:rgba(15,23,42,0.5); }
                    .audit-change-name { color:var(--border); font-size:0.78rem; font-weight:700; }
                    .audit-change-values { display:inline-flex; align-items:center; gap:0.45rem; min-width:0; color:var(--text-primary); font-size:0.8rem; }
                    .audit-change-values i { width:13px; height:13px; color:var(--text-muted); flex:0 0 auto; }
                    .audit-old { color:var(--text-secondary); text-decoration:line-through; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
                    .audit-new { color:var(--success-hover); font-weight:800; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
                    .audit-muted { color:var(--border); font-size:0.84rem; }
                    .danger-text { color:#fca5a5; }
                    .audit-actions { display:flex; gap:0.4rem; flex-wrap:wrap; justify-content:flex-end; }
                    .preview-btn, .restore-btn, .load-more-btn { border-radius:7px; font-weight:700; }
                    .load-more-btn { background:rgba(var(--accent-rgb),0.14); border:1px solid rgba(var(--accent-rgb),0.3); color:var(--accent-text); padding:0.55rem 1.1rem; cursor:pointer; }
                    .audit-load-more-wrap { text-align:center; padding:0.75rem 0 0.25rem; }
                    @media (max-width: 720px) { .audit-card-header, .audit-title-wrap { flex-direction:column; } .audit-actions { justify-content:flex-start; } .audit-change-row { grid-template-columns:1fr; gap:0.25rem; } }
                </style>
                <div class="modal audit-modal-inner">
                    <div class="audit-modal-header">
                        <div>
                            <h3 id="offer-history-title"><i data-lucide="history"></i> Historia ${contextLabel}</h3>
                            <div class="audit-modal-subtitle">${total} wpisów • najnowsze zmiany na górze</div>
                        </div>
                        <button class="btn-icon" aria-label="Zamknij" style="background:rgba(255,255,255,0.08); color:#fff; width:32px; height:32px;" data-action="closeHistoryModal"><i data-lucide="x" aria-hidden="true"></i></button>
                    </div>
                    <div id="audit-logs-container-kartoteka" class="audit-list">
                        ${historyHtml}
                        ${loadMoreHtml}
                    </div>
                </div>`;

            showModal({
                id: 'offer-history-modal',
                titleId: 'offer-history-title',
                html: overlayHtml
            });
            if (typeof window.lucide !== 'undefined') window.lucide.createIcons();

            this.currentAuditLogs = logs;
            this.currentAuditOffset = logs.length;
            this.currentAuditEntityId = id;
            this.currentAuditEntityType = type;
            this._renderEntry = (log) => this.renderAuditEntry(log, id, type);
        } catch (error) {
            logger.error('pvSalesUi', 'Błąd wyświetlania historii:', error);
            if (typeof window.showToast === 'function')
                window.showToast('Błąd pobierania historii', 'error');
        }
    },

    async loadMoreAuditLogs(entityType, entityId, limit) {
        try {
            const offset = this.currentAuditOffset || 0;
            const headers =
                typeof authHeaders === 'function'
                    ? authHeaders()
                    : { 'Content-Type': 'application/json' };
            const res = await fetch(
                `/api/audit/${entityType}/${entityId}?limit=${limit}&offset=${offset}`,
                { headers }
            );
            const json = await res.json();
            const newLogs = json.data || [];
            const total = json.total || 0;

            if (newLogs.length === 0) return;

            this.currentAuditLogs = [...(this.currentAuditLogs || []), ...newLogs];
            this.currentAuditOffset = offset + newLogs.length;

            const container = document.getElementById('audit-logs-container-kartoteka');
            const wrap = document.getElementById('audit-load-more-wrap-kartoteka');
            if (wrap) wrap.remove();

            container.insertAdjacentHTML('beforeend', newLogs.map(this._renderEntry).join(''));

            if (this.currentAuditOffset < total) {
                const remaining = total - this.currentAuditOffset;
                container.insertAdjacentHTML(
                    'beforeend',
                    `<div id="audit-load-more-wrap-kartoteka" class="audit-load-more-wrap">
                        <button class="load-more-btn" data-action="loadMoreAuditLogs" data-entity-type="${entityType}" data-entity-id="${entityId}" data-limit="${limit}"><i data-lucide="scroll-text"></i> Pokaż starsze zmiany (${remaining})</button>
                    </div>`
                );
            }
            if (typeof window.lucide !== 'undefined') window.lucide.createIcons();
        } catch (e) {
            logger.error('pvSalesUi', 'Błąd ładowania logów:', e);
        }
    },

    async restoreOfferVersionUnified(offerId, logId, type) {
        try {
            const log = this.currentAuditLogs?.find((l) => l.id === logId);
            if (!log || !log.newData) return;

            const snapshot = log.newData;
            const isStudnia = type === 'studnia_oferta';
            const currentPage = window.location.pathname.split('/').pop() || 'index.html';

            if (isStudnia && !currentPage.includes('studnie.html')) {
                if (
                    await appConfirm(
                        'Aby przywrócić tę wersję studni, musisz przejść do edytora STUDNIE. Przejść teraz?',
                        { title: 'Przekierowanie', type: 'info', okText: 'Przejdź' }
                    )
                ) {
                    sessionStorage.setItem(
                        'pending_restore',
                        JSON.stringify({ type, data: snapshot })
                    );
                    window.location.href = `studnie.html?edit=${offerId}&restore=true`;
                }
                return;
            }

            if (isStudnia && typeof window.loadSavedOfferStudnie === 'function') {
                window.loadSavedOfferStudnie(snapshot);
            } else if (!isStudnia && typeof window.loadSavedOfferData === 'function') {
                window.loadSavedOfferData(snapshot, offerId);
            }

            const modal = document.getElementById('offer-history-modal');
            if (modal) modal.remove();

            if (typeof window.showToast === 'function')
                window.showToast('Wersja przywrócona do edytora.', 'success');
        } catch (error) {
            logger.error('pvSalesUi', 'Błąd przywracania wersji:', error);
        }
    },

    showAuditSnapshotModal(data, type) {
        const existing = document.getElementById('audit-snapshot-modal');
        if (existing) existing.remove();

        const rows = Object.entries(data || {})
            .filter(([key]) => !['history', '_diffMode'].includes(key))
            .slice(0, 40)
            .map(
                ([key, value]) => `
                <div class="audit-change-row">
                    <span class="audit-change-name">${this.escapeHtml(this.getAuditFieldLabel(key))}</span>
                    <span class="audit-change-values"><span class="audit-new">${this.formatAuditValue(value)}</span></span>
                </div>`
            )
            .join('');

        showModal({
            id: 'audit-snapshot-modal',
            titleId: 'audit-snapshot-title',
            html: `
            <style>
                #audit-snapshot-modal .audit-modal-inner { width:100vw; height:100vh; max-width:none; max-height:none; background:#0f172a; border:0; border-radius:0; box-shadow:none; display:flex; flex-direction:column; }
                #audit-snapshot-modal .audit-modal-header { display:flex; justify-content:space-between; align-items:center; gap:1rem; padding:1rem 1.25rem; border-bottom:1px solid rgba(148,163,184,0.12); }
                #audit-snapshot-modal .audit-modal-header h3 { margin:0; color:var(--text-primary); font-size:1rem; display:flex; align-items:center; gap:0.55rem; }
                #audit-snapshot-modal .audit-modal-subtitle { color:var(--text-secondary); font-size:0.78rem; margin-top:0.18rem; }
                #audit-snapshot-modal .audit-list { padding:1rem 1.25rem 1.25rem; overflow-y:auto; }
                #audit-snapshot-modal .audit-change-row { display:grid; grid-template-columns:minmax(130px,210px) 1fr; gap:0.75rem; align-items:center; padding:0.45rem 0.55rem; border-radius:7px; background:rgba(15,23,42,0.5); }
                #audit-snapshot-modal .audit-change-name { color:var(--border); font-size:0.78rem; font-weight:700; }
                #audit-snapshot-modal .audit-change-values { min-width:0; color:var(--text-primary); font-size:0.8rem; }
                #audit-snapshot-modal .audit-new { color:var(--success-hover); font-weight:800; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:block; }
                #audit-snapshot-modal .audit-muted { color:var(--border); font-size:0.84rem; }
            </style>
            <div class="modal audit-modal-inner" style="width:100vw; height:100vh; max-width:none; max-height:none; overflow:hidden;">
                <div class="audit-modal-header">
                    <div>
                        <h3 id="audit-snapshot-title"><i data-lucide="eye"></i> Podgląd historyczny</h3>
                        <div class="audit-modal-subtitle">${this.escapeHtml(this.getAuditContextLabel(type))}</div>
                    </div>
                    <button class="btn-icon" aria-label="Zamknij" style="background:rgba(255,255,255,0.08); color:#fff; width:32px; height:32px;" data-action="closeModal"><i data-lucide="x" aria-hidden="true"></i></button>
                </div>
                <div class="audit-list" style="display:flex; flex-direction:column; gap:0.45rem;">
                    ${rows || '<div class="audit-muted">Brak danych do pokazania.</div>'}
                </div>
            </div>`
        });
        if (typeof window.lucide !== 'undefined') window.lucide.createIcons();
    },

    async viewHistorySnapshotUnified(id, logId, type) {
        try {
            const headers =
                typeof authHeaders === 'function'
                    ? authHeaders()
                    : { 'Content-Type': 'application/json' };
            const res = await fetch(`/api/audit/rebuild/${type}/${id}/${logId}`, { headers });

            if (!res.ok) {
                const errJson = await res.json().catch(() => ({}));
                throw new Error(errJson.error || 'Błąd odbudowy historycznej wersji.');
            }

            const json = await res.json();
            const rebuiltData = json.data;

            const modal = document.getElementById('offer-history-modal');
            if (modal) modal.remove();

            const isKartoteka = (window.location.pathname.split('/').pop() || '').startsWith(
                'kartoteka'
            );
            if (type === 'order' || type === 'production_order' || isKartoteka) {
                this.showAuditSnapshotModal(rebuiltData, type);
                return;
            }

            if (typeof window.showToast === 'function')
                window.showToast('Wczytano wersję historyczną do testowego podglądu.', 'info');
            this.openOfferForEdit(rebuiltData, id, type);
        } catch (error) {
            logger.error('pvSalesUi', 'Błąd podglądu historii:', error);
            if (typeof window.showToast === 'function') window.showToast(error.message, 'error');
        }
    }
};
