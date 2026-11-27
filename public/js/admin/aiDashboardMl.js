(function () {
    'use strict';

    const renderRequestTokens = new WeakMap();

    function setModelRowBusy(button, isBusy) {
        const actionCell = button.closest('.ai-model-actions-cell');
        if (!actionCell) return;
        actionCell.setAttribute('aria-busy', String(isBusy));
        actionCell.querySelectorAll('button').forEach(function (actionButton) {
            actionButton.disabled = isBusy;
            if (isBusy) actionButton.setAttribute('aria-busy', 'true');
            else actionButton.removeAttribute('aria-busy');
        });
    }

    function getEndpoints() {
        return window.AI_ENDPOINTS || {};
    }

    function countLabel(value) {
        return value == null || !Number.isFinite(Number(value))
            ? '—'
            : new Intl.NumberFormat('pl-PL').format(Number(value));
    }

    function setRefreshState(container, text, isBusy) {
        const state = container.querySelector('.ai-ml-refresh-state');
        const button = container.querySelector('.ai-ml-refresh-btn');
        if (state) state.textContent = text;
        if (button) button.disabled = Boolean(isBusy);
    }

    function renderPredictionStats(container) {
        const host = container.querySelector('.ai-prediction-stats-host');
        if (!host) return;
        host.innerHTML = window.aiLoadingHtml();
        const endpoint = getEndpoints().predictionsStats;
        const request = endpoint && window.fetchJson(endpoint);
        if (!request) {
            host.innerHTML = window.aiApiErrorHtml('unavailable');
            return;
        }
        request
            .then(function (stats) {
                if (!stats || stats.error) {
                    host.innerHTML = window.aiApiErrorHtml(
                        stats && stats.error ? stats.error : 'server'
                    );
                    return;
                }
                const actionCounts =
                    stats.actions && typeof stats.actions === 'object'
                        ? Object.keys(stats.actions)
                              .sort()
                              .map(function (action) {
                                  return (
                                      '<li><span>' +
                                      window.escapeHtml(action) +
                                      '</span><strong>' +
                                      countLabel(stats.actions[action]) +
                                      '</strong></li>'
                                  );
                              })
                        : [];
                const refreshedAt = new Date().toLocaleString('pl-PL');
                host.innerHTML =
                    '<div class="ai-section-title"><i data-lucide="bar-chart-3" aria-hidden="true"></i> Akcje i próbki predykcji</div>' +
                    '<div class="ai-ml-source-note">Źródło: /ai/predictions/stats · zakres: historyczne zdarzenia reward; score z ostatnich max. 100 rekordów · odczyt: ' +
                    window.escapeHtml(refreshedAt) +
                    '</div>' +
                    '<div class="ai-prediction-stats-grid">' +
                    window.aiStatCard(
                        'Zdarzenia reward',
                        countLabel(stats.total),
                        'var(--cyan)',
                        'Łączna liczba rekordów aiRewardLog; nie jest to suma wartości reward.'
                    ) +
                    window.aiStatCard(
                        'Próbki ze score',
                        countLabel(stats.recentCount),
                        'var(--accent2)',
                        'Liczba rekordów scoreBefore w próbce ostatnich maksymalnie 100 zdarzeń.'
                    ) +
                    '<div class="ai-prediction-action-breakdown"><strong>Rozkład zdarzeń</strong>' +
                    (actionCounts.length
                        ? '<ul>' + actionCounts.join('') + '</ul>'
                        : '<div class="ai-model-empty">Brak rozkładu akcji.</div>') +
                    '</div></div>' +
                    (Number(stats.total) === 0
                        ? '<div class="ai-model-empty">Brak zdarzeń reward (0).</div>'
                        : '');
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons({ root: host });
                }
            })
            .catch(function () {
                host.innerHTML = window.aiApiErrorHtml('server');
            });
    }

    // F3: czysta prezentacja strukturalnego statusu bramki z backendu
    // (trainingGate z /ai/ml-status). Zero logiki decyzyjnej po stronie UI.
    function gateCards(gate) {
        const g = gate || {};
        const fmtHours = function (v) {
            return v != null && Number.isFinite(Number(v)) ? Number(v).toFixed(1) + 'h' : 'brak';
        };
        const last = g.lastAttempt || null;
        const lastValue = last ? window.escapeHtml(last.status || '—') : 'brak prób';
        const lastStatus = last ? last.status || '' : '';
        const lastColor = !last
            ? 'var(--text-muted)'
            : lastStatus === 'SUCCESS'
              ? 'var(--success)'
              : lastStatus === 'RUNNING' || lastStatus === 'SKIPPED'
                ? 'var(--warn)'
                : lastStatus.indexOf('FAILED') === 0
                  ? 'var(--danger)'
                  : 'var(--text-muted)';
        const lastTooltip = last
            ? [last.reason || '', (last.startedAt || '').slice(0, 16)]
                  .filter(function (s) {
                      return Boolean(s);
                  })
                  .join(' / ') || 'Brak szczegółów ostatniej próby'
            : 'Brak zapisanych przebiegów treningu';
        return [
            window.aiStatCard(
                'Gotowy do treningu',
                g.eligible ? 'Tak' : 'Nie',
                g.eligible ? 'var(--success)' : 'var(--warn)',
                'Decyzja bramki shouldTrain (SSoT z backendu): czy próba treningu ma sens'
            ),
            window.aiStatCard(
                'Powód bramki',
                window.escapeHtml(g.reason || '—'),
                g.reason === 'ok' ? 'var(--success)' : 'var(--text-muted)',
                'ok / already_running / too_soon / insufficient_new_data (backend, nie UI)'
            ),
            window.aiStatCard(
                'Nowe dane',
                (g.newSinceLastTrain != null ? g.newSinceLastTrain : '—') +
                    ' / ' +
                    (g.minNewData != null ? g.minNewData : 50),
                'var(--accent-text)',
                'Kwalifikujące nowe rekordy od ostatniego SUCCESS na tle progu (ta sama definicja co w pipeline)'
            ),
            window.aiStatCard(
                'Od SUCCESS',
                fmtHours(g.hoursSinceLastTrain),
                'var(--accent-hover)',
                'Czas od zakończonego treningu (minimum ' +
                    (g.minHoursSinceLastTrain != null ? g.minHoursSinceLastTrain : 4) +
                    'h)' +
                    (g.nextEligibleAt ? '. Kolejny możliwy: ' + g.nextEligibleAt.slice(0, 16) : ''),
                g.nextEligibleAt
                    ? 'Kolejny trening możliwy od ' + g.nextEligibleAt.slice(0, 16)
                    : 'Brak poprzedniego SUCCESS (first-run) lub bramka czasowa spełniona'
            ),
            window.aiStatCard(
                'Ostatnia próba',
                lastValue,
                lastColor,
                'Ostatnia RZECZYWISTA próba treningu (AiTrainingRun) — osobna informacja historyczna, nie decyzja bramki. ' +
                    'Pokazuje m.in. split_guard, gdy bramka przepuściła, a trening zatrzymał się na guardach.',
                lastTooltip
            )
        ];
    }

    function renderMlStatus(container) {
        const requestToken = (renderRequestTokens.get(container) || 0) + 1;
        renderRequestTokens.set(container, requestToken);
        const isRefresh = Boolean(container.querySelector('.ai-ml-refresh-btn'));
        if (isRefresh) {
            setRefreshState(container, 'Odświeżanie…', true);
        } else {
            container.innerHTML = window.aiLoadingHtml();
        }
        const renderError = function (errorCode) {
            if (isRefresh && errorCode !== 'forbidden' && errorCode !== 'unauthorized') {
                setRefreshState(container, 'Dane nieaktualne — nie udało się odświeżyć.', false);
                return;
            }
            container.innerHTML = window.aiApiErrorHtml(errorCode);
        };
        const ENDPOINTS = getEndpoints();
        const pStatus = window.fetchJson(ENDPOINTS.mlStatus);
        const pModels = window.fetchJson(ENDPOINTS.models);
        if (!pStatus) {
            renderError('unavailable');
            return;
        }
        Promise.all([pStatus, pModels])
            .then(function (results) {
                if (renderRequestTokens.get(container) !== requestToken) return;
                const status = results[0];
                const modelsData = results[1];
                if (!status || status.error) {
                    renderError(status && status.error ? status.error : 'server');
                    return;
                }
                if (modelsData && modelsData.error) {
                    renderError(modelsData.error);
                    return;
                }
                const online = status.mlOnline;
                const untrained = online && status.modelTrained === false;
                const inf = status.aiInfluencePct || 0;
                const activeVer = status.modelVersion || '—';
                const rollbackTargetVersion = status.rollbackTargetVersion || null;
                const rollbackTargetLabel = rollbackTargetVersion
                    ? ' (' + window.escapeHtml(rollbackTargetVersion) + ')'
                    : '';
                const activeAuc =
                    !untrained &&
                    status.activeModelAuc != null &&
                    Number.isFinite(Number(status.activeModelAuc))
                        ? ' AUC ' + Number(status.activeModelAuc).toFixed(4)
                        : '';
                const m = untrained ? {} : status.activeModelMetrics || {};
                const fmt = function (v, d) {
                    return v != null && Number.isFinite(Number(v))
                        ? Number(v).toFixed(d == null ? 4 : d)
                        : '—';
                };
                // P1.4: ROC-AUC i baseline accuracy to RÓŻNE metryki — nigdy ich
                // nie odejmujemy (odejmowanie sugerowało fałszywe "pp vs reguł").
                const baselineAccuracy =
                    status.baselineAccuracy != null &&
                    Number.isFinite(Number(status.baselineAccuracy))
                        ? Number(status.baselineAccuracy)
                        : null;
                const mlGroup = function (label, gridClass, cards) {
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
                const refreshedAt = new Date().toLocaleString('pl-PL');
                let html =
                    '<div class="ai-ml-toolbar"><h4 class="ai-ml-header"><i data-lucide="activity"></i> ML Pipeline</h4>' +
                    '<div class="ai-ml-refresh-controls"><span class="ai-ml-source-note">Źródło: /ai/ml-status i /ai/models</span><span class="ai-ml-updated-at">Ostatnia aktualizacja: ' +
                    window.escapeHtml(refreshedAt) +
                    '</span><span class="ai-ml-refresh-state" role="status" aria-live="polite"></span><button type="button" class="ai-btn ai-ml-refresh-btn" aria-label="Odśwież status AI/ML" title="Pobierz aktualne dane"><i data-lucide="refresh-cw" aria-hidden="true"></i> Odśwież</button></div></div>' +
                    mlGroup('Status i model', 'ai-ml-col-5', [
                        window.aiStatCard(
                            'Status',
                            untrained ? 'Model bez treningu' : window.aiStatusBadge(online),
                            untrained ? 'var(--warn)' : online ? 'var(--success)' : 'var(--danger)',
                            'Dostępność modelu i informacja, czy użyto próbek treningowych.'
                        ),
                        window.aiStatCard(
                            'Wersja modelu',
                            window.escapeHtml(activeVer) + activeAuc,
                            'var(--accent2-hover)',
                            'Aktualnie wykorzystywany model ML (wersja + AUC + data wdrożenia)',
                            activeVer + activeAuc
                        ),
                        window.aiStatCard(
                            'Utworzono model',
                            (status.activeModelCreatedAt || '—').slice(0, 10),
                            'var(--accent-hover)',
                            'Data utworzenia aktywnego modelu'
                        ),
                        window.aiStatCard(
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
                        window.aiStatCard(
                            'Trening trwa',
                            status.trainingRunning ? 'Tak' : 'Nie',
                            status.trainingRunning ? 'var(--warn)' : 'var(--success)',
                            'Czy w tej chwili trwa trenowanie modelu'
                        )
                    ]) +
                    mlGroup('Jakość predykcji', 'ai-ml-col-5', [
                        window.aiStatCard(
                            'ROC-AUC modelu',
                            untrained ? '—' : fmt(status.activeModelAuc),
                            activeAuc ? 'var(--accent2)' : 'var(--text-muted)',
                            'Pole pod krzywą ROC aktywnego modelu (0.5 = losowo, 1.0 = idealnie). Osobna metryka — nieporównywalna 1:1 z accuracy.',
                            activeAuc ? 'ROC-' + activeAuc.trim() : 'Brak modelu z metryką ROC-AUC'
                        ),
                        window.aiStatCard(
                            'Baseline accuracy',
                            baselineAccuracy != null ? baselineAccuracy.toFixed(4) : '—',
                            baselineAccuracy != null
                                ? 'var(--text-secondary)'
                                : 'var(--text-muted)',
                            'Dokładność majority-class (max(positiveRate, 1-positiveRate) z ostatniego treningu). Punkt odniesienia dla accuracy, nie dla ROC-AUC.'
                        ),
                        window.aiStatCard(
                            'PR-AUC',
                            fmt(m.prAuc),
                            'var(--accent-text)',
                            'Precision-Recall AUC — jakość przy niezbalansowanych danych (im wyżej, tym lepiej)'
                        ),
                        window.aiStatCard(
                            'F1',
                            fmt(m.f1),
                            'var(--accent-hover)',
                            'Harmoniczna średnia precyzji i czułości'
                        ),
                        window.aiStatCard(
                            'LogLoss',
                            fmt(m.logLoss),
                            m.logLoss != null && Number(m.logLoss) <= 1.0
                                ? 'var(--success)'
                                : 'var(--warn)',
                            'Strata logarytmiczna — kalibracja prawdopodobieństw (im niżej, tym lepiej, ≤1.0 zalecane)'
                        ),
                        window.aiStatCard(
                            'ECE (Calibration)',
                            fmt(m.ece),
                            m.ece != null && Number(m.ece) <= 0.25
                                ? 'var(--success)'
                                : 'var(--warn)',
                            'Expected Calibration Error — odchylenie predykcji od rzeczywistych proporcji (≤0.25 zalecane)'
                        )
                    ]) +
                    mlGroup('Dane i operacje', 'ai-ml-col-3', [
                        window.aiStatCard(
                            'Wszystkie wektory historyczne',
                            countLabel(status.featureCount),
                            'var(--accent)',
                            'Wszystkie rekordy AiFeature w bazie, niezależnie od aktualnej kwalifikacji do treningu.',
                            'Źródło: /ai/ml-status · Zakres: pełna historia AiFeature · Ostatni odczyt: ' +
                                refreshedAt
                        ),
                        window.aiStatCard(
                            'Historyczne z etykietą',
                            countLabel(status.labeledCount),
                            'var(--text-secondary)',
                            'Wektory historyczne z etykietą ACCEPTED, ACCEPTED_AFTER_MODIFICATION, REJECTED lub MODIFIED.',
                            'Źródło: /ai/ml-status · Zakres: pełna historia AiFeature · ACCEPTED: ' +
                                ((status.labelCounts && status.labelCounts.accepted) || 0) +
                                ', REJECTED: ' +
                                ((status.labelCounts && status.labelCounts.rejected) || 0) +
                                ', MODIFIED: ' +
                                ((status.labelCounts && status.labelCounts.modified) || 0) +
                                ', NO_FEEDBACK: ' +
                                ((status.labelCounts && status.labelCounts.noFeedback) || 0) +
                                ' · Odczyt: ' +
                                refreshedAt
                        ),
                        window.aiStatCard(
                            'Nowe kwalifikujące się od SUCCESS',
                            countLabel(
                                status.trainingGate && status.trainingGate.newSinceLastTrain
                            ),
                            status.trainingGate && status.trainingGate.eligible
                                ? 'var(--success)'
                                : 'var(--warn)',
                            'Nowe próbki spełniające aktualne warunki treningu od ostatniego udanego przebiegu; nie jest to suma całego zbioru.',
                            'Źródło: trainingGate z /ai/ml-status · Zakres: od ostatniego SUCCESS · Ostatni odczyt: ' +
                                refreshedAt
                        ),
                        window.aiStatCard(
                            'Próbki ostatniego snapshotu',
                            countLabel(
                                status.lastTrainingSnapshot &&
                                    status.lastTrainingSnapshot.datasetSize
                            ),
                            'var(--accent2)',
                            'Liczba wszystkich próbek wykorzystanych w ostatnim udanym przebiegu aktywnego modelu.',
                            'Źródło: AiTrainingRun w /ai/ml-status · Dataset: ' +
                                countLabel(
                                    status.lastTrainingSnapshot &&
                                        status.lastTrainingSnapshot.datasetSize
                                ) +
                                ' (train: ' +
                                countLabel(
                                    status.lastTrainingSnapshot &&
                                        status.lastTrainingSnapshot.trainSize
                                ) +
                                ', validation: ' +
                                countLabel(
                                    status.lastTrainingSnapshot &&
                                        status.lastTrainingSnapshot.validationSize
                                ) +
                                ', test: ' +
                                countLabel(
                                    status.lastTrainingSnapshot &&
                                        status.lastTrainingSnapshot.testSize
                                ) +
                                ') · Odczyt: ' +
                                refreshedAt
                        ),
                        window.aiStatCard(
                            'Zdarzenia reward',
                            countLabel(status.totalRewards),
                            'var(--cyan)',
                            'Liczba rekordów aiRewardLog wszystkich akcji. To licznik zdarzeń, nie suma wartości reward.',
                            'Źródło: /ai/ml-status · Zakres: wszystkie historyczne rekordy aiRewardLog · Ostatni odczyt: ' +
                                refreshedAt
                        ),
                        window.aiStatCard(
                            'Cache predykcji',
                            status.cacheSize || 0,
                            'var(--text-muted)',
                            "Rozmiar cache'a predykcji w pamięci (liczba zapisanych wyników)"
                        )
                    ]) +
                    mlGroup('Bramka treningu', 'ai-ml-col-5', gateCards(status.trainingGate)) +
                    '<div class="ai-influence-widget">' +
                    '<label style="display:flex;align-items:center;gap:10px;cursor:pointer" title="Procentowy wp\u0142yw AI na ranking produkt\u00f3w (0% = tylko ludzkie preferencje, 100% = w pe\u0142ni automatyczny)">' +
                    '<i data-lucide="sliders-horizontal" class="icon-sm" style="color:var(--accent-text);flex-shrink:0"></i>' +
                    '<span style="font-size: var(--fs-md);color:var(--text-primary);white-space:nowrap">Wp\u0142yw AI: <strong id="ai-influence-value">' +
                    inf +
                    '%</strong></span>' +
                    '<input type="range" id="ai-influence-slider" min="0" max="100" value="' +
                    inf +
                    '" style="flex:1;min-width:80px;height:6px;accent-color:var(--accent);cursor:pointer">' +
                    '</label>' +
                    '</div>';
                html +=
                    '<div class="ai-ml-actions">' +
                    '<button id="ai-ml-train-btn" class="ai-ml-train-btn" title="Uruchamia trenowanie modelu ML na zebranych danych telemetrycznych"><i data-lucide="play"></i> Uruchom trening ML</button>' +
                    '<button id="ai-ml-rollback-btn" class="ai-ml-rollback-btn" ' +
                    (rollbackTargetVersion ? '' : 'disabled ') +
                    'title="' +
                    (rollbackTargetVersion
                        ? 'Cofnij do modelu ' + window.aiEscapeHtmlAttr(rollbackTargetVersion)
                        : 'Brak poprzedniego modelu do rollbacku') +
                    '"><i data-lucide="undo-2"></i> Rollback modelu' +
                    rollbackTargetLabel +
                    '</button>' +
                    '</div>';
                let modelRows = '';
                if (modelsData && modelsData.models && modelsData.models.length > 0) {
                    modelRows = modelsData.models
                        .map(function (mm) {
                            const statusHtml = mm.active
                                ? '<span class="ai-model-active">● Aktywny</span>'
                                : (mm.createdAt || '').slice(0, 10);
                            const rowClass = mm.active ? ' class="ai-model-row-active"' : '';
                            const delBtn = mm.active
                                ? ''
                                : '<div class="ai-model-actions-cell">' +
                                  '<button class="ai-model-promote-btn" data-id="' +
                                  window.aiEscapeHtmlAttr(mm.id || '') +
                                  '" data-version="' +
                                  window.aiEscapeHtmlAttr(mm.version || '—') +
                                  '" title="Promuj model ' +
                                  window.aiEscapeHtmlAttr(mm.version || '—') +
                                  ' do produkcji" aria-label="Promuj model ' +
                                  window.aiEscapeHtmlAttr(mm.version || '—') +
                                  '"><i data-lucide="rocket"></i></button>' +
                                  '<button class="ai-model-activate-btn" data-id="' +
                                  window.aiEscapeHtmlAttr(mm.id || '') +
                                  '" data-version="' +
                                  window.aiEscapeHtmlAttr(mm.version || '—') +
                                  '" title="Ustaw model ' +
                                  window.aiEscapeHtmlAttr(mm.version || '—') +
                                  ' jako aktywny" aria-label="Ustaw model ' +
                                  window.aiEscapeHtmlAttr(mm.version || '—') +
                                  ' jako aktywny"><i data-lucide="check-circle"></i></button>' +
                                  '<button class="ai-model-delete-btn" data-id="' +
                                  window.aiEscapeHtmlAttr(mm.id || '') +
                                  '" data-version="' +
                                  window.aiEscapeHtmlAttr(mm.version || '—') +
                                  '" title="Usuń model ' +
                                  window.aiEscapeHtmlAttr(mm.version || '—') +
                                  '" aria-label="Usuń model ' +
                                  window.aiEscapeHtmlAttr(mm.version || '—') +
                                  '"><i data-lucide="trash-2"></i></button>' +
                                  '</div>';
                            const metrics =
                                mm.trainingRows > 0 ? window.aiSafeJson(mm.metrics) : null;
                            const rocAuc =
                                metrics &&
                                metrics.rocAuc != null &&
                                Number.isFinite(Number(metrics.rocAuc))
                                    ? Number(metrics.rocAuc)
                                    : null;
                            const prAuc =
                                metrics &&
                                metrics.prAuc != null &&
                                Number.isFinite(Number(metrics.prAuc))
                                    ? Number(metrics.prAuc)
                                    : null;
                            const f1 =
                                metrics && metrics.f1 != null && Number.isFinite(Number(metrics.f1))
                                    ? Number(metrics.f1)
                                    : null;
                            const featureCount = Array.isArray(mm.features)
                                ? mm.features.length
                                : (window.aiSafeJson(mm.features) || []).length;
                            return (
                                '<tr' +
                                rowClass +
                                '>' +
                                '<td>' +
                                window.escapeHtml(mm.version || '—') +
                                (mm.active
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
                                (mm.trainingRows || 0) +
                                '</td>' +
                                '<td>' +
                                window.escapeHtml(mm.featureVersion || '—') +
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
                        '<th scope="col" title="Wersja modelu">Wersja</th>' +
                        '<th scope="col" title="Area Under Curve — miara jako\u015bci modelu (im wy\u017cej, tym lepiej)">AUC</th>' +
                        '<th scope="col" title="Precision-Recall AUC — jako\u015b\u0107 przy niezbalansowanych danych">PR-AUC</th>' +
                        '<th scope="col" title="Harmoniczna \u015brednia precyzji i czu\u0142o\u015bci">F1</th>' +
                        '<th scope="col" title="Liczba cech u\u017cywanych przez model do predykcji">Cechy</th>' +
                        '<th scope="col" title="Liczba próbek treningowych u\u017cytych do wytrenowania modelu">Próbki</th>' +
                        '<th scope="col" title="Wersja schematu cech u\u017cytego do trenowania modelu">Wersja cech</th>' +
                        '<th scope="col" title="Czy model jest aktualnie aktywny">Status</th>' +
                        '<th scope="col" title="Promuj do produkcji, ustaw aktywny model lub usuń go (aktywnego nie można usunąć)">Akcja</th>' +
                        '</tr></thead><tbody>' +
                        modelRows +
                        '</tbody></table></div>';
                } else {
                    html +=
                        '<div class="ai-model-empty">Brak wytrenowanych modeli. Uruchom trening ML.</div>';
                }
                html +=
                    '<div class="ai-training-sources-host" style="margin-bottom:28px"></div>' +
                    '<div class="ai-training-runs-host" style="margin-bottom:28px"></div>' +
                    '<div class="ai-prediction-stats-host"></div>' +
                    '<div class="ai-drift-host"></div>';
                container.innerHTML = html;
                const refreshButton = container.querySelector('.ai-ml-refresh-btn');
                if (refreshButton) {
                    refreshButton.addEventListener('click', function () {
                        renderMlStatus(container);
                    });
                }
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons({ root: container });
                }
                window.aiRenderTrainingSources(container);
                window.aiRenderTrainingRuns(container);
                renderPredictionStats(container);
                window.aiRenderDrift(container);
                const aiSlider = document.getElementById('ai-influence-slider');
                const aiValueLabel = document.getElementById('ai-influence-value');
                let aiSaveTimer = null;
                if (aiSlider && aiValueLabel) {
                    aiSlider.addEventListener('input', function () {
                        aiValueLabel.textContent = this.value + '%';
                    });
                    aiSlider.addEventListener('change', function () {
                        if (aiSaveTimer) clearTimeout(aiSaveTimer);
                        aiSaveTimer = setTimeout(function () {
                            const val = aiSlider ? aiSlider.value : '0';
                            const p = window.fetchJson(getEndpoints().settings, {
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
                const trainBtn = document.getElementById('ai-ml-train-btn');
                const rollbackBtn = document.getElementById('ai-ml-rollback-btn');
                const mlContainer = container;
                const modelTableWrap = container.querySelector('.ai-model-table-wrap');
                if (modelTableWrap) {
                    modelTableWrap.addEventListener('click', function (ev) {
                        const deleteBtn = ev.target.closest
                            ? ev.target.closest('.ai-model-delete-btn')
                            : null;
                        const activateBtn = ev.target.closest
                            ? ev.target.closest('.ai-model-activate-btn')
                            : null;
                        const promoteBtn = ev.target.closest
                            ? ev.target.closest('.ai-model-promote-btn')
                            : null;
                        if (promoteBtn) {
                            ev.preventDefault();
                            window
                                .aiUiConfirm(
                                    'Promować model ' +
                                        (promoteBtn.getAttribute('data-version') || '—') +
                                        ' do produkcji? Obecnie produkcyjny model zostanie zastąpiony (rollback możliwy).',
                                    { title: 'Promocja modelu', okText: 'Promuj', type: 'info' }
                                )
                                .then(function (confirmed) {
                                    if (!confirmed) return;
                                    const id = promoteBtn.getAttribute('data-id');
                                    setModelRowBusy(promoteBtn, true);
                                    const pp = window.fetchJson(
                                        getEndpoints().promote +
                                            encodeURIComponent(id) +
                                            '/promote',
                                        { method: 'POST' }
                                    );
                                    if (pp) {
                                        pp.then(function (result) {
                                            if (result && result.promoted) {
                                                if (typeof window.showToast === 'function')
                                                    window.showToast(
                                                        'Promowano model: ' + result.model.version,
                                                        'success'
                                                    );
                                                window.aiRenderMlStatus(mlContainer);
                                            } else {
                                                window.aiUiAlert(
                                                    (result && result.error
                                                        ? result.error
                                                        : 'Nie udało się promować modelu.') +
                                                        ' Promować można modele APPROVED/CANDIDATE.',
                                                    { title: 'Błąd promocji', type: 'warning' }
                                                );
                                            }
                                        })
                                            .catch(function () {
                                                window.aiUiAlert('Błąd promocji modelu ML.', {
                                                    title: 'Błąd promocji',
                                                    type: 'warning'
                                                });
                                            })
                                            .finally(function () {
                                                if (promoteBtn.isConnected) {
                                                    setModelRowBusy(promoteBtn, false);
                                                }
                                            });
                                    } else {
                                        setModelRowBusy(promoteBtn, false);
                                    }
                                });
                            return;
                        }
                        if (deleteBtn) {
                            ev.preventDefault();
                            window
                                .aiUiConfirm(
                                    'Na pewno usunąć model ' +
                                        (deleteBtn.getAttribute('data-version') || '—') +
                                        '?',
                                    {
                                        title: 'Usuwanie modelu ML',
                                        okText: 'Usuń',
                                        type: 'danger'
                                    }
                                )
                                .then(function (confirmed) {
                                    if (!confirmed) return;
                                    const id = deleteBtn.getAttribute('data-id');
                                    setModelRowBusy(deleteBtn, true);
                                    const pp = window.fetchJson(
                                        getEndpoints().models + '/' + encodeURIComponent(id),
                                        { method: 'DELETE' }
                                    );
                                    if (pp) {
                                        pp.then(function (result) {
                                            if (result && result.deleted) {
                                                if (typeof window.showToast === 'function')
                                                    window.showToast(
                                                        'Usunięto model ML',
                                                        'success'
                                                    );
                                                window.aiRenderMlStatus(mlContainer);
                                            } else {
                                                window.aiUiAlert(
                                                    'Nie udało się usunąć modelu ML.',
                                                    { title: 'Błąd usuwania', type: 'warning' }
                                                );
                                            }
                                        })
                                            .catch(function () {
                                                window.aiUiAlert('Błąd usuwania modelu ML.', {
                                                    title: 'Błąd usuwania',
                                                    type: 'warning'
                                                });
                                            })
                                            .finally(function () {
                                                if (deleteBtn.isConnected) {
                                                    setModelRowBusy(deleteBtn, false);
                                                }
                                            });
                                    } else {
                                        setModelRowBusy(deleteBtn, false);
                                        window.aiUiAlert('Brak dostępu do usuwania modeli ML.', {
                                            title: 'Błąd usuwania',
                                            type: 'warning'
                                        });
                                    }
                                });
                            return;
                        }
                        if (activateBtn) {
                            ev.preventDefault();
                            window
                                .aiUiConfirm(
                                    'Ustawić model ' +
                                        (activateBtn.getAttribute('data-version') || '—') +
                                        ' jako aktywny? Obecnie aktywny model zostanie zastąpiony.',
                                    {
                                        title: 'Zmiana aktywnego modelu',
                                        okText: 'Użyj',
                                        type: 'info'
                                    }
                                )
                                .then(function (confirmed) {
                                    if (!confirmed) return;
                                    const id = activateBtn.getAttribute('data-id');
                                    setModelRowBusy(activateBtn, true);
                                    const pp = window.fetchJson(
                                        getEndpoints().models +
                                            '/' +
                                            encodeURIComponent(id) +
                                            '/activate',
                                        { method: 'POST' }
                                    );
                                    if (pp) {
                                        pp.then(function (result) {
                                            if (result && result.activated) {
                                                if (typeof window.showToast === 'function')
                                                    window.showToast(
                                                        'Aktywny model: ' + result.model.version,
                                                        'success'
                                                    );
                                                window.aiRenderMlStatus(mlContainer);
                                            } else {
                                                window.aiUiAlert(
                                                    'Nie udało się zmienić aktywnego modelu.',
                                                    { title: 'Błąd zmiany', type: 'warning' }
                                                );
                                            }
                                        })
                                            .catch(function () {
                                                window.aiUiAlert('Błąd zmiany aktywnego modelu.', {
                                                    title: 'Błąd zmiany',
                                                    type: 'warning'
                                                });
                                            })
                                            .finally(function () {
                                                if (activateBtn.isConnected) {
                                                    setModelRowBusy(activateBtn, false);
                                                }
                                            });
                                    } else {
                                        setModelRowBusy(activateBtn, false);
                                        window.aiUiAlert('Brak dostępu do zmiany modelu ML.', {
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
                        window
                            .aiUiConfirm(
                                'Uruchomić trening na ' +
                                    countLabel(
                                        status.trainingGate && status.trainingGate.newSinceLastTrain
                                    ) +
                                    ' nowych kwalifikujących się próbkach? Po walidacji system może wdrożyć nowy model. Aktualny model produkcyjny: ' +
                                    activeVer +
                                    '.',
                                {
                                    title: 'Trening modelu ML',
                                    okText: 'Uruchom trening',
                                    type: 'warning'
                                }
                            )
                            .then(function (confirmed) {
                                if (!confirmed) return;
                                trainBtn.disabled = true;
                                trainBtn.innerHTML =
                                    '<i data-lucide="loader" class="lucide-spin"></i> Trenowanie...';
                                const pp = window.fetchJson(getEndpoints().train, {
                                    method: 'POST'
                                });
                                if (pp) {
                                    pp.then(function (result) {
                                        trainBtn.disabled = false;
                                        trainBtn.innerHTML =
                                            '<i data-lucide="play"></i> Uruchom trening ML';
                                        if (result && !result.error) {
                                            window.aiUiAlert(
                                                'Trening ML zakończony:\n' +
                                                    'Wytrenowany: ' +
                                                    (result.trained ? 'Tak' : 'Nie') +
                                                    (result.reason
                                                        ? '\nPowód: ' + result.reason
                                                        : ''),
                                                { title: 'Trening ML', type: 'info' }
                                            );
                                            window.aiRenderMlStatus(mlContainer);
                                        } else {
                                            window.aiUiAlert(
                                                'Nie udało się uruchomić treningu ML.',
                                                {
                                                    title: 'Trening ML',
                                                    type: 'warning'
                                                }
                                            );
                                        }
                                    }).catch(function () {
                                        trainBtn.disabled = false;
                                        trainBtn.innerHTML =
                                            '<i data-lucide="play"></i> Uruchom trening ML';
                                        window.aiUiAlert('Błąd uruchamiania treningu ML.', {
                                            title: 'Trening ML',
                                            type: 'warning'
                                        });
                                    });
                                } else {
                                    trainBtn.disabled = false;
                                    trainBtn.innerHTML =
                                        '<i data-lucide="play"></i> Uruchom trening ML';
                                }
                            });
                    });
                }
                if (rollbackBtn) {
                    rollbackBtn.addEventListener('click', function () {
                        window
                            .aiUiConfirm(
                                'Cofnąć do modelu ' +
                                    rollbackTargetVersion +
                                    '? Obecny model ' +
                                    activeVer +
                                    ' zostanie zdezaktywowany.',
                                { title: 'Rollback modelu', okText: 'Rollback', type: 'warning' }
                            )
                            .then(function (confirmed) {
                                if (!confirmed) return;
                                rollbackBtn.disabled = true;
                                rollbackBtn.textContent = 'Rollback...';
                                const pp = window.fetchJson(getEndpoints().rollback, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        expectedActiveVersion: activeVer,
                                        expectedPreviousVersion: rollbackTargetVersion
                                    })
                                });
                                if (pp) {
                                    pp.then(function (result) {
                                        rollbackBtn.disabled = false;
                                        rollbackBtn.innerHTML =
                                            '<i data-lucide="undo-2"></i> Rollback modelu' +
                                            rollbackTargetLabel;
                                        if (result && !result.error && result.rolledBack) {
                                            window.aiUiAlert(
                                                'Rollback wykonany. Poprzedni model: ' +
                                                    (result.model ? result.model.version : '—'),
                                                { title: 'Rollback modelu', type: 'info' }
                                            );
                                            window.aiRenderMlStatus(mlContainer);
                                        } else {
                                            window.aiUiAlert(
                                                result && result.error === 'ROLLBACK_TARGET_CHANGED'
                                                    ? 'Modele zmieniły się od potwierdzenia. Odśwież dane i potwierdź ponownie.'
                                                    : 'Brak poprzedniego modelu do rollbacku.',
                                                { title: 'Rollback modelu', type: 'warning' }
                                            );
                                        }
                                    }).catch(function () {
                                        rollbackBtn.disabled = false;
                                        rollbackBtn.innerHTML =
                                            '<i data-lucide="undo-2"></i> Rollback modelu' +
                                            rollbackTargetLabel;
                                        window.aiUiAlert('Błąd rollbacku modelu ML.', {
                                            title: 'Rollback modelu',
                                            type: 'warning'
                                        });
                                    });
                                } else {
                                    rollbackBtn.disabled = false;
                                    rollbackBtn.innerHTML =
                                        '<i data-lucide="undo-2"></i> Rollback modelu' +
                                        rollbackTargetLabel;
                                    window.aiUiAlert('Brak dostępu do rollbacku modelu ML.', {
                                        title: 'Rollback modelu',
                                        type: 'warning'
                                    });
                                }
                            });
                    });
                }
            })
            .catch(function () {
                if (renderRequestTokens.get(container) !== requestToken) return;
                renderError('server');
            });
    }
    window.aiRenderMlStatus = renderMlStatus;
})();
