(function () {
    'use strict';

    // Extract z aiDashboardMl.js (Etap 1, przeniesienie 1:1): leaf-renderery paneli ML.
    // getEndpoints to lokalna kopia - mlPanels.js nie zalezy od aiDashboardMl.js.

    function getEndpoints() {
        return window.AI_ENDPOINTS || {};
    }

    function renderTrainingSources(container) {
        const host = container.querySelector('.ai-training-sources-host');
        if (!host) return;
        host.innerHTML = window.aiLoadingHtml();
        const pSources = window.fetchJson(getEndpoints().trainingUsers);
        const pUsers = window.fetchJson(getEndpoints().users);
        if (!pSources || !pUsers) {
            host.innerHTML = window.aiApiErrorHtml('server');
            return;
        }
        Promise.all([pSources, pUsers])
            .then(function (results) {
                const sources = results[0] || {};
                const usersResp = results[1] || {};
                if (sources.error) {
                    host.innerHTML = window.aiApiErrorHtml(sources.error);
                    return;
                }
                const users = Array.isArray(usersResp.data)
                    ? usersResp.data
                    : Array.isArray(usersResp)
                      ? usersResp
                      : [];
                const configured = sources.configured === true;
                const selected = Array.isArray(sources.userIds) ? sources.userIds : [];
                const selectedSet = {};
                selected.forEach(function (id) {
                    selectedSet[id] = true;
                });
                let banner;
                if (!configured) {
                    banner =
                        '<div class="card-note card-note--with-icon"><i data-lucide="alert-triangle"></i>' +
                        '<span><strong>Tryb: wszyscy użytkownicy</strong> (allowlista nieskonfigurowana) — model uczy się na danych wszystkich.</span></div>';
                } else if (selected.length === 0) {
                    banner =
                        '<div class="card-note card-note--with-icon"><i data-lucide="pause-circle"></i>' +
                        '<span><strong>Tryb: nikt</strong> — allowlista pusta, model nie uczy się na nowych danych.</span></div>';
                } else {
                    banner =
                        '<div class="card-note card-note--with-icon"><i data-lucide="users"></i>' +
                        '<span><strong>Tryb: allowlista (' +
                        selected.length +
                        ' wybranych)</strong> — trening i wzorce tylko z wybranych użytkowników. Wzorce historyczne sprzed konfiguracji wygasają naturalnie (archiwizacja 90 dni).</span></div>';
                }
                const tiles = users
                    .map(function (u) {
                        const fullName =
                            u.firstName || u.lastName
                                ? ((u.firstName || '') + ' ' + (u.lastName || '')).trim()
                                : u.username || u.id;
                        const username = u.username || u.id;
                        const role = u.role || 'USER';
                        const isChecked = Boolean(selectedSet[u.id]);
                        const iconName = role === 'ADMIN' ? 'shield-check' : 'user';
                        const roleBadge =
                            role === 'ADMIN'
                                ? '<span style="display:inline-block;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:700;background:rgba(var(--accent-rgb,59,130,246),0.2);color:var(--accent);border:1px solid rgba(var(--accent-rgb,59,130,246),0.3)">ADMIN</span>'
                                : '<span style="display:inline-block;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:600;background:var(--bg-subtle,rgba(255,255,255,0.08));color:var(--text-secondary)">' +
                                  window.escapeHtml(role) +
                                  '</span>';
                        const tileStyle = isChecked
                            ? 'border-color:var(--accent);background:rgba(var(--accent-rgb, 59, 130, 246), 0.14);box-shadow:0 0 0 1px var(--accent);'
                            : 'border-color:var(--border-color, #334155);background:var(--bg-card, #1e293b);box-shadow:none;';

                        return (
                            '<label class="ai-user-tile' +
                            (isChecked ? ' selected' : '') +
                            '" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:var(--radius-md, 8px);border:1px solid;cursor:pointer;transition:all 0.15s ease;user-select:none;' +
                            tileStyle +
                            '">' +
                            '<input type="checkbox" class="ai-source-user" value="' +
                            window.aiEscapeHtmlAttr(u.id || '') +
                            '"' +
                            (isChecked ? ' checked' : '') +
                            ' style="accent-color:var(--accent);width:16px;height:16px;flex-shrink:0;cursor:pointer">' +
                            '<div class="ai-user-tile-avatar" style="width:34px;height:34px;border-radius:50%;background:rgba(var(--accent-rgb,59,130,246),0.12);border:1px solid rgba(var(--accent-rgb,59,130,246),0.25);display:flex;align-items:center;justify-content:center;color:var(--accent);flex-shrink:0">' +
                            '<i data-lucide="' +
                            iconName +
                            '"></i>' +
                            '</div>' +
                            '<div style="display:flex;flex-direction:column;min-width:0;flex:1">' +
                            '<span style="font-weight:600;font-size:var(--fs-md);color:var(--text-primary);line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
                            window.escapeHtml(fullName) +
                            '</span>' +
                            '<div style="display:flex;align-items:center;gap:6px;margin-top:2px;font-size:var(--fs-xs);color:var(--text-muted)"><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">@' +
                            window.escapeHtml(username) +
                            '</span>' +
                            roleBadge +
                            '</div>' +
                            '</div>' +
                            '</label>'
                        );
                    })
                    .join('');
                host.innerHTML =
                    '<div class="ai-section-title"><i data-lucide="users"></i> Źródła danych treningowych</div>' +
                    banner +
                    '<div class="ai-training-sources-list" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(220px, 1fr));gap:10px;max-height:280px;overflow-y:auto;margin-top:10px;padding:2px">' +
                    (tiles || '<div class="card-note">Brak użytkowników do wyboru.</div>') +
                    '</div>' +
                    '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:16px;margin-bottom:8px;flex-wrap:wrap">' +
                    '<div style="display:flex;align-items:center;gap:10px">' +
                    '<button type="button" id="ai-sources-select-all" class="btn btn-sm" style="display:inline-flex;align-items:center;gap:6px;padding:7px 14px;font-size:var(--fs-xs);font-weight:600;cursor:pointer;border-radius:var(--radius-sm);background:rgba(var(--accent-rgb,59,130,246),0.16);border:1px solid var(--accent);color:var(--accent);transition:all 0.15s ease" title="Zaznacz wszystkich użytkowników"><i data-lucide="check-square" class="icon-xs"></i> Zaznacz wszystkich</button>' +
                    '<button type="button" id="ai-sources-select-none" class="btn btn-sm" style="display:inline-flex;align-items:center;gap:6px;padding:7px 14px;font-size:var(--fs-xs);font-weight:600;cursor:pointer;border-radius:var(--radius-sm);background:rgba(var(--warn-rgb,245,158,11),0.12);border:1px solid var(--warn-border,rgba(245,158,11,0.4));color:var(--warn,#f59e0b);transition:all 0.15s ease" title="Odznacz wszystkich (wyłącza zbieranie od wszystkich)"><i data-lucide="square" class="icon-xs"></i> Odznacz wszystkich</button>' +
                    '</div>' +
                    '<div class="ai-sources-hint" style="display:inline-flex;align-items:center;gap:6px;font-size:var(--fs-xs);color:var(--text-secondary);background:var(--bg-subtle,rgba(255,255,255,0.06));padding:6px 12px;border-radius:var(--radius-sm, 6px);border:1px solid var(--border-color,rgba(255,255,255,0.1));margin-left:auto">' +
                    '<i data-lucide="check-circle-2" class="icon-xs" style="color:var(--success)"></i> <span style="font-weight:500">Zmiana zapisuje się automatycznie</span>' +
                    '</div>' +
                    '</div>';
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons({ root: host });
                }
                function updateTileState(cb) {
                    const tile = cb.closest('.ai-user-tile');
                    if (!tile) return;
                    if (cb.checked) {
                        tile.classList.add('selected');
                        tile.style.borderColor = 'var(--accent)';
                        tile.style.background = 'rgba(var(--accent-rgb, 59, 130, 246), 0.12)';
                        tile.style.boxShadow = '0 0 0 1px var(--accent)';
                    } else {
                        tile.classList.remove('selected');
                        tile.style.borderColor = 'var(--border-color, #334155)';
                        tile.style.background = 'var(--bg-card, #1e293b)';
                        tile.style.boxShadow = 'none';
                    }
                }
                let saveTimer = null;
                const save = function () {
                    if (saveTimer) clearTimeout(saveTimer);
                    saveTimer = setTimeout(function () {
                        const checked = Array.prototype.map.call(
                            host.querySelectorAll('.ai-source-user:checked'),
                            function (el) {
                                return el.value;
                            }
                        );
                        const p = window.fetchJson(getEndpoints().trainingUsers, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ userIds: checked })
                        });
                        if (!p) return;
                        p.then(function (result) {
                            if (result && !result.error) {
                                if (typeof window.showToast === 'function')
                                    window.showToast(
                                        'Źródła treningu: ' + checked.length + ' wybranych',
                                        'success'
                                    );
                                window.aiRenderTrainingSources(container);
                            } else if (typeof window.showToast === 'function') {
                                window.showToast('Błąd zapisu źródeł treningu', 'error');
                            }
                        }).catch(function () {
                            if (typeof window.showToast === 'function')
                                window.showToast('Błąd zapisu źródeł treningu', 'error');
                        });
                    }, 600);
                };
                host.querySelectorAll('.ai-source-user').forEach(function (cb) {
                    cb.addEventListener('change', function () {
                        updateTileState(cb);
                        save();
                    });
                });
                const allBtn = host.querySelector('#ai-sources-select-all');
                const noneBtn = host.querySelector('#ai-sources-select-none');
                if (allBtn) {
                    allBtn.addEventListener('click', function () {
                        host.querySelectorAll('.ai-source-user').forEach(function (cb) {
                            cb.checked = true;
                            updateTileState(cb);
                        });
                        save();
                    });
                }
                if (noneBtn) {
                    noneBtn.addEventListener('click', function () {
                        host.querySelectorAll('.ai-source-user').forEach(function (cb) {
                            cb.checked = false;
                            updateTileState(cb);
                        });
                        save();
                    });
                }
            })
            .catch(function () {
                host.innerHTML = window.aiApiErrorHtml('server');
            });
    }
    window.aiRenderTrainingSources = renderTrainingSources;

    function renderTrainingRuns(container) {
        const host = container.querySelector('.ai-training-runs-host');
        if (!host) return;
        host.innerHTML = window.aiLoadingHtml();
        const p = window.fetchJson(getEndpoints().trainingRuns);
        if (!p) {
            host.innerHTML = window.aiApiErrorHtml('server');
            return;
        }
        p.then(function (data) {
            if (!data || data.error) {
                host.innerHTML = window.aiApiErrorHtml(data && data.error ? data.error : 'server');
                return;
            }
            const runs = data.runs || [];
            if (!runs.length) {
                host.innerHTML =
                    '<div class="ai-model-empty">Brak zapisanych przebiegów treningu.</div>';
                return;
            }
            const rows = runs
                .map(function (r) {
                    const statusCls =
                        r.status === 'SUCCESS'
                            ? 'class="fs-xl-success-bold"'
                            : r.status === 'RUNNING'
                              ? 'style="color:var(--warn);font-weight: var(--fw-bold)"'
                              : r.status === 'SKIPPED'
                                ? 'class="text-muted"'
                                : 'class="fs-xl-danger-bold"';
                    const range =
                        r.datasetStartAt && r.datasetEndAt
                            ? r.datasetStartAt.slice(0, 10) + ' → ' + r.datasetEndAt.slice(0, 10)
                            : '—';
                    const fp = r.datasetFingerprint ? r.datasetFingerprint.slice(0, 8) : '—';
                    return (
                        '<tr>' +
                        '<td style="white-space:nowrap;color:var(--text-muted);font-size: var(--fs-base)">' +
                        window.escapeHtml((r.startedAt || '').slice(0, 16)) +
                        '</td>' +
                        '<td ' +
                        statusCls +
                        '>' +
                        window.escapeHtml(r.status || '—') +
                        '</td>' +
                        '<td>' +
                        (r.datasetSize || 0) +
                        ' (' +
                        (r.trainSize || 0) +
                        '/' +
                        (r.validationSize || 0) +
                        '/' +
                        (r.testSize || 0) +
                        ')</td>' +
                        '<td>' +
                        window.escapeHtml(r.candidateModelVersion || '—') +
                        '</td>' +
                        '<td>' +
                        (r.deployed ? 'Tak' : '—') +
                        '</td>' +
                        '<td>' +
                        window.escapeHtml(range) +
                        '</td>' +
                        '<td style="font-family:monospace;font-size: var(--fs-base);color:var(--text-muted)">' +
                        window.escapeHtml(fp) +
                        '</td>' +
                        '</tr>'
                    );
                })
                .join('');
            host.innerHTML =
                '<div class="ai-section-title"><i data-lucide="history"></i> Przebiegi treningu (ostatnie 20)</div>' +
                '<div class="ai-table-wrap">' +
                '<table class="ai-table">' +
                '<thead><tr>' +
                '<th scope="col" title="Data rozpoczęcia przebiegu">Start</th>' +
                '<th scope="col" title="Status przebiegu (SUCCESS/SKIPPED/FAILED_*)">Status</th>' +
                '<th scope="col" title="Rozmiar zbioru: dataset (train/validation/test)">Zbiór</th>' +
                '<th scope="col" title="Wersja modelu wyprodukowanego przez przebieg">Model</th>' +
                '<th scope="col" title="Czy model został wdrożony do produkcji">Wdrożony</th>' +
                '<th scope="col" title="Zakres czasowy zbioru treningowego">Zakres datasetu</th>' +
                '<th scope="col" title="Skrót fingerprintu zbioru (SHA-256, 8 znaków)">Fingerprint</th>' +
                '</tr></thead><tbody>' +
                rows +
                '</tbody></table></div>';
            if (typeof lucide !== 'undefined') {
                lucide.createIcons({ root: host });
            }
        }).catch(function () {
            host.innerHTML = window.aiApiErrorHtml('server');
        });
    }
    window.aiRenderTrainingRuns = renderTrainingRuns;

    function renderDrift(container) {
        const host = container.querySelector('.ai-drift-host');
        if (!host) return;
        host.innerHTML = window.aiLoadingHtml();
        const p = window.fetchJson(getEndpoints().drift);
        if (!p) {
            host.innerHTML = window.aiApiErrorHtml('server');
            return;
        }
        p.then(function (data) {
            if (!data || data.error) {
                host.innerHTML = window.aiApiErrorHtml(data && data.error ? data.error : 'server');
                return;
            }
            const psiBadge = function (psi) {
                if (psi == null || !Number.isFinite(Number(psi))) {
                    return '<span class="text-muted">brak danych</span>';
                }
                const v = Number(psi);
                const color =
                    v < 0.1
                        ? 'var(--success-hover)'
                        : v < 0.25
                          ? 'var(--warn)'
                          : 'var(--danger-hover)';
                return (
                    '<span style="color:' +
                    color +
                    ';font-weight: var(--fw-bold)">' +
                    v.toFixed(4) +
                    '</span>'
                );
            };
            const featureRows = (data.feature || [])
                .slice(0, 5)
                .map(function (f, i) {
                    return (
                        '<tr>' +
                        '<td>' +
                        (i + 1) +
                        '</td>' +
                        '<td style="font-family:monospace;font-size: var(--fs-base)">' +
                        window.escapeHtml(f.feature || '—') +
                        '</td>' +
                        '<td>' +
                        psiBadge(f.psi) +
                        '</td>' +
                        '</tr>'
                    );
                })
                .join('');
            let labelHtml = '';
            const lab = data.label || {};
            if (lab.currentPositiveRate != null || lab.trainingPositiveRate != null) {
                const delta = lab.delta;
                const deltaCls =
                    delta == null
                        ? 'var(--text-muted)'
                        : Math.abs(delta) < 0.05
                          ? 'var(--success-hover)'
                          : 'var(--warn)';
                const trainingTxt =
                    lab.trainingPositiveRate != null
                        ? Number(lab.trainingPositiveRate).toFixed(4)
                        : 'brak baseline (uruchom trening)';
                labelHtml =
                    '<div class="ai-drift-label">' +
                    '<span><strong>Label drift:</strong> bieżący ' +
                    (lab.currentPositiveRate != null
                        ? Number(lab.currentPositiveRate).toFixed(4)
                        : '—') +
                    ' vs treningowy ' +
                    window.escapeHtml(trainingTxt) +
                    '</span>' +
                    '<span style="color:' +
                    deltaCls +
                    ';font-weight: var(--fw-bold)">Δ ' +
                    (delta != null ? (delta >= 0 ? '+' : '') + Number(delta).toFixed(4) : '—') +
                    '</span></div>';
            } else {
                labelHtml =
                    '<div class="ai-drift-label"><span><strong>Label drift:</strong> brak danych do oceny — uruchom trening ML</span><span class="text-muted">Δ —</span></div>';
            }
            let shadowHtml = '';
            const sh = data.shadow || {};
            if (sh.candidateVersion) {
                shadowHtml =
                    '<div class="ai-drift-label">' +
                    '<span><strong>Shadow (A/B):</strong> kandydat ' +
                    window.escapeHtml(sh.candidateVersion || '—') +
                    ' AUC ' +
                    (sh.shadowAuc != null ? Number(sh.shadowAuc).toFixed(4) : '—') +
                    ' vs produkcja ' +
                    window.escapeHtml(sh.productionVersion || '—') +
                    ' AUC ' +
                    (sh.productionAuc != null ? Number(sh.productionAuc).toFixed(4) : '—') +
                    ' (' +
                    (sh.samples || 0) +
                    ' wspólnych próbek)</span></div>';
            }
            const pred = data.prediction || {};
            const predSamplesTxt =
                pred.currentSamples != null && pred.baselineSamples != null
                    ? pred.currentSamples + ' / ' + pred.baselineSamples + ' próbek'
                    : pred.currentSamples || pred.baselineSamples
                      ? (pred.currentSamples || 0) +
                        ' próbek (baseline ' +
                        (pred.baselineSamples || 0) +
                        ')'
                      : 'brak próbek — min. 20 score';
            const predCard =
                '<div class="ai-drift-card"><strong>Prediction drift</strong><br>' +
                psiBadge(pred.psi != null ? pred.psi : null) +
                '<div class="fs-sm-muted-2px">PSI rozkładu score</div>' +
                '<div class="fs-sm-muted-2px--compact">' +
                window.escapeHtml(predSamplesTxt) +
                '</div></div>';
            const featureCount = Array.isArray(data.feature) ? data.feature.length : 0;
            const featureCard =
                '<div class="ai-drift-card"><strong>Feature drift</strong><br>' +
                '<span style="font-size:var(--fs-xl);font-weight:var(--fw-bold);color:' +
                (featureCount ? 'var(--accent)' : 'var(--text-muted)') +
                '">' +
                (featureCount ? featureCount + ' cech' : 'brak danych') +
                '</span>' +
                '<div class="fs-sm-muted-2px">top-5 cech wg PSI</div></div>';
            const featureBlock = featureRows
                ? '<div class="ai-table-wrap"><table class="ai-table"><thead><tr><th scope="col">#</th><th scope="col">Cecha</th><th scope="col">PSI</th></tr></thead><tbody>' +
                  featureRows +
                  '</tbody></table></div>'
                : '<div class="card-note">Brak danych do oceny driftu cech — baseline zapisywany jest przy treningu ML. Uruchom trening aby ustalić rozkłady referencyjne.</div>';
            host.innerHTML =
                '<div class="ai-section-title"><i data-lucide="waves"></i> Drift modelu</div>' +
                '<div class="ai-drift-grid">' +
                predCard +
                featureCard +
                '</div>' +
                featureBlock +
                labelHtml +
                shadowHtml;
            if (typeof lucide !== 'undefined') {
                lucide.createIcons({ root: host });
            }
        }).catch(function () {
            host.innerHTML = window.aiApiErrorHtml('server');
        });
    }
    window.aiRenderDrift = renderDrift;

    function renderFeatureImportance(container) {
        container.innerHTML = window.aiLoadingHtml();
        const p = window.fetchJson(getEndpoints().featureImportance);
        if (!p) {
            container.innerHTML = window.aiApiErrorHtml('server');
            return;
        }
        p.then(function (data) {
            if (!data) {
                container.innerHTML = window.aiApiErrorHtml('server');
                return;
            }
            if (data.error) {
                if (data.error === 'forbidden' || data.error === 'server') {
                    container.innerHTML = window.aiApiErrorHtml(data.error);
                    return;
                }
                if (data.error === 'unavailable') {
                    container.innerHTML =
                        '<div class="card-note">Brak aktywnego modelu — uruchom trening ML, aby zobaczyć ważność cech.</div>';
                    return;
                }
                container.innerHTML = window.aiApiErrorHtml(data.error);
                return;
            }
            const feats = data.features || [];
            if (!Array.isArray(feats) || feats.length === 0) {
                container.innerHTML =
                    '<div class="card-note">Brak aktywnego modelu — uruchom trening ML, aby zobaczyć ważność cech.</div>';
                return;
            }
            let max = feats.reduce(function (mx, f) {
                return Math.max(mx, f.importance || 0);
            }, 0);
            max = max > 0 ? max : 1;
            const rows = feats
                .map(function (f) {
                    const val = f.importance || 0;
                    const pct = Math.round((val / max) * 100);
                    return (
                        '<div style="margin-bottom:6px">' +
                        '<div style="display:flex;justify-content:space-between;font-size: var(--fs-base);margin-bottom:2px">' +
                        '<span class="text-secondary">' +
                        window.escapeHtml(f.featureName || '—') +
                        '</span>' +
                        '<span style="color:var(--text-primary);font-weight: var(--fw-semibold)">' +
                        val.toFixed(4) +
                        '</span>' +
                        '</div>' +
                        '<div style="background:var(--bg-tertiary);border-radius: var(--radius-2xs);height:8px;overflow:hidden">' +
                        '<div style="width:' +
                        pct +
                        '%;height:100%;background:var(--accent);border-radius: var(--radius-2xs)"></div>' +
                        '</div>' +
                        '</div>'
                    );
                })
                .join('');
            container.innerHTML =
                '<div style="background:var(--bg-card);border:1px solid var(--border-glass);border-radius:var(--radius-md);padding:12px;margin-top:10px">' +
                '<h4 class="ai-section-title"><i data-lucide="bar-chart-3"></i> Feature Importance</h4>' +
                '<div style="font-size: var(--fs-sm);color:var(--text-muted);margin-bottom:10px">Ważność cech aktywnego modelu: <strong>' +
                window.escapeHtml(data.modelVersion || '—') +
                '</strong></div>' +
                rows +
                '</div>';
            if (typeof lucide !== 'undefined') {
                lucide.createIcons({ root: container });
            }
        }).catch(function () {
            container.innerHTML = window.aiApiErrorHtml('server');
        });
    }
    window.aiRenderFeatureImportance = renderFeatureImportance;
})();
