// @ts-check

function getMaxPipeDn(wellDn) {
    if (!wellDn || wellDn === 'styczna') return 9999;
    const dn = parseInt(wellDn);
    if (dn === 1000) return 600;
    if (dn === 1200) return 800;
    if (dn === 1500) return 1000;
    if (dn === 2000) return 1600;
    if (dn === 2500) return 2200;
    return 9999;
}

function syncEditState() {
    if (editPrzejscieIdx < 0) return;
    const rzednaEl = document.getElementById('edit-rzedna-' + editPrzejscieIdx);
    const angleEl = document.getElementById('edit-angle-' + editPrzejscieIdx);
    if (rzednaEl) editPrzejscieState.rzedna = rzednaEl.value;
    if (angleEl) editPrzejscieState.angle = parseFloat(angleEl.value) || 0;
    const spKEl = document.getElementById('edit-spadek-kineta-' + editPrzejscieIdx);
    const spMEl = document.getElementById('edit-spadek-mufa-' + editPrzejscieIdx);
    if (spKEl) editPrzejscieState.spadekKineta = spKEl.value;
    if (spMEl) editPrzejscieState.spadekMufa = spMEl.value;
}

function editUpdateAngles(index) {
    const el = document.getElementById('edit-angle-' + index);
    if (!el) return;
    const angle = parseFloat(el.value) || 0;
    const exec = angle === 0 || angle === 360 ? 0 : 360 - angle;
    const gons = ((angle * 400) / 360).toFixed(2);
    const execEl = document.getElementById('edit-exec-' + index);
    const gonyEl = document.getElementById('edit-gony-' + index);
    if (execEl) execEl.textContent = exec + '°';
    if (gonyEl) gonyEl.innerHTML = gons + '<sup>g</sup>';
}

window.editUpdateAngles = editUpdateAngles;
window.editChangePrzejscieType = editChangePrzejscieType;

function editChangePrzejscieType(index) {
    const typeSelect = document.getElementById('edit-type-' + index);
    const dnSelect = document.getElementById('edit-dn-' + index);
    if (!typeSelect || !dnSelect) return;
    const newType = typeSelect.value;
    const przejsciaProducts = studnieProducts.filter(
        (pr) => pr.componentType === 'przejscie' && pr.active !== 0 && pr.category === newType
    );
    dnSelect.innerHTML = przejsciaProducts
        .map((pr) => {
            const dnLbl = typeof pr.dn === 'string' && pr.dn.includes('/') ? pr.dn : 'DN' + pr.dn;
            return `<option value="${pr.id}">${dnLbl} — ${fmt(pr.price)} PLN</option>`;
        })
        .join('');
}

/* ===== Przejścia niestandardowe (poza cennikiem) — SSoT modelu ===== */

/** Limity wejścia custom przejścia. Lustro limitów w Zod (offerSchemas). */
const CUSTOM_PRZEJSCIE_LIMITS = Object.freeze({
    NAME_MAX: 120,
    DN_MAX: 12,
    PRICE_MAX: 10000000
});

/** Znaki kontrolne i bidi — usuwane z nazwy (spoofing/XSS w eksportach). */
function _customPrzejscieIsForbiddenCode(code) {
    return (
        (code >= 0x0000 && code <= 0x001f) ||
        code === 0x007f ||
        (code >= 0x2028 && code <= 0x202e) ||
        (code >= 0x2066 && code <= 0x2069)
    );
}

