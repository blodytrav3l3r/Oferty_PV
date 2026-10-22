// @ts-check
/**
 * S1a: hub „Cenniki" — 3 widoki (przegląd / cennik / historia).
 * Warstwa 2 (M3/M4): drill-down kafelkowy oś → sekcje → pozycje (read-only).
 * Źródło treści: GET /:id/preview (zamrożona kopia) — Δ liczone LOKALNIE
 * (preview szkicu vs preview obowiązującej); /diff nie jest używany w warstwie 2.
 * Edycja pozostaje w modułach Rury/Studnie.
 */

import { escapeHtml, escapeHtmlAttr } from './shared/escapeHtml.js';
import { showModal, closeModal } from './shared/modalCore.js';

const API = '/api/pricelist-versions';
const EDITORS = { rury: 'rury.html', studnie: 'studnie.html', preco: 'studnie.html' };
/** Link do edytora z zakładką „Cennik" (edycja zostaje w modułach). */
const EDITOR_LINKS = {
    rury: 'rury.html',
    studnie: 'studnie.html?tab=pricelist',
    preco: 'studnie.html?tab=pricelist'
};
/** Etykiety typów w hubie — „PRECO" wielkimi literami (nazwa marki, plan §3). */
const TYPE_LABELS = { rury: 'Rury', studnie: 'Studnie', preco: 'PRECO' };
/**
 * Etykiety stanów są SSoT w shared/pricelistVersions.js (`displayStatus`) —
 * hub nie dubluje mapy (plan §3.1: „jeden helper FE").
 */

/** @type {Array<Record<string, any>>} */
let versions = [];
/** @type {any} */
let summary = null;

const esc = (value) => escapeHtml(String(value ?? ''));
const escAttr = (value) => escapeHtmlAttr(String(value ?? ''));
const pv = () => window.pricelistVersions;

function stateOf(version) {
    return version.state || version.status || '';
}

/** Etykieta stanu wersji — SSoT shared/pricelistVersions.js (`displayStatus`). */
function statusLabel(version) {
    const api = pv();
    if (api && typeof api.displayStatus === 'function') return api.displayStatus(version);
    return stateOf(version) || '—';
}

function statusBadge(version) {
    const api = pv();
    if (api && typeof api.statusBadge === 'function') return api.statusBadge(stateOf(version));
    return `<span class="badge">${esc(statusLabel(version))}</span>`;
}

