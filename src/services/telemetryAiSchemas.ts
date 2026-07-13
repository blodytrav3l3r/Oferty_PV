import { z } from 'zod';

export const FEATURE_COUNT = 16;

export const predictSchema = z.object({
    features: z.array(z.number()).length(FEATURE_COUNT),
    wellType: z.string().optional(),
    warehouse: z.string().optional(),
    dn: z.number().optional(),
    featureVersion: z.string().optional()
});

export const batchCandidateSchema = z.object({
    id: z.number(),
    features: z.array(z.number()).length(FEATURE_COUNT),
    wellType: z.string().optional(),
    warehouse: z.string().optional(),
    dn: z.number().optional()
});

export const batchPredictSchema = z.object({
    candidates: z.array(batchCandidateSchema).min(1).max(10),
    featureVersion: z.string().optional()
});

export const rewardSchema = z.object({
    action: z.enum(['ACCEPT', 'REJECT', 'MODIFY', 'ADJUST', 'SWAP']),
    wellId: z.string().optional(),
    dn: z.number().optional(),
    scoreBefore: z.number().optional(),
    scoreAfter: z.number().optional(),
    wasAiRanked: z.boolean().optional(),
    configSnapshot: z.record(z.string(), z.unknown()).optional()
});
