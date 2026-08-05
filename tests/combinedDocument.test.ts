import fs from 'fs';
import { Packer } from 'docx';
import JSZip from 'jszip';
import { buildCombinedDocument } from '../src/services/docx/combined';
import { generateCombinedHTML } from '../src/services/pdf/combinedHtml';
import type { RuryOfferData, StudnieOfferData } from '../src/services/pdf/types';
import prisma from '../src/prismaClient';

jest.mock('fs', () => ({
    readFileSync: jest.fn()
}));

jest.mock('puppeteer', () => ({
    launch: jest.fn().mockResolvedValue({
        newPage: jest.fn().mockResolvedValue({
            setContent: jest.fn(),
            pdf: jest.fn().mockResolvedValue(Buffer.from('mock-pdf'))
        }),
        close: jest.fn()
    })
}));

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() }
}));

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        offers_rel: { findUnique: jest.fn() },
        offer_items_rel: { findMany: jest.fn() },
        offers_studnie_rel: { findUnique: jest.fn() },
        clients_rel: { findUnique: jest.fn() },
        users: { findUnique: jest.fn() },
        productsRury: { findMany: jest.fn() }
    }
}));

const mockRuryOffer = {
    id: 'r1',
    offer_number: 'R/1',
    userId: 'u1',
    data: JSON.stringify({
        notes: 'Parametry techniczne: Rury betonowe kielichowe, Klasa betonu: C40/50, Uszczelka: EPDM\n\nCena franco budowa bez rozładunku przy dostawie pełnych transportów 24t.'
    })
};
const mockStudnieOffer = {
    id: 's1',
    offer_number: 'S/1',
    userId: 'u1',
    data: JSON.stringify({
        wellsExport: [
            {
                name: 'Studnia DN1000',
                dn: '1000',
                height: 1500,
                zwienczenie: 'Wlaz',
                price: 2000,
                totalPrice: 2000
            }
        ],
        paymentTerms: 'Przelew 14 dni',
        notes: 'Uwaga testowa\n\nParametry techniczne: Nadbudowa i Dennica: Beton, Klasa betonu: C40/50, Agresja chemiczna: XA1, Agresja mrozowa: XF1, Kineta: Beton, Rodzaj stopni: Drabinka, Uszczelka: SDV, Przyłącza dostudzienne: PVC SN8.\n\nCena franco budowa bez rozładunku przy dostawie pełnych transportów 24t.',
        investContractor: 'Firma budowlana'
    })
};
const mockClient = { id: 'c1', name: 'Firma Test', nip: '1234567890', address: 'Ul. Testowa 1' };
const mockItems = [
    {
        name: 'Rura DN300',
        productId: 'P-300-2-1',
        unitPrice: 100,
        quantity: 2,
        lengthM: 1000
    }
];

/** Serdełizuje Document do XML głównej części (word/document.xml). */
async function docxXml(doc: unknown): Promise<string> {
    const buf = await Packer.toBuffer(doc as Parameters<typeof Packer.toBuffer>[0]);
    const zip = await JSZip.loadAsync(buf);
    const file = zip.file('word/document.xml');
    if (!file) throw new Error('brak word/document.xml w DOCX');
    return file.async('string');
}

const countText = (haystack: string, needle: string): number => haystack.split(needle).length - 1;

