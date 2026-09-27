// @ts-nocheck
/* =============================================================
   Etap D konsolidacji: import XLSX z celem LIVE albo DRAFT
   (rury + studnie-PRODUCTS; PRECO-do-draftu poza zakresem).
   Wzorzec: vm sandbox jak w pricelistXlsx.test.ts.
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

describe('Etap D: buildDraftPayload / splitStudnieImport (czyste)', () => {
    test('buildDraftPayload: pusta nota pominięta, nie mutuje rows', () => {
        const sb = baseSandbox();
        const PX = loadShared(sb);
        const rows = [{ id: 'R1' }];
        expect(PX.buildDraftPayload(rows, '')).toEqual({ rows });
        expect(PX.buildDraftPayload(rows, '   ')).toEqual({ rows });
        expect(PX.buildDraftPayload(rows, undefined)).toEqual({ rows });
        expect(PX.buildDraftPayload(rows, ' import z excela ')).toEqual({
            rows,
            note: 'import z excela'
        });
        expect(rows).toEqual([{ id: 'R1' }]);
    });

    test('splitStudnieImport: rozbija {rows, precoDataMap}, braki na pusto', () => {
        const sb = baseSandbox();
        const PX = loadShared(sb);
        const parsed = { rows: [{ a: 1 }], precoDataMap: { 1000: { kinety: [] } } };
        expect(PX.splitStudnieImport(parsed)).toEqual({
            products: [{ a: 1 }],
            precoDataMap: { 1000: { kinety: [] } }
        });
        expect(PX.splitStudnieImport(undefined)).toEqual({ products: [], precoDataMap: {} });
    });
});

describe('Etap D: rury import target', () => {
    const RURY_ROWS = [
        { Indeks: 'R1', 'Nazwa produktu': 'Rura A', 'Cena PLN (netto)': '100,5' },
        { Indeks: 'R2', 'Nazwa produktu': 'Rura B', 'Cena PLN (netto)': 200 }
    ];

    function loadRury(fetchImpl) {
        const sb = baseSandbox();
        const PX = loadShared(sb);
        stubCommon(sb, { fetchImpl, rowsBySheet: { Arkusz1: RURY_ROWS } });
        sb.CATEGORIES = [];
        sb.products = [];
        vm.runInContext(readPub('rury/pricelistUi.js'), sb, { filename: 'pricelistUi.js' });
        return { sb, PX };
    }

    test('live jawny (Etap E: default bez opts to modal — patrz pricelistImportTarget)', async () => {
        const { sb } = loadRury();
        await sb.importRuryFromExcel(xlsxEvent(), { target: 'live' });
        await flush();
        expect(sb.fetch).not.toHaveBeenCalled();
        expect(sb.products).toHaveLength(2);
        expect(sb.products[0]).toMatchObject({ id: 'R1', price: 100.5 });
        const ok = sb.showToast.mock.calls.find((c) => c[1] === 'success');
        expect(ok[0]).toContain('2 pozycji');
    });

    test('draft: POST rury/drafts z rows+note, LIVE nietknięte, toast z numerem', async () => {
        const { sb } = loadRury(async (url, opts) => ({
            ok: true,
            json: async () => ({ version: { id: 'd1', version: 'v3' } })
        }));
        await sb.importRuryFromExcel(xlsxEvent(), { target: 'draft', note: 'xls' });
        await flush();
        expect(sb.fetch).toHaveBeenCalledTimes(1);
        const [url, opts] = sb.fetch.mock.calls[0];
        expect(url).toBe('/api/pricelist-versions/rury/drafts');
        expect(opts.method).toBe('POST');
        const body = JSON.parse(opts.body);
        expect(body.rows).toHaveLength(2);
        expect(body.note).toBe('xls');
        expect(sb.products).toEqual([]);
        const ok = sb.showToast.mock.calls.find((c) => c[1] === 'success');
        expect(ok[0]).toContain('Wersja robocza zapisana');
        expect(ok[0]).toContain('v3');
    });

    test('draft: błąd 422 serwera w treści toasta', async () => {
        const { sb } = loadRury(async () => ({
            ok: false,
            status: 422,
            json: async () => ({ error: 'Błędne wiersze', code: 'INVALID_ROWS' })
        }));
        await sb.importRuryFromExcel(xlsxEvent(), { target: 'draft' });
        await flush();
        const err = sb.showToast.mock.calls.find((c) => c[1] === 'error');
        expect(err[0]).toContain('Błędne wiersze');
        expect(sb.products).toEqual([]);
    });
});

describe('Etap D: studnie import target', () => {
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

    test('live jawny (Etap E: bez opts pokazuje modal — patrz pricelistImportTarget)', async () => {
        const sb = loadStudnie(undefined, true);
        await sb.importStudnieFromExcel(xlsxEvent(), { target: 'live' });
        await flush();
        expect(sb.fetch).not.toHaveBeenCalled();
        expect(sb.window.studnieProducts).toHaveLength(1);
        expect(sb.precoPricing[1000].kinety).toEqual([{ dn: 160, prosta: 500, dodWlot: 50 }]);
    });

    test('draft: POST studnie/drafts + PRECO/drafts, ta sama nota', async () => {
        const sb = loadStudnie(
            async (url, opts) => ({
                ok: true,
                json: async () => ({ version: { id: 'd2', version: 'v5' } })
            }),
            true
        );
        await sb.importStudnieFromExcel(xlsxEvent(), { target: 'draft', note: 'xls' });
        await flush();
        expect(sb.fetch).toHaveBeenCalledTimes(2);
        const [url, opts] = sb.fetch.mock.calls[0];
        expect(url).toBe('/api/pricelist-versions/studnie/drafts');
        expect(opts.method).toBe('POST');
        const body = JSON.parse(opts.body);
        expect(body.rows).toHaveLength(1);
        expect(body.rows[0].id).toBe('S1');
        const [precoUrl, precoOpts] = sb.fetch.mock.calls[1];
        expect(precoUrl).toBe('/api/pricelist-versions/preco/drafts');
        const precoBody = JSON.parse(precoOpts.body);
        expect(precoBody.note).toBe('xls');
        expect(precoBody.rows.kinety).toHaveLength(1);
        expect(sb.precoPricing).toBeUndefined();
        expect(sb.showToast.mock.calls.find((c) => c[1] === 'warning')).toBeUndefined();
        const ok = sb.showToast.mock.calls.find((c) => c[1] === 'success');
        expect(ok[0]).toContain('Wersja robocza zapisana');
        expect(ok[0]).toContain('v5');
        const precoOk = sb.showToast.mock.calls.find((c) => c[0].includes('Draft PRECO zapisany'));
        expect(precoOk[1]).toBe('success');
    });
});

describe('Etap D: kontrakt (bez UI / DB / endpointów / kształtów plików)', () => {
    test('zero nowych window.* poza namespace pricelistXlsx', () => {
        const rury = readPub('rury/pricelistUi.js');
        const studnie = readPub('studnie/pricelistImportExport.js');
        const shared = readPub('shared/pricelistXlsx.js');
        for (const [src, name] of [
            [rury, 'rury'],
            [studnie, 'studnie']
        ]) {
            const globals = src.match(/^window\.\w+\s*=/gm) || [];
            for (const g of globals) expect(`${name}: ${g}`).not.toContain('defaultTarget');
        }
        expect(shared).toContain('window.pricelistXlsx.buildDraftPayload');
        expect(shared).toContain('window.pricelistXlsx.splitStudnieImport');
        expect(shared).toContain('window.pricelistXlsx.precoNestedToFlat');
        expect(rury).toContain('/api/pricelist-versions/rury/drafts');
        expect(studnie).toContain('/api/pricelist-versions/studnie/drafts');
        expect(studnie).toContain('/api/pricelist-versions/preco/drafts');
        expect(studnie).toContain('Draft PRECO zapisany');
        expect(studnie).not.toContain('Dane PRECO pominięto');
    });
});
