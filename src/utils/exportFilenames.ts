/* ===== exportFilenames.ts — SSoT nazewnictwa plików eksportu (backend) =====
 *
 * Jeden wspólny budowniczy nazw dla Content-Disposition we wszystkich trasach
 * eksportu (offers/exports, orders/*.export, exportCombined).
 * Lustrzana implementacja JS: public/js/shared/exportFilenames.js — parzystość
 * reguł pilnuje tests/exportFilenameVectors.json (ten sam plik w obu testach).
 *
 * Konwencja: {rodzaj}_{numery}.pdf|docx|xlsx|json — snake lowercase, zmienna
 * część to sanityzowany numer oferty/zamówienia, fallback ID.
 */

const MAX_PART_LEN = 80;

/**
 * Sanityzuje pojedynczy człon nazwy pliku: diakrytyki → ASCII, separatory
 * ścieżek → '-', allow-list [a-z0-9._-], collapse, trim, cap. Nigdy pusty.
 */
export function safeExportPart(input: unknown): string {
    let s = String(input ?? '');
    // Polskie ł/Ł nie mają dekompozycji NFD (osobne litery) — mapa jawna.
    s = s.replace(/ł/g, 'l').replace(/Ł/g, 'L');
    s = s.normalize('NFD').replace(/\p{M}/gu, '');
    s = s.replace(/[/\\]+/g, '-');
    s = s.replace(/[^a-zA-Z0-9._-]+/g, '_');
    s = s.replace(/_+/g, '_').replace(/-{2,}/g, '-');
    s = s.replace(/^[_.]+|[_.]+$/g, '');
    if (s.length > MAX_PART_LEN) {
        s = s.slice(0, MAX_PART_LEN).replace(/[_.]+$/g, '');
    }
    // Bez lowercase: numery ofert (OF/000001, ZAM-001) zachowują wielkość liter;
    // rodzaje (kind) przekazuj zawsze małymi literami.
    return s || 'dokument';
}

/**
 * Wybiera pierwszy niepusty kandydat (np. [offerNumber, id]) i sanityzuje.
 */
export function pickNamePart(candidates: unknown[]): string {
    for (const c of candidates) {
        if (c === null || c === undefined) continue;
        if (String(c).trim() !== '') return safeExportPart(c);
    }
    return 'dokument';
}

/**
 * Buduje pełną nazwę pliku: kind + każdy człon (człon = lista preferencji)
 * + rozszerzenie. Np. exportFilename('oferta_laczna', [[nrRury],[nrStudni]], 'pdf').
 */
export function exportFilename(kind: string, parts: unknown[][], ext: string): string {
    const safeKind = safeExportPart(kind) || 'plik';
    const safeExt = String(ext || '')
        .replace(/[^a-zA-Z0-9]+/g, '')
        .toLowerCase()
        .slice(0, 8);
    const name = [safeKind, ...parts.map((p) => pickNamePart(Array.isArray(p) ? p : [p]))].join(
        '_'
    );
    return safeExt ? `${name}.${safeExt}` : name;
}
