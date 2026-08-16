import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { RewardCalculator } from '../../src/services/ml/RewardCalculator';

jest.mock('../../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

const mockCreate = jest.fn<any>();
const mockUpdateMany = jest.fn<any>().mockResolvedValue({ count: 1 });
const mockTransaction = jest.fn<any>();

jest.mock('../../src/prismaClient', () => ({
    __esModule: true,
    default: {
        $transaction: (...args: any[]) => mockTransaction(...args)
    }
}));

const rewardCalculator = new RewardCalculator();

function buildP2002(): { code: string } {
    return { code: 'P2002' };
}

beforeEach(() => {
    jest.clearAllMocks();
    mockCreate.mockResolvedValue({ id: 'reward' });
    mockTransaction.mockImplementation((fn: (tx: unknown) => Promise<void>) =>
        fn({ aiRewardLog: { create: mockCreate }, users: { updateMany: mockUpdateMany } })
    );
});

describe('RewardCalculator.processAction — A-19', () => {
    it('ACCEPT (wasAiRanked) zapisuje nagrode 1.0 i inkrementuje totalReward w transakcji', async () => {
        const result = await rewardCalculator.processAction({
            userId: 'u1',
            wellId: 'w1',
            action: 'ACCEPT',
            wasAiRanked: true
        });

        expect(result).toEqual({ applied: true });
        expect(mockTransaction).toHaveBeenCalledTimes(1);
        expect(mockCreate).toHaveBeenCalledWith({
            data: expect.objectContaining({
                userId: 'u1',
                wellId: 'w1',
                action: 'ACCEPT',
                reward: 1.0,
                scoreBefore: null,
                scoreAfter: null
            })
        });
        expect(mockUpdateMany).toHaveBeenCalledWith({
            where: { id: 'u1' },
            data: { totalReward: { increment: 1.0 } }
        });
    });

    it('duplikat (P2002) zwraca applied:false bez rzucania (anti-poisoning)', async () => {
        mockCreate.mockRejectedValue(buildP2002());

        const result = await rewardCalculator.processAction({
            userId: 'u1',
            wellId: 'w1',
            action: 'REJECT'
        });

        expect(result).toEqual({ applied: false });
        expect(mockUpdateMany).not.toHaveBeenCalled();
    });

    it('inny blad niz P2002 jest rethrow (brak silent fail)', async () => {
        mockCreate.mockRejectedValue(new Error('db down'));

        await expect(
            rewardCalculator.processAction({
                userId: 'u1',
                wellId: 'w1',
                action: 'ADJUST'
            })
        ).rejects.toThrow('db down');
    });

    it('nieznana akcja rzuca blad zamiast cichego reward=0', async () => {
        await expect(
            rewardCalculator.processAction({
                userId: 'u1',
                wellId: 'w1',
                action: 'BOGUS' as never
            })
        ).rejects.toThrow('Nieznana akcja');
        expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('MODIFY z poprawa liczy reward z klucza score (bez silent default -0.3)', async () => {
        const result = await rewardCalculator.processAction({
            userId: 'u1',
            wellId: 'w1',
            action: 'MODIFY',
            scoreBefore: 0.5,
            scoreAfter: 0.9
        });

        expect(result).toEqual({ applied: true });
        const createArgs = mockCreate.mock.calls[0][0] as {
            data: { reward: number; scoreBefore: number; scoreAfter: number };
        };
        expect(createArgs.data.reward).toBeCloseTo(0.04, 5);
        expect(createArgs.data.scoreBefore).toBe(0.5);
        expect(createArgs.data.scoreAfter).toBe(0.9);
    });
});
