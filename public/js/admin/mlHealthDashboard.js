(function () {
    'use strict';

    const HEALTH_URL = '/api/telemetry/ai/health';

    /* fetchJson — wspólny helper z shared/ui.js (window.fetchJson) */

    function timeAgo(iso) {
        if (!iso) return '—';
        const diff = Date.now() - new Date(iso).getTime();
        const min = Math.floor(diff / 60000);
        if (min < 1) return 'przed chwilą';
        if (min < 60) return min + ' min temu';
        const h = Math.floor(min / 60);
        if (h < 24) return h + 'h temu';
        return new Date(iso).toLocaleDateString('pl-PL');
    }

    function healthCard(title, value, ok, subtitle, tooltip) {
        const icon = ok
            ? '<i data-lucide="check-circle" class="icon-md" style="color:var(--success)"></i>'
            : '<i data-lucide="alert-circle" class="icon-md" style="color:var(--warn)"></i>';
        const sub = subtitle
            ? '<div style="font-size: var(--fs-sm);color:var(--text-secondary);margin-top:2px">' +
              subtitle +
              '</div>'
            : '';
        return (
            '<div class="ai-health-card"' +
            (tooltip ? ' title="' + tooltip + '"' : '') +
            '>' +
            icon +
            '<div style="flex:1;min-width:0">' +
            '<div style="font-size: var(--fs-base);color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.03em">' +
            title +
            '</div>' +
            '<div style="font-size: var(--fs-3xl);font-weight: var(--fw-semibold);color:var(--text-primary);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
            value +
            '</div>' +
            sub +
            '</div>' +
            '</div>'
        );
    }

    function qualityBar(pct, label) {
        const color = pct >= 95 ? 'var(--success)' : pct >= 80 ? 'var(--warn)' : 'var(--danger)';
        return (
            '<div class="ai-dq-bar">' +
            '<div class="ai-dq-bar-header">' +
            '<span class="ai-dq-bar-label">' +
            window.escapeHtml(label) +
            '</span>' +
            '<span class="ai-dq-bar-value" style="color:' +
            color +
            '">' +
            pct +
            '%</span>' +
            '</div>' +
            '<div class="ai-dq-bar-track">' +
            '<div class="ai-dq-bar-fill" style="background:' +
            color +
            ';width:' +
            pct +
            '%"></div>' +
            '</div>' +
            '</div>'
        );
    }

    window.mlHealthRender = function (containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '<div class="ai-ml-loading">Ładowanie...</div>';

        const renderDisabled = function () {
            container.innerHTML = window.aiMlDisabledHtml
                ? window.aiMlDisabledHtml()
                : '<div class="ai-ml-error">Moduł AI/ML jest wyłączony</div>';
            if (window.lucide && typeof lucide.createIcons === 'function') {
                lucide.createIcons({ root: container });
            }
        };

        const loadHealth = function () {
            window.fetchJson(HEALTH_URL).then(function (d) {
                if (!d || d.error) {
                    const msg =
                        d && d.error === 'forbidden'
                            ? 'Brak dostępu do stanu ML (wymagana rola admin)'
                            : d && d.error === 'unauthorized'
                              ? 'Nieautoryzowany — zaloguj się ponownie'
                              : 'Błąd serwera — nie udało się pobrać stanu ML';
                    container.innerHTML = '<div class="ai-ml-error">' + msg + '</div>';
                    return;
                }

                const renderHealth = function (runtimeMetrics, metricsLoaded) {
                    if (d.aiMlEnabled === false) {
                        renderDisabled();
                        return;
                    }

                    const endpoints =
                        runtimeMetrics && runtimeMetrics.endpoints ? runtimeMetrics.endpoints : {};
                    const predictionApi = endpoints['POST /api/telemetry/ai/predict/batch'] || null;
                    const rewardApi = endpoints['POST /api/telemetry/ai/reward'] || null;
                    const rewardBatchApi = endpoints['POST /api/telemetry/ai/reward-batch'] || null;
                    const rewardSamples = [rewardApi, rewardBatchApi].filter(function (stats) {
                        return stats && stats.recent && stats.recent.n > 0;
                    });
                    const rewardRequestCount = rewardSamples.reduce(function (total, stats) {
                        return total + stats.recent.n;
                    }, 0);
                    const rewardServerErrors = rewardSamples.reduce(function (total, stats) {
                        return total + stats.recent.errors;
                    }, 0);

                    const modelOk = d.mlOnline && d.modelTrained === true;
                    const accuracy =
                        modelOk && Number.isFinite(d.modelAccuracy) ? d.modelAccuracy : null;
                    // Kotwica SEC-03: modelTooltip jest SUROWY celowo — escape atrybutu następuje w callerze
                    // healthCard('Model', ..., window.escapeHtmlAttr(modelTooltip)) poniżej. Nie escapować tutaj.
                    const modelTooltip = d.modelVersion
                        ? d.modelVersion + (accuracy !== null ? ' (acc: ' + accuracy + ')' : '')
                        : 'Brak';

                    const html =
                        /* Naglowek */
                        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' +
                        '<h4 class="ai-ml-header" style="margin:0"><i data-lucide="heart-pulse"></i> Stan pipeline ML</h4>' +
                        '<span style="font-size: var(--fs-sm);color:var(--text-secondary)">' +
                        new Date().toLocaleString('pl-PL') +
                        '</span>' +
                        '</div>' +
                        /* Siatka kart */
                        '<div class="ai-health-grid">' +
                        healthCard('Telemetria', d.telemetryCount, d.telemetryCount > 0) +
                        healthCard(
                            'FeatureExtractor',
                            d.featureCount,
                            d.featureCount > 0,
                            d.featureCount + ' rekordów'
                        ) +
                        healthCard(
                            'Trening',
                            d.lastTrainingAt ? timeAgo(d.lastTrainingAt) : 'Nigdy',
                            !!d.lastTrainingAt,
                            d.trainingRunning ? 'W trakcie...' : '—'
                        ) +
                        healthCard(
                            'Ostatnia telemetria',
                            d.dataFreshness && d.dataFreshness.lastTelemetryAt
                                ? timeAgo(d.dataFreshness.lastTelemetryAt)
                                : 'Nigdy',
                            !!(d.dataFreshness && d.dataFreshness.lastTelemetryAt),
                            'czas ostatniego rekordu w PostgreSQL'
                        ) +
                        healthCard(
                            'Ostatni feature',
                            d.dataFreshness && d.dataFreshness.lastFeatureAt
                                ? timeAgo(d.dataFreshness.lastFeatureAt)
                                : 'Nigdy',
                            !!(d.dataFreshness && d.dataFreshness.lastFeatureAt),
                            'czas ostatniego wektora w PostgreSQL'
                        ) +
                        healthCard(
                            'API predykcji p95 / p99',
                            predictionApi && predictionApi.recent && predictionApi.recent.n > 0
                                ? predictionApi.p95 + ' / ' + predictionApi.p99 + ' ms'
                                : '—',
                            !!(
                                predictionApi &&
                                predictionApi.recent &&
                                predictionApi.recent.errors === 0
                            ),
                            predictionApi && predictionApi.recent
                                ? 'próby: ' +
                                      predictionApi.recent.n +
                                      ' · błędy 5xx: ' +
                                      predictionApi.recent.errors
                                : metricsLoaded
                                  ? 'brak próbek procesu'
                                  : 'ładowanie metryk procesu',
                            'Czas całego endpointu HTTP z ostatnich próbek procesu, nie czysty czas modelu; próbki resetują się po restarcie.'
                        ) +
                        healthCard(
                            'Błędy API reward',
                            rewardRequestCount > 0 ? rewardServerErrors : '—',
                            rewardRequestCount > 0 && rewardServerErrors === 0,
                            rewardRequestCount > 0
                                ? '5xx / ' +
                                      rewardRequestCount +
                                      ' ostatnich żądań; bez 4xx i odrzuceń pozycji batch'
                                : metricsLoaded
                                  ? 'brak próbek procesu'
                                  : 'ładowanie metryk procesu',
                            'Licznik błędów HTTP 5xx dla POST /ai/reward i POST /ai/reward-batch z ostatnich próbek procesu.'
                        ) +
                        healthCard(
                            'Model',
                            window.escapeHtml(modelTooltip),
                            modelOk,
                            d.mlOnline && !modelOk ? 'Bez treningu' : null,
                            window.escapeHtmlAttr(modelTooltip)
                        ) +
                        healthCard(
                            'Predict',
                            modelOk ? 'Online' : d.mlOnline ? 'Model bez treningu' : 'Offline',
                            modelOk,
                            d.mlOnline
                                ? 'model ' + window.escapeHtml(d.modelVersion)
                                : 'brak modelu'
                        ) +
                        healthCard(
                            'Zdarzenia reward',
                            d.totalRewards,
                            true,
                            'wszystkie zapisane rekordy aiRewardLog',
                            'Źródło: /ai/health · zakres: liczba rekordów reward, nie suma wartości nagrody · odczyt: ' +
                                new Date().toLocaleString('pl-PL')
                        ) +
                        healthCard(
                            'Fallback zgłoszony klientem · 24 h',
                            d.fallbacks24h && Number.isFinite(d.fallbacks24h.total)
                                ? d.fallbacks24h.total
                                : '—',
                            !!(d.fallbacks24h && d.fallbacks24h.total === 0),
                            d.fallbacks24h && d.fallbacks24h.byReason
                                ? 'timeout: ' +
                                      d.fallbacks24h.byReason.timeout +
                                      ' · HTTP: ' +
                                      d.fallbacks24h.byReason.http_error +
                                      ' · puste: ' +
                                      d.fallbacks24h.byReason.empty_response +
                                      ' · częściowe: ' +
                                      d.fallbacks24h.byReason.partial_response +
                                      ' · sieć: ' +
                                      d.fallbacks24h.byReason.network_error +
                                      ' · inne: ' +
                                      d.fallbacks24h.byReason.unspecified
                                : 'brak danych'
                        ) +
                        healthCard(
                            'Dry-run kompatybilności · 24 h',
                            d.compatibility24h
                                ? d.compatibility24h.total +
                                      (d.compatibility24h.truncated ? '+' : '')
                                : '—',
                            !!(
                                d.compatibility24h &&
                                d.compatibility24h.byStatus.blocked === 0 &&
                                d.compatibility24h.byStatus.unknown === 0
                            ),
                            d.compatibility24h
                                ? 'zgodne: ' +
                                      d.compatibility24h.byStatus.compatible +
                                      ' · ostrzeżenia: ' +
                                      d.compatibility24h.byStatus.warning +
                                      ' · blokady: ' +
                                      d.compatibility24h.byStatus.blocked +
                                      (d.compatibility24h.byStatus.unknown > 0
                                          ? ' · nieznane: ' + d.compatibility24h.byStatus.unknown
                                          : '')
                                : 'brak danych z audytu'
                        ) +
                        /* Drift danych: % ostatnich telemetrii poza zakresem modelu (niski = OK) */
                        healthCard(
                            'Drift danych',
                            d.driftPct === null || d.driftPct === undefined
                                ? '—'
                                : d.driftPct + '%',
                            d.driftPct !== null && d.driftPct !== undefined && d.driftPct < 20,
                            d.driftPct === null || d.driftPct === undefined
                                ? 'brak danych'
                                : 'odsetek wartości poza zakresem modelu'
                        ) +
                        '</div>' +
                        /* Jakosc danych */
                        '<div class="ai-dq-section">' +
                        '<div class="ai-dq-title"><i data-lucide="gauge"></i> Jakość danych</div>' +
                        '<div class="ai-dq-bars">' +
                        qualityBar(
                            d.dataQuality ? d.dataQuality.withFeatureSnapshotPct || 0 : 0,
                            'FeatureSnapshot'
                        ) +
                        qualityBar(
                            d.dataQuality ? d.dataQuality.withSolverSourcePct || 0 : 0,
                            'SolverSource'
                        ) +
                        qualityBar(
                            d.dataQuality ? d.dataQuality.withWellTypePct || 0 : 0,
                            'WellType'
                        ) +
                        '</div>' +
                        '</div>' +
                        /* Ostrzezenia */
                        '<div class="ai-dq-warnings">' +
                        (d.dataQuality && d.dataQuality.manualOverrideCount > 0
                            ? '<span class="ai-warning-tag warn"><i data-lucide="alert-triangle"></i> Ręczne nadpisania: ' +
                              d.dataQuality.manualOverrideCount +
                              '</span>'
                            : '') +
                        (d.telemetryCount > 0 &&
                        d.dataQuality &&
                        d.dataQuality.withFeatureSnapshotPct < 95
                            ? '<span class="ai-warning-tag danger"><i data-lucide="alert-triangle"></i> Niska jakosc featureSnapshot</span>'
                            : '') +
                        '</div>';

                    container.innerHTML = html;

                    if (window.lucide && typeof lucide.createIcons === 'function') {
                        lucide.createIcons({ root: container });
                    }
                };

                renderHealth(null, false);
                window
                    .fetchJson('/metrics')
                    .then(function (runtimeMetrics) {
                        renderHealth(runtimeMetrics, true);
                    })
                    .catch(function () {
                        renderHealth(null, true);
                    });
            });
        };

        if (typeof window.aiMlEnabled === 'function') {
            window
                .aiMlEnabled()
                .then(function (on) {
                    if (!on) renderDisabled();
                    else loadHealth();
                })
                .catch(loadHealth);
        } else {
            loadHealth();
        }
    };
})();
