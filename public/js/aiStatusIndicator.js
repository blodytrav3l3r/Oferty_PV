/**
 * aiStatusIndicator.js — wskaźnik AI w górnym pasku (app.html).
 * Pobiera status pipeline'u ML z /api/telemetry/ai/ml-status i aktualizuje badge
 * obok nazwy użytkownika. Działa niezależnie od iframe modułów — badge jest
 * widoczny i świeży od pierwszego załadowania aplikacji.
 */

(function () {
    'use strict';

    const STATUS_URL = '/api/telemetry/ai/ml-status';
    const KNOWLEDGE_URL = '/api/telemetry/ai/knowledge/stats';
    const POLL_INTERVAL_MS = 30000;
    const KNOWLEDGE_THROTTLE_MS = 60000;

    let badge = null;
    let dot = null;
    let text = null;
    let _lastFetch = 0;
    let _lastKnowledgeFetch = 0;

    function getElements() {
        if (badge && dot && text) return true;
        badge = document.getElementById('ai-status-indicator');
        dot = document.getElementById('ai-status-dot');
        text = document.getElementById('ai-status-text');
        return !!(badge && dot && text);
    }

    function updateFromStatus(status) {
        if (!getElements()) return;

        if (status) {
            const pct = status.aiInfluencePct || 0;
            const model = status.modelVersion || '?';
            const date = status.activeModelCreatedAt
                ? status.activeModelCreatedAt.slice(0, 10)
                : '?';

            if (status.mlOnline) {
                dot.style.background = pct > 0 ? 'var(--success)' : 'var(--slate-500)';
                text.textContent = 'AI ' + pct + '% · ' + model + ' · ' + date;
                text.title =
                    (pct > 0
                        ? 'AI ranking aktywny (' + pct + '%)'
                        : 'AI online, tryb shadow (0%) — tylko obserwacja') +
                    ' | model: ' +
                    model +
                    (status.activeModelAuc != null
                        ? ' (AUC ' + Number(status.activeModelAuc).toFixed(4) + ')'
                        : '') +
                    ' | utworzony: ' +
                    date +
                    ' | ranking: ' +
                    (status.rankingVersion || '?') +
                    ' | feat: ' +
                    (status.featureVersion || '?');
            } else {
                dot.style.background = 'var(--slate-400)';
                dot.style.boxShadow = 'none';
                text.textContent = 'AI Offline';
                text.title = 'Brak wytrenowanego modelu ML — ranking techniczny';
            }

            badge.style.visibility = 'visible';
        }
    }

    function fetchKnowledgeStatusAsync() {
        const now = Date.now();
        if (now - _lastKnowledgeFetch < KNOWLEDGE_THROTTLE_MS) return;
        _lastKnowledgeFetch = now;
        try {
            fetch(KNOWLEDGE_URL, { headers: authHeaders(), credentials: 'same-origin' })
                .then(function (response) {
                    return response.ok ? response.json() : null;
                })
                .then(function (stats) {
                    if (!getElements() || !stats) return;
                    const existing = text.title || '';
                    text.title =
                        existing.split('\n')[0] +
                        '\nWzorce AI: ' +
                        (stats.active || 0) +
                        ' aktywnych, ' +
                        (stats.total || 0) +
                        ' total' +
                        '\nConfidence: ' +
                        (stats.avgConfidence ? Math.round(stats.avgConfidence * 100) + '%' : '—') +
                        '\nRekomendacje: ' +
                        (stats.acceptedRecommendations || 0) +
                        '/' +
                        (stats.totalRecommendations || 0) +
                        ' zaakc.';
                })
                .catch(function () {
                    /* ignoruj */
                });
        } catch (_e) {
            /* ignoruj */
        }
    }

    function poll() {
        const now = Date.now();
        if (now - _lastFetch < POLL_INTERVAL_MS) return;
        _lastFetch = now;
        try {
            fetch(STATUS_URL, { headers: authHeaders(), credentials: 'same-origin' })
                .then(function (response) {
                    return response.ok ? response.json() : null;
                })
                .then(function (status) {
                    updateFromStatus(status);
                    fetchKnowledgeStatusAsync();
                })
                .catch(function () {
                    /* ignoruj — backend niedostępny */
                });
        } catch (_e) {
            /* ignoruj */
        }
    }

    function init() {
        if (!getElements()) return;
        poll();
        setInterval(poll, POLL_INTERVAL_MS);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
