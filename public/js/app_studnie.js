/* ============================
   WITROS — Kalkulator Studni
   app_studnie.js  (multi-well)
   ============================ */

/* ===== GLOBALS ===== */
let studnieProducts = [];
let currentUser = null;
let currentCennikTab = 'dn1000';

// Multi-well system
let wells = []; // Array of { id, name, dn, config: [{ productId, quantity }], rzednaWlazu, rzednaDna }
let currentWellIndex = 0;
let wellCounter = 1;
let wellDiscounts = {}; // Discounts per DN: { 1000: { dennica: 0, nadbudowa: 0 }, ... }

// Global offer-level defaults (persist until manually changed)
let offerDefaultZakonczenie = null;   // product ID or null (=konus)
let offerDefaultRedukcja = false;     // true = reduction to DN1000
let offerDefaultRedukcjaMinH = 2500;  // minimum bottom section height in mm
let offerDefaultRedukcjaZak = null;   // product ID for reduction top closure (DN1000)

// Multi-offer system
let offersStudnie = [];
let ordersStudnie = [];
let editingOfferIdStudnie = null;
let orderEditMode = null; // When editing an order: { orderId, order }
let clientsDb = [];

// Wizard state
let currentWizardStep = 1;
let wizardConfirmedParams = new Set();
const WIZARD_REQUIRED_PARAMS = ['nadbudowa', 'dennicaMaterial', 'wkladka', 'klasaBetonu', 'agresjaChemiczna', 'agresjaMrozowa', 'malowanieW', 'malowanieZ', 'kineta', 'redukcjaKinety', 'stopnie', 'spocznikH', 'usytuowanie'];

/* ===== FORMATTING ===== */
function fmt(n) { return n == null ? '—' : Number(n).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtInt(n) { return n == null ? '—' : Number(n).toLocaleString('pl-PL'); }

/* ===== AUTH ===== */
function getAuthToken() {
    const m = document.cookie.match(/(?:^|;\s*)authToken=([^;]*)/);
    return m ? m[1] : null;
}
function authHeaders() {
    const h = { 'Content-Type': 'application/json' };
    const t = getAuthToken();
    if (t) h['X-Auth-Token'] = t;
    return h;
}
function appLogout() {
    fetch('/api/auth/logout', { method: 'POST', headers: authHeaders() }).finally(() => {
        document.cookie = 'authToken=; Max-Age=0; path=/';
        window.location.href = 'index.html';
    });
}

/* ===== TOAST ===== */
function showToast(msg, type = 'info') {
    const c = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = msg;
    c.appendChild(el);
    setTimeout(() => el.classList.add('show'), 10);
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 3000);
}

/* ===== CARD TOGGLE ===== */
function toggleCard(contentId, iconId) {
    const content = document.getElementById(contentId);
    const icon = document.getElementById(iconId);
    if (!content) return;
    const isOpen = content.style.display !== 'none';
    content.style.display = isOpen ? 'none' : 'block';
    if (icon) icon.textContent = isOpen ? '🔽' : '🔼';
}

/* ===== NAVIGATION ===== */
function showSection(id) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('section-' + id)?.classList.add('active');
    document.querySelector(`.nav-btn[data-section="${id}"]`)?.classList.add('active');
    if (id === 'pricelist') renderStudniePriceList();
    if (id === 'saved') renderSavedOffersStudnie();
    if (id === 'offer') {
        syncOfferClientSummary();
        renderOfferSummary();
    }
}

function syncOfferClientSummary() {
    const v = id => document.getElementById(id)?.value || '—';
    const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    s('offer-disp-name', v('client-name'));
    s('offer-disp-nip', v('client-nip'));
    s('offer-disp-number', v('offer-number'));
    s('offer-disp-date', v('offer-date'));
    s('offer-disp-invest', v('invest-name'));
    const km = v('transport-km');
    const rate = v('transport-rate');
    s('offer-disp-transport', km !== '—' && rate !== '—' ? `${km} km × ${rate} PLN/km` : '—');
}

/* ===== OFFER NUMBER ===== */
function generateOfferNumberStudnie() {
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

    const count = typeof offersStudnie !== 'undefined' ? offersStudnie.length + 1 : 1;
    return `OS/${String(count).padStart(6, '0')}/${symbol}/${year}`;
}

/* ===== WIZARD ===== */
function goToWizardStep(step) {
    currentWizardStep = step;
    document.querySelectorAll('.wizard-step').forEach(s => s.classList.remove('active'));
    const target = document.getElementById('wizard-step-' + step);
    if (target) target.classList.add('active');
    updateWizardIndicator();
    if (step === 3) updateWizardSummaryBar();
    if (step === 2) validateWizardStep2();
}

function wizardNext() {
    wizardNavStep(currentWizardStep + 1);
}

function wizardPrev() {
    wizardNavStep(currentWizardStep - 1);
}

function wizardNavStep(targetStep) {
    if (targetStep === currentWizardStep || targetStep < 1 || targetStep > 3) return;

    // Allow backward navigation freely
    if (targetStep < currentWizardStep) {
        goToWizardStep(targetStep);
        return;
    }

    // Forward navigation
    if (targetStep === 2) {
        goToWizardStep(2);
    } else if (targetStep === 3) {
        // Always validate before allowing navigation to step 3
        if (!validateWizardStep2()) {
            showToast('Wybierz opcję w każdej grupie parametrów przed przejściem do konfiguracji', 'error');
            // If user tried to jump from step 1 directly to 3, take them to step 2 instead
            if (currentWizardStep === 1) goToWizardStep(2);
            return;
        }
        goToWizardStep(3);
    }
}

function getActiveTileValue(paramName) {
    const group = document.querySelector(`.param-group[data-param="${paramName}"]`);
    if (!group) return 'brak';
    const active = group.querySelector('.param-tile.active');
    return active ? active.getAttribute('data-val') : 'brak';
}

function validateWizardStep2() {
    const allConfirmed = WIZARD_REQUIRED_PARAMS.every(p => wizardConfirmedParams.has(p));

    // Read painting values from DOM tiles (works even without a well)
    const malowanieWVal = getActiveTileValue('malowanieW');
    const malowanieZVal = getActiveTileValue('malowanieZ');

    let powlokaWValid = true;
    if (malowanieWVal !== 'brak') {
        const pwW = document.getElementById('powloka-name-w');
        powlokaWValid = !!(pwW && pwW.value.trim() !== '');
    }

    let powlokaZValid = true;
    if (malowanieZVal !== 'brak') {
        const pwZ = document.getElementById('powloka-name-z');
        powlokaZValid = !!(pwZ && pwZ.value.trim() !== '');
    }

    // Show/hide powłoka name fields based on current tile selection
    const powlokaWGroup = document.getElementById('powloka-name-w-group');
    if (powlokaWGroup) powlokaWGroup.style.display = malowanieWVal !== 'brak' ? 'block' : 'none';
    const powlokaZGroup = document.getElementById('powloka-name-z-group');
    if (powlokaZGroup) powlokaZGroup.style.display = malowanieZVal !== 'brak' ? 'block' : 'none';

    // Clear hidden fields
    if (malowanieWVal === 'brak') {
        const pwWInput = document.getElementById('powloka-name-w');
        if (pwWInput) pwWInput.value = '';
    }
    if (malowanieZVal === 'brak') {
        const pwZInput = document.getElementById('powloka-name-z');
        if (pwZInput) pwZInput.value = '';
    }

    const isFullyValid = allConfirmed && powlokaWValid && powlokaZValid;

    const nextBtn = document.getElementById('wizard-next-step2');
    if (nextBtn) nextBtn.disabled = !isFullyValid;

    // Update visual state of each param group wrapper
    document.querySelectorAll('.wizard-param-group').forEach(wrapper => {
        const param = wrapper.dataset.wizardParam;
        if (!param) return;
        const confirmed = wizardConfirmedParams.has(param);
        wrapper.classList.toggle('confirmed', confirmed);
        wrapper.classList.toggle('needs-selection', !confirmed);
        const icon = wrapper.querySelector('.status-icon');
        if (icon) icon.textContent = confirmed ? '✅' : '⚠️';
    });

    const msg = document.getElementById('wizard-validation-msg');
    if (msg) msg.classList.toggle('hidden', isFullyValid);

    return isFullyValid;
}

function updateWizardIndicator() {
    const dots = document.querySelectorAll('.wizard-step-dot');
    dots.forEach(dot => {
        const step = parseInt(dot.dataset.step);
        dot.classList.remove('active', 'completed');
        if (step === currentWizardStep) dot.classList.add('active');
        else if (step < currentWizardStep) dot.classList.add('completed');
    });
    const line1 = document.getElementById('wizard-line-1');
    const line2 = document.getElementById('wizard-line-2');
    if (line1) line1.classList.toggle('completed', currentWizardStep > 1);
    if (line2) line2.classList.toggle('completed', currentWizardStep > 2);
}

function updateWizardSummaryBar() {
    const client = document.getElementById('client-name')?.value || '';
    const offer = document.getElementById('offer-number')?.value || '';
    const wsbClient = document.getElementById('wsb-client');
    const wsbOffer = document.getElementById('wsb-offer');
    const wsbParams = document.getElementById('wsb-params');
    if (wsbClient) wsbClient.textContent = client || '—';
    if (wsbOffer) wsbOffer.textContent = offer || '—';
    if (wsbParams) {
        const well = getCurrentWell();
        if (well) {
            const nadbudowa = well.nadbudowa === 'zelbetowa' ? 'Żelbet' : 'Beton';
            const denMat = well.dennicaMaterial === 'zelbetowa' ? 'Żelbet' : 'Beton';
            const wkl = well.wkladka === 'brak' ? '' : ` | PEHD ${well.wkladka}`;
            wsbParams.textContent = `Nadb: ${nadbudowa} | Den: ${denMat}${wkl}`;
        } else {
            wsbParams.textContent = '—';
        }
    }
}

function skipWizardToStep3() {
    wizardConfirmedParams = new Set(WIZARD_REQUIRED_PARAMS);
    goToWizardStep(3);
}

/* ===== STORAGE (REST API) ===== */
async function loadStudnieProducts() {
    try {
        const res = await fetch('/api/products-studnie');
        const json = await res.json();
        let saved = json.data;
        if (!saved) {
            const data = JSON.parse(JSON.stringify(DEFAULT_PRODUCTS_STUDNIE));
            data.forEach(renamePłyty);
            await fetch('/api/products-studnie', { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ data }) });
            return data;
        }
        saved.forEach(renamePłyty);
        return saved;
    } catch {
        const data = JSON.parse(JSON.stringify(DEFAULT_PRODUCTS_STUDNIE));
        data.forEach(renamePłyty);
        return data;
    }
}

function renamePłyty(p) {
    if (p && p.name) {
        p.name = p.name.replace(/Płyta Zamykająca/ig, 'Płyta Odciążająca')
            .replace(/Płyta Najazdowa/ig, 'Płyta Odciążająca');
    }
}

async function saveStudnieProducts(data) {
    try {
        await fetch('/api/products-studnie', { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ data }) });
    } catch (err) { console.error('saveStudnieProducts error:', err); }
}

/* ===== WELLS MANAGEMENT ===== */

/** Read the wizard step 2 global params from the UI tiles */
function getWizardGlobalParams() {
    const params = {
        nadbudowa: 'betonowa',
        dennicaMaterial: 'betonowa',
        wkladka: 'brak',
        klasaBetonu: 'C40/50',
        agresjaChemiczna: 'XA1',
        agresjaMrozowa: 'XF1',
        malowanieW: 'brak',
        malowanieZ: 'brak',
        powlokaNameW: '',
        powlokaNameZ: '',
        kineta: 'brak',
        redukcjaKinety: 'nie',
        stopnie: 'brak',
        spocznikH: '1/2',
        usytuowanie: 'w_osi'
    };
    // Read confirmed selections from wizard param tiles
    document.querySelectorAll('#wizard-step-2 .param-group').forEach(group => {
        const paramName = group.getAttribute('data-param');
        if (!paramName) return;
        const activeBtn = group.querySelector('.param-tile.active');
        if (activeBtn) {
            params[paramName] = activeBtn.getAttribute('data-val');
        }
    });
    // Read text inputs
    const pwW = document.getElementById('powloka-name-w');
    if (pwW) params.powlokaNameW = pwW.value || '';
    const pwZ = document.getElementById('powloka-name-z');
    if (pwZ) params.powlokaNameZ = pwZ.value || '';
    return params;
}

function createNewWell(name, dn = 1000) {
    wellCounter++;
    const gp = getWizardGlobalParams();
    return {
        id: 'well-' + Date.now() + '-' + wellCounter,
        name: name || ('Studnia DN' + dn + ' (#' + wellCounter + ')'),
        dn: dn,
        config: [],
        przejscia: [],
        rzednaWlazu: null,
        rzednaDna: null,
        numer: '',
        autoLocked: false,
        zakonczenie: offerDefaultZakonczenie,
        redukcjaDN1000: offerDefaultRedukcja,
        redukcjaMinH: offerDefaultRedukcjaMinH,
        redukcjaZakonczenie: offerDefaultRedukcjaZak,
        nadbudowa: gp.nadbudowa || gp.material || 'betonowa',
        dennicaMaterial: gp.dennicaMaterial || gp.material || 'betonowa',
        wkladka: gp.wkladka,
        klasaBetonu: gp.klasaBetonu,
        agresjaChemiczna: gp.agresjaChemiczna,
        agresjaMrozowa: gp.agresjaMrozowa,
        malowanieW: gp.malowanieW,
        malowanieZ: gp.malowanieZ,
        powlokaNameW: gp.powlokaNameW,
        powlokaNameZ: gp.powlokaNameZ,
        kineta: gp.kineta,
        redukcjaKinety: gp.redukcjaKinety,
        stopnie: gp.stopnie,
        spocznikH: gp.spocznikH,
        usytuowanie: gp.usytuowanie
    };
}

/* ===== OFFER LOCK (after order is created) ===== */
const OFFER_LOCKED_MSG = '🔒 Oferta zablokowana — posiada zamówienie. Edytuj zamówienie zamiast oferty.';
function isOfferLocked() {
    if (orderEditMode) return false; // Order editing mode is always allowed
    if (!editingOfferIdStudnie) return false;
    const offer = offersStudnie.find(o => o.id === editingOfferIdStudnie);
    if (!offer) return false;
    return !!(offer.hasOrder || ordersStudnie.some(ord => ord.offerId === offer.id));
}

function renderOfferLockBanner() {
    // Remove order-mode banner if present (we're not in order mode)
    const orderBanner = document.getElementById('order-mode-banner');
    if (orderBanner) orderBanner.style.display = 'none';

    let lockBanner = document.getElementById('offer-lock-banner');
    if (!lockBanner) {
        const builderSection = document.getElementById('section-builder');
        if (!builderSection) return;
        lockBanner = document.createElement('div');
        lockBanner.id = 'offer-lock-banner';
        builderSection.insertBefore(lockBanner, builderSection.firstChild);
    }

    if (!isOfferLocked()) {
        lockBanner.style.display = 'none';
        return;
    }

    const order = ordersStudnie.find(o => o.offerId === editingOfferIdStudnie);
    const orderId = order ? order.id : '';

    lockBanner.style.cssText = `
        display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.5rem;
        padding:0.7rem 1rem; margin-bottom:0.6rem; border-radius:10px;
        background: linear-gradient(135deg, rgba(239,68,68,0.12), rgba(245,158,11,0.08));
        border: 2px solid rgba(239,68,68,0.3);
    `;

    lockBanner.innerHTML = `
        <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
            <span style="font-size:1.3rem;">🔒</span>
            <div>
                <div style="font-size:0.82rem; font-weight:800; color:#f87171;">
                    OFERTA ZABLOKOWANA
                </div>
                <div style="font-size:0.65rem; color:var(--text-muted);">
                    Ta oferta posiada zamówienie — edycja jest zablokowana. Zmiany wprowadzaj na zamówieniu.
                </div>
            </div>
        </div>
        <div style="display:flex; gap:0.4rem; align-items:center;">
            ${orderId ? `<button class="btn btn-sm" onclick="window.location.href='/studnie?order=${orderId}'" style="background:rgba(16,185,129,0.2); border:1px solid rgba(16,185,129,0.4); color:#34d399; font-size:0.7rem; font-weight:700; padding:0.3rem 0.7rem;">
                📦 Edytuj zamówienie
            </button>` : ''}
        </div>
    `;
}

function addNewWell(dn = 1000) {
    if (isOfferLocked()) { showToast(OFFER_LOCKED_MSG, 'error'); return; }
    const defaultName = 'Studnia ' + wellCounter; // will use auto name if desired
    const well = createNewWell(null, dn);
    wells.push(well);
    currentWellIndex = wells.length - 1;
    // Auto switch builder tab
    const bcontentConcrete = document.getElementById('bcontent-concrete');
    if (bcontentConcrete && bcontentConcrete.style.display === 'none') {
        switchBuilderTab('concrete');
    }
    refreshAll();
    showToast(`Dodano: ${well.name}`, 'success');
}

function duplicateWell(index) {
    const src = wells[index];
    if (!src) return;
    wellCounter++;
    const copy = JSON.parse(JSON.stringify(src));
    copy.id = 'well-' + Date.now() + '-' + wellCounter;
    copy.name = src.name + ' (kopia)';
    wells.splice(index + 1, 0, copy);
    currentWellIndex = index + 1;
    refreshAll();
    showToast(`Skopiowano: ${copy.name}`, 'success');
}

function removeWell(index) {
    if (isOfferLocked()) { showToast(OFFER_LOCKED_MSG, 'error'); return; }
    if (!confirm(`Usunąć "${wells[index].name}"?`)) return;
    wells.splice(index, 1);
    if (currentWellIndex >= wells.length) currentWellIndex = Math.max(0, wells.length - 1);
    refreshAll();
    showToast('Studnia usunięta', 'info');
}

function selectWell(index) {
    if (index < 0 || index >= wells.length) return;
    currentWellIndex = index;
    refreshAll();
}

function renameWell(index) {
    const well = wells[index];
    if (!well) return;
    const name = prompt('Nazwa studni:', well.name);
    if (name && name.trim()) {
        well.name = name.trim();
        renderWellsList();
        renderOfferSummary();
    }
}

function getCurrentWell() {
    if (wells.length === 0) return null;
    return wells[currentWellIndex] || wells[0];
}

function refreshAll() {
    renderWellsList();
    renderTiles();
    renderWellConfig();
    renderWellPrzejscia();
    renderWellDiagram();
    updateSummary();
    updateDNButtons();
    syncElevationInputs();
    updateAutoLockUI();
    updateZakonczenieButton();
    updateRedukcjaButton();
    updateParamTilesUI();
    renderWellParams();
    renderOfferSummary();
    if (orderEditMode) renderOrderModeBanner();
}

/* ===== GENERAL PARAMS (TILES) ===== */
function setupParamTiles() {
    document.querySelectorAll('.param-group').forEach(group => {
        const paramName = group.getAttribute('data-param');
        group.querySelectorAll('.param-tile').forEach(btn => {
            btn.addEventListener('click', () => {
                const val = btn.getAttribute('data-val');
                const well = getCurrentWell();

                // Always toggle visual active state (for wizard step 2 without wells)
                group.querySelectorAll('.param-tile').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // If a well exists, apply param + re-render
                if (well) {
                    well[paramName] = val;
                    updateParamTilesUI();
                    autoSelectComponents(true);
                }

                // Wizard tracking (always)
                wizardConfirmedParams.add(paramName);
                validateWizardStep2();
            });
        });
    });
}

