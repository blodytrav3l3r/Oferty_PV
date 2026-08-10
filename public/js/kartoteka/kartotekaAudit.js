// @ts-check
/* ===== Moduł audytu/historii dla PV Sales UI ===== */

export function auditGetContextLabel(self, type) {
    if (type === 'order') return 'zamówienia';
    if (type === 'production_order') return 'zlecenia produkcyjnego';
    if (type === 'offer') return 'oferty rury';
    return 'oferty studni';
}

export function auditGetActionMeta(log) {
    const isDiff = log.newData && log.newData._diffMode === true;
    if (log.action === 'delete') {
        return { className: 'action-delete', icon: 'trash-2', label: 'Usunięto', tone: 'danger' };
    }
    if (log.action === 'create') {
        return { className: 'action-create', icon: 'sparkles', label: 'Utworzono', tone: 'create' };
    }
    if (isDiff) {
        return { className: 'action-diff', icon: 'pencil', label: 'Zmieniono', tone: 'diff' };
    }
    return { className: 'action-update', icon: 'save', label: 'Zapisano', tone: 'update' };
}

export function auditGetFieldLabel(key) {
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
}

export function auditFormatValue(self, value) {
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
    return escapeHtml(value);
}

export function auditGetSnapshotTitle(self, data, type) {
    if (!data || typeof data !== 'object') return self.getAuditContextLabel(type);
    return (
        data.orderNumber ||
        data.offerNumber ||
        data.number ||
        data.offer_number ||
        data.clientName ||
        data.company ||
        self.getAuditContextLabel(type)
    );
}

export function auditGetSnapshotSummary(self, data, type) {
    if (!data || typeof data !== 'object') return 'Brak szczegółów w tym wpisie.';
    const parts = [];
    const money = data.totalBrutto || data.totalNetto || data.totalTotalNetto;
    if (money) parts.push(`wartość: ${self.formatAuditValue(Number(money))} PLN`);
    if (data.clientName || data.company)
        parts.push(`klient: ${escapeHtml(data.clientName || data.company)}`);
    if (data.orderNumber) parts.push(`zamówienie: ${escapeHtml(data.orderNumber)}`);
    if (data.offerNumber || data.number)
        parts.push(`oferta: ${escapeHtml(data.offerNumber || data.number)}`);
    if (type === 'order' && data.kartaBudowy) parts.push('zawiera kartę budowy');
    return parts.length ? parts.join(' • ') : 'Zapisano pełną migawkę dokumentu.';
}

export function auditGetBusinessChanges(self, log) {
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
        label: self.getAuditFieldLabel(key),
        oldValue: oldData[key],
        newValue: data[key]
    }));
}