describe('Wydruk łączny — spójny dokument', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (fs.readFileSync as jest.Mock).mockImplementation((p: string) =>
            p.includes('.png') ? Buffer.from('fake-image') : 'TEMPLATE'
        );
        (prisma.offers_rel.findUnique as jest.Mock).mockResolvedValue(mockRuryOffer);
        (prisma.offer_items_rel.findMany as jest.Mock).mockResolvedValue(mockItems);
        (prisma.offers_studnie_rel.findUnique as jest.Mock).mockResolvedValue(mockStudnieOffer);
        (prisma.clients_rel.findUnique as jest.Mock).mockResolvedValue(mockClient);
        (prisma.users.findUnique as jest.Mock).mockResolvedValue(null);
        (prisma.productsRury.findMany as jest.Mock).mockResolvedValue([
            { id: 'P-300-2-1', category: 'Rury Betonowe' }
        ]);
    });

    describe('DOCX — buildCombinedDocument', () => {
        it('składa JEDNĄ sekcję ze wspólnym tytułem i warunkami występującymi raz', async () => {
            const doc = await buildCombinedDocument('r1', 's1');
            const xml = await docxXml(doc);

            // Jedna sekcja (jeden <w:sectPr> w body)
            const body = xml.match(/<w:body>([\s\S]*?)<\/w:body>/)?.[1] ?? '';
            expect(body.split('<w:sectPr').length - 1).toBe(1);

            // Wspólny tytuł (raz), bez osobnych tytułów ofert
            expect(countText(xml, 'OFERTA HANDLOWA')).toBe(1);
            expect(xml).toContain('OFERTA HANDLOWA S/1 + R/1');

            // Sekcje studni i rur obecne
            expect(xml).toContain('Studnia DN1000');
            expect(xml).toContain('Rura DN300');

            // Kategoria rur pobrana z bazy (nie "Inne")
            expect(xml).toContain('Rury Betonowe');
            expect(xml).not.toContain('>Inne</w:t>');

            // Bez nagłówka "Parametry techniczne studni"
            expect(xml).not.toContain('Parametry techniczne studni');

            // Parametry techniczne studni i rur w obu sekcjach (po jednym bloku)
            expect(countText(xml, 'Parametry techniczne:')).toBe(2);

            // Cena franco występuje raz w uwagach studni i raz w uwagach rur (jak w polach "Uwagi do oferty")
            expect(countText(xml, 'Cena franco budowa bez rozładunku')).toBe(2);

            // Kolejność: tabela studni → podsumowanie studni → uwagi studni → tabela rur → podsumowanie rur → uwagi rur → suma łączna
            const iWell = xml.indexOf('Studnia DN1000');
            const iWellSum = xml.indexOf('RAZEM NETTO');
            const iParams = xml.indexOf('Parametry techniczne:');
            const iPipe = xml.indexOf('Rura DN300');
            const iRurSum = xml.indexOf('SUMA NETTO');
            const iRurParams = xml.indexOf('Parametry techniczne: Rury betonowe');
            const iCombined = xml.indexOf('RAZEM NETTO (studnie + rury)');
            expect(iWell).toBeGreaterThan(-1);
            expect(iWellSum).toBeGreaterThan(iWell);
            expect(iParams).toBeGreaterThan(iWellSum);
            expect(iPipe).toBeGreaterThan(iParams);
            expect(iRurSum).toBeGreaterThan(iPipe);
            expect(iRurParams).toBeGreaterThan(iRurSum);
            expect(iCombined).toBeGreaterThan(iRurParams);

            // Warunki płatności pod podsumowaniem łącznym
            const iPay = xml.indexOf('Warunki płatności:');
            expect(iPay).toBeGreaterThan(iCombined);

            // Zbiorcze RAZEM NETTO (2000 + 200 = 2200)
            expect(countText(xml, 'RAZEM NETTO (studnie + rury)')).toBe(1);
            expect(xml).toContain('2200,00');

            // Warunki płatności i statyczne warunki handlowe tylko raz
            expect(countText(xml, 'Warunki płatności:')).toBe(1);
            expect(countText(xml, 'Informacje dodatkowe i ogólne warunki:')).toBe(1);
        });
    });

    describe('PDF — generateCombinedHTML', () => {
        const studnieData: StudnieOfferData = {
            offerNumber: 'S/1',
            clientName: 'Firma Test',
            clientNip: '1234567890',
            clientAddress: 'Ul. Testowa 1',
            clientPhone: '123456789',
            investName: 'Budowa 1',
            investAddress: 'Adres budowy',
            investContractor: 'Firma budowlana',
            items: [
                {
                    productName: 'Studnia DN1000',
                    DN: '1000',
                    height: 1500,
                    zwienczenie: 'Wlaz',
                    price: 2000
                }
            ],
            transportCost: 0,
            createdAt: '2026-01-01',
            validityDays: 30,
            notes: 'Uwaga testowa\n\nParametry techniczne: Nadbudowa i Dennica: Beton, Klasa betonu: C40/50, Agresja chemiczna: XA1, Agresja mrozowa: XF1, Kineta: Beton, Rodzaj stopni: Drabinka, Uszczelka: SDV, Przyłącza dostudzienne: PVC SN8.\n\nCena franco budowa bez rozładunku przy dostawie pełnych transportów 24t.',
            paymentTerms: 'Przelew 14 dni'
        };
        const ruryData: RuryOfferData = {
            offerNumber: 'R/1',
            clientName: 'Firma Test',
            clientNip: '',
            clientAddress: '',
            clientPhone: '',
            investName: '',
            investAddress: '',
            investContractor: '',
            items: [
                {
                    name: 'Rura DN300',
                    productId: 'P-300-2-1',
                    category: 'Rury Betonowe',
                    unitPrice: 100,
                    quantity: 2,
                    lengthM: 1000
                }
            ],
            createdAt: '2026-01-01',
            validityDays: 30,
            notes: 'Parametry techniczne: Rury betonowe kielichowe, Klasa betonu: C40/50, Uszczelka: EPDM\n\nCena franco budowa bez rozładunku przy dostawie pełnych transportów 24t.',
            paymentTerms: ''
        };

        it('generuje JEDEN dokument ze wspólnym tytułem, obiema sekcjami i warunkami raz', async () => {
            const TEMPLATE = [
                '<html><head><style>{{PRINT_TOKENS}}</style></head><body>',
                '<div class="offer-title">{{TYTUL_DOKUMENTU}}</div>',
                '{{VALIDITY_SECTION}} {{DANE_KLIENTA}} {{DANE_INWESTYCJI}}',
                '{{TABELE_DN}} {{TABELA_RUR}} {{PODSUMOWANIE}} {{SEKCJA_UWAGI}}',
                '<div class="standard-terms">Informacje dodatkowe i ogólne warunki: warunki handlowe</div>',
                '{{DANE_KONTAKTOWE}}',
                '{{BASE_URL}}/images/letterhead-header.png {{BASE_URL}}/images/letterhead-footer.png',
                '</body></html>'
            ].join('\n');
            (fs.readFileSync as jest.Mock).mockImplementation((p: string) =>
                p.includes('.png') ? Buffer.from('fake-image') : TEMPLATE
            );

            const html = await generateCombinedHTML(studnieData, ruryData);

            // Tytuł łączny (raz), bez osobnych tytułów ofert
            expect(html.match(/OFERTA HANDLOWA/g)).toHaveLength(1);
            expect(html).toContain('OFERTA HANDLOWA S/1 + R/1');

            // Obie sekcje obecne
            expect(html).toContain('Studnia DN1000');
            expect(html).toContain('Rura DN300');

            // Kategoria rur pobrana z bazy (nie "Inne")
            expect(html).toContain('Rury Betonowe');
            expect(html).not.toContain('>Inne</');

            // Bez nagłówka "Parametry techniczne studni"
            expect(html).not.toContain('Parametry techniczne studni');

            // Parametry techniczne studni i rur w obu sekcjach (po jednym bloku)
            expect(html.match(/Parametry techniczne:/g)).toHaveLength(2);

            // Cena franco występuje raz w uwagach studni i raz w uwagach rur (jak w polach "Uwagi do oferty")
            expect(html.match(/Cena franco budowa bez rozładunku/g)).toHaveLength(2);

            // Kolejność: tabela studni → podsumowanie studni → uwagi studni → tabela rur → podsumowanie rur → uwagi rur → suma łączna
            const iWell = html.indexOf('Studnia DN1000');
            const iWellSum = html.indexOf('RAZEM NETTO');
            const iParams = html.indexOf('Parametry techniczne:');
            const iPipe = html.indexOf('Rura DN300');
            const iRurSum = html.indexOf('SUMA NETTO');
            const iRurParams = html.indexOf('Parametry techniczne: Rury betonowe');
            const iCombined = html.indexOf('RAZEM NETTO (studnie + rury)');
            expect(iWellSum).toBeGreaterThan(iWell);
            expect(iParams).toBeGreaterThan(iWellSum);
            expect(iPipe).toBeGreaterThan(iParams);
            expect(iRurSum).toBeGreaterThan(iPipe);
            expect(iRurParams).toBeGreaterThan(iRurSum);
            expect(iCombined).toBeGreaterThan(iRurParams);

            // Warunki płatności pod podsumowaniem łącznym
            const iPay = html.indexOf('Warunki płatności:');
            expect(iPay).toBeGreaterThan(iCombined);

            // Warunki płatności i statyczne warunki tylko raz
            expect(html.match(/Warunki płatności:/g)).toHaveLength(1);
            expect(html.match(/Informacje dodatkowe i ogólne warunki:/g)).toHaveLength(1);

            // Zbiorcze podsumowanie
            expect(html).toContain('RAZEM NETTO (studnie + rury)');
            expect(html).toContain('2200,00 PLN');
        });

        it('wypełnia oba sloty tabel ({{TABELE_DN}} i {{TABELA_RUR}} bez tokenów)', async () => {
            const TEMPLATE =
                '<body>{{TABELE_DN}}|{{TABELA_RUR}}|{{PODSUMOWANIE}}|{{TYTUL_DOKUMENTU}}</body>';
            (fs.readFileSync as jest.Mock).mockImplementation((p: string) =>
                p.includes('.png') ? Buffer.from('fake-image') : TEMPLATE
            );

            const html = await generateCombinedHTML(studnieData, ruryData);

            expect(html).not.toContain('{{TABELE_DN}}');
            expect(html).not.toContain('{{TABELA_RUR}}');
            expect(html).not.toContain('{{PODSUMOWANIE}}');
            expect(html).not.toContain('{{TYTUL_DOKUMENTU}}');
        });
    });
});