function updateParamTilesUI() {
    const well = getCurrentWell();
    if (well) {
        // Sync tiles to well object when well exists
        document.querySelectorAll('.param-group').forEach(group => {
            const paramName = group.getAttribute('data-param');
            const currentVal = well[paramName] || 'brak';
            group.querySelectorAll('.param-tile').forEach(btn => {
                if (btn.getAttribute('data-val') === currentVal) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        });

        // Sync powłoka inputs from well
        const powlokaWInput = document.getElementById('powloka-name-w');
        if (powlokaWInput) powlokaWInput.value = well.powlokaNameW || '';
        const powlokaZInput = document.getElementById('powloka-name-z');
        if (powlokaZInput) powlokaZInput.value = well.powlokaNameZ || '';
    }
    // Note: when no well, tiles keep their visual state from click handlers

    // Show/hide powłoka name fields based on current tile state (works with or without well)
    const malowanieWVal = getActiveTileValue('malowanieW');
    const malowanieZVal = getActiveTileValue('malowanieZ');

    const powlokaWGroup = document.getElementById('powloka-name-w-group');
    if (powlokaWGroup) powlokaWGroup.style.display = malowanieWVal !== 'brak' ? 'block' : 'none';
    const powlokaZGroup = document.getElementById('powloka-name-z-group');
    if (powlokaZGroup) powlokaZGroup.style.display = malowanieZVal !== 'brak' ? 'block' : 'none';

    if (malowanieWVal === 'brak') {
        const pwWInput = document.getElementById('powloka-name-w');
        if (pwWInput) pwWInput.value = '';
        if (well) well.powlokaNameW = '';
    }
    if (malowanieZVal === 'brak') {
        const pwZInput = document.getElementById('powloka-name-z');
        if (pwZInput) pwZInput.value = '';
        if (well) well.powlokaNameZ = '';
    }
}

/* ===== PER-WELL PARAMS RENDERING ===== */
const WELL_PARAM_DEFS = [
    { key: 'nadbudowa', label: 'Nadbudowa', options: [['betonowa', 'Beton'], ['zelbetowa', 'Żelbet']] },
    { key: 'dennicaMaterial', label: 'Dennica', options: [['betonowa', 'Beton'], ['zelbetowa', 'Żelbet']] },
    { key: 'wkladka', label: 'Wkładka PEHD', options: [['brak', 'Brak'], ['3mm', '3mm'], ['4mm', '4mm']] },
    { key: 'klasaBetonu', label: 'Klasa betonu', options: [['C40/50', 'C40/50'], ['C40/50(HSR!!!!)', 'C40/50(HSR)'], ['C45/55', 'C45/55'], ['C45/55(HSR!!!!)', 'C45/55(HSR)'], ['C70/85', 'C70/85'], ['C70/80(HSR!!!!)', 'C70/80(HSR)']] },
    { key: 'agresjaChemiczna', label: 'Agresja chem.', options: [['XA1', 'XA1'], ['XA2', 'XA2'], ['XA3', 'XA3']] },
    { key: 'agresjaMrozowa', label: 'Agresja mroz.', options: [['XF1', 'XF1'], ['XF2', 'XF2'], ['XF3', 'XF3']] },
    { key: 'malowanieW', label: 'Malowanie wew.', options: [['brak', 'Brak'], ['kineta', 'Kineta'], ['kineta_dennica', 'Kineta+denn.'], ['cale', 'Całość']] },
    { key: 'malowanieZ', label: 'Malowanie zew.', options: [['brak', 'Brak'], ['zewnatrz', 'Zewnątrz']] },
    { key: 'kineta', label: 'Kineta', options: [['brak', 'Brak'], ['beton', 'Beton'], ['beton_gfk', 'Beton GFK'], ['klinkier', 'Klinkier'], ['preco', 'Preco'], ['precotop', 'PrecoTop'], ['unolith', 'UnoLith']] },
    { key: 'redukcjaKinety', label: 'Red. kinety', options: [['tak', 'Tak'], ['nie', 'Nie']] },
    { key: 'stopnie', label: 'Stopnie', options: [['brak', 'Brak'], ['drabinka', 'Drabinka'], ['nierdzewna', 'Nierdzewna']] },
    { key: 'spocznikH', label: 'Spocznik wys.', options: [['1/2', '1/2'], ['2/3', '2/3'], ['3/4', '3/4'], ['1/1', '1/1']] },
    { key: 'usytuowanie', label: 'Usytuowanie', options: [['linia_dolna', 'Linia dolna'], ['linia_gorna', 'Linia górna'], ['w_osi', 'W osi'], ['patrz_uwagi', 'Patrz uwagi']] }
];

function renderWellParams() {
    const container = document.getElementById('well-params-container');
    if (!container) return;
    const well = getCurrentWell();
    if (!well) {
        container.innerHTML = '<div style="text-align:center; padding:1rem; color:var(--text-muted); font-size:0.75rem;">Dodaj studnię aby edytować parametry</div>';
        return;
    }

    let html = `<div style="display:flex; flex-direction:column; gap:0.35rem;">`;

    WELL_PARAM_DEFS.forEach(def => {
        const currentVal = well[def.key] || '';

        html += `<div style="display:flex; align-items:center; gap:0.4rem; min-height:28px;">`;
        html += `<span style="font-size:0.62rem; color:var(--text-muted); font-weight:700; white-space:nowrap; min-width:85px; text-align:right;">${def.label}</span>`;
        html += `<div style="display:flex; gap:0.2rem; flex-wrap:wrap;">`;
        def.options.forEach(([val, lbl]) => {
            const isActive = val === currentVal;
            html += `<button onclick="updateWellParam('${def.key}','${val}')" style="
                padding:0.18rem 0.5rem; border-radius:5px; cursor:pointer; font-size:0.62rem; font-weight:${isActive ? '700' : '600'};
                border:1px solid ${isActive ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.06)'};
                background:${isActive ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.03)'};
                color:${isActive ? '#a78bfa' : 'var(--text-secondary)'};
                transition:all 0.15s ease;
                ${isActive ? 'box-shadow:0 0 6px rgba(99,102,241,0.15);' : ''}
            " onmouseenter="if(!${isActive}){this.style.borderColor='rgba(99,102,241,0.25)';this.style.background='rgba(255,255,255,0.06)'}"
               onmouseleave="if(!${isActive}){this.style.borderColor='rgba(255,255,255,0.06)';this.style.background='rgba(255,255,255,0.03)'}"
            >${lbl}</button>`;
        });
        html += `</div></div>`;
    });

    html += `</div>`;
    html += `<div style="display:flex; gap:0.4rem; margin-top:0.5rem; justify-content:flex-end;">`;
    html += `<button class="btn btn-secondary btn-sm" onclick="resetWellParamsToDefaults()" style="font-size:0.65rem; padding:0.2rem 0.5rem;">🔄 Reset do domyślnych (Krok 2)</button>`;
    html += `</div>`;

    container.innerHTML = html;
}

function updateWellParam(paramKey, value) {
    if (isOfferLocked()) { showToast(OFFER_LOCKED_MSG, 'error'); return; }
    const well = getCurrentWell();
    if (!well) return;
    well[paramKey] = value;
    renderWellParams();
    updateParamTilesUI();
}

function resetWellParamsToDefaults() {
    const well = getCurrentWell();
    if (!well) return;
    const gp = getWizardGlobalParams();
    WELL_PARAM_DEFS.forEach(def => {
        if (gp[def.key] !== undefined) well[def.key] = gp[def.key];
    });
    // Also reset powłoka names
    well.powlokaNameW = gp.powlokaNameW || '';
    well.powlokaNameZ = gp.powlokaNameZ || '';
    renderWellParams();
    updateParamTilesUI();
    showToast('Parametry studni zresetowane do domyślnych z Kroku 2', 'success');
}

window.updateWellParam = updateWellParam;
window.resetWellParamsToDefaults = resetWellParamsToDefaults;

function updateParamInput(paramName, value) {
    const well = getCurrentWell();
    if (!well) return;
    well[paramName] = value;
}

/* ===== AUTO-LOCK (MANUAL MODE) ===== */
function toggleAutoLock() {
    const well = getCurrentWell();
    if (!well) { showToast('Najpierw dodaj studnię', 'error'); return; }
    well.autoLocked = !well.autoLocked;
    updateAutoLockUI();
}

function updateAutoLockUI() {
    const well = getCurrentWell();
    const btnLock = document.getElementById('btn-lock-auto');
    const btnAuto = document.getElementById('btn-auto-select');
    if (!btnLock || !btnAuto) return;
    if (!well) {
        btnLock.innerHTML = '🔓 Ręczny';
        btnLock.style.backgroundColor = 'var(--bg-glass)';
        btnLock.style.borderColor = 'var(--border-glass)';
        btnAuto.disabled = true;
        btnAuto.style.opacity = '0.4';
        return;
    }

    if (well.autoLocked) {
        btnLock.innerHTML = '🔒 Tryb ręczny (Włączony)';
        btnLock.style.backgroundColor = 'rgba(239, 68, 68, 0.2)'; // amber/red
        btnLock.style.borderColor = 'rgba(239, 68, 68, 0.5)';
        btnAuto.disabled = true;
        btnAuto.style.opacity = '0.4';
        btnAuto.style.cursor = 'not-allowed';
    } else {
        btnLock.innerHTML = '🔓 Tryb ręczny (Wyłączony)';
        btnLock.style.backgroundColor = 'var(--bg-glass)';
        btnLock.style.borderColor = 'var(--border-glass)';
        btnAuto.disabled = false;
        btnAuto.style.opacity = '1';
        btnAuto.style.cursor = 'pointer';
    }
}

/* ===== ZAKOŃCZENIE (TOP CLOSURE SELECTION) ===== */
function openZakonczeniePopup() {
    const well = getCurrentWell();
    if (!well) { showToast('Najpierw dodaj studnię', 'error'); return; }

    const dn = well.dn;
    const topClosureTypes = ['konus', 'plyta_din', 'plyta_najazdowa', 'plyta_zamykajaca', 'pierscien_odciazajacy'];

    // Find all top closure products for this DN (or universal ones with dn=null)
    const candidates = studnieProducts.filter(p =>
        topClosureTypes.includes(p.componentType) && (p.dn === dn || p.dn === null)
    );

    // Group by componentType for nicer display
    const typeLabels = {
        konus: '🔶 Konus',
        plyta_din: '🔽 Płyta DIN',
        plyta_najazdowa: '🔽 Płyta Odciążająca',
        plyta_zamykajaca: '🔽 Płyta Odciążająca',
        pierscien_odciazajacy: '⚙️ Pierścień Odciążający'
    };

    const typeColors = {
        konus: 'rgba(124,58,237,0.15)',
        plyta_din: 'rgba(30,58,95,0.3)',
        plyta_najazdowa: 'rgba(30,58,95,0.3)',
        plyta_zamykajaca: 'rgba(30,58,95,0.3)',
        pierscien_odciazajacy: 'rgba(30,58,95,0.3)'
    };

    const currentZak = well.zakonczenie;

    let tilesHtml = '';
    if (candidates.length === 0) {
        tilesHtml = '<div style="text-align:center; padding:2rem; color:var(--text-muted);">Brak elementów zakończenia dla DN ' + dn + '</div>';
    } else {
        // "Auto (Konus)" default tile
        const isAutoActive = !currentZak;
        tilesHtml += `<div onclick="selectZakonczenie(null)" style="
            padding:0.6rem 0.8rem; border-radius:8px; cursor:pointer; transition:all 0.15s;
            border:2px solid ${isAutoActive ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.08)'};
            background:${isAutoActive ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)'};
            ${isAutoActive ? 'box-shadow:0 0 12px rgba(99,102,241,0.2);' : ''}
        " onmouseenter="if(!${isAutoActive})this.style.borderColor='rgba(99,102,241,0.3)'"
           onmouseleave="if(!${isAutoActive})this.style.borderColor='rgba(255,255,255,0.08)'">
            <div style="font-weight:700; font-size:0.85rem; color:${isAutoActive ? '#a78bfa' : 'var(--text-primary)'};">🔄 Auto (Konus)</div>
            <div style="font-size:0.65rem; color:var(--text-muted); margin-top:0.15rem;">Domyślny konus dla DN ${dn}</div>
        </div>`;

        candidates.forEach(p => {
            const isActive = currentZak === p.id;
            const typeColor = typeColors[p.componentType] || 'rgba(255,255,255,0.05)';
            const typeLabel = typeLabels[p.componentType] || p.componentType;
            tilesHtml += `<div onclick="selectZakonczenie('${p.id}')" style="
                padding:0.6rem 0.8rem; border-radius:8px; cursor:pointer; transition:all 0.15s;
                border:2px solid ${isActive ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.08)'};
                background:${isActive ? 'rgba(99,102,241,0.15)' : typeColor};
                ${isActive ? 'box-shadow:0 0 12px rgba(99,102,241,0.2);' : ''}
            " onmouseenter="if(!${isActive})this.style.borderColor='rgba(99,102,241,0.3)'"
               onmouseleave="if(!${isActive})this.style.borderColor='rgba(255,255,255,0.08)'">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="font-weight:700; font-size:0.82rem; color:${isActive ? '#a78bfa' : 'var(--text-primary)'};">${typeLabel}</div>
                    ${isActive ? '<span style="font-size:0.6rem; color:#a78bfa; font-weight:700;">✔ AKTYWNE</span>' : ''}
                </div>
                <div style="font-size:0.7rem; color:var(--text-secondary); margin-top:0.15rem; font-weight:600;">${p.name}</div>
                <div style="display:flex; gap:0.8rem; margin-top:0.2rem; font-size:0.62rem; color:var(--text-muted);">
                    <span>ID: ${p.id}</span>
                    ${p.height ? '<span>H: ' + p.height + 'mm</span>' : ''}
                    <span style="color:var(--success);">${fmtInt(p.price)} PLN</span>
                </div>
            </div>`;
        });
    }

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
    <div class="modal" style="max-width:600px; width:95%; border-radius:12px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.3); max-height:85vh; display:flex; flex-direction:column;">
      <div class="modal-header" style="border-bottom:1px solid var(--border); padding-bottom:0.8rem;">
        <h3 style="font-size:1.1rem; font-weight:700; color:var(--text);">🔽 Zakończenie studni <span style="font-size:0.8rem; font-weight:400; color:var(--text-muted);">(${well.name} — DN ${dn})</span></h3>
        <p style="font-size:0.72rem; color:var(--text-muted); margin-top:0.3rem;">Wybierz domyślny element zakończenia górnego dla tej studni. Wybrany element będzie używany przez Auto-dobór.</p>
      </div>
      <div style="flex:1; overflow-y:auto; padding:0.8rem 0; display:grid; grid-template-columns:1fr; gap:0.5rem;">
        ${tilesHtml}
      </div>
      <div class="modal-footer" style="border-top:1px solid var(--border); padding-top:0.8rem;">
        <button class="btn btn-secondary" onclick="closeModal()">Zamknij</button>
      </div>
    </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
}

function selectZakonczenie(productId) {
    const well = getCurrentWell();
    if (!well) return;
    well.zakonczenie = productId;
    closeModal();

    // Save as offer-level default for new wells
    offerDefaultZakonczenie = productId;

    // Update button label to show current selection
    updateZakonczenieButton();

    if (productId) {
        const p = studnieProducts.find(pr => pr.id === productId);
        showToast(`Zakończenie: ${p ? p.name : productId}`, 'success');
    } else {
        showToast('Zakończenie: Auto (Konus)', 'success');
    }

    // Re-run auto-select if not locked
    if (!well.autoLocked) {
        autoSelectComponents(true);
    }
    refreshAll();
}

function updateZakonczenieButton() {
    const btn = document.getElementById('btn-zakonczenie');
    if (!btn) return;
    const well = getCurrentWell();
    if (!well) return;
    if (well.zakonczenie) {
        const p = studnieProducts.find(pr => pr.id === well.zakonczenie);
        const shortName = p ? (p.name.length > 12 ? p.name.substring(0, 12) + '…' : p.name) : well.zakonczenie;
        btn.innerHTML = '🔽 ' + shortName;
        btn.style.borderColor = 'rgba(99,102,241,0.4)';
        btn.style.color = '#a78bfa';
    } else {
        btn.innerHTML = '🔽 Zakończenie';
        btn.style.borderColor = 'var(--border-glass)';
        btn.style.color = '';
    }
}

/* ===== REDUKCJA DN1000 ===== */
function toggleRedukcja() {
    const well = getCurrentWell();
    if (!well) { showToast('Najpierw dodaj studnię', 'error'); return; }

    if (![1200, 1500, 2000, 2500].includes(well.dn)) {
        showToast('Redukcja DN1000 dostępna tylko dla studni DN ≥ 1200', 'error');
        return;
    }

    well.redukcjaDN1000 = !well.redukcjaDN1000;
    offerDefaultRedukcja = well.redukcjaDN1000;  // save as offer-level default
    updateRedukcjaButton();

    if (well.redukcjaDN1000) {
        showToast('Redukcja DN1000 — WŁĄCZONA', 'success');
    } else {
        showToast('Redukcja DN1000 — WYŁĄCZONA', 'info');
    }

    // Re-run autoselect if not locked
    if (!well.autoLocked) {
        autoSelectComponents(true);
    }
    refreshAll();
}

function updateRedukcjaButton() {
    const btn = document.getElementById('btn-redukcja');
    if (!btn) return;
    const well = getCurrentWell();

    // Hide button for DN1000 wells (no reduction possible)
    if (!well || ![1200, 1500, 2000, 2500].includes(well.dn)) {
        btn.style.display = 'none';
        return;
    }
    btn.style.display = '';

    // Show/hide min height input next to button
    const minWrap = document.getElementById('redukcja-min-wrap');
    const minInput = document.getElementById('redukcja-min-h');

    if (well.redukcjaDN1000) {
        btn.innerHTML = '⏬ Redukcja DN1000 ✔';
        btn.style.borderColor = 'rgba(109,40,217,0.5)';
        btn.style.color = '#a78bfa';
        btn.style.background = 'rgba(109,40,217,0.15)';
        if (minWrap) minWrap.style.display = 'flex';
        if (minInput) minInput.value = ((well.redukcjaMinH || 2500) / 1000).toFixed(1);
    } else {
        btn.innerHTML = '⏬ Redukcja DN1000';
        btn.style.borderColor = 'var(--border-glass)';
        btn.style.color = '';
        btn.style.background = '';
        if (minWrap) minWrap.style.display = 'none';
    }
}

function onRedukcjaMinChange(val) {
    const well = getCurrentWell();
    if (!well) return;
    const mm = Math.round(parseFloat(val) * 1000) || 2500;
    well.redukcjaMinH = Math.max(500, Math.min(mm, 10000));
    offerDefaultRedukcjaMinH = well.redukcjaMinH;
    if (!well.autoLocked && well.redukcjaDN1000) {
        autoSelectComponents(true);
        refreshAll();
    }
}

function openRedukcjaZakonczeniePopup() {
    const well = getCurrentWell();
    if (!well) { showToast('Najpierw dodaj studnię', 'error'); return; }

    const topClosureTypes = ['konus', 'plyta_din', 'plyta_najazdowa', 'plyta_zamykajaca', 'pierscien_odciazajacy'];
    const dn1000Candidates = studnieProducts.filter(p =>
        topClosureTypes.includes(p.componentType) && p.dn === 1000
    );

    const typeLabels = {
        konus: '🔶 Konus',
        plyta_din: '🔽 Płyta DIN',
        plyta_najazdowa: '🔽 Płyta Odciążająca',
        plyta_zamykajaca: '🔽 Płyta Odciążająca',
        pierscien_odciazajacy: '⚙️ Pierścień Odciążający'
    };
    const typeColors = {
        konus: 'rgba(124,58,237,0.15)',
        plyta_din: 'rgba(30,58,95,0.3)',
        plyta_najazdowa: 'rgba(30,58,95,0.3)',
        plyta_zamykajaca: 'rgba(30,58,95,0.3)',
        pierscien_odciazajacy: 'rgba(30,58,95,0.3)'
    };

    const currentZak = well.redukcjaZakonczenie;

    const renderTile = (p, overrideLabel = null) => {
        if (!p) return '';
        const isActive = currentZak === p.id;
        const typeColor = typeColors[p.componentType] || 'rgba(255,255,255,0.05)';
        const typeLabel = overrideLabel || typeLabels[p.componentType] || p.componentType;
        return `<div onclick="selectRedukcjaZakonczenie('${p.id}')" style="
            padding:0.6rem 0.8rem; border-radius:8px; cursor:pointer; transition:all 0.15s;
            border:2px solid ${isActive ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.08)'};
            background:${isActive ? 'rgba(99,102,241,0.15)' : typeColor};
            ${isActive ? 'box-shadow:0 0 12px rgba(99,102,241,0.2);' : ''}
            display:flex; flex-direction:column; justify-content:space-between;
        " onmouseenter="if(!${isActive})this.style.borderColor='rgba(99,102,241,0.3)'"
           onmouseleave="if(!${isActive})this.style.borderColor='rgba(255,255,255,0.08)'">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="font-weight:700; font-size:0.82rem; color:${isActive ? '#a78bfa' : 'var(--text-primary)'};">${typeLabel}</div>
                ${isActive ? '<span style="font-size:0.6rem; color:#a78bfa; font-weight:700;">✔ AKTYWNE</span>' : ''}
            </div>
            <div style="flex-grow:1;"></div>
            <div style="font-size:0.7rem; color:var(--text-secondary); margin-top:0.3rem; font-weight:600;">${p.name}</div>
            <div style="display:flex; justify-content:space-between; margin-top:0.3rem; font-size:0.62rem; color:var(--text-muted);">
                ${p.height ? '<span>H: ' + p.height + 'mm</span>' : '<span></span>'}
                <span style="color:var(--success); font-weight:600;">${fmtInt(p.price)} PLN</span>
            </div>
        </div>`;
    };

    let tilesHtml = '';
    // Auto default tile spans 2 columns
    const isAutoActive = !currentZak;
    tilesHtml += `<div onclick="selectRedukcjaZakonczenie(null)" style="
        grid-column: 1 / -1;
        padding:0.6rem 0.8rem; border-radius:8px; cursor:pointer; transition:all 0.15s;
        border:2px solid ${isAutoActive ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.08)'};
        background:${isAutoActive ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)'};
        ${isAutoActive ? 'box-shadow:0 0 12px rgba(99,102,241,0.2);' : ''}
    " onmouseenter="if(!${isAutoActive})this.style.borderColor='rgba(99,102,241,0.3)'"
       onmouseleave="if(!${isAutoActive})this.style.borderColor='rgba(255,255,255,0.08)'">
        <div style="font-weight:700; font-size:0.85rem; color:${isAutoActive ? '#a78bfa' : 'var(--text-primary)'};">🔄 Auto (Konus DN1000)</div>
        <div style="font-size:0.65rem; color:var(--text-muted); margin-top:0.15rem;">Domyślny konus DN1000</div>
    </div>`;

    // Group items
    const konuses = dn1000Candidates.filter(p => p.componentType === 'konus');
    const dinPlates = dn1000Candidates.filter(p => p.componentType === 'plyta_din');
    const odcPlates = dn1000Candidates.filter(p => p.componentType === 'plyta_najazdowa' || p.componentType === 'plyta_zamykajaca');
    const rings = dn1000Candidates.filter(p => p.componentType === 'pierscien_odciazajacy');

    // Row 1: Konusy
    konuses.forEach(p => tilesHtml += renderTile(p));
    // If odd number, add invisible empty div to keep grid aligned (unlikely needed with grid-auto-rows but safe)
    if (konuses.length % 2 !== 0) tilesHtml += '<div></div>';

    // Row 2: DIN plates
    dinPlates.forEach(p => tilesHtml += renderTile(p));
    if (dinPlates.length % 2 !== 0) tilesHtml += '<div></div>';

    // Row 3: Płyty odciążające and Pierścienie
    // Usually there's a plate and a ring, let's put them together
    odcPlates.forEach(p => tilesHtml += renderTile(p));
    rings.forEach(p => tilesHtml += renderTile(p));

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
    <div class="modal" style="max-width:600px; width:95%; border-radius:12px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.3); max-height:85vh; display:flex; flex-direction:column;">
      <div class="modal-header" style="border-bottom:1px solid var(--border); padding-bottom:0.8rem;">
        <h3 style="font-size:1.1rem; font-weight:700; color:var(--text);">🔽 Zakończenie redukcji DN1000</h3>
        <p style="font-size:0.72rem; color:var(--text-muted); margin-top:0.3rem;">Wybierz zakończenie górne dla sekcji redukcji DN1000. Wybór elementu odciążającego automatycznie doda pierścień.</p>
      </div>
      <div style="overflow-y:auto; padding:0.8rem; display:grid; grid-template-columns: 1fr 1fr; gap:0.6rem;">
        ${tilesHtml}
      </div>
      <div class="modal-footer" style="border-top:1px solid var(--border); padding-top:0.6rem; text-align:right;">
        <button class="btn btn-secondary btn-sm" onclick="closeModal()" style="font-size:0.8rem;">Zamknij</button>
      </div>
    </div>`;
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
    document.body.appendChild(overlay);
}

function selectRedukcjaZakonczenie(productId) {
    const well = getCurrentWell();
    if (!well) return;
    well.redukcjaZakonczenie = productId;
    offerDefaultRedukcjaZak = productId;
    closeModal();

    // Update button label
    const btn = document.getElementById('btn-redukcja-zak');
    if (btn) {
        if (productId) {
            const p = studnieProducts.find(pr => pr.id === productId);
            btn.innerHTML = '🔽 ' + (p ? p.name.replace(/^.*?(Konus|Płyta|Pierścień)/i, '$1').substring(0, 18) : 'Zak. DN1000');
            btn.style.borderColor = 'rgba(99,102,241,0.5)';
            btn.style.color = '#a78bfa';
        } else {
            btn.innerHTML = '🔽 Zak. DN1000';
            btn.style.borderColor = 'var(--border-glass)';
            btn.style.color = '';
        }
    }

    if (productId) {
        const p = studnieProducts.find(pr => pr.id === productId);
        showToast(`Zakończenie redukcji: ${p ? p.name : productId}`, 'success');
    } else {
        showToast('Zakończenie redukcji: Auto (Konus DN1000)', 'success');
    }

    if (!well.autoLocked && well.redukcjaDN1000) {
        autoSelectComponents(true);
    }
    refreshAll();
}

/* ===== ELEVATIONS (RZĘDNE) ===== */
function updateElevations() {
    if (isOfferLocked()) { showToast(OFFER_LOCKED_MSG, 'error'); return; }
    const well = getCurrentWell();
    if (!well) { showToast('Najpierw dodaj studnię', 'error'); return; }
    const wlazInput = document.getElementById('input-rzedna-wlazu');
    const dnaInput = document.getElementById('input-rzedna-dna');

    well.rzednaWlazu = wlazInput.value !== '' ? parseFloat(wlazInput.value) : null;
    well.rzednaDna = dnaInput.value !== '' ? parseFloat(dnaInput.value) : 0; // domyślnie 0

    updateHeightIndicator();
    renderWellsList();
    autoSelectComponents(true);
}

function updateWellNumer() {
    if (isOfferLocked()) { showToast(OFFER_LOCKED_MSG, 'error'); return; }
    const well = getCurrentWell();
    if (!well) return;
    const numerInput = document.getElementById('input-well-numer');
    if (!numerInput) return;

    const newNumer = numerInput.value.trim();
    checkWellNumerDuplicate(newNumer, numerInput);

    well.numer = newNumer;
    well.name = well.numer || ('Studnia DN' + well.dn + ' (#' + (currentWellIndex + 1) + ')');
    renderWellsList();
    updateSummary();
}

function checkWellNumerDuplicate(newNumer, inputEl) {
    if (!inputEl) return false;
    if (newNumer !== '') {
        const isDuplicate = wells.some((w, idx) => idx !== currentWellIndex && w.numer && w.numer.toLowerCase() === newNumer.toLowerCase());
        if (isDuplicate) {
            inputEl.style.borderColor = '#ef4444';
            inputEl.style.color = '#ef4444';
            inputEl.style.boxShadow = '0 0 10px rgba(239, 68, 68, 0.2)';
            showToast(`⚠️ Numer studni "${newNumer}" już istnieje! Zmień numer, aby uniknąć duplikatów.`, 'error');
            return true; // is duplicate
        }
    }
    // reset styling
    inputEl.style.borderColor = 'var(--border-glass)';
    inputEl.style.color = '#a78bfa';
    inputEl.style.boxShadow = 'none';
    return false;
}

function syncElevationInputs() {
    const well = getCurrentWell();
    const wlazInput = document.getElementById('input-rzedna-wlazu');
    const dnaInput = document.getElementById('input-rzedna-dna');
    const numerInput = document.getElementById('input-well-numer');
    if (!well) {
        if (wlazInput) wlazInput.value = '';
        if (dnaInput) dnaInput.value = '';
        if (numerInput) {
            numerInput.value = '';
            checkWellNumerDuplicate('', numerInput);
        }
        updateHeightIndicator();
        return;
    }
    if (wlazInput) wlazInput.value = well.rzednaWlazu != null ? well.rzednaWlazu : '';
    if (dnaInput) dnaInput.value = well.rzednaDna != null ? well.rzednaDna : '';
    if (numerInput) {
        numerInput.value = well.numer || '';
        checkWellNumerDuplicate(numerInput.value.trim(), numerInput);
    }
    updateHeightIndicator();
}

function updateHeightIndicator() {
    const well = getCurrentWell();
    const reqEl = document.getElementById('well-required-height');
    const confEl = document.getElementById('well-configured-height');
    const diffEl = document.getElementById('height-diff-indicator');
    if (!reqEl || !confEl || !diffEl) return;
    if (!well) {
        confEl.textContent = '0 m';
        reqEl.textContent = '— m';
        diffEl.innerHTML = '';
        return;
    }

    const stats = calcWellStats(well);
    const confM = (stats.height / 1000).toFixed(2).replace('.', ',');
    confEl.textContent = confM + ' m';

    const rzDna = well.rzednaDna != null ? well.rzednaDna : 0;

    if (well.rzednaWlazu != null && well.rzednaWlazu > rzDna) {
        const requiredMm = Math.round((well.rzednaWlazu - rzDna) * 1000);
        const reqM = (requiredMm / 1000).toFixed(2).replace('.', ',');
        reqEl.textContent = reqM + ' m';

        const diff = stats.height - requiredMm;
        if (Math.abs(diff) <= 50) {
            diffEl.innerHTML = '<span style="color:#10b981;">✅ Wysokość OK</span>';
        } else if (diff > 0) {
            const diffM = (diff / 1000).toFixed(2).replace('.', ',');
            diffEl.innerHTML = `<span style="color:#f59e0b;">⚠️ +${diffM} m za dużo</span>`;
        } else {
            const diffM = (Math.abs(diff) / 1000).toFixed(2).replace('.', ',');
            diffEl.innerHTML = `<span style="color:#f87171;">⚠️ Brakuje ${diffM} m</span>`;
        }
    } else {
        reqEl.textContent = '— m';
        diffEl.innerHTML = '';
    }
}

/* ===== AUTO-SELECT COMPONENTS ===== */
/*
 * ZASADY DOBORU ELEMENTÓW:
 * 1. Zakończenie studni (góra) — TYLKO jedno z trzech:
 *    a) Płyta (PZE — płyta zamykająca)
 *    b) Konus (stożek z PDD — płytą DIN na górze)
 *    c) Płyta z pierścieniem odciążającym (PZE + PO)
 * 2. Regulacja: pierścienie AVR — max 300mm (30 cm) łącznie
 * 3. Tolerancja: do -50mm poniżej wymaganej wysokości
 * 4. NIE przekraczać wysokości; jeśli brak wyjścia — max +20mm
 * 5. Preferuj najniższą dennicę
 * 6. Uwzględniaj zapasy przejść szczelnych
 * 7. Obsługuj redukcję DN → DN1000 (DN1200, DN1500, DN2000, DN2500)
 */
function autoSelectComponents(autoTriggered = false) {
    const well = getCurrentWell();
    if (!well) {
        if (!autoTriggered) showToast('Najpierw dodaj studnię', 'error');
        return;
    }

    if (well.autoLocked) {
        if (!autoTriggered) showToast('Auto-dobór jest zablokowany w Trybie Ręcznym.', 'error');
        return;
    }

    const dn = well.dn;

    const rzDna = well.rzednaDna != null ? well.rzednaDna : 0;

    if (well.rzednaWlazu == null || well.rzednaWlazu <= rzDna) {
        if (!autoTriggered) showToast('Ustaw rzędną włazu, aby auto-dobrać elementy (Rzędna Dna przyjęta jako 0)', 'error');
        return;
    }

    const requiredMm = Math.round((well.rzednaWlazu - rzDna) * 1000);
    if (requiredMm < 500) {
        if (!autoTriggered) showToast('Wymagana wysokość za mała (min. 500mm)', 'error');
        return;
    }

    const dnProducts = studnieProducts.filter(p => p.dn === dn);
    const allProducts = studnieProducts;

    // --- Available TOP components ---
    const topClosureTypes = ['plyta_din', 'plyta_najazdowa', 'plyta_zamykajaca', 'konus', 'pierscien_odciazajacy'];
    const selectedTopItem = well.config.find(item => {
        const p = studnieProducts.find(pr => pr.id === item.productId);
        return p && topClosureTypes.includes(p.componentType);
    });

    let topProd;

    if (!selectedTopItem) {
        let defaultTop = null;
        // Use well.zakonczenie preference if set AND matches current DN
        if (well.zakonczenie) {
            defaultTop = studnieProducts.find(p => p.id === well.zakonczenie && (p.dn === dn || p.dn === null));
        }
        // Default by DN: DN1000/1200/1500 → konus, DN2000/2500 → płyta DIN standard
        if (!defaultTop) {
            if ([2000, 2500].includes(dn)) {
                // Large wells: płyta DIN first, then konus
                defaultTop = dnProducts.find(p => p.componentType === 'plyta_din');
                if (!defaultTop) defaultTop = dnProducts.find(p => p.componentType === 'konus');
            } else {
                // DN1000/1200/1500: konus first, then płyta DIN
                defaultTop = dnProducts.find(p => p.componentType === 'konus');
                if (!defaultTop) defaultTop = dnProducts.find(p => p.componentType === 'plyta_din');
            }
        }
        if (defaultTop) {
            well.config.unshift({ productId: defaultTop.id, quantity: 1 });
            topProd = defaultTop;
        } else {
            if (!autoTriggered) showToast('Nie znaleziono domyślnego zakończenia studni.', 'error');
            return;
        }
    } else {
        topProd = studnieProducts.find(pr => pr.id === selectedTopItem.productId);
    }

    // Build top config
    let labelParts = [];
    let items = [];
    let topHeight = 0;

    if (topProd.componentType === 'plyta_zamykajaca' || topProd.componentType === 'plyta_najazdowa' || topProd.componentType === 'pierscien_odciazajacy') {
        // Always pair plate + ring from the SAME DN
        const sameDnProducts = studnieProducts.filter(p => p.dn === topProd.dn);
        const paired = sameDnProducts.find(p => p.componentType === 'pierscien_odciazajacy');
        const plyta = (topProd.componentType === 'pierscien_odciazajacy')
            ? sameDnProducts.find(p => p.componentType === 'plyta_zamykajaca' || p.componentType === 'plyta_najazdowa')
            : topProd;
        if (paired && plyta) {
            labelParts.push(plyta.name + ' + Pierścień');
            items.push({ productId: plyta.id, quantity: 1 });
            items.push({ productId: paired.id, quantity: 1 });
            topHeight += plyta.height + paired.height;
        } else {
            labelParts.push(topProd.name);
            items.push({ productId: topProd.id, quantity: 1 });
            topHeight += topProd.height;
        }
    } else {
        labelParts.push(topProd.name);
        items.push({ productId: topProd.id, quantity: 1 });
        topHeight += topProd.height;
    }

    // Add Wlaz
    let wlazItem = well.config.find(c => {
        const pr = studnieProducts.find(p => p.id === c.productId);
        return pr && pr.componentType === 'wlaz';
    });
    if (!wlazItem) {
        const wlaz150 = studnieProducts.find(p => p.id === 'WLAZ-150');
        if (wlaz150) wlazItem = { productId: wlaz150.id, quantity: 1 };
    }
    if (wlazItem) {
        const wlazProd = studnieProducts.find(p => p.id === wlazItem.productId);
        if (wlazProd) {
            items.unshift(wlazItem);
            topHeight += wlazProd.height * wlazItem.quantity;
            labelParts.unshift(wlazProd.name);
        }
    }

    const topConfigs = [];
    const isRelief = ['plyta_zamykajaca', 'plyta_najazdowa', 'pierscien_odciazajacy'].includes(topProd.componentType);

    if (items.length > 0) {
        topConfigs.push({ label: labelParts.join(' + '), items: items, height: topHeight, isRelief: isRelief });
    }

    // Auto-fallback: If user chose plate + ring, but well is too short to fit any krąg, fall back to Płyta DIN
    if (isRelief) {
        let dinProd = dnProducts.find(p => p.componentType === 'plyta_din');
        if (!dinProd) dinProd = dnProducts.find(p => p.componentType === 'konus'); // ultimate fallback
        if (dinProd) {
            let fbItems = [{ productId: dinProd.id, quantity: 1 }];
            let fbHeight = dinProd.height;
            let fbLabel = dinProd.name;
            if (wlazItem) {
                const wp = studnieProducts.find(p => p.id === wlazItem.productId);
                if (wp) {
                    fbItems.unshift(wlazItem);
                    fbHeight += wp.height * wlazItem.quantity;
                    fbLabel = wp.name + ' + ' + fbLabel;
                }
            }
            topConfigs.push({ label: fbLabel, items: fbItems, height: fbHeight, isRelief: false });
        }
    }

    if (topConfigs.length === 0) {
        showToast('Błąd konfiguracji wybranego zakończenia.', 'error');
        return;
    }

    // --- Body components (main DN) ---
    const dennicy = dnProducts.filter(p => p.componentType === 'dennica').sort((a, b) => a.height - b.height);
    const kregi = dnProducts.filter(p => p.componentType === 'krag').sort((a, b) => b.height - a.height);
    const avrRings = allProducts.filter(p => p.componentType === 'avr').sort((a, b) => b.height - a.height);

    // --- Reduction DN1000 components (for DN1200/1500/2000) ---
    const dn1000Products = studnieProducts.filter(p => p.dn === 1000);
    const dn1000Kregi = dn1000Products.filter(p => p.componentType === 'krag').sort((a, b) => b.height - a.height);
    const reductionPlate = dnProducts.find(p => p.componentType === 'plyta_redukcyjna');
    let canReduce = well.redukcjaDN1000 && [1200, 1500, 2000, 2500].includes(dn) && reductionPlate;

    // ===== HELPER: Fill kręgi greedily (largest first) =====
    function fillKregi(target, kregiList) {
        const kregItems = [];
        let filled = 0;
        if (target > 0) {
            let left = target;
            for (const krag of kregiList) {
                if (left <= 0) break;
                const qty = Math.floor(left / krag.height);
                if (qty > 0) {
                    kregItems.push({ productId: krag.id, quantity: qty });
                    filled += krag.height * qty;
                    left -= krag.height * qty;
                }
            }
        }
        return { kregItems, filled };
    }

    // ===== HELPER: Fill AVR =====
    function fillAVR(deficit, maxAvr) {
        let avrHeight = 0;
        const avrItems = [];
        if (deficit > 0 && deficit <= maxAvr) {
            let left = deficit;
            for (const avr of avrRings) {
                if (left <= 0) break;
                const qty = Math.floor(left / avr.height);
                if (qty > 0) {
                    avrItems.push({ productId: avr.id, quantity: qty });
                    avrHeight += avr.height * qty;
                    left -= avr.height * qty;
                }
            }
        }
        return { avrItems, avrHeight };
    }

    // ===== HELPER: Validate przejścia against segment map =====
    // Przejścia nie mogą być na połączeniach (jointach) elementów.
    // JOINT_MARGIN = minimalna odległość od krawędzi elementu (góra/dół)
    const JOINT_MARGIN = 50; // mm
    function validatePrzejscia(bottomUp) {
        if (!well.przejscia || well.przejscia.length === 0) return true;
        for (const pr of well.przejscia) {
            let pel = parseFloat(pr.rzednaWlaczenia);
            if (isNaN(pel)) pel = rzDna;
            const mmFromBottom = (pel - rzDna) * 1000;
            const pprod = studnieProducts.find(x => x.id === pr.productId);
            if (!pprod) continue;
            let prDN = 160;
            if (typeof pprod.dn === 'string' && pprod.dn.includes('/')) {
                prDN = parseFloat(pprod.dn.split('/')[1]) || 160; // Use height for validation
            } else {
                prDN = parseFloat(pprod.dn) || 160;
            }
            const zGora = parseFloat(pprod.zapasGora) || 0;
            const zDol = parseFloat(pprod.zapasDol) || 0;
            const holeBottom = mmFromBottom;
            const holeTop = mmFromBottom + prDN;
            let holeValid = false;
            for (let i = 0; i < bottomUp.length; i++) {
                const el = bottomUp[i];
                if (holeBottom >= el.start && holeTop <= el.end) {
                    const isBottomMost = (i === 0);
                    // Dolny zapas: max z zapasu cennikowego i marginesu od jointa
                    // Dla najniższego elementu (dennica na dnie) - dolny zapas = 0
                    const effectiveZDol = isBottomMost ? 0 : Math.max(zDol, JOINT_MARGIN);
                    // Górny zapas: max z zapasu cennikowego i marginesu od jointa
                    const effectiveZGora = Math.max(zGora, JOINT_MARGIN);
                    if (holeBottom >= el.start + effectiveZDol && holeTop <= el.end - effectiveZGora) {
                        holeValid = true;
                    }
                    break;
                }
            }
            if (!holeValid) return false;
        }
        return true;
    }

    // ===== HELPER: Build segment map from bottom =====
    function buildSegmentMap(dennica, kregItems, avrItems) {
        const bottomUp = [];
        bottomUp.push({ type: 'dennica', height: dennica.height, start: 0, end: dennica.height });
        let currY = dennica.height;
        for (const kItem of kregItems) {
            const kProd = studnieProducts.find(p => p.id === kItem.productId);
            if (!kProd) continue;
            for (let i = 0; i < kItem.quantity; i++) {
                bottomUp.push({ type: 'krag', height: kProd.height, start: currY, end: currY + kProd.height });
                currY += kProd.height;
            }
        }
        for (const aItem of avrItems) {
            const aProd = studnieProducts.find(p => p.id === aItem.productId);
            if (aProd) {
                for (let i = 0; i < aItem.quantity; i++) {
                    bottomUp.push({ type: 'avr', height: aProd.height, start: currY, end: currY + aProd.height });
                    currY += aProd.height;
                }
            }
        }
        return bottomUp;
    }

    // ===== MAIN SOLVER =====
    function solve(tolBelow, tolAbove, maxAvr, skipPrzejsciaCheck) {
        let bestSolution = null;
        let bestScore = Infinity;

        for (const topCfg of topConfigs) {
            const bodyTarget = requiredMm - topCfg.height;
            if (bodyTarget < 0) continue;

            // --- SCENARIO A: Normal (same DN) --- (skip if reduction is forced)
            if (!canReduce) for (const dennica of dennicy) {
                const kregTarget = bodyTarget - dennica.height;
                const { kregItems, filled: kregFilled } = fillKregi(kregTarget, kregi);

                // Rejection rule: If it's a relief plate but no krag could fit, reject this topCfg 
                // and wait for the loop to naturally move to the fallback DIN config
                if (topCfg.isRelief && kregItems.length === 0) continue;

                const totalWithoutAVR = topCfg.height + kregFilled + dennica.height;
                const deficit = requiredMm - totalWithoutAVR;
                if (deficit > maxAvr) continue;
                if (deficit < -tolAbove) continue;
                const { avrItems, avrHeight } = fillAVR(deficit, maxAvr);
                const totalFinal = totalWithoutAVR + avrHeight;
                const diff = totalFinal - requiredMm;
                if (diff > tolAbove) continue;
                if (diff < -tolBelow) continue;

                // Przejscia validation
                if (!skipPrzejsciaCheck) {
                    const segments = buildSegmentMap(dennica, kregItems, avrItems);
                    if (!validatePrzejscia(segments)) continue;
                }

                let score = dennica.height * 10000;
                if (diff >= 0) score += diff * 3;
                else score += Math.abs(diff);
                score += (kregItems.length + avrItems.length) * 0.1;

                if (score < bestScore) {
                    bestScore = score;
                    bestSolution = {
                        topItems: [...topCfg.items],
                        kregItems: [...kregItems],
                        dennica: { productId: dennica.id, quantity: 1 },
                        avrItems: [...avrItems],
                        totalHeight: totalFinal,
                        diff: diff,
                        topLabel: topCfg.label,
                        reductionItems: null
                    };
                }
            }

            // --- SCENARIO B: Reduction (DN → DN1000) ---
            // Structure: Dennica DN(well) + Kręgi DN(well) (min 2500mm combined) + Płyta redukcyjna + Kręgi DN1000 + Zakończenie DN1000
            if (canReduce) {
                const redHeight = reductionPlate.height; // 200mm
                const MIN_BOTTOM_SECTION = well.redukcjaMinH || 2500; // configurable minimum dennica + kręgi DN(well)

                // Top closure for reduction must be DN1000
                const dn1000TopProducts = dn1000Products.filter(p =>
                    ['konus', 'plyta_din', 'plyta_najazdowa', 'plyta_zamykajaca', 'pierscien_odciazajacy'].includes(p.componentType)
                );

                // Build DN1000 top config
                let redTopItems = [];
                let redTopHeight = 0;
                let redTopLabel = '';

                // Check if user selected a specific zakończenie for reduction
                const redZak = well.redukcjaZakonczenie;
                if (redZak) {
                    // Use the directly selected DN1000 product
                    const redProd = dn1000TopProducts.find(p => p.id === redZak);
                    if (redProd) {
                        // If plate type that needs pierścień, add as pair
                        if (redProd.componentType === 'plyta_najazdowa' || redProd.componentType === 'plyta_zamykajaca' || redProd.componentType === 'pierscien_odciazajacy') {
                            const pairedRing = dn1000Products.find(p => p.componentType === 'pierscien_odciazajacy');
                            const pairedPlate = (redProd.componentType === 'pierscien_odciazajacy')
                                ? dn1000Products.find(p => p.componentType === 'plyta_zamykajaca' || p.componentType === 'plyta_najazdowa')
                                : redProd;
                            if (pairedRing && pairedPlate) {
                                redTopItems.push({ productId: pairedPlate.id, quantity: 1 });
                                redTopItems.push({ productId: pairedRing.id, quantity: 1 });
                                redTopHeight += pairedPlate.height + pairedRing.height;
                                redTopLabel = pairedPlate.name + ' + Pierścień';
                            } else {
                                redTopItems.push({ productId: redProd.id, quantity: 1 });
                                redTopHeight += redProd.height;
                                redTopLabel = redProd.name;
                            }
                        } else {
                            redTopItems.push({ productId: redProd.id, quantity: 1 });
                            redTopHeight += redProd.height;
                            redTopLabel = redProd.name;
                        }
                    }
                }
                if (redTopItems.length === 0) {
                    // Reduction: konus DN1000 first, fallback to plyta_din DN1000
                    let dn1000Default = dn1000Products.find(p => p.componentType === 'konus');
                    if (!dn1000Default) dn1000Default = dn1000Products.find(p => p.componentType === 'plyta_din');
                    if (dn1000Default) {
                        redTopItems.push({ productId: dn1000Default.id, quantity: 1 });
                        redTopHeight += dn1000Default.height;
                        redTopLabel = dn1000Default.name;
                    }
                }

                // Add wlaz on top
                if (wlazItem) {
                    const wlazProd = studnieProducts.find(p => p.id === wlazItem.productId);
                    if (wlazProd) {
                        redTopItems.unshift(wlazItem);
                        redTopHeight += wlazProd.height * wlazItem.quantity;
                    }
                }

                for (const dennica of dennicy) {
                    // Bottom section: dennica + kręgi DN(well) must be >= MIN_BOTTOM_SECTION
                    const bottomNeeded = Math.max(MIN_BOTTOM_SECTION - dennica.height, 0);
                    const { kregItems: bottomKregItems, filled: bottomKregFilled } = fillKregi(bottomNeeded, kregi);
                    const actualBottomSection = dennica.height + bottomKregFilled;

                    // If bottom section is below minimum, try adding more
                    if (actualBottomSection < MIN_BOTTOM_SECTION - 100) continue; // allow 100mm tolerance

                    // Remaining height for DN1000 section
                    const dn1000SectionTarget = requiredMm - actualBottomSection - redHeight - redTopHeight;
                    if (dn1000SectionTarget < 0) continue;

                    const { kregItems: k1000Items, filled: k1000Filled } = fillKregi(dn1000SectionTarget, dn1000Kregi);

                    let currentRedTopItems = [...redTopItems];
                    let currentRedTopHeight = redTopHeight;
                    let currentRedTopLabel = redTopLabel;

                    // Fallback: If it's a relief plate but no DN1000 krag fits, switch to plyta DIN
                    const isRedTopRelief = redZak ? true : false; // roughly
                    const hasReliefName = redTopLabel.includes('Odciążająca');
                    if (hasReliefName && k1000Items.length === 0) {
                        let dn1000Default = dn1000Products.find(p => p.componentType === 'plyta_din');
                        if (!dn1000Default) dn1000Default = dn1000Products.find(p => p.componentType === 'konus');
                        if (dn1000Default) {
                            currentRedTopItems = [{ productId: dn1000Default.id, quantity: 1 }];
                            currentRedTopHeight = dn1000Default.height;
                            currentRedTopLabel = dn1000Default.name;
                            if (wlazItem) {
                                const wlazProd = studnieProducts.find(p => p.id === wlazItem.productId);
                                if (wlazProd) {
                                    currentRedTopItems.unshift(wlazItem);
                                    currentRedTopHeight += wlazProd.height * wlazItem.quantity;
                                }
                            }
                            // Recalculate k1000 items since top height changed
                            const newDn1000SectionTarget = requiredMm - actualBottomSection - redHeight - currentRedTopHeight;
                            const newFill = fillKregi(newDn1000SectionTarget, dn1000Kregi);
                            k1000Items.length = 0;
                            k1000Items.push(...newFill.kregItems);
                        }
                    }

                    // Recalculate k1000Filled properly
                    const k1000ActualFilled = k1000Items.reduce((acc, k) => {
                        const kp = studnieProducts.find(p => p.id === k.productId);
                        return acc + (kp ? kp.height * k.quantity : 0);
                    }, 0);

                    const totalWithoutAVR = currentRedTopHeight + actualBottomSection + redHeight + k1000ActualFilled;
                    const deficit = requiredMm - totalWithoutAVR;
                    if (deficit > maxAvr) continue;
                    if (deficit < -tolAbove) continue;
                    const { avrItems, avrHeight } = fillAVR(deficit, maxAvr);
                    const totalFinal = totalWithoutAVR + avrHeight;
                    const diff = totalFinal - requiredMm;
                    if (diff > tolAbove) continue;
                    if (diff < -tolBelow) continue;

                    if (!skipPrzejsciaCheck) {
                        // Build segment map: dennica + kręgi DN(well) + reduction + kręgi DN1000
                        const properSegments = [];
                        properSegments.push({ type: 'dennica', height: dennica.height, start: 0, end: dennica.height });
                        let cy = dennica.height;
                        for (const kItem of bottomKregItems) {
                            const kProd = studnieProducts.find(p => p.id === kItem.productId);
                            if (!kProd) continue;
                            for (let i = 0; i < kItem.quantity; i++) {
                                properSegments.push({ type: 'krag', height: kProd.height, start: cy, end: cy + kProd.height });
                                cy += kProd.height;
                            }
                        }
                        properSegments.push({ type: 'reduction', height: redHeight, start: cy, end: cy + redHeight });
                        cy += redHeight;
                        for (const kItem of k1000Items) {
                            const kProd = studnieProducts.find(p => p.id === kItem.productId);
                            if (!kProd) continue;
                            for (let i = 0; i < kItem.quantity; i++) {
                                properSegments.push({ type: 'krag', height: kProd.height, start: cy, end: cy + kProd.height });
                                cy += kProd.height;
                            }
                        }
                        if (!validatePrzejscia(properSegments)) continue;
                    }

                    // Reduction adds cost, so penalize slightly
                    let score = dennica.height * 10000 + 500;
                    if (diff >= 0) score += diff * 3;
                    else score += Math.abs(diff);
                    score += (bottomKregItems.length + k1000Items.length + avrItems.length) * 0.1;

                    if (score < bestScore) {
                        bestScore = score;
                        bestSolution = {
                            topItems: [...currentRedTopItems],
                            kregItems: [...k1000Items, { productId: reductionPlate.id, quantity: 1 }, ...bottomKregItems],
                            dennica: { productId: dennica.id, quantity: 1 },
                            avrItems: [...avrItems],
                            totalHeight: totalFinal,
                            diff: diff,
                            topLabel: currentRedTopLabel,
                            reductionItems: [{ productId: reductionPlate.id, quantity: 1 }]
                        };
                    }
                }
            }
        }
        return bestSolution;
    }

    // --- PASS 1: Strict tolerances (maxAvr = 260mm = 26cm max!) ---
    let bestSolution = solve(50, 20, 260, false);
    let fallback = false;

    // --- PASS 2: Relaxed tolerances if no solution ---
    if (!bestSolution) {
        bestSolution = solve(200, 100, 260, false);
        fallback = true;
    }

    // --- PASS 3: Skip przejscia check if still no solution ---
    if (!bestSolution) {
        bestSolution = solve(200, 100, 260, true);
        fallback = true;
    }

    // --- PASS 4-6: If reduction was enabled but no solution found, fall back to no reduction ---
    if (!bestSolution && canReduce) {
        canReduce = false; // temporarily disable reduction
        bestSolution = solve(50, 20, 260, false);
        if (!bestSolution) bestSolution = solve(200, 100, 260, false);
        if (!bestSolution) bestSolution = solve(200, 100, 260, true);
        if (bestSolution) {
            fallback = true;
            if (!autoTriggered) showToast('Studnia za niska na redukcję — dobrano bez redukcji', 'warning');
        }
        canReduce = true; // restore
    }

    if (!bestSolution) {
        if (!autoTriggered) showToast(`Nie znaleziono kombinacji dla ${fmtInt(requiredMm)} mm`, 'error');
        return;
    }

    // Build config in order: top → AVR → kręgi → dennica
    // For reduction: kręgi = [DN1000 kręgi, płyta redukcyjna, DN-well kręgi]
    const newConfig = [
        ...bestSolution.topItems,
        ...bestSolution.avrItems,
        ...bestSolution.kregItems,
        bestSolution.dennica
    ];

    well.config = newConfig;
    // Only sort if not a reduction well (reduction items are already in proper structural order)
    if (!bestSolution.reductionItems) {
        sortWellConfigByOrder();
    }
    refreshAll();

    const diffStr = bestSolution.diff >= 0
        ? `+${bestSolution.diff}mm`
        : `${bestSolution.diff}mm`;
    const redLabel = bestSolution.reductionItems ? ' + Redukcja DN1000' : '';
    const fallbackLabel = fallback ? ' ⚠️ (rozszerzona tolerancja)' : '';
    if (!autoTriggered) {
        showToast(`Auto-dobór: ${fmtInt(bestSolution.totalHeight)} mm (${diffStr}) | ${bestSolution.topLabel}${redLabel}${fallbackLabel}`, 'success');
    }
}

/* ===== WELLS LIST RENDERING ===== */
function renderWellsList() {
    const container = document.getElementById('wells-list');
    if (!container) return;

    let html = '';
    const dktCap = [1000, 1200, 1500, 2000, 2500];

    // Check for order changes if in edit mode
    let orderChanges = {};
    if (orderEditMode) {
        orderChanges = getOrderChanges({ ...orderEditMode.order, wells: wells });
    }

    dktCap.forEach(dnGroup => {
        const groupWells = wells.map((w, i) => ({ w, i })).filter(item => item.w.dn === dnGroup);
        if (groupWells.length === 0) return;

        html += `<div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; margin: 1.2rem 0 0.5rem 0.5rem; letter-spacing:1px; font-weight:700;">Studnie DN${dnGroup}</div>`;

        groupWells.forEach(({ w, i }) => {
            const isActive = i === currentWellIndex;
            const stats = calcWellStats(w);
            const hasElevations = w.rzednaWlazu != null && w.rzednaDna != null;
            const requiredH = hasElevations ? Math.round((w.rzednaWlazu - w.rzednaDna) * 1000) : null;

            let changeStyling = '';
            let changeBadge = '';
            if (orderEditMode && orderChanges[i]) {
                const changeType = orderChanges[i].type;
                if (changeType === 'added') {
                    changeStyling = 'border-left: 3px solid #10b981; background: rgba(16,185,129,0.05);';
                    changeBadge = '<span style="font-size:0.6rem; color:#10b981; font-weight:700; margin-left:0.3rem;">[NOWA]</span>';
                } else if (changeType === 'modified') {
                    changeStyling = 'border-left: 3px solid #ef4444; background: rgba(239,68,68,0.05);';
                    changeBadge = '<span style="font-size:0.6rem; color:#ef4444; font-weight:700; margin-left:0.3rem;">[ZMIENIONA]</span>';
                }
            }

            html += `<div class="well-list-item ${isActive ? 'active' : ''}" style="${changeStyling}" onclick="selectWell(${i})">
              <div class="well-list-header">
                <div class="well-list-name">${w.name}${changeBadge}</div>
                <div class="well-list-actions">
                  <button class="well-list-action" title="Zmień nazwę" onclick="event.stopPropagation(); renameWell(${i})">✏️</button>
                  <button class="well-list-action" title="Duplikuj" onclick="event.stopPropagation(); duplicateWell(${i})">📋</button>
                  <button class="well-list-action del" title="Usuń" onclick="event.stopPropagation(); removeWell(${i})">✕</button>
                </div>
              </div>
              <div class="well-list-meta">
                <span>${w.config.length} elem.</span>
                <span>${w.przejscia ? w.przejscia.length : 0} przejść</span>
                <span class="well-list-price">${fmtInt(stats.price)} PLN</span>
              </div>
              ${hasElevations ? `<div class="well-list-elevations">
                <span>↑ ${w.rzednaWlazu.toFixed(2)}</span>
                <span>↓ ${w.rzednaDna.toFixed(2)}</span>
                <span>H=${requiredH}mm</span>
              </div>` : ''}
            </div>`;
        });
    });

    if (wells.length === 0) {
        html = `<div style="padding:2rem; text-align:center; color:var(--text-muted); font-size:0.85rem;">Brak dodanych studni.<br>Wybierz średnicę z przycisków powyżej.</div>`;
    }

    container.innerHTML = html;

    const counter = document.getElementById('wells-counter');
    if (counter) counter.textContent = `(${wells.length})`;

    renderDiscountPanel();
}

