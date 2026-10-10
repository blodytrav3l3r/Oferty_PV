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

function notifCountText(n) {
    if (!n || n <= 0) return '';
    const last = n % 10;
    const teen = n % 100;
    if (last === 1 && teen !== 11) return String(n) + ' alert';
    if (last >= 2 && last <= 4 && (teen < 12 || teen > 14)) return String(n) + ' alerty';
    return String(n) + ' alertów';
}

function fmtDelay(overdueDays, createdAt) {
    if (overdueDays > 0) {
        if (overdueDays >= 1) return 'Opóźnienie: ' + String(overdueDays) + 'd';
        return 'Opóźnienie: <1d';
    }
    if (createdAt) {
        const ms = Date.now() - Date.parse(createdAt);
        if (Number.isFinite(ms) && ms > 0) {
            const h = Math.floor(ms / 3600000);
            const m = Math.floor((ms % 3600000) / 60000);
            if (h > 0) return 'Opóźnienie: ' + String(h) + 'h ' + String(m) + 'm';
            return 'Opóźnienie: ' + String(m) + 'm';
        }
    }
    return '';
}

function renderNotifications(items, unreadCount) {
    const badge = document.getElementById('care-notif-count');
    if (badge) badge.textContent = notifCountText(unreadCount);
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
    const byOffer = new Map(
        queueCache.map((it) => [String(it.offerKind) + ':' + String(it.offerId), it])
    );
    const grid = document.createElement('div');
    grid.className = 'care-notif-grid';
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
        const hit = byOffer.get(String(n.offerKind) + ':' + String(n.offerId));
        const delay = fmtDelay(
            hit && hit.status !== 'NO_CONTACT' ? hit.overdueDays : 0,
            n.createdAt
        );
        const lines = document.createElement('div');
        lines.className = 'care-notif-lines';
        const headRow = document.createElement('div');
        headRow.className = 'care-notif-head';
        const l1 = document.createElement('div');
        l1.className = 'care-notif-who';
        l1.textContent = who;
        headRow.appendChild(l1);
        if (delay) {
            const dl = document.createElement('div');
            dl.className = 'care-notif-delay';
            dl.textContent = delay;
            headRow.appendChild(dl);
        }
        lines.appendChild(headRow);
        const foot = document.createElement('div');
        foot.className = 'care-notif-foot';
        if (n.createdAt) {
            const d = new Date(n.createdAt);
            if (!Number.isNaN(d.getTime())) {
                const l2 = document.createElement('div');
                l2.className = 'care-notif-date';
                l2.textContent = 'Zgłoszono: ' + d.toLocaleDateString('pl-PL');
                foot.appendChild(l2);
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
        foot.appendChild(read);
        card.appendChild(foot);
        grid.appendChild(card);
    }
    list.appendChild(grid);
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
        // Pasek proporcji całości (flex:N jak w makiecie) + wiersze z udziałami.
        const bar = document.createElement('div');
        bar.className = 'care-bar';
        bar.setAttribute('role', 'img');
        bar.setAttribute('aria-label', rows.map((r) => r[0] + ': ' + r[1]).join(', '));
        rows.forEach((r, i) => {
            if (r[1] <= 0) return;
            const s = document.createElement('span');
            s.style.flex = String(r[1]);
            s.style.background = BUCKET_COLORS[i % BUCKET_COLORS.length];
            s.title = r[0] + ': ' + r[1];
            bar.appendChild(s);
        });
        box.appendChild(bar);
        // Wykres wierszowy: etykieta + liczba + pasek udziału (osobno na wiersz).
        const chart = document.createElement('div');
        chart.className = 'care-chart';
        chart.setAttribute('role', 'img');
        chart.setAttribute('aria-label', rows.map((r) => r[0] + ': ' + r[1]).join(', '));
        rows.forEach((r, i) => {
            if (r[1] <= 0) return;
            const pct = Math.round((r[1] / total) * 100);
            const row = document.createElement('div');
            row.className = 'care-chart-row';
            const head = document.createElement('div');
            head.className = 'care-chart-head';
            const dot = document.createElement('span');
            dot.className = 'care-chart-dot';
            dot.style.background = BUCKET_COLORS[i % BUCKET_COLORS.length];
            const name = document.createElement('span');
            name.textContent = r[0];
            const count = document.createElement('span');
            count.className = 'care-chart-count';
            count.textContent = String(r[1]) + ' (' + pct + '%)';
            head.append(dot, name, count);
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

function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('pl-PL');
}

function fmtMoney(v) {
    if (typeof v !== 'number' || !Number.isFinite(v)) return '';
    return v.toFixed(2) + ' PLN';
}

function updateQueueFilterCounts() {
    const counts = { all: queueCache.length, urgent: 0, today: 0, paused: 0 };
    for (const it of queueCache) {
        if (it.escalated || it.overdueDays > 0) counts.urgent += 1;
        if (it.slaBucket === 'DUE_TODAY') counts.today += 1;
        if (it.paused) counts.paused += 1;
    }
    document.querySelectorAll('.care-queue-filter-btn').forEach((btn) => {
        const key = btn.dataset.queueFilter || 'all';
        let badge = btn.querySelector('[data-queue-count]');
        if (!(key in counts)) return;
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'care-count';
            badge.setAttribute('data-queue-count', '1');
            btn.appendChild(badge);
        }
        badge.textContent = String(counts[key]);
    });
}

function fmtTerm(it) {
    if (it.nextContactAt) {
        const d = new Date(it.nextContactAt);
        if (!Number.isNaN(d.getTime())) return 'Termin: ' + d.toLocaleDateString('pl-PL');
    }
    return 'Bez terminu';
}

/**
 * Handoff do modala opieki w Kartotece: zapis w sessionStorage + parametr
 * w hash (fallback gdyby storage był zablokowany).
 * Konsument: kartotekaInit.js (hash > storage, jednorazowo + świeżość 5 min).
 */
export function careOpenContact(offerKind, offerId) {
    const target = 'app.html#/kartoteka?kontakt=' + encodeURIComponent(offerKind + ':' + offerId);
    try {
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem(
                'care-open-followup',
                JSON.stringify({
                    id: String(offerId),
                    displayType: offerKind === 'studnie' ? 'studnia_oferta' : 'oferta',
                    at: Date.now()
                })
            );
        }
    } catch {
        /* storage zablokowany — ratuje parametr w hash */
    }
    try {
        if (typeof window !== 'undefined' && window.location) {
            window.location.href = target;
        }
    } catch {
        /* best-effort */
    }
    return target;
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

/** Jeden pill statusu na kartę (priorytet: pauza > eskalacja > zaległość > nowy). */
function statusPill(it) {
    const pill = (cls, text) => {
        const s = document.createElement('span');
        s.className = cls;
        s.textContent = text;
        return s;
    };
    if (it.paused) return pill('ops-pill', it.doneAt ? 'Done' : 'Odłożone');
    if (it.escalated) return pill('ops-pill ops-err', 'Eskalacja');
    if (it.overdueDays > 0 && it.status !== 'NO_CONTACT')
        return pill('ops-pill ops-warn', String(it.overdueDays) + 'd po terminie');
    if (it.status === 'NO_CONTACT') return pill('ops-pill ops-warn', 'Nowy kontakt');
    return null;
}

function renderQueue(items) {
    const list = document.getElementById('care-queue-list');
    if (!list) return;
    list.textContent = '';
    queueCache = Array.isArray(items) ? items : [];
    updateQueueFilterCounts();
    setText('care-queue-count', queueCache.length + ' zadań');
    const visible = queueCache.filter(matchFilter);
    if (visible.length === 0) {
        const empty = document.createElement('span');
        empty.className = 'recycled-empty';
        empty.textContent =
            queueCache.length === 0 ? 'Kolejka pusta.' : 'Brak ofert w tym filtrze.';
        list.appendChild(empty);
        if (queueCache.length === 0) {
            const cta = document.createElement('a');
            cta.href = 'app.html#/kartoteka';
            cta.className = 'btn btn-sm btn-secondary';
            cta.textContent = 'Otwórz kartotekę';
            list.appendChild(cta);
        }
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
        title.textContent = it.clientName ? String(it.clientName) : 'Brak klienta';
        head.appendChild(title);
        const kind = document.createElement('span');
        kind.className = 'ops-pill care-kind-pill';
        kind.textContent = String(it.offerKind);
        head.appendChild(kind);
        const status = statusPill(it);
        if (status) head.appendChild(status);
        row.appendChild(head);
        const valueLine = document.createElement('div');
        valueLine.className = 'care-queue-value';
        const value = fmtMoney(it.value);
        valueLine.textContent =
            (value ? value : '0.00 PLN') + (it.number ? ' • ' + String(it.number) : '');
        row.appendChild(valueLine);
        const info = document.createElement('div');
        info.className = 'care-queue-info';
        const lines = [];
        if (it.status === 'NO_CONTACT') {
            const age = it.overdueDays > 0 ? ' • ' + String(it.overdueDays) + 'd bez kontaktu' : '';
            lines.push('Brak pierwszego kontaktu' + age);
        } else {
            const last = fmtDate(it.lastContactAt);
            lines.push(fmtTerm(it) + (last ? ' • ost. kontakt: ' + last : ''));
        }
        if (it.lastNote) lines.push(String(it.lastNote));
        for (const text of lines) {
            const sub = document.createElement('div');
            sub.className = 'care-queue-line';
            sub.textContent = text;
            info.appendChild(sub);
        }
        row.appendChild(info);
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
        open.href =
            'app.html#/kartoteka?kontakt=' +
            encodeURIComponent(String(it.offerKind) + ':' + String(it.offerId));
        open.className = 'btn btn-sm btn-primary';
        open.textContent = 'Kontakt';
        open.addEventListener('click', () => careOpenContact(it.offerKind, it.offerId));
        actions.appendChild(open);
        actions.appendChild(careMenu(it));
        row.appendChild(actions);
        grid.appendChild(row);
    }
    list.appendChild(grid);
}

let openMenu = null;

function closeMenu() {
    if (openMenu) {
        try {
            openMenu.menu.remove();
        } catch {
            /* best-effort */
        }
        try {
            openMenu.btn.setAttribute('aria-expanded', 'false');
            openMenu.btn.focus();
        } catch {
            /* best-effort */
        }
        openMenu = null;
    }
}

let menuListenersBound = false;
if (typeof document !== 'undefined') {
    try {
        if (document.documentElement && !document.documentElement.dataset.careMenuBound) {
            document.documentElement.dataset.careMenuBound = '1';
            menuListenersBound = true;
        } else if (!document.documentElement) {
            menuListenersBound = true;
        }
    } catch {
        menuListenersBound = true;
    }
}
if (menuListenersBound) {
    document.addEventListener('click', (e) => {
        const isNode = typeof Node !== 'undefined' ? e.target instanceof Node : !!e.target;
        if (openMenu && isNode && !openMenu.wrap.contains(e.target)) {
            closeMenu();
        }
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeMenu();
    });
}

/** Menu ⋮ karty: Done / Wznów / Otwórz kartotekę (istniejące API, bez modala). */
function careMenu(it) {
    const wrap = document.createElement('div');
    wrap.className = 'care-menu-wrap';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-sm btn-secondary care-menu-btn';
    btn.textContent = '⋮';
    btn.setAttribute('aria-label', 'Więcej akcji');
    btn.setAttribute('aria-expanded', 'false');
    btn.addEventListener('click', () => {
        if (openMenu && openMenu.btn === btn) {
            closeMenu();
            return;
        }
        closeMenu();
        const menu = document.createElement('div');
        menu.className = 'care-menu';
        menu.setAttribute('role', 'menu');
        const addItem = (label, fn) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'care-menu-item';
            b.setAttribute('role', 'menuitem');
            b.textContent = label;
            b.addEventListener('click', async () => {
                closeMenu();
                await fn();
            });
            menu.appendChild(b);
        };
        addItem(it.paused ? 'Wznów pilnowanie' : 'Oznacz jako done', () =>
            postCare(it.offerKind, it.offerId, it.paused ? 'reopen' : 'done')
        );
        addItem('Otwórz kartotekę', () => {
            careOpenContact(it.offerKind, it.offerId);
        });
        wrap.appendChild(menu);
        btn.setAttribute('aria-expanded', 'true');
        openMenu = { btn, menu, wrap };
    });
    wrap.appendChild(btn);
    return wrap;
}

async function postCare(offerKind, offerId, action) {
    try {
        const resp = await fetch(
            '/api/care/' +
                encodeURIComponent(offerKind) +
                '/' +
                encodeURIComponent(offerId) +
                '/' +
                action +
                '?t=' +
                Date.now(),
            {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            }
        );
        if (!resp.ok) return;
    } catch {
        return;
    }
    loadCarePanel();
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
    setText('care-task-count', (summary.totalCount ?? 0) + ' zadań');
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
        if (queue) renderQueue(queue.items);
        if (notif) renderNotifications(notif.items, notif.unreadCount ?? 0);
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
