/**
 * A3 security: limity wejścia ofert studni (DoS przez wielkie tablice).
 * Kontrakt: cap = 5000 studni / 5000 komponentów / 500 przejść / 1000 ofert w batchu.
 * Ewidencja sufitu w src/validators/offerSchemas.ts (komentarz) + src/mountRoutes.ts.
 */
import {
    offerStudnieCreateSchema,
    offerStudnieUpdateSchema,
    offersStudnieBatchSchema
} from '../src/validators/offerSchemas';

const emptyWell = () => ({});
const wells = (n: number) => Array.from({ length: n }, emptyWell);

describe('limity wejścia ofert studni (A3 / DoS)', () => {
    it('wells na granicy 5000 przechodzi', () => {
        expect(
            offerStudnieCreateSchema.safeParse({ clientId: 'c1', wells: wells(5000) }).success
        ).toBe(true);
    });

    it('wells 5001 odrzucone', () => {
        expect(
            offerStudnieCreateSchema.safeParse({ clientId: 'c1', wells: wells(5001) }).success
        ).toBe(false);
    });

    it('components na granicy 5000 przechodzi, 5001 odrzucone', () => {
        const at = (n: number) =>
            offerStudnieCreateSchema.safeParse({
                clientId: 'c1',
                wells: [{ components: Array.from({ length: n }, () => ({})) }]
            }).success;
        expect(at(5000)).toBe(true);
        expect(at(5001)).toBe(false);
    });

    it('passages na granicy 500 przechodzi, 501 odrzucone', () => {
        const at = (n: number) =>
            offerStudnieCreateSchema.safeParse({
                clientId: 'c1',
                wells: [{ passages: Array.from({ length: n }, () => ({})) }]
            }).success;
        expect(at(500)).toBe(true);
        expect(at(501)).toBe(false);
    });

    it('update schema też egzekwuje limit wells', () => {
        expect(offerStudnieUpdateSchema.safeParse({ wells: wells(5001) }).success).toBe(false);
        expect(offerStudnieUpdateSchema.safeParse({ wells: wells(5000) }).success).toBe(true);
    });

    it('batch: data na granicy 1000 przechodzi, 1001 odrzucone', () => {
        const at = (n: number) =>
            offersStudnieBatchSchema.safeParse({ data: Array.from({ length: n }, () => ({})) })
                .success;
        expect(at(1000)).toBe(true);
        expect(at(1001)).toBe(false);
    });
});