function _customPrzejscieRound(value) {
    if (typeof roundMoney === 'function') return roundMoney(value);
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function isCustomPrzejscie(item) {
    return !!(item && item.isCustom === true);
}

function sanitizeCustomPrzejscieName(value) {
    const raw = String(value == null ? '' : value);
    let out = '';
    for (const ch of raw) {
        out += _customPrzejscieIsForbiddenCode(ch.codePointAt(0) || 0) ? ' ' : ch;
    }
    return out.replace(/\s+/g, ' ').trim();
}

/**
 * Waliduje dane custom przejścia. Zwraca { ok, errors, value }.
 * @param {{name?:string, dn?:string|number, price?:string|number}} input
 */
function validateCustomPrzejscie(input) {
    const src = input || {};
    const name = sanitizeCustomPrzejscieName(src.name);
    const dn = src.dn == null ? '' : String(src.dn).trim();
    const price = Number(src.price);
    const errors = {};
    if (!name) errors.name = 'Podaj nazwę przejścia.';
    else if (name.length > CUSTOM_PRZEJSCIE_LIMITS.NAME_MAX)
        errors.name = 'Nazwa może mieć maks. ' + CUSTOM_PRZEJSCIE_LIMITS.NAME_MAX + ' znaków.';
    if (dn.length > CUSTOM_PRZEJSCIE_LIMITS.DN_MAX)
        errors.dn = 'DN może mieć maks. ' + CUSTOM_PRZEJSCIE_LIMITS.DN_MAX + ' znaków.';
    if (src.price === '' || src.price == null || !Number.isFinite(price))
        errors.price = 'Podaj cenę netto.';
    else if (price < 0) errors.price = 'Cena nie może być ujemna.';
    else if (price > CUSTOM_PRZEJSCIE_LIMITS.PRICE_MAX)
        errors.price = 'Cena przekracza dopuszczalny limit.';
    return {
        ok: Object.keys(errors).length === 0,
        errors,
        value: { name, dn, price: _customPrzejscieRound(price) }
    };
}

/** Cena bazowa netto pozycji: katalog albo customPrice. */
function getPrzejscieBasePrice(item, product) {
    if (product) return Number(product.price) || 0;
    if (isCustomPrzejscie(item)) return _customPrzejscieRound(item.customPrice);
    return 0;
}

/** Nazwa do prezentacji (kafelek, wydruk, eksport). */
function getPrzejscieName(item, product) {
    if (product) return product.name || product.category || '';
    if (isCustomPrzejscie(item)) return String(item.customName || '');
    return '';
}

/** Rodzaj/materiał do prezentacji — dla custom to jego nazwa. */
function getPrzejscieCategoryLabel(item, product) {
    if (product) return product.category || '';
    if (isCustomPrzejscie(item)) return String(item.customName || '');
    return '';
}

/** DN do prezentacji. */
function getPrzejscieDnLabel(item, product) {
    if (product) return product.dn != null ? product.dn : '';
    if (isCustomPrzejscie(item)) return item.dn != null ? item.dn : '';
    return '';
}

/** Czy pozycja ma prawo wejść do wyceny (katalog albo poprawny custom). */
function isPricedPrzejscie(item, product) {
    return !!product || (isCustomPrzejscie(item) && !!sanitizeCustomPrzejscieName(item.customName));
}

/**
 * Zapamiętane custom przejścia bieżącej oferty (presety do listy wyboru).
 * Dedupe po nazwie+DN — ostatnia cena wygrywa. Bez osobnego zapisu: źródłem
 * są przejścia isCustom już obecne w studniach oferty.
 */
function collectCustomPrzejsciaPresets(wellList) {
    const byKey = new Map();
    (Array.isArray(wellList) ? wellList : []).forEach((well) => {
        if (!well || !Array.isArray(well.przejscia)) return;
        well.przejscia.forEach((item) => {
            if (!isCustomPrzejscie(item)) return;
            const name = sanitizeCustomPrzejscieName(item.customName);
            if (!name) return;
            const dn = item.dn == null ? '' : String(item.dn);
            byKey.set(name + '|' + dn, {
                name,
                dn,
                price: _customPrzejscieRound(item.customPrice)
            });
        });
    });
    return Array.from(byKey.values());
}

/* ===== Rejestracja globali ===== */
window.getMaxPipeDn = getMaxPipeDn;
window.syncEditState = syncEditState;
window.CUSTOM_PRZEJSCIE_LIMITS = CUSTOM_PRZEJSCIE_LIMITS;
window.isCustomPrzejscie = isCustomPrzejscie;
window.sanitizeCustomPrzejscieName = sanitizeCustomPrzejscieName;
window.validateCustomPrzejscie = validateCustomPrzejscie;
window.getPrzejscieBasePrice = getPrzejscieBasePrice;
window.getPrzejscieName = getPrzejscieName;
window.getPrzejscieCategoryLabel = getPrzejscieCategoryLabel;
window.getPrzejscieDnLabel = getPrzejscieDnLabel;
window.isPricedPrzejscie = isPricedPrzejscie;
window.collectCustomPrzejsciaPresets = collectCustomPrzejsciaPresets;
