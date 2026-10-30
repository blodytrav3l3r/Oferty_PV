// @ts-check
/* ===== pricelistXlsx.js — wspólny parser importu XLSX cenników (Etap B konsolidacji) =====
 *
 * Czyste funkcje bez DOM/fetch: XLSX i workbook wchodzą jako parametry,
 * zero side-effectów. Używają: rury/pricelistUi.js (importRuryFromExcel,
 * tylko pierwszy arkusz) i studnie/pricelistImportExport.js
 * (importStudnieFromExcel, wszystkie arkusze bez PRECO_*). Modale (błędów
 * importu) to jedyne funkcje dotykające DOM.
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
    function coerceNumerics(product, numericFields, emptyDefaults, onInvalid) {
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
                if (isNaN(num) && typeof onInvalid === 'function') onInvalid(f, product[f]);
                product[f] = isNaN(num) ? null : num;
            } else {
                var num2 = parseFloat(val);
                if (isNaN(num2) && typeof onInvalid === 'function') onInvalid(f, product[f]);
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
     *         postCoerce(product, raw), onSkip(index, reason, product),
     *         onIssue(index, field, reason, value) }
     * reason: 'missing-id-or-name' | 'duplicate-id' | 'missing-id' |
     *         'missing-name' | 'invalid-number'.
     */
    function normalizeRows(rawRows, opts) {
        var o = opts || {};
        var headerToKey = o.headerToKey || {};
        var seenIds = new Set();
        var out = [];
        var reportIssue = function (index, field, reason, value) {
            if (typeof o.onIssue === 'function') o.onIssue(index, field, reason, value);
        };
        (rawRows || []).forEach(function (raw, index) {
            var product = mapHeaders(raw, headerToKey);
            if (typeof o.preValidate === 'function') o.preValidate(product, raw);
            if (!validateProductIdName(product)) {
                if (!product.id) reportIssue(index, 'id', 'missing-id');
                if (!product.name) reportIssue(index, 'name', 'missing-name');
                if (typeof o.onSkip === 'function') o.onSkip(index, 'missing-id-or-name', product);
                return;
            }
            if (seenIds.has(product.id)) {
                reportIssue(index, 'id', 'duplicate-id', product.id);
                if (typeof o.onSkip === 'function') o.onSkip(index, 'duplicate-id', product);
                return;
            }
            seenIds.add(product.id);
            coerceNumerics(product, o.numericFields, o.emptyDefaults, function (field, value) {
                reportIssue(index, field, 'invalid-number', value);
            });
            if (typeof o.postCoerce === 'function') o.postCoerce(product, raw);
            out.push(product);
        });
        return out;
    }

    /**
     * Wspólny kształt błędu importu (wiersz 1 = nagłówek XLSX).
     * `headerToKey` służy do pokazania ludzkiej nazwy kolumny.
     */
    function importIssue(index, field, reason, headerToKey) {
        var reverse = {};
        Object.keys(headerToKey || {}).forEach(function (header) {
            reverse[headerToKey[header]] = header;
        });
        var messages = {
            'missing-id': 'Brak indeksu',
            'missing-name': 'Brak nazwy',
            'duplicate-id': 'Zduplikowany indeks',
            'invalid-number': 'Nieprawidłowa liczba'
        };
        return {
            row: index + 2,
            column: reverse[field] || field || '—',
            field: field || '',
            message: messages[reason] || String(reason)
        };
    }

    /**
     * Liczba z surowej komórki XLSX dla ścieżki PRECO (1:1 z coerceNumerics:
     * spacje precz, przecinek na kropkę, puste/'-'/'—' → null).
     * Reuse zamiast dubla logiki; null przepuszcza dalej by BE zwrócił
     * jawny 422 (D-FIX-2: zakaz cichego 0).
     */
    function precoNum(val) {
        var o = { v: val };
        coerceNumerics(o, ['v']);
        return o.v;
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
                    dn: precoNum(row['DN Rury']),
                    prosta: precoNum(row['Cena prosta (PLN)']),
                    dodWlot: precoNum(row['Dod. wlot (PLN)'])
                });
            } else if (sheetName === 'PRECO_Dodatki') {
                precoDataMap[dn].skrzynkaWlazowa = precoNum(row['Skrzynka włazowa']);
                precoDataMap[dn].cenaPelnaWysMB = precoNum(row['Cena pełna wys MB']);
                precoDataMap[dn].cenaDnoOsadnika = precoNum(row['Cena dna osadnika']);
            } else if (sheetName === 'PRECO_Zakresy') {
                var typ = row['Typ'];
                if (typ && precoDataMap[dn][typ]) {
                    var min = precoNum(row['Min']);
                    var max = precoNum(row['Max']);
                    var g = row['Grupa DN'];
                    var cena = precoNum(row['Cena (PLN)']);

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
        var allNames = workbook.SheetNames || [];
        var names = allNames;
        if (o.firstSheetOnly === true) {
            names = names
                .filter(function (n) {
                    return n.indexOf('_') !== 0;
                })
                .slice(0, 1);
        }
        names.forEach(function (sheetName) {
            var worksheet = workbook.Sheets[sheetName];
            // Arkusze techniczne (np. `_Cennik` z numerem wersji) — nigdy produkty.
            if (sheetName.indexOf('_') === 0) return;
            var sheetJson = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
            if (!sheetJson || sheetJson.length === 0) return;
            // Arkusze PRECO_* nigdy nie są wierszami produktów. Import PRECO
            // czyta je tylko przy includePreco=true; studnie je pomijają.
            if (sheetName.indexOf('PRECO_') === 0) {
                if (o.includePreco === true) {
                    collectPrecoRows(precoDataMap, sheetName, sheetJson);
                }
                return;
            }
            rows = rows.concat(sheetJson);
        });
        return {
            rows: rows,
            precoDataMap: precoDataMap,
            sheetCount: allNames.length,
            sheetName: allNames[0] || ''
        };
    }

    /**
     * PRECO nested→flat 1:1 z flattenAndSave (src/routes/precoPricingV2.ts).
     * Wejście: precoDataMap {DN: {kinety:[{dn,prosta,dodWlot}], <label>:[{min,max,grupy}],
     *   skrzynkaWlazowa, cenaPelnaWysMB, cenaDnoOsadnika}}.
     * Wyjście: {konfig:[{id,key,value}], kinety:[{id,order,dn,wellDn,height,cena}],
     *   zakresy:[{id,order,label,min,max,grupy,wellDn}]} (grupy = JSON-string).
     * Czysta funkcja: zero DOM/fetch, nie mutuje wejścia.
     */
    function precoNestedToFlat(precoDataMap) {
        var RANGE_TYPES = ['spadekKineta', 'spadekMufa', 'uniesienie', 'redukcja'];
        var konfigRows = [];
        var kinetyRows = [];
        var zakresyRows = [];
        var kinetyIdx = 0;
        var zakresIdx = 0;
        var input = precoDataMap || {};
        Object.keys(input).forEach(function (key) {
            var value = input[key];
            var dn = Number(key);
            if (isNaN(dn) || typeof value !== 'object' || value === null || Array.isArray(value)) {
                return;
            }
            var kinety = value.kinety;
            var scalarFields = {};
            Object.keys(value).forEach(function (k) {
                if (k !== 'kinety') scalarFields[k] = value[k];
            });
            konfigRows.push({
                id: 'preco_konfig_' + key,
                key: key,
                value: JSON.stringify(scalarFields)
            });
            if (Array.isArray(kinety)) {
                kinety.forEach(function (k) {
                    var kin = k || {};
                    kinetyRows.push({
                        id: 'preco_kinety_' + key + '_' + kinetyIdx,
                        order: kin.order != null ? kin.order : kinetyIdx,
                        dn: kin.dn != null ? kin.dn : 0,
                        wellDn: dn,
                        height: kin.prosta != null ? kin.prosta : kin.height,
                        cena: kin.dodWlot != null ? kin.dodWlot : kin.cena
                    });
                    kinetyIdx++;
                });
            }
            RANGE_TYPES.forEach(function (label) {
                var arr = value[label];
                if (Array.isArray(arr)) {
                    arr.forEach(function (item) {
                        var it = item || {};
                        var grupy = it.grupy != null ? it.grupy : {};
                        zakresyRows.push({
                            id: 'preco_zakres_' + label + '_' + zakresIdx,
                            order: it.order != null ? it.order : zakresIdx,
                            label: label,
                            min: it.min,
                            max: it.max,
                            grupy: JSON.stringify(grupy),
                            wellDn: dn
                        });
                        zakresIdx++;
                    });
                }
            });
        });
        return { konfig: konfigRows, kinety: kinetyRows, zakresy: zakresyRows };
    }

    /**
     * Rozbija wynik parseWorkbookToJson na produkty + precoDataMap (Etap D,
     * testowalny alias kształtu { rows, precoDataMap }).
     */
    function splitStudnieImport(parsed) {
        var p = parsed || {};
        return { products: p.rows || [], precoDataMap: p.precoDataMap || {} };
    }

    /**
     * Modal błędów importu: wiersz / kolumna / problem. Bez częściowego zapisu.
     * opts: { issues: [{row, column, message}], onClose() }
     */
    function openImportErrorsModal(opts) {
        var o = opts || {};
        var issues = Array.isArray(o.issues) ? o.issues : [];
        var MODAL_ID = 'px-import-errors-modal';
        var escCell = function (value) {
            return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
                return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
            });
        };
        var rows = issues.slice(0, 100).map(function (issue) {
            return (
                '<tr><td>' +
                escCell(issue.row == null ? '—' : issue.row) +
                '</td><td>' +
                escCell(issue.column || issue.field || '—') +
                '</td><td>' +
                escCell(issue.message || 'Nieprawidłowa wartość') +
                '</td></tr>'
            );
        });
        var more =
            issues.length > 100
                ? '<p class="text-muted">Pokazano 100 z ' +
                  issues.length +
                  ' błędów — popraw plik i zaimportuj ponownie.</p>'
                : '';
        function close() {
            if (typeof window.closeModal === 'function') window.closeModal(MODAL_ID);
            if (typeof o.onClose === 'function') o.onClose();
        }
        window.showModal({
            id: MODAL_ID,
            titleId: 'px-import-errors-title',
            html:
                '<div class="modal"><div class="modal-header"><h3 id="px-import-errors-title">' +
                '<i data-lucide="alert-triangle" aria-hidden="true"></i> Import przerwany — błędy w komórkach</h3>' +
                '<button class="btn-icon" id="px-import-errors-close" aria-label="Zamknij">' +
                '<i data-lucide="x" aria-hidden="true"></i></button></div>' +
                '<div class="modal-body"><p class="color-warn">Nie zapisano żadnych wierszy. Popraw wskazane komórki i zaimportuj plik ponownie.</p>' +
                '<div class="table-wrap"><table><thead><tr><th scope="col">Wiersz</th>' +
                '<th scope="col">Kolumna</th><th scope="col">Problem</th></tr></thead><tbody>' +
                (rows.length > 0
                    ? rows.join('')
                    : '<tr><td colspan="3" class="text-muted">Brak szczegółów błędu.</td></tr>') +
                '</tbody></table></div>' +
                more +
                '</div></div>'
        });
        var overlay = typeof document !== 'undefined' ? document.getElementById(MODAL_ID) : null;
        if (overlay && window.lucide) window.lucide.createIcons({ root: overlay });
        var closeButton =
            typeof document !== 'undefined'
                ? document.getElementById('px-import-errors-close')
                : null;
        if (closeButton && typeof closeButton.addEventListener === 'function') {
            closeButton.addEventListener('click', close);
        }
    }

    /**
     * Arkusze PRECO_* (shape LIVE z wersji cennika) → precoDataMap 1:1 z importem.
     * Reuse collectPrecoRows; bez XLSX i bez DOM.
     */
    function precoSheetsToMap(sheets) {
        var map = {};
        Object.keys(sheets || {}).forEach(function (name) {
            if (name.indexOf('PRECO_') !== 0) return;
            var rows = sheets[name];
            if (Array.isArray(rows) && rows.length > 0) collectPrecoRows(map, name, rows);
        });
        return map;
    }

    window.pricelistXlsx = window.pricelistXlsx || {};
    window.pricelistXlsx.mapHeaders = mapHeaders;
    window.pricelistXlsx.coerceNumerics = coerceNumerics;
    window.pricelistXlsx.validateProductIdName = validateProductIdName;
    window.pricelistXlsx.normalizeRows = normalizeRows;
    window.pricelistXlsx.importIssue = importIssue;
    window.pricelistXlsx.issuesFromDetails = function (details) {
        return (Array.isArray(details) ? details : []).map(function (detail) {
            var d = detail || {};
            return {
                row: d.row,
                column: d.column || d.field,
                message: d.message
            };
        });
    };
    window.pricelistXlsx.parseWorkbookToJson = parseWorkbookToJson;
    window.pricelistXlsx.precoSheetsToMap = precoSheetsToMap;
    window.pricelistXlsx.precoNestedToFlat = precoNestedToFlat;
    window.pricelistXlsx.splitStudnieImport = splitStudnieImport;
    window.pricelistXlsx.openImportErrorsModal = openImportErrorsModal;
})();
