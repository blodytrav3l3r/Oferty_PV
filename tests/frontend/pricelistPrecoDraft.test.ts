// @ts-nocheck
/* =============================================================
   Konsolidacja cenników — finał: import XLSX z arkuszami PRECO_*
   z celem 'draft' tworzy też draft PRECO (konwersja nested→flat
   1:1 z flattenAndSave z src/routes/precoPricingV2.ts).
   Wzorzec: vm sandbox jak w pricelistImportDraft.test.ts.
   ============================================================= */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const ROOT = path.join(__dirname, '..', '..');
const readPub = (rel) => fs.readFileSync(path.join(ROOT, 'public', 'js', rel), 'utf8');

function loadShared(sandbox) {
    vm.runInContext(readPub('shared/pricelistXlsx.js'), sandbox, {
        filename: 'pricelistXlsx.js'
    });
    return sandbox.window.pricelistXlsx;
}

function baseSandbox() {
    const sandbox = {
        window: {},
        console,
        setTimeout: (fn) => 0,
        URL: { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} }
    };
    vm.createContext(sandbox);
    return sandbox;
}

const flush = async (n = 10) => {
    for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0));
};

function stubCommon(sandbox, { fetchImpl, rowsBySheet }) {
    sandbox.fetch = jest.fn(fetchImpl || (async () => ({ ok: true, json: async () => ({}) })));
    sandbox.authHeaders = () => ({ Authorization: 'Bearer t' });
    sandbox.appConfirm = async () => true;
    sandbox.showToast = jest.fn();
    sandbox.logger = { error: jest.fn(), warn: jest.fn(), info: jest.fn() };
    sandbox.ensureXlsx = async () => {};
    sandbox.XLSX = {
        read: () => ({ SheetNames: Object.keys(rowsBySheet), Sheets: rowsBySheet }),
        utils: { sheet_to_json: (ws) => ws }
    };
    sandbox.FileReader = class {
        readAsArrayBuffer() {
            this.onload({ target: { result: new ArrayBuffer(8) } });
        }
    };
    sandbox.document = {
        querySelectorAll: () => [],
        getElementById: () => null,
        createElement: () => ({ style: {}, setAttribute: () => {}, click: () => {} }),
        body: { appendChild: () => {} },
        addEventListener: () => {}
    };
}

const xlsxEvent = () => ({ target: { files: [{ name: 'c.xlsx' }], value: 'x' } });

const STUDNIE_ROWS = [{ Indeks: 'S1', Nazwa: 'Krąg 1000', 'Cena PLN': 500 }];
const PRECO_ROWS = [
    { 'DN Studni': 1000, 'DN Rury': 160, 'Cena prosta (PLN)': 500, 'Dod. wlot (PLN)': 50 }
];

function loadStudnie(fetchImpl, withPreco) {
    const sb = baseSandbox();
    loadShared(sb);
    const sheets = { DN1000: STUDNIE_ROWS };
    if (withPreco) sheets.PRECO_Kinety = PRECO_ROWS;
    stubCommon(sb, { fetchImpl, rowsBySheet: sheets });
    sb.HEADER_TO_KEY = { Indeks: 'id', Nazwa: 'name', 'Cena PLN': 'price' };
    sb.studnieProducts = [];
    sb.window.studnieProducts = [];
    sb._studniePricelistDirty = false;
    sb.renderStudniePriceList = () => {};
    sb.renderTiles = () => {};
    sb.updateStudnieSaveBtn = () => {};
    sb.updatePrecoSaveBtn = () => {};
    vm.runInContext(readPub('studnie/pricelistImportExport.js'), sb, {
        filename: 'pricelistImportExport.js'
    });
    return sb;
}

describe('precoNestedToFlat: semantyka 1:1 z flattenAndSave', () => {
    function nestedFixture() {
        return {
            1000: {
                kinety: [
                    { dn: 160, prosta: 500, dodWlot: 50 },
                    { dn: 200, prosta: 600, dodWlot: 60, order: 7 }
                ],
                spadekKineta: [{ min: 0, max: 10, grupy: { 160: 100 } }],
                spadekMufa: [],
                uniesienie: [],
                redukcja: [],
                skrzynkaWlazowa: 200,
                cenaPelnaWysMB: 300,
                cenaDnoOsadnika: 400
            },
            1200: {
                kinety: [],
                spadekKineta: [],
                spadekMufa: [],
                uniesienie: [],
                redukcja: [{ min: 5, max: 15, grupy: { 200: 150 }, order: 3 }],
                skrzynkaWlazowa: 0,
                cenaPelnaWysMB: 0,
                cenaDnoOsadnika: 0
            }
        };
    }

    test('deep-equal: id/order/grupy-string/Number DN, liczniki globalne', () => {
        const sb = baseSandbox();
        const PX = loadShared(sb);
        const input = nestedFixture();
        const before = JSON.stringify(input);
        const flat = PX.precoNestedToFlat(input);

        expect(flat.konfig).toEqual([
            {
                id: 'preco_konfig_1000',
                key: '1000',
                value: JSON.stringify({
                    spadekKineta: [{ min: 0, max: 10, grupy: { 160: 100 } }],
                    spadekMufa: [],
                    uniesienie: [],
                    redukcja: [],
                    skrzynkaWlazowa: 200,
                    cenaPelnaWysMB: 300,
                    cenaDnoOsadnika: 400
                })
            },
            {
                id: 'preco_konfig_1200',
                key: '1200',
                value: JSON.stringify({
                    spadekKineta: [],
                    spadekMufa: [],
                    uniesienie: [],
                    redukcja: [{ min: 5, max: 15, grupy: { 200: 150 }, order: 3 }],
                    skrzynkaWlazowa: 0,
                    cenaPelnaWysMB: 0,
                    cenaDnoOsadnika: 0
                })
            }
        ]);
        expect(flat.kinety).toEqual([
            { id: 'preco_kinety_1000_0', order: 0, dn: 160, wellDn: 1000, height: 500, cena: 50 },
            { id: 'preco_kinety_1000_1', order: 7, dn: 200, wellDn: 1000, height: 600, cena: 60 }
        ]);
        expect(flat.zakresy).toEqual([
            {
                id: 'preco_zakres_spadekKineta_0',
                order: 0,
                label: 'spadekKineta',
                min: 0,
                max: 10,
                grupy: JSON.stringify({ 160: 100 }),
                wellDn: 1000
            },
            {
                id: 'preco_zakres_redukcja_1',
                order: 3,
                label: 'redukcja',
                min: 5,
                max: 15,
                grupy: JSON.stringify({ 200: 150 }),
                wellDn: 1200
            }
        ]);
        expect(typeof flat.zakresy[0].grupy).toBe('string');
        expect(JSON.stringify(input)).toBe(before);
    });

    test('nie-numeryczne klucze pomijane, pusto → puste tablice', () => {
        const sb = baseSandbox();
        const PX = loadShared(sb);
        expect(PX.precoNestedToFlat({})).toEqual({ konfig: [], kinety: [], zakresy: [] });
        expect(PX.precoNestedToFlat(undefined)).toEqual({ konfig: [], kinety: [], zakresy: [] });
        const flat = PX.precoNestedToFlat({
            foo: { kinety: [{ dn: 1, prosta: 1, dodWlot: 1 }] }
        });
        expect(flat).toEqual({ konfig: [], kinety: [], zakresy: [] });
    });
});

