import fs from 'fs';
import path from 'path';

describe('kartaBudowy coverage: pdf/docx templates', () => {
    it('pdf/kartaBudowy.ts eksportuje generateKartaBudowyPDF', () => {
        const p = path.join(process.cwd(), 'src/services/pdf/kartaBudowy.ts');
        const c = fs.readFileSync(p, 'utf-8');
        expect(c).toMatch(/export async function generateKartaBudowyPDF/);
        expect(c).toMatch(/export async function generateKartaBudowyRuryPDF/);
        expect(c).toMatch(/buildKartaBudowyBaseHtml/);
    });
    it('docx studnie/kartaBudowy.ts ma builder', () => {
        const p = path.join(process.cwd(), 'src/services/docx/studnie/kartaBudowy.ts');
        const c = fs.readFileSync(p, 'utf-8');
        expect(c.length).toBeGreaterThan(500);
        expect(c).toMatch(/KartaBudowy/);
    });
    it('docx rury/kartaBudowy.ts ma builder', () => {
        const p = path.join(process.cwd(), 'src/services/docx/rury/kartaBudowy.ts');
        const c = fs.readFileSync(p, 'utf-8');
        expect(c.length).toBeGreaterThan(500);
    });
    it('docx rury/builder.ts i sections.ts istnieją', () => {
        expect(fs.existsSync(path.join(process.cwd(), 'src/services/docx/rury/builder.ts'))).toBe(
            true
        );
        expect(fs.existsSync(path.join(process.cwd(), 'src/services/docx/rury/sections.ts'))).toBe(
            true
        );
    });
});
