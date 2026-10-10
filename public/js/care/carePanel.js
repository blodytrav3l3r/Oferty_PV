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
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = NOTIF_CLASS[n.type] || 'ops-pill';
        chip.setAttribute('data-notif-id', String(n.id));
        const who = n.clientName
            ? String(n.clientName) + (n.number ? ' • ' + String(n.number) : '')
            : String(n.offerKind) + ' ' + String(n.offerId);
        chip.setAttribute(
            'aria-label',
            'Oznacz jako przeczytane (' + (NOTIF_LABEL[n.type] || String(n.type)) + '): ' + who
        );
        const label = document.createElement('span');
        label.textContent = NOTIF_LABEL[n.type] || String(n.type);
        const sep = document.createElement('span');
        sep.textContent = ' • ';
        const ref = document.createElement('span');
        ref.textContent = who;
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
    const visible = queueCache.filter(matchFilter);
    if (visible.length === 0) {
        const empty = document.createElement('span');
        empty.className = 'recycled-empty';
        empty.textContent =
            queueCache.length === 0 ? 'Kolejka pusta.' : 'Brak ofert w tym filtrze.';
        list.appendChild(empty);
        return;
    }
    for (const it of visible.slice(0, 20)) {
        const row = document.createElement('div');
        row.className = 'care-queue-row';
        const head = document.createElement('div');
        head.className = 'care-queue-head';
        const title = document.createElement('strong');
        const client = it.clientName ? String(it.clientName) : 'Brak klienta';
        const value = fmtMoney(it.value);
        title.textContent =
            client + (value ? ' — ' + value : '') + ' (' + String(it.offerKind) + ')';
        head.appendChild(title);
        if (it.escalated) {
            const esc = document.createElement('span');
            esc.className = 'ops-pill ops-err';
            esc.textContent = 'Eskalacja';
            head.appendChild(esc);
        } else if (it.overdueDays > 0 && it.status !== 'NO_CONTACT') {
            const late = document.createElement('span');
            late.className = 'ops-pill ops-warn';
            late.textContent = String(it.overdueDays) + 'd po terminie';
            head.appendChild(late);
        }
        if (it.paused) {
            const paused = document.createElement('span');
            paused.className = 'ops-pill';
            paused.textContent = it.doneAt ? 'Done' : 'Odłożone';
            head.appendChild(paused);
        }
        row.appendChild(head);
        const sub = document.createElement('div');
        sub.className = 'care-queue-sub';
        // NO_CONTACT: jeden spójny komunikat (wiek od utworzenia),
        // zamiast sprzecznego "Bez terminu + Nd po terminie".
        if (it.status === 'NO_CONTACT') {
            const age = it.overdueDays > 0 ? ' • ' + String(it.overdueDays) + 'd bez kontaktu' : '';
            sub.textContent =
                'Brak pierwszego kontaktu' + age + (it.lastNote ? ' • ' + String(it.lastNote) : '');
            const nc = document.createElement('span');
            nc.className = 'ops-pill ops-warn';
            nc.textContent = 'Nowy kontakt';
            head.appendChild(nc);
        } else {
            sub.textContent = fmtTerm(it) + (it.lastNote ? ' • ' + String(it.lastNote) : '');
        }
        row.appendChild(sub);
        const actions = document.createElement('div');
        actions.className = 'care-queue-actions';
        actions.setAttribute('data-care-actions', '1');
        if (it.phone) {
            const tel = document.createElement('a');
            tel.className = 'btn btn-sm btn-secondary';
            tel.href = 'tel:' + String(it.phone).replace(/[^+\d]/g, '');
            tel.textContent = 'Zadzwoń: ' + String(it.phone);
            actions.appendChild(tel);
        }
        if (!it.paused) {
            const snooze = document.createElement('button');
            snooze.type = 'button';
            snooze.className = 'btn btn-sm btn-secondary';
            snooze.textContent = 'Odłóż +3d';
            snooze.addEventListener('click', () => snoozeQuick(it.offerKind, it.offerId, 3, row));
            actions.appendChild(snooze);
        }
        const open = document.createElement('a');
        open.href = 'app.html#/kartoteka';
        open.className = 'btn btn-sm btn-secondary';
        open.textContent = 'Kontakt';
        actions.appendChild(open);
        row.appendChild(actions);
        list.appendChild(row);
    }
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
