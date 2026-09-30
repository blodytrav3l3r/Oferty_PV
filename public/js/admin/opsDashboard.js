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

    function escAttr(s) {
        if (typeof window !== 'undefined' && typeof window.escapeHtmlAttr === 'function')
            return window.escapeHtmlAttr(String(s));
        if (typeof escapeHtmlAttr === 'function') return escapeHtmlAttr(String(s));
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
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

    // Sonda CSP enforce — kontrakt jak tests/security/headers.test.ts:
    // enforce = script-src 'self' + nonce per-request. Report-Only to osobny
    // nagłówek i nie dowodzi enforce. undefined = brak odpowiedzi (UNKNOWN),
    // null/pusty/słaby = WARNING.
    function cspStatus(h) {
        if (h === undefined) return { label: 'niezweryfikowane', state: 'UNKNOWN' };
        var v = String(h || '');
        var strong = v.indexOf('script-src') !== -1 && /nonce-[A-Za-z0-9+/=]+/.test(v);
        return strong
            ? { label: 'aktywne', state: 'OK' }
            : { label: 'słabe / report-only', state: 'WARNING' };
    }

    function row(name, value, state, hint) {
        return (
            '<div class="ops-row"><span class="ops-name"' +
            (hint ? ' title="' + escAttr(hint) + '"' : '') +
            '>' +
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
        var html =
            '<div class="ops-card"><h4 title="' +
            escAttr(
                'Wersja, środowisko i zasoby procesu. Służy do weryfikacji wdrożenia (czy działa nowy kod) i wykrywania restartów / wycieków pamięci.'
            ) +
            '"><i data-lucide="layers"></i>Aplikacja</h4>';
        if (!version && !sysinfo) {
            html += row('Status', 'brak danych', 'UNKNOWN');
        } else {
            if (version)
                html += row(
                    'Wersja',
                    esc(version.version || '?'),
                    'OK',
                    'Numer wydania z /api/version. Porównaj z CHANGELOG — inna wersja niż po deployu = stary kod lub cache.'
                );
            if (sysinfo) {
                html += row(
                    'Środowisko',
                    esc(sysinfo.environment || '?'),
                    'OK',
                    'Tryb serwera (development / production). W development ścieżki i logi mogą się różnić.'
                );
                html += row(
                    'Commit',
                    esc(String(sysinfo.commitHash || '?').slice(0, 12)),
                    'OK',
                    'Skrót commita git działającego kodu. Pozwala powiązać zachowanie z konkretną rewizją.'
                );
                html += row(
                    'Uptime',
                    esc(fmtUptime(sysinfo.uptime)),
                    'OK',
                    'Czas od startu procesu. Nagły spadek = restart (crash, deploy, reboot).'
                );
                html += row(
                    'Pamięć RSS',
                    esc(fmtBytes(sysinfo.memory && sysinfo.memory.rss)),
                    (sysinfo.memory && sysinfo.memory.rss) > 1024 * 1024 * 1024 ? 'WARNING' : 'OK',
                    'Zużycie RAM procesu Node. WARNING powyżej 1 GB — możliwy wyciek, sprawdź logi i zrestartuj.'
                );
            } else {
                html += row(
                    'Diagnostyka',
                    'wymaga admina',
                    'UNKNOWN',
                    'Szczegóły systemowe tylko dla admina (/api/admin/system-info).'
                );
            }
        }
        html += '</div>';
        container.innerHTML += html;
    }

    function renderHealth(container, live, ready) {
        var html =
            '<div class="ops-card"><h4 title="' +
            escAttr(
                'Sondy Kubernetes-style: liveness = czy proces żyje, readiness = czy baza gotowa. ERROR tutaj = najpierw sprawdź serwer i bazę.'
            ) +
            '"><i data-lucide="activity"></i>Zdrowie</h4>';
        html += row(
            'Liveness',
            live ? 'odpowiada' : 'brak odpowiedzi',
            live ? 'OK' : 'ERROR',
            'Czy proces odpowiada na /health. ERROR = serwer padł lub wiesza się.'
        );
        if (!ready) {
            html += row('Readiness (DB)', 'brak danych', 'UNKNOWN');
        } else if (ready.status === 'ready') {
            html += row(
                'Readiness (DB)',
                'gotowa',
                'OK',
                'Wynik /health/ready (SELECT 1 na bazie). OK = baza gotowa na ruch.'
            );
        } else {
            html += row(
                'Readiness (DB)',
                'niedostępna',
                'ERROR',
                'Baza nie odpowiada (SELECT 1 nie przeszedł). Sprawdź plik SQLite, dysk i backup.'
            );
        }
        html += '</div>';
        container.innerHTML += html;
    }

    function renderApi(container, metrics, csp) {
        var html =
            '<div class="ops-card"><h4 title="' +
            escAttr(
                'Ruch i kondycja API z /metrics. WARNING przy 5xx / busy / błędach audytu / braku backupów / braku CSP.'
            ) +
            '"><i data-lucide="server"></i>API</h4>';
        if (!metrics) {
            html += row(
                'Metryki',
                'wymagają admina',
                'UNKNOWN',
                'Liczniki /metrics tylko dla admina.'
            );
        } else {
            var eps = metrics.endpoints || {};
            var names = Object.keys(eps);
            var total = 0;
            var errors = 0;
            names.forEach(function (k) {
                total += eps[k].n || 0;
                errors += eps[k].errors || 0;
            });
            html += row(
                'Żądania (od startu)',
                esc(String(total)),
                'OK',
                'Licznik żądań od startu procesu. Zeruje się przy restarcie — spadek razem z Uptime = restart.'
            );
            html += row(
                'Błędy 5xx',
                esc(String(errors)),
                errors > 0 ? 'WARNING' : 'OK',
                'Liczba błędów serwera 5xx. WARNING przy >0 — sprawdź logi serwera (logger), ostatnie deploye i bazę.'
            );
            html += row(
                'DB: zapytania / busy',
                esc(String((metrics.db && metrics.db.queries) || 0)) +
                    ' / ' +
                    esc(String((metrics.db && metrics.db.busy) || 0)),
                (metrics.db && metrics.db.busy) > 0 ? 'WARNING' : 'OK',
                'Zapytania DB vs blokady SQLITE_BUSY (konkurencja o SQLite). busy >0 = równoległe zapisy czekają — sprawdź WAL i obciążenie.'
            );
            html += row(
                'Błędy audytu',
                esc(String((metrics.audit && metrics.audit.failures) || 0)),
                (metrics.audit && metrics.audit.failures) > 0 ? 'WARNING' : 'OK',
                'Nieudane zapisy audytu (tabela audit). >0 = dziura w historii zmian — sprawdź bazę i miejsce na dysku.'
            );
            if (metrics.storage) {
                html += row(
                    'Baza / WAL',
                    esc(fmtBytes(metrics.storage.dbBytes)) +
                        ' / ' +
                        esc(fmtBytes(metrics.storage.walBytes)),
                    'OK',
                    'Rozmiar pliku bazy i dziennika WAL. Szybki wzrost WAL = niezamknięte transakcje lub duży import.'
                );
                html += row(
                    'Backupy',
                    esc(String(metrics.storage.backups || 0)) +
                        (metrics.storage.lastBackupAt
                            ? ' (ostatni: ' + esc(metrics.storage.lastBackupAt.slice(0, 10)) + ')'
                            : ' (brak)'),
                    (metrics.storage.backups || 0) > 0 ? 'OK' : 'WARNING',
                    'Liczba backupów i data ostatniego. WARNING przy braku — wykonaj npm run backup przed migracją.'
                );
            }
        }
        html += row(
            'CSP enforce',
            csp.label,
            csp.state,
            'Treść nagłówka Content-Security-Policy z /api/telemetry/ai/ml-status (za Helmet; /api/version i /api/admin/system-info są przed Helmet i nie niosą CSP). OK = script-src + nonce (kontrakt headers.test.ts). Sam Report-Only nie dowodzi enforce.'
        );
        html += '</div>';
        container.innerHTML += html;
    }

    function renderMl(container, ml) {
        var html =
            '<div class="ops-card"><h4 title="' +
            escAttr(
                'Status modułu AI/ML z /api/telemetry/ai/ml-status. WARNING/offline = działa ranking techniczny (reguły), bez uczenia.'
            ) +
            '"><i data-lucide="brain"></i>ML</h4>';
        if (!ml) {
            html += row('Status', 'brak danych', 'UNKNOWN');
        } else if (!ml.mlOnline) {
            html += row(
                'Status',
                'offline (ranking techniczny)',
                'WARNING',
                'ML wyłączony (kill-switch feature_ai_ml_enabled lub brak modelu). Oferty liczone regułami — sprawdź flagę i trening.'
            );
        } else {
            html += row(
                'Model',
                esc(ml.modelVersion || '?') + ' @ ' + esc(String(ml.aiInfluencePct || 0)) + '%',
                'OK',
                'Aktywna wersja modelu i % decyzji AI w rankingu. Niski % = AI mało wpływa — sprawdź progi i rewardy.'
            );
            html += row(
                'AUC / baseline',
                esc(ml.activeModelAuc != null ? Number(ml.activeModelAuc).toFixed(4) : '—') +
                    ' / ' +
                    esc(ml.baselineAccuracy != null ? Number(ml.baselineAccuracy).toFixed(4) : '—'),
                'OK',
                'Jakość modelu (AUC) vs dokładność reguł (baseline). AUC blisko baseline = model niewiele lepszy od reguł.'
            );
            html += row(
                'Wiersze / run',
                esc(ml.trainingRows != null ? String(ml.trainingRows) : '—') +
                    ' / ' +
                    esc(ml.lastTrainingRun ? String(ml.lastTrainingRun.id).slice(0, 8) : '—'),
                'OK',
                'Wiersze treningowe i ID ostatniego treningu. Mało wierszy = słaby model — zbierz więcej decyzji (rewardy).'
            );
            html += row(
                'Dataset',
                esc(
                    ml.lastDatasetFingerprint
                        ? String(ml.lastDatasetFingerprint).slice(0, 12) + '…'
                        : '—'
                ),
                ml.lastDatasetFingerprint ? 'OK' : 'UNKNOWN',
                'Fingerprint datasetu treningowego. UNKNOWN = brak treningu na tych danych — model może być nieaktualny.'
            );
        }
        html += '</div>';
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
        Promise.allSettled([
            getJson('/api/version').then(function (r) {
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
            el.innerHTML = '<div class="ops-grid"></div>';
            var grid = el.querySelector('.ops-grid');
            function bodyOf(r) {
                if (!r || r.status !== 'fulfilled' || !r.value) return null;
                var v = r.value;
                return v && v.body !== undefined && v.headers !== undefined ? v.body : v;
            }
            // CSP tylko z odpowiedzi za Helmet (ml-status); brak odpowiedzi = undefined = UNKNOWN.
            function headerOf(r) {
                if (!r || r.status !== 'fulfilled' || !r.value) return undefined;
                var v = r.value;
                if (v && v.headers && typeof v.headers.get === 'function')
                    return v.headers.get('content-security-policy');
                return null;
            }
            renderApp(grid, bodyOf(results[0]), bodyOf(results[1]));
            renderHealth(grid, bodyOf(results[2]), bodyOf(results[3]));
            renderApi(grid, bodyOf(results[4]), cspStatus(headerOf(results[5])));
            renderMl(grid, bodyOf(results[5]));
            if (typeof lucide !== 'undefined' && lucide.createIcons) {
                try {
                    lucide.createIcons({ root: el });
                } catch (_e) {}
            }
        });
    }

    function init() {
        if (!document.getElementById('ops-container')) return;
        // Sesja rozwiązywana asynchronicznie (/api/auth/me) — pierwszy refresh()
        // na DOMContentLoaded trafia w pusty window.currentUser. Odśwież też
        // w momencie gotowości użytkownika (event z showLoggedIn).
        document.addEventListener('sok:user-ready', function () {
            refresh();
        });
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
