// @ts-nocheck -- vm sandbox for browser script
import fs from 'fs';
import path from 'path';
import vm from 'vm';

describe('studnie Karta Budowy navigation', () => {
    function loadNavigation(orderEditMode = null) {
        const calls = { enterKarta: jest.fn() };
        const elements = {
            'section-builder': { classList: { contains: () => true } },
            'wizard-step-4': { classList: { add: jest.fn() } }
        };
        const context = {
            window: {},
            document: {
                addEventListener: jest.fn(),
                querySelectorAll: () => [],
                querySelector: () => null,
                getElementById: (id) => elements[id] || null
            },
            currentWizardStep: 3,
            orderEditMode,
            updateWizardIndicator: jest.fn(),
            updateStudnieBottomNav: jest.fn(),
            _enterKartaBudowyStep4: calls.enterKarta
        };

        vm.createContext(context);
        vm.runInContext(
            fs.readFileSync(path.join(__dirname, '../../public/js/studnie/uiHelpers.js'), 'utf8'),
            context
        );
        return { context, calls, elements };
    }

    test('wejście do kroku 4 z konfiguratora używa wspólnego wejścia Karty Budowy', () => {
        const { context, calls, elements } = loadNavigation();

        context.goToWizardStep(4);

        expect(calls.enterKarta).toHaveBeenCalledTimes(1);
        expect(elements['wizard-step-4'].classList.add).toHaveBeenCalledWith('active');
        expect(context.currentWizardStep).toBe(4);
    });

    test('wejście do kroku 4 w trybie edycji zamówienia używa tego samego wejścia', () => {
        const { context, calls } = loadNavigation({ order: { id: 'order-1' } });

        context.goToWizardStep(4);

        expect(calls.enterKarta).toHaveBeenCalledTimes(1);
    });
});
