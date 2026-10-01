/**
 * P7 — typowany błąd warstwy transferu.
 * Kod trafia do klienta (raport compatibility / odpowiedź API) i do audytu.
 */
export type TransferBlockCode =
    | 'ARCHIVE_EMPTY'
    | 'ARCHIVE_INVALID'
    | 'ARCHIVE_CORRUPT'
    | 'UPLOAD_TOO_LARGE'
    | 'TOO_MANY_FILES'
    | 'PATH_TRAVERSAL'
    | 'ABSOLUTE_PATH'
    | 'EMPTY_PATH'
    | 'UNKNOWN_ARTIFACT'
    | 'DUPLICATE_PATH'
    | 'ARTIFACT_TOO_LARGE'
    | 'UNPACKED_TOO_LARGE'
    | 'COMPRESSION_RATIO_EXCEEDED'
    | 'MANIFEST_MISSING'
    | 'MANIFEST_INVALID'
    | 'CHECKSUMS_MISSING'
    | 'CHECKSUM_MISMATCH'
    | 'PACKAGE_FINGERPRINT_MISMATCH'
    | 'DRY_RUN_NOT_FOUND'
    | 'DRY_RUN_USER_MISMATCH'
    | 'DRY_RUN_EXPIRED'
    | 'DRY_RUN_PACKAGE_MISMATCH'
    | 'DRY_RUN_NOT_PASSED'
    | 'ALREADY_IMPORTED'
    | 'SYMLINK_ENTRY'
    | 'MODEL_DUPLICATE'
    | 'MODEL_NOT_FOUND'
    | 'MODEL_INVALID'
    | 'DATASET_INVALID';

export class TransferError extends Error {
    readonly code: TransferBlockCode;

    constructor(code: TransferBlockCode, message: string) {
        super(message);
        this.name = 'TransferError';
        this.code = code;
    }
}
