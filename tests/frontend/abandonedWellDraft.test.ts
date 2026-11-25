import fs from 'fs';
import path from 'path';
import vm from 'vm';

const SRC = path.join(__dirname, '../../public/js/studnie/actionsWellCrud.js');
const STYCZNA_SRC = path.join(__dirname, '../../public/js/studnie/popupsStyczna.js');

interface TestProduct {
    id: string;
    componentType: string;
    dn: number;
}

interface TestWell {
    id: string;
    name: string;
    numer: string;
    dn: string | number;
    config: Array<{ productId?: string; quantity?: number }>;
    przejscia: Array<Record<string, unknown>>;
    rzednaWlazu: number | null;
    rzednaDna: number | null;
    doplata: number;
    uwagi: string;
    klasaBetonu?: string;
}

interface TestContext {
    window: {
        _rebuildWellsById: () => number;
        _excelRebuildWellIndex: () => number;
        _excelResetLayoutDependentState: () => number;
        clearExcelRowSelection: () => void;
        _excelInvalidateFilteredIndexes: () => void;
        draftAutosave: { scheduleSave: () => number };
        pzGuard?: { hasPzForWell: () => boolean };
    };
    document: { querySelectorAll: () => unknown[]; getElementById: () => null };
    wells: TestWell[];
    currentWellIndex: number;
    orderEditMode: unknown;
    productionOrders: unknown[];
    wellCounter: number;
    offerDefaultZakonczenie: string | null;
    offerDefaultRedukcja: boolean;
    offerDefaultRedukcjaMinH: number;
    offerDefaultRedukcjaZak: string | null;
    studnieProducts: unknown[];
    getStudnieProductById: (id: string) => TestProduct | null;
    enforceGlobalKonusPehdRule: () => boolean;
    isWellLocked: () => boolean;
    showToast: (message: string) => void;
    refreshAll: () => void;
    showStycznaPopup: () => void;
    createNewWell: (name: string | null, dn: string | number) => TestWell;
    addNewWell: ((dn?: string | number, preparedWell?: TestWell | null) => void) & {
        __rememberPristineDraft: (well: TestWell) => void;
    };
    handleStycznaProductChoice: (productId: string, mode: string) => Promise<void>;
    _excelRowSelectStates?: Record<number, boolean>;
}

function loadActions() {
    const toastMessages: string[] = [];
    const calls = {
        rebuild: 0,
        excelRebuild: 0,
        excelReset: 0,
        excelSelectionClear: 0,
        draftSave: 0,
        stycznaPopup: 0
    };
    const wellIndexes = new Map<string, number>();
    const excelIndexes = new Map<string, number>();
    let context: TestContext;
    const rawContext = {
        window: {
            _rebuildWellsById: () => {
                calls.rebuild++;
                wellIndexes.clear();
                context.wells.forEach((well, index) => wellIndexes.set(well.id, index));
                return wellIndexes.size;
            },
            _excelRebuildWellIndex: () => {
                calls.excelRebuild++;
                excelIndexes.clear();
                context.wells.forEach((well, index) => excelIndexes.set(well.id, index));
                return excelIndexes.size;
            },
            _excelResetLayoutDependentState: () => calls.excelReset++,
            clearExcelRowSelection: () => {
                calls.excelSelectionClear++;
                context._excelRowSelectStates = {};
            },
            _excelInvalidateFilteredIndexes: () => {},
            draftAutosave: { scheduleSave: () => calls.draftSave++ }
        },
        document: {
            querySelectorAll: () => [],
            getElementById: () => null
        },
        wells: [],
        currentWellIndex: 0,
        orderEditMode: null,
        productionOrders: [],
        wellCounter: 0,
        offerDefaultZakonczenie: null,
        offerDefaultRedukcja: false,
        offerDefaultRedukcjaMinH: 0,
        offerDefaultRedukcjaZak: null,
        studnieProducts: [],
        getStudnieProductById: () => null,
        enforceGlobalKonusPehdRule: () => false,
        isWellLocked: () => false,
        showToast: (message: string) => toastMessages.push(message),
        refreshAll: () => {},
        showStycznaPopup: () => calls.stycznaPopup++,
        closeModal: () => {}
    };
    context = rawContext as unknown as TestContext;
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(SRC, 'utf8'), context, { filename: SRC });
    return { context, toastMessages, calls, wellIndexes, excelIndexes };
}

function addCurrentDraft(context: TestContext) {
    const well = context.createNewWell(null, 1200);
    context.wells.push(well);
    context.currentWellIndex = context.wells.length - 1;
    context.addNewWell.__rememberPristineDraft(well);
    return well;
}