/* ===== DISCOUNT PANEL ===== */
function updateDiscount(dn, type, value) {
    if (!wellDiscounts[dn]) wellDiscounts[dn] = { dennica: 0, nadbudowa: 0 };
    wellDiscounts[dn][type] = parseFloat(value) || 0;
    renderDiscountPanel();
    updateSummary();
    renderOfferSummary();
}

function getDiscountedTotal() {
    const dktCap = [1000, 1200, 1500, 2000, 2500];
    let grandTotal = 0;
    dktCap.forEach(dn => {
        const groupWells = wells.filter(w => w.dn === dn);
        if (groupWells.length === 0) return;
        let dennicaSum = 0, nadbudowaSum = 0;
        groupWells.forEach(w => {
            const s = calcWellStats(w);
            dennicaSum += s.priceDennica;
            nadbudowaSum += s.priceNadbudowa;
        });
        const disc = wellDiscounts[dn] || { dennica: 0, nadbudowa: 0 };
        const dennicaDisc = dennicaSum * (1 - disc.dennica / 100);
        const nadbudowaDisc = nadbudowaSum * (1 - disc.nadbudowa / 100);
        grandTotal += dennicaDisc + nadbudowaDisc;
    });
    return grandTotal;
}

function renderDiscountPanel() {
    const panel = document.getElementById('wells-discount-panel');
    if (!panel) return;

    const dktCap = [1000, 1200, 1500, 2000, 2500];
    const activeDNs = dktCap.filter(dn => wells.some(w => w.dn === dn));

    if (activeDNs.length === 0) {
        panel.innerHTML = '';
        return;
    }

    let grandDennica = 0, grandNadbudowa = 0, grandTotal = 0, grandDiscounted = 0;

    let html = `<div style="padding:0.4rem; border-bottom:1px solid rgba(255,255,255,0.08);">
        <div style="font-size:0.65rem; text-transform:uppercase; color:var(--text-muted); font-weight:700; letter-spacing:0.5px; margin-bottom:0.3rem;">💰 Rabaty i podsumowanie</div>`;

    activeDNs.forEach(dn => {
        const groupWells = wells.filter(w => w.dn === dn);
        let dennicaSum = 0, nadbudowaSum = 0;
        groupWells.forEach(w => {
            const s = calcWellStats(w);
            dennicaSum += s.priceDennica;
            nadbudowaSum += s.priceNadbudowa;
        });
        const totalDN = dennicaSum + nadbudowaSum;

        const disc = wellDiscounts[dn] || { dennica: 0, nadbudowa: 0 };
        const dennicaAfter = dennicaSum * (1 - disc.dennica / 100);
        const nadbudowaAfter = nadbudowaSum * (1 - disc.nadbudowa / 100);
        const totalAfter = dennicaAfter + nadbudowaAfter;

        grandDennica += dennicaSum;
        grandNadbudowa += nadbudowaSum;
        grandTotal += totalDN;
        grandDiscounted += totalAfter;

        html += `<div style="background:rgba(255,255,255,0.03); border-radius:6px; padding:0.35rem 0.4rem; margin-bottom:0.25rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.2rem;">
            <span style="font-size:0.7rem; font-weight:700; color:#a78bfa;">DN${dn}</span>
            <span style="font-size:0.65rem; color:var(--text-muted);">${groupWells.length} szt.</span>
          </div>
          <div style="display:grid; grid-template-columns:1fr auto auto; gap:0.15rem 0.3rem; font-size:0.62rem; align-items:center;">
            <span style="color:var(--text-muted);">Dennica</span>
            <span style="color:var(--text-secondary); text-align:right;">${fmtInt(dennicaSum)}</span>
            <div style="display:flex; align-items:center; gap:0.15rem;">
              <input type="number" min="0" max="100" step="0.5" value="${disc.dennica || 0}"
                style="width:38px; padding:1px 3px; font-size:0.6rem; text-align:center; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); border-radius:3px; color:#fff;"
                onchange="updateDiscount(${dn},'dennica',this.value)" oninput="updateDiscount(${dn},'dennica',this.value)">
              <span style="color:var(--text-muted);">%</span>
            </div>
            <span style="color:var(--text-muted);">Nadbudowa</span>
            <span style="color:var(--text-secondary); text-align:right;">${fmtInt(nadbudowaSum)}</span>
            <div style="display:flex; align-items:center; gap:0.15rem;">
              <input type="number" min="0" max="100" step="0.5" value="${disc.nadbudowa || 0}"
                style="width:38px; padding:1px 3px; font-size:0.6rem; text-align:center; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); border-radius:3px; color:#fff;"
                onchange="updateDiscount(${dn},'nadbudowa',this.value)" oninput="updateDiscount(${dn},'nadbudowa',this.value)">
              <span style="color:var(--text-muted);">%</span>
            </div>
          </div>
          <div style="display:flex; justify-content:space-between; margin-top:0.2rem; padding-top:0.15rem; border-top:1px solid rgba(255,255,255,0.06);">
            <span style="font-size:0.6rem; color:var(--text-muted);">Po rabacie:</span>
            <span style="font-size:0.65rem; font-weight:700; color:${totalAfter < totalDN ? '#34d399' : 'var(--text-secondary)'};">${fmtInt(totalAfter)} PLN</span>
          </div>
        </div>`;
    });

    // Grand total
    const hasDiscount = grandDiscounted < grandTotal;
    html += `<div style="display:flex; justify-content:space-between; align-items:center; padding:0.3rem 0.2rem 0.1rem; border-top:1px solid rgba(255,255,255,0.1); margin-top:0.2rem;">
      <span style="font-size:0.7rem; font-weight:700; color:var(--text-primary);">Suma</span>
      <div style="text-align:right;">
        ${hasDiscount ? `<div style="font-size:0.55rem; color:var(--text-muted); text-decoration:line-through;">${fmtInt(grandTotal)} PLN</div>` : ''}
        <div style="font-size:0.75rem; font-weight:700; color:#6366f1;">${fmtInt(grandDiscounted)} PLN</div>
      </div>
    </div>`;

    html += `</div>`;
    panel.innerHTML = html;
}