function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return esc(value);
    return date.toLocaleDateString('pl-PL', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function noteHtml(note) {
    const text = String(note || '').trim();
    if (!text) return '<span class="text-muted">—</span>';
    const short = text.length > 80 ? text.slice(0, 77) + '…' : text;
    return `<span class="cenniki-note" title="${escAttr(text)}">${esc(short)}</span>`;
}

/**
 * JSON do API wersji cenników. `options.method` pozwala na mutacje
 * (POST/DELETE) — nagłówki autoryzacji z SSoT (`authHeaders`).
 */
async function apiJson(path, options) {
    const method = (options && options.method) || 'GET';
    const headers = { Accept: 'application/json' };
    if (method !== 'GET' && typeof window.authHeaders === 'function') {
        Object.assign(headers, window.authHeaders());
    }
    const res = await fetch(API + path, {
        method,
        credentials: 'same-origin',
        headers
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Błąd HTTP ${res.status}`);
    }
    return res.json();
}

function setAlert(message, isError) {
    const host = document.getElementById('cenniki-alert');
    if (!host) return;
    host.innerHTML = message
        ? `<p class="${isError ? 'cenniki-warning' : 'text-muted'}">${esc(message)}</p>`
        : '';
}

function notify(message, type) {
    if (typeof window.showToast === 'function') window.showToast(message, type || 'info');
}

async function loadData() {
    setAlert('Ładowanie danych…', false);
    try {
        const [list, summaryData] = await Promise.all([apiJson(''), apiJson('/summary')]);
        versions = Array.isArray(list.versions) ? list.versions : [];
        summary = summaryData;
        setAlert('', false);
    } catch (error) {
        setAlert(
            `Nie udało się pobrać cenników: ${error instanceof Error ? error.message : String(error)}`,
            true
        );
    }
    renderAll();
    await loadLayer2();
}

/** Warstwy 1 i 3 (przegląd + historia). Warstwa 2 rysuje loadLayer2(). */
function renderAll() {
    renderOverview();
    renderHistory();
}

function renderOverview() {
    const host = document.getElementById('cenniki-cards');
    if (!host) return;
    const types = ['rury', 'studnie', 'preco'];
    host.innerHTML = types
        .map((type) => {
            const data = summary?.types?.[type] || {};
            const active = data.active;
            const next = data.nextScheduled;
            const collision = Number(data.collisionCount || 0);
            const draftCount = Number(data.draftCount || 0);
            const approvedCount = Number(data.approvedCount || 0);
            const archivedCount = Number(data.archivedCount || 0);
            const stateTile = (modifier, title, badge, rows) => `
                <div class="cenniki-tile cenniki-tile--state ${modifier}">
                    <div class="cenniki-tile-title">${esc(title)}</div>
                    ${badge}
                    <div class="cenniki-tile-rows">${rows}</div>
                </div>`;
            const row = (label, value) =>
                `<div class="cenniki-tile-row"><span>${esc(label)}</span><b>${esc(value)}</b></div>`;
            const states = [
                stateTile(
                    'cenniki-tile--active',
                    'Obowiązuje',
                    active
                        ? `<span class="badge badge-ok">${esc(active.version)}</span>`
                        : '<span class="badge badge-muted">brak</span>',
                    active ? row('od', formatDate(active.effectiveFrom)) : ''
                ),
                stateTile(
                    'cenniki-tile--scheduled',
                    'Do wdrożenia',
                    next
                        ? `<span class="badge badge-info">${esc(next.version)}</span>`
                        : '<span class="badge badge-muted">—</span>',
                    next ? row('od', formatDate(next.effectiveFrom)) : ''
                ),
                stateTile(
                    'cenniki-tile--draft',
                    'W przygotowaniu',
                    `<span class="badge badge-muted">${draftCount} szkic${draftCount === 1 ? '' : 'e'}</span>`,
                    ''
                ),
                stateTile(
                    'cenniki-tile--archived',
                    'Historyczne',
                    `<span class="badge badge-muted">${archivedCount} wersji</span>`,
                    ''
                )
            ].join('');
            return `
                <section class="cenniki-tile cenniki-tile--axis" aria-label="Oś cennika ${esc(TYPE_LABELS[type])}">
                    <div class="cenniki-tile-title">${esc(TYPE_LABELS[type])}</div>
                    <div class="cenniki-tile-rows">
                        ${row('Kolizje dat', String(collision))}
                        ${row('Opublikowane', String(approvedCount))}
                    </div>
                    ${
                        collision > 0
                            ? `<p class="cenniki-warning">${collision} dat z więcej niż jedną wersją — sprawdź historię.</p>`
                            : ''
                    }
                    <div class="cenniki-tiles cenniki-tiles--states">${states}</div>
                    <div class="cenniki-tile-actions">
                        <button class="btn btn-sm btn-secondary" data-cenniki-view-link="historia" data-cenniki-type="${escAttr(type)}">
                            Historia
                        </button>
                        <button class="btn btn-sm btn-secondary" data-cenniki-view-link="cennik" data-cenniki-type="${escAttr(type)}">
                            Cennik
                        </button>
                        <a class="btn btn-sm btn-secondary" href="${escAttr(EDITORS[type])}" target="_blank" rel="noopener">
                            Edytor
                        </a>
                    </div>
                </section>`;
        })
        .join('');
}

/* ── Warstwa 2 (M3/M4): drill-down kafelkowy oś → sekcje → pozycje ───────── */

const AXIS_TYPES = ['rury', 'studnie', 'preco'];

/** Limit pozycji renderowanych na sekcję (DOM) — reszta przez „Pokaż kolejne 100". */
const ITEM_PAGE_SIZE = 100;

/** Limit produktów w kafelku Transport (top wg liczby na transport). */
const TRANSPORT_PRODUCT_LIMIT = 5;

/** Kolejność sekcji = arkusze BE (src/services/pricelist/liveProjection.ts). */
const SECTION_ORDER = {
    rury: ['Cennik Rury'],
    studnie: [
        'DN1000',
        'DN1200',
        'DN1500',
        'DN2000',
        'DN2500',
        'Styczna',
        'Dennice',
        'Akcesoria',
        'Przejścia',
        'Kinety',
        'Inne'
    ],
    preco: ['PRECO_Kinety', 'PRECO_Zakresy', 'PRECO_Dodatki']
};

const SECTION_LABELS = {
    'Cennik Rury': 'Rury',
    Styczna: 'Styczne',
    PRECO_Kinety: 'Kinety',
    PRECO_Zakresy: 'Zakresy',
    PRECO_Dodatki: 'Dodatki'
};

/** Kolumna ceny per arkusz (pozostałe arkusze studni: „Cena PLN"). */
const PRICE_COLUMNS = {
    'Cennik Rury': 'Cena PLN (netto)',
    PRECO_Kinety: 'Cena prosta (PLN)',
    PRECO_Zakresy: 'Cena (PLN)',
    PRECO_Dodatki: 'Cena dna osadnika'
};

/** Kolumny tożsamości wiersza (gdy arkusz nie ma kolumny „Indeks"). */
const KEY_COLUMNS = {
    PRECO_Kinety: ['DN Studni', 'DN Rury'],
    PRECO_Zakresy: ['Typ', 'DN Studni', 'Min', 'Max', 'Grupa DN'],
    PRECO_Dodatki: ['DN Studni']
};

/** Kolumna nazwy (null = nazwa składana z klucza wiersza). */
const NAME_COLUMNS = {
    'Cennik Rury': 'Nazwa produktu',
    PRECO_Kinety: null,
    PRECO_Zakresy: null,
    PRECO_Dodatki: null
};

/** Kolumny ilości na transport (rury: „Szt./transport", studnie: „Ilość/transport"). */
const TRANSPORT_COLUMNS = ['Ilość/transport', 'Szt./transport'];

/**
 * Stan warstwy 2. `shown` trzyma limit wyrenderowanych pozycji per sekcja
 * (przycisk „Pokaż kolejne 100") — stan lokalny modułu, bez nowego globala.
 * @type {{
 *   axis: string,
 *   target: any,
 *   draft: any,
 *   active: any,
 *   sections: any[],
 *   section: string,
 *   item: string,
 *   shown: Record<string, number>,
 *   preview: { totalRows: number, bySheet: Record<string, number>, truncated: boolean },
 *   baseTruncated: boolean,
 *   changes: number,
 *   hasBase: boolean
 * }}
 */
const layer2 = {
    axis: 'rury',
    target: null,
    draft: null,
    active: null,
    sections: [],
    section: '',
    item: '',
    shown: {},
    preview: { totalRows: 0, bySheet: {}, truncated: false },
    baseTruncated: false,
    changes: 0,
    hasBase: false
};

function sectionId(sheet) {
    return String(sheet)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-');
}

function rowKey(sheet, row) {
    const columns = KEY_COLUMNS[sheet];
    if (columns) return columns.map((column) => String(row[column] ?? '')).join('|');
    return String(row['Indeks'] ?? '');
}

function rowName(sheet, row) {
    const column = NAME_COLUMNS[sheet] === undefined ? 'Nazwa' : NAME_COLUMNS[sheet];
    if (column) {
        const value = String(row[column] ?? '').trim();
        if (value) return value;
    }
    return rowKey(sheet, row);
}

function priceOf(sheet, row) {
    const column = PRICE_COLUMNS[sheet] || 'Cena PLN';
    const raw = row[column];
    if (raw === null || raw === undefined || raw === '') return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
}

function deltaPct(before, after) {
    if (before === null || after === null || before === 0) return null;
    return Math.round(((after - before) / before) * 1000) / 10;
}

function formatMoney(value) {
    if (value === null || value === undefined || value === '') return '—';
    const number = Number(value);
    if (!Number.isFinite(number)) return '—';
    return (
        number.toLocaleString('pl-PL', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }) + ' zł'
    );
}

function formatDelta(value) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
    const number = Number(value);
    return `${number > 0 ? '+' : ''}${number.toLocaleString('pl-PL', { maximumFractionDigits: 1 })} %`;
}

/** Separator tysięcy (spacja, bez zależności od locale — deterministyczny w testach). */
function formatThousands(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '—';
    return Math.round(number)
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * Pozycja kursu transportu: `Indeks` z prefiksem `TR-` (TR-RURY / TR-STUDNIE),
 * fallback — nazwa zawierająca „(kurs)".
 */
function isCourseRow(row) {
    const index = String(row['Indeks'] ?? '')
        .trim()
        .toUpperCase();
    if (index.startsWith('TR-')) return true;
    const name = String(row['Nazwa produktu'] ?? row['Nazwa'] ?? '').toLowerCase();
    return name.includes('(kurs)');
}

/** Ilość na transport (liczba szt./transport) — null gdy brak kolumny lub wartości. */
function transportValue(row) {
    for (const column of TRANSPORT_COLUMNS) {
        const raw = row[column];
        if (raw === null || raw === undefined || raw === '') continue;
        const value = Number(raw);
        if (Number.isFinite(value) && value > 0) return value;
    }
    return null;
}

/** Limit kursu (kg) ze stałej projektu — public/js/shared/constants.js. */
function maxTransportWeight() {
    const value = Number(window.MAX_TRANSPORT_WEIGHT);
    return Number.isFinite(value) && value > 0 ? value : 24000;
}

/** Fakty transportu — parametry dokumentu oferty, POZA cennikiem (plan §3.2 pkt 6). */
function transportFacts() {
    return [
        'Cena kursu = km × stawka (parametr oferty, poza cennikiem)',
        `Limit kursu: ${formatThousands(maxTransportWeight())} kg`,
        'Tryb transportu: transportSeparate (kurs jako osobna pozycja TR-*)'
    ];
}

/** Najnowszy szkic (DRAFT) osi — SSoT: `/summary` (`types[type].draft`). */
function draftVersion(type) {
    return summary?.types?.[type]?.draft || null;
}

/** Wersja obowiązująca osi (z `/summary`, z pełnym rekordem gdy dostępny). */
function activeVersion(type) {
    const ref = summary?.types?.[type]?.active;
    if (!ref) return null;
    return versions.find((v) => v.id === ref.id) || { ...ref, type };
}

/** Arkusze w kolejności sekcji; arkusze spoza listy dokładane na końcu. */
function orderedSheets(type, sheets) {
    const order = SECTION_ORDER[type] || [];
    const known = new Set(order);
    return [
        ...order.filter((name) => sheets[name]),
        ...Object.keys(sheets).filter((name) => !known.has(name))
    ];
}

/** Porównanie arkusza: dodane / zmienione / usunięte pozycje. */
function compareSheet(sheet, draftRows, activeRows) {
    const added = new Map();
    const changed = new Map();
    const removed = new Map();
    const activeByKey = new Map();
    for (const row of activeRows) activeByKey.set(rowKey(sheet, row), row);
    const draftKeys = new Set();
    for (const row of draftRows) {
        const key = rowKey(sheet, row);
        draftKeys.add(key);
        const after = priceOf(sheet, row);
        const beforeRow = activeByKey.get(key);
        if (!beforeRow) {
            added.set(key, { kind: 'added', before: null, after, deltaPct: null });
            continue;
        }
        const before = priceOf(sheet, beforeRow);
        if (before !== after) {
            changed.set(key, { kind: 'changed', before, after, deltaPct: deltaPct(before, after) });
        }
    }
    for (const [key, row] of activeByKey) {
        if (draftKeys.has(key)) continue;
        removed.set(key, {
            kind: 'removed',
            before: priceOf(sheet, row),
            after: null,
            deltaPct: null
        });
    }
    return { added, changed, removed };
}

/**
 * Δ sekcji wg SUMY wartości (before → after), nie średniej %: pozycje mają
 * różną wagę, więc średnia arytmetyczna % zniekształca realny wpływ na cennik.
 */
function sumDeltaPct(changes) {
    let before = 0;
    let after = 0;
    for (const change of changes.values()) {
        if (change.kind !== 'changed') continue;
        if (change.before === null || change.after === null) continue;
        before += change.before;
        after += change.after;
    }
    if (before === 0) return null;
    return Math.round(((after - before) / before) * 1000) / 10;
}

/** Pozycja kursu osi: TR-RURY / TR-STUDNIE (fallback: dowolny TR- albo „(kurs)"). */
function pickCourse(entries, type) {
    const preferred = `TR-${type.toUpperCase()}`;
    const byIndex = entries.filter((entry) =>
        String(entry.row['Indeks'] ?? '')
            .trim()
            .toUpperCase()
            .startsWith('TR-')
    );
    const exact = byIndex.find(
        (entry) =>
            String(entry.row['Indeks'] ?? '')
                .trim()
                .toUpperCase() === preferred
    );
    return exact || byIndex[0] || entries[0] || null;
}

/** Produkty osi z kolumną „Ilość/transport" — top wg liczby na transport. */
function transportProducts(products) {
    return products
        .map((entry) => ({
            name: rowName(entry.sheet, entry.row),
            value: transportValue(entry.row)
        }))
        .filter((item) => item.value !== null)
        .sort((a, b) => Number(b.value) - Number(a.value))
        .slice(0, TRANSPORT_PRODUCT_LIMIT);
}

/**
 * Sekcje osi z preview + Δ względem previewu wersji obowiązującej (lokalne
 * porównanie — jedyne źródło liczby zmian w warstwie 2).
 * `counts` = liczniki sprzed capa BE (`preview.counts`).
 */
function buildSections(type, draftSheets, activeSheets, counts) {
    const bySheet = (counts && counts.bySheet) || {};
    const hasBase = Boolean(activeSheets);
    const courseEntries = [];
    const products = [];
    const sections = [];
    for (const sheet of orderedSheets(type, draftSheets)) {
        const content = [];
        for (const row of draftSheets[sheet] || []) {
            if (isCourseRow(row)) courseEntries.push({ sheet, row });
            else {
                content.push(row);
                products.push({ sheet, row });
            }
        }
        if (content.length === 0) continue;
        // Brak aktywnej wersji (albo brak szkicu) → bez porównania, same stany.
        const local = hasBase
            ? compareSheet(
                  sheet,
                  content,
                  (activeSheets[sheet] || []).filter((row) => !isCourseRow(row))
              )
            : { added: new Map(), changed: new Map(), removed: new Map() };
        const changes = new Map(local.added);
        for (const [key, change] of local.changed) changes.set(key, change);
        const total = Number(bySheet[sheet] ?? content.length);
        sections.push({
            id: sectionId(sheet),
            label: SECTION_LABELS[sheet] || sheet,
            sheet,
            rows: content,
            count: content.length,
            totalCount: total,
            truncated: total > content.length,
            added: local.added.size,
            removed: local.removed.size,
            changed: local.changed.size,
            deltaPct: sumDeltaPct(changes),
            hasBase,
            changes
        });
    }
    if (type !== 'preco') {
        sections.push({
            id: 'transport',
            label: 'Transport',
            sheet: '',
            rows: [],
            count: 0,
            totalCount: 0,
            truncated: false,
            added: 0,
            removed: 0,
            changed: 0,
            deltaPct: null,
            hasBase,
            changes: new Map(),
            isTransport: true,
            course: pickCourse(courseEntries, type),
            products: transportProducts(products)
        });
    }
    return sections;
}

/** Ładuje podgląd osi: szkic (lub obowiązująca) + preview obowiązującej jako baza Δ. */
async function loadLayer2() {
    const type = layer2.axis;
    const draft = draftVersion(type);
    const active = activeVersion(type);
    const target = draft || active;
    layer2.target = target;
    layer2.draft = draft;
    layer2.active = active;
    layer2.section = '';
    layer2.item = '';
    layer2.sections = [];
    layer2.shown = {};
    layer2.changes = 0;
    layer2.hasBase = false;
    layer2.preview = { totalRows: 0, bySheet: {}, truncated: false };
    layer2.baseTruncated = false;
    if (!target) {
        renderLayer2();
        return;
    }
    try {
        const preview = await apiJson(`/${encodeURIComponent(target.id)}/preview`);
        layer2.preview = {
            totalRows: Number(preview.totalRows ?? preview.counts?.totalRows ?? 0),
            bySheet: preview.counts?.bySheet || {},
            truncated: Boolean(preview.truncated)
        };
        let activeSheets = null;
        if (draft && active && active.id !== draft.id) {
            const base = await apiJson(`/${encodeURIComponent(active.id)}/preview`).catch(
                () => null
            );
            if (base) {
                activeSheets = base.sheets || {};
                layer2.baseTruncated = Boolean(base.truncated);
            }
        }
        layer2.hasBase = Boolean(activeSheets);
        layer2.sections = buildSections(type, preview.sheets || {}, activeSheets, layer2.preview);
        layer2.changes = layer2.sections.reduce(
            (sum, section) => sum + section.added + section.changed + section.removed,
            0
        );
    } catch (error) {
        setAlert(
            `Nie udało się wczytać podglądu cennika: ${error instanceof Error ? error.message : String(error)}`,
            true
        );
    }
    renderLayer2();
}

function renderLayer2() {
    renderAxisTiles();
    renderStateBar();
    renderPreviewNote();
    renderSections();
    renderItems();
    renderItemCard();
}

/**
 * Komunikat o obciętym podglądzie (cap BE: 5000 wierszy/arkusz) — bez niego
 * liczby w kafelkach wyglądają na kompletne, a są zaniżone.
 */
function renderPreviewNote() {
    const host = document.getElementById('cenniki-preview-note');
    if (!host) return;
    if (!layer2.preview.truncated && !layer2.baseTruncated) {
        host.hidden = true;
        host.textContent = '';
        return;
    }
    const shown = layer2.sections.reduce((sum, section) => sum + section.count, 0);
    host.hidden = false;
    host.textContent = layer2.preview.truncated
        ? `Pokazano ${shown} z ${layer2.preview.totalRows} wierszy — pełny diff w eksporcie XLSX`
        : 'Baza porównania obcięta — pełny diff w eksporcie XLSX';
}

/** Kafelki osi (przełącznik Rury / Studnie / PRECO). */
function renderAxisTiles() {
    const host = document.getElementById('cenniki-axis-tiles');
    if (!host) return;
    host.innerHTML = AXIS_TYPES.map((type) => {
        const isCurrent = layer2.axis === type;
        const active = summary?.types?.[type]?.active;
        const draft = draftVersion(type);
        const note = type === 'preco' ? 'osobna oś (nie sekcja studni)' : '';
        const label =
            `Oś cennika ${TYPE_LABELS[type]} — ` +
            (active ? `obowiązuje ${active.version}` : 'brak wersji obowiązującej') +
            (draft ? `, szkic ${draft.version}` : '');
        return `
            <button type="button" class="cenniki-tile cenniki-tile--axis cenniki-tile--switch${
                isCurrent ? ' cenniki-tile--current' : ''
            }" data-cenniki-type="${escAttr(type)}" aria-pressed="${isCurrent ? 'true' : 'false'}" aria-label="${escAttr(label)}">
                <span class="cenniki-tile-title">${esc(TYPE_LABELS[type])}</span>
                <span class="cenniki-tile-row"><span>obowiązuje</span><b>${esc(
                    active ? active.version : '—'
                )}</b></span>
                <span class="cenniki-tile-row"><span>szkic</span><b>${esc(
                    draft ? draft.version : '—'
                )}</b></span>
                ${note ? `<span class="cenniki-tile-note">${esc(note)}</span>` : ''}
            </button>`;
    }).join('');
}

/** Pasek stanu osi: podgląd (szkic/obowiązująca) + statusy + akcje. */
function renderStateBar() {
    const host = document.getElementById('cenniki-state-bar');
    if (!host) return;
    const type = layer2.axis;
    const data = summary?.types?.[type] || {};
    const draft = layer2.draft;
    const active = data.active;
    const next = data.nextScheduled;
    const badges = [];
    if (layer2.target) {
        const isDraft = Boolean(draft && layer2.target.id === draft.id);
        badges.push(
            `<span class="badge badge-info">Podgląd: ${
                isDraft ? 'szkic' : 'obowiązująca'
            } ${esc(layer2.target.version || '')}</span>`
        );
    }
    if (draft) {
        // Jedno źródło liczby zmian: lokalne porównanie previewów (layer2.changes).
        const changes = layer2.hasBase ? `${layer2.changes} zmian` : 'bez wersji bazowej';
        badges.push(
            `<span class="badge badge-muted">✎ Szkic ${esc(draft.version)} (${esc(changes)})</span>`
        );
    } else {
        badges.push('<span class="badge badge-muted">bufor edycji: brak szkiców</span>');
    }
    if (active) {
        badges.push(
            `<span class="badge badge-ok">✓ Obowiązuje ${esc(active.version)} (od ${formatDate(
                active.effectiveFrom
            )})</span>`
        );
    }
    if (next) {
        badges.push(
            `<span class="badge badge-info">◷ Do wdrożenia ${esc(next.version)} (od ${formatDate(
                next.effectiveFrom
            )})</span>`
        );
    }
    const targetId = layer2.target ? String(layer2.target.id) : '';
    const actions = [
        `<a class="btn btn-sm btn-secondary" href="${escAttr(
            EDITOR_LINKS[type]
        )}" target="_blank" rel="noopener">Edytuj w module</a>`
    ];
    if (draft) {
        actions.push(
            `<button type="button" class="btn btn-sm btn-primary" data-cenniki-publish="${escAttr(
                draft.id
            )}">Opublikuj</button>`
        );
    }
    actions.push(
        `<button type="button" class="btn btn-sm btn-secondary" data-cenniki-checks="${escAttr(
            targetId
        )}"${targetId ? '' : ' disabled'}>Kontrola</button>`
    );
    actions.push(
        `<button type="button" class="btn btn-sm btn-secondary" data-cenniki-compare="${escAttr(
            targetId
        )}"${targetId ? '' : ' disabled'}>Porównaj</button>`
    );
    host.innerHTML = `${badges.join(' ')}<div class="cenniki-tile-actions">${actions.join('')}</div>`;
}

