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
            '<span style="background:rgba(var(--danger-rgb),0.15); color:var(--danger-hover); padding:4px 10px; border-radius:6px; font-size:0.75rem; font-weight:800; letter-spacing:0.5px;"><i data-lucide="trash-2"></i> USUNIĘTO</span>';
        const oldData = log.oldData || {};
        contentHtml = `<div style="font-size:0.9rem; color:var(--danger-hover);">Usunięta oferta${oldData.totalBrutto ? ` — wcześniej: <strong style="color:#fff;">${fmt(oldData.totalBrutto)} PLN</strong>` : ''}</div>`;
    } else if (log.action === 'create') {
        cardClass = 'action-create';
        actionBadge =
            '<span style="background:rgba(var(--accent-rgb),0.15); color:var(--accent-hover); padding:4px 10px; border-radius:6px; font-size:0.75rem; font-weight:800; letter-spacing:0.5px;"><i data-lucide="sparkles"></i> UTWORZONO</span>';
        const price = data.totalBrutto || 0;
        contentHtml = `<div style="font-size:1.2rem; font-weight:800; color:var(--text-primary);"><i data-lucide="banknote"></i> ${fmt(price)} PLN</div>`;
        if (data.wells)
            contentHtml += `<div style="font-size:0.8rem; color:var(--text-secondary); margin-top:2px;"><i data-lucide="package"></i> ${data.wells.length} studni</div>`;
    } else if (isDiff) {
        cardClass = 'action-diff';
        actionBadge =
            '<span style="background:rgba(251,191,36,0.15); color:var(--warn-hover); padding:4px 10px; border-radius:6px; font-size:0.75rem; font-weight:800; letter-spacing:0.5px;"><i data-lucide="edit"></i> EDYCJA (DIFF)</span>';
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
                    return `<div class="diff-line"><strong class="diff-key">${k}</strong>: <span class="diff-old">${fmt(Number(oldVal))} PLN</span> <span style="color:var(--text-muted); font-size:0.8rem;"><i data-lucide="arrow-right"></i></span> <span class="diff-new">${fmt(Number(newVal))} PLN</span></div>`;
                }
                return `<div class="diff-line"><strong class="diff-key">${k}</strong>: <span class="diff-old">${JSON.stringify(oldVal)}</span> <span style="color:var(--text-muted); font-size:0.8rem;"><i data-lucide="arrow-right"></i></span> <span class="diff-new">${JSON.stringify(newVal)}</span></div>`;
            })
            .join('');
        contentHtml = `<div class="diff-container">${changesHtml}</div>`;
    } else {
        cardClass = 'action-update';
        actionBadge =
            '<span style="background:rgba(var(--success-rgb),0.15); color:var(--success-hover); padding:4px 10px; border-radius:6px; font-size:0.75rem; font-weight:800; letter-spacing:0.5px;"><i data-lucide="save"></i> ZAPIS / AKTUALIZACJA</span>';
        const price = data.totalBrutto || 0;
        const oldPrice = log.oldData?.totalBrutto || 0;
        if (oldPrice && Math.abs(price - oldPrice) > 0.01) {
            contentHtml = `<div style="font-size:1.2rem; font-weight:800; color:var(--text-primary);"><i data-lucide="banknote"></i> <span style="text-decoration:line-through;color:var(--text-muted);font-size:0.95rem;font-weight:600;">${fmt(oldPrice)}</span> <span style="color:var(--text-muted); font-size:0.9rem; margin:0 4px;"><i data-lucide="arrow-right"></i></span> ${fmt(price)} PLN</div>`;
        } else {
            contentHtml = `<div style="font-size:1.2rem; font-weight:800; color:var(--text-primary);"><i data-lucide="banknote"></i> ${fmt(price)} PLN</div>`;
        }
        if (data.wells)
            contentHtml += `<div style="font-size:0.8rem; color:var(--text-secondary); margin-top:2px;"><i data-lucide="package"></i> ${data.wells.length} studni</div>`;
    }

    const restoreBtnHtml =
        !isDelete && !isDiff
            ? `
        <button class="btn btn-sm btn-secondary restore-btn" onclick="restoreHistorySnapshot('${log.id}')"><i data-lucide="refresh-cw" aria-hidden="true"></i> Przywróć</button>
    `
            : '';

    const buttonsHtml = `
        <div style="display:flex; gap:0.4rem;">
            <button class="btn btn-sm btn-secondary preview-btn" onclick="viewHistorySnapshot('${log.id}')"><i data-lucide="eye" aria-hidden="true"></i> Podgląd</button>
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
                    <i data-lucide="user"></i>‍<i data-lucide="monitor"></i> <strong class="text-primary">${log.userName || 'System'}</strong>
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
        overlay.className = 'modal-overlay';
        overlay.id = 'offer-history-modal';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');

        const historyHtml = logs.map(renderAuditLogEntry).join('');
        const loadMoreHtml =
            logs.length < total
                ? `<div id="audit-load-more-wrap" style="text-align:center; padding:1.5rem 0 0.5rem 0;">
                   <button class="load-more-btn" onclick="loadMoreAuditLogs('studnia_oferta', '${id}', 20)"><i data-lucide="scroll-text"></i> Załaduj starsze zmiany (${total - logs.length} pozostało)</button>
               </div>`
                : '';

        overlay.innerHTML = `
            <style>
                .audit-modal-inner {
                    max-width: 800px; width: 95%; border-radius: 20px; max-height: 90vh; 
                    display: flex; flex-direction: column; background: #0f172a; 
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); border: 1px solid rgba(255, 255, 255, 0.1);
                }
                .audit-card {
                    background: rgba(30, 41, 59, 0.6);
                    border: 1px solid rgba(255, 255, 255, 0.06);
                    border-radius: 16px;
                    padding: 1.25rem 1.5rem;
                    margin-bottom: 1rem;
                    position: relative;
                    overflow: hidden;
                    transition: all 0.2s ease;
                    backdrop-filter: blur(10px);
                }
                .audit-card:hover {
                    background: rgba(30, 41, 59, 0.9);
                    border-color: rgba(255, 255, 255, 0.15);
                    transform: translateY(-2px);
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.15);
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
                    margin-bottom: 1rem; padding-bottom: 0.8rem; border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                }
                .audit-date { font-size: 0.85rem; color: var(--text-secondary); font-weight: 500; }
                .audit-author { font-size: 0.85rem; color: var(--border); display:flex; align-items:center; gap:4px; }
                
                .audit-card-body {
                    display: flex; justify-content: space-between; align-items: center; gap: 1rem;
                }
                
                .diff-container { display: flex; flex-direction: column; gap: 0.4rem; }
                .diff-line { background: rgba(0,0,0,0.2); padding: 0.4rem 0.8rem; border-radius: 6px; font-size: 0.85rem; }
                .diff-key { color: var(--text-primary); font-weight: 600; font-family: monospace; }
                .diff-old { color: var(--text-secondary); text-decoration: line-through; }
                .diff-new { color: var(--success-hover); font-weight: 700; }
                
                .restore-btn, .preview-btn {
                    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); 
                    color: var(--text-primary); padding: 0.5rem 1rem; border-radius: 8px; font-weight: 600;
                    transition: all 0.2s; cursor: pointer; display: flex; align-items: center; gap: 6px;
                }
                .preview-btn:hover { background: rgba(99, 102, 241, 0.15); border-color: rgba(99, 102, 241, 0.3); color: var(--accent-hover); }
                .restore-btn:hover { background: rgba(var(--success-hover-rgb), 0.15); border-color: rgba(var(--success-hover-rgb), 0.3); color: var(--success-hover); }
                
                .load-more-btn {
                    background: rgba(var(--accent-rgb),0.15); border: 1px solid rgba(var(--accent-rgb),0.3); 
                    color: var(--accent-hover); font-weight: 700; padding: 0.6rem 1.5rem; border-radius: 30px;
                    cursor: pointer; transition: all 0.2s;
                }
                .load-more-btn:hover { background: rgba(var(--accent-rgb),0.3); transform: scale(1.05); }
            </style>
            <div class="modal audit-modal-inner">
                <div class="modal-header" style="border-bottom:1px solid rgba(255,255,255,0.1); padding:1.2rem 1.5rem; background: rgba(255,255,255,0.02); border-radius: 20px 20px 0 0;">
                    <h3 style="font-weight:800; color:#fff; margin:0; display:flex; align-items:center; gap:0.5rem;">
                        <span style="font-size:1.4rem;">⌛</span> Oś Czasu Zmian (${total} wpisów)
                    </h3>
                    <button class="btn-icon" aria-label="Zamknij" style="background:rgba(255,255,255,0.1); color:#fff; border-radius:50%; width:32px; height:32px; display:flex; align-items:center; justify-content:center;" onclick="closeModal()"><i data-lucide="x" aria-hidden="true"></i></button>
                </div>
                <div id="audit-logs-container" style="padding:1.5rem; overflow-y:auto; flex:1; scrollbar-width:thin;">
                    ${historyHtml}
                    ${loadMoreHtml}
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        overlay.classList.add('active');
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
                <div id="audit-load-more-wrap" style="text-align:center; padding:1.5rem 0 0.5rem 0;">
                    <button class="load-more-btn" onclick="loadMoreAuditLogs('${entityType}', '${entityId}', ${limit})"><i data-lucide="scroll-text"></i> Załaduj starsze zmiany (${remaining} pozostało)</button>
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
