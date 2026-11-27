/**
 * opsDashboard.js — read-only dashboard operacyjny w panelu admina (index.html).
 * Tylko prezentacja istniejących endpointów: /health, /health/ready, /health/backup,
 * /api/version, /api/admin/system-info, /metrics, /api/telemetry/ai/ml-status.
 * Brak mutacji, brak nowego frameworka, brak nowych globali (IIFE).
 * Stany: OK / WARNING / ERROR / UNKNOWN (brak wymyślonych sygnałów).
 */
(function () {
    'use strict';

    var REFRESH_MS = 60000;
    var _timer = null;

    function esc(s) {
        return typeof escapeHtml === 'function' ? escapeHtml(String(s)) : escAttr(s);
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
        var scriptSrc = String(h || '')
            .split(';')
            .map(function (directive) {
                return directive.trim().split(/\s+/);
            })
            .find(function (parts) {
                return parts[0] === 'script-src';
            });
        var strong =
            scriptSrc &&
            scriptSrc.includes("'self'") &&
            !scriptSrc.includes("'unsafe-inline'") &&
            scriptSrc.some(function (source) {
                return /^'nonce-[A-Za-z0-9+/_=-]+'$/.test(source);
            });
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
        var units = ['B', 'KB', 'MB', 'GB', 'TB'];
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

    function getJson(url, acceptedStatus) {
        return fetch(url, { credentials: 'same-origin' }).then(function (res) {
            if (!res.ok && (acceptedStatus === undefined || res.status !== acceptedStatus)) {
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
            if (version) {
                var versionCommit = sysinfo && sysinfo.commitHash;
                var hasVersionCommit =
                    typeof versionCommit === 'string' && /^[0-9a-f]{7,64}$/i.test(versionCommit);
                var versionLabel = esc(version.version || '?');
                if (hasVersionCommit) {
                    versionLabel =
                        '<span><span title="' +
                        escAttr('Commit: ' + versionCommit) +
                        '">' +
                        versionLabel +
                        '</span><br>' +
                        esc(versionCommit.slice(0, 12)) +
                        '</span>';
                }
                html += row(
                    'Wersja',
                    versionLabel,
                    'OK',
                    'Numer wydania z /api/version. Najedź na wersję, aby zobaczyć pełny SHA commita.'
                );
            }
            if (sysinfo) {
                html += row(
                    'Środowisko',
                    esc(sysinfo.environment || '?'),
                    'OK',
                    'Tryb serwera (development / production). W development ścieżki i logi mogą się różnić.'
                );
                var commit = sysinfo.commitHash;
                var hasCommit = typeof commit === 'string' && /^[0-9a-f]{7,64}$/i.test(commit);
                html += row(
                    'Commit',
                    hasCommit ? esc(commit.slice(0, 12)) : 'brak identyfikatora',
                    hasCommit ? 'OK' : 'UNKNOWN',
                    'Skrót commita git działającego kodu. Pozwala powiązać zachowanie z konkretną rewizją.'
                );
                html += row(
                    'Uptime',
                    esc(fmtUptime(sysinfo.uptime)),
                    'OK',
                    'Czas od startu procesu. Nagły spadek = restart (crash, deploy, reboot).'
                );
                var rss = sysinfo.memory && sysinfo.memory.rss;
                var hasRss = Number.isSafeInteger(rss) && rss >= 0;
                var memoryLimit = sysinfo.memoryLimitBytes;
                var hasMemoryLimit = Number.isSafeInteger(memoryLimit) && memoryLimit > 0;
                if (!hasRss) {
                    html += row(
                        'Pamięć RSS',
                        '—',
                        'UNKNOWN',
                        'Brak poprawnego pomiaru RSS procesu Node.'
                    );
                } else if (hasMemoryLimit) {
                    var rssRatio = rss / memoryLimit;
                    html += row(
                        'Pamięć RSS',
                        esc(
                            fmtBytes(rss) +
                                ' / ' +
                                fmtBytes(memoryLimit) +
                                ' (' +
                                (rssRatio * 100).toFixed(1) +
                                '%)'
                        ),
                        rssRatio >= 0.8 ? 'WARNING' : 'OK',
                        'RSS procesu Node jako udział limitu pamięci procesu. WARNING od 80%; nie obejmuje pełnego użycia kontenera ani Chromium.'
                    );
                } else {
                    html += row(
                        'Pamięć RSS',
                        esc(fmtBytes(rss) + ' · limit nieznany'),
                        rss > 1024 * 1024 * 1024 ? 'WARNING' : 'OK',
                        'System nie zgłosił limitu pamięci. Używany jest awaryjny próg 1 GiB dla RSS procesu Node; nie obejmuje pełnego użycia kontenera ani Chromium.'
                    );
                }
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
        var livenessOk = !!(live && live.status === 'ok');
        html += row(
            'Liveness',
            livenessOk ? 'odpowiada' : live ? 'nieoczekiwana odpowiedź' : 'brak odpowiedzi',
            livenessOk ? 'OK' : 'ERROR',
            'Czy proces odpowiada na /health. ERROR = serwer padł lub wiesza się.'
        );
        if (!ready || !['ready', 'not_ready'].includes(ready.status)) {
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
                'Baza PostgreSQL nie odpowiada (SELECT 1 nie przeszedł). Sprawdź usługę i backup.'
            );
        }
        html += '</div>';
        container.innerHTML += html;
    }

    function backupRow(backup) {
        if (!backup || !['ok', 'stale'].includes(backup.status)) {
            return row('Świeżość backupu', 'brak danych', 'UNKNOWN');
        }
        var hasAge = Number.isFinite(backup.ageHours) && backup.ageHours >= 0;
        var hasLimit = Number.isFinite(backup.maxAgeHours) && backup.maxAgeHours > 0;
        var age = hasAge ? backup.ageHours + ' h' : 'brak zweryfikowanej kopii';
        var limit = hasLimit ? ' / limit ' + backup.maxAgeHours + ' h' : '';
        return row(
            'Świeżość backupu',
            esc(age + limit),
            backup.status === 'stale' ? 'WARNING' : hasAge && hasLimit ? 'OK' : 'UNKNOWN',
            'Wiek zapisu ostatniej udanej weryfikacji kopii wg /health/backup.'
        );
    }

    function renderApi(container, metrics, csp, backup) {
        var html =
            '<div class="ops-card"><h4 title="' +
            escAttr(
                'Ruch i kondycja API z /metrics. WARNING przy 5xx / busy / błędach audytu / braku backupów / braku CSP.'
            ) +
            '"><i data-lucide="server"></i>API</h4>';
        if (!metrics) {
            html += row('Metryki', 'brak danych', 'UNKNOWN', 'Liczniki /metrics tylko dla admina.');
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
                'Błędy 5xx od startu',
                esc(String(errors)),
                total === 0 ? 'UNKNOWN' : errors > 0 ? 'WARNING' : 'OK',
                'Licznik procesu. Szczegóły odpowiedzi znajdziesz w logach serwera.'
            );
            html += endpointErrorRows(eps);
            html += row(
                'DB: zapytania / busy',
                esc(String((metrics.db && metrics.db.queries) || 0)) +
                    ' / ' +
                    esc(String((metrics.db && metrics.db.busy) || 0)),
                (metrics.db && metrics.db.busy) > 0 ? 'WARNING' : 'OK',
                'Zapytania DB i zgłoszone problemy z dostępnością bazy. busy >0 oznacza błąd zaklasyfikowany jako konflikt lub timeout.'
            );
            html += row(
                'Błędy audytu',
                esc(String((metrics.audit && metrics.audit.failures) || 0)),
                (metrics.audit && metrics.audit.failures) > 0 ? 'WARNING' : 'OK',
                'Nieudane zapisy audytu (tabela audit). >0 = dziura w historii zmian — sprawdź bazę i miejsce na dysku.'
            );
            if (metrics.storage) {
                var dbBytes = metrics.storage.dbBytes;
                html += row(
                    'Rozmiar bazy PostgreSQL',
                    Number.isSafeInteger(dbBytes) && dbBytes > 0 ? esc(fmtBytes(dbBytes)) : '—',
                    Number.isSafeInteger(dbBytes) && dbBytes > 0 ? 'OK' : 'UNKNOWN',
                    metrics.storage.dbSizeStatus === 'unavailable'
                        ? 'Pomiar PostgreSQL niedostępny. Sprawdź logi aplikacji.'
                        : 'Miejsce zajęte przez bieżącą bazę PostgreSQL.'
                );
                html += row(
                    'Lokalne pliki kopii',
                    esc(String(metrics.storage.backups || 0)) +
                        (metrics.storage.lastBackupAt
                            ? ' (ostatni: ' + esc(metrics.storage.lastBackupAt.slice(0, 10)) + ')'
                            : ' (brak)'),
                    (metrics.storage.backups || 0) > 0 ? 'OK' : 'WARNING',
                    'Liczba plików i data modyfikacji najnowszego pliku.'
                );
            }
        }
        html += backupRow(backup);
        html += row(
            'CSP enforce',
            csp.label,
            csp.state,
            'Treść nagłówka Content-Security-Policy z /api/telemetry/ai/ml-status (za Helmet; /api/version i /api/admin/system-info są przed Helmet i nie niosą CSP). OK = script-src + nonce (kontrakt headers.test.ts). Sam Report-Only nie dowodzi enforce.'
        );
        html += '</div>';
        container.innerHTML += html;
    }

    function endpointErrorRows(endpoints) {
        var entries = Object.entries(endpoints);
        var sampled = entries.filter(function (entry) {
            return entry[1].recent && entry[1].recent.n > 0;
        });
        var hasRecentErrors = sampled.some(function (entry) {
            return entry[1].recent.errors > 0;
        });
        var html = row(
            '5xx w ostatnich próbkach',
            sampled.length ? (hasRecentErrors ? 'wykryto' : 'brak') : 'brak próbek',
            sampled.length ? (hasRecentErrors ? 'WARNING' : 'OK') : 'UNKNOWN',
            'Maksymalnie 512 ostatnich odpowiedzi na endpoint.'
        );
        var top = entries
            .filter(function (entry) {
                return entry[1].errors > 0;
            })
            .sort(function (a, b) {
                return (
                    ((b[1].recent && b[1].recent.errors) || 0) -
                        ((a[1].recent && a[1].recent.errors) || 0) || b[1].errors - a[1].errors
                );
            })
            .slice(0, 3);
        return (
            html +
            top
                .map(function (entry) {
                    var stats = entry[1];
                    var recent = stats.recent;
                    var details = stats.errors + '/' + stats.n + ' od startu';
                    if (recent && recent.n > 0) {
                        details +=
                            ' · ' +
                            recent.errors +
                            '/' +
                            recent.n +
                            ' (' +
                            ((recent.errors / recent.n) * 100).toFixed(1) +
                            '%) · p95 ' +
                            stats.p95 +
                            ' ms · p99 ' +
                            stats.p99 +
                            ' ms';
                    }
                    return row(
                        entry[0],
                        esc(details),
                        recent ? (recent.errors ? 'WARNING' : 'OK') : 'UNKNOWN',
                        'Błędy / żądania od startu oraz w ostatnich próbkach i ich czas p95/p99.'
                    );
                })
                .join('')
        );
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
        } else if (ml.aiMlEnabled === false || !ml.mlOnline) {
            html += row(
                'Status',
                ml.aiMlEnabled === false ? 'wyłączony' : 'brak aktywnego modelu',
                'WARNING',
                'ML wyłączony (kill-switch feature_ai_ml_enabled lub brak modelu). Oferty liczone regułami — sprawdź flagę i trening.'
            );
        } else {
            var trained = ml.modelTrained === true;
            var hasAuc = trained && Number.isFinite(ml.activeModelAuc);
            var hasRun = trained && !!ml.lastTrainingRun;
            var model =
                esc(ml.modelVersion || '?') + ' @ ' + esc(String(ml.aiInfluencePct || 0)) + '%';
            html += row(
                'Model',
                model + (ml.modelTrained === false ? ' · bez treningu' : ''),
                ml.modelTrained === false ? 'WARNING' : hasAuc && hasRun ? 'OK' : 'UNKNOWN',
                'Aktywny model i jego wpływ na ranking. OK wymaga metryki ROC-AUC i udanego lokalnego treningu.'
            );
            html += row(
                'ROC-AUC modelu',
                hasAuc ? esc(ml.activeModelAuc.toFixed(4)) : '—',
                hasAuc ? 'OK' : 'UNKNOWN',
                'Metryka rozróżniania klas. OK oznacza dostępny pomiar.'
            );
            html += row(
                'Baseline accuracy',
                trained && Number.isFinite(ml.baselineAccuracy)
                    ? esc(ml.baselineAccuracy.toFixed(4))
                    : '—',
                trained && Number.isFinite(ml.baselineAccuracy) ? 'OK' : 'UNKNOWN',
                'Dokładność przewidywania klasy większościowej w zbiorze treningowym.'
            );
            html += row(
                'Próbki treningowe / przebieg',
                esc(ml.trainingRows != null ? String(ml.trainingRows) : '—') +
                    ' / ' +
                    esc(ml.lastTrainingRun ? String(ml.lastTrainingRun.id).slice(0, 8) : '—'),
                hasRun ? 'OK' : 'UNKNOWN',
                'Liczba dotyczy wyłącznie części treningowej; nie obejmuje walidacji ani testu. Id to ostatni udany lokalny przebieg aktywnego modelu.'
            );
            var gate = ml.trainingGate;
            var hasGateProgress =
                gate &&
                Number.isSafeInteger(gate.newSinceLastTrain) &&
                Number.isSafeInteger(gate.minNewData) &&
                gate.minNewData > 0;
            html += row(
                'Nowe cechy / próg',
                hasGateProgress ? esc(gate.newSinceLastTrain + ' / ' + gate.minNewData) : '—',
                hasGateProgress ? (gate.eligible === true ? 'OK' : 'WARNING') : 'UNKNOWN',
                'Liczba nowych rekordów AiFeature kwalifikujących się do treningu. Nie jest liczbą wszystkich zdarzeń telemetrycznych. Cron rozpoczyna trening po osiągnięciu progu; admin może ręcznie wymusić ekstrakcję przy 0 cech.'
            );
            html += row(
                'Dataset',
                esc(
                    ml.lastDatasetFingerprint
                        ? String(ml.lastDatasetFingerprint).slice(0, 12) + '…'
                        : '—'
                ),
                ml.lastDatasetFingerprint ? 'OK' : 'UNKNOWN',
                'Skrót zbioru z udanego lokalnego treningu aktywnego modelu.'
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
            getJson('/health/ready', 503)
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
            }),
            getJson('/health/backup', 503).catch(function () {
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
            renderApi(
                grid,
                bodyOf(results[4]),
                cspStatus(headerOf(results[5])),
                bodyOf(results[6])
            );
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
