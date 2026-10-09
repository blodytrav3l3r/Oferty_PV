// @ts-check
/**
 * Shared Client Manager — wspólny moduł zarządzania bazą klientów.
 * Eliminuje duplikację kodu klientów z app.js (Rury) i offerManager.js (Studnie).
 *
 * Zależności globalne:
 *  - clientsDb (Array) — globalna tablica klientów
 *  - saveClientsDbData(data) — zapis do API
 *  - showToast(msg, type) — powiadomienia (shared/ui.js)
 *  - appConfirm(msg, opts) — modal potwierdzenia (shared/ui.js)
 *  - closeModal() — zamknięcie modala (shared/ui.js)
 */

/* ===== STAN MODUŁU ===== */
let editingClientId = null;

/* ===== KATALOG KONTAKTÓW (N osób per klient) ===== */
// Cache list per klient: {list:[{id,name,phone,email,position,isPrimary}], ok}
// Snapshot oferty (blob clientContacts[]) zostaje SSoT oferty; katalog to podpowiedź.
const clientContactsCache = {};
const MAX_CATALOG_CONTACTS = 10;

/**
 * Lista do wyświetlenia: cache katalogu albo fallback mirror legacy
 * z rozcięciem "Jan, 600" (telefon siedział w jednym stringu).
 */
function catalogDisplayList(c) {
    const cached = clientContactsCache[c.id];
    if (cached && cached.ok && cached.list.length > 0) return cached.list;
    let name = c.contact || '';
    let phone = c.phone || '';
    try {
        const CC = window.ClientContacts;
        if (!phone && name && CC && typeof CC.parseLegacyMirror === 'function') {
            const p = CC.parseLegacyMirror(name)[0];
            if (p && (p.name || p.phone)) {
                name = p.name || name;
                phone = p.phone || '';
            }
        }
    } catch (_e) {
        // pasywnie — pełny string w jednej linii
    }
    if (!name && !phone && !(c.email || '')) return [];
    return [{ id: null, name, phone, email: c.email || '', position: '', isPrimary: true }];
}

function newContactId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return 'cc_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

// Stabilne id PRZED pierwszym sync (retry tym samym payloadem = upsert, nie duplikaty).
function ensureContactIds(list) {
    if (!Array.isArray(list)) return list;
    for (const r of list) {
        if (r && typeof r === 'object' && !r.id) r.id = newContactId();
    }
    return list;
}

/**
 * Pobiera kontakty klienta (cache; nigdy nie rzuca).
 * @param {string} clientId
 * @param {boolean} [force]
 * @returns {Promise<{list:Array, ok:boolean}>}
 */
