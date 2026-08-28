// @ts-nocheck
/**
 * shareModal.js — modal udostępniania z kafelkową listą użytkowników.
 * Zależności: modalCore.js (showModal/closeModal), shareService.js, escapeHtml, lucide
 */
import { shareService } from './shareService.js';
import { escapeHtml } from './escapeHtml.js';

function escapeAttr(str) {
    if (typeof window.escapeHtmlAttr === 'function' && window.escapeHtmlAttr !== escapeHtml)
        return window.escapeHtmlAttr(str);
    return escapeHtml(String(str ?? ''))
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getInitials(user) {
    const fn = (user.firstName || '').trim();
    const ln = (user.lastName || '').trim();
    if (fn && ln) return (fn[0] + ln[0]).toUpperCase();
    if (fn) return fn.slice(0, 2).toUpperCase();
    return (user.username || '?').slice(0, 2).toUpperCase();
}

function displayName(user) {
    const fn = (user.firstName || '').trim();
    const ln = (user.lastName || '').trim();
    if (fn || ln) return `${fn} ${ln}`.trim();
    return user.username || user.id;
}

function roleLabel(role) {
    if (role === 'admin') return 'ADMIN';
    if (role === 'pro') return 'PRO';
    return 'USER';
}

function roleClass(role) {
    if (role === 'admin') return 'role-admin';
    if (role === 'pro') return 'role-pro';
    return 'role-user';
}
function avatarClass(role) {
    if (role === 'admin') return 'avatar-admin';
    if (role === 'pro') return 'avatar-pro';
    return 'avatar-user';
}

export async function openShareModal(documentType, documentId) {
    const _safeId = escapeHtml(String(documentId));
    const _safeType = escapeHtml(String(documentType));
    // loading modal
    const loadingHtml = `
        <div class="modal modal--share">
            <div class="share-modal-header">
                <h3 id="share-title"><span class="share-icon-avatar" aria-hidden="true"><i data-lucide="share-2"></i></span> Udostępnij</h3>
                <button class="btn-icon btn-close-x" aria-label="Zamknij" onclick="closeModal('share-modal')"><i data-lucide="x"></i></button>
            </div>
            <div class="share-modal-body text-center fs-sm-muted"><span class="share-icon-avatar share-icon-avatar--muted" style="margin:0 auto 0.6rem"><i data-lucide="loader-2" class="lucide-spin"></i></span> Ładowanie użytkowników...</div>
        </div>`;
    const overlay = window.showModal({
        id: 'share-modal',
        titleId: 'share-title',
        html: loadingHtml
    });
    if (window.lucide) window.lucide.createIcons({ root: overlay });

    let users = [];
    let sharesData = { data: [] };
    let canShare = true;
    try {
        const [u, s] = await Promise.all([
            shareService.getShareableUsers(),
            shareService
                .getShares(documentType, documentId)
                .catch(() => ({ data: [], canShare: false }))
        ]);
        users = Array.isArray(u) ? u : [];
        sharesData = s;
        if (typeof s.canShare === 'boolean') canShare = s.canShare;
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Błąd pobierania danych';
        overlay.innerHTML = `
            <div class="modal modal--share">
                <div class="share-modal-header"><h3 id="share-title"><span class="share-icon-avatar" aria-hidden="true"><i data-lucide="share-2"></i></span> Udostępnij</h3><button class="btn-icon btn-close-x" aria-label="Zamknij" onclick="closeModal('share-modal')"><i data-lucide="x"></i></button></div>
                <div class="share-modal-body color-danger">${escapeHtml(msg)}</div>
                <div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal('share-modal')">Zamknij</button></div>
            </div>`;
        if (window.lucide) window.lucide.createIcons({ root: overlay });
        return;
    }

    const sharedIds = new Set((sharesData.data || []).map((s) => s.sharedWithUserId));
    const selected = new Set();

    function renderGrid(filter) {
        const q = (filter || '').toLowerCase().trim();
        const filtered = q
            ? users.filter((u) => {
                  const n = displayName(u).toLowerCase();
                  return (
                      n.includes(q) ||
                      (u.username || '').toLowerCase().includes(q) ||
                      (u.symbol || '').toLowerCase().includes(q)
                  );
              })
            : [...users];
        const roleOrder = { admin: 0, pro: 1, user: 2 };
        filtered.sort((a, b) => {
            const ra = roleOrder[a.role] ?? 99;
            const rb = roleOrder[b.role] ?? 99;
            if (ra !== rb) return ra - rb;
            return displayName(a).localeCompare(displayName(b), 'pl');
        });
        if (filtered.length === 0) {
            return `<div class="share-empty"><span class="share-empty-icon" aria-hidden="true"><i data-lucide="${q ? 'search' : 'users'}"></i></span>${q ? 'Brak wyników dla "' + escapeHtml(filter) + '"' : 'Brak użytkowników do udostępnienia'}</div>`;
        }
        return `<div class="share-grid">${filtered
            .map((u) => {
                const isShared = sharedIds.has(u.id);
                const isSelected = selected.has(u.id);
                const selClass = isSelected || isShared ? ' selected' : '';
                const checkState = isShared
                    ? 'is-shared'
                    : isSelected
                      ? 'is-selected'
                      : 'is-unselected';
                const checkIcon = isShared || isSelected ? 'check' : 'x';
                const checkLabel = isShared
                    ? 'Udostępnione — kliknij by cofnąć'
                    : isSelected
                      ? 'Wybrany — kliknij by odznaczyć'
                      : 'Nie wybrany — kliknij by wybrać';
                return `
                <div class="share-tile${selClass}${isShared ? ' share-tile-shared' : ''}" data-user-id="${escapeAttr(u.id)}" role="button" tabindex="0" aria-pressed="${isShared || isSelected ? 'true' : 'false'}" aria-disabled="false" aria-label="${isShared ? 'Udostępnione — kliknij by cofnąć ' : isSelected ? 'Wybrany — kliknij by odznaczyć ' : 'Udostępnij '}${escapeAttr(displayName(u))}">
                    <div class="share-avatar ${avatarClass(u.role)}">${escapeHtml(getInitials(u))}</div>
                    <div class="share-tile-content">
                        <div class="share-tile-name" title="${escapeAttr(displayName(u))}">${escapeHtml(displayName(u))}</div>
                        <div class="share-tile-sub" title="${escapeAttr(u.username + (u.symbol ? ' — ' + u.symbol : ''))}">@${escapeHtml(u.username)}${u.symbol ? ' — ' + escapeHtml(u.symbol) : ''}</div>
                    </div>
                    <div class="share-tile-right">
                        <span class="header-role-badge ${roleClass(u.role)}">${roleLabel(u.role)}</span>
                        <span class="share-check ${checkState}" aria-hidden="true" aria-label="${checkLabel}"><i data-lucide="${checkIcon}"></i></span>
                    </div>
                </div>`;
            })
            .join('')}</div>`;
    }

    function buildHtml() {
        const countShared = sharedIds.size;
        const countSel = selected.size;
        const alreadyInfo = `<div class="share-already"><span class="share-icon-avatar share-icon-avatar--blue share-icon-avatar--sm" aria-hidden="true"><i data-lucide="users"></i></span> Już udostępnione: ${countShared} użytkownikom</div>`;
        const revokeBtn =
            countShared > 0 && canShare
                ? `<button class="btn btn-danger" id="share-revoke-all"><i data-lucide="user-x"></i> Cofnij wszystkie</button>`
                : '';
        return `
        <div class="modal modal--share">
            <div class="share-modal-header">
                <h3 id="share-title"><span class="share-icon-avatar" aria-hidden="true"><i data-lucide="share-2"></i></span> Udostępnij</h3>
                <button class="btn-icon btn-close-x" aria-label="Zamknij" onclick="closeModal('share-modal')"><i data-lucide="x"></i></button>
            </div>
            ${alreadyInfo}
            <div class="share-search-row">
                <div class="search-box"><i data-lucide="search"></i><input id="share-search" class="form-input" placeholder="Szukaj po imieniu, loginie, symbolu..." aria-label="Szukaj użytkownika" autocomplete="off" /></div>
                <span id="share-counter" class="share-counter">${countSel} / 50</span>
            </div>
            <div id="share-grid-wrap" class="share-modal-body">${renderGrid('')}</div>
            <div class="modal-footer">
                <div class="share-footer-left">${revokeBtn}</div>
                <div class="flex-gap-5">
                    <button class="btn btn-secondary" onclick="closeModal('share-modal')">Anuluj</button>
                    <button class="btn btn-primary" id="share-confirm" ${countSel === 0 || !canShare ? 'disabled' : ''}><i data-lucide="share-2"></i> Udostępnij${countSel ? ' (' + countSel + ')' : ''}</button>
                </div>
            </div>
            ${!canShare ? '<div class="share-already color-warn"><span class="share-icon-avatar share-icon-avatar--sm" style="background:rgba(var(--warn-rgb),0.12);border-color:rgba(var(--warn-rgb),0.2);color:var(--warn)" aria-hidden="true"><i data-lucide="alert-triangle"></i></span> Brak uprawnień do udostępniania tego dokumentu</div>' : ''}
        </div>`;
    }

    overlay.innerHTML = buildHtml();
    if (window.lucide) window.lucide.createIcons({ root: overlay });

    const searchInput = overlay.querySelector('#share-search');
    const gridWrap = overlay.querySelector('#share-grid-wrap');
    const counterEl = overlay.querySelector('#share-counter');
    const confirmBtn = overlay.querySelector('#share-confirm');

    function updateCounter() {
        if (counterEl) counterEl.textContent = `${selected.size} / 50`;
        if (confirmBtn) {
            confirmBtn.disabled = selected.size === 0 || !canShare;
            confirmBtn.innerHTML = `<i data-lucide="share-2"></i> Udostępnij${selected.size ? ' (' + selected.size + ')' : ''}`;
            if (window.lucide) window.lucide.createIcons({ root: confirmBtn });
        }
    }

    function syncSharedHeader() {
        const info = overlay.querySelector('.share-already');
        const countShared = sharedIds.size;
        if (info) {
            info.innerHTML = `<span class="share-icon-avatar share-icon-avatar--blue share-icon-avatar--sm" aria-hidden="true"><i data-lucide="users"></i></span> Już udostępnione: ${countShared} użytkownikom`;
            info.style.display = '';
            if (window.lucide) window.lucide.createIcons({ root: info });
        }
        const bulkBtn = overlay.querySelector('#share-revoke-all');
        if (bulkBtn) bulkBtn.style.display = countShared > 0 && canShare ? '' : 'none';
    }

    async function revokeOne(uid) {
        try {
            await shareService.revokeByUsers(documentType, documentId, [uid]);
            sharedIds.delete(uid);
            selected.delete(uid);
            sharesData.data = (sharesData.data || []).filter((s) => s.sharedWithUserId !== uid);
            const filteredQ = searchInput ? searchInput.value : '';
            if (gridWrap) {
                gridWrap.innerHTML = renderGrid(filteredQ);
                if (window.lucide) window.lucide.createIcons({ root: gridWrap });
            }
            syncSharedHeader();
            updateCounter();
            if (typeof window.showToast === 'function')
                window.showToast('Cofnięto udostępnienie', 'success');
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Błąd cofania';
            if (typeof window.showToast === 'function') window.showToast(msg, 'error');
        }
    }

    function onTileClick(e) {
        const revokeBtnEl = e.target.closest('.share-revoke');
        if (revokeBtnEl) {
            e.stopPropagation();
            const uid = revokeBtnEl.getAttribute('data-revoke-id');
            if (uid) revokeOne(uid);
            return;
        }
        const tile = e.target.closest('.share-tile');
        if (!tile) return;
        const uid = tile.getAttribute('data-user-id');
        if (!uid) return;
        if (tile.classList.contains('share-tile-shared')) {
            if (canShare) revokeOne(uid);
            return;
        }
        if (selected.has(uid)) selected.delete(uid);
        else selected.add(uid);
        const filteredQ = searchInput ? searchInput.value : '';
        if (gridWrap) {
            gridWrap.innerHTML = renderGrid(filteredQ);
            if (window.lucide) window.lucide.createIcons({ root: gridWrap });
        }
        updateCounter();
    }
    gridWrap?.addEventListener('click', onTileClick);
    gridWrap?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onTileClick(e);
        }
    });

    searchInput?.addEventListener('input', () => {
        if (gridWrap) {
            gridWrap.innerHTML = renderGrid(searchInput.value);
            if (window.lucide) window.lucide.createIcons({ root: gridWrap });
        }
    });
    // focus search
    setTimeout(() => searchInput?.focus(), 50);

    confirmBtn?.addEventListener('click', async () => {
        if (selected.size === 0) return;
        confirmBtn.disabled = true;
        confirmBtn.innerHTML =
            '<i data-lucide="loader-2" class="lucide-spin"></i> Udostępnianie...';
        if (window.lucide) window.lucide.createIcons({ root: confirmBtn });
        try {
            await shareService.createShares(documentType, documentId, [...selected]);
            if (typeof window.showToast === 'function')
                window.showToast(`Udostępniono ${selected.size} użytkownikom`, 'success');
            window.closeModal('share-modal');
            // odśwież Kartotekę jeśli dostępna
            if (window.kartotekaUI && typeof window.kartotekaUI.refresh === 'function')
                window.kartotekaUI.refresh();
            else if (typeof window.loadOffers === 'function') window.loadOffers();
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Błąd udostępniania';
            if (typeof window.showToast === 'function') window.showToast(msg, 'error');
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = `<i data-lucide="share-2"></i> Udostępnij (${selected.size})`;
            if (window.lucide) window.lucide.createIcons({ root: confirmBtn });
        }
    });

    overlay.querySelector('#share-revoke-all')?.addEventListener('click', async () => {
        if (!confirm('Cofnąć wszystkie udostępnienia tego dokumentu?')) return;
        try {
            const ids = [...sharedIds];
            await shareService.revokeByUsers(documentType, documentId, ids);
            if (typeof window.showToast === 'function')
                window.showToast('Cofnięto udostępnienia', 'success');
            sharedIds.clear();
            sharesData.data = [];
            const filteredQ = searchInput ? searchInput.value : '';
            if (gridWrap) {
                gridWrap.innerHTML = renderGrid(filteredQ);
                if (window.lucide) window.lucide.createIcons({ root: gridWrap });
            }
            syncSharedHeader();
            updateCounter();
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Błąd cofania';
            if (typeof window.showToast === 'function') window.showToast(msg, 'error');
        }
    });
}

if (typeof window !== 'undefined') {
    window.openShareModal = openShareModal;
    window.shareModal = { open: openShareModal };
}
export default { open: openShareModal };
