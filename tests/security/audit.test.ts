import { logAudit } from '../../src/services/auditService';
import { getMetricsSnapshot, resetMetrics } from '../../src/utils/metrics';
import { logger } from '../../src/utils/logger';

jest.mock('../../src/prismaClient', () => ({
    __esModule: true,
    default: {
        $executeRaw: jest.fn(),
        $queryRaw: jest.fn()
    }
}));

jest.mock('../../src/utils/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const prismaMock = require('../../src/prismaClient').default;

beforeEach(() => {
    jest.clearAllMocks();
    resetMetrics();
});

/**
 * P0.4: audit failure nie blokuje operacji (void), ale jest widoczny
 * (strukturalny log + licznik /metrics). Debounce scala zamiast nadpisywać.
 */
describe('P0.4 audit error visibility', () => {
    it('błąd zapisu nie rzuca, loguje kontekst i inkrementuje metrykę', async () => {
        prismaMock.$executeRaw.mockRejectedValueOnce(new Error('SQLITE_BUSY'));
        await expect(
            logAudit('offer', 'o1', 'u1', 'create', { a: 1 }, null)
        ).resolves.toBeUndefined();
        expect(logger.error).toHaveBeenCalledWith(
            'AuditLog',
            'Błąd zapisu logu',
            expect.objectContaining({ entityType: 'offer', entityId: 'o1', action: 'create' })
        );
        expect(getMetricsSnapshot().audit.failures).toBe(1);
    });

    it('sukces nie inkrementuje metryki', async () => {
        prismaMock.$executeRaw.mockResolvedValueOnce(1);
        await logAudit('offer', 'o1', 'u1', 'create', { a: 1 }, null);
        expect(getMetricsSnapshot().audit.failures).toBe(0);
        expect(logger.error).not.toHaveBeenCalled();
    });

    it('debounce scala klucze zamiast nadpisywać (key1 nie znika)', async () => {
        prismaMock.$queryRaw.mockResolvedValueOnce([
            { id: 'r1', newData: JSON.stringify({ key1: 'B', _diffMode: true }) }
        ]);
        prismaMock.$executeRaw.mockResolvedValueOnce(1);
        // drugi update w oknie zmienia key2 (old ma key1=B jak po pierwszym zapisie)
        await logAudit(
            'offer',
            'o1',
            'u1',
            'update',
            { key1: 'B', key2: 'C' },
            { key1: 'B', key2: 'old' }
        );
        expect(prismaMock.$executeRaw).toHaveBeenCalledTimes(1);
        const values: unknown[] = prismaMock.$executeRaw.mock.calls[0];
        const merged = String(values.find((v) => typeof v === 'string' && v.includes('key2')));
        expect(merged).toContain('key1');
        expect(merged).toContain('key2');
    });
});
