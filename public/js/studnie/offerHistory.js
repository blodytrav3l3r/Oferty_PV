// @ts-check
/* ===== HISTORIA OFERTY STUDNIE (audyt SQLite) ===== */

function renderAuditLogEntry(log) {
    const data = log.newData || {};
    const isDiff = data._diffMode === true;
    const isDelete = log.action === 'delete';

    let actionBadge = '';
    let contentHtml = '';
    let cardClass = '';

    if (isDelete) {
        cardClass = 'action-delete';
        actionBadge =
            '<span style="background:rgba(var(--danger-rgb), 0.15); color:var(--danger-hover); padding:4px 10px; border-radius: var(--radius-sm); font-size: var(--fs-base); font-weight: var(--fw-extrabold); letter-spacing:0.5px;"><i data-lucide="trash-2"></i> USUNIĘTO</span>';
        const oldData = log.oldData || {};
        contentHtml = `<div style="font-size: var(--fs-xl); color:var(--danger-hover);">Usunięta oferta${oldData.totalBrutto ? ` — wcześniej: <strong style="color:var(--white);">${fmt(oldData.totalBrutto)} PLN</strong>` : ''}</div>`;
    } else if (log.action === 'create') {
        cardClass = 'action-create';
        actionBadge =
            '<span style="background:rgba(var(--accent-rgb), 0.15); color:var(--accent-hover); padding:4px 10px; border-radius: var(--radius-sm); font-size: var(--fs-base); font-weight: var(--fw-extrabold); letter-spacing:0.5px;"><i data-lucide="sparkles"></i> UTWORZONO</span>';
        const price = data.totalBrutto || 0;
        contentHtml = `<div class="fs-4xl-eb-primary"><i data-lucide="banknote"></i> ${fmt(price)} PLN</div>`;
        if (data.wells)
            contentHtml += `<div class="fs-md-muted"><i data-lucide="package"></i> ${data.wells.length} studni</div>`;
    } else if (isDiff) {
        cardClass = 'action-diff';
        actionBadge =
            '<span style="background:rgba(var(--warn-rgb), 0.15); color:var(--warn-hover); padding:4px 10px; border-radius: var(--radius-sm); font-size: var(--fs-base); font-weight: var(--fw-extrabold); letter-spacing:0.5px;"><i data-lucide="edit"></i> EDYCJA (DIFF)</span>';
        const changedKeys = Object.keys(data).filter((k) => k !== '_diffMode');
        const changesHtml = changedKeys
            .map((k) => {
                const oldVal =
                    log.oldData && log.oldData[k] !== undefined ? log.oldData[k] : '(brak)';
                const newVal = data[k] !== undefined ? data[k] : '(brak)';
                if (
                    k === 'totalBrutto' ||
                    k === 'totalNetto' ||
                    k.toLowerCase().includes('price') ||
                    k.toLowerCase().includes('cena')
                ) {
                    return `<div class="diff-line"><strong class="diff-key">${escapeHtml(k)}</strong>: <span class="diff-old">${escapeHtml(fmt(Number(oldVal)))} PLN</span> <span class="fs-md-muted"><i data-lucide="arrow-right"></i></span> <span class="diff-new">${escapeHtml(fmt(Number(newVal)))} PLN</span></div>`;
                }
                return `<div class="diff-line"><strong class="diff-key">${escapeHtml(k)}</strong>: <span class="diff-old">${escapeHtml(JSON.stringify(oldVal))}</span> <span class="fs-md-muted"><i data-lucide="arrow-right"></i></span> <span class="diff-new">${escapeHtml(JSON.stringify(newVal))}</span></div>`;
            })
            .join('');
        contentHtml = `<div class="diff-container">${changesHtml}</div>`;
    } else {
        cardClass = 'action-update';
        actionBadge =
            '<span style="background:rgba(var(--success-rgb), 0.15); color:var(--success-hover); padding:4px 10px; border-radius: var(--radius-sm); font-size: var(--fs-base); font-weight: var(--fw-extrabold); letter-spacing:0.5px;"><i data-lucide="save"></i> ZAPIS / AKTUALIZACJA</span>';
        const price = data.totalBrutto || 0;
        const oldPrice = log.oldData?.totalBrutto || 0;
        if (oldPrice && Math.abs(price - oldPrice) > 0.01) {
            contentHtml = `<div class="fs-4xl-eb-primary"><i data-lucide="banknote"></i> <span style="text-decoration:line-through;color:var(--text-muted);font-size: var(--fs-xl);font-weight: var(--fw-semibold);">${fmt(oldPrice)}</span> <span style="color:var(--text-muted); font-size: var(--fs-xl); margin:0 4px;"><i data-lucide="arrow-right"></i></span> ${fmt(price)} PLN</div>`;
        } else {
            contentHtml = `<div class="fs-4xl-eb-primary"><i data-lucide="banknote"></i> ${fmt(price)} PLN</div>`;
        }
        if (data.wells)
            contentHtml += `<div class="fs-md-muted"><i data-lucide="package"></i> ${data.wells.length} studni</div>`;
    }

    const restoreBtnHtml =
        !isDelete && !isDiff
            ? `
        <button class="btn btn-sm btn-secondary restore-btn" onclick="restoreHistorySnapshot('${escapeHtml(log.id)}')"><i data-lucide="refresh-cw" aria-hidden="true"></i> Przywróć</button>
    `
            : '';

    const buttonsHtml = `
        <div class="flex-gap-4">
            <button class="btn btn-sm btn-secondary preview-btn" onclick="viewHistorySnapshot('${escapeHtml(log.id)}')"><i data-lucide="eye" aria-hidden="true"></i> Podgląd</button>
            ${restoreBtnHtml}
        </div>
    `;

    return `
        <div class="audit-card ${cardClass}">
            <div class="audit-card-header">
                <div style="display:flex; align-items:center; gap:0.6rem;">
                    ${actionBadge}
                    <span class="audit-date"><i data-lucide="calendar"></i> ${new Date(log.createdAt).toLocaleString()}</span>
                </div>
                <div class="audit-author">
                    <i data-lucide="user"></i>‍<i data-lucide="monitor"></i> <strong class="text-primary">${escapeHtml(log.userName || 'System')}</strong>
                </div>
            </div>
            <div class="audit-card-body">
                <div class="audit-content">${contentHtml}</div>
                <div class="audit-actions">${buttonsHtml}</div>
            </div>
        </div>
    `;
}

