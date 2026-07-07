// @ts-check
/**
 * Dashboard ML — Panel statystyk systemu uczenia (admin only).
 * Dwie zakładki:
 * 1. "Learning Engine" — istniejący dashboard OR-Tools (korekty, preferencje, acceptance rate)
 * 2. "AI Pipeline" — nowy system ML (modele, feature store, trening)
 */

const ML_API_BASE = `http://${window.location.hostname}:8000/api/v1/telemetry`;
const ML_NEW_API = '/api/telemetry/ai';

/**
 * Pobiera statystyki ML z backendu.
 * @returns {Promise<Object>} Dane statystyk
 */
async function fetchMLStats() {
    try {
        const res = await fetch(`${ML_API_BASE}/stats`, {
            headers: { 'Content-Type': 'application/json' }
        });
        return await res.json();
    } catch (e) {
        logger.error('mlDashboard', '[ML Dashboard] Błąd pobierania statystyk:', e);
        return null;
    }
}

/**
 * Renderuje modal z dashboardem ML.
 * Dostępny tylko dla admin/pro.
 */
async function showMLDashboard(tab) {
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'pro')) {
        showToast('Brak uprawnień', 'error');
        return;
    }

    // Toggle: kliknięcie zamyka istniejące okno
    const existing = document.querySelector('.modal-overlay');
    if (existing) {
        existing.remove();
        return;
    }

    var activeTab = tab || 'learning';

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.style.zIndex = '99999';

    var tabButtons = [
        { id: 'learning', label: 'Learning Engine', icon: 'brain' },
        { id: 'ai-pipeline', label: 'AI Pipeline', icon: 'cpu' }
    ];

    var tabsHtml = tabButtons
        .map(function (t) {
            var active =
                t.id === activeTab
                    ? ' style="background:rgba(99,102,241,0.2);border-color:#6366f1;color:#6366f1;font-weight:600;"'
                    : '';
            return (
                '<button class="btn btn-sm" data-tab="' +
                t.id +
                '"' +
                active +
                '>' +
                '<i data-lucide="' +
                t.icon +
                '"></i> ' +
                t.label +
                '</button>'
            );
        })
        .join('');

    overlay.innerHTML =
        '\
    <div class="modal" style="max-width:780px; padding:1.5rem;">\
        <h3 style="color:#6366f1; font-weight:700; margin-bottom:1rem;">\
            <i data-lucide="brain"></i> Dashboard AI — System Uczenia\
        </h3>\
        <div style="display:flex; gap:0.5rem; margin-bottom:1rem; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:0.5rem;">\
            ' +
        tabsHtml +
        '\
        </div>\
        <div id="ml-dashboard-content">' +
        _getLoadingSpinner() +
        '</div>\
    </div>';

    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (e) {
        if (e.target === overlay) overlay.remove();
    });

    // Event delegation dla przycisków tab
    overlay.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-tab]');
        if (btn) {
            e.preventDefault();
            var tabId = btn.getAttribute('data-tab');
            document.querySelector('.modal-overlay')?.remove();
            showMLDashboard(tabId);
        }
    });

    // Załaduj zawartość
    var contentEl = overlay.querySelector('#ml-dashboard-content');
    if (activeTab === 'learning') {
        await _renderLearningTab(contentEl);
    } else {
        await _renderAiPipelineTab(contentEl);
    }

    if (typeof lucide !== 'undefined') lucide.createIcons({ root: overlay });
}

function _getLoadingSpinner() {
    return '<div style="text-align:center;padding:2rem;color:var(--text-muted);"><i data-lucide="loader-2" class="spin-icon"></i> Ładowanie...</div>';
}

