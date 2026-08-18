(function () {
    'use strict';

    /* ===== ENDPOINTY (poprawione — dodano /ai/) ===== */
    var ENDPOINTS = {
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

    /* fetchJson — wspólny helper z shared/ui.js (window.fetchJson) */

    /* Bezpieczne parsowanie JSON (backend może zwrócić obiekt lub string JSON) */
    function safeJson(v) {
        if (v == null) return null;
        if (typeof v === 'object') return v;
        try {
            return JSON.parse(v);
        } catch (_e) {
            return null;
        }
    }

    /* Escaping do atrybutów HTML — centralna implementacja w shared/ui.js */
    function escapeHtmlAttr(str) {
        if (typeof window.escapeHtmlAttr === 'function') return window.escapeHtmlAttr(str);
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    /* Komunikat błędu API — fetchJson rozróżnia {error:'forbidden'} (403) od {error:'server'} */
    function apiErrorHtml(errorCode) {
        var msg =
            errorCode === 'forbidden'
                ? 'Brak dostępu (wymagana rola admin)'
                : errorCode === 'unauthorized'
                  ? 'Nieautoryzowany — zaloguj się ponownie'
                  : 'Błąd serwera — nie udało się pobrać danych';
        return '<div class="ai-ml-error">' + msg + '</div>';
    }

    /* Popup in-app (fallback do natywnych okien) */
    function uiConfirm(msg, opts) {
        if (typeof window.appConfirm === 'function') return window.appConfirm(msg, opts);
        return Promise.resolve(window.confirm(msg));
    }

    function uiAlert(msg, opts) {
        if (typeof window.appAlert === 'function') return window.appAlert(msg, opts);
        return Promise.resolve(window.alert(msg));
    }

    /* ===== HELPER: karta statystyczna ===== */
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

    function statusBadge(ok) {
        return ok
            ? '<span style="color:var(--success-hover);font-weight: var(--fw-bold)">✓ Online</span>'
            : '<span style="color:var(--danger-hover);font-weight: var(--fw-bold)">✗ Offline</span>';
    }

    function loadingHtml() {
        return '<div class="ai-ml-loading">Ładowanie...</div>';
    }

    /* ===== LEARNING ENGINE STATS ===== */
    function renderStats(container) {
        container.innerHTML = loadingHtml();
        var p = window.fetchJson(ENDPOINTS.stats);
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
            var html =
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

    /* ===== PATTERNS LIST ===== */
    function renderPatterns(container, dnFilter) {
        container.innerHTML = loadingHtml();
        var url =
            ENDPOINTS.patterns +
            '?dn=' +
            encodeURIComponent(dnFilter || 'all_dn') +
            '&minConfidence=0.3';
        var p = window.fetchJson(url);
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
            var rows = data.items
                .map(function (p) {
                    var confColor =
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
                        '<td style="text-align:right;font-feature-settings:\'tnum\';color:var(--text-primary)">' +
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
                '<th title="Typ wykrytego wzorca">Typ</th>' +
                '<th title="Klucz wzorca">Pattern</th>' +
                '<th style="text-align:right" title="Poziom ufno\u015bci dla wzorca (0-100%)">Confidence</th>' +
                '<th style="text-align:right" title="Liczba trafie\u0144 (zastosowa\u0144 wzorca)">Hits</th>' +
                '<th title="Opis wzorca">Opis</th>' +
                '</tr></thead><tbody>' +
                rows +
                '</tbody></table></div>';
        }).catch(function () {
            container.innerHTML = apiErrorHtml('server');
        });
    }

    /* ===== PATTERNS EMPTY - komunikat diagnostyczny ===== */
    function patternsEmptyHtml(data, dnFilter) {
        var tc = data.telemetryCount || 0;
        var pt = data.patternsTotal || 0;
        var otherDn = data.patternsOtherDn || 0;
        var lastRun = data.lastRunAt ? new Date(data.lastRunAt).toLocaleString('pl-PL') : null;
        var msg = '';
        var icon = 'database';
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

    /* ===== ML STATUS ===== */
    function renderMlStatus(container) {
        container.innerHTML = loadingHtml();
        var pStatus = window.fetchJson(ENDPOINTS.mlStatus);
        var pModels = window.fetchJson(ENDPOINTS.models);
        if (!pStatus) {
            container.innerHTML = '<div class="ai-ml-unavailable">Brak dostępu do ML status</div>';
            return;
        }
        Promise.all([pStatus, pModels])
            .then(function (results) {
                var status = results[0];
                var modelsData = results[1];
                if (!status || status.error) {
                    container.innerHTML = apiErrorHtml(
                        status && status.error ? status.error : 'server'
                    );
                    return;
                }
                if (modelsData && modelsData.error) {
                    container.innerHTML = apiErrorHtml(modelsData.error);
                    return;
                }

                var online = status.mlOnline;
                var inf = status.aiInfluencePct || 0;
                var activeVer = status.modelVersion || '—';
                var activeAuc =
                    status.activeModelAuc != null && Number.isFinite(Number(status.activeModelAuc))
                        ? ' AUC ' + Number(status.activeModelAuc).toFixed(4)
                        : '';
                var m = status.activeModelMetrics || {};
                var fmt = function (v, d) {
                    return v != null && Number.isFinite(Number(v))
                        ? Number(v).toFixed(d == null ? 4 : d)
                        : '—';
                };
                var baselineAccuracy =
                    status.baselineAccuracy != null &&
                    Number.isFinite(Number(status.baselineAccuracy))
                        ? Number(status.baselineAccuracy)
                        : null;
                var baselineVsModel =
                    baselineAccuracy != null &&
                    status.activeModelAuc != null &&
                    Number.isFinite(Number(status.activeModelAuc))
                        ? Number(status.activeModelAuc) - baselineAccuracy
                        : null;
                var mlGroup = function (label, gridClass, cards) {
                    return (
                        '<div class="ai-ml-group">' +
                        '<div class="ai-ml-group-label"><i data-lucide="circle" style="width:6px;height:6px;fill:currentColor"></i>' +
                        window.escapeHtml(label) +
                        '</div>' +
                        '<div class="ai-ml-group-grid ' +
                        gridClass +
                        '">' +
                        cards.join('') +
                        '</div>' +
                        '</div>'
                    );
                };
                var html =
                    '<h4 class="ai-ml-header"><i data-lucide="activity"></i> ML Pipeline</h4>' +
                    mlGroup('Status i model', 'ai-ml-col-5', [
                        statCard(
                            'Status',
                            statusBadge(online),
                            online ? 'var(--success)' : 'var(--danger)',
                            "Status pipeline'a ML — online (działa) lub offline (wyłączony)"
                        ),
                        statCard(
                            'Wersja modelu',
                            window.escapeHtml(activeVer) + activeAuc,
                            'var(--accent2)',
                            'Aktualnie wykorzystywany model ML (wersja + AUC + data wdrożenia)',
                            activeVer +
                                (status.activeModelAuc != null
                                    ? ' AUC ' + status.activeModelAuc
                                    : '')
                        ),
                        statCard(
                            'Data wdrożenia',
                            (status.activeModelCreatedAt || '—').slice(0, 10),
                            'var(--accent-hover)',
                            'Kiedy aktywny model został wdrożony'
                        ),
                        statCard(
                            'Liczba modeli',
                            status.modelCount,
                            'var(--accent-hover)',
                            'Zapisane modele ML',
                            status.retention
                                ? 'Zapisane modele ML: ' +
                                      status.modelCount +
                                      '. Limit retencji: ' +
                                      status.retention.keepLast +
                                      ' ostatnich + ' +
                                      status.retention.keepBest +
                                      ' najlepszych.'
                                : 'Zapisane modele ML'
                        ),
                        statCard(
                            'Trening trwa',
                            status.trainingRunning ? 'Tak' : 'Nie',
                            status.trainingRunning ? 'var(--warn)' : 'var(--success)',
                            'Czy w tej chwili trwa trenowanie modelu'
                        )
                    ]) +
                    mlGroup('Jakość predykcji', 'ai-ml-col-5', [
                        statCard(
                            'Baseline vs Model',
                            baselineVsModel == null
                                ? '—'
                                : (baselineVsModel >= 0 ? '+' : '') +
                                      baselineVsModel.toFixed(2) +
                                      ' pp',
                            baselineVsModel == null
                                ? 'var(--text-muted)'
                                : baselineVsModel >= 0
                                  ? 'var(--success)'
                                  : 'var(--danger)',
                            'Różnica AUC aktywnego modelu względem baseline accuracy (majority-class, max(positiveRate, 1-positiveRate) z ostatniego treningu) w punktach procentowych',
                            baselineAccuracy != null
                                ? 'Baseline accuracy: ' +
                                      baselineAccuracy.toFixed(4) +
                                      ' (majority-class). Model AUC: ' +
                                      (status.activeModelAuc != null
                                          ? Number(status.activeModelAuc).toFixed(4)
                                          : '—')
                                : 'Brak baseline accuracy — brak udanego treningu z metryką'
                        ),
                        statCard(
                            'PR-AUC',
                            fmt(m.prAuc),
                            'var(--accent)',
                            'Precision-Recall AUC — jakość przy niezbalansowanych danych (im wyżej, tym lepiej)'
                        ),
                        statCard(
                            'F1',
                            fmt(m.f1),
                            'var(--accent-hover)',
                            'Harmoniczna średnia precyzji i czułości'
                        ),
                        statCard(
                            'LogLoss',
                            fmt(m.logLoss),
                            m.logLoss != null && Number(m.logLoss) <= 1.0
                                ? 'var(--success)'
                                : 'var(--warn)',
                            'Strata logarytmiczna — kalibracja prawdopodobieństw (im niżej, tym lepiej, ≤1.0 zalecane)'
                        ),
                        statCard(
                            'ECE (Calibration)',
                            fmt(m.ece),
                            m.ece != null && Number(m.ece) <= 0.25
                                ? 'var(--success)'
                                : 'var(--warn)',
                            'Expected Calibration Error — odchylenie predykcji od rzeczywistych proporcji (≤0.25 zalecane)'
                        )
                    ]) +
                    mlGroup('Dane i operacje', 'ai-ml-col-3', [
                        statCard(
                            'Dane treningowe (oznaczone)',
                            status.labeledCount + ' / ' + status.featureCount,
                            status.labeledCount >= 100 ? 'var(--success)' : 'var(--warn)',
                            'Wektory z sygnałem użytkownika (ACCEPTED/ACCEPTED_AFTER_MODIFICATION/REJECTED/MODIFIED) na tle wszystkich. ' +
                                'NO_FEEDBACK jest odrzucane przy treningu — sam surowy licznik może mylić.',
                            'ACCEPTED: ' +
                                status.labelCounts.accepted +
                                ', REJECTED: ' +
                                status.labelCounts.rejected +
                                ', MODIFIED: ' +
                                status.labelCounts.modified +
                                ', NO_FEEDBACK: ' +
                                status.labelCounts.noFeedback +
                                '. Próg treningu: min. 100 oznaczonych.'
                        ),
                        statCard(
                            'Nagrody (reward)',
                            status.totalRewards || 0,
                            'var(--cyan)',
                            'Suma nagród (reward) zebranych przez model za trafne predykcje'
                        ),
                        statCard(
                            'Cache predykcji',
                            status.cacheSize || 0,
                            'var(--text-muted)',
                            "Rozmiar cache'a predykcji w pamięci (liczba zapisanych wyników)"
                        )
                    ]) +
                    '<div class="ai-influence-widget">' +
                    '<label style="display:flex;align-items:center;gap:10px;cursor:pointer" title="Procentowy wp\u0142yw AI na ranking produkt\u00f3w (0% = tylko ludzkie preferencje, 100% = w pe\u0142ni automatyczny)">' +
                    '<i data-lucide="sliders-horizontal" style="width:16px;height:16px;color:var(--accent);flex-shrink:0"></i>' +
                    '<span style="font-size: var(--fs-md);color:var(--text-primary);white-space:nowrap">Wp\u0142yw AI: <strong id="ai-influence-value">' +
                    inf +
                    '%</strong></span>' +
                    '<input type="range" id="ai-influence-slider" min="0" max="100" value="' +
                    inf +
                    '" style="flex:1;min-width:80px;height:6px;accent-color:var(--accent);cursor:pointer">' +
                    '</label>' +
                    '</div>';

                /* Przyciski akcji */
                html +=
                    '<div class="ai-ml-actions">' +
                    '<button id="ai-ml-train-btn" class="ai-ml-train-btn" title="Uruchamia trenowanie modelu ML na zebranych danych telemetrycznych"><i data-lucide="play"></i> Uruchom trening ML</button>' +
                    '<button id="ai-ml-rollback-btn" class="ai-ml-rollback-btn" title="Przywraca poprzedni\u0105 wersj\u0119 modelu ML (cofa ostatni trening)"><i data-lucide="undo-2"></i> Rollback modelu</button>' +
                    '</div>';

                /* Tabela modeli */
                var modelRows = '';
                if (modelsData && modelsData.models && modelsData.models.length > 0) {
                    modelRows = modelsData.models
                        .map(function (m) {
                            var statusHtml = m.active
                                ? '<span class="ai-model-active">● Aktywny</span>'
                                : (m.createdAt || '').slice(0, 10);
                            var rowClass = m.active ? ' class="ai-model-row-active"' : '';
                            var delBtn = m.active
                                ? ''
                                : '<div class="ai-model-actions-cell">' +
                                  '<button class="ai-model-promote-btn" data-id="' +
                                  escapeHtmlAttr(m.id || '') +
                                  '" title="Promuj do produkcji (state machine: APPROVED/CANDIDATE → PRODUCTION)"><i data-lucide="rocket"></i></button>' +
                                  '<button class="ai-model-activate-btn" data-id="' +
                                  escapeHtmlAttr(m.id || '') +
                                  '" title="Ustaw ten model jako aktywny"><i data-lucide="check-circle"></i></button>' +
                                  '<button class="ai-model-delete-btn" data-id="' +
                                  escapeHtmlAttr(m.id || '') +
                                  '" title="Usuń ten model"><i data-lucide="trash-2"></i></button>' +
                                  '</div>';
                            /* Backend zwraca StoredModel: metrics (JSON z rocAuc), features, trainingRows, featureVersion */
                            var metrics = safeJson(m.metrics);
                            var rocAuc =
                                metrics &&
                                metrics.rocAuc != null &&
                                Number.isFinite(Number(metrics.rocAuc))
                                    ? Number(metrics.rocAuc)
                                    : null;
                            var prAuc =
                                metrics &&
                                metrics.prAuc != null &&
                                Number.isFinite(Number(metrics.prAuc))
                                    ? Number(metrics.prAuc)
                                    : null;
                            var f1 =
                                metrics && metrics.f1 != null && Number.isFinite(Number(metrics.f1))
                                    ? Number(metrics.f1)
                                    : null;
                            var featureCount = Array.isArray(m.features)
                                ? m.features.length
                                : (safeJson(m.features) || []).length;
                            return (
                                '<tr' +
                                rowClass +
                                '>' +
                                '<td>' +
                                window.escapeHtml(m.version || '—') +
                                (m.active
                                    ? '<span class="ai-model-used-tag">W UŻYCIU</span>'
                                    : '') +
                                '</td>' +
                                '<td>' +
                                (rocAuc != null ? rocAuc.toFixed(4) : '—') +
                                '</td>' +
                                '<td>' +
                                (prAuc != null ? prAuc.toFixed(4) : '—') +
                                '</td>' +
                                '<td>' +
                                (f1 != null ? f1.toFixed(4) : '—') +
                                '</td>' +
                                '<td>' +
                                (featureCount || 0) +
                                '</td>' +
                                '<td>' +
                                (m.trainingRows || 0) +
                                '</td>' +
                                '<td>' +
                                window.escapeHtml(m.featureVersion || '—') +
                                '</td>' +
                                '<td>' +
                                statusHtml +
                                '</td>' +
                                '<td>' +
                                delBtn +
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
                        '<th title="Wersja modelu">Wersja</th>' +
                        '<th title="Area Under Curve — miara jako\u015bci modelu (im wy\u017cej, tym lepiej)">AUC</th>' +
                        '<th title="Precision-Recall AUC — jako\u015b\u0107 przy niezbalansowanych danych">PR-AUC</th>' +
                        '<th title="Harmoniczna \u015brednia precyzji i czu\u0142o\u015bci">F1</th>' +
                        '<th title="Liczba cech u\u017cywanych przez model do predykcji">Cechy</th>' +
                        '<th title="Liczba próbek treningowych u\u017cytych do wytrenowania modelu">Próbki</th>' +
                        '<th title="Wersja schematu cech u\u017cytego do trenowania modelu">Wersja cech</th>' +
                        '<th title="Czy model jest aktualnie aktywny">Status</th>' +
                        '<th title="Promuj do produkcji, ustaw aktywny model lub usuń go (aktywnego nie można usunąć)">Akcja</th>' +
                        '</tr></thead><tbody>' +
                        modelRows +
                        '</tbody></table></div>';
                } else {
                    html +=
                        '<div class="ai-model-empty">Brak wytrenowanych modeli. Uruchom trening ML.</div>';
                }

                html +=
                    '<div class="ai-training-runs-host"></div>' +
                    '<div class="ai-drift-host"></div>';

                container.innerHTML = html;

                if (typeof lucide !== 'undefined') {
                    lucide.createIcons({ root: container });
                }

                renderTrainingRuns(container);
                renderDrift(container);

                /* Slider AI Influence */
                var aiSlider = document.getElementById('ai-influence-slider');
                var aiValueLabel = document.getElementById('ai-influence-value');
                var aiSaveTimer = null;
                if (aiSlider && aiValueLabel) {
                    aiSlider.addEventListener('input', function () {
                        aiValueLabel.textContent = this.value + '%';
                    });
                    aiSlider.addEventListener('change', function () {
                        if (aiSaveTimer) clearTimeout(aiSaveTimer);
                        aiSaveTimer = setTimeout(function () {
                            var val = aiSlider ? aiSlider.value : '0';
                            var p = window.fetchJson(ENDPOINTS.settings, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ value: val })
                            });
                            if (p) {
                                p.then(function (result) {
                                    if (result && result.error) {
                                        if (typeof window.showToast === 'function')
                                            window.showToast('Błąd zapisu AI Influence', 'error');
                                        return;
                                    }
                                    if (typeof window.showToast === 'function')
                                        window.showToast('AI Influence: ' + val + '%', 'info');
                                }).catch(function () {
                                    if (typeof window.showToast === 'function')
                                        window.showToast('Błąd zapisu AI Influence', 'error');
                                });
                            }
                        }, 500);
                    });
                }

                /* Eventy przycisków */
                var trainBtn = document.getElementById('ai-ml-train-btn');
                var rollbackBtn = document.getElementById('ai-ml-rollback-btn');
                var mlContainer = container;
                /* Usuwanie i ręczna aktywacja modeli (delegacja zdarzeń) */
                /* Delegacja zdarzeń: jeden handler dla delete + activate (P6) */
                var modelTableWrap = container.querySelector('.ai-model-table-wrap');
                if (modelTableWrap) {
                    modelTableWrap.addEventListener('click', function (ev) {
                        var deleteBtn = ev.target.closest
                            ? ev.target.closest('.ai-model-delete-btn')
                            : null;
                        var activateBtn = ev.target.closest
                            ? ev.target.closest('.ai-model-activate-btn')
                            : null;
                        var promoteBtn = ev.target.closest
                            ? ev.target.closest('.ai-model-promote-btn')
                            : null;

                        if (promoteBtn) {
                            ev.preventDefault();
                            uiConfirm(
                                'Promować ten model do produkcji? Obecnie produkcyjny model zostanie zastąpiony (rollback możliwy).',
                                {
                                    title: 'Promocja modelu',
                                    okText: 'Promuj',
                                    type: 'info'
                                }
                            ).then(function (confirmed) {
                                if (!confirmed) return;
                                var id = promoteBtn.getAttribute('data-id');
                                var p = window.fetchJson(
                                    ENDPOINTS.promote + encodeURIComponent(id) + '/promote',
                                    { method: 'POST' }
                                );
                                if (p) {
                                    p.then(function (result) {
                                        if (result && result.promoted) {
                                            if (typeof window.showToast === 'function')
                                                window.showToast(
                                                    'Promowano model: ' + result.model.version,
                                                    'success'
                                                );
                                            renderMlStatus(mlContainer);
                                        } else {
                                            uiAlert(
                                                (result && result.error
                                                    ? result.error
                                                    : 'Nie udało się promować modelu.') +
                                                    ' Promować można modele APPROVED/CANDIDATE.',
                                                {
                                                    title: 'Błąd promocji',
                                                    type: 'warning'
                                                }
                                            );
                                        }
                                    }).catch(function () {
                                        uiAlert('Błąd promocji modelu ML.', {
                                            title: 'Błąd promocji',
                                            type: 'warning'
                                        });
                                    });
                                }
                            });
                            return;
                        }

                        if (deleteBtn) {
                            ev.preventDefault();
                            uiConfirm('Na pewno usunąć ten model ML?', {
                                title: 'Usuwanie modelu ML',
                                okText: 'Usuń',
                                type: 'danger'
                            }).then(function (confirmed) {
                                if (!confirmed) return;
                                var id = deleteBtn.getAttribute('data-id');
                                var p = window.fetchJson(
                                    ENDPOINTS.models + '/' + encodeURIComponent(id),
                                    {
                                        method: 'DELETE'
                                    }
                                );
                                if (p) {
                                    p.then(function (result) {
                                        if (result && result.deleted) {
                                            if (typeof window.showToast === 'function')
                                                window.showToast('Usunięto model ML', 'success');
                                            renderMlStatus(mlContainer);
                                        } else {
                                            uiAlert('Nie udało się usunąć modelu ML.', {
                                                title: 'Błąd usuwania',
                                                type: 'warning'
                                            });
                                        }
                                    }).catch(function () {
                                        uiAlert('Błąd usuwania modelu ML.', {
                                            title: 'Błąd usuwania',
                                            type: 'warning'
                                        });
                                    });
                                } else {
                                    uiAlert('Brak dostępu do usuwania modeli ML.', {
                                        title: 'Błąd usuwania',
                                        type: 'warning'
                                    });
                                }
                            });
                            return;
                        }

                        if (activateBtn) {
                            ev.preventDefault();
                            uiConfirm(
                                'Ustawić ten model jako aktywny? Obecnie aktywny model zostanie zastąpiony.',
                                {
                                    title: 'Zmiana aktywnego modelu',
                                    okText: 'Użyj',
                                    type: 'info'
                                }
                            ).then(function (confirmed) {
                                if (!confirmed) return;
                                var id = activateBtn.getAttribute('data-id');
                                var p = window.fetchJson(
                                    ENDPOINTS.models + '/' + encodeURIComponent(id) + '/activate',
                                    { method: 'POST' }
                                );
                                if (p) {
                                    p.then(function (result) {
                                        if (result && result.activated) {
                                            if (typeof window.showToast === 'function')
                                                window.showToast(
                                                    'Aktywny model: ' + result.model.version,
                                                    'success'
                                                );
                                            renderMlStatus(mlContainer);
                                        } else {
                                            uiAlert('Nie udało się zmienić aktywnego modelu.', {
                                                title: 'Błąd zmiany',
                                                type: 'warning'
                                            });
                                        }
                                    }).catch(function () {
                                        uiAlert('Błąd zmiany aktywnego modelu.', {
                                            title: 'Błąd zmiany',
                                            type: 'warning'
                                        });
                                    });
                                } else {
                                    uiAlert('Brak dostępu do zmiany modelu ML.', {
                                        title: 'Błąd zmiany',
                                        type: 'warning'
                                    });
                                }
                            });
                        }
                    });
                }
                if (trainBtn) {
                    trainBtn.addEventListener('click', function () {
                        trainBtn.disabled = true;
                        trainBtn.innerHTML =
                            '<i data-lucide="loader" class="lucide-spin"></i> Trenowanie...';
                        var p = window.fetchJson(ENDPOINTS.train, { method: 'POST' });
                        if (p) {
                            p.then(function (result) {
                                trainBtn.disabled = false;
                                trainBtn.innerHTML =
                                    '<i data-lucide="play"></i> Uruchom trening ML';
                                if (result && !result.error) {
                                    uiAlert(
                                        'Trening ML zakończony:\n' +
                                            'Wytrenowany: ' +
                                            (result.trained ? 'Tak' : 'Nie') +
                                            (result.reason ? '\nPowód: ' + result.reason : ''),
                                        { title: 'Trening ML', type: 'info' }
                                    );
                                    renderMlStatus(mlContainer);
                                } else {
                                    uiAlert('Nie udało się uruchomić treningu ML.', {
                                        title: 'Trening ML',
                                        type: 'warning'
                                    });
                                }
                            }).catch(function () {
                                trainBtn.disabled = false;
                                trainBtn.innerHTML =
                                    '<i data-lucide="play"></i> Uruchom trening ML';
                            });
                        } else {
                            trainBtn.disabled = false;
                            trainBtn.innerHTML = '<i data-lucide="play"></i> Uruchom trening ML';
                        }
                    });
                }

                if (rollbackBtn) {
                    rollbackBtn.addEventListener('click', function () {
                        uiConfirm(
                            'Rollback do poprzedniego modelu? Obecny model zostanie zdezaktywowany.',
                            {
                                title: 'Rollback modelu',
                                okText: 'Rollback',
                                type: 'warning'
                            }
                        ).then(function (confirmed) {
                            if (!confirmed) return;
                            rollbackBtn.disabled = true;
                            rollbackBtn.textContent = 'Rollback...';
                            var p = window.fetchJson(ENDPOINTS.rollback, { method: 'POST' });
                            if (p) {
                                p.then(function (result) {
                                    rollbackBtn.disabled = false;
                                    rollbackBtn.innerHTML =
                                        '<i data-lucide="undo-2"></i> Rollback modelu';
                                    if (result && !result.error && result.rolledBack) {
                                        uiAlert(
                                            'Rollback wykonany. Poprzedni model: ' +
                                                (result.model ? result.model.version : '—'),
                                            { title: 'Rollback modelu', type: 'info' }
                                        );
                                        renderMlStatus(mlContainer);
                                    } else {
                                        uiAlert('Brak poprzedniego modelu do rollbacku.', {
                                            title: 'Rollback modelu',
                                            type: 'warning'
                                        });
                                    }
                                }).catch(function () {
                                    rollbackBtn.disabled = false;
                                    rollbackBtn.innerHTML =
                                        '<i data-lucide="undo-2"></i> Rollback modelu';
                                });
                            } else {
                                rollbackBtn.disabled = false;
                                rollbackBtn.innerHTML =
                                    '<i data-lucide="undo-2"></i> Rollback modelu';
                                uiAlert('Brak dostępu do rollbacku modelu ML.', {
                                    title: 'Rollback modelu',
                                    type: 'warning'
                                });
                            }
                        });
                    });
                }
            })
            .catch(function () {
                container.innerHTML = apiErrorHtml('server');
            });
    }

    /* ===== TRAINING RUNS ===== */
    /* GET /api/telemetry/ai/training/runs zwraca { runs } — 20 ostatnich AiTrainingRun */
    function renderTrainingRuns(container) {
        var host = container.querySelector('.ai-training-runs-host');
        if (!host) return;
        host.innerHTML = loadingHtml();
        var p = window.fetchJson(ENDPOINTS.trainingRuns);
        if (!p) {
            host.innerHTML = apiErrorHtml('server');
            return;
        }
        p.then(function (data) {
            if (!data || data.error) {
                host.innerHTML = apiErrorHtml(data && data.error ? data.error : 'server');
                return;
            }
            var runs = data.runs || [];
            if (!runs.length) {
                host.innerHTML =
                    '<div class="ai-model-empty">Brak zapisanych przebiegów treningu.</div>';
                return;
            }
            var rows = runs
                .map(function (r) {
                    var statusCls =
                        r.status === 'SUCCESS'
                            ? 'style="color:var(--success-hover);font-weight: var(--fw-bold)"'
                            : r.status === 'RUNNING'
                              ? 'style="color:var(--warn);font-weight: var(--fw-bold)"'
                              : r.status === 'SKIPPED'
                                ? 'style="color:var(--text-muted)"'
                                : 'style="color:var(--danger-hover);font-weight: var(--fw-bold)"';
                    var range =
                        r.datasetStartAt && r.datasetEndAt
                            ? r.datasetStartAt.slice(0, 10) + ' → ' + r.datasetEndAt.slice(0, 10)
                            : '—';
                    var fp = r.datasetFingerprint ? r.datasetFingerprint.slice(0, 8) : '—';
                    return (
                        '<tr>' +
                        '<td style="white-space:nowrap;color:var(--text-muted);font-size: var(--fs-base)">' +
                        window.escapeHtml((r.startedAt || '').slice(0, 16)) +
                        '</td>' +
                        '<td ' +
                        statusCls +
                        '>' +
                        window.escapeHtml(r.status || '—') +
                        '</td>' +
                        '<td>' +
                        (r.datasetSize || 0) +
                        ' (' +
                        (r.trainSize || 0) +
                        '/' +
                        (r.validationSize || 0) +
                        '/' +
                        (r.testSize || 0) +
                        ')</td>' +
                        '<td>' +
                        window.escapeHtml(r.candidateModelVersion || '—') +
                        '</td>' +
                        '<td>' +
                        (r.deployed ? 'Tak' : '—') +
                        '</td>' +
                        '<td>' +
                        window.escapeHtml(range) +
                        '</td>' +
                        '<td style="font-family:monospace;font-size: var(--fs-base);color:var(--text-muted)">' +
                        window.escapeHtml(fp) +
                        '</td>' +
                        '</tr>'
                    );
                })
                .join('');
            host.innerHTML =
                '<div class="ai-section-title"><i data-lucide="history"></i> Przebiegi treningu (ostatnie 20)</div>' +
                '<div class="ai-table-wrap">' +
                '<table class="ai-table">' +
                '<thead><tr>' +
                '<th title="Data rozpoczęcia przebiegu">Start</th>' +
                '<th title="Status przebiegu (SUCCESS/SKIPPED/FAILED_*)">Status</th>' +
                '<th title="Rozmiar zbioru: dataset (train/validation/test)">Zbiór</th>' +
                '<th title="Wersja modelu wyprodukowanego przez przebieg">Model</th>' +
                '<th title="Czy model został wdrożony do produkcji">Wdrożony</th>' +
                '<th title="Zakres czasowy zbioru treningowego">Zakres datasetu</th>' +
                '<th title="Skrót fingerprintu zbioru (SHA-256, 8 znaków)">Fingerprint</th>' +
                '</tr></thead><tbody>' +
                rows +
                '</tbody></table></div>';
            if (typeof lucide !== 'undefined') {
                lucide.createIcons({ root: host });
            }
        }).catch(function () {
            host.innerHTML = apiErrorHtml('server');
        });
    }

    /* ===== DRIFT ===== */
    /* GET /api/telemetry/ai/drift zwraca DriftReport:
       feature: [{feature, psi}] (top-5 wg PSI), prediction: {psi},
       label: {currentPositiveRate, trainingPositiveRate, delta}, shadow: {...} */
    function renderDrift(container) {
        var host = container.querySelector('.ai-drift-host');
        if (!host) return;
        host.innerHTML = loadingHtml();
        var p = window.fetchJson(ENDPOINTS.drift);
        if (!p) {
            host.innerHTML = apiErrorHtml('server');
            return;
        }
        p.then(function (data) {
            if (!data || data.error) {
                host.innerHTML = apiErrorHtml(data && data.error ? data.error : 'server');
                return;
            }
            var psiBadge = function (psi) {
                if (psi == null || !Number.isFinite(Number(psi))) {
                    return '<span style="color:var(--text-muted)">brak danych</span>';
                }
                var v = Number(psi);
                var color =
                    v < 0.1
                        ? 'var(--success-hover)'
                        : v < 0.25
                          ? 'var(--warn)'
                          : 'var(--danger-hover)';
                return (
                    '<span style="color:' +
                    color +
                    ';font-weight: var(--fw-bold)">' +
                    v.toFixed(4) +
                    '</span>'
                );
            };
            var featureRows = (data.feature || [])
                .slice(0, 5)
                .map(function (f, i) {
                    return (
                        '<tr>' +
                        '<td>' +
                        (i + 1) +
                        '</td>' +
                        '<td style="font-family:monospace;font-size: var(--fs-base)">' +
                        window.escapeHtml(f.feature || '—') +
                        '</td>' +
                        '<td>' +
                        psiBadge(f.psi) +
                        '</td>' +
                        '</tr>'
                    );
                })
                .join('');
            var labelHtml = '';
            var lab = data.label || {};
            if (lab.currentPositiveRate != null || lab.trainingPositiveRate != null) {
                var delta = lab.delta;
                var deltaCls =
                    delta == null
                        ? 'var(--text-muted)'
                        : Math.abs(delta) < 0.05
                          ? 'var(--success-hover)'
                          : 'var(--warn)';
                labelHtml =
                    '<div class="ai-drift-label">' +
                    '<span><strong>Label drift:</strong> bieżący positiveRate ' +
                    (lab.currentPositiveRate != null
                        ? Number(lab.currentPositiveRate).toFixed(4)
                        : '—') +
                    ' vs treningowy ' +
                    (lab.trainingPositiveRate != null
                        ? Number(lab.trainingPositiveRate).toFixed(4)
                        : '—') +
                    '</span>' +
                    '<span style="color:' +
                    deltaCls +
                    ';font-weight: var(--fw-bold)">Δ ' +
                    (delta != null ? (delta >= 0 ? '+' : '') + Number(delta).toFixed(4) : '—') +
                    '</span></div>';
            }
            var shadowHtml = '';
            var sh = data.shadow || {};
            if (sh.candidateVersion) {
                shadowHtml =
                    '<div class="ai-drift-label">' +
                    '<span><strong>Shadow (A/B):</strong> kandydat ' +
                    window.escapeHtml(sh.candidateVersion || '—') +
                    ' AUC ' +
                    (sh.shadowAuc != null ? Number(sh.shadowAuc).toFixed(4) : '—') +
                    ' vs produkcja ' +
                    window.escapeHtml(sh.productionVersion || '—') +
                    ' AUC ' +
                    (sh.productionAuc != null ? Number(sh.productionAuc).toFixed(4) : '—') +
                    ' (' +
                    (sh.samples || 0) +
                    ' wspólnych próbek)</span></div>';
            }
            host.innerHTML =
                '<div class="ai-section-title"><i data-lucide="waves"></i> Drift modelu</div>' +
                '<div class="ai-drift-grid">' +
                '<div class="ai-drift-card"><strong>Prediction drift</strong><br>' +
                psiBadge(data.prediction ? data.prediction.psi : null) +
                '<div style="color:var(--text-muted);font-size: var(--fs-sm);margin-top:2px">PSI rozkładu score</div></div>' +
                '<div class="ai-drift-card"><strong>Feature drift</strong><br>' +
                '<div style="color:var(--text-muted);font-size: var(--fs-sm);margin-top:2px">top-5 cech wg PSI</div></div>' +
                '</div>' +
                (featureRows
                    ? '<div class="ai-table-wrap"><table class="ai-table"><thead><tr><th>#</th><th>Cecha</th><th>PSI</th></tr></thead><tbody>' +
                      featureRows +
                      '</tbody></table></div>'
                    : '') +
                labelHtml +
                shadowHtml;
            if (typeof lucide !== 'undefined') {
                lucide.createIcons({ root: host });
            }
        }).catch(function () {
            host.innerHTML = apiErrorHtml('server');
        });
    }

    /* ===== FEATURE IMPORTANCE ===== */
    /* GET /api/telemetry/ai/feature-importance zwraca { modelVersion, features: [{featureName, importance}] }
       posortowane malejąco wg importance. 503 (brak aktywnego modelu) jest normalizowane przez fetchJson
       na {error:'unavailable'} — dla braku modelu pokazujemy komunikat o uruchomieniu treningu ML. */
    function renderFeatureImportance(container) {
        container.innerHTML = loadingHtml();
        var p = window.fetchJson(ENDPOINTS.featureImportance);
        if (!p) {
            container.innerHTML = apiErrorHtml('server');
            return;
        }
        p.then(function (data) {
            if (!data) {
                container.innerHTML = apiErrorHtml('server');
                return;
            }
            if (data.error) {
                if (data.error === 'forbidden' || data.error === 'server') {
                    container.innerHTML = apiErrorHtml(data.error);
                    return;
                }
                if (data.error === 'unavailable') {
                    container.innerHTML =
                        '<div style="color:var(--text-muted);background:var(--bg-tertiary);border:1px solid var(--border-glass);border-radius:var(--radius-sm);padding:12px;font-size: var(--fs-md)">Brak aktywnego modelu — uruchom trening ML, aby zobaczyć ważność cech.</div>';
                    return;
                }
                container.innerHTML = apiErrorHtml(data.error);
                return;
            }
            var feats = data.features || [];
            if (!Array.isArray(feats) || feats.length === 0) {
                container.innerHTML =
                    '<div style="color:var(--text-muted);background:var(--bg-tertiary);border:1px solid var(--border-glass);border-radius:var(--radius-sm);padding:12px;font-size: var(--fs-md)">Brak aktywnego modelu — uruchom trening ML, aby zobaczyć ważność cech.</div>';
                return;
            }
            var max = feats.reduce(function (mx, f) {
                return Math.max(mx, f.importance || 0);
            }, 0);
            max = max > 0 ? max : 1;
            var rows = feats
                .map(function (f) {
                    var val = f.importance || 0;
                    var pct = Math.round((val / max) * 100);
                    return (
                        '<div style="margin-bottom:6px">' +
                        '<div style="display:flex;justify-content:space-between;font-size: var(--fs-base);margin-bottom:2px">' +
                        '<span style="color:var(--text-secondary)">' +
                        window.escapeHtml(f.featureName || '—') +
                        '</span>' +
                        '<span style="color:var(--text-primary);font-weight: var(--fw-semibold)">' +
                        val.toFixed(4) +
                        '</span>' +
                        '</div>' +
                        '<div style="background:var(--bg-tertiary);border-radius: var(--radius-2xs);height:8px;overflow:hidden">' +
                        '<div style="width:' +
                        pct +
                        '%;height:100%;background:var(--accent);border-radius: var(--radius-2xs)"></div>' +
                        '</div>' +
                        '</div>'
                    );
                })
                .join('');
            container.innerHTML =
                '<div style="background:var(--bg-card);border:1px solid var(--border-glass);border-radius:var(--radius-md);padding:12px;margin-top:10px">' +
                '<h4 class="ai-section-title"><i data-lucide="bar-chart-3"></i> Feature Importance</h4>' +
                '<div style="font-size: var(--fs-sm);color:var(--text-muted);margin-bottom:10px">Ważność cech aktywnego modelu: <strong>' +
                window.escapeHtml(data.modelVersion || '—') +
                '</strong></div>' +
                rows +
                '</div>';
            if (typeof lucide !== 'undefined') {
                lucide.createIcons({ root: container });
            }
        }).catch(function () {
            container.innerHTML = apiErrorHtml('server');
        });
    }

    /* ===== STUDNIE DOBRANE PRZEZ AI (well selections) ===== */
    function renderWellSelections(container) {
        container.innerHTML = loadingHtml();
        var p = window.fetchJson(ENDPOINTS.wellSelections);
        if (!p) {
            container.innerHTML = apiErrorHtml('server');
            return;
        }
        p.then(function (data) {
            if (!data || data.error) {
                container.innerHTML = apiErrorHtml(data && data.error ? data.error : 'server');
                return;
            }
            var items = data.items || [];
            if (items.length === 0) {
                container.innerHTML =
                    '<div style="color:var(--text-muted);background:var(--bg-tertiary);border:1px solid var(--border-glass);border-radius:var(--radius-sm);padding:12px;font-size: var(--fs-md)">Brak studni dobranych przez AI. Gdy AI zmieni wynik doboru, studnia pojawi się tutaj.</div>';
                return;
            }
            var shown = items.slice(0, 20);
            var rows = shown
                .map(function (w, i) {
                    // N8: legacy createdAt bywa surowym epoch-ms (liczba) — new Date(liczba)
                    // jest OK, ale string "Invalid Date" z zepsutych danych rzucał RangeError
                    // wewnątrz .then i zostawiał "Ładowanie..." na stałe.
                    var lastSeen = '—';
                    if (w.lastSeenAt) {
                        var d = new Date(w.lastSeenAt);
                        if (!isNaN(d.getTime())) {
                            lastSeen = d.toLocaleString('pl-PL');
                        }
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
                        '<td style="text-align:right;font-feature-settings:\'tnum\';color:var(--text-primary)">' +
                        (w.count || 0) +
                        '</td>' +
                        '<td style="color:var(--text-muted);font-size: var(--fs-sm);white-space:nowrap">' +
                        window.escapeHtml(lastSeen) +
                        '</td>' +
                        '</tr>'
                    );
                })
                .join('');
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
                '<th>Lp</th>' +
                '<th title="Średnica nominalna studni">DN</th>' +
                '<th title="Magazyn / zakład produkcyjny">Magazyn</th>' +
                '<th style="text-align:right" title="Liczba rekordów telemetrii z nadpisaniem przez AI">Liczba rekordów</th>' +
                '<th title="Kiedy AI ostatnio zmieniło dobór dla tej studni">Ostatnio użyto</th>' +
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
            if (typeof lucide !== 'undefined') {
                lucide.createIcons({ root: container });
            }
        }).catch(function () {
            container.innerHTML = apiErrorHtml('server');
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
            '<h4 class="ai-section-title"><i data-lucide="brain"></i> Learning Engine (baza wiedzy)</h4>' +
            '<div id="ai-stats"></div>' +
            '<div class="ai-toolbar">' +
            '<input type="text" id="ai-dn-filter" class="ai-filter-input" placeholder="DN (np. 1200)">' +
            '<button id="ai-filter-btn" class="ai-btn" title="Filtruj wzorce po \u015brednicy nominalnej (DN)"><i data-lucide="filter"></i> Filtruj</button>' +
            '<button id="ai-run-cycle" class="ai-btn ai-btn-primary" title="Uruchamia cykl uczenia — analizuje dane telemetryczne i wykrywa nowe wzorce"><i data-lucide="refresh-cw"></i> Uruchom Learning Cycle</button>' +
            '</div>' +
            '<div id="ai-patterns"></div>' +
            '</div>' +
            /* Separator */
            '<hr style="border:none;border-top:1px solid var(--border-glass);margin:4px 0">' +
            /* Sekcja: ML Pipeline */
            '<div id="ai-ml-section">' +
            '<div id="ai-ml-status"></div>' +
            '<div id="ai-feature-importance"></div>' +
            '</div>' +
            /* Sekcja: Studnie dobrane przez AI */
            '<hr style="border:none;border-top:1px solid var(--border-glass);margin:4px 0">' +
            '<div id="ai-well-selections-section">' +
            '<div id="ai-well-selections"></div>' +
            '</div>' +
            '</div>';

        renderStats(document.getElementById('ai-stats'));
        renderMlStatus(document.getElementById('ai-ml-status'));
        renderFeatureImportance(document.getElementById('ai-feature-importance'));
        renderWellSelections(document.getElementById('ai-well-selections'));
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
                var p = window.fetchJson(ENDPOINTS.runCycle, { method: 'POST' });
                if (p) {
                    p.then(function (result) {
                        runBtn.disabled = false;
                        runBtn.innerHTML =
                            '<i data-lucide="refresh-cw"></i> Uruchom Learning Cycle';
                        if (result && !result.error) {
                            uiAlert(
                                'Learning cycle zakończony:\n' +
                                    'Przetworzone: ' +
                                    result.processed +
                                    '\nWykrytych wzorców: ' +
                                    result.patternsDetected +
                                    '\nZapisanych do KB: ' +
                                    result.persistedToKb,
                                { title: 'Learning Cycle', type: 'info' }
                            );
                            renderStats(statsContainer);
                            renderPatterns(patternsContainer, dnInput ? dnInput.value : '');
                        } else {
                            uiAlert('Nie udało się uruchomić Learning Cycle.', {
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

        if (typeof lucide !== 'undefined') {
            lucide.createIcons({ root: container });
        }
    };
})();
