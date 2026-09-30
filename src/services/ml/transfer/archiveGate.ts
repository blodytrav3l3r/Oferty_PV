import crypto from 'crypto';
import JSZip from 'jszip';
import { SOKML_LIMITS, isAllowedArtifactPath, type SokmlLimits } from './transferConstants';
import { TransferError } from './transferErrors';

/**
 * P7.0 — Security/Archive Gate (GO-3: pre-extraction validation).
 *
 * ZABRONIONE jest pełne rozpakowanie archiwum przed walidacją.
 * Kolejność: limit rozmiaru bufora → odczyt wpisów central directory (bez
 * ekstrakcji treści) → walidacja nazw/typów/liczby/duplikatów/allowlisty →
 * dopiero kontrolowany odczyt treści (strumień z licznikiem bajtów).
 *
 * Nigdy nie materializujemy symlinków: do pamięci trafiają wyłącznie pliki
 * regularne z allowlisty; wpisy katalogowe są pomijane.
 */

export interface GatedEntry {
    path: string;
    size: number;
    sha256: string;
    data: Buffer;
}

const EOCD_SIG = 0x06054b50;
const CD_SIG = 0x02014b50;
// EOCD może być poprzedzony komentarzem do 65535 B.
const EOCD_SCAN_WINDOW = 65535 + 22;

interface CdEntry {
    name: string;
    dir: boolean;
}

/** Odczyt nazw wpisów z central directory — zero dekompresji treści. */
export function readCentralDirectoryNames(buffer: Buffer): CdEntry[] {
    const tail = Math.min(buffer.length, EOCD_SCAN_WINDOW);
    let eocdAt = -1;
    for (let i = buffer.length - 22; i >= buffer.length - tail && i >= 0; i--) {
        if (buffer.readUInt32LE(i) === EOCD_SIG) {
            eocdAt = i;
            break;
        }
    }
    if (eocdAt < 0) throw new TransferError('ARCHIVE_INVALID', 'Brak rekordu EOCD');
    const totalEntries = buffer.readUInt16LE(eocdAt + 10);
    const cdOffset = buffer.readUInt32LE(eocdAt + 16);
    if (cdOffset >= buffer.length) {
        throw new TransferError('ARCHIVE_INVALID', 'Nieprawidłowy offset central directory');
    }
    const entries: CdEntry[] = [];
    let pos = cdOffset;
    for (let n = 0; n < totalEntries; n++) {
        if (pos + 46 > buffer.length || buffer.readUInt32LE(pos) !== CD_SIG) {
            throw new TransferError('ARCHIVE_INVALID', 'Uszkodzony central directory');
        }
        const nameLen = buffer.readUInt16LE(pos + 28);
        const extraLen = buffer.readUInt16LE(pos + 30);
        const commentLen = buffer.readUInt16LE(pos + 32);
        const nameEnd = pos + 46 + nameLen;
        if (nameEnd > buffer.length) {
            throw new TransferError('ARCHIVE_INVALID', 'Nazwa wpisu poza zakresem');
        }
        const name = buffer.toString('utf8', pos + 46, nameEnd);
        entries.push({ name, dir: name.endsWith('/') });
        pos = nameEnd + extraLen + commentLen;
    }
    return entries;
}

/** Walidacja pojedynczej ścieżki wpisu (eksportowana do testów jednostkowych). */
export function validateEntryName(name: string): void {
    if (!name || name.length === 0) {
        throw new TransferError('EMPTY_PATH', 'Pusta ścieżka wpisu');
    }
    if (name.includes('\0')) {
        throw new TransferError('PATH_TRAVERSAL', 'Znak NUL w ścieżce');
    }
    // Normalizacja separatorów: backslash traktujemy jak separator (atak z Windows).
    const normalized = name.replace(/\\/g, '/');
    if (normalized.startsWith('/') || /^[A-Za-z]:\//.test(normalized)) {
        throw new TransferError('ABSOLUTE_PATH', `Ścieżka absolutna: ${name.slice(0, 80)}`);
    }
    const parts = normalized.split('/');
    if (parts.some((p) => p === '..')) {
        throw new TransferError('PATH_TRAVERSAL', `Ścieżka poza archiwum: ${name.slice(0, 80)}`);
    }
    if (parts.some((p) => p.length === 0 && p !== parts[parts.length - 1])) {
        throw new TransferError('PATH_TRAVERSAL', `Pusta składowa ścieżki: ${name.slice(0, 80)}`);
    }
}

