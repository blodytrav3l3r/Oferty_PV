/**
 * F1: Wersjonowanie cenników — drafty per typ + resolveActive.
 *
 * Obok starego priceOverrideService (LIVE + *_Default działają do Contract).
 *
 * FASADA (split 5 modułów, zero zmian API/zachowania): implementacja mieszka
 * w src/services/pricelist/ (validation, lifecycle, liveProjection, export,
 * usage). Ten plik wyłącznie re-eksportuje publiczne symbole — importerzy
 * bez zmian. Symbole wewnętrzne (requireType, toUtcIso, validateRows, locki,
 * helpers tx) NIE są re-eksportowane celowo (jak w oryginale).
 */

export {
    PRICELIST_TYPES,
    EDITABLE_STATUSES,
    PRECO_REFERENCE_STATUSES,
    PricelistVersionError,
    assertEditable,
    requireExportSource,
    requirePricingSource
} from './pricelist/validation';
export type {
    PricelistType,
    PricelistStatus,
    RuryRows,
    StudnieRows,
    PrecoRows,
    VersionRows,
    CreateDraftOptions,
    PricelistExportSource,
    PricingSource
} from './pricelist/validation';

export {
    createDraft,
    versionLabel,
    updateDraft,
    approveVersion,
    publishDraft,
    activate,
    applyBackdate,
    deleteVersion,
    cloneAsDraft
} from './pricelist/lifecycle';
export type { ApproveVersionOptions, CloneDraftOptions } from './pricelist/lifecycle';

export {
    RURY_LIVE_COLUMNS,
    RURY_LIVE_SHEET,
    STUDNIE_LIVE_COLUMNS,
    PRECO_KINETY_LIVE_COLUMNS,
    PRECO_ZAKRESY_LIVE_COLUMNS,
    PRECO_DODATKI_LIVE_COLUMNS,
    PRECO_LIVE_SHEETS,
    liveStudnieSheetName,
    liveSanitizeSheetName,
    projectVersionToLiveShape,
    projectPrecoNestedToSheets
} from './pricelist/liveProjection';
export type { LiveSheetRows } from './pricelist/liveProjection';

export {
    getVersionExport,
    getVersionExportSheets,
    liveSheetsToXlsxSheets,
    getVersionDiff,
    getVersionPreview,
    pickPrecoVersionForStudnie,
    pickPrecoVersionFromTimeline
} from './pricelist/export';
export type {
    VersionExport,
    VersionDiff,
    VersionDiffRef,
    VersionPreview,
    VersionPreviewPrecoRef,
    PrecoTimelineVersion
} from './pricelist/export';

export {
    countVersionUsage,
    getPrecoReferences,
    getVersionsSummary,
    resolveActive,
    resolveVersionIdSafe,
    resolveActivePricing
} from './pricelist/usage';
export type {
    VersionUsage,
    ActivePricing,
    PrecoReferenceInfo,
    VersionSummaryRef,
    VersionsSummary
} from './pricelist/usage';
