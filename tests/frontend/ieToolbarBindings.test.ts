// @ts-nocheck -- VM harness verifies the classic-script DOM boundary.
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const BUTTONS = [
    ['ie-btn-export-xlsx', 'showExportXlsxDialog'],
    ['ie-btn-export-json', 'showExportJsonPopup'],
    ['ie-btn-import-json', 'showImportJsonDialog'],
    ['ie-btn-import-xlsx', 'showImportXlsxDialog']
];

function createButton() {
    return {
        onclick: null,
        listeners: [],
        addEventListener(type, handler) {
            if (type === 'click') this.listeners.push(handler);
        },
        click() {
            this.listeners.forEach((handler) => handler());
            if (typeof this.onclick === 'function') this.onclick();
        }
    };
}

function loadToolbar({ enabled = true, hostPresent = true } = {}) {
    const buttons = Object.fromEntries(BUTTONS.map(([id]) => [id, createButton()]));
    const host = { dataset: {}, innerHTML: '' };
    const sandbox = {
        console,
        window: { lucide: null },
        document: {
            getElementById: (id) => {
                if (id === 'toolbar-host') return hostPresent ? host : null;
                return buttons[id] || null;
            }
        },
        ImportExportFeatureFlag: { isEnabled: async () => enabled }
    };
    vm.createContext(sandbox);
    vm.runInContext(
        fs.readFileSync(path.join(process.cwd(), 'public/js/import-export/toolbar.js'), 'utf-8'),
        sandbox,
        { filename: 'toolbar.js' }
    );

    const toolbar = sandbox.window.importExportToolbar;
    const actions = Object.fromEntries(BUTTONS.map(([, method]) => [method, jest.fn()]));
    Object.assign(toolbar, actions);
    return { toolbar, buttons, host, actions };
}

describe('import-export toolbar click bindings', () => {
    test('każdy przycisk uruchamia dotychczasową akcję raz bez przypisania onclick', async () => {
        const { toolbar, buttons, actions } = loadToolbar();

        await toolbar.init('toolbar-host');
        for (const [id, method] of BUTTONS) {
            buttons[id].click();
            expect(actions[method]).toHaveBeenCalledTimes(1);
            expect(buttons[id].onclick).toBeNull();
        }
    });

    test('ponowne init nie dubluje listenerów', async () => {
        const { toolbar, buttons, actions } = loadToolbar();

        await toolbar.init('toolbar-host');
        await toolbar.init('toolbar-host');
        for (const [id, method] of BUTTONS) buttons[id].click();

        for (const [, method] of BUTTONS) expect(actions[method]).toHaveBeenCalledTimes(1);
    });

    test.each([
        ['flaga wyłączona', { enabled: false, hostPresent: true }],
        ['brak hosta', { enabled: true, hostPresent: false }]
    ])('%s nie tworzy przycisków ani listenerów', async (_label, options) => {
        const { toolbar, buttons, host } = loadToolbar(options);

        await toolbar.init('toolbar-host');

        expect(host.innerHTML).toBe('');
        for (const [id] of BUTTONS) {
            expect(buttons[id].listeners).toHaveLength(0);
            expect(buttons[id].onclick).toBeNull();
        }
    });
});
