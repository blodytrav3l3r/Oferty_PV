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
let offerDefaultZakonczenie = null; // product ID or null (=konus)
let offerDefaultRedukcja = false; // true = reduction to DN1000
let offerDefaultRedukcjaMinH = 2500; // minimum bottom section height in mm
let offerDefaultRedukcjaZak = null; // product ID for reduction top closure (DN1000)

// Multi-offer system
let offersStudnie = [];
let ordersStudnie = [];
let editingOfferIdStudnie = null;
let isSavingOffer = false;
let orderEditMode = null; // When editing an order: { orderId, order }
let clientsDb = [];

// Wizard state
let currentWizardStep = 1;
let wizardConfirmedParams = new Set();
const WIZARD_REQUIRED_PARAMS = [
    'nadbudowa',
    'dennicaMaterial',
    'wkladka',
    'klasaBetonu',
    'agresjaChemiczna',
    'agresjaMrozowa',
    'klasaNosnosci_korpus',
    'klasaNosnosci_zwienczenie',
    'malowanieW',
    'malowanieZ',
    'kineta',
    'spocznik',
    'redukcjaKinety',
    'stopnie',
    'spocznikH',
    'usytuowanie',
    'magazyn'
];

/* ===== FORMATTING ===== */
// fmt() i fmtInt() — dostępne z shared/formatters.js

/* ===== AUTH ===== */
// getAuthToken(), authHeaders(), appLogout() — dostępne z shared/auth.js

/* ===== TOAST ===== */
// showToast() — dostępne z shared/ui.js

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
    document.querySelectorAll('.section').forEach((s) => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
    document.getElementById('section-' + id)?.classList.add('active');
    document.querySelector(`.nav-btn[data-section="${id}"]`)?.classList.add('active');

    if (id === 'pricelist') renderStudniePriceList();
    if (id === 'offer') {
        syncOfferClientSummary();
        renderOfferSummary();
    }
}

function syncOfferClientSummary() {
    const v = (id) => document.getElementById(id)?.value || '—';
    const s = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };
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
    let symbol = 'XX';
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

/** Utility to strip prefixes from compound IDs like offer:studnie:user:uuid */
function normalizeId(id) {
    if (!id || typeof id !== 'string') return id;
    if (id.includes(':')) return id.split(':').pop();
    return id;
}
