(function () {
    'use strict';

    // P7.8 — zakładka Transfer Center (.sokml) w AI Dashboard.
    // Wzorzec: aiDashboardMl.js (IIFE + window.aiRenderTransfer, addEventListener).
    // Jeden nowy global (renderer) — spójny z aiRenderStats/aiRenderMlStatus.

    var BASE = '/api/telemetry/ai/transfer';
    var EPS = {
        models: '/api/telemetry/ai/models',
        previewExport: BASE + '/preview-export',
        export: BASE + '/export',
        dryRun: BASE + '/dry-run',
        import: BASE + '/import',
        history: BASE + '/history'
    };

    function esc(s) {
        return typeof window.escapeHtml === 'function' ? window.escapeHtml(String(s)) : String(s);
    }

    function escAttr(s) {
        if (typeof window.escapeHtmlAttr === 'function') return window.escapeHtmlAttr(String(s));
        return String(s).replace(/"/g, '&quot;');
    }

    function toast(msg, type) {
        if (typeof window.showToast === 'function') window.showToast(msg, type);
    }

    function icons(root) {
        if (typeof lucide !== 'undefined') lucide.createIcons({ root: root });
    }

    function rawFetch(url, buffer) {
        return fetch(url, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: buffer
        });
    }

    function checkIcon(status) {
        if (status === 'PASS') return '<i data-lucide="check"></i>';
        if (status === 'WARNING') return '<i data-lucide="alert-triangle"></i>';
        return '<i data-lucide="x"></i>';
    }

    function renderChecks(host, checks) {
        host.innerHTML =
            '<ul class="ai-check-list">' +
            checks
                .map(function (c) {
                    return (
                        '<li class="ai-check-' +
                        c.status.toLowerCase() +
                        '">' +
                        checkIcon(c.status) +
                        ' <code>' +
                        esc(c.code) +
                        '</code>' +
                        (c.detail ? ' <span>' + esc(c.detail) + '</span>' : '') +
                        '</li>'
                    );
                })
                .join('') +
            '</ul>';
        icons(host);
    }

    function renderHistory(host) {
        host.innerHTML = '<p>Ładowanie historii…</p>';
        var p = window.fetchJson(EPS.history);
        if (!p || !p.then) {
            host.innerHTML = '<p>Historia niedostępna (brak połączenia).</p>';
            return;
        }
        p.then(function (res) {
            var rows = (res && res.data) || [];
            if (!rows.length) {
                host.innerHTML = '<p>Brak transferów.</p>';
                return;
            }
            host.innerHTML =
                '<table class="ai-table"><thead><tr><th>Data</th><th>Kierunek</th><th>Wersja</th><th>Wynik</th><th>Transfer</th></tr></thead><tbody>' +
                rows
                    .map(function (r) {
                        return (
                            '<tr><td>' +
                            esc(r.createdAt || '') +
                            '</td><td>' +
                            esc(r.direction || '') +
                            '</td><td>' +
                            esc(r.modelVersion || '—') +
                            '</td><td>' +
                            esc(r.status || '') +
                            '</td><td><code>' +
                            esc(r.transferId || '') +
                            '</code></td></tr>'
                        );
                    })
                    .join('') +
                '</tbody></table>';
        }).catch(function () {
            host.innerHTML = '<p>Nie udało się pobrać historii.</p>';
        });
    }

    function loadModels(select) {
        select.innerHTML = '<option value="">Ładowanie…</option>';
        var p = window.fetchJson(EPS.models);
        if (!p || !p.then) {
            select.innerHTML = '<option value="">Brak połączenia</option>';
            return;
        }
        p.then(function (res) {
            var models = (res && res.models) || [];
            select.innerHTML = models.length
                ? models
                      .map(function (m) {
                          return (
                              '<option value="' +
                              escAttr(m.id) +
                              '">' +
                              esc(m.version) +
                              ' (' +
                              esc(m.state || '?') +
                              ')</option>'
                          );
                      })
                      .join('')
                : '<option value="">Brak modeli</option>';
        }).catch(function () {
            select.innerHTML = '<option value="">Błąd pobierania</option>';
        });
    }

    function downloadPackage(modelId, scope, statusHost) {
        statusHost.textContent = 'Generowanie pakietu…';
        // Jeden POST: binarka przy OK, JSON z kodem przy błędzie (rozjazd po Content-Type).
        fetch(EPS.export, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                modelId: modelId,
                dataset: scope.dataset,
                knowledge: scope.knowledge === true ? true : undefined,
                telemetry: scope.telemetry === true ? true : undefined
            })
        })
            .then(function (resp) {
                var ct = resp.headers.get('Content-Type') || '';
                if (!resp.ok) {
                    return resp
                        .json()
                        .catch(function () {
                            return {};
                        })
                        .then(function (body) {
                            throw new Error((body && body.code) || 'ERROR');
                        });
                }
                if (ct.indexOf('application/octet-stream') === -1) {
                    throw new Error('BAD_CONTENT');
                }
                var disp = resp.headers.get('Content-Disposition') || '';
                var name = /filename="([^"]+)"/.exec(disp);
                return resp.blob().then(function (blob) {
                    return { blob: blob, name: name ? name[1] : 'sok-ai-ml.sokml' };
                });
            })
            .then(function (dl) {
                var url = URL.createObjectURL(dl.blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = dl.name;
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(function () {
                    URL.revokeObjectURL(url);
                }, 5000);
                statusHost.textContent = 'Pobrano ' + dl.name;
                toast('Wyeksportowano pakiet .sokml', 'success');
            })
            .catch(function (e) {
                statusHost.textContent = 'Eksport nie powiódł się (' + e.message + ').';
                toast('Eksport nie powiódł się', 'error');
            });
    }

    function exportScope(root) {
        function checked(id) {
            var el = root.querySelector(id);
            return !!(el && el.checked);
        }
        return {
            dataset: checked('#ai-tr-full') ? 'full' : undefined,
            knowledge: checked('#ai-tr-kb') || undefined,
            telemetry: checked('#ai-tr-tel') || undefined
        };
    }

    function scopeQuery(scope) {
        var q = [];
        if (scope.dataset) q.push('dataset=' + scope.dataset);
        if (scope.knowledge) q.push('knowledge=1');
        if (scope.telemetry) q.push('telemetry=1');
        return q.length ? '&' + q.join('&') : '';
    }

    function wireExport(root) {
        var select = root.querySelector('#ai-tr-model');
        var previewBtn = root.querySelector('#ai-tr-preview-btn');
        var exportBtn = root.querySelector('#ai-tr-export-btn');
        var previewHost = root.querySelector('#ai-tr-export-preview');
        var statusHost = root.querySelector('#ai-tr-export-status');
        if (!select || !previewBtn || !exportBtn) return;
        loadModels(select);
        previewBtn.addEventListener('click', function () {
            if (!select.value) return;
            previewHost.innerHTML = '<p>Ładowanie podglądu…</p>';
            var url =
                EPS.previewExport +
                '?modelId=' +
                encodeURIComponent(select.value) +
                scopeQuery(exportScope(root));
            window
                .fetchJson(url)
                .then(function (p) {
                    if (!p || p.error) {
                        previewHost.innerHTML = '<p>Podgląd niedostępny.</p>';
                        return;
                    }
                    previewHost.innerHTML =
                        '<dl class="ai-dl">' +
                        '<dt>Model</dt><dd>' +
                        esc(p.model.version) +
                        ' (' +
                        esc(p.model.state || '?') +
                        ')</dd>' +
                        '<dt>Dataset</dt><dd>' +
                        esc(p.dataset.mode) +
                        (p.dataset.fingerprint
                            ? ' <code>' + esc(p.dataset.fingerprint) + '</code>'
                            : '') +
                        (p.dataset.recordCount != null
                            ? ' (' + esc(String(p.dataset.recordCount)) + ' rekordów)'
                            : '') +
                        '</dd>' +
                        '<dt>Knowledge</dt><dd>' +
                        (p.knowledge && p.knowledge.included
                            ? esc(String(p.knowledge.patterns)) + ' patterns'
                            : 'nie') +
                        '</dd>' +
                        '<dt>Telemetria</dt><dd>' +
                        esc(p.telemetry ? p.telemetry.note : 'nie') +
                        '</dd>' +
                        '<dt>Training runs</dt><dd>' +
                        esc(String(p.trainingRuns)) +
                        '</dd>' +
                        '<dt>Szacowany rozmiar</dt><dd>' +
                        esc(String(p.estimatedBytes)) +
                        ' B</dd>' +
                        '</dl>';
                })
                .catch(function () {
                    previewHost.innerHTML = '<p>Podgląd niedostępny.</p>';
                });
        });
        exportBtn.addEventListener('click', function () {
            if (!select.value) return;
            var confirmFn = window.aiUiConfirm || window.appConfirm;
            var run = function () {
                downloadPackage(select.value, exportScope(root), statusHost);
            };
            if (typeof confirmFn === 'function') {
                confirmFn('Wyeksportować pakiet .sokml wybranego modelu?', {
                    title: 'Eksport AI/ML',
                    okText: 'Eksportuj'
                }).then(function (ok) {
                    if (ok) run();
                });
            } else {
                run();
            }
        });
    }

    function wireImport(root, historyHost) {
        var fileInput = root.querySelector('#ai-tr-file');
        var dryBtn = root.querySelector('#ai-tr-dryrun-btn');
        var importBtn = root.querySelector('#ai-tr-import-btn');
        var resultHost = root.querySelector('#ai-tr-import-result');
        if (!fileInput || !dryBtn || !importBtn) return;
        var state = { buffer: null, dryRunId: null };
        importBtn.disabled = true;

        function readFile() {
            var file = fileInput.files && fileInput.files[0];
            if (!file) return Promise.resolve(null);
            return new Promise(function (resolve, reject) {
                var reader = new FileReader();
                reader.onload = function () {
                    resolve(reader.result);
                };
                reader.onerror = function () {
                    reject(new Error('read'));
                };
                reader.readAsArrayBuffer(file);
            });
        }

        dryBtn.addEventListener('click', function () {
            resultHost.innerHTML = '<p>Analiza pakietu…</p>';
            importBtn.disabled = true;
            state.buffer = null;
            state.dryRunId = null;
            readFile()
                .then(function (buf) {
                    if (!buf) {
                        resultHost.innerHTML = '<p>Wybierz plik .sokml.</p>';
                        return null;
                    }
                    return rawFetch(EPS.dryRun, buf).then(function (resp) {
                        return resp.json().then(function (body) {
                            return { resp: resp, body: body, buf: buf };
                        });
                    });
                })
                .then(function (out) {
                    if (!out) return;
                    if (!out.resp.ok) {
                        resultHost.innerHTML =
                            '<p>Dry-run odrzucony: <code>' +
                            esc((out.body && out.body.code) || 'ERROR') +
                            '</code></p>';
                        return;
                    }
                    state.buffer = out.buf;
                    state.dryRunId = out.body.dryRunId;
                    var pv = out.body.preview;
                    var extras = '';
                    if (pv.datasetRecords != null)
                        extras +=
                            '<p>Dataset FULL: ' + esc(String(pv.datasetRecords)) + ' rekordów</p>';
                    if (pv.knowledgePatterns != null)
                        extras +=
                            '<p>Knowledge: ' + esc(String(pv.knowledgePatterns)) + ' patterns</p>';
                    if (pv.telemetryGroups != null)
                        extras +=
                            '<p>Telemetria: ' +
                            esc(String(pv.telemetryGroups)) +
                            ' grup (informacyjnie)</p>';
                    var html =
                        '<p>Pakiet: <code>' +
                        esc(pv.packageFingerprint) +
                        '</code></p>' +
                        '<p>Model: ' +
                        esc(pv.modelVersion) +
                        ' → wynik: CANDIDATE</p>' +
                        extras;
                    resultHost.innerHTML = html;
                    var checksHost = document.createElement('div');
                    resultHost.appendChild(checksHost);
                    renderChecks(checksHost, out.body.checks || []);
                    if (out.body.status !== 'blocked') {
                        importBtn.disabled = false;
                    } else {
                        var blocked = document.createElement('p');
                        blocked.textContent = 'IMPORT BLOCKED — popraw pakiet.';
                        resultHost.appendChild(blocked);
                    }
                })
                .catch(function () {
                    resultHost.innerHTML = '<p>Dry-run nie powiódł się.</p>';
                });
        });

        importBtn.addEventListener('click', function () {
            if (!state.buffer || !state.dryRunId) return;
            var confirmFn = window.aiUiConfirm || window.appConfirm;
            var run = function () {
                importBtn.disabled = true;
                rawFetch(
                    EPS.import + '?dryRunId=' + encodeURIComponent(state.dryRunId),
                    state.buffer
                )
                    .then(function (resp) {
                        return resp.json().then(function (body) {
                            return { resp: resp, body: body };
                        });
                    })
                    .then(function (out) {
                        if (!out.resp.ok) {
                            resultHost.innerHTML =
                                '<p>Import odrzucony: <code>' +
                                esc((out.body && out.body.code) || 'ERROR') +
                                '</code></p>';
                            return;
                        }
                        resultHost.innerHTML =
                            '<p>Wynik: <strong>' +
                            esc(out.body.status) +
                            '</strong> — wersja ' +
                            esc(out.body.version || '?') +
                            ' (' +
                            esc(out.body.transferId || '') +
                            '). Model wymaga APPROVE → PROMOTE.</p>';
                        toast('Import zakończony: ' + out.body.status, 'success');
                        renderHistory(historyHost);
                    })
                    .catch(function () {
                        resultHost.innerHTML = '<p>Import nie powiódł się.</p>';
                        importBtn.disabled = false;
                    });
            };
            if (typeof confirmFn === 'function') {
                confirmFn('Zaimportować pakiet jako CANDIDATE?', {
                    title: 'Import AI/ML',
                    okText: 'Importuj',
                    type: 'danger'
                }).then(function (ok) {
                    if (ok) run();
                });
            } else {
                run();
            }
        });
    }

    window.aiRenderTransfer = function (host) {
        if (!host) return;
        if (typeof window.aiMlEnabled === 'function' && !window.aiMlEnabled()) {
            host.innerHTML =
                typeof window.aiMlDisabledHtml === 'function' ? window.aiMlDisabledHtml() : '';
            return;
        }
        host.innerHTML =
            '<h4 class="ai-section-title"><i data-lucide="arrow-left-right"></i> Transfer Center (.sokml)</h4>' +
            '<div class="ai-toolbar"><strong>Eksport</strong></div>' +
            '<div class="ai-toolbar">' +
            '<select id="ai-tr-model" class="ai-filter-input" aria-label="Model do eksportu"></select>' +
            '<button id="ai-tr-preview-btn" class="ai-btn"><i data-lucide="eye"></i> Podgląd</button>' +
            '<button id="ai-tr-export-btn" class="ai-btn ai-btn-primary"><i data-lucide="download"></i> Eksportuj .sokml</button>' +
            '</div>' +
            '<div class="ai-toolbar">' +
            '<label><input type="checkbox" id="ai-tr-full"> Dataset FULL (rekordy)</label>' +
            '<label><input type="checkbox" id="ai-tr-kb"> Knowledge (patterns)</label>' +
            '<label title="Agregaty operacyjne z 30 dni — informacyjnie, bez zapisu u celu"><input type="checkbox" id="ai-tr-tel"> Telemetria (agregaty)</label>' +
            '</div>' +
            '<div id="ai-tr-export-preview"></div>' +
            '<p id="ai-tr-export-status" aria-live="polite"></p>' +
            '<div class="ai-divider" role="separator"></div>' +
            '<div class="ai-toolbar"><strong>Import</strong></div>' +
            '<div class="ai-toolbar">' +
            '<input type="file" id="ai-tr-file" accept=".sokml" aria-label="Plik pakietu .sokml">' +
            '<button id="ai-tr-dryrun-btn" class="ai-btn"><i data-lucide="search"></i> Dry-run</button>' +
            '<button id="ai-tr-import-btn" class="ai-btn ai-btn-primary"><i data-lucide="upload"></i> Importuj</button>' +
            '</div>' +
            '<div id="ai-tr-import-result" aria-live="polite"></div>' +
            '<div class="ai-divider" role="separator"></div>' +
            '<div class="ai-toolbar"><strong>Historia transferów</strong></div>' +
            '<div id="ai-tr-history"></div>';
        var historyHost = host.querySelector('#ai-tr-history');
        wireExport(host);
        wireImport(host, historyHost);
        renderHistory(historyHost);
        icons(host);
    };
})();