async function readEntryCapped(
    file: JSZip.JSZipObject,
    path: string,
    maxArtifactBytes: number
): Promise<{ data: Buffer; sha256: string }> {
    const hash = crypto.createHash('sha256');
    const chunks: Buffer[] = [];
    let size = 0;
    // jszip nodeStream() to Node Readable — iteracja porcjami z limitem,
    // żeby pojedynczy artefakt nie zaalokował pamięci przed kontrolą.
    const stream = file.nodeStream() as unknown as NodeJS.ReadableStream & {
        destroy?: () => void;
    };
    try {
        await new Promise<void>((resolve, reject) => {
            stream.on('data', (chunk: Uint8Array) => {
                size += chunk.byteLength;
                if (size > maxArtifactBytes) {
                    stream.destroy?.();
                    reject(
                        new TransferError(
                            'ARTIFACT_TOO_LARGE',
                            `Artefakt przekracza limit: ${path}`
                        )
                    );
                    return;
                }
                const buf = Buffer.from(chunk);
                hash.update(buf);
                chunks.push(buf);
            });
            stream.on('end', () => resolve());
            stream.on('error', (err: unknown) => reject(err));
        });
    } catch (e) {
        if (e instanceof TransferError) throw e;
        throw new TransferError('ARCHIVE_CORRUPT', `Błąd odczytu wpisu: ${path}`);
    }
    return { data: Buffer.concat(chunks), sha256: hash.digest('hex') };
}

/**
 * Pełna inspekcja archiwum .sokml. Zwraca mapę zweryfikowanych wpisów
 * (ścieżka → treść + SHA-256). Rzuca TransferError z kodem BLOCKED.
 */
export async function inspectArchive(
    buffer: Buffer,
    limits: SokmlLimits = SOKML_LIMITS
): Promise<Map<string, GatedEntry>> {
    if (!buffer || buffer.length === 0) {
        throw new TransferError('ARCHIVE_EMPTY', 'Pusty pakiet');
    }
    if (buffer.length > limits.maxUploadBytes) {
        throw new TransferError('UPLOAD_TOO_LARGE', 'Pakiet przekracza limit uploadu');
    }
    // 1. Wpisy bez ekstrakcji + limit liczby na poziomie nagłówków.
    const cdEntries = readCentralDirectoryNames(buffer);
    if (cdEntries.length > limits.maxFiles * 4) {
        throw new TransferError('TOO_MANY_FILES', 'Zbyt wiele wpisów w archiwum');
    }
    // 2. Nazwy: traversal/abs/duplikaty; allowlista dla plików.
    const seen = new Set<string>();
    const files: string[] = [];
    for (const entry of cdEntries) {
        validateEntryName(entry.name);
        const normalized = entry.name.replace(/\\/g, '/');
        if (entry.dir) continue;
        if (seen.has(normalized)) {
            throw new TransferError('DUPLICATE_PATH', `Zduplikowana ścieżka: ${normalized}`);
        }
        seen.add(normalized);
        if (!isAllowedArtifactPath(normalized)) {
            throw new TransferError('UNKNOWN_ARTIFACT', `Artefakt spoza allowlisty: ${normalized}`);
        }
        files.push(normalized);
    }
    if (files.length === 0 || files.length > limits.maxFiles) {
        throw new TransferError('TOO_MANY_FILES', 'Nieprawidłowa liczba plików w pakiecie');
    }
    // 3. Parsowanie treści dopiero po walidacji strukturalnej.
    let zip: JSZip;
    try {
        zip = await JSZip.loadAsync(buffer);
    } catch {
        throw new TransferError('ARCHIVE_INVALID', 'Nieprawidłowy format ZIP');
    }
    // 4. Kontrolowany odczyt treści (strumień z limitem na artefakt i całość).
    const result = new Map<string, GatedEntry>();
    let totalUnpacked = 0;
    for (const path of files) {
        const file = zip.file(path);
        if (!file) {
            throw new TransferError('ARCHIVE_CORRUPT', `Brak wpisu po parsowaniu: ${path}`);
        }
        const { data, sha256 } = await readEntryCapped(file, path, limits.maxArtifactBytes);
        totalUnpacked += data.length;
        if (totalUnpacked > limits.maxUnpackedBytes) {
            throw new TransferError('UNPACKED_TOO_LARGE', 'Pakiet po rozpakowaniu za duży');
        }
        result.set(path, { path, size: data.length, sha256, data });
    }
    if (totalUnpacked / Math.max(buffer.length, 1) > limits.maxCompressionRatio) {
        throw new TransferError('COMPRESSION_RATIO_EXCEEDED', 'Podejrzany stopień kompresji');
    }
    return result;
}
