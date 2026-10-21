// @ts-check
/**
 * S1a: hub „Cenniki" — 3 widoki (przegląd / cennik / historia).
 * Read-only: operacje zapisu zostają w edytorach rury.html / studnie.html.
 */

import { escapeHtml, escapeHtmlAttr } from './shared/escapeHtml.js';
import { showModal } from './shared/modalCore.js';

const API = '/api/pricelist-versions';
const EDITORS = { rury: 'rury.html', studnie: 'studnie.html', preco: 'studnie.html' };
const TYPE_LABELS = { rury: 'Rury', studnie: 'Studnie', preco: 'PRECO' };
const STATE_LABELS = {
    DRAFT: 'Szkic',
    SCHEDULED: 'Zaplanowana',
    ACTIVE: 'Obowiązuje',
    BACKDATE: 'Obowiązuje (korekta)',
    BACKDATE_REQUESTED: 'Szkic (korekta)',
    ARCHIVED: 'Archiwalna',
    APPROVED: 'Zatwierdzona'
};

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

function stateLabel(state) {
    return STATE_LABELS[state] || state || '—';
}

function statusBadge(version) {
    const api = pv();
    if (api && typeof api.statusBadge === 'function') return api.statusBadge(stateOf(version));
    return `<span class="badge">${esc(stateLabel(stateOf(version)))}</span>`;
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

async function apiJson(path) {
    const res = await fetch(API + path, {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' }
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
}

function renderAll() {
    renderOverview();
    renderCurrent();
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
            return `
                <article class="cenniki-card">
                    <h2>${esc(TYPE_LABELS[type])}</h2>
                    <dl>
                        <div>
                            <dt>Aktywna</dt>
                            <dd>${active ? esc(active.version) : 'Brak'}</dd>
                        </div>
                        <div>
                            <dt>Od</dt>
                            <dd>${active ? formatDate(active.effectiveFrom) : '—'}</dd>
                        </div>
                        <div>
                            <dt>Zaplanowana</dt>
                            <dd>${next ? esc(next.version) : 'Brak'}</dd>
                        </div>
                        <div>
                            <dt>Robocze</dt>
                            <dd>${Number(data.draftCount || 0)}</dd>
                        </div>
                        <div>
                            <dt>Opublikowane</dt>
                            <dd>${Number(data.approvedCount || 0)}</dd>
                        </div>
                        <div>
                            <dt>Kolizje dat</dt>
                            <dd>${collision}</dd>
                        </div>
                    </dl>
                    ${
                        collision > 0
                            ? `<p class="cenniki-warning">${collision} dat z więcej niż jedną wersją — sprawdź historię.</p>`
                            : ''
                    }
                    <div class="cenniki-card-actions">
                        <button class="btn btn-sm btn-secondary" data-cenniki-view-link="historia" data-cenniki-type="${escAttr(type)}">
                            Historia
                        </button>
                        <button class="btn btn-sm btn-secondary" data-cenniki-view-link="cennik" data-cenniki-type="${escAttr(type)}">
                            Cennik
                        </button>
                        <a class="btn btn-sm btn-secondary" href="${EDITORS[type]}" target="_blank" rel="noopener">
                            Edytor
                        </a>
                    </div>
                </article>`;
        })
        .join('');
}

function renderCurrent() {
    const host = document.getElementById('cenniki-current');
    const select = /** @type {HTMLSelectElement | null} */ (
        document.getElementById('cenniki-type')
    );
    const editorLink = /** @type {HTMLAnchorElement | null} */ (
        document.getElementById('cenniki-editor-link')
    );
    if (!host || !select) return;
    const type = select.value || 'rury';
    if (editorLink) editorLink.href = EDITORS[type];
    const data = summary?.types?.[type];
    const active = data?.active;
    if (!data) {
        host.innerHTML = '<p class="cenniki-empty">Brak danych podsumowania.</p>';
        return;
    }
    const activeCard = active
        ? `<article class="cenniki-card">
                <h2>Bieżący cennik: ${esc(active.version)}</h2>
                <p class="text-muted">Obowiązuje od ${formatDate(active.effectiveFrom)}</p>
                <div class="cenniki-card-actions">
                    <button class="btn btn-sm btn-secondary" data-cenniki-preview="${escAttr(active.id)}" data-cenniki-preview-type="${escAttr(type)}">Podgląd</button>
                    <button class="btn btn-sm btn-secondary" data-cenniki-checks="${escAttr(active.id)}">Sprawdź</button>
                    <button class="btn btn-sm btn-secondary" data-cenniki-export="${escAttr(active.id)}" data-cenniki-export-type="${escAttr(type)}" data-cenniki-export-version="${escAttr(active.version)}" data-cenniki-export-status="${escAttr(active.status)}">Eksport</button>
                </div>
           </article>`
        : '<p class="cenniki-empty">Brak aktywnej wersji — resolver korzysta z LIVE.</p>';
    const nextCard = data.nextScheduled
        ? `<article class="cenniki-card">
                <h2>Najbliższa zaplanowana</h2>
                <p>${esc(data.nextScheduled.version)} — od ${formatDate(data.nextScheduled.effectiveFrom)}</p>
           </article>`
        : '';
    host.innerHTML = activeCard + nextCard;
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

function renderHistory() {
    const body = document.getElementById('cenniki-history-body');
    const count = document.getElementById('cenniki-history-count');
    if (!body) return;
    const rows = filteredVersions();
    const collisions = collisionKeys();
    if (count) count.textContent = `${rows.length} wersji`;
    if (rows.length === 0) {
        body.innerHTML = '<tr><td colspan="9" class="cenniki-empty">Brak wersji.</td></tr>';
        return;
    }
    body.innerHTML = rows
        .map((version) => {
            const id = escAttr(version.id);
            const type = escAttr(version.type);
            const versionLabel = escAttr(version.version || '');
            const status = escAttr(version.status || '');
            const hasCollision = collisions.has(`${version.type}\u0000${version.effectiveFrom}`);
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
                        </div>
                    </td>
                </tr>`;
        })
        .join('');
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
        const typeSelect = /** @type {HTMLSelectElement | null} */ (
            document.getElementById('cenniki-type')
        );
        const historyType = /** @type {HTMLSelectElement | null} */ (
            document.getElementById('cenniki-history-type')
        );
        if (typeSelect) typeSelect.value = type;
        if (historyType) historyType.value = type;
        renderCurrent();
        renderHistory();
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
    if (id === 'cennik') renderCurrent();
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
    apiJson(`/${encodeURIComponent(id)}/checks`)
        .then((checks) => {
            body.innerHTML = renderChecks(checks);
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
    const viewLink = target.closest('[data-cenniki-view-link]');
    if (viewLink) {
        const type = viewLink.getAttribute('data-cenniki-type');
        showSection(viewLink.getAttribute('data-cenniki-view-link') || 'przeglad');
        if (type) {
            const select = /** @type {HTMLSelectElement | null} */ (
                document.getElementById('cenniki-type')
            );
            const historyType = /** @type {HTMLSelectElement | null} */ (
                document.getElementById('cenniki-history-type')
            );
            if (select) select.value = type;
            if (historyType) historyType.value = type;
            renderCurrent();
            renderHistory();
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
    if (target.id === 'cenniki-type') renderCurrent();
    if (target.id === 'cenniki-history-type' || target.id === 'cenniki-history-state') {
        renderHistory();
    }
});

window.showSection = showSection;

void loadData().then(() => applyDeepLink());
