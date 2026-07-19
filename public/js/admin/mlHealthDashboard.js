(function () {
    'use strict';

    var HEALTH_URL = '/api/telemetry/ai/health';

    function fetchJson(url) {
        if (!window.fetch) return Promise.resolve(null);
        return fetch(url, { credentials: 'same-origin' })
            .then(function (r) {
                if (!r.ok) return null;
                return r.json();
            })
            .catch(function () {
                return null;
            });
    }

    function timeAgo(iso) {
        if (!iso) return '—';
        var diff = Date.now() - new Date(iso).getTime();
        var min = Math.floor(diff / 60000);
        if (min < 1) return 'przed chwila';
        if (min < 60) return min + ' min temu';
        var h = Math.floor(min / 60);
        if (h < 24) return h + 'h temu';
        return new Date(iso).toLocaleDateString('pl-PL');
    }

    function healthCard(title, value, ok, subtitle) {
        var icon = ok
            ? '<i data-lucide="check-circle" style="width:18px;height:18px;color:#22c55e"></i>'
            : '<i data-lucide="alert-circle" style="width:18px;height:18px;color:#eab308"></i>';
        var sub = subtitle
            ? '<div style="font-size:0.7rem;color:var(--text-secondary);margin-top:2px">' +
              subtitle +
              '</div>'
            : '';
        return (
            '<div class="ai-health-card" style="background:var(--bg-card);border:1px solid var(--border-glass);border-radius:var(--radius-md);padding:10px 12px;display:flex;align-items:center;gap:10px">' +
            icon +
            '<div style="flex:1;min-width:0">' +
            '<div style="font-size:0.78rem;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.03em">' +
            title +
            '</div>' +
            '<div style="font-size:1.1rem;font-weight:600;color:var(--text-primary);margin-top:1px">' +
            value +
            '</div>' +
            sub +
            '</div>' +
            '</div>'
        );
    }

    function qualityBar(pct, label) {
        var color = pct >= 95 ? 'var(--success)' : pct >= 80 ? 'var(--warn)' : 'var(--danger)';
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
        var container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML =
            '<div style="display:flex;justify-content:center;padding:20px;color:var(--text-secondary)">Ladowanie...</div>';

        fetchJson(HEALTH_URL).then(function (d) {
            if (!d) {
                container.innerHTML =
                    '<div style="padding:12px;text-align:center;color:#ef4444;font-size:0.85rem">Nie mozna pobrac danych</div>';
                return;
            }

            var modelStr = d.modelVersion
                ? window.escapeHtml(d.modelVersion) +
                  (d.modelAccuracy ? ' (acc: ' + d.modelAccuracy + ')' : '')
                : 'Brak';
            var modelOk = !!d.mlOnline;

            var html =
                /* Naglowek */
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' +
                '<div style="display:flex;align-items:center;gap:6px">' +
                '<i data-lucide="heart-pulse" style="width:18px;height:18px;color:var(--accent)"></i>' +
                '<span style="font-size:0.9rem;font-weight:600;color:var(--text-primary)">Stan pipeline ML</span>' +
                '</div>' +
                '<span style="font-size:0.7rem;color:var(--text-secondary)">' +
                new Date().toLocaleString('pl-PL') +
                '</span>' +
                '</div>' +
                /* Siatka 2x3 */
                '<div class="ai-health-grid">' +
                healthCard('Telemetria', d.telemetryCount, d.telemetryCount > 0) +
                healthCard(
                    'FeatureExtractor',
                    d.featureCount,
                    d.featureCount > 0,
                    d.featureCount + ' rekordow'
                ) +
                healthCard(
                    'Trening',
                    d.lastTrainingAt ? timeAgo(d.lastTrainingAt) : 'Nigdy',
                    !!d.lastTrainingAt,
                    d.trainingRunning ? 'W trakcie...' : '—'
                ) +
                healthCard('Model', modelStr, modelOk) +
                healthCard(
                    'Predict',
                    d.mlOnline ? 'Online' : 'Offline',
                    d.mlOnline,
                    d.mlOnline ? 'model v' + d.modelVersion : 'brak modelu'
                ) +
                healthCard('Nagrody', d.totalRewards, true) +
                '</div>' +
                /* Jakosc danych */
                '<div class="ai-dq-section">' +
                '<div class="ai-dq-title"><i data-lucide="gauge"></i> Jakosc danych</div>' +
                '<div class="ai-dq-bars">' +
                qualityBar(d.dataQuality.withFeatureSnapshotPct, 'FeatureSnapshot') +
                qualityBar(d.dataQuality.withSolverSourcePct, 'SolverSource') +
                qualityBar(d.dataQuality.withWellTypePct, 'WellType') +
                '</div>' +
                '</div>' +
                /* Ostrzezenia */
                '<div class="ai-dq-warnings">' +
                (d.dataQuality.manualOverrideCount > 0
                    ? '<span class="ai-warning-tag warn"><i data-lucide="alert-triangle"></i> Ręczne nadpisania: ' +
                      d.dataQuality.manualOverrideCount +
                      '</span>'
                    : '') +
                (d.telemetryCount > 0 && d.dataQuality.withFeatureSnapshotPct < 95
                    ? '<span class="ai-warning-tag danger"><i data-lucide="alert-triangle"></i> Niska jakosc featureSnapshot</span>'
                    : '') +
                '</div>';

            container.innerHTML = html;

            if (window.lucide && typeof lucide.createIcons === 'function') {
                lucide.createIcons({ root: container });
            }
        });
    };
})();
