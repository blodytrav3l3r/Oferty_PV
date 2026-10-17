// @ts-nocheck
// A3 security: eksport XLSX (studnie/import) — wartości z [= + - @] MUSZĄ zostać
// komórkami tekstowymi (brak elementu formuły <f>). Lock kontraktu: ścieżka FE
// (XLSX.utils.json_to_sheet) nie tworzy formuł → formula injection nie występuje.
// Brak ścieżki CSV w projekcie (zweryfikowane grepem po public/js + src).
import path from 'path';
import JSZip from 'jszip';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- vendored UMD (nie ESM)
const XLSX = require(path.join(__dirname, '../../public/vendor/xlsx.full.min.js'));

const PAYLOADS = [
    '=1+1',
    '=HYPERLINK("http://evil.example")',
    '+cmd|calc',
    '-2+3',
    '@SUM(A1:A2)',
    "=cmd|' /c calc'!A1"
];

function buildBase64() {
    const rows = PAYLOADS.map((v, i) => ({ idx: i, wartosc: v }));
    const ws = XLSX.utils.json_to_sheet(rows, { header: ['idx', 'wartosc'] });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Import');
    return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
}

describe('FE eksport XLSX — brak formuł (formula injection NIE dotyczy)', () => {
    it('wartości z [= + - @] pozostają komórkami tekstowymi bez .f', () => {
        const wb = XLSX.read(buildBase64(), { type: 'base64' });
        const sheet = wb.Sheets.Import;
        PAYLOADS.forEach((p, i) => {
            const ref = XLSX.utils.encode_cell({ r: i + 1, c: 1 });
            const cell = sheet[ref];
            expect(cell).toBeDefined();
            expect(cell.t).toBe('s');
            expect(cell.f).toBeUndefined();
            expect(cell.v).toBe(p);
        });
    });

    it('surowy XML arkusza nie zawiera elementu formuły <f>', async () => {
        const zip = await JSZip.loadAsync(buildBase64(), { base64: true });
        const xml = await zip.file('xl/worksheets/sheet1.xml').async('string');
        expect(xml).not.toContain('<f>');
        expect(xml).not.toContain('<f ');
    });
});
