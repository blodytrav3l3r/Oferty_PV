import fs from 'fs';
import path from 'path';
import vm from 'vm';

describe('wspólne pole numeru zamówienia', () => {
    test('ujawnia numer w trybie zamówienia i ukrywa go przy czyszczeniu', () => {
        const input = { value: '' };
        const group = { hidden: true, style: { display: '' } };
        const elements: Record<string, typeof input | typeof group> = {
            'order-number': input,
            'order-number-group': group
        };
        const document = {
            addEventListener: () => undefined,
            getElementById: (id: string) => elements[id] || null
        };
        const window: Record<string, (value?: string) => void> = {};
        const source = fs.readFileSync(
            path.join(__dirname, '../../public/js/shared/offerCrudCommon.js'),
            'utf8'
        );

        vm.runInNewContext(source, { document, window });
        window.setOrderNumberField('ZS/1/2026');

        expect(input.value).toBe('ZS/1/2026');
        expect(group.hidden).toBe(false);

        window.clearOrderNumberField();
        expect(input.value).toBe('');
        expect(group.hidden).toBe(true);
    });
});
