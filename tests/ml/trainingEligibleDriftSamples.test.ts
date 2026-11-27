import { describe, expect, it, jest, beforeEach } from '@jest/globals';

const mockQueryRaw = jest.fn<any>();

jest.mock('../../src/prismaClient', () => ({
    __esModule: true,
    default: { $queryRaw: (...args: any[]) => mockQueryRaw(...args) }
}));

import { findEligibleLabeledFeatures } from '../../src/services/ml/trainingUsers';

describe('findEligibleLabeledFeatures', () => {
    beforeEach(() => {
        mockQueryRaw.mockReset();
        mockQueryRaw.mockResolvedValue([]);
    });

    it('filtruje kwalifikację allowlisty w PostgreSQL przed ograniczeniem okna', async () => {
        await findEligibleLabeledFeatures('2026-11-27T12:00:00.000Z', ['owner-1'], 500);

        expect(mockQueryRaw).toHaveBeenCalledTimes(1);
        const [query, since, userIds, limit] = mockQueryRaw.mock.calls[0] as [
            TemplateStringsArray,
            string,
            { values: string[] },
            number
        ];
        const sql = query.join('');
        expect(sql).toContain('INNER JOIN "ai_telemetry_logs"');
        expect(sql).toContain('"trainingEligible" = TRUE');
        expect(sql.indexOf('"trainingEligible"')).toBeLessThan(sql.indexOf('ORDER BY'));
        expect(sql.indexOf('ORDER BY')).toBeLessThan(sql.indexOf('LIMIT'));
        expect(since).toBe('2026-11-27T12:00:00.000Z');
        expect(userIds).toMatchObject({ values: ['owner-1'] });
        expect(limit).toBe(500);
    });

    it('nie wykonuje zapytania dla pustej allowlisty ani nieprawidłowego limitu', async () => {
        await expect(
            findEligibleLabeledFeatures('2026-11-27T12:00:00.000Z', [], 500)
        ).resolves.toEqual([]);
        await expect(
            findEligibleLabeledFeatures('2026-11-27T12:00:00.000Z', ['owner-1'], 0)
        ).resolves.toEqual([]);
        expect(mockQueryRaw).not.toHaveBeenCalled();
    });
});
