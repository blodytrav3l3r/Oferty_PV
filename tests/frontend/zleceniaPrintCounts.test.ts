/**
 * Testy warstwy renderu liczników wydruków — public/js/spa/zleceniaRender.js
 * (vm pattern, wzorzec tests/frontend/ruryProductHelpers.test.ts).
 * Pokrywa renderPrintCounts i updatePrintCells: wartości, stany zerowe,
 * tytuły z datami, odporność na złe typy (XSS/NaN-safe).
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

function escapeHtmlStub(s: unknown): string {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function escapeJsStrStub(s: unknown): string {
    return String(s ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'");
}

function loadZleceniaRender(
    docStub: { querySelector: jest.Mock },
    lucideStub: { createIcons: jest.Mock }
) {
    const file = path.join(process.cwd(), 'public/js/spa/zleceniaRender.js');
    const sandbox = {
        window: {
            formatDate: (iso: string) => 'DATA(' + iso + ')',
            escapeHtml: escapeHtmlStub,
            escapeJsStr: escapeJsStrStub
        },
        document: docStub,
        lucide: lucideStub,
        console
    };
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(file, 'utf-8'), sandbox, { filename: 'zleceniaRender.js' });
    return (sandbox.window as unknown as { zleceniaRender: ZleceniaRenderApi }).zleceniaRender;
}

interface ZleceniaRenderApi {
    renderPrintCounts(o: Record<string, unknown>): string;
    updatePrintCells(items: Array<Record<string, unknown>>): void;
}

describe('frontend vm: zleceniaRender.printCounts', () => {
    const querySelector = jest.fn();
    const createIcons = jest.fn();
    const render = loadZleceniaRender({ querySelector }, { createIcons });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('zero: muted badge i tytuły o braku potwierdzeń', () => {
        const html = render.renderPrintCounts({});
        expect(html).toContain('print-badge-zero');
        expect(html).toContain('0x');
        expect(html).toContain('brak potwierdzeń');
        expect(html).not.toContain('print-badge-z"');
        expect(html).not.toContain('print-badge-e"');
    });

    it('wartości: aktywne klasy i daty w tytułach', () => {
        const html = render.renderPrintCounts({
            printCountZlecenia: 3,
            printCountEtykieta: 1,
            printLastZleceniaAt: '2026-09-18T10:00:00.000Z',
            printLastEtykietaAt: '2026-09-18T11:00:00.000Z'
        });
        expect(html).toContain('print-badge-z');
        expect(html).toContain('print-badge-e');
        expect(html).toContain('3x');
        expect(html).toContain('1x');
        expect(html).toContain('Potwierdzone uruchomienia wydruku zlecenia: 3');
        expect(html).toContain('DATA(2026-09-18T10:00:00.000Z)');
        expect(html).toContain('Potwierdzone uruchomienia wydruku etykiety: 1');
    });

    it('złe typy nie wstrzykują HTML i sprowadzają się do 0', () => {
        const html = render.renderPrintCounts({
            printCountZlecenia: '5<script>alert(1)</script>',
            printCountEtykieta: -2,
            printLastZleceniaAt: '"><img src=x onerror=alert(1)>'
        });
        expect(html).not.toContain('<script>');
        expect(html).not.toContain('<img');
        expect(html).toContain('0x');
        // data przechodzi przez escapeHtml w title
        expect(html).toContain('&quot;&gt;&lt;img');
    });

    it('updatePrintCells: aktualizuje komórkę i woła lucide z wąskim rootem', () => {
        const cell = { innerHTML: '' };
        querySelector.mockReturnValue(cell);
        render.updatePrintCells([{ id: 'pz-1', printCountZlecenia: 2 }]);
        expect(querySelector).toHaveBeenCalledWith('td[data-print-for="pz-1"]');
        expect(cell.innerHTML).toContain('2x');
        expect(createIcons).toHaveBeenCalledWith({ root: cell });
    });

    it('updatePrintCells: brak komórki i puste wejście nie rzucają', () => {
        querySelector.mockReturnValue(null);
        expect(() => render.updatePrintCells([{ id: 'pz-x' }])).not.toThrow();
        expect(() => render.updatePrintCells([])).not.toThrow();
        expect(() => render.updatePrintCells(null as unknown as [])).not.toThrow();
    });
});
