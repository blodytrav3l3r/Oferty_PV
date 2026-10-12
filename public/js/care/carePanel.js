const POLL_MS = 60000;
const POLL_MAX_MS = 300000;
const QUEUE_LIMIT = 50;
let timer = null;
let pollMs = POLL_MS;
let careScope = 'mine';
let careRep = '';
let queueFilter = 'all';
let queueSort = 'sla';
let queueView = 'list';
let queueRange = 'all';
let queueCache = [];
let queueNextCursor = null;
let queueTotal = 0;
// Flagi in-flight przeciw double-submit (odblokowanie zawsze w finally).
const snoozeInFlight = new Set();
const postCareInFlight = new Set();
// ETag pakietu panelu per scope (304 = brak zmian, bez renderu).
// Bounded: kombinacji scope|preset|rep może być wiele (admin) — trzymaj max 20.
const panelEtags = {};

function rememberPanelEtag(key, etag) {
    panelEtags[key] = etag;
    try {
        const keys = Object.keys(panelEtags);
        while (keys.length > 20) delete panelEtags[keys.shift()];
    } catch {
        /* best-effort */
    }
}

function careStoreGet(key) {
    try {
        if (typeof localStorage === 'undefined') return null;
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function careStoreSet(key, value) {
    try {
        if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
    } catch {
        /* best-effort */
    }
}

/** Sort kolejki (test-hook dla harnesu vm). Zwraca znormalizowaną wartość. */
export function setQueueSort(value) {
    queueSort = value === 'value' || value === 'client' ? value : 'sla';
    careStoreSet('sok-care-sort', queueSort);
    return queueSort;
}

/** Widok kolejki grid/list (test-hook). Zwraca znormalizowaną wartość. */
export function setQueueView(value) {
    queueView = value === 'grid' ? 'grid' : 'list';
    careStoreSet('sok-care-view', queueView);
    return queueView;
}

/* Zakres dat panelu/kolejki (test-hook jak setQueueSort). Wszystko = brak filtra. */
export function setQueueRange(value) {
    queueRange = value === '7d' || value === '30d' || value === '90d' ? value : 'all';
    careStoreSet('sok-care-range', queueRange);
    return queueRange;
}

const RANGE_DAYS = { '7d': 7, '30d': 30, '90d': 90 };

/* ISO from/to z presetu (All = brak filtra, zachowanie jak dotąd). */
function resolveQueueRange() {
    const days = RANGE_DAYS[queueRange];
    if (!days) return {};
    // Klucz ETag musi być stabilny między pollingami: minuta w dół.
    const nowMin = Math.floor(Date.now() / 60000) * 60000;
    return {
        from: new Date(nowMin - days * 86400000).toISOString(),
        to: new Date(nowMin).toISOString()
    };
}

function rangeQuery() {
    const r = resolveQueueRange();
    if (!r.from) return '';
    return '&from=' + encodeURIComponent(r.from) + '&to=' + encodeURIComponent(r.to);
}

/* ETag per scope+preset+rep (klucz stabilny — minutowe from/to w URL i tak
 * wchodzą do hasła BE; klucz po timestampach rotował co minutę i 304 nie trafiał). */
function panelKey() {
    return careScope + '|' + queueRange + '|' + (careRep || '');
}

/* Zawężenie do 1 handlowca (repId waliduje BE via resolveRepOwner, fail-closed 403). */
function repQuery() {
    return careRep ? '&repId=' + encodeURIComponent(careRep) : '';
}

/* hidePaused bez kontrolki UI (zawsze false) — ścieżka pod przyszły filtr. */
function hidePausedQuery() {
    return '';
}

function notifyRangeChange() {
    try {
        if (
            typeof document !== 'undefined' &&
            typeof document.dispatchEvent === 'function' &&
            typeof CustomEvent !== 'undefined'
        ) {
            document.dispatchEvent(new CustomEvent('care-range-change'));
        }
    } catch {
        /* best-effort */
    }
}

setQueueSort(careStoreGet('sok-care-sort') || 'sla');
setQueueView(careStoreGet('sok-care-view') || 'list');
setQueueRange(careStoreGet('sok-care-range') || 'all');

function setText(id, v) {
    const el = document.getElementById(id);
    if (el) el.textContent = String(v);
}

function refreshCareIcons(root) {
    try {
        if (
            typeof window !== 'undefined' &&
            window.lucide &&
            typeof window.lucide.createIcons === 'function'
        ) {
            window.lucide.createIcons({ root: root || document });
        } else if (
            typeof lucide !== 'undefined' &&
            lucide &&
            typeof lucide.createIcons === 'function'
        ) {
            lucide.createIcons({ root: root || document });
        }
    } catch {
        /* ikony best-effort */
    }
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

/* Po udanym odświeżeniu alert znika (nie wisi po starej awarii). */
function clearError() {
    try {
        const panel = document.getElementById('followup-panel');
        const err = panel && panel.querySelector('[data-care-error]');
        if (err) err.remove();
    } catch {
        /* best-effort */
    }
}

/* Wskaźnik odświeżania (P0-1): aria-busy + status na żywo, jeden na panel. */
function showLoading() {
    try {
        const panel = document.getElementById('followup-panel');
        if (!panel) return;
        try {
            panel.setAttribute('aria-busy', 'true');
        } catch {
            /* best-effort */
        }
        try {
            if (panel.querySelector && panel.querySelector('[data-care-loading]')) return;
        } catch {
            /* best-effort */
        }
        try {
            for (const c of panel.children || []) {
                if (c && c.dataset && 'careLoading' in c.dataset && !c.removed) return;
            }
        } catch {
            /* best-effort */
        }
        const div = document.createElement('div');
        div.setAttribute('data-care-loading', '1');
        div.setAttribute('role', 'status');
        div.textContent = 'Odświeżanie opieki…';
        panel.appendChild(div);
    } catch {
        /* best-effort */
    }
}

/* Znika po renderze (finally), też gdy fetch padnie. */
function clearLoading() {
    try {
        const panel = document.getElementById('followup-panel');
        if (!panel) return;
        try {
            if (typeof panel.removeAttribute === 'function') panel.removeAttribute('aria-busy');
        } catch {
            /* best-effort */
        }
        try {
            const el = panel.querySelector && panel.querySelector('[data-care-loading]');
            if (el) el.remove();
        } catch {
            /* best-effort */
        }
        try {
            for (const c of [...(panel.children || [])]) {
                if (c && c.dataset && 'careLoading' in c.dataset) {
                    try {
                        c.remove();
                    } catch {
                        /* best-effort */
                    }
                }
            }
        } catch {
            /* best-effort */
        }
    } catch {
        /* best-effort */
    }
}

/* Błąd zapisu nigdy nie jest cichy: toast zamiast udawanego sukcesu. */
function careToastError(msg) {
    try {
        if (typeof window !== 'undefined' && typeof window.showToast === 'function')
            window.showToast(msg, 'error');
    } catch {
        /* best-effort */
    }
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

function renderNotifications(items, unreadCount, mailboxUserId, hasOverflow) {
    const badge = document.getElementById('care-notif-count');
    if (badge) {
        // aria-live statycznie w index.html (#care-notif-count); tu tylko tekst.
        // Cap tylko prezentacja: licznik rośnie bez limitu, badge stoi na 99+.
        badge.textContent = unreadCount > 99 ? '99+' : notifCountText(unreadCount);
    }
    const list = document.getElementById('care-notif-list');
    if (!list) return;
    list.textContent = '';
    // Skrzynka podąża za repem; cudza = podgląd read-only (zapis tylko własny, I-003).
    const foreign = !!careRep && !!mailboxUserId && String(mailboxUserId) !== careUserId();
    const clear = document.getElementById('care-notif-clear');
    if (clear) {
        try {
            clear.hidden = foreign;
        } catch {
            /* best-effort */
        }
    }
    // A+C: podgląd repa — kolejka i skrzynka za repem (read-only gdy cudzy).
    // textContent (bez innerHTML) = brak powierzchni XSS.
    let repLabel = '';
    if (careRep) {
        const sel = document.getElementById('care-rep');
        repLabel =
            (sel && sel.selectedOptions && sel.selectedOptions[0]
                ? sel.selectedOptions[0].textContent
                : '') || careRep;
        repLabel = String(repLabel).trim();
        const banner = document.createElement('div');
        banner.className = 'care-notif-preview';
        banner.setAttribute('role', 'status');
        banner.textContent = foreign
            ? 'Skrzynka: ' + repLabel + ' — powiadomienia wybranego handlowca (podgląd read-only).'
            : 'Podgląd ofert: ' +
              repLabel +
              ' — poniżej Twoje powiadomienia (moja skrzynka), nie wybranego handlowca.';
        list.appendChild(banner);
    }
    if (!items || items.length === 0) {
        const empty = document.createElement('span');
        empty.className = 'recycled-empty';
        empty.textContent = foreign
            ? 'Brak powiadomień (skrzynka: ' + repLabel + ').'
            : careRep
              ? 'Brak Twoich powiadomień (podgląd ofert: ' + repLabel + ').'
              : 'Brak nowych powiadomień.';
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
            ? String(n.clientName)
            : String(n.offerKind) + ' ' + String(n.offerId);
        const offerNo = n.number
            ? String(n.number)
            : n.clientName
              ? ''
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
        if (offerNo && offerNo !== who) {
            const num = document.createElement('div');
            num.className = 'care-notif-no';
            num.textContent = offerNo;
            headRow.appendChild(num);
        }
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
        // Cudza skrzynka = read-only: brak przycisku zapisu (BE i tak broni 404, I-003).
        if (!foreign) {
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
                let ok = false;
                try {
                    const resp = await fetch(
                        '/api/care/notifications/' + encodeURIComponent(String(n.id)) + '/read',
                        {
                            method: 'POST',
                            credentials: 'same-origin'
                        }
                    );
                    ok = !!resp && resp.ok;
                } catch {
                    ok = false;
                }
                if (!ok) {
                    careToastError('Nie oznaczono jako przeczytane — spróbuj ponownie.');
                    return;
                }
                careBumpPolling();
                loadCarePanel();
            });
            foot.appendChild(read);
        }
        card.appendChild(foot);
        grid.appendChild(card);
    }
    list.appendChild(grid);
    // Stopka przepełnienia: cap tylko prezentacja (BE tnie listę, licznik cały).
    const itemCount = items ? items.length : 0;
    const overflow = typeof hasOverflow === 'boolean' ? hasOverflow : unreadCount > itemCount;
    if (overflow && unreadCount > itemCount) {
        const more = document.createElement('div');
        more.className = 'care-notif-more';
        more.textContent = '+' + (unreadCount - itemCount) + ' więcej';
        list.appendChild(more);
    }
    refreshCareIcons(list);
}

async function clearNotifications() {
    let items = [];
    try {
        const json = await getJson(
            '/api/care/notifications?scope=' +
                careScope +
                repQuery() +
                '&unreadOnly=true&limit=100&t=' +
                Date.now()
        );
        items = (json && json.items) || [];
    } catch {
        return;
    }
    if (items.length === 0) {
        loadCarePanel();
        return;
    }
    const confirmed =
        typeof window !== 'undefined' && typeof window.appConfirm === 'function'
            ? await window.appConfirm(
                  'Oznaczyć ' + items.length + ' powiadomień jako przeczytane?',
                  { title: 'Powiadomienia', okText: 'Oznacz', type: 'info' }
              )
            : true;
    if (!confirmed) return;
    const ids = items.map((n) => String(n.id));
    let failed = 0;
    try {
        const resp = await fetch('/api/care/notifications/read', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids })
        });
        if (!resp || !resp.ok) failed = ids.length;
    } catch {
        failed = ids.length;
    }
    if (failed > 0) {
        // Fallback: pojedyncze odczyty (stary kontrakt API), z liczeniem strat.
        failed = 0;
        for (const id of ids) {
            try {
                const resp = await fetch(
                    '/api/care/notifications/' + encodeURIComponent(id) + '/read',
                    {
                        method: 'POST',
                        credentials: 'same-origin'
                    }
                );
                if (!resp || !resp.ok) failed += 1;
            } catch {
                failed += 1;
            }
        }
    }
    if (failed > 0) {
        careToastError(
            'Nie oznaczono ' + failed + ' z ' + ids.length + ' powiadomień — spróbuj ponownie.'
        );
        return;
    }
    careBumpPolling();
    loadCarePanel();
}

