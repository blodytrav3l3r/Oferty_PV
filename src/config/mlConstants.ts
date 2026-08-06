export const FEATURE_NAMES = [
    'dn',
    'heightMm',
    'warehouse_KLB',
    'warehouse_WL',
    'wellType_standard',
    'wellType_psia_buda',
    'wellType_styczna',
    'hasReduction',
    'hasPsiaBuda',
    'ringCount',
    'connectionCount',
    'transitionsAboveDennica',
    'totalPrice',
    'totalWeight',
    'ringVariety',
    'season_num',
    'hasKnownBottom',
    'hasKnownTop',
    'dn_x_ringCount',
    'isKLBstandard',
    'kineta_preco',
    'kineta_unolith',
    'kineta_standard',
    'dennicaHeight'
];

export const ML_CONSTANTS = {
    FEATURE_VERSION: process.env.ML_FEATURE_VERSION || 'v6',
    FEATURE_COUNT: FEATURE_NAMES.length,
    PREDICTION_CACHE_TTL_MS: 15 * 60 * 1000,
    TRAINING_BATCH_SIZE: 2000,
    LEARNING_MAX_RECORDS: 200
} as const;
