import {
    offerItemSchema,
    offerCreateSchema,
    wellComponentSchema,
    passageConfigSchema,
    wellDataSchema
} from '../../src/validators/offerSchemas';
import {
    productionOrderItemSchema,
    productionOrderCreateSchema,
    studnieOrderUpdateSchema
} from '../../src/validators/orderSchemas';
import { productPatchSchema } from '../../src/validators/productSchemas';

/**
 * P0.3: klasyfikacja A/B/C — wszystkie .passthrough() to klasa A (celowe).
 * Dowody: itemki rur niosą uid + 10 pól domenowych (offerAddItems.js:136-152),
 * przejścia id/productId/rzednaWlaczenia/flowType/displayIndex (excelHelpers.js:50-64),
 * trasy czytają req.body + ownership fail-closed (resolveAssignUserId).
 * Ten test blokuje regresję w obie strony:
 * - legalne payload z polami dodatkowymi PRZECHODZĄ,
 * - uszkodzony rdzeń (brak productId, ujemna ilość, zły enum) ODRZUCA.
 */
describe('P0.3 validation gate (klasa A)', () => {
    it('item rur z uid i polami domenowymi przechodzi', () => {
        const r = offerItemSchema.safeParse({
            uid: 'rur_123_abc',
            productId: 'p1',
            name: 'Rura',
            quantity: 2,
            lengthM: 6,
            discount: 0
        });
        expect(r.success).toBe(true);
    });

    it('item bez productId / z ujemną ilością odpada', () => {
        expect(offerItemSchema.safeParse({ quantity: 1 }).success).toBe(false);
        expect(offerItemSchema.safeParse({ productId: 'p1', quantity: -2 }).success).toBe(false);
    });

    it('oferta z polami serwerowymi (offer_number/version) przechodzi', () => {
        const r = offerCreateSchema.safeParse({
            clientId: 'c1',
            items: [{ productId: 'p1', quantity: 1 }],
            offer_number: 'R1/2026',
            version: 3,
            userId: 'u1'
        });
        expect(r.success).toBe(true);
    });

    it('oferta bez clientId / ze złym state odpada', () => {
        expect(
            offerCreateSchema.safeParse({ items: [{ productId: 'p1', quantity: 1 }] }).success
        ).toBe(false);
        expect(
            offerCreateSchema.safeParse({ clientId: 'c1', state: 'archived', items: [] }).success
        ).toBe(false);
    });

    it('komponent/przejście/studnia z polami solvera przechodzą', () => {
        expect(
            wellComponentSchema.safeParse({ productId: 'k1', quantity: 2, _elemId: 'e1' }).success
        ).toBe(true);
        expect(
            passageConfigSchema.safeParse({
                id: 'prz-1',
                productId: '',
                rzednaWlaczenia: null,
                angle: 0,
                flowType: 'WYLOT',
                displayIndex: 0
            }).success
        ).toBe(true);
        expect(
            wellDataSchema.safeParse({ id: 'w1', dn: 1000, name: 'S1', magazyn: 'WL' }).success
        ).toBe(true);
    });

    it('PZ z id/version przechodzi; brak wellId odpada', () => {
        expect(
            productionOrderCreateSchema.safeParse({ wellId: 'w1', elementIndex: 2 }).success
        ).toBe(true);
        expect(
            productionOrderCreateSchema.safeParse({ id: 'pz1', wellId: 'w1', version: 1 }).success
        ).toBe(true);
        expect(productionOrderCreateSchema.safeParse({ orderId: 'o1' }).success).toBe(false);
        expect(productionOrderItemSchema.safeParse({ wellId: 'w1' }).success).toBe(true);
    });

    it('update powyżej + patch produktu: rdzeń broniony', () => {
        expect(studnieOrderUpdateSchema.safeParse({ status: 'x', extra: 1 }).success).toBe(true);
        expect(productPatchSchema.safeParse({ price: 10, foo: 'bar' }).success).toBe(true);
        expect(productPatchSchema.safeParse({ price: 'tanio' }).success).toBe(false);
    });
});
