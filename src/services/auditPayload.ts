/**
 * Limit rozmiaru payloadu wpisu audytu — SSoT dla wszystkich writerów `audit_logs`.
 *
 * Powód: pełne snapshoty ofert i zamówień sięgały 34 MB na wiersz (tabela 1,27 GB).
 * Reguła:
 *  - do 64 KB  → zapis bez zmian (format legacy, czytelny dla dotychczasowych odbiorców),
 *  - powyżej   → koperta z markerem skrócenia, hash SHA-256 PEŁNEGO oryginału
 *                (liczony przed skróceniem) i czytelnym preview.
 *
 * Historia już zapisana w bazie nie jest modyfikowana — limit działa tylko na zapisie.
 */
import crypto from 'crypto';

export const AUDIT_PAYLOAD_LIMIT_BYTES = 64 * 1024;
export const AUDIT_TRUNCATED_FORMAT_VERSION = 1;

export interface TruncatedAuditPayload {
    _auditTruncated: true;
    _formatVersion: number;
    _originalBytes: number;
    _payloadHash: string;
    _preview: string;
}

/** Czy sparsowany payload to koperta skrócenia (nie da się z niej odtworzyć danych). */
export function isTruncatedAuditPayload(value: unknown): value is TruncatedAuditPayload {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    return (value as Record<string, unknown>)._auditTruncated === true;
}

/** Tnie UTF-8 po bajtach, ale nie zostawia połówki znaku wielobajtowego. */
function sliceUtf8Safe(text: string, maxBytes: number): string {
    if (maxBytes <= 0) return '';
    const buf = Buffer.from(text, 'utf8');
    if (buf.length <= maxBytes) return text;
    return buf
        .subarray(0, maxBytes)
        .toString('utf8')
        .replace(/\uFFFD+$/, '');
}

/**
 * Serializuje payload audytu z limitem rozmiaru.
 * Zwraca `null` dla braku danych (tak jak dotychczasowy `JSON.stringify` na null).
 */
export function encodeAuditPayload(value: unknown): string | null {
    if (value === null || value === undefined) return null;

    const json = JSON.stringify(value);
    const bytes = Buffer.byteLength(json, 'utf8');
    if (bytes <= AUDIT_PAYLOAD_LIMIT_BYTES) return json;

    const frame: TruncatedAuditPayload = {
        _auditTruncated: true,
        _formatVersion: AUDIT_TRUNCATED_FORMAT_VERSION,
        _originalBytes: bytes,
        _payloadHash: crypto.createHash('sha256').update(json, 'utf8').digest('hex'),
        _preview: ''
    };

    let room = AUDIT_PAYLOAD_LIMIT_BYTES - Buffer.byteLength(JSON.stringify(frame), 'utf8');
    while (room > 0) {
        frame._preview = sliceUtf8Safe(json, room);
        const encoded = JSON.stringify(frame);
        if (Buffer.byteLength(encoded, 'utf8') <= AUDIT_PAYLOAD_LIMIT_BYTES) return encoded;
        // Escapowanie w JSON powiększa preview — zmniejszamy i próbujemy ponownie.
        room = Math.floor(room * 0.9);
    }
    // Sam marker (bez preview) mieści się w limicie zawsze.
    frame._preview = '';
    return JSON.stringify(frame);
}
