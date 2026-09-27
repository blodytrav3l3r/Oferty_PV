// @ts-nocheck
/* =============================================================
   Etap E konsolidacji: dialog wyboru celu importu XLSX
   (Na żywo / Wersja robocza + nota) w obu cennikach.
   Wzorzec: vm sandbox jak w pricelistImportDraft.test.ts
   + wstrzyknięte stubby showModal/closeModal i prosty fake DOM.
   ============================================================= */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const ROOT = path.join(__dirname, '..', '..');
const readPub = (rel) => fs.readFileSync(path.join(ROOT, 'public', 'js', rel), 'utf8');

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

function loadShared(sandbox) {
    vm.runInContext(readPub('shared/pricelistXlsx.js'), sandbox, {
        filename: 'pricelistXlsx.js'
    });
    return sandbox.window.pricelistXlsx;
}

const flush = async (n = 10) => {
    for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0));
};

/* Fake DOM: getElementById zwraca atrapy z przechwyconymi listenerami i value. */
function makeDoc() {
    const handlers = {};
    const values = {};
    const els = {};
    const getEl = (id) => {
        if (!els[id]) {
            if (!(id in values)) values[id] = '';
            if (!(id in handlers)) handlers[id] = {};
            els[id] = {
                get value() {
                    return values[id];
                },
                set value(v) {
                    values[id] = v;
                },
                innerHTML: '',
                style: {},
                setAttribute: () => {},
                removeAttribute: () => {},
                addEventListener: (ev, fn) => {
                    handlers[id][ev] = fn;
                }
            };
        }
        return els[id];
    };
    return {
        handlers,
        values,
        querySelectorAll: () => [],
        getElementById: (id) => getEl(id),
        createElement: () => ({ style: {}, setAttribute: () => {}, click: () => {} }),
        body: { appendChild: () => {} },
        addEventListener: () => {}
    };
}

function stubModal(sandbox, doc) {
    sandbox.window.showModal = jest.fn((opts) => ({ id: opts.id }));
    sandbox.window.closeModal = jest.fn();
    sandbox.document = doc;
}

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
}

const xlsxEvent = () => ({ target: { files: [{ name: 'c.xlsx' }], value: 'x' } });

describe('Etap E: openImportTargetModal (shared builder)', () => {
    function loadModal() {
        const sb = baseSandbox();
        const PX = loadShared(sb);
        const doc = makeDoc();
        stubModal(sb, doc);
        return { sb, PX, doc };
    }

    test('tytuł, nota i dwa przyciski po polsku; onClose = anuluj', () => {
        const { PX, sb } = loadModal();
        PX.openImportTargetModal({ onPick: () => {}, onCancel: () => {} });
        expect(sb.window.showModal).toHaveBeenCalledTimes(1);
        const opts = sb.window.showModal.mock.calls[0][0];
        expect(opts.id).toBe('px-import-target-modal');
        expect(opts.html).toContain('Import cennika — wybierz cel');
        expect(opts.html).toContain('Opis zmiany (dla wersji roboczej, opcjonalnie)');
        expect(opts.html).toContain('Do cennika na żywo');
        expect(opts.html).toContain('Jako wersja robocza');
        expect(typeof opts.onClose).toBe('function');
    });

    test('live: nota ignorowana (pusta), modal zamknięty', () => {
        const { PX, sb, doc } = loadModal();
        const onPick = jest.fn();
        PX.openImportTargetModal({ onPick, onCancel: () => {} });
        doc.values['px-import-target-note'] = 'jakaś nota';
        doc.handlers['px-import-target-live'].click();
        expect(onPick).toHaveBeenCalledWith('live', '');
        expect(sb.window.closeModal).toHaveBeenCalledWith('px-import-target-modal');
    });

    test('draft: nota przekazana', () => {
        const { PX, doc } = loadModal();
        const onPick = jest.fn();
        PX.openImportTargetModal({ onPick, onCancel: () => {} });
        doc.values['px-import-target-note'] = 'xls import';
        doc.handlers['px-import-target-draft'].click();
        expect(onPick).toHaveBeenCalledWith('draft', 'xls import');
    });

    test('X i onClose (Escape/tło) wołają onCancel', () => {
        const { PX, sb, doc } = loadModal();
        const onCancel = jest.fn();
        const onPick = jest.fn();
        PX.openImportTargetModal({ onPick, onCancel });
        doc.handlers['px-import-target-close'].click();
        expect(onCancel).toHaveBeenCalledTimes(1);
        expect(onPick).not.toHaveBeenCalled();
        const opts = sb.window.showModal.mock.calls[0][0];
        opts.onClose();
        expect(onCancel).toHaveBeenCalledTimes(2);
    });
});