/** Ile pozycji sekcji jest wyrenderowanych (limit DOM = 100 na sekcję). */
function shownLimit(section) {
    const limit = Number(layer2.shown[section.id] || 0);
    return limit > 0 ? Math.min(limit, section.count) : Math.min(ITEM_PAGE_SIZE, section.count);
}

/** Kafelki sekcji osi (klik → kafelki pozycji). */
function renderSections() {
    const host = document.getElementById('cenniki-sections');
    if (!host) return;
    if (!layer2.target) {
        host.innerHTML = '<p class="cenniki-empty">Brak wersji do podglądu.</p>';
        return;
    }
    const tiles = layer2.sections.map((section) => {
        if (section.isTransport) return transportTile(section);
        const isCurrent = layer2.section === section.id;
        const delta = section.hasBase
            ? section.deltaPct === null
                ? 'bez zmian'
                : `Δ ${formatDelta(section.deltaPct)}`
            : 'bez wersji bazowej';
        const label =
            `${TYPE_LABELS[layer2.axis]} ${section.label} — ${section.count} pozycji, ` +
            `${section.changed} zmienionych, ${section.added} nowych`;
        const notes = [];
        if (section.removed > 0) notes.push(`${section.removed} usuniętych`);
        if (section.truncated) {
            notes.push(
                `Pokazano ${section.count} z ${section.totalCount} wierszy — pełny diff w eksporcie XLSX`
            );
        }
        const shown = shownLimit(section);
        if (shown < section.count) notes.push(`podgląd ${shown} z ${section.count}`);
        return `
            <button type="button" class="cenniki-tile cenniki-tile--section${
                isCurrent ? ' cenniki-tile--current' : ''
            }" data-cenniki-section="${escAttr(section.id)}" aria-label="${escAttr(label)}" aria-pressed="${
                isCurrent ? 'true' : 'false'
            }">
                <span class="cenniki-tile-title">${esc(section.label)}</span>
                <span class="cenniki-tile-row"><span>pozycji</span><b>${esc(
                    String(section.count)
                )}</b></span>
                <span class="cenniki-tile-row"><span>zmiany</span><b>${esc(delta)}</b></span>
                ${notes.map((note) => `<span class="cenniki-tile-note">${esc(note)}</span>`).join('')}
            </button>`;
    });
    if (layer2.axis === 'studnie') {
        tiles.push(`
            <button type="button" class="cenniki-tile cenniki-tile--section cenniki-tile--preco" data-cenniki-type="preco" aria-label="Wkładki PRECO — osobna oś cennika, osobny cykl publikacji">
                <span class="cenniki-tile-title">Wkładki PRECO</span>
                <span class="cenniki-tile-row"><span>osobna oś</span><b>PRECO</b></span>
                <span class="cenniki-tile-note">publikacja studni ≠ publikacja PRECO</span>
            </button>`);
    }
    host.innerHTML = tiles.join('');
}

