export const ML_CONFIG = {
    minNewRecordsForTraining: 50,
    minFeatureCountForTraining: 100,
    minHoursSinceLastTrain: 4,
    rollbackAucThreshold: 0.65,
    // 0 = każdy model z wyższym AUC jest wdrażany automatycznie (najlepszy zawsze aktywny)
    deployAucImprovement: 0,
    // Retencja rejestru modeli ML (pruneOldModels)
    retention: {
        keepLast: 10, // zawsze trzymaj N najnowszych (keepLast >= 2 gwarantuje działający rollback)
        keepBest: 3 // + N najlepszych wg AUC (keepBest >= 1 gwarantuje cel promoteBestModel)
    }
};
