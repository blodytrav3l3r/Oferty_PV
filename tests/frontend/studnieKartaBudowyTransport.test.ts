// @ts-nocheck -- vm sandbox for browser script
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const ROOT = path.join(__dirname, '..', '..');

describe('studnie karta budowy: transport i pola karty', () => {
    test('input step4-wyliczony-transport istnieje w partialu karty budowy', () => {
        const partial = fs.readFileSync(
            path.join(ROOT, 'public/partials/shared/karta-build-card.html'),
            'utf8'
        );
        expect(partial).toContain('id="step4-wyliczony-transport"');
    });

    test('odczyt, kopiowanie i zbieranie wyliczonego transportu w orderKartaBudowy.js', () => {
        const domElements = {};
        const getOrCreateElement = (id) => {
            if (!domElements[id]) {
                domElements[id] = {
                    id,
                    value: '',
                    style: {},
                    dataset: {},
                    classList: {
                        add: jest.fn(),
                        remove: jest.fn(),
                        contains: () => false
                    }
                };
            }
            return domElements[id];
        };

        const context = {
            window: {},
            document: {
                getElementById: (id) => getOrCreateElement(id),
                querySelectorAll: () => [],
                querySelector: () => null,
                createElement: () => ({ appendChild: jest.fn(), setAttribute: jest.fn() })
            },
            MAX_TRANSPORT_WEIGHT: 24000,
            ClientContacts: {
                kartaBudowy: {
                    restore: jest.fn(),
                    collect: () => ({
                        kontaktZamawiajacy: [],
                        kontaktyBudowa: [],
                        osobaKontakt: ''
                    }),
                    prefill: jest.fn()
                }
            },
            orderEditMode: null,
            pendingOrderCreationData: null,
            collectPrzejsciaDetailsFromTable: () => [],
            calcWellStats: () => ({ price: 1000, weight: 2000 })
        };
        context.window = context;

        const code = fs.readFileSync(
            path.join(ROOT, 'public/js/studnie/orderKartaBudowy.js'),
            'utf8'
        );
        vm.createContext(context);
        vm.runInContext(code, context);

        // 1. _applyExistingKartaBudowyData przywraca wyliczonyTransport
        const existingData = {
            wyliczonyTransport: '0,24 x 1 000,00 zł = 243,04 zł',
            emailFaktura: 'faktura@example.com',
            kaskada: 'Nie dotyczy'
        };
        context._applyExistingKartaBudowyData(existingData, 'OS/123');
        expect(domElements['step4-wyliczony-transport'].value).toBe(
            '0,24 x 1 000,00 zł = 243,04 zł'
        );
        expect(domElements['step4-email-faktura'].value).toBe('faktura@example.com');

        // 2. applyCopiedKartaBudowyData kopiuje wyliczonyTransport
        domElements['step4-wyliczony-transport'].value = '';
        context.applyCopiedKartaBudowyData({
            wyliczonyTransport: '1 x 1 200,00 zł = 1 200,00 zł'
        });
        expect(domElements['step4-wyliczony-transport'].value).toBe(
            '1 x 1 200,00 zł = 1 200,00 zł'
        );

        // 3. collectKartaBudowyDataStep4 zbiera wyliczonyTransport
        domElements['step4-wyliczony-transport'].value = '0,50 x 800,00 zł = 400,00 zł';
        const collected = context.collectKartaBudowyDataStep4();
        expect(collected.wyliczonyTransport).toBe('0,50 x 800,00 zł = 400,00 zł');

        // 4. _calcTransportCosts dla orderEditMode z frozenTransportCost i wellsExport
        context.orderEditMode = {
            order: {
                totalWeight: 5589,
                transportKm: 100,
                transportRate: 10,
                wells: [{ id: 'w1', weight: 5589 }],
                wellsExport: [{ transportCost: 243.04 }]
            }
        };
        const calcRes = context._calcTransportCosts();
        expect(calcRes.tCost).toBeCloseTo(243.04, 2);
        expect(calcRes.costPerTrip).toBe(1000);

        // 5. _calcTransportCosts z bezpośrednim frozenTransportCost na studni
        context.orderEditMode.order.wells = [
            { id: 'w1', weight: 5589, frozenTransportCost: 350.5 }
        ];
        context.orderEditMode.order.wellsExport = [];
        const calcRes2 = context._calcTransportCosts();
        expect(calcRes2.tCost).toBeCloseTo(350.5, 2);
    });
});
