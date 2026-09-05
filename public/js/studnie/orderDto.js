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
    'numer',
    'dn',
    'rzednaDna',
    'rzednaWlazu',
    'magazyn',
    'usytuowanie',
    'psiaBuda',
    'stycznaNadbudowa1200',
    'stycznaVariant',
    'zakonczenie',
    'zakonczenieByDn',
    'redukcjaDN1000',
    'redukcjaTargetDN',
    'redukcjaKinety',
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
    'klasaBetonu',
    'klasaNosnosci_korpus',
    'klasaNosnosci_zwienczenie',
    'stopnie',
    'doplata',
    'malowanieW',
    'malowanieWewCena',
    'malowanieZ',
    'malowanieZewCena',
    'powlokaNameW',
    'powlokaNameZ',
    'agresjaChemiczna',
    'agresjaMrozowa',
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

/* ===== SLIM SNAPSHOT (P1) — deterministyczny hash kanonicznego DTO =====
 *
 * configHash = hash pól wpływających na cenę/porównanie (canonical pricing
 * input → stable serialization → FNV-1a). NIE zależy od kolejności kluczy,
 * kolejności elementów config (drag to przetasowanie) ani runtime/cache.
 * Ograniczenie: hash nie widzi zmian cennika katalogowego (ceny z katalogu
 * dla pozycji bez frozenPrice) — rabaty globalne żyją osobno w snapshocie
 * (wellDiscounts), a cena ofertowa jest materializowana w price.
 */

/**
 * Pola studni wchodzące do kanonicznego wejścia cenowego.
 * Ustalona audytem calcWellStats/getItemAssessedPrice/calcPrecoPricing/
 * getPehdEffectiveArea (2026-09-05).
 */
const WELL_PRICING_FIELDS = [
    'dn',
    'psiaBuda',
    'klasaNosnosci_korpus',
    'klasaNosnosci_zwienczenie',
    'dennicaMaterial',
    'material',
    'wkladkaDennica',
    'wkladkaNadbudowa',
    'wkladkaZwienczenie',
    'wkladkaOsadnikPreco',
    'wkladkaOsadnikH',
    'kineta',
    'spocznikH',
    'redukcjaKinety',
    'precoFullHeight',
    'pehdDiscount',
    'stopnie',
    'malowanieW',
    'malowanieWewCena',
    'malowanieZ',
    'malowanieZewCena',
    'doplata'
];

const CONFIG_PRICING_FIELDS = [
    'productId',
    'quantity',
    'frozenPrice',
    'frozenPriceBase',
    'disablePehd',
    'disablePreco'
];

const PRZEJSCIE_PRICING_FIELDS = [
    'productId',
    'dn',
    'rzednaWlaczenia',
    'angle',
    'doplata',
    'frozenPrice'
];

/**
 * Deterministyczna serializacja: sortuje klucze obiektów rekurencyjnie.
 * Tablice zachowują kolejność (kanonizację kolejności robi caller).
 * @param {*} value
 * @returns {string}
 */
function stableStringify(value) {
    if (value === null || value === undefined) return 'null';
    if (Array.isArray(value)) {
        return '[' + value.map(stableStringify).join(',') + ']';
    }
    if (typeof value === 'object') {
        return (
            '{' +
            Object.keys(value)
                .sort()
                .map((k) => JSON.stringify(k) + ':' + stableStringify(value[k]))
                .join(',') +
            '}'
        );
    }
    const s = JSON.stringify(value);
    return s === undefined ? 'null' : s;
}

/**
 * FNV-1a 32-bit → hex. Detekcja zmian, nie kryptografia.
 * @param {string} str
 * @returns {string}
 */
function fnv1aHex(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return ('0000000' + (h >>> 0).toString(16)).slice(-8);
}

/**
 * Kanoniczne wejście cenowe studni (DTO): sortuje pozycje config
 * i przejścia, żeby drag/przetasowanie nie zmieniało hasha.
 * @param {Object} dtoWell studnia po toWellOrderDTO
 * @returns {Object}
 */
function wellPricingInput(dtoWell) {
    const w = dtoWell || {};
    const input = _pickDtoFields(w, WELL_PRICING_FIELDS);
    input.config = (Array.isArray(w.config) ? [...w.config] : [])
        .map((c) => _pickDtoFields(c, CONFIG_PRICING_FIELDS))
        .sort((a, b) =>
            String(a.productId) < String(b.productId)
                ? -1
                : String(a.productId) > String(b.productId)
                  ? 1
                  : (a.quantity || 0) - (b.quantity || 0)
        );
    input.przejscia = (Array.isArray(w.przejscia) ? [...w.przejscia] : [])
        .map((p) => _pickDtoFields(p, PRZEJSCIE_PRICING_FIELDS))
        .sort((a, b) => {
            const ak = String(a.productId) + '|' + String(a.rzednaWlaczenia);
            const bk = String(b.productId) + '|' + String(b.rzednaWlaczenia);
            return ak < bk ? -1 : ak > bk ? 1 : 0;
        });
    return input;
}

/**
 * @param {Object} dtoWell studnia po toWellOrderDTO
 * @returns {string} 8-znakowy hash kanonicznego wejścia cenowego
 */
function wellConfigHash(dtoWell) {
    return fnv1aHex(stableStringify(wellPricingInput(dtoWell)));
}

const roundGrosz = (v) => Math.round((Number(v) || 0) * 100) / 100;

/**
 * Buduje slim snapshot: [{id, name, price, weight, configHash}].
 * statsFn wstrzykiwany dla testowalności; produkcyjnie (w) => calcWellStats(w).
 * @param {Array} dtoWells studnie po toOrderWellsDTO
 * @param {Function} statsFn (well) => ({price, weight})
 * @returns {Array}
 */
function buildSlimWells(dtoWells, statsFn) {
    if (!Array.isArray(dtoWells)) return [];
    return dtoWells.map((w) => {
        let price = 0;
        let weight = 0;
        try {
            const s = typeof statsFn === 'function' ? statsFn(w) : null;
            if (s) {
                price = roundGrosz(s.price);
                weight = roundGrosz(s.weight);
            }
        } catch (_e) {
            // pasywnie — zerowy wpis zamiast wywalenia zapisu
        }
        return {
            id: w ? w.id : undefined,
            name: w ? w.name : undefined,
            price,
            weight,
            configHash: wellConfigHash(w)
        };
    });
}

window.stableStringify = stableStringify;
window.wellConfigHash = wellConfigHash;
window.buildSlimWells = buildSlimWells;
window.WELL_PRICING_FIELDS = WELL_PRICING_FIELDS;
