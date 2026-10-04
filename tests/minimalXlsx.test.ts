/**
 * minimalXlsx — unit buildera XLSX (pokrycie ogona 20%).
 * Bez nowych zależności: weryfikacja przez jszip (już w projekcie).
 */
import JSZip from 'jszip';
import { sanitizeSheetName, buildXlsx } from '../src/utils/minimalXlsx';

describe('sanitizeSheetName', () => {
    it('czyści znaki zakazane Excela', () => {
        expect(sanitizeSheetName('a/b\\c:d?e*f[g]')).toBe('a_b_c_d_e_f_g_');
    });

    it('tnie do 31 znaków; pusty → Arkusz', () => {
        expect(sanitizeSheetName('x'.repeat(40))).toBe('x'.repeat(31));
        expect(sanitizeSheetName('')).toBe('Arkusz');
    });

    it('polskie znaki przechodzą bez zmian', () => {
        expect(sanitizeSheetName('Zażółć — studnie MEA')).toBe('Zażółć — studnie MEA');
    });
});

describe('buildXlsx', () => {
    it('buduje odczytywalny zip z nagłówkiem i wierszami', async () => {
        const buf = await buildXlsx([
            { name: 'Cennik', headers: ['Nazwa', 'Cena'], rows: [['Rura DN110', 12.5]] }
        ]);
        const zip = await JSZip.loadAsync(buf);
        expect(zip.file('xl/worksheets/sheet1.xml')).not.toBeNull();
        const xml = await zip.file('xl/worksheets/sheet1.xml')!.async('string');
        expect(xml).toContain('Rura DN110');
        expect(xml).toContain('12.5');
    });

    it('escapuje XML w nagłówkach (XSS-safe eksport)', async () => {
        const buf = await buildXlsx([
            { name: 'T', headers: ['<script>alert(1)</script>'], rows: [[null]] }
        ]);
        const zip = await JSZip.loadAsync(buf);
        const xml = await zip.file('xl/worksheets/sheet1.xml')!.async('string');
        expect(xml).not.toContain('<script>');
        expect(xml).toContain('&lt;script&gt;');
    });

    it('wiele arkuszy → wiele plików sheet', async () => {
        const buf = await buildXlsx([
            { name: 'A', headers: ['h'], rows: [] },
            { name: 'B', headers: ['h'], rows: [] }
        ]);
        const zip = await JSZip.loadAsync(buf);
        expect(zip.file('xl/worksheets/sheet1.xml')).not.toBeNull();
        expect(zip.file('xl/worksheets/sheet2.xml')).not.toBeNull();
    });
});
