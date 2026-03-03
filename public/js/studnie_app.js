/* ===== AUTH HELPER ===== */
let currentUser = null;

function getAuthToken() { return localStorage.getItem('authToken'); }
function authHeaders(extra = {}) {
    const token = getAuthToken();
    const headers = { 'Content-Type': 'application/json', ...extra };
    if (token) headers['X-Auth-Token'] = token;
    return headers;
}
function appLogout() {
    fetch('/api/auth/logout', { method: 'POST', headers: authHeaders() }).catch(() => { });
    localStorage.removeItem('authToken');
    window.location.href = 'index.html';
}

/* ===== GLOBALS ===== */
let offers = [];
let editingOfferId = null;

// The main data structure for the current offer
// Instead of simple items, it's an array of well "rows"
let currentWells = [];
let wellIdCounter = 1;

// Modals State
let activeModalWellId = null;

window.toggleCard = function (contentId, iconId) {
    const content = document.getElementById(contentId);
    const icon = document.getElementById(iconId);
    if (content && icon) {
        content.classList.toggle('hidden');
        icon.textContent = content.classList.contains('hidden') ? '🔽' : '🔼';
    }
};

/* ===== INIT ===== */
document.addEventListener('DOMContentLoaded', async () => {
    // Auth Check
    const token = getAuthToken();
    if (!token) { window.location.href = 'index.html'; return; }
    try {
        const authRes = await fetch('/api/auth/me', { headers: authHeaders() });
        const authData = await authRes.json();
        if (!authData.user) { window.location.href = 'index.html'; return; }
        currentUser = authData.user;
    } catch (e) { window.location.href = 'index.html'; return; }

    const userEl = document.getElementById('header-username');
    const roleEl = document.getElementById('header-role-badge');
    if (userEl) userEl.textContent = '👤 ' + currentUser.username;
    if (roleEl) {
        roleEl.textContent = currentUser.role === 'admin' ? 'ADMIN' : 'USER';
        roleEl.style.background = currentUser.role === 'admin' ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.15)';
        roleEl.style.color = currentUser.role === 'admin' ? '#f59e0b' : '#60a5fa';
        roleEl.style.border = currentUser.role === 'admin' ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(59,130,246,0.3)';
    }

    document.getElementById('offer-date').valueAsDate = new Date();
    document.getElementById('offer-number').value = 'OFE/' + new Date().getFullYear() + '/' + Math.floor(Math.random() * 10000);

    setupNavigation();

    try {
        const res = await fetch('/api/studnie-offers', { headers: authHeaders() });
        if (res.ok) {
            const json = await res.json();
            offers = json.data || [];
        }
    } catch (e) { }

    renderSavedOffers();
    renderGrid(); // Render empty grid
});

/* ===== NAVIGATION ===== */
function setupNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => showSection(btn.dataset.section));
    });
}
function showSection(id) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('section-' + id)?.classList.add('active');
    document.querySelector(`.nav-btn[data-section="${id}"]`)?.classList.add('active');
}

/* ===== TOAST ===== */
function showToast(msg, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = msg;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(100%)'; setTimeout(() => toast.remove(), 300); }, 2500);
}

