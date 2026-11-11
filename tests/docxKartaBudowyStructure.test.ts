import JSZip from 'jszip';

const findStudnie = jest.fn();
const findRury = jest.fn();

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        orders_studnie_rel: { findUnique: (...args: unknown[]) => findStudnie(...args) },
        orders_rury_rel: { findUnique: (...args: unknown[]) => findRury(...args) }
    },
    Prisma: { empty: '', sql: () => '', raw: (s: string) => s, join: () => '' }
}));

jest.mock('../src/services/pricelist/catalog', () => ({
    getCatalogStudnieRows: jest.fn(async () => [])
}));

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

import { generateKartaBudowyDOCX } from '../src/services/docx/studnie/kartaBudowy';
import { generateKartaBudowyRuryDOCX } from '../src/services/docx/rury/kartaBudowy';
import { logger } from '../src/utils/logger';

const orderData = {
    orderNumber: 'ZAM/2026/11/9',
    offerNumber: 'OF/2026/11/3',
    kartaBudowy: {
        investName: 'Budowa domu — Osiedle Słoneczne',
        investPostalCode: '62-800',
        investCity: 'Kalisz',
        investStreet: 'ul. Wrocławska 12/4',
        kontaktyBudowa: [
            { name: 'Jan Kowalski', phone: '+48 600 100 200', email: 'jan@example.com' },
            { name: 'Anna Nowak', phone: '+48 601 300 400', email: 'anna@example.com' }
        ],
        kontaktZamawiajacy: [
            { name: 'Marek Wiśniewski', phone: '+48 602 500 600', email: 'marek@example.com' }
        ],
        clientNumber: 'KH-1042',
        clientName: 'Firma Kowalski sp. z o.o.',
        clientNip: '754-123-45-67',
        clientAddress: 'ul. Przemysłowa 4a, 62-800 Kalisz',
        warunkiPlatnosci: 'Przelew 30 dni',
        iloscDni: '30',
        rodzajTransportu: 'Transport własny',
        wyliczonyTransport: '1 250,00 zł',
        przejsciaDetails: [
            { rodzaj: 'szczelne', dnOd: 160, dnDo: 200, ilosc: 2, uwagi: 'izolacja' }
        ]
    }
};

const orderFixture = (data: unknown) => ({ id: 'order-1', data: JSON.stringify(data) });

async function documentXml(buffer: Buffer): Promise<string> {
    const zip = await JSZip.loadAsync(buffer);
    const file = zip.file('word/document.xml');
    if (!file) throw new Error('brak word/document.xml');
    return file.async('string');
}

/** Akapit zawierający podany tekst (bez rozwinięć XML). */
function paragraphWith(xml: string, text: string): string {
    const paragraphs = xml.split('</w:p>');
    const hit = paragraphs.find((p) => p.replace(/<[^>]+>/g, '').includes(text));
    if (!hit) throw new Error(`Brak akapitu z tekstem: ${text}`);
    return hit;
}

/** Wiersz tabeli zawierający podany tekst. */
function rowWith(xml: string, text: string): string {
    const rows = xml.split('</w:tr>');
    const hit = rows.find((r) => r.replace(/<[^>]+>/g, '').includes(text));
    if (!hit) throw new Error(`Brak wiersza z tekstem: ${text}`);
    return hit;
}

beforeEach(() => {
    jest.clearAllMocks();
});