/**
 * Sekcja Transport — kafelek informacyjny: pozycja kursu (`TR-*`), produkty osi
 * z kolumną „Ilość/transport" i 3 fakty poza cennikiem (plan §3.2 pkt 6).
 */
function transportTile(section) {
    const course = section.course || null;
    const row = course ? course.row : null;
    const sheet = course ? course.sheet : '';
    const courseId = row ? String(row['Indeks'] ?? '') : '—';
    const courseName = row
        ? String(row['Nazwa produktu'] || row['Nazwa'] || courseId)
        : 'brak pozycji kursu';
    const coursePrice = row ? priceOf(sheet, row) : null;
    const facts = transportFacts()
        .map((fact) => `<li>${esc(fact)}</li>`)
        .join('');
    const products = (section.products || [])
        .map(
            (product) =>
                `<li>${esc(product.name)} — Ilość/transport: ${esc(String(product.value))}</li>`
        )
        .join('');
    return `
        <div class="cenniki-tile cenniki-tile--section cenniki-tile--transport" role="group" aria-label="Sekcja Transport — pozycja kursu, produkty z ilością na transport i parametry poza cennikiem">
            <span class="cenniki-tile-title">Transport</span>
            <span class="cenniki-tile-row"><span>pozycja kursu</span><b>${esc(courseId)}</b></span>
            <span class="cenniki-tile-row"><span>nazwa</span><b>${esc(courseName)}</b></span>
            <span class="cenniki-tile-row"><span>cena w cenniku</span><b>${esc(
                formatMoney(coursePrice)
            )}</b></span>
            ${
                products
                    ? `<ul class="cenniki-facts">${products}</ul>`
                    : '<span class="cenniki-tile-note">brak produktów z kolumną Ilość/transport</span>'
            }
            <ul class="cenniki-facts">${facts}</ul>
            <span class="badge badge-muted">poza cennikiem</span>
        </div>`;
}

