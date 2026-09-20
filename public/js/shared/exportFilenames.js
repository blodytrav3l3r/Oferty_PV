// @ts-check
/* ===== exportFilenames.js — SSoT nazewnictwa plików eksportu (frontend) =====
 *
 * Lustrzana implementacja src/utils/exportFilenames.ts (te same reguły).
 * Parzystość pilnuje tests/exportFilenameVectors.json (wspólne wektory).
 * Używają: offerPrintManager (rury/studnie), orderExport, printModal,
 * offerCrud/offerExports (JSON/XLSX), offerFileOps, draftAutosave.
 */

var MAX_PART_LEN = 80;

function efSafePart(input) {
    var s = String(input === null || input === undefined ? '' : input);
    if (typeof s.normalize === 'function') s = s.normalize('NFD');
    s = s.replace(/ł/g, 'l').replace(/Ł/g, 'L');
    s = s.replace(/\p{M}/gu, '');
    s = s.replace(/[/\\]+/g, '-');
    s = s.replace(/[^a-zA-Z0-9._-]+/g, '_');
    s = s.replace(/_+/g, '_').replace(/-{2,}/g, '-');
    s = s.replace(/^[_.]+|[_.]+$/g, '');
    if (s.length > MAX_PART_LEN) s = s.slice(0, MAX_PART_LEN).replace(/[_.]+$/g, '');
    return s || 'dokument';
}

function efPickPart(candidates) {
    var list = Array.isArray(candidates) ? candidates : [candidates];
    for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if (c === null || c === undefined) continue;
        if (String(c).trim() !== '') return efSafePart(c);
    }
    return 'dokument';
}

function efFilename(kind, parts, ext) {
    var safeKind = efSafePart(kind) || 'plik';
    var safeExt = String(ext || '')
        .replace(/[^a-zA-Z0-9]+/g, '')
        .toLowerCase()
        .slice(0, 8);
    var names = [safeKind];
    for (var i = 0; i < (parts || []).length; i++) names.push(efPickPart(parts[i]));
    var name = names.join('_');
    return safeExt ? name + '.' + safeExt : name;
}

/**
 * Wyciąga filename z nagłówka Content-Disposition. Zwraca '' gdy brak/śmieci.
 * Backend jest SSoT nazwy — frontend już jej nie zgaduje (decyzja unifikacji).
 */
function efFromDisposition(header) {
    if (!header || typeof header !== 'string') return '';
    // Nagłówek z CRLF to zawsze śmieci/atak — odrzuć w całości (bez wycieku prefiksu).
    if (/[\r\n]/.test(header)) return '';
    var m = /filename\*?\s*=\s*(?:UTF-8''\s*)?"?([^";]+)"?/i.exec(header);
    if (!m) return '';
    var name = m[1].trim().replace(/"$/g, '');
    if (!name || /["\r\n]/.test(name) || name.length > 180) return '';
    return name;
}

/**
 * Nazwa pliku do a.download: nagłówek serwera, fallback gdy brak.
 * W pełni null-safe (testy vm z mockami res bez headers).
 */
function efServerFilename(res, fallback) {
    try {
        var headers = res && res.headers;
        var raw =
            headers && typeof headers.get === 'function'
                ? headers.get('Content-Disposition')
                : headers && typeof headers === 'object'
                  ? headers['content-disposition'] || headers['Content-Disposition']
                  : '';
        var parsed = efFromDisposition(raw);
        if (parsed) return parsed;
    } catch (_e) {
        /* fallback poniżej */
    }
    return fallback;
}

var ExportFilenames = {
    safePart: efSafePart,
    pickPart: efPickPart,
    filename: efFilename,
    fromDisposition: efFromDisposition,
    serverFilename: efServerFilename
};

if (typeof window !== 'undefined') {
    window.ExportFilenames = ExportFilenames;
}
