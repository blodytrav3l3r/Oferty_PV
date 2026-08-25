// @ts-check
/* ===== ZMIENNE GLOBALNE ===== */
/** @type {any[]} */
let studnieProducts = [];
let currentUser = null;
let currentCennikTab = 'dn1000';

// window.studnieProducts — proxy na zmienną modułową. telemetryBridge/mlDualRanking
// czytają przez window, a lista jest wymieniana w miejscu (appStudnie.js, pricelist*).
// Getter gwarantuje aktualną referencję niezależnie od tego, kiedy odczyt następuje;
// setter (np. externalExportTemplate) zapisuje do tej samej zmiennej.
var MIN_OT_HEIGHT = 500;
function _purgeOrphanOtProducts(list) {
    if (!Array.isArray(list)) return list;
    return list.filter((p) => {
        if (
            p.componentType === 'krag_ot' &&
            parseInt(p.height) > 0 &&
            parseInt(p.height) < MIN_OT_HEIGHT
        )
            return false;
        if (
            String(p.id || '').endsWith('_OT') &&
            parseInt(p.height) > 0 &&
            parseInt(p.height) < MIN_OT_HEIGHT
        )
            return false;
        return true;
    });
}
Object.defineProperty(window, 'studnieProducts', {
    configurable: true,
    get: () => studnieProducts,
    set: (v) => {
        studnieProducts = _purgeOrphanOtProducts(v);
    }
});
window._purgeOrphanOtProducts = _purgeOrphanOtProducts;

// System wielu studni
let wells = []; // Tablica obiektów { id, name, dn, config: [{ productId, quantity }], rzednaWlazu, rzednaDna }
let currentWellIndex = 0;
let wellCounter = 1;
let wellDiscounts = {}; // Rabaty na DN: { 1000: { dennica, nadbudowa, preco, pehd, dennicaE600, nadbudowaE600, zwienczenieE600, dennicaF900, nadbudowaF900, zwienczenieF900 }, ... }
let precoPricing = {}; // Cennik wkładek PRECO: { 1000: { kinety: [...], ... }, ... }

// Globalne domyślne parametry oferty (utrzymują się do czasu ręcznej zmiany)
let offerDefaultZakonczenie = null; // ID produktu lub null (=konus)
let offerDefaultRedukcja = false; // true = redukcja do DN1000
let offerDefaultRedukcjaMinH = 2500; // minimalna wysokość sekcji dennej w mm
let offerDefaultRedukcjaZak = null; // ID produktu dla górnego zakończenia redukcji (DN1000)

// System wielu ofert
let offersStudnie = [];
let ordersStudnie = [];
let editingOfferIdStudnie = null;
let editingOfferAssignedUserId = null;
let editingOfferAssignedUserName = '';
let editingOfferCreatedByUserId = null;
let editingOfferCreatedByUserName = '';
let isSavingOffer = false;
/** @type {any} */
let orderEditMode = null; // Podczas edycji zamówienia: { orderId, order }

const expandedWellIndices = new Set();
// clientsDb to zmienna globalna (window.clientsDb)
// ustawiana w appStudnie.js przez clientsDb = loadClientsDb()

// Stan kreatora
let currentWizardStep = 1;
let wizardConfirmedParams = new Set();
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
        if (typeof syncOfferTabFields === 'function') syncOfferTabFields();
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
    s('offer-disp-client-number', v('client-number'));
    s('offer-disp-number', v('offer-number'));
    s('offer-disp-date', v('offer-date'));
    s('offer-disp-invest', v('invest-name'));
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

window.showSection = showSectionStudnie;

