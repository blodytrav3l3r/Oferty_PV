import fs from 'fs';
import { loadPdfTemplate, clearPdfTemplateCache } from '../src/services/pdf/templateCache';
import { loadLetterheadBase64, clearLetterheadCache } from '../src/services/pdf/letterhead';

jest.mock('fs', () => ({
    readFileSync: jest.fn(),
    existsSync: jest.fn(() => true)
}));

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() }
}));

const readMock = fs.readFileSync as jest.Mock;

describe('P2 cache szablonów PDF', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        clearPdfTemplateCache();
        clearLetterheadCache();
    });

    test('drugi odczyt tego samego szablonu nie tyka fs', () => {
        readMock.mockReturnValue('szablon {{PRINT_TOKENS}}');
        const a = loadPdfTemplate('/tpl/ofertaRury.html');
        const b = loadPdfTemplate('/tpl/ofertaRury.html');
        expect(a).toBe(b);
        expect(a).not.toContain('{{PRINT_TOKENS}}');
        expect(readMock).toHaveBeenCalledTimes(1);
    });

    test('różne ścieżki to osobne wpisy', () => {
        readMock.mockImplementation((p: string) => `tpl:${p}`);
        loadPdfTemplate('/tpl/a.html');
        loadPdfTemplate('/tpl/b.html');
        expect(readMock).toHaveBeenCalledTimes(2);
    });

    test('brak pliku dalej rzuca z nazwą szablonu', () => {
        readMock.mockImplementation(() => {
            throw new Error('ENOENT');
        });
        expect(() => loadPdfTemplate('/tpl/brak.html')).toThrow('/tpl/brak.html');
    });

    test('letterhead: PNG czytane raz na proces', () => {
        readMock.mockReturnValue(Buffer.from('png'));
        const a = loadLetterheadBase64();
        const b = loadLetterheadBase64();
        expect(a.header).toBe(b.header);
        expect(a.header).toMatch(/^data:image\/png;base64,/);
        expect(readMock).toHaveBeenCalledTimes(2);
    });
});