/* ===== WELL STATS ===== */

function calcWellStats(well) {
    let price = 0, weight = 0, height = 0, areaInt = 0, areaExt = 0;
    let priceDennica = 0, priceNadbudowa = 0;
    well.config.forEach(item => {
        const p = studnieProducts.find(pr => pr.id === item.productId);
        if (!p) return;

        let itemPrice = p.price || 0;

        // Wkładka PEHD (jeśli zaznaczona jakakolwiek opcja inna niż brak)
        if (well.wkladka && well.wkladka !== 'brak' && p.doplataPEHD) {
            itemPrice += parseFloat(p.doplataPEHD);
        }

        // Malowanie wewnątrz
        if (well.malowanieW && well.malowanieW !== 'brak' && p.malowanieWewnetrzne) {
            if (well.malowanieW === 'cale' || p.componentType === 'dennica') {
                itemPrice += parseFloat(p.malowanieWewnetrzne);
            }
        }

        // Malowanie zewnątrz
        if (well.malowanieZ === 'zewnatrz' && p.malowanieZewnetrzne) {
            itemPrice += parseFloat(p.malowanieZewnetrzne);
        }

        // Żelbet (dopłata dla dennicy)
        if ((well.dennicaMaterial === 'zelbetowa' || well.material === 'zelbetowa') && p.componentType === 'dennica' && p.doplataZelbet) {
            itemPrice += parseFloat(p.doplataZelbet);
        }

        // Drabinka nierdzewna (dopłata gdy stopnie = nierdzewna)
        if (well.stopnie === 'nierdzewna' && p.doplataDrabNierdzewna) {
            itemPrice += parseFloat(p.doplataDrabNierdzewna);
        }

        const lineTotal = itemPrice * item.quantity;
        price += lineTotal;

        // Split into dennica vs nadbudowa
        if (p.componentType === 'dennica') {
            priceDennica += lineTotal;
        } else {
            priceNadbudowa += lineTotal;
        }

        weight += (p.weight || 0) * item.quantity;
        height += (p.height || 0) * item.quantity;
        areaInt += (p.area || 0) * item.quantity;
        areaExt += (p.areaExt || 0) * item.quantity;
    });
    if (well.przejscia) {
        well.przejscia.forEach(item => {
            const p = studnieProducts.find(pr => pr.id === item.productId);
            if (!p) return;
            price += (p.price || 0);
            priceNadbudowa += (p.price || 0);
            weight += (p.weight || 0);
        });
    }
    return { price, priceDennica, priceNadbudowa, weight, height, areaInt, areaExt };
}

/* ===== DN SELECTOR ===== */
function selectDN(dn) {
    const well = getCurrentWell();
    if (!well) { showToast('Najpierw dodaj studnię', 'error'); return; }

    if (well.dn !== dn) {
        well.dn = dn;
        // Update name if it uses the default format
        if (!well.numer || well.name.startsWith('Studnia DN')) {
            well.name = well.numer || ('Studnia DN' + well.dn + ' (#' + (currentWellIndex + 1) + ')');
        }

        // Update zakończenie to match new DN
        if (well.zakonczenie) {
            const oldProd = studnieProducts.find(p => p.id === well.zakonczenie);
            if (oldProd) {
                const newProd = studnieProducts.find(p =>
                    p.componentType === oldProd.componentType && p.dn === dn
                );
                well.zakonczenie = newProd ? newProd.id : null;
            } else {
                well.zakonczenie = null;
            }
        }

        // Clear old components that do not match new DN and re-run auto-select
        well.config = [];
        autoSelectComponents(true);
        refreshAll();
    }

    updateDNButtons();
    renderTiles();
    renderWellsList();
}

function updateDNButtons() {
    const well = getCurrentWell();
    document.querySelectorAll('.dn-btn').forEach(b => {
        b.classList.toggle('active', well ? b.textContent.includes(well.dn) : false);
    });
}

/* ===== TILES RENDERING ===== */
function renderTiles() {
    const container = document.getElementById('tiles-container');
    const well = getCurrentWell();
    if (!well) {
        if (container) container.innerHTML = '<div style="text-align:center; padding:2rem; color:var(--text-muted); font-size:0.8rem;">Dodaj studnię aby wybrać elementy</div>';
        return;
    }
    const dn = well.dn;

    const groups = [
        { title: '🔘 Włazy', icon: '', types: ['wlaz'] },
        { title: '⚙️ AVR / Pierścienie', icon: '', types: ['avr'] },
        { title: '🔶 Konus / Stożek', icon: '', types: ['konus'] },
        { title: '🔽 Płyty nakrywające', icon: '', types: ['plyta_din', 'plyta_najazdowa', 'plyta_zamykajaca', 'pierscien_odciazajacy'] },
        { title: '⬛ Płyty redukcyjne', icon: '', types: ['plyta_redukcyjna'] },
        { title: '🟦 Kręgi', icon: '', types: ['krag'] },
        { title: '🟪 Kręgi z otworami (OT)', icon: '', types: ['krag_ot'] },
        { title: '🟩 Dennica', icon: '', types: ['dennica'] },
        { title: '🪣 Osadniki', icon: '', types: ['osadnik'] }
    ];

    let html = '';

    const renderGroup = (group, prods) => {
        const items = prods.filter(p => group.types.includes(p.componentType));
        if (items.length === 0) return;

        html += `<div class="tiles-section">
      <div class="tiles-section-title">${group.title}</div>
      <div class="tiles-grid">`;

        items.forEach(p => {
            const isTopClosure = ['plyta_din', 'plyta_najazdowa', 'plyta_zamykajaca', 'konus', 'pierscien_odciazajacy'].includes(p.componentType);
            const isInConfig = well.config.some(c => c.productId === p.id);
            const activeClass = (isTopClosure && isInConfig) ? 'active-top-closure' : '';

            html += `<div class="tile ${activeClass}" data-type="${p.componentType}" onclick="addWellComponent('${p.id}')">
        <div class="tile-name">${p.name}</div>
        <div class="tile-meta">
          <span>${p.weight ? fmtInt(p.weight) + ' kg' : ''}</span>
          <span class="tile-price">${fmtInt(p.price)} PLN</span>
        </div>
      </div>`;
        });
        html += `</div></div>`;
    };

    const primaryProducts = studnieProducts.filter(p => (p.dn === dn || p.dn === null) && p.category !== 'Uszczelki studni');
    groups.forEach(g => renderGroup(g, primaryProducts));

    if ([1200, 1500, 2000, 2500].includes(dn)) {
        const redProducts = studnieProducts.filter(p => p.dn === 1000 && p.category !== 'Uszczelki studni' && p.componentType !== 'plyta_redukcyjna' && p.componentType !== 'dennica');
        if (redProducts.length > 0) {
            html += `<div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px dashed rgba(255,255,255,0.1);">`;
            html += `<h3 style="color:#f59e0b; margin-bottom:1rem; font-size:1.1rem;">⏬ Redukcja (DN1000)</h3>`;
            groups.forEach(g => renderGroup(g, redProducts));
            html += `</div>`;
        }
    }

    container.innerHTML = html;
}

/* ===== WELL CONFIGURATION ===== */
function addWellComponent(productId) {
    if (isOfferLocked()) { showToast(OFFER_LOCKED_MSG, 'error'); return; }
    const product = studnieProducts.find(p => p.id === productId);
    if (!product) return;

    const well = getCurrentWell();
    if (!well) { showToast('Najpierw dodaj studnię', 'error'); return; }

    // Włączenie trybu ręcznego jeśli dodano jakikolwiek element z palety
    if (!well.autoLocked) {
        well.autoLocked = true;
        updateAutoLockUI();
        showToast('Włączono tryb ręczny.', 'info');
    }

    // ZASADA 1: Tylko jedno zakończenie studni
    const topClosureTypes = ['plyta_din', 'plyta_najazdowa', 'plyta_zamykajaca', 'konus', 'pierscien_odciazajacy'];
    if (topClosureTypes.includes(product.componentType)) {
        // Usuń poprzednie elementy zakończenia
        well.config = well.config.filter(item => {
            const p = studnieProducts.find(pr => pr.id === item.productId);
            return p && !topClosureTypes.includes(p.componentType);
        });
    }

    // ZASADA 2: Właz - tylko 1 naraz
    if (product.componentType === 'wlaz') {
        well.config = well.config.filter(item => {
            const p = studnieProducts.find(pr => pr.id === item.productId);
            return p && p.componentType !== 'wlaz';
        });
    }

    // Helper to add a single product to well config
    const addSingle = (prod) => {
        const existing = well.config.find(c => c.productId === prod.id);
        if (existing) {
            existing.quantity++;
        } else {
            well.config.push({ productId: prod.id, quantity: 1 });
        }
    };

    addSingle(product);
    let pairedName = '';

    // Auto-add counterpart for "Płyta odciążająca" + "Pierścień odciążający"
    if (product.componentType === 'plyta_zamykajaca') {
        const paired = studnieProducts.find(p => p.componentType === 'pierscien_odciazajacy' && p.dn === well.dn);
        if (paired) {
            addSingle(paired);
            pairedName = paired.name;
        }
    } else if (product.componentType === 'pierscien_odciazajacy') {
        const paired = studnieProducts.find(p => p.componentType === 'plyta_zamykajaca' && p.dn === well.dn);
        if (paired) {
            addSingle(paired);
            pairedName = paired.name;
        }
    }

    sortWellConfigByOrder();
    renderWellConfig();
    renderWellDiagram();
    updateSummary();
    renderWellsList();
    renderTiles(); // Update highlight

    if (topClosureTypes.includes(product.componentType) && well.rzednaWlazu != null) {
        const rzDna = well.rzednaDna != null ? well.rzednaDna : 0;
        if (well.rzednaWlazu > rzDna) {
            if (pairedName) {
                showToast(`Wybrano zakończenie: ${product.name} + ${pairedName}`, 'success');
            } else {
                showToast(`Wybrano zakończenie: ${product.name}`, 'success');
            }

            // Auto-dobór (gdy dodajemy płyte starym "klikiem", 
            // ale teraz tryb ręczny blokuje autodobór, wiec nigdy to nie zajdzie, chyba ze go odblokujemy)
            if (!well.autoLocked) {
                autoSelectComponents(true);
                return;
            }
        } else {
            if (pairedName) {
                showToast(`Wybrano zakończenie: ${product.name} + ${pairedName}`, 'success');
            } else {
                showToast(`Dodano: ${product.name}`, 'success');
            }
        }
    } else {
        showToast(`Dodano: ${product.name}`, 'success');
    }
}

function removeWellComponent(index) {
    if (isOfferLocked()) { showToast(OFFER_LOCKED_MSG, 'error'); return; }
    const well = getCurrentWell();
    well.config.splice(index, 1);
    renderWellConfig();
    renderWellDiagram();
    updateSummary();
    renderWellsList();
    renderTiles(); // Update highlight
}

function updateWellQuantity(index, value) {
    const qty = parseInt(value);
    if (qty <= 0) {
        removeWellComponent(index);
        return;
    }
    const well = getCurrentWell();
    well.config[index].quantity = qty;
    renderWellConfig();
    renderWellDiagram();
    updateSummary();
    renderTiles(); // highlight items
}

function clearWellConfig() {
    const well = getCurrentWell();
    if (!well) return;
    well.config = [];
    well.autoLocked = false;
    updateAutoLockUI();
    refreshAll();
    showToast('Wyczyszczono konfigurację studni', 'info');
}

function renderWellConfig() {
    const tbody = document.getElementById('well-config-body');
    const well = getCurrentWell();

    if (!well || well.config.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:2rem;color:var(--text-muted);">Kliknij kafelki powyżej, aby dodać elementy studni</td></tr>';
        return;
    }

    // Component type visual order mapping (top of well → bottom)
    const typeOrderMap = {
        wlaz: 0,
        plyta_din: 1,
        plyta_najazdowa: 1,
        plyta_zamykajaca: 1,
        pierscien_odciazajacy: 2,
        konus: 1,
        avr: 3,
        plyta_redukcyjna: 4,
        krag: 5,
        krag_ot: 5,
        dennica: 6
    };

    // Type color badges
    const typeBadge = {
        wlaz: { bg: '#374151', label: '🔘 Właz' },
        plyta_din: { bg: '#1e3a5f', label: '🔽 Płyta' },
        plyta_najazdowa: { bg: '#1e3a5f', label: '🔽 Płyta' },
        plyta_zamykajaca: { bg: '#1e3a5f', label: '🔽 Płyta' },
        pierscien_odciazajacy: { bg: '#1e3a5f', label: '⚙️ Pierścień' },
        konus: { bg: '#7c3aed30', label: '🔶 Konus' },
        avr: { bg: '#44403c', label: '⚙️ AVR' },
        plyta_redukcyjna: { bg: '#6d28d920', label: '⬛ Redukcja' },
        krag: { bg: '#164e63', label: '🟦 Krąg' },
        krag_ot: { bg: '#312e81', label: '🟪 Krąg OT' },
        dennica: { bg: '#14532d', label: '🟩 Dennica' }
    };

    let html = '';
    well.config.forEach((item, index) => {
        const p = studnieProducts.find(pr => pr.id === item.productId);
        if (!p) return;
        const totalPrice = p.price * item.quantity;
        const totalWeight = (p.weight || 0) * item.quantity;
        const totalAreaInt = (p.area || 0) * item.quantity;
        const totalAreaExt = (p.areaExt || 0) * item.quantity;
        const badge = typeBadge[p.componentType] || { bg: '#333', label: '?' };

        const canMoveUp = index > 0;
        const canMoveDown = index < well.config.length - 1;

        html += `<tr data-cfg-idx="${index}">
      <td>
        <div style="display:flex; flex-direction:column; gap:1px; align-items:center;">
          <button class="cfg-move-btn" ${!canMoveUp ? 'disabled' : ''} onclick="moveWellComponent(${index}, -1)" title="▲">▲</button>
          <span style="font-size:0.62rem; color:var(--text-muted)">${index + 1}</span>
          <button class="cfg-move-btn" ${!canMoveDown ? 'disabled' : ''} onclick="moveWellComponent(${index}, 1)" title="▼">▼</button>
        </div>
      </td>
      <td>
        <div style="display:flex; align-items:center; gap:0.35rem;">
          <span style="font-size:0.5rem; padding:1px 4px; border-radius:3px; background:${badge.bg}; color:var(--text-secondary); white-space:nowrap;">${badge.label}</span>
          <div>
            <div style="font-weight:600; color:var(--text-primary); font-size:0.76rem; line-height:1.2;">${p.name}</div>
            <div style="font-size:0.6rem; color:var(--text-muted);">${p.id}${p.height ? ' | H=' + p.height + 'mm' : ''}</div>
          </div>
        </div>
      </td>
      <td style="text-align:right">${p.weight ? fmtInt(totalWeight) + ' kg' : '—'}</td>
      <td style="text-align:right">${p.area ? fmt(totalAreaInt) : '—'}</td>
      <td style="text-align:right">${p.areaExt ? fmt(totalAreaExt) : '—'}</td>
      <td style="text-align:center">
        <input type="number" value="${item.quantity}" min="1" max="20"
          style="width:42px; text-align:center; background:rgba(30,41,59,0.8); border:1px solid var(--border-glass); border-radius:4px; color:var(--text-primary); padding:0.15rem; font-size:0.75rem;"
          onchange="updateWellQuantity(${index}, this.value)">
      </td>
      <td style="text-align:right; color:var(--text-secondary); font-size:0.75rem;">${fmtInt(p.price)}</td>
      <td style="text-align:right; font-weight:700; color:var(--text-primary); font-size:0.75rem;">${fmtInt(totalPrice)}</td>
      <td style="text-align:center">
        <button class="config-remove-btn" onclick="removeWellComponent(${index})" style="font-size:0.62rem; padding:0.15rem 0.35rem;">✕</button>
      </td>
    </tr>`;
    });

    tbody.innerHTML = html;
}

/* ===== MOVE WELL COMPONENT ===== */
function moveWellComponent(index, direction) {
    const well = getCurrentWell();
    if (!well) return;
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= well.config.length) return;

    // Swap elements
    const temp = well.config[index];
    well.config[index] = well.config[newIndex];
    well.config[newIndex] = temp;

    // Enable manual mode since user is reordering
    if (!well.autoLocked) {
        well.autoLocked = true;
        updateAutoLockUI();
    }

    renderWellConfig();
    renderWellDiagram();
    updateSummary();
}

/* ===== SORT WELL CONFIG by well-physical order (top → bottom) ===== */
function sortWellConfigByOrder() {
    const well = getCurrentWell();
    if (!well) return;
    const typeOrder = {
        wlaz: 0,
        plyta_din: 1, plyta_najazdowa: 1, plyta_zamykajaca: 1,
        pierscien_odciazajacy: 2,
        konus: 1,
        avr: 3,
        plyta_redukcyjna: 4,
        krag: 5, krag_ot: 5,
        dennica: 6
    };
    well.config.sort((a, b) => {
        const pa = studnieProducts.find(p => p.id === a.productId);
        const pb = studnieProducts.find(p => p.id === b.productId);
        const oa = pa ? (typeOrder[pa.componentType] ?? 99) : 99;
        const ob = pb ? (typeOrder[pb.componentType] ?? 99) : 99;
        if (oa !== ob) return oa - ob;
        // Within same type, sort by height descending (largest kręgi first)
        const ha = pa ? pa.height : 0;
        const hb = pb ? pb.height : 0;
        return hb - ha;
    });
}

function renderWellPrzejscia() {
    const container = document.getElementById('well-przejscia-tiles');
    const countEl = document.getElementById('przejscia-count');
    const well = getCurrentWell();

    if (!container) return;

    if (!well || !well.przejscia || well.przejscia.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:1.2rem; color:var(--text-muted); font-size:0.75rem; border:1px dashed rgba(255,255,255,0.08); border-radius:8px;">Brak zdefiniowanych przejść.<br>Dodaj przejście z formularza powyżej.</div>';
        if (countEl) countEl.textContent = '';
        return;
    }

    // Auto-sort by angle (smallest to largest)
    const sorted = well.przejscia.map((item, origIdx) => ({ item, origIdx }))
        .sort((a, b) => (a.item.angle || 0) - (b.item.angle || 0));

    // Rebuild przejscia array in sorted order
    well.przejscia = sorted.map(s => s.item);

    if (countEl) countEl.textContent = `(${well.przejscia.length})`;

    let totalPrice = 0;
    let html = '<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:0.4rem;">';

    well.przejscia.forEach((item, index) => {
        const p = studnieProducts.find(pr => pr.id === item.productId);
        const typeName = p ? p.category : 'Nieznane';
        const dn = p ? p.dn : '—';
        const price = p ? p.price : 0;
        totalPrice += price;

        const angleColor = item.angle === 0 ? '#6366f1' : '#818cf8';
        const isFirst = index === 0;
        const isLast = index === well.przejscia.length - 1;

        // Edit mode for this tile
        if (editPrzejscieIdx === index) {
            const przejsciaProducts = studnieProducts.filter(pr => pr.componentType === 'przejscie');
            const allTypes = [...new Set(przejsciaProducts.map(pr => pr.category))].sort();
            const currentTypeDNs = przejsciaProducts.filter(pr => pr.category === typeName);

            const typeOptions = allTypes.map(t =>
                `<option value="${t}" ${t === typeName ? 'selected' : ''}>${t}</option>`
            ).join('');

            const dnOptions = currentTypeDNs.map(pr => {
                const dnLbl = (typeof pr.dn === 'string' && pr.dn.includes('/')) ? pr.dn : 'DN' + pr.dn;
                return `<option value="${pr.id}" ${pr.id === item.productId ? 'selected' : ''}>${dnLbl} — ${fmtInt(pr.price)} PLN</option>`;
            }).join('');

            const execAngle = (item.angle === 0 || item.angle === 360) ? 0 : (360 - item.angle);

            html += `<div style="background:rgba(30,41,59,0.9); border:1.5px solid rgba(96,165,250,0.4); border-radius:8px; padding:0.5rem; position:relative; box-shadow:0 0 12px rgba(96,165,250,0.1);">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
                <div style="display:flex; align-items:center; gap:0.3rem;">
                  <span style="background:#60a5fa; color:#fff; font-size:0.55rem; font-weight:800; padding:0.1rem 0.35rem; border-radius:10px;">${index + 1}</span>
                  <span style="font-size:0.65rem; font-weight:700; color:#60a5fa;">Edycja przejścia</span>
                </div>
                <button onclick="cancelPrzejscieEdit()" title="Anuluj" style="background:none; border:none; cursor:pointer; font-size:0.65rem; padding:0.1rem 0.3rem; color:var(--text-muted);">✕</button>
              </div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.3rem; margin-bottom:0.3rem;">
                <div>
                  <label style="font-size:0.5rem; color:var(--text-muted); display:block; margin-bottom:0.1rem;">Typ przejścia</label>
                  <select id="edit-type-${index}" class="form-input" onchange="editChangePrzejscieType(${index})" style="padding:0.25rem 0.3rem; font-size:0.62rem; width:100%;">${typeOptions}</select>
                </div>
                <div>
                  <label style="font-size:0.5rem; color:var(--text-muted); display:block; margin-bottom:0.1rem;">Średnica (DN)</label>
                  <select id="edit-dn-${index}" class="form-input" style="padding:0.25rem 0.3rem; font-size:0.62rem; width:100%;">${dnOptions}</select>
                </div>
              </div>
              <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:0.3rem; margin-bottom:0.3rem;">
                <div>
                  <label style="font-size:0.5rem; color:var(--text-muted); display:block; margin-bottom:0.1rem;">Rzędna [m]</label>
                  <input type="number" class="form-input" id="edit-rzedna-${index}" step="0.01" value="${item.rzednaWlaczenia || ''}" placeholder="142.50" style="padding:0.25rem 0.3rem; font-size:0.62rem;">
                </div>
                <div>
                  <label style="font-size:0.5rem; color:var(--text-muted); display:block; margin-bottom:0.1rem;">Kąt [°]</label>
                  <input type="number" class="form-input" id="edit-angle-${index}" value="${item.angle}" min="0" max="360" oninput="editUpdateAngles(${index})" style="padding:0.25rem 0.3rem; font-size:0.62rem; color:#818cf8; font-weight:700;">
                </div>
                <div>
                  <label style="font-size:0.5rem; color:var(--text-muted); display:block; margin-bottom:0.1rem;">Uwagi</label>
                  <input type="text" class="form-input" id="edit-notes-${index}" value="${item.notes || ''}" placeholder="np. Wlot A" style="padding:0.25rem 0.3rem; font-size:0.62rem;">
                </div>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; gap:0.8rem; font-size:0.58rem;">
                  <span style="color:var(--text-muted);">Kąt wyk: <strong id="edit-exec-${index}" style="color:var(--text-primary);">${execAngle}°</strong></span>
                  <span style="color:var(--text-muted);">Gony: <strong id="edit-gony-${index}" style="color:var(--success);">${item.angleGony}<sup>g</sup></strong></span>
                </div>
                <div style="display:flex; gap:0.25rem;">
                  <button onclick="cancelPrzejscieEdit()" style="padding:0.25rem 0.5rem; font-size:0.6rem; border-radius:5px; border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.04); color:var(--text-muted); cursor:pointer;">Anuluj</button>
                  <button onclick="savePrzejscieEdit(${index})" class="btn btn-primary" style="padding:0.25rem 0.6rem; font-size:0.6rem;">💾 Zapisz</button>
                </div>
              </div>
            </div>`;
            return;
        }

        html += `<div style="background:rgba(30,41,59,0.7); border:1px solid rgba(99,102,241,0.15); border-radius:8px; padding:0.45rem 0.5rem; position:relative; transition:all 0.2s ease;"
                      onmouseenter="this.style.borderColor='rgba(99,102,241,0.4)'" onmouseleave="this.style.borderColor='rgba(99,102,241,0.15)'">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
            <div style="display:flex; align-items:center; gap:0.3rem;">
              <span style="background:${angleColor}; color:#fff; font-size:0.55rem; font-weight:800; padding:0.1rem 0.35rem; border-radius:10px;">${index + 1}</span>
              <span style="font-size:0.68rem; font-weight:700; color:var(--text-primary);">${typeName}</span>
            </div>
            <div style="display:flex; gap:0.15rem;">
              ${!isFirst ? `<button onclick="movePrzejscie(${index},-1)" title="W górę" style="background:none; border:none; cursor:pointer; font-size:0.6rem; padding:0.1rem 0.2rem; color:var(--text-muted); opacity:0.7;">⬆</button>` : ''}
              ${!isLast ? `<button onclick="movePrzejscie(${index},1)" title="W dół" style="background:none; border:none; cursor:pointer; font-size:0.6rem; padding:0.1rem 0.2rem; color:var(--text-muted); opacity:0.7;">⬇</button>` : ''}
              <button onclick="editPrzejscie(${index})" title="Edytuj" style="background:none; border:none; cursor:pointer; font-size:0.6rem; padding:0.1rem 0.2rem; color:#60a5fa; opacity:0.8;">✏️</button>
              <button onclick="removePrzejscieFromWell(${index})" title="Usuń" style="background:none; border:none; cursor:pointer; font-size:0.65rem; padding:0.1rem 0.2rem; color:#ef4444;">✕</button>
            </div>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.15rem 0.5rem; font-size:0.6rem;">
            <div style="display:flex; justify-content:space-between;">
              <span style="color:var(--text-muted);">DN</span>
              <span style="font-weight:700; color:#a78bfa;">${typeof dn === 'string' && dn.includes('/') ? dn : 'DN' + dn}</span>
            </div>
            <div style="display:flex; justify-content:space-between;">
              <span style="color:var(--text-muted);">Rzędna</span>
              <span style="font-weight:700; color:var(--text-primary);">${item.rzednaWlaczenia || '—'}</span>
            </div>
            <div style="display:flex; justify-content:space-between;">
              <span style="color:var(--text-muted);">Kąt</span>
              <span style="font-weight:800; color:${angleColor};">${item.angle}°</span>
            </div>
            <div style="display:flex; justify-content:space-between;">
              <span style="color:var(--text-muted);">Kąt wyk.</span>
              <span style="font-weight:600; color:var(--text-secondary);">${item.angleExecution}°</span>
            </div>
            <div style="display:flex; justify-content:space-between;">
              <span style="color:var(--text-muted);">Gony</span>
              <span style="font-weight:700; color:var(--success);">${item.angleGony}<sup>g</sup></span>
            </div>
            <div style="display:flex; justify-content:space-between;">
              <span style="color:var(--text-muted);">Cena</span>
              <span style="font-weight:700; color:var(--success);">${fmtInt(price)}</span>
            </div>
          </div>
          ${item.notes ? `<div style="font-size:0.55rem; color:var(--text-muted); margin-top:0.2rem; padding-top:0.15rem; border-top:1px solid rgba(255,255,255,0.04); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${item.notes}">📝 ${item.notes}</div>` : ''}
        </div>`;
    });

    html += '</div>';

    // Summary bar
    html += `<div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.4rem; padding:0.3rem 0.4rem; background:rgba(99,102,241,0.08); border-radius:6px; border:1px solid rgba(99,102,241,0.15);">
      <span style="font-size:0.65rem; color:var(--text-muted);">Suma przejść (${well.przejscia.length} szt.)</span>
      <span style="font-size:0.75rem; font-weight:800; color:var(--success);">${fmtInt(totalPrice)} PLN</span>
    </div>`;

    container.innerHTML = html;
}