describe('generateKartaBudowyDOCX (studnie)', () => {
    it('rzuca czytelny błąd, gdy zamówienie nie istnieje', async () => {
        findStudnie.mockResolvedValueOnce(null);
        await expect(generateKartaBudowyDOCX('brak')).rejects.toThrow(
            'Zamówienie studni nie znaleziona'
        );
    });

    it('toleruje uszkodzony JSON danych zamówienia', async () => {
        findStudnie.mockResolvedValueOnce({ id: 'order-1', data: '{nie-json' });

        const buffer = await generateKartaBudowyDOCX('order-1');

        expect(buffer.length).toBeGreaterThan(0);
        expect(logger.warn).toHaveBeenCalledWith(
            'DocxKartaBudowy',
            expect.stringContaining('Nie udało się sparsować'),
            expect.any(Error)
        );
    });

    it('tytuł i numer zamówienia są w jednym akapicie', async () => {
        findStudnie.mockResolvedValueOnce(orderFixture(orderData));

        const xml = await documentXml(await generateKartaBudowyDOCX('order-1'));
        const paragraph = paragraphWith(xml, 'KARTA BUDOWY').replace(/<[^>]+>/g, '');

        expect(paragraph).toContain('KARTA BUDOWY');
        expect(paragraph).toContain('Nr zamówienia: ZAM/2026/11/9');
    });

    it('kontakty budowy i nabywcy: jedna linia na osobę (3 kolumny)', async () => {
        findStudnie.mockResolvedValueOnce(orderFixture(orderData));

        const xml = await documentXml(await generateKartaBudowyDOCX('order-1'));

        for (const [name, phone, email] of [
            ['Jan Kowalski', '+48 600 100 200', 'jan@example.com'],
            ['Anna Nowak', '+48 601 300 400', 'anna@example.com'],
            ['Marek Wiśniewski', '+48 602 500 600', 'marek@example.com']
        ]) {
            const row = rowWith(xml, name);
            expect(row).toContain(phone);
            expect(row).toContain(email);
            expect((row.match(/<w:tc>/g) ?? []).length).toBe(3);
        }
    });

    it('dane nabywcy: NIP i adres w osobnych wierszach niż firma', async () => {
        findStudnie.mockResolvedValueOnce(orderFixture(orderData));

        const xml = await documentXml(await generateKartaBudowyDOCX('order-1'));

        const firma = rowWith(xml, 'Firma Kowalski');
        expect(firma).not.toContain('754-123-45-67');
        expect(firma).not.toContain('Przemysłowa 4a');

        const nip = rowWith(xml, '754-123-45-67');
        expect(nip).toContain('NIP');
        expect(nip).not.toContain('Przemysłowa 4a');

        const adres = rowWith(xml, 'Przemysłowa 4a');
        expect(adres).toContain('Adres firmy');
    });

    it('zachowuje kolejność sekcji karty', async () => {
        findStudnie.mockResolvedValueOnce(orderFixture(orderData));

        const xml = await documentXml(await generateKartaBudowyDOCX('order-1'));
        const text = xml.replace(/<[^>]+>/g, '');
        const sectionOrder = [
            'MIEJSCE BUDOWY / DOSTAWY',
            'OSOBY DO KONTAKTU',
            'DANE NABYWCY',
            'PODSTAWOWE INFORMACJE',
            'LOGISTYKA I PŁATNOŚCI',
            'STUDNIA I BETON',
            'KINETA I SPOCZNIK',
            'PRZEJŚCIA'
        ];
        const positions = sectionOrder.map((title) => {
            const idx = text.indexOf(title);
            expect(idx).toBeGreaterThanOrEqual(0);
            return idx;
        });
        expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    });

    it('tabela przejść pojawia się, gdy są szczegóły przejść', async () => {
        findStudnie.mockResolvedValueOnce(orderFixture(orderData));

        const xml = await documentXml(await generateKartaBudowyDOCX('order-1'));

        expect(xml).toContain('160');
        expect(xml).toContain('200');
        expect(xml).toContain('izolacja');
    });
});

describe('generateKartaBudowyRuryDOCX', () => {
    it('rzuca błąd, gdy zamówienie rur nie istnieje', async () => {
        findRury.mockResolvedValueOnce(null);
        await expect(generateKartaBudowyRuryDOCX('brak')).rejects.toThrow();
    });

    it('generuje dokument z tytułem i numerem zamówienia', async () => {
        findRury.mockResolvedValueOnce(orderFixture({ ...orderData, orderNumber: 'ZAM/R/1' }));

        const xml = await documentXml(await generateKartaBudowyRuryDOCX('order-1'));
        const paragraph = paragraphWith(xml, 'KARTA BUDOWY').replace(/<[^>]+>/g, '');

        expect(paragraph).toContain('KARTA BUDOWY');
        expect(paragraph).toContain('Nr zamówienia: ZAM/R/1');
    });
});
