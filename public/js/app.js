/* ===== PRODUCT LENGTH (from ID pattern) ===== */
function getProductLength(id) {
  // ID format: XXX-X-DD-LL-XXX where LL = length in hundreds of mm
  // e.g. RTB-0-03-25-K00 → 25 → 2500mm, RGZ-2-14-30-BU → 30 → 3000mm
  const parts = id.split('-');
  if (parts.length >= 4) {
    const code = parseInt(parts[3]);
    if (!isNaN(code) && code >= 10) return code * 100; // mm
  }
  return null;
}

/* ===== PRODUCT DIAMETER (from ID pattern) ===== */
function getProductDiameter(id) {
  // ID format: XXX-X-DD-LL-XXX where DD = diameter code
  // e.g. RTB-0-03-25-K00 → 03 → DN 300, RTZ-2-12-25-K00 → 12 → DN 1200
  const parts = id.split('-');
  if (parts.length >= 3) {
    const code = parseInt(parts[2]);
    if (!isNaN(code) && code > 0) return code * 100; // mm
  }
  return null;
}

/* ===== PIPE INNER AREA AREA ===== */
function getPipeInnerArea(id) {
  const product = products.find(p => p.id === id);
  if (product && product.area != null) {
    return product.area;
  }

  const d = getProductDiameter(id);
  const l = getProductLength(id);
  if (!d || !l) return 0;

  if (id.startsWith('RJB') || id.startsWith('RJZ')) {
    // Jajowa - przybliżony obwód
    const h = d * 1.5;
    const perimeter = Math.PI * ((d + h) / 2) / 1000;
    return perimeter * (l / 1000);
  }
  return Math.PI * (d / 1000) * (l / 1000);
}

function isOneMetrePipe(id) {
  const len = getProductLength(id);
  return len === 1000;
}

/* ===== STORAGE HELPERS (REST API → server.js) ===== */
async function loadProducts() {
  try {
    const res = await fetch('/api/products');
    const json = await res.json();
    let saved = json.data;

    if (!saved) {
      // First run: seed server with defaults
      const data = JSON.parse(JSON.stringify(DEFAULT_PRODUCTS));
      await fetch('/api/products', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data }) });
      return data;
    }

    let modified = false;
    const savedIds = new Set(saved.map(p => p.id));

    DEFAULT_PRODUCTS.forEach(dp => {
      if (!savedIds.has(dp.id)) {
        saved.push(JSON.parse(JSON.stringify(dp)));
        modified = true;
      }
    });

    saved.forEach(sp => {
      const dp = DEFAULT_PRODUCTS.find(p => p.id === sp.id);
      if (dp) {
        if (sp.area === undefined || (sp.area === null && dp.area !== null)) { sp.area = dp.area; modified = true; }
        if (sp.category === undefined) { sp.category = dp.category; modified = true; }
        if (sp.transport === undefined) { sp.transport = dp.transport; modified = true; }
        if (sp.weight === undefined) { sp.weight = dp.weight; modified = true; }
      }
    });

    if (modified) {
      await fetch('/api/products', { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ data: saved }) });
    }

    return saved;
  } catch (err) {
    console.error('loadProducts error:', err);
    return JSON.parse(JSON.stringify(DEFAULT_PRODUCTS));
  }
}

async function saveProducts(data) {
  try {
    await fetch('/api/products', { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ data }) });
  } catch (err) { console.error('saveProducts error:', err); }
}

async function loadOffers() {
  try {
    const res = await fetch('/api/offers', { headers: authHeaders() });
    if (res.status === 401) { window.location.href = 'index.html'; return []; }
    const json = await res.json();
    return json.data || [];
  } catch (err) { console.error('loadOffers error:', err); return []; }
}

async function saveOffersData(data) {
  try {
    await fetch('/api/offers', { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ data }) });
  } catch (err) { console.error('saveOffersData error:', err); }
}

async function loadClientsDb() {
  try {
    const res = await fetch('/api/clients', { headers: authHeaders() });
    const json = await res.json();
    return json.data || [];
  } catch (err) { console.error('loadClientsDb error:', err); return []; }
}

async function saveClientsDbData(data) {
  try {
    await fetch('/api/clients', { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ data }) });
  } catch (err) { console.error('saveClientsDbData error:', err); }
}

/* ===== AUTH HELPER ===== */
let currentUser = null;

function getAuthToken() {
  return localStorage.getItem('authToken');
}

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
let products = [];
let offers = [];
let clientsDb = [];
let currentOfferItems = [];
let editingOfferId = null;
let isTransportBreakdownExpanded = false;

window.toggleTransportBreakdown = function () {
  isTransportBreakdownExpanded = !isTransportBreakdownExpanded;
  const content = document.getElementById('transport-breakdown-content');
  const icon = document.getElementById('transport-toggle-icon');
  if (content) {
    content.style.display = isTransportBreakdownExpanded ? 'block' : 'none';
    icon.textContent = isTransportBreakdownExpanded ? '🔼' : '🔽';
  }
};

window.toggleCard = function (contentId, iconId) {
  const content = document.getElementById(contentId);
  const icon = document.getElementById(iconId);
  if (content && icon) {
    content.classList.toggle('hidden');
    const isHidden = content.classList.contains('hidden');
    icon.textContent = isHidden ? '🔼' : '🔽';

    // Explicitly hide sticky elements inside that might escape overflow bounds
    const stickyEls = content.querySelectorAll('.offer-search-row, .catalog-tabs');
    stickyEls.forEach(el => {
      if (isHidden) el.classList.add('hidden');
      else el.classList.remove('hidden');
    });
  }
};

/* ===== INIT ===== */
document.addEventListener('DOMContentLoaded', async () => {
  // Check authentication
  const token = getAuthToken();
  if (!token) { window.location.href = 'index.html'; return; }
  try {
    const authRes = await fetch('/api/auth/me', { headers: authHeaders() });
    const authData = await authRes.json();
    if (!authData.user) { window.location.href = 'index.html'; return; }
    currentUser = authData.user;
  } catch (e) { window.location.href = 'index.html'; return; }

  // Display user info in header
  const userEl = document.getElementById('header-username');
  const roleEl = document.getElementById('header-role-badge');
  if (userEl) userEl.textContent = '👤 ' + currentUser.username;
  if (roleEl) {
    roleEl.textContent = currentUser.role === 'admin' ? 'ADMIN' : 'USER';
    roleEl.style.background = currentUser.role === 'admin' ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.15)';
    roleEl.style.color = currentUser.role === 'admin' ? '#f59e0b' : '#60a5fa';
    roleEl.style.border = currentUser.role === 'admin' ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(59,130,246,0.3)';
  }

  products = await loadProducts();
  offers = await loadOffers();
  clientsDb = await loadClientsDb();

  setupNavigation();
  renderPriceList();
  renderSavedOffers();
  setupOfferForm();

  const urlParams = new URLSearchParams(window.location.search);
  const tab = urlParams.get('tab');
  if (tab) {
    showSection(tab);
  } else {
    showSection('offer');
  }
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
  if (id === 'saved') renderSavedOffers();
  if (id === 'pricelist') renderPriceList();
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

/* ===== FORMAT ===== */
function fmt(n) { return n == null ? '—' : Number(n).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtInt(n) { return n == null ? '—' : Number(n).toLocaleString('pl-PL'); }

/* ===== PRICE LIST ===== */
function renderPriceList() {
  const container = document.getElementById('pricelist-body');
  const searchVal = document.getElementById('pricelist-search')?.value?.toLowerCase() || '';

  let html = `<div class="table-wrap">
    <table style="table-layout: fixed; width: 100%;">
      <thead>
        <tr>
          <th style="width: 15%;">Indeks</th>
          <th style="width: 35%;">Nazwa produktu</th>
          <th class="text-right" style="width: 12%;">Cena PLN</th>
          <th class="text-right" style="width: 10%;">Pole pow.<br><span style="font-size:0.7em">(m²)</span></th>
          <th class="text-right" style="width: 10%;">Szt./transp.</th>
          <th class="text-right" style="width: 10%;">Waga (kg)</th>
          <th class="text-center" style="width: 8%;">Akcje</th>
        </tr>
      </thead>`;

  let hasAnyItems = false;

  CATEGORIES.forEach(cat => {
    const items = products.filter(p => p.category === cat && (
      !searchVal || p.id.toLowerCase().includes(searchVal) || p.name.toLowerCase().includes(searchVal)
    ));
    if (items.length === 0 && searchVal) return;
    if (items.length === 0 && !searchVal) return; // Skip empty categories completely for cleaner layout

    hasAnyItems = true;

    html += `<tbody>
      <tr>
        <td colspan="7" style="padding: 0; border: none;">
          <div class="cat-header" style="margin: 1rem 0 0.4rem 0;">
            ${cat} <span class="cat-count">(${items.length} produktów)</span>
          </div>
        </td>
      </tr>`;

    items.forEach(p => {
      html += `<tr data-id="${p.id}">
        <td class="text-nowrap" style="overflow: hidden; text-overflow: ellipsis;"><code style="color:var(--accent-hover);font-size:.78rem" class="editable" onclick="editCell(this,'id','${p.id}')">${p.id}</code></td>
        <td style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"><span class="editable" onclick="editCell(this,'name','${p.id}')">${p.name}</span></td>
        <td class="text-right"><span class="editable" onclick="editCell(this,'price','${p.id}')">${fmt(p.price)}</span></td>
        <td class="text-right"><span class="editable" onclick="editCell(this,'area','${p.id}')">${p.area != null ? fmt(p.area) : '—'}</span></td>
        <td class="text-right"><span class="editable" onclick="editCell(this,'transport','${p.id}')">${p.transport != null ? fmtInt(p.transport) : '—'}</span></td>
        <td class="text-right"><span class="editable" onclick="editCell(this,'weight','${p.id}')">${p.weight != null ? fmtInt(p.weight) : '—'}</span></td>
        <td class="text-center" style="white-space:nowrap;">
          <button class="btn-icon" title="Powiel" onclick="copyProduct('${p.id}')">📋</button>
          <button class="btn-icon" title="Usuń" onclick="deleteProduct('${p.id}')">✕</button>
        </td>
      </tr>`;
    });

    html += `</tbody>`;
  });

  html += `</table></div>`;

  if (!hasAnyItems) {
    html = `<div style="padding: 2rem; text-align: center; color: var(--text-muted);">Brak wyników do wyświetlenia...</div>`;
  }

  container.innerHTML = html;
}

function editCell(el, field, id) {
  if (el.querySelector('input')) return;
  const product = products.find(p => p.id === id);
  const oldVal = product[field] ?? '';
  const input = document.createElement('input');
  input.type = (field === 'name' || field === 'id') ? 'text' : 'number';
  input.className = 'edit-input';
  input.value = oldVal;
  input.style.width = field === 'name' ? '100%' : (field === 'id' ? '120px' : '80px');
  el.textContent = '';
  el.appendChild(input);
  input.focus();
  input.select();

  let isSaving = false;
  const save = () => {
    if (isSaving) return;
    isSaving = true;

    const val = (field === 'name' || field === 'id') ? input.value.trim() : (input.value === '' ? null : Number(input.value));

    if (field === 'id') {
      if (!val) {
        showToast('Indeks nie może być pusty', 'error');
        renderPriceList();
        return;
      }
      if (val !== id && products.some(p => p.id === val)) {
        showToast('Taki indeks już istnieje', 'error');
        renderPriceList();
        return;
      }
    }

    product[field] = val;
    saveProducts(products);
    renderPriceList();
    renderOfferItems(); // Recalculate transport in case weight or capacity was changed
    showToast('Zaktualizowano cennik', 'success');
  };
  input.addEventListener('blur', save);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') renderPriceList(); });
}

function copyProduct(id) {
  const original = products.find(p => p.id === id);
  if (!original) return;

  const newId = original.id + '-KOP';
  let counter = 1;
  let finalId = newId;

  while (products.some(p => p.id === finalId)) {
    finalId = `${newId}${counter}`;
    counter++;
  }

  const copied = JSON.parse(JSON.stringify(original));
  copied.id = finalId;
  copied.name = copied.name + ' (Kopia)';

  const index = products.findIndex(p => p.id === id);
  products.splice(index + 1, 0, copied);

  saveProducts(products);
  renderPriceList();
  showToast('Produkt skopiowany', 'success');
}

function deleteProduct(id) {
  if (!confirm('Czy na pewno usunąć ten produkt z cennika?')) return;
  products = products.filter(p => p.id !== id);
  saveProducts(products);
  renderPriceList();
  showToast('Produkt usunięty', 'info');
}

async function resetPriceList() {
  try {
    const res = await fetch('/api/products/default');
    const json = await res.json();
    const customDefault = json.data;
    if (customDefault && customDefault.length > 0) {
      if (!confirm('Przywrócić cennik do Twojego zapisanego cennika domyślnego? Utracisz niezapisane i najnowsze zmiany.')) return;
      products = JSON.parse(JSON.stringify(customDefault));
    } else {
      if (!confirm('Brak zapisanego własnego cennika. Przywrócić do wartości fabrycznych producenta? Utracisz wszystkie zmiany.')) return;
      products = JSON.parse(JSON.stringify(DEFAULT_PRODUCTS));
    }
  } catch {
    if (!confirm('Przywrócić cennik do wartości fabrycznych? Utracisz wszystkie zmiany.')) return;
    products = JSON.parse(JSON.stringify(DEFAULT_PRODUCTS));
  }
  saveProducts(products);
  renderPriceList();
  showToast('Cennik przywrócony', 'info');
}

async function manuallySaveProductsDB() {
  if (!confirm('Czy na pewno chcesz zapisać aktualny cennik jako wartości fabryczne (do resetu)?')) return;
  try {
    saveProducts(products); // Zapis do bieżącej instancji
    await fetch('/api/products/default', { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ data: products }) });
    renderPriceList();
    renderTiles();
    showToast('Zapisano produkty jako wartości fabryczne', 'success');
  } catch (err) {
    showToast('Błąd zapisu jako wartości fabryczne', 'error');
  }
}