function fmt(n) { return n == null ? '—' : Number(n).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

/* ===== GRID LOGIC ===== */

function createEmptyWell(dn = 'DN1000') {
    return {
        _id: wellIdCounter++,
        name: 'S' + wellIdCounter,
        rzTerenu: '',
        rzDna: '',
        h: '',
        dn: dn,
        manholeH: 0.15,
        elements: {}, // { 'item-id': qty }
        bottom: {
            h: 500,
            type: 'UTH',
            concreteClass: 'standard',
            price: 0
        },
        discount: 0,
        netto: 0,
        weight: 0
    };
}

window.addWellRow = function (dn = 'DN1000') {
    currentWells.push(createEmptyWell(dn));
    renderGrid();
}

window.clearAllWells = function () {
    if (confirm('Na pewno wyczyścić arkusz?')) {
        currentWells = [];
        wellIdCounter = 1;
        renderGrid();
    }
}

window.removeWellRow = function (id) {
    currentWells = currentWells.filter(w => w._id !== id);
    if (currentWells.length === 0) {
        renderGrid();
    } else {
        renderGrid();
        recalcAll();
    }
}

function getWell(id) {
    return currentWells.find(w => w._id === id);
}

// UI Handlers
window.updateWellField = function (id, field, val, isElement = false) {
    const w = getWell(id);
    if (!w) return;

    if (isElement) {
        w.elements[field] = parseInt(val) || 0;
    } else if (field === 'rzTerenu' || field === 'rzDna' || field === 'h') {
        const num = parseFloat(val);
        w[field] = isNaN(num) ? '' : num;
        if (field === 'rzTerenu' || field === 'rzDna') {
            if (w.rzTerenu !== '' && w.rzDna !== '') {
                w.h = parseFloat((w.rzTerenu - w.rzDna).toFixed(2));
            }
        }
    } else if (field === 'manholeH') {
        if (val === 'Brak') w.manholeH = 0;
        else if (val === '11 cm') w.manholeH = 0.11;
        else w.manholeH = 0.15;
    } else if (field === 'discount') {
        w[field] = parseFloat(val) || 0;
    } else if (field === 'bottomH') {
        w.bottom.h = parseInt(val) || 500;
    } else {
        w[field] = val;
    }

    recalcWell(w);
    updateSummary();
}

let spreadsheetTabs = [];

function renderGrid() {
    currentWells.forEach(w => recalcWell(w));
    updateSummary();

    const container = document.getElementById('spreadsheet-container');
    if (!container) return;

    // Group wells by DN
    const wellsByDN = {
        'DN1000': [], 'DN1200': [], 'DN1500': [], 'DN2000': []
    };
    currentWells.forEach(w => {
        if (wellsByDN[w.dn]) wellsByDN[w.dn].push(w);
    });

    const worksheets = [];

    ['DN1000', 'DN1200', 'DN1500', 'DN2000'].forEach(dn => {
        const productRef = STUDNIE_DATA[dn]?.nadbudowa || [];
        const baseColumns = [
            { type: 'text', title: 'Lp.', width: 50, readOnly: true },
            { type: 'text', title: 'Nr.', width: 80 },
            { type: 'numeric', title: 'Rz. włazu', width: 100 },
            { type: 'numeric', title: 'Rz. dna', width: 100 },
            { type: 'numeric', title: 'Wys. H', width: 80, readOnly: true },
            { type: 'dropdown', title: 'Właz', width: 100, source: ['15 cm', '11 cm', 'Brak'] }
        ];

        const dynColumns = productRef.filter(p => p.name && p.name !== 'Waga całkowita').map(p => {
            return {
                type: 'numeric',
                title: p.name,
                width: 90,
                itemId: p.id // custom prop to identify
            };
        });

        const endColumns = [
            { type: 'numeric', title: 'Dennica H(mm)', width: 120 },
            { type: 'numeric', title: 'Rabat (%)', width: 80 },
            { type: 'text', title: 'Cena Netto', width: 120, readOnly: true },
            { type: 'text', title: 'Akcje', width: 100, readOnly: true }
        ];

        const cols = [...baseColumns, ...dynColumns, ...endColumns];

        const data = wellsByDN[dn].map((w, index) => {
            const manholeStr = w.manholeH === 0.15 ? '15 cm' : (w.manholeH === 0.11 ? '11 cm' : 'Brak');
            const row = [
                index + 1,
                w.name,
                w.rzTerenu,
                w.rzDna,
                w.h,
                manholeStr
            ];

            // Map dynamic items
            dynColumns.forEach(c => {
                row.push(w.elements[c.itemId] || '');
            });

            row.push(w.bottom.h || 500);
            row.push(w.discount);
            row.push(fmt(w.netto) + ' PLN');
            row.push("📋 Skopiuj / ❌ Usuń");

            // Hidden well ID to track mutations
            row.push(w._id);
            return row;
        });

        // Push empty row if none
        if (data.length === 0) {
            data.push(Array(cols.length).fill(''));
        }

        worksheets.push({
            worksheetName: dn,
            data: data,
            columns: cols,
            updateTable: function (instance, cell, col, row, val, label, cellName) {
                if (row % 2) cell.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
                if (col == cols.length - 1) {
                    cell.style.color = '#f87171';
                    cell.style.cursor = 'pointer';
                    cell.style.fontSize = '0.7rem';
                }
                const dynCount = dynColumns.length;
                if (col > 5 && col < 6 + dynCount) {
                    if (val > 0) {
                        cell.style.color = '#10b981';
                        cell.style.fontWeight = 'bold';
                    }
                }
            }
        });
    });

    window.ignoreGridChange = true;
    container.innerHTML = ''; // reset since jspreadsheet worksheets replace it entirely

    renderTabs(worksheets, container);
}

let activeGridDn = 'DN1000';
let activeJssInstance = null;

function renderTabs(worksheets, container) {
    const tabsHtml = `
        <div style="display:flex; gap:0.5rem; margin-bottom: 0.5rem; border-bottom: 1px solid var(--border-glass); padding-bottom:0.5rem;">
            ${worksheets.map(w => `<button class="tab-btn ${activeGridDn === w.worksheetName ? 'active' : ''}" onclick="switchGridTab('${w.worksheetName}')">${w.worksheetName}</button>`).join('')}
            <button class="btn btn-primary btn-sm" onclick="addWellRow('${activeGridDn}')" style="margin-left:auto;">➕ Dodaj Studnię ${activeGridDn}</button>
        </div>
        <div id="grid-sheet"></div>
    `;
    container.innerHTML = tabsHtml;

    const sheetData = worksheets.find(w => w.worksheetName === activeGridDn);

    activeJssInstance = jspreadsheet(document.getElementById('grid-sheet'), {
        data: sheetData.data,
        columns: sheetData.columns,
        updateTable: sheetData.updateTable,
        onchange: function (instance, cell, col, row, value) {
            if (window.ignoreGridChange) return;
            // The last hidden column is wellId
            const wellId = instance.jexcel.options.data[row][sheetData.columns.length];
            if (!wellId) return;

            col = Number(col);
            const w = getWell(wellId);
            if (!w) return;

            const dynStart = 6;
            const dynEnd = dynStart + (sheetData.columns.length - 10); // minus base and end cols

            if (col === 1) window.updateWellField(wellId, 'name', value);
            else if (col === 2) window.updateWellField(wellId, 'rzTerenu', value);
            else if (col === 3) window.updateWellField(wellId, 'rzDna', value);
            else if (col === 5) window.updateWellField(wellId, 'manholeH', value);
            else if (col >= dynStart && col < dynEnd) {
                const itemId = sheetData.columns[col].itemId;
                window.updateWellField(wellId, itemId, value, true);
            } else if (col === dynEnd) window.updateWellField(wellId, 'bottomH', value);
            else if (col === dynEnd + 1) window.updateWellField(wellId, 'discount', value);

            // Re-render to update formulas visually
            recalcWell(w);
            updateSummary();

            // Just update the readonly price cell visually without a full re-render
            const priceCellName = jspreadsheet.helpers.getColumnNameFromId([dynEnd + 2, row]);
            window.ignoreGridChange = true;
            instance.jexcel.setValue(priceCellName, fmt(w.netto) + ' PLN');
            window.ignoreGridChange = false;
        }
    });

    window.ignoreGridChange = false;

    document.getElementById('grid-sheet').addEventListener('mousedown', function (e) {
        const td = e.target.closest('td');
        if (!td) return;
        const x = parseInt(td.getAttribute('data-x'));
        const y = parseInt(td.getAttribute('data-y'));
        if (isNaN(x) || isNaN(y)) return;

        if (x === sheetData.columns.length - 1) { // Akcje
            const wellId = activeJssInstance.options.data[y][sheetData.columns.length];
            if (!wellId) return;
            const action = prompt(`Wpisz 'K' aby skopiować studnię, lub 'U' aby usunąć:`, 'K');
            if (action && action.toUpperCase() === 'K') {
                copyWell(wellId);
            } else if (action && action.toUpperCase() === 'U') {
                if (confirm(`Na pewno usunąć studnię?`)) removeWellRow(wellId);
            }
        }
    });
}

window.switchGridTab = function (dn) {
    activeGridDn = dn;
    renderGrid();
}


window.closeModal = function (id) {
    document.getElementById(id).classList.remove('active');
}

// 1. RINGS
window.openRingsModal = function (wellId) {
    activeModalWellId = wellId;
    const w = getWell(wellId);

    window.closeModal = function (id) {
        document.getElementById(id).classList.remove('active');
    }

    // ==== WELL COPY ====
    window.copyWell = function (id) {
        const w = getWell(id);
        if (w) {
            const copy = JSON.parse(JSON.stringify(w));
            copy._id = wellIdCounter++;
            copy.name += ' (Kopia)';
            currentWells.push(copy);
            renderGrid();
        }
    }

    // ==== CALCULATIONS ====
    function recalcAll() {
        currentWells.forEach(w => recalcWell(w));
        updateSummary();
    }

    function recalcWell(w) {
        let netto = 0;
        let weight = 0;

        const data = STUDNIE_DATA[w.dn];
        if (!data) return;

        const elementsPricelist = data.nadbudowa;
        const botData = data.bottom;

        // 1. Elements (from dictionary)
        for (const [itemId, qty] of Object.entries(w.elements || {})) {
            if (qty > 0) {
                const item = elementsPricelist.find(x => x.id === itemId);
                if (item) {
                    netto += item.price * qty;
                    weight += item.weight * qty;
                }
            }
        }

        // 2. Bottom Base
        let botPrice = 0;
        let botWeight = 0;
        if (botData) {
            const hIdx = botData.heights.indexOf(w.bottom.h);
            if (hIdx >= 0) {
                botPrice = botData.basePrices[hIdx] || 0;
                botWeight = botData.weights[hIdx] || 0;

                if (w.bottom.concreteClass === 'zelbet') botPrice += botData.zelbetSurcharge[hIdx] || 0;
                else if (w.bottom.concreteClass === 'nierdzewka') botPrice += botData.stainlessSurcharge[hIdx] || 0;
                else if (w.bottom.concreteClass === 'klasa_s') botPrice += botData.classSurcharge[hIdx] || 0;
            }
        }
        netto += botPrice;
        weight += botWeight;
        w.bottom.price = botPrice; // saved for summary render
        w.netto = netto;
        w.weight = weight;

        // Update live DOM visually
        const priceEl = document.getElementById(`well-${w._id}-price`);
        if (priceEl) priceEl.textContent = fmt(netto);
    }

    window.updateSummary = function () {
        let totalNetto = 0;
        let totalWeight = 0;

        currentWells.forEach(w => {
            totalNetto += w.netto;
            totalWeight += w.weight;
        });

        const transKm = parseFloat(document.getElementById('transport-km').value) || 0;
        const transRate = parseFloat(document.getElementById('transport-rate').value) || 0;

        const TONS_CAPACITY = 24000;
        const numVehicles = Math.ceil(totalWeight / TONS_CAPACITY);
        const transportTotal = numVehicles * (transKm * transRate);

        const summaryTotalNetto = totalNetto + transportTotal;
        const summaryTotalBrutto = summaryTotalNetto * 1.23;

        document.getElementById('sum-netto-products').textContent = fmt(totalNetto) + ' PLN';
        document.getElementById('sum-transport-cost').textContent = fmt(transportTotal) + ' PLN';
        document.getElementById('sum-total-netto').textContent = fmt(summaryTotalNetto) + ' PLN';

        document.getElementById('sum-transport-details').innerHTML =
            `${numVehicles} kurs(ów) × ${fmt(transKm * transRate)} PLN<br><span style="color:var(--text-muted);font-size:0.7rem">Masa całkowita: ${fmt(totalWeight)} kg</span>`;
        document.getElementById('sum-brutto-details').textContent = `Brutto: ${fmt(summaryTotalBrutto)} PLN`;
    }

    /* ==== SAVING OFFER ==== */

    window.saveOffer = async function () {
        if (currentWells.length === 0) {
            showToast('Oferta jest pusta', 'error');
            return;
        }

        const clientName = document.getElementById('client-name').value;
        if (!clientName) {
            showToast('Brak nazwy klienta', 'error');
            return;
        }

        const offerObj = {
            id: editingOfferId || 'OFE-' + Date.now(),
            dateStr: document.getElementById('offer-date').value,
            number: document.getElementById('offer-number').value,
            client: {
                name: clientName,
                nip: document.getElementById('client-nip').value,
                address: document.getElementById('client-address').value,
                contact: document.getElementById('client-contact').value
            },
            invest: {
                name: document.getElementById('invest-name').value,
                address: document.getElementById('invest-address').value
            },
            transport: {
                km: document.getElementById('transport-km').value,
                rate: document.getElementById('transport-rate').value
            },
            notes: document.getElementById('offer-notes').value,
            wells: currentWells, // Instead of items
            timestamp: Date.now()
        };

        let idx = offers.findIndex(o => o.id === offerObj.id);
        if (idx >= 0) offers[idx] = offerObj;
        else offers.push(offerObj);

        try {
            await fetch('/api/studnie-offers', { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ data: offers }) });
            showToast('Oferta zapisana');
            renderSavedOffers();
        } catch (e) {
            showToast('Zapisano lokalnie w RAM', 'success');
        }
    }

    window.loadOffer = function (id) {
        const o = offers.find(x => x.id === id);
        if (!o) return;

        editingOfferId = o.id;
        document.getElementById('offer-date').value = o.dateStr || '';
        document.getElementById('offer-number').value = o.number || '';
        document.getElementById('client-name').value = o.client.name || '';
        document.getElementById('client-nip').value = o.client.nip || '';
        document.getElementById('client-address').value = o.client.address || '';
        document.getElementById('client-contact').value = o.client.contact || '';
        document.getElementById('invest-name').value = o.invest?.name || '';
        document.getElementById('invest-address').value = o.invest?.address || '';
        document.getElementById('transport-km').value = o.transport?.km || 100;
        document.getElementById('transport-rate').value = o.transport?.rate || 10;
        document.getElementById('offer-notes').value = o.notes || '';

        currentWells = JSON.parse(JSON.stringify(o.wells || []));

        // Find highest _id to avoid collision
        let maxId = 0;
        currentWells.forEach(w => { if (w._id > maxId) maxId = w._id; });
        wellIdCounter = maxId + 1;

        renderGrid();
        showSection('offer');
    }

    window.clearOfferForm = function () {
        editingOfferId = null;
        document.getElementById('client-name').value = '';
        document.getElementById('client-nip').value = '';
        document.getElementById('client-address').value = '';
        document.getElementById('client-contact').value = '';
        document.getElementById('invest-name').value = '';
        document.getElementById('invest-address').value = '';
        document.getElementById('offer-number').value = 'OFE/' + new Date().getFullYear() + '/' + Math.floor(Math.random() * 10000);
        document.getElementById('offer-notes').value = '';

        currentWells = [];
        wellIdCounter = 1;
        renderGrid();
    }

    function renderSavedOffers() {
        const list = document.getElementById('saved-offers-list');
        if (!list) return;

        if (offers.length === 0) {
            list.innerHTML = `<div style="padding:2rem;text-align:center;color:var(--text-muted)">Brak zapisanych ofert</div>`;
            return;
        }

        const sorted = [...offers].sort((a, b) => b.timestamp - a.timestamp);
        let html = '';
        sorted.forEach(o => {
            const wellsCount = o.wells ? o.wells.length : 0;
            html += `
        <div class="card" style="margin-bottom:0.8rem; padding: 1rem; display:flex; justify-content:space-between; align-items:center;">
            <div>
                <div style="font-weight:600">${o.number || 'Bez numeru'} - ${o.client.name}</div>
                <div style="font-size:0.8rem; color:var(--text-muted)">${o.dateStr} | ${wellsCount} studni</div>
            </div>
            <div style="display:flex; gap:0.5rem;">
                <button class="btn btn-secondary btn-sm" onclick="loadOffer('${o.id}')">Edytuj</button>
                <button class="btn btn-secondary btn-sm" style="color:#f87171" onclick="deleteOffer('${o.id}')">Usuń</button>
            </div>
        </div>
        `;
        });
        list.innerHTML = html;
    }

    window.deleteOffer = async function (id) {
        if (!confirm("Na pewno usunąć?")) return;
        offers = offers.filter(x => x.id !== id);
        try {
            await fetch('/api/studnie-offers', { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ data: offers }) });
            showToast('Oferta usunięta');
        } catch (e) { }
        if (editingOfferId === id) clearOfferForm();
        renderSavedOffers();
    }