async function fetchClientContacts(clientId, force) {
    const hit = clientContactsCache[clientId];
    if (hit && !force) return hit;
    try {
        const res = await fetch(`/api/clients/${encodeURIComponent(clientId)}/contacts`, {
            headers: authHeaders(),
            credentials: 'same-origin'
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const entry = { list: Array.isArray(json.items) ? json.items : [], ok: true };
        clientContactsCache[clientId] = entry;
        return entry;
    } catch (e) {
        logger.error('clientManager', 'fetchClientContacts error:', e);
        return { list: [], ok: false };
    }
}

async function prefetchAllClientContacts() {
    if (!Array.isArray(clientsDb) || clientsDb.length === 0) return;
    await Promise.allSettled(
        clientsDb.filter((c) => c && c.id).map((c) => fetchClientContacts(String(c.id)))
    );
}

/**
 * PUT sync pełnego zestawu (brak na liście = usuń). Fetch-fail = blokada, nigdy [].
 * @returns {Promise<{ok:boolean, updatedAt?:string, error?:string, status?:number}>}
 */
async function syncClientContacts(clientId, rows, baseUpdatedAt) {
    const body = { contacts: rows };
    if (baseUpdatedAt) body.clientUpdatedAt = baseUpdatedAt;
    try {
        const res = await fetch(`/api/clients/${encodeURIComponent(clientId)}/contacts/sync`, {
            method: 'PUT',
            headers: { ...authHeaders(), 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(body)
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
            return {
                ok: false,
                status: res.status,
                error: json.error || `HTTP ${res.status}`,
                updatedAt: json.updatedAt
            };
        }
        clientContactsCache[clientId] = { list: rows, ok: true };
        return { ok: true, updatedAt: json.updatedAt };
    } catch (e) {
        logger.error('clientManager', 'syncClientContacts error:', e);
        return { ok: false, error: e.message || 'błąd sieci' };
    }
}

/* ===== BEZPIECZEŃSTWO ===== */
// escapeHtml dostarczany przez shared/ui.js (ładowany wcześniej)

/* ===== API KLIENTÓW ===== */
async function loadClientsDb() {
    try {
        const res = await fetchWithTimeout('/api/clients', { headers: authHeaders() });
        if (!res.ok) {
            const json = await res.json().catch(() => ({}));
            throw new Error(json.error || `HTTP ${res.status}`);
        }
        const json = await res.json();
        return json.data || [];
    } catch (err) {
        // Abort (timeout/nawigacja) to nie błąd — tło spróbuje ponownie, bez toasta.
        if (err && err.name === 'AbortError') return [];
        logger.error('clientManager', 'loadClientsDb error:', err);
        showToast('Błąd ładowania klientów: ' + (err.message || 'błąd sieci'), 'error');
        return [];
    }
}

/* ===== STABILNE ID (D-009) ===== */
// Serwer minci UUID per request dla wierszy bez id (clients.ts: docId =
// c.id || randomUUID) — retry/double-submit payloadu z id-less wierszami
// tworzył duplikaty. Mintujemy stabilne id PRZED pierwszym PUT (ten sam
// format co serwer: crypto.randomUUID, fallback jak w wellElemId.js),
// więc retry niesie te same ids → upsert bez duplikatów. Idempotentne:
// istniejące id bez zmian; mutacja in-place stabilizuje też clientsDb.
function newClientId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return 'cl_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

function ensureClientIds(data) {
    if (!Array.isArray(data)) return data;
    for (const item of data) {
        if (!item || typeof item !== 'object') continue;
        if (!item.id) {
            item.id = newClientId();
        }
    }
    return data;
}

async function saveClientsDbData(data) {
    try {
        ensureClientIds(data);
        const res = await fetch('/api/clients', {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify({ data })
        });
        if (!res.ok) {
            const json = await res.json().catch(() => ({}));
            throw new Error(json.error || `HTTP ${res.status}`);
        }
        return true;
    } catch (err) {
        logger.error('clientManager', 'saveClientsDbData error:', err);
        showToast('Błąd zapisu klientów: ' + (err.message || 'błąd sieci'), 'error');
        return false;
    }
}

/**
 * Dokleja pełną listę osób z edytora oferty do katalogu (PUT sync).
 * Bez bazy updatedAt — wołane tuż po zapisie firmy (semantyka last-write-wins
 * jak batch PUT). Fetch-fail = toast, nigdy pusty sync.
 */
function syncOfferEditorToCatalog(clientId) {
    try {
        const box = document.getElementById('client-contacts');
        const CC = window.ClientContacts;
        if (!box || !CC || typeof CC.collectContacts !== 'function') return;
        const rows = ensureContactIds(
            CC.collectContacts(box).map((r) => ({
                name: r.name || '',
                phone: r.phone || '',
                email: r.email || '',
                position: '',
                isPrimary: false
            }))
        );
        const named = rows.filter((r) => r.name.trim() !== '');
        if (named.length === 0) return;
        if (named.length < rows.length)
            showToast('Pominięto osoby bez imienia (katalog wymaga nazwy)', 'warning');
        named[0].isPrimary = true;
        syncClientContacts(clientId, named, null).then((r) => {
            if (!r.ok) {
                showToast('Kontakty nie zapisane w katalogu: ' + (r.error || ''), 'warning');
                return;
            }
            const c = clientsDb.find((x) => x.id === clientId);
            if (c) {
                c.contact = named[0].name;
                c.phone = named[0].phone;
                c.email = named[0].email;
                if (r.updatedAt) c.updatedAt = r.updatedAt;
            }
        });
    } catch (_e) {
        // pasywnie — firma zapisana, kontakty zostaną w snapshocie oferty
    }
}

/* ===== ZAPIS KLIENTA Z FORMULARZA ===== */
function saveClientToDb() {
    const _saveBtn = document.querySelector('button[data-csp="saveClientToDb"]');
    if (_saveBtn) _saveBtn.disabled = true;
    // Odblokuj na KAŻDYM wyjściu — inaczej przycisk martwy po błędzie walidacji.
    const _unlockSaveBtn = () => {
        if (_saveBtn) _saveBtn.disabled = false;
    };

    const name = document.getElementById('client-name')?.value.trim() ?? '';
    const nip = document.getElementById('client-nip')?.value.trim() ?? '';
    const address = document.getElementById('client-address')?.value.trim() ?? '';
    const contact = document.getElementById('client-contact')?.value.trim() ?? '';
    const clientNumber = document.getElementById('client-number')?.value.trim() ?? '';
    // Pierwsza osoba z edytora → telefon/e-mail wiersza clients_rel.
    let contactPhone = '';
    let contactEmail = '';
    try {
        const box = document.getElementById('client-contacts');
        const CC = window.ClientContacts;
        if (box && CC) {
            const first = CC.collectContacts(box)[0];
            if (first) {
                contactPhone = first.phone || '';
                contactEmail = first.email || '';
            }
        }
    } catch (_e) {
        // pasywnie — wiersz zapisze się bez telefonu/e-maila
    }

    if (!name) {
        showToast('Wprowadź nazwę firmy, aby zapisać klienta', 'error');
        const nameEl = document.getElementById('client-name');
        const errEl = document.getElementById('err-client-name');
        if (nameEl) nameEl.setAttribute('aria-invalid', 'true');
        if (errEl) {
            errEl.textContent = 'Podaj nazwę firmy';
            errEl.hidden = false;
        }
        nameEl?.focus();
        _unlockSaveBtn();
        return;
    } else {
        document.getElementById('client-name')?.removeAttribute('aria-invalid');
        const err = document.getElementById('err-client-name');
        if (err) err.hidden = true;
    }

    if (nip) {
        const existingByNip = clientsDb.find((c) => c.nip === nip);
        if (existingByNip && existingByNip.name.toLowerCase() !== name.toLowerCase()) {
            showToast(`Firma z NIP ${nip} już istnieje w bazie danych`, 'error');
            _unlockSaveBtn();
            return;
        }
    }

    const existingIdx = clientsDb.findIndex((c) => c.name.toLowerCase() === name.toLowerCase());
    if (existingIdx >= 0) {
        appConfirm('Klient o takiej nazwie już istnieje. Zaktualizować dane?', {
            title: 'Aktualizacja klienta',
            type: 'warning'
        })
            .then((ok) => {
                if (ok) {
                    clientsDb[existingIdx] = {
                        ...clientsDb[existingIdx],
                        name,
                        nip,
                        address,
                        contact,
                        phone: contactPhone || clientsDb[existingIdx].phone || '',
                        email: contactEmail || clientsDb[existingIdx].email || '',
                        clientNumber,
                        updatedAt: new Date().toISOString()
                    };
                    saveClientsDbData(clientsDb);
                    syncOfferEditorToCatalog(clientsDb[existingIdx].id);
                    showToast('Zaktualizowano dane klienta', 'success');
                }
                _unlockSaveBtn();
            })
            .catch((e) => {
                _unlockSaveBtn();
                logger.error('clientManager', e);
            });
    } else {
        const newId = newClientId();
        clientsDb.push({
            id: newId,
            name,
            nip,
            address,
            contact,
            phone: contactPhone,
            email: contactEmail,
            clientNumber,
            createdAt: new Date().toISOString()
        });
        saveClientsDbData(clientsDb);
        syncOfferEditorToCatalog(newId);
        showToast('Zapisano nowego klienta', 'success');
        if (_saveBtn) _saveBtn.disabled = false;
    }
}

/* ===== MODAL BAZY KLIENTÓW ===== */
function showClientsDb() {
    showModal({
        id: 'clients-db-modal',
        onClose: () => {
            // Sync guard: edycja w toku — użytkownik anuluje ją ręcznie
            if (editingClientId) return false;
        },
        html: `
    <div class="modal modal--clients">
      <div class="modal-header">
        <h3><i data-lucide="folder-open"></i> Baza klientów <span class="text-muted">(${clientsDb.length})</span></h3>
        <button class="btn-icon" aria-label="Zamknij" data-csp="closeModal" data-csp-args="[]"><i data-lucide="x" aria-hidden="true"></i></button>
      </div>
      <div class="clients-search">
        <div class="clients-search-row">
          <div class="clients-search-field">
            <input type="text" id="clients-search-input" class="form-input" placeholder="Szukaj po nazwie, NIP, osobie lub telefonie..." data-csp="filterClientsDb" data-csp-args="[&quot;$value&quot;]" data-csp-on="input">
          </div>
        </div>
      </div>
      <div id="clients-db-list" class="modal-body"></div>
    </div>`
    });

    renderClientsDbList('');
    setTimeout(() => document.getElementById('clients-search-input')?.focus(), 100);
    // Kontakty katalogu dociągane w tle (display +N, search, picker); brak = fallback mirror.
    prefetchAllClientContacts().then(() => {
        const input = document.getElementById('clients-search-input');
        renderClientsDbList(input ? input.value : '');
    });
}

/* ===== FILTROWANIE ===== */
function filterClientsDb(query) {
    renderClientsDbList(query);
}

/* ===== EDYTOR KONTAKTÓW KATALOGU (N osób, .ccc-*) ===== */
// Osobny namespace niż edytor oferty (.cc-*): wiersz niesie id + stanowisko + ★.
function catalogEditorRow(container, clientId, r) {
    const row = document.createElement('div');
    row.className = 'ccc-row';
    if (r && r.id) row.setAttribute('data-ccc-id', r.id);

    const star = document.createElement('label');
    star.className = 'ccc-star';
    star.title = 'Główna osoba do kontaktu';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'ccc-primary-' + clientId;
    radio.checked = !!(r && r.isPrimary);
    radio.setAttribute('aria-label', 'Główna osoba do kontaktu');
    radio.onclick = (e) => e.stopPropagation();
    star.appendChild(radio);
    const starMark = document.createElement('span');
    starMark.textContent = '★';
    star.appendChild(starMark);
    row.appendChild(star);

    const mk = (field, type, ph, cls) => {
        const input = document.createElement('input');
        input.type = type;
        input.className = 'form-input form-input-sm' + (cls ? ' ' + cls : '');
        input.placeholder = ph;
        input.setAttribute('aria-label', ph);
        input.setAttribute('data-ccc', field);
        input.value = (r && r[field]) || '';
        if (field === 'name') input.maxLength = 200;
        if (field === 'phone') input.maxLength = 50;
        if (field === 'email') input.maxLength = 200;
        if (field === 'position') input.maxLength = 200;
        input.onclick = (e) => e.stopPropagation();
        return input;
    };
    row.appendChild(mk('name', 'text', 'Imię i nazwisko *', 'ccc-name'));
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'btn btn-sm btn-secondary';
    del.textContent = 'Usuń';
    del.setAttribute('aria-label', 'Usuń osobę');
    del.onclick = (e) => {
        e.stopPropagation();
        row.remove();
    };
    row.appendChild(del);
    row.appendChild(mk('phone', 'tel', 'Telefon'));
    row.appendChild(mk('email', 'email', 'E-mail', 'ccc-mail'));
    row.appendChild(mk('position', 'text', 'Stanowisko', 'ccc-pos'));
    container.appendChild(row);
    return row;
}

function renderCatalogEditor(container, clientId, list) {
    if (!container) return;
    container.innerHTML = '';
    const rows = document.createElement('div');
    rows.className = 'ccc-rows';
    const data = Array.isArray(list) && list.length > 0 ? list : [{}];
    data.forEach((r, i) => {
        // Domyślna ★ na pierwszej (mirror [0] przewidywalny).
        const row = r && typeof r === 'object' ? r : {};
        if (i === 0 && !data.some((x) => x && x.isPrimary)) row.isPrimary = true;
        catalogEditorRow(rows, clientId, row);
    });
    container.appendChild(rows);
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'btn btn-sm btn-secondary';
    add.textContent = 'Dodaj osobę';
    add.onclick = (e) => {
        e.stopPropagation();
        if (rows.querySelectorAll('[data-ccc-id], .ccc-row').length >= MAX_CATALOG_CONTACTS) {
            showToast('Maksymalnie ' + MAX_CATALOG_CONTACTS + ' osób', 'warning');
            return;
        }
        catalogEditorRow(rows, clientId, {});
    };
    container.appendChild(add);
}

function collectCatalogEditor(container, clientId) {
    const out = [];
    if (!container || typeof container.querySelectorAll !== 'function') return out;
    container.querySelectorAll('.ccc-row').forEach((row) => {
        const get = (k) => {
            const el = row.querySelector(`[data-ccc="${k}"]`);
            return el && typeof el.value === 'string' ? el.value.trim() : '';
        };
        // clientId to UUID/cc_* (bezpieczne znaki), bez CSS.escape.
        const radio = row.querySelector(`input[name="ccc-primary-${clientId}"]`);
        out.push({
            id: row.getAttribute('data-ccc-id') || null,
            name: get('name'),
            phone: get('phone'),
            email: get('email'),
            position: get('position'),
            isPrimary: !!(radio && radio.checked)
        });
    });
    // Puste wiersze wypadają (jak BE); ★ awaryjnie na pierwszą.
    const rows = out.filter((r) => r.name || r.phone || r.email || r.position);
    if (rows.length > 0 && !rows.some((r) => r.isPrimary)) rows[0].isPrimary = true;
    return rows;
}

/* ===== RENDEROWANIE LISTY ===== */
function renderClientsDbList(query) {
    const container = document.getElementById('clients-db-list');
    if (!container) return;

    const q = (query || '').toLowerCase().trim();
    const hitContact = (c) => {
        const hit = (v) => v && v.toLowerCase().includes(q);
        if (hit(c.contact) || hit(c.phone) || hit(c.email)) return true;
        const cached = clientContactsCache[c.id];
        return (
            !!cached &&
            cached.list.some((r) => hit(r.name) || hit(r.phone) || hit(r.email) || hit(r.position))
        );
    };
    const filtered = q
        ? clientsDb.filter(
              (c) =>
                  (c.name && c.name.toLowerCase().includes(q)) ||
                  (c.nip && c.nip.includes(q)) ||
                  (c.clientNumber && c.clientNumber.toLowerCase().includes(q)) ||
                  hitContact(c)
          )
        : clientsDb;
    const sorted = [...filtered].sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', 'pl', { sensitivity: 'base' })
    );

    if (clientsDb.length === 0) {
        container.innerHTML =
            '<div style="text-align:center; color:var(--text-muted); padding:3rem; font-size: var(--fs-xl);">Baza klientów jest pusta.<br><span class="fs-md">Zapisz klienta przyciskiem <i data-lucide="save"></i> w formularzu oferty.</span></div>';
        return;
    }

    if (filtered.length === 0) {
        container.innerHTML =
            '<div style="text-align:center; color:var(--text-muted); padding:2rem; font-size: var(--fs-lg);">Brak wyników dla „' +
            escapeHtml(q) +
            '"</div>';
        return;
    }

    const table = document.createElement('table');
    table.className = 'clients-table';

    const thead = document.createElement('thead');
    thead.innerHTML = `<tr>
        <th scope="col" style="width:84px;">Nr klienta</th>
        <th scope="col">Firma</th>
        <th scope="col" style="width:110px;">NIP</th>
        <th scope="col">Adres</th>
        <th scope="col">Kontakt</th>
        <th scope="col" class="td-center" style="width:108px;">Akcje</th>
    </tr>`;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');

    sorted.forEach((c) => {
        const tr = document.createElement('tr');
        tr.className =
            editingClientId === c.id ? 'clients-row clients-row--editing' : 'clients-row';

        if (editingClientId === c.id) {
            // Książka (1 osoba/firma): telefon/e-mail edytowane w komórce Kontakt.
            const fields = ['clientNumber', 'name', 'nip', 'address'];
            fields.forEach((field) => {
                const td = document.createElement('td');
                td.className = 'td-edit';
                const input = document.createElement('input');
                input.type = 'text';
                input.id = 'edit-client-' + field;
                input.className = 'form-input form-input-sm';
                input.value = c[field] || '';
                input.onclick = (e) => e.stopPropagation();
                td.appendChild(input);
                tr.appendChild(td);
            });
            // Edytor N-osób katalogu (imię/telefon/e-mail/stanowisko + ★).
            const contactTd = document.createElement('td');
            contactTd.className = 'td-edit';
            const cached = clientContactsCache[c.id];
            // Fallback mirror: łączony "Jan, 600" rozcinany jak w displayu.
            let legacySingle = {
                id: null,
                name: c.contact || '',
                phone: c.phone || '',
                email: c.email || '',
                position: '',
                isPrimary: true
            };
            try {
                const CC = window.ClientContacts;
                if (
                    !legacySingle.phone &&
                    legacySingle.name &&
                    CC &&
                    typeof CC.parseLegacyMirror === 'function'
                ) {
                    const p = CC.parseLegacyMirror(legacySingle.name)[0];
                    if (p && (p.name || p.phone)) {
                        legacySingle = {
                            ...legacySingle,
                            name: p.name || legacySingle.name,
                            phone: p.phone
                        };
                    }
                }
            } catch (_e) {
                // pasywnie — pełny string w polu nazwy
            }
            const editList = cached && cached.ok ? cached.list : [legacySingle];
            const edBox = document.createElement('div');
            edBox.id = 'edit-client-contacts';
            renderCatalogEditor(edBox, c.id, editList);
            contactTd.appendChild(edBox);
            tr.appendChild(contactTd);
            const actionTd = document.createElement('td');
            actionTd.className = 'td-edit td-actions';
            actionTd.innerHTML = `<button class="btn-icon btn-icon--accent" data-csp="saveEditedClientInDb" data-csp-args="${escapeHtmlAttr(JSON.stringify([c.id]))}" data-csp-stop="1" title="Zapisz" aria-label="Zapisz"><i data-lucide="save" aria-hidden="true"></i></button>
                <button class="btn-icon btn-icon--muted" data-csp="cancelEditClient" data-csp-args="[]" data-csp-stop="1" title="Anuluj" aria-label="Anuluj"><i data-lucide="x" aria-hidden="true"></i></button>`;
            tr.appendChild(actionTd);
        } else {
            const clientNumberTd = document.createElement('td');
            clientNumberTd.className = 'td-muted';
            clientNumberTd.textContent = c.clientNumber || '—';
            tr.appendChild(clientNumberTd);

            const nameTd = document.createElement('td');
            nameTd.className = 'td-name';
            nameTd.textContent = c.name;
            tr.appendChild(nameTd);

            const nipTd = document.createElement('td');
            nipTd.className = 'td-mono';
            nipTd.textContent = c.nip || '—';
            tr.appendChild(nipTd);

            const addrTd = document.createElement('td');
            addrTd.className = 'td-muted';
            addrTd.textContent = c.address || '—';
            tr.appendChild(addrTd);

            // Katalog N-osób: linia 1 primary/[0] + ★, linia 2 telefon,
            // reszta za "+N" (rozwijane). Fallback mirror legacy z rozcięciem.
            const contactTd = document.createElement('td');
            contactTd.className = 'td-muted td-contact';
            const list = catalogDisplayList(c);
            if (list.length === 0) {
                contactTd.textContent = '—';
            } else {
                const primary = list.find((r) => r.isPrimary) || list[0];
                const contactName = document.createElement('span');
                contactName.textContent = primary.name || '—';
                contactTd.appendChild(contactName);
                if (list.length > 1) {
                    const star = document.createElement('span');
                    star.className = 'td-sub';
                    star.textContent = '★ Główna';
                    contactTd.appendChild(star);
                }
                if (primary.phone) {
                    const contactPhone = document.createElement('span');
                    contactPhone.className = 'td-sub';
                    contactPhone.textContent = primary.phone;
                    contactTd.appendChild(contactPhone);
                }
                contactTd.title = list
                    .map(
                        (r) =>
                            r.name +
                            (r.phone ? ', ' + r.phone : '') +
                            (r.email ? ', ' + r.email : '')
                    )
                    .join(' | ');
                if (list.length > 1) {
                    const rest = list.length - 1;
                    const plus = document.createElement('button');
                    plus.type = 'button';
                    plus.className = 'btn btn-sm btn-secondary ccc-plus';
                    plus.textContent = '+' + rest;
                    plus.title = 'Pokaż wszystkie osoby';
                    plus.setAttribute('aria-label', 'Pokaż wszystkie osoby do kontaktu');
                    const full = document.createElement('div');
                    full.className = 'ccc-full';
                    full.hidden = true;
                    for (const r of list) {
                        const line = document.createElement('span');
                        line.className = 'td-sub';
                        line.textContent =
                            (r.isPrimary ? '★ ' : '') +
                            r.name +
                            (r.phone ? ' — ' + r.phone : '') +
                            (r.email ? ', ' + r.email : '') +
                            (r.position ? ' (' + r.position + ')' : '');
                        full.appendChild(line);
                    }
                    plus.onclick = (e) => {
                        e.stopPropagation();
                        full.hidden = !full.hidden;
                        plus.textContent = full.hidden ? '+' + rest : '−';
                    };
                    contactTd.appendChild(plus);
                    contactTd.appendChild(full);
                }
            }
            tr.appendChild(contactTd);

            const actionTd = document.createElement('td');
            actionTd.className = 'td-actions';
            actionTd.innerHTML = `<button class="btn-icon btn-icon--accent" data-csp="selectClientFromDb" data-csp-args="${escapeHtmlAttr(JSON.stringify([c.id]))}" data-csp-stop="1" title="Wczytaj do oferty" aria-label="Wczytaj do oferty"><i data-lucide="download" aria-hidden="true"></i></button>
                <button class="btn-icon btn-icon--dim" data-csp="editClientInDb" data-csp-args="${escapeHtmlAttr(JSON.stringify([c.id]))}" data-csp-stop="1" title="Edytuj" aria-label="Edytuj"><i data-lucide="pencil" aria-hidden="true"></i></button>
                <button class="btn-icon btn-icon--danger" data-csp="deleteClientFromDb" data-csp-args="${escapeHtmlAttr(JSON.stringify([c.id]))}" data-csp-stop="1" title="Usuń z bazy" aria-label="Usuń z bazy"><i data-lucide="x" aria-hidden="true"></i></button>`;
            tr.appendChild(actionTd);

            tr.title = 'Wczytaj do oferty';
            tr.onclick = () => selectClientFromDb(c.id);
        }

        tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    container.innerHTML = '';
    container.appendChild(table);
}

/* ===== INLINE EDIT ===== */
function editClientInDb(id) {
    editingClientId = id;
    const searchInput = document.getElementById('clients-search-input');
    renderClientsDbList(searchInput ? searchInput.value : '');
}

async function saveEditedClientInDb(id) {
    const name = document.getElementById('edit-client-name')?.value.trim() ?? '';
    const nip = document.getElementById('edit-client-nip')?.value.trim() ?? '';
    const address = document.getElementById('edit-client-address')?.value.trim() ?? '';
    const clientNumber = document.getElementById('edit-client-clientNumber')?.value.trim() ?? '';

    if (!name) {
        showToast('Wprowadź nazwę firmy', 'error');
        return;
    }

    const client = clientsDb.find((c) => c.id === id);
    if (!client) return;
    // Kontakty: pełny sync (nie batch firm). Imię wymagane (BE 400).
    const rows = ensureContactIds(
        collectCatalogEditor(document.getElementById('edit-client-contacts'), id)
    );
    for (let i = 0; i < rows.length; i++) {
        if (!rows[i].name) {
            showToast(`Osoba ${i + 1}: podaj imię i nazwisko`, 'error');
            return;
        }
        if (rows[i].email && !/.+@.+\..+/.test(rows[i].email)) {
            showToast(`Osoba ${i + 1}: nieprawidłowy adres e-mail`, 'error');
            return;
        }
    }
    const sync = await syncClientContacts(id, rows, client.updatedAt || null);
    if (!sync.ok) {
        if (sync.status === 409) {
            if (sync.updatedAt) client.updatedAt = sync.updatedAt;
            showToast(
                'Kontakty zmieniono w międzyczasie — sprawdź listę i zapisz ponownie',
                'warning'
            );
        } else {
            showToast('Błąd zapisu kontaktów: ' + (sync.error || ''), 'error');
        }
        return;
    }
    const primary = rows.find((r) => r.isPrimary) || rows[0] || null;
    client.name = name;
    client.nip = nip;
    client.address = address;
    client.contact = primary ? primary.name : '';
    client.phone = primary ? primary.phone : '';
    client.email = primary ? primary.email : '';
    client.clientNumber = clientNumber;
    client.updatedAt = sync.updatedAt || new Date().toISOString();
    editingClientId = null;
    await saveClientsDbData(clientsDb);
    showToast('Zaktualizowano dane klienta', 'success');
    const searchInput = document.getElementById('clients-search-input');
    renderClientsDbList(searchInput ? searchInput.value : '');
}

function cancelEditClient() {
    editingClientId = null;
    const searchInput = document.getElementById('clients-search-input');
    renderClientsDbList(searchInput ? searchInput.value : '');
}

/* ===== WYBÓR KLIENTA ===== */
function selectClientFromDb(id) {
    // Snapshot-vs-katalog: jawne "Wczytaj" nie nadpisuje brudnego
    // edytora oferty bez potwierdzenia (snapshot per-offer ma pierwszeństwo).
    if (typeof document !== 'undefined' && document.getElementById('app-confirm-overlay')) return;
    try {
        const box = document.getElementById('client-contacts');
        const CC = window.ClientContacts;
        if (box && CC && typeof CC.collectContacts === 'function') {
            const dirty = CC.collectContacts(box).some(
                (r) => (r.name || '').trim() || (r.phone || '').trim() || (r.email || '').trim()
            );
            if (dirty && typeof window.appConfirm === 'function') {
                // async guard — kontynuacja po potwierdzeniu
                window
                    .appConfirm(
                        'Edytor osób do kontaktu zawiera dane. Wczytać dane klienta z bazy (nadpisze kontakty oferty)?',
                        { title: 'Wczytaj klienta', type: 'warning' }
                    )
                    .then((ok) => {
                        if (ok) proceedSelectClient(id);
                    })
                    .catch((e) => logger.error('clientManager', 'Wczytywanie klienta:', e));
                return;
            }
        }
    } catch (_e) {
        // pasywnie — brak guarda, stare zachowanie
    }
    proceedSelectClient(id);
}

async function proceedSelectClient(id) {
    const res = await fetchClientContacts(id);
    if (!res.ok) showToast('Brak połączenia z katalogiem — wczytano podpowiedź z firmy', 'warning');
    const rows = res.ok ? res.list : [];
    // N osób → picker (wszystkie domyślnie zaznaczone); 1/0 → dotychczasowa ścieżka.
    if (rows.length > 1) {
        openContactPicker(id, rows);
        return;
    }
    selectClientFromDbForce(id, rows.slice(0, 1));
}

function openContactPicker(id, rows) {
    const c = clientsDb.find((client) => client.id === id);
    const esc = (v) => window.escapeHtml(String(v ?? ''));
    const items = rows
        .map(
            (r) =>
                `<label class="ccc-pick"><input type="checkbox" data-ccc-pick="${window.escapeHtmlAttr(r.id || '')}" checked />` +
                `<span>${esc(r.isPrimary ? '★ ' : '')}${esc(r.name)}${r.phone ? esc(' — ' + r.phone) : ''}${r.email ? esc(', ' + r.email) : ''}${r.position ? esc(' (' + r.position + ')') : ''}</span></label>`
        )
        .join('');
    const overlay = showModal({
        id: 'client-contact-picker',
        html:
            `<div class="modal"><h3>Wybierz osoby do oferty — ${esc(c ? c.name : '')}</h3>` +
            `<p class="text-muted fs-md">Do oferty trafiają tylko zaznaczone. Katalog trzyma wszystkie.</p>` +
            `<div class="ccc-picks">${items}</div>` +
            `<div class="fu-form-actions"><button type="button" class="btn btn-sm btn-primary" data-ccc-pick-ok>Wczytaj zaznaczone</button>` +
            `<button type="button" class="btn btn-sm btn-secondary" data-ccc-pick-cancel>Anuluj</button></div></div>`
    });
    overlay.querySelector('[data-ccc-pick-ok]').addEventListener('click', () => {
        const picked = [...overlay.querySelectorAll('[data-ccc-pick]:checked')]
            .map((cb) => rows.find((r) => r.id === cb.getAttribute('data-ccc-pick')))
            .filter(Boolean);
        if (picked.length === 0) {
            showToast('Zaznacz co najmniej jedną osobę', 'error');
            return;
        }
        closeModal('client-contact-picker');
        selectClientFromDbForce(id, picked);
    });
    overlay.querySelector('[data-ccc-pick-cancel]').addEventListener('click', () => {
        closeModal('client-contact-picker');
    });
}

function selectClientFromDbForce(id, picked) {
    const c = clientsDb.find((client) => client.id === id);
    if (c) {
        const nameEl = document.getElementById('client-name');
        const nipEl = document.getElementById('client-nip');
        const addrEl = document.getElementById('client-address');
        const contactEl = document.getElementById('client-contact');
        const numEl = document.getElementById('client-number');
        if (nameEl) nameEl.value = c.name || '';
        if (nipEl) nipEl.value = c.nip || '';
        if (addrEl) addrEl.value = c.address || '';
        if (contactEl) contactEl.value = c.contact || '';
        if (numEl) numEl.value = c.clientNumber || '';
        // Katalog → edytor oferty (tylko imię/telefon/e-mail; snapshot bez id/stanowiska).
        try {
            const box = document.getElementById('client-contacts');
            const CC = window.ClientContacts;
            if (box && CC) {
                let rows = Array.isArray(picked) && picked.length > 0 ? picked : null;
                if (!rows) {
                    const cached = clientContactsCache[id];
                    if (cached && cached.ok && cached.list.length > 0) rows = cached.list;
                    else {
                        let cand = {
                            name: c.contact || '',
                            phone: c.phone || '',
                            email: c.email || ''
                        };
                        if (
                            !cand.phone &&
                            cand.name &&
                            typeof CC.parseLegacyMirror === 'function'
                        ) {
                            const p = CC.parseLegacyMirror(cand.name)[0];
                            if (p && (p.name || p.phone))
                                cand = {
                                    name: p.name || cand.name,
                                    phone: p.phone,
                                    email: cand.email
                                };
                        }
                        rows = [cand];
                    }
                }
                const norm = CC.normalizeContacts(
                    rows.map((r) => ({
                        name: r.name || '',
                        phone: r.phone || '',
                        email: r.email || ''
                    }))
                );
                CC.renderEditor(
                    box,
                    norm.length > 0 ? norm : CC.parseLegacyMirror(c.contact || '')
                );
                CC.bindEditor(box);
            }
        } catch (_e) {
            // pasywnie — mirror w #client-contact już ustawiony
        }
        if (typeof updateStep1NextState === 'function') updateStep1NextState();
        showToast('Wczytano dane klienta', 'success');
        closeModal();
    }
}

/* ===== USUWANIE KLIENTA ===== */
async function deleteClientFromDb(id) {
    if (
        !(await appConfirm('Czy na pewno chcesz usunąć tego klienta z bazy?', {
            title: 'Usuwanie klienta',
            type: 'danger'
        }))
    )
        return;
    clientsDb = clientsDb.filter((c) => c.id !== id);
    delete clientContactsCache[id];
    saveClientsDbData(clientsDb);

    const searchInput = document.getElementById('clients-search-input');
    renderClientsDbList(searchInput ? searchInput.value : '');
    showToast('Klient usunięty z bazy', 'info');
}

/* ===== Rejestracja globali ===== */
window.saveClientToDb = saveClientToDb;
window.showClientsDb = showClientsDb;
window.filterClientsDb = filterClientsDb;
window.editClientInDb = editClientInDb;
window.saveEditedClientInDb = saveEditedClientInDb;
window.cancelEditClient = cancelEditClient;

/* ===== Rejestracja globali ===== */
window.loadClientsDb = loadClientsDb;
window.deleteClientFromDb = deleteClientFromDb;
window.ensureClientIds = ensureClientIds;
window.newClientId = newClientId;
window.selectClientFromDb = selectClientFromDb;
window.selectClientFromDbForce = selectClientFromDbForce;
window.renderClientsDbList = renderClientsDbList;
