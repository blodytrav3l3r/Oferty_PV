import type { TrainingSplit } from './trainingLineage';
import { z } from 'zod';

const safeCountSchema = z.number().int().nonnegative().refine(Number.isSafeInteger);

const trainingGroupDimensionSchema = z.object({
    uniqueGroups: z.object({
        train: safeCountSchema,
        validation: safeCountSchema,
        test: safeCountSchema
    }),
    groupsAcrossSplits: safeCountSchema,
    pairwiseOverlap: z.object({
        trainValidation: safeCountSchema,
        trainTest: safeCountSchema,
        validationTest: safeCountSchema
    }),
    rowsWithoutGroup: safeCountSchema
});

export const trainingGroupDiagnosticsSchema = z
    .object({
        version: z.literal(1),
        status: z.enum(['available', 'partial', 'unavailable']),
        reason: z.enum(['lookup_failed', 'no_telemetry_links', 'no_examples']).optional(),
        totalRows: safeCountSchema,
        rowsWithTelemetry: safeCountSchema,
        well: trainingGroupDimensionSchema,
        offer: trainingGroupDimensionSchema
    })
    .refine((value) => value.rowsWithTelemetry <= value.totalRows);

export type TrainingGroupRow = {
    split: TrainingSplit;
    hasTelemetry: boolean;
    offerId: string | null;
    wellId: string | null;
};

type PairwiseOverlap = {
    trainValidation: number;
    trainTest: number;
    validationTest: number;
};

type GroupDimensionDiagnostics = {
    uniqueGroups: Record<TrainingSplit, number>;
    groupsAcrossSplits: number;
    pairwiseOverlap: PairwiseOverlap;
    rowsWithoutGroup: number;
};

export type TrainingGroupDiagnostics = {
    version: 1;
    status: 'available' | 'partial' | 'unavailable';
    reason?: 'lookup_failed' | 'no_telemetry_links' | 'no_examples';
    totalRows: number;
    rowsWithTelemetry: number;
    well: GroupDimensionDiagnostics;
    offer: GroupDimensionDiagnostics;
};

function createEmptyDimension(rows: number): GroupDimensionDiagnostics {
    return {
        uniqueGroups: { train: 0, validation: 0, test: 0 },
        groupsAcrossSplits: 0,
        pairwiseOverlap: { trainValidation: 0, trainTest: 0, validationTest: 0 },
        rowsWithoutGroup: rows
    };
}

export function unavailableTrainingGroupDiagnostics(
    totalRows: number,
    reason: NonNullable<TrainingGroupDiagnostics['reason']>
): TrainingGroupDiagnostics {
    const rows = Number.isSafeInteger(totalRows) && totalRows > 0 ? totalRows : 0;
    return {
        version: 1,
        status: 'unavailable',
        reason,
        totalRows: rows,
        rowsWithTelemetry: 0,
        well: createEmptyDimension(rows),
        offer: createEmptyDimension(rows)
    };
}

function getGroupId(value: string | null): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function countIntersection(left: ReadonlySet<string>, right: ReadonlySet<string>): number {
    let count = 0;
    for (const value of left) {
        if (right.has(value)) count++;
    }
    return count;
}

function computeDimension(
    rows: readonly TrainingGroupRow[],
    field: 'wellId' | 'offerId'
): GroupDimensionDiagnostics {
    const groupsBySplit: Record<TrainingSplit, Set<string>> = {
        train: new Set(),
        validation: new Set(),
        test: new Set()
    };
    const splitMembership = new Map<string, Set<TrainingSplit>>();
    let rowsWithoutGroup = 0;

    for (const row of rows) {
        const groupId = row.hasTelemetry ? getGroupId(row[field]) : null;
        if (!groupId) {
            rowsWithoutGroup++;
            continue;
        }
        groupsBySplit[row.split].add(groupId);
        const membership = splitMembership.get(groupId) ?? new Set<TrainingSplit>();
        membership.add(row.split);
        splitMembership.set(groupId, membership);
    }

    return {
        uniqueGroups: {
            train: groupsBySplit.train.size,
            validation: groupsBySplit.validation.size,
            test: groupsBySplit.test.size
        },
        groupsAcrossSplits: [...splitMembership.values()].filter(
            (membership) => membership.size > 1
        ).length,
        pairwiseOverlap: {
            trainValidation: countIntersection(groupsBySplit.train, groupsBySplit.validation),
            trainTest: countIntersection(groupsBySplit.train, groupsBySplit.test),
            validationTest: countIntersection(groupsBySplit.validation, groupsBySplit.test)
        },
        rowsWithoutGroup
    };
}

export function computeTrainingGroupDiagnostics(
    rows: readonly TrainingGroupRow[]
): TrainingGroupDiagnostics {
    if (rows.length === 0) return unavailableTrainingGroupDiagnostics(0, 'no_examples');

    const rowsWithTelemetry = rows.filter((row) => row.hasTelemetry).length;
    if (rowsWithTelemetry === 0) {
        return unavailableTrainingGroupDiagnostics(rows.length, 'no_telemetry_links');
    }

    const well = computeDimension(rows, 'wellId');
    const offer = computeDimension(rows, 'offerId');
    const hasMissingGroups =
        rowsWithTelemetry !== rows.length ||
        well.rowsWithoutGroup > 0 ||
        offer.rowsWithoutGroup > 0;

    return {
        version: 1,
        status: hasMissingGroups ? 'partial' : 'available',
        totalRows: rows.length,
        rowsWithTelemetry,
        well,
        offer
    };
}

export function parseTrainingGroupDiagnostics(value: unknown): TrainingGroupDiagnostics | null {
    const result = trainingGroupDiagnosticsSchema.safeParse(value);
    return result.success ? result.data : null;
}

export function parseTrainingGroupDiagnosticsFromSnapshot(
    snapshot: string | null | undefined
): TrainingGroupDiagnostics | null {
    if (!snapshot) return null;
    try {
        const parsed: unknown = JSON.parse(snapshot);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
        return parseTrainingGroupDiagnostics(
            (parsed as Record<string, unknown>).groupOverlapDiagnostics
        );
    } catch {
        return null;
    }
}