export function auditRenderEntry(self, log, id, type) {
    const meta = self.getAuditActionMeta(log);
    const data = log.newData || {};
    const oldData = log.oldData || {};
    const isDiff = data._diffMode === true;
    const source = log.action === 'delete' ? oldData : data;
    const title = escapeHtml(self.getAuditSnapshotTitle(source, type));
    const summary = escapeHtml(self.getAuditSnapshotSummary(source, type));
    const date = log.createdAt ? new Date(log.createdAt).toLocaleString('pl-PL') : 'brak daty';
    const author = escapeHtml(log.userName || log.userId || 'System');

    let detailsHtml = '';
    if (isDiff) {
        const changes = self.getBusinessChanges(log);
        detailsHtml = changes.length
            ? changes
                  .map(
                      (change) => `
                <div class="audit-change-row">
                    <span class="audit-change-name">${escapeHtml(change.label)}</span>
                    <span class="audit-change-values">
                        <span class="audit-old">${self.formatAuditValue(change.oldValue)}</span>
                        <i data-lucide="arrow-right"></i>
                        <span class="audit-new">${self.formatAuditValue(change.newValue)}</span>
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
        ? `<button class="btn btn-sm btn-secondary restore-btn" onclick="window.kartotekaUI.restoreOfferVersionUnified('${escapeHtml(id)}', '${escapeHtml(log.id)}', '${escapeHtml(type)}')"><i data-lucide="refresh-cw"></i> Przywróć</button>`
        : '';
    const previewBtn = `<button class="btn btn-sm btn-secondary preview-btn" onclick="window.kartotekaUI.viewHistorySnapshotUnified('${escapeHtml(id)}', '${escapeHtml(log.id)}', '${escapeHtml(type)}')"><i data-lucide="eye"></i> Podgląd</button>`;

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
}

export async function auditShowHistory(self, id, type = 'studnia_oferta') {
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
            if (typeof window.showToast === 'function') {
                window.showToast('Brak historii dla tego elementu', 'info');
            }
            return;
        }

        const existing = document.getElementById('offer-history-modal');
        if (existing) existing.remove();

        const contextLabel = self.getAuditContextLabel(type);
        const historyHtml = logs.map((log) => self.renderAuditEntry(log, id, type)).join('');
        const loadMoreHtml =
            logs.length < total
                ? `<div id="audit-load-more-wrap-kartoteka" class="audit-load-more-wrap">
                <button class="btn btn-sm btn-secondary" onclick="window.kartotekaUI.loadMoreAuditLogs('${escapeHtml(type)}', '${escapeHtml(id)}', 20)"><i data-lucide="scroll-text"></i> Pokaż starsze zmiany (${total - logs.length})</button>
            </div>`
                : '';

        const overlayHtml = `
            <div class="modal audit-modal-inner">
                <div class="audit-modal-header">
                    <div>
                        <h3 id="offer-history-title"><i data-lucide="history"></i> Historia ${contextLabel}</h3>
                        <div class="audit-modal-subtitle">${total} wpisów • najnowsze zmiany na górze</div>
                    </div>
                    <button class="btn-icon" aria-label="Zamknij" onclick="document.getElementById('offer-history-modal').remove()"><i data-lucide="x" aria-hidden="true"></i></button>
                </div>
                <div id="audit-logs-container-kartoteka" class="audit-list">
                    ${historyHtml}
                    ${loadMoreHtml}
                </div>
            </div>`;

        showModal({ id: 'offer-history-modal', titleId: 'offer-history-title', html: overlayHtml });
        if (typeof window.lucide !== 'undefined') window.lucide.createIcons();

        self.currentAuditLogs = logs;
        self.currentAuditOffset = logs.length;
        self.currentAuditEntityId = id;
        self.currentAuditEntityType = type;
        self._renderEntry = (log) => self.renderAuditEntry(log, id, type);
    } catch (error) {
        logger.error('kartotekaUi', 'Błąd wyświetlania historii:', error);
        if (typeof window.showToast === 'function') {
            window.showToast('Błąd pobierania historii', 'error');
        }
    }
}

export async function auditLoadMore(self, entityType, entityId, limit) {
    try {
        const offset = self.currentAuditOffset || 0;
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

        self.currentAuditLogs = [...(self.currentAuditLogs || []), ...newLogs];
        self.currentAuditOffset = offset + newLogs.length;

        const container = document.getElementById('audit-logs-container-kartoteka');
        const wrap = document.getElementById('audit-load-more-wrap-kartoteka');
        if (wrap) wrap.remove();

        container.insertAdjacentHTML('beforeend', newLogs.map(self._renderEntry).join(''));

        if (self.currentAuditOffset < total) {
            const remaining = total - self.currentAuditOffset;
            container.insertAdjacentHTML(
                'beforeend',
                `
                <div id="audit-load-more-wrap-kartoteka" class="audit-load-more-wrap">
                    <button class="btn btn-sm btn-secondary" onclick="window.kartotekaUI.loadMoreAuditLogs('${escapeHtml(entityType)}', '${escapeHtml(entityId)}', ${limit})"><i data-lucide="scroll-text"></i> Pokaż starsze zmiany (${remaining})</button>
                </div>`
            );
        }
        if (typeof window.lucide !== 'undefined') window.lucide.createIcons();
    } catch (e) {
        logger.error('kartotekaUi', 'Błąd ładowania logów:', e);
    }
}

export async function auditRestoreVersion(self, offerId, logId, type) {
    try {
        const log = self.currentAuditLogs?.find((l) => l.id === logId);
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
                sessionStorage.setItem('pending_restore', JSON.stringify({ type, data: snapshot }));
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
        logger.error('kartotekaUi', 'Błąd przywracania wersji:', error);
    }
}

export function auditShowSnapshotModal(self, data, type) {
    const existing = document.getElementById('audit-snapshot-modal');
    if (existing) existing.remove();

    const rows = Object.entries(data || {})
        .filter(([key]) => !['history', '_diffMode'].includes(key))
        .slice(0, 40)
        .map(
            ([key, value]) => `
            <div class="audit-change-row">
                <span class="audit-change-name">${escapeHtml(self.getAuditFieldLabel(key))}</span>
                <span class="audit-change-values"><span class="audit-new">${self.formatAuditValue(value)}</span></span>
            </div>`
        )
        .join('');

    showModal({
        id: 'audit-snapshot-modal',
        titleId: 'audit-snapshot-title',
        html: `
        <div class="modal audit-modal-inner">
            <div class="audit-modal-header">
                <div>
                    <h3 id="audit-snapshot-title"><i data-lucide="eye"></i> Podgląd historyczny</h3>
                    <div class="audit-modal-subtitle">${escapeHtml(self.getAuditContextLabel(type))}</div>
                </div>
                <button class="btn-icon" aria-label="Zamknij" onclick="closeModal()"><i data-lucide="x" aria-hidden="true"></i></button>
            </div>
            <div class="audit-list" style="display:flex; flex-direction:column; gap:0.45rem;">
                ${rows || '<div class="audit-muted">Brak danych do pokazania.</div>'}
            </div>
        </div>`
    });
    if (typeof window.lucide !== 'undefined') window.lucide.createIcons();
}

export async function auditViewSnapshot(self, id, logId, type) {
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
            self.showAuditSnapshotModal(rebuiltData, type);
            return;
        }

        if (typeof window.showToast === 'function') {
            window.showToast('Wczytano wersję historyczną do testowego podglądu.', 'info');
        }

        self.openOfferForEdit(rebuiltData, id, type);
    } catch (error) {
        logger.error('kartotekaUi', 'Błąd podglądu historii:', error);
        if (typeof window.showToast === 'function') window.showToast(error.message, 'error');
    }
}
