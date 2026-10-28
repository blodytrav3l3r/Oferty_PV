// @ts-nocheck
/* =============================================================
   Eksport/import cennika = WERSJA ZAZNACZONA na osi wersji.
   Popup mówi, który cennik leci do pliku i do którego trafi import.
   ============================================================= */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const ROOT = path.join(__dirname, '..', '..');
const readPub = (rel) => fs.readFileSync(path.join(ROOT, 'public', 'js', rel), 'utf8');

const VERSION = { id: 'v1', version: 'Rv1-20260927', status: 'ACTIVE', sha256: 'sha1' };

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
        setTimeout: () => 0,
        URL: { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} }
    };
    vm.createContext(sandbox);
    return sandbox;
}

const flush = async (n = 10) => {
    for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0));
};

function stubCommon(sandbox, { rowsBySheet, version }) {
    const target = version === undefined ? VERSION : version;
    sandbox.fetch = jest.fn(async () => ({ ok: true, json: async () => ({}) }));
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
    // Kontrakt realnego shared/pricelistVersions.js (implementację ma panel wersji).
    sandbox.window.pricelistVersions = {
        transferVersion: jest.fn(async () => target),
        transferConfirm: jest.fn(async () => true),
        enterVersionEditForImport: jest.fn(() => true),
        exportVersionXlsx: jest.fn(async () => 'Cennik_Rv1-20260927.xlsx')
    };
    return sandbox.window.pricelistVersions;
}

const xlsxEvent = () => ({ target: { files: [{ name: 'c.xlsx' }], value: 'x' } });

describe('eksport cennika = wersja zaznaczona na osi', () => {
    test('rury: transferVersion + popup + plik z serwera', async () => {
        const sb = baseSandbox();
        loadShared(sb);
        const pv = stubCommon(sb, { rowsBySheet: {} });
        sb.products = [{ id: 'R1' }];
        sb._pricelistDirty = false;
        vm.runInContext(readPub('rury/pricelistUi.js'), sb, { filename: 'pricelistUi.js' });

        await sb.exportRuryToExcel();
        expect(pv.transferVersion).toHaveBeenCalledWith('rury');
        expect(pv.transferConfirm).toHaveBeenCalledWith('export', 'rury', VERSION);
        expect(pv.exportVersionXlsx).toHaveBeenCalledWith('rury', VERSION);
        const ok = sb.showToast.mock.calls.find((c) => c[1] === 'success');
        expect(ok[0]).toContain('Rv1-20260927');
    });

    test('studnie: eksportuje wersję z osi, nie „to co w siatce”', async () => {
        const sb = baseSandbox();
        loadShared(sb);
        const pv = stubCommon(sb, { rowsBySheet: {} });
        sb.studnieProducts = [];
        vm.runInContext(readPub('studnie/pricelistImportExport.js'), sb, {
            filename: 'pricelistImportExport.js'
        });

        await sb.exportStudnieToExcel();
        expect(pv.transferVersion).toHaveBeenCalledWith('studnie');
        expect(pv.transferConfirm).toHaveBeenCalledWith('export', 'studnie', VERSION);
        expect(pv.exportVersionXlsx).toHaveBeenCalledWith('studnie', VERSION);
        expect(sb.fetch).not.toHaveBeenCalled();
    });

    test('preco: ta sama ścieżka co rury/studnie', async () => {
        const sb = baseSandbox();
        loadShared(sb);
        const pv = stubCommon(sb, { rowsBySheet: {} });
        sb.precoPricing = {};
        vm.runInContext(readPub('studnie/pricelistPreco.js'), sb, {
            filename: 'pricelistPreco.js'
        });

        await sb.exportPrecoToExcel();
        expect(pv.transferVersion).toHaveBeenCalledWith('preco');
        expect(pv.transferConfirm).toHaveBeenCalledWith('export', 'preco', VERSION);
        expect(pv.exportVersionXlsx).toHaveBeenCalledWith('preco', VERSION);
    });

    test('brak wersji → ostrzeżenie i zero pobierania', async () => {
        const sb = baseSandbox();
        loadShared(sb);
        const pv = stubCommon(sb, { rowsBySheet: {}, version: null });
        sb.products = [{ id: 'R1' }];
        vm.runInContext(readPub('rury/pricelistUi.js'), sb, { filename: 'pricelistUi.js' });

        await sb.exportRuryToExcel();
        expect(pv.exportVersionXlsx).not.toHaveBeenCalled();
        expect(sb.showToast.mock.calls.some((c) => c[1] === 'warning')).toBe(true);
    });

    test('anulowanie popupu → brak pobrania pliku', async () => {
        const sb = baseSandbox();
        loadShared(sb);
        const pv = stubCommon(sb, { rowsBySheet: {} });
        pv.transferConfirm = jest.fn(async () => false);
        sb.products = [{ id: 'R1' }];
        vm.runInContext(readPub('rury/pricelistUi.js'), sb, { filename: 'pricelistUi.js' });

        await sb.exportRuryToExcel();
        expect(pv.exportVersionXlsx).not.toHaveBeenCalled();
    });
});