const BUCKET_COLORS = [
    'var(--accent-strong)',
    'var(--blue)',
    'var(--success)',
    'var(--warn)',
    'var(--slate-300)'
];

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
        // Wiersze: kropka + etykieta … liczba (procent), pod spodem pasek.
        const chart = document.createElement('div');
        chart.className = 'care-chart';
        chart.setAttribute('role', 'img');
        chart.setAttribute('aria-label', rows.map((r) => r[0] + ': ' + r[1]).join(', '));
        rows.forEach((r, i) => {
            const pct = Math.round((r[1] / total) * 100);
            const row = document.createElement('div');
            row.className = 'care-chart-row';
            if (r[1] <= 0) row.classList.add('is-zero');
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
        // Jeden pasek proporcji całości (flex:N).
        const bar = document.createElement('div');
        bar.className = 'care-bar care-bar--stacked';
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
    }
    const topEl = document.getElementById('care-buckets-top');
    if (topEl) {
        const top = rows.reduce((a, r) => (r[1] > a[1] ? r : a), rows[0]);
        topEl.textContent = '';
        const icon = document.createElement('i');
        icon.setAttribute('data-lucide', 'circle-alert');
        icon.setAttribute('aria-hidden', 'true');
        const label = document.createElement('span');
        label.textContent = 'Najwyższy priorytet: ' + top[0];
        topEl.append(icon, label);
        refreshCareIcons(topEl);
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
    try {
        return (
            v.toLocaleString('pl-PL', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }) + ' PLN'
        );
    } catch {
        return v.toFixed(2) + ' PLN';
    }
}

