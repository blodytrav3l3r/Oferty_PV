import { mapPrismaError } from '../src/utils/prismaErrors';

function mockRes() {
    const calls: Array<{ code: number; body: unknown }> = [];
    return {
        calls,
        res: {
            status(code: number) {
                return {
                    json(body: unknown) {
                        calls.push({ code, body });
                        return null;
                    }
                };
            }
        }
    };
}

describe('P2 mapPrismaError', () => {
    test('P2025 → 404 NOT_FOUND', () => {
        const { calls, res } = mockRes();
        const err = Object.assign(new Error('No record'), { code: 'P2025' });
        expect(mapPrismaError(res, err)).toBe(true);
        expect(calls).toEqual([
            { code: 404, body: { error: 'Rekord nie istnieje', code: 'NOT_FOUND' } }
        ]);
    });

    test('P2002 → 409 UNIQUE_CONFLICT', () => {
        const { calls, res } = mockRes();
        const err = Object.assign(new Error('Unique'), { code: 'P2002' });
        expect(mapPrismaError(res, err)).toBe(true);
        expect(calls[0].code).toBe(409);
        expect((calls[0].body as { code: string }).code).toBe('UNIQUE_CONFLICT');
    });

    test('extra doklejane (kontrakt saved: [] w produkcji)', () => {
        const { calls, res } = mockRes();
        const err = Object.assign(new Error('No record'), { code: 'P2025' });
        expect(mapPrismaError(res, err, { saved: [] })).toBe(true);
        expect(calls[0].body).toEqual({
            error: 'Rekord nie istnieje',
            code: 'NOT_FOUND',
            saved: []
        });
    });

    test('obcy błąd → false, brak odpowiedzi', () => {
        const { calls, res } = mockRes();
        expect(mapPrismaError(res, new Error('boom'))).toBe(false);
        expect(calls).toEqual([]);
    });
});
