/**
 * Telemetry AI - punkt wejścia modułu.
 *
 * Moduł telemetry jest pasywny — solver JS pozostaje jedynym źródłem prawdy
 * doboru elementów studni. Moduł ten zbiera dane do późniejszej analizy AI.
 */

export {
    telemetryService
} from './telemetryService';

export type {
    SolverSource,
    ReviewStatus,
    TelemetryEventType,
    WellComponentSnapshot,
    TransitionSnapshot,
    TelemetryConfigPayload,
    TelemetryEventInput,
    TelemetryRecordResponse,
    TelemetryListResponse,
    ConfigHistoryInput,
    VersionRegistrationInput,
    PassiveHookData,
    PreferenceWeights
} from './telemetryTypes';
