export type AiOfferWellStatus =
    'READY' | 'WAITING_FEEDBACK' | 'COLLECTING' | 'EXCLUDED' | 'NO_DATA';

export interface AiOfferWellTelemetry {
    id: string;
    wellId: string | null;
    userId: string | null;
    trainingEligible: boolean;
}

export interface AiOfferWellFeature {
    telemetryId: string | null;
    label: string;
}

export interface AiOfferWellStatuses {
    wells: { wellId: string; status: AiOfferWellStatus }[];
    counts: {
        ready: number;
        waiting: number;
        collecting: number;
        excluded: number;
        noData: number;
    };
}

export function buildAiOfferWellStatuses(
    wellIds: readonly string[],
    telemetry: readonly AiOfferWellTelemetry[],
    features: readonly AiOfferWellFeature[],
    allowlist: readonly string[]
): AiOfferWellStatuses {
    const telemetryByWell = new Map<string, AiOfferWellTelemetry[]>();
    telemetry.forEach((row) => {
        if (!row.wellId) return;
        telemetryByWell.set(row.wellId, [...(telemetryByWell.get(row.wellId) || []), row]);
    });
    const featureLabels = new Map<string, Set<string>>();
    const allowedUsers = new Set(allowlist);
    features.forEach((feature) => {
        if (!feature.telemetryId) return;
        const labels = featureLabels.get(feature.telemetryId) || new Set<string>();
        labels.add(feature.label);
        featureLabels.set(feature.telemetryId, labels);
    });

    const counts: AiOfferWellStatuses['counts'] = {
        ready: 0,
        waiting: 0,
        collecting: 0,
        excluded: 0,
        noData: 0
    };
    const wells = [...new Set(wellIds)].map((wellId) => {
        const records = telemetryByWell.get(wellId) || [];
        const eligible = records.filter(
            (row) => row.trainingEligible && !!row.userId && allowedUsers.has(row.userId)
        );
        const labels = eligible.flatMap((row) => [...(featureLabels.get(row.id) || [])]);
        const status: AiOfferWellStatus =
            records.length === 0
                ? 'NO_DATA'
                : eligible.length === 0
                  ? 'EXCLUDED'
                  : labels.some((label) =>
                          [
                              'ACCEPTED',
                              'ACCEPTED_AFTER_MODIFICATION',
                              'REJECTED',
                              'MODIFIED'
                          ].includes(label)
                      )
                    ? 'READY'
                    : labels.includes('NO_FEEDBACK')
                      ? 'WAITING_FEEDBACK'
                      : 'COLLECTING';
        const countKey =
            status === 'READY'
                ? 'ready'
                : status === 'WAITING_FEEDBACK'
                  ? 'waiting'
                  : status === 'COLLECTING'
                    ? 'collecting'
                    : status === 'EXCLUDED'
                      ? 'excluded'
                      : 'noData';
        counts[countKey] += 1;
        return { wellId, status };
    });

    return { wells, counts };
}