function updateQueueFilterCounts() {
    // 'all' z serwera (queueTotal), reszta z załadowanej strony — filtry
    // tną cache, nie dopytują serwera.
    const counts = { all: queueTotal, urgent: 0, today: 0, paused: 0 };
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
            badge.className = 'care-count care-count--' + key;
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

async function snoozeQuick(it, days, row) {
    const offerKind = it.offerKind;
    const offerId = it.offerId;
    const key = String(offerKind) + ':' + String(offerId);
    // Drugi klik w locie — ignoruj (BE i tak broni Idempotency-Key).
    if (snoozeInFlight.has(key)) return;
    // Blokada przycisków wiersza na czas fetcha (powrót w finally).
    const locked = [];
    try {
        snoozeInFlight.add(key);
        const btns =
            row && typeof row.querySelectorAll === 'function' ? row.querySelectorAll('button') : [];
        for (const b of btns || []) {
            try {
                if (!b.disabled) {
                    b.disabled = true;
                    locked.push(b);
                }
            } catch {
                /* best-effort */
            }
        }
    } catch {
        /* best-effort */
    }
    const until = new Date(Date.now() + days * 86400000).toISOString();
    const body = { snoozedUntil: until };
    if (it.careUpdatedAt) body.expectedUpdatedAt = it.careUpdatedAt;
    let ok = false;
    let conflict = false;
    let freshUpdatedAt = null;
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
                body: JSON.stringify(body)
            }
        );
        ok = !!resp && resp.ok;
        conflict = !!resp && resp.status === 409;
        if (ok) {
            try {
                const json = await resp.json();
                if (json && json.state && json.state.updatedAt)
                    freshUpdatedAt = json.state.updatedAt;
            } catch {
                /* brak świeżego znacznika — undo bez opt-lock */
            }
        }
    } catch {
        ok = false;
    } finally {
        snoozeInFlight.delete(key);
        try {
            for (const b of locked) b.disabled = false;
        } catch {
            /* best-effort */
        }
    }
    if (!ok) {
        if (conflict) {
            careBumpPolling();
            loadCarePanel();
        }
        careToastError('Nie odłożono kontaktu — spróbuj ponownie.');
        return;
    }
    // Undo inline: podmiana akcji w wierszu na "Cofnij".
    const actions = row && row.querySelector ? row.querySelector('[data-care-actions]') : null;
    if (!actions) {
        careBumpPolling();
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
        let ok = false;
        let conflict = false;
        try {
            const undoBody = {};
            if (freshUpdatedAt) undoBody.expectedUpdatedAt = freshUpdatedAt;
            const resp = await fetch(
                '/api/care/' +
                    encodeURIComponent(offerKind) +
                    '/' +
                    encodeURIComponent(offerId) +
                    '/reopen?t=' +
                    Date.now(),
                {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(undoBody)
                }
            );
            ok = !!resp && resp.ok;
            conflict = !!resp && resp.status === 409;
        } catch {
            ok = false;
        }
        if (!ok) {
            if (conflict) {
                careBumpPolling();
                loadCarePanel();
            }
            careToastError('Nie wznowiono pilnowania — spróbuj ponownie.');
            return;
        }
        careBumpPolling();
        loadCarePanel();
    });
    actions.append(done, undo);
}

function fmtTermDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return pad(d.getDate()) + '.' + pad(d.getMonth() + 1);
}

function fmtTermTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
}