/* ===== Żywe bindingi window.* dla zmiennych stanu ===== */
// Klasyczne skrypty: top-level `let` nie tworzy właściwości window.
// Kod w innych plikach czyta/zapisuje część stanu przez window (np. window.wellDiscounts,
// window.wells) — gettery/settery utrzymują spójność z tymi samymi zmiennymi (wzorzec studnieProducts).
const _GLOBAL_BINDINGS = {
    currentUser: () => currentUser,
    currentCennikTab: () => currentCennikTab,
    wells: () => wells,
    currentWellIndex: () => currentWellIndex,
    wellCounter: () => wellCounter,
    wellDiscounts: () => wellDiscounts,
    precoPricing: () => precoPricing,
    offerDefaultZakonczenie: () => offerDefaultZakonczenie,
    offerDefaultRedukcja: () => offerDefaultRedukcja,
    offerDefaultRedukcjaMinH: () => offerDefaultRedukcjaMinH,
    offerDefaultRedukcjaZak: () => offerDefaultRedukcjaZak,
    offersStudnie: () => offersStudnie,
    ordersStudnie: () => ordersStudnie,
    editingOfferIdStudnie: () => editingOfferIdStudnie,
    editingOfferAssignedUserId: () => editingOfferAssignedUserId,
    editingOfferAssignedUserName: () => editingOfferAssignedUserName,
    editingOfferCreatedByUserId: () => editingOfferCreatedByUserId,
    editingOfferCreatedByUserName: () => editingOfferCreatedByUserName,
    isSavingOffer: () => isSavingOffer,
    orderEditMode: () => orderEditMode,
    expandedWellIndices: () => expandedWellIndices,
    currentWizardStep: () => currentWizardStep,
    wizardConfirmedParams: () => wizardConfirmedParams,
    studnieViewTransitionTimer: () => studnieViewTransitionTimer,
    WIZARD_REQUIRED_PARAMS: () => WIZARD_REQUIRED_PARAMS
};
const _GLOBAL_SETTERS = {
    currentUser: (v) => {
        currentUser = v;
    },
    currentCennikTab: (v) => {
        currentCennikTab = v;
    },
    wells: (v) => {
        wells = v;
    },
    currentWellIndex: (v) => {
        currentWellIndex = v;
    },
    wellCounter: (v) => {
        wellCounter = v;
    },
    wellDiscounts: (v) => {
        wellDiscounts = v;
    },
    precoPricing: (v) => {
        precoPricing = v;
    },
    offerDefaultZakonczenie: (v) => {
        offerDefaultZakonczenie = v;
    },
    offerDefaultRedukcja: (v) => {
        offerDefaultRedukcja = v;
    },
    offerDefaultRedukcjaMinH: (v) => {
        offerDefaultRedukcjaMinH = v;
    },
    offerDefaultRedukcjaZak: (v) => {
        offerDefaultRedukcjaZak = v;
    },
    offersStudnie: (v) => {
        offersStudnie = v;
    },
    ordersStudnie: (v) => {
        ordersStudnie = v;
    },
    editingOfferIdStudnie: (v) => {
        editingOfferIdStudnie = v;
    },
    editingOfferAssignedUserId: (v) => {
        editingOfferAssignedUserId = v;
    },
    editingOfferAssignedUserName: (v) => {
        editingOfferAssignedUserName = v;
    },
    editingOfferCreatedByUserId: (v) => {
        editingOfferCreatedByUserId = v;
    },
    editingOfferCreatedByUserName: (v) => {
        editingOfferCreatedByUserName = v;
    },
    isSavingOffer: (v) => {
        isSavingOffer = v;
    },
    orderEditMode: (v) => {
        orderEditMode = v;
    },
    currentWizardStep: (v) => {
        currentWizardStep = v;
    },
    wizardConfirmedParams: (v) => {
        wizardConfirmedParams = v;
    },
    studnieViewTransitionTimer: (v) => {
        studnieViewTransitionTimer = v;
    }
};
for (const key of Object.keys(_GLOBAL_BINDINGS)) {
    Object.defineProperty(window, key, {
        configurable: true,
        get: _GLOBAL_BINDINGS[key],
        set: _GLOBAL_SETTERS[key]
    });
}

/* ===== Rejestracja globali ===== */
window.toggleCard = toggleCard;
window.generateOfferNumberStudnie = generateOfferNumberStudnie;
window.normalizeId = normalizeId;
