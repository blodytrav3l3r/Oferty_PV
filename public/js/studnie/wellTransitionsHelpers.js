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
    if (angleEl) {
        editPrzejscieState.angle = Math.min(360, parseFloat(angleEl.value) || 0);
        if (parseFloat(angleEl.value) > 360) angleEl.value = String(editPrzejscieState.angle);
    }
    const spKEl = document.getElementById('edit-spadek-kineta-' + editPrzejscieIdx);
    const spMEl = document.getElementById('edit-spadek-mufa-' + editPrzejscieIdx);
    if (spKEl) editPrzejscieState.spadekKineta = spKEl.value;
    if (spMEl) editPrzejscieState.spadekMufa = spMEl.value;
}

function editUpdateAngles(index) {
    const el = document.getElementById('edit-angle-' + index);
    if (!el) return;
    const angle = Math.min(360, parseFloat(el.value) || 0);
    if (parseFloat(el.value) > 360) el.value = '360';
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
    PRICE_MAX: 10000000,
    WEIGHT_MAX: 100000
});

const CUSTOM_PRZEJSCIE_RESERVE_FIELDS = ['zapasDol', 'zapasGora', 'zapasDolMin', 'zapasGoraMin'];

function _customPrzejscieNormalizeReserves(variant) {
    return CUSTOM_PRZEJSCIE_RESERVE_FIELDS.reduce((reserves, key) => {
        const raw = variant[key];
        if (raw === '' || raw == null) return reserves;
        const value = Number(raw);
        if (Number.isFinite(value) && value >= 0) reserves[key] = value;
        return reserves;
    }, {});
}

/** Klucz typu custom w panelu: 'custom:<id>'. Wariant: 'custom:<id>:<dn>'. */
const CUSTOM_PRZEJSCIE_TYPE_PREFIX = 'custom:';
/** Domyślna grubość ścianki studni do auto-wagi przejścia [m]. */
const CUSTOM_PRZEJSCIE_WALL_M = 0.15;
/** Gęstość betonu zbrojonego do auto-wagi przejścia [kg/m3]. */
const CUSTOM_PRZEJSCIE_CONCRETE_KG_M3 = 2400;

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

/**
 * Auto-waga przejścia: walec betonu o średnicy DN przez ściankę 15 cm.
 * Wartość można nadpisać ręcznie przy tworzeniu typu.
 * @param {string|number} dn
 * @returns {number} kg
 */
