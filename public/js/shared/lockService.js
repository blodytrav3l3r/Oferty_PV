// @ts-check
/* ===== TWARDA BLOKADA EDYCJI (doc_locks) =====
 * 1 dokument = 1 uzytkownik. Prawda po stronie serwera; frontend tylko
 * acquire przy otwarciu, heartbeat co 60 s, release przy zamknieciu.
 * Detekcja konfliktu wylacznie strukturalna (status 423 / DOC_LOCKED).
 */

const LOCK_HEARTBEAT_MS = 60000;

/** Aktualnie trzymana blokada albo null. */
let _held = null;
/** Timer heartbeat albo null. */
let _hbTimer = null;
/** beforeunload zarejestrowany raz. */
let _unloadWired = false;

function _esc(s) {
    if (typeof window !== 'undefined' && typeof window.escapeHtml === 'function')
        return window.escapeHtml(s);
    return String(s ?? '');
}

function _headers() {
    if (typeof window !== 'undefined' && typeof window.authHeaders === 'function')
        return window.authHeaders();
    return { 'Content-Type': 'application/json' };
}

/**
 * Wzbogaca blad o status/code/holder z body odpowiedzi.
 * @param {Response} res
 * @param {any} data
 * @returns {Error & {status?: number, code?: string, holder?: object}}
 */
function _lockError(res, data) {
    const err = /** @type {Error & {status?: number, code?: string, holder?: object}} */ (
        new Error((data && data.error) || 'Dokument jest edytowany przez innego użytkownika')
    );
    err.status = res.status;
    if (data) {
        err.code = data.code;
        if (data.holder) err.holder = data.holder;
    }
    return err;
}

async function _post(path, body) {
    const res = await fetch(path, {
        method: 'POST',
        headers: _headers(),
        body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw _lockError(res, data);
    return data;
}

/**
 * Czy blad oznacza konflikt blokady? Tylko status/code, nigdy tekst.
 * @param {unknown} err
 * @returns {boolean}
 */
function isDocLocked(err) {
    if (!err || typeof err !== 'object') return false;
    const e = /** @type {{status?: unknown, code?: unknown}} */ (err);
    return e.status === 423 || e.code === 'DOC_LOCKED';
}

/** Imie posiadacza + czas do modala (tylko niezbedne dane). */
function describeHolder(holder) {
    const name = (holder && holder.userName) || 'inny użytkownik';
    let when = '';
    try {
        if (holder && holder.lockedAt) when = new Date(holder.lockedAt).toLocaleString();
    } catch (_e) {
        when = '';
    }
    return { name, when };
}

function _stopHeartbeat() {
    if (_hbTimer) {
        clearInterval(_hbTimer);
        _hbTimer = null;
    }
}

function _wireUnloadOnce() {
    if (_unloadWired || typeof window === 'undefined' || !window.addEventListener) return;
    _unloadWired = true;
    window.addEventListener('beforeunload', function () {
        if (!_held) return;
        const body = JSON.stringify({ docType: _held.docType, docId: _held.docId });
        try {
            if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
                const blob = new Blob([body], { type: 'application/json' });
                navigator.sendBeacon('/api/locks/release', blob);
                return;
            }
        } catch (_e) {
            /* fallback nizej */
        }
        try {
            fetch('/api/locks/release', {
                method: 'POST',
                headers: _headers(),
                body,
                keepalive: true
            }).catch(function () {});
        } catch (_e) {
            /* best-effort */
        }
    });
}

async function _heartbeatTick() {
    if (!_held) {
        _stopHeartbeat();
        return;
    }
    try {
        await _post('/api/locks/heartbeat', { docType: _held.docType, docId: _held.docId });
    } catch (_e) {
        // Blokada utracona w trakcie edycji: formularz zostaje (ochrona danych),
        // zapis i tak odrzuci backend (423). Uzytkownik dostaje jeden toast.
        _stopHeartbeat();
        if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
            window.showToast('Utracono blokadę edycji — zapis może być niemożliwy', 'warning');
            if (window.lucide) window.lucide.createIcons();
        }
    }
}

