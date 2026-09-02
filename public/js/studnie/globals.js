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
        if (typeof _rebuildStudnieProductsById === 'function') _rebuildStudnieProductsById();
    }
});
window._purgeOrphanOtProducts = _purgeOrphanOtProducts;

// Map<productId, Product> — O(1) lookup zamiast find() 40M porównań przy 10k (P0 C)
// Klucz canonical: String(product.id) — jeden SSoT dla lookupu
/** @type {Map<string, any>} */
let studnieProductsById = new Map();
function _rebuildStudnieProductsById() {
    studnieProductsById = new Map();
    for (let i = 0; i < studnieProducts.length; i++) {
        const p = studnieProducts[i];
        if (p && p.id != null) studnieProductsById.set(String(p.id), p);
    }
}
/**
 * O(1) lookup produktu studni — String canonical.
 * Hybrid: primary rebuild przez window.studnieProducts setter, lazy cheap detector size, fallback find jako self-healing.
 * @param {string} id
 * @returns {any|null}
 */
function getStudnieProductById(id) {
    if (id == null) return null;
    const k = String(id);
    // cheap stale detector — nie proof, tylko sygnał dla bypassów (push/filter bez window.*)
    if (studnieProductsById.size !== studnieProducts.length) {
        _rebuildStudnieProductsById();
    }
    const v = studnieProductsById.get(k);
    if (!v && studnieProducts.length) {
        const f = studnieProducts.find((p) => String(p.id) === k);
        if (f) {
            studnieProductsById.set(k, f);
            return f;
        }
    }
    return v || null;
}
/**
 * Formalny invariant dev/CI — nie size===length, tylko referencje + unikalność.
 * @returns {boolean}
 */
function __assertStudnieMapFresh() {
    if (studnieProducts.length === 0) return studnieProductsById.size === 0;
    if (studnieProductsById.size !== studnieProducts.length) return false;
    const seen = new Set();
    for (let i = 0; i < studnieProducts.length; i++) {
        const p = studnieProducts[i];
        if (!p || p.id == null) return false;
        const k = String(p.id);
        if (seen.has(k)) return false;
        seen.add(k);
        if (studnieProductsById.get(k) !== p) return false;
    }
    return true;
}
window._rebuildStudnieProductsById = _rebuildStudnieProductsById;
window.getStudnieProductById = getStudnieProductById;
window.__assertStudnieMapFresh = __assertStudnieMapFresh;
Object.defineProperty(window, 'studnieProductsById', {
    configurable: true,
    get: () => studnieProductsById
});
_rebuildStudnieProductsById();

// System wielu studni
let wells = []; // Tablica obiektów { id, name, dn, uwagi, config: [{ productId, quantity }], rzednaWlazu, rzednaDna }
let wellsById = new Map();
function _rebuildWellsById() {
    wellsById = new Map();
    for (let i = 0; i < wells.length; i++) {
        const w = wells[i];
        if (w && w.id != null) wellsById.set(String(w.id), i);
    }
}
function getWellIndexById(id) {
    if (id == null) return -1;
    if (wellsById.size !== wells.length) _rebuildWellsById();
    const v = wellsById.get(String(id));
    return v !== undefined ? v : -1;
}
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
let offersStudnieById = new Map();
function _rebuildOffersStudnieById() {
    offersStudnieById = new Map();
    for (let i = 0; i < offersStudnie.length; i++) {
        const o = offersStudnie[i];
        if (o && o.id) {
            offersStudnieById.set(String(o.id), o);
            const nid = normalizeId(o.id);
            if (nid !== o.id) offersStudnieById.set(String(nid), o);
        }
    }
}
function getOfferStudnieById(id) {
    if (!id) return null;
    const key = String(id);
    const nid = normalizeId(key);
    // lazy rebuild gdy rozmiar nie zgadza się (push/filter)
    if (offersStudnieById.size !== offersStudnie.length * 1) {
        // przy mapowaniu raw+nid rozmiar może być > length — sprawdzamy minimalnie
        if (offersStudnieById.size < offersStudnie.length) _rebuildOffersStudnieById();
        else {
            // weryfikacja szybka: czy każdy oferuje jest w mapie
            let missing = false;
            for (let i = 0; i < offersStudnie.length; i++) {
                if (!offersStudnieById.has(String(offersStudnie[i].id))) {
                    missing = true;
                    break;
                }
            }
            if (missing) _rebuildOffersStudnieById();
        }
    }
    return offersStudnieById.get(key) || (nid !== key ? offersStudnieById.get(nid) : null) || null;
}
window._rebuildOffersStudnieById = _rebuildOffersStudnieById;
window.getOfferStudnieById = getOfferStudnieById;
Object.defineProperty(window, 'offersStudnieById', {
    configurable: true,
    get: () => offersStudnieById
});
_rebuildOffersStudnieById();
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
        if (typeof _rebuildWellsById === 'function') _rebuildWellsById();
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
        if (typeof _rebuildOffersStudnieById === 'function') _rebuildOffersStudnieById();
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

// scheduleRender — ONE render scheduler (I4): at most one pending rAF per sync transaction
let _sokRenderPending = false;
let _sokRenderDirty = false; // "model may have changed" — not "render required"
function scheduleRender() {
    _sokRenderDirty = true;
    if (_sokRenderPending) return;
    _sokRenderPending = true;
    requestAnimationFrame(function () {
        _sokRenderPending = false;
        if (!_sokRenderDirty) return;
        _sokRenderDirty = false;
        if (typeof window.refreshAll === 'function') {
            try {
                window.refreshAll();
            } catch (_e) {}
        } else {
            if (typeof window.updateSummary === 'function') window.updateSummary();
            if (typeof window.renderWellsList === 'function') window.renderWellsList();
            if (typeof window.renderWellDiagram === 'function') window.renderWellDiagram();
        }
    });
}
window.scheduleRender = scheduleRender;

/* ===== Rejestracja globali ===== */
window._rebuildWellsById = _rebuildWellsById;
window.getWellIndexById = getWellIndexById;
Object.defineProperty(window, 'wellsById', { configurable: true, get: () => wellsById });
_rebuildWellsById();
window.toggleCard = toggleCard;
window.generateOfferNumberStudnie = generateOfferNumberStudnie;
window.normalizeId = normalizeId;
