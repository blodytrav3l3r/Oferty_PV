// @ts-nocheck
/* =============================================================
   Parzystość frontendowego exportFilenames.js z backendowym SSoT.
   Te same wektory (tests/exportFilenameVectors.json) + parsowanie
   Content-Disposition (tylko frontend).
   ============================================================= */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const vectors = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'exportFilenameVectors.json'), 'utf8')
);

function loadEF() {
    const code = fs.readFileSync(
        path.join(__dirname, '..', '..', 'public', 'js', 'shared', 'exportFilenames.js'),
        'utf8'
    );
    const sandbox = { window: {} };
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox, { filename: 'exportFilenames.js' });
    return sandbox.window.ExportFilenames;
}

describe('exportFilenames parity (frontend lustro backendu)', () => {
    test('moduł rejestruje się na window bez DOM', () => {
        const EF = loadEF();
        expect(EF).toBeDefined();
        expect(typeof EF.filename).toBe('function');
        expect(typeof EF.serverFilename).toBe('function');
    });

    test.each(vectors.safePart.map((v) => [v.in, v.out]))(
        'safePart(%p) → %p',
        (input, expected) => {
            expect(loadEF().safePart(input)).toBe(expected);
        }
    );

    test.each(vectors.pickPart.map((v) => [v.in, v.out]))(
        'pickPart(%p) → %p',
        (input, expected) => {
            expect(loadEF().pickPart(input)).toBe(expected);
        }
    );

    test.each(vectors.filename.map((v) => [v.kind, v.parts, v.ext, v.out]))(
        'filename(%s) → %s',
        (kind, parts, ext, expected) => {
            expect(loadEF().filename(kind, parts, ext)).toBe(expected);
        }
    );

    test('fromDisposition: nagłówek serwera → nazwa', () => {
        const EF = loadEF();
        expect(EF.fromDisposition('attachment; filename="oferta_laczna_a_b.pdf"')).toBe(
            'oferta_laczna_a_b.pdf'
        );
        expect(EF.fromDisposition('attachment; filename=oferta_x.pdf')).toBe('oferta_x.pdf');
        expect(EF.fromDisposition('')).toBe('');
        expect(EF.fromDisposition(null)).toBe('');
        expect(EF.fromDisposition('attachment; filename="a\r\nb.pdf"')).toBe('');
    });

    test('serverFilename: nagłówek wygrywa, fallback gdy brak', () => {
        const EF = loadEF();
        const withHeader = { headers: { get: () => 'attachment; filename="oferta_x.pdf"' } };
        expect(EF.serverFilename(withHeader, 'fallback.pdf')).toBe('oferta_x.pdf');
        expect(EF.serverFilename({ headers: { get: () => null } }, 'fallback.pdf')).toBe(
            'fallback.pdf'
        );
        expect(EF.serverFilename({}, 'fallback.pdf')).toBe('fallback.pdf');
        expect(EF.serverFilename(null, 'fallback.pdf')).toBe('fallback.pdf');
    });
});
