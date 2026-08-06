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
        settings: '/api/telemetry/ai/settings'
    };

    function fetchJson(url, options) {
        if (!window.fetch) return null;
        try {
            var resp = fetch(url, Object.assign({ credentials: 'same-origin' }, options || {}));
            return resp
                .then(function (r) {
                    if (r.status === 403) return { error: 'forbidden' };
                    if (!r.ok) return { error: 'server' };
                    return r.json();
                })
                .catch(function () {
                    return null;
                });
        } catch (e) {
            return null;
        }
    }

    /* Bezpieczne parsowanie JSON (backend może zwrócić obiekt lub string JSON) */
    function safeJson(v) {
        if (v == null) return null;
        if (typeof v === 'object') return v;
        try {
            return JSON.parse(v);
        } catch (e) {
            return null;
        }
    }

    /* Komunikat błędu API — fetchJson rozróżnia {error:'forbidden'} (403) od {error:'server'} */
    function apiErrorHtml(errorCode) {
        var msg =
            errorCode === 'forbidden'
                ? 'Brak dostępu (wymagana rola admin)'
                : 'Błąd serwera — nie udało się pobrać danych';
        return (
            '<div style="background:var(--danger-bg);border:1px solid var(--danger-border);border-radius:var(--radius-md);padding:12px;color:var(--danger-hover)">' +
            msg +
            '</div>'
        );
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
    function statCard(title, value, color, desc) {
        return (
            '<div class="ai-stat-card" ' +
            (desc ? 'title="' + window.escapeHtml(desc) + '"' : '') +
            ' style="background:var(--bg-card);border:1px solid var(--border-glass);border-radius:var(--radius-md);padding:12px;text-align:center">' +
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
                statCard(
                    'Wzorce łacznie',
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
                    'Rekomendacje',
                    stats.totalRecommendations,
                    'var(--accent2)',
                    'Liczba rekomendacji wygenerowanych przez Learning Engine'
                ) +
                statCard(
                    'Zaakceptowane',
                    stats.acceptedRecommendations,
                    'var(--success-hover)',
                    'Liczba rekomendacji zaakceptowanych przez użytkownika'
                ) +
                statCard(
                    'Odrzucone',
                    stats.rejectedRecommendations,
                    'var(--danger-hover)',
                    'Liczba rekomendacji odrzuconych przez użytkownika'
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
                    ? '<div style="background:var(--bg-card);border-radius:var(--radius-md);padding:12px;margin-bottom:16px;border:1px solid var(--border-glass)">' +
                      '<h4 style="margin:0 0 8px;font-size:0.82rem;color:var(--text-primary);display:flex;align-items:center;gap:6px"><i data-lucide="pie-chart" style="width:14px;height:14px;color:var(--accent)"></i> Rozk\u0142ad wg typu</h4>' +
                      Object.keys(stats.byPatternType)
                          .map(function (k) {
                              return (
                                  '<div style="display:flex;justify-content:space-between;border-bottom:1px solid var(--border-glass);padding:5px 0;font-size:0.8rem">' +
                                  '<span style="color:var(--text-secondary)">' +
                                  window.escapeHtml(k) +
                                  '</span>' +
                                  '<strong style="color:var(--text-primary)">' +
                                  window.escapeHtml(stats.byPatternType[k]) +
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
                        '<tr style="border-bottom:1px solid var(--border-glass)">' +
                        '<td style="padding:6px"><code style="background:var(--bg-tertiary);padding:2px 6px;border-radius:4px;font-size:0.72rem;color:var(--accent-text)">' +
                        window.escapeHtml(p.patternType || '') +
                        '</code></td>' +
                        '<td style="padding:6px;font-family:monospace;font-size:0.7rem;color:var(--text-secondary);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
                        window.escapeHtml((p.patternKey || '').slice(0, 60)) +
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
                        window.escapeHtml((p.description || '').slice(0, 80)) +
                        '</td>' +
                        '</tr>'
                    );
                })
                .join('');
            container.innerHTML =
                '<div style="overflow-x:auto;border-radius:var(--radius-sm);border:1px solid var(--border-glass)">' +
                '<table style="width:100%;border-collapse:collapse;color:var(--text-primary);font-size:0.82rem">' +
                '<thead><tr style="background:var(--bg-tertiary);color:var(--text-muted);font-size:0.68rem;text-transform:uppercase;letter-spacing:0.4px">' +
                '<th style="padding:6px;text-align:left;font-weight:700" title="Typ wykrytego wzorca">Typ</th>' +
                '<th style="padding:6px;text-align:left;font-weight:700" title="Klucz wzorca">Pattern</th>' +
                '<th style="padding:6px;text-align:right;font-weight:700" title="Poziom ufno\u015bci dla wzorca (0-100%)">Confidence</th>' +
                '<th style="padding:6px;text-align:right;font-weight:700" title="Liczba trafie\u0144 (zastosowa\u0144 wzorca)">Hits</th>' +
                '<th style="padding:6px;text-align:left;font-weight:700" title="Opis wzorca">Opis</th>' +
                '</tr></thead><tbody>' +
                rows +
                '</tbody></table></div>';
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
            '<div style="font-size:0.82rem;line-height:1.45">' +
            msg +
            '</div></div>'
        );
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
            var inf = status.aiInfluencePct || 0;
            var activeVer = status.modelVersion || '—';
            var activeAuc =
                status.activeModelAuc != null ? ' AUC ' + status.activeModelAuc.toFixed(4) : '';
            var html =
                '<h4 class="ai-ml-header"><i data-lucide="activity"></i> ML Pipeline</h4>' +
                '<div class="ai-ml-stats-grid">' +
                statCard(
                    'Status',
                    statusBadge(online),
                    online ? 'var(--success)' : 'var(--danger)',
                    "Status pipeline'a ML — online (działa) lub offline (wyłączony)"
                ) +
                statCard(
                    'Wersja modelu',
                    window.escapeHtml(activeVer) + activeAuc,
                    'var(--accent2)',
                    'Aktualnie wykorzystywany model ML (wersja + AUC + data wdrożenia)'
                ) +
                statCard(
                    'Data wdrożenia',
                    (status.activeModelCreatedAt || '—').slice(0, 10),
                    'var(--accent-hover)',
                    'Kiedy aktywny model został wdrożony'
                ) +
                statCard(
                    'Liczba modeli',
                    status.modelCount || 0,
                    'var(--accent-hover)',
                    'Całkowita liczba zapisanych modeli w rejestrze'
                ) +
                statCard(
                    'Trening trwa',
                    status.trainingRunning ? 'Tak' : 'Nie',
                    status.trainingRunning ? 'var(--warn)' : 'var(--success)',
                    'Czy w tej chwili trwa trenowanie modelu'
                ) +
                statCard(
                    'Nagrody (reward)',
                    status.totalRewards || 0,
                    'var(--cyan)',
                    'Suma nagród (reward) zebranych przez model za trafne predykcje'
                ) +
                statCard(
                    'Cache predykcji',
                    status.cacheSize || 0,
                    'var(--text-muted)',
                    "Rozmiar cache'a predykcji w pamięci (liczba zapisanych wyników)"
                ) +
                '</div>' +
                '<div class="ai-influence-widget" style="background:var(--bg-card);border:1px solid var(--border-glass);border-radius:var(--radius-md);padding:12px;margin-top:10px">' +
                '<label style="display:flex;align-items:center;gap:10px;cursor:pointer" title="Procentowy wp\u0142yw AI na ranking produkt\u00f3w (0% = tylko ludzkie preferencje, 100% = w pe\u0142ni automatyczny)">' +
                '<i data-lucide="sliders-horizontal" style="width:16px;height:16px;color:var(--accent);flex-shrink:0"></i>' +
                '<span style="font-size:0.82rem;color:var(--text-primary);white-space:nowrap">Wp\u0142yw AI: <strong id="ai-influence-value">' +
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
                              '<button class="ai-model-activate-btn" data-id="' +
                              window.escapeHtml(m.id || '') +
                              '" title="Ustaw ten model jako aktywny"><i data-lucide="check-circle"></i></button>' +
                              '<button class="ai-model-delete-btn" data-id="' +
                              window.escapeHtml(m.id || '') +
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
                        var featureCount = Array.isArray(m.features)
                            ? m.features.length
                            : (safeJson(m.features) || []).length;
                        return (
                            '<tr' +
                            rowClass +
                            '>' +
                            '<td>' +
                            window.escapeHtml(m.version || '—') +
                            (m.active ? '<span class="ai-model-used-tag">W UŻYCIU</span>' : '') +
                            '</td>' +
                            '<td>' +
                            (rocAuc != null ? rocAuc.toFixed(4) : '—') +
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
                    '<th title="Liczba cech u\u017cywanych przez model do predykcji">Cechy</th>' +
                    '<th title="Liczba próbek treningowych u\u017cytych do wytrenowania modelu">Próbki</th>' +
                    '<th title="Wersja schematu cech u\u017cytego do trenowania modelu">Wersja cech</th>' +
                    '<th title="Czy model jest aktualnie aktywny">Status</th>' +
                    '<th title="Ustaw aktywny model lub usuń go (aktywnego nie można usunąć)">Akcja</th>' +
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
                        var p = fetchJson(ENDPOINTS.settings || '/api/telemetry/ai/settings', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ value: val })
                        });
                        if (p) {
                            p.then(function () {
                                if (typeof window.showToast === 'function')
                                    window.showToast('AI Influence: ' + val + '%', 'info');
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
            var modelTableWrap = container.querySelector('.ai-model-table-wrap');
            if (modelTableWrap) {
                modelTableWrap.addEventListener('click', function (ev) {
                    var btn = ev.target.closest ? ev.target.closest('.ai-model-delete-btn') : null;
                    if (!btn) return;
                    ev.preventDefault();
                    uiConfirm('Na pewno usunąć ten model ML?', {
                        title: 'Usuwanie modelu ML',
                        okText: 'Usuń',
                        type: 'danger'
                    }).then(function (confirmed) {
                        if (!confirmed) return;
                        var id = btn.getAttribute('data-id');
                        var p = fetchJson(ENDPOINTS.models + '/' + encodeURIComponent(id), {
                            method: 'DELETE'
                        });
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
                            });
                        } else {
                            uiAlert('Brak dostępu do usuwania modeli ML.', {
                                title: 'Błąd usuwania',
                                type: 'warning'
                            });
                        }
                    });
                });
                modelTableWrap.addEventListener('click', function (ev) {
                    var btn = ev.target.closest
                        ? ev.target.closest('.ai-model-activate-btn')
                        : null;
                    if (!btn) return;
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
                        var id = btn.getAttribute('data-id');
                        var p = fetchJson(
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
                            });
                        } else {
                            uiAlert('Brak dostępu do zmiany modelu ML.', {
                                title: 'Błąd zmiany',
                                type: 'warning'
                            });
                        }
                    });
                });
            }
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
                                uiAlert(
                                    'Trening ML zakończony:\n' +
                                        'Wytrenowany: ' +
                                        (result.trained ? 'Tak' : 'Nie') +
                                        (result.reason ? '\nPowód: ' + result.reason : ''),
                                    { title: 'Trening ML', type: 'info' }
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
                        var p = fetchJson(ENDPOINTS.rollback, { method: 'POST' });
                        if (p) {
                            p.then(function (result) {
                                rollbackBtn.disabled = false;
                                rollbackBtn.innerHTML =
                                    '<i data-lucide="undo-2"></i> Rollback modelu';
                                if (result && result.rolledBack) {
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
                            });
                        } else {
                            rollbackBtn.disabled = false;
                            rollbackBtn.innerHTML = '<i data-lucide="undo-2"></i> Rollback modelu';
                            uiAlert('Brak dostępu do rollbacku modelu ML.', {
                                title: 'Rollback modelu',
                                type: 'warning'
                            });
                        }
                    });
                });
            }
        });
    }

    /* ===== FEATURE IMPORTANCE ===== */
    /* GET /api/telemetry/ai/feature-importance zwraca { modelVersion, features: [{featureName, importance}] }
       posortowane malejąco wg importance. 503 (brak aktywnego modelu) jest normalizowane przez fetchJson
       na {error:'server'} — dla pustej listy cech pokazujemy komunikat o braku modelu. */
    function renderFeatureImportance(container) {
        var p = fetchJson(ENDPOINTS.featureImportance);
        if (!p) {
            container.innerHTML = apiErrorHtml('server');
            return;
        }
        p.then(function (data) {
            if (!data) {
                container.innerHTML = apiErrorHtml('server');
                return;
            }
            if (data.error === 'forbidden' || data.error === 'server') {
                container.innerHTML = apiErrorHtml(data.error);
                return;
            }
            var feats = data.features || [];
            if (!Array.isArray(feats) || feats.length === 0) {
                container.innerHTML =
                    '<div style="color:var(--text-muted);background:var(--bg-tertiary);border:1px solid var(--border-glass);border-radius:var(--radius-sm);padding:12px;font-size:0.82rem">Brak aktywnego modelu — uruchom trening ML, aby zobaczyć ważność cech.</div>';
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
                        '<div style="display:flex;justify-content:space-between;font-size:0.76rem;margin-bottom:2px">' +
                        '<span style="color:var(--text-secondary)">' +
                        window.escapeHtml(f.featureName || '—') +
                        '</span>' +
                        '<span style="color:var(--text-primary);font-weight:600">' +
                        val.toFixed(4) +
                        '</span>' +
                        '</div>' +
                        '<div style="background:var(--bg-tertiary);border-radius:4px;height:8px;overflow:hidden">' +
                        '<div style="width:' +
                        pct +
                        '%;height:100%;background:var(--accent);border-radius:4px"></div>' +
                        '</div>' +
                        '</div>'
                    );
                })
                .join('');
            container.innerHTML =
                '<div style="background:var(--bg-card);border:1px solid var(--border-glass);border-radius:var(--radius-md);padding:12px;margin-top:10px">' +
                '<h4 style="margin:0 0 4px;font-size:0.82rem;color:var(--text-primary);display:flex;align-items:center;gap:6px"><i data-lucide="bar-chart-3" style="width:14px;height:14px;color:var(--accent)"></i> Feature Importance</h4>' +
                '<div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:10px">Ważność cech aktywnego modelu: <strong>' +
                window.escapeHtml(data.modelVersion || '—') +
                '</strong></div>' +
                rows +
                '</div>';
            if (typeof lucide !== 'undefined') {
                lucide.createIcons({ root: container });
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
            '<button id="ai-filter-btn" class="btn-hero" style="padding:0.35rem 0.8rem;font-size:0.78rem" title="Filtruj wzorce po \u015brednicy nominalnej (DN)"><i data-lucide="filter"></i> Filtruj</button>' +
            '<button id="ai-run-cycle" class="btn-hero btn-accent" style="padding:0.35rem 0.8rem;font-size:0.78rem" title="Uruchamia cykl uczenia — analizuje dane telemetryczne i wykrywa nowe wzorce"><i data-lucide="refresh-cw"></i> Uruchom Learning Cycle</button>' +
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
            '</div>';

        renderStats(document.getElementById('ai-stats'));
        renderMlStatus(document.getElementById('ai-ml-status'));
        renderFeatureImportance(document.getElementById('ai-feature-importance'));
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