describe('import cennika = wersja zaznaczona na osi', () => {
    const RURY_ROWS = [
        { Indeks: 'R1', 'Nazwa produktu': 'Rura A', 'Cena PLN (netto)': '100,5' },
        { Indeks: 'R2', 'Nazwa produktu': 'Rura B', 'Cena PLN (netto)': 200 }
    ];
    const STUDNIE_ROWS = [{ Indeks: 'S1', Nazwa: 'Krąg 1000', 'Cena PLN': 500 }];
    const PRECO_ROWS = [
        { 'DN Studni': 1000, 'DN Rury': 160, 'Cena prosta (PLN)': 500, 'Dod. wlot (PLN)': 50 }
    ];

    function loadRury(rowsBySheet) {
        const sb = baseSandbox();
        loadShared(sb);
        const pv = stubCommon(sb, { rowsBySheet: rowsBySheet || { Arkusz1: RURY_ROWS } });
        sb.CATEGORIES = [];
        sb.products = [];
        sb._pricelistDirty = false;
        sb.updateSaveBtn = () => {};
        sb.renderPriceList = () => {};
        vm.runInContext(readPub('rury/pricelistUi.js'), sb, { filename: 'pricelistUi.js' });
        return { sb, pv };
    }

    function loadStudnie(rowsBySheet) {
        const sb = baseSandbox();
        loadShared(sb);
        const pv = stubCommon(sb, {
            rowsBySheet: rowsBySheet || { DN1000: STUDNIE_ROWS }
        });
        sb.HEADER_TO_KEY = { Indeks: 'id', Nazwa: 'name', 'Cena PLN': 'price' };
        sb.studnieProducts = [];
        sb.window.studnieProducts = [];
        sb._studniePricelistDirty = false;
        sb.renderStudniePriceList = () => {};
        sb.renderTiles = () => {};
        sb.updateStudnieSaveBtn = () => {};
        vm.runInContext(readPub('studnie/pricelistImportExport.js'), sb, {
            filename: 'pricelistImportExport.js'
        });
        return { sb, pv };
    }

    function loadPreco(rowsBySheet) {
        const sb = baseSandbox();
        loadShared(sb);
        const pv = stubCommon(sb, { rowsBySheet: rowsBySheet || { PRECO_Kinety: PRECO_ROWS } });
        sb.precoPricing = {};
        sb._precoDirty = false;
        sb.updatePrecoSaveBtn = () => {};
        sb.renderPrecoPriceList = () => {};
        vm.runInContext(readPub('studnie/pricelistImportExport.js'), sb, {
            filename: 'pricelistImportExport.js'
        });
        return { sb, pv };
    }

    test('rury: popup do wybranej wersji, siatka wypełniona, zero POST-ów draftu', async () => {
        const { sb, pv } = loadRury();
        const ev = xlsxEvent();
        await sb.importRuryFromExcel(ev);
        await flush();
        expect(pv.transferConfirm).toHaveBeenCalledWith('import', 'rury', VERSION);
        expect(pv.enterVersionEditForImport).toHaveBeenCalledWith('rury', VERSION);
        expect(sb.products).toHaveLength(2);
        expect(sb.products[0]).toMatchObject({ id: 'R1', price: 100.5 });
        expect(sb.fetch).not.toHaveBeenCalled();
        expect(ev.target.value).toBe('');
        const ok = sb.showToast.mock.calls.find((c) => c[1] === 'success');
        expect(ok[0]).toContain('Rv1-20260927');
    });

    test('rury: anulowanie popupu → pusty input, siatka nietknięta', async () => {
        const { sb, pv } = loadRury();
        pv.transferConfirm = jest.fn(async () => false);
        const ev = xlsxEvent();
        await sb.importRuryFromExcel(ev);
        await flush();
        expect(pv.enterVersionEditForImport).not.toHaveBeenCalled();
        expect(sb.products).toEqual([]);
        expect(ev.target.value).toBe('');
    });

    test('rury: brak edytora w tej zakładce → błąd i zero zmian', async () => {
        const { sb, pv } = loadRury();
        pv.enterVersionEditForImport = jest.fn(() => false);
        await sb.importRuryFromExcel(xlsxEvent());
        await flush();
        expect(sb.products).toEqual([]);
        expect(sb.showToast.mock.calls.some((c) => c[1] === 'error')).toBe(true);
    });

    test('studnie: wersja z osi, arkusze PRECO pomijane', async () => {
        const { sb, pv } = loadStudnie({
            DN1000: STUDNIE_ROWS,
            PRECO_Kinety: PRECO_ROWS
        });
        const ev = xlsxEvent();
        await sb.importStudnieFromExcel(ev);
        await flush();
        expect(pv.transferConfirm).toHaveBeenCalledWith('import', 'studnie', VERSION);
        expect(pv.enterVersionEditForImport).toHaveBeenCalledWith('studnie', VERSION);
        expect(sb.window.studnieProducts).toHaveLength(1);
        expect(sb.precoPricing).toBeUndefined();
        expect(sb.showToast.mock.calls.some((c) => c[0].includes('Arkusze PRECO pominięte'))).toBe(
            true
        );
        expect(sb.fetch).not.toHaveBeenCalled();
        expect(ev.target.value).toBe('');
    });

    test('preco: wersja z osi, dane w siatce PRECO', async () => {
        const { sb, pv } = loadPreco();
        const ev = xlsxEvent();
        await sb.importPrecoFromExcel(ev);
        await flush();
        expect(pv.transferConfirm).toHaveBeenCalledWith('import', 'preco', VERSION);
        expect(pv.enterVersionEditForImport).toHaveBeenCalledWith('preco', VERSION);
        expect(sb.precoPricing[1000].kinety).toEqual([{ dn: 160, prosta: 500, dodWlot: 50 }]);
        expect(sb.fetch).not.toHaveBeenCalled();
        expect(ev.target.value).toBe('');
        const ok = sb.showToast.mock.calls.find((c) => c[1] === 'success');
        expect(ok[0]).toContain('Rv1-20260927');
    });
});