function movePrzejscie(index, direction) {
    const well = getCurrentWell();
    if (!well || !well.przejscia) return;
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= well.przejscia.length) return;
    const temp = well.przejscia[index];
    well.przejscia[index] = well.przejscia[newIndex];
    well.przejscia[newIndex] = temp;
    renderWellPrzejscia();
    updateSummary();
}

function editPrzejscie(index) {
    const well = getCurrentWell();
    if (!well || !well.przejscia || !well.przejscia[index]) return;
    const item = well.przejscia[index];
    const p = studnieProducts.find(pr => pr.id === item.productId);
    const typeName = p ? p.category : 'Nieznane';
    const dn = p ? p.dn : '—';

    // Get all przejscia products for the DN selector
    const przejsciaProducts = studnieProducts.filter(pr => pr.componentType === 'przejscie');
    const allTypes = [...new Set(przejsciaProducts.map(pr => pr.category))].sort();

    // Build type selector
    const typeOptions = allTypes.map(t => {
        const isActive = t === typeName;
        return `<option value="${t}" ${isActive ? 'selected' : ''}>${t}</option>`;
    }).join('');

    // Build DN selector for current type
    const currentTypeDNs = przejsciaProducts.filter(pr => pr.category === typeName);
    const dnOptions = currentTypeDNs.map(pr => {
        const isActive = pr.id === item.productId;
        const dnLbl = (typeof pr.dn === 'string' && pr.dn.includes('/')) ? pr.dn : 'DN' + pr.dn;
        return `<option value="${pr.id}" ${isActive ? 'selected' : ''}>${dnLbl} — ${fmtInt(pr.price)} PLN</option>`;
    }).join('');

    // Find the tile container
    const container = document.getElementById('well-przejscia-tiles');
    if (!container) return;
    const tiles = container.querySelectorAll('[data-przejscie-idx]');
    const tile = tiles[index] || container.querySelectorAll(':scope > div > div')[index];

    // Actually, re-render with index in edit mode is simpler
    editPrzejscieIdx = index;
    renderWellPrzejscia();
}

let editPrzejscieIdx = -1;

function savePrzejscieEdit(index) {
    if (isOfferLocked()) { showToast(OFFER_LOCKED_MSG, 'error'); return; }
    const well = getCurrentWell();
    if (!well || !well.przejscia || !well.przejscia[index]) return;

    const newProductId = document.getElementById('edit-dn-' + index).value;
    const rzedna = document.getElementById('edit-rzedna-' + index).value;
    const angle = parseFloat(document.getElementById('edit-angle-' + index).value) || 0;
    const notes = document.getElementById('edit-notes-' + index).value.trim();

    const exec = (angle === 0 || angle === 360) ? 0 : (360 - angle);
    const gons = (angle * 400 / 360).toFixed(2);

    well.przejscia[index] = {
        productId: newProductId,
        rzednaWlaczenia: rzedna ? parseFloat(rzedna).toFixed(2) : null,
        angle: angle,
        angleExecution: exec,
        angleGony: gons,
        notes: notes
    };

    editPrzejscieIdx = -1;
    refreshAll();
    autoSelectComponents(true);
    showToast('Zapisano zmiany przejścia', 'success');
    renderWellPrzejscia();
}

function cancelPrzejscieEdit() {
    editPrzejscieIdx = -1;
    renderWellPrzejscia();
}

function editUpdateAngles(index) {
    const el = document.getElementById('edit-angle-' + index);
    if (!el) return;
    const angle = parseFloat(el.value) || 0;
    const exec = (angle === 0 || angle === 360) ? 0 : (360 - angle);
    const gons = (angle * 400 / 360).toFixed(2);
    const execEl = document.getElementById('edit-exec-' + index);
    const gonyEl = document.getElementById('edit-gony-' + index);
    if (execEl) execEl.textContent = exec + '°';
    if (gonyEl) gonyEl.innerHTML = gons + '<sup>g</sup>';
}

function editChangePrzejscieType(index) {
    const typeSelect = document.getElementById('edit-type-' + index);
    const dnSelect = document.getElementById('edit-dn-' + index);
    if (!typeSelect || !dnSelect) return;
    const newType = typeSelect.value;
    const przejsciaProducts = studnieProducts.filter(pr => pr.componentType === 'przejscie' && pr.category === newType);
    dnSelect.innerHTML = przejsciaProducts.map(pr => {
        const dnLbl = (typeof pr.dn === 'string' && pr.dn.includes('/')) ? pr.dn : 'DN' + pr.dn;
        return `<option value="${pr.id}">${dnLbl} — ${fmtInt(pr.price)} PLN</option>`;
    }).join('');
}

window.editPrzejscie = editPrzejscie;
window.savePrzejscieEdit = savePrzejscieEdit;
window.cancelPrzejscieEdit = cancelPrzejscieEdit;
window.editUpdateAngles = editUpdateAngles;
window.editChangePrzejscieType = editChangePrzejscieType;

function toggleCard(contentId, iconId) {
    const content = document.getElementById(contentId);
    const icon = document.getElementById(iconId);
    if (!content || !icon) return;
    if (content.style.display === 'none') {
        content.style.display = 'block';
        icon.textContent = '🔼';
    } else {
        content.style.display = 'none';
        icon.textContent = '🔽';
    }
}

function switchBuilderTab(tab) {
    document.getElementById('btab-concrete').classList.toggle('active', tab === 'concrete');
    document.getElementById('btab-transitions').classList.toggle('active', tab === 'transitions');
    document.getElementById('bcontent-concrete').style.display = tab === 'concrete' ? 'block' : 'none';
    document.getElementById('bcontent-transitions').style.display = tab === 'transitions' ? 'block' : 'none';

    if (tab === 'transitions') {
        renderInlinePrzejsciaApp();
        renderWellPrzejscia();
    }
}

let inlinePrzejsciaState = { type: null, dnId: null };
let visiblePrzejsciaTypes = new Set(); // By default, all types are hidden

/* ===== PRZEJŚCIA VISIBILITY POPUP ===== */
function openPrzejsciaVisibilityPopup() {
    const przejsciaProducts = studnieProducts.filter(p => p.componentType === 'przejscie');
    const allTypes = [...new Set(przejsciaProducts.map(p => p.category))].sort();

    // Create overlay
    let overlay = document.getElementById('przejscia-visibility-overlay');
    if (overlay) overlay.remove();

    overlay = document.createElement('div');
    overlay.id = 'przejscia-visibility-overlay';
    overlay.style.cssText = `
        position:fixed; inset:0; z-index:9999;
        background:rgba(0,0,0,0.6); backdrop-filter:blur(6px);
        display:flex; align-items:center; justify-content:center;
        animation: fadeInOverlay 0.2s ease;
    `;
    overlay.onclick = (e) => { if (e.target === overlay) closePrzejsciaVisibilityPopup(); };

    const visibleCount = allTypes.filter(t => visiblePrzejsciaTypes.has(t)).length;

    let tilesHtml = allTypes.map(t => {
        const isVisible = visiblePrzejsciaTypes.has(t);
        return `
            <div class="przejscia-vis-tile ${isVisible ? 'visible' : 'hidden-type'}" 
                 onclick="togglePrzejsciaTypeVisibility('${t.replace(/'/g, "\\\\'")}')"
                 title="${t}">
                <div class="przejscia-vis-tile-name">${t}</div>
            </div>`;
    }).join('');

    overlay.innerHTML = `
        <div class="przejscia-vis-popup">
            <div class="przejscia-vis-header">
                <div>
                    <h3 style="margin:0; font-size:0.85rem; font-weight:800; color:var(--text-primary);">Pokaż / Ukryj przejścia</h3>
                    <div class="przejscia-vis-counter" style="font-size:0.6rem; color:var(--text-muted); margin-top:0.1rem;">Kliknij kafelek aby przełączyć widoczność. Widoczne: <strong style="color:var(--success);">${visibleCount}</strong> / ${allTypes.length}</div>
                </div>
                <button onclick="closePrzejsciaVisibilityPopup()" style="background:none; border:none; color:var(--text-muted); font-size:1.2rem; cursor:pointer; padding:0.2rem 0.4rem; border-radius:4px; transition:all 0.15s;" onmouseenter="this.style.color='#f87171'" onmouseleave="this.style.color='var(--text-muted)'">✕</button>
            </div>
            <div class="przejscia-vis-actions">
                <button class="przejscia-vis-action-btn" onclick="setPrzejsciaVisibilityAll(true)">Pokaż wszystkie</button>
                <button class="przejscia-vis-action-btn" onclick="setPrzejsciaVisibilityAll(false)">Ukryj wszystkie</button>
            </div>
            <div class="przejscia-vis-grid">
                ${tilesHtml}
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Measure longest tile name and set uniform column width
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.font = '700 0.85rem Inter, sans-serif';
    const maxTextWidth = Math.max(...allTypes.map(n => ctx.measureText(n).width));
    const tileMinW = Math.ceil(maxTextWidth + 24); // +24 for padding
    const gridEl = overlay.querySelector('.przejscia-vis-grid');
    if (gridEl) gridEl.style.setProperty('--tile-min-w', tileMinW + 'px');
}

function closePrzejsciaVisibilityPopup() {
    const overlay = document.getElementById('przejscia-visibility-overlay');
    if (overlay) overlay.remove();
    renderInlinePrzejsciaApp();
}

function togglePrzejsciaTypeVisibility(type) {
    if (visiblePrzejsciaTypes.has(type)) {
        visiblePrzejsciaTypes.delete(type);
    } else {
        visiblePrzejsciaTypes.add(type);
    }
    refreshPrzejsciaVisibilityTiles();
}

function setPrzejsciaVisibilityAll(visible) {
    const przejsciaProducts = studnieProducts.filter(p => p.componentType === 'przejscie');
    const allTypes = [...new Set(przejsciaProducts.map(p => p.category))];
    if (visible) {
        allTypes.forEach(t => visiblePrzejsciaTypes.add(t));
    } else {
        visiblePrzejsciaTypes.clear();
    }
    refreshPrzejsciaVisibilityTiles();
}

function refreshPrzejsciaVisibilityTiles() {
    const overlay = document.getElementById('przejscia-visibility-overlay');
    if (!overlay) return;

    const przejsciaProducts = studnieProducts.filter(p => p.componentType === 'przejscie');
    const allTypes = [...new Set(przejsciaProducts.map(p => p.category))].sort();
    const visibleCount = allTypes.filter(t => visiblePrzejsciaTypes.has(t)).length;

    // Update counter text
    const counterEl = overlay.querySelector('.przejscia-vis-counter');
    if (counterEl) counterEl.innerHTML = `Kliknij kafelek aby przełączyć widoczność. Widoczne: <strong style="color:var(--success);">${visibleCount}</strong> / ${allTypes.length}`;

    // Update each tile in-place
    const tiles = overlay.querySelectorAll('.przejscia-vis-tile');
    tiles.forEach(tile => {
        const type = tile.getAttribute('title');
        const isVisible = visiblePrzejsciaTypes.has(type);
        tile.classList.toggle('visible', isVisible);
        tile.classList.toggle('hidden-type', !isVisible);
    });
}

window.openPrzejsciaVisibilityPopup = openPrzejsciaVisibilityPopup;
window.closePrzejsciaVisibilityPopup = closePrzejsciaVisibilityPopup;
window.togglePrzejsciaTypeVisibility = togglePrzejsciaTypeVisibility;
window.setPrzejsciaVisibilityAll = setPrzejsciaVisibilityAll;

function renderInlinePrzejsciaApp() {
    const przejsciaProducts = studnieProducts.filter(p => p.componentType === 'przejscie');
    const allTypes = [...new Set(przejsciaProducts.map(p => p.category))].sort();
    // Filter to only visible types
    const types = allTypes.filter(t => visiblePrzejsciaTypes.has(t));

    const container = document.getElementById('inline-przejscia-app');
    if (!container) return;

    // Reset type if it's been hidden
    if (inlinePrzejsciaState.type && !types.includes(inlinePrzejsciaState.type)) {
        inlinePrzejsciaState.type = types[0] || null;
        inlinePrzejsciaState.dnId = null;
    }
    if (!inlinePrzejsciaState.type) {
        inlinePrzejsciaState.type = types[0] || null;
    }

    const hiddenCount = allTypes.length - types.length;
    const visibilityBtnLabel = hiddenCount > 0 ? `👁️ Pokaż/Ukryj (${hiddenCount} ukrytych)` : '👁️ Pokaż/Ukryj';

    // If no types visible, show empty state
    if (types.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:1.5rem; border:1px dashed rgba(99,102,241,0.2); border-radius:10px; background:rgba(15,23,42,0.3); margin:0.4rem 0;">
                <div style="font-size:1.5rem; margin-bottom:0.5rem;">🚫</div>
                <div style="font-size:0.75rem; font-weight:700; color:var(--text-primary); margin-bottom:0.3rem;">Wszystkie przejścia są ukryte</div>
                <div style="font-size:0.65rem; color:var(--text-muted); margin-bottom:0.8rem;">Włącz widoczność wybranych typów przejść, aby móc je dodawać.</div>
                <button class="btn btn-primary btn-sm" onclick="openPrzejsciaVisibilityPopup()" style="padding:0.35rem 0.8rem; font-size:0.7rem;">
                    👁️ Pokaż przejścia (${allTypes.length} dostępnych)
                </button>
            </div>
        `;
        return;
    }

    const dnList = inlinePrzejsciaState.type ? przejsciaProducts.filter(p => p.category === inlinePrzejsciaState.type).sort((a, b) => a.dn - b.dn) : [];
    const selectedProduct = inlinePrzejsciaState.dnId ? studnieProducts.find(p => p.id === inlinePrzejsciaState.dnId) : null;

    container.innerHTML = `
        <!-- Rodzaj tiles - scrollable grid -->
        <div style="padding:0.4rem 0;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem;">
                <div style="font-size:0.58rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; font-weight:700;">Rodzaj materiału</div>
                <button onclick="openPrzejsciaVisibilityPopup()" style="background:rgba(99,102,241,0.1); border:1px solid rgba(99,102,241,0.25); color:#a5b4fc; font-size:0.58rem; font-weight:600; padding:0.15rem 0.5rem; border-radius:5px; cursor:pointer; transition:all 0.15s;" onmouseenter="this.style.background='rgba(99,102,241,0.2)';this.style.borderColor='rgba(99,102,241,0.4)'" onmouseleave="this.style.background='rgba(99,102,241,0.1)';this.style.borderColor='rgba(99,102,241,0.25)'">${visibilityBtnLabel}</button>
            </div>
            <div id="przejscia-type-scroll" style="max-height:140px; overflow-y:auto; padding-right:0.2rem; scrollbar-width:thin; scrollbar-color:rgba(99,102,241,0.4) transparent;">
                <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(170px, 1fr)); gap:0.25rem;">
                    ${types.map(t => {
        const isActive = t === inlinePrzejsciaState.type;
        const dnCount = przejsciaProducts.filter(p => p.category === t).length;
        return `
                        <div onclick="window.inlineSetType('${t}')" 
                             style="padding:0.3rem 0.4rem; border-radius:6px; cursor:pointer; transition:all 0.15s ease;
                                    background:${isActive ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.03)'};
                                    border:1px solid ${isActive ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.06)'};
                                    ${isActive ? 'box-shadow:0 0 8px rgba(99,102,241,0.15);' : ''}"
                             onmouseenter="if(!${isActive})this.style.borderColor='rgba(99,102,241,0.25)';this.style.background='${isActive ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.06)'}'"
                             onmouseleave="if(!${isActive})this.style.borderColor='rgba(255,255,255,0.06)';this.style.background='${isActive ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.03)'}'"
                             title="${t}">
                            <div style="font-size:0.65rem; font-weight:${isActive ? '700' : '600'}; color:${isActive ? '#a78bfa' : 'var(--text-primary)'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${t}</div>
                            <div style="font-size:0.5rem; color:var(--text-muted);">${dnCount} DN</div>
                        </div>`;
    }).join('')}
                </div>
            </div>
        </div>

        <!-- DN selector -->
        <div style="padding:0.3rem 0;">
            <div style="font-size:0.58rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.3rem; letter-spacing:0.5px; font-weight:700;">Średnica (DN) — ${inlinePrzejsciaState.type || ''}</div>
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(90px, 1fr)); gap:0.25rem;">
                ${dnList.map(p => {
        const dnLabel = (typeof p.dn === 'string' && p.dn.includes('/')) ? p.dn : ('DN' + p.dn);
        return `
                    <div class="fs-dn-tile ${p.id === inlinePrzejsciaState.dnId ? 'active' : ''}" 
                         style="padding:0.35rem; text-align:center; cursor:pointer; border-radius:6px;"
                         onclick="window.inlineSetDN('${p.id}')">
                        <div style="font-size:0.7rem; font-weight:800; color:var(--text-primary);">${dnLabel}</div>
                        <div style="font-size:0.6rem; color:var(--success); font-weight:600;">${fmtInt(p.price)}</div>
                    </div>
                `;
    }).join('')}
            </div>
        </div>

        ${selectedProduct ? `
        <div style="background:rgba(30,41,59,0.6); border:1px solid rgba(99,102,241,0.2); padding:0.5rem; border-radius:8px; margin-top:0.3rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
                <span style="font-size:0.72rem; font-weight:700; color:#fff;">🔗 ${selectedProduct.category} ${typeof selectedProduct.dn === 'string' && selectedProduct.dn.includes('/') ? selectedProduct.dn : 'DN' + selectedProduct.dn}</span>
                <span style="font-size:0.8rem; color:var(--success); font-weight:800;">${fmtInt(selectedProduct.price)} PLN</span>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:0.3rem; align-items:end;">
                <div>
                    <label style="font-size:0.55rem; color:var(--text-muted); display:block; margin-bottom:0.1rem;">Rzędna włączenia [m]</label>
                    <input type="number" class="form-input" id="inl-rzedna" step="0.01" placeholder="142.50" style="padding:0.3rem 0.4rem; font-size:0.7rem;">
                </div>
                <div>
                    <label style="font-size:0.55rem; color:var(--text-muted); display:block; margin-bottom:0.1rem;">Kąt [°]</label>
                    <input type="number" class="form-input" id="inl-angle" value="0" min="0" max="360" oninput="window.inlineUpdateAngles()" style="padding:0.3rem 0.4rem; font-size:0.7rem; color:#818cf8; font-weight:700;">
                </div>
                <div>
                    <label style="font-size:0.55rem; color:var(--text-muted); display:block; margin-bottom:0.1rem;">Uwagi</label>
                    <input type="text" class="form-input" id="inl-notes" placeholder="np. Wlot A" style="padding:0.3rem 0.4rem; font-size:0.7rem;">
                </div>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.35rem;">
                <div style="display:flex; gap:1rem; font-size:0.62rem;">
                    <span style="color:var(--text-muted);">Kąt wyk: <strong id="inl-exec" style="color:var(--text-primary);">360°</strong></span>
                    <span style="color:var(--text-muted);">Gony: <strong id="inl-gony" style="color:var(--success);">0.00<sup>g</sup></strong></span>
                </div>
                <button class="btn btn-primary" onclick="window.inlineFinish()" style="padding:0.3rem 0.8rem; font-size:0.7rem;">➕ Dodaj</button>
            </div>
        </div>
        ` : `
        <div style="text-align:center; padding:0.8rem; color:var(--text-muted); border:1px dashed rgba(255,255,255,0.06); border-radius:8px; font-size:0.7rem; margin-top:0.3rem;">
            Wybierz średnicę (DN) aby skonfigurować przejście
        </div>
        `}
    `;

    if (inlinePrzejsciaState.dnId) window.inlineUpdateAngles();
}

window.inlineSetType = (t) => { inlinePrzejsciaState.type = t; inlinePrzejsciaState.dnId = null; renderInlinePrzejsciaApp(); };
window.inlineSetDN = (id) => { inlinePrzejsciaState.dnId = id; renderInlinePrzejsciaApp(); };

window.inlineUpdateAngles = () => {
    const el = document.getElementById('inl-angle');
    if (!el) return;
    const angle = parseFloat(el.value) || 0;
    const exec = (angle === 0 || angle === 360) ? 0 : (360 - angle);
    const gons = (angle * 400 / 360).toFixed(2);

    document.getElementById('inl-exec').textContent = exec + '°';
    document.getElementById('inl-gony').innerHTML = gons + '<sup>g</sup>';
};

window.inlineFinish = () => {
    const id = inlinePrzejsciaState.dnId;
    if (!id) return;

    const rzedna = document.getElementById('inl-rzedna').value;
    const angle = parseFloat(document.getElementById('inl-angle').value) || 0;
    const notes = document.getElementById('inl-notes').value.trim();

    const exec = (angle === 0 || angle === 360) ? 0 : (360 - angle);
    const gons = (angle * 400 / 360).toFixed(2);

    const well = getCurrentWell();
    if (!well) { showToast('Najpierw dodaj studnię', 'error'); return; }
    if (!well.przejscia) well.przejscia = [];

    well.przejscia.push({
        productId: id,
        rzednaWlaczenia: rzedna ? parseFloat(rzedna).toFixed(2) : null,
        angle: angle,
        angleExecution: exec,
        angleGony: gons,
        notes: notes
    });

    inlinePrzejsciaState.dnId = null;
    refreshAll();
    autoSelectComponents(true);
    showToast('Dodano przejście szczelne', 'success');
    renderInlinePrzejsciaApp();
};

function removePrzejscieFromWell(index) {
    if (isOfferLocked()) { showToast(OFFER_LOCKED_MSG, 'error'); return; }
    const well = getCurrentWell();
    if (!well) return;
    if (well.przejscia) {
        well.przejscia.splice(index, 1);
        refreshAll();
        autoSelectComponents(true);
    }
}


/* ===== SUMMARY ===== */
function updateSummary() {
    const well = getCurrentWell();
    if (!well) {
        document.getElementById('sum-price').textContent = '0 PLN';
        document.getElementById('sum-weight').textContent = '0 kg';
        document.getElementById('sum-height').textContent = '0 mm';
        document.getElementById('sum-area-int').textContent = '0,00 m²';
        document.getElementById('sum-area-ext').textContent = '0,00 m²';
        const titleEl = document.getElementById('well-diagram-title');
        if (titleEl) titleEl.innerHTML = '🔍 Podgląd studni';
        document.getElementById('ws-price').textContent = '0 PLN';
        document.getElementById('ws-weight').textContent = '0 kg';
        document.getElementById('ws-height').textContent = '0 mm';
        updateHeightIndicator();
        return;
    }
    const stats = calcWellStats(well);

    // Bottom bar
    document.getElementById('sum-price').textContent = fmtInt(stats.price) + ' PLN';
    document.getElementById('sum-weight').textContent = fmtInt(stats.weight) + ' kg';
    document.getElementById('sum-height').textContent = fmtInt(stats.height) + ' mm';
    document.getElementById('sum-area-int').textContent = fmt(stats.areaInt) + ' m²';
    document.getElementById('sum-area-ext').textContent = fmt(stats.areaExt) + ' m²';

    // Side panel
    const titleEl = document.getElementById('well-diagram-title');
    if (titleEl) titleEl.innerHTML = `🔍 Podgląd studni - ${well.name}`;

    document.getElementById('ws-price').textContent = fmtInt(stats.price) + ' PLN';
    document.getElementById('ws-weight').textContent = fmtInt(stats.weight) + ' kg';
    document.getElementById('ws-height').textContent = fmtInt(stats.height) + ' mm';

    // Height indicator
    updateHeightIndicator();
}

