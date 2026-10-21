/**
 * S5: cel zapisu cennika + liczniki O3 (bez DB).
 */
import {
    getEditorPricing,
    getPricelistWriteTarget,
    saveRowsToDraft
} from '../src/services/pricelist/writeTarget';
import {
    getMetricsSnapshot,
    recordPricelistFallback,
    recordPricelistLiveWrite,
    resetMetrics
} from '../src/utils/metrics';

const createDraft = jest.fn();
const updateDraft = jest.fn();
jest.mock('../src/services/pricelist/lifecycle', () => ({
    createDraft: (...args: unknown[]) => createDraft(...args),
    updateDraft: (...args: unknown[]) => updateDraft(...args)
}));

const pricingFromVersion = jest.fn();
const resolveActivePricing = jest.fn();
jest.mock('../src/services/pricelist/usage', () => ({
    pricingFromVersion: (...args: unknown[]) => pricingFromVersion(...args),
    resolveActivePricing: (...args: unknown[]) => resolveActivePricing(...args)
}));

const findFirst = jest.fn();
jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: { pricelistVersion: { findFirst: (...args: unknown[]) => findFirst(...args) } }
}));

beforeEach(() => {
    jest.clearAllMocks();
    resetMetrics();
    delete process.env.PRICELIST_WRITE_TARGET;
});

describe('getPricelistWriteTarget', () => {
    it('default = draft (S5)', () => {
        expect(getPricelistWriteTarget()).toBe('draft');
    });

    it('PRICELIST_WRITE_TARGET=draft przelacza zapis', () => {
        process.env.PRICELIST_WRITE_TARGET = 'draft';
        expect(getPricelistWriteTarget()).toBe('draft');
    });

    it('PRICELIST_WRITE_TARGET=live zostaje live', () => {
        process.env.PRICELIST_WRITE_TARGET = 'live';
        expect(getPricelistWriteTarget()).toBe('live');
    });
});

describe('saveRowsToDraft', () => {
    it('wznawia istniejacy DRAFT', async () => {
        findFirst.mockResolvedValue({ id: 'd1' });
        updateDraft.mockResolvedValue({ id: 'd1' });
        await saveRowsToDraft('rury', [{ id: 'r1' }], 'u1');
        expect(updateDraft).toHaveBeenCalledWith('d1', [{ id: 'r1' }], undefined, {
            userId: 'u1'
        });
        expect(createDraft).not.toHaveBeenCalled();
    });

    it('tworzy DRAFT, gdy brak szkicu', async () => {
        findFirst.mockResolvedValue(null);
        createDraft.mockResolvedValue({ id: 'd2' });
        await saveRowsToDraft('studnie', [], 'u1');
        expect(createDraft).toHaveBeenCalledWith('studnie', [], { createdBy: 'u1' });
        expect(updateDraft).not.toHaveBeenCalled();
    });
});

describe('getEditorPricing', () => {
    it('DRAFT ma pierwszenstwo przed ACTIVE', async () => {
        findFirst.mockResolvedValue({ id: 'd1' });
        pricingFromVersion.mockResolvedValue({ data: [{ id: 'r1' }], fallback: false });
        const out = await getEditorPricing('rury');
        expect(pricingFromVersion).toHaveBeenCalledWith('rury', { id: 'd1' });
        expect(out.data).toEqual([{ id: 'r1' }]);
        expect(resolveActivePricing).not.toHaveBeenCalled();
    });

    it('brak DRAFT = ACTIVE', async () => {
        findFirst.mockResolvedValue(null);
        resolveActivePricing.mockResolvedValue({ data: [], fallback: false });
        await getEditorPricing('rury');
        expect(resolveActivePricing).toHaveBeenCalledWith('rury');
    });
});

describe('liczniki O3', () => {
    it('zlicza LIVE_WRITE i fallback per typ', () => {
        recordPricelistLiveWrite('rury');
        recordPricelistLiveWrite('rury');
        recordPricelistLiveWrite('preco');
        recordPricelistFallback('studnie');
        const p = getMetricsSnapshot().pricelist;
        expect(p.liveWrites).toBe(3);
        expect(p.liveWritesByType).toEqual({ rury: 2, preco: 1 });
        expect(p.fallbacks).toBe(1);
        expect(p.fallbacksByType).toEqual({ studnie: 1 });
    });
});