/** @param {HTMLElement} container */
async function _renderLearningTab(container) {
    const stats = await fetchMLStats();
    if (!stats || stats.status !== 'ok') {
        container.innerHTML =
            '<div style="padding:2rem;text-align:center;color:var(--text-muted);">Backend OR-Tools offline — statystyki ML niedostępne</div>';
        return;
    }

    const acceptance = stats.acceptance || {};
    const acceptanceRate = acceptance.acceptance_rate_percent || 0;
    const topPrefs = stats.top_preferences || [];

    const prefRows =
        topPrefs.length > 0
            ? topPrefs
                  .map(function (p) {
                      const typeLabel = _prefTypeLabel(p.pattern_type);
                      const conf = (p.confidence * 100).toFixed(0);
                      return (
                          '<tr>\
                <td style="padding:0.3rem 0.6rem;"><span class="badge" style="background:' +
                          typeLabel.color +
                          ';color:#fff;padding:2px 8px;border-radius:4px;font-size:0.7rem;">' +
                          typeLabel.text +
                          '</span></td>\
                <td style="padding:0.3rem 0.6rem;font-size:0.75rem;font-family:monospace;max-width:200px;overflow:hidden;text-overflow:ellipsis;">' +
                          p.pattern_key +
                          '</td>\
                <td style="padding:0.3rem 0.6rem;text-align:center;">' +
                          conf +
                          '%</td>\
                <td style="padding:0.3rem 0.6rem;text-align:center;">' +
                          p.hit_count +
                          '</td>\
            </tr>'
                      );
                  })
                  .join('')
            : '<tr><td colspan="4" style="padding:1rem;text-align:center;color:var(--text-muted);">Brak preferencji — system jeszcze się uczy</td></tr>';

    container.innerHTML =
        '\
        <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:0.8rem; margin-bottom:1.5rem;">\
            ' +
        _statCard('Korekty', stats.total_corrections || 0, '#ef4444') +
        '\
            ' +
        _statCard('Preferencje', stats.active_preferences || 0, '#6366f1') +
        '\
            ' +
        _statCard('Acceptance', acceptanceRate + '%', '#10b981') +
        '\
            ' +
        _statCard('Zamówienia', acceptance.order_confirmed || 0, '#f59e0b') +
        '\
        </div>\
        <div style="margin-bottom:1rem;">\
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">\
                <h4 style="font-size:0.85rem; font-weight:600; color:var(--text-primary);">Acceptance Rate</h4>\
                <span style="font-size:0.75rem; color:var(--text-muted);">' +
        (acceptance.auto_accepted || 0) +
        ' auto / ' +
        (acceptance.manually_modified || 0) +
        ' ręcznych</span>\
            </div>\
            <div style="background:rgba(255,255,255,0.05); border-radius:8px; height:12px; overflow:hidden;">\
                <div style="background:linear-gradient(90deg,#10b981,#6366f1); height:100%; width:' +
        acceptanceRate +
        '%; border-radius:8px; transition:width 0.5s;"></div>\
            </div>\
        </div>\
        <h4 style="font-size:0.85rem; font-weight:600; margin:1rem 0 0.5rem; color:var(--text-primary);">Top Preferencje</h4>\
        <div style="max-height:200px; overflow-y:auto; border:1px solid rgba(255,255,255,0.1); border-radius:8px;">\
            <table style="width:100%; border-collapse:collapse; font-size:0.8rem;">\
                <thead>\
                    <tr style="background:rgba(255,255,255,0.05);">\
                        <th style="padding:0.4rem 0.6rem; text-align:left;">Typ</th>\
                        <th style="padding:0.4rem 0.6rem; text-align:left;">Klucz</th>\
                        <th style="padding:0.4rem 0.6rem; text-align:center;">Pewność</th>\
                        <th style="padding:0.4rem 0.6rem; text-align:center;">Hity</th>\
                    </tr>\
                </thead>\
                <tbody>' +
        prefRows +
        '</tbody>\
            </table>\
        </div>\
        <div style="display:flex; gap:0.5rem; margin-top:1.5rem; justify-content:space-between;">\
            <div style="display:flex; gap:0.5rem;">\
                <button class="btn btn-sm btn-secondary" onclick="_exportMLPreferences()" title="Eksport preferencji do pliku JSON">\
                    <i data-lucide="download"></i> Eksport\
                </button>\
                <button class="btn btn-sm btn-secondary" onclick="_importMLPreferences()" title="Import preferencji z pliku JSON">\
                    <i data-lucide="upload"></i> Import\
                </button>\
            </div>\
            <button class="btn btn-sm" onclick="this.closest(\'.modal-overlay\').remove()">Zamknij</button>\
        </div>';
}

