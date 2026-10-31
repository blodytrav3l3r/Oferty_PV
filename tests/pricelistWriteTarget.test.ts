/**
 * S5: cel zapisu cennika + liczniki O3 (bez DB).
 */
import {
    getEditorPricing,
    getPricelistWriteTarget,
    saveRowsToDraft
} from '../src/services/pricelist/writeTarget';
import { resetMetrics } from '../src/utils/metrics';

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
});

describe('getPricelistWriteTarget', () => {
    it('zawsze zwraca draft — zapis do LIVE jest wylaczony', () => {
        expect(getPricelistWriteTarget()).toBe('draft');
    });

    it('PRICELIST_WRITE_TARGET jest ignorowany (brak trybu zapisu LIVE)', () => {
        process.env.PRICELIST_WRITE_TARGET = 'live';
        try {
            expect(getPricelistWriteTarget()).toBe('draft');
        } finally {
            delete process.env.PRICELIST_WRITE_TARGET;
        }
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
