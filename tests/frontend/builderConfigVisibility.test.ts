/// <reference lib="dom" />
/**
 * @jest-environment jsdom
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

describe('konfiguracja betonowa pozostaje widoczna w obu zakładkach wyboru', () => {
    test('panel konfiguracji jest poza zawartością przełączanych zakładek', () => {
        const template = fs.readFileSync(
            path.join(__dirname, '../../public/partials/studnie/step3-offer.html'),
            'utf8'
        );
        document.body.innerHTML = template;
        const context: any = { document, window: {} };
        vm.createContext(context);
        const tabSwitcher = fs.readFileSync(
            path.join(__dirname, '../../public/js/studnie/uiTabSwitcher.js'),
            'utf8'
        );
        vm.runInContext(tabSwitcher, context);

        const configPanel = document.getElementById('well-config-wrap');
        expect(configPanel).not.toBeNull();
        expect(configPanel?.closest('#bcontent-concrete, #bcontent-transitions')).toBeNull();

        context.switchBuilderTab('transitions');
        expect(configPanel?.closest('#bcontent-transitions')).toBeNull();
        context.switchBuilderTab('concrete');
        expect(configPanel?.closest('#bcontent-concrete')).toBeNull();
    });
});