/** @param {HTMLElement} container */
async function _renderAiPipelineTab(container) {
    try {
        const [statusRes, modelsRes] = await Promise.all([
            fetch(ML_NEW_API + '/ml-status', { credentials: 'same-origin' }),
            fetch(ML_NEW_API + '/models', { credentials: 'same-origin' })
        ]);

        const status = await statusRes.json();
        const modelsData = await modelsRes.json();
        const models = modelsData.models || [];

        const activeModel = models.find(function (m) {
            return m.active;
        });

        var modelRows = models
            .slice(0, 20)
            .map(function (m) {
                var activeBadge = m.active
                    ? '<span style="background:#10b981;color:#fff;padding:1px 6px;border-radius:4px;font-size:0.65rem;">AKTYWNY</span>'
                    : '';
                return (
                    '<tr>\
                <td style="padding:0.3rem 0.5rem;font-size:0.75rem;font-family:monospace;">' +
                    m.version +
                    ' ' +
                    activeBadge +
                    '</td>\
                <td style="padding:0.3rem 0.5rem;text-align:center;font-size:0.75rem;">' +
                    (m.metrics.rocAuc || '-').toFixed(4) +
                    '</td>\
                <td style="padding:0.3rem 0.5rem;text-align:center;font-size:0.75rem;">' +
                    (m.metrics.accuracy || '-').toFixed(3) +
                    '</td>\
                <td style="padding:0.3rem 0.5rem;text-align:center;font-size:0.75rem;">' +
                    m.trainingRows +
                    '</td>\
                <td style="padding:0.3rem 0.5rem;font-size:0.7rem;color:var(--text-muted);">' +
                    new Date(m.createdAt).toLocaleDateString() +
                    '</td>\
            </tr>'
                );
            })
            .join('');

        var modelTable = modelRows
            ? modelRows
            : '<tr><td colspan="5" style="padding:1rem;text-align:center;color:var(--text-muted);">Brak wytrenowanych modeli</td></tr>';

        container.innerHTML =
            '\
        <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:0.8rem; margin-bottom:1.5rem;">\
            ' +
            _statCard(
                'ML Online',
                status.mlOnline ? 'TAK' : 'NIE',
                status.mlOnline ? '#10b981' : '#ef4444'
            ) +
            '\
            ' +
            _statCard('Modele', status.modelCount || 0, '#6366f1') +
            '\
            ' +
            _statCard('Feature Vectors', status.featureCount || 0, '#f59e0b') +
            '\
            ' +
            _statCard('Rewards', status.totalRewards || 0, '#10b981') +
            '\
        </div>\
        <div style="margin-bottom:1rem;padding:0.8rem;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:8px;">\
            <div style="display:flex;justify-content:space-between;align-items:center;">\
                <div>\
                    <span style="font-size:0.8rem;color:var(--text-muted);">Wersja modelu:</span>\
                    <span style="font-size:0.85rem;font-weight:600;color:var(--text-primary);margin-left:0.5rem;">' +
            (status.modelVersion || 'brak') +
            '</span>\
                </div>\
                <div>\
                    <span style="font-size:0.8rem;color:var(--text-muted);">Trening:</span>\
                    <span style="font-size:0.85rem;font-weight:600;color:' +
            (status.trainingRunning ? '#f59e0b' : '#10b981') +
            ';margin-left:0.5rem;">' +
            (status.trainingRunning ? '⏳ w trakcie' : '✅ gotowy') +
            '</span>\
                </div>\
                <div>\
                    <span style="font-size:0.8rem;color:var(--text-muted);">Cache API:</span>\
                    <span style="font-size:0.85rem;font-weight:600;color:var(--text-primary);margin-left:0.5rem;">' +
            (status.cacheSize || 0) +
            '</span>\
                </div>\
            </div>\
        </div>\
        <div style="display:flex;gap:0.5rem;margin-bottom:1rem;">\
            <button class="btn btn-sm btn-secondary" onclick="_triggerTraining()" title="Wymuś trening">\
                <i data-lucide="play"></i> Trenuj teraz\
            </button>\
            <button class="btn btn-sm btn-secondary" onclick="_triggerRollback()" title="Rollback do poprzedniego modelu">\
                <i data-lucide="rotate-ccw"></i> Rollback\
            </button>\
            <button class="btn btn-sm" onclick="this.closest(\'.modal-overlay\').remove()">Zamknij</button>\
        </div>\
        <h4 style="font-size:0.85rem;font-weight:600;margin:1rem 0 0.5rem;color:var(--text-primary);">Modele (ostatnie 20)</h4>\
        <div style="max-height:220px;overflow-y:auto;border:1px solid rgba(255,255,255,0.1);border-radius:8px;">\
            <table style="width:100%;border-collapse:collapse;font-size:0.8rem;">\
                <thead>\
                    <tr style="background:rgba(255,255,255,0.05);">\
                        <th style="padding:0.3rem 0.5rem;text-align:left;">Wersja</th>\
                        <th style="padding:0.3rem 0.5rem;text-align:center;">ROC-AUC</th>\
                        <th style="padding:0.3rem 0.5rem;text-align:center;">Acc</th>\
                        <th style="padding:0.3rem 0.5rem;text-align:center;">Rows</th>\
                        <th style="padding:0.3rem 0.5rem;text-align:center;">Data</th>\
                    </tr>\
                </thead>\
                <tbody>' +
            modelTable +
            '</tbody>\
            </table>\
        </div>';
    } catch (e) {
        container.innerHTML =
            '<div style="padding:2rem;text-align:center;color:var(--text-muted);">Nie udało się załadować danych AI Pipeline: ' +
            e.message +
            '</div>';
    }
}

