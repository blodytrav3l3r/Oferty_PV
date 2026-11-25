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
 * - rekord ma wersję i termin ważności (5 dni), więc stary format jest ignorowany,
 * - nic nie jest przywracane automatycznie: link wymaga kliknięcia.
 */
(function () {
    'use strict';

    var KEY_PREFIX = 'sok_last_route_v1_';
    var SCHEMA_VERSION = 1;
    var TTL_MS = 5 * 24 * 60 * 60 * 1000;
    /** Parametry panelu/modału — nie opisują trasy, nie zapisujemy ich. */
    var TRANSIENT = ['panel', 'pvtype', 'version', 'against', 'tab', 'newOffer'];
    var LABELS = {
        rury: 'Oferty Rury',
        studnie: 'Oferty Studnie',
        kartoteka: 'Kartoteka',
        zlecenia: 'Zlecenia',
        cennik: 'Cennik',
        pulpit: 'Pulpit'
    };

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
            var updatedAt = Date.parse(parsed.updatedAt);
            var expiresAt = Date.parse(parsed.expiresAt);
            var normalized = normalizeHash(parsed.hash);
            if (
                !isNaN(updatedAt) &&
                updatedAt + TTL_MS > now &&
                !isNaN(expiresAt) &&
                expiresAt > now &&
                normalized === parsed.hash
            )
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

    /** @param {object} [user] */
    function clear(user) {
        var userId = user && (user.id === 0 || user.id) ? String(user.id) : resolveUserId();
        if (!userId) return;
        try {
            window.localStorage.removeItem(KEY_PREFIX + userId);
        } catch (_e) {}
    }

    /** @param {object} [opts] {now?} */
    function sweepExpired(opts) {
        var now = opts && typeof opts.now === 'number' ? opts.now : Date.now();
        var keys = [];
        try {
            for (var i = 0; i < window.localStorage.length; i++) {
                var key = window.localStorage.key(i);
                if (typeof key === 'string' && key.indexOf(KEY_PREFIX) === 0) keys.push(key);
            }
        } catch (_e) {
            return 0;
        }
        var removed = 0;
        keys.forEach(function (key) {
            var userId = key.slice(KEY_PREFIX.length);
            if (userId && get({ id: userId }, { now: now }) === null) removed++;
        });
        return removed;
    }

    window.lastRoute = {
        KEY_PREFIX: KEY_PREFIX,
        TTL_MS: TTL_MS,
        save: save,
        get: get,
        sweepExpired: sweepExpired,
        clear: clear,
        normalizeHash: normalizeHash
    };

    function sweepExpiredRoutes() {
        sweepExpired();
    }

    sweepExpiredRoutes();
    if (typeof window.setInterval === 'function') window.setInterval(sweepExpiredRoutes, 60 * 1000);
    if (typeof window.addEventListener === 'function') {
        window.addEventListener('pageshow', sweepExpiredRoutes);
        window.addEventListener('focus', sweepExpiredRoutes);
    }

    // Trasa zapisana także przy opuszczaniu strony: pierwsza nawigacja bywa
    // szybsza niż ustalenie sesji, więc bez tego pojedyncza wizyta w module
    // nie zostawiłaby karty „Wróć do…" na pulpicie.
    try {
        window.addEventListener('pagehide', function () {
            save(window.location.hash);
        });
    } catch (_ePH) {}
})();
