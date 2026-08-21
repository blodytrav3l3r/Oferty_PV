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
        logger.error('clientManager', 'loadClientsDb error:', err);
        showToast('Błąd ładowania klientów: ' + (err.message || 'błąd sieci'), 'error');
        return [];
    }
}

async function saveClientsDbData(data) {
    try {
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

/* ===== ZAPIS KLIENTA Z FORMULARZA ===== */
function saveClientToDb() {
    const name = document.getElementById('client-name').value.trim();
    const nip = document.getElementById('client-nip').value.trim();
    const address = document.getElementById('client-address').value.trim();
    const contact = document.getElementById('client-contact').value.trim();
    const clientNumber = document.getElementById('client-number').value.trim();

    if (!name) {
        showToast('Wprowadź nazwę firmy, aby zapisać klienta', 'error');
        return;
    }

    if (nip) {
        const existingByNip = clientsDb.find((c) => c.nip === nip);
        if (existingByNip && existingByNip.name.toLowerCase() !== name.toLowerCase()) {
            showToast(`Firma z NIP ${nip} już istnieje w bazie danych`, 'error');
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
                        clientNumber,
                        updatedAt: new Date().toISOString()
                    };
                    saveClientsDbData(clientsDb);
                    showToast('Zaktualizowano dane klienta', 'success');
                }
            })
            .catch((e) => logger.error('clientManager', e));
    } else {
        clientsDb.push({
            id: Date.now().toString(),
            name,
            nip,
            address,
            contact,
            clientNumber,
            createdAt: new Date().toISOString()
        });
        saveClientsDbData(clientsDb);
        showToast('Zapisano nowego klienta', 'success');
    }
}

/* ===== MODAL BAZY KLIENTÓW ===== */
function showClientsDb() {
    showModal({
        id: 'clients-db-modal',
        html: `
    <div class="modal modal--clients">
      <div class="modal-header">
        <h3><i data-lucide="folder-open"></i> Baza klientów <span class="text-muted">(${clientsDb.length})</span></h3>
        <button class="btn-icon" aria-label="Zamknij" onclick="closeModal()"><i data-lucide="x" aria-hidden="true"></i></button>
      </div>
      <div class="clients-search">
        <div class="clients-search-row">
          <div class="clients-search-field">
            <input type="text" id="clients-search-input" class="form-input" placeholder="Szukaj po nazwie lub NIP..." oninput="filterClientsDb(this.value)">
          </div>
        </div>
      </div>
      <div id="clients-db-list" class="modal-body"></div>
    </div>`
    });

    renderClientsDbList('');
    setTimeout(() => document.getElementById('clients-search-input')?.focus(), 100);
}

/* ===== FILTROWANIE ===== */
function filterClientsDb(query) {
    renderClientsDbList(query);
}

