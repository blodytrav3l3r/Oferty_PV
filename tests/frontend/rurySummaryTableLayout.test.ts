import fs from 'fs';
import path from 'path';

// Regresja audytu 2026-10-19 (#16): zepsuty markup nagłówka tabeli
// („<th scope=\"col\"ead>" zamiast "<thead>") + undefined klasa i mieszane
// wyrównanie kolumn w tabeli podsumowania oferty (rury).

function walkJs(dir: string, acc: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walkJs(full, acc);
        else if (entry.name.endsWith('.js')) acc.push(full);
    }
    return acc;
}

describe('frontend: tabela podsumowania oferty (rury) — markup i wyrównanie', () => {
    const tabSrc = fs.readFileSync(
        path.join(process.cwd(), 'public/js/rury/offerSummaryTab.js'),
        'utf-8'
    );
    const css = fs.readFileSync(path.join(process.cwd(), 'public/css/rury.css'), 'utf-8');

    it('brak zepsutego nagłówka <thead> w public/js', () => {
        const offenders = walkJs(path.join(process.cwd(), 'public/js')).filter((f) =>
            fs.readFileSync(f, 'utf-8').includes('col"ead')
        );
        expect(offenders).toEqual([]);
    });

    it('tabela ma poprawny <thead> i klasę offer-summary-table', () => {
        expect(tabSrc).toContain('<table class="offer-summary-table"');
        expect(tabSrc).toMatch(/<thead>\s*<tr>/);
        expect(tabSrc).toContain('</thead>');
    });

    it('brak martwej klasy text-secondary-nowrap i inline text-align:right', () => {
        expect(tabSrc).not.toContain('text-secondary-nowrap');
        expect(tabSrc).not.toContain('text-align:right');
    });

    it('CSS wyśrodkowuje kolumny tabeli', () => {
        expect(css).toMatch(
            /\.offer-summary-table th,\s*\.offer-summary-table td\s*\{\s*text-align:\s*center;/
        );
    });
});
