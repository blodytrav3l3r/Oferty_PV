// @ts-check
/* ===== ZMIENNE GLOBALNE ===== */
/** @type {any[]} */
const studnieProducts = [];
const currentUser = null;
const currentCennikTab = 'dn1000';

// System wielu studni
const wells = []; // Tablica obiektów { id, name, dn, config: [{ productId, quantity }], rzednaWlazu, rzednaDna }
const currentWellIndex = 0;
const wellCounter = 1;
var wellDiscounts = {}; // Rabaty na DN: { 1000: { dennica: 0, nadbudowa: 0, preco: 0 }, ... }
var precoPricing = {}; // Cennik wkładek PRECO: { 1000: { kinety: [...], ... }, ... }

// Globalne domyślne parametry oferty (utrzymują się do czasu ręcznej zmiany)
const offerDefaultZakonczenie = null; // ID produktu lub null (=konus)
const offerDefaultRedukcja = false; // true = redukcja do DN1000
const offerDefaultRedukcjaMinH = 2500; // minimalna wysokość sekcji dennej w mm
const offerDefaultRedukcjaZak = null; // ID produktu dla górnego zakończenia redukcji (DN1000)

// System wielu ofert
const offersStudnie = [];
const ordersStudnie = [];
const editingOfferIdStudnie = null;
var isSavingOffer = false;
/** @type {any} */
var orderEditMode = null; // Podczas edycji zamówienia: { orderId, order }

const expandedWellIndices = new Set();
// clientsDb jest zarządzane przez AppState (shared/appState.js)
// Używać AppState.clientsDb zamiast lokalnej zmiennej

// Stan kreatora
const currentWizardStep = 1;
const wizardConfirmedParams = new Set();
let studnieViewTransitionTimer = null;
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
    'uszczelka',
    'magazyn'
];

/* ===== FORMATOWANIE ===== */
// fmt() i fmtInt() — dostępne z shared/formatters.js

/* ===== AUTH ===== */
// getAuthToken(), authHeaders(), appLogout() — dostępne z shared/auth.js

/* ===== TOASTY ===== */
// showToast() — dostępne z shared/ui.js

/* ===== PRZEŁĄCZANIE KART ===== */
function toggleCard(contentId, iconId) {
    const content = document.getElementById(contentId);
    const icon = document.getElementById(iconId);
    if (!content) return;
    const isOpen = content.style.display !== 'none';
    content.style.display = isOpen ? 'none' : 'block';
    if (icon)
        icon.innerHTML = isOpen
            ? '<span class="text-xs"><i data-lucide="chevron-down"></i></span>'
            : '<span class="text-xs"><i data-lucide="chevron-up"></i></span>';
}

/* ===== NAWIGACJA ===== */
function startStudnieViewTransition(duration = 180) {
    const main = document.querySelector('main.main') || document.body;
    if (!main) return;
    window.clearTimeout(studnieViewTransitionTimer);
    main.classList.add('studnie-view-transitioning');
    studnieViewTransitionTimer = window.setTimeout(() => {
        main.classList.remove('studnie-view-transitioning');
    }, duration);
}

function showSectionStudnie(id) {
    startStudnieViewTransition();
    document.querySelectorAll('.section').forEach((s) => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
    document.getElementById('section-' + id)?.classList.add('active');
    document.querySelector(`.nav-btn[data-section="${id}"]`)?.classList.add('active');

    // Cleanup well drag listeners when leaving builder section
    if (id !== 'builder' && typeof window.cleanupWellDragListeners === 'function') {
        window.cleanupWellDragListeners();
    }

    if (id === 'pricelist') renderStudniePriceList();
    if (id === 'offer') {
        syncOfferClientSummary();
        renderOfferSummary();

        // Baner kontekstu
        const ctxBanner = document.getElementById('offer-context-banner-studnie');
        const ctxBadge = document.getElementById('offer-context-badge-studnie');
        const ctxText = document.getElementById('offer-context-text-studnie');
        if (ctxBanner && ctxBadge && ctxText) {
            ctxBanner.style.display = 'block';
            if (orderEditMode) {
                ctxBadge.innerHTML =
                    '<i data-lucide="package" class="icon-xs"></i> Zamówienie (krok 5)';
                ctxBadge.classList.add('badge-ok');
                ctxText.textContent =
                    'Podgląd zamówienia — dane pochodzą z zatwierdzonego zamówienia.';
            } else if (editingOfferIdStudnie) {
                ctxBadge.innerHTML = '<i data-lucide="edit" class="icon-xs"></i> Oferta (krok 3)';
                ctxBadge.classList.add('badge-info');
                ctxText.textContent = 'Podgląd oferty — edytuj pozycje w zakładce Konfiguracja.';
            } else {
                ctxBadge.innerHTML = '<i data-lucide="file-text" class="icon-xs"></i> Nowa oferta';
                ctxBadge.classList.add('badge-muted');
                ctxText.textContent = 'Dodaj produkty w zakładce Konfiguracja.';
            }
            if (window.lucide) lucide.createIcons();
        }
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

/* ===== NUMER OFERTY ===== */
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

/** Narzędzie do usuwania prefiksów ze złożonych identyfikatorów, np. offer:studnie:user:uuid */
function normalizeId(id) {
    if (!id || typeof id !== 'string') return id;
    if (id.includes(':')) return id.split(':').pop();
    return id;
}
