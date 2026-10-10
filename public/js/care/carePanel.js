const POLL_MS = 60000;
const QUEUE_LIMIT = 50;
let timer = null;
let careScope = 'mine';
let queueFilter = 'all';
let queueCache = [];

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
        const card = document.createElement('div');
        card.className = 'care-notif-card ' + (n.type === 'CALLBACK_DUE' ? 'warn' : 'err');
        const pill = document.createElement('span');
        pill.className = NOTIF_CLASS[n.type] || 'ops-pill';
        pill.textContent = NOTIF_LABEL[n.type] || String(n.type);
        card.appendChild(pill);
        const who = n.clientName
            ? String(n.clientName) + (n.number ? ' • ' + String(n.number) : '')
            : String(n.offerKind) + ' ' + String(n.offerId);
        const lines = document.createElement('div');
        lines.className = 'care-notif-lines';
        const l1 = document.createElement('div');
        l1.textContent = who;
        lines.appendChild(l1);
        if (n.createdAt) {
            const d = new Date(n.createdAt);
            if (!Number.isNaN(d.getTime())) {
                const l2 = document.createElement('div');
                l2.textContent = 'Zgłoszono: ' + d.toLocaleDateString('pl-PL');
                lines.appendChild(l2);
            }
        }
        card.appendChild(lines);
        const read = document.createElement('button');
        read.type = 'button';
        read.className = 'care-link-btn';
        read.setAttribute('data-notif-id', String(n.id));
        read.setAttribute(
            'aria-label',
            'Oznacz jako przeczytane (' + (NOTIF_LABEL[n.type] || String(n.type)) + '): ' + who
        );
        read.textContent = 'Oznacz jako przeczytane';
        read.addEventListener('click', async () => {
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
        card.appendChild(read);
        list.appendChild(card);
    }
}

async function clearNotifications() {
    let items = [];
    try {
        const json = await getJson(
            '/api/care/notifications?scope=' +
                careScope +
                '&unreadOnly=true&limit=100&t=' +
                Date.now()
        );
        items = (json && json.items) || [];
    } catch {
        return;
    }
    for (const n of items) {
        try {
            await fetch('/api/care/notifications/' + encodeURIComponent(String(n.id)) + '/read', {
                method: 'POST',
                credentials: 'same-origin'
            });
        } catch {
            /* best-effort */
        }
    }
    loadCarePanel();
}

const BUCKET_COLORS = ['#4f46e5', '#60a5fa', '#22c55e', '#f59e0b', '#cbd5e1'];

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
    const totalEl = document.getElementById('care-buckets-total');
    if (totalEl) totalEl.textContent = 'Razem: ' + total;
    if (total === 0) {
        const empty = document.createElement('span');
        empty.className = 'recycled-empty';
        empty.textContent = 'Brak ofert w opiece.';
        box.appendChild(empty);
    } else {
        // Wykres wierszowy: etykieta + liczba + pasek udziału (osobno na wiersz).
        const chart = document.createElement('div');
        chart.className = 'care-chart';
        chart.setAttribute('role', 'img');
        chart.setAttribute('aria-label', rows.map((r) => r[0] + ': ' + r[1]).join(', '));
        rows.forEach((r, i) => {
            const pct = Math.round((r[1] / total) * 100);
            const row = document.createElement('div');
            row.className = 'care-chart-row';
            const head = document.createElement('div');
            head.className = 'care-chart-head';
            const name = document.createElement('span');
            name.textContent = r[0];
            const count = document.createElement('span');
            count.className = 'care-chart-count';
            count.textContent = String(r[1]) + ' (' + pct + '%)';
            head.append(name, count);
            const track = document.createElement('div');
            track.className = 'care-chart-track';
            const fill = document.createElement('div');
            fill.className = 'care-chart-fill';
            fill.style.width = pct + '%';
            fill.style.background = BUCKET_COLORS[i % BUCKET_COLORS.length];
            fill.title = r[0] + ': ' + r[1];
            track.appendChild(fill);
            row.append(head, track);
            chart.appendChild(row);
        });
        box.appendChild(chart);
    }
    const topEl = document.getElementById('care-buckets-top');
    if (topEl) {
        const top = rows.reduce((a, r) => (r[1] > a[1] ? r : a), rows[0]);
        topEl.textContent = 'Najwyższy priorytet: ' + top[0];
    }
    const shareEl = document.getElementById('care-buckets-share');
    if (shareEl) {
        shareEl.textContent =
            total > 0 ? Math.round((rows[0][1] / total) * 100) + '% wolumenu' : '';
    }
}

