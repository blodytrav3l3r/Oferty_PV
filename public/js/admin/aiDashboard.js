(function () {
    'use strict';

    // Slim orchestrator — reszta w aiDashboardCore.js + aiDashboardMl.js (ADR-008)
    // Kolejność ładowania w index.html: aiDashboardCore → aiDashboardMl → aiDashboard (ten plik)

    function getEndpoints() {
        return (
            window.AI_ENDPOINTS || {
                wellSelections: '/api/telemetry/ai/well-selections'
            }
        );
    }

    function renderWellSelections(container) {
        const loading = window.aiLoadingHtml
            ? window.aiLoadingHtml()
            : '<div class="ai-ml-loading">Ładowanie...</div>';
        const errHtml =
            window.aiApiErrorHtml ||
            function () {
                return '<div class="ai-ml-error">Błąd</div>';
            };
        container.innerHTML = loading;
        const p = window.fetchJson(getEndpoints().wellSelections);
        if (!p) {
            container.innerHTML = errHtml('server');
            return;
        }
        p.then(function (data) {
            if (!data || data.error) {
                container.innerHTML = errHtml(data && data.error ? data.error : 'server');
                return;
            }
            const items = data.items || [];
            if (items.length === 0) {
                container.innerHTML =
                    '<div class="card-note card-note--with-icon"><i data-lucide="wand-2"></i><span>Brak studni dobranych przez AI. Gdy AI zmieni wynik doboru, studnia pojawi się tutaj.</span></div>';
                if (typeof lucide !== 'undefined') lucide.createIcons({ root: container });
                return;
            }
            const shown = items.slice(0, 20);
            const rows = shown
                .map(function (w, i) {
                    let lastSeen = '—';
                    if (w.lastSeenAt) {
                        const d = new Date(w.lastSeenAt);
                        if (!isNaN(d.getTime())) lastSeen = d.toLocaleString('pl-PL');
                    }
                    return (
                        '<tr>' +
                        '<td style="color:var(--text-muted);font-size: var(--fs-sm)">' +
                        (i + 1) +
                        '</td>' +
                        '<td style="font-family:monospace;font-size: var(--fs-base);color:var(--accent-text)">' +
                        window.escapeHtml(w.dn || '—') +
                        '</td>' +
                        '<td style="color:var(--text-primary)">' +
                        window.escapeHtml(w.warehouse || '—') +
                        '</td>' +
                        '<td class="rury-col-num-inline">' +
                        (w.count || 0) +
                        '</td>' +
                        '<td style="color:var(--text-muted);font-size: var(--fs-sm);white-space:nowrap">' +
                        window.escapeHtml(lastSeen) +
                        '</td>' +
                        '</tr>'
                    );
                })
                .join('');
            const statCard =
                window.aiStatCard ||
                function (t, v) {
                    return '<div>' + t + ':' + v + '</div>';
                };
            container.innerHTML =
                '<div style="background:var(--bg-card);border:1px solid var(--border-glass);border-radius:var(--radius-md);padding:12px">' +
                '<h4 class="ai-section-title"><i data-lucide="wand-2"></i> Studnie dobrane przez AI</h4>' +
                '<div class="ai-toolbar">' +
                statCard(
                    'Studnie (AI)',
                    data.totalWells || 0,
                    'var(--accent)',
                    'Liczba studni, w których AI zmieniło wynik doboru elementów'
                ) +
                statCard(
                    'Wszystkie dobory (AI)',
                    data.totalSelections || 0,
                    'var(--success)',
                    'Łączna liczba rekordów telemetrii z nadpisaniem przez AI'
                ) +
                '</div>' +
                '<div class="ai-table-wrap">' +
                '<table class="ai-table">' +
                '<thead><tr>' +
                '<th scope="col">Lp</th>' +
                '<th scope="col" title="Średnica nominalna studni">DN</th>' +
                '<th scope="col" title="Magazyn / zakład produkcyjny">Magazyn</th>' +
                '<th scope="col" class="text-right" title="Liczba rekordów telemetrii z nadpisaniem przez AI">Liczba rekordów</th>' +
                '<th scope="col" title="Kiedy AI ostatnio zmieniło dobór dla tej studni">Ostatnio użyto</th>' +
                '</tr></thead><tbody>' +
                rows +
                '</tbody></table></div>' +
                (items.length > shown.length
                    ? '<div style="font-size: var(--fs-sm);color:var(--text-muted);text-align:right;margin-top:6px">Pokazano ' +
                      shown.length +
                      ' z ' +
                      items.length +
                      ' studni</div>'
                    : '') +
                '</div>';
            if (typeof lucide !== 'undefined') lucide.createIcons({ root: container });
        }).catch(function () {
            container.innerHTML = errHtml('server');
        });
    }

    window.aiDashboardRender = function (containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML =
            '<div style="display:grid;grid-template-columns:1fr;gap:16px">' +
            '<div id="ai-learning-section">' +
            '<h4 class="ai-section-title"><i data-lucide="brain"></i> Learning Engine (baza wiedzy)</h4>' +
            '<div id="ai-stats"></div>' +
            '<div class="ai-toolbar">' +
            '<input type="text" id="ai-dn-filter" class="ai-filter-input" placeholder="DN (np. 1200)">' +
            '<button id="ai-filter-btn" class="ai-btn" title="Filtruj wzorce po \u015brednicy nominalnej (DN)"><i data-lucide="filter"></i> Filtruj</button>' +
            '<button id="ai-run-cycle" class="ai-btn ai-btn-primary" title="Uruchamia cykl uczenia — analizuje dane telemetryczne i wykrywa nowe wzorce"><i data-lucide="refresh-cw"></i> Uruchom Learning Cycle</button>' +
            '</div>' +
            '<div id="ai-patterns"></div>' +
            '</div>' +
            '<div class="ai-divider" role="separator"></div>' +
            '<div id="ai-ml-section"><div id="ai-ml-status"></div><div id="ai-feature-importance"></div></div>' +
            '<div class="ai-divider" role="separator"></div>' +
            '<div id="ai-well-selections-section"><div id="ai-well-selections"></div></div>' +
            '</div>';

        if (window.aiRenderStats) window.aiRenderStats(document.getElementById('ai-stats'));
        if (window.aiRenderMlStatus)
            window.aiRenderMlStatus(document.getElementById('ai-ml-status'));
        if (window.aiRenderFeatureImportance)
            window.aiRenderFeatureImportance(document.getElementById('ai-feature-importance'));
        renderWellSelections(document.getElementById('ai-well-selections'));
        if (window.aiRenderPatterns)
            window.aiRenderPatterns(document.getElementById('ai-patterns'));

        const filterBtn = document.getElementById('ai-filter-btn');
        const runBtn = document.getElementById('ai-run-cycle');
        const dnInput = document.getElementById('ai-dn-filter');
        const patternsContainer = document.getElementById('ai-patterns');
        const statsContainer = document.getElementById('ai-stats');
        if (filterBtn && dnInput) {
            filterBtn.addEventListener('click', function () {
                if (window.aiRenderPatterns)
                    window.aiRenderPatterns(patternsContainer, dnInput.value || '');
            });
        }
        if (runBtn) {
            runBtn.addEventListener('click', function () {
                runBtn.disabled = true;
                runBtn.innerHTML =
                    '<i data-lucide="loader" class="lucide-spin"></i> Uruchamianie...';
                const eps = window.AI_ENDPOINTS || getEndpoints();
                const p = window.fetchJson(eps.runCycle, { method: 'POST' });
                if (p) {
                    p.then(function (result) {
                        runBtn.disabled = false;
                        runBtn.innerHTML =
                            '<i data-lucide="refresh-cw"></i> Uruchom Learning Cycle';
                        const alertFn =
                            window.aiUiAlert ||
                            window.appAlert ||
                            window.parent?.appAlert ||
                            function (m, o) {
                                const fn = window.appConfirm || window.parent?.appConfirm;
                                if (typeof fn === 'function')
                                    return fn(m, { ...(o || {}), hideCancel: true }).then(
                                        function () {}
                                    );
                                return Promise.resolve();
                            };
                        if (result && !result.error) {
                            alertFn(
                                'Learning cycle zakończony:\nPrzetworzone: ' +
                                    result.processed +
                                    '\nWykrytych wzorców: ' +
                                    result.patternsDetected +
                                    '\nZapisanych do KB: ' +
                                    result.persistedToKb,
                                { title: 'Learning Cycle', type: 'info' }
                            );
                            if (window.aiRenderStats) window.aiRenderStats(statsContainer);
                            if (window.aiRenderPatterns)
                                window.aiRenderPatterns(
                                    patternsContainer,
                                    dnInput ? dnInput.value : ''
                                );
                        } else {
                            alertFn('Nie udało się uruchomić Learning Cycle.', {
                                title: 'Learning Cycle',
                                type: 'warning'
                            });
                        }
                    }).catch(function () {
                        runBtn.disabled = false;
                        runBtn.innerHTML =
                            '<i data-lucide="refresh-cw"></i> Uruchom Learning Cycle';
                    });
                } else {
                    runBtn.disabled = false;
                    runBtn.innerHTML = '<i data-lucide="refresh-cw"></i> Uruchom Learning Cycle';
                }
            });
        }
        if (typeof lucide !== 'undefined') lucide.createIcons({ root: container });
    };
})();
