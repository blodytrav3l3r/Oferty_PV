/*
 * Testy RewardCalculator — clamp totalReward (limity bezwzględne).
 */

import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { RewardCalculator } from '../../src/services/ml/RewardCalculator';

const mockCreate = jest.fn<any>();
const mockFindUnique = jest.fn<any>();
const mockUpdate = jest.fn<any>();

jest.mock('../../src/prismaClient', () => {
    const db = {
        $transaction: (cb: any) => cb(db),
        aiRewardLog: { create: (...args: any[]) => mockCreate(...args) },
        users: {
            findUnique: (...args: any[]) => mockFindUnique(...args),
            update: (...args: any[]) => mockUpdate(...args)
        }
    };
    return { __esModule: true, default: db };
});

jest.mock('../../src/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

function lastUpdateData(): { totalReward: number } {
    const calls = mockUpdate.mock.calls as unknown as Array<
        Array<{ where: unknown; data: { totalReward: number } }>
    >;
    return calls[calls.length - 1][0].data;
}

describe('RewardCalculator clamp totalReward', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFindUnique.mockResolvedValue({ totalReward: 0 });
        mockUpdate.mockResolvedValue({});
        mockCreate.mockResolvedValue({});
    });

    it('totalReward nie przekracza MAX_TOTAL_REWARD', async () => {
        mockFindUnique.mockResolvedValue({ totalReward: 900 });
        const calculator = new RewardCalculator();
        const res = await calculator.processAction({
            userId: 'u1',
            wellId: 'w1',
            action: 'ACCEPT',
            wasAiRanked: true
        });
        expect(res.applied).toBe(true);
        expect(mockUpdate).toHaveBeenCalledTimes(1);
        expect(lastUpdateData().totalReward).toBe(901);
    });

    it('totalReward na limicie zostaje clamped (nie increment)', async () => {
        mockFindUnique.mockResolvedValue({ totalReward: 999.7 });
        const calculator = new RewardCalculator();
        await calculator.processAction({
            userId: 'u1',
            wellId: 'w2',
            action: 'ACCEPT',
            wasAiRanked: true
        });
        expect(lastUpdateData().totalReward).toBe(1000);
    });

    it('totalReward nie spada poniżej -MAX_TOTAL_REWARD', async () => {
        mockFindUnique.mockResolvedValue({ totalReward: -999.7 });
        const calculator = new RewardCalculator();
        await calculator.processAction({ userId: 'u1', wellId: 'w3', action: 'REJECT' });
        expect(lastUpdateData().totalReward).toBe(-1000);
    });
});