/* ===== EXCEL IMPORT / EXPORT ===== */
const RURY_EXPORT_COLUMNS = [
  { header: 'Indeks', key: 'id' },
  { header: 'Nazwa', key: 'name' },
  { header: 'Cena PLN', key: 'price' },
  { header: 'Kategoria', key: 'category' },
  { header: 'Waga (kg)', key: 'weight' },
  { header: 'K.Transp.', key: 'transport' },
  { header: 'Pow.Zewn.(m2)', key: 'area' }
];

const RURY_HEADER_TO_KEY = {};
RURY_EXPORT_COLUMNS.forEach(col => { RURY_HEADER_TO_KEY[col.header] = col.key; });

function exportRuryToExcel() {
  if (!products || products.length === 0) {
    showToast('Brak danych do eksportu', 'error');
    return;
  }
  const wb = XLSX.utils.book_new();

  const rows = products.map(p => {
    const row = {};
    RURY_EXPORT_COLUMNS.forEach(col => {
      row[col.header] = p[col.key] ?? '';
    });
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = RURY_EXPORT_COLUMNS.map(col => ({ wch: Math.max(col.header.length + 2, 12) }));

  XLSX.utils.book_append_sheet(wb, ws, "Cennik Rury");
  XLSX.writeFile(wb, "Cennik_Rury_Export.xlsx");
  showToast('Wyeksportowano cennik rur do Excela (' + products.length + ' pozycji)', 'success');
}

function importRuryFromExcel(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function (e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const json = XLSX.utils.sheet_to_json(worksheet);

      if (!json || json.length === 0) {
        showToast('Skoroszyt jest pusty lub ma zły format', 'error');
        return;
      }

      const numericFields = ['price', 'weight', 'transport', 'area'];
      const normalized = json.map(raw => {
        const product = {};

        Object.keys(raw).forEach(col => {
          const key = RURY_HEADER_TO_KEY[col] || col;
          product[key] = raw[col];
        });

        product.id = String(product.id || '').trim();
        product.name = String(product.name || '').trim();
        product.category = String(product.category || '').trim();

        numericFields.forEach(f => {
          if (product[f] === '' || product[f] === undefined || product[f] === null || product[f] === '-') {
            product[f] = null;
          } else {
            const num = parseFloat(product[f]);
            product[f] = isNaN(num) ? null : num;
          }
        });

        return product;
      }).filter(p => p.id);

      if (normalized.length === 0) {
        showToast('Brak prawidłowych wierszy do importu', 'error');
        return;
      }

      products = normalized;
      saveProducts(products); // Zapamiętuje nową tablicę prosto do bazy danych
      renderPriceList();
      showToast('Pomyślnie zaimportowano ' + normalized.length + ' pozycji z Excela', 'success');
    } catch (err) {
      console.error(err);
      showToast('Błąd podczas importu pliku Excel', 'error');
    }
    event.target.value = ''; // Reset input
  };
  reader.readAsArrayBuffer(file);
}

function showAddProductModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'add-product-modal';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header"><h3>➕ Dodaj nowy produkt</h3><button class="btn-icon" onclick="closeModal()">✕</button></div>
      <div class="form-group"><label class="form-label">Kategoria</label>
        <select class="form-select" id="np-category">${CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">Indeks</label><input class="form-input" id="np-id" placeholder="np. RTB-0-10-25-K00"></div>
      <div class="form-group"><label class="form-label">Nazwa produktu</label><input class="form-input" id="np-name" placeholder="np. RURA WITROS..."></div>
      <div class="form-row form-row-4">
        <div class="form-group"><label class="form-label">Cena PLN</label><input class="form-input" id="np-price" type="number" step="0.01"></div>
        <div class="form-group"><label class="form-label">Pole (m²)</label><input class="form-input" id="np-area" type="number" step="0.01"></div>
        <div class="form-group"><label class="form-label">Szt./trans.</label><input class="form-input" id="np-transport" type="number"></div>
        <div class="form-group"><label class="form-label">Waga (kg)</label><input class="form-input" id="np-weight" type="number"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Anuluj</button>
        <button class="btn btn-primary" onclick="addProduct()">Dodaj produkt</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
}

function addProduct() {
  const id = document.getElementById('np-id').value.trim();
  const name = document.getElementById('np-name').value.trim();
  const price = parseFloat(document.getElementById('np-price').value);
  const area = document.getElementById('np-area').value ? parseFloat(document.getElementById('np-area').value) : null;
  const transport = document.getElementById('np-transport').value ? parseInt(document.getElementById('np-transport').value) : null;
  const weight = document.getElementById('np-weight').value ? parseInt(document.getElementById('np-weight').value) : null;
  const category = document.getElementById('np-category').value;

  if (!id || !name || isNaN(price)) { showToast('Wypełnij wymagane pola (indeks, nazwa, cena)', 'error'); return; }
  if (products.some(p => p.id === id)) { showToast('Produkt o takim indeksie już istnieje', 'error'); return; }

  products.push({ id, name, price, area, transport, weight, category });
  saveProducts(products);
  closeModal();
  renderPriceList();
  showToast('Dodano nowy produkt', 'success');
}

function closeModal() {
  document.querySelector('.modal-overlay')?.remove();
}

/* ===== OFFER FORM ===== */
function setupOfferForm() {
  const searchInput = document.getElementById('product-search');
  const dropdown = document.getElementById('product-dropdown');

  searchInput.addEventListener('input', () => {
    const val = searchInput.value.toLowerCase().trim();
    if (val.length < 2) { dropdown.classList.remove('show'); return; }
    const matches = products.filter(p =>
      p.category !== 'Akcesoria PEHD' &&
      (p.id.toLowerCase().includes(val) || p.name.toLowerCase().includes(val))
    ).slice(0, 15);

    if (matches.length === 0) { dropdown.classList.remove('show'); return; }
    dropdown.innerHTML = matches.map(p =>
      `<div class="product-dropdown-item" onclick="addOfferItem('${p.id}')">
        <span>${p.name}</span>
        <span class="price">${fmt(p.price)} PLN</span>
      </div>`
    ).join('');
    dropdown.classList.add('show');
  });

  searchInput.addEventListener('blur', () => setTimeout(() => dropdown.classList.remove('show'), 200));
  document.getElementById('pricelist-search')?.addEventListener('input', renderPriceList);

  // Set today's date and auto-generate offer number
  document.getElementById('offer-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('offer-number').value = generateOfferNumber();

  if (!activeCatalogCategory || activeCatalogCategory === "Akcesoria PEHD") {
    activeCatalogCategory = CATEGORIES.filter(c => c !== "Akcesoria PEHD")[0];
  }
  renderCatalogTabs();
  renderCatalogProducts();
}

/* ===== PRODUCT CATALOG ===== */
let catalogVisible = true;
let activeCatalogCategory = null;

function toggleCatalog() {
  catalogVisible = !catalogVisible;
  const catalog = document.getElementById('product-catalog');
  const btn = document.getElementById('toggle-catalog-btn');
  if (catalogVisible) {
    catalog.style.display = 'block';
    btn.innerHTML = '📂 Ukryj katalog produktów';
    if (!activeCatalogCategory || activeCatalogCategory === "Akcesoria PEHD") activeCatalogCategory = CATEGORIES.filter(c => c !== "Akcesoria PEHD")[0];
    renderCatalogTabs();
    renderCatalogProducts();
  } else {
    catalog.style.display = 'none';
    btn.innerHTML = '📂 Pokaż katalog produktów';
  }
}

function renderCatalogTabs() {
  const container = document.getElementById('catalog-tabs');
  container.innerHTML = CATEGORIES.filter(cat => cat !== 'Akcesoria PEHD').map(cat => {
    const count = products.filter(p => p.category === cat).length;
    return `<button class="catalog-tab${cat === activeCatalogCategory ? ' active' : ''}" onclick="selectCatalogCategory('${cat}')">${cat} <span style="opacity:.6">(${count})</span></button>`;
  }).join('');
}

function selectCatalogCategory(cat) {
  activeCatalogCategory = cat;
  renderCatalogTabs();
  renderCatalogProducts();
}

function renderCatalogProducts() {
  const container = document.getElementById('catalog-products');
  const items = products.filter(p => p.category === activeCatalogCategory);
  if (items.length === 0) {
    container.innerHTML = '<div style="padding:1rem;color:var(--text-muted);font-size:.85rem">Brak produktów w tej kategorii</div>';
    return;
  }

  // Group items by diameter
  const grouped = {};
  items.forEach(p => {
    const diameter = getProductDiameter(p.id);
    const diamKey = diameter ? `DN ${diameter}` : 'Inne';
    if (!grouped[diamKey]) grouped[diamKey] = [];
    grouped[diamKey].push(p);
  });

  // Sort diameters numerically
  const diamKeys = Object.keys(grouped).sort((a, b) => {
    const da = parseInt(a.replace('DN ', '')) || 99999;
    const db = parseInt(b.replace('DN ', '')) || 99999;
    return da - db;
  });

  let html = '<div class="catalog-list">';

  diamKeys.forEach(diamKey => {
    html += `<div class="catalog-diam-header">⌀ ${diamKey}</div>`;
    grouped[diamKey].forEach(p => {
      const is1m = isOneMetrePipe(p.id);
      html += `
      <div class="catalog-item-row${is1m ? ' catalog-item-1m' : ''}" onclick="addOfferItem('${p.id}')">
        <div class="catalog-item-row-name">${p.name}</div>
        <div class="catalog-item-row-meta">
          <span class="catalog-item-row-id">${p.id}</span>
          ${p.weight ? `<span class="catalog-item-row-weight">${fmtInt(p.weight)} kg</span>` : ''}
        </div>
        <div class="catalog-item-row-price">${fmt(p.price)} PLN</div>
        <button class="catalog-item-add" onclick="event.stopPropagation();addOfferItem('${p.id}')">+ Dodaj</button>
      </div>`;
    });
  });

  html += '</div>';
  container.innerHTML = html;
}

function generateOfferNumber() {
  const d = new Date();
  const year = d.getFullYear();
  let symbol = "XX";
  if (typeof currentUser !== 'undefined' && currentUser) {
    if (currentUser.symbol) {
      symbol = currentUser.symbol;
    } else if (currentUser.firstName && currentUser.lastName) {
      symbol = (currentUser.firstName[0] + currentUser.lastName[0]).toUpperCase();
    } else if (currentUser.username) {
      symbol = currentUser.username.substring(0, 2).toUpperCase();
    }
  }

  const count = typeof offers !== 'undefined' ? offers.length + 1 : 1;
  return `OF/${String(count).padStart(6, '0')}/${symbol}/${year}`;
}

function addOfferItem(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return;

  const isEditableLength = product.category === 'Rury Jajowe Betonowe' || product.category === 'Rury Jajowe Żelbetowe' || product.category === 'Duże Żelbetowe II';

  if (isEditableLength) {
    showPipeLengthModal(productId);
  } else {
    doAddOfferItem(productId, null);
  }
}

function showPipeLengthModal(productId, editIndex = null) {
  const product = products.find(p => p.id === productId);
  if (!product) return;

  const diam = getProductDiameter(product.id);
  const maxL = (diam === 2200) ? 2.5 : 3;

  let currentVal = getProductLength(product.id) / 1000 || 3;
  if (editIndex !== null) {
    const item = currentOfferItems[editIndex];
    currentVal = item.customLengthM || item.lengthM || currentVal;
  }

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'add-pipe-length-modal';
  overlay.innerHTML = `
    <div class="modal" style="max-width: 450px; border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);">
      <div class="modal-header" style="border-bottom: 1px solid var(--border); padding-bottom: 1rem; margin-bottom: 1.5rem;">
        <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--text);">📏 ${editIndex !== null ? 'Zmień' : 'Dostosuj'} długość rury</h3>
        <button class="btn-icon" onclick="closeModal()">✕</button>
      </div>
      <div style="font-size:0.95rem; color: var(--text-muted); margin-bottom: 1.5rem; line-height: 1.5; background: var(--bg-hover); padding: 1rem; border-radius: 8px;">
        Wybrany produkt:<br><strong style="color:var(--text); font-size: 1.05rem;">${product.name}</strong>
      </div>
      <div class="form-group" style="text-align: center; margin-bottom: 2rem;">
        <label class="form-label" style="font-size:1.15rem; font-weight:600; margin-bottom:1rem; color: var(--text);">Wprowadź długość rury (m)</label>
        <div style="display:flex; justify-content:center; align-items:center; gap:1rem">
          <button class="btn btn-secondary" style="border-radius:50%; width: 44px; height: 44px; padding: 0; font-size: 1.5rem; display: flex; align-items: center; justify-content: center;" onclick="document.getElementById('pipe-custom-length').stepDown()">-</button>
          <input class="form-input" id="pipe-custom-length" type="number" step="0.1" min="1" max="${maxL}" value="${currentVal}" 
            style="font-size:2.5rem; padding:1rem; width:140px; text-align:center; font-weight:800; border: 2px solid var(--primary); border-radius: 12px; color: var(--primary); background: transparent;">
          <button class="btn btn-secondary" style="border-radius:50%; width: 44px; height: 44px; padding: 0; font-size: 1.5rem; display: flex; align-items: center; justify-content: center;" onclick="document.getElementById('pipe-custom-length').stepUp()">+</button>
        </div>
        <div style="margin-top:1rem; font-size:0.9rem; color:var(--text-muted); display: flex; justify-content: center; gap: 1rem;">
          <span style="background: var(--bg-hover); padding: 0.25rem 0.5rem; border-radius: 4px;">Min: <strong>1.0m</strong></span>
          <span style="background: var(--bg-hover); padding: 0.25rem 0.5rem; border-radius: 4px;">Max: <strong>${maxL}m</strong></span>
        </div>
      </div>
      <div class="modal-footer" style="margin-top:1.5rem; border-top: 1px solid var(--border); padding-top: 1.5rem; display: flex; justify-content: flex-end; gap: 1rem;">
        <button class="btn btn-secondary" onclick="closeModal()" style="padding: 0.75rem 1.5rem;">Anuluj</button>
        <button class="btn btn-primary" onclick="confirmPipeLength('${productId}', ${editIndex})" style="padding: 0.75rem 2rem; font-size:1.05rem; font-weight: 600; box-shadow: 0 4px 6px -1px var(--primary-alpha);">Zatwierdź ➔</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

  setTimeout(() => {
    const input = document.getElementById('pipe-custom-length');
    if (input) { input.focus(); input.select(); }
  }, 50);
}

function confirmPipeLength(productId, editIndex) {
  const input = document.getElementById('pipe-custom-length');
  if (!input) return;
  const lengthM = Number(input.value);
  closeModal();

  if (editIndex !== null && typeof editIndex === 'number') {
    updatePipeLength(editIndex, lengthM);
  } else {
    doAddOfferItem(productId, lengthM);
  }
}

function doAddOfferItem(productId, customLengthM) {
  const product = products.find(p => p.id === productId);
  if (!product) return;

  // Check if exactly same item (product + length) already added
  const existingItemIndex = currentOfferItems.findIndex(i => i.productId === productId && (i.customLengthM || null) === (customLengthM || null));
  if (existingItemIndex !== -1) {
    updateItem(existingItemIndex, 'quantity', currentOfferItems[existingItemIndex].quantity + 1);
    showToast(`Zwiększono ilość: ${product.name}`, 'info');
    document.getElementById('product-search').value = '';
    document.getElementById('product-dropdown').classList.remove('show');
    return;
  }

  const lengthMm = getProductLength(product.id);
  const lengthM = lengthMm ? lengthMm / 1000 : null;

  const item = {
    productId: product.id,
    name: product.name,
    unitPrice: product.price,
    quantity: 1,
    meters: lengthM || 0,
    lengthM: lengthM,
    discount: 0,
    weight: product.weight,
    transport: product.transport,
    pehdType: null,
    pehdCostPerUnit: 0,
    customLengthM: null
  };

  currentOfferItems.push(item);

  if (customLengthM && customLengthM !== lengthM) {
    const newIndex = currentOfferItems.length - 1;
    updatePipeLength(newIndex, customLengthM, true);
  } else {
    syncGaskets();
    document.getElementById('product-search').value = '';
    document.getElementById('product-dropdown').classList.remove('show');
    renderOfferItems();
    showToast('Dodano: ' + product.name.substring(0, 40) + '...', 'success');
  }
}

function syncGaskets() {
  const req = {};

  currentOfferItems.forEach(item => {
    if (!item.autoAdded && item.quantity > 0) {
      const product = products.find(p => p.id === item.productId);
      if (product && product.category === 'Duże Żelbetowe II') {
        const diam = getProductDiameter(item.productId);
        if (diam) {
          const kw = diam.toString();
          const gasket = products.find(p => p.category === 'Uszczelki' && (p.name.includes(kw) || p.id.includes(kw)));
          if (gasket) {
            const isBosy = product.name.toLowerCase().includes('bosy-bosy');
            const qtyPerPipe = isBosy ? 2 : 1;
            if (!req[gasket.id]) req[gasket.id] = { product: gasket, qty: 0 };
            req[gasket.id].qty += (item.quantity * qtyPerPipe);
          }
        }
      }
    }
  });

  for (let i = currentOfferItems.length - 1; i >= 0; i--) {
    const item = currentOfferItems[i];
    if (item.autoAdded) {
      if (req[item.productId] && req[item.productId].qty > 0) {
        item.quantity = req[item.productId].qty;
        req[item.productId].qty = 0; // handled
      } else {
        currentOfferItems.splice(i, 1);
      }
    }
  }

  Object.values(req).forEach(r => {
    if (r.qty > 0) {
      currentOfferItems.push({
        productId: r.product.id,
        name: r.product.name,
        unitPrice: r.product.price,
        quantity: r.qty,
        meters: 0,
        lengthM: null,
        discount: 0,
        weight: r.product.weight,
        transport: r.product.transport,
        autoAdded: true,
        linkedTo: null
      });
      showToast(`Automatycznie zaktualizowano uszczelki: ${r.product.name}`, 'info');
    }
  });
}

function addPehdToPipe(pipeIndex, pehdId) {
  const pipe = currentOfferItems[pipeIndex];
  const area = getPipeInnerArea(pipe.productId);
  if (area <= 0) return;

  const pehdProd = products.find(p => p.id === pehdId);
  if (!pehdProd) return;

  if (pipe.pehdType === pehdId) {
    pipe.pehdType = null;
    pipe.pehdCostPerUnit = 0;
    showToast('Wkładka usunięta', 'info');
  } else {
    pipe.pehdType = pehdId;
    let ratio = 1;
    if (pipe.customLengthM) {
      const origL = getProductLength(pipe.productId) / 1000;
      if (origL > 0) ratio = pipe.customLengthM / origL;
    }
    pipe.pehdCostPerUnit = area * ratio * pehdProd.price;
    showToast('Wkładka została przypisana do rury', 'success');
  }

  renderOfferItems();
}

/* ===== TRANSPORT PER UNIT HELPERS ===== */
function getCostPerTrip() {
  const km = Number(document.getElementById('transport-km')?.value) || 0;
  const rate = Number(document.getElementById('transport-rate')?.value) || 0;
  return km * rate;
}

/**
 * Calculates transport cost distribution across all items.
 * 
 * Uses POST-OPTIMIZATION transport count (after consolidation)
 * and distributes cost proportionally by WEIGHT:
 *   Total transport cost = totalTransports (after optimization) × costPerTrip
 *   Each product's weight share = (weightPerPiece × quantity) / totalWeight
 *   Transport per unit = (weightShare × totalTransportCost) / quantity
 * 
 * This ensures heavier items pay more, lighter items pay less,
 * and the sum of all charges = actual total transport cost.
 * 
 * Returns an object: productId → transportPerUnit
 */
function calculateTransportDistribution(items, costPerTripOverride) {
  const costPerTrip = costPerTripOverride != null ? costPerTripOverride : getCostPerTrip();
  const distribution = {};
  if (costPerTrip <= 0) return distribution;

  const transportResult = calculateTransports(items);
  if (transportResult.totalTransports <= 0 || transportResult.lines.length === 0) return distribution;

  // Use POST-optimization transport count
  const totalTransportCost = transportResult.totalTransports * costPerTrip;

  // Calculate total weight of all transported items
  const totalWeight = transportResult.lines.reduce((s, l) => s + l.totalWeight, 0);
  if (totalWeight <= 0) return distribution;

  // Distribute proportionally by weight
  transportResult.lines.forEach(line => {
    const weightShare = line.totalWeight / totalWeight;
    const itemTransportCost = weightShare * totalTransportCost;
    distribution[line.productId] = itemTransportCost / line.quantity;
  });

  return distribution;
}

/** Standalone helper for save/export contexts (no DOM) */
function calculateTransportDistributionStandalone(items, costPerTrip) {
  return calculateTransportDistribution(items, costPerTrip);
}

function renderOfferItems() {
  const tbody = document.getElementById('offer-items-body');
  if (currentOfferItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" class="text-center" style="padding:2rem;color:var(--text-muted)">
      Wyszukaj i dodaj produkty z cennika powyżej</td></tr>`;
    updateOfferSummary();
    return;
  }

  // Filter out any leftover standalone PEHD items from previous versions
  currentOfferItems = currentOfferItems.filter(i => !i.isPehd);

  // Sync weights from the price list (so changes in pricelist apply immediately)
  currentOfferItems.forEach(item => {
    const product = products.find(p => p.id === item.productId);
    if (product !== undefined) {
      if (!item.customLengthM) {
        item.weight = product.weight;
        item.transport = product.transport;
        item.lengthM = getProductLength(item.productId) / 1000;
      }
    }
    // Also sync PEHD price if PEHD was added
    if (item.pehdType) {
      const pehdProd = products.find(p => p.id === item.pehdType);
      if (pehdProd) {
        const area = getPipeInnerArea(item.productId);
        let ratio = 1;
        if (item.customLengthM) {
          const origL = getProductLength(item.productId) / 1000;
          if (origL > 0) ratio = item.customLengthM / origL;
        }
        item.pehdCostPerUnit = area * ratio * pehdProd.price;
      }
    }
  });

  // Pre-calculate transport distribution for all items
  const transportDist = calculateTransportDistribution(currentOfferItems);

  // Group items by category, then by diameter
  const grouped = {};
  currentOfferItems.forEach((item, i) => {
    const product = products.find(p => p.id === item.productId);
    const category = product ? product.category : 'Inne';
    if (!grouped[category]) grouped[category] = {};
    let diameter = getProductDiameter(item.productId);
    // Gasket IDs like Y-U-GZ-U-14-BU have diameter at parts[4]
    if (!diameter && item.productId) {
      const parts = item.productId.split('-');
      if (parts.length >= 5) {
        const code = parseInt(parts[4]);
        if (!isNaN(code) && code > 0) diameter = code * 100;
      }
    }
    const diamKey = diameter ? `DN ${diameter}` : 'Inne';
    if (!grouped[category][diamKey]) grouped[category][diamKey] = [];
    grouped[category][diamKey].push({ item, originalIndex: i, diameter });
  });

  // Sort the categories by their order in CATEGORIES
  const sortedCategories = Object.keys(grouped).sort((a, b) => {
    const ia = CATEGORIES.indexOf(a);
    const ib = CATEGORIES.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  let html = '';
  let lp = 1;

  sortedCategories.forEach(cat => {
    // Category header row
    html += `<tr class="offer-cat-header"><td colspan="11">${cat}</td></tr>`;

    // Sort diameters numerically
    const diamKeys = Object.keys(grouped[cat]).sort((a, b) => {
      const da = parseInt(a.replace('DN ', '')) || 99999;
      const db = parseInt(b.replace('DN ', '')) || 99999;
      return da - db;
    });

    diamKeys.forEach(diamKey => {
      // Diameter sub-header row
      html += `<tr class="offer-diam-header"><td colspan="11">⌀ ${diamKey}</td></tr>`;

      grouped[cat][diamKey].sort((a, b) => {
        // Bosy-Bosy always first
        const aBB = a.item.name.toLowerCase().includes('bosy') || a.item.productId.endsWith('-B00');
        const bBB = b.item.name.toLowerCase().includes('bosy') || b.item.productId.endsWith('-B00');
        if (aBB !== bBB) return aBB ? -1 : 1;
        // Then by length ascending
        return (a.item.lengthM || 0) - (b.item.lengthM || 0);
      });

      grouped[cat][diamKey].forEach(({ item, originalIndex: i }) => {
        const basePriceAfterDiscount = item.unitPrice * (1 - item.discount / 100);
        const pehdCost = item.pehdCostPerUnit || 0;
        const priceAfterDiscount = basePriceAfterDiscount + pehdCost;

        const transportPerUnit = transportDist[item.productId] || 0;
        const unitTotal = priceAfterDiscount + transportPerUnit;
        const netto = unitTotal * item.quantity;
        const vat = netto * 0.23;
        const brutto = netto + vat;
        const hasLength = item.lengthM && item.lengthM > 0;
        const metersVal = hasLength ? (item.meters || 0) : '';
        const autoTag = item.autoAdded ? ' <span style="font-size:.65rem;color:var(--warn);opacity:.8">(auto)</span>' : '';
        const is1m = isOneMetrePipe(item.productId);

        let pName = item.name;
        if (item.pehdType === 'PEHD-3MM') pName += ' <span style="color:var(--primary);font-weight:bold">+ PEHD 3mm</span>';
        if (item.pehdType === 'PEHD-4MM') pName += ' <span style="color:var(--primary);font-weight:bold">+ PEHD 4mm</span>';

        let rowClass = '';
        let rowStyle = '';
        if (item.autoAdded) {
          rowStyle = 'background:rgba(245,158,11,0.04)';
        } else if (is1m) {
          rowClass = 'row-1m';
        }
        const activePehdStyle = 'font-size:0.65rem; padding: 0.2rem 0.5rem; margin-top:2px; background:#10b981; color:white; border:none; box-shadow:0 0 10px rgba(16,185,129,0.3); font-weight:700; border-radius:4px;';
        const inactivePehdStyle = 'font-size:0.6rem; padding: 0.2rem 0.4rem; margin-top:2px; background:var(--bg-hover); color:var(--text-muted); border:1px solid var(--border); border-radius:4px; transition:all 0.2s ease;';

        const active3mm = item.pehdType === 'PEHD-3MM' ? `style="${activePehdStyle}"` : `style="${inactivePehdStyle}"`;
        const active4mm = item.pehdType === 'PEHD-4MM' ? `style="${activePehdStyle}"` : `style="${inactivePehdStyle}"`;

        const isEditableLength = cat === 'Rury Jajowe Betonowe' || cat === 'Rury Jajowe Żelbetowe' || cat === 'Duże Żelbetowe II';
        const lengthEditor = isEditableLength && hasLength ? `<br><div style="margin-top:6px;"><button class="btn-icon" style="font-size:0.75rem; padding:0.2rem 0.5rem; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); display: inline-flex; align-items: center; gap: 6px; cursor: pointer; color: var(--text);" onclick="showPipeLengthModal('${item.productId}', ${i})" title="Zmień długość rury i automatycznie przelicz wagę oraz transport">📏 Dł. rury: <strong style="color:var(--primary)">${fmt(item.customLengthM || item.lengthM)}m</strong> ✎</button></div>` : '';

        html += `<tr class="${rowClass}" ${rowStyle ? `style="${rowStyle}"` : ''}>
          <td>${lp++}</td>
          <td style="max-width:280px">${pName}${autoTag}${lengthEditor}</td>
          <td class="text-right">${fmt(item.unitPrice)}</td>
          <td class="text-center">${hasLength
            ? `<input type="number" class="edit-input" style="width:70px;text-align:center" min="0" step="0.1" value="${metersVal}" onfocus="this.select()" onchange="updateItemMeters(${i},this.value)" title="Metry bieżące"> m`
            : '—'}</td>
          <td class="text-center"><input type="number" class="edit-input" style="width:60px;text-align:center" min="1" value="${item.quantity}" onfocus="this.select()" onchange="updateItem(${i},'quantity',this.value)"> szt.</td>
          <td class="text-center"><input type="number" class="edit-input" style="width:50px;text-align:center" min="0" max="100" step="0.5" value="${item.discount}" onfocus="this.select()" onchange="updateItem(${i},'discount',this.value)">%</td>
          <td class="text-right">${fmt(unitTotal)}</td>
          <td class="text-right" style="color:var(--warn)">${transportPerUnit > 0 ? fmt(transportPerUnit) : '—'}</td>
          <td class="text-right" style="font-weight:600">${fmt(netto)}</td>
          <td class="text-right">${fmt(brutto)}</td>
          <td class="text-center" style="white-space:nowrap;">
            <div style="display: inline-flex; align-items: center; gap: 0.5rem; justify-content: center;">
              ${getPipeInnerArea(item.productId) > 0 && !item.autoAdded ? `
                <div style="display: flex; flex-direction: column; gap: 2px;">
                  <button class="btn btn-sm btn-secondary" ${active3mm} onclick="addPehdToPipe(${i}, 'PEHD-3MM')" title="Dolicz wkładkę 3mm">+ PEHD 3mm</button>
                  <button class="btn btn-sm btn-secondary" ${active4mm} onclick="addPehdToPipe(${i}, 'PEHD-4MM')" title="Dolicz wkładkę 4mm">+ PEHD 4mm</button>
                </div>
              ` : ''}
              <button class="btn-icon" title="Usuń" onclick="removeOfferItem(${i})">✕</button>
            </div>
          </td>
        </tr>`;
      });
    });
  });

  tbody.innerHTML = html;
  updateOfferSummary();
}

function updatePipeLength(index, newLengthM, skipRender = false) {
  const item = currentOfferItems[index];
  let newL = Number(newLengthM);

  const diameter = getProductDiameter(item.productId);
  const maxLength = (diameter === 2200) ? 2.5 : 3;

  if (newL < 1) {
    newL = 1;
    showToast('Minimalna długość rury to 1m', 'error');
  } else if (newL > maxLength) {
    newL = maxLength;
    showToast(`Maksymalna długość tej rury to ${maxLength}m`, 'error');
  }

  const product = products.find(p => p.id === item.productId);
  if (!product) return;

  const originalLengthM = getProductLength(product.id) / 1000;
  if (!originalLengthM || originalLengthM <= 0) return;

  if (newL === originalLengthM) {
    item.customLengthM = null;
    item.lengthM = originalLengthM;
    item.weight = product.weight;
    item.transport = product.transport;
    item.name = product.name; // reset name
  } else {
    item.customLengthM = newL;
    item.lengthM = newL;

    if (product.weight) {
      const weightPerMeter = product.weight / originalLengthM;
      item.weight = Math.round(weightPerMeter * newL);

      const truckCapacity = (product.weight * product.transport) || 24000;
      item.transport = Math.max(1, Math.floor(truckCapacity / item.weight));
    }

    // Update name dynamically
    const lOriginalMm = Math.round(originalLengthM * 1000);
    const lNewMm = Math.round(newL * 1000);
    if (product.name.includes(` / ${lOriginalMm}`)) {
      item.name = product.name.replace(` / ${lOriginalMm}`, ` / ${lNewMm}`);
    } else {
      item.name = `${product.name} (L=${newL}m)`;
    }
  }

  item.meters = item.quantity * item.lengthM;

  if (!skipRender) {
    syncGaskets();
    renderOfferItems();
    updateOfferSummary();
    showToast('Przeliczono uciętą rurę (waga, transport, nazwa)', 'info');
  } else {
    syncGaskets();
    document.getElementById('product-search').value = '';
    document.getElementById('product-dropdown').classList.remove('show');
    renderOfferItems();
    showToast('Dodano: ' + item.name.substring(0, 40) + '...', 'success');
  }
}

function updateItem(index, field, value) {
  const item = currentOfferItems[index];
  const numVal = Number(value);

  // Gasket discount warning
  if (field === 'discount' && numVal > 0) {
    const isGasket = item.autoAdded || item.name.toLowerCase().includes('uszczelk') || (item.productId && item.productId.includes('Y-U-GZ-U'));
    if (isGasket) {
      alert("UWAGA! Wpisujesz rabat na uszczelki!");
    }
  }

  item[field] = numVal;
  // If quantity changed and has length, recalculate meters
  if (field === 'quantity' && item.lengthM) {
    item.meters = numVal * item.lengthM;
  }

  syncGaskets();
  renderOfferItems();
}

function updateItemMeters(index, metersValue) {
  const item = currentOfferItems[index];
  const meters = Number(metersValue);
  item.meters = meters;
  if (item.lengthM && item.lengthM > 0) {
    item.quantity = Math.ceil(meters / item.lengthM);
    if (item.quantity < 1 && meters > 0) item.quantity = 1;
    if (meters === 0) item.quantity = 0;
  }

  syncGaskets();
  renderOfferItems();
}

function removeOfferItem(index) {
  currentOfferItems.splice(index, 1);
  syncGaskets();
  renderOfferItems();
}

function updateOfferSummary() {
  let totalProductsNetto = 0;
  const costPerTrip = getCostPerTrip();

  // Pre-calculate transport distribution
  const transportDist = calculateTransportDistribution(currentOfferItems);

  currentOfferItems.forEach(item => {
    const basePriceAfterDiscount = item.unitPrice * (1 - item.discount / 100);
    const pehdCost = item.pehdCostPerUnit || 0;
    const priceAfterDiscount = basePriceAfterDiscount + pehdCost;
    totalProductsNetto += priceAfterDiscount * item.quantity;
  });

  // Calculate transports for breakdown
  const transportResult = calculateTransports(currentOfferItems);

  const totalTransportCostCalc = transportResult.totalTransports * costPerTrip;
  const finalTotalNetto = totalProductsNetto + totalTransportCostCalc;
  const totalVat = finalTotalNetto * 0.23;
  const totalBrutto = finalTotalNetto + totalVat;

  const elProducts = document.getElementById('sum-netto-products');
  if (elProducts) elProducts.textContent = fmt(totalProductsNetto) + ' PLN';

  const elTransport = document.getElementById('sum-transport-cost');
  if (elTransport) elTransport.textContent = fmt(totalTransportCostCalc) + ' PLN';

  const elTransportDetails = document.getElementById('sum-transport-details');
  if (elTransportDetails) elTransportDetails.textContent = costPerTrip > 0
    ? `Ilość transportów: ${transportResult.totalTransports}. Koszt: ${fmt(costPerTrip)} PLN/kurs`
    : 'Brak transportów / 0.00 PLN za kurs';

  const elTotalNetto = document.getElementById('sum-total-netto');
  if (elTotalNetto) elTotalNetto.textContent = fmt(finalTotalNetto) + ' PLN';

  const elBrutto = document.getElementById('sum-brutto-details');
  if (elBrutto) elBrutto.innerHTML = `Brutto z VAT: <strong>${fmt(totalBrutto)} PLN</strong>`;

  // Render transport breakdown
  renderTransportBreakdown(transportResult, costPerTrip);
}

/* ===== TRANSPORT CALCULATION ===== */
const MAX_TRANSPORT_WEIGHT = 24000; // kg

function calculateTransports(items) {
  // Map items to calculate with latest pricelist data
  const mappedItems = items.map(i => {
    let baseId = i.productId;
    if (i.isPehd) {
      if (i.productId.startsWith('PEHD-3MM')) baseId = 'PEHD-3MM';
      if (i.productId.startsWith('PEHD-4MM')) baseId = 'PEHD-4MM';
    }
    const product = products.find(p => p.id === baseId);
    return {
      ...i,
      currentWeight: i.customLengthM ? i.weight : (product ? product.weight : (i.weight || 0)),
      currentTransport: i.customLengthM ? i.transport : (product ? product.transport : (i.transport || 0))
    };
  });

  // Filter items that need transport (pipes with current weight > 0, not gaskets)
  const transportItems = mappedItems.filter(i => i.currentWeight && i.currentWeight > 0 && i.quantity > 0 && !i.autoAdded);
  if (transportItems.length === 0) return { lines: [], totalTransports: 0, consolidated: [] };

  const lines = [];
  const partials = []; // leftover from last transport of each product

  transportItems.forEach(item => {
    const maxByWeight = Math.floor(MAX_TRANSPORT_WEIGHT / item.currentWeight);
    const maxByCount = item.currentTransport || maxByWeight;
    const maxPerTransport = Math.min(maxByWeight, maxByCount);
    if (maxPerTransport <= 0) return;

    const fullTransports = Math.floor(item.quantity / maxPerTransport);
    const remainder = item.quantity % maxPerTransport;
    const totalForItem = fullTransports + (remainder > 0 ? 1 : 0);

    const line = {
      productId: item.productId,
      name: item.name,
      quantity: item.quantity,
      weightPerPiece: item.currentWeight,
      totalWeight: item.currentWeight * item.quantity,
      maxPerTransport,
      fullTransports,
      remainder,
      dedicatedTransports: totalForItem
    };
    lines.push(line);

    // Track partials for consolidation
    if (remainder > 0) {
      partials.push({
        productId: item.productId,
        name: item.name,
        pieces: remainder,
        weight: remainder * item.currentWeight,
        maxPerTransport
      });
    }
  });

  // Try to consolidate partial transports
  let totalDedicated = lines.reduce((s, l) => s + l.dedicatedTransports, 0);
  let saved = 0;
  const consolidated = [];

  if (partials.length > 1) {
    // Sort partials by weight descending for better bin-packing
    partials.sort((a, b) => b.weight - a.weight);
    const used = new Set();

    for (let i = 0; i < partials.length; i++) {
      if (used.has(i)) continue;
      const group = [partials[i]];
      let groupWeight = partials[i].weight;
      used.add(i);

      for (let j = i + 1; j < partials.length; j++) {
        if (used.has(j)) continue;
        if (groupWeight + partials[j].weight <= MAX_TRANSPORT_WEIGHT) {
          group.push(partials[j]);
          groupWeight += partials[j].weight;
          used.add(j);
        }
      }

      if (group.length > 1) {
        consolidated.push({ items: group, totalWeight: groupWeight });
        saved += group.length - 1; // save (n-1) transports
      }
    }
  }

  return {
    lines,
    totalTransports: totalDedicated - saved,
    saved,
    consolidated
  };
}

function renderTransportBreakdown(result, costPerTrip) {
  const container = document.getElementById('transport-breakdown');
  if (result.lines.length === 0) {
    container.innerHTML = '';
    return;
  }

  const totalDedicated = result.lines.reduce((s, l) => s + l.dedicatedTransports, 0);
  const totalTransportCost = result.totalTransports * costPerTrip;
  const totalWeight = result.lines.reduce((s, l) => s + l.totalWeight, 0);

  let html = `<div class="cat-header" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center; user-select:none;" onclick="toggleTransportBreakdown()">
    <div>🚚 Kalkulacja transportu <span class="cat-count">(max ${fmtInt(MAX_TRANSPORT_WEIGHT)} kg / transport)</span></div>
    <span id="transport-toggle-icon">${isTransportBreakdownExpanded ? '🔼' : '🔽'}</span>
  </div>`;
  html += `<div id="transport-breakdown-content" style="display:${isTransportBreakdownExpanded ? 'block' : 'none'}; margin-top:0.5rem;">`;
  html += `<div class="table-wrap"><table>
    <thead><tr>
      <th>Produkt</th><th class="text-right">Ilość</th><th class="text-right">Waga/szt</th>
      <th class="text-right">Łączna waga</th><th class="text-right">Max/transport</th>
      <th class="text-right">Transporty</th>
      ${costPerTrip > 0 ? '<th class="text-right">Udział wagi</th><th class="text-right">Transport/szt.</th>' : ''}
    </tr></thead><tbody>`;
  // Sort lines: by diameter (smallest to largest), egg-shaped ("jajowe") always last
  const sortedLines = [...result.lines].sort((a, b) => {
    const aJaj = a.name.toUpperCase().includes('JAJOW');
    const bJaj = b.name.toUpperCase().includes('JAJOW');
    if (aJaj !== bJaj) return aJaj ? 1 : -1;
    const dA = getProductDiameter(a.productId) || 99999;
    const dB = getProductDiameter(b.productId) || 99999;
    return dA - dB;
  });

  sortedLines.forEach(l => {
    const weightShare = totalWeight > 0 ? l.totalWeight / totalWeight : 0;
    const itemTransportCost = weightShare * totalTransportCost;
    const perUnit = l.quantity > 0 ? itemTransportCost / l.quantity : 0;
    html += `<tr>
      <td style="max-width:250px">${l.name}</td>
      <td class="text-right">${l.quantity} szt.</td>
      <td class="text-right">${fmtInt(l.weightPerPiece)} kg</td>
      <td class="text-right">${fmtInt(l.totalWeight)} kg</td>
      <td class="text-right">${l.maxPerTransport} szt.</td>
      <td class="text-right" style="font-weight:600">${l.dedicatedTransports}</td>
      ${costPerTrip > 0 ? `<td class="text-right" style="color:var(--text-secondary)">${(weightShare * 100).toFixed(1)}%</td>
      <td class="text-right" style="color:var(--warn);font-weight:600">${fmt(perUnit)} PLN</td>` : ''}
    </tr>`;
  });

  html += '</tbody></table></div>';

  if (result.saved > 0) {
    html += `<div style="margin-top:.5rem;padding:.5rem .8rem;background:rgba(16,185,129,0.08);border-radius:8px;font-size:.82rem;color:var(--success)">
      ✅ Optymalizacja: połączono niepełne transporty, zaoszczędzono <strong>${result.saved}</strong> transportów
      (${totalDedicated} → ${result.totalTransports})</div>`;
  }

  if (costPerTrip > 0) {
    const km = Number(document.getElementById('transport-km')?.value) || 0;
    const rate = Number(document.getElementById('transport-rate')?.value) || 0;
    html += `<div style="margin-top:.5rem;font-size:.82rem;color:var(--text-secondary)">
      ${km} km × ${fmt(rate)} PLN/km = ${fmt(costPerTrip)} PLN/kurs × ${result.totalTransports} kursów = <strong style="color:var(--warn)">${fmt(totalTransportCost)} PLN</strong> (rozdzielone proporcjonalnie na pozycje)</div>`;
  }

  html += `</div>`; // Close transport-breakdown-content

  container.innerHTML = html;
}

/* ===== FILE DOWNLOAD HELPER ===== */
function downloadOfferFile(offer) {
  const json = JSON.stringify(offer, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeNumber = offer.number.replace(/[/\\:*?"<>|]/g, '_');
  a.href = url;
  a.download = `Oferta_${safeNumber}_${offer.date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ===== SAVE OFFER ===== */
function saveOffer() {
  const number = document.getElementById('offer-number').value.trim();
  const date = document.getElementById('offer-date').value;
  const clientName = document.getElementById('client-name').value.trim();
  const clientNip = document.getElementById('client-nip').value.trim();
  const clientAddress = document.getElementById('client-address').value.trim();
  const clientContact = document.getElementById('client-contact').value.trim();
  const investName = document.getElementById('invest-name').value.trim();
  const investAddress = document.getElementById('invest-address').value.trim();
  const investContractor = document.getElementById('invest-contractor').value.trim();
  const notes = document.getElementById('offer-notes').value.trim();
  const transportKm = Number(document.getElementById('transport-km').value) || 0;
  const transportRate = Number(document.getElementById('transport-rate').value) || 0;
  const transportCostPerTrip = transportKm * transportRate;

  if (!number) { showToast('Podaj numer oferty', 'error'); return; }
  if (currentOfferItems.length === 0) { showToast('Dodaj przynajmniej jeden produkt', 'error'); return; }

  const transportResult = calculateTransports(currentOfferItems);
  const transportCost = transportResult.totalTransports * transportCostPerTrip;
  const transportDist = calculateTransportDistributionStandalone(currentOfferItems, transportCostPerTrip);

  let totalNetto = 0;
  currentOfferItems.forEach(item => {
    const priceAfterDiscount = item.unitPrice * (1 - item.discount / 100);
    const transportPerUnit = transportDist[item.productId] || 0;
    totalNetto += (priceAfterDiscount + transportPerUnit) * item.quantity;
  });

  const existingOffer = editingOfferId ? offers.find(o => o.id === editingOfferId) : null;
  const offer = {
    id: editingOfferId || 'offer_' + Date.now(),
    userId: existingOffer?.userId || (currentUser ? currentUser.id : null),
    userName: existingOffer?.userName || (currentUser ? currentUser.username : ''),
    number, date, clientName, clientNip, clientAddress, clientContact, investName, investAddress, investContractor, notes,
    items: JSON.parse(JSON.stringify(currentOfferItems)),
    transportKm,
    transportRate,
    transportCostPerTrip,
    transportCount: transportResult.totalTransports,
    transportCost,
    totalNetto,
    totalBrutto: totalNetto * 1.23,
    createdAt: editingOfferId ? (existingOffer?.createdAt || new Date().toISOString()) : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastEditedBy: currentUser ? currentUser.username : ''
  };

  if (editingOfferId) {
    const idx = offers.findIndex(o => o.id === editingOfferId);
    if (idx >= 0) {
      // Save snapshot of previous state
      const oldOffer = offers[idx];
      if (!oldOffer.history) oldOffer.history = [];
      const historySnapshot = JSON.parse(JSON.stringify(oldOffer));
      // Remove history from snapshot to prevent infinite nesting expansion
      delete historySnapshot.history;

      const newHistory = [...oldOffer.history, historySnapshot];
      offer.history = newHistory;

      offers[idx] = offer;
    }
    editingOfferId = null;
  } else {
    offer.history = [];
    offers.push(offer);
  }
  saveOffersData(offers);

  // Ask if user wants to download as XLSX
  if (confirm('Oferta zapisana! Czy pobrać plik XLSX?')) {
    exportOfferXlsx(offer.id);
  }

  showToast('Oferta zapisana ✔', 'success');
  editingOfferId = offer.id;
  renderSavedOffers();
}

function clearOfferForm() {
  editingOfferId = null;
  document.getElementById('offer-number').value = generateOfferNumber();
  document.getElementById('offer-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('client-name').value = '';
  document.getElementById('client-nip').value = '';
  document.getElementById('client-address').value = '';
  document.getElementById('client-contact').value = '';
  document.getElementById('invest-name').value = '';
  document.getElementById('invest-address').value = '';
  document.getElementById('invest-contractor').value = '';
  document.getElementById('offer-notes').value = '';
  document.getElementById('transport-km').value = '100';
  document.getElementById('transport-rate').value = '10';
  currentOfferItems = [];
  renderOfferItems();
}

/* ===== SAVED OFFERS ===== */
function renderSavedOffers() {
  const container = document.getElementById('saved-offers-list');
  if (offers.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 12h6m-3-3v6m-7 4h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
      <h3>Brak zapisanych ofert</h3><p>Utwórz nową ofertę w zakładce "Nowa Oferta"</p></div>`;
    return;
  }

  const isAdmin = currentUser && currentUser.role === 'admin';
  const isPro = currentUser && currentUser.role === 'pro';
  const subUsers = (currentUser && currentUser.subUsers) || [];

  container.innerHTML = offers.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).map(o => {
    const isOwner = currentUser && o.userId === currentUser.id;
    const isSubUserOffer = isPro && subUsers.includes(o.userId);
    const canEdit = isAdmin || isOwner || isSubUserOffer;

    return `
    <div class="offer-list-item">
      <div class="offer-info" style="min-width:0;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:0.5rem;">
          <h3 style="margin-bottom:0.2rem; word-break:break-all;">${o.number}</h3>
          <div style="font-weight:700; color:var(--text-primary); font-size: 0.9rem; white-space:nowrap;">
            💰 ${fmt(o.totalBrutto)} PLN
          </div>
        </div>
        <div class="meta" style="margin-top:0.3rem;">
          <span>📅 <strong>${o.date}</strong></span>
          <span>📦 <strong>${o.items.length}</strong> poz.</span>
          ${isAdmin && o.userName ? `<span style="color:var(--accent-hover)">👤 <strong>${o.userName}</strong></span>` : ''}
        </div>
        ${o.clientName || o.investName || o.clientContact ? `
        <div class="offer-client-badges">
          ${o.clientName ? `<div class="badge-client">🏢 <strong>Klient:</strong> <span style="font-weight:500">${o.clientName}</span></div>` : ''}
          ${o.investName ? `<div class="badge-invest">🏗️ <strong>Budowa:</strong> <span style="font-weight:500">${o.investName}</span></div>` : ''}
          ${o.clientContact ? `<div class="badge-contact">📞 <strong>Kontakt:</strong> <span style="font-weight:500">${o.clientContact}</span></div>` : ''}
        </div>` : ''}
      </div>
      <div class="offer-actions" style="display:flex; flex-wrap:wrap; gap:0.4rem; justify-content:flex-end; align-content:center;">
        ${canEdit ? `<button class="btn btn-sm btn-primary" onclick="loadOffer('${o.id}')" title="Edytuj">✏️ Edytuj</button>` : ''}
        <button class="btn btn-sm btn-secondary" onclick="duplicateOffer('${o.id}')" title="Duplikuj">📋 Duplikuj</button>
        ${(o.history && o.history.length > 0) ? `<button class="btn btn-sm btn-secondary" onclick="showOfferHistory('${o.id}')" title="Historia zmian">⏳ Historia</button>` : ''}
        <button class="btn btn-sm btn-secondary" onclick="downloadExistingOffer('${o.id}')" title="Pobierz plik JSON">💾 JSON</button>
        <button class="btn btn-sm btn-secondary" onclick="exportOfferXlsx('${o.id}')" title="Pobierz plik XLSX">📊 XLSX</button>
        <button class="btn btn-sm btn-success" onclick="exportOfferPDF('${o.id}')" title="PDF">📄 PDF</button>
        ${canEdit ? `<button class="btn btn-sm btn-danger" onclick="deleteOffer('${o.id}')" title="Usuń">🗑️ Usuń</button>` : ''}
      </div>
    </div>
  `}).join('');
}

function loadOffer(id) {
  const offer = offers.find(o => o.id === id);
  if (!offer) return;
  editingOfferId = id;
  document.getElementById('offer-number').value = offer.number;
  document.getElementById('offer-date').value = offer.date;
  document.getElementById('client-name').value = offer.clientName || '';
  document.getElementById('client-nip').value = offer.clientNip || '';
  document.getElementById('client-address').value = offer.clientAddress || '';
  document.getElementById('client-contact').value = offer.clientContact || '';
  document.getElementById('invest-name').value = offer.investName || '';
  document.getElementById('invest-address').value = offer.investAddress || '';
  document.getElementById('invest-contractor').value = offer.investContractor || '';
  document.getElementById('offer-notes').value = offer.notes || '';
  document.getElementById('transport-km').value = offer.transportKm || 100;
  document.getElementById('transport-rate').value = offer.transportRate || 10;
  currentOfferItems = JSON.parse(JSON.stringify(offer.items));
  renderOfferItems();
  showSection('offer');
  showToast('Wczytano ofertę: ' + offer.number, 'info');
}

function duplicateOffer(id) {
  const offer = offers.find(o => o.id === id);
  if (!offer) return;
  const newOffer = JSON.parse(JSON.stringify(offer));
  newOffer.id = 'offer_' + Date.now();
  newOffer.number = offer.number + ' (kopia)';
  newOffer.userId = currentUser ? currentUser.id : null;
  newOffer.userName = currentUser ? currentUser.username : '';
  newOffer.createdAt = new Date().toISOString();
  newOffer.updatedAt = new Date().toISOString();
  offers.push(newOffer);
  saveOffersData(offers);
  renderSavedOffers();
  showToast('Zduplikowano ofertę', 'success');
}

function deleteOffer(id) {
  if (!confirm('Czy na pewno usunąć tę ofertę?')) return;
  offers = offers.filter(o => o.id !== id);
  saveOffersData(offers);
  renderSavedOffers();
  showToast('Oferta usunięta', 'info');
}

function downloadExistingOffer(id) {
  const offer = offers.find(o => o.id === id);
  if (!offer) return;
  downloadOfferFile(offer);
  showToast('Pobrano plik oferty', 'success');
}

/* ===== OFFER HISTORY ===== */
function showOfferHistory(id) {
  const offer = offers.find(o => o.id === id);
  if (!offer || !offer.history || offer.history.length === 0) {
    showToast('Brak historii dla tej oferty', 'info');
    return;
  }

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'offer-history-modal';

  let historyHtml = offer.history.map((h, i) => {
    // Find next state (either next history item or current offer)
    const nextState = i === offer.history.length - 1 ? offer : offer.history[i + 1];
    const priceDiff = nextState.totalBrutto - h.totalBrutto;

    let diffHtml = '';
    if (Math.abs(priceDiff) > 0.01) {
      if (priceDiff > 0) {
        diffHtml = `<span style="color:var(--danger); font-size:0.8rem; font-weight:700;">+${fmt(priceDiff)} PLN</span>`;
      } else {
        diffHtml = `<span style="color:var(--success); font-size:0.8rem; font-weight:700;">${fmt(priceDiff)} PLN</span>`;
      }
    } else {
      diffHtml = `<span style="color:var(--text-muted); font-size:0.8rem;">Bez zmian</span>`;
    }

    return `
      <div style="background:var(--bg-glass); border:1px solid var(--border-glass); border-radius:8px; padding:1rem; margin-bottom:0.8rem;">
        <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem; border-bottom:1px dashed var(--border-glass); padding-bottom:0.4rem;">
          <strong style="color:var(--text-primary);">${new Date(h.updatedAt).toLocaleString()}</strong>
          <div style="text-align:right;">
            <div style="font-size:0.75rem; color:var(--text-muted);">Zapisana przez: <strong style="color:var(--text-secondary);">${h.lastEditedBy || h.userName || '—'}</strong></div>
            <div style="font-size:0.75rem; color:var(--text-muted);">Nadpisana przez: <strong style="color:var(--accent);">${nextState.lastEditedBy || nextState.userName || '—'}</strong></div>
          </div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-size:0.85rem; color:var(--text-secondary);">Wersja przed zmianą</div>
            <div style="font-size:1.1rem; font-weight:700;">💰 ${fmt(h.totalBrutto)} PLN</div>
            <div style="font-size:0.8rem; color:var(--text-muted);">Pozycji: ${h.items ? h.items.length : 0}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:0.2rem;">Różnica do kolejnej wersji:</div>
            ${diffHtml}
            <div style="margin-top:0.6rem;">
              <button class="btn btn-sm btn-secondary" onclick="restoreOfferVersion('${id}', ${i})">Pobierz do edycji</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).reverse().join('');

  overlay.innerHTML = `
    <div class="modal" style="max-width:800px; width:95%; border-radius:12px; max-height:90vh; display:flex; flex-direction:column;">
      <div class="modal-header" style="border-bottom:1px solid var(--border); padding-bottom:0.8rem;">
        <h3 style="font-weight:700;">⏳ Historia zmian oferty: ${offer.number}</h3>
        <button class="btn-icon" onclick="closeModal()">✕</button>
      </div>
      <div style="padding:1rem 0; overflow-y:auto; flex:1;">
        ${historyHtml}
      </div>
    </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
}

function restoreOfferVersion(offerId, historyIndex) {
  const offer = offers.find(o => o.id === offerId);
  if (!offer || !offer.history || !offer.history[historyIndex]) return;

  const snapshot = offer.history[historyIndex];

  // Load snapshot as new offer with current editing id
  editingOfferId = offer.id;
  document.getElementById('offer-number').value = snapshot.number || offer.number;
  document.getElementById('offer-date').value = snapshot.date || offer.date;
  document.getElementById('client-name').value = snapshot.clientName || '';
  document.getElementById('client-nip').value = snapshot.clientNip || '';
  document.getElementById('client-address').value = snapshot.clientAddress || '';
  document.getElementById('client-contact').value = snapshot.clientContact || '';
  document.getElementById('invest-name').value = snapshot.investName || '';
  document.getElementById('invest-address').value = snapshot.investAddress || '';
  document.getElementById('invest-contractor').value = snapshot.investContractor || '';
  document.getElementById('offer-notes').value = snapshot.notes || '';
  document.getElementById('transport-km').value = snapshot.transportKm || 100;
  document.getElementById('transport-rate').value = snapshot.transportRate || 10;

  currentOfferItems = JSON.parse(JSON.stringify(snapshot.items || []));
  renderOfferItems();

  closeModal();
  showSection('offer');
  showToast('Wczytano starszą wersję w trybie edycji! Pamiętaj aby ją zapisać.', 'success');
}

/* ===== IMPORT OFFER FROM FILE ===== */
function importOfferFromFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.multiple = true;
  input.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    let imported = 0;
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const offer = JSON.parse(ev.target.result);
          if (!offer.number || !offer.items || !Array.isArray(offer.items)) {
            showToast(`Plik ${file.name} nie zawiera poprawnej oferty`, 'error');
            return;
          }
          // Check if offer with same id already exists
          const existingIdx = offers.findIndex(o => o.id === offer.id);
          if (existingIdx >= 0) {
            if (confirm(`Oferta "${offer.number}" już istnieje. Nadpisać?`)) {
              offers[existingIdx] = offer;
            } else {
              return;
            }
          } else {
            offers.push(offer);
          }
          imported++;
          saveOffersData(offers);
          renderSavedOffers();
          showToast(`Zaimportowano: ${offer.number}`, 'success');
        } catch (err) {
          showToast(`Błąd odczytu pliku ${file.name}`, 'error');
        }
      };
      reader.readAsText(file);
    });
  });
  input.click();
}

