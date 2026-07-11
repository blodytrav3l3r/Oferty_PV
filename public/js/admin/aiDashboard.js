(function () {
    'use strict';

    /* ===== ENDPOINTY (poprawione — dodano /ai/) ===== */
    var ENDPOINTS = {
        stats: '/api/telemetry/ai/knowledge/stats',
        patterns: '/api/telemetry/ai/knowledge/patterns',
        recommendations: '/api/telemetry/ai/recommendations/',
        runCycle: '/api/telemetry/ai/learning/run',
        status: '/api/telemetry/ai/learning/status',
        mlStatus: '/api/telemetry/ai/ml-status',
        models: '/api/telemetry/ai/models',
        train: '/api/telemetry/ai/train',
        rollback: '/api/telemetry/ai/rollback'
    };

    function fetchJson(url, options) {
        if (!window.fetch) return null;
        try {
            var resp = fetch(url, Object.assign({ credentials: 'same-origin' }, options || {}));
            return resp
                .then(function (r) {
                    if (!r.ok) return null;
                    return r.json();
                })
                .catch(function () {
                    return null;
                });
        } catch (e) {
            return null;
        }
    }

    /* ===== HELPER: karta statystyczna ===== */
    function statCard(title, value, color) {
        return (
            '<div class="ai-stat-card" style="background:var(--bg-card);border:1px solid var(--border-glass);border-radius:var(--radius-md);padding:12px;text-align:center">' +
            '<div style="font-size:1.5rem;font-weight:600;color:' +
            (color || 'var(--accent)') +
            '">' +
            value +
            '</div>' +
            '<div style="font-size:0.78rem;color:var(--text-secondary);margin-top:4px">' +
            title +
            '</div>' +
            '</div>'
        );
    }

    function statusBadge(ok) {
        return ok
            ? '<span style="color:var(--success-hover);font-weight:700">✓ Online</span>'
            : '<span style="color:var(--danger-hover);font-weight:700">✗ Offline</span>';
    }

    /* ===== LEARNING ENGINE STATS ===== */
    function renderStats(container) {
        var p = fetchJson(ENDPOINTS.stats);
        if (!p) {
            container.innerHTML =
                '<div style="background:var(--danger-bg);border:1px solid var(--danger-border);border-radius:var(--radius-md);padding:12px;color:var(--danger-hover)">Brak dostępu do statystyk (wymagana rola admin)</div>';
            return;
        }
        p.then(function (stats) {
            if (!stats) {
                container.innerHTML =
                    '<div style="background:var(--danger-bg);border:1px solid var(--danger-border);border-radius:var(--radius-md);padding:12px;color:var(--danger-hover)">Brak dostępu do statystyk (wymagana rola admin)</div>';
                return;
            }
            var html =
                '<div class="ai-stats-grid">' +
                statCard('Wzorce łacznie', stats.total, 'var(--accent)') +
                statCard('Aktywne', stats.active, 'var(--success)') +
                statCard(
                    'Średnie confidence',
                    Math.round((stats.avgConfidence || 0) * 100) + '%',
                    'var(--warn)'
                ) +
                statCard('Rekomendacje', stats.totalRecommendations, 'var(--accent2)') +
                statCard('Zaakceptowane', stats.acceptedRecommendations, 'var(--success-hover)') +
                statCard('Odrzucone', stats.rejectedRecommendations, 'var(--danger-hover)') +
                statCard('Nowe (7 dni)', stats.recentDetected, 'var(--cyan)') +
                statCard('Archiwalne', stats.archived, 'var(--text-muted)') +
                '</div>' +
                (stats.byPatternType
                    ? '<div style="background:var(--bg-card);border-radius:var(--radius-md);padding:12px;margin-bottom:16px;border:1px solid var(--border-glass)">' +
                      '<h4 style="margin:0 0 8px;font-size:0.82rem;color:var(--text-primary);display:flex;align-items:center;gap:6px"><i data-lucide="pie-chart" style="width:14px;height:14px;color:var(--accent)"></i> Rozk\u0142ad wg typu</h4>' +
                      Object.keys(stats.byPatternType)
                          .map(function (k) {
                              return (
                                  '<div style="display:flex;justify-content:space-between;border-bottom:1px solid var(--border-glass);padding:5px 0;font-size:0.8rem">' +
                                  '<span style="color:var(--text-secondary)">' +
                                  k +
                                  '</span>' +
                                  '<strong style="color:var(--text-primary)">' +
                                  stats.byPatternType[k] +
                                  '</strong></div>'
                              );
                          })
                          .join('') +
                      '</div>'
                    : '') +
                '<div style="font-size:0.72rem;color:var(--text-muted);text-align:right">Ostatnia aktualizacja: ' +
                new Date().toLocaleString('pl-PL') +
                '</div>';
            container.innerHTML = html;
            if (typeof lucide !== 'undefined') {
                lucide.createIcons({ root: container });
            }
        });
    }

    /* ===== PATTERNS LIST ===== */
    function renderPatterns(container, dnFilter) {
        var url =
            ENDPOINTS.patterns +
            '?dn=' +
            encodeURIComponent(dnFilter || 'all_dn') +
            '&minConfidence=0.3';
        var p = fetchJson(url);
        if (!p) {
            container.innerHTML =
                '<div style="color:var(--text-muted);text-align:center;padding:20px">Brak wzorców (lub brak dostępu)</div>';
            return;
        }
        p.then(function (data) {
            if (!data) {
                container.innerHTML =
                    '<div style="color:var(--text-muted);text-align:center;padding:20px">Brak wzorców (lub brak dostępu)</div>';
                return;
            }
            if (!data.items || data.items.length === 0) {
                container.innerHTML =
                    '<div style="color:var(--text-muted);text-align:center;padding:20px">Brak wzorców dla DN=' +
                    escapeHtml(dnFilter || 'all_dn') +
                    '. Uruchom <strong>Learning Cycle</strong>.</div>';
                return;
            }
            var rows = data.items
                .map(function (p) {
                    var confColor =
                        p.confidence >= 0.7
                            ? 'var(--success-hover)'
                            : p.confidence >= 0.4
                              ? 'var(--warn)'
                              : 'var(--text-muted)';
                    return (
                        '<tr style="border-bottom:1px solid var(--border-glass)">' +
                        '<td style="padding:6px"><code style="background:var(--bg-tertiary);padding:2px 6px;border-radius:4px;font-size:0.72rem;color:var(--accent-text)">' +
                        (p.patternType || '') +
                        '</code></td>' +
                        '<td style="padding:6px;font-family:monospace;font-size:0.7rem;color:var(--text-secondary);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
                        (p.patternKey || '').slice(0, 60) +
                        '</td>' +
                        '<td style="padding:6px;text-align:right;color:' +
                        confColor +
                        ';font-weight:700">' +
                        Math.round((p.confidence || 0) * 100) +
                        '%</td>' +
                        '<td style="padding:6px;text-align:right;font-feature-settings:\'tnum\';color:var(--text-primary)">' +
                        (p.hitCount || 0) +
                        '</td>' +
                        '<td style="padding:6px;color:var(--text-muted);font-size:0.72rem;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
                        (p.description || '').slice(0, 80) +
                        '</td>' +
                        '</tr>'
                    );
                })
                .join('');
            container.innerHTML =
                '<div style="overflow-x:auto;border-radius:var(--radius-sm);border:1px solid var(--border-glass)">' +
                '<table style="width:100%;border-collapse:collapse;color:var(--text-primary);font-size:0.82rem">' +
                '<thead><tr style="background:var(--bg-tertiary);color:var(--text-muted);font-size:0.68rem;text-transform:uppercase;letter-spacing:0.4px">' +
                '<th style="padding:6px;text-align:left;font-weight:700">Typ</th>' +
                '<th style="padding:6px;text-align:left;font-weight:700">Pattern</th>' +
                '<th style="padding:6px;text-align:right;font-weight:700">Confidence</th>' +
                '<th style="padding:6px;text-align:right;font-weight:700">Hits</th>' +
                '<th style="padding:6px;text-align:left;font-weight:700">Opis</th>' +
                '</tr></thead><tbody>' +
                rows +
                '</tbody></table></div>';
        });
    }

    /* ===== ML STATUS ===== */
    function renderMlStatus(container) {
        var pStatus = fetchJson(ENDPOINTS.mlStatus);
        var pModels = fetchJson(ENDPOINTS.models);
        if (!pStatus) {
            container.innerHTML = '<div class="ai-ml-unavailable">Brak dostępu do ML status</div>';
            return;
        }
        Promise.all([pStatus, pModels]).then(function (results) {
            var status = results[0];
            var modelsData = results[1];
            if (!status) {
                container.innerHTML =
                    '<div class="ai-ml-unavailable">ML pipeline nieaktywny lub brak dostępu</div>';
                return;
            }

            var online = status.mlOnline;
            var html =
                '<h4 class="ai-ml-header"><i data-lucide="activity"></i> ML Pipeline</h4>' +
                '<div class="ai-ml-stats-grid">' +
                statCard(
                    'Status',
                    statusBadge(online),
                    online ? 'var(--success)' : 'var(--danger)'
                ) +
                statCard('Wersja modelu', status.modelVersion || '—', 'var(--accent2)') +
                statCard('Liczba modeli', status.modelCount || 0, 'var(--accent-hover)') +
                statCard(
                    'Trening trwa',
                    status.trainingRunning ? 'Tak' : 'Nie',
                    status.trainingRunning ? 'var(--warn)' : 'var(--success)'
                ) +
                statCard('Nagrody (reward)', status.totalRewards || 0, 'var(--cyan)') +
                statCard('Cache predykcji', status.cacheSize || 0, 'var(--text-muted)') +
                '</div>';

            /* Przyciski akcji */
            html +=
                '<div class="ai-ml-actions">' +
                '<button id="ai-ml-train-btn" class="ai-ml-train-btn"><i data-lucide="play"></i> Uruchom trening ML</button>' +
                '<button id="ai-ml-rollback-btn" class="ai-ml-rollback-btn"><i data-lucide="undo-2"></i> Rollback modelu</button>' +
                '</div>';

            /* Tabela modeli */
            var modelRows = '';
            if (modelsData && modelsData.models && modelsData.models.length > 0) {
                modelRows = modelsData.models
                    .map(function (m) {
                        var statusHtml = m.active
                            ? '<span class="ai-model-active">active</span>'
                            : (m.createdAt || '').slice(0, 10);
                        return (
                            '<tr>' +
                            '<td>' +
                            (m.version || '—') +
                            '</td>' +
                            '<td>' +
                            (m.auc != null ? m.auc.toFixed(4) : '—') +
                            '</td>' +
                            '<td>' +
                            (m.featureCount || 0) +
                            '</td>' +
                            '<td>' +
                            (m.trainingSamples || 0) +
                            '</td>' +
                            '<td>' +
                            statusHtml +
                            '</td>' +
                            '</tr>'
                        );
                    })
                    .join('');
            }

            if (modelRows) {
                html +=
                    '<div class="ai-model-table-wrap">' +
                    '<table class="ai-model-table">' +
                    '<thead><tr>' +
                    '<th>Wersja</th>' +
                    '<th>AUC</th>' +
                    '<th>Cechy</th>' +
                    '<th>Próbki</th>' +
                    '<th>Status</th>' +
                    '</tr></thead><tbody>' +
                    modelRows +
                    '</tbody></table></div>';
            } else {
                html +=
                    '<div class="ai-model-empty">Brak wytrenowanych modeli. Uruchom trening ML.</div>';
            }

            container.innerHTML = html;

            if (typeof lucide !== 'undefined') {
                lucide.createIcons({ root: container });
            }

            /* Eventy przycisków */
            var trainBtn = document.getElementById('ai-ml-train-btn');
            var rollbackBtn = document.getElementById('ai-ml-rollback-btn');
            var mlContainer = container;

            if (trainBtn) {
                trainBtn.addEventListener('click', function () {
                    trainBtn.disabled = true;
                    trainBtn.innerHTML =
                        '<i data-lucide="loader" class="lucide-spin"></i> Trenowanie...';
                    var p = fetchJson(ENDPOINTS.train, { method: 'POST' });
                    if (p) {
                        p.then(function (result) {
                            trainBtn.disabled = false;
                            trainBtn.innerHTML = '<i data-lucide="play"></i> Uruchom trening ML';
                            if (result) {
                                window.alert(
                                    'Trening ML zako\u0144czony:\n' +
                                        'Wytrenowany: ' +
                                        (result.trained ? 'Tak' : 'Nie') +
                                        (result.reason ? '\nPowód: ' + result.reason : '')
                                );
                                renderMlStatus(mlContainer);
                            }
                        });
                    } else {
                        trainBtn.disabled = false;
                        trainBtn.innerHTML = '<i data-lucide="play"></i> Uruchom trening ML';
                    }
                });
            }

            if (rollbackBtn) {
                rollbackBtn.addEventListener('click', function () {
                    if (
                        !window.confirm(
                            'Rollback do poprzedniego modelu? Obecny model zostanie zdezaktywowany.'
                        )
                    )
                        return;
                    rollbackBtn.disabled = true;
                    rollbackBtn.textContent = 'Rollback...';
                    var p = fetchJson(ENDPOINTS.rollback, { method: 'POST' });
                    if (p) {
                        p.then(function (result) {
                            rollbackBtn.disabled = false;
                            rollbackBtn.innerHTML = '<i data-lucide="undo-2"></i> Rollback modelu';
                            if (result && result.rolledBack) {
                                window.alert(
                                    'Rollback wykonany. Poprzedni model: ' +
                                        (result.model ? result.model.version : '—')
                                );
                                renderMlStatus(mlContainer);
                            } else {
                                window.alert('Brak poprzedniego modelu do rollbacku.');
                            }
                        });
                    } else {
                        rollbackBtn.disabled = false;
                        rollbackBtn.innerHTML = '<i data-lucide="undo-2"></i> Rollback modelu';
                    }
                });
            }
        });
    }

    /* ===== ENTRY POINT ===== */
    window.aiDashboardRender = function (containerId) {
        var container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML =
            '<div style="display:grid;grid-template-columns:1fr;gap:20px">' +
            /* Sekcja: Learning Engine */
            '<div id="ai-learning-section">' +
            '<h4 style="margin:0 0 10px;font-size:0.82rem;color:var(--text-primary);display:flex;align-items:center;gap:6px"><i data-lucide="brain" style="width:14px;height:14px;color:var(--accent)"></i> Learning Engine (baza wiedzy)</h4>' +
            '<div id="ai-stats"></div>' +
            '<div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;flex-wrap:wrap">' +
            '<input type="text" id="ai-dn-filter" placeholder="DN (np. 1200)" style="background:var(--bg-input);border:1px solid var(--border-glass);color:var(--text-primary);padding:6px 12px;border-radius:var(--radius-sm);font-size:0.82rem;width:110px">' +
            '<button id="ai-filter-btn" class="btn-hero" style="padding:0.35rem 0.8rem;font-size:0.78rem"><i data-lucide="filter"></i> Filtruj</button>' +
            '<button id="ai-run-cycle" class="btn-hero btn-accent" style="padding:0.35rem 0.8rem;font-size:0.78rem"><i data-lucide="refresh-cw"></i> Uruchom Learning Cycle</button>' +
            '</div>' +
            '<div id="ai-patterns"></div>' +
            '</div>' +
            /* Separator */
            '<hr style="border:none;border-top:1px solid var(--border-glass);margin:4px 0">' +
            /* Sekcja: ML Pipeline */
            '<div id="ai-ml-section">' +
            '<div id="ai-ml-status"></div>' +
            '</div>' +
            '</div>';

        renderStats(document.getElementById('ai-stats'));
        renderMlStatus(document.getElementById('ai-ml-status'));
        renderPatterns(document.getElementById('ai-patterns'));

        var filterBtn = document.getElementById('ai-filter-btn');
        var runBtn = document.getElementById('ai-run-cycle');
        var dnInput = document.getElementById('ai-dn-filter');
        var patternsContainer = document.getElementById('ai-patterns');
        var statsContainer = document.getElementById('ai-stats');

        if (filterBtn && dnInput) {
            filterBtn.addEventListener('click', function () {
                renderPatterns(patternsContainer, dnInput.value || '');
            });
        }

        if (runBtn) {
            runBtn.addEventListener('click', function () {
                runBtn.disabled = true;
                runBtn.innerHTML =
                    '<i data-lucide="loader" class="lucide-spin"></i> Uruchamianie...';
                var p = fetchJson(ENDPOINTS.runCycle, { method: 'POST' });
                if (p) {
                    p.then(function (result) {
                        runBtn.disabled = false;
                        runBtn.innerHTML =
                            '<i data-lucide="refresh-cw"></i> Uruchom Learning Cycle';
                        if (result) {
                            window.alert(
                                'Learning cycle zako\u0144czony:\n' +
                                    'Przetworzone: ' +
                                    result.processed +
                                    '\nWykrytych wzorców: ' +
                                    result.patternsDetected +
                                    '\nZapisanych do KB: ' +
                                    result.persistedToKb
                            );
                            renderStats(statsContainer);
                            renderPatterns(patternsContainer, dnInput ? dnInput.value : '');
                        }
                    });
                } else {
                    runBtn.disabled = false;
                    runBtn.innerHTML = '<i data-lucide="refresh-cw"></i> Uruchom Learning Cycle';
                }
            });
        }

        if (typeof lucide !== 'undefined') {
            lucide.createIcons({ root: container });
        }
    };
})();
