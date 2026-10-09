// @ts-check
/**
 * clientContacts.js — ESM: wiele osób do kontaktu w ofercie.
 * SSoT listy: blob `data.clientContacts: [{name, phone, email}]` (max 10).
 * Klucze legacy (contactPerson/clientPhone/clientEmail/clientContact) to
 * mirror pierwszego wpisu — PDF/search/DOCX czytają je jak dotąd.
 * Oferty legacy bez tablicy: jeden wpis wyprowadzony z kluczy legacy.
 */

export const MAX_CONTACTS = 10;

function str(v) {
    return typeof v === 'string' ? v.trim() : '';
}

/** Normalizuje dowolny input do listy (puste wiersze wypadają, limit 10). */
export function normalizeContacts(raw) {
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (const r of raw) {
        if (!r || typeof r !== 'object') continue;
        const name = str(r.name).slice(0, 200);
        const phone = str(r.phone).slice(0, 50);
        const email = str(r.email).slice(0, 200);
        if (!name && !phone && !email) continue;
        out.push({ name, phone, email });
        if (out.length >= MAX_CONTACTS) break;
    }
    return out;
}

/** Blob/detail oferty → lista edytowalna (fallback: klucze legacy). */
export function legacyToContacts(blob) {
    const b = blob && typeof blob === 'object' ? blob : {};
    const fromArray = normalizeContacts(b.clientContacts);
    if (fromArray.length > 0) return fromArray;
    const single = {
        name: str(b.contactPerson),
        phone: str(b.clientPhone) || str(b.clientContact),
        email: str(b.clientEmail)
    };
    if (!single.name && !single.phone && !single.email) return [];
    return [single];
}

/** Lista → mirror kluczy legacy (pierwszy wpis). */
export function contactsToLegacy(list) {
    const first = normalizeContacts(list)[0] || { name: '', phone: '', email: '' };
    return { contactPerson: first.name, clientPhone: first.phone, clientEmail: first.email };
}

/** Lista → tekst do ukrytego pola legacy `client-contact` ("Jan, 600; ..."). */
export function contactsToMirrorString(list) {
    return normalizeContacts(list)
        .map((c) => [c.name, c.phone].filter(Boolean).join(', '))
        .filter(Boolean)
        .join('; ');
}

/** Heurystyka dla wartości legacy ("Jan Kowalski, 600 100 200" → wiersz). */
export function parseLegacyMirror(s) {
    const t = str(s);
    if (!t) return [];
    const parts = t
        .split(';')
        .map((x) => x.trim())
        .filter(Boolean);
    return normalizeContacts(
        parts.map((p) => {
            const m = p.match(/^(.*?)[,;]\s*([\d+\-() ]{7,20})$/);
            if (m) return { name: m[1].trim(), phone: m[2].trim(), email: '' };
            return { name: p, phone: '', email: '' };
        })
    );
}

function escAttr(s) {
    if (typeof window !== 'undefined' && typeof window.escapeHtmlAttr === 'function')
        return window.escapeHtmlAttr(s);
    // Fallback pełnym łańcuchem (jak escapeHtmlAttr): sam cudzysłów nie wystarcza w value="...".
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** Wiersz edytora: imię i nazwisko + telefon + e-mail + Usuń. */
export function contactRowHtml(c, idx) {
    const contact = c && typeof c === 'object' ? c : {};
    return (
        `<div class="cc-row" data-cc-row="${idx}">` +
        `<input type="text" class="wizard-form-input form-input form-input-sm" data-cc="name" maxlength="200" value="${escAttr(contact.name || '')}" placeholder="Imię i nazwisko" aria-label="Imię i nazwisko osoby do kontaktu" />` +
        `<input type="tel" class="wizard-form-input form-input form-input-sm" data-cc="phone" maxlength="50" value="${escAttr(contact.phone || '')}" placeholder="Telefon" aria-label="Telefon osoby do kontaktu" />` +
        `<input type="email" class="wizard-form-input form-input form-input-sm" data-cc="email" maxlength="200" value="${escAttr(contact.email || '')}" placeholder="E-mail" aria-label="E-mail osoby do kontaktu" />` +
        `<button type="button" class="btn btn-sm btn-secondary" data-cc-remove="${idx}" aria-label="Usuń osobę">Usuń</button>` +
        `</div>`
    );
}

export function editorHtml(list) {
    const rows = normalizeContacts(list);
    return (
        `<div class="cc-rows">` +
        rows.map((c, i) => contactRowHtml(c, i)).join('') +
        `</div>` +
        `<button type="button" class="btn btn-sm btn-secondary" data-cc-add="1">Dodaj osobę</button>`
    );
}

/** Renderuje edytor do kontenera (nadpisuje zawartość + sync mirroru). */
export function renderEditor(container, list) {
    if (!container) return;
    const rows = normalizeContacts(list);
    container.innerHTML = editorHtml(rows.length > 0 ? rows : [{}]);
    const hiddenId = container.getAttribute && container.getAttribute('data-cc-hidden');
    if (hiddenId && typeof document !== 'undefined') {
        const hidden = document.getElementById(hiddenId);
        if (hidden) hidden.value = contactsToMirrorString(rows);
    }
}

/** Zbiera listę z wierszy edytora. */
export function collectContacts(container) {
    if (!container || typeof container.querySelectorAll !== 'function') return [];
    const rows = container.querySelectorAll('[data-cc-row]');
    const out = [];
    rows.forEach((row) => {
        const get = (k) => {
            const el = row.querySelector(`[data-cc="${k}"]`);
            return el && typeof el.value === 'string' ? el.value : '';
        };
        out.push({ name: get('name'), phone: get('phone'), email: get('email') });
    });
    return normalizeContacts(out);
}

/**
 * Podpina edytor: przycisk Dodaj + delegacja Usuń + sync ukrytego mirroru.
 * @param {Element} container kontener z data-cc-hidden="id-inputa"
 */
export function bindEditor(container) {
    if (!container || /** @type {any} */ (container)._ccBound) return;
    /** @type {any} */ (container)._ccBound = true;
    const syncHidden = () => {
        const hiddenId = container.getAttribute && container.getAttribute('data-cc-hidden');
        if (!hiddenId || typeof document === 'undefined') return;
        const hidden = document.getElementById(hiddenId);
        if (hidden) hidden.value = contactsToMirrorString(collectContacts(container));
    };
    container.addEventListener('click', (e) => {
        const t =
            e.target && e.target.closest
                ? e.target.closest('[data-cc-add],[data-cc-remove]')
                : null;
        if (!t) return;
        if (t.hasAttribute('data-cc-add')) {
            const rows = container.querySelector('.cc-rows');
            if (rows && rows.children.length >= MAX_CONTACTS) return;
            if (rows) {
                const wrap = document.createElement('div');
                wrap.innerHTML = contactRowHtml({}, rows.children.length);
                const row = wrap.firstElementChild;
                if (row) rows.appendChild(row);
            }
        } else {
            const row = t.closest('[data-cc-row]');
            if (row && typeof row.remove === 'function') row.remove();
        }
        syncHidden();
    });
    container.addEventListener('input', syncHidden);
}

// Bridge dla klasycznych (non-ESM) formularzy ofert — precedens: escapeHtml.js.
if (typeof window !== 'undefined') {
    window.ClientContacts = {
        MAX_CONTACTS,
        normalizeContacts,
        legacyToContacts,
        contactsToLegacy,
        contactsToMirrorString,
        parseLegacyMirror,
        contactRowHtml,
        editorHtml,
        renderEditor,
        collectContacts,
        bindEditor
    };
}