describe('Etap E: rury — modal po parsowaniu', () => {
    const RURY_ROWS = [
        { Indeks: 'R1', 'Nazwa produktu': 'Rura A', 'Cena PLN (netto)': '100,5' },
        { Indeks: 'R2', 'Nazwa produktu': 'Rura B', 'Cena PLN (netto)': 200 }
    ];

    function loadRury(fetchImpl, rowsBySheet) {
        const sb = baseSandbox();
        loadShared(sb);
        stubCommon(sb, { fetchImpl, rowsBySheet: rowsBySheet || { Arkusz1: RURY_ROWS } });
        const doc = makeDoc();
        stubModal(sb, doc);
        sb.CATEGORIES = [];
        sb.products = [];
        vm.runInContext(readPub('rury/pricelistUi.js'), sb, { filename: 'pricelistUi.js' });
        return { sb, doc };
    }

    test('bez opts: modal po parsowaniu, zapis dopiero po wyborze live', async () => {
        const { sb, doc } = loadRury();
        const ev = xlsxEvent();
        await sb.importRuryFromExcel(ev);
        await flush();
        expect(sb.window.showModal).toHaveBeenCalledTimes(1);
        expect(sb.fetch).not.toHaveBeenCalled();
        expect(sb.products).toEqual([]);
        expect(ev.target.value).toBe('x');
        doc.handlers['px-import-target-live'].click();
        await flush();
        expect(sb.products).toHaveLength(2);
        expect(sb.products[0]).toMatchObject({ id: 'R1', price: 100.5 });
        expect(ev.target.value).toBe('');
        const ok = sb.showToast.mock.calls.find((c) => c[1] === 'success');
        expect(ok[0]).toContain('2 pozycji');
    });

    test('bez opts: wybór draft z notą → POST z rows+note, live nietknięte', async () => {
        const { sb, doc } = loadRury(async (url, opts) => ({
            ok: true,
            json: async () => ({ version: { id: 'd1', version: 'v3' } })
        }));
        const ev = xlsxEvent();
        await sb.importRuryFromExcel(ev);
        await flush();
        doc.values['px-import-target-note'] = 'xls';
        doc.handlers['px-import-target-draft'].click();
        await flush();
        expect(sb.fetch).toHaveBeenCalledTimes(1);
        const [url, opts] = sb.fetch.mock.calls[0];
        expect(url).toBe('/api/pricelist-versions/rury/drafts');
        const body = JSON.parse(opts.body);
        expect(body.rows).toHaveLength(2);
        expect(body.note).toBe('xls');
        expect(sb.products).toEqual([]);
        expect(ev.target.value).toBe('');
    });

    test('anulowanie (X): brak zapisu, input wyczyszczony jak dziś', async () => {
        const { sb, doc } = loadRury();
        const ev = xlsxEvent();
        await sb.importRuryFromExcel(ev);
        await flush();
        doc.handlers['px-import-target-close'].click();
        await flush();
        expect(sb.fetch).not.toHaveBeenCalled();
        expect(sb.products).toEqual([]);
        expect(ev.target.value).toBe('');
    });

    test('pusty plik: brak modala, błąd jak dziś', async () => {
        const { sb } = loadRury(undefined, { Arkusz1: [] });
        const ev = xlsxEvent();
        await sb.importRuryFromExcel(ev);
        await flush();
        expect(sb.window.showModal).not.toHaveBeenCalled();
        const err = sb.showToast.mock.calls.find((c) => c[1] === 'error');
        expect(err[0]).toContain('pusty lub ma zły format');
    });

    test('jawny opts.target (Etap D): bez modala, routing jak dziś', async () => {
        const { sb } = loadRury(async (url, opts) => ({
            ok: true,
            json: async () => ({ version: { id: 'd1', version: 'v3' } })
        }));
        await sb.importRuryFromExcel(xlsxEvent(), { target: 'draft', note: 'x' });
        await flush();
        expect(sb.window.showModal).not.toHaveBeenCalled();
        expect(sb.fetch).toHaveBeenCalledTimes(1);
    });
});

