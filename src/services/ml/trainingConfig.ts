export const ML_CONFIG = {
    minNewRecordsForTraining: 50,
    minFeatureCountForTraining: 100,
    minHoursSinceLastTrain: 4,
    rollbackAucThreshold: 0.65,
    // Antychatter: margines 0.01 — niewielkie wahania nie wywołują deploy.
    // Kandydat musi być istotnie lepszy od aktualnego PRODUCTION (plan 2.3).
    deployAucImprovement: 0.01,
    // Guardy minimalnych rozmiarów zbiorów (split 70/15/15). Niespełnienie → SKIPPED.
    minDatasetForSplit: 300,
    minTrain: 200,
    minVal: 50,
    minTest: 50,
    minTestPositive: 5,
    minTestNegative: 5,
    // Deploy guardrails (ETAP 5): absolutne progi dla pierwszego modelu
    minAuc: 0.55,
    minPrAuc: 0.5,
    maxLogLoss: 1.0,
    maxEce: 0.25,
    // Relatywne progi regresji względem aktualnego PRODUCTION
    maxLogLossRegression: 0.02,
    maxEceRegression: 0.02,
    // Loss divergence (ETAP 3): loss > bestLoss * (1 + threshold) przez N epok
    divergenceThreshold: 0.05,
    divergenceEpochs: 10,
    // Timeout treningu (ETAP 3): cooperative cancellation — deadline sprawdzany co epokę
    maxTrainingDurationMs: 120_000,
    // Retencja rejestru modeli ML (pruneOldModels)
    retention: {
        keepLast: 10, // zawsze trzymaj N najnowszych (keepLast >= 2 gwarantuje działający rollback)
        keepBest: 3 // + N najlepszych wg AUC (keepBest >= 1 gwarantuje cel promoteBestModel)
    },
    // Ograniczenia POST /ai/train (ETAP 8): min-interval między treningami
    // + max-duration — admin nie może uruchomić serii treningów w kilka sekund.
    trainMinIntervalMs: 60_000,
    trainMaxDurationMs: 300_000
};
