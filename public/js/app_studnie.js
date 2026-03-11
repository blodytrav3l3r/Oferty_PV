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
const WIZARD_REQUIRED_PARAMS = ['nadbudowa', 'dennicaMaterial', 'wkladka', 'klasaBetonu', 'agresjaChemiczna', 'agresjaMrozowa', 'malowanieW', 'malowanieZ', 'kineta', 'redukcjaKinety', 'stopnie', 'spocznikH', 'usytuowanie', 'magazyn'];

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

    const layout = document.querySelector('.well-app-layout');
    if (layout) {
        if (step === 1 || step === 2) {
            layout.classList.add('intro-mode');
        } else {
            layout.classList.remove('intro-mode');
        }
    }
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
    let malCenaWValid = true;
    if (malowanieWVal !== 'brak') {
        const pwW = document.getElementById('powloka-name-w');
        powlokaWValid = !!(pwW && pwW.value.trim() !== '');
        const mcW = document.getElementById('malowanie-wew-cena');
        malCenaWValid = !!(mcW && mcW.value.trim() !== '' && !isNaN(parseFloat(mcW.value)));
    }

    let powlokaZValid = true;
    let malCenaZValid = true;
    if (malowanieZVal !== 'brak') {
        const pwZ = document.getElementById('powloka-name-z');
        powlokaZValid = !!(pwZ && pwZ.value.trim() !== '');
        const mcZ = document.getElementById('malowanie-zew-cena');
        malCenaZValid = !!(mcZ && mcZ.value.trim() !== '' && !isNaN(parseFloat(mcZ.value)));
    }

    // Show/hide powłoka name fields based on current tile selection
    const powlokaWGroup = document.getElementById('powloka-name-w-group');
    if (powlokaWGroup) powlokaWGroup.style.display = malowanieWVal !== 'brak' ? 'block' : 'none';
    const malCenaWGroup = document.getElementById('malowanie-wew-cena-group');
    if (malCenaWGroup) malCenaWGroup.style.display = malowanieWVal !== 'brak' ? 'block' : 'none';

    const powlokaZGroup = document.getElementById('powloka-name-z-group');
    if (powlokaZGroup) powlokaZGroup.style.display = malowanieZVal !== 'brak' ? 'block' : 'none';
    const malCenaZGroup = document.getElementById('malowanie-zew-cena-group');
    if (malCenaZGroup) malCenaZGroup.style.display = malowanieZVal !== 'brak' ? 'block' : 'none';

    // Clear hidden fields
    if (malowanieWVal === 'brak') {
        const pwWInput = document.getElementById('powloka-name-w');
        if (pwWInput) pwWInput.value = '';
        const mcWInput = document.getElementById('malowanie-wew-cena');
        if (mcWInput) mcWInput.value = '';
    }
    if (malowanieZVal === 'brak') {
        const pwZInput = document.getElementById('powloka-name-z');
        if (pwZInput) pwZInput.value = '';
        const mcZInput = document.getElementById('malowanie-zew-cena');
        if (mcZInput) mcZInput.value = '';
    }

    const isFullyValid = allConfirmed && powlokaWValid && powlokaZValid && malCenaWValid && malCenaZValid;

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
    function migrateProducts(arr) {
        arr.forEach(p => {
            if (p.formaStandardowa == null) p.formaStandardowa = 1;
            if (p.formaStandardowaKLB == null) p.formaStandardowaKLB = 1;
            renamePłyty(p);
        });
        return arr;
    }
    try {
        const res = await fetch('/api/products-studnie');
        const json = await res.json();
        let saved = json.data;
        if (!saved || saved.length === 0) {
            const data = JSON.parse(JSON.stringify(DEFAULT_PRODUCTS_STUDNIE));
            migrateProducts(data);
            await fetch('/api/products-studnie', { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ data }) });
            return data;
        }
        return migrateProducts(saved);
    } catch {
        const data = JSON.parse(JSON.stringify(DEFAULT_PRODUCTS_STUDNIE));
        return migrateProducts(data);
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
        usytuowanie: 'w_osi',
        uszczelka: 'brak',
        magazyn: 'Kluczbork'
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
    const mccW = document.getElementById('malowanie-wew-cena');
    if (mccW) params.malowanieWewCena = parseFloat(mccW.value) || 0;
    const mccZ = document.getElementById('malowanie-zew-cena');
    if (mccZ) params.malowanieZewCena = parseFloat(mccZ.value) || 0;
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
        doplata: 0,
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
        malowanieWewCena: gp.malowanieWewCena,
        malowanieZewCena: gp.malowanieZewCena,
        kineta: gp.kineta,
        redukcjaKinety: gp.redukcjaKinety,
        stopnie: gp.stopnie,
        spocznikH: gp.spocznikH,
        usytuowanie: gp.usytuowanie,
        uszczelka: gp.uszczelka,
        magazyn: gp.magazyn
    };
}

/* ===== OFFER LOCK (after order is created) ===== */
const OFFER_LOCKED_MSG = '🔒 Oferta zablokowana — posiada zamówienie. Edytuj zamówienie zamiast oferty.';
const WELL_LOCKED_MSG = '🔒 Studnia zablokowana — posiada zaakceptowane zlecenie produkcyjne.';
function isOfferLocked() {
    if (orderEditMode) return false; // Order editing mode is always allowed
    if (!editingOfferIdStudnie) return false;
    const offer = offersStudnie.find(o => o.id === editingOfferIdStudnie);
    if (!offer) return false;
    return !!(offer.hasOrder || ordersStudnie.some(ord => ord.offerId === offer.id));
}

function isWellLocked(wellIdx) {
    const idx = wellIdx !== undefined ? wellIdx : currentWellIndex;
    const well = wells[idx];
    if (!well) return false;
    return productionOrders.some(po => po.wellId === well.id && po.status === 'accepted');
}

