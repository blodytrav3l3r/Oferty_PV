/**
 * opsDashboard.js — read-only dashboard operacyjny w panelu admina (index.html).
 * Tylko prezentacja istniejących endpointów: /health, /health/ready,
 * /api/version, /api/admin/system-info, /metrics, /api/telemetry/ai/ml-status.
 * Brak mutacji, brak nowego frameworka, brak nowych globali (IIFE).
 * Stany: OK / WARNING / ERROR / UNKNOWN (brak wymyślonych sygnałów).
 */
(function () {
    'use strict';

    var REFRESH_MS = 60000;
    var _timer = null;

    function esc(s) {
        return typeof escapeHtml === 'function' ? escapeHtml(String(s)) : String(s);
    }

    function isAdmin() {
        try {
            return !!(window.currentUser && window.currentUser.role === 'admin');
        } catch (_e) {
            return false;
        }
    }

    function pill(state, label) {
        var cls =
            state === 'OK'
                ? 'ops-ok'
                : state === 'WARNING'
                  ? 'ops-warn'
                  : state === 'ERROR'
                    ? 'ops-err'
                    : 'ops-unknown';
        var icon =
            state === 'OK'
                ? 'check-circle'
                : state === 'WARNING'
                  ? 'alert-triangle'
                  : state === 'ERROR'
                    ? 'x-circle'
                    : 'help-circle';
        return (
            '<span class="ops-pill ' +
            cls +
            '"><i data-lucide="' +
            icon +
            '" class="icon-xs" aria-hidden="true"></i> ' +
            esc(label || state) +
            '</span>'
        );
    }

    function row(name, value, state) {
        return (
            '<div class="ops-row"><span class="ops-name">' +
            esc(name) +
            '</span><span class="ops-value">' +
            value +
            '</span>' +
            pill(state || 'UNKNOWN') +
            '</div>'
        );
    }

    function fmtBytes(b) {
        if (b === null || b === undefined) return '—';
        var units = ['B', 'KB', 'MB', 'GB'];
        var i = 0;
        var v = b;
        while (v >= 1024 && i < units.length - 1) {
            v /= 1024;
            i++;
        }
        return v.toFixed(1) + ' ' + units[i];
    }

    function fmtUptime(sec) {
        if (sec === null || sec === undefined) return '—';
        var d = Math.floor(sec / 86400);
        var h = Math.floor((sec % 86400) / 3600);
        return d > 0
            ? d + 'd ' + h + 'h'
            : h > 0
              ? h + 'h ' + Math.floor((sec % 3600) / 60) + 'm'
              : Math.floor(sec / 60) + 'm';
    }

    function getJson(url) {
        return fetch(url, { credentials: 'same-origin' }).then(function (res) {
            if (!res.ok) {
                var e = new Error('HTTP ' + res.status);
                e.status = res.status;
                e.headers = res.headers;
                throw e;
            }
            return res.json().then(function (body) {
                return { body: body, headers: res.headers };
            });
        });
    }

    function renderApp(container, version, sysinfo) {
        var html = '<h4>Aplikacja</h4>';
        if (!version && !sysinfo) {
            html += row('Status', 'brak danych', 'UNKNOWN');
        } else {
            if (version) html += row('Wersja', esc(version.version || '?'), 'OK');
            if (sysinfo) {
                html += row('Środowisko', esc(sysinfo.environment || '?'), 'OK');
                html += row('Commit', esc(String(sysinfo.commitHash || '?').slice(0, 12)), 'OK');
                html += row('Uptime', esc(fmtUptime(sysinfo.uptime)), 'OK');
                html += row(
                    'Pamięć RSS',
                    esc(fmtBytes(sysinfo.memory && sysinfo.memory.rss)),
                    (sysinfo.memory && sysinfo.memory.rss) > 1024 * 1024 * 1024 ? 'WARNING' : 'OK'
                );
            } else {
                html += row('Diagnostyka', 'wymaga admina', 'UNKNOWN');
            }
        }
        container.innerHTML += html;
    }

    function renderHealth(container, live, ready) {
        var html = '<h4>Zdrowie</h4>';
        html += row('Liveness', live ? 'odpowiada' : 'brak odpowiedzi', live ? 'OK' : 'ERROR');
        if (!ready) {
            html += row('Readiness (DB)', 'brak danych', 'UNKNOWN');
        } else if (ready.status === 'ready') {
            html += row('Readiness (DB)', 'gotowa', 'OK');
        } else {
            html += row('Readiness (DB)', 'niedostępna', 'ERROR');
        }
        container.innerHTML += html;
    }

    function renderApi(container, metrics, csp) {
        var html = '<h4>API</h4>';
        if (!metrics) {
            html += row('Metryki', 'wymagają admina', 'UNKNOWN');
        } else {
            var eps = metrics.endpoints || {};
            var names = Object.keys(eps);
            var total = 0;
            var errors = 0;
            names.forEach(function (k) {
                total += eps[k].n || 0;
                errors += eps[k].errors || 0;
            });
            html += row('Żądania (od startu)', esc(String(total)), 'OK');
            html += row('Błędy 5xx', esc(String(errors)), errors > 0 ? 'WARNING' : 'OK');
            html += row(
                'DB: zapytania / busy',
                esc(String((metrics.db && metrics.db.queries) || 0)) +
                    ' / ' +
                    esc(String((metrics.db && metrics.db.busy) || 0)),
                (metrics.db && metrics.db.busy) > 0 ? 'WARNING' : 'OK'
            );
            html += row(
                'Błędy audytu',
                esc(String((metrics.audit && metrics.audit.failures) || 0)),
                (metrics.audit && metrics.audit.failures) > 0 ? 'WARNING' : 'OK'
            );
            if (metrics.storage) {
                html += row(
                    'Baza / WAL',
                    esc(fmtBytes(metrics.storage.dbBytes)) +
                        ' / ' +
                        esc(fmtBytes(metrics.storage.walBytes)),
                    'OK'
                );
                html += row(
                    'Backupy',
                    esc(String(metrics.storage.backups || 0)) +
                        (metrics.storage.lastBackupAt
                            ? ' (ostatni: ' + esc(metrics.storage.lastBackupAt.slice(0, 10)) + ')'
                            : ' (brak)'),
                    (metrics.storage.backups || 0) > 0 ? 'OK' : 'WARNING'
                );
            }
        }
        html += row('CSP enforce', csp ? 'aktywne' : 'brak / report-only', csp ? 'OK' : 'WARNING');
        container.innerHTML += html;
    }

    function renderMl(container, ml) {
        var html = '<h4>ML</h4>';
        if (!ml) {
            html += row('Status', 'brak danych', 'UNKNOWN');
        } else if (!ml.mlOnline) {
            html += row('Status', 'offline (ranking techniczny)', 'WARNING');
        } else {
            html += row(
                'Model',
                esc(ml.modelVersion || '?') + ' @ ' + esc(String(ml.aiInfluencePct || 0)) + '%',
                'OK'
            );
            html += row(
                'AUC / baseline',
                esc(ml.activeModelAuc != null ? Number(ml.activeModelAuc).toFixed(4) : '—') +
                    ' / ' +
                    esc(ml.baselineAccuracy != null ? Number(ml.baselineAccuracy).toFixed(4) : '—'),
                'OK'
            );
            html += row(
                'Wiersze / run',
                esc(ml.trainingRows != null ? String(ml.trainingRows) : '—') +
                    ' / ' +
                    esc(ml.lastTrainingRun ? String(ml.lastTrainingRun.id).slice(0, 8) : '—'),
                'OK'
            );
            html += row(
                'Dataset',
                esc(
                    ml.lastDatasetFingerprint
                        ? String(ml.lastDatasetFingerprint).slice(0, 12) + '…'
                        : '—'
                ),
                ml.lastDatasetFingerprint ? 'OK' : 'UNKNOWN'
            );
        }
        container.innerHTML += html;
    }

    function renderError(container) {
        container.innerHTML =
            '<div class="ops-error">Nie udało się pobrać danych operacyjnych. <button type="button" class="ai-btn" id="ops-retry">Spróbuj ponownie</button></div>';
        var btn = document.getElementById('ops-retry');
        if (btn) btn.addEventListener('click', refresh);
    }

    function refresh() {
        var container = document.getElementById('ops-container');
        if (!container) return;
        if (!isAdmin()) {
            container.innerHTML =
                '<p class="text-muted">Dashboard operacyjny wymaga roli admin.</p>';
            return;
        }
        container.innerHTML = '<p class="text-muted">Ładowanie…</p>';
        var csp = null;
        Promise.allSettled([
            getJson('/api/version').then(function (r) {
                csp = r.headers && r.headers.get ? r.headers.get('content-security-policy') : null;
                return r.body;
            }),
            getJson('/api/admin/system-info').catch(function () {
                return null;
            }),
            getJson('/health')
                .then(function (r) {
                    return r.body;
                })
                .catch(function () {
                    return null;
                }),
            getJson('/health/ready')
                .then(function (r) {
                    return r.body;
                })
                .catch(function () {
                    return null;
                }),
            getJson('/metrics').catch(function () {
                return null;
            }),
            getJson('/api/telemetry/ai/ml-status').catch(function () {
                return null;
            })
        ]).then(function (results) {
            var el = document.getElementById('ops-container');
            if (!el) return;
            var ok = results.filter(function (r) {
                return r.status === 'fulfilled' && r.value;
            });
            if (ok.length === 0) {
                renderError(el);
                return;
            }
            el.innerHTML = '';
            // getJson zwraca {body, headers} — odpakuj raz, centralnie.
            function bodyOf(r) {
                if (!r || r.status !== 'fulfilled' || !r.value) return null;
                var v = r.value;
                return v && v.body !== undefined && v.headers !== undefined ? v.body : v;
            }
            renderApp(el, bodyOf(results[0]), bodyOf(results[1]));
            renderHealth(el, bodyOf(results[2]), bodyOf(results[3]));
            renderApi(el, bodyOf(results[4]), !!csp);
            renderMl(el, bodyOf(results[5]));
            if (typeof lucide !== 'undefined' && lucide.createIcons) {
                try {
                    lucide.createIcons({ root: el });
                } catch (_e) {}
            }
        });
    }

    function init() {
        if (!document.getElementById('ops-container')) return;
        refresh();
        if (_timer) return;
        _timer = setInterval(function () {
            if (document.hidden) return;
            refresh();
        }, REFRESH_MS);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
