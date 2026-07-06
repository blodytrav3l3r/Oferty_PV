/**
 * AI Dashboard (admin) — wizualizacja bazy wiedzy, rekomendacji i statystyk.
 *
 * Łączy się z /api/telemetry/ai/* oraz /api/learning/preferences
 * i przedstawia wyniki w formie kart statystycznych + listy wzorców + panelu preferencji.
 *
 * Bez żadnego wpływu na solver JS — to viewer.
 */

(function () {
    'use strict';

    const ENDPOINTS = {
        stats: '/api/telemetry/ai/knowledge/stats',
        patterns: '/api/telemetry/ai/knowledge/patterns',
        runCycle: '/api/telemetry/ai/learning/run',
        status: '/api/telemetry/ai/learning/status',
        preferences: '/api/learning/preferences'
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

    function escapeHtml(str) {
        if (typeof str !== 'string') return String(str || '');
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return str.replace(/[&<>"']/g, function (m) { return map[m]; });
    }

    function confidenceColor(c) {
        c = c || 0;
        return c >= 0.7 ? '#22c55e' : c >= 0.4 ? '#f59e0b' : '#94a3b8';
    }

    function makeBadge(text, bg) {
        return '<span style="display:inline-block;background:' + (bg || '#6366f1') +
            ';color:#fff;padding:1px 8px;border-radius:10px;font-size:0.7rem;font-weight:600">' +
            escapeHtml(text) + '</span>';
    }

    function statCard(title, value, color) {
        return (
            '<div style="background:#16192a;border:1px solid rgba(100,116,139,0.2);border-radius:8px;padding:12px;text-align:center">' +
            '<div style="font-size:1.5rem;font-weight:600;color:' + (color || '#6366f1') + '">' + value + '</div>' +
            '<div style="font-size:0.85rem;color:#94a3b8;margin-top:4px">' + escapeHtml(title) + '</div>' +
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
            '<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(140px, 1fr));gap:12px;margin-bottom:16px">' +
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
                ? '<div style="background:#16192a;border-radius:8px;padding:12px;margin-bottom:16px">' +
                    '<h3 style="margin-top:0;font-size:0.95rem">Rozkład wg typu</h3>' +
                    Object.entries(stats.byPatternType)
                        .map(function (kv) {
                            return (
                                '<div style="display:flex;justify-content:space-between;border-bottom:1px solid rgba(100,116,139,0.15);padding:6px 0">' +
                                '<span>' + escapeHtml(kv[0]) + '</span>' +
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
        if (!dnFilter) dnFilter = 'all_dn';
        const url = ENDPOINTS.patterns + '?dn=' + encodeURIComponent(dnFilter) + '&minConfidence=0.1';
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
                'Brak wzorców dla DN=' + escapeHtml(dnFilter) + '. Uruchom <code>Learning cycle</code>.' +
                '</div>';
            return;
        }
        var currentExpanded = null;
        const html =
            '<div style="color:#94a3b8;font-size:0.75rem;margin-bottom:8px">Znaleziono ' + data.items.length + ' wzorców (min confidence ≥0.1)</div>' +
            '<table style="width:100%;border-collapse:collapse;color:#e2e8f0;font-size:0.85rem">' +
            '<thead><tr style="background:#1e2238;color:#94a3b8">' +
            '<th style="padding:6px;text-align:left;width:130px">Typ</th>' +
            '<th style="padding:6px;text-align:left">Pattern</th>' +
            '<th style="padding:6px;text-align:right;width:80px">Confidence</th>' +
            '<th style="padding:6px;text-align:right;width:50px">Hits</th>' +
            '<th style="padding:6px;text-align:left">Opis</th>' +
            '</tr></thead><tbody>' +
            data.items
                .map(function (p, idx) {
                    var rowId = 'ai-pattern-row-' + idx;
                    var detailId = 'ai-pattern-detail-' + idx;
                    var confPct = Math.round((p.confidence || 0) * 100);
                    var rec = p.recommendation ? JSON.stringify(p.recommendation, null, 2) : null;
                    return (
                        '<tr id="' + rowId + '" style="border-bottom:1px solid rgba(100,116,139,0.15);cursor:pointer" ' +
                        'onclick="var d=document.getElementById(\'' + detailId + '\');if(d){d.style.display=d.style.display===\'none\'?\'\':\'none\'}">' +
                        '<td style="padding:6px">' + makeBadge(p.patternType) + '</td>' +
                        '<td style="padding:6px;font-family:monospace;font-size:0.72rem;word-break:break-all">' + escapeHtml((p.patternKey || '').slice(0, 60)) + '</td>' +
                        '<td style="padding:6px;text-align:right;color:' + confidenceColor(p.confidence) + ';font-weight:600">' + confPct + '%</td>' +
                        '<td style="padding:6px;text-align:right">' + (p.hitCount || 0) + '</td>' +
                        '<td style="padding:6px;color:#94a3b8;font-size:0.75rem">' + escapeHtml((p.description || '').slice(0, 80)) + '</td>' +
                        '</tr>' +
                        '<tr id="' + detailId + '" style="display:none;background:#1a1d2e">' +
                        '<td colspan="5" style="padding:10px;border-bottom:1px solid rgba(100,116,139,0.15)">' +
                        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:0.82rem">' +
                        '<div><strong style="color:#94a3b8">DN:</strong> ' + escapeHtml(p.dn || '-') + '</div>' +
                        '<div><strong style="color:#94a3b8">Status:</strong> ' + escapeHtml(p.status || 'active') + '</div>' +
                        '<div><strong style="color:#94a3b8">Success:</strong> ' + (p.successCount || 0) + '</div>' +
                        '<div><strong style="color:#94a3b8">Rejection:</strong> ' + (p.rejectionCount || 0) + '</div>' +
                        (rec ? '<div style="grid-column:1/-1"><strong style="color:#94a3b8">Rekomendacja:</strong><pre style="background:#121422;padding:8px;border-radius:4px;font-size:0.72rem;margin-top:4px;overflow-x:auto">' + escapeHtml(rec) + '</pre></div>' : '') +
                        '</div>' +
                        '</td>' +
                        '</tr>'
                    );
                })
                .join('') +
            '</tbody></table>';
        container.innerHTML = html;
    }

    async function renderPreferences(container, dn) {
        var prefsContainer = container;
        var url = ENDPOINTS.preferences + '?dn=' + encodeURIComponent(dn || '1000');
        var data = await fetchJson(url);
        if (!data) {
            prefsContainer.innerHTML =
                '<div style="color:#94a3b8;text-align:center;padding:20px">Brak danych preferencji</div>';
            return;
        }
        var confPct = Math.round((data.confidence || 0) * 100);
        var ringBonusHtml = data.ringHeightBonus && Object.keys(data.ringHeightBonus).length > 0
            ? Object.entries(data.ringHeightBonus)
                .map(function (kv) { return '<div>' + kv[0] + 'mm: <span style="color:' + (kv[1] < 0 ? '#22c55e' : '#ef4444') + '">' + kv[1] + '</span></div>'; })
                .join('')
            : '<div style="color:#64748b;font-style:italic">Brak danych</div>';

        var denyBonusesHtml = data.dennicaBonus && Object.keys(data.dennicaBonus).length > 0
            ? Object.entries(data.dennicaBonus)
                .map(function (kv) { return '<div>' + escapeHtml(kv[0]) + ': <span style="color:' + (kv[1] < 0 ? '#22c55e' : '#ef4444') + '">' + kv[1] + '</span></div>'; })
                .join('')
            : '<div style="color:#64748b;font-style:italic">Brak danych</div>';

        prefsContainer.innerHTML =
            '<div style="background:#16192a;border:1px solid rgba(100,116,139,0.2);border-radius:8px;padding:12px">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' +
            '<h3 style="margin:0;font-size:0.95rem">Preferencje scoringowe dla DN' + escapeHtml(String(dn)) + '</h3>' +
            '<span style="font-size:0.82rem;color:' + confidenceColor(data.confidence) + '">Confidence: ' + confPct + '%</span>' +
            '</div>' +
            (data.warnings && data.warnings.length > 0
                ? '<div style="background:#2d1f0e;border:1px solid #d97706;border-radius:6px;padding:8px;margin-bottom:10px;font-size:0.82rem;color:#fbbf24">' +
                    data.warnings.map(function (w) { return '<div>' + escapeHtml(w) + '</div>'; }).join('') +
                    '</div>'
                : '') +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;font-size:0.85rem">' +
            '<div>' +
            '<h4 style="margin:0 0 6px 0;color:#94a3b8;font-size:0.82rem">🎯 Bonus wysokości kręgów</h4>' +
            ringBonusHtml +
            '</div>' +
            '<div>' +
            '<h4 style="margin:0 0 6px 0;color:#94a3b8;font-size:0.82rem">🏗️ Bonus dennic</h4>' +
            denyBonusesHtml +
            '</div>' +
            '<div>' +
            '<h4 style="margin:0 0 6px 0;color:#94a3b8;font-size:0.82rem">🔧 Konus bonus</h4>' +
            '<span style="color:' + (data.konusBonus < -500000 ? '#22c55e' : '#f59e0b') + ';font-weight:600">' + data.konusBonus + '</span>' +
            '</div>' +
            '<div>' +
            '<h4 style="margin:0 0 6px 0;color:#94a3b8;font-size:0.82rem">🚫 Unikane produkty</h4>' +
            (data.avoidProductIds && data.avoidProductIds.length > 0
                ? data.avoidProductIds.map(function (pid) { return '<div style="color:#ef4444;font-size:0.78rem">' + escapeHtml(pid) + '</div>'; }).join('')
                : '<div style="color:#64748b;font-style:italic">Brak</div>') +
            '</div>' +
            '<div>' +
            '<h4 style="margin:0 0 6px 0;color:#94a3b8;font-size:0.82rem">⭐ Preferowane produkty</h4>' +
            (data.preferProductIds && data.preferProductIds.length > 0
                ? data.preferProductIds.map(function (pid) { return '<div style="color:#22c55e;font-size:0.78rem">' + escapeHtml(pid) + '</div>'; }).join('')
                : '<div style="color:#64748b;font-style:italic">Brak</div>') +
            '</div>' +
            '<div>' +
            '<h4 style="margin:0 0 6px 0;color:#94a3b8;font-size:0.82rem">📐 Profile bonuses</h4>' +
            (data.profileBonuses && data.profileBonuses.length > 0
                ? data.profileBonuses.slice(0, 3).map(function (pb) {
                    return '<div style="font-size:0.75rem;margin-bottom:4px;padding:4px;background:#1e2238;border-radius:4px">' +
                        'Pattern: [' + (pb.pattern || []).join(', ') + '] → <span style="color:' + (pb.bonus < 0 ? '#22c55e' : '#ef4444') + '">' + pb.bonus + '</span></div>';
                  }).join('')
                : '<div style="color:#64748b;font-style:italic">Brak</div>') +
            '</div>' +
            '</div>' +
            '<div style="margin-top:10px;font-size:0.72rem;color:#64748b;border-top:1px solid rgba(100,116,139,0.15);padding-top:8px">' +
            'Ostatnia aktualizacja: ' + (data.timeApplied ? new Date(data.timeApplied).toLocaleString('pl-PL') : '-') +
            '</div>' +
            '</div>';
    }

    function renderStatus(container) {
        fetchJson(ENDPOINTS.status).then(function (status) {
            if (!status) {
                container.innerHTML = '<span style="color:#ef4444">Status: błąd</span>';
                return;
            }
            var lastRun = status.lastRunAt
                ? new Date(status.lastRunAt).toLocaleString('pl-PL')
                : 'nigdy';
            container.innerHTML =
                '<div style="display:flex;gap:16px;align-items:center;font-size:0.82rem;color:#94a3b8">' +
                '<span>Status: <span style="color:' + (status.initialized ? '#22c55e' : '#f59e0b') + ';font-weight:600">' +
                (status.initialized ? '✅ Aktywny' : '⏳ Nieaktywny') + '</span></span>' +
                '<span>Ostatnie uruchomienie: <strong style="color:#e2e8f0">' + escapeHtml(lastRun) + '</strong></span>' +
                '</div>';
        });
    }

    /**
     * Punkt wejścia: renderuje dashboard wewnątrz `#ai-dashboard-container`.
     */
    window.aiDashboardRender = async function (containerId) {
        var container = document.getElementById(containerId);
        if (!container) return;

        var currentDn = '1000';

        container.innerHTML =
            '<div style="display:grid;grid-template-columns:1fr;gap:16px">' +
            '<div id="ai-status-bar" style="margin-bottom:4px"></div>' +
            '<div id="ai-stats"></div>' +
            '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px">' +
            '<input type="text" id="ai-dn-filter" value="' + currentDn + '" placeholder="DN (np. 1200)" ' +
            'style="background:#1e2238;border:1px solid rgba(100,116,139,0.3);color:#e2e8f0;padding:6px 12px;border-radius:4px;font-size:0.85rem;width:100px">' +
            '<button id="ai-filter-btn" style="background:#6366f1;color:#fff;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-size:0.85rem">🔍 Filtruj wzorce</button>' +
            '<button id="ai-pref-btn" style="background:#8b5cf6;color:#fff;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-size:0.85rem">📊 Pokaż preferencje</button>' +
            '<button id="ai-run-cycle" style="background:#10b981;color:#0f172a;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-weight:600;font-size:0.85rem">⚡ Uruchom Learning Cycle</button>' +
            '</div>' +
            '<div id="ai-preferences"></div>' +
            '<div id="ai-patterns"></div>' +
            '</div>';

        renderStatus(document.getElementById('ai-status-bar'));
        await renderStats(document.getElementById('ai-stats'));
        await renderPatterns(document.getElementById('ai-patterns'), currentDn);

        var filterBtn = document.getElementById('ai-filter-btn');
        var prefBtn = document.getElementById('ai-pref-btn');
        var runBtn = document.getElementById('ai-run-cycle');
        var dnInput = document.getElementById('ai-dn-filter');

        if (filterBtn && dnInput) {
            filterBtn.addEventListener('click', function () {
                currentDn = dnInput.value || '1000';
                var patternsContainer = document.getElementById('ai-patterns');
                if (patternsContainer) patternsContainer.innerHTML = '<div style="color:#94a3b8;padding:10px">Ładowanie...</div>';
                void renderPatterns(patternsContainer, currentDn);
            });
        }

        if (prefBtn && dnInput) {
            prefBtn.addEventListener('click', function () {
                currentDn = dnInput.value || '1000';
                var prefsContainer = document.getElementById('ai-preferences');
                if (prefsContainer) prefsContainer.innerHTML = '<div style="color:#94a3b8;padding:10px">Ładowanie preferencji...</div>';
                void renderPreferences(prefsContainer, currentDn);
            });
        }

        if (runBtn) {
            runBtn.addEventListener('click', async function () {
                runBtn.disabled = true;
                runBtn.textContent = 'Uruchamianie...';
                var result = await fetchJson(ENDPOINTS.runCycle, { method: 'POST' });
                runBtn.disabled = false;
                runBtn.textContent = '⚡ Uruchom Learning Cycle';
                if (result) {
                    window.alert(
                        'Learning cycle zakończony:\n' +
                        'Przetworzone: ' + result.processed +
                        '\nWykrytych wzorców: ' + result.patternsDetected +
                        '\nZapisanych do KB: ' + result.persistedToKb
                    );
                    renderStatus(document.getElementById('ai-status-bar'));
                    await renderStats(document.getElementById('ai-stats'));
                    await renderPatterns(document.getElementById('ai-patterns'), currentDn);
                }
            });
        }
    };
})();