/** Kafelki pozycji wybranej sekcji (limit DOM: 100 pozycji + „Pokaż kolejne 100"). */
function renderItems() {
    const host = document.getElementById('cenniki-items');
    const note = document.getElementById('cenniki-items-note');
    if (!host) return;
    const section = layer2.sections.find((item) => item.id === layer2.section);
    if (!section) {
        host.hidden = true;
        host.innerHTML = '';
        if (note) {
            note.hidden = true;
            note.innerHTML = '';
        }
        return;
    }
    const visible = section.rows.slice(0, shownLimit(section));
    host.hidden = false;
    host.innerHTML = visible
        .map((row) => {
            const key = rowKey(section.sheet, row);
            const change = section.changes.get(key);
            const state = change ? (change.kind === 'added' ? 'nowa' : 'zmieniona') : 'bez zmian';
            const stateClass = change ? (change.kind === 'added' ? 'added' : 'changed') : 'same';
            const name = rowName(section.sheet, row);
            const price = priceOf(section.sheet, row);
            const delta =
                change && change.deltaPct !== null && change.deltaPct !== undefined
                    ? formatDelta(change.deltaPct)
                    : '—';
            const label = `${name} — ${formatMoney(price)}, ${state}, Δ ${delta}`;
            return `
                <button type="button" class="cenniki-tile cenniki-tile--item${
                    layer2.item === key ? ' cenniki-tile--current' : ''
                }" data-cenniki-item="${escAttr(key)}" aria-label="${escAttr(label)}" aria-pressed="${
                    layer2.item === key ? 'true' : 'false'
                }">
                    <span class="cenniki-tile-title">${esc(name)}</span>
                    <span class="cenniki-tile-row"><span>cena</span><b>${esc(
                        formatMoney(price)
                    )}</b></span>
                    <span class="cenniki-tile-row"><span>Δ</span><b>${esc(delta)}</b></span>
                    <span class="cenniki-tile-state cenniki-tile-state--${stateClass}">${esc(
                        state
                    )}</span>
                </button>`;
        })
        .join('');
    if (!note) return;
    const parts = [`Pokazano ${visible.length} z ${section.count} pozycji`];
    if (section.truncated) {
        parts.push(
            `Pokazano ${section.count} z ${section.totalCount} wierszy — pełny diff w eksporcie XLSX`
        );
    }
    const more =
        visible.length < section.count
            ? `<button type="button" class="btn btn-sm btn-secondary" data-cenniki-more="${escAttr(
                  section.id
              )}">Pokaż kolejne ${ITEM_PAGE_SIZE}</button>`
            : '';
    note.hidden = false;
    note.innerHTML = `<span>${esc(parts.join(' — '))}</span> ${more}`;
}

/** Karta pozycji (klik w kafelek pozycji). */
function renderItemCard() {
    const host = document.getElementById('cenniki-item-card');
    if (!host) return;
    const section = layer2.sections.find((item) => item.id === layer2.section);
    const row = section
        ? section.rows.find((item) => rowKey(section.sheet, item) === layer2.item)
        : null;
    if (!row || !section) {
        host.hidden = true;
        host.innerHTML = '';
        return;
    }
    const key = rowKey(section.sheet, row);
    const change = section.changes.get(key);
    const state = change ? (change.kind === 'added' ? 'nowa' : 'zmieniona') : 'bez zmian';
    const stateClass = change ? (change.kind === 'added' ? 'added' : 'changed') : 'same';
    const before =
        change && change.before !== null && change.before !== undefined ? change.before : null;
    const delta =
        change && change.deltaPct !== null && change.deltaPct !== undefined
            ? formatDelta(change.deltaPct)
            : '—';
    host.hidden = false;
    const truncation = section.truncated
        ? `<p class="cenniki-warning">Pokazano ${esc(String(section.count))} z ${esc(
              String(section.totalCount)
          )} wierszy — pełny diff w eksporcie XLSX</p>`
        : '';
    host.innerHTML = `
        <h3 class="cenniki-item-title">${esc(rowName(section.sheet, row))}</h3>
        <div class="cenniki-tile-row"><span>Indeks</span><b>${esc(key)}</b></div>
        <div class="cenniki-tile-row"><span>Cena w obowiązującej</span><b>${esc(
            formatMoney(before)
        )}</b></div>
        <div class="cenniki-tile-row"><span>Cena w podglądzie</span><b>${esc(
            formatMoney(priceOf(section.sheet, row))
        )}</b></div>
        <div class="cenniki-tile-row"><span>Zmiana</span><b>${esc(delta)}</b></div>
        <span class="cenniki-tile-state cenniki-tile-state--${stateClass}">${esc(state)}</span>
        ${truncation}`;
}

/** Toast po publikacji — jedna ścieżka dla zwykłej publikacji i korekty wstecznej. */
function notifyPublish(json) {
    const published = (json && json.version) || {};
    const stale = Boolean(json && json.checksStale);
    notify(
        `Opublikowano ${published.version || ''}${
            stale ? ' — kontrola nieaktualna, sprawdź różnice' : ''
        }`,
        stale ? 'warning' : 'success'
    );
}

/** Wersja po ID — lista wersji albo `/summary` (szkic/obowiązująca). */
function findVersion(id) {
    const fromList = versions.find((version) => version.id === id);
    if (fromList) return fromList;
    const refs = Object.values(summary?.types || {})
        .map((data) => data && (data.draft || data.active))
        .filter(Boolean);
    return refs.find((version) => version.id === id) || null;
}

/** Publikacja szkicu: `approveVersion` + nota dla daty w przeszłości. */
function publishDraft(id) {
    const api = pv();
    if (!api || typeof api.approveVersion !== 'function') {
        notify('Brak modułu publikacji wersji.', 'error');
        return;
    }
    const version = findVersion(id);
    const isPast =
        version && typeof api.isPastDate === 'function'
            ? api.isPastDate(version.effectiveFrom)
            : false;
    if (isPast) {
        openPublishNoteModal(id);
        return;
    }
    api.approveVersion(id)
        .then((json) => {
            notifyPublish(json);
            return loadData();
        })
        .catch((error) => {
            notify(`Błąd publikacji: ${error.message || 'nieznany błąd'}`, 'error');
        });
}

/** Modal uzasadnienia (korekta wsteczna — nota ≥ 10 znaków). */
function openPublishNoteModal(id) {
    showModal({
        id: 'cenniki-note-modal',
        title: 'Korekta wsteczna — uzasadnienie',
        titleId: 'cenniki-note-title',
        html: `<div class="modal"><div class="modal-header"><h3 id="cenniki-note-title">Korekta wsteczna — uzasadnienie</h3>
            <button class="btn-icon" aria-label="Zamknij" data-csp="closeModal" data-csp-args="[&quot;cenniki-note-modal&quot;]">×</button></div>
            <div class="modal-body">
                <div class="form-group"><label for="cenniki-note-input">Uzasadnienie (min. 10 znaków)</label>
                <input class="form-input" id="cenniki-note-input" maxlength="500" placeholder="Min. 10 znaków uzasadnienia zmiany…"></div>
                <p class="text-muted" id="cenniki-note-hint">0/10 znaków</p>
                <div class="form-group"><button type="button" class="btn btn-primary" id="cenniki-note-ok" disabled>Opublikuj</button></div>
            </div></div>`
    });
    const input = document.getElementById('cenniki-note-input');
    const ok = document.getElementById('cenniki-note-ok');
    const hint = document.getElementById('cenniki-note-hint');
    if (!input || !ok) return;
    const update = () => {
        const length = (input.value || '').trim().length;
        if (hint) hint.textContent = `${length}/10 znaków`;
        ok.disabled = length < 10;
    };
    input.addEventListener('input', update);
    ok.addEventListener('click', () => {
        const note = input.value || '';
        closeModal('cenniki-note-modal');
        window.pricelistVersions
            .approveVersion(id, note)
            .then((json) => {
                notifyPublish(json);
                return loadData();
            })
            .catch((error) => {
                notify(`Błąd publikacji: ${error.message || 'nieznany błąd'}`, 'error');
            });
    });
    update();
}

/* ── Warstwa 3 (M6): historia jako kafelki wersji ────────────────────────── */

/**
 * Próg gęstości historii: wariant tabelaryczny tylko powyżej 20 wersji
 * (plan §3.0 — tabela tylko dla gęstych list; domyślnie kafelki).
 */
