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
        if (status === 'PASS')
            return '<i data-lucide="check-circle" class="icon-xs" aria-hidden="true"></i>';
        if (status === 'WARNING')
            return '<i data-lucide="alert-triangle" class="icon-xs" aria-hidden="true"></i>';
        return '<i data-lucide="x-circle" class="icon-xs" aria-hidden="true"></i>';
    }

    function checkLabel(status) {
        if (status === 'PASS') return 'Zgodne';
        if (status === 'WARNING') return 'Uwaga';
        return 'Blokada';
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
                        ' <span class="ops-pill ' +
                        (c.status === 'PASS'
                            ? 'ops-ok'
                            : c.status === 'WARNING'
                              ? 'ops-warn'
                              : 'ops-err') +
                        '">' +
                        checkLabel(c.status) +
                        '</span>' +
                        (c.detail ? ' <span>' + esc(c.detail) + '</span>' : '') +
                        '</li>'
                    );
                })
                .join('') +
            '</ul>';
        icons(host);
    }

    function renderHistory(host) {
        host.innerHTML = '<p class="text-muted">Ładowanie historii…</p>';
        var p = window.fetchJson(EPS.history);
        if (!p || !p.then) {
            host.innerHTML = '<p class="text-muted">Historia niedostępna (brak połączenia).</p>';
            return;
        }
        p.then(function (res) {
            var rows = (res && res.data) || [];
            if (!rows.length) {
                host.innerHTML = '<p class="text-muted">Brak zarejestrowanych transferów.</p>';
                return;
            }
            host.innerHTML =
                '<div class="ai-table-wrap">' +
                '<table class="ai-table"><thead><tr><th>Data</th><th>Kierunek</th><th>Wersja modelu</th><th>Status</th><th>Identyfikator transferu</th></tr></thead><tbody>' +
                rows
                    .map(function (r) {
                        var statusCls =
                            r.status === 'COMPLETED'
                                ? 'ops-ok'
                                : r.status === 'ALREADY_IMPORTED'
                                  ? 'ops-warn'
                                  : 'ops-err';
                        var statusLabel =
                            r.status === 'COMPLETED'
                                ? 'Ukończono'
                                : r.status === 'ALREADY_IMPORTED'
                                  ? 'Już zaimportowano'
                                  : r.status === 'REJECTED'
                                    ? 'Odrzucono'
                                    : r.status;
                        return (
                            '<tr><td>' +
                            esc((r.createdAt || '').slice(0, 19).replace('T', ' ')) +
                            '</td><td><span class="ops-pill ' +
                            (r.direction === 'EXPORT' ? 'ops-ok' : 'ops-warn') +
                            '">' +
                            esc(r.direction === 'EXPORT' ? 'Eksport' : 'Import') +
                            '</span></td><td><code>' +
                            esc(r.modelVersion || '—') +
                            '</code></td><td><span class="ops-pill ' +
                            statusCls +
                            '">' +
                            esc(statusLabel) +
                            '</span></td><td><code>' +
                            esc(r.transferId || '') +
                            '</code></td></tr>'
                        );
                    })
                    .join('') +
                '</tbody></table></div>';
        }).catch(function () {
            host.innerHTML = '<p class="text-muted">Nie udało się pobrać historii transferów.</p>';
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
                        '<dt>Model</dt><dd><code>' +
                        esc(p.model.version) +
                        '</code> (' +
                        esc(p.model.state || 'nieznany') +
                        ')</dd>' +
                        '<dt>Zbiór danych</dt><dd>' +
                        esc(
                            p.dataset.mode === 'full'
                                ? 'Pełny (records.ndjson)'
                                : p.dataset.mode === 'fingerprint-only'
                                  ? 'Tylko sygnatura (fingerprint)'
                                  : 'Brak'
                        ) +
                        (p.dataset.fingerprint
                            ? ' <code>' + esc(p.dataset.fingerprint) + '</code>'
                            : '') +
                        (p.dataset.recordCount != null
                            ? ' (' + esc(String(p.dataset.recordCount)) + ' rekordów)'
                            : '') +
                        '</dd>' +
                        '<dt>Baza wiedzy</dt><dd>' +
                        (p.knowledge && p.knowledge.included
                            ? esc(String(p.knowledge.patterns)) + ' wzorców'
                            : 'Brak') +
                        '</dd>' +
                        '<dt>Telemetria</dt><dd>' +
                        esc(p.telemetry ? p.telemetry.note : 'Brak') +
                        '</dd>' +
                        '<dt>Cykle treningowe</dt><dd>' +
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
                            '<p>Pełny zbiór danych: <strong>' +
                            esc(String(pv.datasetRecords)) +
                            '</strong> rekordów</p>';
                    if (pv.knowledgePatterns != null)
                        extras +=
                            '<p>Wzorce bazy wiedzy: <strong>' +
                            esc(String(pv.knowledgePatterns)) +
                            '</strong> pozycji</p>';
                    if (pv.telemetryGroups != null)
                        extras +=
                            '<p>Telemetria: <strong>' +
                            esc(String(pv.telemetryGroups)) +
                            '</strong> grup operacyjnych</p>';
                    var html =
                        '<p>Sygnatura pakietu: <code>' +
                        esc(pv.packageFingerprint) +
                        '</code></p>' +
                        '<p>Wersja modelu: <code>' +
                        esc(pv.modelVersion) +
                        '</code> → status po imporcie: <strong>CANDIDATE (Kandydat)</strong></p>' +
                        extras;
                    resultHost.innerHTML = html;
                    var checksHost = document.createElement('div');
                    resultHost.appendChild(checksHost);
                    renderChecks(checksHost, out.body.checks || []);
                    if (out.body.status !== 'blocked') {
                        importBtn.disabled = false;
                    } else {
                        var blocked = document.createElement('p');
                        blocked.className = 'text-danger';
                        blocked.textContent = 'Import zablokowany — pakiet zawiera niezgodności.';
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
                            esc(
                                out.body.status === 'IMPORTED'
                                    ? 'Pomyślnie zaimportowano'
                                    : out.body.status === 'ALREADY_IMPORTED'
                                      ? 'Pakiet był już wcześniej zaimportowany'
                                      : out.body.status
                            ) +
                            '</strong> — wersja modelu: <code>' +
                            esc(out.body.version || '?') +
                            '</code> (identyfikator: <code>' +
                            esc(out.body.transferId || '') +
                            '</code>). Model otrzymał status CANDIDATE i wymaga zatwierdzenia przez administratora (Zatwierdź / Awansuj).</p>';
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

    function disabledHtml() {
        return typeof window.aiMlDisabledHtml === 'function' ? window.aiMlDisabledHtml() : '';
    }

    function unknownHtml() {
        return typeof window.aiMlUnknownHtml === 'function' ? window.aiMlUnknownHtml() : '';
    }

    // Bramka kill-switcha: aiMlEnabled() zwraca Promise (tri-state true/false/null).
    // true → panel, false → blokada, null/błąd → UNKNOWN. Nigdy nic wykonywalnego
    // przed rozstrzygnięciem (loading), nigdy zgadywania ON.
    window.aiRenderTransfer = function (host) {
        if (!host) return;
        if (typeof window.aiMlEnabled === 'function') {
            host.innerHTML = '<div class="ai-ml-loading">Ładowanie...</div>';
            window
                .aiMlEnabled()
                .then(function (on) {
                    if (on === true) renderTransferOpen(host);
                    else {
                        host.innerHTML = on === false ? disabledHtml() : unknownHtml();
                        icons(host);
                    }
                })
                .catch(function () {
                    host.innerHTML = unknownHtml();
                    icons(host);
                });
            return;
        }
        renderTransferOpen(host);
    };

    function renderTransferOpen(host) {
        host.innerHTML =
            '<h4 class="ai-section-title"><i data-lucide="arrow-left-right"></i> Centrum transferu modeli i danych (.sokml)</h4>' +
            '<div class="ai-transfer-grid">' +
            '  <div class="ai-transfer-card">' +
            '    <div class="ai-transfer-card-header"><i data-lucide="upload"></i> Eksport pakietu .sokml</div>' +
            '    <div class="ai-toolbar" style="margin-bottom:0">' +
            '      <select id="ai-tr-model" class="ai-filter-input" style="width:100%" aria-label="Model do eksportu"></select>' +
            '    </div>' +
            '    <div class="ai-transfer-options">' +
            '      <label><input type="checkbox" id="ai-tr-full"> Pełny zbiór uczący (records.ndjson)</label>' +
            '      <label><input type="checkbox" id="ai-tr-kb"> Baza wiedzy (wzorce i reguły)</label>' +
            '      <label title="Agregaty operacyjne z ostatnich 30 dni — tylko informacyjnie"><input type="checkbox" id="ai-tr-tel"> Podsumowanie telemetrii (agregaty)</label>' +
            '    </div>' +
            '    <div class="ai-toolbar" style="margin-bottom:0">' +
            '      <button id="ai-tr-preview-btn" class="ai-btn"><i data-lucide="eye"></i> Podgląd zawartości</button>' +
            '      <button id="ai-tr-export-btn" class="ai-btn ai-btn-primary"><i data-lucide="download"></i> Eksportuj pakiet</button>' +
            '    </div>' +
            '    <div id="ai-tr-export-preview" class="ai-transfer-preview"></div>' +
            '    <p id="ai-tr-export-status" class="ai-transfer-status" aria-live="polite"></p>' +
            '  </div>' +
            '  <div class="ai-transfer-card">' +
            '    <div class="ai-transfer-card-header"><i data-lucide="download"></i> Import i weryfikacja pakietu</div>' +
            '    <div class="ai-file-btn-wrapper">' +
            '      <input type="file" id="ai-tr-file" accept=".sokml" aria-label="Wybierz plik pakietu .sokml">' +
            '    </div>' +
            '    <div class="ai-toolbar" style="margin-bottom:0">' +
            '      <button id="ai-tr-dryrun-btn" class="ai-btn"><i data-lucide="search"></i> Wykonaj próbę (Dry-run)</button>' +
            '      <button id="ai-tr-import-btn" class="ai-btn ai-btn-primary"><i data-lucide="check"></i> Zatwierdź import</button>' +
            '    </div>' +
            '    <div id="ai-tr-import-result" class="ai-transfer-preview" aria-live="polite"></div>' +
            '  </div>' +
            '</div>' +
            '<div class="ai-divider" role="separator"></div>' +
            '<div class="ai-section-title"><i data-lucide="history"></i> Historia operacji transferu</div>' +
            '<div id="ai-tr-history"></div>';
        var historyHost = host.querySelector('#ai-tr-history');
        wireExport(host);
        wireImport(host, historyHost);
        renderHistory(historyHost);
        icons(host);
    }
})();
