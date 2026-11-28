import { fetchJson } from '../shared/fetchJson.js';

const STATUS_PRESENTATION = {
    READY: {
        text: 'AI · Dane',
        title: 'Zapisano ocenę odpowiedzi AI dla tej studni. To jeszcze nie znaczy, że model już użył jej do nauki.'
    },
    WAITING_FEEDBACK: {
        text: 'AI · Czeka',
        title: 'AI zaproponowało wynik, ale nikt jeszcze nie ocenił, czy był dobry.'
    },
    COLLECTING: {
        text: 'AI · Przygotowanie',
        title: 'Zapisano dane tej studni, ale system jeszcze nie przygotował ich do nauki.'
    },
    EXCLUDED: {
        text: 'AI · Pominięta',
        title: 'Te dane nie są teraz uwzględniane w nauce AI: konto autora nie jest na liście uczących się albo próbka nie spełnia wymagań.'
    },
    NO_DATA: {
        text: 'AI · Brak danych',
        title: 'Nie znaleziono danych AI przypisanych do tej studni i oferty.'
    }
};
const STATUS_CLASS = {
    READY: 'is-ready',
    WAITING_FEEDBACK: 'is-waiting',
    COLLECTING: 'is-collecting',
    EXCLUDED: 'is-excluded',
    NO_DATA: 'is-no-data'
};
const STATUS_COUNTS = [
    [
        'READY',
        'Etykietowane',
        'Zapisano ocenę odpowiedzi AI. Model mógł jeszcze nie użyć jej do nauki.'
    ],
    [
        'WAITING_FEEDBACK',
        'Oczekuje na feedback',
        'AI zaproponowało wynik, ale nikt jeszcze go nie ocenił.'
    ],
    [
        'COLLECTING',
        'Do przygotowania',
        'Dane są zapisane, lecz system nie przygotował ich jeszcze do nauki.'
    ],
    [
        'EXCLUDED',
        'Pominięte',
        'Konto autora nie jest na liście uczących się albo próbka nie spełnia wymagań.'
    ],
    ['NO_DATA', 'Bez telemetrii', 'Nie znaleziono danych AI przypisanych do tej studni i oferty.']
];
const CHUNK_SIZE = 100;
const REFRESH_INTERVAL_MS = 15_000;

let currentOfferId = null;
let currentWellIds = [];
let currentStatuses = new Map();
let lastFetchedAt = 0;
let refreshTimer = 0;
let requestSequence = 0;
let listObserver = null;
let panelObserver = null;

function getPanel() {
    return document.getElementById('ai-offer-status');
}

function getWellIds() {
    return Array.isArray(window.wells)
        ? [...new Set(window.wells.map((well) => well && well.id).filter(Boolean))]
        : [];
}

function initializeCollapse(panel) {
    const content = panel.querySelector('[data-ai-status-content]');
    const toggle = panel.querySelector('[data-ai-status-toggle]');
    if (!content || !toggle) return;

    let isOpen =
        typeof window.collapseGet === 'function'
            ? window.collapseGet('ai-offer-status-content', true)
            : true;
    const applyState = () => {
        content.hidden = !isOpen;
        toggle.setAttribute('aria-expanded', String(isOpen));
        const label = isOpen ? 'Zwiń dane AI' : 'Rozwiń dane AI';
        toggle.setAttribute('aria-label', label);
        toggle.title = label;
    };

    applyState();
    toggle.addEventListener('click', () => {
        isOpen = !isOpen;
        applyState();
        if (typeof window.collapseSet === 'function') {
            window.collapseSet('ai-offer-status-content', isOpen);
        }
    });
}

function setMessage(message, busy = false) {
    const panel = getPanel();
    const text = panel?.querySelector('[data-ai-status-message]');
    if (!panel || !text) return;
    text.textContent = message;
    panel.setAttribute('aria-busy', String(busy));
}

function renderCounts(statuses) {
    const panel = getPanel();
    const host = panel?.querySelector('[data-ai-status-counts]');
    if (!host) return;
    host.replaceChildren();
    STATUS_COUNTS.forEach(([status, label, description]) => {
        const item = document.createElement('span');
        item.className = 'ai-offer-status-count';
        item.title = description;
        item.setAttribute('aria-label', `${label}: ${description}`);
        const name = document.createElement('span');
        name.textContent = label;
        const value = document.createElement('strong');
        value.textContent = String(statuses.filter((entry) => entry.status === status).length);
        item.append(name, value);
        host.append(item);
    });
    host.hidden = false;
}

function applyCardStatuses() {
    const list = document.getElementById('wells-list');
    if (!list) return;
    list.querySelectorAll('.well-list-item[data-well-id]').forEach((card) => {
        const indicator = card.querySelector('[data-ai-well-status]');
        const presentation = currentStatuses.get(card.getAttribute('data-well-id'));
        if (!indicator || !presentation) return;
        if (indicator.textContent !== presentation.text) {
            indicator.textContent = presentation.text;
        }
        indicator.title = presentation.title;
        indicator.setAttribute('aria-label', presentation.title);
        Object.values(STATUS_CLASS).forEach((className) => indicator.classList.remove(className));
        indicator.classList.add(STATUS_CLASS[presentation.status]);
        indicator.hidden = false;
    });
}