function isToday(iso) {
    if (!iso) return false;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return false;
    const now = new Date();
    return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
    );
}

/** Jeden pill statusu na kartę (priorytet: pauza > eskalacja > dziś > termin > zaległość > nowy). */
function statusPill(it) {
    const pill = (cls, text) => {
        const s = document.createElement('span');
        s.className = cls;
        s.textContent = text;
        return s;
    };
    if (it.paused) return pill('ops-pill care-status-pill care-status-paused', 'Odłożone');
    if (it.escalated) return pill('ops-pill ops-err care-status-pill', 'Eskalacja');
    if (it.nextContactAt && isToday(it.nextContactAt))
        return pill(
            'ops-pill care-status-pill care-status-today',
            'Dziś do ' + fmtTermTime(it.nextContactAt)
        );
    if (it.nextContactAt)
        return pill(
            'ops-pill care-status-pill care-status-term',
            'Termin: ' + fmtTermDate(it.nextContactAt)
        );
    if (it.overdueDays > 0 && it.status !== 'NO_CONTACT')
        return pill(
            'ops-pill ops-warn care-status-pill',
            '● ' + String(it.overdueDays) + 'd po terminie'
        );
    if (it.status === 'NO_CONTACT')
        return pill('ops-pill ops-warn care-status-pill', 'Nowy kontakt');
    return null;
}

/** Ikona + tytuł + sub do szarego boxu karty (jak na projekcie: ⚠/📄/◷/✓). */
function queueInfoContent(it) {
    const last = fmtDate(it.lastContactAt);
    if (it.status === 'NO_CONTACT') {
        const age = it.overdueDays > 0 ? String(it.overdueDays) + 'd bez kontaktu' : 'bez historii';
        return {
            icon: 'triangle-alert',
            title: it.paused ? 'Odłożone — brak pierwszego kontaktu' : 'Brak pierwszego kontaktu',
            sub: age + ' • bez jakiejkolwiek interakcji'
        };
    }
    if (it.paused) {
        return {
            icon: 'pause',
            title: 'Odłożone',
            sub: (last ? 'Ost. kontakt: ' + last : 'Bez terminu') + ' • wymaga ponowienia'
        };
    }
    if (it.nextContactAt) {
        return {
            icon: 'check',
            title: 'Zaplanowano kontakt telefoniczny',
            sub:
                'Termin: ' +
                fmtDate(it.nextContactAt) +
                (last ? ' • ost. kontakt: ' + last : '') +
                (it.lastNote ? ' • ' + String(it.lastNote) : '')
        };
    }
    if (it.lastNote) {
        return {
            icon: 'file-text',
            title: String(it.lastNote),
            sub: last ? 'Ost. kontakt: ' + last : fmtTerm(it)
        };
    }
    return {
        icon: 'clock',
        title: fmtTerm(it),
        sub: last ? 'Ost. kontakt: ' + last : 'Wycena w toku'
    };
}

function sortQueueItems(items) {
    if (queueSort === 'value') {
        return [...items].sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity));
    }
    if (queueSort === 'client') {
        return [...items].sort((a, b) =>
            String(a.clientName ?? '').localeCompare(String(b.clientName ?? ''), 'pl')
        );
    }
    return items;
}

function renderQueue(items, nextCursor, totalCount) {
    const list = document.getElementById('care-queue-list');
    if (!list) return;
    list.textContent = '';
    queueCache = Array.isArray(items) ? items : [];
    queueNextCursor = nextCursor ?? null;
    queueTotal = typeof totalCount === 'number' ? totalCount : queueCache.length;
    updateQueueFilterCounts();
    setText('care-queue-count', queueCache.length + ' zadań');
    const visible = sortQueueItems(queueCache.filter(matchFilter));
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
    grid.className = 'care-queue-cards is-' + queueView;
    for (const it of visible) {
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
        kind.textContent = String(it.offerKind).toLowerCase();
        head.appendChild(kind);
        const status = statusPill(it);
        if (status) head.appendChild(status);
        row.appendChild(head);
        const valueLine = document.createElement('div');
        valueLine.className = 'care-queue-value';
        const value = fmtMoney(it.value);
        const valueStrong = document.createElement('span');
        valueStrong.className = 'care-queue-price';
        valueStrong.textContent = value ? value : '0,00 PLN';
        valueLine.appendChild(valueStrong);
        if (it.number) {
            const no = document.createElement('span');
            no.className = 'care-queue-no';
            no.textContent = ' • ' + String(it.number);
            valueLine.appendChild(no);
        }
        row.appendChild(valueLine);
        const info = document.createElement('div');
        info.className = 'care-queue-info';
        const content = queueInfoContent(it);
        const line = document.createElement('div');
        line.className = 'care-queue-line';
        const icon = document.createElement('i');
        icon.setAttribute('data-lucide', content.icon);
        icon.setAttribute('aria-hidden', 'true');
        const titleWrap = document.createElement('div');
        titleWrap.className = 'care-queue-text';
        const heading = document.createElement('div');
        heading.className = 'care-queue-title-text';
        heading.textContent = content.title;
        const sub = document.createElement('div');
        sub.className = 'care-queue-sub';
        sub.textContent = content.sub;
        titleWrap.append(heading, sub);
        line.append(icon, titleWrap);
        info.appendChild(line);
        row.appendChild(info);
        const actions = document.createElement('div');
        actions.className = 'care-queue-btns';
        actions.setAttribute('data-care-actions', '1');
        const snooze = document.createElement('button');
        snooze.type = 'button';
        snooze.className = 'btn btn-sm btn-secondary';
        snooze.textContent = 'Odłóż +3d';
        if (it.paused) snooze.disabled = true;
        snooze.addEventListener('click', () => snoozeQuick(it, 3, row));
        actions.appendChild(snooze);
        const open = document.createElement('a');
        open.href =
            'app.html#/kartoteka?kontakt=' +
            encodeURIComponent(String(it.offerKind) + ':' + String(it.offerId));
        open.className = 'btn btn-sm btn-primary care-contact-btn';
        const phoneIcon = document.createElement('i');
        phoneIcon.setAttribute('data-lucide', 'phone');
        phoneIcon.setAttribute('aria-hidden', 'true');
        const openLabel = document.createElement('span');
        openLabel.textContent =
            (it.nextContactAt && isToday(it.nextContactAt)) || it.phone ? 'Zadzwoń' : 'Kontakt';
        open.append(phoneIcon, openLabel);
        open.addEventListener('click', () => careOpenContact(it.offerKind, it.offerId));
        actions.appendChild(open);
        actions.appendChild(careMenu(it));
        row.appendChild(actions);
        grid.appendChild(row);
    }
    list.appendChild(grid);
    if (queueNextCursor) {
        const moreWrap = document.createElement('div');
        moreWrap.className = 'care-queue-more';
        const more = document.createElement('button');
        more.type = 'button';
        more.className = 'btn btn-sm btn-secondary';
        more.textContent = 'Pokaż więcej (widoczne ' + visible.length + ' z ' + queueTotal + ')';
        more.addEventListener('click', loadMoreQueue);
        moreWrap.appendChild(more);
        list.appendChild(moreWrap);
    }
    refreshCareIcons(list);
}