const HISTORY_TABLE_THRESHOLD = 20;

/** Aktywny widok historii: 'tiles' (domyślny) albo 'table' (gęsty). */
let historyView = 'tiles';

/** Referencja do tabeli gęstej — w widoku kafelków jest odłączona od DOM. */
let historyTableRef = null;

/** Rodzic tabeli gęstej (do przywrócenia po odłączeniu w widoku kafelków). */
let historyTableParent = null;

/** Data obowiązywania: lokalnie (czytelnie) + UTC — jak w panelu wersji. */
function effectiveFromHtml(value) {
    const raw = String(value || '');
    if (!raw) return '<span class="text-muted">—</span>';
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return esc(raw);
    const local = date.toLocaleString('pl-PL');
    const utc = `${date.toISOString().replace('T', ' ').slice(0, 16)} UTC`;
    return `<span title="${escAttr(raw)}">${esc(local)}<br><span class="text-muted">UTC: ${esc(
        utc
    )}</span></span>`;
}

/** Użycie wersji: liczba + rodzaj (oferty/zamówienia albo wersje studni). */
function usedByText(version) {
    if (typeof version.usedBy !== 'number') return '—';
    const kind = version.usedByKind === 'studnieVersions' ? 'wersji studni' : 'ofert/zamówień';
    return `${version.usedBy} ${kind}`;
}

/** Czy wersję można usunąć — SSoT: `window.pricelistVersions.canDelete`. */
function canDeleteVersion(version) {
    const api = pv();
    const state = stateOf(version);
    if (api && typeof api.canDelete === 'function') return Boolean(api.canDelete(state));
    return state === 'DRAFT' || state === 'SCHEDULED';
}

/** Potwierdzenie operacji (appConfirm z fallbackiem) — jak w panelu wersji. */
function confirmAction(message) {
    if (typeof window.appConfirm === 'function') return window.appConfirm(message);
    if (typeof window.confirm === 'function') return Promise.resolve(window.confirm(message));
    return Promise.resolve(true);
}

/** Kontener kafelków wersji + tabela gęsta (referencje, nie tylko DOM). */
function historyHosts() {
    const body = document.getElementById('cenniki-history-body');
    let tiles = body;
    if (body && body.tagName === 'TBODY') {
        // Uklad legacy: `#cenniki-history-body` = tbody tabeli — kafelki dostaja
        // wlasny kontener, tabela zostaje wariantem gestym.
        historyTableRef = body.closest('table');
        tiles = document.getElementById('cenniki-history-tiles');
        if (!tiles) {
            tiles = document.createElement('div');
            tiles.id = 'cenniki-history-tiles';
            tiles.className = 'cenniki-tiles cenniki-tiles--versions';
            tiles.setAttribute('role', 'group');
            tiles.setAttribute('aria-label', 'Wersje cenników');
            if (historyTableRef && historyTableRef.parentElement) {
                historyTableRef.parentElement.insertBefore(tiles, historyTableRef);
            }
        }
    }
    const tableBody = document.getElementById('cenniki-history-table-body');
    if (tableBody) historyTableRef = tableBody.closest('table');
    return { tiles, table: historyTableRef };
}

/** Odłącza tabelę gęstą od DOM (widok kafelków). */
function detachHistoryTable() {
    if (historyTableRef && historyTableRef.isConnected) {
        historyTableParent = historyTableRef.parentElement;
        historyTableRef.remove();
    }
}

/** Przywraca tabelę gęstą do DOM (widok tabelaryczny). */
function attachHistoryTable() {
    if (!historyTableRef || historyTableRef.isConnected) return;
    const parent = document.getElementById('cenniki-history-table-wrap') || historyTableParent;
    if (parent) parent.appendChild(historyTableRef);
}

function filteredVersions() {
    const typeSelect = /** @type {HTMLSelectElement | null} */ (
        document.getElementById('cenniki-history-type')
    );
    const stateSelect = /** @type {HTMLSelectElement | null} */ (
        document.getElementById('cenniki-history-state')
    );
    const type = typeSelect?.value || '';
    const state = stateSelect?.value || '';
    return versions.filter(
        (version) => (!type || version.type === type) && (!state || stateOf(version) === state)
    );
}

function collisionKeys() {
    const counts = new Map();
    for (const version of versions) {
        if (version.status !== 'APPROVED') continue;
        const key = `${version.type}\u0000${version.effectiveFrom}`;
        counts.set(key, (counts.get(key) || 0) + 1);
    }
    return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key));
}

/**
 * Kafelek wersji (kafelek = wersja): badge stanu, etykieta + seq, data
 * obowiązywania (lokalnie + UTC), autor, użycie, nota i akcje.
 */
function renderVersionTile(version, collisions) {
    const id = escAttr(version.id);
    const type = escAttr(version.type);
    const label = esc(version.version || '—');
    const status = escAttr(version.status || '');
    const hasCollision = collisions.has(`${version.type}\u0000${version.effectiveFrom}`);
    const usage = usedByText(version);
    const aria = `Wersja ${version.version || '—'} — ${statusLabel(version)}, od ${formatDate(
        version.effectiveFrom
    )}, ${usage}`;
    const deletable = canDeleteVersion(version);
    return `
        <div class="cenniki-tile cenniki-tile--version" role="group" aria-label="${escAttr(aria)}">
            <div class="cenniki-tile-head">
                <button type="button" class="cenniki-tile-title cenniki-tile-link" data-cenniki-preview="${id}" data-cenniki-preview-type="${type}" aria-label="${escAttr(aria)}">${label}</button>
                <span class="text-muted">seq ${Number(version.seq || 0)}</span>
                ${statusBadge(version)}
                ${
                    hasCollision
                        ? '<span class="badge" title="Więcej niż jedna wersja z tą datą">kolizja</span>'
                        : ''
                }
            </div>
            <div class="cenniki-tile-rows">
                <div class="cenniki-tile-row"><span>typ</span><b>${esc(
                    TYPE_LABELS[version.type] || version.type
                )}</b></div>
                <div class="cenniki-tile-row"><span>obowiązuje od</span><b>${effectiveFromHtml(
                    version.effectiveFrom
                )}</b></div>
                <div class="cenniki-tile-row"><span>autor</span><b>${esc(
                    version.createdByName || version.createdBy || '—'
                )}</b></div>
                <div class="cenniki-tile-row"><span>użycie</span><b>${esc(usage)}</b></div>
            </div>
            <span class="cenniki-tile-note">${noteHtml(version.note)}</span>
            <div class="cenniki-tile-actions">
                <button type="button" class="btn btn-sm btn-secondary" data-cenniki-preview="${id}" data-cenniki-preview-type="${type}">Podgląd</button>
                <button type="button" class="btn btn-sm btn-secondary" data-cenniki-diff="${id}" data-cenniki-diff-type="${type}">Porównaj</button>
                <button type="button" class="btn btn-sm btn-secondary" data-cenniki-checks="${id}">Kontrola</button>
                <button type="button" class="btn btn-sm btn-secondary" data-cenniki-export="${id}" data-cenniki-export-type="${type}" data-cenniki-export-version="${escAttr(
                    version.version || ''
                )}" data-cenniki-export-status="${status}">Eksport</button>
                <button type="button" class="btn btn-sm btn-secondary" data-cenniki-clone="${id}">Klon</button>
                <button type="button" class="btn btn-sm btn-danger" data-cenniki-delete="${id}" data-cenniki-delete-version="${escAttr(
                    version.version || ''
                )}"${
                    deletable
                        ? ''
                        : ' disabled title="Wersja obowiązująca lub historyczna — nieusuwalna"'
                }>Usuń</button>
            </div>
        </div>`;
}

/** Kafelki wersji — widok domyślny historii. */
function renderHistoryTiles(rows, collisions) {
    if (rows.length === 0) return '<p class="cenniki-empty">Brak wersji.</p>';
    return rows.map((version) => renderVersionTile(version, collisions)).join('');
}