/**
 * Przejmuje blokade dokumentu. Rzuca strukturalny 423 przy konflikcie.
 * Poprzednia blokada zwalniana DOPIERO po udanym acquire (nieudany
 * acquire nie rusza starego locka — formularz z niezapisanymi zmianami
 * zostaje chroniony).
 * @param {string} docType offer|offer_studnie|order_rury|order_studnie
 * @param {string} docId
 * @returns {Promise<object>} { lock } lub { already: true }
 */
async function acquireLock(docType, docId) {
    if (_held && _held.docType === docType && _held.docId === docId) return { already: true };
    const data = await _post('/api/locks/acquire', { docType, docId });
    await releaseLock();
    _held = { docType, docId };
    _stopHeartbeat();
    _hbTimer = setInterval(_heartbeatTick, LOCK_HEARTBEAT_MS);
    _wireUnloadOnce();
    return data;
}

/** Zwalnia trzymana blokade (idempotentne, best-effort). */
async function releaseLock() {
    _stopHeartbeat();
    if (!_held) return { ok: true, released: false };
    const body = { docType: _held.docType, docId: _held.docId };
    _held = null;
    try {
        return await _post('/api/locks/release', body);
    } catch (_e) {
        return { ok: true, released: false };
    }
}

/**
 * Force-przejecie admina (JEDEN upsert po stronie serwera, bez okna wyscigu).
 * @param {string} docType
 * @param {string} docId
 */
async function forceLock(docType, docId) {
    const data = await _post('/api/locks/force', { docType, docId });
    _held = { docType, docId };
    _stopHeartbeat();
    _hbTimer = setInterval(_heartbeatTick, LOCK_HEARTBEAT_MS);
    _wireUnloadOnce();
    return data;
}

/** Aktualnie trzymana blokada albo null. */
function currentLock() {
    return _held;
}

/**
 * Zwalnia blokade konkretnego dokumentu (sprzatanie po usunieciu, wyjscia).
 * Trzymany lock zwalniany tylko przy zgodnosci; obcy wiersz czyszczony
 * best-effort dla podanego docId (serwer usuwa tylko wlasny/wygasly).
 */
async function releaseOf(docType, docId) {
    if (_held && _held.docType === docType && (!docId || _held.docId === docId))
        return releaseLock();
    if (!docId) return { ok: true, released: false };
    try {
        return await _post('/api/locks/release', { docType, docId });
    } catch (_e) {
        return { ok: true, released: false };
    }
}

/**
 * Modal 423: calkowity zakaz otwarcia. Przyciski: Spróbuj ponownie /
 * Wróć do listy (+ Przejmij dla admina). Bez "otwórz mimo blokady".
 */
