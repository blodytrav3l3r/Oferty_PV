/**
 * FeedbackProcessor.ts
 *
 * Przetwarza sygnały zwrotne z telemetry na wewnętrzne "feedback events"
 * wykorzystywane przez PatternDetector.
 *
 * Pasywne - nie wpływa na solvera.
 */

export interface FeedbackEvent {
    type: 'accept' | 'reject' | 'modify' | 'fallback';
    wellId: string;
    dn?: string;
    telemetryId?: string;
    details?: Record<string, unknown>;
    at: string;
}

export class FeedbackProcessor {
    /**
     * Mapuje zdarzenia telemetry na FeedbackEvent wewnętrzny.
     */
    fromTelemetryEvent(event: {
        eventType: string;
        telemetryId?: string | null;
        wellId?: string | null;
        componentId?: string | null;
        previousValue?: string | null;
        newValue?: string | null;
        changeReason?: string | null;
        createdAt?: string | null;
    }): FeedbackEvent | null {
        const at = event.createdAt || new Date().toISOString();
        switch (event.eventType) {
            case 'accept':
                return {
                    type: 'accept',
                    wellId: event.wellId || 'unknown',
                    telemetryId: event.telemetryId || undefined,
                    at
                };
            case 'reject':
                return {
                    type: 'reject',
                    wellId: event.wellId || 'unknown',
                    telemetryId: event.telemetryId || undefined,
                    at
                };
            case 'user_change':
                return {
                    type: 'modify',
                    wellId: event.wellId || 'unknown',
                    telemetryId: event.telemetryId || undefined,
                    details: {
                        from: event.previousValue,
                        to: event.newValue,
                        reason: event.changeReason
                    },
                    at
                };
            case 'fallback_triggered':
                return {
                    type: 'fallback',
                    wellId: event.wellId || 'unknown',
                    telemetryId: event.telemetryId || undefined,
                    at
                };
            default:
                return null;
        }
    }

    /**
     * Batch - przyjmuje tablicę zdarzeń telemetry.
     */
    fromBatch(events: Array<{ eventType: string }>): FeedbackEvent[] {
        const out: FeedbackEvent[] = [];
        for (const e of events) {
            const fe = this.fromTelemetryEvent(e as {
                eventType: string;
                telemetryId?: string | null;
                wellId?: string | null;
                createdAt?: string | null;
            });
            if (fe) out.push(fe);
        }
        return out;
    }
}
