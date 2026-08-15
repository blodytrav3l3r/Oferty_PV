/**
 * Cykl życia modelu ML (AiModel.state). String + stała centralna — zgodnie
 * z konwencją projektu (schema celowo nie używa Prisma enum; pola statusowe
 * to String: AiFeature.label, aiRewardLog.action itd.).
 *
 * Odrębna oś od TrainingRun.status: state opisuje życie MODELU,
 * status opisuje wynik PROCESU treningowego.
 */
export const AiModelState = {
    CANDIDATE: 'CANDIDATE',
    APPROVED: 'APPROVED',
    PRODUCTION: 'PRODUCTION',
    REJECTED: 'REJECTED',
    ROLLED_BACK: 'ROLLED_BACK'
} as const;

export type AiModelStateValue = (typeof AiModelState)[keyof typeof AiModelState];

const VALID_STATES = new Set<string>(Object.values(AiModelState));

export function isValidAiModelState(state: string | null | undefined): state is AiModelStateValue {
    return state != null && VALID_STATES.has(state);
}

/**
 * Guard walidacji stanu przy zapisie. Nieznana wartość → błąd (odrzucenie zapisu).
 */
export function assertValidAiModelState(
    state: string | null | undefined
): AiModelStateValue | null {
    if (state == null) return null;
    if (!VALID_STATES.has(state)) {
        throw new Error(`Nieznany stan modelu AiModel: "${state}"`);
    }
    return state as AiModelStateValue;
}

/**
 * Semantyka legacy: aktywny model bez state = PRODUCTION (backward compatibility).
 */
export function resolveLegacyState(
    active: boolean,
    state: string | null | undefined
): AiModelStateValue {
    if (isValidAiModelState(state)) return state;
    return active ? AiModelState.PRODUCTION : AiModelState.CANDIDATE;
}
