/// <reference lib="dom" />

import fs from 'node:fs';
import vm from 'node:vm';

it('w hubie bez włączonej edycji odczytuje ACTIVE i nie nadpisuje otwartego podglądu', async () => {
    document.body.innerHTML = '<div id="studnie-pricelist-body"></div>';
    let completeLoad: (rows: Array<Record<string, unknown>>) => void = () => undefined;
    const loaded = new Promise<Array<Record<string, unknown>>>((resolve) => {
        completeLoad = resolve;
    });
    const loadStudnieProducts = jest.fn(() => loaded);
    const sandbox = vm.createContext({
        document,
        studnieProducts: [{ id: 'GRP-150', active: 0 }],
        pricelistVersions: {
            isPricelistEditing: () => true,
            isEditing: () => false,
            offerStamp: () => null
        },
        loadStudnieProducts,
        renderStudniePriceList: jest.fn(),
        renderTiles: jest.fn(),
        logger: { warn: jest.fn() }
    });
    sandbox.window = sandbox;
    vm.runInContext(fs.readFileSync('public/js/studnie/pricelistSaveReset.js', 'utf8'), sandbox);

    const refresh = sandbox.refreshStudnieData();
    expect(loadStudnieProducts).toHaveBeenCalledWith({ source: 'active' });
    const bar = document.createElement('div');
    bar.id = 'pv-version-bar';
    bar.dataset.axis = 'studnie';
    document.body.appendChild(bar);
    sandbox.studnieProducts = [{ id: 'GRP-150', active: 1 }];
    completeLoad([{ id: 'GRP-150', active: 0 }]);
    await refresh;

    expect(sandbox.studnieProducts[0].active).toBe(1);
});
