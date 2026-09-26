// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

describe('studnie przejscia: przycisk TAK/NIE (toggle)', () => {
    function runCtx() {
        const czyBtn: any = {
            id: 'step4-psz-custom-0-czy',
            value: 'TAK',
            textContent: 'TAK',
            style: {}
        };
        const inputs: any = {
            'step4-psz-custom-0-rodzaj': { value: 'PVC SN8' },
            'step4-psz-custom-0-dnod': { value: '' },
            'step4-psz-custom-0-dndo': { value: '' },
            'step4-psz-custom-0-ilosc': { value: '1' },
            'step4-psz-custom-0-uwagi': { value: '' },
            'step4-psz-custom-0-czy': czyBtn
        };
        const fakeTr = { dataset: { pszSource: 'custom', pszIdx: '0' } };
        const context: any = {
            window: {},
            document: {
                getElementById: (id: string) => inputs[id] || null,
                querySelectorAll: (sel: string) => (sel === 'tr[data-psz-source]' ? [fakeTr] : [])
            },
            studnieProducts: [],
            wells: [],
            appConfirm: async () => true
        };
        const code = fs.readFileSync(
            path.join(__dirname, '../../public/js/studnie/orderPrzejscia.js'),
            'utf8'
        );
        vm.createContext(context);
        vm.runInContext(code, context);
        // seed: sync czyta wiersz z fake DOM do pamieci
        context.document.querySelectorAll = () => [fakeTr];
        return { ctx: context, czyBtn };
    }

    test('toggle odwraca TAK->NIE z kolorem i przechodzi przez sync+collect', () => {
        const { ctx, czyBtn } = runCtx();
        ctx._toggleCzyPrzejscieStudnie(czyBtn);
        expect(czyBtn.value).toBe('NIE');
        expect(czyBtn.textContent).toBe('NIE');
        expect(czyBtn.style.color).toBe('var(--danger-hover)');
        const collected = ctx.collectPrzejsciaDetailsFromTable();
        const custom = collected.filter((r: any) => r.source === 'custom');
        expect(custom[0].czyPrzejscie).toBe('NIE');
        expect(custom[0].rodzaj).toBe('PVC SN8');
    });

    test('toggle odwraca NIE->TAK', () => {
        const { ctx, czyBtn } = runCtx();
        czyBtn.value = 'NIE';
        czyBtn.textContent = 'NIE';
        ctx._toggleCzyPrzejscieStudnie(czyBtn);
        expect(czyBtn.value).toBe('TAK');
        expect(czyBtn.style.color).toBe('var(--success-hover)');
    });

    test('nieznany id tylko odwraca przycisk (bez wywalenia)', () => {
        const { ctx } = runCtx();
        const btn: any = { id: 'cos-innego', value: 'TAK', textContent: 'TAK', style: {} };
        expect(() => ctx._toggleCzyPrzejscieStudnie(btn)).not.toThrow();
        expect(btn.value).toBe('NIE');
    });
});
