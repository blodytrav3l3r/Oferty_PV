import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { getPredictionStats } from '../../src/services/telemetry/aiReadModel';
import { addVerifiedPredictionProvenance } from '../../src/services/ml/predictionProvenance';

const mockCount = jest.fn<any>();
const mockGroupBy = jest.fn<any>();
const mockFindMany = jest.fn<any>();

jest.mock('../../src/prismaClient', () => ({
    __esModule: true,
    default: {
        aiRewardLog: {
            count: (...args: any[]) => mockCount(...args),
            groupBy: (...args: any[]) => mockGroupBy(...args),
            findMany: (...args: any[]) => mockFindMany(...args)
        }
    }
}));

beforeEach(() => {
    jest.clearAllMocks();
    mockCount.mockResolvedValue(15);
    mockGroupBy.mockResolvedValue([{ action: 'ACCEPT', _count: { _all: 15 } }]);
    mockFindMany.mockResolvedValue([]);
});

describe('getPredictionStats', () => {
    it('zwraca tylko serwerowo zweryfikowane score z jednej wersji modelu', async () => {
        const serialize = (score: number, modelVersion: string, rewardId: string) =>
            JSON.stringify(
                addVerifiedPredictionProvenance(
                    undefined,
                    {
                        score,
                        modelVersion,
                        verifiedAt: '2026-11-27T12:00:00.000Z'
                    },
                    rewardId
                )
            );
        mockFindMany.mockResolvedValue([
            { id: 'reward-1', configSnapshot: serialize(0.8, 'model-v2', 'reward-1') },
            { id: 'reward-2', configSnapshot: serialize(0.9, 'model-v1', 'reward-2') },
            { id: 'reward-3', configSnapshot: '{"scoreBefore":0.6}' },
            { id: 'reward-4', configSnapshot: serialize(0.7, 'model-v2', 'reward-4') }
        ]);

        const result = await getPredictionStats(10);

        expect(result).toEqual({
            total: 15,
            actions: { ACCEPT: 15 },
            recentScores: [0.8, 0.7],
            recentCount: 2,
            scoreModelVersion: 'model-v2'
        });
        expect(mockFindMany).toHaveBeenCalledWith({
            where: { scoreBefore: { not: null } },
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: { id: true, configSnapshot: true }
        });
    });

    it('nie przedstawia braku danych jako score równego zero', async () => {
        const result = await getPredictionStats();
        expect(result.recentScores).toEqual([]);
        expect(result.recentCount).toBe(0);
        expect(result.scoreModelVersion).toBeNull();
    });
});
