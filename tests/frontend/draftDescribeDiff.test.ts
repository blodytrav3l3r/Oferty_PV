// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

/** Kontrakt SSoT: equivalent==true → describe==[] ; diff bez HTML (escapuje renderer). */
function readJs(rel: string): string {
    return fs.readFileSync(path.join(__dirname, '../../public/js', rel), 'utf8');
}

function loadCtx() {
    const sandbox: any = { console, window: {} as any };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(readJs('shared/draftStore.js'), sandbox, { filename: 'draftStore.js' });
    vm.runInContext(readJs('shared/draftAutosave.js'), sandbox, { filename: 'draftAutosave.js' });
    return sandbox;
}

const EMPTY_RURY = {
    fields: {
        number: '',
        date: '',
        clientName: '',
        clientNumber: '',
        clientNip: '',
        clientAddress: '',
        clientContact: '',
        investName: '',
        investAddress: '',
        investContractor: '',
        notes: '',
        paymentTerms: 'Do uzgodnienia lub według indywidualnych warunków handlowych.',
        validity: '7 dni',
        transportKm: 100,
        transportRate: 10
    },
    wellDiscounts: {},
    visiblePrzejsciaTypes: [],
    transportMode: 'full',
    items: []
};

describe('draft describeDiff — kontrakt SSoT', () => {
    it('równoważne → [] (twardy kontrakt)', () => {
        const s = loadCtx();
        const da = s.window.draftAutosave;
        expect(da.areEquivalent('offer_rury', EMPTY_RURY, EMPTY_RURY, true)).toBe(true);
        expect(da.describeDiff('offer_rury', EMPTY_RURY, EMPTY_RURY, true)).toEqual([]);
    });

    it('efemeryczne stripowane przez comparable nie lądują w diffie', () => {
        const s = loadCtx();
        const da = s.window.draftAutosave;
        const live = {
            wells: [{ id: 'a', name: 'W1', configStatus: 'ERROR', configErrors: ['x'] }]
        };
        const saved = { wells: [{ id: 'a', name: 'W1' }] };
        expect(da.areEquivalent('offer_studnie', live, saved, false)).toBe(true);
        expect(da.describeDiff('offer_studnie', live, saved, false)).toEqual([]);
    });

    it('pola: lista kluczy bez wartości + brak HTML', () => {
        const s = loadCtx();
        const da = s.window.draftAutosave;
        const ch = JSON.parse(JSON.stringify(EMPTY_RURY));
        ch.fields.clientName = '<img src=x onerror=alert(1)>';
        ch.fields.notes = 'n2';
        const lines = da.describeDiff('offer_rury', ch, EMPTY_RURY, true);
        expect(lines).toEqual(['Pola: clientName, notes']);
        expect(lines.join(' ')).not.toContain('<img');
    });

    it('studnie: N → M + dodana/zmodyfikowana', () => {
        const s = loadCtx();
        const da = s.window.draftAutosave;
        const b = { wells: [{ id: 'a', name: 'W1', config: [] }] };
        const a = {
            wells: [
                { id: 'a', name: 'W1', config: [{ productId: 'p', quantity: 2 }] },
                { id: 'b', name: 'W2' }
            ]
        };
        expect(da.describeDiff('offer_studnie', a, b, false)).toEqual([
            'Studnie: 1 → 2',
            '~ „W1"',
            '+ „W2"'
        ]);
    });

    it('B1: quantity 5 === "5", transportKm "100" === 100', () => {
        const s = loadCtx();
        const da = s.window.draftAutosave;
        expect(
            da.areEquivalent(
                'offer_rury',
                { items: [{ productId: 'P', quantity: 5 }] },
                { items: [{ productId: 'P', quantity: '5' }] },
                true
            )
        ).toBe(true);
        expect(
            da.areEquivalent(
                'offer_rury',
                { fields: { transportKm: '100' }, items: [] },
                { fields: { transportKm: 100 }, items: [] },
                true
            )
        ).toBe(true);
    });

    it('B1: identyfikator "00123" !== 123 (brak normalizacji ID)', () => {
        const s = loadCtx();
        const da = s.window.draftAutosave;
        expect(
            da.areEquivalent(
                'offer_rury',
                { items: [{ productId: '00123', quantity: 1 }] },
                { items: [{ productId: 123, quantity: 1 }] },
                true
            )
        ).toBe(false);
    });

    it('B2: items reorder równe, wells reorder różne', () => {
        const s = loadCtx();
        const da = s.window.draftAutosave;
        expect(
            da.areEquivalent(
                'offer_rury',
                {
                    items: [
                        { productId: 'A', quantity: 1 },
                        { productId: 'B', quantity: 2 }
                    ]
                },
                {
                    items: [
                        { productId: 'B', quantity: 2 },
                        { productId: 'A', quantity: 1 }
                    ]
                },
                true
            )
        ).toBe(true);
        expect(
            da.areEquivalent(
                'offer_studnie',
                {
                    wells: [
                        { id: 'a', name: 'W1' },
                        { id: 'b', name: 'W2' }
                    ]
                },
                {
                    wells: [
                        { id: 'b', name: 'W2' },
                        { id: 'a', name: 'W1' }
                    ]
                },
                false
            )
        ).toBe(false);
    });

    it('B3: brak wellDiscounts/visible === {} / []', () => {
        const s = loadCtx();
        const da = s.window.draftAutosave;
        expect(
            da.areEquivalent(
                'offer_rury',
                { items: [] },
                { items: [], wellDiscounts: {}, visiblePrzejsciaTypes: [] },
                true
            )
        ).toBe(true);
        expect(da.describeDiff('offer_rury', { items: [] }, { items: [] }, true)).toEqual([]);
    });
});
