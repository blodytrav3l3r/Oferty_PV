import { evaluatePricelistHealth } from '../src/services/pricelist/health';
import type { PricelistHealthVersion } from '../src/services/pricelist/health';

const NOW = new Date('2026-10-21T12:00:00.000Z');

function version(
    type: string,
    id: string,
    effectiveFrom: string,
    status = 'APPROVED'
): PricelistHealthVersion {
    return { id, type, version: `v-${id}`, status, effectiveFrom };
}

describe('evaluatePricelistHealth', () => {
    it('exactly one ACTIVE per type -> ok', () => {
        const report = evaluatePricelistHealth(
            [
                version('rury', 'r1', '2026-10-01T00:00:00.000Z'),
                version('studnie', 's1', '2026-10-01T00:00:00.000Z'),
                version('preco', 'p1', '2026-10-01T00:00:00.000Z'),
                version('rury', 'r2', '2026-11-01T00:00:00.000Z')
            ],
            { now: NOW }
        );

        expect(report.ok).toBe(true);
        expect(report.active.rury?.id).toBe('r1');
        expect(report.violations).toEqual([]);
    });

    it('no APPROVED in the past -> NO_ACTIVE_VERSION', () => {
        const report = evaluatePricelistHealth(
            [
                version('rury', 'r2', '2026-11-01T00:00:00.000Z'),
                version('studnie', 's1', '2026-10-01T00:00:00.000Z'),
                version('preco', 'p1', '2026-10-01T00:00:00.000Z')
            ],
            { now: NOW }
        );

        expect(report.ok).toBe(false);
        expect(report.active.rury).toBeNull();
        expect(report.violations).toEqual([
            expect.objectContaining({ type: 'rury', code: 'NO_ACTIVE_VERSION' })
        ]);
    });

    it('two versions at the same latest date -> MULTIPLE_ACTIVE_VERSIONS', () => {
        const report = evaluatePricelistHealth(
            [
                version('rury', 'r1', '2026-10-01T00:00:00.000Z'),
                version('rury', 'r2', '2026-10-01T00:00:00.000Z'),
                version('studnie', 's1', '2026-10-01T00:00:00.000Z'),
                version('preco', 'p1', '2026-10-01T00:00:00.000Z')
            ],
            { now: NOW }
        );

        expect(report.ok).toBe(false);
        expect(report.violations).toEqual([
            expect.objectContaining({ type: 'rury', code: 'MULTIPLE_ACTIVE_VERSIONS' })
        ]);
    });

    it('invalid date is reported and never active', () => {
        const report = evaluatePricelistHealth(
            [
                version('rury', 'bad', 'not-a-date'),
                version('studnie', 's1', '2026-10-01T00:00:00.000Z'),
                version('preco', 'p1', '2026-10-01T00:00:00.000Z')
            ],
            { now: NOW }
        );

        expect(report.active.rury).toBeNull();
        expect(report.violations).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ type: 'rury', code: 'INVALID_EFFECTIVE_FROM' }),
                expect.objectContaining({ type: 'rury', code: 'NO_ACTIVE_VERSION' })
            ])
        );
    });
});