describe('kontrakt: stare ścieżki zniknęły z FE', () => {
    test('brak modala wyboru celu i brak zapisu do draftu z importu', () => {
        const files = [
            readPub('rury/pricelistUi.js'),
            readPub('studnie/pricelistImportExport.js'),
            readPub('studnie/pricelistPreco.js'),
            readPub('shared/pricelistXlsx.js'),
            readPub('shared/pricelistVersions.js')
        ];
        for (const src of files) {
            expect(src).not.toContain('openImportTargetModal');
            expect(src).not.toContain('saveDraftRows');
            expect(src).not.toContain('buildDraftPayload');
        }
    });

    test('wszystkie trzy osie idą tą samą ścieżką transferu', () => {
        const expectAxis = (src, axis) => {
            expect(src).toContain("transferVersion('" + axis + "')");
            expect(src).toContain('transferConfirm(');
            expect(src).toContain('exportVersionXlsx(');
        };
        expectAxis(readPub('rury/pricelistUi.js'), 'rury');
        expectAxis(readPub('studnie/pricelistImportExport.js'), 'studnie');
        expectAxis(readPub('studnie/pricelistPreco.js'), 'preco');
        for (const rel of ['rury/pricelistUi.js', 'studnie/pricelistImportExport.js']) {
            expect(readPub(rel)).toContain('enterVersionEditForImport');
        }
    });
});
