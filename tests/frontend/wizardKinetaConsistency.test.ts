/**
 * @jest-environment jsdom
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

describe('wizard kineta and spocznik tiles stay consistent', () => {
    function loadWizard() {
        document.body.innerHTML = `
            <div id="wizard-step-2">
                <div class="param-group" data-param="kineta">
                    <button class="param-tile active" data-val="brak">Brak</button>
                    <button class="param-tile" data-val="beton">Beton</button>
                    <button class="param-tile" data-val="preco">Preco</button>
                </div>
                <div class="param-group" data-param="spocznik">
                    <button class="param-tile active" data-val="brak">Brak</button>
                    <button class="param-tile" data-val="beton">Beton</button>
                    <button class="param-tile" data-val="preco">Preco</button>
                </div>
                <div class="param-group" data-param="spocznikH">
                    <button class="param-tile" data-val="1/2">1/2</button>
                    <button class="param-tile" data-val="1/1">1/1</button>
                    <button class="param-tile active" data-val="brak">Brak</button>
                </div>
                <div class="param-group" data-param="precoFullHeight">
                    <button class="param-tile" data-val="nie">Nie</button>
                </div>
            </div>`;
        const context: any = {
            document,
            window: {},
            WIZARD_REQUIRED_PARAMS: [],
            wizardConfirmedParams: new Set(),
            enforceLoadClassRulesWizard: () => {},
            updateParamTilesUI: () => {},
            validateWizardStep2: () => {}
        };
        vm.createContext(context);
        const code = fs.readFileSync(
            path.join(__dirname, '../../public/js/studnie/uiParamTiles.js'),
            'utf8'
        );
        vm.runInContext(code, context);
        context.enforceLoadClassRulesWizard = () => {};
        context.updateParamTilesUI = () => {};
        context.validateWizardStep2 = () => {};
        context.setupParamTiles();
        return context;
    }

    function clickTile(param: string, value: string) {
        const tile = document.querySelector(
            `.param-group[data-param="${param}"] .param-tile[data-val="${value}"]`
        ) as HTMLButtonElement;
        tile.click();
    }

    function activeValue(param: string) {
        return document
            .querySelector(`.param-group[data-param="${param}"] .param-tile.active`)
            ?.getAttribute('data-val');
    }

    test('selecting Brak height clears both kineta fields; selecting kineta restores 1/2', () => {
        loadWizard();

        clickTile('kineta', 'beton');
        expect(activeValue('kineta')).toBe('beton');
        expect(activeValue('spocznik')).toBe('beton');
        expect(activeValue('spocznikH')).toBe('1/2');

        clickTile('spocznikH', 'brak');
        expect(activeValue('kineta')).toBe('brak');
        expect(activeValue('spocznik')).toBe('brak');
        expect(activeValue('spocznikH')).toBe('brak');

        clickTile('kineta', 'beton');
        expect(activeValue('kineta')).toBe('beton');
        expect(activeValue('spocznik')).toBe('beton');
        expect(activeValue('spocznikH')).toBe('1/2');
    });

    test('selecting a height while Brak is active enables concrete kineta and spocznik', () => {
        loadWizard();

        clickTile('spocznikH', '1/2');

        expect(activeValue('kineta')).toBe('beton');
        expect(activeValue('spocznik')).toBe('beton');
        expect(activeValue('spocznikH')).toBe('1/2');
    });

    test('selecting Brak spocznik clears kineta; PRECO may also be turned off with Brak height', () => {
        loadWizard();
        clickTile('kineta', 'beton');
        clickTile('spocznik', 'brak');
        expect(activeValue('kineta')).toBe('brak');
        expect(activeValue('spocznikH')).toBe('brak');

        clickTile('kineta', 'preco');
        expect(activeValue('spocznikH')).toBe('1/1');
        clickTile('spocznikH', '1/2');
        expect(activeValue('spocznikH')).toBe('1/1');
        clickTile('spocznikH', 'brak');
        expect(activeValue('kineta')).toBe('brak');
        expect(activeValue('spocznik')).toBe('brak');
        expect(activeValue('spocznikH')).toBe('brak');
    });

    test('restoring legacy wizard params normalizes a saved Brak height', () => {
        const context = loadWizard();
        const code = fs.readFileSync(
            path.join(__dirname, '../../public/js/studnie/offerFormHelpers.js'),
            'utf8'
        );
        vm.runInContext(code, context);

        context.restoreWizardState(
            {
                globalParams: {
                    kineta: 'beton',
                    spocznik: 'beton',
                    spocznikH: 'brak'
                }
            },
            true
        );

        expect(activeValue('kineta')).toBe('brak');
        expect(activeValue('spocznik')).toBe('brak');
        expect(activeValue('spocznikH')).toBe('brak');

        context.restoreWizardState(
            {
                globalParams: {
                    kineta: 'preco',
                    spocznik: 'preco',
                    spocznikH: '1/2'
                }
            },
            true
        );

        expect(activeValue('kineta')).toBe('preco');
        expect(activeValue('spocznik')).toBe('preco');
        expect(activeValue('spocznikH')).toBe('1/1');
    });
});
