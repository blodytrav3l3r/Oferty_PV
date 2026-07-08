(function () {
    'use strict';

    var POLL_INTERVAL = 30000;
    var HEALTH_URL = 'http://' + window.location.hostname + ':8000/api/v1/health';
    var pollTimer = null;

    var STATES = {
        checking: { cls: 'checking', title: 'Sprawdzanie serwera obliczeniowego...' },
        online: { cls: 'online', title: 'Serwer obliczeniowy online' },
        offline: { cls: 'offline', title: 'Serwer obliczeniowy offline' }
    };

    function setState(state) {
        var container = document.getElementById('backend-status-indicator');
        if (!container) return;
        var dot = container.querySelector('span');
        if (dot) {
            dot.className = 'dot ' + state.cls;
        }
        container.title = state.title;
    }

    async function checkBackendStatus() {
        try {
            var res = await fetchWithTimeout(HEALTH_URL, {}, 5000);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            var data = await res.json();
            if (data && data.status === 'ok') {
                setState(STATES.online);
            } else {
                throw new Error('Invalid response');
            }
        } catch (e) {
            setState(STATES.offline);
        }
    }

    function startBackendPolling() {
        setState(STATES.checking);
        checkBackendStatus();
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = setInterval(checkBackendStatus, POLL_INTERVAL);
    }

    function stopBackendPolling() {
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
    }

    window.checkBackendStatus = checkBackendStatus;
    window.startBackendPolling = startBackendPolling;
    window.stopBackendPolling = stopBackendPolling;
})();