/* ===== RENDEROWANIE LISTY ===== */
function renderClientsDbList(query) {
    const container = document.getElementById('clients-db-list');
    if (!container) return;

    const q = (query || '').toLowerCase().trim();
    const filtered = q
        ? clientsDb.filter(
              (c) =>
                  (c.name && c.name.toLowerCase().includes(q)) ||
                  (c.nip && c.nip.includes(q)) ||
                  (c.clientNumber && c.clientNumber.toLowerCase().includes(q))
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
    table.style.cssText = 'width:100%; border-collapse:collapse; font-size: var(--fs-lg);';

    const thead = document.createElement('thead');
    thead.innerHTML = `<tr style="border-bottom:2px solid var(--border); color:var(--text-muted); font-size: var(--fs-base); text-transform:uppercase; letter-spacing:0.5px;">
        <th scope="col" style="padding:0.5rem 0.8rem; text-align:left; font-weight: var(--fw-semibold); width:100px;">Nr klienta</th>
        <th scope="col" class="th-l-fw600">Firma</th>
        <th scope="col" style="padding:0.5rem 0.8rem; text-align:left; font-weight: var(--fw-semibold); width:130px;">NIP</th>
        <th scope="col" class="th-l-fw600">Adres</th>
        <th scope="col" class="th-l-fw600">Kontakt</th>
        <th scope="col" style="padding:0.5rem 0.8rem; text-align:center; font-weight: var(--fw-semibold); width:100px;">Akcje</th>
    </tr>`;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');

    sorted.forEach((c) => {
        const tr = document.createElement('tr');
        tr.style.cssText =
            'border-bottom:1px solid var(--border-glass); cursor:pointer; transition:background 0.15s;';
        tr.onmouseenter = () => {
            tr.style.background = 'rgba(var(--accent-rgb), 0.05)';
        };
        tr.onmouseleave = () => {
            tr.style.background = 'transparent';
        };

        if (editingClientId === c.id) {
            tr.style.background = 'rgba(var(--accent-rgb), 0.05)';
            const fields = ['clientNumber', 'name', 'nip', 'address', 'contact'];
            fields.forEach((field) => {
                const td = document.createElement('td');
                td.style.padding = '0.4rem 0.6rem';
                const input = document.createElement('input');
                input.type = 'text';
                input.id = 'edit-client-' + field;
                input.className = 'form-input form-input-sm';
                input.value = c[field] || '';
                input.style.width = '100%';
                input.onclick = (e) => e.stopPropagation();
                td.appendChild(input);
                tr.appendChild(td);
            });
            const actionTd = document.createElement('td');
            actionTd.style.cssText =
                'padding:0.4rem 0.6rem; text-align:center; white-space:nowrap;';
            actionTd.innerHTML = `<button class="btn-icon" onclick="event.stopPropagation(); saveEditedClientInDb('${escapeHtml(c.id)}')" title="Zapisz" aria-label="Zapisz" style="color:var(--accent); font-size: var(--fs-2xl);"><i data-lucide="save" aria-hidden="true"></i></button>
                <button class="btn-icon" onclick="event.stopPropagation(); cancelEditClient()" title="Anuluj" aria-label="Anuluj" style="color:var(--text-muted); font-size: var(--fs-lg);"><i data-lucide="x" aria-hidden="true"></i></button>`;
            tr.appendChild(actionTd);
        } else {
            const clientNumberTd = document.createElement('td');
            clientNumberTd.style.cssText =
                'padding:0.6rem 0.8rem; color:var(--text-muted); font-size: var(--fs-md);';
            clientNumberTd.textContent = c.clientNumber || '—';
            tr.appendChild(clientNumberTd);

            const nameTd = document.createElement('td');
            nameTd.style.cssText =
                'padding:0.6rem 0.8rem; font-weight: var(--fw-semibold); color:var(--text-primary);';
            nameTd.textContent = c.name;
            tr.appendChild(nameTd);

            const nipTd = document.createElement('td');
            nipTd.style.cssText =
                'padding:0.6rem 0.8rem; font-family:monospace; font-size: var(--fs-md); color:var(--text-secondary);';
            nipTd.textContent = c.nip || '—';
            tr.appendChild(nipTd);

            const addrTd = document.createElement('td');
            addrTd.style.cssText =
                'padding:0.6rem 0.8rem; color:var(--text-muted); font-size: var(--fs-md);';
            addrTd.textContent = c.address || '—';
            tr.appendChild(addrTd);

            const contactTd = document.createElement('td');
            contactTd.style.cssText =
                'padding:0.6rem 0.8rem; color:var(--text-muted); font-size: var(--fs-md);';
            contactTd.textContent = c.contact || '—';
            tr.appendChild(contactTd);

            const actionTd = document.createElement('td');
            actionTd.style.cssText =
                'padding:0.6rem 0.8rem; text-align:center; white-space:nowrap;';
            actionTd.innerHTML = `<button class="btn-icon" onclick="event.stopPropagation(); editClientInDb('${escapeHtml(c.id)}')" title="Edytuj" aria-label="Edytuj" style="color:var(--text-secondary); font-size: var(--fs-lg); opacity:0.8;"><i data-lucide="pencil" aria-hidden="true"></i></button>
                <button class="btn-icon" onclick="event.stopPropagation(); deleteClientFromDb('${escapeHtml(c.id)}')" title="Usuń z bazy" aria-label="Usuń z bazy" style="color:var(--danger); font-size: var(--fs-lg); opacity:0.6;" onmouseenter="this.style.opacity='1'" onmouseleave="this.style.opacity='0.6'"><i data-lucide="x" aria-hidden="true"></i></button>`;
            tr.appendChild(actionTd);

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

function saveEditedClientInDb(id) {
    const name = document.getElementById('edit-client-name').value.trim();
    const nip = document.getElementById('edit-client-nip').value.trim();
    const address = document.getElementById('edit-client-address').value.trim();
    const contact = document.getElementById('edit-client-contact').value.trim();
    const clientNumber = document.getElementById('edit-client-clientNumber').value.trim();

    if (!name) {
        showToast('Wprowadź nazwę firmy', 'error');
        return;
    }

    const client = clientsDb.find((c) => c.id === id);
    if (client) {
        client.name = name;
        client.nip = nip;
        client.address = address;
        client.contact = contact;
        client.clientNumber = clientNumber;
        client.updatedAt = new Date().toISOString();
        saveClientsDbData(clientsDb);
        showToast('Zaktualizowano dane klienta', 'success');
    }
    editingClientId = null;
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
    const c = clientsDb.find((client) => client.id === id);
    if (c) {
        document.getElementById('client-name').value = c.name || '';
        document.getElementById('client-nip').value = c.nip || '';
        document.getElementById('client-address').value = c.address || '';
        document.getElementById('client-contact').value = c.contact || '';
        document.getElementById('client-number').value = c.clientNumber || '';
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