describe('Etap E: studnie — modal po parsowaniu', () => {
    const STUDNIE_ROWS = [{ Indeks: 'S1', Nazwa: 'Krąg 1000', 'Cena PLN': 500 }];
    const PRECO_ROWS = [
        { 'DN Studni': 1000, 'DN Rury': 160, 'Cena prosta (PLN)': 500, 'Dod. wlot (PLN)': 50 }
    ];

    function loadStudnie(fetchImpl) {
        const sb = baseSandbox();
        loadShared(sb);
        stubCommon(sb, {
            fetchImpl,
            rowsBySheet: { DN1000: STUDNIE_ROWS, PRECO_Kinety: PRECO_ROWS }
        });
        const doc = makeDoc();
        stubModal(sb, doc);
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
        return { sb, doc };
    }

    test('bez opts: modal, live zapisuje produkty+PRECO lokalnie', async () => {
        const { sb, doc } = loadStudnie();
        await sb.importStudnieFromExcel(xlsxEvent());
        await flush();
        expect(sb.window.showModal).toHaveBeenCalledTimes(1);
        expect(sb.fetch).not.toHaveBeenCalled();
        doc.handlers['px-import-target-live'].click();
        await flush();
        expect(sb.fetch).not.toHaveBeenCalled();
        expect(sb.window.studnieProducts).toHaveLength(1);
        expect(sb.precoPricing[1000].kinety).toEqual([{ dn: 160, prosta: 500, dodWlot: 50 }]);
    });

    test('bez opts: draft z notą → POST tylko produkty, PRECO pominięte + warning', async () => {
        const { sb, doc } = loadStudnie(async (url, opts) => ({
            ok: true,
            json: async () => ({ version: { id: 'd2', version: 'v5' } })
        }));
        const ev = xlsxEvent();
        await sb.importStudnieFromExcel(ev);
        await flush();
        doc.values['px-import-target-note'] = 'xls';
        doc.handlers['px-import-target-draft'].click();
        await flush();
        expect(sb.fetch).toHaveBeenCalledTimes(1);
        const [url, opts] = sb.fetch.mock.calls[0];
        expect(url).toBe('/api/pricelist-versions/studnie/drafts');
        const body = JSON.parse(opts.body);
        expect(body.rows).toHaveLength(1);
        expect(body.note).toBe('xls');
        expect(JSON.stringify(body)).not.toContain('kinety');
        expect(sb.precoPricing).toBeUndefined();
        const warn = sb.showToast.mock.calls.find((c) => c[1] === 'warning');
        expect(warn[0]).toContain('PRECO pominięto');
        expect(ev.target.value).toBe('');
    });
});

describe('Etap E: kontrakt (bez parsowania/endpointów/DB/kształtów)', () => {
    test('zero nowych window.* poza namespace pricelistXlsx; wspólny builder z obu wrapperów', () => {
        const rury = readPub('rury/pricelistUi.js');
        const studnie = readPub('studnie/pricelistImportExport.js');
        const shared = readPub('shared/pricelistXlsx.js');
        for (const [src, name] of [
            [rury, 'rury'],
            [studnie, 'studnie']
        ]) {
            expect(`${name}: ${src}`).toContain('window.pricelistXlsx.openImportTargetModal');
            expect(`${name}: ${src}`).toContain('finishImport');
            const globals = src.match(/^window\.\w+\s*=/gm) || [];
            for (const g of globals) expect(`${name}: ${g}`).not.toContain('openImportTargetModal');
        }
        expect(shared).toContain('window.pricelistXlsx.openImportTargetModal');
        expect(shared).toContain('Do cennika na żywo');
        expect(shared).toContain('Jako wersja robocza');
        expect(rury).not.toContain('Do cennika na żywo');
        expect(studnie).not.toContain('Do cennika na żywo');
    });
});
