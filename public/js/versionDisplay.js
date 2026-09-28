/**
 * versionDisplay.js — wyświetlanie wersji aplikacji w interfejsie użytkownika.
 * Pobiera wersję z endpointu /api/version i wstrzykuje do elementu #app-version-toolbar.
 */

(function () {
    'use strict';

    /**
     * Główna funkcja inicjalizująca — wywoływana po załadowaniu DOM.
     */
    function initVersionDisplay() {
        // Referencja do elementu, w którym wyświetlimy wersję
        const versionEl = document.getElementById('app-version-toolbar');

        // Jeśli element nie istnieje, nie ma co robić
        if (!versionEl) {
            return;
        }

        // Pobieramy wersję z endpointu API
        fetch('/api/version')
            .then(function (response) {
                // Sprawdzamy czy odpowiedź jest poprawna
                if (!response.ok) {
                    throw new Error('Odpowiedź serwera: ' + response.status);
                }
                return response.json();
            })
            .then(function (data) {
                // Wstrzykujemy wersję do elementu — format "vX.Y.Z" (textContent: brak HTML, P2 hardening SEC-01)
                if (data && data.version) {
                    versionEl.textContent = 'v' + data.version;
                } else {
                    versionEl.textContent = 'v—';
                }
            })
            .catch(function () {
                // W przypadku błędu (np. serwer nie odpowiada) wyświetlamy "v—"
                versionEl.textContent = 'v—';
            });
    }

    // Uruchamiamy po pełnym załadowaniu DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initVersionDisplay);
    } else {
        // DOM już załadowany — wykonaj od razu
        initVersionDisplay();
    }
})();

/* ===== Aktywne cenniki w pasku górnym (obok wersji aplikacji) =====
 * Osobny blok — nie rusza initVersionDisplay ani #app-version-toolbar.
 * Format: „Rury vN · Studnie vM" (labelki z /labels, max seq per typ);
 * brak wersji → „brak aktywnego cennika" (muted); niezalogowany → cisza.
 * Zero nowego CSS: istniejące .header-version + .text-muted. */
(function () {
    'use strict';

    var TYPES = ['rury', 'studnie'];
    var TYPE_LABELS = { rury: 'Rury', studnie: 'Studnie' };

    function pvHeaders() {
        try {
            return typeof window.authHeaders === 'function' ? window.authHeaders() : {};
        } catch (_e) {
            return {};
        }
    }

    /* Zwraca aktywną wersję typu (max seq) albo null (brak) albo
     * undefined (niezalogowany/brak dostępu — pasek ma zniknąć). */
    async function fetchActiveVersion(type) {
        var res = await fetch('/api/pricelist-versions/labels?type=' + type, {
            headers: pvHeaders()
        });
        if (res.status === 401 || res.status === 403) return undefined;
        if (!res.ok) throw new Error('HTTP ' + res.status);
        var json = await res.json();
        var best = null;
        ((json && json.versions) || []).forEach(function (v) {
            if (!best || (v.seq || 0) > (best.seq || 0)) best = v;
        });
        return best;
    }

    async function initPricelistTopbar() {
        var anchor = document.getElementById('app-version-toolbar');
        if (!anchor || document.getElementById('app-pricelists-toolbar')) return;
        var el = document.createElement('span');
        el.id = 'app-pricelists-toolbar';
        el.className = 'header-version header-versions-stack text-muted';
        anchor.insertAdjacentElement('afterend', el);
        var parts = [];
        try {
            for (var i = 0; i < TYPES.length; i++) {
                var v = await fetchActiveVersion(TYPES[i]);
                if (v === undefined) {
                    el.remove();
                    return;
                }
                if (v) parts.push(TYPE_LABELS[TYPES[i]] + ' ' + v.version);
            }
        } catch (_e) {
            el.remove();
            return;
        }
        // textContent per linia: brak HTML (jak wersja aplikacji wyżej).
        el.title = 'Aktywne cenniki';
        if (parts.length === 0) {
            el.textContent = 'brak aktywnego cennika';
            return;
        }
        for (var j = 0; j < parts.length; j++) {
            var line = document.createElement('span');
            line.textContent = parts[j];
            el.appendChild(line);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPricelistTopbar);
    } else {
        initPricelistTopbar();
    }
})();
