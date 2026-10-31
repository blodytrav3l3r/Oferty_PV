// @ts-nocheck -- vm sandbox + jsdom, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * Edycja PRECO: puste/niepoprawne pole nie może cicho wyzerować ceny.
 * Regresja: `parseFloat(input.value) || 0` zapisywało 0 zł dla pustej komórki
 * (rury/studnie zapisują `null`), a zapis przechodził bez ostrzeżenia.
 */

const ROOT = path.join(__dirname, '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, 'public/js/studnie/pricelistPreco.js'), 'utf8');

const BASE_PRECO = {
    '1000': {
        kinety: [{ dn: 150, prosta: 920, dodWlot: 300 }],
        uniesienie: [{ order: 1, min: 0, max: 100, grupy: { '150-300': 180 } }],
        skrzynkaWlazowa: 400,
        cenaPelnaWysMB: 1500,
        cenaDnoOsadnika: 920
    }
};

function mount(fields: Array<{ dn: string; field: string; value: string }>): any {
    document.body.innerHTML = '';
    for (const f of fields) {
        const input = document.createElement('input');
        input.setAttribute('data-preco-field', f.field);
        input.setAttribute('data-preco-dn', f.dn);
        input.value = f.value;
        document.body.appendChild(input);
    }
    const sandbox: any = {
        window: {},
        document,
        console,
        structuredClone: (value: unknown) => JSON.parse(JSON.stringify(value)),
        precoPricing: JSON.parse(JSON.stringify(BASE_PRECO))
    };
    vm.createContext(sandbox);
    vm.runInContext(SRC, sandbox, { filename: 'pricelistPreco.js' });
    return sandbox;
}

describe('collectPrecoFromUI: pusty input nie zeruje ceny', () => {
    test('poprawna wartość trafia do danych, brak zgłoszeń', () => {
        const sb = mount([{ dn: '1000', field: 'kinety.0.prosta', value: '1050' }]);
        const data = vm.runInContext('collectPrecoFromUI()', sb);
        const issues = vm.runInContext('_precoInputIssues', sb);
        expect(data['1000'].kinety[0].prosta).toBe(1050);
        expect(issues).toEqual([]);
    });

    test('puste pole zachowuje poprzednią cenę i zgłasza pole', () => {
        const sb = mount([{ dn: '1000', field: 'kinety.0.prosta', value: '' }]);
        const data = vm.runInContext('collectPrecoFromUI()', sb);
        const issues = vm.runInContext('_precoInputIssues', sb);
        expect(data['1000'].kinety[0].prosta).toBe(920);
        expect(issues).toEqual(['DN1000 kinety.0.prosta']);
    });

    test('wartość ujemna i nieliczbowa też są zgłaszane', () => {
        const sb = mount([
            { dn: '1000', field: 'cenaPelnaWysMB', value: '-1' },
            { dn: '1000', field: 'skrzynkaWlazowa', value: 'abc' }
        ]);
        const data = vm.runInContext('collectPrecoFromUI()', sb);
        const issues = vm.runInContext('_precoInputIssues', sb);
        expect(data['1000'].cenaPelnaWysMB).toBe(1500);
        expect(data['1000'].skrzynkaWlazowa).toBe(400);
        expect(issues).toEqual(['DN1000 cenaPelnaWysMB', 'DN1000 skrzynkaWlazowa']);
    });

    test('0 jest poprawną ceną (nie zgłaszamy)', () => {
        const sb = mount([{ dn: '1000', field: 'skrzynkaWlazowa', value: '0' }]);
        const data = vm.runInContext('collectPrecoFromUI()', sb);
        const issues = vm.runInContext('_precoInputIssues', sb);
        expect(data['1000'].skrzynkaWlazowa).toBe(0);
        expect(issues).toEqual([]);
    });
});

describe('savePrecoFromUI: blokada zapisu przy zgłoszeniach', () => {
    test('zapis sprawdza _precoInputIssues przed wysłaniem danych', () => {
        const save = SRC.slice(SRC.indexOf('async function savePrecoFromUI'));
        const guard = save.indexOf('_precoInputIssues.length > 0');
        const send = save.indexOf('savePrecoPricing(data)');
        expect(guard).toBeGreaterThan(-1);
        expect(send).toBeGreaterThan(guard);
    });

    test('brak cichej koercji pustego pola na 0', () => {
        expect(SRC).not.toContain('parseFloat(input.value) || 0');
    });
});
