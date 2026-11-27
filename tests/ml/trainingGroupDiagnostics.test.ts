import { describe, expect, it } from '@jest/globals';
import {
    computeTrainingGroupDiagnostics,
    parseTrainingGroupDiagnostics,
    parseTrainingGroupDiagnosticsFromSnapshot,
    unavailableTrainingGroupDiagnostics,
    type TrainingGroupRow
} from '../../src/services/ml/trainingGroupDiagnostics';

const rows: TrainingGroupRow[] = [
    { split: 'train', hasTelemetry: true, offerId: 'offer-a', wellId: 'well-a' },
    { split: 'train', hasTelemetry: true, offerId: 'offer-b', wellId: 'well-b' },
    { split: 'validation', hasTelemetry: true, offerId: 'offer-a', wellId: 'well-a' },
    { split: 'test', hasTelemetry: true, offerId: 'offer-c', wellId: 'well-b' },
    { split: 'test', hasTelemetry: false, offerId: null, wellId: null }
];

describe('diagnostyka przecięć grup treningowych', () => {
    it('liczy grupy i ich przecięcia osobno dla studni i ofert bez zwracania identyfikatorów', () => {
        const diagnostics = computeTrainingGroupDiagnostics(rows);

        expect(diagnostics).toMatchObject({
            version: 1,
            status: 'partial',
            totalRows: 5,
            rowsWithTelemetry: 4,
            well: {
                uniqueGroups: { train: 2, validation: 1, test: 1 },
                groupsAcrossSplits: 2,
                pairwiseOverlap: { trainValidation: 1, trainTest: 1, validationTest: 0 },
                rowsWithoutGroup: 1
            },
            offer: {
                uniqueGroups: { train: 2, validation: 1, test: 1 },
                groupsAcrossSplits: 1,
                pairwiseOverlap: { trainValidation: 1, trainTest: 0, validationTest: 0 },
                rowsWithoutGroup: 1
            }
        });
        expect(JSON.stringify(diagnostics)).not.toContain('offer-a');
        expect(JSON.stringify(diagnostics)).not.toContain('well-a');
    });

    it('zwraca jawny stan niedostępny po błędzie odczytu', () => {
        expect(unavailableTrainingGroupDiagnostics(12, 'lookup_failed')).toMatchObject({
            version: 1,
            status: 'unavailable',
            reason: 'lookup_failed',
            totalRows: 12,
            rowsWithTelemetry: 0
        });
    });

    it('odrzuca niepoprawny snapshot i usuwa nieznane pola przy parsowaniu', () => {
        expect(parseTrainingGroupDiagnostics(null)).toBeNull();
        expect(
            parseTrainingGroupDiagnostics({
                ...computeTrainingGroupDiagnostics(rows),
                offerId: 'secret'
            })
        ).not.toHaveProperty('offerId');
        expect(
            parseTrainingGroupDiagnostics({
                ...computeTrainingGroupDiagnostics(rows),
                totalRows: -1
            })
        ).toBeNull();
    });

    it('bezpiecznie czyta zagregowane dane z lineageSnapshot albo zwraca null', () => {
        const diagnostics = computeTrainingGroupDiagnostics(rows);
        const snapshot = JSON.stringify({
            groupOverlapDiagnostics: diagnostics,
            wellId: 'private'
        });

        expect(parseTrainingGroupDiagnosticsFromSnapshot(snapshot)).toEqual(diagnostics);
        expect(parseTrainingGroupDiagnosticsFromSnapshot('{')).toBeNull();
        expect(parseTrainingGroupDiagnosticsFromSnapshot(null)).toBeNull();
        expect(JSON.stringify(parseTrainingGroupDiagnosticsFromSnapshot(snapshot))).not.toContain(
            'private'
        );
    });
});
