// @ts-check
/* ===== ORDER DTO (STUDNIE) — allowlist transportowa =====
 *
 * Kontrakt pól wysyłanych do API przy zapisie zamówienia.
 * Allowlist (nie denylist): każde nowe pole runtime/cache/telemetrii
 * dodane do obiektu studni w UI NIE trafia do payloadu automatycznie.
 *
 * Lista pól zweryfikowana audytem konsumentów (2026-09-05):
 * - kalkulacja: actionsWellPricing (calcWellStats), pricingCalculator,
 *   offerPricingCalc, precoCalcCore, actionsWellPainting
 * - walidacja/solver: solverValidation, solverCore, ruleEngine, diagramOtRings
 * - PZ/zlecenia: orderZleceniaData, orderZleceniaForm, orderBulk (_elemId)
 * - eksport: import-export/studnie/externalExportTemplate (productId + katalog)
 * - UI: actionsConfigRender, offerWellComponents, uiHelpers, orderKartaBudowy
 *
 * stripWellRuntimeFields (offerSave.js) zostaje jako defense-in-depth
 * na czas migracji — docelowo DTO jest jedynym kontraktem.
 */

/**
 * Pola pozycji konfiguracji istotne biznesowo.
 * Pominięte celowo (transient): isPlaceholder, _addedAt, _xp,
 * __resCache oraz dowolne przyszłe klucze cache/solvera.
 */
const ORDER_CONFIG_ITEM_FIELDS = [
    'productId',
    'quantity',
    'frozenPrice',
    'frozenPriceBase',
    'frozenName',
    'disablePehd',
    'disablePreco',
    'isPsiaBuda',
    '_elemId'
];

/**
 * Pola przejścia rurowego istotne biznesowo.
 * katWlaczenia = legacy fallback (diagramTransitions.js) — tylko gdy obecne.
 */
const ORDER_PRZEJSCIE_FIELDS = [
    'productId',
    'dn',
    'rzednaWlaczenia',
    'angle',
    'angleExecution',
    'angleGony',
    'flowType',
    'doplata',
    'frozenPrice',
    'frozenPriceBase',
    'frozenName',
    'katWlaczenia'
];

/**
 * Pola studni istotne biznesowo.
 * Pominięte celowo (runtime/derived): _lastAutoConfig, _lastAutoTelemetryId,
 * _aiRankInfo, _lastSolveInputHash, __resCache, _psiaBudaBackup, configErrors,
 * configStatus, wellHeight, type, warehouse oraz przyszłe klucze cache.
 * material/nadbudowa = legacy odpowiedniki dennicaMaterial (back-compat).
 */
const ORDER_WELL_FIELDS = [
    'id',
    'name',
    'dn',
    'rzednaDna',
    'rzednaWlazu',
    'magazyn',
    'psiaBuda',
    'stycznaNadbudowa1200',
    'zakonczenie',
    'zakonczenieByDn',
    'redukcjaDN1000',
    'redukcjaTargetDN',
    'wkladkaDennica',
    'wkladkaNadbudowa',
    'wkladkaZwienczenie',
    'wkladkaOsadnikPreco',
    'wkladkaOsadnikH',
    'kineta',
    'spocznik',
    'spocznikH',
    'dennicaMaterial',
    'material',
    'nadbudowa',
    'stopnie',
    'doplata',
    'malowanieW',
    'malowanieWewCena',
    'malowanieZ',
    'malowanieZewCena',
    'precoFullHeight',
    'pehdDiscount',
    'autoSelect',
    'autoLocked',
    'configSource',
    'config',
    'przejscia'
];

/**
 * Kopiuje wyłącznie pola z allowlisty (płytko). Obiekty zagnieżdżone
 * (config/przejscia/zakonczenieByDn) obsługują dedykowane buildery.
 * @param {Object} src
 * @param {Array<string>} fields
 * @returns {Object}
 */
function _pickDtoFields(src, fields) {
    const out = {};
    if (!src || typeof src !== 'object') return out;
    for (const f of fields) {
        if (src[f] !== undefined) out[f] = src[f];
    }
    return out;
}

/**
 * @param {Object} item pozycja well.config
 * @returns {Object|null} DTO pozycji albo null dla pustych wpisów
 */
function toWellConfigItemDTO(item) {
    if (!item || typeof item !== 'object' || !item.productId) return null;
    const dto = _pickDtoFields(item, ORDER_CONFIG_ITEM_FIELDS);
    if (dto.quantity == null) dto.quantity = 1;
    return dto;
}

/**
 * @param {Object} pr pozycja well.przejscia
 * @returns {Object|null} DTO przejścia albo null dla pustych wpisów
 */
function toWellPrzejscieDTO(pr) {
    if (!pr || typeof pr !== 'object' || !pr.productId) return null;
    return _pickDtoFields(pr, ORDER_PRZEJSCIE_FIELDS);
}

/**
 * Buduje transportowe DTO studni (allowlist). Nie mutuje wejścia.
 * @param {Object} well studnia z UI (pełny obiekt SSoT)
 * @returns {Object|null} DTO studni albo null dla pustych wpisów
 */
function toWellOrderDTO(well) {
    if (!well || typeof well !== 'object') return null;
    const dto = _pickDtoFields(well, ORDER_WELL_FIELDS);
    if (Array.isArray(well.config)) {
        dto.config = well.config.map(toWellConfigItemDTO).filter(Boolean);
    }
    if (Array.isArray(well.przejscia)) {
        dto.przejscia = well.przejscia.map(toWellPrzejscieDTO).filter(Boolean);
    }
    if (well.zakonczenieByDn && typeof well.zakonczenieByDn === 'object') {
        dto.zakonczenieByDn = { ...well.zakonczenieByDn };
    }
    return dto;
}

/**
 * Mapuje tablicę studni UI na tablicę DTO (pomija puste wpisy).
 * @param {Array} wellsArr
 * @returns {Array}
 */
function toOrderWellsDTO(wellsArr) {
    if (!Array.isArray(wellsArr)) return [];
    return wellsArr.map(toWellOrderDTO).filter(Boolean);
}

window.toWellConfigItemDTO = toWellConfigItemDTO;
window.toWellPrzejscieDTO = toWellPrzejscieDTO;
window.toWellOrderDTO = toWellOrderDTO;
window.toOrderWellsDTO = toOrderWellsDTO;
window.ORDER_WELL_FIELDS = ORDER_WELL_FIELDS;
window.ORDER_CONFIG_ITEM_FIELDS = ORDER_CONFIG_ITEM_FIELDS;
window.ORDER_PRZEJSCIE_FIELDS = ORDER_PRZEJSCIE_FIELDS;
