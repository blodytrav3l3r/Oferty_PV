// @ts-check
/* ===== pricelistXlsx.js — wspólny parser importu XLSX cenników (Etap B konsolidacji) =====
 *
 * Czyste funkcje bez DOM/fetch: XLSX i workbook wchodzą jako parametry,
 * zero side-effectów. Używają: rury/pricelistUi.js (importRuryFromExcel,
 * tylko pierwszy arkusz) i studnie/pricelistImportExport.js
 * (importStudnieFromExcel, wszystkie arkusze + PRECO_*).
 * JEDYNY nowy global: window.pricelistXlsx (IIFE, nic poza namespace).
 */

(function () {
    'use strict';

    /**
     * Mapuje kolumny surowego wiersza (polskie nagłówki lub surowe klucze)
     * na klucze produktu. Zwraca NOWY obiekt, nie mutuje wejścia.
     */
    function mapHeaders(raw, headerToKey) {
        var product = {};
        Object.keys(raw).forEach(function (col) {
            var key = (headerToKey && headerToKey[col]) || col;
            product[key] = raw[col];
        });
        return product;
    }

    /**
     * Solidne parsowanie pól liczbowych: spacje precz, przecinek na kropkę,
     * puste/myślniki/em-dash na default (emptyDefaults) lub null.
     * Mutuje i zwraca przekazany produkt (jak dotychczas w callerach).
     */
    function coerceNumerics(product, numericFields, emptyDefaults) {
        (numericFields || []).forEach(function (f) {
            var val = product[f];
            if (val === '' || val === undefined || val === null || val === '-' || val === '—') {
                product[f] =
                    emptyDefaults && Object.prototype.hasOwnProperty.call(emptyDefaults, f)
                        ? emptyDefaults[f]
                        : null;
            } else if (typeof val === 'string') {
                val = val.replace(/\s/g, '').replace(',', '.');
                var num = parseFloat(val);
                product[f] = isNaN(num) ? null : num;
            } else {
                var num2 = parseFloat(val);
                product[f] = isNaN(num2) ? null : num2;
            }
        });
        return product;
    }

    /**
     * Trimuje id/name w przekazanym produkcie. Zwraca false gdy brak ID lub nazwy.
     */
    function validateProductIdName(product) {
        product.id = String(product.id || '').trim();
        product.name = String(product.name || '').trim();
        return Boolean(product.id && product.name);
    }

    /**
     * Zbiorcza normalizacja surowych wierszy: mapowanie nagłówków, preValidate,
     * walidacja id/name, dedup po id, coerce liczb, postCoerce.
     * opts: { headerToKey, numericFields, emptyDefaults, preValidate(product, raw),
     *         postCoerce(product, raw), onSkip(index, reason, product) }
     * reason: 'missing-id-or-name' | 'duplicate-id'.
     */
    function normalizeRows(rawRows, opts) {
        var o = opts || {};
        var headerToKey = o.headerToKey || {};
        var seenIds = new Set();
        var out = [];
        (rawRows || []).forEach(function (raw, index) {
            var product = mapHeaders(raw, headerToKey);
            if (typeof o.preValidate === 'function') o.preValidate(product, raw);
            if (!validateProductIdName(product)) {
                if (typeof o.onSkip === 'function') o.onSkip(index, 'missing-id-or-name', product);
                return;
            }
            if (seenIds.has(product.id)) {
                if (typeof o.onSkip === 'function') o.onSkip(index, 'duplicate-id', product);
                return;
            }
            seenIds.add(product.id);
            coerceNumerics(product, o.numericFields, o.emptyDefaults);
            if (typeof o.postCoerce === 'function') o.postCoerce(product, raw);
            out.push(product);
        });
        return out;
    }

    /**
     * Wiersz arkusza PRECO_* do precoDataMap. Logika 1:1 ze studniowym importem
     * (PRECO_Kinety / PRECO_Dodatki / PRECO_Zakresy, grupowanie po 'DN Studni').
     */
    function collectPrecoRows(precoDataMap, sheetName, sheetJson) {
        sheetJson.forEach(function (row) {
            var dn = row['DN Studni'];
            if (!dn) return;
            if (!precoDataMap[dn]) {
                precoDataMap[dn] = {
                    kinety: [],
                    spadekKineta: [],
                    spadekMufa: [],
                    uniesienie: [],
                    redukcja: [],
                    skrzynkaWlazowa: null,
                    cenaPelnaWysMB: 0,
                    cenaDnoOsadnika: 0
                };
            }

            if (sheetName === 'PRECO_Kinety') {
                precoDataMap[dn].kinety.push({
                    dn: row['DN Rury'] || 0,
                    prosta: row['Cena prosta (PLN)'] || 0,
                    dodWlot: row['Dod. wlot (PLN)'] || 0
                });
            } else if (sheetName === 'PRECO_Dodatki') {
                precoDataMap[dn].skrzynkaWlazowa = row['Skrzynka włazowa'] || 0;
                precoDataMap[dn].cenaPelnaWysMB = row['Cena pełna wys MB'] || 0;
                precoDataMap[dn].cenaDnoOsadnika = row['Cena dna osadnika'] || 0;
            } else if (sheetName === 'PRECO_Zakresy') {
                var typ = row['Typ'];
                if (typ && precoDataMap[dn][typ]) {
                    var min = row['Min'] || 0;
                    var max = row['Max'] || 0;
                    var g = row['Grupa DN'];
                    var cena = row['Cena (PLN)'] || 0;

                    var table = precoDataMap[dn][typ];
                    var existingRow = null;
                    for (var i = 0; i < table.length; i++) {
                        if (table[i].min === min && table[i].max === max) {
                            existingRow = table[i];
                            break;
                        }
                    }
                    if (!existingRow) {
                        existingRow = { min: min, max: max, grupy: {} };
                        table.push(existingRow);
                    }
                    if (g) existingRow.grupy[g] = cena;
                }
            }
        });
    }

    /**
     * Rozbija workbook na surowe wiersze + precoDataMap.
     * opts: { firstSheetOnly: true (rury) | false (studnie),
     *         includePreco: true (studnie) | false (rury) }
     */
    function parseWorkbookToJson(XLSX, workbook, opts) {
        var o = opts || {};
        var rows = [];
        var precoDataMap = {};
        var names = workbook.SheetNames || [];
        if (o.firstSheetOnly === true) names = names.slice(0, 1);
        names.forEach(function (sheetName) {
            var worksheet = workbook.Sheets[sheetName];
            var sheetJson = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
            if (!sheetJson || sheetJson.length === 0) return;
            if (o.includePreco === true && sheetName.indexOf('PRECO_') === 0) {
                collectPrecoRows(precoDataMap, sheetName, sheetJson);
                return;
            }
            rows = rows.concat(sheetJson);
        });
        return { rows: rows, precoDataMap: precoDataMap };
    }

    window.pricelistXlsx = window.pricelistXlsx || {};
    window.pricelistXlsx.mapHeaders = mapHeaders;
    window.pricelistXlsx.coerceNumerics = coerceNumerics;
    window.pricelistXlsx.validateProductIdName = validateProductIdName;
    window.pricelistXlsx.normalizeRows = normalizeRows;
    window.pricelistXlsx.parseWorkbookToJson = parseWorkbookToJson;
})();
