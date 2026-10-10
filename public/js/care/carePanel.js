const POLL_MS = 60000;
let timer = null;

function setText(id, v) {
    const el = document.getElementById(id);
    if (el) el.textContent = String(v);
}

function showError() {
    const panel = document.getElementById('followup-panel');
    if (!panel || panel.querySelector('[data-care-error]')) return;
    const div = document.createElement('div');
    div.setAttribute('data-care-error', '1');
    div.setAttribute('role', 'alert');
    div.textContent = 'Nie udało się odświeżyć opieki — spróbuj ponownie.';
    panel.appendChild(div);
}

export async function loadCarePanel() {
    const panel = document.getElementById('followup-panel');
    if (!panel) return false;
    let res;
    try {
        res = await fetch('/api/care/summary?scope=mine&t=' + Date.now(), {
            credentials: 'same-origin'
        });
    } catch {
        showError();
        return false;
    }
    if (!res.ok) return false;
    let json;
    try {
        json = await res.json();
    } catch {
        return false;
    }
    setText('fu-stat-needs', (json.noContact ?? 0) + (json.due ?? 0));
    setText('fu-stat-progress', json.openOk ?? 0);
    setText('fu-stat-won', json.won ?? 0);
    setText('fu-stat-lost', json.lost ?? 0);
    const badge = document.getElementById('care-badge');
    if (badge) badge.textContent = String((json.noContact ?? 0) + (json.due ?? 0));
    const label = document.getElementById('followup-top-label');
    if (label) label.textContent = 'Najpilniejsze do kontaktu';
    return true;
}

export function startCarePolling() {
    if (timer) return;
    timer = setInterval(() => {
        if (document.hidden) return;
        loadCarePanel();
    }, POLL_MS);
}

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        loadCarePanel().then((ok) => {
            if (ok) startCarePolling();
        });
    });
}