function computeCustomPrzejscieWeight(dn) {
    const mm = parseFloat(String(dn == null ? '' : dn).replace(',', '.'));
    if (!Number.isFinite(mm) || mm <= 0) return 0;
    const m = mm / 1000;
    const volume = (Math.PI / 4) * m * m * CUSTOM_PRZEJSCIE_WALL_M;
    return _customPrzejscieRound(volume * CUSTOM_PRZEJSCIE_CONCRETE_KG_M3);
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
 * @param {{name?:string, dn?:string|number, price?:string|number, weight?:string|number}} input
 */
function validateCustomPrzejscie(input) {
    const src = input || {};
    const name = sanitizeCustomPrzejscieName(src.name);
    const dn = src.dn == null ? '' : String(src.dn).trim();
    const price = Number(src.price);
    const weight =
        src.weight === '' || src.weight == null
            ? computeCustomPrzejscieWeight(dn)
            : Number(src.weight);
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
    if (!Number.isFinite(weight) || weight < 0) errors.weight = 'Waga nie może być ujemna.';
    else if (weight > CUSTOM_PRZEJSCIE_LIMITS.WEIGHT_MAX)
        errors.weight = 'Waga przekracza dopuszczalny limit.';
    return {
        ok: Object.keys(errors).length === 0,
        errors,
        value: {
            name,
            dn,
            price: _customPrzejscieRound(price),
            weight: _customPrzejscieRound(weight)
        }
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
 * Typy przejść niestandardowych (nazwa + warianty DN) bieżącej oferty.
 * @returns {Array<{id:string,name:string,variants:Array<{dn:string,weight:number,price:number,zapasDol?:number,zapasGora?:number,zapasDolMin?:number,zapasGoraMin?:number}>}>}
 */
function getCustomPrzejsciaTypesList() {
    return typeof customPrzejsciaTypes !== 'undefined' && Array.isArray(customPrzejsciaTypes)
        ? customPrzejsciaTypes
        : [];
}

function customPrzejsciaTypeKey(typeId) {
    return CUSTOM_PRZEJSCIE_TYPE_PREFIX + String(typeId || '');
}

function isCustomPrzejsciaTypeKey(key) {
    return (
        typeof key === 'string' &&
        key.indexOf(CUSTOM_PRZEJSCIE_TYPE_PREFIX) === 0 &&
        key.length > CUSTOM_PRZEJSCIE_TYPE_PREFIX.length
    );
}

function findCustomPrzejsciaTypeByKey(key) {
    if (!isCustomPrzejsciaTypeKey(key)) return null;
    const id = key.slice(CUSTOM_PRZEJSCIE_TYPE_PREFIX.length);
    return getCustomPrzejsciaTypesList().find((t) => t && String(t.id) === id) || null;
}

function getCustomPrzejsciaVariantKey(typeId, dn) {
    return CUSTOM_PRZEJSCIE_TYPE_PREFIX + String(typeId || '') + ':' + String(dn == null ? '' : dn);
}

/** @returns {{typeId:string, dn:string}|null} */
function parseCustomPrzejsciaVariantKey(key) {
    if (!isCustomPrzejsciaTypeKey(key)) return null;
    const rest = key.slice(CUSTOM_PRZEJSCIE_TYPE_PREFIX.length);
    const sep = rest.indexOf(':');
    if (sep <= 0) return null;
    return { typeId: rest.slice(0, sep), dn: rest.slice(sep + 1) };
}

function _customPrzejscieNewTypeId() {
    return 'cpt-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
}

/** Sortuje warianty rosnąco po DN (liczbowo, fallback tekstowy). */
function _sortCustomPrzejsciaVariants(variants) {
    return (Array.isArray(variants) ? variants : []).slice().sort((a, b) => {
        const na = parseFloat(String(a.dn).replace(',', '.'));
        const nb = parseFloat(String(b.dn).replace(',', '.'));
        if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
        return String(a.dn).localeCompare(String(b.dn), 'pl', { numeric: true });
    });
}

/** Normalizuje warianty: string DN, liczby, dedupe po DN (ostatni wygrywa). */
function _normalizeCustomPrzejsciaVariants(rawVariants) {
    const byDn = new Map();
    (Array.isArray(rawVariants) ? rawVariants : []).forEach((v) => {
        if (!v || typeof v !== 'object') return;
        const dn = v.dn == null ? '' : String(v.dn).trim();
        if (!dn || dn.length > CUSTOM_PRZEJSCIE_LIMITS.DN_MAX) return;
        const price = Number(v.price);
        const weight =
            v.weight === '' || v.weight == null
                ? computeCustomPrzejscieWeight(dn)
                : Number(v.weight);
        if (!Number.isFinite(price) || price < 0 || price > CUSTOM_PRZEJSCIE_LIMITS.PRICE_MAX)
            return;
        if (!Number.isFinite(weight) || weight < 0 || weight > CUSTOM_PRZEJSCIE_LIMITS.WEIGHT_MAX)
            return;
        byDn.set(dn, {
            dn,
            weight: _customPrzejscieRound(weight),
            price: _customPrzejscieRound(price),
            ..._customPrzejscieNormalizeReserves(v)
        });
    });
    return _sortCustomPrzejsciaVariants(Array.from(byDn.values()));
}

/** Normalizuje listę typów z oferty/zamówienia (defensywnie, dedupe po id). */
function normalizeCustomPrzejsciaTypes(rawList) {
    const byId = new Map();
    (Array.isArray(rawList) ? rawList : []).forEach((raw) => {
        if (!raw || typeof raw !== 'object') return;
        const name = sanitizeCustomPrzejscieName(raw.name);
        if (!name || name.length > CUSTOM_PRZEJSCIE_LIMITS.NAME_MAX) return;
        const variants = _normalizeCustomPrzejsciaVariants(raw.variants);
        if (variants.length === 0) return;
        const id = raw.id ? String(raw.id) : _customPrzejscieNewTypeId();
        byId.set(id, { id, name, variants });
    });
    return Array.from(byId.values());
}

/**
 * Waliduje typ custom przejścia (nazwa + warianty).
 * Błędy wariantu mają klucze `v<index>-<pole>`.
 * @param {{name?:string, variants?:Array}} input
 */
function validateCustomPrzejscieType(input) {
    const src = input || {};
    const name = sanitizeCustomPrzejscieName(src.name);
    const errors = {};
    if (!name) errors.name = 'Podaj nazwę przejścia.';
    else if (name.length > CUSTOM_PRZEJSCIE_LIMITS.NAME_MAX)
        errors.name = 'Nazwa może mieć maks. ' + CUSTOM_PRZEJSCIE_LIMITS.NAME_MAX + ' znaków.';

    const rawVariants = Array.isArray(src.variants) ? src.variants : [];
    if (rawVariants.length === 0) errors.variants = 'Dodaj co najmniej jedną średnicę.';

    const seen = new Set();
    const variants = rawVariants.map((raw, index) => {
        const v = raw || {};
        const dn = v.dn == null ? '' : String(v.dn).trim();
        const weightRaw =
            v.weight === '' || v.weight == null
                ? computeCustomPrzejscieWeight(dn)
                : Number(v.weight);
        const price = Number(v.price);
        if (!dn) errors['v' + index + '-dn'] = 'Podaj DN.';
        else if (dn.length > CUSTOM_PRZEJSCIE_LIMITS.DN_MAX)
            errors['v' + index + '-dn'] =
                'DN może mieć maks. ' + CUSTOM_PRZEJSCIE_LIMITS.DN_MAX + ' znaków.';
        else if (seen.has(dn)) errors['v' + index + '-dn'] = 'Ten DN już jest na liście.';
        else seen.add(dn);
        if (!Number.isFinite(weightRaw) || weightRaw < 0)
            errors['v' + index + '-weight'] = 'Waga nie może być ujemna.';
        else if (weightRaw > CUSTOM_PRZEJSCIE_LIMITS.WEIGHT_MAX)
            errors['v' + index + '-weight'] = 'Waga przekracza dopuszczalny limit.';
        if (v.price === '' || v.price == null || !Number.isFinite(price))
            errors['v' + index + '-price'] = 'Podaj cenę netto.';
        else if (price < 0) errors['v' + index + '-price'] = 'Cena nie może być ujemna.';
        else if (price > CUSTOM_PRZEJSCIE_LIMITS.PRICE_MAX)
            errors['v' + index + '-price'] = 'Cena przekracza dopuszczalny limit.';
        const reserveValues = {};
        CUSTOM_PRZEJSCIE_RESERVE_FIELDS.forEach((key) => {
            const rawReserve = v[key];
            if (rawReserve === '' || rawReserve == null) return;
            const reserve = Number(rawReserve);
            if (!Number.isFinite(reserve) || reserve < 0)
                errors['v' + index + '-' + key] = 'Zapas musi być nieujemną liczbą.';
            else reserveValues[key] = reserve;
        });
        return {
            dn,
            weight: _customPrzejscieRound(Number.isFinite(weightRaw) ? weightRaw : 0),
            price: _customPrzejscieRound(Number.isFinite(price) ? price : 0),
            ...reserveValues
        };
    });

    return {
        ok: Object.keys(errors).length === 0,
        errors,
        value: { name, variants: _sortCustomPrzejsciaVariants(variants) }
    };
}

/**
 * Scala zapisane typy z oferty z pozycjami isCustom w studniach (back-compat
 * dla ofert zapisanych przed typami). Nadaje pozycjom customTypeId.
 * @param {Array} rawTypes
 * @param {Array} wellList
 */
function hydrateCustomPrzejsciaTypes(rawTypes, wellList) {
    const types = normalizeCustomPrzejsciaTypes(rawTypes);
    (Array.isArray(wellList) ? wellList : []).forEach((well) => {
        if (!well || !Array.isArray(well.przejscia)) return;
        well.przejscia.forEach((item) => {
            if (!isCustomPrzejscie(item)) return;
            const name = sanitizeCustomPrzejscieName(item.customName);
            if (!name) return;
            let type = types.find((t) => t.name === name);
            if (!type) {
                type = { id: _customPrzejscieNewTypeId(), name, variants: [] };
                types.push(type);
            }
            const dn = item.dn == null ? '' : String(item.dn);
            const price = Number(item.customPrice);
            const weight =
                item.customWeight == null
                    ? computeCustomPrzejscieWeight(dn)
                    : Number(item.customWeight);
            if (
                dn &&
                Number.isFinite(price) &&
                price >= 0 &&
                !type.variants.some((v) => v.dn === dn)
            ) {
                type.variants.push({
                    dn,
                    weight: _customPrzejscieRound(Number.isFinite(weight) ? weight : 0),
                    price: _customPrzejscieRound(price),
                    ..._customPrzejscieNormalizeReserves(item)
                });
            }
            item.customTypeId = type.id;
        });
    });
    return types.filter((t) => t.variants.length > 0);
}

/* ===== Rejestracja globali ===== */
window.getMaxPipeDn = getMaxPipeDn;
window.syncEditState = syncEditState;
window.CUSTOM_PRZEJSCIE_LIMITS = CUSTOM_PRZEJSCIE_LIMITS;
window.computeCustomPrzejscieWeight = computeCustomPrzejscieWeight;
window.isCustomPrzejscie = isCustomPrzejscie;
window.sanitizeCustomPrzejscieName = sanitizeCustomPrzejscieName;
window.validateCustomPrzejscie = validateCustomPrzejscie;
window.getPrzejscieBasePrice = getPrzejscieBasePrice;
window.getPrzejscieName = getPrzejscieName;
window.getPrzejscieCategoryLabel = getPrzejscieCategoryLabel;
window.getPrzejscieDnLabel = getPrzejscieDnLabel;
window.isPricedPrzejscie = isPricedPrzejscie;
window.getCustomPrzejsciaTypesList = getCustomPrzejsciaTypesList;
window.customPrzejsciaTypeKey = customPrzejsciaTypeKey;
window.isCustomPrzejsciaTypeKey = isCustomPrzejsciaTypeKey;
window.findCustomPrzejsciaTypeByKey = findCustomPrzejsciaTypeByKey;
window.getCustomPrzejsciaVariantKey = getCustomPrzejsciaVariantKey;
window.parseCustomPrzejsciaVariantKey = parseCustomPrzejsciaVariantKey;
window.normalizeCustomPrzejsciaTypes = normalizeCustomPrzejsciaTypes;
window.sortCustomPrzejsciaVariants = _sortCustomPrzejsciaVariants;
window.validateCustomPrzejscieType = validateCustomPrzejscieType;
window.hydrateCustomPrzejsciaTypes = hydrateCustomPrzejsciaTypes;