describe('addNewWell removes a pristine abandoned draft', () => {
    test('removes the previous untouched, unnamed, empty draft when another well is added', () => {
        const { context, toastMessages, calls, wellIndexes, excelIndexes } = loadActions();
        const keptWell = context.createNewWell('K1', 1000);
        const draft = context.createNewWell(null, 1200);
        context.addNewWell.__rememberPristineDraft(draft);
        context.wells.push(keptWell, draft);
        context.currentWellIndex = 1;
        context._excelRowSelectStates = { 0: true, 1: true };
        const previousWells = context.wells;

        context.addNewWell(1500);

        expect(context.wells.map((well) => well.dn)).toEqual([1000, 1500]);
        expect(context.wells[0].id).toBe(keptWell.id);
        expect(wellIndexes.get(keptWell.id)).toBe(0);
        expect(wellIndexes.get(context.wells[1].id)).toBe(1);
        expect(excelIndexes.get(keptWell.id)).toBe(0);
        expect(excelIndexes.get(context.wells[1].id)).toBe(1);
        expect(context.currentWellIndex).toBe(1);
        expect(context.wells).not.toBe(previousWells);
        expect(context._excelRowSelectStates).toEqual({});
        expect(calls).toEqual({
            rebuild: 1,
            excelRebuild: 1,
            excelReset: 1,
            excelSelectionClear: 1,
            draftSave: 1,
            stycznaPopup: 0
        });
        expect(toastMessages[0]).toContain('Pominięto pustą');
    });

    test.each([
        ['numer', (well: TestWell) => (well.numer = 'S2')],
        ['produkt', (well: TestWell) => well.config.push({ productId: 'ring', quantity: 1 })],
        ['przejście', (well: TestWell) => well.przejscia.push({ id: 'prz-1' })],
        ['rzędna', (well: TestWell) => (well.rzednaWlazu = 4.2)],
        ['uwagi', (well: TestWell) => (well.uwagi = 'zostaw')],
        ['parametr', (well: TestWell) => (well.klasaBetonu = 'C25/30')]
    ] as Array<[string, (well: TestWell) => unknown]>)(
        'preserves a draft with user data: %s',
        (_field, changeWell) => {
            const { context } = loadActions();
            const draft = addCurrentDraft(context);
            changeWell(draft);

            context.addNewWell(1500);

            expect(context.wells[0]).toBe(draft);
            expect(context.wells).toHaveLength(2);
        }
    );

    test('keeps the draft when it is locked, PZ-linked, or editing an order', () => {
        const protect = [
            (context: TestContext) => (context.isWellLocked = () => true),
            (context: TestContext) => {
                context.window.pzGuard = { hasPzForWell: () => true };
            },
            (context: TestContext) => (context.orderEditMode = { order: { wells: [] } })
        ];
        protect.forEach((applyProtection: (context: TestContext) => unknown) => {
            const { context } = loadActions();
            const draft = addCurrentDraft(context);
            applyProtection(context);

            context.addNewWell(1500);

            expect(context.wells[0]).toBe(draft);
            expect(context.wells).toHaveLength(2);
        });
    });

    test('waits for a confirmed Styczna choice before removing the draft', async () => {
        const { context, calls } = loadActions();
        const draft = addCurrentDraft(context);

        context.addNewWell('styczna');
        expect(context.wells).toEqual([draft]);
        expect(calls.stycznaPopup).toBe(1);

        vm.runInContext(fs.readFileSync(STYCZNA_SRC, 'utf8'), context, {
            filename: STYCZNA_SRC
        });
        const product = { id: 'styczna-1200', componentType: 'styczna', dn: 1200 };
        context.studnieProducts.push(product);
        context.getStudnieProductById = (id) => (id === product.id ? product : null);
        await context.handleStycznaProductChoice(product.id, 'add');

        expect(context.wells).toHaveLength(1);
        expect(context.wells[0].config).toEqual([{ productId: product.id, quantity: 1 }]);
        expect(context.currentWellIndex).toBe(0);
    });

    test('rejects a prepared Styczna without a selected catalog product', () => {
        const { context } = loadActions();
        const draft = addCurrentDraft(context);

        context.addNewWell('styczna', {
            id: 'invalid-styczna',
            name: 'Styczna',
            numer: '',
            dn: 'styczna',
            config: [],
            przejscia: [],
            rzednaWlazu: null,
            rzednaDna: null,
            doplata: 0,
            uwagi: ''
        });

        expect(context.wells).toEqual([draft]);
    });

    test('does not treat wells created by unrelated factory callers as builder drafts', () => {
        const { context } = loadActions();
        const excelCreatedWell = context.createNewWell(null, 1200);
        context.wells.push(excelCreatedWell);

        context.addNewWell(1500);

        expect(context.wells[0]).toBe(excelCreatedWell);
        expect(context.wells).toHaveLength(2);
    });
});
