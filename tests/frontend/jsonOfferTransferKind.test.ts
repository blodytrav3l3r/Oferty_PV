// @ts-nocheck
import fs from 'fs';
import path from 'path';
import vm from 'vm';

function loadTransfer() {
    const context: any = { window: {} };
    vm.createContext(context);
    const code = fs.readFileSync(
        path.join(__dirname, '../../public/js/import-export/shared/jsonOfferTransfer.js'),
        'utf8'
    );
    vm.runInContext(code, context, { filename: 'jsonOfferTransfer.js' });
    return context.window.JsonOfferTransfer;
}

describe('jsonOfferTransfer — kind transferu (sok-* + kompatybilność wsteczna)', () => {
    it('eksportuje aktualny kind oferty i zamówienia', () => {
        const transfer = loadTransfer();
        expect(transfer.buildPayload('rury', {}, []).kind).toBe('sok-offer-transfer');
        expect(transfer.buildOrderPayload('rury', {}).kind).toBe('sok-order-transfer');
    });

    it('akceptuje aktualny i historyczny kind oferty', () => {
        const transfer = loadTransfer();
        const kinds = ['sok-offer-transfer', 'witros-offer-transfer'];
        for (const kind of kinds) {
            expect(
                transfer.validatePayload({ kind, schemaVersion: 1, module: 'rury', offer: {} })
            ).toBe(true);
        }
    });

    it('akceptuje aktualny i historyczny kind zamówienia', () => {
        const transfer = loadTransfer();
        const kinds = ['sok-order-transfer', 'witros-order-transfer'];
        for (const kind of kinds) {
            expect(
                transfer.validateOrderPayload({ kind, schemaVersion: 1, module: 'rury', order: {} })
            ).toBe(true);
        }
    });

    it('odrzuca nieznany kind z komunikatem o nagłówku kind', () => {
        const transfer = loadTransfer();
        const payload = { kind: 'inny-transfer', schemaVersion: 1, module: 'rury' };
        expect(() => transfer.validatePayload({ ...payload, offer: {} })).toThrow(/kind/);
        expect(() => transfer.validateOrderPayload({ ...payload, order: {} })).toThrow(/kind/);
    });

    it('rozpoznaje typ transferu niezależnie od wariantu kind', () => {
        const transfer = loadTransfer();
        expect(transfer.isOfferKind('sok-offer-transfer')).toBe(true);
        expect(transfer.isOfferKind('witros-offer-transfer')).toBe(true);
        expect(transfer.isOfferKind('witros-order-transfer')).toBe(false);
        expect(transfer.isOrderKind('sok-order-transfer')).toBe(true);
        expect(transfer.isOrderKind('witros-order-transfer')).toBe(true);
        expect(transfer.isOrderKind('sok-offer-transfer')).toBe(false);
    });
});