/** Gęsty wariant historii: tabela 9 kolumn (tylko dla list > 20 wersji). */
function renderHistoryTable(rows, collisions) {
    if (rows.length === 0)
        return '<tr><td colspan="9" class="cenniki-empty">Brak wersji.</td></tr>';
    return rows
        .map((version) => {
            const id = escAttr(version.id);
            const type = escAttr(version.type);
            const versionLabel = escAttr(version.version || '');
            const status = escAttr(version.status || '');
            const hasCollision = collisions.has(`${version.type}\u0000${version.effectiveFrom}`);
            const deletable = canDeleteVersion(version);
            return `
                <tr>
                    <td>${esc(TYPE_LABELS[version.type] || version.type)}</td>
                    <td><strong>${esc(version.version || '—')}</strong> <span class="text-muted">seq ${Number(version.seq || 0)}</span></td>
                    <td>${statusBadge(version)}${hasCollision ? ' <span class="badge" title="Więcej niż jedna wersja z tą datą">kolizja</span>' : ''}</td>
                    <td>${formatDate(version.effectiveFrom)}</td>
                    <td>${esc(version.createdByName || version.createdBy || '—')}</td>
                    <td>${noteHtml(version.note)}</td>
                    <td>${typeof version.usedBy === 'number' ? Number(version.usedBy) : '—'}</td>
                    <td>
                        <button class="btn btn-sm btn-secondary" data-cenniki-checks="${id}">Sprawdź</button>
                    </td>
                    <td>
                        <div class="cenniki-actions">
                            <button class="btn btn-sm btn-secondary" data-cenniki-preview="${id}" data-cenniki-preview-type="${type}">Podgląd</button>
                            <button class="btn btn-sm btn-secondary" data-cenniki-diff="${id}" data-cenniki-diff-type="${type}">Porównaj</button>
                            <button class="btn btn-sm btn-secondary" data-cenniki-export="${id}" data-cenniki-export-type="${type}" data-cenniki-export-version="${versionLabel}" data-cenniki-export-status="${status}">Eksport</button>
                            <button class="btn btn-sm btn-secondary" data-cenniki-clone="${id}">Klon</button>
                            <button class="btn btn-sm btn-danger" data-cenniki-delete="${id}" data-cenniki-delete-version="${versionLabel}"${deletable ? '' : ' disabled title="Wersja obowiązująca lub historyczna — nieusuwalna"'}>Usuń</button>
                        </div>
                    </td>
                </tr>`;
        })
        .join('');
}

/** Stan przełącznika widoku (kafelki / tabela) — tabela tylko dla gęstych list. */
function renderHistorySwitch(dense) {
    const switchHost = document.getElementById('cenniki-history-switch');
    if (!switchHost) return;
    switchHost.querySelectorAll('[data-cenniki-history-view]').forEach((button) => {
        const element = /** @type {HTMLButtonElement} */ (button);
        const isTable = element.getAttribute('data-cenniki-history-view') === 'table';
        element.setAttribute(
            'aria-pressed',
            isTable === (historyView === 'table') ? 'true' : 'false'
        );
        if (!isTable) return;
        element.disabled = !dense;
        element.title = dense
            ? 'Widok tabelaryczny'
            : `Tabela od ${HISTORY_TABLE_THRESHOLD + 1} wersji`;
    });
}

function renderHistory() {
    const rows = filteredVersions();
    const collisions = collisionKeys();
    const count = document.getElementById('cenniki-history-count');
    const hosts = historyHosts();
    const tableBody = hosts.table ? hosts.table.querySelector('tbody') : null;
    const wrap = document.getElementById('cenniki-history-table-wrap');
    const dense = rows.length > HISTORY_TABLE_THRESHOLD;
    if (count) count.textContent = `Pokazano ${rows.length} z ${versions.length} wersji`;
    // Tabela tylko dla gestych list (> 20 wersji) — kafelki sa domyslne.
    if (!dense) historyView = 'tiles';
    const useTable = historyView === 'table' && dense && Boolean(tableBody);
    const switchHost = document.getElementById('cenniki-history-switch');
    if (switchHost) switchHost.hidden = rows.length === 0;

    if (hosts.tiles) {
        hosts.tiles.hidden = useTable;
        hosts.tiles.innerHTML = useTable ? '' : renderHistoryTiles(rows, collisions);
    }
    if (useTable && tableBody) {
        tableBody.innerHTML = renderHistoryTable(rows, collisions);
        attachHistoryTable();
        if (wrap) wrap.hidden = false;
    } else {
        if (tableBody) tableBody.innerHTML = '';
        detachHistoryTable();
        if (wrap) wrap.hidden = true;
    }
    renderHistorySwitch(dense);
}

/** Klon wersji → nowy szkic (POST /:id/clone-draft). */
async function cloneVersion(id) {
    if (!id) return;
    try {
        const json = await apiJson(`/${encodeURIComponent(id)}/clone-draft`, { method: 'POST' });
        const created = (json && json.version) || {};
        notify(`Utworzono wersję roboczą ${created.version || ''}`, 'success');
        await loadData();
    } catch (error) {
        notify(`Błąd klonowania: ${error.message || 'nieznany błąd'}`, 'error');
    }
}

/** Usunięcie wersji (DELETE /:id) — z potwierdzeniem jak w panelu wersji. */
async function deleteVersion(id, label) {
    if (!id) return;
    const name = label || id;
    const ok = await confirmAction(
        `Usunąć wersję ${name} wraz z jej pozycjami? Usunięcie jest trwałe.`
    );
    if (!ok) return;
    try {
        await apiJson(`/${encodeURIComponent(id)}`, { method: 'DELETE' });
        notify(`Wersja ${name} usunięta`, 'success');
        await loadData();
    } catch (error) {
        notify(`Błąd usuwania: ${error.message || 'nieznany błąd'}`, 'error');
    }
}

function deepLinkParams() {
    let hash = window.location.hash || '';
    try {
        if (window.parent && window.parent !== window) hash = window.parent.location.hash || hash;
    } catch (_error) {
        /* cross-origin fallback: własny hash */
    }
    const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
    const params = {};
    new URLSearchParams(query).forEach((value, key) => {
        params[key] = value;
    });
    if (!params.tab && /\/historia(?:[/?]|$)/.test(hash)) params.tab = 'historia';
    return params;
}

function applyDeepLink(attempt = 0) {
    const params = deepLinkParams();
    const type = ['rury', 'studnie', 'preco'].includes(params.type) ? params.type : '';
    const id = params.version || params.id || '';
    const tab = params.tab || (id ? 'historia' : '');
    if (tab) showSection(tab);
    if (type) {
        const historyType = /** @type {HTMLSelectElement | null} */ (
            document.getElementById('cenniki-history-type')
        );
        if (historyType) historyType.value = type;
        renderHistory();
        if (AXIS_TYPES.includes(type) && type !== layer2.axis) {
            layer2.axis = type;
            void loadLayer2();
        }
    }
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return;
    const api = pv();
    if (!api || typeof api.openPreview !== 'function') {
        if (attempt < 10) setTimeout(() => applyDeepLink(attempt + 1), 100);
        return;
    }
    if (params.against && /^[A-Za-z0-9_-]{1,64}$/.test(params.against)) {
        if (typeof api.openDiff === 'function') api.openDiff(id, params.against, type);
    } else {
        api.openPreview(id, type);
    }
}

function showSection(sectionId) {
    const id = ['przeglad', 'cennik', 'historia'].includes(sectionId) ? sectionId : 'przeglad';
    document.querySelectorAll('[data-cenniki-view]').forEach((view) => {
        const element = /** @type {HTMLElement} */ (view);
        element.hidden = element.dataset.cennikiView !== id;
    });
    if (id === 'historia') renderHistory();
    if (id === 'cennik') renderLayer2();
    document.querySelectorAll('[data-lucide]').forEach((icon) => {
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons({ root: icon.parentElement || undefined });
        }
    });
}

