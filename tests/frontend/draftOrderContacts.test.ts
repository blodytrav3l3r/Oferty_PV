// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

/** RED-kontrakt: pusta tablica clientContacts live == brak klucza w SAVED (order_studnie). */
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

describe('draft order_studnie clientContacts — kontrakt normalizacji', () => {
    it('T1: pusta tablica live == brak klucza saved', () => {
        const s = loadCtx();
        const da = s.window.draftAutosave;
        const live = {
            fields: {
                clientContacts: [],
                contactPerson: '',
                clientPhone: '',
                clientEmail: '',
                clientContact: 'Jan, 600'
            }
        };
        const saved = { fields: { clientContact: 'Jan, 600' } };
        expect(da.areEquivalent('order_studnie', live, saved, false)).toBe(true);
    });

    it('T2: 1 realny kontakt live vs brak tablicy saved → brud', () => {
        const s = loadCtx();
        const da = s.window.draftAutosave;
        const live = {
            fields: {
                clientContacts: [{ name: 'Jan', phone: '600', email: '' }],
                contactPerson: '',
                clientPhone: '',
                clientEmail: '',
                clientContact: 'Jan, 600'
            }
        };
        const saved = { fields: { clientContact: 'Jan, 600' } };
        expect(da.areEquivalent('order_studnie', live, saved, false)).toBe(false);
    });

    it('T3: wiersz whitespace-only wypada → czysto', () => {
        const s = loadCtx();
        const da = s.window.draftAutosave;
        const live = {
            fields: {
                clientContacts: [{ name: ' ', phone: '', email: '' }],
                contactPerson: '',
                clientPhone: '',
                clientEmail: '',
                clientContact: 'Jan, 600'
            }
        };
        const saved = { fields: { clientContact: 'Jan, 600' } };
        expect(da.areEquivalent('order_studnie', live, saved, false)).toBe(true);
    });

    it('T4: describeDiff dla T1 → []', () => {
        const s = loadCtx();
        const da = s.window.draftAutosave;
        const live = {
            fields: {
                clientContacts: [],
                contactPerson: '',
                clientPhone: '',
                clientEmail: '',
                clientContact: 'Jan, 600'
            }
        };
        const saved = { fields: { clientContact: 'Jan, 600' } };
        expect(da.describeDiff('order_studnie', live, saved, false)).toEqual([]);
    });

    it('T5: sam mirror rozjechany (pusto vs tekst) → brud', () => {
        const s = loadCtx();
        const da = s.window.draftAutosave;
        const live = {
            fields: {
                clientContacts: [],
                contactPerson: '',
                clientPhone: '',
                clientEmail: '',
                clientContact: ''
            }
        };
        const saved = { fields: { clientContact: 'Jan, 600' } };
        expect(da.areEquivalent('order_studnie', live, saved, false)).toBe(false);
        expect(da.describeDiff('order_studnie', live, saved, false)).toEqual([
            'Pola: clientContact'
        ]);
    });
});