function clearCardStatuses() {
    const list = document.getElementById('wells-list');
    if (!list) return;
    list.querySelectorAll('.well-list-item[data-well-id] [data-ai-well-status]').forEach(
        (indicator) => {
            if (!indicator.hidden) indicator.hidden = true;
            if (indicator.textContent) indicator.textContent = '';
            if (indicator.title) indicator.title = '';
            indicator.removeAttribute('aria-label');
            Object.values(STATUS_CLASS).forEach((className) =>
                indicator.classList.remove(className)
            );
        }
    );
}

async function loadStatuses(offerId, wellIds, sequence) {
    const collected = [];
    for (let offset = 0; offset < wellIds.length; offset += CHUNK_SIZE) {
        const params = new URLSearchParams({ offerId });
        wellIds
            .slice(offset, offset + CHUNK_SIZE)
            .forEach((wellId) => params.append('wellId', wellId));
        const response = await fetchJson(`/api/telemetry/ai/offer-status?${params.toString()}`);
        if (response?.error) return { error: response.error };
        if (!response || !Array.isArray(response.wells)) return null;
        collected.push(...response.wells);
        if (sequence !== requestSequence) return null;
    }
    return collected;
}

async function refresh(force = false) {
    const panel = getPanel();
    if (!panel) return;
    const offerId = window.editingOfferIdStudnie || null;
    const wellIds = getWellIds();
    const signature = `${offerId || ''}:${wellIds.join('|')}`;
    const previousSignature = `${currentOfferId || ''}:${currentWellIds.join('|')}`;
    const changed = signature !== previousSignature;
    if (!force && !changed && Date.now() - lastFetchedAt < REFRESH_INTERVAL_MS) {
        applyCardStatuses();
        return;
    }
    if (changed) {
        panel.hidden = true;
        currentStatuses = new Map();
        clearCardStatuses();
        panel.querySelector('[data-ai-status-counts]').hidden = true;
    }
    currentOfferId = offerId;
    currentWellIds = wellIds;
    const sequence = ++requestSequence;
    if (!offerId) {
        panel.hidden = true;
        currentStatuses = new Map();
        panel.querySelector('[data-ai-status-counts]').hidden = true;
        setMessage('Zapisz ofertę, aby sprawdzić jej dane AI.');
        applyCardStatuses();
        return;
    }
    if (wellIds.length === 0) {
        currentStatuses = new Map();
        panel.querySelector('[data-ai-status-counts]').hidden = true;
        return;
    }

    setMessage('Sprawdzam dane AI powiązane z ofertą…', true);
    const rows = await loadStatuses(offerId, wellIds, sequence);
    if (sequence !== requestSequence) return;
    lastFetchedAt = Date.now();
    if (!rows || rows.error) {
        panel.hidden = true;
        currentStatuses = new Map();
        clearCardStatuses();
        panel.querySelector('[data-ai-status-counts]').hidden = true;
        setMessage('Nie udało się teraz sprawdzić statusu AI. Spróbuj ponownie za chwilę.');
        return;
    }
    panel.hidden = false;
    const byWellId = new Map(rows.map((row) => [row.wellId, row.status]));
    const normalized = wellIds.map((wellId) => ({
        wellId,
        status: byWellId.get(wellId) || 'NO_DATA'
    }));
    currentStatuses = new Map(
        normalized.map(({ wellId, status }) => [wellId, { status, ...STATUS_PRESENTATION[status] }])
    );
    renderCounts(normalized);
    setMessage(
        `Sprawdzono ${wellIds.length} ${wellIds.length === 1 ? 'studnię' : 'studni'} w tej ofercie.`
    );
    applyCardStatuses();
}

function scheduleRefresh(force = false) {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => refresh(force), 180);
}

function initialize() {
    const panel = getPanel();
    if (panel) initializeCollapse(panel);
    window.addEventListener('sok:studnie-offer-rendered', () => scheduleRefresh());
    document.addEventListener('sok:ai-offer-status-refresh', () => scheduleRefresh(true));
    const list = document.getElementById('wells-list');
    if (list) {
        listObserver = new MutationObserver(applyCardStatuses);
        listObserver.observe(list, { childList: true, subtree: true });
    }
    scheduleRefresh(true);
}

panelObserver = new MutationObserver(() => {
    if (!getPanel()) return;
    panelObserver?.disconnect();
    panelObserver = null;
    initialize();
});
panelObserver.observe(document.documentElement, { childList: true, subtree: true });
if (getPanel()) {
    panelObserver.disconnect();
    panelObserver = null;
    initialize();
}
