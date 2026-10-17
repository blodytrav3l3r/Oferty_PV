// Kontrakt: paste-create nie może CICHO gubić wierszy bez nazwy.
// Wiersz bez nazwy nie powstaje jako studnia, ale musi być zaraportowany
// (licznik + toast). Regresja: branch `if (!name) return;` bez raportu.
import fs from 'fs';
import path from 'path';

const src = fs.readFileSync(
    path.join(__dirname, '../../public/js/studnie/excelTableManager.js'),
    'utf8'
);

describe('excel paste-create: wiersze bez nazwy są raportowane (nie cichy drop)', () => {
    const fnPos = src.indexOf('function _excelPasteCreateWells(text) {');
    expect(fnPos).toBeGreaterThan(-1);
    const body = src.slice(fnPos);

    it('licznik skipped istnieje i rośnie w branchu bez nazwy', () => {
        const forEachPos = body.indexOf('parsed.forEach(function (row) {');
        expect(forEachPos).toBeGreaterThan(-1);
        const afterForEach = body.slice(forEachPos);
        const branchEnd = afterForEach.indexOf('// DN z danych steruje');
        expect(branchEnd).toBeGreaterThan(-1);
        const branch = afterForEach.slice(0, branchEnd);
        expect(branch).toContain('skipped++');
        expect(branch).not.toMatch(/if \(!name\)\s*return;/);
    });

    it('skipped jest raportowane tostem (pełny i częściowy drop)', () => {
        expect(body).toContain('let skipped = 0;');
        expect(body).toContain('wierszy bez nazwy studni');
        const occurrences = body.split('wierszy bez nazwy studni').length - 1;
        expect(occurrences).toBeGreaterThanOrEqual(2);
    });
});
