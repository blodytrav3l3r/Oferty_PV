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

const NOTIF_CLASS = {
    SLA_BREACH: 'ops-pill ops-err',
    ESCALATION: 'ops-pill ops-err',
    CALLBACK_DUE: 'ops-pill ops-warn'
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
        chip.className = NOTIF_CLASS[n.type] || 'ops-pill';
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
        ['Utracone', summary.lost ?? 0],
        ['Porzucone', summary.abandoned ?? 0]
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

function renderQueue(items) {
    const list = document.getElementById('care-queue-list');
    if (!list) return;
    list.textContent = '';
    if (!items || items.length === 0) {
        const empty = document.createElement('span');
        empty.className = 'recycled-empty';
        empty.textContent = 'Kolejka pusta.';
        list.appendChild(empty);
        return;
    }
    for (const it of items.slice(0, 10)) {
        const row = document.createElement('div');
        row.className = 'care-queue-row';
        const main = document.createElement('span');
        main.textContent =
            String(it.offerKind) + ' ' + String(it.offerId) + ' • ' + String(it.status);
        row.appendChild(main);
        if (it.escalated) {
            const esc = document.createElement('span');
            esc.className = 'ops-pill ops-err';
            esc.textContent = 'Eskalacja';
            row.appendChild(esc);
        } else if (it.overdueDays > 0) {
            const late = document.createElement('span');
            late.className = 'ops-pill ops-warn';
            late.textContent = String(it.overdueDays) + 'd po terminie';
            row.appendChild(late);
        }
        if (it.paused) {
            const paused = document.createElement('span');
            paused.className = 'ops-pill';
            paused.textContent = it.doneAt ? 'Done' : 'Odłożone';
            row.appendChild(paused);
        }
        const open = document.createElement('a');
        open.href = 'app.html#/kartoteka';
        open.className = 'btn btn-sm btn-secondary';
        open.textContent = 'Otwórz';
        row.appendChild(open);
        list.appendChild(row);
    }
}

function isAdmin() {
    try {
        return (
            typeof window !== 'undefined' &&
            window.currentUser &&
            window.currentUser.role === 'admin'
        );
    } catch {
        return false;
    }
}

async function loadSlaBox() {
    const box = document.getElementById('care-sla-box');
    if (!box || !isAdmin()) return;
    const sla = await getJson('/api/care/sla?t=' + Date.now());
    if (!sla || !sla.sla) return;
    box.hidden = false;
    const first = document.getElementById('care-sla-first');
    const stale = document.getElementById('care-sla-stale');
    const esc = document.getElementById('care-sla-esc');
    if (first) first.value = String(sla.sla.firstContactH ?? 24);
    if (stale) stale.value = String(sla.sla.staleD ?? 7);
    if (esc) esc.value = String(sla.sla.escalationH ?? 72);
    const save = document.getElementById('care-sla-save');
    if (save && !save.dataset.bound) {
        save.dataset.bound = '1';
        save.addEventListener('click', async () => {
            const payload = {
                firstContactH: Number(first && first.value) || 24,
                staleD: Number(stale && stale.value) || 7,
                escalationH: Number(esc && esc.value) || 72
            };
            try {
                const resp = await fetch('/api/care/sla', {
                    method: 'PUT',
                    credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                save.textContent = resp.ok ? 'Zapisano' : 'Błąd zapisu';
            } catch {
                save.textContent = 'Błąd zapisu';
            }
            setTimeout(() => {
                save.textContent = 'Zapisz progi';
            }, 2000);
        });
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
    setText('fu-stat-lost', (summary.lost ?? 0) + (summary.abandoned ?? 0));
    renderBuckets(summary);
    try {
        const [notif, queue] = await Promise.all([
            getJson('/api/care/notifications?scope=mine&unreadOnly=true&limit=20&t=' + Date.now()),
            getJson('/api/care/queue?scope=mine&limit=10&t=' + Date.now())
        ]);
        if (notif) renderNotifications(notif.items, notif.unreadCount ?? 0);
        if (queue) renderQueue(queue.items);
    } catch {
        /* centrum i kolejka best-effort, liczniki już są */
    }
    try {
        await loadSlaBox();
    } catch {
        /* SLA best-effort */
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
