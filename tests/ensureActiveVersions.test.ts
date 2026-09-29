/**
 * ensureActivePricelistVersions: LIVE bez wersji → v1 ACTIVE; z wersjami → skip;
 * puste LIVE → skip. Mock prismy jak pricelistActiveSource.test.ts.
 */
import { ensureActivePricelistVersions } from '../src/services/ensureActiveVersions';

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

const mockPrisma = jest.mocked(jest.requireMock('../src/prismaClient').default ?? {});

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        pricelistVersion: { count: jest.fn(), create: jest.fn() },
        productsRury: { count: jest.fn(), findMany: jest.fn() },
        productsStudnie: { count: jest.fn(), findMany: jest.fn() },
        precoKonfig: { count: jest.fn(), findMany: jest.fn() },
        precoKinety: { count: jest.fn(), findMany: jest.fn() },
        precoZakresy: { count: jest.fn(), findMany: jest.fn() },
        pricelistItemRury: { createMany: jest.fn() },
        pricelistItemStudnie: { createMany: jest.fn() },
        pricelistItemPrecoKonfig: { createMany: jest.fn() },
        pricelistItemPrecoKinety: { createMany: jest.fn() },
        pricelistItemPrecoZakresy: { createMany: jest.fn() },
        $transaction: jest.fn(async (fn: any) =>
            fn({
                pricelistItemRury: { createMany: jest.fn() },
                pricelistItemStudnie: { createMany: jest.fn() },
                pricelistItemPrecoKonfig: { createMany: jest.fn() },
                pricelistItemPrecoKinety: { createMany: jest.fn() },
                pricelistItemPrecoZakresy: { createMany: jest.fn() }
            })
        )
    }
}));

function setup(opts: { versions: Record<string, number>; live: Record<string, number> }) {
    const p: any = jest.requireMock('../src/prismaClient').default;
    p.pricelistVersion.count.mockImplementation(({ where }: any) => opts.versions[where.type] ?? 0);
    p.productsRury.count.mockResolvedValue(opts.live.rury ?? 0);
    p.productsStudnie.count.mockResolvedValue(opts.live.studnie ?? 0);
    p.precoKonfig.count.mockResolvedValue(opts.live.preco ?? 0);
    p.precoKinety.count.mockResolvedValue(0);
    p.precoZakresy.count.mockResolvedValue(0);
    p.productsRury.findMany.mockResolvedValue(
        Array.from({ length: opts.live.rury ?? 0 }, (_, i) => ({ id: `r${i}`, price: 1 }))
    );
    p.productsStudnie.findMany.mockResolvedValue([]);
    p.precoKonfig.findMany.mockResolvedValue([]);
    p.precoKinety.findMany.mockResolvedValue([]);
    p.precoZakresy.findMany.mockResolvedValue([]);
    p.pricelistVersion.create.mockImplementation(({ data }: any) => Promise.resolve(data));
    void mockPrisma;
}

beforeEach(jest.clearAllMocks);

test('LIVE bez wersji → tworzy v1 ACTIVE', async () => {
    setup({ versions: { rury: 0, studnie: 1, preco: 1 }, live: { rury: 2 } });
    const created = await ensureActivePricelistVersions();
    expect(created).toEqual(['rury']);
    const p: any = jest.requireMock('../src/prismaClient').default;
    expect(p.pricelistVersion.create).toHaveBeenCalledTimes(1);
    expect(p.pricelistVersion.create.mock.calls[0][0].data).toMatchObject({
        type: 'rury',
        seq: 1,
        version: 'v1',
        status: 'ACTIVE'
    });
});

test('istniejące wersje → skip', async () => {
    setup({ versions: { rury: 1, studnie: 1, preco: 1 }, live: { rury: 5 } });
    expect(await ensureActivePricelistVersions()).toEqual([]);
});

test('puste LIVE → skip', async () => {
    setup({ versions: { rury: 0, studnie: 0, preco: 0 }, live: {} });
    expect(await ensureActivePricelistVersions()).toEqual([]);
});
