/* ===== exportFilenames.test.ts — unit SSoT nazw plików (backend) =====
 *
 * Wektory z tests/exportFilenameVectors.json — ten sam plik czyta test
 * parzystości frontendu (tests/frontend/exportFilenamesParity.test.ts).
 */
import vectors from './exportFilenameVectors.json';
import {
    safeExportPart,
    pickNamePart,
    exportFilename,
    versionExportFilename
} from '../src/utils/exportFilenames';

describe('exportFilenames (backend SSoT)', () => {
    test.each(vectors.safePart.map((v) => [v.in, v.out]))(
        'safeExportPart(%p) → %p',
        (input: unknown, expected: string) => {
            expect(safeExportPart(input)).toBe(expected);
        }
    );

    test.each(vectors.pickPart.map((v) => [v.in, v.out]))(
        'pickNamePart(%p) → %p',
        (input: unknown[], expected: string) => {
            expect(pickNamePart(input)).toBe(expected);
        }
    );

    test.each(
        vectors.filename.map(
            (v) => [v.kind, v.parts, v.ext, v.out] as [string, unknown[][], string, string]
        )
    )('exportFilename(%s) → %s', (kind, parts, ext, expected) => {
        expect(exportFilename(kind, parts, ext)).toBe(expected);
    });

    test('limit 80 znaków na człon + trim końcówek', () => {
        const long = 'x'.repeat(100);
        expect(safeExportPart(long)).toBe('x'.repeat(80));
        expect(safeExportPart(long + '___')).toBe('x'.repeat(80));
    });

    test('rozszerzenie sanityzowane (bez kropki, lowercase, cap)', () => {
        expect(exportFilename('oferta_rury', [['OF/1']], 'PDF')).toBe('oferta_rury_OF-1.pdf');
        expect(exportFilename('oferta_rury', [['OF/1']], '.pdf')).toBe('oferta_rury_OF-1.pdf');
    });

    test.each(
        (vectors.versionFilename as { type: string; version: string; out: string }[]).map((v) => [
            v.type,
            v.version,
            v.out
        ])
    )('versionExportFilename(%p, %p) → %p', (type: string, version: string, expected: string) => {
        expect(versionExportFilename(type, version)).toBe(expected);
    });

    test('versionExportFilename: nigdy separator/CRLF/cudzysłów/pusty', () => {
        const long = 'x'.repeat(100);
        const cases: [string, string][] = [
            ['rury', 'v3'],
            ['../', '../../etc'],
            ['..\\..', '..\\evil'],
            ['a/b\\c', 'v"1"\r\nevil'],
            ['.', '..'],
            ['', ''],
            [long, 'v1'],
            ['rury', 'Zażółć gęślą jaźń'],
            ['rury', '"a\r\nb"'],
            ['evil"type', 'v1']
        ];
        for (const [t, v] of cases) {
            const out = versionExportFilename(t, v);
            expect(out.length).toBeGreaterThan(0);
            expect(out).not.toMatch(/[/\\]/);
            expect(out).not.toMatch(/["\r\n]/);
            expect(out).toMatch(/^Cennik_.+_Export\.xlsx$/);
        }
        expect(versionExportFilename('rury', 'v3')).toBe('Cennik_Rury_v3_Export.xlsx');
    });
});
