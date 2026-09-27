// @ts-check
/* ===== pricelistXlsx.js — wspólny parser importu XLSX cenników (Etap B konsolidacji) =====
 *
 * Czyste funkcje bez DOM/fetch: XLSX i workbook wchodzą jako parametry,
 * zero side-effectów. Używają: rury/pricelistUi.js (importRuryFromExcel,
 * tylko pierwszy arkusz) i studnie/pricelistImportExport.js
 * (importStudnieFromExcel, wszystkie arkusze + PRECO_*).
 * Wyjątek (Etap E): openImportTargetModal — wspólny builder modala wyboru
 * celu importu (Na żywo / Wersja robocza + nota), wołany z obu wrapperów.
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

    /**
     * Payload POST /api/pricelist-versions/{rury|studnie}/drafts (Etap D).
     * Nota: pusta/biała → pominięta (serwer i tak przyjmie brak).
     * Zwraca NOWY obiekt, nie mutuje rows.
     */
    function buildDraftPayload(rows, note) {
        var payload = { rows: rows };
        var n = note == null ? '' : String(note).trim();
        if (n) payload.note = n;
        return payload;
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
     * Wspólny modal wyboru celu importu XLSX (Etap E, rury + studnie).
     * Dwa przyciski zamiast radio (brak stylu radio w projekcie, zero nowego CSS).
     * Nota przekazywana tylko dla draft; dla live ignorowana (bez ostrzeżenia).
     * X / Escape / klik w tło = anuluj (onCancel).
     * opts: { onPick(target, note), onCancel() }
     * target: 'live' | 'draft'. Dla 'live' note zawsze ''.
     */
    function openImportTargetModal(opts) {
        var o = opts || {};
        var MODAL_ID = 'px-import-target-modal';
        function close() {
            if (typeof window.closeModal === 'function') window.closeModal(MODAL_ID);
        }
        function pick(target) {
            var noteEl =
                typeof document !== 'undefined'
                    ? document.getElementById('px-import-target-note')
                    : null;
            var note = target === 'draft' && noteEl ? noteEl.value || '' : '';
            close();
            if (typeof o.onPick === 'function') o.onPick(target, note);
        }
        function cancel() {
            close();
            if (typeof o.onCancel === 'function') o.onCancel();
        }
        window.showModal({
            id: MODAL_ID,
            titleId: 'px-import-target-title',
            html:
                '<div class="modal"><div class="modal-header"><h3 id="px-import-target-title">' +
                '<i data-lucide="file-input" aria-hidden="true"></i> Import cennika — wybierz cel</h3>' +
                '<button class="btn-icon" id="px-import-target-close" aria-label="Zamknij">' +
                '<i data-lucide="x" aria-hidden="true"></i></button></div>' +
                '<div class="modal-body"><div class="form-group">' +
                '<label class="form-label" for="px-import-target-note">Nota</label>' +
                '<input class="form-input" id="px-import-target-note" maxlength="500" ' +
                'placeholder="Opis zmiany (dla wersji roboczej, opcjonalnie)"></div>' +
                '<div class="modal-footer">' +
                '<button class="btn btn-secondary" id="px-import-target-live">Do cennika na żywo</button>' +
                '<button class="btn btn-primary" id="px-import-target-draft">Jako wersja robocza</button>' +
                '</div></div></div>',
            onClose: cancel
        });
        var overlay = typeof document !== 'undefined' ? document.getElementById(MODAL_ID) : null;
        if (overlay && window.lucide) window.lucide.createIcons({ root: overlay });
        function bind(id, fn) {
            var el = typeof document !== 'undefined' ? document.getElementById(id) : null;
            if (el && typeof el.addEventListener === 'function') el.addEventListener('click', fn);
        }
        bind('px-import-target-live', function () {
            pick('live');
        });
        bind('px-import-target-draft', function () {
            pick('draft');
        });
        bind('px-import-target-close', cancel);
        var noteInput =
            typeof document !== 'undefined'
                ? document.getElementById('px-import-target-note')
                : null;
        if (noteInput && typeof noteInput.addEventListener === 'function') {
            noteInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') pick('draft');
            });
        }
    }

    window.pricelistXlsx = window.pricelistXlsx || {};
    window.pricelistXlsx.mapHeaders = mapHeaders;
    window.pricelistXlsx.coerceNumerics = coerceNumerics;
    window.pricelistXlsx.validateProductIdName = validateProductIdName;
    window.pricelistXlsx.normalizeRows = normalizeRows;
    window.pricelistXlsx.parseWorkbookToJson = parseWorkbookToJson;
    window.pricelistXlsx.buildDraftPayload = buildDraftPayload;
    window.pricelistXlsx.splitStudnieImport = splitStudnieImport;
    window.pricelistXlsx.openImportTargetModal = openImportTargetModal;
})();
