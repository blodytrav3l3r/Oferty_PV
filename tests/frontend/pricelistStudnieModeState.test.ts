/// <reference lib="dom" />

import fs from 'node:fs';
import vm from 'node:vm';

it('pokazuje niezapisane zmiany i odróżnia podgląd zapisanej wersji', () => {
    document.body.innerHTML =
        '<button id="btn-save-studnie-pricelist"></button>' +
        '<span id="studnie-pricelist-dirty-state" hidden>Niezapisane zmiany</span>' +
        '<span id="studnie-pricelist-readonly-state" hidden>Tylko odczyt</span>';
    let editing = true;
    const sandbox = vm.createContext({
        document,
        pricelistVersions: {
            saveButtonMeta: () => ({ editing, label: 'Zapisz', title: 'Zapisz' })
        }
    });
    sandbox.window = sandbox;
    vm.runInContext(fs.readFileSync('public/js/studnie/pricelistState.js', 'utf8'), sandbox);
    vm.runInContext('_studniePricelistDirty = true; updateStudnieSaveBtn();', sandbox);

    expect(document.getElementById('studnie-pricelist-dirty-state')?.hidden).toBe(false);
    expect(document.getElementById('studnie-pricelist-readonly-state')?.hidden).toBe(true);

    editing = false;
    sandbox.updateStudnieSaveBtn();
    expect(document.getElementById('studnie-pricelist-dirty-state')?.hidden).toBe(false);
    expect(document.getElementById('studnie-pricelist-readonly-state')?.hidden).toBe(false);

    vm.runInContext('_studniePricelistDirty = false; updateStudnieSaveBtn();', sandbox);
    expect(document.getElementById('studnie-pricelist-dirty-state')?.hidden).toBe(true);
});
