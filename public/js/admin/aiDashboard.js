/**
 * AI Dashboard (admin) — wizualizacja bazy wiedzy, rekomendacji i statystyk.
 *
 * Łączy się z /api/telemetry/learning/* oraz /api/telemetry/recommendations/*
 * i przedstawia wyniki w formie kart statystycznych + listy wzorców.
 *
 * Bez żadnego wpływu na solver JS — to viewer.
 */

(function () {
    'use strict';

    const ENDPOINTS = {
        stats: '/api/telemetry/knowledge/stats',
        patterns: '/api/telemetry/knowledge/patterns',
        recommendations: '/api/telemetry/recommendations/',
        runCycle: '/api/telemetry/learning/run',
        status: '/api/telemetry/learning/status'
    };

    async function fetchJson(url, options) {
        if (!window.fetch) return null;
        try {
            const resp = await fetch(url, Object.assign(
                { credentials: 'same-origin' },
                options || {}
            ));
            if (!resp.ok) return null;
            return await resp.json();
        } catch (e) {
            return null;
        }
    }

    function statCard(title, value, color) {
        return (
            '<div style="background:#16192a;border:1px solid rgba(100,116,139,0.2);border-radius:8px;padding:12px;text-align:center">' +
            '<div style="font-size:1.5rem;font-weight:600;color:' + (color || '#6366f1') + '">' + value + '</div>' +
            '<div style="font-size:0.85rem;color:#94a3b8;margin-top:4px">' + title + '</div>' +
            '</div>'
        );
    }

    async function renderStats(container) {
        const stats = await fetchJson(ENDPOINTS.stats);
        if (!stats) {
            container.innerHTML =
                '<div style="background:#2d1616;border:1px solid #ef4444;border-radius:8px;padding:12px;color:#fca5a5">' +
                'Brak dostępu do statystyk (wymagana rola admin)' +
                '</div>';
            return;
        }
        const html =
            '<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(140px, 1fr));gap:12px;margin-bottom:20px">' +
            statCard('Wzorce łącznie', stats.total, '#6366f1') +
            statCard('Aktywne', stats.active, '#10b981') +
            statCard('Avg confidence', Math.round((stats.avgConfidence || 0) * 100) + '%', '#f59e0b') +
            statCard('Rekomendacje', stats.totalRecommendations, '#8b5cf6') +
            statCard('Zaakceptowane', stats.acceptedRecommendations, '#22c55e') +
            statCard('Odrzucone', stats.rejectedRecommendations, '#ef4444') +
            statCard('Nowe (7 dni)', stats.recentDetected, '#06b6d4') +
            statCard('Archiwalne', stats.archived, '#64748b') +
            '</div>' +
            (stats.byPatternType
                ? '<div style="background:#16192a;border-radius:8px;padding:12px;margin-bottom:20px">' +
                    '<h3 style="margin-top:0">Rozkład wg typu</h3>' +
                    Object.entries(stats.byPatternType)
                        .map(function (kv) {
                            return (
                                '<div style="display:flex;justify-content:space-between;border-bottom:1px solid rgba(100,116,139,0.15);padding:6px 0">' +
                                '<span>' + kv[0] + '</span>' +
                                '<strong>' + kv[1] + '</strong>' +
                                '</div>'
                            );
                        })
                        .join('') +
                    '</div>'
                : '');
        container.innerHTML = html;
    }

    async function renderPatterns(container, dnFilter) {
        const url = ENDPOINTS.patterns + '?dn=' + encodeURIComponent(dnFilter || 'all_dn') + '&minConfidence=0.3';
        const data = await fetchJson(url);
        if (!data) {
            container.innerHTML =
                '<div style="color:#94a3b8;text-align:center;padding:20px">' +
                'Brak wzorców (lub brak dostępu)' +
                '</div>';
            return;
        }
        if (!data.items || data.items.length === 0) {
            container.innerHTML =
                '<div style="color:#94a3b8;text-align:center;padding:20px">' +
                'Brak wzorców dla DN=' + (dnFilter || 'all_dn') + '. Uruchom <code>Learning cycle</code>.' +
                '</div>';
            return;
        }
        const html =
            '<table style="width:100%;border-collapse:collapse;color:#e2e8f0;font-size:0.85rem">' +
            '<thead><tr style="background:#1e2238;color:#94a3b8">' +
            '<th style="padding:6px;text-align:left">Typ</th>' +
            '<th style="padding:6px;text-align:left">Pattern</th>' +
            '<th style="padding:6px;text-align:right">Confidence</th>' +
            '<th style="padding:6px;text-align:right">Hits</th>' +
            '<th style="padding:6px;text-align:left">Opis</th>' +
            '</tr></thead><tbody>' +
            data.items
                .map(function (p) {
                    return (
                        '<tr style="border-bottom:1px solid rgba(100,116,139,0.15)">' +
                        '<td style="padding:6px"><code style="background:#1e2238;padding:2px 6px;border-radius:4px;font-size:0.75rem">' + p.patternType + '</code></td>' +
                        '<td style="padding:6px;font-family:monospace;font-size:0.72rem">' + (p.patternKey || '').slice(0, 50) + '</td>' +
                        '<td style="padding:6px;text-align:right;color:' + (p.confidence >= 0.7 ? '#22c55e' : p.confidence >= 0.4 ? '#f59e0b' : '#94a3b8') + '">' + Math.round((p.confidence || 0) * 100) + '%</td>' +
                        '<td style="padding:6px;text-align:right">' + (p.hitCount || 0) + '</td>' +
                        '<td style="padding:6px;color:#94a3b8;font-size:0.75rem">' + (p.description || '').slice(0, 80) + '</td>' +
                        '</tr>'
                    );
                })
                .join('') +
            '</tbody></table>';
        container.innerHTML = html;
    }

    /**
     * Punkt wejścia: renderuje dashboard wewnątrz `#ai-dashboard-container`.
     */
    window.aiDashboardRender = async function (containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML =
            '<div style="display:grid;grid-template-columns:1fr;gap:20px">' +
            '<div id="ai-stats"></div>' +
            '<div style="display:flex;gap:8px;align-items:center;margin-bottom:10px">' +
            '<input type="text" id="ai-dn-filter" placeholder="DN filter (np. 1200)" style="background:#1e2238;border:1px solid rgba(100,116,139,0.3);color:#e2e8f0;padding:6px 12px;border-radius:4px;font-size:0.85rem">' +
            '<button id="ai-filter-btn" style="background:#6366f1;color:#fff;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-size:0.85rem">Filtruj</button>' +
            '<button id="ai-run-cycle" style="background:#10b981;color:#0f172a;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-weight:600;font-size:0.85rem">Uruchom Learning Cycle</button>' +
            '</div>' +
            '<div id="ai-patterns"></div>' +
            '</div>';

        await renderStats(document.getElementById('ai-stats'));
        await renderPatterns(document.getElementById('ai-patterns'));

        const filterBtn = document.getElementById('ai-filter-btn');
        const runBtn = document.getElementById('ai-run-cycle');
        const dnInput = document.getElementById('ai-dn-filter');

        if (filterBtn && dnInput) {
            filterBtn.addEventListener('click', function () {
                void renderPatterns(document.getElementById('ai-patterns'), dnInput.value || '');
            });
        }

        if (runBtn) {
            runBtn.addEventListener('click', async function () {
                runBtn.disabled = true;
                runBtn.textContent = 'Uruchamianie...';
                const result = await fetchJson(ENDPOINTS.runCycle, { method: 'POST' });
                runBtn.disabled = false;
                runBtn.textContent = 'Uruchom Learning Cycle';
                if (result) {
                    window.alert(
                        'Learning cycle zakończony:\n' +
                            'Przetworzone: ' +
                            result.processed +
                            '\nWykrytych wzorców: ' +
                            result.patternsDetected +
                            '\nZapisanych do KB: ' +
                            result.persistedToKb
                    );
                    await renderStats(document.getElementById('ai-stats'));
                    await renderPatterns(document.getElementById('ai-patterns'));
                }
            });
        }
    };
})();