function fmtMoney(v) {
    if (typeof v !== 'number' || !Number.isFinite(v)) return '';
    return v.toFixed(2) + ' PLN';
}

function fmtTerm(it) {
    if (it.nextContactAt) {
        const d = new Date(it.nextContactAt);
        if (!Number.isNaN(d.getTime())) return 'Termin: ' + d.toLocaleDateString('pl-PL');
    }
    return 'Bez terminu';
}

function matchFilter(it) {
    if (queueFilter === 'urgent') return !!it.escalated || it.overdueDays > 0;
    if (queueFilter === 'today') return it.slaBucket === 'DUE_TODAY';
    if (queueFilter === 'paused') return !!it.paused;
    return true;
}

async function snoozeQuick(offerKind, offerId, days, row) {
    const until = new Date(Date.now() + days * 86400000).toISOString();
    try {
        const resp = await fetch(
            '/api/care/' +
                encodeURIComponent(offerKind) +
                '/' +
                encodeURIComponent(offerId) +
                '/snooze?t=' +
                Date.now(),
            {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ snoozedUntil: until })
            }
        );
        if (!resp.ok) return;
    } catch {
        return;
    }
    // Undo inline: podmiana akcji w wierszu na "Cofnij".
    const actions = row.querySelector('[data-care-actions]');
    if (!actions) {
        loadCarePanel();
        return;
    }
    actions.textContent = '';
    const done = document.createElement('span');
    done.className = 'ops-pill ops-ok';
    done.textContent = 'Odłożono o ' + days + 'd';
    const undo = document.createElement('button');
    undo.type = 'button';
    undo.className = 'btn btn-sm btn-secondary';
    undo.textContent = 'Cofnij';
    undo.addEventListener('click', async () => {
        try {
            await fetch(
                '/api/care/' +
                    encodeURIComponent(offerKind) +
                    '/' +
                    encodeURIComponent(offerId) +
                    '/reopen?t=' +
                    Date.now(),
                { method: 'POST', credentials: 'same-origin' }
            );
        } catch {
            /* best-effort */
        }
        loadCarePanel();
    });
    actions.append(done, undo);
}

function renderQueue(items) {
    const list = document.getElementById('care-queue-list');
    if (!list) return;
    list.textContent = '';
    queueCache = Array.isArray(items) ? items : [];
    const urgentCount = queueCache.filter((it) => !!it.escalated || it.overdueDays > 0).length;
    document.querySelectorAll('.care-queue-filter-btn').forEach((btn) => {
        if (btn.dataset.queueFilter !== 'urgent') return;
        let badge = btn.querySelector('[data-urgent-count]');
        if (urgentCount > 0) {
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'ops-pill ops-err';
                badge.setAttribute('data-urgent-count', '1');
                btn.appendChild(badge);
            }
            badge.textContent = String(urgentCount);
        } else if (badge) {
            badge.remove();
        }
    });
    const visible = queueCache.filter(matchFilter);
    if (visible.length === 0) {
        const empty = document.createElement('span');
        empty.className = 'recycled-empty';
        empty.textContent =
            queueCache.length === 0 ? 'Kolejka pusta.' : 'Brak ofert w tym filtrze.';
        list.appendChild(empty);
        return;
    }
    const grid = document.createElement('div');
    grid.className = 'care-queue-cards';
    for (const it of visible.slice(0, 20)) {
        const row = document.createElement('div');
        row.className = 'care-queue-card';
        const head = document.createElement('div');
        head.className = 'care-queue-title';
        const title = document.createElement('span');
        title.className = 'care-queue-name';
        const client = it.clientName ? String(it.clientName) : 'Brak klienta';
        const value = fmtMoney(it.value);
        title.textContent = client + (value ? ' — ' + value : '');
        const kind = document.createElement('span');
        kind.className = 'care-queue-kind';
        kind.textContent = '(' + String(it.offerKind) + ')';
        head.append(title, kind);
        row.appendChild(head);
        const pillRow = document.createElement('div');
        pillRow.className = 'care-queue-line';
        if (it.escalated) {
            const esc = document.createElement('span');
            esc.className = 'ops-pill ops-err';
            esc.textContent = 'Eskalacja';
            pillRow.appendChild(esc);
        } else if (it.overdueDays > 0 && it.status !== 'NO_CONTACT') {
            const late = document.createElement('span');
            late.className = 'ops-pill ops-warn';
            late.textContent = String(it.overdueDays) + 'd po terminie';
            pillRow.appendChild(late);
        }
        if (it.paused) {
            const paused = document.createElement('span');
            paused.className = 'ops-pill';
            paused.textContent = it.doneAt ? 'Done' : 'Odłożone';
            pillRow.appendChild(paused);
        }
        if (it.status === 'NO_CONTACT') {
            const nc = document.createElement('span');
            nc.className = 'ops-pill ops-warn';
            nc.textContent = 'Nowy kontakt';
            pillRow.appendChild(nc);
        }
        if (pillRow.children.length > 0) row.appendChild(pillRow);
        const lines = [];
        if (it.status === 'NO_CONTACT') {
            const age = it.overdueDays > 0 ? ' • ' + String(it.overdueDays) + 'd bez kontaktu' : '';
            lines.push('Brak pierwszego kontaktu' + age);
        } else {
            lines.push(fmtTerm(it));
        }
        if (it.lastNote) lines.push(String(it.lastNote));
        for (const text of lines) {
            const sub = document.createElement('div');
            sub.className = 'care-queue-line';
            sub.textContent = text;
            row.appendChild(sub);
        }
        const actions = document.createElement('div');
        actions.className = 'care-queue-btns';
        actions.setAttribute('data-care-actions', '1');
        const snooze = document.createElement('button');
        snooze.type = 'button';
        snooze.className = 'btn btn-sm btn-secondary';
        snooze.textContent = 'Odłóż +3d';
        if (it.paused) snooze.disabled = true;
        snooze.addEventListener('click', () => snoozeQuick(it.offerKind, it.offerId, 3, row));
        actions.appendChild(snooze);
        const open = document.createElement('a');
        open.href = 'app.html#/kartoteka';
        open.className = 'btn btn-sm btn-primary';
        open.textContent = 'Kontakt';
        actions.appendChild(open);
        if (it.phone) {
            const tel = document.createElement('a');
            tel.className = 'care-link-btn';
            tel.href = 'tel:' + String(it.phone).replace(/[^+\d]/g, '');
            tel.textContent = String(it.phone);
            actions.appendChild(tel);
        }
        row.appendChild(actions);
        grid.appendChild(row);
    }
    list.appendChild(grid);
}