/* ===== WELL DIAGRAM (SVG) ===== */
function renderWellDiagram() {
    const svg = document.getElementById('well-diagram');
    const well = getCurrentWell();

    if (!well || well.config.length === 0) {
        svg.setAttribute('viewBox', '0 0 300 500');
        svg.innerHTML = `
      <text x="150" y="240" text-anchor="middle" fill="#64748b" font-size="13" font-family="Inter,sans-serif">Dodaj elementy</text>
      <text x="150" y="260" text-anchor="middle" fill="#475569" font-size="11" font-family="Inter,sans-serif">aby zobaczyć podgląd</text>`;
        return;
    }

    const typeOrder = {
        wlaz: 1,         // Właz na samej górze
        avr: 2,          // Pierścienie poniżej włazu
        plyta_din: 3,    // Zwieńczenie
        plyta_najazdowa: 3,
        plyta_zamykajaca: 3, // Płyta odciążająca wyżej niż kręgi
        konus: 3,        // Konus zamiennie z płytami na tej samej wysokości domyślnej
        pierscien_odciazajacy: 4, // Pierścień poniżej płyty
        krag: 5,         // Kręgi pod spodem
        krag_ot: 5,
        osadnik: 5.5,    // Osadnik pod krągami
        dennica: 6,      // Dno na dole
        plyta_redukcyjna: 7
    };

    const components = [];
    well.config.forEach(item => {
        const p = studnieProducts.find(pr => pr.id === item.productId);
        if (!p) return;
        for (let i = 0; i < item.quantity; i++) components.push({ ...p });
    });

    const getSortOrder = (c) => {
        let order = typeOrder[c.componentType] || 99;
        if (c.componentType === 'plyta_redukcyjna') return 4.7;
        if ((c.componentType === 'krag' || c.componentType === 'krag_ot') && c.dn === 1000) return 4.5;
        // top closures of DN1000 also render on top naturally due to their base order (3 or 4)
        return order;
    };

    const visible = components.filter(c => (c.height || 0) > 0);
    visible.sort((a, b) => getSortOrder(a) - getSortOrder(b));

    if (visible.length === 0) {
        svg.setAttribute('viewBox', '0 0 300 500');
        svg.innerHTML = `<text x="150" y="240" text-anchor="middle" fill="#64748b" font-size="12">Brak elementów z wysokością</text>`;
        return;
    }

    const totalMm = visible.reduce((s, c) => s + c.height, 0);
    const bodyDN = well.dn;

    // Canvas
    const svgW = 320;
    const mL = 15, mR = 55, mT = 15, mB = 22;
    const drawW = svgW - mL - mR;

    // ── Real physical outer diameters for each element type ──
    // Konus: bottom = well DN, top = 625mm standard opening
    // Płyta DIN: outer = well DN, 625mm opening hole  
    // Płyta redukcyjna: outer = well DN (e.g. 1200), transitions to 1000 below
    // Płyta zamykająca / pierścień odciążający: outer rim = well DN + ~200mm 
    // Płyta najazdowa: square plate = well DN + ~200mm
    // Właz: standard 600mm manhole cover
    // AVR: standard 625mm adjustment ring
    // Kręgi, dennica, osadnik: = well DN (from product dn field)

    // Get the visual outer width (in mm) for diagram rendering
    function getElementOuterDn(comp) {
        const ct = comp.componentType;
        const prodDn = (comp.dn && typeof comp.dn === 'number') ? comp.dn : bodyDN;

        switch (ct) {
            case 'wlaz':
                return 600;  // standard manhole cover diameter
            case 'avr':
                return 625;  // standard adjustment ring
            case 'konus':
                return prodDn;  // bottom width = well DN (top is 625, handled in rendering)
            case 'plyta_din':
                return prodDn;  // coincides with well DN
            case 'plyta_redukcyjna':
                return prodDn;  // outer = well DN
            case 'plyta_zamykajaca':
            case 'pierscien_odciazajacy':
                return prodDn + 200;  // outer rim extends beyond well shaft
            case 'plyta_najazdowa':
                return prodDn + 200;  // square plate extends beyond well shaft
            case 'dennica':
            case 'krag':
            case 'krag_ot':
            case 'osadnik':
            default:
                return prodDn;
        }
    }

    // Przewidzenie najszerszego elementu — bazujemy na DN studni (kręgi nadbudowy)
    // Płyty, które wystają poza obrys studni (zamykająca, najazdowa +200mm)
    // mogą wychodzić lekko poza, ale skala opiera się na DN studni
    let maxElemWidth = bodyDN;
    if (maxElemWidth < 1000) maxElemWidth = 1000;

    // Skaler: stała proporcja dopasowana do szerokości okna
    const pxMm = drawW / maxElemWidth;

    const drawH = totalMm * pxMm;
    const svgH = drawH + mT + mB;
    svg.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`);

    // Zwraca piksele z milimetrów
    const mmToPx = (mm) => mm * pxMm;
    const cx = mL + drawW / 2;

    const TC = {
        wlaz: { fill: '#1e293b', stroke: '#334155', label: 'Właz' },
        plyta_din: { fill: '#be185d', stroke: '#ec4899', label: 'Płyta DIN' },
        plyta_najazdowa: { fill: '#9d174d', stroke: '#f472b6', label: 'Pł. Odci.' },
        plyta_zamykajaca: { fill: '#7c3aed', stroke: '#a78bfa', label: 'Pł. Odci.' },
        pierscien_odciazajacy: { fill: '#0891b2', stroke: '#22d3ee', label: 'PO' },
        konus: { fill: '#d97706', stroke: '#fbbf24', label: 'Konus' },
        avr: { fill: '#475569', stroke: '#94a3b8', label: 'AVR' },
        krag: { fill: '#4338ca', stroke: '#818cf8', label: 'Krąg' },
        krag_ot: { fill: '#4338ca', stroke: '#c084fc', label: 'Krąg OT' },
        osadnik: { fill: '#a16207', stroke: '#fbbf24', label: 'Osadnik' },
        dennica: { fill: '#047857', stroke: '#34d399', label: 'Dennica' },
        plyta_redukcyjna: { fill: '#6d28d9', stroke: '#a78bfa', label: 'Płyta red.' },
    };

    let svg_out = '';
    let y = mT;

    visible.forEach(comp => {
        const h = comp.height * pxMm;
        const outerDn = getElementOuterDn(comp);
        const w = Math.max(mmToPx(outerDn), 20);
        const x = cx - w / 2;
        const c = TC[comp.componentType] || { fill: '#334155', stroke: '#64748b', label: '' };

        if (comp.componentType === 'konus') {
            // Konus: trapezoid — top = 625mm opening, bottom = well DN
            const topW = Math.max(mmToPx(625), 20);
            const topX = cx - topW / 2;
            svg_out += `<polygon points="${topX},${y} ${topX + topW},${y} ${x + w},${y + h} ${x},${y + h}" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5" opacity="0.85"/>`;
        } else if (comp.componentType === 'dennica') {
            // Dennica: rectangle with thick bottom line
            svg_out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5" opacity="0.85"/>`;
            svg_out += `<line x1="${x}" y1="${y + h}" x2="${x + w}" y2="${y + h}" stroke="${c.stroke}" stroke-width="3"/>`;
        } else if (comp.componentType === 'plyta_redukcyjna') {
            // Płyta redukcyjna: prostokąt o szerokości DN studni
            svg_out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5" opacity="0.85"/>`;
        } else if (comp.componentType === 'plyta_zamykajaca' || comp.componentType === 'pierscien_odciazajacy') {
            // Wider plate/ring with outer rim
            svg_out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5" opacity="0.85"/>`;
        } else if (comp.componentType === 'plyta_najazdowa') {
            // Square drive-over plate
            svg_out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5" opacity="0.85"/>`;
        } else if (comp.componentType === 'plyta_din') {
            // Same width as well shaft
            svg_out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5" opacity="0.85"/>`;
        } else if (comp.componentType === 'wlaz') {
            // Właz: 600mm manhole cover
            svg_out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5" opacity="0.95"/>`;
        } else if (comp.componentType === 'avr') {
            // AVR: 625mm adjustment ring
            svg_out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5" opacity="0.85"/>`;
        } else if (comp.componentType === 'osadnik') {
            svg_out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5" opacity="0.85"/>`;
            const oy = y + h * 0.65;
            svg_out += `<line x1="${x + 4}" y1="${oy}" x2="${x + w - 4}" y2="${oy}" stroke="${c.stroke}" stroke-width="0.7" stroke-dasharray="3,2" opacity="0.6"/>`;
            svg_out += `<line x1="${x + 4}" y1="${oy + h * 0.15}" x2="${x + w - 4}" y2="${oy + h * 0.15}" stroke="${c.stroke}" stroke-width="0.5" stroke-dasharray="2,2" opacity="0.4"/>`;
        } else {
            // Kręgi and other elements
            svg_out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5" opacity="0.85"/>`;
            if (comp.componentType === 'krag_ot') {
                const hr = Math.min(h * 0.15, 7);
                if (hr > 2) {
                    svg_out += `<circle cx="${x + 10}" cy="${y + h / 2}" r="${hr}" fill="rgba(15,23,42,0.7)" stroke="${c.stroke}" stroke-width="0.8"/>`;
                    svg_out += `<circle cx="${x + w - 10}" cy="${y + h / 2}" r="${hr}" fill="rgba(15,23,42,0.7)" stroke="${c.stroke}" stroke-width="0.8"/>`;
                }
            }
        }

        // ── Label wewnątrz elementu ──
        if (h > 18) {
            const fontSize = Math.min(11, Math.max(8, h * 0.35));
            svg_out += `<text x="${cx}" y="${y + h / 2 + 4}" text-anchor="middle" fill="white" font-size="${fontSize}" font-family="Inter,sans-serif" font-weight="700" opacity="0.95">${c.label}</text>`;
        } else if (h > 8) {
            svg_out += `<text x="${cx}" y="${y + h / 2 + 3}" text-anchor="middle" fill="white" font-size="7" font-family="Inter,sans-serif" font-weight="600" opacity="0.8">${c.label}</text>`;
        }

        // ── Wymiar po prawej z kreskami ──
        if (h > 6) {
            const dx = cx + mmToPx(maxElemWidth) / 2 + 8;
            // Kreska pionowa wymiaru
            svg_out += `<line x1="${dx}" y1="${y + 1}" x2="${dx}" y2="${y + h - 1}" stroke="#94a3b8" stroke-width="0.7"/>`;
            // Kreski poziome (górny i dolny tick)
            svg_out += `<line x1="${dx - 3}" y1="${y + 1}" x2="${dx + 3}" y2="${y + 1}" stroke="#94a3b8" stroke-width="0.7"/>`;
            svg_out += `<line x1="${dx - 3}" y1="${y + h - 1}" x2="${dx + 3}" y2="${y + h - 1}" stroke="#94a3b8" stroke-width="0.7"/>`;
            // Tekst wymiaru
            const dimFontSize = Math.min(10, Math.max(7, h * 0.3));
            svg_out += `<text x="${dx + 6}" y="${y + h / 2 + 3.5}" text-anchor="start" fill="#cbd5e1" font-size="${dimFontSize}" font-family="Inter,sans-serif" font-weight="600">${comp.height}</text>`;
        }

        y += h;
    });

    // Draw Przejscia
    if (well.przejscia && well.przejscia.length > 0 && well.rzednaDna !== null && well.rzednaWlazu !== null) {
        const bottomElev = parseFloat(well.rzednaDna) || 0;

        well.przejscia.forEach(pr => {
            let pel = parseFloat(pr.rzednaWlaczenia);
            if (isNaN(pel)) pel = 0;

            const pprod = studnieProducts.find(x => x.id === pr.productId);
            let prW = 160, prH = 160, isEgg = false;
            if (pprod && typeof pprod.dn === 'string' && pprod.dn.includes('/')) {
                const parts = pprod.dn.split('/');
                prW = parseFloat(parts[0]) || 160;
                prH = parseFloat(parts[1]) || prW;
                isEgg = true;
            } else if (pprod) {
                prW = parseFloat(pprod.dn) || 160;
                prH = prW;
            } else {
                prW = prH = 160;
            }

            const mmFromBottom = (pel - bottomElev) * 1000;
            if (mmFromBottom > -5000 && mmFromBottom < totalMm + 5000) {
                const radiusW = Math.max((prW / 2) * pxMm, 3);
                const radiusH = Math.max((prH / 2) * pxMm, 3);
                const prY = (mT + drawH) - (mmFromBottom * pxMm) - radiusH;

                let px = cx;
                const a = parseFloat(pr.angle) || 0;
                const bw = mmToPx(bodyDN);
                const offset = Math.sin((a * Math.PI) / 180) * (bw / 2 - radiusW);
                px += offset;

                const isBack = a > 90 && a < 270;
                const pColor = isBack ? 'rgba(71,85,105,0.4)' : '#38bdf8';
                const sColor = isBack ? 'rgba(100,116,139,0.5)' : '#0ea5e9';
                const sDash = isBack ? 'stroke-dasharray="2,2"' : '';

                if (isEgg) {
                    // SVG ellipse for jajowe pipe cross-section
                    svg_out += `<ellipse cx="${px}" cy="${prY}" rx="${radiusW}" ry="${radiusH}" fill="${pColor}" stroke="${sColor}" stroke-width="1.5" ${sDash} />`;
                } else {
                    svg_out += `<circle cx="${px}" cy="${prY}" r="${radiusW}" fill="${pColor}" stroke="${sColor}" stroke-width="1.5" ${sDash} />`;
                }

                if (!isBack) {
                    svg_out += `<text x="${px}" y="${prY - radiusH - 4}" text-anchor="middle" fill="#7dd3fc" font-size="8" font-weight="700" font-family="Inter,sans-serif">${a}°</text>`;
                }
            }
        });
    }

    // ── Łączna wysokość – pasek po prawej ──
    const aX = svgW - 10;
    svg_out += `<line x1="${aX}" y1="${mT}" x2="${aX}" y2="${mT + drawH}" stroke="#818cf8" stroke-width="1.5" stroke-dasharray="4,3"/>`;
    svg_out += `<line x1="${aX - 4}" y1="${mT}" x2="${aX + 4}" y2="${mT}" stroke="#818cf8" stroke-width="1.5"/>`;
    svg_out += `<line x1="${aX - 4}" y1="${mT + drawH}" x2="${aX + 4}" y2="${mT + drawH}" stroke="#818cf8" stroke-width="1.5"/>`;
    // Tło pod tekstem
    const totalLabel = fmtInt(totalMm) + ' mm';
    svg_out += `<rect x="${aX - 20}" y="${mT + drawH / 2 - 7}" width="40" height="14" rx="3" fill="rgba(15,23,42,0.85)"/>`;
    svg_out += `<text x="${aX}" y="${mT + drawH / 2 + 4}" text-anchor="middle" fill="#a5b4fc" font-size="9" font-family="Inter,sans-serif" font-weight="700" transform="rotate(-90 ${aX} ${mT + drawH / 2})">${totalLabel}</text>`;

    // ── Oznaczenie DN na dole ──
    svg_out += `<text x="${cx}" y="${mT + drawH + mB - 2}" text-anchor="middle" fill="#64748b" font-size="9" font-family="Inter,sans-serif" font-weight="600">DN${bodyDN}</text>`;

    svg.innerHTML = svg_out;
}

/* ===== OFFER SUMMARY ===== */
function renderOfferSummary() {
    const container = document.getElementById('offer-summary-body');
    if (!container) return;

    // Check for order changes dynamically against current wells in memory
    const order = getCurrentOfferOrder();
    const orderChanges = order ? getOrderChanges({ ...order, wells: wells }) : {};
    const hasChanges = Object.keys(orderChanges).length > 0;

    let totalPrice = 0, totalWeight = 0;

    let html = '';

    // Order status banner
    if (order) {
        const changeCount = Object.keys(orderChanges).length;
        html += `<div style="display:flex; align-items:center; justify-content:space-between; padding:0.5rem 0.8rem; margin-bottom:0.5rem; background:${hasChanges ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)'}; border:1px solid ${hasChanges ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}; border-radius:8px;">
            <div style="display:flex; align-items:center; gap:0.4rem;">
                <span style="font-size:1.1rem;">📦</span>
                <span style="font-size:0.75rem; font-weight:700; color:${hasChanges ? '#f87171' : '#34d399'};">ZAMÓWIENIE ${hasChanges ? '— ' + changeCount + ' studni zmienionych' : '— bez zmian'}</span>
            </div>
            <button class="btn btn-sm" style="background:rgba(16,185,129,0.15); border:1px solid rgba(16,185,129,0.3); color:#34d399; font-size:0.65rem; padding:0.15rem 0.4rem;" onclick="orderEditMode ? saveCurrentOrder() : saveOrderStudnie()">📦 Zapisz zamówienie</button>
        </div>`;
    }

    html += `<div class="table-wrap">
    <table style="table-layout:fixed; width:100%;">
      <thead>
        <tr>
          <th style="width:5%;">Lp.</th>
          <th style="width:18%;">Nazwa studni</th>
          <th style="width:8%;">DN</th>
          <th style="width:8%;">Elementy</th>
          <th class="text-right" style="width:12%;">Waga</th>
          <th class="text-right" style="width:10%;">Wys.</th>
          <th class="text-right" style="width:12%;">Pow. wewn.</th>
          <th class="text-right" style="width:12%;">Pow. zewn.</th>
          <th class="text-right" style="width:15%;">Cena netto</th>
        </tr>
      </thead>
      <tbody>`;

    wells.forEach((well, i) => {
        const stats = calcWellStats(well);
        totalPrice += stats.price;
        totalWeight += stats.weight;

        const wc = orderChanges[i];
        const isChanged = !!wc;
        const rowStyle = isChanged
            ? (wc.type === 'added' ? 'border-left:3px solid #34d399; background:rgba(16,185,129,0.05);' : 'border-left:3px solid #ef4444; background:rgba(239,68,68,0.05);')
            : '';
        const changeBadge = isChanged
            ? (wc.type === 'added'
                ? '<span style="font-size:0.55rem; padding:1px 5px; border-radius:3px; background:rgba(16,185,129,0.2); color:#34d399; font-weight:700; margin-left:0.3rem;">🟢 NOWE</span>'
                : '<span style="font-size:0.55rem; padding:1px 5px; border-radius:3px; background:rgba(239,68,68,0.2); color:#f87171; font-weight:700; margin-left:0.3rem;">🔴 ZMIENIONO</span>')
            : '';

        html += `<tr style="cursor:pointer; ${rowStyle}" onclick="showSection('builder'); selectWell(${i})">
      <td>${i + 1}</td>
      <td style="font-weight:600; color:var(--text-primary);">${well.name}${changeBadge}</td>
      <td>DN${well.dn}</td>
      <td>${well.config.length}</td>
      <td class="text-right">${fmtInt(stats.weight)} kg</td>
      <td class="text-right">${fmtInt(stats.height)} mm</td>
      <td class="text-right">${fmt(stats.areaInt)} m²</td>
      <td class="text-right">${fmt(stats.areaExt)} m²</td>
      <td class="text-right" style="font-weight:700; color:var(--success);">${fmtInt(stats.price)} PLN</td>
    </tr>`;

        // Component details
        well.config.forEach(item => {
            const p = studnieProducts.find(pr => pr.id === item.productId);
            if (!p) return;
            html += `<tr style="opacity:0.6; ${isChanged && wc.type === 'modified' && wc.fields?.includes('config') ? 'color:#f87171;' : ''}">
        <td></td>
        <td colspan="2" style="padding-left:1.5rem; font-size:0.78rem; ${isChanged && wc.type === 'modified' && wc.fields?.includes('config') ? 'color:#f87171;' : 'color:var(--text-muted);'}">↳ ${p.name}</td>
        <td style="font-size:0.78rem;">${item.quantity} szt.</td>
        <td class="text-right" style="font-size:0.78rem;">${fmtInt((p.weight || 0) * item.quantity)} kg</td>
        <td class="text-right" style="font-size:0.78rem;">${p.height ? fmtInt(p.height) + ' mm' : '—'}</td>
        <td class="text-right" style="font-size:0.78rem;">${p.area ? fmt(p.area * item.quantity) : '—'}</td>
        <td class="text-right" style="font-size:0.78rem;">${p.areaExt ? fmt(p.areaExt * item.quantity) : '—'}</td>
        <td class="text-right" style="font-size:0.78rem;">${fmtInt(p.price * item.quantity)} PLN</td>
      </tr>`;
        });

        // Transitions details in offer
        if (well.przejscia && well.przejscia.length > 0) {
            well.przejscia.forEach(item => {
                const p = studnieProducts.find(pr => pr.id === item.productId);
                if (!p) return;
                html += `<tr style="opacity:0.6; ${isChanged && wc.type === 'modified' && wc.fields?.includes('przejscia') ? 'color:#f87171;' : 'color:#818cf8;'}">
                    <td></td>
                    <td colspan="2" style="padding-left:1.5rem; font-size:0.72rem;">↳ Przejście szczelne: ${p.category} ${typeof p.dn === 'string' && p.dn.includes('/') ? p.dn : 'DN' + p.dn} (${item.angle}°)</td>
                    <td style="font-size:0.72rem;">1 szt.</td>
                    <td class="text-right" style="font-size:0.72rem;">${fmtInt(p.weight || 0)} kg</td>
                    <td class="text-right" style="font-size:0.72rem;">—</td>
                    <td class="text-right" style="font-size:0.72rem;">—</td>
                    <td class="text-right" style="font-size:0.72rem;">—</td>
                    <td class="text-right" style="font-size:0.72rem;">${fmtInt(p.price)} PLN</td>
                </tr>`;
            });
        }
    });

    html += `</tbody>
      <tfoot>
        <tr style="border-top:2px solid var(--border-glass);">
          <td colspan="4" style="font-weight:700; font-size:0.95rem; color:var(--text-primary);">RAZEM (${wells.length} studni)</td>
          <td class="text-right" style="font-weight:700;">${fmtInt(totalWeight)} kg</td>
          <td></td><td></td><td></td>
          <td class="text-right" style="font-weight:800; font-size:1.1rem; color:var(--success);">${fmtInt(totalPrice)} PLN</td>
        </tr>
      </tfoot>
    </table></div>`;

    container.innerHTML = html;

    // Update offer totals
    const totalEl = document.getElementById('sum-total-netto');
    const bruttoEl = document.getElementById('sum-brutto-details');
    const weightEl = document.getElementById('sum-netto-weight');
    const transCostEl = document.getElementById('sum-transport-cost');

    // Transport
    const transportKm = parseFloat(document.getElementById('transport-km')?.value) || 0;
    const transportRate = parseFloat(document.getElementById('transport-rate')?.value) || 0;
    let transportCost = 0;
    if (transportKm > 0 && transportRate > 0) {
        // Obliczamy ile tirów potrzeba w uproszczeniu (1 tir = 24t)
        const totalTransports = Math.ceil(totalWeight / 24000);
        const transportCostPerTrip = transportKm * transportRate;
        transportCost = totalTransports * transportCostPerTrip;

        if (transCostEl) transCostEl.textContent = fmtInt(transportCost) + ' PLN';

        const transDetails = document.getElementById('transport-breakdown');
        if (transDetails) {
            transDetails.innerHTML = `<div style="font-size:0.8rem; color:var(--text-muted); background:rgba(15,23,42,0.4); padding:0.8rem; border-radius:8px; border:1px solid rgba(255,255,255,0.05); margin-bottom:1rem;">
             🛣️ Łączny ciężar to <strong>${fmtInt(totalWeight)} kg</strong> co wymaga ok. <strong>${totalTransports} transportów</strong>. 
             Koszt jednego kursu: <strong>${fmtInt(transportCostPerTrip)} PLN</strong>. Łącznie transport: <strong>${fmtInt(transportCost)} PLN</strong>.
           </div>`;
        }
    } else {
        if (transCostEl) transCostEl.textContent = '0 PLN';
        const transDetails = document.getElementById('transport-breakdown');
        if (transDetails) transDetails.innerHTML = '';
    }

    const finalNetto = totalPrice + transportCost;

    if (totalEl) totalEl.textContent = fmtInt(finalNetto) + ' PLN';
    if (bruttoEl) bruttoEl.textContent = 'Brutto: ' + fmtInt(finalNetto * 1.23) + ' PLN';
    if (weightEl) weightEl.textContent = fmtInt(totalWeight) + ' kg';
}

/* ===== CENNIK TABS ===== */
const CENNIK_TAB_FILTERS = {
    dn1000: p => p.category === 'Studnie DN1000',
    dn1200: p => p.category === 'Studnie DN1200',
    dn1500: p => p.category === 'Studnie DN1500',
    dn2000: p => p.category === 'Studnie DN2000',
    dn2500: p => p.category === 'Studnie DN2500',
    dennicy: p => p.componentType === 'dennica',
    akcesoria: p => p.category === 'Akcesoria studni' || p.category === 'Uszczelki studni',
    przejscia: p => p.componentType === 'przejscie'
};

function selectCennikTab(tab) {
    currentCennikTab = tab;
    document.querySelectorAll('.cennik-tab').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === tab);
    });
    renderStudniePriceList();
}

/* ===== PRICE LIST ===== */
function renderStudniePriceList() {
    const container = document.getElementById('studnie-pricelist-body');
    const searchVal = document.getElementById('studnie-pricelist-search')?.value?.toLowerCase() || '';
    const tabFilter = CENNIK_TAB_FILTERS[currentCennikTab] || (() => true);

    const filteredProducts = studnieProducts.filter(p =>
        tabFilter(p) &&
        (!searchVal || p.id.toLowerCase().includes(searchVal) || p.name.toLowerCase().includes(searchVal))
    );

    const groups = {};
    const dynamicGroups = new Set();
    filteredProducts.forEach(p => {
        let groupKey;
        if (currentCennikTab === 'dennicy' && p.dn) {
            groupKey = 'dn' + p.dn;
        } else if (currentCennikTab === 'przejscia') {
            groupKey = p.category || 'inne';
            dynamicGroups.add(groupKey);
        } else {
            groupKey = p.componentType || 'inne';
        }
        if (!groups[groupKey]) groups[groupKey] = [];
        groups[groupKey].push(p);
    });

    const groupLabels = {
        dennica: '🟩 Dennicy',
        osadnik: '🪣 Osadniki',
        konus: '🔶 Konusy',
        krag: '🟦 Kręgi',
        krag_ot: '🟪 Kręgi z otworami (OT)',
        plyta_din: '📐 Płyty DIN',
        plyta_najazdowa: '🪨 Płyty odciążające',
        plyta_zamykajaca: '🪨 Płyta odciążająca',
        pierscien_odciazajacy: '⭕ Pierścienie odciążające',
        plyta_redukcyjna: '⬛ Płyty redukcyjne',
        avr: '⚙️ AVR / Pierścienie wyrównawcze',
        uszczelka: '🟢 Uszczelki',
        inne: '📦 Inne',
        przejscie: '🔗 Nawiercenia / Przejścia',
        dn1000: '🔵 DN1000',
        dn1200: '🟣 DN1200',
        dn1500: '🔴 DN1500',
        dn2000: '🟠 DN2000',
        dn2500: '🔴 DN2500'
    };

    let groupOrder = ['dn1000', 'dn1200', 'dn1500', 'dn2000', 'dn2500', 'plyta_din', 'plyta_najazdowa', 'plyta_zamykajaca', 'pierscien_odciazajacy', 'konus', 'krag', 'krag_ot', 'dennica', 'plyta_redukcyjna', 'avr', 'uszczelka', 'przejscie', 'inne'];

    const isPrzejscia = currentCennikTab === 'przejscia';

    if (isPrzejscia) {
        groupOrder = Array.from(dynamicGroups).sort();
    } else {
        // Append any custom groups not in the predefined order
        const allGroupKeys = Object.keys(groups);
        allGroupKeys.forEach(k => {
            if (!groupOrder.includes(k)) groupOrder.push(k);
        });
    }

    let html = `<div class="table-wrap">
    <div style="padding:0.5rem; text-align:right; display:flex; gap:0.5rem; justify-content:flex-end;">
        ${isPrzejscia ? `<button class="btn btn-secondary" onclick="addPrzejsciaCategory()" style="font-size:0.8rem; padding:0.4rem 0.8rem;">➕ Dodaj kategorię przejść</button>` : `<button class="btn btn-secondary" onclick="addStudnieCategory()" style="font-size:0.8rem; padding:0.4rem 0.8rem;">➕ Dodaj kategorię</button>`}
        <button class="btn btn-secondary" onclick="addStudnieElement()" style="font-size:0.8rem; padding:0.4rem 0.8rem;">➕ Dodaj element</button>
    </div>
    <table style="table-layout: fixed; width: 100%;">
      <thead>
        <tr>
          <th style="width: 12%;">Indeks</th>
          <th style="width: 20%;">${isPrzejscia ? 'Rodzaj przejścia' : 'Nazwa elementu'}</th>
          ${isPrzejscia ? `
          <th class="text-center" style="width: 8%;">Średnica (DN)</th>
          <th class="text-right" style="width: 7%;">Waga kg</th>
          <th class="text-right" style="width: 8%;">Zap. dół mm</th>
          <th class="text-right" style="width: 8%;">Zap. góra mm</th>
          <th class="text-right" style="width: 8%;">Zap. dół min</th>
          <th class="text-right" style="width: 8%;">Zap. góra min</th>
          ` : `
          <th class="text-right" style="width: 5%;">Wys. mm</th>
          <th class="text-right" style="width: 5%;">Waga kg</th>
          <th class="text-right" style="width: 5%;">P. wew</th>
          <th class="text-right" style="width: 5%;">P. zew</th>
          <th class="text-right" style="width: 5%;">Ilość</th>
          <th class="text-right" style="width: 6%;">PEHD</th>
          <th class="text-right" style="width: 6%;">MalW</th>
          <th class="text-right" style="width: 6%;">MalZ</th>
          <th class="text-right" style="width: 5%;">Żelbet</th>
          <th class="text-right" style="width: 5%;">Drab.Ni.</th>
          <th class="text-center" style="width: 3%;">Mag WL</th>
          <th class="text-center" style="width: 3%;">Mag KLB</th>
          <th class="text-center" style="width: 3%;">Forma std.</th>
          `}
          <th class="text-right" style="width: 7%;">Cena PLN</th>
          <th class="text-center" style="width: 8%;">Akcje</th>
        </tr>
      </thead>`;

    let hasAnyItems = false;

    groupOrder.forEach(groupKey => {
        const items = groups[groupKey];
        if (!items || items.length === 0) return;
        hasAnyItems = true;
        const label = groupLabels[groupKey] || groupKey;

        html += `<tbody>
      <tr>
        <td colspan="${isPrzejscia ? '10' : '17'}" style="padding:0; border-bottom:1px solid var(--border);">
          <div style="display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0.5rem; background:rgba(99,102,241,0.06); font-size:0.85rem;">
            <span style="font-weight:700; color:var(--text-primary);">${label} <span style="opacity:.5">(${items.length})</span></span>
            <div style="display:flex;gap:0.3rem;">
              <button class="btn-icon" title="Dodaj element do tej kategorii" onclick="addStudnieElement('${groupKey.replace(/'/g, "\\'")}')"
                style="padding:0.2rem 0.5rem; font-size:0.75rem;">➕</button>
              <button class="btn-icon del" title="Usuń całą kategorię" onclick="deleteStudnieCategory('${groupKey.replace(/'/g, "\\'")}')"
                style="padding:0.2rem 0.5rem; font-size:0.75rem;">🗑️</button>
            </div>
          </div>
        </td>
      </tr>`;

        items.forEach(p => {
            html += `<tr>
        <td onclick="editStudnieCell(this,'id','${p.id}')" style="cursor:pointer; font-size:0.78rem; color:var(--text-muted);">${p.id}</td>
        <td onclick="editStudnieCell(this,'name','${p.id}')" style="cursor:pointer; font-weight:500;">${p.name}</td>`;

            if (isPrzejscia) {
                html += `
        <td class="text-center" style="font-weight:600; color:#818cf8; cursor:pointer;" onclick="editStudnieCell(this,'dn','${p.id}')">${p.dn != null ? (typeof p.dn === 'string' && p.dn.includes('/') ? p.dn : 'DN ' + p.dn) : '—'}</td>
        <td class="text-right" onclick="editStudnieCell(this,'weight','${p.id}')" style="cursor:pointer; font-weight:600;">${p.weight != null ? fmtInt(p.weight) : '—'}</td>
        <td class="text-right" onclick="editStudnieCell(this,'zapasDol','${p.id}')" style="cursor:pointer;">${p.zapasDol != null ? fmtInt(p.zapasDol) : '—'}</td>
        <td class="text-right" onclick="editStudnieCell(this,'zapasGora','${p.id}')" style="cursor:pointer;">${p.zapasGora != null ? fmtInt(p.zapasGora) : '—'}</td>
        <td class="text-right" onclick="editStudnieCell(this,'zapasDolMin','${p.id}')" style="cursor:pointer; color:#fbbf24;">${p.zapasDolMin != null ? fmtInt(p.zapasDolMin) : '—'}</td>
        <td class="text-right" onclick="editStudnieCell(this,'zapasGoraMin','${p.id}')" style="cursor:pointer; color:#fbbf24;">${p.zapasGoraMin != null ? fmtInt(p.zapasGoraMin) : '—'}</td>
               `;
            } else {
                html += `
        <td class="text-right" onclick="editStudnieCell(this,'height','${p.id}')" style="cursor:pointer; font-weight:600; color:#818cf8;">${p.height != null ? fmtInt(p.height) : '—'}</td>
        <td class="text-right" onclick="editStudnieCell(this,'weight','${p.id}')" style="cursor:pointer;">${p.weight != null ? fmtInt(p.weight) : '—'}</td>
        <td class="text-right" onclick="editStudnieCell(this,'area','${p.id}')" style="cursor:pointer;">${p.area != null ? fmt(p.area) : '—'}</td>
        <td class="text-right" onclick="editStudnieCell(this,'areaExt','${p.id}')" style="cursor:pointer;">${p.areaExt != null ? fmt(p.areaExt) : '—'}</td>
        <td class="text-right" onclick="editStudnieCell(this,'transport','${p.id}')" style="cursor:pointer;">${p.transport != null ? fmtInt(p.transport) : '—'}</td>
        <td class="text-right" onclick="editStudnieCell(this,'doplataPEHD','${p.id}')" style="cursor:pointer; color:var(--success);">${p.doplataPEHD != null ? '+' + fmtInt(p.doplataPEHD) : '—'}</td>
        <td class="text-right" onclick="editStudnieCell(this,'malowanieWewnetrzne','${p.id}')" style="cursor:pointer; color:var(--success);">${p.malowanieWewnetrzne != null ? '+' + fmtInt(p.malowanieWewnetrzne) : '—'}</td>
        <td class="text-right" onclick="editStudnieCell(this,'malowanieZewnetrzne','${p.id}')" style="cursor:pointer; color:var(--success);">${p.malowanieZewnetrzne != null ? '+' + fmtInt(p.malowanieZewnetrzne) : '—'}</td>
        <td class="text-right" ${p.componentType === 'dennica' ? `onclick="editStudnieCell(this,'doplataZelbet','${p.id}')" style="cursor:pointer; color:var(--success);"` : `style="color:var(--text-muted);"`}>${p.componentType === 'dennica' ? (p.doplataZelbet != null ? '+' + fmtInt(p.doplataZelbet) : '—') : '—'}</td>
        <td class="text-right" onclick="editStudnieCell(this,'doplataDrabNierdzewna','${p.id}')" style="cursor:pointer; color:var(--success);">${p.doplataDrabNierdzewna != null ? '+' + fmtInt(p.doplataDrabNierdzewna) : '—'}</td>
        <td class="text-center" onclick="toggleMagazynField(this,'magazynWL','${p.id}')" style="cursor:pointer; font-weight:700; color:${p.magazynWL === 1 ? '#34d399' : '#f87171'};">${p.magazynWL === 1 ? '1' : '0'}</td>
        <td class="text-center" onclick="toggleMagazynField(this,'magazynKLB','${p.id}')" style="cursor:pointer; font-weight:700; color:${p.magazynKLB === 1 ? '#34d399' : '#f87171'};">${p.magazynKLB === 1 ? '1' : '0'}</td>
        <td class="text-center" onclick="toggleMagazynField(this,'formaStandardowa','${p.id}')" style="cursor:pointer; font-weight:700; color:${p.formaStandardowa === 1 ? '#34d399' : '#f87171'};">${p.formaStandardowa === 1 ? '1' : '0'}</td>
               `;
            }

            html += `
        <td class="text-right" onclick="editStudnieCell(this,'price','${p.id}')" style="cursor:pointer; font-weight:700; color:var(--success);">${fmtInt(p.price)}</td>
        <td class="text-center" style="white-space:nowrap;">
          <button class="btn-icon" title="Powiel" onclick="copyStudnieProduct('${p.id}')">📋</button>
          <button class="btn-icon" title="Usuń" onclick="deleteStudnieProduct('${p.id}')">✕</button>
        </td>
      </tr>`;
        });

        html += `</tbody>`;
    });

    html += `</table></div>`;

    if (!hasAnyItems) {
        html = `<div style="padding:2rem;text-align:center;color:var(--text-muted);">Brak wyników w tej zakładce...</div>`;
    }

    container.innerHTML = html;
}

