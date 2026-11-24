// @ts-nocheck
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const BASE = path.join(__dirname, '../../public/js/studnie');

function loadScript(context, fileName) {
    vm.runInContext(fs.readFileSync(path.join(BASE, fileName), 'utf8'), context);
}

function makeContext() {
    const count = { textContent: '' };
    const tabs = { innerHTML: '' };
    const context = {
        wells: [
            { id: 'empty', dn: 1200, name: 'Pusta', config: [], przejscia: [] },
            { id: 'full', dn: 1200, name: 'C1', config: [{ productId: 'ring', quantity: 1 }] },
            { id: 'legacy-locked', dn: 1200, name: 'PZ locked', config: [], przejscia: [] },
            { id: 'legacy-linked', dn: 1200, name: 'PZ linked', config: [], przejscia: [] }
        ],
        orderEditMode: { order: { wells: [{ id: 'legacy-linked' }] } },
        studnieProducts: [{ id: 'ring' }],
        _excelActiveTab: '1200',
        _excelVirtualMode: 'legacy',
        _excelVirtualSettingEnabled: () => false,
        DN_TABS: ['1000', '1200', '1500', '2000', '2500', 'styczne'],
        DN_COLORS: { '1000': {}, '1200': {}, '1500': {}, '2000': {}, '2500': {}, styczne: {} },
        getStudnieProductById: (id) => (id === 'ring' ? { id } : null),
        isWellLocked: (index) => index === 2,
        escapeHtmlAttr: (value) => value,
        document: {
            hidden: false,
            addEventListener() {},
            getElementById(id) {
                if (id === 'excel-search-input') return { value: '' };
                if (id === 'excel-well-count') return count;
                if (id === 'excel-tabs') return tabs;
                return null;
            }
        },
        localStorage: { getItem: () => null },
        setTimeout,
        clearTimeout
    };
    context.window = Object.assign(context, { addEventListener() {} });
    vm.createContext(context);
    loadScript(context, 'wellUIHelpers.js');
    loadScript(context, 'excelState.js');
    loadScript(context, 'excelTabs.js');
    vm.runInContext("_excelActiveTab = '1200'", context);
    return { context, count, tabs };
}

describe('Excel studni — projekcja pustych pozycji', () => {
    test('zachowuje puste pozycje i indeksy wells w tabeli Excel', () => {
        const { context, count, tabs } = makeContext();

        expect(Array.from(context._excelRebuildFilteredIndexes())).toEqual([0, 1, 2, 3]);
        context._excelUpdateWellCount();
        context._excelRenderTabs();

        expect(count.textContent).toBe('4 studni');
        expect(tabs.innerHTML).toMatch(/DN1200<span[^>]*>4<\/span>/);
        expect(context.wells).toHaveLength(4);
        expect(
            context._excelRebuildFilteredIndexes().map((index: number) => context.wells[index].id)
        ).toEqual(['empty', 'full', 'legacy-locked', 'legacy-linked']);
        expect(context.wells[3].id).toBe('legacy-linked');
    });
});