function syncScopeButtons() {
    document.querySelectorAll('.care-scope-btn').forEach((btn) => {
        const active = btn.dataset.careScope === careScope;
        btn.classList.toggle('active', active);
        btn.classList.toggle('btn-secondary', !active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
}

function syncQueueFilterButtons() {
    document.querySelectorAll('.care-queue-filter-btn').forEach((btn) => {
        const active = btn.dataset.queueFilter === queueFilter;
        btn.classList.toggle('active', active);
        btn.classList.toggle('btn-secondary', !active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
}

function bindPanelControls() {
    document.querySelectorAll('.care-scope-btn').forEach((btn) => {
        if (btn.dataset.bound) return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', () => {
            careScope = btn.dataset.careScope === 'team' ? 'team' : 'mine';
            syncScopeButtons();
            loadCarePanel();
        });
    });
    document.querySelectorAll('.care-queue-filter-btn').forEach((btn) => {
        if (btn.dataset.bound) return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', () => {
            queueFilter = btn.dataset.queueFilter || 'all';
            syncQueueFilterButtons();
            renderQueue(queueCache);
        });
    });
    const clear = document.getElementById('care-notif-clear');
    if (clear && !clear.dataset.bound) {
        clear.dataset.bound = '1';
        clear.addEventListener('click', clearNotifications);
    }
}

function setSyncText() {
    const el = document.getElementById('care-sync-text');
    if (!el) return;
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    el.textContent =
        'Ostatnia synchronizacja: ' +
        pad(d.getHours()) +
        ':' +
        pad(d.getMinutes()) +
        ':' +
        pad(d.getSeconds());
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
    bindPanelControls();
    syncScopeButtons();
    syncQueueFilterButtons();
    let summary = null;
    try {
        summary = await getJson('/api/care/summary?scope=' + careScope + '&t=' + Date.now());
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
            getJson(
                '/api/care/notifications?scope=' +
                    careScope +
                    '&unreadOnly=true&limit=20&t=' +
                    Date.now()
            ),
            getJson(
                '/api/care/queue?scope=' + careScope + '&limit=' + QUEUE_LIMIT + '&t=' + Date.now()
            )
        ]);
        if (notif) renderNotifications(notif.items, notif.unreadCount ?? 0);
        if (queue) renderQueue(queue.items);
        setSyncText();
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
