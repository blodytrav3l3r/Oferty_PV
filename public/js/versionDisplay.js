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
        var versionEl = document.getElementById('app-version-toolbar');

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
                // Wstrzykujemy wersję do elementu — format "vX.Y.Z"
                if (data && data.version) {
                    versionEl.innerHTML = 'v' + data.version;
                } else {
                    versionEl.innerHTML = 'v—';
                }
            })
            .catch(function () {
                // W przypadku błędu (np. serwer nie odpowiada) wyświetlamy "v—"
                versionEl.innerHTML = 'v—';
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