/* ===== PRZEJŚCIA CAT. MANAGEMENT ===== */
function addPrzejsciaCategory() {
    let name = prompt('Podaj nazwę nowej kategorii (np. GRP, Incor):');
    if (!name) return;
    name = name.trim();
    if (!name) return;

    const catName = name.startsWith('W + ') ? name : `W + ${name}`;

    if (studnieProducts.some(p => p.componentType === 'przejscie' && p.category === catName)) {
        showToast('Taka kategoria już istnieje', 'error');
        return;
    }

    const defaultSizes = [110, 160, 200, 250, 315, 400];
    defaultSizes.forEach(dn => {
        studnieProducts.push({
            id: `${catName.replace(/ /g, '-')}-${dn}`,
            name: `${catName}`,
            category: catName,
            dn: dn,
            componentType: 'przejscie',
            zapasDol: 300,
            zapasGora: 300,
            zapasDolMin: 150,
            zapasGoraMin: 150,
            price: 0,
            weight: -1 * Math.round(dn / 15),
            area: null,
            areaExt: null,
            transport: null
        });
    });

    saveStudnieProducts(studnieProducts);
    renderStudniePriceList();
    showToast(`Utworzono kategorię ${catName}`, 'success');
}

function deletePrzejsciaCategory(cat) {
    deleteStudnieCategory(cat);
}

/* ===== GENERIC CATEGORY / ELEMENT MANAGEMENT ===== */

// Map tab -> { category, dn, componentType defaults }
function _tabDefaults() {
    const tab = currentCennikTab;
    const dnMap = { dn1000: 1000, dn1200: 1200, dn1500: 1500, dn2000: 2000, dn2500: 2500 };
    const catMap = { dn1000: 'Studnie DN1000', dn1200: 'Studnie DN1200', dn1500: 'Studnie DN1500', dn2000: 'Studnie DN2000', dn2500: 'Studnie DN2500', akcesoria: 'Akcesoria studni' };

    return {
        category: catMap[tab] || null,
        dn: dnMap[tab] || null,
        isPrzejscia: tab === 'przejscia',
        isDennicy: tab === 'dennicy',
        tab
    };
}

function addStudnieCategory() {
    const defaults = _tabDefaults();

    if (defaults.isPrzejscia) {
        addPrzejsciaCategory();
        return;
    }

    const name = prompt('Podaj nazwę nowej kategorii elementów:');
    if (!name || !name.trim()) return;

    const catName = name.trim();
    // Check if any products already have this as componentType
    const existingKey = catName.toLowerCase().replace(/[^a-z0-9]+/g, '_');

    // Create one placeholder element in this category
    const newProduct = {
        id: existingKey + '_1',
        name: catName,
        category: defaults.category || catName,
        dn: defaults.dn || null,
        componentType: existingKey,
        height: null,
        price: 0,
        weight: 0,
        area: null,
        areaExt: null,
        transport: null,
        magazynWL: 0,
        magazynKLB: 0,
        doplataDrabNierdzewna: null,
        formaStandardowa: 0
    };

    studnieProducts.push(newProduct);
    saveStudnieProducts(studnieProducts);
    renderStudniePriceList();
    showToast(`Utworzono kategorię "${catName}" z 1 elementem`, 'success');
}

function addStudnieElement(groupKey) {
    const defaults = _tabDefaults();

    // If groupKey provided, find example product in that group to copy defaults from
    let template = null;
    if (groupKey) {
        if (defaults.isPrzejscia) {
            template = studnieProducts.find(p => p.componentType === 'przejscie' && p.category === groupKey);
        } else if (defaults.isDennicy) {
            template = studnieProducts.find(p => p.componentType === 'dennica' && 'dn' + p.dn === groupKey);
        } else {
            template = studnieProducts.find(p => p.componentType === groupKey && CENNIK_TAB_FILTERS[defaults.tab]?.(p));
            if (!template) {
                template = studnieProducts.find(p => p.componentType === groupKey);
            }
        }
    }

    // Fallback: find any product in current tab
    if (!template) {
        const tabFilter = CENNIK_TAB_FILTERS[defaults.tab];
        if (tabFilter) {
            template = studnieProducts.find(tabFilter);
        }
    }

    const id = prompt('Podaj indeks nowego elementu:', template ? '' : '');
    if (!id || !id.trim()) return;

    const name = prompt('Podaj nazwę nowego elementu:', '');
    if (!name) return;

    const newProduct = {
        id: id.trim(),
        name: name.trim(),
        category: template?.category || defaults.category || '',
        dn: template?.dn || defaults.dn || null,
        componentType: template?.componentType || (groupKey || 'inne'),
        height: null,
        price: 0,
        weight: 0,
        area: null,
        areaExt: null,
        transport: null,
        magazynWL: 0,
        magazynKLB: 0,
        doplataDrabNierdzewna: null,
        formaStandardowa: 0
    };

    if (defaults.isPrzejscia || template?.componentType === 'przejscie') {
        newProduct.componentType = 'przejscie';
        newProduct.zapasDol = template?.zapasDol || 300;
        newProduct.zapasGora = template?.zapasGora || 300;
        newProduct.zapasDolMin = template?.zapasDolMin || 150;
        newProduct.zapasGoraMin = template?.zapasGoraMin || 150;
        const dnStr = prompt('Średnica DN:', template?.dn?.toString() || '200');
        if (dnStr) newProduct.dn = isNaN(Number(dnStr)) ? dnStr : Number(dnStr);
    }

    studnieProducts.push(newProduct);
    saveStudnieProducts(studnieProducts);
    renderStudniePriceList();
    showToast(`Dodano element "${name.trim()}"`, 'success');
}

function deleteStudnieCategory(groupKey) {
    const defaults = _tabDefaults();
    const label = groupKey;

    if (!confirm(`Czy na pewno chcesz usunąć całą kategorię: ${label} oraz wszystkie jej elementy z cennika?`)) return;

    if (defaults.isPrzejscia) {
        studnieProducts = studnieProducts.filter(p => !(p.componentType === 'przejscie' && p.category === groupKey));
    } else if (defaults.isDennicy) {
        const dn = parseInt(groupKey.replace('dn', ''), 10);
        studnieProducts = studnieProducts.filter(p => !(p.componentType === 'dennica' && p.dn === dn));
    } else {
        // Delete by componentType within the current tab filter
        const tabFilter = CENNIK_TAB_FILTERS[defaults.tab];
        studnieProducts = studnieProducts.filter(p => {
            if (!tabFilter || !tabFilter(p)) return true; // keep items not in this tab
            return p.componentType !== groupKey;
        });
    }

    saveStudnieProducts(studnieProducts);
    renderStudniePriceList();
    showToast(`Usunięto kategorię ${label}`, 'info');
}


/* ===== TOGGLE MAGAZYN FIELD ===== */
function toggleMagazynField(el, field, id) {
    const product = studnieProducts.find(p => p.id === id);
    if (!product) return;
    product[field] = product[field] === 1 ? 0 : 1;
    saveStudnieProducts(studnieProducts);
    renderStudniePriceList();
}

/* ===== INLINE EDIT ===== */
function editStudnieCell(el, field, id) {
    if (el.querySelector('input')) return;
    const product = studnieProducts.find(p => p.id === id);
    const oldVal = product[field] ?? '';
    const input = document.createElement('input');
    input.type = (field === 'name' || field === 'id') ? 'text' : 'number';
    if (input.type === 'number') input.step = 'any';
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
            if (!val) { showToast('Indeks nie może być pusty', 'error'); renderStudniePriceList(); return; }
            if (val !== id && studnieProducts.some(p => p.id === val)) { showToast('Taki indeks już istnieje', 'error'); renderStudniePriceList(); return; }
        }

        product[field] = val;
        saveStudnieProducts(studnieProducts);
        renderStudniePriceList();
        showToast('Zaktualizowano cennik studni', 'success');
    };
    input.addEventListener('blur', save);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') renderStudniePriceList(); });
}

/* ===== PRODUCT CRUD ===== */
function deleteStudnieProduct(id) {
    if (!confirm('Usunąć ten element z cennika?')) return;
    studnieProducts = studnieProducts.filter(p => p.id !== id);
    saveStudnieProducts(studnieProducts);
    renderStudniePriceList();
    showToast('Element usunięty', 'info');
}

function copyStudnieProduct(id) {
    const original = studnieProducts.find(p => p.id === id);
    if (!original) return;
    let finalId = original.id + '-KOP';
    let counter = 1;
    while (studnieProducts.some(p => p.id === finalId)) { finalId = `${original.id}-KOP${counter}`; counter++; }
    const copied = JSON.parse(JSON.stringify(original));
    copied.id = finalId;
    copied.name = copied.name + ' (Kopia)';
    const index = studnieProducts.findIndex(p => p.id === id);
    studnieProducts.splice(index + 1, 0, copied);
    saveStudnieProducts(studnieProducts);
    renderStudniePriceList();
    showToast('Element skopiowany', 'success');
}

function showAddStudnieProductModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'add-product-modal';
    overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header"><h3>➕ Dodaj element</h3><button class="btn-icon" onclick="closeModal()">✕</button></div>
      <div class="form-group"><label class="form-label">Kategoria</label>
        <select class="form-select" id="np-category" onchange="togglePrzejsciaFields()">${CATEGORIES_STUDNIE.map(c => `<option value="${c}">${c}</option>`).join('')}</select>
        <input type="text" class="form-input" id="np-custom-category" placeholder="Nazwa nowej kategorii (np. W + PVC)" style="display:none; margin-top:0.5rem;" list="przejscia-cats-list">
        <datalist id="przejscia-cats-list">
            ${[...new Set(studnieProducts.filter(p => p.componentType === 'przejscie').map(p => p.category))].filter(Boolean).map(c => `<option value="${c}">`).join('')}
        </datalist>
      </div>
      <div class="form-row" style="display:grid;grid-template-columns:1fr 1fr;gap:0.8rem;">
        <div class="form-group"><label class="form-label">Indeks</label><input class="form-input" id="np-id" placeholder="Indeks"></div>
        <div class="form-group"><label class="form-label">Nazwa</label><input class="form-input" id="np-name" placeholder="Nazwa"></div>
      </div>
      <div class="form-row" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.8rem;">
        <div class="form-group"><label class="form-label">Cena PLN</label><input class="form-input" id="np-price" type="number"></div>
        <div class="form-group non-przejscia"><label class="form-label">Wysokość mm</label><input class="form-input" id="np-height" type="number"></div>
        <div class="form-group"><label class="form-label">Waga kg</label><input class="form-input" id="np-weight" type="number"></div>
      </div>
      <div class="form-row non-przejscia" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.8rem;">
        <div class="form-group"><label class="form-label">Pow. wewn. m²</label><input class="form-input" id="np-area" type="number" step="0.01"></div>
        <div class="form-group"><label class="form-label">Pow. zewn. m²</label><input class="form-input" id="np-areaExt" type="number" step="0.01"></div>
        <div class="form-group"><label class="form-label">Ilość/transp.</label><input class="form-input" id="np-transport" type="number"></div>
      </div>
      <div class="form-row non-przejscia" style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr 1fr;gap:0.8rem;margin-top:0.8rem;">
        <div class="form-group"><label class="form-label">Dopłata PEHD PLN</label><input class="form-input" id="np-pehd" type="number"></div>
        <div class="form-group"><label class="form-label">Malow. wewn. PLN</label><input class="form-input" id="np-malW" type="number"></div>
        <div class="form-group"><label class="form-label">Malow. zewn. PLN</label><input class="form-input" id="np-malZ" type="number"></div>
        <div class="form-group"><label class="form-label">Dopłata Żelbet PLN</label><input class="form-input" id="np-zelbet" type="number" placeholder="Tylko dennice"></div>
        <div class="form-group"><label class="form-label">Drab. Nierdzewna PLN</label><input class="form-input" id="np-drabNierdzewna" type="number"></div>
      </div>
      <div class="form-row przejscia-only" style="display:none;grid-template-columns:1fr 1fr 1fr 1fr;gap:0.8rem;margin-top:0.8rem;">
        <div class="form-group"><label class="form-label">Zapas dół mm</label><input class="form-input" id="np-zapasDol" type="number" value="300"></div>
        <div class="form-group"><label class="form-label">Zapas góra mm</label><input class="form-input" id="np-zapasGora" type="number" value="300"></div>
        <div class="form-group"><label class="form-label">Zapas dół min mm</label><input class="form-input" id="np-zapasDolMin" type="number" value="150"></div>
        <div class="form-group"><label class="form-label">Zapas góra min mm</label><input class="form-input" id="np-zapasGoraMin" type="number" value="150"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Anuluj</button>
        <button class="btn btn-primary" onclick="addStudnieProduct()">Dodaj element</button>
      </div>
    </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
    window.togglePrzejsciaFields = () => {
        const cat = document.getElementById('np-category').value;
        const isPrzejscia = cat === 'Przejścia';
        const customCatEl = document.getElementById('np-custom-category');
        if (customCatEl) customCatEl.style.display = isPrzejscia ? 'block' : 'none';
        document.querySelectorAll('.non-przejscia').forEach(el => el.style.display = isPrzejscia ? 'none' : '');
        document.querySelectorAll('.przejscia-only').forEach(el => el.style.display = isPrzejscia ? 'grid' : 'none');
    };
    setTimeout(() => window.togglePrzejsciaFields(), 10);
}

function addStudnieProduct() {
    const id = document.getElementById('np-id').value.trim();
    const name = document.getElementById('np-name').value.trim();
    const price = parseFloat(document.getElementById('np-price').value);
    const height = document.getElementById('np-height').value ? parseInt(document.getElementById('np-height').value) : 0;
    const area = document.getElementById('np-area').value ? parseFloat(document.getElementById('np-area').value) : null;
    const areaExt = document.getElementById('np-areaExt').value ? parseFloat(document.getElementById('np-areaExt').value) : null;
    const transport = document.getElementById('np-transport').value ? parseInt(document.getElementById('np-transport').value) : null;
    const weight = document.getElementById('np-weight').value ? parseInt(document.getElementById('np-weight').value) : null;
    let category = document.getElementById('np-category').value;
    const isPrzejscia = category === 'Przejścia';

    if (isPrzejscia) {
        const customCat = document.getElementById('np-custom-category')?.value.trim();
        if (!customCat) { showToast('Wpisz nazwę kategorii przejścia', 'error'); return; }
        category = customCat;
    }
    const zapasDol = document.getElementById('np-zapasDol')?.value ? parseInt(document.getElementById('np-zapasDol').value) : null;
    const zapasGora = document.getElementById('np-zapasGora')?.value ? parseInt(document.getElementById('np-zapasGora').value) : null;
    const zapasDolMin = document.getElementById('np-zapasDolMin')?.value ? parseInt(document.getElementById('np-zapasDolMin').value) : null;
    const zapasGoraMin = document.getElementById('np-zapasGoraMin')?.value ? parseInt(document.getElementById('np-zapasGoraMin').value) : null;
    const pehd = document.getElementById('np-pehd').value ? parseFloat(document.getElementById('np-pehd').value) : null;
    const malW = document.getElementById('np-malW').value ? parseFloat(document.getElementById('np-malW').value) : null;
    const malZ = document.getElementById('np-malZ').value ? parseFloat(document.getElementById('np-malZ').value) : null;
    const zelbet = document.getElementById('np-zelbet').value ? parseFloat(document.getElementById('np-zelbet').value) : null;
    const drabNierdzewna = document.getElementById('np-drabNierdzewna')?.value ? parseFloat(document.getElementById('np-drabNierdzewna').value) : null;

    if (!id || !name || isNaN(price)) { showToast('Wypełnij wymagane pola (indeks, nazwa, cena)', 'error'); return; }
    if (studnieProducts.some(p => p.id === id)) { showToast('Element o takim indeksie już istnieje', 'error'); return; }

    studnieProducts.push({
        id, name, price,
        height: isPrzejscia ? null : height,
        area: isPrzejscia ? null : area,
        areaExt: isPrzejscia ? null : areaExt,
        transport: isPrzejscia ? null : transport,
        weight: weight,
        category,
        dn: null,
        componentType: isPrzejscia ? 'przejscie' : 'krag',
        zapasDol: isPrzejscia ? zapasDol : undefined,
        zapasGora: isPrzejscia ? zapasGora : undefined,
        zapasDolMin: isPrzejscia ? zapasDolMin : undefined,
        zapasGoraMin: isPrzejscia ? zapasGoraMin : undefined,
        doplataPEHD: isPrzejscia ? undefined : pehd,
        malowanieWewnetrzne: isPrzejscia ? undefined : malW,
        malowanieZewnetrzne: isPrzejscia ? undefined : malZ,
        doplataZelbet: isPrzejscia ? undefined : zelbet,
        doplataDrabNierdzewna: isPrzejscia ? undefined : drabNierdzewna
    });
    saveStudnieProducts(studnieProducts);
    closeModal();
    renderStudniePriceList();
    showToast('Dodano nowy element', 'success');
}

function closeModal() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
}

/* ===== RESET / SAVE DEFAULT ===== */
async function resetStudniePriceList() {
    try {
        const res = await fetch('/api/products-studnie/default');
        const json = await res.json();
        const customDefault = json.data;
        if (customDefault) {
            if (!confirm('Przywrócić cennik studni do zapisanego cennika domyślnego?')) return;
            studnieProducts = JSON.parse(JSON.stringify(customDefault));
        } else {
            if (!confirm('Brak własnego cennika. Przywrócić do wartości fabrycznych?')) return;
            studnieProducts = JSON.parse(JSON.stringify(DEFAULT_PRODUCTS_STUDNIE));
        }
    } catch {
        if (!confirm('Przywrócić cennik do wartości fabrycznych?')) return;
        studnieProducts = JSON.parse(JSON.stringify(DEFAULT_PRODUCTS_STUDNIE));
    }
    saveStudnieProducts(studnieProducts);
    renderStudniePriceList();
    renderTiles();
    showToast('Cennik studni przywrócony', 'info');
}

async function saveAsDefaultStudniePriceList() {
    if (!confirm('Ustawić aktualny cennik jako domyślny punkt do resetu?')) return;
    try {
        await fetch('/api/products-studnie/default', { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ data: studnieProducts }) });
        showToast('Zapisano cennik jako domyślny', 'success');
    } catch (err) {
        showToast('Błąd zapisu cennika domyślnego', 'error');
    }
}

function downloadStudniePricelistFile() {
    const fileContent = `/* ===== DEFAULT PRODUCT DATA — STUDNIE ===== */\nconst DEFAULT_PRODUCTS_STUDNIE = ${JSON.stringify(studnieProducts, null, 4)};\n\nconst CATEGORIES_STUDNIE = ${JSON.stringify(CATEGORIES_STUDNIE, null, 4)};\n`;
    const blob = new Blob([fileContent], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pricelist_studnie.js';
    a.click();
    URL.revokeObjectURL(url);
}

/* ===== EXCEL IMPORT / EXPORT ===== */

// Column definitions for export/import - order matters
const EXPORT_COLUMNS = [
    { key: 'id', header: 'Indeks' },
    { key: 'name', header: 'Nazwa' },
    { key: 'category', header: 'Kategoria' },
    { key: 'componentType', header: 'Typ komponentu' },
    { key: 'dn', header: 'DN' },
    { key: 'height', header: 'Wysokość mm' },
    { key: 'weight', header: 'Waga kg' },
    { key: 'area', header: 'Pow. wewn. m²' },
    { key: 'areaExt', header: 'Pow. zewn. m²' },
    { key: 'transport', header: 'Ilość/transport' },
    { key: 'price', header: 'Cena PLN' },
    { key: 'doplataPEHD', header: 'Dopłata PEHD' },
    { key: 'malowanieWewnetrzne', header: 'Malow. wewn.' },
    { key: 'malowanieZewnetrzne', header: 'Malow. zewn.' },
    { key: 'doplataZelbet', header: 'Dopłata Żelbet' },
    { key: 'doplataDrabNierdzewna', header: 'Drab. Nierdzewna' },
    { key: 'magazynWL', header: 'Mag WL' },
    { key: 'magazynKLB', header: 'Mag KLB' },
    { key: 'formaStandardowa', header: 'Forma std.' },
    { key: 'zapasDol', header: 'Zapas dół mm' },
    { key: 'zapasGora', header: 'Zapas góra mm' },
    { key: 'zapasDolMin', header: 'Zapas dół min mm' },
    { key: 'zapasGoraMin', header: 'Zapas góra min mm' },
];

// Build reverse lookup: Polish header -> key
const HEADER_TO_KEY = {};
EXPORT_COLUMNS.forEach(c => { HEADER_TO_KEY[c.header] = c.key; HEADER_TO_KEY[c.key] = c.key; });

function exportStudnieToExcel() {
    if (!studnieProducts || studnieProducts.length === 0) {
        showToast('Brak danych do eksportu', 'error');
        return;
    }

    // Build export rows with ordered columns and Polish headers
    const rows = studnieProducts.map(p => {
        const row = {};
        EXPORT_COLUMNS.forEach(col => {
            row[col.header] = p[col.key] ?? '';
        });
        return row;
    });

    const ws = XLSX.utils.json_to_sheet(rows);

    // Set column widths
    ws['!cols'] = EXPORT_COLUMNS.map(col => ({ wch: Math.max(col.header.length + 2, 12) }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cennik Studni");
    XLSX.writeFile(wb, "Cennik_Studni_Export.xlsx");
    showToast('Wyeksportowano cennik do Excela (' + studnieProducts.length + ' pozycji)', 'success');
}

function importStudnieFromExcel(event) {
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

            // Normalize imported data — map Polish headers to keys & set defaults
            const numericFields = ['height', 'weight', 'area', 'areaExt', 'transport', 'price',
                'doplataPEHD', 'malowanieWewnetrzne', 'malowanieZewnetrzne', 'doplataZelbet',
                'doplataDrabNierdzewna', 'magazynWL', 'magazynKLB', 'formaStandardowa',
                'zapasDol', 'zapasGora', 'zapasDolMin', 'zapasGoraMin', 'dn'];

            const normalized = json.map(raw => {
                const product = {};

                // Map columns - support both Polish headers and raw keys
                Object.keys(raw).forEach(col => {
                    const key = HEADER_TO_KEY[col] || col;
                    product[key] = raw[col];
                });

                // Ensure required string fields
                product.id = String(product.id || '').trim();
                product.name = String(product.name || '').trim();
                product.category = String(product.category || '').trim();
                product.componentType = String(product.componentType || '').trim();

                // Parse numeric fields
                numericFields.forEach(f => {
                    if (product[f] === '' || product[f] === undefined || product[f] === null || product[f] === '—') {
                        product[f] = (f === 'magazynWL' || f === 'magazynKLB' || f === 'formaStandardowa') ? 0 : null;
                    } else {
                        const num = parseFloat(product[f]);
                        product[f] = isNaN(num) ? null : num;
                    }
                });

                // DN can be string for egg-shaped pipes ("600/900")
                if (product.dn !== null && typeof raw[HEADER_TO_KEY['dn'] || 'dn'] === 'string' && raw[HEADER_TO_KEY['dn'] || 'dn'].includes('/')) {
                    product.dn = raw[HEADER_TO_KEY['dn'] || 'dn'];
                }

                // Ensure magazyn fields default to 0
                if (product.magazynWL == null) product.magazynWL = 0;
                if (product.magazynKLB == null) product.magazynKLB = 0;
                if (product.formaStandardowa == null) product.formaStandardowa = 0;

                renamePłyty(product);

                return product;
            }).filter(p => p.id); // Skip rows without ID

            if (normalized.length === 0) {
                showToast('Brak prawidłowych wierszy do importu', 'error');
                return;
            }

            studnieProducts = normalized;
            saveStudnieProducts(studnieProducts);
            renderStudniePriceList();
            renderTiles();
            showToast(`Pomyślnie zaimportowano ${normalized.length} pozycji z Excela`, 'success');
        } catch (err) {
            console.error(err);
            showToast('Błąd podczas importu pliku Excel', 'error');
        }
        event.target.value = ''; // Reset input
    };
    reader.readAsArrayBuffer(file);
}


/* ===== INIT ===== */
document.addEventListener('DOMContentLoaded', async () => {
    // Auth check
    const token = getAuthToken();
    if (!token) { window.location.href = 'index.html'; return; }
    try {
        const authRes = await fetch('/api/auth/me', { headers: authHeaders() });
        const authData = await authRes.json();
        if (!authData.user) { window.location.href = 'index.html'; return; }
        currentUser = authData.user;
    } catch { window.location.href = 'index.html'; return; }

    // Display user info
    const userEl = document.getElementById('header-username');
    const roleEl = document.getElementById('header-role-badge');
    if (userEl) userEl.textContent = currentUser.firstName ? `${currentUser.firstName} ${currentUser.lastName || ''}`.trim() : currentUser.username;
    if (roleEl) {
        roleEl.textContent = currentUser.role;
        roleEl.style.background = currentUser.role === 'admin' ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.15)';
        roleEl.style.color = currentUser.role === 'admin' ? '#f59e0b' : '#60a5fa';
        roleEl.style.border = currentUser.role === 'admin' ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(59,130,246,0.3)';
    }

    // ── Setup navigation FIRST (before async data loading) ──
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => showSection(btn.dataset.section));
    });

    // Setup search
    document.getElementById('studnie-pricelist-search')?.addEventListener('input', renderStudniePriceList);

    // Setup offer defaults
    document.getElementById('offer-date').value = new Date().toISOString().slice(0, 10);

    // Wizard: start at step 1
    wizardConfirmedParams = new Set();
    goToWizardStep(1);

    // ── Load data (wrapped in try-catch so failures don't break navigation) ──
    try {
        // Load products
        studnieProducts = await loadStudnieProducts();

        // Start with no wells — user adds first well themselves
        wells = [];
        wellCounter = 0;
        currentWellIndex = 0;
        offerDefaultZakonczenie = null;
        offerDefaultRedukcja = false;
        offerDefaultRedukcjaMinH = 2500;
        offerDefaultRedukcjaZak = null;

        // Initial render
        refreshAll();

        const urlParams = new URLSearchParams(window.location.search);
        const tab = urlParams.get('tab');
        const orderParam = urlParams.get('order');

        offersStudnie = await loadOffersStudnie();
        ordersStudnie = await loadOrdersStudnie();
        clientsDb = await loadClientsDb();
        renderSavedOffersStudnie();

        // Check if we're opening an order for editing
        if (orderParam) {
            await enterOrderEditMode(orderParam);
        } else if (tab) {
            showSection(tab);
        }

        // Set initial offer number properly based on loaded offers
        if (!orderEditMode) {
            document.getElementById('offer-number').value = generateOfferNumberStudnie();
        }
    } catch (err) {
        console.error('Błąd podczas inicjalizacji danych:', err);
        showToast('Wystąpił błąd podczas ładowania danych. Nawigacja jest dostępna.', 'error');
    }
});

