import { escapeHtml } from '../shared/escapeHtml.js';

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

async function getJson(url) {
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) return null;
    try {
        return await res.json();
    } catch {
        return null;
    }
}

const NOTIF_LABEL = {
    SLA_BREACH: 'Przekroczony SLA',
    ESCALATION: 'Eskalacja',
    CALLBACK_DUE: 'Termin kontaktu'
};

function renderNotifications(items, unreadCount) {
    const badge = document.getElementById('care-badge');
    if (badge) badge.textContent = unreadCount > 0 ? String(unreadCount) : '';
    const list = document.getElementById('care-notif-list');
    if (!list) return;
    list.textContent = '';
    if (!items || items.length === 0) {
        const empty = document.createElement('span');
        empty.className = 'recycled-empty';
        empty.textContent = 'Brak nowych powiadomień.';
        list.appendChild(empty);
        return;
    }
    for (const n of items.slice(0, 20)) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'ops-pill';
        chip.setAttribute('data-notif-id', String(n.id));
        chip.setAttribute('aria-label', 'Oznacz jako przeczytane: ' + String(n.offerId));
        const label = document.createElement('span');
        label.innerHTML = escapeHtml(NOTIF_LABEL[n.type] || String(n.type));
        const sep = document.createElement('span');
        sep.textContent = ' • ';
        const ref = document.createElement('span');
        ref.innerHTML = escapeHtml(String(n.offerKind) + ' ' + String(n.offerId));
        chip.append(label, sep, ref);
        chip.addEventListener('click', async () => {
            try {
                await fetch(
                    '/api/care/notifications/' + encodeURIComponent(String(n.id)) + '/read',
                    {
                        method: 'POST',
                        credentials: 'same-origin'
                    }
                );
            } catch {
                /* best-effort */
            }
            loadCarePanel();
        });
        list.appendChild(chip);
    }
}

function renderBuckets(summary) {
    const box = document.getElementById('care-buckets');
    if (!box) return;
    box.textContent = '';
    const rows = [
        ['Do kontaktu', (summary.noContact ?? 0) + (summary.due ?? 0)],
        ['W toku', summary.openOk ?? 0],
        ['Wygrane', summary.won ?? 0],
        ['Utracone', summary.lost ?? 0]
    ];
    const total = rows.reduce((a, r) => a + r[1], 0);
    if (total === 0) {
        const empty = document.createElement('span');
        empty.className = 'recycled-empty';
        empty.textContent = 'Brak ofert w opiece.';
        box.appendChild(empty);
        return;
    }
    for (const [name, count] of rows) {
        const row = document.createElement('div');
        row.className = 'care-bucket-row';
        const label = document.createElement('span');
        label.textContent = name + ': ' + count;
        const bar = document.createElement('div');
        bar.className = 'care-bucket-bar';
        const fill = document.createElement('div');
        fill.className = 'care-bucket-fill';
        fill.style.width = Math.round((count / total) * 100) + '%';
        bar.appendChild(fill);
        row.append(label, bar);
        box.appendChild(row);
    }
}

export async function loadCarePanel() {
    const panel = document.getElementById('followup-panel');
    if (!panel) return false;
    let summary = null;
    try {
        summary = await getJson('/api/care/summary?scope=mine&t=' + Date.now());
    } catch {
        showError();
        return false;
    }
    if (!summary) return false;
    setText('fu-stat-needs', (summary.noContact ?? 0) + (summary.due ?? 0));
    setText('fu-stat-progress', summary.openOk ?? 0);
    setText('fu-stat-won', summary.won ?? 0);
    setText('fu-stat-lost', summary.lost ?? 0);
    renderBuckets(summary);
    try {
        const notif = await getJson(
            '/api/care/notifications?scope=mine&unreadOnly=true&limit=20&t=' + Date.now()
        );
        if (notif) renderNotifications(notif.items, notif.unreadCount ?? 0);
    } catch {
        /* centrum best-effort, liczniki już są */
    }
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