/* ===== PDF EXPORT ===== */
function exportOfferPDF(id) {
  const offer = offers.find(o => o.id === id);
  if (!offer) return;

  let totalNetto = 0, totalWeight = 0;
  const costPerTrip = offer.transportCostPerTrip || 0;

  // Recalculate transport for PDF
  const transportResult = calculateTransports(offer.items);
  const transportCost = transportResult.totalTransports * costPerTrip;
  const transportDist = calculateTransportDistributionStandalone(offer.items, costPerTrip);

  offer.items.forEach(item => {
    const priceAfterDiscount = item.unitPrice * (1 - item.discount / 100);
    const transportPerUnit = transportDist[item.productId] || 0;
    totalNetto += (priceAfterDiscount + transportPerUnit) * item.quantity;
    totalWeight += (item.weight || 0) * item.quantity;
  });

  const totalVat = totalNetto * 0.23;
  const totalBrutto = totalNetto + totalVat;

  // Transport table HTML
  let transportHtml = '';
  if (transportResult.lines.length > 0) {
    transportHtml = `<h3 style="font-size:13px;color:#2d3561;margin-top:18px;margin-bottom:6px">🚚 Transport (max 24 000 kg / kurs)</h3>
    <table><thead><tr><th>Produkt</th><th class="text-right">Ilość</th><th class="text-right">Waga/szt</th><th class="text-right">Łączna waga</th><th class="text-right">Max/transport</th><th class="text-right">Transporty</th></tr></thead><tbody>`;
    transportResult.lines.forEach(l => {
      transportHtml += `<tr><td>${l.name}</td><td class="text-right">${l.quantity}</td><td class="text-right">${fmtInt(l.weightPerPiece)} kg</td><td class="text-right">${fmtInt(l.totalWeight)} kg</td><td class="text-right">${l.maxPerTransport}</td><td class="text-right" style="font-weight:bold">${l.dedicatedTransports}</td></tr>`;
    });
    transportHtml += `</tbody></table>`;
    if (transportResult.saved > 0) {
      transportHtml += `<div style="font-size:11px;color:#059669;margin-top:4px">Optymalizacja: połączono niepełne transporty (${transportResult.lines.reduce((s, l) => s + l.dedicatedTransports, 0)} → ${transportResult.totalTransports})</div>`;
    }
  }

  const printWin = window.open('', '_blank');
  printWin.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Oferta ${offer.number}</title>
  <style>
    body{font-family:Arial,sans-serif;color:#1a1a2e;padding:30px;font-size:13px;line-height:1.5}
    h1{font-size:20px;color:#2d3561;margin-bottom:5px}
    .header-line{border-bottom:3px solid #2d3561;padding-bottom:10px;margin-bottom:15px}
    .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:20px}
    .info-box{background:#f4f6fb;border-radius:6px;padding:12px}
    .info-box h3{font-size:12px;color:#6b7280;text-transform:uppercase;margin-bottom:5px}
    table{width:100%;border-collapse:collapse;margin:15px 0;font-size:12px}
    th{background:#2d3561;color:#fff;padding:8px;text-align:left;font-size:11px}
    td{padding:7px 8px;border-bottom:1px solid #e5e7eb}
    tr:nth-child(even){background:#f9fafb}
    .text-right{text-align:right}
    .summary{background:#f0f4ff;border-radius:6px;padding:15px;margin-top:15px}
    .summary-row{display:flex;justify-content:space-between;padding:4px 0}
    .summary-row.total{font-weight:bold;font-size:15px;border-top:2px solid #2d3561;padding-top:8px;margin-top:5px}
    .summary-row.transport{color:#b45309}
    .notes{margin-top:15px;padding:10px;background:#fffbeb;border-left:3px solid #f59e0b;border-radius:4px;font-size:12px}
    .footer{margin-top:30px;font-size:11px;color:#6b7280;text-align:center;border-top:1px solid #e5e7eb;padding-top:10px}
  </style></head><body>
  <div class="header-line">
    <h1>OFERTA HANDLOWA</h1>
    <div style="display:flex;justify-content:space-between">
      <span><strong>Nr:</strong> ${offer.number}</span>
      <span><strong>Data:</strong> ${offer.date}</span>
    </div>
  </div>
  <div class="info-grid">
    <div class="info-box"><h3>Dane klienta</h3>
      ${offer.clientName ? `<div><strong>${offer.clientName}</strong></div>` : ''}
      ${offer.clientNip ? `<div>NIP: ${offer.clientNip}</div>` : ''}
      ${offer.clientAddress ? `<div>${offer.clientAddress}</div>` : ''}
      ${offer.clientContact ? `<div>Kontakt: ${offer.clientContact}</div>` : ''}
      ${offer.investName ? `<div style="margin-top:6px"><strong>Inwestycja:</strong> ${offer.investName}</div>` : ''}
      ${offer.investAddress ? `<div>Adres inwestycji: ${offer.investAddress}</div>` : ''}
    </div>
    <div class="info-box"><h3>Podsumowanie</h3>
      <div>Pozycji: ${offer.items.length}</div>
      <div>Łączna waga: ${fmtInt(totalWeight)} kg</div>
      <div>Transportów: ${transportResult.totalTransports}</div>
    </div>
  </div>
  <table>
    <thead><tr><th>Lp.</th><th>Indeks</th><th>Nazwa</th><th class="text-right">Cena jedn.</th><th class="text-right">Rabat</th><th class="text-right">Po rabacie</th><th class="text-right">Transport/szt.</th><th class="text-right">Ilość</th><th class="text-right">Netto</th><th class="text-right">Brutto</th></tr></thead>
    <tbody>${offer.items.map((item, i) => {
    const pad = item.unitPrice * (1 - item.discount / 100) + (item.pehdCostPerUnit || 0);
    const tpu = transportDist[item.productId] || 0;
    const unitTotal = pad + tpu;
    const n = unitTotal * item.quantity;

    let pName = item.name;
    if (item.pehdType === 'PEHD-3MM') pName += ' + PEHD 3mm';
    if (item.pehdType === 'PEHD-4MM') pName += ' + PEHD 4mm';

    return `<tr><td>${i + 1}</td><td>${item.productId}</td><td>${pName}${item.autoAdded ? ' (uszczelka)' : ''}</td><td class="text-right">${fmt(item.unitPrice)}</td><td class="text-right">${item.discount}%</td><td class="text-right">${fmt(unitTotal)}</td><td class="text-right">${tpu > 0 ? fmt(tpu) : '—'}</td><td class="text-right">${item.quantity}</td><td class="text-right">${fmt(n)}</td><td class="text-right">${fmt(n * 1.23)}</td></tr>`;
  }).join('')}</tbody>
  </table>
  ${transportHtml}
  <div class="summary">
    <div class="summary-row"><span>RAZEM netto (produkty + transport):</span><span>${fmt(totalNetto)} PLN</span></div>
    ${costPerTrip > 0 ? `<div class="summary-row transport"><span>w tym transport: ${offer.transportKm || '?'} km × ${fmt(offer.transportRate || 0)} PLN/km = ${fmt(costPerTrip)} PLN/kurs × ${transportResult.totalTransports} kursów</span><span>${fmt(transportCost)} PLN</span></div>` : ''}
    <div class="summary-row"><span>RAZEM netto:</span><span>${fmt(totalNetto)} PLN</span></div>
    <div class="summary-row"><span>VAT (23%):</span><span>${fmt(totalVat)} PLN</span></div>
    <div class="summary-row total"><span>SUMA BRUTTO:</span><span>${fmt(totalBrutto)} PLN</span></div>
  </div>
  ${offer.notes ? `<div class="notes"><strong>Uwagi:</strong> ${offer.notes}</div>` : ''}
  <div class="footer">Oferta wygenerowana automatycznie • WITROS</div>
  </body></html>`);
  printWin.document.close();
  setTimeout(() => printWin.print(), 500);
}

/* ===== CLIENTS DATABASE ===== */
function saveClientToDb() {
  const name = document.getElementById('client-name').value.trim();
  const nip = document.getElementById('client-nip').value.trim();
  const address = document.getElementById('client-address').value.trim();
  const contact = document.getElementById('client-contact').value.trim();

  if (!name) {
    showToast('Wprowadź nazwę firmy, aby zapisać klienta', 'error');
    return;
  }

  if (nip) {
    const existingByNip = clientsDb.find(c => c.nip === nip);
    if (existingByNip && existingByNip.name.toLowerCase() !== name.toLowerCase()) {
      showToast(`Firma z NIP ${nip} już istnieje w bazie danych`, 'error');
      return;
    }
  }

  const existingIdx = clientsDb.findIndex(c => c.name.toLowerCase() === name.toLowerCase());
  if (existingIdx >= 0) {
    if (confirm('Klient o takiej nazwie już istnieje. Zaktualizować dane?')) {
      clientsDb[existingIdx] = { ...clientsDb[existingIdx], name, nip, address, contact, updatedAt: new Date().toISOString() };
      saveClientsDbData(clientsDb);
      showToast('Zaktualizowano dane klienta', 'success');
    }
  } else {
    clientsDb.push({ id: Date.now().toString(), name, nip, address, contact, createdAt: new Date().toISOString() });
    saveClientsDbData(clientsDb);
    showToast('Zapisano nowego klienta', 'success');
  }
}

function showClientsDb() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'clients-db-modal';

  overlay.innerHTML = `
    <div class="modal" style="max-width:1200px; width:95%; border-radius:12px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.1); max-height:90vh; display:flex; flex-direction:column;">
      <div class="modal-header" style="border-bottom:1px solid var(--border); padding-bottom:0.8rem; margin-bottom:0;">
        <h3 style="font-size:1.25rem; font-weight:700; color:var(--text);">📂 Baza klientów <span style="font-size:0.8rem; font-weight:400; color:var(--text-muted);">(${clientsDb.length})</span></h3>
        <button class="btn-icon" onclick="closeModal()">✕</button>
      </div>
      <div style="padding:0.8rem 0; border-bottom:1px solid var(--border);">
        <div style="display:flex; gap:0.5rem; align-items:center;">
          <div style="position:relative; flex:1;">
            <input type="text" id="clients-search-input" placeholder="🔍 Szukaj po nazwie lub NIP..." 
              oninput="filterClientsDb(this.value)"
              style="width:100%; padding:0.6rem 0.8rem; border:1px solid var(--border); border-radius:8px; background:var(--bg); color:var(--text); font-size:0.85rem; outline:none; transition:border-color 0.2s;"
              onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='var(--border)'">
          </div>
        </div>
      </div>
      <div id="clients-db-list" style="flex:1; overflow-y:auto; padding:0.5rem 0;"></div>
    </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

  renderClientsDbList('');
  setTimeout(() => document.getElementById('clients-search-input')?.focus(), 100);
}

function filterClientsDb(query) {
  renderClientsDbList(query);
}

let editingClientId = null;

function renderClientsDbList(query) {
  const container = document.getElementById('clients-db-list');
  if (!container) return;

  const q = (query || '').toLowerCase().trim();
  const filtered = q ? clientsDb.filter(c =>
    (c.name && c.name.toLowerCase().includes(q)) ||
    (c.nip && c.nip.includes(q))
  ) : clientsDb;

  if (clientsDb.length === 0) {
    container.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:3rem; font-size:0.9rem;">Baza klientów jest pusta.<br><span style="font-size:0.8rem;">Zapisz klienta przyciskiem 💾 w formularzu oferty.</span></div>';
    return;
  }

  if (filtered.length === 0) {
    container.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:2rem; font-size:0.85rem;">Brak wyników dla „' + q + '"</div>';
    return;
  }

  let html = `<table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
    <thead>
      <tr style="border-bottom:2px solid var(--border); color:var(--text-muted); font-size:0.75rem; text-transform:uppercase; letter-spacing:0.5px;">
        <th style="padding:0.5rem 0.8rem; text-align:left; font-weight:600;">Firma</th>
        <th style="padding:0.5rem 0.8rem; text-align:left; font-weight:600; width:130px;">NIP</th>
        <th style="padding:0.5rem 0.8rem; text-align:left; font-weight:600;">Adres</th>
        <th style="padding:0.5rem 0.8rem; text-align:left; font-weight:600;">Kontakt</th>
        <th style="padding:0.5rem 0.8rem; text-align:center; font-weight:600; width:80px;">Akcje</th>
      </tr>
    </thead>
    <tbody>`;

  filtered.forEach(c => {
    if (editingClientId === c.id) {
      html += `<tr style="border-bottom:1px solid var(--border-glass); background:rgba(99,102,241,0.05);">
        <td style="padding:0.4rem 0.6rem;"><input type="text" id="edit-client-name" class="form-input form-input-sm" value="${c.name.replace(/"/g, '&quot;')}" style="width:100%" onclick="event.stopPropagation()"></td>
        <td style="padding:0.4rem 0.6rem;"><input type="text" id="edit-client-nip" class="form-input form-input-sm" value="${(c.nip || '').replace(/"/g, '&quot;')}" style="width:100%" onclick="event.stopPropagation()"></td>
        <td style="padding:0.4rem 0.6rem;"><input type="text" id="edit-client-address" class="form-input form-input-sm" value="${(c.address || '').replace(/"/g, '&quot;')}" style="width:100%" onclick="event.stopPropagation()"></td>
        <td style="padding:0.4rem 0.6rem;"><input type="text" id="edit-client-contact" class="form-input form-input-sm" value="${(c.contact || '').replace(/"/g, '&quot;')}" style="width:100%" onclick="event.stopPropagation()"></td>
        <td style="padding:0.4rem 0.6rem; text-align:center; display:flex; gap:0.2rem; justify-content:center;">
          <button class="btn-icon" onclick="event.stopPropagation(); saveEditedClientInDb('${c.id}')" title="Zapisz" style="color:var(--primary); font-size:1rem;">💾</button>
          <button class="btn-icon" onclick="event.stopPropagation(); cancelEditClient()" title="Anuluj" style="color:var(--text-muted); font-size:0.85rem;">✕</button>
        </td>
      </tr>`;
    } else {
      let nameDisplay = c.name;
      let nipDisplay = c.nip || '—';

      // Highlight matching text if searching
      if (q) {
        const nameIdx = c.name.toLowerCase().indexOf(q);
        if (nameIdx >= 0) {
          nameDisplay = c.name.substring(0, nameIdx) + '<mark style="background:rgba(99,102,241,0.3); color:var(--text); padding:0 2px; border-radius:2px;">' + c.name.substring(nameIdx, nameIdx + q.length) + '</mark>' + c.name.substring(nameIdx + q.length);
        }
        if (c.nip) {
          const nipIdx = c.nip.indexOf(q);
          if (nipIdx >= 0) {
            nipDisplay = c.nip.substring(0, nipIdx) + '<mark style="background:rgba(99,102,241,0.3); color:var(--text); padding:0 2px; border-radius:2px;">' + c.nip.substring(nipIdx, nipIdx + q.length) + '</mark>' + c.nip.substring(nipIdx + q.length);
          }
        }
      }

      html += `<tr onclick="selectClientFromDb('${c.id}')" 
        style="border-bottom:1px solid var(--border-glass); cursor:pointer; transition:background 0.15s;"
        onmouseenter="this.style.background='rgba(99,102,241,0.06)'" 
        onmouseleave="this.style.background='transparent'">
        <td style="padding:0.6rem 0.8rem; font-weight:600; color:var(--text);">${nameDisplay}</td>
        <td style="padding:0.6rem 0.8rem; font-family:monospace; font-size:0.8rem; color:var(--text-secondary);">${nipDisplay}</td>
        <td style="padding:0.6rem 0.8rem; color:var(--text-muted); font-size:0.8rem;">${c.address || '—'}</td>
        <td style="padding:0.6rem 0.8rem; color:var(--text-muted); font-size:0.8rem;">${c.contact || '—'}</td>
        <td style="padding:0.6rem 0.8rem; text-align:center; display:flex; gap:0.2rem; justify-content:center;">
          <button class="btn-icon" onclick="event.stopPropagation(); editClientInDb('${c.id}')" title="Edytuj" style="color:var(--text-secondary); font-size:0.85rem; opacity:0.8;">✏️</button>
          <button class="btn-icon" onclick="event.stopPropagation(); deleteClientFromDb('${c.id}')" title="Usuń z bazy" style="color:var(--danger); font-size:0.85rem; opacity:0.6;" onmouseenter="this.style.opacity='1'" onmouseleave="this.style.opacity='0.6'">✕</button>
        </td>
      </tr>`;
    }
  });

  html += '</tbody></table>';
  container.innerHTML = html;
}

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

  if (!name) {
    showToast('Wprowadź nazwę firmy', 'error');
    return;
  }

  const client = clientsDb.find(c => c.id === id);
  if (client) {
    client.name = name;
    client.nip = nip;
    client.address = address;
    client.contact = contact;
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

function selectClientFromDb(id) {
  const c = clientsDb.find(client => client.id === id);
  if (c) {
    document.getElementById('client-name').value = c.name || '';
    document.getElementById('client-nip').value = c.nip || '';
    document.getElementById('client-address').value = c.address || '';
    document.getElementById('client-contact').value = c.contact || '';
    showToast('Wczytano dane klienta', 'success');
    closeModal();
  }
}

function deleteClientFromDb(id) {
  if (!confirm('Czy na pewno chcesz usunąć tego klienta z bazy?')) return;
  clientsDb = clientsDb.filter(c => c.id !== id);
  saveClientsDbData(clientsDb);

  // Refresh list in-place
  const searchInput = document.getElementById('clients-search-input');
  renderClientsDbList(searchInput ? searchInput.value : '');
  showToast('Klient usunięty z bazy', 'info');
}

/* ===== ITEM-LEVEL DISCOUNT MODAL ===== */
let tempDiscounts = [];

function showItemDiscountModal() {
  if (currentOfferItems.length === 0) {
    showToast('Brak produktów w ofercie.', 'error');
    return;
  }

  // Create shallow copy of current discounts
  tempDiscounts = currentOfferItems.map(item => item.discount || 0);

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'item-discount-modal';

  overlay.innerHTML = `
    <div class="modal" style="max-width:1200px; width:95%; border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); max-height:90vh; display:flex; flex-direction:column;">
      <div class="modal-header" style="border-bottom: 1px solid var(--border); padding-bottom: 0.8rem; margin-bottom: 0.5rem;">
        <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--text);">% Edytuj rabaty pozycji</h3>
        <button class="btn-icon" onclick="closeModal()">✕</button>
      </div>
      
      <div style="overflow-y:auto; flex:1; padding-right:0.5rem;" id="discount-modal-list">
        <!-- JS will populate this -->
      </div>

      <div class="modal-footer" style="margin-top:1rem; border-top: 1px solid var(--border); padding-top: 1rem; display: flex; justify-content: space-between; align-items: center;">
        <div style="text-align:left;">
          <div style="font-size:0.9rem; color:var(--text-muted);">Suma Netto (po rabatach):</div>
          <div id="discount-modal-total" style="font-size:1.4rem; font-weight:800; color:var(--success);">0,00 PLN</div>
        </div>
        <div style="display:flex; gap: 1rem;">
          <button class="btn btn-secondary" onclick="closeModal()" style="padding: 0.75rem 1.5rem;">Anuluj</button>
          <button class="btn btn-primary" onclick="applyItemDiscounts()" style="padding: 0.75rem 2rem; font-size:1.05rem; font-weight: 600;">Zastosuj ➔</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

  renderDiscountModalItems();
}

function renderDiscountModalItems() {
  const container = document.getElementById('discount-modal-list');
  if (!container) return;

  let html = `<table style="width:100%; text-align:left; border-collapse:collapse;">
    <thead>
      <tr style="border-bottom:1px solid var(--border); font-size:0.75rem; color:var(--text-muted);">
        <th style="padding:0.4rem; width:50%;">Produkt</th>
        <th style="padding:0.4rem; width:15%; text-align:center;">Rabat (%)</th>
        <th style="padding:0.4rem; width:15%; text-align:right;">Cena jedn. po rabacie</th>
        <th style="padding:0.4rem; width:20%; text-align:right;">Wartość Netto</th>
      </tr>
    </thead>
    <tbody>`;

  let totalNetto = 0;

  // Build sorted list matching the offer table order
  const sortedItems = currentOfferItems.map((item, index) => {
    const product = products.find(p => p.id === item.productId);
    const category = product ? product.category : 'Inne';
    const catOrder = CATEGORIES.indexOf(category);
    const diameter = getProductDiameter(item.productId) || 99999;
    const isBB = item.name.toLowerCase().includes('bosy') || item.productId.endsWith('-B00');
    return { item, index, catOrder: catOrder === -1 ? 999 : catOrder, diameter, isBB, lengthM: item.lengthM || 0 };
  }).sort((a, b) => {
    if (a.catOrder !== b.catOrder) return a.catOrder - b.catOrder;
    if (a.diameter !== b.diameter) return a.diameter - b.diameter;
    if (a.isBB !== b.isBB) return a.isBB ? -1 : 1;
    return a.lengthM - b.lengthM;
  });

  sortedItems.forEach(({ item, index }) => {
    const d = tempDiscounts[index];
    const basePriceAfterDiscount = item.unitPrice * (1 - d / 100);
    const pehdCost = item.pehdCostPerUnit || 0;
    const priceAfterDiscount = basePriceAfterDiscount + pehdCost;
    const netto = priceAfterDiscount * item.quantity;

    totalNetto += netto;

    let pName = item.name;
    if (item.pehdType === 'PEHD-3MM') pName += ' <span style="display:inline-block; font-size:0.65rem; padding:0.15rem 0.4rem; background:#10b981; color:white; border-radius:4px; font-weight:700; box-shadow:0 0 8px rgba(16,185,129,0.3); vertical-align:middle;">+ PEHD 3mm</span>';
    if (item.pehdType === 'PEHD-4MM') pName += ' <span style="display:inline-block; font-size:0.65rem; padding:0.15rem 0.4rem; background:#10b981; color:white; border-radius:4px; font-weight:700; box-shadow:0 0 8px rgba(16,185,129,0.3); vertical-align:middle;">+ PEHD 4mm</span>';
    if (item.autoAdded) pName += ' <span style="font-size:.65rem;color:var(--warn);opacity:.8">(auto)</span>';

    const isGasket = item.autoAdded || item.name.toLowerCase().includes('uszczelk') || (item.productId && item.productId.includes('Y-U-GZ-U'));
    const warningText = isGasket ? '<div style="font-size:0.65rem; color:var(--danger); font-weight:700; margin-top:4px; line-height:1.2;">Uwaga rabat<br>na uszczelki !</div>' : '';

    html += `
      <tr style="border-bottom:1px solid var(--border-glass);">
        <td style="padding:0.4rem; font-size:0.8rem; font-weight:500;">
          ${pName} <br>
          <span style="font-size:0.7rem; color:var(--text-muted);">Ilość: ${item.quantity}</span>
        </td>
        <td style="padding:0.4rem; text-align:center; vertical-align:middle;">
          <input type="number" step="0.5" min="0" max="100" value="${d}" 
            onfocus="this.select()"
            oninput="updateTempDiscount(${index}, this)"
            onchange="checkGasketDiscount(${index}, this)"
            style="width:65px; padding:0.3rem; text-align:center; border:1px solid var(--border); border-radius:4px; font-weight:700; color:var(--primary); background:var(--bg);">
          ${warningText}
        </td>
        <td id="modal-price-${index}" style="padding:0.4rem; text-align:right; font-size:0.8rem;">${fmt(priceAfterDiscount)} PLN</td>
        <td id="modal-netto-${index}" style="padding:0.4rem; text-align:right; font-weight:700; color:var(--text-primary); font-size:0.9rem;">${fmt(netto)} PLN</td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;

  const totalEl = document.getElementById('discount-modal-total');
  if (totalEl) totalEl.textContent = `${fmt(totalNetto)} PLN`;
}

function updateTempDiscount(index, inputEl) {
  let val = inputEl.value;
  let v = parseFloat(val);
  if (isNaN(v)) v = 0;
  if (v < 0) v = 0;
  if (v > 100) {
    v = 100;
    inputEl.value = 100;
  }
  tempDiscounts[index] = v;

  // Live DOM update for this particular row
  const item = currentOfferItems[index];

  // Gasket warning moved to onchange via checkGasketDiscount()
  const basePriceAfterDiscount = item.unitPrice * (1 - v / 100);
  const pehdCost = item.pehdCostPerUnit || 0;
  const priceAfterDiscount = basePriceAfterDiscount + pehdCost;
  const netto = priceAfterDiscount * item.quantity;

  const priceTd = document.getElementById(`modal-price-${index}`);
  const nettoTd = document.getElementById(`modal-netto-${index}`);
  if (priceTd) priceTd.textContent = `${fmt(priceAfterDiscount)} PLN`;
  if (nettoTd) nettoTd.textContent = `${fmt(netto)} PLN`;

  // Recalculate and update the grand total
  let totalNetto = 0;
  currentOfferItems.forEach((it, idx) => {
    const d = tempDiscounts[idx];
    const bpad = it.unitPrice * (1 - d / 100);
    const pCost = it.pehdCostPerUnit || 0;
    totalNetto += (bpad + pCost) * it.quantity;
  });

  const totalEl = document.getElementById('discount-modal-total');
  if (totalEl) totalEl.textContent = `${fmt(totalNetto)} PLN`;
}

function checkGasketDiscount(index, inputEl) {
  const item = currentOfferItems[index];
  const v = parseFloat(inputEl.value) || 0;
  const isGasket = item.autoAdded || item.name.toLowerCase().includes('uszczelk') || (item.productId && item.productId.includes('Y-U-GZ-U'));
  if (isGasket && v > 0) {
    alert("UWAGA! Wpisujesz rabat na uszczelki!");
  }
}

function applyItemDiscounts() {
  currentOfferItems.forEach((item, index) => {
    item.discount = tempDiscounts[index];
  });

  closeModal();
  syncGaskets();
  renderOfferItems();
  updateOfferSummary();
  showToast('Zaktualizowano rabaty dla wybranych pozycji', 'success');
}

/* ===== XLSX EXPORT ===== */
function exportOfferXlsx(id) {
  const offer = offers.find(o => o.id === id);
  if (!offer) return;

  const costPerTrip = offer.transportCostPerTrip || 0;
  const transportResult = calculateTransports(offer.items);
  const transportDist = calculateTransportDistributionStandalone(offer.items, costPerTrip);
  const transportCost = transportResult.totalTransports * costPerTrip;

  // ─── Sheet 1: OFERTA ───
  const rows = [];

  // Header section
  rows.push(['OFERTA HANDLOWA']);
  rows.push([]);
  rows.push(['Nr oferty:', offer.number, '', 'Data:', offer.date]);
  rows.push([]);
  rows.push(['DANE KLIENTA']);
  rows.push(['Firma:', offer.clientName || '']);
  rows.push(['NIP:', offer.clientNip || '']);
  rows.push(['Adres:', offer.clientAddress || '']);
  rows.push(['Kontakt:', offer.clientContact || '']);
  rows.push([]);
  rows.push(['INWESTYCJA']);
  rows.push(['Nazwa:', offer.investName || '']);
  rows.push(['Adres:', offer.investAddress || '']);
  rows.push([]);
  rows.push(['TRANSPORT']);
  rows.push(['Kilometry:', offer.transportKm || 0, 'PLN/km:', offer.transportRate || 0]);
  rows.push(['Koszt/kurs:', costPerTrip, 'Ilość kursów:', transportResult.totalTransports]);
  rows.push([]);

  // Items table header
  const headerRow = 18; // 0-indexed row where item table header starts
  rows.push(['Lp.', 'Indeks', 'Nazwa produktu', 'PEHD', 'Cena jedn.', 'Ilość ✏️', 'Metry', 'Rabat % ✏️', 'Po rabacie', 'Transport/szt', 'Netto', 'Brutto', 'Waga/szt']);

  let totalNetto = 0;
  let totalWeight = 0;

  offer.items.forEach((item, i) => {
    const priceAfterDiscount = item.unitPrice * (1 - item.discount / 100);
    const pehdCost = item.pehdCostPerUnit || 0;
    const unitAfterDiscount = priceAfterDiscount + pehdCost;
    const tpu = transportDist[item.productId] || 0;
    const unitTotal = unitAfterDiscount + tpu;
    const netto = unitTotal * item.quantity;
    const brutto = netto * 1.23;

    totalNetto += netto;
    totalWeight += (item.weight || 0) * item.quantity;

    let pName = item.name;
    let pehdLabel = '';
    if (item.pehdType === 'PEHD-3MM') pehdLabel = 'PEHD 3mm';
    if (item.pehdType === 'PEHD-4MM') pehdLabel = 'PEHD 4mm';
    if (item.autoAdded) pName += ' (uszczelka)';

    rows.push([
      i + 1,
      item.productId,
      pName,
      pehdLabel,
      item.unitPrice,
      item.quantity,         // ✏️ editable
      item.meters || 0,
      item.discount,         // ✏️ editable
      unitAfterDiscount,
      tpu > 0 ? tpu : '',
      netto,
      brutto,
      item.weight || ''
    ]);
  });

  // Summary rows
  const totalVat = totalNetto * 0.23;
  const totalBrutto = totalNetto + totalVat;

  rows.push([]);
  rows.push(['', '', '', '', '', '', '', '', 'RAZEM Netto:', '', totalNetto]);
  rows.push(['', '', '', '', '', '', '', '', 'Transport:', '', transportCost]);
  rows.push(['', '', '', '', '', '', '', '', 'VAT (23%):', '', totalVat]);
  rows.push(['', '', '', '', '', '', '', '', 'SUMA BRUTTO:', '', totalBrutto]);
  rows.push([]);
  rows.push(['Łączna waga:', totalWeight, 'kg']);

  if (offer.notes) {
    rows.push([]);
    rows.push(['Uwagi:', offer.notes]);
  }

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Column widths
  ws['!cols'] = [
    { wch: 5 },   // Lp
    { wch: 20 },  // Indeks
    { wch: 55 },  // Nazwa
    { wch: 12 },  // PEHD
    { wch: 12 },  // Cena
    { wch: 10 },  // Ilość
    { wch: 10 },  // Metry
    { wch: 10 },  // Rabat
    { wch: 14 },  // Po rabacie
    { wch: 14 },  // Transport
    { wch: 14 },  // Netto
    { wch: 14 },  // Brutto
    { wch: 10 },  // Waga
  ];

  // Number formatting for currency columns
  const itemStartRow = headerRow + 1;
  const itemEndRow = itemStartRow + offer.items.length;
  for (let r = itemStartRow; r < itemEndRow; r++) {
    ['E', 'I', 'J', 'K', 'L'].forEach(col => {
      const ref = col + (r + 1);
      if (ws[ref] && typeof ws[ref].v === 'number') {
        ws[ref].z = '#,##0.00';
      }
    });
  }

  // Format summary numbers
  for (let r = itemEndRow + 1; r < rows.length; r++) {
    const ref = 'K' + (r + 1);
    if (ws[ref] && typeof ws[ref].v === 'number') {
      ws[ref].z = '#,##0.00';
    }
  }

  // ─── Sheet 2: METADATA (hidden data for re-import) ───
  const metaRows = [['KEY', 'VALUE']];
  metaRows.push(['offerId', offer.id]);
  metaRows.push(['number', offer.number]);
  metaRows.push(['date', offer.date]);
  metaRows.push(['clientName', offer.clientName || '']);
  metaRows.push(['clientNip', offer.clientNip || '']);
  metaRows.push(['clientAddress', offer.clientAddress || '']);
  metaRows.push(['clientContact', offer.clientContact || '']);
  metaRows.push(['investName', offer.investName || '']);
  metaRows.push(['investAddress', offer.investAddress || '']);
  metaRows.push(['notes', offer.notes || '']);
  metaRows.push(['transportKm', offer.transportKm || 0]);
  metaRows.push(['transportRate', offer.transportRate || 0]);
  metaRows.push(['itemCount', offer.items.length]);

  // Store full item data as JSON for lossless re-import
  offer.items.forEach((item, i) => {
    metaRows.push([`item_${i}`, JSON.stringify(item)]);
  });

  const wsMeta = XLSX.utils.aoa_to_sheet(metaRows);
  wsMeta['!cols'] = [{ wch: 15 }, { wch: 120 }];

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Oferta');
  XLSX.utils.book_append_sheet(wb, wsMeta, 'Dane');

  // Download
  const safeNumber = offer.number.replace(/[/\\:*?"<>|]/g, '_');
  XLSX.writeFile(wb, `Oferta_${safeNumber}_${offer.date}.xlsx`);
  showToast('Pobrano plik XLSX', 'success');
}

/* ===== XLSX IMPORT ===== */
function importOfferFromXlsx() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.xlsx,.xls';
  input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target.result);
        const wb = XLSX.read(data, { type: 'array' });

        // Try to find metadata sheet first (lossless import)
        const metaSheet = wb.Sheets['Dane'];
        if (metaSheet) {
          const metaData = XLSX.utils.sheet_to_json(metaSheet, { header: 1 });
          const meta = {};
          metaData.forEach(row => {
            if (row[0] && row[0] !== 'KEY') meta[row[0]] = row[1];
          });

          // Read items from metadata (full JSON roundtrip)
          const items = [];
          const itemCount = parseInt(meta.itemCount) || 0;
          for (let i = 0; i < itemCount; i++) {
            const key = `item_${i}`;
            if (meta[key]) {
              try {
                items.push(JSON.parse(meta[key]));
              } catch (e) { /* skip broken items */ }
            }
          }

          // Now check the Oferta sheet for user edits to quantity and discount
          const ofertaSheet = wb.Sheets['Oferta'];
          if (ofertaSheet) {
            const ofertaData = XLSX.utils.sheet_to_json(ofertaSheet, { header: 1 });

            // Find header row
            let headerRowIdx = -1;
            for (let r = 0; r < ofertaData.length; r++) {
              if (ofertaData[r] && ofertaData[r][0] === 'Lp.' && String(ofertaData[r][5]).includes('Ilość')) {
                headerRowIdx = r;
                break;
              }
            }

            if (headerRowIdx >= 0 && items.length > 0) {
              // Read edited values from the spreadsheet
              for (let i = 0; i < items.length; i++) {
                const row = ofertaData[headerRowIdx + 1 + i];
                if (!row) continue;

                const newQty = parseFloat(row[5]);
                const newDiscount = parseFloat(row[7]);

                if (!isNaN(newQty) && newQty >= 0) {
                  items[i].quantity = newQty;
                  if (items[i].lengthM) {
                    items[i].meters = newQty * items[i].lengthM;
                  }
                }
                if (!isNaN(newDiscount) && newDiscount >= 0 && newDiscount <= 100) {
                  items[i].discount = newDiscount;
                }
              }
            }
          }

          if (items.length === 0) {
            showToast('Plik nie zawiera pozycji oferty', 'error');
            return;
          }

          const transportKm = parseFloat(meta.transportKm) || 0;
          const transportRate = parseFloat(meta.transportRate) || 0;
          const transportCostPerTrip = transportKm * transportRate;
          const transportResult = calculateTransports(items);
          const transportDist = calculateTransportDistributionStandalone(items, transportCostPerTrip);

          let totalNetto = 0;
          items.forEach(item => {
            const priceAfterDiscount = item.unitPrice * (1 - item.discount / 100);
            const tpu = transportDist[item.productId] || 0;
            totalNetto += (priceAfterDiscount + tpu) * item.quantity;
          });

          const offer = {
            id: meta.offerId || 'offer_' + Date.now(),
            number: meta.number || 'XLSX-Import',
            date: meta.date || new Date().toISOString().slice(0, 10),
            clientName: meta.clientName || '',
            clientNip: meta.clientNip || '',
            clientAddress: meta.clientAddress || '',
            clientContact: meta.clientContact || '',
            investName: meta.investName || '',
            investAddress: meta.investAddress || '',
            notes: meta.notes || '',
            items,
            transportKm,
            transportRate,
            transportCostPerTrip,
            transportCount: transportResult.totalTransports,
            transportCost: transportResult.totalTransports * transportCostPerTrip,
            totalNetto,
            totalBrutto: totalNetto * 1.23,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          // Check for duplicate
          const existingIdx = offers.findIndex(o => o.id === offer.id);
          if (existingIdx >= 0) {
            if (confirm(`Oferta "${offer.number}" już istnieje. Nadpisać?`)) {
              offers[existingIdx] = offer;
            } else {
              return;
            }
          } else {
            offers.push(offer);
          }

          saveOffersData(offers);
          renderSavedOffers();
          showToast(`Zaimportowano z XLSX: ${offer.number}`, 'success');
        } else {
          showToast('Plik XLSX nie zawiera arkusza "Dane" — nie można zaimportować', 'error');
        }
      } catch (err) {
        console.error(err);
        showToast('Błąd odczytu pliku XLSX: ' + err.message, 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  });
  input.click();
}

// Automatically switch tab based on URL query parameter
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab');
  if (tab) {
    // If there's a button matching data-section, click it
    const tabBtn = document.querySelector(`.nav-btn[data-section="${tab}"]`);
    if (tabBtn) {
      // Delay slightly to ensure any initial setup (like auth) completes first
      setTimeout(() => tabBtn.click(), 100);
    }
  }
});