/** Dopaginowanie kolejki cursorem (endpoint /queue, dopisanie bez resetu). */
async function loadMoreQueue() {
    if (!queueNextCursor) return;
    const json = await getJson(
        '/api/care/queue?scope=' +
            careScope +
            repQuery() +
            '&limit=' +
            QUEUE_LIMIT +
            '&cursor=' +
            encodeURIComponent(queueNextCursor) +
            rangeQuery() +
            hidePausedQuery() +
            '&t=' +
            Date.now()
    );
    if (!json || !Array.isArray(json.items)) return;
    const seen = new Set(queueCache.map((it) => String(it.offerKind) + ':' + String(it.offerId)));
    for (const it of json.items) {
        const key = String(it.offerKind) + ':' + String(it.offerId);
        if (!seen.has(key)) {
            seen.add(key);
            queueCache.push(it);
        }
    }
    renderQueue(queueCache, json.nextCursor ?? null, json.totalCount ?? queueTotal);
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
                // Blokada przycisku na czas fetcha (powrót w finally).
                if (b.disabled) return;
                b.disabled = true;
                try {
                    closeMenu();
                    await fn();
                } finally {
                    try {
                        b.disabled = false;
                    } catch {
                        /* best-effort */
                    }
                }
            });
            menu.appendChild(b);
        };
        addItem(it.paused ? 'Wznów pilnowanie' : 'Oznacz jako done', () =>
            postCare(it, it.paused ? 'reopen' : 'done')
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

async function postCare(it, action) {
    const offerKind = it.offerKind;
    const offerId = it.offerId;
    const key = String(offerKind) + ':' + String(offerId) + ':' + String(action);
    // Drugi klik w locie — ignoruj (BE i tak broni Idempotency-Key).
    if (postCareInFlight.has(key)) return;
    const body = {};
    if (it.careUpdatedAt) body.expectedUpdatedAt = it.careUpdatedAt;
    let ok = false;
    let conflict = false;
    try {
        postCareInFlight.add(key);
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
                body: JSON.stringify(body)
            }
        );
        ok = !!resp && resp.ok;
        conflict = !!resp && resp.status === 409;
    } catch {
        ok = false;
    } finally {
        postCareInFlight.delete(key);
    }
    if (!ok) {
        // 409 = ktoś zmienił stan w międzyczasie: odśwież do prawdy.
        if (conflict) {
            careBumpPolling();
            loadCarePanel();
        }
        careToastError('Nie zapisano zmiany — spróbuj ponownie.');
        return;
    }
    careBumpPolling();
    loadCarePanel();
}

const RANGE_LABELS = [
    ['7d', '7D'],
    ['30d', '30D'],
    ['90d', '90D'],
    ['all', 'Wszystko']
];

