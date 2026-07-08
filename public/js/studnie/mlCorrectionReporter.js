// @ts-check
/**
 * mlCorrectionReporter.js — wysyła korekty użytkownika do Python AI Backend
 * przez Node proxy (/api/telemetry/ai/override).
 *
 * Cechy:
 * - localStorage queue (retry po reconnect)
 * - correction_id (idempotentny retry)
 * - source/version metadata
 * - sendBeacon przed zamknięciem zakładki
 * - fire-and-forget, nie blokuje UI
 */
(function () {
    'use strict';

    var PROXY_URL = '/api/telemetry/ai/override';
    var TIMEOUT_MS = 2000;
    var QUEUE_KEY = 'ml_correction_queue';
    var MAX_QUEUE_SIZE = 200;
    var QUEUE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dni
    var APP_VERSION =
        (typeof window.APP_VERSION === 'string' ? window.APP_VERSION : '') ||
        (document.querySelector('meta[name="version"]')
            ? document.querySelector('meta[name="version"]').getAttribute('content')
            : '') ||
        'unknown';

    function getQueue() {
        try {
            var raw = localStorage.getItem(QUEUE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    function saveQueue(queue) {
        try {
            localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
        } catch (e) {
            /* localStorage pełny — ignore */
        }
    }

    function removeFromQueue(correctionId) {
        var queue = getQueue();
        var filtered = queue.filter(function (item) {
            return item.correction_id !== correctionId;
        });
        if (filtered.length !== queue.length) {
            saveQueue(filtered);
        }
    }

    function pushToQueue(payload) {
        var queue = getQueue();
        var now = Date.now();
        // Usuń przeterminowane wpisy (TTL)
        queue = queue.filter(function (item) {
            return now - item.created_at < QUEUE_TTL_MS;
        });
        // Limit rozmiaru — usuń najstarsze jeśli przekroczony
        if (queue.length >= MAX_QUEUE_SIZE) {
            queue = queue.slice(queue.length - MAX_QUEUE_SIZE + 1);
        }
        queue.push({
            correction_id: payload.correction_id,
            payload: payload,
            created_at: now
        });
        saveQueue(queue);
    }

    /**
     * Flush: wysyła wszystkie zaległe korekty z kolejki.
     */
    function flushQueue() {
        var queue = getQueue();
        if (queue.length === 0) return;
        var pending = queue.slice();
        pending.forEach(function (entry) {
            safeFetch(PROXY_URL, entry.payload, function () {
                removeFromQueue(entry.correction_id);
            });
        });
    }

    /**
     * Bezpieczny fetch z timeoutem. Po sukcesie wywołuje onSuccess.
     */
    function safeFetch(url, payload, onSuccess) {
        try {
            if (!window.fetch) return;
            var controller = new AbortController();
            var timeoutId = setTimeout(function () {
                controller.abort();
            }, TIMEOUT_MS);
            fetch(url, {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
            })
                .then(function (resp) {
                    clearTimeout(timeoutId);
                    if (resp.ok && typeof onSuccess === 'function') {
                        onSuccess();
                    }
                })
                .catch(function () {
                    clearTimeout(timeoutId);
                });
        } catch (e) {
            /* ignore */
        }
    }

    /**
     * Zgłasza korektę użytkownika do systemu uczącego.
     * Fire-and-forget — nie blokuje UI.
     * Kolejkuje do localStorage przed fetch (odporność na offline).
     *
     * @param {Object} options
     * @param {Array} options.originalConfig - konfiguracja przed zmianą
     * @param {Array} options.finalConfig - konfiguracja po zmianie
     * @param {string} [options.overrideReason] - powód korekty
     * @param {Object} [options.wellParams] - parametry studni
     */
    window.reportCorrection = function (options) {
        if (!options || !options.originalConfig || !options.finalConfig) return;

        var originalConfig = options.originalConfig;
        var finalConfig = options.finalConfig;

        if (!Array.isArray(originalConfig) || !Array.isArray(finalConfig)) return;
        if (originalConfig.length === 0 || finalConfig.length === 0) return;

        var correctionId =
            window.crypto && window.crypto.randomUUID
                ? window.crypto.randomUUID()
                : 'rur_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);

        var payload = {
            schema_version: 1,
            correction_id: correctionId,
            originalConfig: originalConfig,
            finalConfig: finalConfig,
            overrideReason: options.overrideReason || 'user_manual_change',
            source: {
                client: 'web',
                version: APP_VERSION
            },
            wellParams: {
                dn:
                    options.wellParams && options.wellParams.dn != null
                        ? String(options.wellParams.dn)
                        : 'unknown',
                target_height_mm:
                    options.wellParams && options.wellParams.target_height_mm
                        ? Number(options.wellParams.target_height_mm)
                        : undefined,
                height_bucket:
                    options.wellParams && options.wellParams.height_bucket
                        ? options.wellParams.height_bucket
                        : undefined
            }
        };

        // Kolejkuj przed fetch (odporność na zamknięcie/offline)
        pushToQueue(payload);

        // Wyślij natychmiast
        safeFetch(PROXY_URL, payload, function () {
            removeFromQueue(correctionId);
        });
    };

    /**
     * Pomocnik: wyciąga parametry studni dla raportu korekty.
     *
     * @param {Object} well - obiekt studni
     * @returns {Object} { dn, target_height_mm, height_bucket }
     */
    window.getWellParamsForReport = function (well) {
        if (!well) return { dn: 'unknown' };
        var dn = well.dn != null ? String(well.dn) : 'unknown';
        var targetHeightMm = 0;
        if (well.rzednaWlazu != null && well.rzednaDna != null) {
            targetHeightMm = Math.round(
                Math.abs((parseFloat(well.rzednaWlazu) - parseFloat(well.rzednaDna || 0)) * 1000)
            );
        }
        var heightBucket = undefined;
        if (targetHeightMm > 0) {
            if (targetHeightMm <= 3000) heightBucket = 'shallow';
            else if (targetHeightMm <= 6000) heightBucket = 'medium';
            else heightBucket = 'deep';
        }
        return {
            dn: dn,
            target_height_mm: targetHeightMm || undefined,
            height_bucket: heightBucket
        };
    };

    // Flush queue po reconnect
    if (typeof window.addEventListener === 'function') {
        window.addEventListener('online', flushQueue);
    }

    // Przed zamknięciem — wyślij zaległe korekty przez sendBeacon
    if (typeof window.addEventListener === 'function') {
        window.addEventListener('beforeunload', function () {
            var queue = getQueue();
            if (queue.length === 0) return;
            if (typeof navigator.sendBeacon !== 'function') return;
            queue.forEach(function (entry) {
                try {
                    var blob = new Blob([JSON.stringify(entry.payload)], {
                        type: 'application/json'
                    });
                    navigator.sendBeacon(PROXY_URL, blob);
                } catch (e) {
                    /* ignore */
                }
            });
        });
    }

    // Flush na starcie (korekty sprzed odświeżenia)
    if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(flushQueue);
    } else {
        setTimeout(flushQueue, 1000);
    }
})();
