import { pickPrecoVersionFromTimeline } from '../src/services/pricelist/export';
import type { PrecoTimelineVersion } from '../src/services/pricelist/export';

function preco(
    id: string,
    seq: number,
    status: string,
    effectiveFrom?: string
): PrecoTimelineVersion {
    return { id, version: `v${seq}`, seq, status, effectiveFrom };
}

describe('D1: pickPrecoVersionFromTimeline', () => {
    it.each(['DRAFT'])('pomija status %s', (status) => {
        const picked = pickPrecoVersionFromTimeline(
            { effectiveFrom: '2026-02-01T00:00:00.000Z', seq: 5 },
            [preco('p1', 1, status, '2026-01-01T00:00:00.000Z')]
        );
        expect(picked).toBeNull();
    });

    it.each(['APPROVED'])('bierze status %s', (status) => {
        const picked = pickPrecoVersionFromTimeline(
            { effectiveFrom: '2026-02-01T00:00:00.000Z', seq: 5 },
            [preco('p1', 1, status, '2026-01-01T00:00:00.000Z')]
        );
        expect(picked?.id).toBe('p1');
    });

    it('bierze najnowsze effectiveFrom, potem najwyższe seq', () => {
        const picked = pickPrecoVersionFromTimeline(
            { effectiveFrom: '2026-03-01T00:00:00.000Z', seq: 9 },
            [
                preco('old', 1, 'APPROVED', '2026-01-01T00:00:00.000Z'),
                preco('new-low', 2, 'APPROVED', '2026-02-01T00:00:00.000Z'),
                preco('new-high', 3, 'APPROVED', '2026-02-01T00:00:00.000Z')
            ]
        );
        expect(picked?.id).toBe('new-high');
    });

    it('nie bierze PRECO z przyszłości', () => {
        const picked = pickPrecoVersionFromTimeline(
            { effectiveFrom: '2026-02-01T00:00:00.000Z', seq: 5 },
            [preco('future', 9, 'APPROVED', '2026-03-01T00:00:00.000Z')]
        );
        expect(picked).toBeNull();
    });

    it('legacy bez effectiveFrom → fallback seq <=', () => {
        const picked = pickPrecoVersionFromTimeline({ seq: 5 }, [
            preco('old', 3, 'ARCHIVED'),
            preco('same', 5, 'APPROVED'),
            preco('new', 9, 'APPROVED')
        ]);
        expect(picked?.id).toBe('same');
    });

    it('bez effectiveFrom studni nie bierze PRECO bez daty, gdy jest data', () => {
        const picked = pickPrecoVersionFromTimeline(
            { effectiveFrom: '2026-02-01T00:00:00.000Z', seq: 5 },
            [preco('no-date', 1, 'APPROVED')]
        );
        expect(picked).toBeNull();
    });
});
