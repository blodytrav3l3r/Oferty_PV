// @ts-check
/**
 * Dashboard ML — Panel statystyk systemu uczenia (admin only).
 * Wyświetla: ilość korekt, preferencje, acceptance rate, top wzorce.
 * Umożliwia eksport/import preferencji między komputerami.
 */

const ML_API_BASE = `http://${window.location.hostname}:8000/api/v1/telemetry`;

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
async function showMLDashboard() {
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'pro')) {
        showToast('Brak uprawnień', 'error');
        return;
    }

    const stats = await fetchMLStats();
    if (!stats || stats.status !== 'ok') {
        logger.warn('mlDashboard', 'Backend OR-Tools offline — statystyki ML niedostępne');
        return;
    }

    const acceptance = stats.acceptance || {};
    const acceptanceRate = acceptance.acceptance_rate_percent || 0;
    const topPrefs = stats.top_preferences || [];

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.style.zIndex = '99999';

    const prefRows =
        topPrefs.length > 0
            ? topPrefs
                  .map((p) => {
                      const typeLabel = _prefTypeLabel(p.pattern_type);
                      const conf = (p.confidence * 100).toFixed(0);
                      return `<tr>
                <td style="padding:0.3rem 0.6rem;"><span class="badge" style="background:${typeLabel.color};color:#fff;padding:2px 8px;border-radius:4px;font-size:0.7rem;">${typeLabel.text}</span></td>
                <td style="padding:0.3rem 0.6rem;font-size:0.75rem;font-family:monospace;max-width:200px;overflow:hidden;text-overflow:ellipsis;">${p.pattern_key}</td>
                <td style="padding:0.3rem 0.6rem;text-align:center;">${conf}%</td>
                <td style="padding:0.3rem 0.6rem;text-align:center;">${p.hit_count}</td>
            </tr>`;
                  })
                  .join('')
            : '<tr><td colspan="4" style="padding:1rem;text-align:center;color:var(--text-muted);">Brak preferencji — system jeszcze się uczy</td></tr>';

    overlay.innerHTML = `
    <div class="modal" style="max-width:700px; padding:1.5rem;">
        <h3 style="color:#6366f1; font-weight:700; margin-bottom:1rem;">
            <i data-lucide="brain"></i> Dashboard AI — System Uczenia
        </h3>

        <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:0.8rem; margin-bottom:1.5rem;">
            ${_statCard('Korekty', stats.total_corrections || 0, '#ef4444')}
            ${_statCard('Preferencje', stats.active_preferences || 0, '#6366f1')}
            ${_statCard('Acceptance', acceptanceRate + '%', '#10b981')}
            ${_statCard('Zamówienia', acceptance.order_confirmed || 0, '#f59e0b')}
        </div>

        <div style="margin-bottom:1rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                <h4 style="font-size:0.85rem; font-weight:600; color:var(--text-primary);">Acceptance Rate</h4>
                <span style="font-size:0.75rem; color:var(--text-muted);">${acceptance.auto_accepted || 0} auto / ${acceptance.manually_modified || 0} ręcznych</span>
            </div>
            <div style="background:rgba(255,255,255,0.05); border-radius:8px; height:12px; overflow:hidden;">
                <div style="background:linear-gradient(90deg,#10b981,#6366f1); height:100%; width:${acceptanceRate}%; border-radius:8px; transition:width 0.5s;"></div>
            </div>
        </div>

        <h4 style="font-size:0.85rem; font-weight:600; margin:1rem 0 0.5rem; color:var(--text-primary);">Top Preferencje</h4>
        <div style="max-height:200px; overflow-y:auto; border:1px solid rgba(255,255,255,0.1); border-radius:8px;">
            <table style="width:100%; border-collapse:collapse; font-size:0.8rem;">
                <thead>
                    <tr style="background:rgba(255,255,255,0.05);">
                        <th style="padding:0.4rem 0.6rem; text-align:left;">Typ</th>
                        <th style="padding:0.4rem 0.6rem; text-align:left;">Klucz</th>
                        <th style="padding:0.4rem 0.6rem; text-align:center;">Pewność</th>
                        <th style="padding:0.4rem 0.6rem; text-align:center;">Hity</th>
                    </tr>
                </thead>
                <tbody>${prefRows}</tbody>
            </table>
        </div>

        <div style="display:flex; gap:0.5rem; margin-top:1.5rem; justify-content:space-between;">
            <div style="display:flex; gap:0.5rem;">
                <button class="btn btn-sm btn-secondary" onclick="_exportMLPreferences()" title="Eksport preferencji do pliku JSON">
                    <i data-lucide="download"></i> Eksport
                </button>
                <button class="btn btn-sm btn-secondary" onclick="_importMLPreferences()" title="Import preferencji z pliku JSON">
                    <i data-lucide="upload"></i> Import
                </button>
                <button class="btn btn-sm btn-info" onclick="_openNewAIDashboard()" title="Nowy dashboard AI z preferencjami scoringowymi (Knowledge Base)">
                    <i data-lucide="brain-circuit"></i> Dashboard V2
                </button>
            </div>
            <button class="btn btn-sm" onclick="this.closest('.modal-overlay').remove()">Zamknij</button>
        </div>
    </div>`;

    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function _statCard(label, value, color) {
    return `<div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:0.8rem; text-align:center;">
        <div style="font-size:1.5rem; font-weight:800; color:${color};">${value}</div>
        <div style="font-size:0.7rem; color:var(--text-muted); margin-top:0.2rem;">${label}</div>
    </div>`;
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
                // Odśwież dashboard
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

/**
 * Otwiera nowy modal z Dashboard AI V2 (Knowledge Base).
 * Wywołuje window.aiDashboardRender() z aiDashboard.js.
 */
function _openNewAIDashboard() {
    document.querySelectorAll('.modal-overlay').forEach(function (m) { m.remove(); });
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.style.cssText = 'z-index:99999; padding:2rem;';
    overlay.innerHTML =
        '<div class="modal" style="max-width:1100px; padding:1.5rem; max-height:90vh; overflow-y:auto;">' +
        '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">' +
        '<h3 style="color:#6366f1; font-weight:700; margin:0;"><i data-lucide="brain-circuit"></i> Dashboard AI V2 (Knowledge Base)</h3>' +
        '<button class="btn btn-sm" onclick="this.closest(\'.modal-overlay\').remove()">Zamknij</button>' +
        '</div>' +
        '<div id="ai-dashboard-container"></div>' +
        '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (e) {
        if (e.target === overlay) overlay.remove();
    });
    if (typeof lucide !== 'undefined') lucide.createIcons();

    var container = document.getElementById('ai-dashboard-container');
    if (typeof window.aiDashboardRender === 'function') {
        window.aiDashboardRender('ai-dashboard-container');
    } else if (container) {
        container.innerHTML =
            '<div style="background:#2d1616;padding:1rem;color:#fca5a5;border-radius:8px">' +
            'aiDashboard.js nie załadowany — sprawdź <code>studnie.html</code> &lt;script&gt; tag' +
            '</div>';
    }
}

// Eksportuj do globalnego scope
window.showMLDashboard = showMLDashboard;