function openChecks(id) {
    showModal({
        id: 'cenniki-checks-modal',
        title: 'Kontrola wersji',
        titleId: 'cenniki-checks-title',
        html: `<div class="modal"><div class="modal-header"><h3 id="cenniki-checks-title">Kontrola wersji</h3>
            <button class="btn-icon" aria-label="Zamknij" data-csp="closeModal" data-csp-args="[&quot;cenniki-checks-modal&quot;]">×</button></div>
            <div class="modal-body" id="cenniki-checks-body"><p class="text-muted">Ładowanie…</p></div></div>`
    });
    const body = document.getElementById('cenniki-checks-body');
    if (!body) return;
    const api = pv();
    if (!api || typeof api.fetchChecks !== 'function') {
        body.innerHTML = '<p class="cenniki-warning">Brak modułu kontroli wersji.</p>';
        return;
    }
    api.fetchChecks(id)
        .then((checks) => {
            body.innerHTML = checks
                ? renderChecks(checks)
                : '<p class="cenniki-warning">Nie udało się pobrać kontroli wersji.</p>';
        })
        .catch((error) => {
            body.innerHTML = `<p class="cenniki-warning">${esc(error.message || 'Błąd kontroli')}</p>`;
        });
}

function renderChecks(checks) {
    const usage = checks.usage || {};
    const collision = checks.collision || {};
    const live = checks.liveDiff;
    const comparison = checks.comparisonToCurrentApproved || {};
    const comparisonStatus =
        comparison.status === 'MATCH'
            ? 'Zgodna z bieżącą'
            : comparison.status === 'DIFFERS'
              ? 'Różni się od bieżącej'
              : 'Brak bieżącej wersji';
    return `
        <div class="checks-grid">
            <div class="checks-box">
                <h4>Użycie</h4>
                <p>${Number(usage.total || 0)} ${usage.kind === 'studnieVersions' ? 'wersji studni' : 'ofert/zamówień'}</p>
            </div>
            <div class="checks-box">
                <h4>Kolizja daty</h4>
                <p>${collision.hasCollision ? `Tak — ${Number((collision.versions || []).length)} innych wersji` : 'Brak'}</p>
                <p class="text-muted">${formatDate(collision.effectiveFrom)}</p>
            </div>
            <div class="checks-box">
                <h4>Różnica do LIVE</h4>
                <p>${
                    live
                        ? `+${Number(live.added || 0)} / −${Number(live.removed || 0)} / ~${Number(live.changed || 0)}`
                        : 'Brak danych'
                }</p>
            </div>
            <div class="checks-box">
                <h4>Wersja bazowa</h4>
                <p>${esc(checks.baseVersion?.status || 'UNVERIFIABLE')}</p>
                <p class="text-muted">${esc(checks.baseVersion?.reason || '')}</p>
            </div>
            <div class="checks-box">
                <h4>Porównanie z bieżącą</h4>
                <p>${esc(comparisonStatus)}</p>
                <p class="text-muted">${esc(comparison.currentVersionId || '—')}</p>
            </div>
        </div>
        <p class="text-muted">Kontrola doradcza (read-only), ${esc(formatDate(checks.checkedAt))}.</p>`;
}

document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const historyViewButton = target.closest('[data-cenniki-history-view]');
    if (historyViewButton) {
        historyView =
            historyViewButton.getAttribute('data-cenniki-history-view') === 'table'
                ? 'table'
                : 'tiles';
        renderHistory();
        return;
    }
    const clone = target.closest('[data-cenniki-clone]');
    if (clone) {
        void cloneVersion(clone.getAttribute('data-cenniki-clone') || '');
        return;
    }
    const remove = target.closest('[data-cenniki-delete]');
    if (remove) {
        void deleteVersion(
            remove.getAttribute('data-cenniki-delete') || '',
            remove.getAttribute('data-cenniki-delete-version') || ''
        );
        return;
    }
    const viewLink = target.closest('[data-cenniki-view-link]');
    if (viewLink) {
        const type = viewLink.getAttribute('data-cenniki-type');
        showSection(viewLink.getAttribute('data-cenniki-view-link') || 'przeglad');
        if (type) {
            const historyType = /** @type {HTMLSelectElement | null} */ (
                document.getElementById('cenniki-history-type')
            );
            if (historyType) historyType.value = type;
            renderHistory();
            if (AXIS_TYPES.includes(type)) {
                layer2.axis = type;
                layer2.section = '';
                layer2.item = '';
                void loadLayer2();
            }
        }
        return;
    }
    const axisButton = target.closest('[data-cenniki-type]');
    if (axisButton) {
        const type = axisButton.getAttribute('data-cenniki-type') || '';
        if (AXIS_TYPES.includes(type) && type !== layer2.axis) {
            layer2.axis = type;
            layer2.section = '';
            layer2.item = '';
            void loadLayer2();
        }
        return;
    }
    const sectionButton = target.closest('[data-cenniki-section]');
    if (sectionButton) {
        const id = sectionButton.getAttribute('data-cenniki-section') || '';
        layer2.section = layer2.section === id ? '' : id;
        layer2.item = '';
        renderSections();
        renderItems();
        renderItemCard();
        return;
    }
    const itemButton = target.closest('[data-cenniki-item]');
    if (itemButton) {
        const key = itemButton.getAttribute('data-cenniki-item') || '';
        layer2.item = layer2.item === key ? '' : key;
        renderItems();
        renderItemCard();
        return;
    }
    const moreButton = target.closest('[data-cenniki-more]');
    if (moreButton) {
        const id = moreButton.getAttribute('data-cenniki-more') || '';
        const section = layer2.sections.find((item) => item.id === id);
        if (section) {
            layer2.shown[id] = Math.min(section.count, shownLimit(section) + ITEM_PAGE_SIZE);
            renderSections();
            renderItems();
        }
        return;
    }
    const publish = target.closest('[data-cenniki-publish]');
    if (publish) {
        publishDraft(publish.getAttribute('data-cenniki-publish') || '');
        return;
    }
    const compare = target.closest('[data-cenniki-compare]');
    if (compare) {
        const id = compare.getAttribute('data-cenniki-compare') || '';
        const api = pv();
        if (api && typeof api.openDiff === 'function') {
            api.openDiff(id, layer2.active ? String(layer2.active.id) : null, layer2.axis);
        }
        return;
    }
    const refresh = target.closest('[data-cenniki-refresh]');
    if (refresh) {
        void loadData();
        return;
    }
    const preview = target.closest('[data-cenniki-preview]');
    if (preview) {
        const id = preview.getAttribute('data-cenniki-preview') || '';
        const type = preview.getAttribute('data-cenniki-preview-type') || '';
        const api = pv();
        if (api && typeof api.openPreview === 'function') api.openPreview(id, type);
        return;
    }
    const diff = target.closest('[data-cenniki-diff]');
    if (diff) {
        const id = diff.getAttribute('data-cenniki-diff') || '';
        const type = diff.getAttribute('data-cenniki-diff-type') || '';
        const api = pv();
        if (api && typeof api.openDiff === 'function') api.openDiff(id, null, type);
        return;
    }
    const checks = target.closest('[data-cenniki-checks]');
    if (checks) {
        openChecks(checks.getAttribute('data-cenniki-checks') || '');
        return;
    }
    const exportButton = target.closest('[data-cenniki-export]');
    if (exportButton) {
        const api = pv();
        if (api && typeof api.exportVersion === 'function') {
            api.exportVersion(
                exportButton.getAttribute('data-cenniki-export') || '',
                exportButton.getAttribute('data-cenniki-export-type') || '',
                exportButton.getAttribute('data-cenniki-export-version') || '',
                exportButton.getAttribute('data-cenniki-export-status') || ''
            );
        }
    }
});

document.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    if (target.id === 'cenniki-history-type' || target.id === 'cenniki-history-state') {
        renderHistory();
    }
});

window.showSection = showSection;

void loadData().then(() => applyDeepLink());