describe('studnie draft z PRECO: dwa POSTy', () => {
    test('produkty potem PRECO, ta sama nota, toasty obu wersji', async () => {
        const sb = loadStudnie(async (url) => {
            if (String(url).includes('/preco/drafts'))
                return { ok: true, json: async () => ({ version: { id: 'p1', version: 'v2' } }) };
            return { ok: true, json: async () => ({ version: { id: 'd2', version: 'v5' } }) };
        }, true);
        await sb.importStudnieFromExcel(xlsxEvent(), { target: 'draft', note: 'xls' });
        await flush();

        expect(sb.fetch).toHaveBeenCalledTimes(2);
        const [url1, opts1] = sb.fetch.mock.calls[0];
        const [url2, opts2] = sb.fetch.mock.calls[1];
        expect(url1).toBe('/api/pricelist-versions/studnie/drafts');
        expect(url2).toBe('/api/pricelist-versions/preco/drafts');

        const body1 = JSON.parse(opts1.body);
        expect(body1.rows).toHaveLength(1);
        expect(body1.rows[0].id).toBe('S1');
        expect(body1.note).toBe('xls');

        const body2 = JSON.parse(opts2.body);
        expect(body2.note).toBe('xls');
        expect(body2.rows.konfig).toEqual([
            {
                id: 'preco_konfig_1000',
                key: '1000',
                value: JSON.stringify({
                    spadekKineta: [],
                    spadekMufa: [],
                    uniesienie: [],
                    redukcja: [],
                    skrzynkaWlazowa: null,
                    cenaPelnaWysMB: 0,
                    cenaDnoOsadnika: 0
                })
            }
        ]);
        expect(body2.rows.kinety).toEqual([
            { id: 'preco_kinety_1000_0', order: 0, dn: 160, wellDn: 1000, height: 500, cena: 50 }
        ]);
        expect(body2.rows.zakresy).toEqual([]);

        const ok = sb.showToast.mock.calls.filter((c) => c[1] === 'success').map((c) => c[0]);
        expect(
            ok.find((m) => m.includes('Wersja robocza zapisana') && m.includes('v5'))
        ).toBeTruthy();
        expect(ok.find((m) => m.includes('Draft PRECO zapisany') && m.includes('v2'))).toBeTruthy();
        expect(sb.showToast.mock.calls.find((c) => c[1] === 'warning')).toBeUndefined();
        expect(sb.precoPricing).toBeUndefined();
    });

    test('puste preco → tylko 1 POST (studnie)', async () => {
        const sb = loadStudnie(
            async () => ({
                ok: true,
                json: async () => ({ version: { id: 'd2', version: 'v5' } })
            }),
            false
        );
        await sb.importStudnieFromExcel(xlsxEvent(), { target: 'draft', note: 'xls' });
        await flush();
        expect(sb.fetch).toHaveBeenCalledTimes(1);
        expect(sb.fetch.mock.calls[0][0]).toBe('/api/pricelist-versions/studnie/drafts');
        const ok = sb.showToast.mock.calls.find((c) => c[1] === 'success');
        expect(ok[0]).toContain('v5');
    });

    test('422 z PRECO w treści toasta, draft produktów zostaje', async () => {
        const sb = loadStudnie(async (url) => {
            if (String(url).includes('/preco/drafts'))
                return {
                    ok: false,
                    status: 422,
                    json: async () => ({ error: 'Błędne wiersze PRECO', code: 'INVALID_ROWS' })
                };
            return { ok: true, json: async () => ({ version: { id: 'd2', version: 'v5' } }) };
        }, true);
        await sb.importStudnieFromExcel(xlsxEvent(), { target: 'draft', note: 'xls' });
        await flush();
        expect(sb.fetch).toHaveBeenCalledTimes(2);
        const ok = sb.showToast.mock.calls.find(
            (c) => c[1] === 'success' && c[0].includes('Wersja robocza zapisana')
        );
        expect(ok[0]).toContain('v5');
        const err = sb.showToast.mock.calls.find((c) => c[1] === 'error');
        expect(err[0]).toContain('Błędne wiersze PRECO');
    });
});
