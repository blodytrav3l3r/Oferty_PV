/**
 * S1b: GET /:id/checks — kontrakt read-only (użycie, kolizja, bieżąca wersja).
 * Serwis testowany bez HTTP; zależności DB/eksportu zmockowane.
 */

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: { pricelistVersion: { findMany: jest.fn() } }
}));

jest.mock('../src/services/pricelist/export', () => ({
    getVersionExport: jest.fn()
}));

jest.mock('../src/services/pricelist/usage', () => ({
    countVersionUsage: jest.fn(),
    getPrecoReferences: jest.fn(),
    resolveActive: jest.fn()
}));

import prisma from '../src/prismaClient';
import { getVersionExport } from '../src/services/pricelist/export';
import {
    countVersionUsage,
    getPrecoReferences,
    resolveActive
} from '../src/services/pricelist/usage';
import { getVersionChecks } from '../src/services/pricelist/checks';

const findMany = prisma.pricelistVersion.findMany as jest.Mock;
const getVersionExportMock = getVersionExport as jest.Mock;
const countUsageMock = countVersionUsage as jest.Mock;
const precoRefsMock = getPrecoReferences as jest.Mock;
const resolveActiveMock = resolveActive as jest.Mock;

function version(overrides: Record<string, unknown> = {}) {
    return {
        id: 'v1',
        type: 'rury',
        version: 'v3',
        seq: 3,
        status: 'DRAFT',
        effectiveFrom: '2027-01-01T00:00:00.000Z',
        ...overrides
    };
}

beforeEach(() => {
    jest.clearAllMocks();
    findMany.mockResolvedValue([]);
});

describe('getVersionChecks', () => {
    test('brak aktywnej: NO_CURRENT, usage ofert i kolizja', async () => {
        getVersionExportMock.mockResolvedValue({
            version: version(),
            sections: { rury: [{ id: 'a', price: 12 }] }
        });
        countUsageMock.mockResolvedValue({ offers: 2, orders: 1, total: 3 });
        resolveActiveMock.mockResolvedValue(null);
        findMany.mockResolvedValue([{ id: 'v2', version: 'v2', seq: 2, status: 'DRAFT' }]);

        const checks = await getVersionChecks('v1');

        expect(checks.advisory).toBe(true);
        expect(checks.usage).toEqual({ offers: 2, orders: 1, total: 3, kind: 'offers' });
        expect(checks.collision.hasCollision).toBe(true);
        expect(checks.collision.versions).toHaveLength(1);
        expect(checks.baseVersion.status).toBe('UNVERIFIABLE');
        expect(checks.comparisonToCurrentApproved.status).toBe('NO_CURRENT');
    });

    test('aktywna identyczna: MATCH i currentVersionId', async () => {
        getVersionExportMock.mockImplementation(async (id: string) => ({
            version: version({ id, status: id === 'v1' ? 'DRAFT' : 'ACTIVE' }),
            sections: { rury: [{ id: 'a', price: 10 }] }
        }));
        countUsageMock.mockResolvedValue({ offers: 0, orders: 0, total: 0 });
        resolveActiveMock.mockResolvedValue(version({ id: 'active', status: 'ACTIVE' }));

        const checks = await getVersionChecks('v1');

        expect(checks.comparisonToCurrentApproved).toEqual({
            status: 'MATCH',
            currentVersionId: 'active',
            sections: { rury: { added: 0, removed: 0, changed: 0 } }
        });
    });

    test('PRECO: usage z referencji studni, kind=studnieVersions', async () => {
        getVersionExportMock.mockResolvedValue({
            version: version({ type: 'preco' }),
            sections: { konfig: [{ id: 'k1', cena: 1 }] }
        });
        precoRefsMock.mockResolvedValue(new Map([['v1', { count: 4, labels: ['v1'] }]]));
        resolveActiveMock.mockResolvedValue(null);

        const checks = await getVersionChecks('v1');

        expect(countUsageMock).not.toHaveBeenCalled();
        expect(checks.usage).toEqual({
            offers: 0,
            orders: 0,
            total: 4,
            kind: 'studnieVersions'
        });
    });
});
