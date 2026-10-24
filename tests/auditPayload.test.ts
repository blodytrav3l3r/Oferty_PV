/**
 * Limit payloadu audytu — testy graniczne 65 536 / 65 537 B.
 * Kontrakt: poniżej/na granicy zapis bez zmian; powyżej koperta z markerem,
 * hash SHA-256 PEŁNEGO oryginału i rozmiarem oryginału.
 */
import crypto from 'node:crypto';
import {
    AUDIT_PAYLOAD_LIMIT_BYTES,
    AUDIT_TRUNCATED_FORMAT_VERSION,
    encodeAuditPayload,
    isTruncatedAuditPayload
} from '../src/services/auditPayload';

/** Buduje JSON o dokładnie `bytes` bajtach (klucz `s` wypełniony literą `a`). */
function payloadOfSize(bytes: number): string {
    const head = '{"s":"';
    const tail = '"}';
    const filler = bytes - head.length - tail.length;
    return head + 'a'.repeat(filler) + tail;
}

describe('encodeAuditPayload', () => {
    test('null i undefined → null (brak danych, nie "null" jako string)', () => {
        expect(encodeAuditPayload(null)).toBeNull();
        expect(encodeAuditPayload(undefined)).toBeNull();
    });

    test('mały obiekt → JSON bez markera skrócenia', () => {
        const json = encodeAuditPayload({ a: 1 });
        expect(json).toBe('{"a":1}');
        expect(isTruncatedAuditPayload(JSON.parse(json as string))).toBe(false);
    });

    test('65 536 B → zapis bez zmian (na granicy limitu)', () => {
        const original = payloadOfSize(AUDIT_PAYLOAD_LIMIT_BYTES);
        expect(Buffer.byteLength(original, 'utf8')).toBe(AUDIT_PAYLOAD_LIMIT_BYTES);

        const encoded = encodeAuditPayload(JSON.parse(original));

        expect(encoded).toBe(original);
        expect(Buffer.byteLength(encoded as string, 'utf8')).toBe(AUDIT_PAYLOAD_LIMIT_BYTES);
    });

    test('65 537 B → koperta skrócenia z hashem oryginału', () => {
        const original = payloadOfSize(AUDIT_PAYLOAD_LIMIT_BYTES + 1);
        expect(Buffer.byteLength(original, 'utf8')).toBe(AUDIT_PAYLOAD_LIMIT_BYTES + 1);

        const encoded = encodeAuditPayload(JSON.parse(original)) as string;
        const frame = JSON.parse(encoded);

        expect(isTruncatedAuditPayload(frame)).toBe(true);
        expect(frame._formatVersion).toBe(AUDIT_TRUNCATED_FORMAT_VERSION);
        expect(frame._originalBytes).toBe(AUDIT_PAYLOAD_LIMIT_BYTES + 1);
        expect(frame._payloadHash).toBe(
            crypto.createHash('sha256').update(original, 'utf8').digest('hex')
        );
        // Cała koperta respektuje limit, a preview jest początkiem oryginału.
        expect(Buffer.byteLength(encoded, 'utf8')).toBeLessThanOrEqual(AUDIT_PAYLOAD_LIMIT_BYTES);
        expect(frame._preview.length).toBeGreaterThan(0);
        expect(original.startsWith(frame._preview)).toBe(true);
    });

    test('duży payload z polskimi znakami → preview bez uszkodzonego UTF-8', () => {
        const big = { opis: 'z'.repeat(AUDIT_PAYLOAD_LIMIT_BYTES) + 'żółć', tab: [1, 2, 3] };
        const encoded = encodeAuditPayload(big) as string;
        const frame = JSON.parse(encoded);

        expect(isTruncatedAuditPayload(frame)).toBe(true);
        expect(frame._preview).not.toContain('\uFFFD');
        expect(Buffer.byteLength(encoded, 'utf8')).toBeLessThanOrEqual(AUDIT_PAYLOAD_LIMIT_BYTES);
        expect(frame._payloadHash).toBe(
            crypto.createHash('sha256').update(JSON.stringify(big), 'utf8').digest('hex')
        );
    });

    test('payload 34 MB (realny rozmiar z bazy) → koperta nadal ≤ 64 KB', () => {
        const wall = {
            wells: Array.from({ length: 200 }, (_, i) => ({ i, s: 'x'.repeat(17000) }))
        };
        const original = JSON.stringify(wall);
        expect(Buffer.byteLength(original, 'utf8')).toBeGreaterThan(3 * 1024 * 1024);

        const encoded = encodeAuditPayload(wall) as string;

        expect(Buffer.byteLength(encoded, 'utf8')).toBeLessThanOrEqual(AUDIT_PAYLOAD_LIMIT_BYTES);
        expect(JSON.parse(encoded)._originalBytes).toBe(Buffer.byteLength(original, 'utf8'));
    });
});
