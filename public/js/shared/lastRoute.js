// @ts-check
/**
 * Opcja A: „ostatnia trasa" — powrót do miejsca, w którym użytkownik pracował.
 *
 * Draft (`resumeDrafts`) odzyskuje NIEZAPISANE zmiany. Ten moduł pamięta samą
 * trasę, więc powrót działa także wtedy, gdy dokument był czysty i draftu nie ma.
 * Zapis wyłącznie lokalny (`localStorage`, per-user) — zero backendu.
 *
 * Kontrakt:
 * - zapisujemy tylko trasy znanych modułów SPA, bez parametrów przejściowych,
 * - rekord ma wersję i termin ważności (30 dni), więc stary format jest ignorowany,
 * - nic nie jest przywracane automatycznie: link wymaga kliknięcia.
 */
(function () {
    'use strict';

    var KEY_PREFIX = 'sok_last_route_v1_';
    var SCHEMA_VERSION = 1;
    var TTL_MS = 30 * 24 * 60 * 60 * 1000;
    var CONTAINER_ID = 'last-route';
    /** Parametry panelu/modału — nie opisują trasy, nie zapisujemy ich. */
    var TRANSIENT = ['panel', 'pvtype', 'version', 'against', 'tab'];
    var LABELS = {
        rury: 'Oferty Rury',
        studnie: 'Oferty Studnie',
        kartoteka: 'Kartoteka',
        zlecenia: 'Zlecenia'
    };

    /** @param {string} s @returns {string} */
    function esc(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /** @returns {string|null} */
    function resolveUserId() {
        try {
            var u = /** @type {any} */ (window).currentUser;
            if (u && (u.id === 0 || u.id)) return String(u.id);
        } catch (_e0) {}
        try {
            var raw = window.sessionStorage.getItem('user');
            if (!raw) return null;
            var parsed = JSON.parse(raw);
            if (parsed && (parsed.id === 0 || parsed.id)) return String(parsed.id);
        } catch (_e1) {}
        return null;
    }

    /**
     * Normalizuje hash: tylko znany moduł, tylko stabilne parametry.
     * @param {string} hash
     * @returns {string|null}
     */
    function normalizeHash(hash) {
        if (typeof hash !== 'string') return null;
        var raw = hash.trim();
        if (raw.indexOf('#/') !== 0) return null;
        var parts = raw.slice(2).split('?');
        var module = (parts[0] || '').split('/')[0];
        if (!LABELS[module]) return null;
        var params = new URLSearchParams(parts[1] || '');
        var kept = [];
        TRANSIENT.forEach(function (name) {
            params.delete(name);
        });
        params.forEach(function (value, name) {
            if (!/^[A-Za-z0-9_-]{1,64}$/.test(name)) return;
            if (typeof value !== 'string' || value.length > 128) return;
            kept.push(encodeURIComponent(name) + '=' + encodeURIComponent(value));
        });
        return '#/' + module + (kept.length ? '?' + kept.join('&') : '');
    }

    /** @param {string} hash @returns {string} */
    function labelFor(hash) {
        var module = hash.slice(2).split('?')[0].split('/')[0];
        var label = LABELS[module] || 'Moduł';
        if (hash.indexOf('?edit=') !== -1 || hash.indexOf('?order=') !== -1)
            return label + ' — ostatni dokument';
        return label;
    }

    /**
     * Zapisuje ostatnią trasę (best-effort; brak miejsca/magazynu nie rzuca).
     * @param {string} hash
     * @returns {boolean}
     */
    function save(hash) {
        try {
            var userId = resolveUserId();
            if (!userId) return false;
            var normalized = normalizeHash(hash);
            if (!normalized) return false;
            var now = Date.now();
            var record = {
                v: SCHEMA_VERSION,
                hash: normalized,
                updatedAt: new Date(now).toISOString(),
                expiresAt: new Date(now + TTL_MS).toISOString()
            };
            window.localStorage.setItem(KEY_PREFIX + userId, JSON.stringify(record));
            return true;
        } catch (_e) {
            return false;
        }
    }

    /**
     * Odczyt ostatniej trasy. Uszkodzone/wygasłe/niezgodne rekordy są usuwane.
     * @param {object} [user]
     * @param {object} [opts] {now?}
     * @returns {{hash: string, label: string, updatedAt: string}|null}
     */
    function get(user, opts) {
        var userId = user && (user.id === 0 || user.id) ? String(user.id) : resolveUserId();
        if (!userId) return null;
        var key = KEY_PREFIX + userId;
        var now = opts && typeof opts.now === 'number' ? opts.now : Date.now();
        var raw = null;
        try {
            raw = window.localStorage.getItem(key);
        } catch (_e0) {
            return null;
        }
        if (!raw) return null;
        var parsed = null;
        try {
            parsed = JSON.parse(raw);
        } catch (_e1) {
            parsed = null;
        }
        var valid =
            parsed &&
            parsed.v === SCHEMA_VERSION &&
            typeof parsed.hash === 'string' &&
            typeof parsed.updatedAt === 'string' &&
            typeof parsed.expiresAt === 'string';
        if (valid) {
            var expiresAt = Date.parse(parsed.expiresAt);
            var normalized = normalizeHash(parsed.hash);
            if (!isNaN(expiresAt) && expiresAt > now && normalized === parsed.hash)
                return {
                    hash: parsed.hash,
                    label: labelFor(parsed.hash),
                    updatedAt: parsed.updatedAt
                };
        }
        try {
            window.localStorage.removeItem(key);
        } catch (_e2) {}
        return null;
    }

    /**
     * Renderuje kartę „Wróć do…" przed siatką modułów. Brak rekordu → brak karty.
     * @param {object} [user]
     */
    function render(user) {
        try {
            if (typeof document === 'undefined' || !document.body) return;
            var host = document.querySelector('.launch-grid');
            var existing = document.getElementById(CONTAINER_ID);
            var record = get(user);
            if (!record) {
                if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
                return;
            }
            if (!host) return;
            var box = existing;
            if (!box) {
                box = document.createElement('div');
                box.id = CONTAINER_ID;
                box.className = 'last-route';
                if (host.parentNode) host.parentNode.insertBefore(box, host);
            }
            box.innerHTML =
                '<span class="last-route-label">Wróć do: <strong>' +
                esc(record.label) +
                '</strong></span>' +
                '<a class="btn btn-sm btn-secondary" href="app.html' +
                esc(record.hash) +
                '">Otwórz</a>';
        } catch (_e) {}
    }

    /** @param {object} [user] */
    function clear(user) {
        var userId = user && (user.id === 0 || user.id) ? String(user.id) : resolveUserId();
        if (!userId) return;
        try {
            window.localStorage.removeItem(KEY_PREFIX + userId);
        } catch (_e) {}
    }

    window.lastRoute = {
        KEY_PREFIX: KEY_PREFIX,
        TTL_MS: TTL_MS,
        save: save,
        get: get,
        render: render,
        clear: clear,
        normalizeHash: normalizeHash
    };

    // Trasa zapisana także przy opuszczaniu strony: pierwsza nawigacja bywa
    // szybsza niż ustalenie sesji, więc bez tego pojedyncza wizyta w module
    // nie zostawiłaby karty „Wróć do…" na pulpicie.
    try {
        window.addEventListener('pagehide', function () {
            save(window.location.hash);
        });
    } catch (_ePH) {}
})();