function renderOfferLockBanner() {
    // Remove order-mode banner if present (we're not in order mode)
    const orderBanner = document.getElementById('order-mode-banner');
    if (orderBanner) orderBanner.style.display = 'none';

    let lockBanner = document.getElementById('offer-lock-banner');
    if (!lockBanner) {
        const centerCol = document.querySelector('.well-center-column');
        if (!centerCol) return;
        lockBanner = document.createElement('div');
        lockBanner.id = 'offer-lock-banner';
        centerCol.insertBefore(lockBanner, centerCol.firstChild);
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
    if (isWellLocked(index)) { showToast(WELL_LOCKED_MSG, 'error'); return; }
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

function syncGaskets(well) {
    if (!well || !well.config) return;

    // Filter out existing uszczelki
    const newConfig = well.config.filter(item => {
        const p = studnieProducts.find(pr => pr.id === item.productId);
        return !(p && p.componentType === 'uszczelka');
    });

    if (well.uszczelka && well.uszczelka !== 'brak') {
        const uType = well.uszczelka;
        const requiredGaskets = {};

        // Find the bottom-most dennica index
        let bottomDennicaIndex = -1;
        for (let i = newConfig.length - 1; i >= 0; i--) {
            const p = studnieProducts.find(pr => pr.id === newConfig[i].productId);
            if (p && p.componentType === 'dennica') {
                bottomDennicaIndex = i;
                break;
            }
        }

        // Find elements requiring a gasket
        newConfig.forEach((item, index) => {
            const p = studnieProducts.find(pr => pr.id === item.productId);
            if (p && ['krag', 'krag_ot', 'plyta_din', 'plyta_redukcyjna', 'konus'].includes(p.componentType)) {
                if (p.dn) {
                    requiredGaskets[p.dn] = (requiredGaskets[p.dn] || 0) + item.quantity;
                }
            } else if (p && p.componentType === 'dennica') {
                if (p.dn) {
                    if (index === bottomDennicaIndex) {
                        // The structural bottom dennica only needs a gasket if quantity > 1
                        if (item.quantity > 1) {
                            requiredGaskets[p.dn] = (requiredGaskets[p.dn] || 0) + (item.quantity - 1);
                        }
                    } else {
                        // All other non-bottom dennice need gaskets for themselves
                        requiredGaskets[p.dn] = (requiredGaskets[p.dn] || 0) + item.quantity;
                    }
                }
            }
        });

        // Add corresponding gaskets
        for (const dn in requiredGaskets) {
            const qty = requiredGaskets[dn];
            let gasketName = `Uszczelka GSG DN${dn}`;
            if (uType === 'GSG') gasketName = `Uszczelka GSG DN${dn}`;
            else if (uType === 'SDV') gasketName = `Uszczelka SDV DN${dn}`;
            else if (uType === 'SDV PO') gasketName = `Uszczelka SDV DN${dn} SDV z pierścieniem odciążającym`;
            else if (uType === 'NBR') gasketName = `Uszczelka GSG DN${dn} z NBR`;

            const gasketProd = studnieProducts.find(p => p.componentType === 'uszczelka' && p.name === gasketName);
            if (gasketProd) {
                newConfig.push({
                    productId: gasketProd.id,
                    quantity: qty,
                    autoAdded: true
                });
            }
        }
    }

    well.config = newConfig;
}

function syncKineta(well) {
    if (!well || !well.config) return;

    // Filter out existing kineta
    const newConfig = well.config.filter(item => {
        const p = studnieProducts.find(pr => pr.id === item.productId);
        return !(p && p.componentType === 'kineta');
    });

    const hasDennica = well.config.some(item => {
        const p = studnieProducts.find(pr => pr.id === item.productId);
        return p && p.componentType === 'dennica';
    });

    if (hasDennica && well.spocznikH && well.spocznikH !== 'brak') {
        const kinetaProd = studnieProducts.find(p => p.componentType === 'kineta' && parseInt(p.dn) === parseInt(well.dn) && p.spocznikH === well.spocznikH);
        if (kinetaProd) {
            newConfig.push({
                productId: kinetaProd.id,
                quantity: 1,
                autoAdded: true
            });
        }
    }

    well.config = newConfig;
}

function refreshAll() {
    const well = getCurrentWell();
    if (well) {
        syncGaskets(well);
        syncKineta(well);
    }

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
            btn.addEventListener('click', async () => {
                const val = btn.getAttribute('data-val');
                const well = getCurrentWell();

                // Always toggle visual active state (for wizard step 2 without wells)
                group.querySelectorAll('.param-tile').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // If a well exists, apply param + re-render
                if (well) {
                    well[paramName] = val;
                    updateParamTilesUI();
                    well.autoLocked = false;
                    updateAutoLockUI();
                    await autoSelectComponents(false);
                    refreshAll();
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
    { key: 'spocznikH', label: 'Spocznik wys.', options: [['1/2', '1/2'], ['2/3', '2/3'], ['3/4', '3/4'], ['1/1', '1/1'], ['brak', 'Brak']] },
    { key: 'usytuowanie', label: 'Usytuowanie', options: [['linia_dolna', 'Linia dolna'], ['linia_gorna', 'Linia górna'], ['w_osi', 'W osi'], ['patrz_uwagi', 'Patrz uwagi']] },
    { key: 'uszczelka', label: 'Uszczelka', options: [['brak', 'Brak'], ['GSG', 'GSG'], ['SDV', 'SDV'], ['SDV PO', 'SDV PO'], ['NBR', 'NBR']] },
    { key: 'magazyn', label: 'Magazyn', options: [['Kluczbork', 'Kluczbork'], ['Włocławek', 'Włocławek']] }
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

    if (well.malowanieW && well.malowanieW !== 'brak') {
        html += `<div style="display:flex; align-items:center; gap:0.4rem; min-height:28px; margin-top:0.2rem;">`;
        html += `<span style="font-size:0.62rem; color:var(--text-muted); font-weight:700; white-space:nowrap; min-width:85px; text-align:right;">Nazwa p. wew.</span>`;
        html += `<input type="text" value="${well.powlokaNameW || ''}" onchange="updateWellParam('powlokaNameW', this.value)" placeholder="Nazwa powłoki..." style="flex:1; max-width:200px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:var(--text-primary); padding:0.2rem 0.5rem; font-size:0.65rem; border-radius:4px;">`;
        html += `</div>`;
        html += `<div style="display:flex; align-items:center; gap:0.4rem; min-height:28px; margin-top:0.2rem;">`;
        html += `<span style="font-size:0.62rem; color:var(--text-muted); font-weight:700; white-space:nowrap; min-width:85px; text-align:right;">Koszt p. wew.</span>`;
        html += `<input type="number" step="0.01" value="${well.malowanieWewCena || ''}" onchange="updateWellParam('malowanieWewCena', parseFloat(this.value)||0)" placeholder="PLN / m²" style="width:80px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:var(--text-primary); padding:0.2rem 0.5rem; font-size:0.65rem; border-radius:4px;">`;
        html += `</div>`;
    }

    if (well.malowanieZ && well.malowanieZ !== 'brak') {
        html += `<div style="display:flex; align-items:center; gap:0.4rem; min-height:28px; margin-top:0.2rem;">`;
        html += `<span style="font-size:0.62rem; color:var(--text-muted); font-weight:700; white-space:nowrap; min-width:85px; text-align:right;">Nazwa p. zew.</span>`;
        html += `<input type="text" value="${well.powlokaNameZ || ''}" onchange="updateWellParam('powlokaNameZ', this.value)" placeholder="Nazwa powłoki..." style="flex:1; max-width:200px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:var(--text-primary); padding:0.2rem 0.5rem; font-size:0.65rem; border-radius:4px;">`;
        html += `</div>`;
        html += `<div style="display:flex; align-items:center; gap:0.4rem; min-height:28px; margin-top:0.2rem;">`;
        html += `<span style="font-size:0.62rem; color:var(--text-muted); font-weight:700; white-space:nowrap; min-width:85px; text-align:right;">Koszt p. zew.</span>`;
        html += `<input type="number" step="0.01" value="${well.malowanieZewCena || ''}" onchange="updateWellParam('malowanieZewCena', parseFloat(this.value)||0)" placeholder="PLN / m²" style="width:80px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:var(--text-primary); padding:0.2rem 0.5rem; font-size:0.65rem; border-radius:4px;">`;
        html += `</div>`;
    }

    html += `</div>`;
    html += `<div style="display:flex; gap:0.4rem; margin-top:0.5rem; justify-content:flex-end;">`;
    html += `<button class="btn btn-secondary btn-sm" onclick="resetWellParamsToDefaults()" style="font-size:0.65rem; padding:0.2rem 0.5rem;">🔄 Reset do domyślnych (Krok 2)</button>`;
    html += `</div>`;

    container.innerHTML = html;
}

async function updateWellParam(paramKey, value) {
    if (isOfferLocked()) { showToast(OFFER_LOCKED_MSG, 'error'); return; }
    if (isWellLocked()) { showToast(WELL_LOCKED_MSG, 'error'); return; }
    const well = getCurrentWell();
    if (!well) return;
    well[paramKey] = value;
    renderWellParams();
    updateParamTilesUI();
    well.autoLocked = false;
    updateAutoLockUI();
    await autoSelectComponents(false);
    refreshAll();
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

async function updateParamInput(paramName, value) {
    const well = getCurrentWell();
    if (!well) return;
    well[paramName] = value;
    well.autoLocked = false;
    updateAutoLockUI();
    await autoSelectComponents(false);
    refreshAll();
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

async function selectZakonczenie(productId) {
    const well = getCurrentWell();
    if (!well) return;

    // Zmiana Zakończenia MA WYMUSIĆ ponowne przeliczenie elementów
    well.autoLocked = false;
    updateAutoLockUI();
    well.configSource = 'AUTO';

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

    // Flusz konfiguracji, żeby po zmianie Zakończenia 
    // solver na pewno zbudował stos od całkowitego zera
    well.config = [];

    // Re-run auto-select if not locked
    if (!well.autoLocked) {
        await autoSelectComponents(true);
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
async function toggleRedukcja() {
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

        // Zmiana zdania ("niecę jednak Redukcji") powoduje twardy skasunek wszystkiego i autodobór
        well.autoLocked = false;
        updateAutoLockUI();
        well.configSource = 'AUTO';

        // Reset ewentualnego nadpisanego błędem "Zakoczenia" dla rury DN1000 i samej redukcji
        well.zakonczenie = null;
        offerDefaultZakonczenie = null;
        well.redukcjaZakonczenie = null;
        offerDefaultRedukcjaZak = null;
        updateZakonczenieButton();

        const btnZak = document.getElementById('btn-redukcja-zak');
        if (btnZak) {
            btnZak.innerHTML = '🔽 Zak. DN1000';
            btnZak.style.borderColor = 'var(--border-glass)';
            btnZak.style.color = '';
        }
    }

    // Całkowite wyczyszczenie koszyka ze starych elementów 
    // z innej średnicy (np. starego Konusa DN1000 po powrocie do DN1500)
    well.config = [];

    // Re-run autoselect if not locked
    if (!well.autoLocked) {
        await autoSelectComponents(true);
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

async function selectRedukcjaZakonczenie(productId) {
    const well = getCurrentWell();
    if (!well) return;

    // Zmiana Zakończenia MA WYMUSIĆ ponowne przeliczenie elementów
    well.autoLocked = false;
    updateAutoLockUI();
    well.configSource = 'AUTO';

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

    // Flusz konfiguracji, żeby po zmianie Zakończenia Redukcji
    // solver na pewno zbudował stos od całkowitego zera
    well.config = [];

    if (!well.autoLocked && well.redukcjaDN1000) {
        await autoSelectComponents(true);
    }
    refreshAll();
}

/* ===== ELEVATIONS (RZĘDNE) ===== */
function updateElevations() {
    if (isOfferLocked()) { showToast(OFFER_LOCKED_MSG, 'error'); return; }
    if (isWellLocked()) { showToast(WELL_LOCKED_MSG, 'error'); return; }
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

function updateDoplata() {
    if (isOfferLocked()) { showToast(OFFER_LOCKED_MSG, 'error'); return; }
    const well = getCurrentWell();
    if (!well) { showToast('Najpierw dodaj studnię', 'error'); return; }
    const domEl = document.getElementById('input-doplata');
    well.doplata = domEl.value !== '' ? parseFloat(domEl.value) : 0;

    renderWellsList();
    updateSummary();
    renderOfferSummary();
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
    const doplataInput = document.getElementById('input-doplata');
    if (!well) {
        if (wlazInput) wlazInput.value = '';
        if (dnaInput) dnaInput.value = '';
        if (doplataInput) doplataInput.value = '';
        if (numerInput) {
            numerInput.value = '';
            checkWellNumerDuplicate('', numerInput);
        }
        updateHeightIndicator();
        return;
    }
    if (wlazInput) wlazInput.value = well.rzednaWlazu != null ? well.rzednaWlazu : '';
    if (dnaInput) dnaInput.value = well.rzednaDna != null ? well.rzednaDna : '';
    if (doplataInput) doplataInput.value = well.doplata != null ? well.doplata : 0;
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
    const errContainer = document.getElementById('well-config-errors-container');

    if (!reqEl || !confEl || !diffEl) return;
    if (!well) {
        confEl.textContent = '0 m';
        reqEl.textContent = '— m';
        diffEl.innerHTML = '';
        if (errContainer) errContainer.style.display = 'none';
        return;
    }

    if (errContainer) {
        if (well.configErrors && well.configErrors.length > 0) {
            errContainer.innerHTML = '⚠️ Błędy w konfiguracji studni:<br>' + well.configErrors.map(e => `• ${e}`).join('<br>');
            errContainer.style.display = 'block';
        } else {
            errContainer.style.display = 'none';
        }
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

/* ===== WAREHOUSE & VARIANT HELPERS ===== */

/**
 * Filtruje produkty wg magazynu studni i priorytetyzuje formy standardowe.
 * well.magazyn = 'Kluczbork' → magazynKLB === 1
 * well.magazyn = 'Włocławek' → magazynWL === 1
 */
function getAvailableProducts(well) {
    const mag = well.magazyn || 'Kluczbork';
    const magField = mag === 'Włocławek' ? 'magazynWL' : 'magazynKLB';
    const formaField = mag === 'Włocławek' ? 'formaStandardowa' : 'formaStandardowaKLB';
    return studnieProducts.filter(p => p[magField] === 1)
        .sort((a, b) => (b[formaField] || 0) - (a[formaField] || 0));
}

/**
 * Z listy kręgów (tego samego DN) wybiera najlepszy wariant per wysokość
 * wg parametrów studni (nadbudowa, stopnie).
 * Zwraca listę z max 1 produktem per unikalna wysokość.
 */
function selectRingVariants(kregiList, well) {
    const isZelbet = well.nadbudowa === 'zelbetowa';
    const stopnie = well.stopnie || 'drabinka';
    let suffix;
    if (stopnie === 'nierdzewna') suffix = '-N';
    else if (stopnie === 'brak') suffix = '-B';
    else suffix = '-D'; // drabinka

    // Group by height
    const byHeight = {};
    kregiList.forEach(k => {
        const h = k.height;
        if (!byHeight[h]) byHeight[h] = [];
        byHeight[h].push(k);
    });

    const result = [];
    Object.keys(byHeight).sort((a, b) => Number(b) - Number(a)).forEach(h => {
        const candidates = byHeight[h];
        // Score each candidate
        let best = null, bestScore = -Infinity;
        for (const c of candidates) {
            let score = 0;
            const id = (c.id || '').toUpperCase();
            // Material match
            if (isZelbet && id.startsWith('KDZ')) score += 10;
            else if (!isZelbet && id.startsWith('KDB')) score += 10;
            // Suffix match
            if (id.includes(suffix)) score += 5;
            // Forma standardowa
            const mag = well.magazyn || 'Kluczbork';
            const ff = mag === 'Włocławek' ? 'formaStandardowa' : 'formaStandardowaKLB';
            if (c[ff] === 1) score += 3000;
            if (score > bestScore) { bestScore = score; best = c; }
        }
        if (best) result.push(best);
    });
    return result.sort((a, b) => b.height - a.height);
}

/**
 * Po zbudowaniu segmentów, sprawdza czy przejście (otwór) jest WEWNĄTRZ kręgu
 * i zamienia zwykły krag na krag_ot (wiercony) w odpowiednim segmencie.
 * 
 * ZASADY:
 * 1. Otwór OT tylko gdy przejście faktycznie jest WEWNĄTRZ tego kręgu (cały otwór mieści się w segmencie)
 * 2. Zamiana na OT musi zachować tę samą wysokość kręgu (nie zmienia totalnej wysokości)
 * 3. Jeśli otwór wychodzi na łączenie dennicy i kręgu → zwraca flagę needsTallerDennica
 *
 * Zwraca { items: kregItems[], needsTallerDennica: boolean }
 */
function applyDrilledRings(kregItems, segments, well, availProducts) {
    const result = { items: kregItems, needsTallerDennica: false };
    if (!well.przejscia || well.przejscia.length === 0) return result;
    const rzDna = well.rzednaDna != null ? well.rzednaDna : 0;
    const newItems = JSON.parse(JSON.stringify(kregItems));
    const usedSegIndices = new Set();

    for (const pr of well.przejscia) {
        let pel = parseFloat(pr.rzednaWlaczenia);
        if (isNaN(pel)) continue;
        const mmFromBottom = (pel - rzDna) * 1000;
        const pprod = studnieProducts.find(x => x.id === pr.productId);
        if (!pprod) continue;
        let prDN = typeof pprod.dn === 'string' && pprod.dn.includes('/')
            ? parseFloat(pprod.dn.split('/')[1]) || 160
            : parseFloat(pprod.dn) || 160;

        const zGora = parseFloat(pprod.zapasGora) || 50;
        const zDol = parseFloat(pprod.zapasDol) || 50;
        const holeBottom = mmFromBottom;
        const holeTop = mmFromBottom + prDN;

        // Check if hole spans dennica-ring junction
        const dennicaSeg = segments.find(s => s.type === 'dennica');
        if (dennicaSeg && holeBottom < dennicaSeg.end && holeTop > dennicaSeg.end) {
            // Hole crosses dennica top edge → need taller dennica
            result.needsTallerDennica = true;
        }

        // Check if hole is fully inside dennica — no OT needed
        if (dennicaSeg && holeTop <= dennicaSeg.end) continue;

        // Find which krag segment contains the ENTIRE hole (with clearances)
        let foundSeg = false;
        for (let si = 1; si < segments.length; si++) {
            const seg = segments[si];
            if (seg.type !== 'krag' && seg.type !== 'krag_ot') continue;
            // Check if entire hole fits inside this segment
            if (holeBottom >= seg.start && holeTop <= seg.end && !usedSegIndices.has(si)) {
                usedSegIndices.add(si);
                foundSeg = true;

                // Find corresponding kregItem — map segment index to item+unit
                let segCount = 0;
                for (let ki = 0; ki < newItems.length; ki++) {
                    const kp = studnieProducts.find(p => p.id === newItems[ki].productId);
                    if (!kp || (kp.componentType !== 'krag' && kp.componentType !== 'krag_ot')) continue;
                    for (let q = 0; q < newItems[ki].quantity; q++) {
                        segCount++;
                        if (segCount === si) {
                            // Stosuj wiercony krąg TYLKO i wyłącznie o tej samej wielkości,
                            // aby nie niszczyć matematyki wysokości solvera (np. 50cm = 50cm, 75cm = 75cm)
                            const otProd = availProducts.find(p => p.componentType === 'krag_ot' && p.dn === kp.dn && p.height === kp.height);

                            if (otProd) {
                                if (newItems[ki].quantity === 1) {
                                    newItems[ki].productId = otProd.id;
                                } else {
                                    newItems[ki].quantity--;
                                    newItems.splice(ki + 1, 0, { productId: otProd.id, quantity: 1 });
                                }
                            }
                            break;
                        }
                    }
                    if (segCount >= si) break;
                }
                break;
            }
        }
    }
    result.items = newItems;
    return result;
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
/* ===== ZAPYTANIE DO NOWEGO BACKENDU (OFFLINE-FIRST) ===== */
async function fetchConfigFromBackend(well, requiredMm, availProducts) {
    try {
        const payload = {
            dn: well.dn,
            target_height_mm: requiredMm,
            use_reduction: well.redukcjaDN1000 || false,
            warehouse: well.magazyn === 'Włocławek' ? 'WL' : 'KLB',
            transitions: (well.przejscia || []).map((p, idx) => ({
                id: `T${idx + 1}`,
                height_from_bottom_mm: Math.round((parseFloat(p.rzednaWlaczenia) - (well.rzednaDna || 0)) * 1000)
            })),
            forced_top_closure_id: well.redukcjaDN1000 ? (well.redukcjaZakonczenie || null) : (well.zakonczenie || null),
            available_products: availProducts.map(p => ({
                id: p.id || '',
                name: p.name || '',
                componentType: p.componentType || '',
                dn: (typeof p.dn === 'string' && p.dn.includes('/')) ? (parseFloat(p.dn.split('/')[0]) || p.dn) : (parseFloat(p.dn) || null),
                height: parseFloat(p.height) || 0,
                formaStandardowaKLB: parseInt(p.formaStandardowaKLB) || 0,
                formaStandardowaWL: parseInt(p.formaStandardowa) || parseInt(p.formaStandardowaWL) || 0,
                zapasDol: parseFloat(p.zapasDol) || 0,
                zapasGora: parseFloat(p.zapasGora) || 0,
                zapasDolMin: parseFloat(p.zapasDolMin) || 0,
                zapasGoraMin: parseFloat(p.zapasGoraMin) || 0
            }))
        };
        const apiUrl = `http://${window.location.hostname}:8000/api/v1/configure`;
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) return null;
        const data = await response.json();
        return data.length > 0 ? data[0] : null;
    } catch {
        return null; // Fallback do lokalnego kodu gdy serwer nie działa
    }
}

async function autoSelectComponents(autoTriggered = false) {
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

    // --- Filter products by warehouse availability ---
    const availProducts = getAvailableProducts(well);

    // --- INTEGRACJA Z NOWYM BACKENDEM ---
    console.log("Próba integracji z backendem OR-Tools...");
    const backendResult = await fetchConfigFromBackend(well, requiredMm, availProducts);
    if (backendResult && backendResult.is_valid && backendResult.items.length > 0) {
        console.log("Otrzymano pomyślny model z API:", backendResult);
        // Zastąp format backendowego na UI config format ('productId' jako główny klucz)
        // Backend grupuje każdą płytę osobno: { product_id, quantity ... }
        // Więc można albo skondensować duplikaty, albo po prostu wpisać 1 sztukowa połączone kręgi (tak samo zadziała)
        const newConfig = [];
        for (const bItem of backendResult.items) {
            const qty = bItem.quantity || 1;
            for (let i = 0; i < qty; i++) {
                newConfig.push({ productId: bItem.product_id, quantity: 1 });
            }
        }
        well.config = newConfig;

        if (backendResult.errors && backendResult.errors.length > 0) {
            backendResult.errors.forEach(e => showToast(e, 'error'));
        } else if (!autoTriggered) {
            showToast('Zoptymalizowano matematycznie (serwer OR-Tools) pomyślnie!', 'success');
        }

        well.configSource = 'AUTO_AI';

        if (backendResult.has_minimal_clearance) {
            showToast('Zastosowano minimalne zapasy przejść rur.', 'warning');
        }

        renderWellConfig();
        sortWellConfigByOrder();
        renderWellDiagram();
        updateSummary();
        return;
    }

    // Jeżeli API odpowiedziało, ale uznało że budowa z żądanymi restrykcjami (np max +20mm) jest NIEMOŻLIWA:
    if (backendResult && !backendResult.is_valid) {
        console.warn("Backend OR-Tools odrzucił układ bez ułożenia:", backendResult.errors);

        const apiErrors = (backendResult.errors && backendResult.errors.length > 0)
            ? backendResult.errors
            : ["Algorytm AI nie odnalazł ułożenia spełniającego wymogi rygorów wysokości lub kolizji."];

        if (!autoTriggered) {
            apiErrors.forEach(e => showToast(e, 'error'));
        }

        well.configSource = 'AUTO_AI';
        well.configStatus = 'ERROR';
        well.configErrors = apiErrors;
        well.config = [];

        refreshAll();
        return; // Zakończ odpytywanie - wymuszamy AI i BLOKUJEMY przepinanie na słabszy kod JS!
    }

    // FALLBACK tylko wtedy, gdy API nie ma w ogóle łączności (wyłączony port 8000, brak serwera Pyt):
    console.warn("Backend niedostępny lub środowisko Python nie działa. Spadek do lokalnego kodu awaryjnego JS.");
    const result = runJsAutoSelection(well, requiredMm, availProducts);
    if (result.error) {
        if (!autoTriggered) showToast(result.error, "error");
        well.configStatus = "ERROR";
        well.configErrors = [result.error];
        refreshAll();
        return;
    }
    well.config = result.config;

    const errors = result.errors || [];
    if (result.fallback) errors.push(result.fallbackReason ? `Zastosowana rozszerzona tolerancja - ${result.fallbackReason}` : "Zastosowana rozszerzona tolerancja");
    if (errors.length > 0 && result.isMinimal) {
        well.configStatus = "WARNING";
    } else if (errors.length > 0) {
        well.configStatus = "WARNING";
    } else {
        well.configStatus = "OK";
    }
    well.configErrors = errors;
    well.configSource = "AUTO_JS";

    refreshAll();
    const diffStr = result.diff >= 0 ? `+${result.diff}mm` : `${result.diff}mm`;
    const redLabel = result.reductionUsed ? " + Redukcja DN1000" : "";
    const fallbackLabel = result.fallback ? " ⚠️ (rozszerzona tolerancja)" : "";
    let statusIcon = "✅";
    if (well.configStatus === "WARNING") statusIcon = "⚠️";
    if (well.configStatus === "ERROR") statusIcon = "❗";
    if (!autoTriggered) {
        showToast(`${statusIcon} Auto-dobór: ${fmtInt(result.totalHeight)} mm (${diffStr}) | ${result.topLabel}${redLabel}${fallbackLabel}`, well.configStatus === "OK" ? "success" : "warning");
    }
}

function runJsAutoSelection(well, requiredMm, availProducts) {
    const dn = well.dn;
    const mag = well.magazyn || 'Kluczbork';
    const ff = mag === 'Włocławek' ? 'formaStandardowa' : 'formaStandardowaKLB';
    const dnProducts = availProducts.filter(p => p.dn === dn);
    const allProducts = availProducts;

    // --- 1. Zakończenie studni ---
    let topProd = null;
    if (well.zakonczenie) {
        topProd = studnieProducts.find(p => p.id === well.zakonczenie && (p.dn === dn || p.dn === null));
    }
    if (!topProd) {
        topProd = dnProducts.find(p => p.componentType === 'konus');
        if (!topProd) topProd = dnProducts.find(p => p.componentType === 'plyta_din');
    }
    if (!topProd) return { error: 'Nie znaleziono domyślnego zakończenia studni.' };

    const topConfigs = [];
    const buildTopConfig = (topP) => {
        let items = [];
        let h = 0;
        let lbl = '';
        if (['plyta_zamykajaca', 'plyta_najazdowa', 'pierscien_odciazajacy'].includes(topP.componentType)) {
            const sameDn = studnieProducts.filter(p => p.dn === topP.dn);
            const ring = sameDn.find(p => p.componentType === 'pierscien_odciazajacy');
            const plate = (topP.componentType === 'pierscien_odciazajacy')
                ? sameDn.find(p => p.componentType === 'plyta_zamykajaca' || p.componentType === 'plyta_najazdowa')
                : topP;
            if (ring && plate) {
                items.push({ productId: plate.id, quantity: 1 }, { productId: ring.id, quantity: 1 });
                h += plate.height + ring.height;
                lbl = plate.name + ' + Pierścień';
            } else {
                items.push({ productId: topP.id, quantity: 1 });
                h += topP.height;
                lbl = topP.name;
            }
        } else {
            items.push({ productId: topP.id, quantity: 1 });
            h += topP.height;
            lbl = topP.name;
        }

        let wlazItem = well.config.find(c => studnieProducts.find(p => p.id === c.productId)?.componentType === 'wlaz');
        if (!wlazItem) {
            const wlaz150 = studnieProducts.find(p => p.id === 'WLAZ-150');
            if (wlaz150) wlazItem = { productId: wlaz150.id, quantity: 1 };
        }
        if (wlazItem) {
            const wlazProd = studnieProducts.find(p => p.id === wlazItem.productId);
            if (wlazProd) {
                items.unshift(wlazItem);
                h += wlazProd.height * wlazItem.quantity;
                lbl = wlazProd.name + ' + ' + lbl;
            }
        }
        return { items, height: h, label: lbl, prod: topP };
    };

    topConfigs.push(buildTopConfig(topProd));
    const isRelief = ['plyta_zamykajaca', 'plyta_najazdowa', 'pierscien_odciazajacy'].includes(topProd.componentType);
    if (isRelief || topProd.componentType === 'konus') {
        const dinProd = dnProducts.find(p => p.componentType === 'plyta_din');
        if (dinProd) {
            const fbCfg = buildTopConfig(dinProd);
            fbCfg.label += ' (zamiennik)';
            topConfigs.push(fbCfg);
        }
    }

    // --- 2. Minimalna Dennica (spocznik) ---
    let minDennicaH = 0;
    if (well.spocznikH && well.spocznikH !== 'brak') {
        const sh = well.spocznikH;
        if (sh === '1/2' || sh === '1_2') minDennicaH = dn * 0.5;
        else if (sh === '2/3' || sh === '2_3') minDennicaH = dn * (2 / 3);
        else if (sh === '3/4' || sh === '3_4') minDennicaH = dn * 0.75;
        else if (sh === '1/1' || sh === 'cale' || sh === '1_1') minDennicaH = dn;
        else if (!isNaN(parseFloat(sh))) minDennicaH = parseFloat(sh);
    }

    let holes = (well.przejscia || []).map(p => {
        return {
            z: parseFloat(p.przejscieZ) || 0,
            ruraDz: parseFloat(p.ruraDz) || 0,
            zdD: parseFloat(p.zapasDol) || 0,
            zdDM: parseFloat(p.zapasDolMin) || 0,
            zdG: parseFloat(p.zapasGora) || 0,
            zdGM: parseFloat(p.zapasGoraMin) || 0
        };
    });

    let maxReqH = minDennicaH;
    let maxReqHMin = minDennicaH;

    holes.forEach(h => {
        const effZdD = h.z === 0 ? 0 : h.zdD;
        const effZdDM = h.z === 0 ? 0 : h.zdDM;
        const reqH = h.z + h.ruraDz + h.zdG;
        if (reqH > maxReqH) maxReqH = reqH;
        const reqHMin = h.z + h.ruraDz + h.zdGM;
        if (reqHMin > maxReqHMin) maxReqHMin = reqHMin;
    });

    let dennicy = dnProducts.filter(p => p.componentType === 'dennica').sort((a, b) => {
        const aForm = a[ff] === 1 ? 1 : 0;
        const bForm = b[ff] === 1 ? 1 : 0;
        if (aForm !== bForm) return bForm - aForm;
        return a.height - b.height;
    });
    if (dennicy.length === 0) return { error: 'Brak dennic w magazynie.' };

    const avrRings = allProducts.filter(p => p.componentType === 'avr').sort((a, b) => b.height - a.height);
    const kregiRaw = dnProducts.filter(p => p.componentType === 'krag');
    const kregi = kregiRaw.filter(p => p[ff] === 1).sort((a, b) => b.height - a.height);
    if (kregi.length === 0) kregi.push(...kregiRaw.sort((a, b) => b.height - a.height));

    const dn1000Products = availProducts.filter(p => p.dn === 1000);
    const dn1000Kregi = dn1000Products.filter(p => p.componentType === 'krag').filter(p => p[ff] === 1).sort((a, b) => b.height - a.height);
    if (dn1000Kregi.length === 0) dn1000Kregi.push(...dn1000Products.filter(p => p.componentType === 'krag').sort((a, b) => b.height - a.height));

    let reductionPlate = dnProducts.find(p => p.componentType === 'plyta_redukcyjna');
    if (!reductionPlate) reductionPlate = studnieProducts.find(p => p.componentType === 'plyta_redukcyjna' && p.dn === dn);
    let canReduce = well.redukcjaDN1000 && [1200, 1500, 2000, 2500].includes(dn) && reductionPlate;

    function fillKregi(target, kList) {
        let kItems = [];
        let filled = 0;
        if (target > 0) {
            let left = target;
            for (const k of kList) {
                if (left <= 0) break;
                const qty = Math.floor(left / k.height);
                for (let i = 0; i < qty; i++) {
                    kItems.push({ productId: k.id, quantity: 1, _h: k.height });
                    filled += k.height;
                    left -= k.height;
                }
            }
        }
        return { kItems, filled };
    }

    function checkConflicts(kItems, denH, reduceH, topItems) {
        let segs = [];
        let y = 0;
        segs.push({ type: 'dennica', h: denH, start: 0, end: denH });
        y += denH;

        for (let k of kItems) {
            if (k.productId === reductionPlate?.id) {
                segs.push({ type: 'plyta_redukcyjna', h: reduceH, start: y, end: y + reduceH });
                y += reduceH;
            } else {
                segs.push({ type: 'krag', h: k._h, start: y, end: y + k._h });
                y += k._h;
            }
        }
        for (let t of [...topItems].reverse()) {
            const tp = studnieProducts.find(p => p.id === t.productId);
            if (tp) {
                segs.push({ type: tp.componentType, h: tp.height, start: y, end: y + tp.height });
                y += tp.height;
            }
        }

        let isMinimal = false;
        let valid = true;
        let errors = [];

        holes.forEach((h, idx) => {
            const hTop = h.z + h.ruraDz;
            const hBot = h.z;
            const effZdD = h.z === 0 ? 0 : h.zdD;
            const resTop = hTop + h.zdG;
            const resBot = hBot - effZdD;
            const resTopMin = hTop + h.zdGM;
            const effZdDM = h.z === 0 ? 0 : h.zdDM;
            const resBotMin = hBot - effZdDM;

            let strictValid = true;
            let minValid = true;

            for (let s of segs) {
                if (s.type !== 'dennica' || true) {
                    if (s.end >= resBot && s.end <= resTop) strictValid = false;
                    if (s.end >= resBotMin && s.end <= resTopMin) minValid = false;
                }

                const isForbidden = ['konus', 'plyta_din', 'plyta_redukcyjna', 'pierscien_odciazajacy'].includes(s.type);
                if (isForbidden) {
                    if ((hTop > s.start && hBot < s.end)) {
                        strictValid = false; minValid = false;
                        errors.push(`Kolizja otworu z elementem ${s.type}`);
                    }
                }
                if (s.type === 'plyta_redukcyjna') {
                    if (hBot >= s.start) {
                        strictValid = false; minValid = false;
                        errors.push(`Przejście nie może być powyżej płyty redukcyjnej`);
                    }
                }
            }

            if (!strictValid) {
                if (minValid) {
                    isMinimal = true;
                } else {
                    valid = false;
                    errors.push(`Kolizja otworu Z=${h.z} ze złączami`);
                }
            }
        });

        return { valid, isMinimal, errors };
    }

    function solve(tolBelow, tolAbove, maxAvr, skipHolesValid) {
        let best = null;
        let bestScore = Infinity;

        for (const topCfg of topConfigs) {
            for (const dennica of dennicy) {
                if (dennica.height < maxReqHMin) continue;
                let reqD = maxReqH;
                let denIsMin = false;
                if (dennica.height < reqD) denIsMin = true;

                const targetBody = requiredMm - topCfg.height - dennica.height;
                if (targetBody < 0) continue;

                const { kItems, filled } = fillKregi(targetBody, kregi);

                const deficit = requiredMm - (dennica.height + topCfg.height + filled);
                if (deficit > maxAvr || deficit < -tolAbove) continue;

                let avrItems = [];
                let avrH = 0;
                let left = deficit;
                for (const avr of avrRings) {
                    if (left <= 0) break;
                    const qty = Math.floor(left / avr.height);
                    if (qty > 0) {
                        avrItems.push({ productId: avr.id, quantity: qty });
                        left -= avr.height * qty;
                        avrH += avr.height * qty;
                    }
                }
                const diff = (dennica.height + topCfg.height + filled + avrH) - requiredMm;
                if (diff < -tolBelow || diff > tolAbove) continue;

                const conf = checkConflicts(kItems, dennica.height, 0, topCfg.items);
                if (!conf.valid && !skipHolesValid) continue;

                let score = dennica.height * 1000 + kItems.length * 10;
                if (diff !== 0) score += Math.abs(diff) * 5;
                if (conf.isMinimal || denIsMin) score += 50000;
                if (topCfg.label.includes('zamiennik')) score += 100000;

                if (score < bestScore) {
                    bestScore = score;
                    best = {
                        topItems: [...topCfg.items],
                        kregItems: kItems.map(ki => ({ productId: ki.productId, quantity: ki.quantity })),
                        dennica: { productId: dennica.id, quantity: 1 },
                        avrItems: avrItems,
                        totalHeight: dennica.height + topCfg.height + filled + avrH,
                        diff: diff,
                        topLabel: topCfg.label,
                        errors: conf.errors,
                        isMinimal: conf.isMinimal || denIsMin
                    };
                }
            }
        }

        if (canReduce) {
            let topRedItems = [];
            let topRedH = 0;
            const redTopProducts = dn1000Products.filter(p => ['konus', 'plyta_din', 'plyta_najazdowa', 'plyta_zamykajaca', 'pierscien_odciazajacy'].includes(p.componentType));
            const rZak = well.redukcjaZakonczenie ? redTopProducts.find(p => p.id === well.redukcjaZakonczenie) : redTopProducts.find(p => p.componentType === 'konus');
            if (rZak) {
                topRedItems.push({ productId: rZak.id, quantity: 1 });
                topRedH += rZak.height;
            }

            let dynamicMinBottom = well.redukcjaMinH || 2500;
            let lift = 0;
            while (lift < 5) {
                for (const dennica of dennicy) {
                    if (dennica.height < maxReqHMin) continue;
                    let bottomNeed = Math.max(dynamicMinBottom - dennica.height, 0);
                    const bKregi = fillKregi(bottomNeed, kregi);
                    const bSec = dennica.height + bKregi.filled;

                    const dn1000Need = requiredMm - bSec - reductionPlate.height - topRedH;
                    if (dn1000Need < 0) continue;

                    const t1000 = fillKregi(dn1000Need, dn1000Kregi);
                    const currentTotal = bSec + reductionPlate.height + topRedH + t1000.filled;

                    const deficit = requiredMm - currentTotal;
                    if (deficit > maxAvr || deficit < -tolAbove) continue;
                    let avrItems = [];
                    let avrH = 0;
                    let left = deficit;
                    for (const avr of avrRings) {
                        if (left <= 0) break;
                        const qty = Math.floor(left / avr.height);
                        if (qty > 0) {
                            avrItems.push({ productId: avr.id, quantity: qty });
                            left -= avr.height * qty;
                            avrH += avr.height * qty;
                        }
                    }

                    const diff = currentTotal + avrH - requiredMm;
                    if (diff < -tolBelow || diff > tolAbove) continue;

                    let redKItems = [];
                    bKregi.kItems.forEach(k => redKItems.push(k));
                    redKItems.push({ productId: reductionPlate.id, quantity: 1, _h: reductionPlate.height });
                    t1000.kItems.forEach(k => redKItems.push(k));

                    const conf = checkConflicts(redKItems, dennica.height, reductionPlate.height, topRedItems);

                    if (!conf.valid && !skipHolesValid) {
                        if (conf.errors.some(e => e.includes('redukcyjnej') || e.includes('konus'))) {
                            break;
                        }
                        continue;
                    }

                    let score = dennica.height * 1000 + 4000;

                    const oversizedBottom = bSec - dynamicMinBottom;
                    if (oversizedBottom > 0) {
                        score += oversizedBottom * 40;
                    }

                    if (diff !== 0) score += Math.abs(diff) * 5;
                    if (conf.isMinimal) score += 50000;

                    if (score < bestScore) {
                        bestScore = score;
                        best = {
                            reductionUsed: true,
                            topItems: [...topRedItems],
                            kregItems: [
                                ...t1000.kItems.map(ki => ({ productId: ki.productId, quantity: ki.quantity })).reverse(),
                                { productId: reductionPlate.id, quantity: 1 },
                                ...bKregi.kItems.map(ki => ({ productId: ki.productId, quantity: ki.quantity })).reverse()
                            ],
                            dennica: { productId: dennica.id, quantity: 1 },
                            avrItems: avrItems,
                            totalHeight: currentTotal + avrH,
                            diff: diff,
                            topLabel: rZak ? rZak.name + ' (Redukcja)' : 'Redukcja',
                            errors: conf.errors,
                            isMinimal: conf.isMinimal || (dennica.height < maxReqH)
                        };
                    }
                }
                dynamicMinBottom += 250;
                lift++;
            }
        }

        return best;
    }

    let solution = solve(50, 20, 260, false);
    let fallback = false;
    let fallbackReason = "";
    if (!solution) { solution = solve(50, 20, 260, true); if (solution) { fallback = true; fallbackReason = "kolizje przejść ominięte awaryjnie"; } }

    if (!solution) { return { error: `Nie znaleziono pasującej kombinacji elementów dla tej wysokości (max. ± dozwolona odchyłka, max ${well.magazyn || 'Kluczbork'} avr 26cm).` }; }

    const wlazItems = solution.topItems.filter(item => {
        const p = studnieProducts.find(pr => pr.id === item.productId);
        return p && p.componentType === 'wlaz';
    });
    const otherTopItems = solution.topItems.filter(item => {
        const p = studnieProducts.find(pr => pr.id === item.productId);
        return p && p.componentType !== 'wlaz';
    });

    const kregItemsOrdered = solution.reductionUsed ? solution.kregItems : [...solution.kregItems].reverse();

    let newConfig = [...wlazItems, ...solution.avrItems, ...otherTopItems, ...kregItemsOrdered, solution.dennica];

    for (let i = 0; i < newConfig.length - 1; i++) {
        const itemKonus = newConfig[i];
        const prodKonus = studnieProducts.find(p => p.id === itemKonus.productId);

        if (prodKonus && prodKonus.componentType === 'konus' && !prodKonus.name.includes('+')) {
            let nextKragIdx = -1;
            for (let j = i + 1; j < newConfig.length; j++) {
                const pj = studnieProducts.find(p => p.id === newConfig[j].productId);
                if (pj && (pj.componentType === 'krag' || pj.componentType === 'krag_ot')) {
                    nextKragIdx = j;
                    break;
                } else if (pj && (pj.componentType === 'dennica' || pj.componentType === 'plyta_redukcyjna')) {
                    break;
                }
            }

            if (nextKragIdx >= 0) {
                const itemKrag = newConfig[nextKragIdx];
                const prodKrag = studnieProducts.find(p => p.id === itemKrag.productId);

                if (prodKrag && prodKrag.height === 250 && prodKrag.componentType === 'krag') {
                    const konusPlus = availProducts.find(p => p.componentType === 'konus' && p.dn === prodKonus.dn && p.name.includes('Konus+'));
                    if (konusPlus) {
                        itemKonus.productId = konusPlus.id;
                        if (itemKrag.quantity > 1) {
                            itemKrag.quantity--;
                        } else {
                            newConfig.splice(nextKragIdx, 1);
                        }
                    }
                }
            }
            break;
        }
    }

    return {
        config: newConfig,
        totalHeight: solution.totalHeight,
        diff: solution.diff,
        isMinimal: solution.isMinimal,
        errors: solution.errors,
        topLabel: solution.topLabel,
        fallback,
        fallbackReason
    };
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

            const statusBadge = w.configStatus === 'ERROR' ? '<span title="Błąd konfiguracji" style="margin-left:0.3rem;">❌</span>'
                : w.configStatus === 'WARNING' ? '<span title="' + (w.configErrors || []).join('; ') + '" style="margin-left:0.3rem;">⚠️</span>'
                    : w.configStatus === 'OK' ? '<span style="margin-left:0.3rem;">✅</span>' : '';

            // Icon for configuration source
            let sourceBadge = '';
            if (w.configSource === 'AUTO_AI') {
                sourceBadge = '<span title="Dobór Automatyczny (Serwer AI / OR-Tools)" style="font-size:0.75rem; margin-left:0.3rem; filter: sepia(100%) hue-rotate(190deg) saturate(500%);">🧠</span>';
            } else if (w.configSource === 'AUTO_JS') {
                sourceBadge = '<span title="Dobór Automatyczny (Skrypt JS)" style="font-size:0.75rem; margin-left:0.3rem; filter: sepia(100%) hue-rotate(30deg) saturate(300%);">⚙️</span>';
            } else {
                sourceBadge = '<span title="Dobór Ręczny" style="font-size:0.75rem; margin-left:0.3rem; filter: grayscale(1);">🖐️</span>';
            }

            let errorsHtml = '';
            if (w.configErrors && w.configErrors.length > 0) {
                const color = w.configStatus === 'ERROR' ? '#ef4444' : '#f59e0b';
                errorsHtml = `<div style="font-size:0.65rem; color:${color}; padding:0.2rem 0; line-height:1.2;">${w.configErrors.join('<br>')}</div>`;
            }

            const wellLockBadge = isWellLocked(i) ? '<span title="Studnia zablokowana — zaakceptowane zlecenie produkcyjne" style="font-size:0.75rem; margin-left:0.3rem;">🔒</span>' : '';

            html += `<div class="well-list-item ${isActive ? 'active' : ''}" style="${changeStyling}${isWellLocked(i) ? ' opacity:0.7;' : ''}" onclick="selectWell(${i})">
              <div class="well-list-header">
                <div class="well-list-name">${w.name}${wellLockBadge}${sourceBadge}${statusBadge}${changeBadge}</div>
                <div class="well-list-actions">
                  <button class="well-list-action" title="Zmień nazwę" onclick="event.stopPropagation(); renameWell(${i})">✏️</button>
                  <button class="well-list-action" title="Duplikuj" onclick="event.stopPropagation(); duplicateWell(${i})">📋</button>
                  <button class="well-list-action del" title="Usuń" onclick="event.stopPropagation(); removeWell(${i})">✕</button>
                </div>
              </div>
              ${errorsHtml}
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
    renderWellConfig();
}

function getDiscountedTotal() {
    let grandTotal = 0;
    wells.forEach(w => {
        const s = calcWellStats(w);
        grandTotal += s.price;
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
        let dennicaBaseSum = 0, nadbudowaBaseSum = 0;
        let dennicaAfterSum = 0, nadbudowaAfterSum = 0;
        groupWells.forEach(w => {
            const s = calcWellStats(w);
            dennicaBaseSum += s.priceDennicaBase;
            nadbudowaBaseSum += s.priceNadbudowaBase;
            dennicaAfterSum += s.priceDennica;
            nadbudowaAfterSum += s.priceNadbudowa;
        });
        const totalDN = dennicaBaseSum + nadbudowaBaseSum;

        const disc = wellDiscounts[dn] || { dennica: 0, nadbudowa: 0 };
        const totalAfter = dennicaAfterSum + nadbudowaAfterSum;

        grandDennica += dennicaBaseSum;
        grandNadbudowa += nadbudowaBaseSum;
        grandTotal += totalDN;
        grandDiscounted += totalAfter;

        html += `<div style="background:rgba(255,255,255,0.03); border-radius:6px; padding:0.35rem 0.4rem; margin-bottom:0.25rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.2rem;">
            <span style="font-size:0.7rem; font-weight:700; color:#a78bfa;">DN${dn}</span>
            <span style="font-size:0.65rem; color:var(--text-muted);">${groupWells.length} szt.</span>
          </div>
          <div style="display:grid; grid-template-columns:1fr auto auto; gap:0.15rem 0.3rem; font-size:0.62rem; align-items:center;">
            <span style="color:var(--text-muted);">Dennica</span>
            <span style="color:var(--text-secondary); text-align:right;">${fmtInt(dennicaBaseSum)}</span>
            <div style="display:flex; align-items:center; gap:0.15rem;">
              <input type="number" min="0" max="100" step="0.5" value="${disc.dennica || 0}"
                style="width:38px; padding:1px 3px; font-size:0.6rem; text-align:center; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); border-radius:3px; color:#fff;"
                onchange="updateDiscount(${dn},'dennica',this.value)" oninput="updateDiscount(${dn},'dennica',this.value)">
              <span style="color:var(--text-muted);">%</span>
            </div>
            <span style="color:var(--text-muted);">Nadbudowa</span>
            <span style="color:var(--text-secondary); text-align:right;">${fmtInt(nadbudowaBaseSum)}</span>
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

function getItemAssessedPrice(well, p, applyDiscount = true) {
    let itemPrice = p.price || 0;

    let discountPct = 0;
    if (applyDiscount && well.dn) {
        const disc = wellDiscounts[well.dn] || { dennica: 0, nadbudowa: 0 };
        if (p.componentType === 'dennica' || p.componentType === 'kineta') {
            discountPct = disc.dennica || 0;
        } else {
            discountPct = disc.nadbudowa || 0;
        }
    }
    const mult = 1 - (discountPct / 100);

    if (p.componentType === 'kineta') {
        let dennicaHeight = 0;
        const dennicaItem = well.config.find(c => {
            const pr = studnieProducts.find(x => x.id === c.productId);
            return pr && pr.componentType === 'dennica';
        });
        if (dennicaItem) {
            dennicaHeight = studnieProducts.find(x => x.id === dennicaItem.productId)?.height || 0;
        }

        const h1m = parseFloat(p.hMin1); const h1x = parseFloat(p.hMax1);
        const h2m = parseFloat(p.hMin2); const h2x = parseFloat(p.hMax2);
        const h3m = parseFloat(p.hMin3); const h3x = parseFloat(p.hMax3);

        let kinetaBase = itemPrice;
        if (!isNaN(h1m) && !isNaN(h1x) && dennicaHeight >= h1m && dennicaHeight <= h1x) {
            kinetaBase = parseFloat(p.cena1) || 0;
        } else if (!isNaN(h2m) && !isNaN(h2x) && dennicaHeight >= h2m && dennicaHeight <= h2x) {
            kinetaBase = parseFloat(p.cena2) || 0;
        } else if (!isNaN(h3m) && !isNaN(h3x) && dennicaHeight >= h3m && dennicaHeight <= h3x) {
            kinetaBase = parseFloat(p.cena3) || 0;
        }

        itemPrice = kinetaBase * mult;

        // Add malowanie to kineta before early return
        if (well.malowanieW && well.malowanieW !== 'brak' && well.malowanieWewCena) {
            if (well.malowanieW === 'kineta' || well.malowanieW === 'cale') {
                itemPrice += (p.area || 0) * well.malowanieWewCena;
            }
        }
        if (well.malowanieZ === 'zewnatrz' && well.malowanieZewCena) {
            itemPrice += (p.areaExt || 0) * well.malowanieZewCena;
        } else if (well.malowanieZ === 'zewnatrz' && p.malowanieZewnetrzne && !well.malowanieZewCena) {
            itemPrice += parseFloat(p.malowanieZewnetrzne);
        }

        return itemPrice;
    }

    itemPrice = itemPrice * mult;

    // Wkładka PEHD
    if (well.wkladka && well.wkladka !== 'brak' && p.doplataPEHD) {
        itemPrice += parseFloat(p.doplataPEHD);
    }

    // Malowanie wewnątrz (z ceny za m2)
    if (well.malowanieW && well.malowanieW !== 'brak' && well.malowanieWewCena) {
        if (well.malowanieW === 'kineta_dennica' && p.componentType === 'dennica') {
            itemPrice += (p.area || 0) * well.malowanieWewCena;
        } else if (well.malowanieW === 'cale') {
            itemPrice += (p.area || 0) * well.malowanieWewCena;
        }
    } else if (well.malowanieW && well.malowanieW !== 'brak' && p.malowanieWewnetrzne) {
        if (well.malowanieW === 'cale' || p.componentType === 'dennica') {
            itemPrice += parseFloat(p.malowanieWewnetrzne);
        }
    }

    // Malowanie zewnątrz (z ceny za m2 i stara opcja)
    if (well.malowanieZ === 'zewnatrz' && well.malowanieZewCena) {
        itemPrice += (p.areaExt || 0) * well.malowanieZewCena;
    } else if (well.malowanieZ === 'zewnatrz' && p.malowanieZewnetrzne && !well.malowanieZewCena) {
        itemPrice += parseFloat(p.malowanieZewnetrzne);
    }

    // Żelbet (dopłata dla dennicy)
    if ((well.dennicaMaterial === 'zelbetowa' || well.material === 'zelbetowa') && p.componentType === 'dennica' && p.doplataZelbet) {
        itemPrice += parseFloat(p.doplataZelbet);
    }

    // Drabinka nierdzewna
    if (well.stopnie === 'nierdzewna' && p.doplataDrabNierdzewna) {
        itemPrice += parseFloat(p.doplataDrabNierdzewna);
    }

    return itemPrice;
}

function calcWellStats(well) {
    let price = 0, weight = 0, height = 0, areaInt = 0, areaExt = 0;
    let priceDennica = 0, priceNadbudowa = 0;

    // Base prices (undiscounted)
    let priceBase = 0, priceDennicaBase = 0, priceNadbudowaBase = 0;

    let dennicaCount = 0;

    well.config.forEach(item => {
        const p = studnieProducts.find(pr => pr.id === item.productId);
        if (!p) return;

        let itemPriceDisc = getItemAssessedPrice(well, p, true);
        let itemPriceBaseVal = getItemAssessedPrice(well, p, false);

        const lineTotalDisc = itemPriceDisc * item.quantity;
        const lineTotalBase = itemPriceBaseVal * item.quantity;

        price += lineTotalDisc;
        priceBase += lineTotalBase;

        // Split into dennica vs nadbudowa
        if (p.componentType === 'dennica' || p.componentType === 'kineta') {
            priceDennica += lineTotalDisc;
            priceDennicaBase += lineTotalBase;
        } else {
            priceNadbudowa += lineTotalDisc;
            priceNadbudowaBase += lineTotalBase;
        }

        weight += (p.weight || 0) * item.quantity;
        areaInt += (p.area || 0) * item.quantity;
        areaExt += (p.areaExt || 0) * item.quantity;

        if (p.componentType === 'dennica') {
            for (let q = 0; q < item.quantity; q++) {
                dennicaCount++;
                height += (p.height || 0) - (dennicaCount > 1 ? 100 : 0);
            }
        } else {
            height += (p.height || 0) * item.quantity;
        }
    });

    if (well.przejscia) {
        let discNadbudowa = 0;
        if (well.dn && wellDiscounts[well.dn]) {
            discNadbudowa = wellDiscounts[well.dn].nadbudowa || 0;
        }
        const mult = 1 - (discNadbudowa / 100);

        well.przejscia.forEach(item => {
            const p = studnieProducts.find(pr => pr.id === item.productId);
            if (!p) return;
            const bP = p.price || 0;
            const dP = bP * mult;

            priceBase += bP;
            priceNadbudowaBase += bP;

            price += dP;
            priceNadbudowa += dP;

            weight += (p.weight || 0);
        });
    }

    let malowanieZewTotal = 0;
    if (well.malowanieZ === 'zewnatrz' && well.malowanieZewCena) {
        malowanieZewTotal = areaExt * well.malowanieZewCena;
    }

    if (well.doplata) {
        price += well.doplata;
        priceBase += well.doplata;
        priceDennica += well.doplata;
        priceDennicaBase += well.doplata;
    }

    return {
        price, priceBase,
        priceDennica, priceDennicaBase,
        priceNadbudowa, priceNadbudowaBase,
        weight, height, areaInt, areaExt, malowanieZewTotal
    };
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

            html += `<div class="tile ${activeClass}" data-type="${p.componentType}" onclick="addWellComponent('${p.id}')" draggable="true" ondragstart="dragWellComponent(event, '${p.id}')" ondragend="dragEndWellComponent(event)">
        <div class="tile-name">${p.name}</div>
        <div class="tile-meta">
          <span>${p.weight ? fmtInt(p.weight) + ' kg' : ''}</span>
          <span class="tile-price">${fmtInt(p.price)} PLN</span>
        </div>
      </div>`;
        });
        html += `</div></div>`;
    };

    const availProducts = getAvailableProducts(well);

    const filterByWellParams = (p) => {
        const id = (p.id || '').toUpperCase();

        // 1. Kręgi (KDZ/KDB), Konus (JZW) i stopnie (-B, -D, -N)
        if (p.componentType === 'krag' || p.componentType === 'krag_ot' || p.componentType === 'konus') {
            const isZelbet = well.nadbudowa === 'zelbetowa';
            if (isZelbet && id.startsWith('KDB')) return false;
            if (!isZelbet && id.startsWith('KDZ')) return false;

            const stopnie = well.stopnie || 'drabinka';

            // Kręgi kończą się na: -B (brak), -D (drabinka), -N-D (nierdzewna)
            const hasStepsAny = id.endsWith('-B') || id.endsWith('-D');

            if (hasStepsAny) {
                if (stopnie === 'nierdzewna') {
                    if (!id.endsWith('-N-D')) return false;
                } else if (stopnie === 'brak') {
                    if (!id.endsWith('-B')) return false;
                } else {
                    // drabinka (domyślna)
                    if (!id.endsWith('-D') || id.endsWith('-N-D')) return false;
                }
            }
        }

        // 2. Dennice (DUZ/DU)
        if (p.componentType === 'dennica') {
            const isZelbet = well.dennicaMaterial === 'zelbetowa';
            if (isZelbet && id.startsWith('DU') && !id.startsWith('DUZ')) return false;
            if (!isZelbet && id.startsWith('DUZ')) return false;
        }

        // 3. Płyty (PDZ/PD itp)
        if (['plyta_din', 'plyta_najazdowa', 'plyta_zamykajaca', 'plyta_redukcyjna'].includes(p.componentType)) {
            const isZelbet = well.nadbudowa === 'zelbetowa';
            if (isZelbet && id.startsWith('PD') && !id.startsWith('PDZ')) return false;
            if (!isZelbet && id.startsWith('PDZ')) return false;
            if (isZelbet && id.startsWith('PZ') && !id.startsWith('PZZ')) return false;
            if (!isZelbet && id.startsWith('PZZ')) return false;
        }

        return true;
    };

    const primaryProducts = availProducts
        .filter(p => (p.dn === dn || p.dn === null) && p.category !== 'Uszczelki studni')
        .filter(filterByWellParams);

    groups.forEach(g => renderGroup(g, primaryProducts));

    const hasReduction = well.config.some(c => {
        const p = studnieProducts.find(pr => pr.id === c.productId);
        return p && p.componentType === 'plyta_redukcyjna';
    });

    if ([1200, 1500, 2000, 2500].includes(dn) && hasReduction) {
        const redProducts = availProducts
            .filter(p => p.dn === 1000 && p.category !== 'Uszczelki studni' && p.componentType !== 'plyta_redukcyjna' && p.componentType !== 'dennica')
            .filter(filterByWellParams);
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

/* --- Drag & Drop for Well Components --- */
window.currentDraggedPlaceholderId = null;

function dragWellComponent(ev, productId) {
    ev.dataTransfer.setData("text/plain", productId);
    ev.dataTransfer.effectAllowed = "copy";
    window.currentDraggedPlaceholderId = productId;
}

function dragEndWellComponent(ev) {
    const dz = document.getElementById('drop-zone-diagram');
    if (dz) dz.classList.remove('drag-over');

    const well = getCurrentWell();
    if (well && window.currentDraggedPlaceholderId) {
        well.config = well.config.filter(c => !c.isPlaceholder);
        window.requestAnimationFrame(() => {
            renderWellConfig();
            renderWellDiagram();
        });
    }
    window.currentDraggedPlaceholderId = null;
}

function allowDropWellComponent(ev) {
    ev.preventDefault();
    ev.dataTransfer.dropEffect = (draggedCfgIndex !== null) ? "move" : "copy";
    const dz = document.getElementById('drop-zone-diagram');
    if (dz) dz.classList.add('drag-over');

    const well = getCurrentWell();
    if (!well) return;

    let targetIdx = well.config.length;
    let found = false;
    const grps = Array.from(dz.querySelectorAll('g.diag-comp-grp'));

    for (let g of grps) {
        const rect = g.getBoundingClientRect();
        if (ev.clientY < rect.top + rect.height / 2) {
            targetIdx = parseInt(g.getAttribute('data-cfg-idx'));
            found = true;
            break;
        }
    }
    if (!found && grps.length > 0) {
        targetIdx = well.config.length;
    }

    if (window.currentDraggedPlaceholderId) {
        const plIdx = well.config.findIndex(c => c.isPlaceholder);
        // Avoid flickering by not rendering if position mapped is practically same
        let currentEffIdx = plIdx;
        let newEffIdx = targetIdx;
        if (plIdx > -1 && plIdx < targetIdx) newEffIdx -= 1;

        if (plIdx === -1 || plIdx !== newEffIdx) {
            const p = studnieProducts.find(x => x.id === window.currentDraggedPlaceholderId);
            if (p) {
                if (plIdx > -1) well.config.splice(plIdx, 1);

                let insertIdx = targetIdx;
                if (plIdx > -1 && plIdx < targetIdx) insertIdx -= 1;
                insertIdx = Math.max(0, Math.min(well.config.length, insertIdx));

                well.config.splice(insertIdx, 0, {
                    productId: window.currentDraggedPlaceholderId,
                    quantity: 1,
                    height: p.height || 0,
                    isPlaceholder: true
                });

                window.requestAnimationFrame(() => {
                    renderWellConfig();
                    renderWellDiagram();
                });
            }
        }
    } else if (draggedCfgIndex !== null) {
        let insertIdx = targetIdx;
        if (draggedCfgIndex < targetIdx) insertIdx -= 1;
        insertIdx = Math.max(0, Math.min(well.config.length, insertIdx));

        if (draggedCfgIndex !== insertIdx) {
            const draggedItem = well.config.splice(draggedCfgIndex, 1)[0];
            well.config.splice(insertIdx, 0, draggedItem);
            draggedCfgIndex = insertIdx;

            window.requestAnimationFrame(() => renderWellDiagram());
        }
    }
}

function dragLeaveWellComponent(ev) {
    const dz = document.getElementById('drop-zone-diagram');
    if (dz) dz.classList.remove('drag-over');
}

function dropWellComponent(ev) {
    ev.preventDefault();
    const dz = document.getElementById('drop-zone-diagram');
    if (dz) dz.classList.remove('drag-over');

    const well = getCurrentWell();
    if (well && window.currentDraggedPlaceholderId) {
        // Zamiast kasować na bezczelnego, szukamy gdzie jest nasz placeholder
        const plIdx = well.config.findIndex(c => c.isPlaceholder);
        if (plIdx > -1) {
            well.config[plIdx].isPlaceholder = false;
        } else {
            // Bezpiecznik: jeśli go nie było, dodaj na koniec
            well.config.push({
                productId: window.currentDraggedPlaceholderId,
                quantity: 1
            });
        }

        window.currentDraggedPlaceholderId = null;

        // Włączamy ręczny reżim
        well.autoLocked = true;
        updateAutoLockUI();
        well.configSource = 'MANUAL';

        renderWellConfig();
        renderWellDiagram();
        updateSummary();
    } else if (well && draggedCfgIndex !== null) {
        // Zostało puszczone na puste pole SVG, resetujemy flagi i zapisujemy
        well.config.forEach(c => c.isPlaceholder = false);
        well.autoLocked = true;
        updateAutoLockUI();
        well.configSource = 'MANUAL';

        renderWellConfig();
        renderWellDiagram();
        updateSummary();
    }
}

function addWellComponent(productId) {
    if (isOfferLocked()) { showToast(OFFER_LOCKED_MSG, 'error'); return; }
    if (isWellLocked()) { showToast(WELL_LOCKED_MSG, 'error'); return; }
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
    well.configSource = 'MANUAL';

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
        well.config.push({ productId: prod.id, quantity: 1 });
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
    syncGaskets(well);
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
    if (isWellLocked()) { showToast(WELL_LOCKED_MSG, 'error'); return; }
    const well = getCurrentWell();
    well.configSource = 'MANUAL';

    const removedItem = well.config.splice(index, 1)[0];

    if (removedItem) {
        const p = studnieProducts.find(pr => pr.id === removedItem.productId);
        if (p && p.componentType === 'redukcja') {
            well.redukcjaDN1000 = false;

            const redToggle = document.getElementById('well-redukcja-toggle');
            if (redToggle) redToggle.checked = false;

            well.autoLocked = false;
            if (typeof updateAutoLockUI === 'function') updateAutoLockUI();

            showToast('Usunięto redukcję. Przeliczam studnię na nowo...', 'info');
            autoSelectComponents(false);
            return;
        }
    }

    syncGaskets(well);
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
    well.configSource = 'MANUAL';
    // We do not allow changing quantity to > 1 for concrete items, but keeping the function for removals
    well.config[index].quantity = 1;
    renderWellConfig();
    renderWellDiagram();
    updateSummary();
    renderTiles(); // highlight items
}

function clearWellConfig() {
    const well = getCurrentWell();
    if (!well) return;
    well.configSource = 'MANUAL';
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
        tbody.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-muted);">Kliknij kafelki powyżej, aby dodać elementy studni</div>';
        return;
    }

    // Component type visual order mapping (top of well → bottom)
    const typeOrderMap = {
        wlaz: 0,
        avr: 1,
        plyta_din: 2,
        plyta_najazdowa: 2,
        plyta_zamykajaca: 2,
        konus: 2,
        pierscien_odciazajacy: 3,
        plyta_redukcyjna: 4,
        krag: 5,
        krag_ot: 5,
        dennica: 6,
        kineta: 7
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
        dennica: { bg: '#14532d', label: '🟩 Dennica' },
        kineta: { bg: '#9d174d', label: '🔌 Kineta' }
    };

    let html = '';
    well.config.forEach((item, index) => {
        const p = studnieProducts.find(pr => pr.id === item.productId);
        if (!p) return;
        const itemAssessedPrice = getItemAssessedPrice(well, p);
        let totalPrice = itemAssessedPrice * item.quantity;

        if (p.componentType === 'dennica') {
            const kinetaItem = well.config.find(c => {
                const pr = studnieProducts.find(x => x.id === c.productId);
                return pr && pr.componentType === 'kineta';
            });
            if (kinetaItem) {
                const kinetaProd = studnieProducts.find(x => x.id === kinetaItem.productId);
                if (kinetaProd) {
                    const rawKinetaPrice = getItemAssessedPrice(well, kinetaProd);
                    totalPrice += rawKinetaPrice * (kinetaItem.quantity || 1);
                }
            }
        }
        const totalWeight = (p.weight || 0) * item.quantity;
        const totalAreaInt = (p.area || 0) * item.quantity;
        const totalAreaExt = (p.areaExt || 0) * item.quantity;
        const badge = typeBadge[p.componentType] || { bg: '#333', label: '?' };

        const canMoveUp = index > 0;
        const canMoveDown = index < well.config.length - 1;

        const isPlaceholder = item.isPlaceholder;
        const plStyle = isPlaceholder ? 'opacity:0.7; box-shadow: 0 0 15px rgba(56, 189, 248, 0.4); pointer-events: none;' : '';

        html += `<div data-cfg-idx="${index}" class="config-tile" draggable="true" ondragstart="handleCfgDragStart(event)" ondragover="handleCfgDragOver(event)" ondrop="handleCfgDrop(event)" ondragend="handleCfgDragEnd(event)" style="background:linear-gradient(90deg, ${badge.bg} 0%, rgba(30,41,59,0.8) 100%); border:1px solid rgba(255,255,255,0.05); border-left:4px solid ${badge.bg.substring(0, 7)}; border-radius:8px; padding:0.45rem 0.5rem; position:relative; transition:all 0.2s ease; margin-bottom:0.3rem; cursor:grab; ${plStyle}"
                      onmouseenter="if(!${isPlaceholder}){this.style.filter='brightness(1.1)'; window.highlightSvg('cfg', ${index})}" onmouseleave="if(!${isPlaceholder}){this.style.filter='brightness(1)'; window.unhighlightSvg('cfg', ${index})}">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            
            <div style="display:flex; align-items:center; gap:0.4rem;">
                <div style="display:flex; flex-direction:column; gap:1px; align-items:center; background:rgba(0,0,0,0.2); padding:0.15rem; border-radius:4px;">
                  <button class="cfg-move-btn" ${!canMoveUp ? 'disabled' : ''} onclick="moveWellComponent(${index}, -1)" title="W górę" style="background:none; border:none; color:var(--text-muted); font-size:0.6rem; cursor:${canMoveUp ? 'pointer' : 'default'}; display:${item.autoAdded ? 'none' : 'block'};">▲</button>
                  <span style="font-size:0.6rem; color:var(--text-primary); font-weight:700;">${index + 1}</span>
                  <button class="cfg-move-btn" ${!canMoveDown ? 'disabled' : ''} onclick="moveWellComponent(${index}, 1)" title="W dół" style="background:none; border:none; color:var(--text-muted); font-size:0.6rem; cursor:${canMoveDown ? 'pointer' : 'default'}; display:${item.autoAdded ? 'none' : 'block'};">▼</button>
                </div>

                <div style="display:flex; flex-direction:column; gap:0.1rem;">
                  <div style="font-weight:700; color:var(--text-primary); font-size:0.75rem; line-height:1.2;">${p.name}${p.componentType === 'uszczelka' && item.quantity > 1 ? ` (x${item.quantity} szt.)` : (p.componentType === 'uszczelka' ? ` (1 szt.)` : '')}</div>
                  <div style="font-size:0.6rem; color:var(--text-muted);">${p.id}${p.height ? ' | H=' + p.height + 'mm' : ''}</div>
                </div>
            </div>

            <div style="display:flex; align-items:center; gap:0.6rem;">
              <div style="font-size:0.6rem; color:var(--text-muted); text-align:right;">Waga:<br><span style="color:var(--text-primary); font-weight:600; font-size:0.65rem;">${p.weight ? fmtInt(totalWeight) + ' kg' : '—'}</span></div>
              <div style="font-size:0.6rem; color:var(--text-muted); text-align:right;">Cena:<br><span style="font-size:0.8rem; font-weight:800; color:var(--success);">${p.componentType === 'kineta' ? 'wliczone (' + fmtInt(totalPrice) + ' PLN)' : fmtInt(totalPrice) + ' PLN'}</span></div>
              <button onclick="removeWellComponent(${index})" title="Usuń" style="background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); border-radius:6px; cursor:pointer; font-size:0.8rem; padding:0.3rem; color:#ef4444; display:${item.autoAdded ? 'none' : 'flex'}; align-items:center; justify-content:center;">✕</button>
            </div>

          </div>
        </div>`;
    });

    tbody.innerHTML = html;
}

/* ===== MOVE WELL COMPONENT ===== */
function moveWellComponent(index, direction) {
    const well = getCurrentWell();
    if (!well) return;
    if (isWellLocked()) { showToast(WELL_LOCKED_MSG, 'error'); return; }
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
    well.configSource = 'MANUAL';

    renderWellConfig();
}

/* ===== DRAG & DROP FOR CONCRETE CONFIG ===== */
let draggedCfgIndex = null;

window.handleCfgDragStart = function (e) {
    draggedCfgIndex = parseInt(e.currentTarget.getAttribute('data-cfg-idx'));
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.style.opacity = '0.4';

    // Robimy z niego ducha na czas ciągnięcia
    const well = getCurrentWell();
    if (well && well.config[draggedCfgIndex]) {
        well.config[draggedCfgIndex].isPlaceholder = true;
        window.requestAnimationFrame(() => renderWellDiagram());
    }
};

window.handleCfgDragOver = function (e) {
    if (draggedCfgIndex === null && !window.currentDraggedPlaceholderId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const tile = e.target.closest('.config-tile');

    if (draggedCfgIndex !== null) {
        if (tile) {
            tile.style.borderTop = '2px solid #6366f1';
            const dropIndex = parseInt(tile.getAttribute('data-cfg-idx'));
            const well = getCurrentWell();
            if (well && draggedCfgIndex !== dropIndex) {
                const draggedItem = well.config.splice(draggedCfgIndex, 1)[0];
                well.config.splice(dropIndex, 0, draggedItem);
                draggedCfgIndex = dropIndex;
                window.requestAnimationFrame(() => renderWellDiagram());
            }
        }
    } else if (window.currentDraggedPlaceholderId) {
        if (tile) {
            const dropIndex = parseInt(tile.getAttribute('data-cfg-idx'));
            const well = getCurrentWell();
            if (well) {
                // Find existing placeholder index
                const plIdx = well.config.findIndex(c => c.isPlaceholder);

                if (plIdx !== dropIndex) {
                    const p = studnieProducts.find(x => x.id === window.currentDraggedPlaceholderId);
                    if (p) {
                        // Remove old placeholder
                        if (plIdx > -1) well.config.splice(plIdx, 1);

                        // Because splicing might shift indices, find new effective drop index
                        let targetIdx = dropIndex;
                        if (plIdx > -1 && plIdx < dropIndex) targetIdx -= 1; // It shifted down

                        well.config.splice(targetIdx, 0, {
                            productId: window.currentDraggedPlaceholderId,
                            quantity: 1,
                            height: p.height || 0,
                            isPlaceholder: true
                        });

                        window.requestAnimationFrame(() => {
                            renderWellConfig();
                            renderWellDiagram();
                        });
                    }
                }
            }
        }
    }
};

window.handleCfgDragLeave = function (e) {
    const tile = e.target.closest('.config-tile');
    if (tile && draggedCfgIndex !== null) {
        tile.style.borderTop = '';
    }
};

window.handleCfgDrop = function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (isWellLocked()) { showToast(WELL_LOCKED_MSG, 'error'); return; }
    const tile = e.target.closest('.config-tile');

    if (tile) {
        const dropIndex = parseInt(tile.getAttribute('data-cfg-idx'));
        const well = getCurrentWell();
        if (!well) return;

        if (draggedCfgIndex !== null) {
            tile.style.borderTop = '';

            well.config.forEach(c => c.isPlaceholder = false);

            well.autoLocked = true;
            updateAutoLockUI();
            well.configSource = 'MANUAL';

            renderWellConfig();
            renderWellDiagram();
            updateSummary();
        } else if (window.currentDraggedPlaceholderId) {
            tile.style.borderTop = '';
            well.config = well.config.filter(c => !c.isPlaceholder);

            const addedProductId = window.currentDraggedPlaceholderId;
            well.config.splice(dropIndex, 0, { productId: addedProductId, quantity: 1 });
            window.currentDraggedPlaceholderId = null;

            well.autoLocked = true;
            updateAutoLockUI();
            well.configSource = 'MANUAL';

            syncGaskets(well);

            renderWellConfig();
            renderWellDiagram();
            updateSummary();
        }
    }
};

window.handleCfgDragEnd = function (e) {
    e.currentTarget.style.opacity = '1';
    document.querySelectorAll('.config-tile').forEach(t => t.style.borderTop = '');
    draggedCfgIndex = null;

    const well = getCurrentWell();
    if (well) {
        well.config.forEach(c => c.isPlaceholder = false);
        window.requestAnimationFrame(() => {
            renderWellConfig();
            renderWellDiagram();
        });
    }
};



/* ===== SORT WELL CONFIG by well-physical order (top → bottom) ===== */
function sortWellConfigByOrder() {
    const well = getCurrentWell();
    if (!well) return;
    const typeOrder = {
        wlaz: 0,
        avr: 1,
        plyta_din: 2, plyta_najazdowa: 2, plyta_zamykajaca: 2,
        konus: 2,
        pierscien_odciazajacy: 3,
        plyta_redukcyjna: 4,
        krag: 5, krag_ot: 5,
        dennica: 6,
        kineta: 7
    };
    well.config.sort((a, b) => {
        const pa = studnieProducts.find(p => p.id === a.productId);
        const pb = studnieProducts.find(p => p.id === b.productId);
        const oa = pa ? (typeOrder[pa.componentType] ?? 99) : 99;
        const ob = pb ? (typeOrder[pb.componentType] ?? 99) : 99;
        if (oa !== ob) return oa - ob;

        // Items of the same type keep their relative structural order. 
        // Previously kręgi were forced sorted by height, which scrambled krag_ot positions.
        return 0;
    });
}

function renderWellPrzejscia() {
    const container = document.getElementById('well-przejscia-tiles');
    const countEl = document.getElementById('przejscia-count');
    const well = getCurrentWell();

    if (!window.activateQuickEdit) {
        window.activateQuickEdit = function (element, index, field) {
            if (element.querySelector('input')) return; // Aboard if already in edit mode
            const well = getCurrentWell();
            if (!well || !well.przejscia || !well.przejscia[index]) return;

            let val, step;
            if (field === 'angle') { val = well.przejscia[index].angle; step = '1'; }
            else if (field === 'spadekKineta') { val = well.przejscia[index].spadekKineta || ''; step = '0.1'; }
            else if (field === 'spadekMufa') { val = well.przejscia[index].spadekMufa || ''; step = '0.1'; }
            else if (field === 'heightMm') { val = ''; step = '1'; }
            else { val = well.przejscia[index].rzednaWlaczenia || ''; step = '0.01'; }
            const w = element.offsetWidth;

            element.innerHTML = `<input type="number" step="${step}" placeholder="${val}" style="width:${Math.max(70, w + 10)}px; background:#0f172a; color:#fff; border:1px solid #3b82f6; border-radius:4px; font-size:1.15rem; font-weight:800; text-align:center; padding:0; outline:none; box-shadow:0 0 5px rgba(59,130,246,0.5);" value="" onblur="window.saveQuickEdit(${index}, '${field}', this.value)" onkeydown="if(event.key==='Enter') this.blur();">`;
            const inp = element.querySelector('input');
            inp.focus();
        };

        window.saveQuickEdit = function (index, field, value) {
            const well = getCurrentWell();
            if (!well || !well.przejscia || !well.przejscia[index]) return;

            if (value.trim() === '') {
                renderWellPrzejscia();
                return; // Revert to old value if nothing was typed
            }

            let numVal = parseFloat(value);

            if (field === 'angle') {
                if (isNaN(numVal)) numVal = 0;
                if (numVal < 0) numVal = 0;
                if (numVal > 360) numVal = 360;
                well.przejscia[index].angle = numVal;
                well.przejscia[index].angleExecution = (numVal === 0 || numVal === 360) ? 0 : (360 - numVal);
                well.przejscia[index].angleGony = (numVal * 400 / 360).toFixed(2);
            } else if (field === 'rzednaWlaczenia') {
                if (isNaN(numVal)) {
                    well.przejscia[index].rzednaWlaczenia = '';
                } else {
                    const rzWlazu = parseFloat(well.rzednaWlazu);
                    const rzDna = parseFloat(well.rzednaDna);

                    if (!isNaN(rzDna) && numVal < rzDna) {
                        showToast('Rzędna nie może być niższa niż rzędna dna!', 'error');
                        numVal = rzDna;
                    }
                    if (!isNaN(rzWlazu) && numVal > rzWlazu) {
                        showToast('Rzędna nie może być wyższa niż rzędna włazu!', 'error');
                        numVal = rzWlazu;
                    }
                    well.przejscia[index].rzednaWlaczenia = parseFloat(numVal).toFixed(2);
                }
            } else if (field === 'spadekKineta') {
                well.przejscia[index].spadekKineta = isNaN(numVal) ? null : parseFloat(numVal).toFixed(1);
            } else if (field === 'spadekMufa') {
                well.przejscia[index].spadekMufa = isNaN(numVal) ? null : parseFloat(numVal).toFixed(1);
            } else if (field === 'heightMm') {
                // Compute element bottom ordinate and derive new rzedna
                const rzDnaQ = parseFloat(well.rzednaDna) || 0;
                const cfgMap = [];
                let cY = 0, dpc = 0;
                for (let j = well.config.length - 1; j >= 0; j--) {
                    const ci = well.config[j];
                    const pr = studnieProducts.find(p => p.id === ci.productId);
                    if (!pr) continue;
                    let hh = 0;
                    if (pr.componentType === 'dennica') {
                        for (let q = 0; q < ci.quantity; q++) { dpc++; hh += (pr.height || 0) - (dpc > 1 ? 100 : 0); }
                    } else { hh = (pr.height || 0) * ci.quantity; }
                    cfgMap.push({ index: j, start: cY, end: cY + hh });
                    cY += hh;
                }
                let curRz = parseFloat(well.przejscia[index].rzednaWlaczenia);
                if (isNaN(curRz)) curRz = rzDnaQ;
                const curMm = (curRz - rzDnaQ) * 1000;
                let elStart = 0;
                for (let cm of cfgMap) {
                    if (curMm >= cm.start && curMm < cm.end) { elStart = cm.start; break; }
                }
                if (isNaN(numVal)) numVal = 0;
                if (numVal < 0) numVal = 0;
                const newRzedna = rzDnaQ + (elStart + numVal) / 1000;
                well.przejscia[index].rzednaWlaczenia = parseFloat(newRzedna).toFixed(2);
            }

            renderWellPrzejscia();
            renderWellDiagram();
            updateSummary();
        };
    }

    if (!container) return;

    if (!well || !well.przejscia || well.przejscia.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:1.2rem; color:var(--text-muted); font-size:0.75rem; border:1px dashed rgba(255,255,255,0.08); border-radius:8px;">Brak zdefiniowanych przejść.<br>Dodaj przejście z formularza powyżej.</div>';
        if (countEl) countEl.textContent = '';
        return;
    }

    const typeBadge = {
        wlaz: { bg: '#374151' },
        plyta_din: { bg: '#1e3a5f' },
        plyta_najazdowa: { bg: '#1e3a5f' },
        plyta_zamykajaca: { bg: '#1e3a5f' },
        pierscien_odciazajacy: { bg: '#1e3a5f' },
        konus: { bg: '#7c3aed30' },
        avr: { bg: '#44403c' },
        plyta_redukcyjna: { bg: '#6d28d920' },
        krag: { bg: '#164e63' },
        krag_ot: { bg: '#312e81' },
        dennica: { bg: '#14532d' },
        kineta: { bg: '#9d174d' }
    };

    const rzDna = parseFloat(well.rzednaDna) || 0;
    const configMap = [];
    let currY = 0;
    let dennicaProcessedCount = 0;
    for (let j = well.config.length - 1; j >= 0; j--) {
        const cItem = well.config[j];
        const p = studnieProducts.find(pr => pr.id === cItem.productId);
        if (!p) continue;
        let h = 0;
        if (p.componentType === 'dennica') {
            for (let q = 0; q < cItem.quantity; q++) {
                dennicaProcessedCount++;
                h += (p.height || 0) - (dennicaProcessedCount > 1 ? 100 : 0);
            }
        } else {
            h = (p.height || 0) * cItem.quantity;
        }
        const badge = typeBadge[p.componentType] || { bg: '#333333' };
        configMap.push({ index: j, name: p.name, start: currY, end: currY + h, bg: badge.bg });
        currY += h;
    }

    // Auto-sort by element level (assignedIndex) and then by angle
    const sorted = well.przejscia.map((item) => {
        let pel = parseFloat(item.rzednaWlaczenia);
        if (isNaN(pel)) pel = rzDna;
        const mmFromBottom = (pel - rzDna) * 1000;
        let assignedIndex = -1;
        for (let cm of configMap) {
            if (mmFromBottom >= cm.start && mmFromBottom < cm.end) {
                assignedIndex = cm.index;
                break;
            }
        }
        if (assignedIndex === -1 && well.config.length > 0) {
            if (mmFromBottom < 0) {
                assignedIndex = configMap[0].index;
            } else {
                assignedIndex = configMap[configMap.length - 1].index;
            }
        }
        return { item, assignedIndex };
    }).sort((a, b) => {
        if (a.assignedIndex !== b.assignedIndex) {
            return b.assignedIndex - a.assignedIndex;
        }
        return (a.item.angle || 0) - (b.item.angle || 0);
    });

    // Rebuild przejscia array in sorted order
    well.przejscia = sorted.map(s => s.item);

    if (countEl) countEl.textContent = `(${well.przejscia.length})`;

    let totalPrice = 0;
    let html = '<div style="display:grid; grid-template-columns:1fr; gap:0.5rem;">';

    let prevAssignedIndex = -999;

    well.przejscia.forEach((item, index) => {
        let pel = parseFloat(item.rzednaWlaczenia);
        if (isNaN(pel)) pel = rzDna;
        const mmFromBottom = (pel - rzDna) * 1000;

        let assignedIndex = -1;
        let assignedName = "Brak dopasowania";
        let assignedBg = "rgba(0,0,0,0.25)";
        for (let cm of configMap) {
            if (mmFromBottom >= cm.start && mmFromBottom < cm.end) {
                assignedIndex = cm.index;
                assignedName = cm.name;
                assignedBg = cm.bg;
                break;
            }
        }
        if (assignedIndex === -1 && well.config.length > 0) {
            const tgt = (mmFromBottom < 0) ? configMap[0] : configMap[configMap.length - 1];
            assignedIndex = tgt.index;
            assignedName = tgt.name;
            assignedBg = tgt.bg;
        }

        if (assignedIndex !== prevAssignedIndex) {
            const rawRGB = assignedBg.length > 7 ? assignedBg.substring(0, 7) : assignedBg;
            if (index > 0) html += `<div style="height:0.5rem;"></div>`;
            html += `<div style="display:flex; align-items:center; gap:0.4rem; padding:0.3rem 0.5rem; margin-top:0.4rem; margin-bottom:0.4rem; background:linear-gradient(90deg, ${assignedBg} 0%, rgba(30,41,59,0.8) 100%); border-left:3px solid ${rawRGB}; border-radius:6px; color:var(--text-muted); font-size:0.65rem; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; box-shadow:0 1px 3px rgba(0,0,0,0.3);">
                <span style="font-size:0.9rem; filter:grayscale(0.4);">📍</span> 
                <span>Dotyczy:</span> 
                <span style="color:#e2e8f0; font-size:0.75rem; padding-left:0.2rem;">${assignedName}</span>
            </div>`;
            prevAssignedIndex = assignedIndex;
        }

        const p = studnieProducts.find(pr => pr.id === item.productId);
        const typeName = p ? p.category : 'Nieznane';
        const dn = p ? p.dn : '—';
        const price = p ? p.price : 0;
        totalPrice += price;

        const angleColor = item.angle === 0 ? '#6366f1' : '#818cf8';
        const isFirst = index === 0;
        const isLast = index === well.przejscia.length - 1;

        // Compute height from element bottom to transition
        let elementStartMm = 0;
        for (let cm of configMap) {
            if (mmFromBottom >= cm.start && mmFromBottom < cm.end) { elementStartMm = cm.start; break; }
        }
        const heightMm = Math.round(mmFromBottom - elementStartMm);

        // Edit mode for this tile
        if (editPrzejscieIdx === index) {
            const przejsciaProducts = studnieProducts.filter(pr => pr.componentType === 'przejscie');
            const allTypes = [...new Set(przejsciaProducts.map(pr => pr.category))].sort();

            // Sync fallback to what was currently rendering if state is empty
            if (!editPrzejscieState.type) {
                editPrzejscieState.type = typeName;
                editPrzejscieState.dnId = item.productId;
                editPrzejscieState.rzedna = item.rzednaWlaczenia || '';
                editPrzejscieState.angle = item.angle || 0;
                editPrzejscieState.notes = item.notes || '';
                editPrzejscieState.spadekKineta = item.spadekKineta || '';
                editPrzejscieState.spadekMufa = item.spadekMufa || '';
            }

            const currentTypeDNs = przejsciaProducts.filter(pr => pr.category === editPrzejscieState.type).sort((a, b) => a.dn - b.dn);
            const execAngle = (editPrzejscieState.angle === 0 || editPrzejscieState.angle === 360) ? 0 : (360 - editPrzejscieState.angle);
            const gons = (editPrzejscieState.angle * 400 / 360).toFixed(2);

            html += `<div style="background:linear-gradient(90deg, rgba(30,58,138,0.8) 0%, rgba(30,41,59,0.95) 100%); border:1px solid rgba(96,165,250,0.5); border-left:4px solid #3b82f6; border-radius:8px; padding:0.6rem; position:relative; box-shadow:0 4px 12px rgba(96,165,250,0.15); margin-bottom:0.3rem;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
                <div style="display:flex; align-items:center; gap:0.4rem;">
                  <div style="display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.2); padding:0.2rem 0.4rem; border-radius:4px;">
                    <span style="font-size:0.65rem; color:var(--text-primary); font-weight:700;">${index + 1}</span>
                  </div>
                  <span style="font-size:0.75rem; font-weight:700; color:#60a5fa;">Edycja wariantu</span>
                </div>
                <button onclick="cancelPrzejscieEdit()" title="Krzyżyk" style="background:none; border:none; cursor:pointer; font-size:0.8rem; color:var(--text-muted);">✕</button>
              </div>
              
              <div style="font-size:0.55rem; color:var(--text-muted); margin-bottom:0.2rem;">Kategoria przejścia</div>
              <div style="display:flex; flex-wrap:wrap; gap:0.25rem; margin-bottom:0.5rem; max-height:80px; overflow-y:auto; scrollbar-width:thin;">
                ${allTypes.map(t => {
                const isActive = t === editPrzejscieState.type;
                return `<div onclick="window.editInlineSetType('${t}')" style="padding:0.25rem 0.45rem; font-size:0.65rem; font-weight:600; border-radius:4px; cursor:pointer; background:${isActive ? 'rgba(96,165,250,0.2)' : 'rgba(255,255,255,0.03)'}; border:1px solid ${isActive ? 'rgba(96,165,250,0.6)' : 'rgba(255,255,255,0.08)'}; color:${isActive ? '#93c5fd' : 'var(--text-primary)'}; transition:all 0.15s;">${t}</div>`;
            }).join('')}
              </div>

              <div style="font-size:0.55rem; color:var(--text-muted); margin-bottom:0.2rem;">Średnica (DN)</div>
              <div style="display:flex; flex-wrap:wrap; gap:0.25rem; margin-bottom:0.6rem;">
                ${currentTypeDNs.map(pr => {
                const isActive = pr.id === editPrzejscieState.dnId;
                const dnLbl = (typeof pr.dn === 'string' && pr.dn.includes('/')) ? pr.dn : 'DN' + pr.dn;
                return `<div onclick="window.editInlineSetDN('${pr.id}')" style="padding:0.25rem 0.45rem; font-size:0.65rem; font-weight:700; border-radius:4px; cursor:pointer; background:${isActive ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.03)'}; border:1px solid ${isActive ? 'rgba(34,197,94,0.6)' : 'rgba(255,255,255,0.08)'}; color:${isActive ? '#4ade80' : 'var(--text-primary)'}; transition:all 0.15s;">${dnLbl}</div>`;
            }).join('')}
              </div>

              <div style="display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:0.5rem; margin-bottom:0.5rem;">
                <div>
                  <label style="font-size:0.55rem; color:var(--text-muted); display:block; margin-bottom:0.15rem;">Rzędna [m]</label>
                  <input type="number" class="form-input" id="edit-rzedna-${index}" step="0.01" value="${editPrzejscieState.rzedna}" placeholder="142.50" style="padding:0.35rem; font-size:0.75rem; text-align:center;" onchange="window.syncEditState()">
                </div>
                <div>
                  <label style="font-size:0.55rem; color:var(--text-muted); display:block; margin-bottom:0.15rem;">Kąt [°]</label>
                  <input type="number" class="form-input" id="edit-angle-${index}" value="${editPrzejscieState.angle}" min="0" max="360" oninput="editUpdateAngles(${index}); window.syncEditState()" style="padding:0.35rem; font-size:0.75rem; color:#818cf8; font-weight:800; text-align:center;">
                </div>
                <div>
                  <label style="font-size:0.55rem; color:var(--text-muted); display:block; margin-bottom:0.15rem;">Spadek w kinecie [%]</label>
                  <input type="number" class="form-input" id="edit-spadek-kineta-${index}" step="0.1" value="${editPrzejscieState.spadekKineta}" style="padding:0.35rem; font-size:0.75rem; text-align:center;" onchange="window.syncEditState()">
                </div>
                <div>
                  <label style="font-size:0.55rem; color:var(--text-muted); display:block; margin-bottom:0.15rem;">Spadek w mufie [%]</label>
                  <input type="number" class="form-input" id="edit-spadek-mufa-${index}" step="0.1" value="${editPrzejscieState.spadekMufa}" style="padding:0.35rem; font-size:0.75rem; text-align:center;" onchange="window.syncEditState()">
                </div>
              </div>
              
              <div style="margin-bottom:0.5rem;">
                  <label style="font-size:0.55rem; color:var(--text-muted); display:block; margin-bottom:0.15rem;">Uwagi dodatkowe</label>
                  <input type="text" class="form-input" id="edit-notes-${index}" value="${editPrzejscieState.notes}" placeholder="np. Wlot A, PVC" style="padding:0.3rem 0.4rem; font-size:0.7rem;" onchange="window.syncEditState()">
              </div>

              <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.6rem; padding-top:0.4rem; border-top:1px solid rgba(255,255,255,0.05);">
                <div style="display:flex; gap:0.8rem; font-size:0.65rem;">
                  <span style="color:var(--text-muted);">Wyk: <strong id="edit-exec-${index}" style="color:var(--text-primary);">${execAngle}°</strong></span>
                  <span style="color:var(--text-muted);">Gony: <strong id="edit-gony-${index}" style="color:var(--success);">${gons}<sup>g</sup></strong></span>
                </div>
                <div style="display:flex; gap:0.4rem;">
                  <button onclick="cancelPrzejscieEdit()" style="padding:0.3rem 0.6rem; font-size:0.7rem; border-radius:5px; border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.05); color:var(--text-primary); cursor:pointer;">Anuluj</button>
                  <button onclick="savePrzejscieEdit(${index})" class="btn btn-primary" style="padding:0.3rem 0.6rem; font-size:0.7rem;">💾 Zapisz</button>
                </div>
              </div>
            </div>`;
            return;
        }

        if (!item.flowType) {
            item.flowType = (index === 0 && item.angle === 0) ? 'wylot' : 'wlot';
        }
        const flowLabel = item.flowType === 'wylot' ? 'Wylot' : 'Wlot';
        const flowBg = item.flowType === 'wylot' ? 'rgba(239,68,68,0.2)' : 'rgba(59,130,246,0.2)';
        const flowColor = item.flowType === 'wylot' ? '#fca5a5' : '#93c5fd';
        const flowBorder = item.flowType === 'wylot' ? 'rgba(239,68,68,0.6)' : 'rgba(59,130,246,0.6)';
        const flowIcon = item.flowType === 'wylot' ? '📤' : '📥';

        html += `<div data-prz-idx="${index}" draggable="true" ondragstart="handlePrzDragStart(event)" ondragover="handlePrzDragOver(event)" ondrop="handlePrzDrop(event)" ondragend="handlePrzDragEnd(event)" 
                      style="background:linear-gradient(90deg, rgba(30,58,138,0.3) 0%, rgba(30,41,59,0.8) 100%); border:1px solid rgba(255,255,255,0.05); border-left:5px solid ${flowBorder}; border-radius:10px; padding:0.45rem; position:relative; transition:all 0.2s ease; margin-bottom:0.4rem; display:flex; align-items:center; gap:0.5rem; cursor:grab;"
                      onmouseenter="this.style.filter='brightness(1.1)'; window.highlightSvg('prz', ${index}); window.highlightSvg('cfg', ${assignedIndex});" onmouseleave="this.style.filter='brightness(1)'; window.unhighlightSvg('prz', ${index}); window.unhighlightSvg('cfg', ${assignedIndex});">
          
          <!-- FLOW TYPE BUTTON -->
          <button onclick="openFlowTypePopup(${index})" title="Kliknij by zmienić na Wlot/Wylot" style="background:${flowBg}; color:${flowColor}; border:1px solid ${flowBorder}; border-radius:8px; padding:0.3rem 0.5rem; display:flex; flex-direction:column; align-items:center; cursor:pointer; min-width:55px; transition:all 0.2s;">
            <span style="font-size:1.1rem; margin-bottom:0.1rem;">${flowIcon}</span>
            <span style="font-size:0.6rem; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">${flowLabel}</span>
          </button>

          <!-- DETAILS -->
          <div style="flex:1; display:flex; justify-content:space-between; align-items:center; gap:1rem;">
            
            <div style="display:flex; flex-direction:column; gap:0.15rem;">
               <div style="display:flex; align-items:center; gap:0.6rem;">
                 <span style="font-size:1.0rem; font-weight:800; color:var(--text-primary); text-shadow:0 1px 2px rgba(0,0,0,0.5);">${typeName}</span>
                 <span style="font-size:1.0rem; color:#a78bfa; font-weight:800;">${typeof dn === 'string' && dn.includes('/') ? dn : 'DN ' + dn}</span>
               </div>
               ${item.notes ? `<div style="font-size:0.65rem; color:#94a3b8; font-style:italic; margin-top:2px;">📝 ${item.notes}</div>` : ''}
            </div>

            <div style="display:flex; align-items:center; gap:1.5rem; margin-right: 0.5rem;">
              <div style="text-align:center; min-width:60px;">
                <div style="font-size:0.6rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.1rem; letter-spacing:0.5px;">Spadek w kinecie</div>
                <div onclick="window.activateQuickEdit(this, ${index}, 'spadekKineta')" title="Kliknij aby edytować" style="font-size:0.9rem; font-weight:700; color:var(--text-primary); text-shadow:0 1px 2px rgba(0,0,0,0.3); cursor:pointer; padding:0 0.3rem; transition:color 0.2s; display:inline-block;" onmouseenter="this.style.color='#60a5fa'" onmouseleave="this.style.color='var(--text-primary)'">${item.spadekKineta != null && item.spadekKineta !== '' ? item.spadekKineta + '%' : '—'}</div>
              </div>
              <div style="text-align:center; min-width:60px;">
                <div style="font-size:0.6rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.1rem; letter-spacing:0.5px;">Spadek w mufie</div>
                <div onclick="window.activateQuickEdit(this, ${index}, 'spadekMufa')" title="Kliknij aby edytować" style="font-size:0.9rem; font-weight:700; color:var(--text-primary); text-shadow:0 1px 2px rgba(0,0,0,0.3); cursor:pointer; padding:0 0.3rem; transition:color 0.2s; display:inline-block;" onmouseenter="this.style.color='#60a5fa'" onmouseleave="this.style.color='var(--text-primary)'">${item.spadekMufa != null && item.spadekMufa !== '' ? item.spadekMufa + '%' : '—'}</div>
              </div>
              <div style="text-align:center; min-width:80px; position:relative; padding-bottom:0.1rem;">
                <div style="font-size:0.6rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.1rem; letter-spacing:0.5px;">Kąt</div>
                <div onclick="window.activateQuickEdit(this, ${index}, 'angle')" title="Kliknij aby edytować wpisując liczbę" style="font-size:1.05rem; font-weight:800; color:${angleColor}; text-shadow:0 1px 2px rgba(0,0,0,0.3); cursor:pointer; padding:0 0.5rem; transition:transform 0.2s; display:inline-block;" onmouseenter="this.style.transform='scale(1.15)'" onmouseleave="this.style.transform='scale(1)'">${item.angle}°</div>
              </div>
              <div style="text-align:center; min-width:70px;">
                <div style="font-size:0.6rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.1rem; letter-spacing:0.5px;">Wysokość [mm]</div>
                <div onclick="window.activateQuickEdit(this, ${index}, 'heightMm')" title="Wysokość od dolnej krawędzi elementu" style="font-size:1.05rem; font-weight:800; color:#f59e0b; text-shadow:0 1px 2px rgba(0,0,0,0.3); cursor:pointer; padding:0 0.3rem; transition:color 0.2s; display:inline-block;" onmouseenter="this.style.color='#fbbf24'" onmouseleave="this.style.color='#f59e0b'">${heightMm} mm</div>
              </div>
              <div style="text-align:center; min-width:65px;">
                <div style="font-size:0.6rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.1rem; letter-spacing:0.5px;">Kąt wykonania</div>
                <div style="font-size:1.0rem; font-weight:700; color:#38bdf8;" title="360° - kąt">${(item.angle === 0 || item.angle === 360) ? '0' : (360 - item.angle)}°</div>
              </div>
              <div style="text-align:center; min-width:60px;">
                <div style="font-size:0.6rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.1rem; letter-spacing:0.5px;">Kąt gony</div>
                <div style="font-size:1.0rem; font-weight:700; color:#2dd4bf;" title="Kąt wykonania w gonach">${((item.angle === 0 || item.angle === 360) ? 0 : ((360 - item.angle) * 400 / 360)).toFixed(2)}g</div>
              </div>
              <div style="text-align:center; min-width:80px;">
                <div style="font-size:0.6rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.1rem; letter-spacing:0.5px;">Rzędna</div>
                <div onclick="window.activateQuickEdit(this, ${index}, 'rzednaWlaczenia')" title="Kliknij aby edytować wpisując liczbę" style="font-size:1.05rem; font-weight:800; color:var(--text-primary); text-shadow:0 1px 2px rgba(0,0,0,0.3); cursor:pointer; padding:0 0.5rem; transition:color 0.2s; display:inline-block;" onmouseenter="this.style.color='#60a5fa'" onmouseleave="this.style.color='var(--text-primary)'">${item.rzednaWlaczenia || '—'}</div>
              </div>
              <div style="text-align:right; min-width:70px;">
                <div style="font-size:0.6rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.1rem; letter-spacing:0.5px;">Cena</div>
                <div style="font-size:0.95rem; font-weight:800; color:var(--success);">${fmtInt(price)} <span style="font-size:0.7rem;">PLN</span></div>
              </div>
            </div>

          </div>

          <!-- ACTIONS -->
          <div style="display:flex; align-items:center; gap:0.25rem; padding-left:0.5rem; border-left:1px dashed rgba(255,255,255,0.1);">
            <button onclick="editPrzejscie(${index})" title="Edytuj" style="background:rgba(96,165,250,0.15); border:1px solid rgba(96,165,250,0.3); border-radius:8px; cursor:pointer; font-size:0.9rem; padding:0.35rem; color:#60a5fa; transition:all 0.2s;" onmouseenter="this.style.background='rgba(96,165,250,0.3)'" onmouseleave="this.style.background='rgba(96,165,250,0.15)'">✏️</button>
            <button onclick="removePrzejscieFromWell(${index})" title="Usuń" style="background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.3); border-radius:8px; cursor:pointer; font-size:0.9rem; padding:0.35rem; color:#ef4444; transition:all 0.2s;" onmouseenter="this.style.background='rgba(239,68,68,0.3)'" onmouseleave="this.style.background='rgba(239,68,68,0.15)'">✕</button>
          </div>
        </div>`;
    });

    html += '</div>';

    // Summary bar
    html += `<div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.6rem; padding:0.4rem 0.6rem; background:rgba(99,102,241,0.08); border-radius:6px; border:1px solid rgba(99,102,241,0.2);">
      <span style="font-size:0.7rem; color:var(--text-muted); font-weight:600;">Suma wszystkich przejść (${well.przejscia.length} szt.)</span>
      <span style="font-size:0.85rem; font-weight:800; color:var(--success);">${fmtInt(totalPrice)} PLN</span>
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

/* ===== DRAG & DROP FOR PRZEJŚCIA ===== */
let draggedPrzIndex = null;

window.handlePrzDragStart = function (e) {
    draggedPrzIndex = parseInt(e.currentTarget.getAttribute('data-prz-idx'));
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.style.opacity = '0.4';
};

window.handlePrzDragOver = function (e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const tile = e.target.closest('[data-prz-idx]');
    if (tile) {
        tile.style.borderTop = '2px solid #3b82f6';
    }
};

window.handlePrzDrop = function (e) {
    e.preventDefault();
    e.stopPropagation();
    const tile = e.target.closest('[data-prz-idx]');
    if (tile && draggedPrzIndex !== null) {
        tile.style.borderTop = '';
        const dropIndex = parseInt(tile.getAttribute('data-prz-idx'));
        if (draggedPrzIndex === dropIndex) return;

        const well = getCurrentWell();
        if (!well) return;

        // Extract the dragged item
        const draggedItem = well.przejscia.splice(draggedPrzIndex, 1)[0];

        // Insert at the new position
        well.przejscia.splice(dropIndex, 0, draggedItem);

        renderWellPrzejscia();
        updateSummary();
    }
};

window.handlePrzDragEnd = function (e) {
    e.currentTarget.style.opacity = '1';
    document.querySelectorAll('[data-prz-idx]').forEach(t => t.style.borderTop = '');
    draggedPrzIndex = null;
}

function syncEditState() {
    if (editPrzejscieIdx < 0) return;
    const rzednaEl = document.getElementById('edit-rzedna-' + editPrzejscieIdx);
    const angleEl = document.getElementById('edit-angle-' + editPrzejscieIdx);
    const notesEl = document.getElementById('edit-notes-' + editPrzejscieIdx);
    if (rzednaEl) editPrzejscieState.rzedna = rzednaEl.value;
    if (angleEl) editPrzejscieState.angle = parseFloat(angleEl.value) || 0;
    if (notesEl) editPrzejscieState.notes = notesEl.value;
    const spKEl = document.getElementById('edit-spadek-kineta-' + editPrzejscieIdx);
    const spMEl = document.getElementById('edit-spadek-mufa-' + editPrzejscieIdx);
    if (spKEl) editPrzejscieState.spadekKineta = spKEl.value;
    if (spMEl) editPrzejscieState.spadekMufa = spMEl.value;
}

window.editInlineSetType = function (type) {
    syncEditState();
    editPrzejscieState.type = type;
    const przejsciaProducts = studnieProducts.filter(pr => pr.componentType === 'przejscie');
    const dns = przejsciaProducts.filter(p => p.category === type).sort((a, b) => a.dn - b.dn);
    if (dns.length > 0) editPrzejscieState.dnId = dns[0].id;
    else editPrzejscieState.dnId = null;
    renderWellPrzejscia();
};

window.editInlineSetDN = function (dnId) {
    syncEditState();
    editPrzejscieState.dnId = dnId;
    renderWellPrzejscia();
};

function editPrzejscie(index) {
    const well = getCurrentWell();
    if (!well || !well.przejscia || !well.przejscia[index]) return;
    const item = well.przejscia[index];
    const p = studnieProducts.find(pr => pr.id === item.productId);

    editPrzejscieIdx = index;
    editPrzejscieState = {
        type: p ? p.category : null,
        dnId: item.productId,
        rzedna: item.rzednaWlaczenia,
        angle: item.angle,
        notes: item.notes || '',
        spadekKineta: item.spadekKineta || '',
        spadekMufa: item.spadekMufa || ''
    };
    renderWellPrzejscia();
}

let editPrzejscieIdx = -1;
let editPrzejscieState = { type: null, dnId: null, rzedna: '', angle: 0, notes: '', spadekKineta: '', spadekMufa: '' };

function savePrzejscieEdit(index) {
    if (isOfferLocked()) { showToast(OFFER_LOCKED_MSG, 'error'); return; }
    if (isWellLocked()) { showToast(WELL_LOCKED_MSG, 'error'); return; }
    const well = getCurrentWell();
    if (!well || !well.przejscia || !well.przejscia[index]) return;

    syncEditState(); // save values from DOM to state just in case

    if (!editPrzejscieState.dnId) {
        showToast('Wybierz typ i średnicę przejścia', 'error');
        return;
    }

    const newProductId = editPrzejscieState.dnId;
    const rzedna = editPrzejscieState.rzedna;
    const angle = editPrzejscieState.angle || 0;
    const notes = editPrzejscieState.notes.trim();
    const spadekKineta = editPrzejscieState.spadekKineta;
    const spadekMufa = editPrzejscieState.spadekMufa;

    const exec = (angle === 0 || angle === 360) ? 0 : (360 - angle);
    const gons = (angle * 400 / 360).toFixed(2);

    well.przejscia[index] = {
        productId: newProductId,
        rzednaWlaczenia: rzedna ? parseFloat(rzedna).toFixed(2) : null,
        angle: angle,
        angleExecution: exec,
        angleGony: gons,
        notes: notes,
        spadekKineta: spadekKineta ? parseFloat(spadekKineta).toFixed(1) : null,
        spadekMufa: spadekMufa ? parseFloat(spadekMufa).toFixed(1) : null
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

    // Status server ping
    checkBackendStatus();

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
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr 1fr 1fr; gap:0.3rem; align-items:end;">
                <div>
                    <label style="font-size:0.55rem; color:var(--text-muted); display:block; margin-bottom:0.1rem;">Rzędna wlaczenia [m]</label>
                    <input type="number" class="form-input" id="inl-rzedna" step="0.01" placeholder="142.50" style="padding:0.3rem 0.4rem; font-size:0.7rem;">
                </div>
                <div>
                    <label style="font-size:0.55rem; color:var(--text-muted); display:block; margin-bottom:0.1rem;">Kąt [°]</label>
                    <input type="number" class="form-input" id="inl-angle" value="0" min="0" max="360" oninput="window.inlineUpdateAngles()" style="padding:0.3rem 0.4rem; font-size:0.7rem; color:#818cf8; font-weight:700;">
                </div>
                <div>
                    <label style="font-size:0.55rem; color:var(--text-muted); display:block; margin-bottom:0.1rem;">Spadek w kinecie [%]</label>
                    <input type="number" class="form-input" id="inl-spadek-kineta" step="0.1" placeholder="np. 0.5" style="padding:0.3rem 0.4rem; font-size:0.7rem;">
                </div>
                <div>
                    <label style="font-size:0.55rem; color:var(--text-muted); display:block; margin-bottom:0.1rem;">Spadek w mufie [%]</label>
                    <input type="number" class="form-input" id="inl-spadek-mufa" step="0.1" placeholder="np. 1.0" style="padding:0.3rem 0.4rem; font-size:0.7rem;">
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
    const spadekKineta = document.getElementById('inl-spadek-kineta').value.trim();
    const spadekMufa = document.getElementById('inl-spadek-mufa').value.trim();

    const exec = (angle === 0 || angle === 360) ? 0 : (360 - angle);
    const gons = (angle * 400 / 360).toFixed(2);

    const well = getCurrentWell();
    if (!well) { showToast('Najpierw dodaj studnię', 'error'); return; }
    if (!well.przejscia) well.przejscia = [];

    const isFirst = well.przejscia ? well.przejscia.length === 0 : true;
    const flowType = (isFirst && angle === 0) ? 'wylot' : 'wlot';

    well.przejscia.push({
        productId: id,
        rzednaWlaczenia: rzedna ? parseFloat(rzedna).toFixed(2) : null,
        angle: angle,
        angleExecution: exec,
        angleGony: gons,
        notes: notes,
        flowType: flowType,
        spadekKineta: spadekKineta ? parseFloat(spadekKineta).toFixed(1) : null,
        spadekMufa: spadekMufa ? parseFloat(spadekMufa).toFixed(1) : null
    });

    inlinePrzejsciaState.dnId = null;
    refreshAll();
    autoSelectComponents(true);
    showToast('Dodano przejście szczelne', 'success');
    renderInlinePrzejsciaApp();
};

window.openFlowTypePopup = function (index) {
    const well = getCurrentWell();
    if (!well || !well.przejscia || !well.przejscia[index]) return;

    let modal = document.getElementById('flow-type-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'flow-type-modal';
        modal.innerHTML = `
        <div style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); backdrop-filter:blur(3px); z-index:9999; display:flex; align-items:center; justify-content:center;" onclick="document.getElementById('flow-type-modal').style.display='none'">
           <div style="background:#1e293b; padding:1.5rem; border-radius:12px; border:1px solid #334155; width:300px; text-align:center; box-shadow:0 10px 25px rgba(0,0,0,0.5);" onclick="event.stopPropagation()">
               <h3 style="margin-bottom:1rem; color:#fff; font-size:1.1rem; font-weight:700;">Wybierz typ przepływu</h3>
               <div style="display:flex; gap:1rem; justify-content:center;">
                  <button id="flow-wlot-btn" style="flex:1; background:rgba(59,130,246,0.2); color:#93c5fd; border:2px solid rgba(59,130,246,0.6); padding:1.2rem; border-radius:10px; cursor:pointer; font-weight:800; font-size:1.1rem; display:flex; flex-direction:column; align-items:center; gap:0.4rem; transition:all 0.2s;" onmouseenter="this.style.background='rgba(59,130,246,0.4)'" onmouseleave="this.style.background='rgba(59,130,246,0.2)'">
                     <span style="font-size:2.5rem;">📥</span>WLOT
                  </button>
                  <button id="flow-wylot-btn" style="flex:1; background:rgba(239,68,68,0.2); color:#fca5a5; border:2px solid rgba(239,68,68,0.6); padding:1.2rem; border-radius:10px; cursor:pointer; font-weight:800; font-size:1.1rem; display:flex; flex-direction:column; align-items:center; gap:0.4rem; transition:all 0.2s;" onmouseenter="this.style.background='rgba(239,68,68,0.4)'" onmouseleave="this.style.background='rgba(239,68,68,0.2)'">
                     <span style="font-size:2.5rem;">📤</span>WYLOT
                  </button>
               </div>
               <button style="margin-top:1.5rem; padding:0.5rem 1rem; border-radius:6px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:var(--text-muted); cursor:pointer;" onclick="document.getElementById('flow-type-modal').style.display='none'">Anuluj</button>
           </div>
        </div>
        `;
        document.body.appendChild(modal);
    }

    document.getElementById('flow-type-modal').style.display = 'flex';

    document.getElementById('flow-wlot-btn').onclick = () => {
        well.przejscia[index].flowType = 'wlot';
        document.getElementById('flow-type-modal').style.display = 'none';
        renderWellPrzejscia();
    };

    document.getElementById('flow-wylot-btn').onclick = () => {
        well.przejscia[index].flowType = 'wylot';
        document.getElementById('flow-type-modal').style.display = 'none';
        renderWellPrzejscia();
    };
};

function removePrzejscieFromWell(index) {
    if (isOfferLocked()) { showToast(OFFER_LOCKED_MSG, 'error'); return; }
    if (isWellLocked()) { showToast(WELL_LOCKED_MSG, 'error'); return; }
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

        const wsHeight = document.getElementById('ws-height');
        const wsReq = document.getElementById('ws-req-height');
        const wsDiff = document.getElementById('ws-diff-height');
        const wsPrice = document.getElementById('ws-price');
        if (wsHeight) wsHeight.textContent = '0 mm';
        if (wsReq) wsReq.textContent = '—';
        if (wsDiff) { wsDiff.textContent = '—'; wsDiff.style.color = 'var(--text-muted)'; }
        if (wsPrice) wsPrice.textContent = '0';

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

    let reqMmText = '—';
    let diffMmText = '—';
    let diffColor = 'var(--text-muted)';

    const rzWlazu = parseFloat(well.rzednaWlazu);
    const rzDna = isNaN(parseFloat(well.rzednaDna)) ? (isNaN(rzWlazu) ? NaN : 0) : parseFloat(well.rzednaDna);

    if (!isNaN(rzWlazu) && !isNaN(rzDna) && rzWlazu > rzDna) {
        const reqMm = Math.round((rzWlazu - rzDna) * 1000);
        reqMmText = fmtInt(reqMm) + ' mm';
        const diff = reqMm - stats.height;

        if (diff > 0) {
            diffMmText = '-' + fmtInt(diff) + ' mm';
            diffColor = '#f87171'; // red
        } else if (diff < 0) {
            diffMmText = '+' + fmtInt(Math.abs(diff)) + ' mm';
            diffColor = '#facc15'; // yellow/orange
        } else {
            diffMmText = 'OK';
            diffColor = '#4ade80'; // green
        }
    }

    const wsHeight = document.getElementById('ws-height');
    const wsReq = document.getElementById('ws-req-height');
    const wsDiff = document.getElementById('ws-diff-height');
    const wsPrice = document.getElementById('ws-price');

    if (wsHeight) wsHeight.textContent = fmtInt(stats.height) + ' mm';
    if (wsReq) wsReq.textContent = reqMmText;
    if (wsDiff) {
        wsDiff.textContent = diffMmText;
        wsDiff.style.color = diffColor;
    }
    if (wsPrice) wsPrice.textContent = fmtInt(stats.price);

    // Height indicator
    updateHeightIndicator();
}

/* ===== SVG HIGHLIGHTING ===== */
window.highlightSvg = function (type, index) {
    document.querySelectorAll('.svg-' + type + '-' + index).forEach(el => {
        el.style.filter = 'drop-shadow(0px 0px 8px rgba(96, 165, 250, 0.9)) brightness(1.3)';
    });

    // Auto-highlight corresponding list tile
    if (type === 'cfg') {
        const tile = document.querySelector('.config-tile[data-cfg-idx="' + index + '"]');
        if (tile) tile.style.filter = 'brightness(1.1)';
    } else if (type === 'prz') {
        const tile = document.querySelector('div[data-prz-idx="' + index + '"]');
        if (tile) tile.style.filter = 'brightness(1.1)';
    }
};
window.unhighlightSvg = function (type, index) {
    document.querySelectorAll('.svg-' + type + '-' + index).forEach(el => {
        el.style.filter = '';
    });

    if (type === 'cfg') {
        const tile = document.querySelector('.config-tile[data-cfg-idx="' + index + '"]');
        if (tile) tile.style.filter = 'brightness(1)';
    } else if (type === 'prz') {
        const tile = document.querySelector('div[data-prz-idx="' + index + '"]');
        if (tile) tile.style.filter = 'brightness(1)';
    }
};

window.svgPointerEnter = function (ev, idx) {
    if (window.svgDragStartIndex >= 0) return; // blokowanie hovera w trkacie ciągnięcia
    window.highlightSvg('cfg', idx);
};

window.svgPointerLeave = function (ev, idx) {
    window.unhighlightSvg('cfg', idx);
};

window.svgPrzPointerEnter = function (ev, idx) {
    if (window.svgDragStartIndex >= 0) return;
    window.highlightSvg('prz', idx);
};

window.svgPrzPointerLeave = function (ev, idx) {
    window.unhighlightSvg('prz', idx);
};

/* ===== WELL DIAGRAM (SVG) ===== */
function renderWellDiagram(targetSvg, targetWell) {
    const svg = targetSvg || document.getElementById('well-diagram');
    const well = targetWell || getCurrentWell();

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

    let totalDennice = 0;
    well.config.forEach(item => {
        const p = studnieProducts.find(pr => pr.id === item.productId);
        if (p && p.componentType === 'dennica') totalDennice += item.quantity;
    });

    const components = [];
    let currentDennica = 0;
    well.config.forEach((item, index) => {
        const p = studnieProducts.find(pr => pr.id === item.productId);
        if (!p) return;
        for (let i = 0; i < item.quantity; i++) {
            let effH = p.height || 0;
            if (p.componentType === 'dennica') {
                currentDennica++;
                // The bottom-most dennica remains full height. Others get -100mm.
                if (currentDennica < totalDennice) {
                    effH = Math.max(0, effH - 100);
                }
            }
            components.push({ ...p, height: effH, _originalHeight: p.height, _cfgIdx: index, _isFirst: i === 0, _isLast: i === item.quantity - 1, isPlaceholder: !!item.isPlaceholder });
        }
    });

    const visible = components.filter(c =>
        c.componentType !== 'uszczelka' && (
            (c.height || 0) > 0 ||
            c.componentType === 'wlaz' ||
            c.componentType === 'plyta_zamykajaca' ||
            c.componentType === 'plyta_najazdowa'
        )
    );

    // Sortowanie wyłączone - wizualizacja pokazuje elementy W DOKŁADNEJ KOLEJNOŚCI jak w tablicy config,
    // co pozwala na ręczne manipulowanie kolejnością!

    if (visible.length === 0) {
        svg.setAttribute('viewBox', '0 0 300 500');
        svg.innerHTML = `<text x="150" y="240" text-anchor="middle" fill="#64748b" font-size="12">Brak elementów z wysokością</text>`;
        return;
    }

    const totalMm = visible.reduce((s, c) => {
        let h = c.height || 0;
        return s + (h === 0 ? 18 / pxMm : h);
    }, 0);
    const bodyDN = well.dn;

    // Canvas
    const svgW = 340;
    const mL = 75, mR = 25, mT = 15, mB = 22; // mL=75 dla szerszego pasa wymiarowego po lewej
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

    let dimLinesY = [];

    visible.forEach(comp => {
        let h = (comp.height || 0) * pxMm;

        // Syntetyczna grubość rysowania dla elementów bez fizycznej wysokości "height"
        if (h === 0) {
            h = 18; // px wymuszone wizualnie, by element był nakładką
        }

        dimLinesY.push(y);
        dimLinesY.push(y + h);

        const outerDn = getElementOuterDn(comp);
        const w = Math.max(mmToPx(outerDn), 20);
        const x = cx - w / 2;

        let localCompType = comp.componentType;
        const c = TC[localCompType] || { fill: '#334155', stroke: '#64748b', label: '' };

        const isPlaceholder = comp.isPlaceholder;
        const pointerEvents = isPlaceholder ? 'pointer-events="none"' : '';
        const plStyle = isPlaceholder ? 'opacity:0.6; filter:drop-shadow(0px 0px 8px rgba(96, 165, 250, 0.9));' : '';

        if (comp._cfgIdx !== undefined) {
            svg_out += `<g class="diag-comp-grp svg-cfg-${comp._cfgIdx}" style="transition:all 0.2s; ${plStyle}" cursor="grab" ${pointerEvents} ` +
                `data-cfg-idx="${comp._cfgIdx}" draggable="true" ` +
                `ondragstart="window.handleCfgDragStart(event)" ` +
                `ondragend="window.handleCfgDragEnd(event)" ` +
                `onmousedown="window.svgPointerDown(event, ${comp._cfgIdx})" ` +
                `onmouseenter="window.svgPointerEnter(event, ${comp._cfgIdx})" ` +
                `onmouseleave="window.svgPointerLeave(event, ${comp._cfgIdx})" ` +
                `onmouseup="window.svgPointerUp(event, ${comp._cfgIdx})" ` +
                `ontouchstart="window.svgTouchStart(event, ${comp._cfgIdx})" ` +
                `ontouchend="window.svgTouchEnd(event)">`;
        }

        if (localCompType === 'konus') {
            // Konus: trapezoid — top = 625mm opening, bottom = well DN
            const topW = Math.max(mmToPx(625), 20);
            const topX = cx - topW / 2;
            svg_out += `<polygon points="${topX},${y} ${topX + topW},${y} ${x + w},${y + h} ${x},${y + h}" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5" opacity="0.85"/>`;
        } else if (localCompType === 'dennica') {
            // Dennica: rectangle with thick bottom line
            svg_out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5" opacity="0.85"/>`;
            svg_out += `<line x1="${x}" y1="${y + h}" x2="${x + w}" y2="${y + h}" stroke="${c.stroke}" stroke-width="3"/>`;
        } else if (localCompType === 'plyta_redukcyjna') {
            // Płyta redukcyjna: prostokąt o szerokości DN studni
            svg_out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5" opacity="0.85"/>`;
        } else if (localCompType === 'plyta_zamykajaca' || localCompType === 'pierscien_odciazajacy') {
            // Wider plate/ring with outer rim
            svg_out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5" opacity="0.85"/>`;
        } else if (localCompType === 'plyta_najazdowa') {
            // Square drive-over plate
            svg_out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5" opacity="0.85"/>`;
        } else if (localCompType === 'plyta_din') {
            // Same width as well shaft
            svg_out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5" opacity="0.85"/>`;
        } else if (localCompType === 'wlaz') {
            // Właz: 600mm manhole cover
            svg_out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5" opacity="0.95"/>`;
        } else if (localCompType === 'avr') {
            // AVR: 625mm adjustment ring
            svg_out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5" opacity="0.85"/>`;
        } else if (localCompType === 'osadnik') {
            svg_out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5" opacity="0.85"/>`;
            const oy = y + h * 0.65;
            svg_out += `<line x1="${x + 4}" y1="${oy}" x2="${x + w - 4}" y2="${oy}" stroke="${c.stroke}" stroke-width="0.7" stroke-dasharray="3,2" opacity="0.6"/>`;
            svg_out += `<line x1="${x + 4}" y1="${oy + h * 0.15}" x2="${x + w - 4}" y2="${oy + h * 0.15}" stroke="${c.stroke}" stroke-width="0.5" stroke-dasharray="2,2" opacity="0.4"/>`;
        } else {
            // Kręgi and other elements
            svg_out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5" opacity="0.85"/>`;
            if (localCompType === 'krag_ot') {
                const hr = Math.min(h * 0.15, 7);
                if (hr > 2) {
                    svg_out += `<circle cx="${x + 10}" cy="${y + h / 2}" r="${hr}" fill="rgba(15,23,42,0.7)" stroke="${c.stroke}" stroke-width="0.8"/>`;
                    svg_out += `<circle cx="${x + w - 10}" cy="${y + h / 2}" r="${hr}" fill="rgba(15,23,42,0.7)" stroke="${c.stroke}" stroke-width="0.8"/>`;
                }
            }
        }

        // ── Label wewnątrz elementu ──
        if (h > 18) {
            const fontSize = Math.min(13, Math.max(10, h * 0.35));
            svg_out += `<text x="${cx}" y="${y + h / 2 + 4}" text-anchor="middle" fill="white" font-size="${fontSize}" font-family="Inter,sans-serif" font-weight="700" opacity="0.95">${c.label}</text>`;
        } else if (h > 8) {
            svg_out += `<text x="${cx}" y="${y + h / 2 + 3}" text-anchor="middle" fill="white" font-size="9" font-family="Inter,sans-serif" font-weight="600" opacity="0.8">${c.label}</text>`;
        }

        // ── Wymiar elementu (przeniesiony z prawej na lewą) ──
        if (h > 6) {
            const dx = 32;
            // Kreska pionowa wymiaru
            svg_out += `<line x1="${dx}" y1="${y + 1}" x2="${dx}" y2="${y + h - 1}" stroke="#94a3b8" stroke-width="0.7"/>`;
            // Kreski poziome (górny i dolny tick)
            svg_out += `<line x1="${dx - 3}" y1="${y + 1}" x2="${dx + 3}" y2="${y + 1}" stroke="#94a3b8" stroke-width="0.7"/>`;
            svg_out += `<line x1="${dx - 3}" y1="${y + h - 1}" x2="${dx + 3}" y2="${y + h - 1}" stroke="#94a3b8" stroke-width="0.7"/>`;
            // Tekst wymiaru (pionowo z lewej strony)
            const dimFontSize = Math.min(11, Math.max(8, h * 0.3));
            svg_out += `<text x="${dx - 4}" y="${y + h / 2}" transform="rotate(-90 ${dx - 4} ${y + h / 2})" text-anchor="middle" fill="#cbd5e1" font-size="${dimFontSize}" font-family="Inter,sans-serif" font-weight="600">${comp.height}</text>`;
        }

        if (comp._cfgIdx !== undefined) {
            svg_out += `</g>`;
        }

        y += h;
    });

    // Draw Przejscia
    if (well.przejscia && well.przejscia.length > 0 && well.rzednaDna !== null && well.rzednaWlazu !== null) {
        const bottomElev = parseFloat(well.rzednaDna) || 0;

        well.przejscia.forEach((pr, idx) => {
            let pel = parseFloat(pr.rzednaWlaczenia);
            if (isNaN(pel)) pel = 0;

            const pprod = studnieProducts.find(x => x.id === pr.productId);
            let prW = 160, prH = 160, isEgg = false, isRect = false;

            if (pprod && pprod.category === 'Otwór KPED') {
                prW = 1020;
                prH = 500;
                isRect = true;
            } else if (pprod && typeof pprod.dn === 'string' && pprod.dn.includes('/')) {
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

                dimLinesY.push(prY - radiusH);
                dimLinesY.push(prY + radiusH);

                let px = cx;
                const a = parseFloat(pr.angle) || 0;
                const bw = mmToPx(bodyDN);
                const offset = Math.sin((a * Math.PI) / 180) * (bw / 2 - radiusW);
                px += offset;

                const isBack = a > 90 && a < 270;
                const pColor = isBack ? 'rgba(71,85,105,0.4)' : '#38bdf8';
                const sColor = isBack ? 'rgba(100,116,139,0.5)' : '#0ea5e9';
                const sDash = isBack ? 'stroke-dasharray="2,2"' : '';

                if (isRect) {
                    svg_out += `<g class="svg-prz-${idx}" style="transition:all 0.2s;" onmouseenter="window.svgPrzPointerEnter(event, ${idx})" onmouseleave="window.svgPrzPointerLeave(event, ${idx})"><rect x="${px - radiusW}" y="${prY - radiusH}" width="${radiusW * 2}" height="${radiusH * 2}" fill="${pColor}" stroke="${sColor}" stroke-width="1.5" ${sDash} /></g>`;
                } else if (isEgg) {
                    // SVG ellipse for jajowe pipe cross-section
                    svg_out += `<g class="svg-prz-${idx}" style="transition:all 0.2s;" onmouseenter="window.svgPrzPointerEnter(event, ${idx})" onmouseleave="window.svgPrzPointerLeave(event, ${idx})"><ellipse cx="${px}" cy="${prY}" rx="${radiusW}" ry="${radiusH}" fill="${pColor}" stroke="${sColor}" stroke-width="1.5" ${sDash} /></g>`;
                } else {
                    svg_out += `<g class="svg-prz-${idx}" style="transition:all 0.2s;" onmouseenter="window.svgPrzPointerEnter(event, ${idx})" onmouseleave="window.svgPrzPointerLeave(event, ${idx})"><circle cx="${px}" cy="${prY}" r="${radiusW}" fill="${pColor}" stroke="${sColor}" stroke-width="1.5" ${sDash} /></g>`;
                }

                const tColor = isBack ? 'rgba(148,163,184,0.7)' : '#bae6fd';
                const fSz = 11; // Nieznacznie większa czcionka

                if (!isBack) {
                    svg_out += `<text x="${px}" y="${prY + 3.5}" text-anchor="middle" fill="#ffffff" font-size="${fSz + 1}" font-weight="800" font-family="Inter,sans-serif" style="text-shadow: 1px 1px 2px rgba(0,0,0,0.8);">${a}°</text>`;
                }

                // Delikatna linia pomocnicza łącząca rurę z zunifikowaną osią wymiarową wskazująca wpięcie
                const dimColor = isBack ? '#64748b' : '#38bdf8';
                svg_out += `<line x1="25" y1="${prY}" x2="${px - radiusW - 2}" y2="${prY}" stroke="${dimColor}" stroke-width="0.8" stroke-dasharray="2,2" opacity="0.5"/>`;
            }
        });
    }

    // --- POJEDYNCZA LINIA WYMIAROWA PO LEWEJ STRONIE ---
    if (dimLinesY.length > 0) {
        dimLinesY = [...new Set(dimLinesY.map(v => Math.round(v * 10) / 10))].sort((a, b) => b - a);
        const dX = 52;
        const dimColor = '#94a3b8'; // neutral grey

        dimLinesY.forEach(pY => {
            svg_out += `<line x1="${dX - 4}" y1="${pY}" x2="${dX + 4}" y2="${pY}" stroke="${dimColor}" stroke-width="1.2"/>`;
        });

        for (let i = 0; i < dimLinesY.length - 1; i++) {
            const yB = dimLinesY[i];     // dolny punkt elementu/przejścia (wartość Y rośnie w dół)
            const yT = dimLinesY[i + 1];   // górny punkt elementu/przejścia
            const distY = yB - yT;
            const distMm = Math.round(distY / pxMm);

            if (distMm > 1) { // Rysuj jeżeli dystans jest zauważalny
                svg_out += `<line x1="${dX}" y1="${yB}" x2="${dX}" y2="${yT}" stroke="${dimColor}" stroke-width="1.2"/>`;

                let labelText = `${distMm}`;
                let isPipe = false;

                // Sprawdzamy czy ten segment to idealnie rura/przejście
                if (well.przejscia && well.przejscia.length > 0) {
                    well.przejscia.forEach(pr => {
                        let pel = parseFloat(pr.rzednaWlaczenia) || 0;
                        const pprod = studnieProducts.find(x => x.id === pr.productId);
                        let prH = 160;
                        if (pprod && pprod.category === 'Otwór KPED') {
                            prH = 500;
                        } else if (pprod && typeof pprod.dn === 'string' && pprod.dn.includes('/')) {
                            prH = parseFloat(pprod.dn.split('/')[1]) || 160;
                        } else if (pprod) {
                            prH = parseFloat(pprod.dn) || 160;
                        }

                        const mmFromBottom = (pel - (parseFloat(well.rzednaDna) || 0)) * 1000;
                        const radiusH = Math.max((prH / 2) * pxMm, 3);
                        const prY = (mT + drawH) - (mmFromBottom * pxMm) - radiusH;

                        const pyB = Math.round((prY + radiusH) * 10) / 10;
                        const pyT = Math.round((prY - radiusH) * 10) / 10;

                        // Compare segment rounded values with pipe boundary
                        if (Math.abs(yB - pyB) <= 1.2 && Math.abs(yT - pyT) <= 1.2) {
                            labelText = `DN ${Math.round(prH)}`; // oznacz jako rura
                            isPipe = true;
                        }
                    });
                }

                const fSz = 11;
                const textColor = isPipe ? '#38bdf8' : '#cbd5e1';
                const fW = isPipe ? '700' : '600';
                const textOpts = `text-anchor="middle" fill="${textColor}" font-size="${fSz}" font-family="Inter,sans-serif" font-weight="${fW}"`;
                svg_out += `<text x="${dX - 6}" y="${(yB + yT) / 2}" transform="rotate(-90 ${dX - 6} ${(yB + yT) / 2})" ${textOpts}>${labelText}</text>`;
            }
        }
    }

    // ── Łączna wysokość – pasek po lewej stronie ──
    const aX = 12;
    const aDimColor = '#94a3b8';
    svg_out += `<line x1="${aX}" y1="${mT}" x2="${aX}" y2="${mT + drawH}" stroke="${aDimColor}" stroke-width="1.2"/>`;
    svg_out += `<line x1="${aX - 4}" y1="${mT}" x2="${aX + 4}" y2="${mT}" stroke="${aDimColor}" stroke-width="1.2"/>`;
    svg_out += `<line x1="${aX - 4}" y1="${mT + drawH}" x2="${aX + 4}" y2="${mT + drawH}" stroke="${aDimColor}" stroke-width="1.2"/>`;
    const totalLabel = fmtInt(totalMm);
    svg_out += `<text x="${aX - 5}" y="${mT + drawH / 2}" transform="rotate(-90 ${aX - 5} ${mT + drawH / 2})" text-anchor="middle" fill="${aDimColor}" font-size="11" font-family="Inter,sans-serif" font-weight="600">${totalLabel}</text>`;

    // ── Oznaczenie DN na dole ──
    svg_out += `<text x="${cx}" y="${mT + drawH + mB - 2}" text-anchor="middle" fill="#64748b" font-size="11" font-family="Inter,sans-serif" font-weight="600">DN${bodyDN}</text>`;

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

    // Pre-calculate global transport cost
    let globalWeight = 0;
    wells.forEach(w => globalWeight += calcWellStats(w).weight);

    const transportKm = parseFloat(document.getElementById('transport-km')?.value) || 0;
    const transportRate = parseFloat(document.getElementById('transport-rate')?.value) || 0;
    let totalTransportCost = 0;
    let totalTransports = 0;
    let transportCostPerTrip = 0;

    if (transportKm > 0 && transportRate > 0) {
        totalTransports = Math.ceil(globalWeight / 24000);
        transportCostPerTrip = transportKm * transportRate;
        totalTransportCost = totalTransports * transportCostPerTrip;
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
        totalWeight += stats.weight;

        // Koszt transportu przypisany do tej studni proporcjonalnie do jej wagi
        const wellTransportCost = globalWeight > 0 ? totalTransportCost * (stats.weight / globalWeight) : 0;

        // Zwiększamy statystykę ceny o koszt transportu (aby kwota brutto na pasku zamówienia i rubryki się zgadzały)
        stats.price += wellTransportCost;
        totalPrice += stats.price;

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

        const rzDna = parseFloat(well.rzednaDna) || 0;
        const configMap = [];
        let currY = 0;
        let dennicaProcessedCount = 0;
        for (let j = well.config.length - 1; j >= 0; j--) {
            const item = well.config[j];
            const p = studnieProducts.find(pr => pr.id === item.productId);
            if (!p) continue;

            let h = 0;
            if (p.componentType === 'dennica') {
                for (let q = 0; q < item.quantity; q++) {
                    dennicaProcessedCount++;
                    h += (p.height || 0) - (dennicaProcessedCount > 1 ? 100 : 0);
                }
            } else {
                h = (p.height || 0) * item.quantity;
            }

            configMap.push({ index: j, start: currY, end: currY + h });
            currY += h;
        }

        const assignedPrzejscia = {};
        if (well.przejscia) {
            well.przejscia.forEach(pr => {
                let pel = parseFloat(pr.rzednaWlaczenia);
                if (isNaN(pel)) pel = rzDna;
                const mmFromBottom = (pel - rzDna) * 1000;

                let assignedIndex = -1;
                for (let cm of configMap) {
                    if (mmFromBottom >= cm.start && mmFromBottom < cm.end) {
                        assignedIndex = cm.index;
                        break;
                    }
                }
                if (assignedIndex === -1 && well.config.length > 0) assignedIndex = well.config.length - 1;

                if (!assignedPrzejscia[assignedIndex]) assignedPrzejscia[assignedIndex] = [];
                assignedPrzejscia[assignedIndex].push(pr);
            });
        }

        const disc = wellDiscounts[well.dn] || { dennica: 0, nadbudowa: 0 };
        const nadbudowaMult = 1 - ((disc.nadbudowa || 0) / 100);

        // Component details
        well.config.forEach((item, index) => {
            const p = studnieProducts.find(pr => pr.id === item.productId);
            if (!p) return;
            if (p.componentType === 'kineta') return; // Wyświetlana jako podpunkt pod dennicą

            let discStr = '';
            if (p.componentType === 'dennica' || p.componentType === 'kineta') {
                if (disc.dennica > 0) discStr = ` <span style="font-size:0.6rem; color:#10b981; margin-left:0.3rem;">(-${disc.dennica}%)</span>`;
            } else {
                if (disc.nadbudowa > 0) discStr = ` <span style="font-size:0.6rem; color:#10b981; margin-left:0.3rem;">(-${disc.nadbudowa}%)</span>`;
            }

            const itemPrice = getItemAssessedPrice(well, p, true);
            let totalLinePrice = itemPrice * item.quantity;

            if (p.componentType === 'dennica') {
                const kinetaItem = well.config.find(c => {
                    const pr = studnieProducts.find(x => x.id === c.productId);
                    return pr && pr.componentType === 'kineta';
                });
                if (kinetaItem) {
                    const kinetaProd = studnieProducts.find(x => x.id === kinetaItem.productId);
                    if (kinetaProd) {
                        const rawKinetaPrice = getItemAssessedPrice(well, kinetaProd, true);
                        totalLinePrice += rawKinetaPrice * (kinetaItem.quantity || 1);
                    }
                }
                // Dodaj też część kosztu transportu studni do dennicy
                totalLinePrice += wellTransportCost;
            }
            let totalLineWeight = (p.weight || 0) * item.quantity;

            const itemPrzejscia = assignedPrzejscia[index] || [];
            itemPrzejscia.forEach(pr => {
                const prProd = studnieProducts.find(x => x.id === pr.productId);
                if (prProd) {
                    totalLinePrice += (prProd.price || 0) * nadbudowaMult;
                    totalLineWeight += (prProd.weight || 0);
                }
            });

            const isBottommost = (index === well.config.length - 1);
            if (isBottommost && well.doplata) {
                totalLinePrice += well.doplata;
            }

            html += `<tr style="opacity:0.6; ${isChanged && wc.type === 'modified' && wc.fields?.includes('config') ? 'color:#f87171;' : ''}">
        <td></td>
        <td colspan="2" style="padding-left:1.5rem; font-size:0.78rem; ${isChanged && wc.type === 'modified' && wc.fields?.includes('config') ? 'color:#f87171;' : 'color:var(--text-muted);'}">↳ ${p.name}${discStr}</td>
        <td style="font-size:0.78rem;">${item.quantity} szt.</td>
        <td class="text-right" style="font-size:0.78rem;">${fmtInt(totalLineWeight)} kg</td>
        <td class="text-right" style="font-size:0.78rem;">${p.height ? fmtInt(p.height) + ' mm' : '—'}</td>
        <td class="text-right" style="font-size:0.78rem;">${p.area ? fmt(p.area * item.quantity) : '—'}</td>
        <td class="text-right" style="font-size:0.78rem;">${p.areaExt ? fmt(p.areaExt * item.quantity) : '—'}</td>
        <td class="text-right" style="font-size:0.78rem;">${p.componentType === 'kineta' ? 'wliczone (' + fmtInt(totalLinePrice) + ' PLN)' : fmtInt(totalLinePrice) + ' PLN'}</td>
      </tr>`;

            if (isBottommost && well.doplata) {
                html += `<tr style="opacity:0.6; color:#10b981;">
                    <td></td>
                    <td colspan="2" style="padding-left:2.5rem; font-size:0.72rem;">↳ + Dopłata</td>
                    <td style="font-size:0.72rem;">1 skmpl.</td>
                    <td class="text-right" style="font-size:0.72rem;">—</td>
                    <td class="text-right" style="font-size:0.72rem;">—</td>
                    <td class="text-right" style="font-size:0.72rem;">—</td>
                    <td class="text-right" style="font-size:0.72rem;">—</td>
                    <td class="text-right" style="font-size:0.72rem;">wliczone (${fmtInt(well.doplata)} PLN)</td>
                </tr>`;
            }

            itemPrzejscia.forEach(pr => {
                const prProd = studnieProducts.find(x => x.id === pr.productId);
                if (!prProd) return;

                let pDiscStr = '';
                if (disc.nadbudowa > 0) pDiscStr = ` <span style="font-size:0.6rem; color:#10b981; margin-left:0.3rem;">(-${disc.nadbudowa}%)</span>`;

                const prPriceDoliczane = (prProd.price || 0) * nadbudowaMult;

                html += `<tr style="opacity:0.6; ${isChanged && wc.type === 'modified' && wc.fields?.includes('przejscia') ? 'color:#f87171;' : 'color:#818cf8;'}">
                    <td></td>
                    <td colspan="2" style="padding-left:2.5rem; font-size:0.72rem;">↳ + Przejście szczelne: ${prProd.category} ${typeof prProd.dn === 'string' && prProd.dn.includes('/') ? prProd.dn : 'DN' + prProd.dn} (${pr.angle}°)${pDiscStr}</td>
                    <td style="font-size:0.72rem;">1 szt.</td>
                    <td class="text-right" style="font-size:0.72rem;">wliczone (${fmtInt(prProd.weight || 0)} kg)</td>
                    <td class="text-right" style="font-size:0.72rem;">—</td>
                    <td class="text-right" style="font-size:0.72rem;">—</td>
                    <td class="text-right" style="font-size:0.72rem;">—</td>
                    <td class="text-right" style="font-size:0.72rem;">wliczone (${fmtInt(prPriceDoliczane)} PLN)</td>
                </tr>`;
            });

            // Podpunkt dla kinety, jeśli renderujemy dennicę
            if (p.componentType === 'dennica') {
                const kinetaItem = well.config.find(c => {
                    const pr = studnieProducts.find(x => x.id === c.productId);
                    return pr && pr.componentType === 'kineta';
                });
                if (kinetaItem) {
                    const kinetaProd = studnieProducts.find(x => x.id === kinetaItem.productId);
                    if (kinetaProd) {
                        let kDiscStr = '';
                        if (disc.dennica > 0) kDiscStr = ` <span style="font-size:0.6rem; color:#10b981; margin-left:0.3rem;">(-${disc.dennica}%)</span>`;

                        const kPriceDoliczane = getItemAssessedPrice(well, kinetaProd, true) * (kinetaItem.quantity || 1);
                        const kWeight = (kinetaProd.weight || 0) * kinetaItem.quantity;
                        html += `<tr style="opacity:0.6; ${isChanged && wc.type === 'modified' && wc.fields?.includes('config') ? 'color:#f87171;' : 'color:#f472b6;'}">
                            <td></td>
                            <td colspan="2" style="padding-left:2.5rem; font-size:0.72rem;">↳ + ${kinetaProd.name}${kDiscStr}</td>
                            <td style="font-size:0.72rem;">${kinetaItem.quantity} szt.</td>
                            <td class="text-right" style="font-size:0.72rem;">${kWeight > 0 ? fmtInt(kWeight) + ' kg' : 'wliczone (0 kg)'}</td>
                            <td class="text-right" style="font-size:0.72rem;">—</td>
                            <td class="text-right" style="font-size:0.72rem;">—</td>
                            <td class="text-right" style="font-size:0.72rem;">—</td>
                            <td class="text-right" style="font-size:0.72rem;">wliczone (${fmtInt(kPriceDoliczane)} PLN)</td>
                        </tr>`;
                    }
                }

                // Dodaj wiersz "Transport" pod dennicą, jeśli istnieje koszt
                if (wellTransportCost > 0) {
                    html += `<tr style="opacity:0.6; color:#a855f7;">
                        <td></td>
                        <td colspan="2" style="padding-left:2.5rem; font-size:0.72rem;">↳ 🚚 Koszt transportu</td>
                        <td style="font-size:0.72rem;">1 skmpl.</td>
                        <td class="text-right" style="font-size:0.72rem;">—</td>
                        <td class="text-right" style="font-size:0.72rem;">—</td>
                        <td class="text-right" style="font-size:0.72rem;">—</td>
                        <td class="text-right" style="font-size:0.72rem;">—</td>
                        <td class="text-right" style="font-size:0.72rem;">wliczone (${fmtInt(wellTransportCost)} PLN)</td>
                    </tr>`;
                }
            }
        });

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

    // Transport UI indicators
    if (totalTransportCost > 0) {
        if (transCostEl) transCostEl.textContent = fmtInt(totalTransportCost) + ' PLN';

        const transDetails = document.getElementById('transport-breakdown');
        if (transDetails) {
            transDetails.innerHTML = `<div style="font-size:0.8rem; color:var(--text-muted); background:rgba(15,23,42,0.4); padding:0.8rem; border-radius:8px; border:1px solid rgba(255,255,245,0.05); margin-bottom:1rem;">
             🛣️ Łączny ciężar to <strong>${fmtInt(totalWeight)} kg</strong> co wymaga ok. <strong>${totalTransports} transportów</strong>. 
             Koszt jednego kursu: <strong>${fmtInt(transportCostPerTrip)} PLN</strong>. Łącznie transport: <strong>${fmtInt(totalTransportCost)} PLN</strong> (koszt rozbity na poszczególne studnie w tabeli wyżej).
           </div>`;
        }
    } else {
        if (transCostEl) transCostEl.textContent = '0 PLN';
        const transDetails = document.getElementById('transport-breakdown');
        if (transDetails) transDetails.innerHTML = '';
    }

    // Transport jest już wliczony w totalPrice podczas pętli studni
    const finalNetto = totalPrice;

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
    przejscia: p => p.componentType === 'przejscie',
    kinety: p => p.componentType === 'kineta' || (p.category && p.category.startsWith('Kinety'))
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
        } else if (currentCennikTab === 'kinety') {
            groupKey = p.category || ('Kinety DN' + (p.dn || ''));
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
    const isKinety = currentCennikTab === 'kinety';

    if (isPrzejscia || isKinety) {
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
        ${isKinety ? `<button class="btn btn-secondary" onclick="generateDefaultKinety()" style="font-size:0.8rem; padding:0.4rem 0.8rem;">🔌 Generuj puste Kinety</button>` : ''}
    </div>
    <table style="table-layout: fixed; width: 100%;">
      <thead>
        <tr>
          <th style="width: 10%;">Indeks</th>
          <th style="width: ${isPrzejscia ? '18' : isKinety ? '12' : '15'}%;">${isPrzejscia ? 'Rodzaj przejścia' : isKinety ? 'Nazwa kinety' : 'Nazwa elementu'}</th>
          ${isPrzejscia ? `
          <th class="text-center" style="width: 8%;">Średnica (DN)</th>
          <th class="text-right" style="width: 7%;">Waga kg</th>
          <th class="text-right" style="width: 8%;">Zap. dół</th>
          <th class="text-right" style="width: 8%;">Zap. góra</th>
          <th class="text-right" style="width: 8%;">Zap. dół min</th>
          <th class="text-right" style="width: 8%;">Zap. góra min</th>
          ` : isKinety ? `
          <th class="text-center" style="width: 4%;">DN</th>
          <th class="text-center" style="width: 6%;">Wys.Sp.</th>
          <th class="text-center" style="width: 5%;">Pow. m²</th>
          <th class="text-center" style="width: 4%;">Hmin1 mm</th>
          <th class="text-center" style="width: 4%;">Hmax1 mm</th>
          <th class="text-right" style="width: 6%;">Cena1</th>
          <th class="text-center" style="width: 5%;">Hmin2 mm</th>
          <th class="text-center" style="width: 5%;">Hmax2 mm</th>
          <th class="text-right" style="width: 6%;">Cena2</th>
          <th class="text-center" style="width: 5%;">Hmin3 mm</th>
          <th class="text-center" style="width: 5%;">Hmax3 mm</th>
          <th class="text-right" style="width: 6%;">Cena3</th>
          ` : `
          <th class="text-right" style="width: 5%;" title="Wysokość [mm]">Wys.</th>
          <th class="text-right" style="width: 5%;" title="Waga [kg]">Waga</th>
          <th class="text-right" style="width: 5%;" title="Powierzchnia wewnętrzna [m2]">P.wew</th>
          <th class="text-right" style="width: 5%;" title="Powierzchnia zewnętrzna [m2]">P.zew</th>
          <th class="text-right" style="width: 4%;" title="Maksymalna ilość sztuk na naczepie 24t">Szt</th>
          <th class="text-right" style="width: 6%;" title="Dopłata do wkładki PEHD [PLN]">PEHD</th>
          <th class="text-right" style="width: 5%;" title="Dopłata za malowanie wewnątrz [PLN]">Mal W.</th>
          <th class="text-right" style="width: 5%;" title="Dopłata za malowanie zewnątrz [PLN]">Mal Z.</th>
          <th class="text-right" style="width: 5%;" title="Dopłata dla dennicy za Żelbet [PLN]">Żelbet</th>
          <th class="text-right" style="width: 5%;" title="Dopłata za stopnie nierdzewne zamiast drabinki [PLN]">Dr.Ni.</th>
          <th class="text-center" style="width: 3%;" title="Dostępne na magazynie Włocławek (1=Tak, 0=Nie)">M.WL</th>
          <th class="text-center" style="width: 3%;" title="Dostępne na magazynie Kluczbork (1=Tak, 0=Nie)">M.KLB</th>
          <th class="text-center" style="width: 3%;" title="Forma Standardowa: Włocławek (1=Tak, 0=Nie)">FS.WL</th>
          <th class="text-center" style="width: 4%;" title="Forma Standardowa: Kluczbork (1=Tak, 0=Nie)">FS.KLB</th>
          `}
          <th class="text-right" style="width: 6%;">Cena PLN</th>
          <th class="text-center" style="width: 6%;">Akcje</th>
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
        <td colspan="${isPrzejscia ? '10' : isKinety ? '16' : '18'}" style="padding:0; border-bottom:1px solid var(--border);">
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
            } else if (isKinety) {
                html += `
        <td class="text-center" style="font-weight:600; color:#818cf8; cursor:pointer;" onclick="editStudnieCell(this,'dn','${p.id}')">${p.dn != null ? (typeof p.dn === 'string' && p.dn.includes('/') ? p.dn : 'DN ' + p.dn) : '—'}</td>
        <td class="text-center" onclick="editStudnieCell(this,'spocznikH','${p.id}')" style="cursor:pointer; font-weight:600;">${p.spocznikH || '—'}</td>
        <td class="text-center" onclick="editStudnieCell(this,'area','${p.id}')" style="cursor:pointer; font-weight:600;">${p.area != null ? fmt(p.area) : '—'}</td>
        <td class="text-center" onclick="editStudnieCell(this,'hMin1','${p.id}')" style="cursor:pointer; font-weight:600;">${p.hMin1 != null ? fmtInt(p.hMin1) : '—'}</td>
        <td class="text-center" onclick="editStudnieCell(this,'hMax1','${p.id}')" style="cursor:pointer; font-weight:600;">${p.hMax1 != null ? fmtInt(p.hMax1) : '—'}</td>
        <td class="text-right" onclick="editStudnieCell(this,'cena1','${p.id}')" style="cursor:pointer; font-weight:600; color:var(--success);">${p.cena1 != null ? fmtInt(p.cena1) : '—'}</td>
        <td class="text-center" onclick="editStudnieCell(this,'hMin2','${p.id}')" style="cursor:pointer; font-weight:600;">${p.hMin2 != null ? fmtInt(p.hMin2) : '—'}</td>
        <td class="text-center" onclick="editStudnieCell(this,'hMax2','${p.id}')" style="cursor:pointer; font-weight:600;">${p.hMax2 != null ? fmtInt(p.hMax2) : '—'}</td>
        <td class="text-right" onclick="editStudnieCell(this,'cena2','${p.id}')" style="cursor:pointer; font-weight:600; color:var(--success);">${p.cena2 != null ? fmtInt(p.cena2) : '—'}</td>
        <td class="text-center" onclick="editStudnieCell(this,'hMin3','${p.id}')" style="cursor:pointer; font-weight:600;">${p.hMin3 != null ? fmtInt(p.hMin3) : '—'}</td>
        <td class="text-center" onclick="editStudnieCell(this,'hMax3','${p.id}')" style="cursor:pointer; font-weight:600;">${p.hMax3 != null ? fmtInt(p.hMax3) : '—'}</td>
        <td class="text-right" onclick="editStudnieCell(this,'cena3','${p.id}')" style="cursor:pointer; font-weight:600; color:var(--success);">${p.cena3 != null ? fmtInt(p.cena3) : '—'}</td>
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
        <td class="text-center" onclick="toggleMagazynField(this,'formaStandardowaKLB','${p.id}')" style="cursor:pointer; font-weight:700; color:${p.formaStandardowaKLB === 1 ? '#34d399' : '#f87171'};">${p.formaStandardowaKLB === 1 ? '1' : '0'}</td>
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

/* ===== KINETY CAT. MANAGEMENT ===== */
function generateDefaultKinety(auto = false) {
    if (!auto && !confirm('Wygenerować szablon cennika kinet dla wszystkich średnic? (nie nadpisze to istniejących ze zgodnym id)')) return;

    const dns = [1000, 1200, 1500, 2000, 2500];
    const heights = ['1/2', '2/3', '3/4', '1/1'];
    let added = 0;

    dns.forEach(dn => {
        heights.forEach(h => {
            const hId = h.replace('/', '');
            const id = `KINETA-DN${dn}-${hId}`;

            if (!studnieProducts.find(p => p.id === id)) {
                studnieProducts.push({
                    id: id,
                    name: `Kineta DN${dn} wys. ${h}`,
                    category: `Kinety DN${dn}`,
                    componentType: 'kineta',
                    dn: dn,
                    spocznikH: h,
                    area: 0,
                    hMin1: null, hMax1: null, cena1: 100,
                    hMin2: null, hMax2: null, cena2: 100,
                    hMin3: null, hMax3: null, cena3: 100,
                    price: 100
                });
                added++;
            }
        });
    });

    if (added > 0) {
        saveStudnieProducts(studnieProducts);
        renderStudniePriceList();
        if (!auto) showToast(`Dodano ${added} elementów kinet do uzupełnienia.`, 'success');
    } else {
        if (!auto) showToast('Wszystkie kinety już istnieją.', 'info');
    }
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
        formaStandardowa: 1,
        formaStandardowaKLB: 1
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
        formaStandardowa: 1,
        formaStandardowaKLB: 1
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
    const isTextField = ['name', 'id', 'dn', 'spocznikH', 'category'].includes(field);
    input.type = isTextField ? 'text' : 'number';
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
        let val = input.value.trim();
        if (!isTextField) {
            val = val === '' ? null : Number(val);
        } else if (field === 'dn' && val !== '' && !val.includes('/')) {
            const numDn = Number(val);
            if (!isNaN(numDn)) val = numDn;
        }

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
        if (customDefault && customDefault.length > 0) {
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

async function manuallySaveStudnieProductsDB() {
    if (!confirm('Czy na pewno chcesz zapisać listę produktów studni jako wartości fabryczne (do resetu)?')) return;
    try {
        await saveStudnieProducts(studnieProducts);
        await fetch('/api/products-studnie/default', { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ data: studnieProducts }) });
        renderStudniePriceList();
        renderTiles();
        showToast('Zapisano produkty studni jako wartości fabryczne', 'success');
    } catch (err) {
        showToast('Błąd zapisu jako wartości fabryczne', 'error');
    }
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
    { key: 'formaStandardowa', header: 'Forma std. WL' },
    { key: 'formaStandardowaKLB', header: 'Forma std. KLB' },
    { key: 'zapasDol', header: 'Zapas dół mm' },
    { key: 'zapasGora', header: 'Zapas góra mm' },
    { key: 'zapasDolMin', header: 'Zapas dół min mm' },
    { key: 'zapasGoraMin', header: 'Zapas góra min mm' },
    { key: 'spocznikH', header: 'Wys. spocznika' },
    { key: 'hMin1', header: 'Hmin 1 mm' },
    { key: 'hMax1', header: 'Hmax 1 mm' },
    { key: 'cena1', header: 'Cena 1 PLN' },
    { key: 'hMin2', header: 'Hmin 2 mm' },
    { key: 'hMax2', header: 'Hmax 2 mm' },
    { key: 'cena2', header: 'Cena 2 PLN' },
    { key: 'hMin3', header: 'Hmin 3 mm' },
    { key: 'hMax3', header: 'Hmax 3 mm' },
    { key: 'cena3', header: 'Cena 3 PLN' }
];

// Build reverse lookup: Polish header -> key
const HEADER_TO_KEY = {};
EXPORT_COLUMNS.forEach(c => { HEADER_TO_KEY[c.header] = c.key; HEADER_TO_KEY[c.key] = c.key; });
// Backward compatibility: old header 'Forma std.' maps to formaStandardowa (WL)
HEADER_TO_KEY['Forma std.'] = 'formaStandardowa';

function exportStudnieToExcel() {
    if (!studnieProducts || studnieProducts.length === 0) {
        showToast('Brak danych do eksportu', 'error');
        return;
    }

    const wb = XLSX.utils.book_new();

    function getSheetName(p) {
        const c = p.category || '';
        const ct = p.componentType || '';

        if (c.toLowerCase().includes('akcesoria') || c.toLowerCase().includes('chemia') || c.toLowerCase().includes('stopnie') || c.toLowerCase().includes('uszczelki') || ct === 'wlaz' || ct === 'osadnik') return 'Akcesoria';
        if (c.toLowerCase().includes('przejścia') || c.toLowerCase().includes('przejscia') || c.toLowerCase().includes('otwór') || c.toLowerCase().includes('otwor') || ct === 'przejscie') return 'Przejścia';
        if (c.toLowerCase().includes('kinet') || ct === 'kineta') return 'Kinety';
        if (c.toLowerCase().includes('dennic') || ct === 'dennica') return 'Dennicy';

        if (p.dn) {
            if (p.dn == 1000) return 'DN1000';
            if (p.dn == 1200) return 'DN1200';
            if (p.dn == 1500) return 'DN1500';
            if (p.dn == 2000) return 'DN2000';
            if (p.dn == 2500) return 'DN2500';
            return 'DN' + p.dn;
        }

        return 'Akcesoria';
    }

    // Group products by custom category
    const categories = {};
    studnieProducts.forEach(p => {
        const cat = getSheetName(p);
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(p);
    });

    Object.keys(categories).forEach(cat => {
        // Build export rows with ordered columns and Polish headers
        const rows = categories[cat].map(p => {
            const row = {};
            EXPORT_COLUMNS.forEach(col => {
                row[col.header] = p[col.key] ?? '';
            });
            return row;
        });

        const ws = XLSX.utils.json_to_sheet(rows);

        // Set column widths
        ws['!cols'] = EXPORT_COLUMNS.map(col => ({ wch: Math.max(col.header.length + 2, 12) }));

        // Ensure valid sheet name (max 31 chars, no forbidden chars)
        let sheetName = cat.replace(/[\[\]\*\/\\\?\:]/g, '_').substring(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    XLSX.writeFile(wb, "Cennik_Studni_Export.xlsx");
    showToast('Wyeksportowano cennik do Excela (' + studnieProducts.length + ' pozycji w ' + Object.keys(categories).length + ' zakładkach)', 'success');
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

            let allJson = [];
            workbook.SheetNames.forEach(sheetName => {
                const worksheet = workbook.Sheets[sheetName];
                const sheetJson = XLSX.utils.sheet_to_json(worksheet);
                if (sheetJson && sheetJson.length > 0) {
                    allJson = allJson.concat(sheetJson);
                }
            });

            if (allJson.length === 0) {
                showToast('Skoroszyt jest pusty lub ma zły format', 'error');
                return;
            }

            // Normalize imported data — map Polish headers to keys & set defaults
            const numericFields = ['height', 'weight', 'area', 'areaExt', 'transport', 'price',
                'doplataPEHD', 'malowanieWewnetrzne', 'malowanieZewnetrzne', 'doplataZelbet',
                'doplataDrabNierdzewna', 'magazynWL', 'magazynKLB', 'formaStandardowa', 'formaStandardowaKLB',
                'zapasDol', 'zapasGora', 'zapasDolMin', 'zapasGoraMin', 'dn',
                'hMin1', 'hMax1', 'cena1', 'hMin2', 'hMax2', 'cena2', 'hMin3', 'hMax3', 'cena3'];

            const normalized = allJson.map(raw => {
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
                if (product.category.startsWith('Kinety') && !product.componentType) {
                    product.componentType = 'kineta';
                }

                // Parse numeric fields
                numericFields.forEach(f => {
                    if (product[f] === '' || product[f] === undefined || product[f] === null || product[f] === '—') {
                        product[f] = (f === 'magazynWL' || f === 'magazynKLB' || f === 'formaStandardowa' || f === 'formaStandardowaKLB') ? 1 : null;
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
                if (product.formaStandardowa == null) product.formaStandardowa = 1;
                if (product.formaStandardowaKLB == null) product.formaStandardowaKLB = 1;

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

        if (!studnieProducts.some(p => p.componentType === 'kineta')) {
            generateDefaultKinety(true);
        }

        // Dodanie kategorii Otwór KPED jeśli nie istnieje
        if (!studnieProducts.some(p => p.id === 'Otwor-KPED' || p.category === 'Otwór KPED')) {
            studnieProducts.push({
                id: 'Otwor-KPED',
                name: 'Otwór KPED',
                category: 'Otwór KPED',
                dn: '1020/500', // szerokość/wysokość
                componentType: 'przejscie',
                zapasDol: 300,
                zapasGora: 300,
                zapasDolMin: 150,
                zapasGoraMin: 150,
                price: 500,
                weight: 0
            });
            saveStudnieProducts(studnieProducts);
        }

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
        investContractor: offer.investContractor,
        notes: offer.notes,
        wells: JSON.parse(JSON.stringify(offer.wells)),
        visiblePrzejsciaTypes: Array.from(visiblePrzejsciaTypes),
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
    order.visiblePrzejsciaTypes = Array.from(visiblePrzejsciaTypes);
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

        visiblePrzejsciaTypes = new Set(order.visiblePrzejsciaTypes || []);

        // Load wells from order
        wells = JSON.parse(JSON.stringify(order.wells));
        migrateWellData(wells);

        // Automatyczne odblokowanie widoku kategorii dla użytych przejść
        wells.forEach(w => {
            if (w.przejscia) {
                w.przejscia.forEach(pr => {
                    const prod = studnieProducts.find(p => p.id === pr.productId);
                    if (prod && prod.category) {
                        visiblePrzejsciaTypes.add(prod.category);
                    }
                });
            }
        });

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
        document.getElementById('invest-contractor').value = order.investContractor || '';

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
        // Create banner div at the top of the center column
        const centerCol = document.querySelector('.well-center-column');
        if (!centerCol) return;
        banner = document.createElement('div');
        banner.id = 'order-mode-banner';
        centerCol.insertBefore(banner, centerCol.firstChild);
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
    order.visiblePrzejsciaTypes = Array.from(visiblePrzejsciaTypes);
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
    const investContractor = document.getElementById('invest-contractor').value.trim();
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
        number, date, clientName, clientNip, clientAddress, clientContact, investName, investAddress, investContractor, notes,
        wells: JSON.parse(JSON.stringify(wells)),
        visiblePrzejsciaTypes: Array.from(visiblePrzejsciaTypes),
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
    document.getElementById('invest-contractor').value = '';
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
    document.getElementById('invest-contractor').value = offer.investContractor || '';
    document.getElementById('offer-notes').value = offer.notes || '';
    document.getElementById('transport-km').value = offer.transportKm || 100;
    document.getElementById('transport-rate').value = offer.transportRate || 10;

    visiblePrzejsciaTypes = new Set(offer.visiblePrzejsciaTypes || []);

    wells = JSON.parse(JSON.stringify(offer.wells));
    migrateWellData(wells);

    // Zawsze sprawdzaj, czy jakieś przejścia już są fizycznie dodane w studniach
    // i automatycznie włącz kategorię do widoku (aby nie trzeba było ich "wczytywać")
    wells.forEach(w => {
        if (w.przejscia) {
            w.przejscia.forEach(pr => {
                const prod = studnieProducts.find(p => p.id === pr.productId);
                if (prod && prod.category) {
                    visiblePrzejsciaTypes.add(prod.category);
                }
            });
        }
    });

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

/* --- SVG Diagram Logic Helper --- */
window.decDiagramWellQty = function (idx) {
    const well = getCurrentWell();
    if (well && well.config[idx]) {
        updateWellQuantity(idx, well.config[idx].quantity - 1);
    }
}

window.svgDragStartIndex = -1;

window.svgPointerDown = function (ev, idx) {
    ev.preventDefault();
    const well = getCurrentWell();
    if (!well) return;

    // If Zlecenia modal is open, select element instead of dragging
    const zlModal = document.getElementById('zlecenia-modal');
    if (zlModal && zlModal.classList.contains('active')) {
        const targetIdx = zleceniaElementsList.findIndex(el => el.wellIndex === currentWellIndex && el.elementIndex === idx);
        if (targetIdx >= 0) {
            selectZleceniaElement(targetIdx);
        }
        return;
    }

    window.svgDragStartIndex = idx;
    well.config[idx].isPlaceholder = true;
    window.requestAnimationFrame(() => renderWellDiagram());
};

window.svgTouchStart = function (ev, idx) {
    ev.preventDefault();
    const well = getCurrentWell();
    if (!well) return;
    window.svgDragStartIndex = idx;
    well.config[idx].isPlaceholder = true;
    window.requestAnimationFrame(() => renderWellDiagram());
};

function handleLiveSvgDrag(clientY) {
    if (window.svgDragStartIndex >= 0) {
        const well = getCurrentWell();
        if (!well) return;
        const dz = document.getElementById('drop-zone-diagram');
        if (!dz) return;

        let targetIdx = well.config.length;
        let found = false;
        const grps = Array.from(dz.querySelectorAll('g.diag-comp-grp:not([pointer-events="none"])'));

        for (let g of grps) {
            const rect = g.getBoundingClientRect();
            if (clientY < rect.top + rect.height / 2) {
                targetIdx = parseInt(g.getAttribute('data-cfg-idx'));
                found = true;
                break;
            }
        }
        if (!found && grps.length > 0) {
            targetIdx = well.config.length;
        }

        let insertIdx = targetIdx;
        if (window.svgDragStartIndex < targetIdx) insertIdx -= 1;
        insertIdx = Math.max(0, Math.min(well.config.length, insertIdx));

        if (window.svgDragStartIndex !== insertIdx) {
            const draggedItem = well.config.splice(window.svgDragStartIndex, 1)[0];
            well.config.splice(insertIdx, 0, draggedItem);
            window.svgDragStartIndex = insertIdx;

            window.requestAnimationFrame(() => renderWellDiagram());
        }
    }
}

document.addEventListener('mousemove', (ev) => {
    if (window.svgDragStartIndex >= 0) {
        handleLiveSvgDrag(ev.clientY);
    }
});

document.addEventListener('touchmove', (ev) => {
    if (window.svgDragStartIndex >= 0 && ev.touches.length > 0) {
        handleLiveSvgDrag(ev.touches[0].clientY);
    }
}, { passive: false });

document.addEventListener('mouseup', (ev) => {
    if (window.svgDragStartIndex >= 0) {
        const sourceIdx = window.svgDragStartIndex;
        window.svgDragStartIndex = -1;

        let shouldRemove = false;

        // Złapane w obszar kosza
        const trash = document.getElementById('svg-trash');
        if (trash && (trash === ev.target || trash.contains(ev.target))) {
            shouldRemove = true;
        }

        // Wyrzucone całkowicie poza okienko podglądu (diagram-panel)
        const diagramZone = document.getElementById('drop-zone-diagram');
        if (diagramZone && !diagramZone.contains(ev.target)) {
            shouldRemove = true;
        }

        const well = getCurrentWell();
        if (well) {
            well.config.forEach(c => c.isPlaceholder = false);
            well.autoLocked = true;
            if (typeof updateAutoLockUI === 'function') updateAutoLockUI();
            well.configSource = 'MANUAL';
        }

        if (shouldRemove) {
            window.decDiagramWellQty(sourceIdx);
        } else {
            renderWellConfig();
            renderWellDiagram();
            updateSummary();
        }

        // Reset trash visual state
        if (trash) {
            trash.style.background = 'rgba(239,68,68,0.1)';
            trash.style.borderColor = 'rgba(239,68,68,0.4)';
        }
    }
});

document.addEventListener('touchend', (ev) => {
    if (window.svgDragStartIndex >= 0) {
        // Syntetyczne mapowanie na to samo zachowanie co mouseup
        const mouseUpEvent = new MouseEvent('mouseup', {
            clientX: ev.changedTouches[0].clientX,
            clientY: ev.changedTouches[0].clientY,
            bubbles: true
        });
        document.dispatchEvent(mouseUpEvent);
    }
});

let dragOverCount = 0; // for drag & drop visual

let isBackendOnline = false;

/* ===== BACKEND STATUS CHECKER ===== */
async function checkBackendStatus() {
    try {
        const response = await fetch('http://localhost:8000/api/v1/sync/pull', { method: 'GET' });
        const indicator = document.querySelector('#backend-status-indicator span');
        if (response.ok) {
            isBackendOnline = true;
            if (indicator) {
                indicator.style.background = '#4ade80'; // jasny zielony
                indicator.style.boxShadow = '0 0 8px #4ade80';
                indicator.parentElement.title = 'Serwer OR-Tools połączony';
            }
        } else {
            throw new Error("Backend response not ok");
        }
    } catch (e) {
        isBackendOnline = false;
        const indicator = document.querySelector('#backend-status-indicator span');
        if (indicator) {
            indicator.style.background = '#f87171'; // czerwony
            indicator.style.boxShadow = '0 0 8px #f87171';
            indicator.parentElement.title = 'Serwer obliczeniowy OFFLINE (działa tryb JS)';
        }
    }
}
setInterval(checkBackendStatus, 15000); // Check every 15 seconds

// DOMContentLoaded
/* ===== GLOBAL RECALCULATOR ===== */
window.openGlobalRecalcModal = function () {
    if (!wells || wells.length === 0) {
        showToast('Brak studni w ofercie', 'error');
        return;
    }

    const uniqueDns = [...new Set(wells.map(w => w.dn))].sort((a, b) => a - b);

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'global-recalc-modal';

    // We will build a UI for each DN
    let groupsHtml = uniqueDns.map(dn => {
        const exampleMag = wells[0]?.magazyn || 'Kluczbork';
        // Get all products that can be used for closures
        const availForDn = studnieProducts.filter(p => p.dn === dn && ((exampleMag === 'Włocławek' && p.magazynWL === 1) || (exampleMag !== 'Włocławek' && p.magazynKLB === 1)));

        const topClosureTypes = ['konus', 'plyta_din', 'plyta_najazdowa', 'plyta_zamykajaca', 'pierscien_odciazajacy'];
        const candidates = availForDn.filter(p => topClosureTypes.includes(p.componentType));
        const canReduce = [1200, 1500, 2000, 2500].includes(dn);

        let topTiles = candidates.map(p => `
            <div class="fs-dn-tile" id="recalc-top-${dn}-${p.id}"
                 style="padding:0.35rem; text-align:center; cursor:pointer; border-radius:6px; background: rgba(30,41,59,0.3); border: 1px solid var(--border);"
                 onclick="window.recalcSelectTop(${dn}, '${p.id}')">
                <div style="font-size:0.65rem; font-weight:700; color:var(--text-primary);">${p.name.replace(/^.*?(Konus|Płyta|Pierścień)/i, '$1').substring(0, 18)}</div>
            </div>
        `).join('');

        // Auto Konus as default tile
        topTiles = `
            <div class="fs-dn-tile active" id="recalc-top-${dn}-auto"
                 style="padding:0.35rem; text-align:center; cursor:pointer; border-radius:6px; background: rgba(30,41,59,0.3); border: 1px solid var(--border);"
                 onclick="window.recalcSelectTop(${dn}, 'auto')">
                <div style="font-size:0.65rem; font-weight:700; color:#a78bfa;">🔄 Auto (Domyślny)</div>
            </div>
        ` + topTiles;

        let reductionHtml = '';
        if (canReduce) {
            const dn1000Candidates = studnieProducts.filter(p => p.dn === 1000 && topClosureTypes.includes(p.componentType) && ((exampleMag === 'Włocławek' && p.magazynWL === 1) || (exampleMag !== 'Włocławek' && p.magazynKLB === 1)));

            let redTiles = dn1000Candidates.map(p => `
                <div class="fs-dn-tile fs-red-tile-${dn}" id="recalc-redtop-${dn}-${p.id}"
                     style="padding:0.35rem; text-align:center; cursor:pointer; border-radius:6px; background: rgba(30,41,59,0.3); border: 1px solid var(--border);"
                     onclick="window.recalcSelectRedTop(${dn}, '${p.id}')">
                    <div style="font-size:0.65rem; font-weight:700; color:var(--text-primary);">${p.name.replace(/^.*?(Konus|Płyta|Pierścień)/i, '$1').substring(0, 18)}</div>
                </div>
            `).join('');

            redTiles = `
                <div class="fs-dn-tile active fs-red-tile-${dn}" id="recalc-redtop-${dn}-auto"
                     style="padding:0.35rem; text-align:center; cursor:pointer; border-radius:6px; background: rgba(30,41,59,0.3); border: 1px solid var(--border);"
                     onclick="window.recalcSelectRedTop(${dn}, 'auto')">
                    <div style="font-size:0.65rem; font-weight:700; color:#a78bfa;">🔄 Auto (Konus)</div>
                </div>
            ` + redTiles;

            reductionHtml = `
            <div style="margin-top:0.6rem;">
                <label style="display:flex; align-items:center; gap:0.4rem; font-size:0.75rem; cursor:pointer;">
                    <input type="checkbox" id="recalc-use-red-${dn}" onchange="window.recalcToggleRed(${dn})" />
                    Wykonaj redukcję na DN1000
                </label>
                <div id="recalc-red-box-${dn}" style="display:none; margin-top:0.5rem; padding-left:1rem; border-left:2px solid var(--border);">
                    <div style="display:grid; grid-template-columns:1fr; gap:0.4rem; margin-bottom:0.5rem;">
                        <label class="form-label" style="font-size:0.65rem;">Min. wys. komory roboczej (mm)</label>
                        <input type="number" id="recalc-red-minh-${dn}" class="form-input" value="2500" style="padding:0.3rem 0.5rem; width:120px;" />
                    </div>
                    <div style="font-size:0.65rem; margin-bottom:0.3rem; color:var(--text-muted);">Zakończenie komina DN1000:</div>
                    <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(110px, 1fr)); gap:0.3rem;" id="recalc-red-tiles-${dn}">
                        ${redTiles}
                    </div>
                </div>
            </div>`;
        }

        return `
        <div style="background:rgba(30,41,59,0.4); border:1px solid var(--border); border-radius:8px; padding:0.8rem; margin-bottom:0.8rem;" class="recalc-group" data-dn="${dn}">
            <h4 style="margin-top:0; margin-bottom:0.6rem; color:var(--accent); font-size:0.9rem;">Studnie DN ${dn} <span style="font-size:0.65rem; color:var(--text-muted); font-weight:normal;">(${wells.filter(w => w.dn === dn).length} szt.)</span></h4>
            <div style="font-size:0.65rem; margin-bottom:0.3rem; color:var(--text-muted);">Zakończenie główne:</div>
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(110px, 1fr)); gap:0.3rem;" id="recalc-top-tiles-${dn}">
                ${topTiles}
            </div>
            ${reductionHtml}
            <input type="hidden" id="recalc-choice-top-${dn}" value="auto" />
            <input type="hidden" id="recalc-choice-redtop-${dn}" value="auto" />
        </div>
        `;
    }).join('');

    overlay.innerHTML = `
    <div class="modal" style="width:700px; max-width:95vw; background:#111827;">
      <div class="modal-header"><h3>⚙️ Automatycznie przelicz ofertę</h3><button class="btn-icon" onclick="window.closeGlobalRecalcModal()">✕</button></div>
      <div style="padding:1rem; max-height:65vh; overflow-y:auto; scrollbar-width:thin; scrollbar-color:rgba(99,102,241,0.4) transparent;">
        <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:1rem; line-height:1.4;">Ustaw preferencje dla poszczególnych średnic. Program zaktualizuje ustawienia zakończeń i ponownie wygeneruje układ elementów dla <strong>wszystkich studni w ofercie</strong> według reguł automatycznych.</p>
        ${groupsHtml}
      </div>
      <div style="padding:1rem; border-top:1px solid var(--border); display:flex; justify-content:flex-end; gap:0.5rem; background:rgba(0,0,0,0.2);">
        <button class="btn btn-secondary" onclick="window.closeGlobalRecalcModal()">Anuluj</button>
        <button class="btn btn-primary" onclick="window.applyGlobalRecalc()" style="background:var(--accent); color:#fff; font-weight:600;">🔄 Przelicz wszystkie</button>
      </div>
    </div>
    `;

    document.body.appendChild(overlay);
};

window.closeGlobalRecalcModal = function () {
    const el = document.getElementById('global-recalc-modal');
    if (el) el.remove();
};

window.recalcSelectTop = function (dn, id) {
    document.getElementById(`recalc-choice-top-${dn}`).value = id;
    const tiles = document.querySelectorAll(`#recalc-top-tiles-${dn} .fs-dn-tile`);
    tiles.forEach(t => {
        t.classList.remove('active');
        t.style.borderColor = 'var(--border)';
    });
    const selected = document.getElementById(`recalc-top-${dn}-${id}`);
    selected.classList.add('active');
    selected.style.borderColor = 'var(--accent)';
};

window.recalcSelectRedTop = function (dn, id) {
    document.getElementById(`recalc-choice-redtop-${dn}`).value = id;
    const tiles = document.querySelectorAll(`.fs-red-tile-${dn}`);
    tiles.forEach(t => {
        t.classList.remove('active');
        t.style.borderColor = 'var(--border)';
    });
    const selected = document.getElementById(`recalc-redtop-${dn}-${id}`);
    selected.classList.add('active');
    selected.style.borderColor = 'var(--accent)';
};

window.recalcToggleRed = function (dn) {
    const cb = document.getElementById(`recalc-use-red-${dn}`);
    const box = document.getElementById(`recalc-red-box-${dn}`);
    if (cb && box) {
        box.style.display = cb.checked ? 'block' : 'none';
    }
};

window.applyGlobalRecalc = async function () {
    const btn = document.querySelector('#global-recalc-modal .btn-primary');
    if (btn) {
        btn.innerHTML = '🔄 Przeliczanie...';
        btn.disabled = true;
    }

    try {
        const uniqueDns = [...new Set(wells.map(w => w.dn))];
        const prefs = {};

        uniqueDns.forEach(dn => {
            const topId = document.getElementById(`recalc-choice-top-${dn}`)?.value || 'auto';
            const useRed = document.getElementById(`recalc-use-red-${dn}`)?.checked || false;
            let redTopId = 'auto';
            let redMinH = 2500;

            if (useRed) {
                redTopId = document.getElementById(`recalc-choice-redtop-${dn}`)?.value || 'auto';
                redMinH = parseInt(document.getElementById(`recalc-red-minh-${dn}`)?.value) || 2500;
            }

            prefs[dn] = { topId, useRed, redTopId, redMinH };
        });

        // Backup current index
        const originalIndex = currentWellIndex;

        // Apply settings and recalc all
        for (let i = 0; i < wells.length; i++) {
            const w = wells[i];
            const p = prefs[w.dn];
            if (!p) continue;

            w.zakonczenie = p.topId === 'auto' ? null : p.topId;
            w.redukcjaDN1000 = p.useRed;
            if (p.useRed) {
                w.redukcjaMinH = p.redMinH;
                w.redukcjaZakonczenie = p.redTopId === 'auto' ? null : p.redTopId;
            } else {
                w.redukcjaZakonczenie = null;
            }
            w.config = []; // clean state to force full recalculation
            w.autoLocked = false;

            currentWellIndex = i; // let generator pick the right well
            await autoSelectComponents(true);
        }

        currentWellIndex = originalIndex;
        refreshAll();
        showToast('Wszystkie studnie przeliczone poprawnie', 'success');
        window.closeGlobalRecalcModal();
    } catch (e) {
        console.error(e);
        showToast('Wystąpił błąd podczas przeliczania', 'error');
        if (btn) {
            btn.innerHTML = 'Spróbuj ponownie';
            btn.disabled = false;
        }
    }
};

/* ===== ZLECENIA PRODUKCYJNE (Production Orders) ===== */
let productionOrders = [];
let zleceniaElementsList = []; // [{wellIndex, elementIndex, well, product, configItem}]
let zleceniaSelectedIdx = -1;

async function loadProductionOrders() {
    try {
        const resp = await fetch('/api/production-orders', { headers: authHeaders() });
        if (resp.ok) {
            const json = await resp.json();
            productionOrders = json.data || [];
        }
    } catch (e) { console.error('loadProductionOrders error:', e); }
}

async function saveProductionOrdersData(data) {
    try {
        await fetch('/api/production-orders', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({ data })
        });
    } catch (e) { console.error('saveProductionOrdersData error:', e); }
}

function parseWysokoscGlebokosc(productName) {
    // Parse "H=450/300" from product name like "Dennica DN1000 H=450/300"
    const m = productName && productName.match(/H\s*=\s*(\d+)\s*\/\s*(\d+)/i);
    if (m) return { wysokosc: parseInt(m[1]), glebokosc: parseInt(m[2]) };
    return { wysokosc: 0, glebokosc: 0 };
}

function getStudniaDIN(dn) {
    if ([1000, 1200].includes(dn)) return 'AT/2009-03-1733';
    if ([1500, 2000, 2500].includes(dn)) return 'PN-EN 1917:2004';
    return 'AT/2009-03-1733'; // default for krag_ot
}

function calcStopnieExecution(angle) {
    const a = parseFloat(angle) || 0;
    return a > 0 ? (360 - a) : 0;
}

function openZleceniaProdukcyjne() {
    if (wells.length === 0) {
        showToast('Najpierw dodaj studnie', 'error');
        return;
    }
    const modal = document.getElementById('zlecenia-modal');
    if (modal) modal.classList.add('active');
    
    // MOVEMENT OF MAIN SVG DIAGRAM TO MODAL
    const zwp = document.querySelector('.zlecenia-left');
    const dz = document.getElementById('drop-zone-diagram');
    if (zwp && dz) {
        zwp.innerHTML = ''; // clear original preview container
        zwp.appendChild(dz);
        dz.style.flex = '1';
        dz.style.border = 'none'; // remove outer border if any
        dz.style.background = 'transparent';
        dz.style.padding = '0.8rem 1.2rem'; // Match modal side-padding
    }

    buildZleceniaWellList();
    // Auto select first element
    if (zleceniaElementsList.length > 0) {
        selectZleceniaElement(0);
    }
}

function closeZleceniaModal() {
    const modal = document.getElementById('zlecenia-modal');
    if (modal) modal.classList.remove('active');
    
    // RESTORE MAIN SVG DIAGRAM TO MAIN LAYOUT
    const mainLayout = document.querySelector('.well-app-layout');
    const dz = document.getElementById('drop-zone-diagram');
    if (mainLayout && dz) {
        dz.style.flex = '';
        dz.style.border = '';
        dz.style.background = '';
        dz.style.padding = ''; // Reset inline padding
        mainLayout.insertBefore(dz, mainLayout.firstChild);
    }
}

function buildZleceniaWellList() {
    zleceniaElementsList = [];
    wells.forEach((well, wIdx) => {
        well.config.forEach((item, eIdx) => {
            const p = studnieProducts.find(pr => pr.id === item.productId);
            if (p && (p.componentType === 'dennica' || p.componentType === 'krag_ot')) {
                zleceniaElementsList.push({
                    wellIndex: wIdx,
                    elementIndex: eIdx,
                    well: well,
                    product: p,
                    configItem: item
                });
            }
        });
    });
    renderZleceniaList();
}

function renderZleceniaList() {
    const container = document.getElementById('zlecenia-elements-list');
    const countEl = document.getElementById('zlecenia-el-count');
    if (!container) return;

    const search = (document.getElementById('zlecenia-search')?.value || '').toLowerCase();

    const groupedElements = {};
    let visibleCount = 0;

    zleceniaElementsList.forEach((el, i) => {
        const matchesSearch = !search ||
            el.product.name.toLowerCase().includes(search) ||
            el.well.name.toLowerCase().includes(search) ||
            ('dn' + el.well.dn).toLowerCase().includes(search);
        if (!matchesSearch) return;

        if (!groupedElements[el.wellIndex]) {
            groupedElements[el.wellIndex] = {
                wellName: el.well.name,
                wellDn: el.well.dn,
                elements: []
            };
        }
        groupedElements[el.wellIndex].elements.push({ el, index: i });
        visibleCount++;
    });

    let html = '';
    
    Object.keys(groupedElements).forEach(wIdx => {
        const group = groupedElements[wIdx];
        
        // Well Header
        html += `<div style="background:var(--bg-secondary); padding:0.6rem 0.8rem; border-bottom:1px solid var(--border-glass); border-top:1px solid var(--border-glass); position:sticky; top:0; z-index:5; display:flex; justify-content:space-between; align-items:center; margin-top:-1px;">
            <div style="font-size:0.75rem; font-weight:800; color:#818cf8; text-transform:uppercase; letter-spacing:0.5px;">🏷️ ${group.wellName}</div>
            <div style="font-size:0.65rem; font-weight:700; color:var(--text-muted); background:var(--bg-primary); padding:0.2rem 0.5rem; border-radius:12px; border:1px solid var(--border-glass);">DN${group.wellDn}</div>
        </div>
        <div style="padding: 0.4rem;">`; // wrapper for elements in this well

        group.elements.forEach(item => {
            const el = item.el;
            const i = item.index;
            const isSaved = productionOrders.some(po => po.wellId === el.well.id && po.elementIndex === el.elementIndex);
            const savedOrder = productionOrders.find(po => po.wellId === el.well.id && po.elementIndex === el.elementIndex);
            const isAccepted = savedOrder && savedOrder.status === 'accepted';
            const isActive = i === zleceniaSelectedIdx;
            
            html += `<div class="zlecenia-el-item ${isActive ? 'active' : ''} ${isSaved ? 'saved' : ''} ${isAccepted ? 'accepted' : ''}" onclick="selectZleceniaElement(${i})" style="margin-bottom:0.3rem;">
                <div style="font-size:0.75rem; font-weight:700; color:var(--text-primary);">${el.product.name}</div>
                <div style="display:flex; gap:0.6rem; margin-top:0.15rem; font-size:0.62rem; color:var(--text-muted);">
                    ${el.product.height ? '<span>📐 Wyskokość: ' + el.product.height + 'mm</span>' : ''}
                </div>
                ${isAccepted ? '<div style="font-size:0.55rem; color:#34d399; margin-top:0.2rem; font-weight:700;">🔒 Zaakceptowane — studnia zablokowana</div>' : (isSaved ? '<div style="font-size:0.55rem; color:#fbbf24; margin-top:0.2rem; font-weight:700;">⏳ Wersja robocza</div>' : '')}
            </div>`;
        });
        
        html += `</div>`;
    });

    if (html === '') html = '<div style="text-align:center; padding:1.5rem; color:var(--text-muted); font-size:0.72rem;">Brak elementów (dennic / kręgów z otworem)</div>';
    
    // Remove default padding from the container if we bring our own wrappers
    container.style.padding = '0';
    container.innerHTML = html;
    
    if (countEl) countEl.textContent = visibleCount + ' elementów';
}

function filterZleceniaList() {
    renderZleceniaList();
}

function selectZleceniaElement(idx) {
    zleceniaSelectedIdx = idx;
    renderZleceniaList();
    const el = zleceniaElementsList[idx];
    if (!el) return;
    
    // Set global well context to the order's well
    if (currentWellIndex !== el.wellIndex) {
        currentWellIndex = el.wellIndex;
    }
    
    // Ensure the diagram updates with correct index and UI gets refreshed
    renderWellDiagram();
    
    populateZleceniaForm(el);
}

function renderZleceniaSvgPreview(well) {
    const svg = document.getElementById('zlecenia-svg-preview');
    const info = document.getElementById('zlecenia-well-info-mini');
    if (!svg) return;

    // Use the REAL well diagram renderer with the target SVG
    renderWellDiagram(svg, well);

    if (info) {
        const stats = calcWellStats(well);
        info.innerHTML = `<strong>${well.name}</strong> — DN${well.dn} — H: ${fmtInt(stats.height)}mm — ${fmtInt(stats.weight)}kg`;
    }
}

function populateZleceniaForm(el) {
    const { well, product, configItem, elementIndex, wellIndex } = el;
    const container = document.getElementById('zlecenia-form-content');
    if (!container) return;

    const parsed = parseWysokoscGlebokosc(product.name);
    const dnoKineta = parsed.wysokosc - parsed.glebokosc;
    const din = getStudniaDIN(well.dn);
    const todayStr = new Date().toISOString().split('T')[0];

    // Get user name
    const userName = currentUser ? ((currentUser.firstName || '') + ' ' + (currentUser.lastName || '')).trim() || currentUser.username : '';
    // Get firma from offer client
    const clientName = document.getElementById('client-name')?.value || '';
    const investName = document.getElementById('invest-name')?.value || '';
    const investAddress = document.getElementById('invest-address')?.value || '';
    const investContractor = document.getElementById('invest-contractor')?.value || '';

    // Check for existing saved production order
    const existing = productionOrders.find(po => po.wellId === well.id && po.elementIndex === elementIndex);

    // Compute which element gets which transition to filter for this `elementIndex`
    const rzDna = parseFloat(well.rzednaDna) || 0;
    const configMap = [];
    let currY = 0;
    let dennicaProcessedCount = 0;
    for (let j = well.config.length - 1; j >= 0; j--) {
        const cItem = well.config[j];
        const p = studnieProducts.find(pr => pr.id === cItem.productId);
        if (!p) continue;
        let h = 0;
        if (p.componentType === 'dennica') {
            for (let q = 0; q < cItem.quantity; q++) {
                dennicaProcessedCount++;
                h += (p.height || 0) - (dennicaProcessedCount > 1 ? 100 : 0);
            }
        } else {
            h = (p.height || 0) * cItem.quantity;
        }
        configMap.push({ index: j, name: p.name, start: currY, end: currY + h });
        currY += h;
    }

    // Filter transitions assigned to this element
    const assignedPrzejscia = (well.przejscia || []).filter(item => {
        let pel = parseFloat(item.rzednaWlaczenia);
        if (isNaN(pel)) pel = rzDna;
        const mmFromBottom = (pel - rzDna) * 1000;
        let assignedIndex = -1;
        for (let cm of configMap) {
            if (mmFromBottom >= cm.start && mmFromBottom < cm.end) {
                assignedIndex = cm.index;
                break;
            }
        }
        if (assignedIndex === -1 && configMap.length > 0) {
            assignedIndex = (mmFromBottom < 0) ? configMap[0].index : configMap[configMap.length - 1].index;
        }
        return assignedIndex === elementIndex;
    });
    const przejsciaCount = assignedPrzejscia.length;

    // Stopnie select — derive current value
    const stopnieVal = existing?.rodzajStopni || '';
    const stopnieOptions = [
        ['', 'Brak'],
        ['drabinka_a_stalowa', 'Drabinka Typ A/stalowa'],
        ['drabinka_a_szlachetna', 'Drabinka Typ A/stal szlachetna'],
        ['drabinka_b_stalowa', 'Drabinka Typ B/stalowa'],
        ['drabinka_b_szlachetna', 'Drabinka Typ B/stal szlachetna'],
        ['inne', 'Inne']
    ];

    const katStopni = existing?.katStopni || '';
    const wykonanie = katStopni ? calcStopnieExecution(katStopni) : '';

    // Values for tiles
    const redKinetyVal = existing?.redukcjaKinety ?? well.redukcjaKinety ?? '';
    const spocznikHVal = existing?.spocznikH ?? well.spocznikH ?? '';
    const usytuowanieVal = existing?.usytuowanie ?? well.usytuowanie ?? '';
    const kinetaVal = existing?.kineta ?? well.kineta ?? '';
    const klasaBetonuVal = existing?.klasaBetonu ?? well.klasaBetonu ?? '';
    
    // Quick tiles for kat stopni
    const katOptions = ['90', '135', '180', '270'];
    
    const dinOptions = [
        ['AT/2009-03-1733', 'AT/2009-03-1733'],
        ['Brak', 'Brak']
    ];
    
    const spocznikMatOptions = [
        ['brak', 'Brak'], ['beton_gfk', 'Beton z GFK'], ['klinkier', 'Klinkier'],
        ['preco', 'Preco'], ['precotop', 'Preco Top'], ['unolith', 'UnoLith'],
        ['predl', 'Predl'], ['kamionka', 'Kamionka']
    ];
    
    const rodzajStudniOptions = [
        ['beton', 'Beton'], ['zelbet', 'Żelbet']
    ];
    
    const dinVal = existing?.din ?? din;
    const spocznikMatVal = existing?.spocznik ?? '';
    
    let domyslnyRodzajStudni = '';
    if (product && product.componentType === 'dennica') {
        domyslnyRodzajStudni = (well.dennicaMaterial === 'zelbetowa') ? 'zelbet' : 'beton';
    } else {
        domyslnyRodzajStudni = (well.nadbudowa === 'zelbetowa') ? 'zelbet' : 'beton';
    }
    const rodzajStudniVal = existing?.rodzajStudni || domyslnyRodzajStudni;

    // Map well params to display labels
    const kinetaOptions = [
        ['brak', 'Brak'], ['beton', 'Beton'], ['beton_gfk', 'Beton GFK'],
        ['klinkier', 'Klinkier'], ['preco', 'Preco'], ['precotop', 'PrecoTop'], ['unolith', 'UnoLith']
    ];
    const spocznikOptions = [
        ['1/2', '1/2'], ['2/3', '2/3'], ['3/4', '3/4'], ['1/1', '1/1'], ['brak', 'Brak']
    ];
    const usytOptions = [
        ['linia_dolna', 'Linia dolna'], ['linia_gorna', 'Linia górna'],
        ['w_osi', 'W osi'], ['patrz_uwagi', 'Patrz uwagi']
    ];
    const redKinetyOptions = [
        ['tak', 'Tak'], ['nie', 'Nie']
    ];
    const klasaBetonuOptions = [
        ['C40/50', 'C40/50'], ['C40/50(HSR!!!!)', 'C40/50 HSR'],
        ['C45/55', 'C45/55'], ['C45/55(HSR!!!!)', 'C45/55 HSR'],
        ['C70/85', 'C70/85'], ['C70/80(HSR!!!!)', 'C70/80 HSR']
    ];

    container.innerHTML = `
    <!-- Dane zlecenia -->
    <div class="card card-compact" style="margin-bottom:0.5rem;">
        <div class="card-title-sm" onclick="const b=this.nextElementSibling; b.style.display=b.style.display==='none'?'grid':'none'; this.querySelector('.zl-toggle').textContent=b.style.display==='none'?'▶':'▼';" style="cursor:pointer; user-select:none; display:flex; justify-content:space-between; align-items:center;">
            <span>📋 Dane zlecenia</span>
            <span class="zl-toggle" style="font-size:0.6rem; color:var(--text-muted);">▶</span>
        </div>
        <div style="display:none; grid-template-columns:1fr 1fr; gap:0.5rem; padding:0.2rem 0;">
            <div class="form-group-sm" style="margin:0;">
                <label class="form-label-sm" style="color:var(--text-secondary);">Obiekt</label>
                <input type="text" id="zl-obiekt" class="form-input form-input-sm" value="${existing?.obiekt || investName}" placeholder="Nazwa obiektu...">
            </div>
            <div class="form-group-sm" style="margin:0;">
                <label class="form-label-sm" style="color:var(--text-secondary);">Data</label>
                <input type="text" id="zl-data" class="form-input form-input-sm" value="${existing?.data || todayStr}" readonly style="background:rgba(255,255,255,0.02); color:#818cf8; font-weight:700;">
            </div>
            <div class="form-group-sm" style="margin:0;">
                <label class="form-label-sm" style="color:var(--text-secondary);">Adres</label>
                <input type="text" id="zl-adres" class="form-input form-input-sm" value="${existing?.adres || investAddress}" placeholder="Adres obiektu...">
            </div>
            <div class="form-group-sm" style="margin:0;">
                <label class="form-label-sm" style="color:var(--text-secondary);">Nazwisko (przygotował)</label>
                <input type="text" id="zl-nazwisko" class="form-input form-input-sm" value="${existing?.nazwisko || userName}" readonly style="background:rgba(255,255,255,0.02); color:#818cf8; font-weight:700;">
            </div>
            <div class="form-group-sm" style="margin:0;">
                <label class="form-label-sm" style="color:var(--text-secondary);">Wykonawca</label>
                <input type="text" id="zl-wykonawca" class="form-input form-input-sm" value="${existing?.wykonawca || investContractor}" placeholder="Wykonawca...">
            </div>
            <div class="form-group-sm" style="margin:0;">
                <label class="form-label-sm" style="color:var(--text-secondary);">Data produkcji</label>
                <input type="date" id="zl-data-produkcji" class="form-input form-input-sm" value="${existing?.dataProdukcji || ''}">
            </div>
            <div class="form-group-sm" style="grid-column: 1 / -1; margin:0;">
                <label class="form-label-sm" style="color:var(--text-secondary);">Fakturowane na</label>
                <input type="text" id="zl-fakturowane" class="form-input form-input-sm" value="${existing?.fakturowane || clientName}" readonly style="background:rgba(255,255,255,0.02); color:#818cf8; font-weight:700;">
            </div>
        </div>
    </div>

    <!-- Dane studni + Przejścia side by side -->
    <div style="display:grid; grid-template-columns:0.8fr 1.8fr; gap:0.5rem; margin-bottom:0.5rem;">
        <div class="card card-compact">
            <div class="card-title-sm">🏗️ Dane elementu</div>
            <div style="display:flex; flex-direction:column; gap:0.5rem; font-size:0.75rem;">
                <!-- Numer Studni -->
                <div style="display:flex; align-items:center; gap:0.5rem;">
                    <span style="color:var(--text-secondary); font-size:0.75rem; text-transform:uppercase; font-weight:600;">Numer studni</span>
                    <span style="font-weight:bold; color:#818cf8; font-size:0.85rem;">${well.name || ''}</span>
                </div>
                
                <!-- Underneath list -->
                <div style="display:flex; flex-direction:column; gap:0.4rem; margin-top:0.2rem; background:#0d1520; padding:0.6rem; border-radius:var(--radius-sm); border:1px solid var(--border-glass);">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="color:var(--text-muted); font-size:0.65rem; text-transform:uppercase;">Średnica</span>
                        <span style="font-weight:bold; color:var(--text-primary); font-size:0.75rem;">DN${well.dn}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="color:var(--text-muted); font-size:0.65rem; text-transform:uppercase;">Głębokość</span>
                        <span style="font-weight:bold; color:var(--text-primary); font-size:0.75rem;">${parsed.glebokosc || '—'} mm</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="color:var(--text-muted); font-size:0.65rem; text-transform:uppercase;">Wysokość</span>
                        <span style="font-weight:bold; color:var(--text-primary); font-size:0.75rem;">${parsed.wysokosc || (product.height || 0)} mm</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; padding-top:0.3rem; margin-top:0.1rem; border-top:1px dashed rgba(255,255,255,0.1);">
                        <span style="color:var(--text-muted); font-size:0.65rem; text-transform:uppercase;">Grubość dna</span>
                        <span style="font-weight:bold; color:var(--text-primary); font-size:0.75rem;">${dnoKineta > 0 ? dnoKineta + ' mm' : '—'}</span>
                    </div>
                </div>
                
                <!-- Rodzaj studni -->
                <div class="form-group-sm" style="margin-top:0.3rem;">
                    <label class="form-label-sm" style="color:var(--text-secondary);">Rodzaj studni</label>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; margin-top:0.3rem;" class="zl-param-group">
                        ${rodzajStudniOptions.map(([v, l]) =>
                            `<button type="button" class="param-tile ${v === rodzajStudniVal ? 'active' : ''}" style="padding:0.8rem; font-size:0.95rem; font-weight:800; letter-spacing:0.5px; border-radius:8px;" onclick="selectZleceniaTile(this, 'zl-rodzaj-studni', '${v}')">${l}</button>`
                        ).join('')}
                    </div>
                    <input type="hidden" id="zl-rodzaj-studni" value="${rodzajStudniVal}">
                </div>

            </div>
        </div>

        <div class="card card-compact">
            <div class="card-title-sm" style="display:flex; justify-content:space-between;">
                <span>🔗 Przejścia </span>
                <span style="color:var(--text-muted); font-size:0.7rem;">(${przejsciaCount})</span>
            </div>
            <div id="zlecenia-przejscia-mirror" style="border-radius:var(--radius-sm); font-size:0.72rem; color:var(--text-secondary); height:-webkit-fill-available;">
            </div>
        </div>
    </div>

    <!-- Uwagi -->
    <div class="card card-compact" style="margin-bottom:0.5rem;">
        <div class="card-title-sm">📝 Uwagi</div>
        <div class="form-group-sm">
            <textarea id="zl-uwagi" class="form-textarea" rows="3" placeholder="Uwagi do zlecenia..." style="min-height:50px;">${existing?.uwagi || ''}</textarea>
        </div>
    </div>

    <!-- Parametry studni w dwóch kolumnach -->
    <div class="card card-compact" style="margin-bottom:0.5rem;">
        <div class="card-title-sm">⚙️ Parametry studni</div>
        
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; align-items:start;">
            <!-- Kolumna 1 -->
            <div style="display:flex; flex-direction:column; gap:0.5rem;">
                <div class="form-group-sm">
                    <label class="form-label-sm">Redukcja kinety</label>
                    <div style="display:flex; gap:0.25rem; flex-wrap:wrap; margin-top:0.2rem;" class="zl-param-group">
                        ${redKinetyOptions.map(([v, l]) =>
                            `<button type="button" class="param-tile ${v === redKinetyVal ? 'active' : ''}" style="padding:0.35rem 0.5rem; font-size:0.65rem;" onclick="selectZleceniaTile(this, 'zl-red-kinety', '${v}')">${l}</button>`
                        ).join('')}
                    </div>
                    <input type="hidden" id="zl-red-kinety" value="${redKinetyVal}">
                </div>

                <div class="form-group-sm">
                    <label class="form-label-sm">Studnia wd. DIN</label>
                    <div style="display:flex; gap:0.25rem; flex-wrap:wrap; margin-top:0.2rem;" class="zl-param-group">
                        <input type="text" id="zl-din" class="form-input form-input-sm" value="${dinVal}" style="width:140px; margin-right:5px; color:#818cf8; font-weight:700;">
                        ${dinOptions.map(([v, l]) =>
                            `<button type="button" class="param-tile" style="padding:0.35rem 0.5rem; font-size:0.65rem;" onclick="document.getElementById('zl-din').value='${v}'">${l}</button>`
                        ).join('')}
                    </div>
                </div>

                <div class="form-group-sm">
                    <label class="form-label-sm">Rodzaj stopni</label>
                    <div style="display:flex; gap:0.25rem; flex-wrap:wrap; margin-top:0.2rem;" class="zl-param-group">
                        ${stopnieOptions.map(([v, l]) =>
                            `<button type="button" class="param-tile ${v === stopnieVal ? 'active' : ''}" style="padding:0.35rem 0.5rem; font-size:0.65rem;" onclick="selectZleceniaTile(this, 'zl-rodzaj-stopni', '${v}')">${l}</button>`
                        ).join('')}
                    </div>
                    <input type="hidden" id="zl-rodzaj-stopni" value="${stopnieVal}">
                </div>

                <div id="zl-stopnie-inne-wrap" style="display:${stopnieVal === 'inne' ? 'block' : 'none'};">
                    <div class="form-group-sm">
                        <label class="form-label-sm">Inne (opis)</label>
                        <input type="text" id="zl-stopnie-inne" class="form-input form-input-sm" value="${existing?.stopnieInne || ''}" placeholder="Opis...">
                    </div>
                </div>

                <div class="form-group-sm">
                    <label class="form-label-sm">Ustalanie kąta stopni / Wykonanie</label>
                    <div style="display:flex; gap:0.25rem; flex-wrap:wrap; margin-top:0.2rem; align-items:center;" class="zl-param-group">
                        <input type="number" id="zl-kat-stopni" class="form-input form-input-sm" value="${katStopni}" placeholder="np. 90" min="0" max="360" onfocus="this.value=''" oninput="onZleceniaKatChange()" style="width:70px;">
                        <span style="font-size:1.2rem; color:var(--text-muted); margin: 0 4px;">→</span>
                        <input type="text" id="zl-wykonanie" class="form-input form-input-sm" value="${wykonanie ? wykonanie + '°' : ''}" readonly style="width:70px; color:#818cf8; font-weight:700; margin-right:5px; pointer-events:none;">
                        ${katOptions.map(v =>
                            `<button type="button" class="param-tile" style="padding:0.35rem 0.5rem; font-size:0.65rem;" onclick="document.getElementById('zl-kat-stopni').value='${v}'; onZleceniaKatChange();">${v}°</button>`
                        ).join('')}
                    </div>
                </div>
            </div>

            <!-- Kolumna 2 -->
            <div style="display:flex; flex-direction:column; gap:0.5rem;">
                <div class="form-group-sm">
                    <label class="form-label-sm">Wysokość spocznika</label>
                    <div style="display:flex; gap:0.25rem; flex-wrap:wrap; margin-top:0.2rem;" class="zl-param-group">
                        ${spocznikOptions.map(([v, l]) =>
                            `<button type="button" class="param-tile ${v === spocznikHVal ? 'active' : ''}" style="padding:0.35rem 0.5rem; font-size:0.65rem;" onclick="selectZleceniaTile(this, 'zl-spocznik-h', '${v}')">${l}</button>`
                        ).join('')}
                    </div>
                    <input type="hidden" id="zl-spocznik-h" value="${spocznikHVal}">
                </div>

                <div class="form-group-sm">
                    <label class="form-label-sm">Usytuowanie</label>
                    <div style="display:flex; gap:0.25rem; flex-wrap:wrap; margin-top:0.2rem;" class="zl-param-group">
                        ${usytOptions.map(([v, l]) =>
                            `<button type="button" class="param-tile ${v === usytuowanieVal ? 'active' : ''}" style="padding:0.35rem 0.5rem; font-size:0.65rem;" onclick="selectZleceniaTile(this, 'zl-usytuowanie', '${v}')">${l}</button>`
                        ).join('')}
                    </div>
                    <input type="hidden" id="zl-usytuowanie" value="${usytuowanieVal}">
                </div>

                <div class="form-group-sm">
                    <label class="form-label-sm">Kineta</label>
                    <div style="display:flex; gap:0.25rem; flex-wrap:wrap; margin-top:0.2rem;" class="zl-param-group">
                        ${kinetaOptions.map(([v, l]) =>
                            `<button type="button" class="param-tile ${v === kinetaVal ? 'active' : ''}" style="padding:0.35rem 0.5rem; font-size:0.65rem;" onclick="selectZleceniaTile(this, 'zl-kineta', '${v}')">${l}</button>`
                        ).join('')}
                    </div>
                    <input type="hidden" id="zl-kineta" value="${kinetaVal}">
                </div>

                <div class="form-group-sm">
                    <label class="form-label-sm">Spocznik</label>
                    <div style="display:flex; gap:0.25rem; flex-wrap:wrap; margin-top:0.2rem;" class="zl-param-group">
                        ${spocznikMatOptions.map(([v, l]) =>
                            `<button type="button" class="param-tile ${v === spocznikMatVal ? 'active' : ''}" style="padding:0.35rem 0.5rem; font-size:0.65rem;" onclick="selectZleceniaTile(this, 'zl-spocznik', '${v}')">${l}</button>`
                        ).join('')}
                    </div>
                    <input type="hidden" id="zl-spocznik" value="${spocznikMatVal}">
                </div>

                <div class="form-group-sm">
                    <label class="form-label-sm">Klasa betonu</label>
                    <div style="display:flex; gap:0.25rem; flex-wrap:wrap; margin-top:0.2rem;" class="zl-param-group">
                        ${klasaBetonuOptions.map(([v, l]) =>
                            `<button type="button" class="param-tile ${v === klasaBetonuVal ? 'active' : ''}" style="padding:0.35rem 0.5rem; font-size:0.65rem;" onclick="selectZleceniaTile(this, 'zl-klasa-betonu', '${v}')">${l}</button>`
                        ).join('')}
                    </div>
                    <input type="hidden" id="zl-klasa-betonu" value="${klasaBetonuVal}">
                </div>
            </div>
        </div>
    </div>
    `;
    // Render filtered przejścia into the mirror container
    const mirrorEl = document.getElementById('zlecenia-przejscia-mirror');
    if (mirrorEl) {
        if (assignedPrzejscia.length === 0) {
            mirrorEl.innerHTML = '<div style="padding:1.2rem; text-align:center; color:var(--text-muted); border:1px dashed rgba(255,255,255,0.1); border-radius:8px; font-size:0.75rem;">Brak przejść szczelnych<br>w tym elemencie.</div>';
        } else {
            mirrorEl.innerHTML = assignedPrzejscia.map((item, i) => {
                const przProd = studnieProducts.find(pr => pr.id === item.productId);
                const przName = przProd ? przProd.category : 'Nieznane';
                const dn = przProd ? przProd.dn : '—';
                if (!item.flowType) {
                    item.flowType = (i === 0 && (item.angle === 0 || item.angle === '0')) ? 'wylot' : 'wlot';
                }
                const flowLabel = item.flowType === 'wylot' ? 'Wylot' : 'Wlot';
                const flowBg = item.flowType === 'wylot' ? 'rgba(239,68,68,0.2)' : 'rgba(59,130,246,0.2)';
                const flowColor = item.flowType === 'wylot' ? '#fca5a5' : '#93c5fd';
                const flowBorder = item.flowType === 'wylot' ? 'rgba(239,68,68,0.6)' : 'rgba(59,130,246,0.6)';
                const flowIcon = item.flowType === 'wylot' ? '📤' : '📥';
                const angleColor = (item.angle === 0 || item.angle === '0') ? '#6366f1' : '#818cf8';

                return `<div style="background:linear-gradient(90deg, rgba(30,58,138,0.3) 0%, rgba(30,41,59,0.8) 100%); border:1px solid rgba(255,255,255,0.05); border-left:5px solid ${flowBorder}; border-radius:10px; padding:0.45rem; margin-bottom:0.4rem; display:flex; align-items:center; gap:0.5rem;">
                    <div style="background:${flowBg}; color:${flowColor}; border:1px solid ${flowBorder}; border-radius:8px; padding:0.3rem 0.5rem; display:flex; flex-direction:column; align-items:center; min-width:55px;">
                        <span style="font-size:1.1rem; margin-bottom:0.1rem;">${flowIcon}</span>
                        <span style="font-size:0.6rem; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">${flowLabel}</span>
                    </div>
                    <div style="flex:1; display:flex; justify-content:space-between; align-items:center; gap:0.8rem;">
                        <div style="display:flex; flex-direction:column; gap:0.15rem;">
                            <div style="display:flex; align-items:center; gap:0.6rem;">
                                <span style="font-size:1.0rem; font-weight:800; color:var(--text-primary);">${przName}</span>
                                <span style="font-size:1.0rem; color:#a78bfa; font-weight:800;">${typeof dn === 'string' && dn.includes('/') ? dn : 'DN ' + dn}</span>
                            </div>
                            ${item.notes ? `<div style="font-size:0.65rem; color:#94a3b8; font-style:italic; margin-top:2px;">📝 ${item.notes}</div>` : ''}
                        </div>
                        <div style="display:flex; align-items:center; gap:1.5rem; margin-right:0.5rem;">
                            <div style="text-align:center; min-width:60px;">
                                <div style="font-size:0.6rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.1rem;">Spadek w kinecie</div>
                                <div style="font-size:0.9rem; font-weight:700; color:var(--text-primary);">${item.spadekKineta != null && item.spadekKineta !== '' ? item.spadekKineta + '%' : '—'}</div>
                            </div>
                            <div style="text-align:center; min-width:60px;">
                                <div style="font-size:0.6rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.1rem;">Spadek w mufie</div>
                                <div style="font-size:0.9rem; font-weight:700; color:var(--text-primary);">${item.spadekMufa != null && item.spadekMufa !== '' ? item.spadekMufa + '%' : '—'}</div>
                            </div>
                            <div style="text-align:center; min-width:80px;">
                                <div style="font-size:0.6rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.1rem;">Rzędna</div>
                                <div style="font-size:1.05rem; font-weight:800; color:var(--text-primary);">${item.rzednaWlaczenia || '—'}</div>
                            </div>
                            <div style="text-align:center; min-width:80px;">
                                <div style="font-size:0.6rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.1rem;">Kąt</div>
                                <div style="font-size:1.05rem; font-weight:800; color:${angleColor};">${item.angle}°</div>
                            </div>
                        </div>
                    </div>
                </div>`;
            }).join('');
        }
    }
}

function selectZleceniaTile(btn, targetId, val) {
    const group = btn.closest('.zl-param-group');
    if (group) {
        group.querySelectorAll('.param-tile').forEach(b => b.classList.remove('active'));
    }
    btn.classList.add('active');
    
    const input = document.getElementById(targetId);
    if (input) {
        input.value = val;
    }
    
    if (targetId === 'zl-rodzaj-stopni') {
        onZleceniaStopnieChange();
    }
}

function onZleceniaStopnieChange() {
    const hiddenInput = document.getElementById('zl-rodzaj-stopni');
    const wrap = document.getElementById('zl-stopnie-inne-wrap');
    if (hiddenInput && wrap) {
        wrap.style.display = hiddenInput.value === 'inne' ? 'block' : 'none';
    }
}

function onZleceniaKatChange() {
    const katInput = document.getElementById('zl-kat-stopni');
    const wykInput = document.getElementById('zl-wykonanie');
    if (katInput && wykInput) {
        const angle = parseFloat(katInput.value) || 0;
        const exec = angle > 0 ? calcStopnieExecution(angle) : '';
        wykInput.value = exec ? exec + '°' : '';
    }
}

async function saveProductionOrder() {
    if (zleceniaSelectedIdx < 0 || !zleceniaElementsList[zleceniaSelectedIdx]) {
        showToast('Najpierw wybierz element z listy', 'error');
        return;
    }

    const el = zleceniaElementsList[zleceniaSelectedIdx];
    const { well, product, elementIndex, wellIndex } = el;

    const existingIdx = productionOrders.findIndex(po => po.wellId === well.id && po.elementIndex === elementIndex);

    const order = {
        id: existingIdx >= 0 ? productionOrders[existingIdx].id : 'prodorder_' + Date.now(),
        userId: currentUser ? currentUser.id : null,
        wellId: well.id,
        wellName: well.name,
        elementIndex: elementIndex,
        productName: product.name,
        productId: product.id,
        dn: well.dn,

        // Form fields
        obiekt: document.getElementById('zl-obiekt')?.value || '',
        data: document.getElementById('zl-data')?.value || '',
        adres: document.getElementById('zl-adres')?.value || '',
        nazwisko: document.getElementById('zl-nazwisko')?.value || '',
        wykonawca: document.getElementById('zl-wykonawca')?.value || '',
        dataProdukcji: document.getElementById('zl-data-produkcji')?.value || '',
        fakturowane: document.getElementById('zl-fakturowane')?.value || '',

        // Well specs
        snr: well.numer || '',
        srednica: well.dn,
        wysokosc: document.getElementById('zl-wysokosc')?.value || '',
        glebokosc: document.getElementById('zl-glebokosc')?.value || '',
        dnoKineta: document.getElementById('zl-dno-kineta')?.value || '',
        rodzajStudni: document.getElementById('zl-rodzaj-studni')?.value || '',

        // Przejscia snapshot
        przejscia: well.przejscia ? JSON.parse(JSON.stringify(well.przejscia)) : [],

        uwagi: document.getElementById('zl-uwagi')?.value || '',

        // Params
        redukcjaKinety: document.getElementById('zl-red-kinety')?.value || '',
        spocznikH: document.getElementById('zl-spocznik-h')?.value || '',
        din: document.getElementById('zl-din')?.value || getStudniaDIN(well.dn),
        rodzajStopni: document.getElementById('zl-rodzaj-stopni')?.value || '',
        stopnieInne: document.getElementById('zl-stopnie-inne')?.value || '',
        katStopni: document.getElementById('zl-kat-stopni')?.value || '',
        wykonanie: document.getElementById('zl-wykonanie')?.value || '',
        usytuowanie: document.getElementById('zl-usytuowanie')?.value || '',
        kineta: document.getElementById('zl-kineta')?.value || '',
        spocznik: document.getElementById('zl-spocznik')?.value || '',
        klasaBetonu: document.getElementById('zl-klasa-betonu')?.value || '',

        createdAt: existingIdx >= 0 ? productionOrders[existingIdx].createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: existingIdx >= 0 ? (productionOrders[existingIdx].status || 'draft') : 'draft'
    };

    if (existingIdx >= 0) {
        productionOrders[existingIdx] = order;
    } else {
        productionOrders.push(order);
    }

    await saveProductionOrdersData(productionOrders);
    renderZleceniaList();
    showToast('✅ Zlecenie produkcyjne zapisane', 'success');
}

async function deleteProductionOrder(id) {
    if (!confirm('Usunąć to zlecenie produkcyjne?')) return;
    try {
        await fetch('/api/production-orders/' + id, {
            method: 'DELETE',
            headers: authHeaders()
        });
        productionOrders = productionOrders.filter(po => po.id !== id);
        renderZleceniaList();
        showToast('Zlecenie usunięte', 'info');
    } catch (e) { console.error('deleteProductionOrder error:', e); }
}

async function acceptProductionOrder() {
    if (zleceniaSelectedIdx < 0 || !zleceniaElementsList[zleceniaSelectedIdx]) {
        showToast('Najpierw wybierz element z listy', 'error');
        return;
    }
    const el = zleceniaElementsList[zleceniaSelectedIdx];
    const po = productionOrders.find(p => p.wellId === el.well.id && p.elementIndex === el.elementIndex);
    if (!po) { showToast('Najpierw zapisz zlecenie produkcyjne', 'error'); return; }
    if (po.status === 'accepted') { showToast('Zlecenie już zaakceptowane', 'info'); return; }
    if (!confirm('Zaakceptować zlecenie? Studnia zostanie zablokowana od edycji.')) return;
    po.status = 'accepted';
    po.acceptedAt = new Date().toISOString();
    po.acceptedBy = currentUser ? currentUser.username : '';
    await saveProductionOrdersData(productionOrders);
    renderZleceniaList();
    showToast('🔒 Zlecenie zaakceptowane — studnia zablokowana', 'success');
}

async function revokeProductionOrder() {
    if (zleceniaSelectedIdx < 0 || !zleceniaElementsList[zleceniaSelectedIdx]) {
        showToast('Najpierw wybierz element z listy', 'error');
        return;
    }
    const el = zleceniaElementsList[zleceniaSelectedIdx];
    const po = productionOrders.find(p => p.wellId === el.well.id && p.elementIndex === el.elementIndex);
    if (!po) { showToast('Brak zlecenia do cofnięcia', 'error'); return; }
    if (po.status !== 'accepted') { showToast('Zlecenie nie jest zaakceptowane', 'info'); return; }
    if (!confirm('Cofnąć akceptację? Studnia zostanie odblokowana.')) return;
    po.status = 'draft';
    delete po.acceptedAt;
    delete po.acceptedBy;
    await saveProductionOrdersData(productionOrders);
    renderZleceniaList();
    showToast('🔓 Akceptacja cofnięta — studnia odblokowana', 'info');
}

window.openZleceniaProdukcyjne = openZleceniaProdukcyjne;
window.closeZleceniaModal = closeZleceniaModal;
window.selectZleceniaElement = selectZleceniaElement;
window.filterZleceniaList = filterZleceniaList;
window.saveProductionOrder = saveProductionOrder;
window.deleteProductionOrder = deleteProductionOrder;
window.acceptProductionOrder = acceptProductionOrder;
window.revokeProductionOrder = revokeProductionOrder;
window.onZleceniaStopnieChange = onZleceniaStopnieChange;
window.onZleceniaKatChange = onZleceniaKatChange;

document.addEventListener('DOMContentLoaded', () => { setTimeout(() => { setupParamTiles(); updateParamTilesUI(); loadProductionOrders(); }, 500); });
