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
        var color = pct >= 95 ? '#22c55e' : pct >= 80 ? '#eab308' : '#ef4444';
        return (
            '<div style="margin-bottom:6px">' +
            '<div style="display:flex;justify-content:space-between;font-size:0.72rem;color:var(--text-secondary);margin-bottom:2px">' +
            '<span>' +
            label +
            '</span>' +
            '<span style="font-weight:600;color:' +
            color +
            '">' +
            pct +
            '%</span>' +
            '</div>' +
            '<div style="background:var(--border-glass);border-radius:4px;height:6px;overflow:hidden">' +
            '<div style="background:' +
            color +
            ';width:' +
            pct +
            '%;height:100%;border-radius:4px;transition:width 0.3s"></div>' +
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
                ? d.modelVersion + (d.modelAccuracy ? ' (acc: ' + d.modelAccuracy + ')' : '')
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
                '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">' +
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
                '<div style="border-top:1px solid var(--border-glass);padding-top:10px;margin-bottom:6px">' +
                '<div style="font-size:0.78rem;color:var(--text-secondary);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.03em">Jakosc danych</div>' +
                '<div style="max-width:400px">' +
                qualityBar(d.dataQuality.withFeatureSnapshotPct, 'Z featureSnapshot') +
                qualityBar(d.dataQuality.withSolverSourcePct, 'Z solverSource') +
                qualityBar(d.dataQuality.withWellTypePct, 'Z wellType') +
                '</div>' +
                '</div>' +
                /* Ostrzezenia */
                '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">' +
                (d.dataQuality.manualOverrideCount > 0
                    ? '<span style="display:inline-flex;align-items:center;gap:4px;font-size:0.72rem;color:#eab308;background:rgba(234,179,8,0.1);padding:3px 8px;border-radius:var(--radius-sm)"><i data-lucide="alert-triangle" style="width:12px;height:12px"></i> Ręczne nadpisania: ' +
                      d.dataQuality.manualOverrideCount +
                      '</span>'
                    : '') +
                (d.telemetryCount > 0 && d.dataQuality.withFeatureSnapshotPct < 95
                    ? '<span style="display:inline-flex;align-items:center;gap:4px;font-size:0.72rem;color:#ef4444;background:rgba(239,68,68,0.1);padding:3px 8px;border-radius:var(--radius-sm)"><i data-lucide="alert-triangle" style="width:12px;height:12px"></i> Niska jakosc featureSnapshot</span>'
                    : '') +
                '</div>';

            container.innerHTML = html;

            if (window.lucide && typeof lucide.createIcons === 'function') {
                lucide.createIcons({ root: container });
            }
        });
    };
})();
