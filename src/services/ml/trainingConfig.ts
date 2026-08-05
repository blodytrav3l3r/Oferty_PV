export const ML_CONFIG = {
    minNewRecordsForTraining: 50,
    minFeatureCountForTraining: 100,
    minHoursSinceLastTrain: 4,
    maxRecordsPerExtraction: 500,
    rollbackAucThreshold: 0.65,
    // 0 = każdy model z wyższym AUC jest wdrażany automatycznie (najlepszy zawsze aktywny)
    deployAucImprovement: 0
};
