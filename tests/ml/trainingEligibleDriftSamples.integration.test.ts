import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import crypto from 'node:crypto';
import prisma from '../../src/prismaClient';
import { findEligibleLabeledFeatures } from '../../src/services/ml/trainingUsers';

const TAG = `drift-window-${crypto.randomUUID()}`;
const ALLOWED_USER = `${TAG}-allowed`;
const OTHER_USER = `${TAG}-other`;
const TELEMETRY_IDS = Array.from({ length: 5 }, (_, index) => `${TAG}-telemetry-${index}`);
const FEATURE_IDS = Array.from({ length: 5 }, (_, index) => `${TAG}-feature-${index}`);

beforeAll(async () => {
    await prisma.ai_telemetry_logs.createMany({
        data: [
            { id: TELEMETRY_IDS[0], userId: ALLOWED_USER, trainingEligible: true },
            { id: TELEMETRY_IDS[1], userId: OTHER_USER, trainingEligible: true },
            { id: TELEMETRY_IDS[2], userId: ALLOWED_USER, trainingEligible: false },
            { id: TELEMETRY_IDS[3], userId: ALLOWED_USER, trainingEligible: true },
            { id: TELEMETRY_IDS[4], userId: ALLOWED_USER, trainingEligible: true }
        ]
    });
    await prisma.aiFeature.createMany({
        data: [
            {
                id: FEATURE_IDS[0],
                telemetryId: TELEMETRY_IDS[0],
                createdAt: '2026-11-27T12:30:00.000Z',
                label: 'ACCEPTED',
                dn: 1000,
                heightMm: 2000,
                warehouse: 'KLB',
                wellType: 'standard',
                bottomType: 'beton',
                topType: 'standard',
                season: 'winter'
            },
            {
                id: FEATURE_IDS[1],
                telemetryId: TELEMETRY_IDS[1],
                createdAt: '2026-11-27T12:40:00.000Z',
                label: 'ACCEPTED',
                dn: 1000,
                heightMm: 2000,
                warehouse: 'KLB',
                wellType: 'standard',
                bottomType: 'beton',
                topType: 'standard',
                season: 'winter'
            },
            {
                id: FEATURE_IDS[2],
                telemetryId: TELEMETRY_IDS[2],
                createdAt: '2026-11-27T12:50:00.000Z',
                label: 'ACCEPTED',
                dn: 1000,
                heightMm: 2000,
                warehouse: 'KLB',
                wellType: 'standard',
                bottomType: 'beton',
                topType: 'standard',
                season: 'winter'
            },
            {
                id: FEATURE_IDS[3],
                telemetryId: TELEMETRY_IDS[3],
                createdAt: '2026-11-27T11:50:00.000Z',
                label: 'ACCEPTED',
                dn: 1000,
                heightMm: 2000,
                warehouse: 'KLB',
                wellType: 'standard',
                bottomType: 'beton',
                topType: 'standard',
                season: 'winter'
            },
            {
                id: FEATURE_IDS[4],
                telemetryId: TELEMETRY_IDS[4],
                createdAt: '2026-11-27T12:35:00.000Z',
                label: 'NO_FEEDBACK',
                dn: 1000,
                heightMm: 2000,
                warehouse: 'KLB',
                wellType: 'standard',
                bottomType: 'beton',
                topType: 'standard',
                season: 'winter'
            }
        ]
    });
});

afterAll(async () => {
    await prisma.aiFeature.deleteMany({ where: { id: { startsWith: TAG } } });
    await prisma.ai_telemetry_logs.deleteMany({ where: { id: { startsWith: TAG } } });
    await prisma.$disconnect();
});

describe('AI drift sample window PostgreSQL query', () => {
    it('filters by owner, training eligibility, label and post-training time before limit', async () => {
        const rows = await findEligibleLabeledFeatures(
            '2026-11-27T12:00:00.000Z',
            [ALLOWED_USER],
            1
        );

        expect(rows.map((row) => row.id)).toEqual([FEATURE_IDS[0]]);
    });
});