async function showOfferHistoryStudnie(id) {
    try {
        const res = await fetch(`/api/audit/studnia_oferta/${id}?limit=20&offset=0`, {
            headers: authHeaders()
        });
        const json = await res.json();
        const logs = json.data || [];
        const total = json.total || 0;

        if (logs.length === 0) {
            showToast('Brak historii dla tego elementu', 'info');
            return;
        }

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay js-modal-overlay';
        overlay.id = 'offer-history-modal';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');

        const historyHtml = logs.map(renderAuditLogEntry).join('');
        const loadMoreHtml =
            logs.length < total
                ? `<div id="audit-load-more-wrap" class="text-center">
                   <button class="load-more-btn" onclick="loadMoreAuditLogs('studnia_oferta', '${escapeHtml(id)}', 20)"><i data-lucide="scroll-text"></i> Załaduj starsze zmiany (${total - logs.length} pozostało)</button>
               </div>`
                : '';

        overlay.innerHTML = `
            <style>
                .audit-modal-inner {
                    max-width: 800px; width: 95%; border-radius: var(--radius-lg); max-height: 90vh; 
                    display: flex; flex-direction: column; background: var(--slate-950); 
                    box-shadow: 0 25px 50px -12px rgba(var(--black-rgb), 0.5); border: 1px solid rgba(var(--white-rgb), 0.1);
                }
                .audit-card {
                    background: rgba(var(--slate-800-rgb), 0.8);
                    border: 1px solid rgba(var(--white-rgb), 0.05);
                    border-radius: var(--radius-md);
                    padding: 1.25rem 1.5rem;
                    margin-bottom: 1rem;
                    position: relative;
                    overflow: hidden;
                    transition: all 0.2s ease;
                    backdrop-filter: blur(10px);
                }
                .audit-card:hover {
                    background: rgba(var(--slate-800-rgb), 0.8);
                    border-color: rgba(var(--white-rgb), 0.15);
                    transform: translateY(-2px);
                    box-shadow: 0 10px 15px -3px rgba(var(--black-rgb), 0.3), 0 4px 6px -2px rgba(var(--black-rgb), 0.15);
                }
                .audit-card::before {
                    content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 5px;
                }
                .audit-card.action-create::before { background: var(--accent-hover); }
                .audit-card.action-update::before { background: var(--success-hover); }
                .audit-card.action-diff::before { background: var(--warn-hover); }
                .audit-card.action-delete::before { background: var(--danger-hover); }
                
                .audit-card-header {
                    display: flex; justify-content: space-between; align-items: center;
                    margin-bottom: 1rem; padding-bottom: 0.8rem; border-bottom: 1px solid rgba(var(--white-rgb), 0.05);
                }
                .audit-date { font-size: var(--fs-lg); color: var(--text-secondary); font-weight: var(--fw-medium); }
                .audit-author { font-size: var(--fs-lg); color: var(--border); display:flex; align-items:center; gap:4px; }
                
                .audit-card-body {
                    display: flex; justify-content: space-between; align-items: center; gap: 1rem;
                }
                
                .diff-container { display: flex; flex-direction: column; gap: 0.4rem; }
                .diff-line { background: rgba(var(--black-rgb), 0.2); padding: 0.4rem 0.8rem; border-radius: var(--radius-sm); font-size: var(--fs-lg); }
                .diff-key { color: var(--text-primary); font-weight: var(--fw-semibold); font-family: monospace; }
                .diff-old { color: var(--text-secondary); text-decoration: line-through; }
                .diff-new { color: var(--success-hover); font-weight: var(--fw-bold); }
                
                .restore-btn, .preview-btn {
                    background: rgba(var(--white-rgb), 0.05); border: 1px solid rgba(var(--white-rgb), 0.1); 
                    color: var(--text-primary); padding: 0.5rem 1rem; border-radius: var(--radius-sm); font-weight: var(--fw-semibold);
                    transition: all 0.2s; cursor: pointer; display: flex; align-items: center; gap: 6px;
                }
                .preview-btn:hover { background: rgba(var(--accent-rgb), 0.15); border-color: rgba(var(--accent-rgb), 0.3); color: var(--accent-hover); }
                .restore-btn:hover { background: rgba(var(--success-rgb), 0.2); border-color: rgba(var(--success-rgb), 0.5); color: var(--success-hover); }
                
                .load-more-btn {
                    background: rgba(var(--accent-rgb), 0.15); border: 1px solid rgba(var(--accent-rgb), 0.3); 
                    color: var(--accent-hover); font-weight: var(--fw-bold); padding: 0.6rem 1.5rem; border-radius: 30px;
                    cursor: pointer; transition: all 0.2s;
                }
                .load-more-btn:hover { background: rgba(var(--accent-rgb), 0.3); transform: scale(1.05); }
            </style>
            <div class="modal audit-modal-inner">
                <div class="modal-header" style="border-bottom:1px solid rgba(var(--white-rgb), 0.1); padding:1.2rem 1.5rem; background: rgba(var(--white-rgb), 0.05); border-radius: var(--radius-lg) 20px 0 0;">
                    <h3 style="font-weight: var(--fw-extrabold); color:var(--white); margin:0; display:flex; align-items:center; gap:0.5rem;">
                        <span style="font-size: var(--fs-5xl);">⌛</span> Oś Czasu Zmian (${total} wpisów)
                    </h3>
                    <button class="btn-icon" aria-label="Zamknij" style="background:rgba(var(--white-rgb), 0.1); color:var(--white); border-radius:50%; width:32px; height:32px; display:flex; align-items:center; justify-content:center;" onclick="closeModal()"><i data-lucide="x" aria-hidden="true"></i></button>
                </div>
                <div id="audit-logs-container" style="padding:1.5rem; overflow-y:auto; flex:1; scrollbar-width:thin;">
                    ${historyHtml}
                    ${loadMoreHtml}
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        overlay.classList.add('active');
        if (typeof trapFocus === 'function') {
            /** @type {any} */ (overlay)._previousFocus = document.activeElement;
            trapFocus(overlay);
        }
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });

        window.currentAuditLogs = logs;
        window.currentAuditOffset = logs.length;
    } catch (e) {
        logger.error('offerManager', 'Błąd pobierania historii:', e);
        showToast('Błąd pobierania historii', 'error');
    }
}

async function loadMoreAuditLogs(entityType, entityId, limit) {
    try {
        const offset = window.currentAuditOffset || 0;
        const res = await fetch(
            `/api/audit/${entityType}/${entityId}?limit=${limit}&offset=${offset}`,
            { headers: authHeaders() }
        );
        const json = await res.json();
        const newLogs = json.data || [];
        const total = json.total || 0;

        if (newLogs.length === 0) return;

        window.currentAuditLogs = [...(window.currentAuditLogs || []), ...newLogs];
        window.currentAuditOffset = offset + newLogs.length;

        const container = document.getElementById('audit-logs-container');
        const loadMoreWrap = document.getElementById('audit-load-more-wrap');
        if (loadMoreWrap) loadMoreWrap.remove();

        container.insertAdjacentHTML('beforeend', newLogs.map(renderAuditLogEntry).join(''));

        if (window.currentAuditOffset < total) {
            const remaining = total - window.currentAuditOffset;
            container.insertAdjacentHTML(
                'beforeend',
                `
                <div id="audit-load-more-wrap" class="text-center">
                    <button class="load-more-btn" onclick="loadMoreAuditLogs('${escapeHtml(entityType)}', '${escapeHtml(entityId)}', ${limit})"><i data-lucide="scroll-text"></i> Załaduj starsze zmiany (${remaining} pozostało)</button>
                </div>
            `
            );
        }
    } catch (e) {
        logger.error('offerManager', 'Błąd ładowania kolejnych logów:', e);
    }
}

async function viewHistorySnapshot(logId) {
    const log = window.currentAuditLogs?.find((l) => l.id === logId);
    if (!log) return;

    try {
        const entityType = log.entityType;
        const entityId = log.entityId;

        const res = await fetch(`/api/audit/rebuild/${entityType}/${entityId}/${logId}`, {
            headers: authHeaders()
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Błąd odtwarzania z serwera.');
        }

        const json = await res.json();
        const rebuiltData = json.data;

        if (entityType === 'order' && typeof window.loadOrderSnapshot === 'function') {
            window.loadOrderSnapshot(rebuiltData, entityId);
            showToast(
                '<i data-lucide="eye"></i>️ Wczytano archiwalną wersję ZAMÓWIENIA w trybie READ-ONLY',
                'info'
            );
        } else {
            loadSavedOfferStudnie(rebuiltData);
            showToast(
                '<i data-lucide="eye"></i>️ Wczytano wersję historyczną do testowego podglądu',
                'info'
            );
            if (typeof window.applyPreviewLockUI === 'function') window.applyPreviewLockUI();
        }

        closeModal();
    } catch (e) {
        logger.error('offerManager', 'Błąd podglądu:', e);
        showToast('Błąd podglądu: ' + e.message, 'error');
    }
}

async function restoreHistorySnapshot(logId) {
    const log = window.currentAuditLogs?.find((l) => l.id === logId);
    if (!log || !log.newData) return;

    if (
        !(await appConfirm(
            'Czy na pewno chcesz przywrócić tę wersję? Aktualne zmiany zostaną nadpisane przy następnym zapisie.',
            { title: 'Przywrócenie wersji', type: 'warning', okText: 'Przywróć' }
        ))
    )
        return;

    if (log.entityType === 'order' && typeof window.loadOrderSnapshot === 'function') {
        window.loadOrderSnapshot(log.newData, log.entityId);
        // Wymuś tryb odblokowania dla przywracania
        window.isPreviewMode = false;
        const banner = document.getElementById('preview-lock-banner');
        if (banner) banner.remove();
        document
            .querySelectorAll('.drop-zone, #svg-trash, #studnie-product-list, .actions-bar')
            .forEach((el) => {
                el.style.pointerEvents = '';
                el.style.opacity = '1';
            });
        showToast(
            '<i data-lucide="refresh-cw"></i> Przywrócono ZAMÓWIENIE z historii. Zapisz pomyślnie używając guzika "Zapisz zamówienie".',
            'success'
        );
    } else {
        loadSavedOfferStudnie(log.newData);
        showToast(
            '<i data-lucide="refresh-cw"></i> Przywrócono wersję historyczną. Zapisz ofertę, aby zatwierdzić.',
            'success'
        );
    }

    closeModal();
}

/* ===== Rejestracja globali ===== */
window.showOfferHistoryStudnie = showOfferHistoryStudnie;
window.loadMoreAuditLogs = loadMoreAuditLogs;
window.viewHistorySnapshot = viewHistorySnapshot;
window.restoreHistorySnapshot = restoreHistorySnapshot;
