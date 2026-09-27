import {
    serializeSnapshot,
    deserializeSnapshot,
    isVersionedSnapshot,
    UnknownSnapshotVersionError,
    SNAPSHOT_SCHEMA_VERSION
} from '../src/utils/snapshots';

/**
 * P1.5: kontrakt koperty {schemaVersion, data} + kompatybilność legacy.
 */
describe('P1.5 versioned snapshots', () => {
    it('round-trip koperty v1', () => {
        const raw = serializeSnapshot({ a: 1, items: [1, 2] });
        expect(isVersionedSnapshot(JSON.parse(raw))).toBe(true);
        expect(deserializeSnapshot<{ a: number }>(raw)).toEqual({ a: 1, items: [1, 2] });
    });

    it('legacy JSON bez koperty przechodzi bez zmian', () => {
        expect(deserializeSnapshot('{"a":1}')).toEqual({ a: 1 });
        expect(deserializeSnapshot('[1,2]')).toEqual([1, 2]);
        expect(deserializeSnapshot('"x"')).toBe('x');
    });

    it('null/pusty -> null', () => {
        expect(deserializeSnapshot(null)).toBeNull();
        expect(deserializeSnapshot(undefined)).toBeNull();
        expect(deserializeSnapshot('')).toBeNull();
    });

    it('nie-JSON -> kontrolowany wyjątek (nie silent)', () => {
        expect(() => deserializeSnapshot('nie json{')).toThrow(SyntaxError);
    });

    it('nieznana wersja -> UnknownSnapshotVersionError', () => {
        const raw = JSON.stringify({ schemaVersion: 999, data: { a: 1 } });
        expect(() => deserializeSnapshot(raw)).toThrow(UnknownSnapshotVersionError);
    });

    it('aktualna wersja to 1', () => {
        expect(SNAPSHOT_SCHEMA_VERSION).toBe(1);
    });
});