function showDocLockedModal(opts) {
    const holder = describeHolder(opts && opts.holder);
    const isAdmin = !!(
        (opts && opts.isAdmin) ||
        (typeof currentUser !== 'undefined' && currentUser && currentUser.role === 'admin')
    );
    const title = 'Dokument edytowany przez innego użytkownika';
    const bodyHtml =
        '<p><strong>' +
        _esc(holder.name) +
        '</strong>' +
        (holder.when ? ' od ' + _esc(holder.when) : '') +
        ' edytuje ten dokument.</p>' +
        '<p>Nie można otworzyć go do edycji. Spróbuj ponownie później.</p>';

    if (typeof window !== 'undefined' && typeof window.showModal === 'function') {
        const overlay = window.showModal({
            id: 'doc-locked-modal',
            title,
            titleId: 'doc-locked-title',
            html:
                '<div class="modal"><div class="modal-header">' +
                '<h3 id="doc-locked-title"><i data-lucide="lock" aria-hidden="true"></i> ' +
                _esc(title) +
                '</h3>' +
                '<button type="button" class="btn-icon" aria-label="Zamknij" data-act="back"><i data-lucide="x" aria-hidden="true"></i></button>' +
                '</div><div class="modal-body">' +
                bodyHtml +
                '</div><div class="modal-footer">' +
                '<button type="button" class="btn btn-secondary" data-act="back"><i data-lucide="arrow-left" aria-hidden="true"></i> Wróć do listy</button>' +
                (isAdmin
                    ? '<button type="button" class="btn btn-danger" data-act="force"><i data-lucide="shield-alert" aria-hidden="true"></i> Przejmij</button>'
                    : '') +
                '<button type="button" class="btn btn-primary" data-act="retry"><i data-lucide="refresh-cw" aria-hidden="true"></i> Spróbuj ponownie</button>' +
                '</div></div>'
        });
        const close = function () {
            if (typeof window.closeModal === 'function') window.closeModal('doc-locked-modal');
            else if (overlay && overlay.remove) overlay.remove();
        };
        overlay.addEventListener('click', function (e) {
            const btn = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
            if (!btn) return;
            const act = btn.getAttribute('data-act');
            close();
            if (act === 'retry' && opts && typeof opts.onRetry === 'function') opts.onRetry();
            else if (act === 'back' && opts && typeof opts.onBack === 'function') opts.onBack();
            else if (act === 'force' && opts && typeof opts.onForce === 'function') opts.onForce();
        });
        if (window.lucide) window.lucide.createIcons({ root: overlay });
        return;
    }
    // Fallback: appConfirm (2 przyciski) — bez opcji Przejmij.
    if (typeof window !== 'undefined' && typeof window.appConfirm === 'function') {
        const tmp = document.createElement('div');
        tmp.innerHTML = bodyHtml;
        window
            .appConfirm('<strong>' + _esc(title) + '</strong><br>' + tmp.innerHTML, {
                allowHtml: true,
                okText: 'Spróbuj ponownie',
                cancelText: 'Wróć do listy'
            })
            .then(function (ok) {
                if (ok && opts && typeof opts.onRetry === 'function') opts.onRetry();
                else if (!ok && opts && typeof opts.onBack === 'function') opts.onBack();
            });
    }
}

/**
 * Straznik otwarcia w 1 linii: acquire albo modal 423 (formularz nietkniety).
 * Nie-423 (np. brak sieci) przepuszcza — zapis chronia 409/423 backendu.
 * @param {string} docType
 * @param {string} docId
 * @param {function} retryFn ponowne wywolanie otwierajacej funkcji
 * @returns {Promise<boolean>} true = mozna edytowac
 */
async function tryOpen(docType, docId, retryFn) {
    try {
        await acquireLock(docType, docId);
        return true;
    } catch (err) {
        if (!isDocLocked(err)) {
            if (typeof console !== 'undefined' && console.warn)
                console.warn('[lockService] acquire nieudany, otwieram bez blokady:', err);
            return true;
        }
        const holder = /** @type {{holder?: object}} */ (err).holder;
        showDocLockedModal({
            holder,
            onRetry: function () {
                if (typeof retryFn === 'function') retryFn();
            },
            onForce: function () {
                forceLock(docType, docId)
                    .then(function () {
                        if (typeof retryFn === 'function') retryFn();
                    })
                    .catch(function () {
                        if (typeof window.showToast === 'function')
                            window.showToast('Nie udało się przejąć blokady', 'error');
                    });
            },
            onBack: function () {}
        });
        return false;
    }
}

window.lockService = {
    acquire: acquireLock,
    release: releaseLock,
    releaseOf,
    force: forceLock,
    current: currentLock,
    tryOpen,
    isLocked: isDocLocked,
    describeHolder,
    showLockedModal: showDocLockedModal,
    HEARTBEAT_MS: LOCK_HEARTBEAT_MS
};