function _statCard(label, value, color) {
    return (
        '<div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:0.8rem; text-align:center;">\
        <div style="font-size:1.5rem; font-weight:800; color:' +
        color +
        ';">' +
        value +
        '</div>\
        <div style="font-size:0.7rem; color:var(--text-muted); margin-top:0.2rem;">' +
        label +
        '</div>\
    </div>'
    );
}

function _prefTypeLabel(type) {
    const map = {
        SUBSTITUTION: { text: 'ZAMIANA', color: '#ef4444' },
        ADDITION: { text: 'DODANIE', color: '#10b981' },
        REMOVAL: { text: 'USUNIĘCIE', color: '#f59e0b' },
        USAGE_BOOST: { text: 'POPULARNE', color: '#6366f1' }
    };
    return map[type] || { text: type, color: '#64748b' };
}

async function _triggerTraining() {
    try {
        showToast('Rozpoczynam trening...', 'info');
        const res = await fetch(ML_NEW_API + '/train', {
            method: 'POST',
            credentials: 'same-origin'
        });
        const data = await res.json();
        if (data.trained) {
            showToast(
                'Wytrenowano model ' +
                    data.version +
                    ' (AUC=' +
                    data.metrics.rocAuc.toFixed(4) +
                    ')',
                'success'
            );
        } else {
            showToast('Trening pominięty: ' + (data.reason || ''), 'warning');
        }
        document.querySelector('.modal-overlay')?.remove();
        showMLDashboard('ai-pipeline');
    } catch (e) {
        showToast('Błąd treningu: ' + e.message, 'error');
    }
}

async function _triggerRollback() {
    try {
        const res = await fetch(ML_NEW_API + '/rollback', {
            method: 'POST',
            credentials: 'same-origin'
        });
        const data = await res.json();
        if (data.rolledBack) {
            showToast('Rollback do ' + data.model.version, 'success');
        } else {
            showToast('Brak modelu do rollbacku', 'warning');
        }
        document.querySelector('.modal-overlay')?.remove();
        showMLDashboard('ai-pipeline');
    } catch (e) {
        showToast('Błąd rollbacku: ' + e.message, 'error');
    }
}

async function _exportMLPreferences() {
    try {
        const res = await fetch(`${ML_API_BASE}/export`);
        const data = await res.json();
        if (data.status !== 'ok') {
            showToast('Błąd eksportu: ' + (data.detail || ''), 'error');
            return;
        }

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ml_preferences_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast(`Wyeksportowano ${data.count} preferencji`, 'success');
    } catch (e) {
        showToast('Błąd eksportu', 'error');
    }
}

async function _importMLPreferences() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
        const input = /** @type {HTMLInputElement} */ (e.target);
        const file = input.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            const prefs = data.preferences || [];
            if (prefs.length === 0) {
                showToast('Plik nie zawiera preferencji', 'error');
                return;
            }

            const res = await fetch(`${ML_API_BASE}/import`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ preferences: prefs })
            });
            const result = await res.json();
            if (result.status === 'ok') {
                showToast(
                    `Zaimportowano ${result.merged} preferencji (pominięto ${result.skipped})`,
                    'success'
                );
                document.querySelector('.modal-overlay')?.remove();
                showMLDashboard();
            } else {
                showToast('Błąd importu: ' + (result.detail || ''), 'error');
            }
        } catch (err) {
            showToast('Błąd parsowania pliku JSON', 'error');
        }
    };
    input.click();
}

// Eksportuj do globalnego scope
window.showMLDashboard = showMLDashboard;
window._triggerTraining = _triggerTraining;
window._triggerRollback = _triggerRollback;
window._exportMLPreferences = _exportMLPreferences;
window._importMLPreferences = _importMLPreferences;