/* ===== OFFERS STUDNIE (SERVER API) ===== */
async function loadOffersStudnie() {
    try {
        const res = await fetch('/api/offers-studnie', { headers: authHeaders() });
        const json = await res.json();
        return json.data || [];
    } catch (err) {
        console.error('Błąd ładowania ofert studni:', err);
        return [];
    }
}

async function saveOffersDataStudnie(data) {
    try {
        await fetch('/api/offers-studnie', { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ data }) });
    } catch (err) {
        console.error('Błąd zapisu ofert studni:', err);
    }
}

/* ===== ORDERS STUDNIE (Zamówienia) ===== */
async function loadOrdersStudnie() {
    try {
        const res = await fetch('/api/orders-studnie', { headers: authHeaders() });
        const json = await res.json();
        return json.data || [];
    } catch (err) {
        console.error('Błąd ładowania zamówień studni:', err);
        return [];
    }
}

async function saveOrdersDataStudnie(data) {
    try {
        await fetch('/api/orders-studnie', { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ data }) });
    } catch (err) {
        console.error('Błąd zapisu zamówień studni:', err);
    }
}

function createOrderFromOffer() {
    // First save the current offer
    const number = document.getElementById('offer-number').value.trim();
    if (!number) { showToast('Najpierw zapisz ofertę', 'error'); return; }
    if (!editingOfferIdStudnie) {
        showToast('Najpierw zapisz ofertę (kliknij 💾 Zapisz)', 'error');
        return;
    }

    const offer = offersStudnie.find(o => o.id === editingOfferIdStudnie);
    if (!offer) { showToast('Nie znaleziono oferty', 'error'); return; }

    // Check if order already exists
    const existingOrder = ordersStudnie.find(o => o.offerId === offer.id);
    if (existingOrder) {
        if (!confirm('Zamówienie dla tej oferty już istnieje. Czy chcesz utworzyć nowe (nadpisze poprzednie)?')) return;
        ordersStudnie = ordersStudnie.filter(o => o.offerId !== offer.id);
    }

    // Create order from offer — deep copy everything, save original snapshot
    const order = {
        id: 'order_studnie_' + Date.now(),
        offerId: offer.id,
        offerNumber: offer.number,
        userId: offer.userId,
        userName: offer.userName,
        number: offer.number,
        date: offer.date,
        clientName: offer.clientName,
        clientNip: offer.clientNip,
        clientAddress: offer.clientAddress,
        clientContact: offer.clientContact,
        investName: offer.investName,
        investAddress: offer.investAddress,
        notes: offer.notes,
        wells: JSON.parse(JSON.stringify(offer.wells)),
        originalSnapshot: JSON.parse(JSON.stringify(offer.wells)), // frozen copy for diff
        transportKm: offer.transportKm,
        transportRate: offer.transportRate,
        totalWeight: offer.totalWeight,
        totalNetto: offer.totalNetto,
        totalBrutto: offer.totalBrutto,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: currentUser ? currentUser.username : ''
    };

    // Mark the offer as having an order
    offer.hasOrder = true;
    offer.orderId = order.id;
    saveOffersDataStudnie(offersStudnie);

    ordersStudnie.push(order);
    saveOrdersDataStudnie(ordersStudnie);
    renderSavedOffersStudnie();

    showToast('📦 Zamówienie utworzone z oferty ' + offer.number, 'success');

    // Open order in the same window (uses main studnie editor in order mode)
    window.location.href = '/studnie?order=' + order.id;
}

function saveOrderStudnie() {
    if (!editingOfferIdStudnie) return;
    const offer = offersStudnie.find(o => o.id === editingOfferIdStudnie);
    if (!offer) return;
    const order = ordersStudnie.find(o => o.offerId === offer.id);
    if (!order) return;

    // Update order wells with current wells state
    order.wells = JSON.parse(JSON.stringify(wells));
    order.updatedAt = new Date().toISOString();

    // Recalculate totals
    let totalNetto = 0, totalWeight = 0;
    wells.forEach(well => {
        const stats = calcWellStats(well);
        totalNetto += stats.price;
        totalWeight += stats.weight;
    });
    order.totalWeight = totalWeight;
    order.totalNetto = totalNetto;
    order.totalBrutto = totalNetto * 1.23;

    saveOrdersDataStudnie(ordersStudnie);
    showToast('📦 Zamówienie zaktualizowane', 'success');
}

function deleteOrderStudnie(orderId) {
    if (!confirm('Czy na pewno usunąć to zamówienie?')) return;
    const order = ordersStudnie.find(o => o.id === orderId);
    if (order) {
        // Remove hasOrder flag from offer
        const offer = offersStudnie.find(o => o.id === order.offerId);
        if (offer) {
            offer.hasOrder = false;
            delete offer.orderId;
            saveOffersDataStudnie(offersStudnie);
        }
    }
    ordersStudnie = ordersStudnie.filter(o => o.id !== orderId);
    saveOrdersDataStudnie(ordersStudnie);
    renderSavedOffersStudnie();
    showToast('Zamówienie usunięte', 'info');
}

/** Compare current order wells vs originalSnapshot, return changes map */
function getOrderChanges(order) {
    if (!order || !order.originalSnapshot) return {};
    const changes = {}; // { wellIndex: { type: 'modified'|'added'|'removed', fields: [...] } }
    const orig = order.originalSnapshot;
    const curr = order.wells;

    const maxLen = Math.max(orig.length, curr.length);
    for (let i = 0; i < maxLen; i++) {
        if (i >= orig.length) {
            changes[i] = { type: 'added' };
            continue;
        }
        if (i >= curr.length) {
            changes[i] = { type: 'removed', name: orig[i].name };
            continue;
        }
        const o = orig[i], c = curr[i];
        const diffs = [];

        // Compare config (components)
        const oConfig = JSON.stringify(o.config || []);
        const cConfig = JSON.stringify(c.config || []);
        if (oConfig !== cConfig) diffs.push('config');

        // Compare przejscia (ignoring angle, angleExecution, angleGony)
        const cleanPrzejscia = (arr) => (arr || []).map(p => ({
            productId: p.productId,
            rzednaWlaczenia: p.rzednaWlaczenia,
            notes: p.notes
        }));
        if (JSON.stringify(cleanPrzejscia(o.przejscia)) !== JSON.stringify(cleanPrzejscia(c.przejscia))) {
            diffs.push('przejscia');
        }

        // Compare params
        const paramKeys = ['nadbudowa', 'dennicaMaterial', 'wkladka', 'klasaBetonu', 'agresjaChemiczna', 'agresjaMrozowa', 'malowanieW', 'malowanieZ', 'kineta', 'redukcjaKinety', 'stopnie', 'spocznikH', 'usytuowanie'];
        paramKeys.forEach(key => {
            if ((o[key] || '') !== (c[key] || '')) diffs.push(key);
        });

        // Compare basic fields & elevations
        if ((o.dn || 0) !== (c.dn || 0)) diffs.push('dn');
        if ((o.name || '') !== (c.name || '')) diffs.push('name');
        if ((o.rzednaWlazu == null ? '' : o.rzednaWlazu) !== (c.rzednaWlazu == null ? '' : c.rzednaWlazu)) diffs.push('rzednaWlazu');
        if ((o.rzednaDna == null ? '' : o.rzednaDna) !== (c.rzednaDna == null ? '' : c.rzednaDna)) diffs.push('rzednaDna');

        if (diffs.length > 0) {
            changes[i] = { type: 'modified', fields: diffs };
        }
    }
    return changes;
}

/** Check if current offer has an active order */
function getCurrentOfferOrder() {
    if (orderEditMode) return orderEditMode.order;
    if (!editingOfferIdStudnie) return null;
    return ordersStudnie.find(o => o.offerId === editingOfferIdStudnie) || null;
}

/** Enter order editing mode — loads order into main editor */
async function enterOrderEditMode(orderId) {
    try {
        const res = await fetch(`/api/orders-studnie/${orderId}`, { headers: authHeaders() });
        if (!res.ok) { showToast('Zamówienie nie znalezione', 'error'); return; }
        const json = await res.json();
        const order = json.data;
        if (!order) { showToast('Zamówienie nie znalezione', 'error'); return; }

        orderEditMode = { orderId: order.id, order: order };

        // Load wells from order
        wells = JSON.parse(JSON.stringify(order.wells));
        migrateWellData(wells);
        wellCounter = wells.length;
        currentWellIndex = 0;

        // Fill client/offer fields
        document.getElementById('offer-number').value = order.number || '';
        document.getElementById('offer-date').value = order.date || new Date().toISOString().slice(0, 10);
        document.getElementById('client-name').value = order.clientName || '';
        document.getElementById('client-nip').value = order.clientNip || '';
        document.getElementById('client-address').value = order.clientAddress || '';
        document.getElementById('client-contact').value = order.clientContact || '';
        document.getElementById('invest-name').value = order.investName || '';
        document.getElementById('invest-address').value = order.investAddress || '';

        // Skip wizard → go to step 3 (config)
        skipWizardToStep3();
        showSection('builder');

        // Update UI
        refreshAll();

        // Show order mode banner
        renderOrderModeBanner();

        // Update page title
        document.title = `📦 Zamówienie: ${order.number || orderId}`;

        showToast('📦 Zamówienie wczytane do edycji', 'success');
    } catch (err) {
        console.error('Błąd ładowania zamówienia:', err);
        showToast('Błąd ładowania zamówienia: ' + err.message, 'error');
    }
}

function renderOrderModeBanner() {
    let banner = document.getElementById('order-mode-banner');
    if (!banner) {
        // Create banner div at the top of the builder section
        const builderSection = document.getElementById('section-builder');
        if (!builderSection) return;
        banner = document.createElement('div');
        banner.id = 'order-mode-banner';
        builderSection.insertBefore(banner, builderSection.firstChild);
    }

    if (!orderEditMode) {
        banner.style.display = 'none';
        return;
    }

    const order = orderEditMode.order;
    // Compute changes vs current wells
    const tempOrder = { ...order, wells: wells };
    const changes = getOrderChanges({ ...order, wells: wells });
    const changeCount = Object.keys(changes).length;
    const hasChanges = changeCount > 0;

    banner.style.cssText = `
        display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.5rem;
        padding:0.6rem 1rem; margin-bottom:0.6rem; border-radius:10px;
        background: ${hasChanges ? 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.06))' : 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.06))'};
        border: 1px solid ${hasChanges ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'};
    `;

    banner.innerHTML = `
        <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
            <span style="font-size:1.2rem;">📦</span>
            <div>
                <div style="font-size:0.78rem; font-weight:800; color:${hasChanges ? '#f87171' : '#34d399'};">
                    TRYB ZAMÓWIENIA — ${order.number || ''}
                </div>
                <div style="font-size:0.62rem; color:var(--text-muted);">
                    ${hasChanges ? `⚠️ ${changeCount} studni zmienionych od oryginału` : '✅ Bez zmian od oryginału'}
                    • Utworzono: ${new Date(order.createdAt).toLocaleString('pl-PL')}
                </div>
            </div>
        </div>
        <div style="display:flex; gap:0.4rem; align-items:center;">
            <button class="btn btn-sm" onclick="saveCurrentOrder()" style="background:rgba(16,185,129,0.2); border:1px solid rgba(16,185,129,0.4); color:#34d399; font-size:0.7rem; font-weight:700; padding:0.3rem 0.7rem;">
                💾 Zapisz zamówienie
            </button>
            <a href="/studnie?tab=saved" class="btn btn-sm btn-secondary" style="font-size:0.65rem; padding:0.25rem 0.5rem;">← Wróć do ofert</a>
        </div>
    `;
}

async function saveCurrentOrder() {
    if (!orderEditMode) { showToast('Brak trybu zamówienia', 'error'); return; }

    const order = orderEditMode.order;

    // Update order with current wells
    order.wells = JSON.parse(JSON.stringify(wells));
    order.updatedAt = new Date().toISOString();

    // Recalculate totals
    let totalNetto = 0, totalWeight = 0;
    wells.forEach(well => {
        const stats = calcWellStats(well);
        totalNetto += stats.price;
        totalWeight += stats.weight;
    });
    order.totalWeight = totalWeight;
    order.totalNetto = totalNetto;
    order.totalBrutto = totalNetto * 1.23;

    // Save via PATCH
    try {
        await fetch(`/api/orders-studnie/${order.id}`, {
            method: 'PATCH',
            headers: authHeaders(),
            body: JSON.stringify({
                wells: order.wells,
                updatedAt: order.updatedAt,
                totalWeight: order.totalWeight,
                totalNetto: order.totalNetto,
                totalBrutto: order.totalBrutto
            })
        });
        showToast('📦 Zamówienie zapisane', 'success');
        renderOrderModeBanner();
    } catch (err) {
        console.error('Błąd zapisu zamówienia:', err);
        showToast('Błąd zapisu zamówienia', 'error');
    }
}

window.createOrderFromOffer = createOrderFromOffer;
window.saveOrderStudnie = saveOrderStudnie;
window.saveCurrentOrder = saveCurrentOrder;
window.deleteOrderStudnie = deleteOrderStudnie;

/* ===== OFFER SUMMARY (Studnie) ===== */
function saveOfferStudnie() {
    if (isOfferLocked()) { showToast(OFFER_LOCKED_MSG, 'error'); return; }
    const number = document.getElementById('offer-number').value.trim();
    if (!number) { showToast('Wprowadź numer oferty', 'error'); return; }

    const date = document.getElementById('offer-date').value;
    const clientName = document.getElementById('client-name').value.trim();
    const clientNip = document.getElementById('client-nip').value.trim();
    const clientAddress = document.getElementById('client-address').value.trim();
    const clientContact = document.getElementById('client-contact').value.trim();
    const investName = document.getElementById('invest-name').value.trim();
    const investAddress = document.getElementById('invest-address').value.trim();
    const notes = document.getElementById('offer-notes').value.trim();
    const transportKm = parseFloat(document.getElementById('transport-km').value) || 0;
    const transportRate = parseFloat(document.getElementById('transport-rate').value) || 0;

    let totalNetto = 0;
    let totalWeight = 0;
    wells.forEach(well => {
        const stats = calcWellStats(well);
        totalNetto += stats.price;
        totalWeight += stats.weight;
    });

    const existingOffer = editingOfferIdStudnie ? offersStudnie.find(o => o.id === editingOfferIdStudnie) : null;
    const offer = {
        id: editingOfferIdStudnie || 'offer_studnie_' + Date.now(),
        userId: existingOffer?.userId || (currentUser ? currentUser.id : null),
        userName: existingOffer?.userName || (currentUser ? currentUser.username : ''),
        number, date, clientName, clientNip, clientAddress, clientContact, investName, investAddress, notes,
        wells: JSON.parse(JSON.stringify(wells)),
        transportKm,
        transportRate,
        totalWeight,
        totalNetto,
        totalBrutto: totalNetto * 1.23,
        createdAt: editingOfferIdStudnie ? (existingOffer?.createdAt || new Date().toISOString()) : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastEditedBy: currentUser ? currentUser.username : ''
    };

    if (editingOfferIdStudnie) {
        const idx = offersStudnie.findIndex(o => o.id === editingOfferIdStudnie);
        if (idx >= 0) offersStudnie[idx] = offer;
        editingOfferIdStudnie = null;
    } else {
        offersStudnie.push(offer);
    }

    saveOffersDataStudnie(offersStudnie);

    showToast('Oferta zapisana ✔', 'success');
    editingOfferIdStudnie = offer.id;
    renderSavedOffersStudnie();
}

function clearOfferForm() {
    editingOfferIdStudnie = null;
    document.getElementById('offer-number').value = generateOfferNumberStudnie();
    document.getElementById('offer-date').value = new Date().toISOString().slice(0, 10);
    document.getElementById('client-name').value = '';
    document.getElementById('client-nip').value = '';
    document.getElementById('client-address').value = '';
    document.getElementById('client-contact').value = '';
    document.getElementById('invest-name').value = '';
    document.getElementById('invest-address').value = '';
    document.getElementById('offer-notes').value = '';
    document.getElementById('transport-km').value = '100';
    document.getElementById('transport-rate').value = '10';
    wells = [];
    wellCounter = 1;
    currentWellIndex = 0;
    offerDefaultZakonczenie = null;
    offerDefaultRedukcja = false;
    offerDefaultRedukcjaMinH = 2500;
    offerDefaultRedukcjaZak = null;
    refreshAll();
    showSection('builder');
    renderOfferSummary();
    // Reset wizard to step 1
    wizardConfirmedParams = new Set();
    goToWizardStep(1);
}

function renderSavedOffersStudnie() {
    const container = document.getElementById('saved-offers-list');
    if (!container) return;

    if (offersStudnie.length === 0) {
        container.innerHTML = `<div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 12h6m-3-3v6m-7 4h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
            <h3>Brak zapisanych ofert</h3><p>Utwórz nową ofertę w zakładce "Oferta"</p></div>`;
        return;
    }

    container.innerHTML = offersStudnie.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).map(o => {
        const hasOrder = o.hasOrder || ordersStudnie.some(ord => ord.offerId === o.id);
        const order = ordersStudnie.find(ord => ord.offerId === o.id);
        const orderBadge = hasOrder
            ? `<div style="display:inline-flex; align-items:center; gap:0.3rem; padding:0.2rem 0.6rem; background:rgba(16,185,129,0.15); border:2px solid rgba(16,185,129,0.4); border-radius:6px; margin-top:0.3rem;">
                <span style="font-size:0.85rem;">📦</span>
                <span style="font-size:0.68rem; font-weight:800; color:#34d399; text-transform:uppercase; letter-spacing:0.5px;">Zamówienie</span>
               </div>`
            : '';
        return `
        <div class="offer-list-item" ${hasOrder ? 'style="border-left:3px solid #34d399;"' : ''}>
            <div class="offer-info" style="min-width:0;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:0.5rem;">
                    <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                        <h3 style="margin-bottom:0.2rem; word-break:break-all;">${o.number}</h3>
                        ${orderBadge}
                    </div>
                    <div style="font-weight:700; color:var(--text-primary); font-size: 0.9rem; white-space:nowrap;">
                        💰 ${fmt(o.totalBrutto)} PLN
                    </div>
                </div>
                <div class="meta" style="margin-top:0.3rem;">
                    <span>📅 <strong>${o.date}</strong></span>
                    <span>🗂️ <strong>${o.wells.length}</strong> studnie</span>
                    ${o.userName ? `<span style="color:var(--accent-hover)">👤 <strong>${o.userName}</strong></span>` : ''}
                </div>
                ${o.clientName || o.investName || o.clientContact ? `
                <div class="offer-client-badges">
                    ${o.clientName ? `<div class="badge-client">🏢 <strong>Klient:</strong> <span style="font-weight:500">${o.clientName}</span></div>` : ''}
                    ${o.investName ? `<div class="badge-invest">🏗️ <strong>Budowa:</strong> <span style="font-weight:500">${o.investName}</span></div>` : ''}
                </div>` : ''}
            </div>
            <div class="offer-actions" style="display:flex; flex-wrap:wrap; gap:0.4rem; justify-content:flex-end; align-content:center;">
                <button class="btn btn-sm btn-primary" onclick="loadSavedOfferStudnie('${o.id}')" title="Wczytaj">Wczytaj</button>
                <button class="btn btn-sm btn-secondary" onclick="exportJSONStudnie('${o.id}')" title="Pobierz plik JSON">💾 JSON</button>
                <button class="btn btn-sm btn-danger" onclick="deleteOfferStudnie('${o.id}')" title="Usuń">🗑️ Usuń</button>
                ${hasOrder && order ? `<button class="btn btn-sm" style="background:rgba(16,185,129,0.15); border:1px solid rgba(16,185,129,0.3); color:#34d399; font-size:0.62rem;" onclick="window.location.href='/studnie?order=${order.id}'" title="Otwórz zamówienie">📦 Otwórz</button>
                <button class="btn btn-sm" style="background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.3); color:#f87171; font-size:0.6rem;" onclick="deleteOrderStudnie('${order.id}')" title="Usuń zamówienie">🗑️ Zamówienie</button>` : ''}
            </div>
        </div>
        `}).join('');
}

/** Migrate old well data (material -> nadbudowa/dennicaMaterial) */
function migrateWellData(wellsArr) {
    if (!wellsArr) return wellsArr;
    wellsArr.forEach(w => {
        // Migrate old 'material' field to new 'nadbudowa' + 'dennicaMaterial'
        if (w.material && !w.nadbudowa) {
            w.nadbudowa = w.material;
        }
        if (w.material && !w.dennicaMaterial) {
            w.dennicaMaterial = w.material;
        }
        // Ensure defaults
        if (!w.nadbudowa) w.nadbudowa = 'betonowa';
        if (!w.dennicaMaterial) w.dennicaMaterial = 'betonowa';
    });
    return wellsArr;
}

function loadSavedOfferStudnie(id) {
    const offer = offersStudnie.find(o => o.id === id);
    if (!offer) return;
    orderEditMode = null; // exit order mode if active
    editingOfferIdStudnie = id;
    document.getElementById('offer-number').value = offer.number || '';
    document.getElementById('offer-date').value = offer.date || new Date().toISOString().slice(0, 10);
    document.getElementById('client-name').value = offer.clientName || '';
    document.getElementById('client-nip').value = offer.clientNip || '';
    document.getElementById('client-address').value = offer.clientAddress || '';
    document.getElementById('client-contact').value = offer.clientContact || '';
    document.getElementById('invest-name').value = offer.investName || '';
    document.getElementById('invest-address').value = offer.investAddress || '';
    document.getElementById('offer-notes').value = offer.notes || '';
    document.getElementById('transport-km').value = offer.transportKm || 100;
    document.getElementById('transport-rate').value = offer.transportRate || 10;

    wells = JSON.parse(JSON.stringify(offer.wells));
    migrateWellData(wells);
    currentWellIndex = 0;

    // Restore offer-level defaults from loaded wells
    if (wells.length > 0) {
        const lastWell = wells[wells.length - 1];
        offerDefaultZakonczenie = lastWell.zakonczenie || null;
        offerDefaultRedukcja = lastWell.redukcjaDN1000 || false;
        offerDefaultRedukcjaMinH = lastWell.redukcjaMinH || 2500;
        offerDefaultRedukcjaZak = lastWell.redukcjaZakonczenie || null;
    } else {
        offerDefaultZakonczenie = null;
        offerDefaultRedukcja = false;
        offerDefaultRedukcjaMinH = 2500;
        offerDefaultRedukcjaZak = null;
    }

    refreshAll();
    // Skip wizard for loaded offers — go directly to offer view
    skipWizardToStep3();
    showSection('offer');
    showToast('Wczytano ofertę: ' + offer.number, 'info');

    // Show lock banner if offer has order
    renderOfferLockBanner();
}

function deleteOfferStudnie(id) {
    if (!confirm('Czy na pewno usunąć tę ofertę?')) return;
    offersStudnie = offersStudnie.filter(o => o.id !== id);
    saveOffersDataStudnie(offersStudnie);
    renderSavedOffersStudnie();
    showToast('Oferta usunięta', 'info');
}

function exportJSONStudnie(id) {
    const offer = offersStudnie.find(o => o.id === id);
    if (!offer) return;
    const jsonStr = JSON.stringify(offer, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `STUDNIE_OFERTA_${offer.number.replace(/[^A-Za-z0-9]/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importOfferFromFileStudnie() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = event => {
            try {
                const imported = JSON.parse(event.target.result);
                if (imported && imported.wells) {
                    imported.id = 'offer_studnie_' + Date.now();
                    migrateWellData(imported.wells);
                    offersStudnie.push(imported);
                    saveOffersDataStudnie(offersStudnie);
                    renderSavedOffersStudnie();
                    showToast('Oferta zaimportowana', 'success');
                } else {
                    showToast('Nieprawidłowy plik studni', 'error');
                }
            } catch (err) {
                showToast('Błąd parsowania', 'error');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

/* ===== CLIENT DATABASE ===== */
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

    const searchInput = document.getElementById('clients-search-input');
    renderClientsDbList(searchInput ? searchInput.value : '');
    showToast('Klient usunięty z bazy', 'info');
}



document.addEventListener('DOMContentLoaded', () => { setTimeout(() => { setupParamTiles(); updateParamTilesUI(); }, 500); });