function syncRangeButtons() {
    document.querySelectorAll('.care-range-btn').forEach((btn) => {
        const active = btn.dataset.careRange === queueRange;
        btn.classList.toggle('active', active);
        btn.classList.toggle('btn-secondary', !active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
}

/* Pigułki zakresu obok filtrów kolejki (osobna grupa, tworzona raz). */
function ensureRangeUI() {
    try {
        if (typeof document.querySelector !== 'function') return;
        const filters = document.querySelector('.care-queue-filters');
        if (
            !filters ||
            !filters.parentNode ||
            filters.parentNode.querySelector('[data-care-range]')
        )
            return;
        const group = document.createElement('div');
        group.className = 'care-range-group';
        group.setAttribute('role', 'group');
        group.setAttribute('aria-label', 'Zakres dat');
        for (const [value, label] of RANGE_LABELS) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn btn-sm ka-pill care-range-btn';
            btn.setAttribute('data-care-range', value);
            btn.textContent = label;
            btn.addEventListener('click', () => {
                setQueueRange(value);
                queueCache = [];
                queueNextCursor = null;
                careBumpPolling();
                syncRangeButtons();
                notifyRangeChange();
                loadCarePanel();
            });
            group.appendChild(btn);
        }
        filters.parentNode.insertBefore(group, filters.nextSibling);
    } catch {
        /* best-effort */
    }
}

function syncScopeButtons() {
    const role = careRole();
    document.querySelectorAll('.care-scope-btn').forEach((btn) => {
        const s = btn.dataset.careScope;
        // user: tylko Moje; pro: Moje+Zespół; admin: +Wszystkie.
        const visible =
            s === 'mine' || (s === 'team' && role !== 'user') || (s === 'all' && role === 'admin');
        try {
            btn.hidden = !visible;
        } catch {
            /* best-effort */
        }
        if (!visible && careScope === s) careScope = 'mine';
        const active = btn.dataset.careScope === careScope;
        btn.classList.toggle('active', active);
        btn.classList.toggle('btn-secondary', !active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    // Widget KPI (dashboard.js) czyta zakres z localStorage — trzymaj w sync.
    careStoreSet('sok-care-scope', careScope);
    careStoreSet('sok-care-rep', careRep || '');
    syncRepUI();
}

function syncQueueFilterButtons() {
    document.querySelectorAll('.care-queue-filter-btn').forEach((btn) => {
        const active = btn.dataset.queueFilter === queueFilter;
        btn.classList.toggle('active', active);
        btn.classList.toggle('btn-secondary', !active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
}

function syncSortViewControls() {
    const sort = document.getElementById('care-sort');
    if (sort) sort.value = queueSort;
    document.querySelectorAll('.care-view-btn').forEach((btn) => {
        const active = btn.dataset.careView === queueView;
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
            const want = btn.dataset.careScope;
            const role = careRole();
            if (want === 'all' && role !== 'admin') return;
            if (want === 'team' && role === 'user') return;
            careScope = want === 'team' ? 'team' : want === 'all' ? 'all' : 'mine';
            // Zmiana zakresu czyści rep spoza nowego zakresu (fail-closed BE i tak broni).
            careRep = '';
            const sel = document.getElementById('care-rep');
            if (sel) sel.value = '';
            syncScopeButtons();
            notifyRangeChange();
            loadCarePanel();
        });
    });
    document.querySelectorAll('.care-queue-filter-btn').forEach((btn) => {
        if (btn.dataset.bound) return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', () => {
            queueFilter = btn.dataset.queueFilter || 'all';
            syncQueueFilterButtons();
            renderQueue(queueCache, queueNextCursor, queueTotal);
        });
    });
    const clear = document.getElementById('care-notif-clear');
    if (clear && !clear.dataset.bound) {
        clear.dataset.bound = '1';
        clear.addEventListener('click', clearNotifications);
    }
    const sort = document.getElementById('care-sort');
    if (sort && !sort.dataset.bound) {
        sort.dataset.bound = '1';
        sort.addEventListener('change', () => {
            setQueueSort(sort.value);
            renderQueue(queueCache, queueNextCursor, queueTotal);
        });
    }
    document.querySelectorAll('.care-view-btn').forEach((btn) => {
        if (btn.dataset.bound) return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', () => {
            setQueueView(btn.dataset.careView || 'list');
            syncSortViewControls();
            renderQueue(queueCache, queueNextCursor, queueTotal);
        });
    });
}

function setSyncText(skipped) {
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
        pad(d.getSeconds()) +
        (skipped ? ' (podgląd — bez synchronizacji)' : '');
}

function careRole() {
    try {
        if (typeof window !== 'undefined' && window.currentUser && window.currentUser.role)
            return String(window.currentUser.role);
    } catch {
        /* ignore */
    }
    return 'user';
}

function careUserId() {
    try {
        if (typeof window !== 'undefined' && window.currentUser && window.currentUser.id)
            return String(window.currentUser.id);
    } catch {
        /* ignore */
    }
    return '';
}

function careSubUsers() {
    try {
        const s =
            typeof window !== 'undefined' && window.currentUser
                ? window.currentUser.subUsers
                : null;
        if (Array.isArray(s)) return s.map(String);
    } catch {
        /* ignore */
    }
    return [];
}

/* Select handlowca: user ukryty, pro self+subUsers, admin wszyscy.
 * Opcje z /api/users-for-assignment (bez hasła/subUsers na drucie). */
let repLoading = false;
async function syncRepUI() {
    const sel = document.getElementById('care-rep');
    let wrap = null;
    try {
        wrap =
            (sel && sel.closest && sel.closest('.care-rep-wrap')) ||
            (typeof document.querySelector === 'function'
                ? document.querySelector('.care-rep-wrap')
                : null);
    } catch {
        wrap = null;
    }
    const role = careRole();
    if (!sel) return;
    const show = role === 'admin' || role === 'pro';
    try {
        if (wrap) wrap.hidden = !show;
        else sel.hidden = !show;
    } catch {
        /* best-effort */
    }
    if (!show) {
        careRep = '';
        return;
    }
    if (sel.options && sel.options.length > 1) {
        // Opcje już załadowane — tylko przytnij do zakresu roli.
        filterRepOptions(sel, role);
        return;
    }
    if (repLoading) return;
    repLoading = true;
    try {
        const json = await getJson('/api/users-for-assignment?t=' + Date.now());
        const users = (json && json.data) || [];
        sel.textContent = '';
        const all = document.createElement('option');
        all.value = '';
        all.textContent = 'Wszyscy';
        sel.appendChild(all);
        for (const u of users) {
            if (!u || !u.id) continue;
            if (role === 'pro') {
                const allowed = [careUserId(), ...careSubUsers()];
                if (!allowed.includes(String(u.id))) continue;
            }
            const opt = document.createElement('option');
            opt.value = String(u.id);
            const name =
                (u.firstName || u.lastName
                    ? String(u.firstName || '') + ' ' + String(u.lastName || '')
                    : u.username || u.id
                ).trim() || String(u.id);
            opt.textContent = name + ' (' + String(u.role || 'user').toUpperCase() + ')';
            sel.appendChild(opt);
        }
        sel.value = careRep || '';
        if (!sel.dataset.bound) {
            sel.dataset.bound = '1';
            sel.addEventListener('change', () => {
                careRep = sel.value || '';
                // Moje + cudzy handlowiec = zawsze pusto (mine ∩ rep≠self).
                // Poszerz zakres do najmniejszego mieszczącego repa (BE i tak
                // broni 403 — pro spoza subów i user nic nie zobaczą).
                if (careRep && careRep !== careUserId()) {
                    const role = careRole();
                    if (role === 'admin') careScope = 'all';
                    else if (role === 'pro') careScope = 'team';
                    else {
                        careRep = '';
                        sel.value = '';
                    }
                }
                careBumpPolling();
                syncScopeButtons();
                notifyRangeChange();
                loadCarePanel();
            });
        }
    } catch {
        /* best-effort: select zostaje z samą opcją Wszyscy */
    } finally {
        repLoading = false;
    }
}

function filterRepOptions(sel, role) {
    try {
        if (role === 'admin') return;
        const allowed = new Set([careUserId(), ...careSubUsers(), '']);
        for (const opt of sel.options || []) {
            if (opt.value === '') continue;
            if (!allowed.has(String(opt.value))) opt.hidden = true;
        }
        if (careRep && !allowed.has(careRep)) {
            careRep = '';
            sel.value = '';
        }
    } catch {
        /* best-effort */
    }
}

function slaScopeForRole(role) {
    if (role === 'admin') return 'global';
    return 'mine';
}

function slaScopeOptions(role) {
    if (role === 'admin')
        return [
            ['global', 'Globalne'],
            ['team', 'Zespół'],
            ['mine', 'Moje']
        ];
    if (role === 'pro')
        return [
            ['team', 'Zespół'],
            ['mine', 'Moje']
        ];
    return [['mine', 'Moje']];
}

function slaScopeToQuery(sel) {
    if (sel === 'global') return 'all';
    if (sel === 'team') return 'team';
    return 'mine';
}

async function loadSlaBox() {
    const box = document.getElementById('care-sla-box');
    if (!box) return;
    const role = careRole();
    const scopeSel = document.getElementById('care-sla-scope');
    if (scopeSel) {
        const want = slaScopeOptions(role);
        const current = scopeSel.value || slaScopeForRole(role);
        scopeSel.textContent = '';
        for (const [value, label] of want) {
            const opt = document.createElement('option');
            opt.value = value;
            opt.textContent = label;
            scopeSel.appendChild(opt);
        }
        scopeSel.value = want.some(([v]) => v === current) ? current : want[0][0];
        if (!scopeSel.dataset.bound) {
            scopeSel.dataset.bound = '1';
            scopeSel.addEventListener('change', loadSlaBoxValues);
        }
    }
    box.hidden = false;
    try {
        // Użytkownik edytuje progi (focus w boxie) — odświeżenie wartości
        // nadpisałoby wpisywanie przy każdym pollingu. Opcje powyżej już zsyncowane.
        const active = typeof document !== 'undefined' ? document.activeElement : null;
        if (box.contains && active && box.contains(active)) return;
    } catch {
        /* best-effort */
    }
    await loadSlaBoxValues();
    const save = document.getElementById('care-sla-save');
    if (save && !save.dataset.bound) {
        save.dataset.bound = '1';
        save.addEventListener('click', async () => {
            const first = document.getElementById('care-sla-first');
            const stale = document.getElementById('care-sla-stale');
            const esc = document.getElementById('care-sla-esc');
            const firstH = Number(first && first.value);
            const staleD = Number(stale && stale.value);
            const escH = Number(esc && esc.value);
            const valid =
                Number.isInteger(firstH) &&
                firstH >= 1 &&
                firstH <= 720 &&
                Number.isInteger(staleD) &&
                staleD >= 1 &&
                staleD <= 90 &&
                Number.isInteger(escH) &&
                escH >= 1 &&
                escH <= 720;
            if (!valid) {
                save.textContent = 'Nieprawidłowe progi';
                setTimeout(() => {
                    save.textContent = 'Zapisz progi';
                }, 2000);
                return;
            }
            const payload = {
                firstContactH: firstH,
                staleD,
                escalationH: escH
            };
            const sel = document.getElementById('care-sla-scope');
            if (sel && sel.value !== 'global') {
                payload.scopeType = sel.value === 'team' ? 'team' : 'user';
            }
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

async function loadSlaBoxValues() {
    const sel = document.getElementById('care-sla-scope');
    const sla = await getJson(
        '/api/care/sla?scope=' + slaScopeToQuery(sel ? sel.value : 'mine') + '&t=' + Date.now()
    );
    if (!sla || !sla.sla) return;
    const first = document.getElementById('care-sla-first');
    const stale = document.getElementById('care-sla-stale');
    const esc = document.getElementById('care-sla-esc');
    if (first) first.value = String(sla.sla.firstContactH ?? 24);
    if (stale) stale.value = String(sla.sla.staleD ?? 7);
    if (esc) esc.value = String(sla.sla.escalationH ?? 72);
}

function renderSummary(summary) {
    setText('fu-stat-needs', (summary.noContact ?? 0) + (summary.due ?? 0));
    setText('fu-stat-progress', summary.openOk ?? 0);
    setText('fu-stat-won', summary.won ?? 0);
    setText('fu-stat-lost', (summary.lost ?? 0) + (summary.abandoned ?? 0));
    setText('care-task-count', (summary.totalCount ?? 0) + ' zadań');
    renderBuckets(summary);
}

/** Pakiet /panel w 1 requeście. Zwraca 'fresh' | 'stale' | null (błąd). */
async function loadPanelPacket() {
    const headers = {};
    const known = panelEtags[panelKey()];
    if (known) headers['If-None-Match'] = known;
    let resp = null;
    try {
        resp = await fetch(
            '/api/care/panel?scope=' +
                careScope +
                repQuery() +
                '&limit=' +
                QUEUE_LIMIT +
                rangeQuery() +
                hidePausedQuery() +
                '&t=' +
                Date.now(),
            { credentials: 'same-origin', headers }
        );
    } catch {
        return null;
    }
    if (!resp) return null;
    if (resp.status === 304) return 'stale';
    if (resp.status === 403) {
        // Zakres spoza roli (np. rola cofnięta w trakcie sesji): wróć do
        // Moje zamiast kłamać starymi liczbami. Następny tick dociągnie.
        careScope = 'mine';
        careRep = '';
        const sel = document.getElementById('care-rep');
        if (sel) sel.value = '';
        syncScopeButtons();
        return null;
    }
    if (!resp.ok) return null;
    try {
        const json = await resp.json();
        if (!json || !json.ok || !json.summary || !json.queue) return null;
        if (json.etag) rememberPanelEtag(panelKey(), json.etag);
        renderSummary(json.summary);
        renderQueue(json.queue.items, json.queue.nextCursor, json.queue.totalCount);
        if (json.notifications)
            renderNotifications(
                json.notifications.items,
                json.notifications.unreadCount ?? 0,
                json.notifications.mailboxUserId,
                json.notifications.hasOverflow
            );
        setSyncText(
            json.notifications && json.notifications.sync
                ? json.notifications.sync.skipped
                : undefined
        );
        clearError();
        return 'fresh';
    } catch {
        return null;
    }
}

/** Ścieżka legacy (3 requesty) — fallback gdy /panel niedostępny. */
async function loadCarePanelLegacy() {
    let summary = null;
    try {
        summary = await getJson(
            '/api/care/summary?scope=' + careScope + repQuery() + rangeQuery() + '&t=' + Date.now()
        );
    } catch {
        showError();
        return false;
    }
    if (!summary) return false;
    renderSummary(summary);
    try {
        const [notif, queue] = await Promise.all([
            getJson(
                '/api/care/notifications?scope=' +
                    careScope +
                    repQuery() +
                    '&unreadOnly=true&limit=20&t=' +
                    Date.now()
            ),
            getJson(
                '/api/care/queue?scope=' +
                    careScope +
                    repQuery() +
                    '&limit=' +
                    QUEUE_LIMIT +
                    rangeQuery() +
                    hidePausedQuery() +
                    '&t=' +
                    Date.now()
            )
        ]);
        if (queue) renderQueue(queue.items, queue.nextCursor, queue.totalCount);
        if (notif)
            renderNotifications(
                notif.items,
                notif.unreadCount ?? 0,
                notif.mailboxUserId,
                notif.hasOverflow
            );
        setSyncText(notif && notif.sync ? notif.sync.skipped : undefined);
        clearError();
    } catch {
        /* centrum i kolejka best-effort, liczniki już są */
    }
    return true;
}

let panelLoading = false;
let careLoadError = false;

export async function loadCarePanel() {
    if (panelLoading) return false;
    const panel = document.getElementById('followup-panel');
    if (!panel) return false;
    panelLoading = true;
    showLoading();
    try {
        bindPanelControls();
        ensureRangeUI();
        syncScopeButtons();
        syncQueueFilterButtons();
        syncRangeButtons();
        syncSortViewControls();
        const packet = await loadPanelPacket();
        let changed = false;
        careLoadError = false;
        if (packet === 'stale') {
            changed = false;
        } else if (packet === 'fresh') {
            changed = true;
        } else {
            changed = await loadCarePanelLegacy();
            if (!changed) careLoadError = true;
        }
        try {
            await loadSlaBox();
        } catch {
            /* SLA best-effort */
        }
        return changed;
    } finally {
        clearLoading();
        panelLoading = false;
    }
}

export function startCarePolling() {
    if (timer) return;
    const tick = async () => {
        timer = null;
        // Panel zdjęty z DOM (nawigacja) — koniec pętli, nie fetchuj w próżnię.
        if (typeof document === 'undefined' || !document.getElementById('followup-panel')) return;
        if (!document.hidden) {
            try {
                const changed = await loadCarePanel();
                // Backoff: brak zmian wydłuża polling do POLL_MAX_MS.
                // Błąd NIE wydłuża (szybki retry), tylko czysty brak zmian.
                pollMs = changed || careLoadError ? POLL_MS : Math.min(POLL_MAX_MS, pollMs * 2);
            } catch {
                pollMs = POLL_MS;
            }
        }
        if (timer === null) timer = setTimeout(tick, pollMs);
    };
    timer = setTimeout(tick, pollMs);
}

/** Akcje (snooze/done/read) wołają to, żeby następny polling był świeży. */
export function careBumpPolling() {
    pollMs = POLL_MS;
    delete panelEtags[panelKey()];
    try {
        // Przestaw licznik od nowa (akcja + stary tick nie kumulują się).
        if (timer !== null && typeof clearTimeout === 'function') {
            clearTimeout(timer);
            timer = null;
            startCarePolling();
        }
    } catch {
        /* best-effort */
    }
}

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        loadCarePanel().then(() => {
            startCarePolling();
        });
    });
    // Sesja async (/api/auth/me) — init na DOMContentLoaded widzi pusty
    // window.currentUser (rola user: select ukryty, brak opcji). Dociągnij
    // po gotowości użytkownika (ten sam wzorzec co opsDashboard.js).
    // Polling startuje ZAWSZE (też po nieudanym pierwszym loadzie) —
    // inaczej panel umiera po cichu do przeładowania strony.
    // Zmiana użytkownika resetuje zakres (poprzedni nie dziedziczy cudzego).
    let lastCareUserId = '';
    document.addEventListener('sok:user-ready', () => {
        const uid = careUserId();
        if (uid && uid !== lastCareUserId) {
            lastCareUserId = uid;
            careScope = 'mine';
            careRep = '';
            const sel = document.getElementById('care-rep');
            if (sel) sel.value = '';
        }
        syncScopeButtons();
        loadCarePanel();
        startCarePolling();
    });
    // Powrót na kartę: dane mogły się zestarzeć (hidden pauzuje polling).
    document.addEventListener('visibilitychange', () => {
        try {
            if (!document.hidden && document.getElementById('followup-panel')) {
                careBumpPolling();
                loadCarePanel();
            }
        } catch {
            /* best-effort */
        }
    });
}
