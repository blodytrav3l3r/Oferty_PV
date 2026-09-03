(function () {
    'use strict';

    const ENDPOINTS = {
        stats: '/api/telemetry/ai/knowledge/stats',
        patterns: '/api/telemetry/ai/knowledge/patterns',
        runCycle: '/api/telemetry/ai/learning/run',
        mlStatus: '/api/telemetry/ai/ml-status',
        models: '/api/telemetry/ai/models',
        featureImportance: '/api/telemetry/ai/feature-importance',
        train: '/api/telemetry/ai/train',
        rollback: '/api/telemetry/ai/rollback',
        promote: '/api/telemetry/ai/models/',
        approve: '/api/telemetry/ai/models/',
        settings: '/api/telemetry/ai/settings',
        wellSelections: '/api/telemetry/ai/well-selections',
        trainingRuns: '/api/telemetry/ai/training/runs',
        drift: '/api/telemetry/ai/drift',
        predictionsStats: '/api/telemetry/ai/predictions/stats'
    };
    window.AI_ENDPOINTS = ENDPOINTS;

    function safeJson(v) {
        if (v == null) return null;
        if (typeof v === 'object') return v;
        try {
            return JSON.parse(v);
        } catch (_e) {
            return null;
        }
    }
    window.aiSafeJson = safeJson;

    function escapeHtmlAttr(str) {
        if (typeof window.escapeHtmlAttr === 'function') return window.escapeHtmlAttr(str);
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }
    window.aiEscapeHtmlAttr = escapeHtmlAttr;

    function apiErrorHtml(errorCode) {
        const msg =
            errorCode === 'forbidden'
                ? 'Brak dostępu (wymagana rola admin)'
                : errorCode === 'unauthorized'
                  ? 'Nieautoryzowany — zaloguj się ponownie'
                  : 'Błąd serwera — nie udało się pobrać danych';
        return '<div class="ai-ml-error">' + msg + '</div>';
    }
    window.aiApiErrorHtml = apiErrorHtml;

    function uiConfirm(msg, opts) {
        const fn = window.appConfirm || window.parent?.appConfirm;
        if (typeof fn === 'function') return fn(msg, opts);
        return Promise.resolve(false);
    }
    window.aiUiConfirm = uiConfirm;

    function uiAlert(msg, opts) {
        const fn =
            window.appAlert ||
            window.parent?.appAlert ||
            window.appConfirm ||
            window.parent?.appConfirm;
        if (typeof fn === 'function') {
            if (fn === window.appConfirm || fn === window.parent?.appConfirm) {
                return fn(msg, { ...(opts || {}), hideCancel: true });
            }
            return fn(msg, opts);
        }
        return Promise.resolve();
    }
    window.aiUiAlert = uiAlert;

    function statCard(title, value, color, desc, tooltip) {
        return (
            '<div class="ai-stat-card" ' +
            (desc ? 'title="' + window.escapeHtml(desc) + '"' : '') +
            '>' +
            '<div' +
            (tooltip ? ' title="' + window.escapeHtml(tooltip) + '"' : '') +
            ' style="color:' +
            (color || 'var(--accent)') +
            '">' +
            value +
            '</div>' +
            '<div>' +
            title +
            '</div>' +
            '</div>'
        );
    }
    window.aiStatCard = statCard;

    function statusBadge(ok) {
        return ok
            ? '<span class="fs-xl-success-bold">✓ Online</span>'
            : '<span class="fs-xl-danger-bold">✗ Offline</span>';
    }
    window.aiStatusBadge = statusBadge;

    function loadingHtml() {
        return '<div class="ai-ml-loading">Ładowanie...</div>';
    }
    window.aiLoadingHtml = loadingHtml;

    // Execution kill-switch AI/ML — jedyne źródło stanu UI: GET /api/feature-flags.
    // Endpointy statusowe (ml-status/health/settings) powtarzają aiMlEnabled dla wygody.
    var _aiMlEnabledCache = null;
    function aiMlEnabled(forceRefresh) {
        if (_aiMlEnabledCache !== null && !forceRefresh) {
            return Promise.resolve(_aiMlEnabledCache);
        }
        var p = window.fetchJson('/api/feature-flags');
        if (!p) return Promise.resolve(true);
        return p
            .then(function (j) {
                _aiMlEnabledCache = !j || j.ai_ml_enabled !== false;
                return _aiMlEnabledCache;
            })
            .catch(function () {
                return true;
            });
    }
    window.aiMlEnabled = aiMlEnabled;
    window.aiMlInvalidateFlag = function () {
        _aiMlEnabledCache = null;
    };

    function aiMlDisabledHtml() {
        return (
            '<div class="card-note card-note--with-icon"><i data-lucide="power"></i>' +
            '<span>Moduł AI/ML jest wyłączony. Dane diagnostyczne i statusy są nadal dostępne, ale predykcje, treningi i operacje na modelach są zablokowane (503). Włącz moduł przyciskiem powyżej.</span></div>'
        );
    }
    window.aiMlDisabledHtml = aiMlDisabledHtml;

    function renderStats(container) {
        container.innerHTML = loadingHtml();
        const p = window.fetchJson(ENDPOINTS.stats);
        if (!p) {
            container.innerHTML =
                '<div class="ai-ml-error">Brak dostępu do statystyk (wymagana rola admin)</div>';
            return;
        }
        p.then(function (stats) {
            if (!stats || stats.error) {
                container.innerHTML = apiErrorHtml(stats && stats.error ? stats.error : 'server');
                return;
            }
            const html =
                '<div class="ai-stats-grid">' +
                statCard(
                    'Wzorce łącznie',
                    stats.total,
                    'var(--accent)',
                    'Łączna liczba wykrytych wzorców w bazie wiedzy'
                ) +
                statCard(
                    'Aktywne',
                    stats.active,
                    'var(--success)',
                    'Liczba aktywnych, aktualnie używanych wzorców'
                ) +
                statCard(
                    'Średnie confidence',
                    Math.round((stats.avgConfidence || 0) * 100) + '%',
                    'var(--warn)',
                    'Średni poziom ufności dla wszystkich wzorców (0-100%)'
                ) +
                statCard(
                    'Konfiguracje AI',
                    stats.totalRecommendations,
                    'var(--accent2)',
                    'Liczba rekordów konfiguracji studni zapisanych przez telemetrię AI'
                ) +
                statCard(
                    'Zaakceptowane',
                    stats.acceptedRecommendations,
                    'var(--success-hover)',
                    'Rekordy, w których użytkownik zaakceptował automatyczny dobór'
                ) +
                statCard(
                    'Odrzucone',
                    stats.rejectedRecommendations,
                    'var(--danger-hover)',
                    'Rekordy z jawnym odrzuceniem auto-doboru (sygnał REJECTED z UI)'
                ) +
                statCard(
                    'Nowe (7 dni)',
                    stats.recentDetected,
                    'var(--cyan)',
                    'Nowe wzorce wykryte w ciągu ostatnich 7 dni'
                ) +
                statCard(
                    'Archiwalne',
                    stats.archived,
                    'var(--text-muted)',
                    'Liczba wzorców zarchiwizowanych (nieaktywnych)'
                ) +
                '</div>' +
                (stats.byPatternType
                    ? '<div class="ai-pattern-list">' +
                      '<h4 class="ai-section-title"><i data-lucide="pie-chart"></i> Rozk\u0142ad wg typu</h4>' +
                      Object.keys(stats.byPatternType)
                          .map(function (k) {
                              return (
                                  '<div class="ai-pattern-row">' +
                                  '<span>' +
                                  window.escapeHtml(k) +
                                  '</span>' +
                                  '<strong>' +
                                  window.escapeHtml(stats.byPatternType[k]) +
                                  '</strong></div>'
                              );
                          })
                          .join('') +
                      '</div>'
                    : '') +
                '<div style="font-size: var(--fs-sm);color:var(--text-muted);text-align:right">Ostatnia aktualizacja: ' +
                new Date().toLocaleString('pl-PL') +
                '</div>';
            container.innerHTML = html;
            if (typeof lucide !== 'undefined') {
                lucide.createIcons({ root: container });
            }
        }).catch(function () {
            container.innerHTML = apiErrorHtml('server');
        });
    }
    window.aiRenderStats = renderStats;

    function patternsEmptyHtml(data, dnFilter) {
        const tc = data.telemetryCount || 0;
        const pt = data.patternsTotal || 0;
        const otherDn = data.patternsOtherDn || 0;
        const lastRun = data.lastRunAt ? new Date(data.lastRunAt).toLocaleString('pl-PL') : null;
        let msg = '';
        let icon = 'database';
        if (tc === 0) {
            msg =
                '<strong>Brak danych telemetrycznych.</strong> Zacznij budować studnie, aby system zebrał dane do nauki.';
            icon = 'inbox';
        } else if (!lastRun) {
            msg =
                '<strong>Zebrano ' +
                tc +
                ' akcji, ale Learning Cycle nie był jeszcze uruchomiony.</strong> Kliknij <em>Uruchom Learning Cycle</em>, aby wykryć wzorce.';
            icon = 'play';
        } else if (otherDn > 0 && pt > 0) {
            msg =
                '<strong>Brak wzorców dla DN=' +
                window.escapeHtml(dnFilter) +
                '.</strong> System zna ' +
                otherDn +
                ' wzorce dla innych średnic — zmień filtr DN.';
            icon = 'filter';
        } else {
            msg =
                '<strong>Brak wzorców spełniających próg pewności (30%).</strong> Zebrano ' +
                tc +
                ' akcji, ostatni cykl: ' +
                window.escapeHtml(lastRun || '—') +
                '. Zbierz więcej danych lub obniż próg.';
            icon = 'brain';
        }
        return (
            '<div style="display:flex;align-items:flex-start;gap:10px;color:var(--text-muted);background:var(--bg-tertiary);border:1px solid var(--border-glass);border-radius:var(--radius-sm);padding:14px">' +
            '<i data-lucide="' +
            icon +
            '" style="width:18px;height:18px;flex-shrink:0;margin-top:2px"></i>' +
            '<div style="font-size: var(--fs-md);line-height:1.45">' +
            msg +
            '</div></div>'
        );
    }
    window.aiPatternsEmptyHtml = patternsEmptyHtml;

    function renderPatterns(container, dnFilter) {
        container.innerHTML = loadingHtml();
        const url =
            ENDPOINTS.patterns +
            '?dn=' +
            encodeURIComponent(dnFilter || 'all_dn') +
            '&minConfidence=0.3';
        const p = window.fetchJson(url);
        if (!p) {
            container.innerHTML =
                '<div class="ai-ml-unavailable">Brak wzorców (lub brak dostępu)</div>';
            return;
        }
        p.then(function (data) {
            if (!data || data.error) {
                container.innerHTML =
                    data && data.error
                        ? apiErrorHtml(data.error)
                        : '<div class="ai-ml-unavailable">Brak wzorców (lub brak dostępu)</div>';
                return;
            }
            if (!data.items || data.items.length === 0) {
                container.innerHTML = patternsEmptyHtml(data, dnFilter || 'all_dn');
                if (window.lucide && typeof lucide.createIcons === 'function') {
                    lucide.createIcons({ root: container });
                }
                return;
            }
            const rows = data.items
                .map(function (p) {
                    const confColor =
                        p.confidence >= 0.7
                            ? 'var(--success-hover)'
                            : p.confidence >= 0.4
                              ? 'var(--warn)'
                              : 'var(--text-muted)';
                    return (
                        '<tr>' +
                        '<td><code class="ai-pattern-code">' +
                        window.escapeHtml(p.patternType || '') +
                        '</code></td>' +
                        '<td style="font-family:monospace;font-size: var(--fs-sm);color:var(--text-secondary);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
                        window.escapeHtml((p.patternKey || '').slice(0, 60)) +
                        '</td>' +
                        '<td style="text-align:right;color:' +
                        confColor +
                        ';font-weight: var(--fw-bold)">' +
                        Math.round((p.confidence || 0) * 100) +
                        '%</td>' +
                        '<td class="rury-col-num-inline">' +
                        (p.hitCount || 0) +
                        '</td>' +
                        '<td style="color:var(--text-muted);font-size: var(--fs-sm);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
                        window.escapeHtml((p.description || '').slice(0, 80)) +
                        '</td>' +
                        '</tr>'
                    );
                })
                .join('');
            container.innerHTML =
                '<div class="ai-table-wrap">' +
                '<table class="ai-table">' +
                '<thead><tr>' +
                '<th scope="col" title="Typ wykrytego wzorca">Typ</th>' +
                '<th scope="col" title="Klucz wzorca">Pattern</th>' +
                '<th scope="col" class="text-right" title="Poziom ufno\u015bci dla wzorca (0-100%)">Confidence</th>' +
                '<th scope="col" class="text-right" title="Liczba trafie\u0144 (zastosowa\u0144 wzorca)">Hits</th>' +
                '<th scope="col" title="Opis wzorca">Opis</th>' +
                '</tr></thead><tbody>' +
                rows +
                '</tbody></table></div>';
        }).catch(function () {
            container.innerHTML = apiErrorHtml('server');
        });
    }
    window.aiRenderPatterns = renderPatterns;
})();
