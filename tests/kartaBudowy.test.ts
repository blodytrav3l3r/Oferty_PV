import {
    generateKartaBudowyPDF,
    generateKartaBudowyRuryPDF
} from '../src/services/pdf/kartaBudowy';
import prisma from '../src/prismaClient';
import { getCatalogStudnieRows } from '../src/services/pricelist/catalog';
import * as pdfEngine from '../src/services/pdf/pdfEngine';
import { generateKartaBudowyDOCX } from '../src/services/docx/studnie/kartaBudowy';
import { generateKartaBudowyRuryDOCX } from '../src/services/docx/rury/kartaBudowy';
import { getKartaBudowySharedSections } from '../src/services/kartaBudowy/sharedSections';
import JSZip from 'jszip';

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        orders_studnie_rel: { findUnique: jest.fn() },
        orders_rury_rel: { findUnique: jest.fn() }
    }
}));

// Etap 2: metadane elementów studni przychodzą z ACTIVE (fallback seed), nie z `*Default`.
jest.mock('../src/services/pricelist/catalog', () => ({
    getCatalogStudnieRows: jest.fn().mockResolvedValue([])
}));

jest.mock('../src/services/pdf/pdfEngine', () => ({
    generatePDF: jest.fn().mockResolvedValue(Buffer.from('PDFDATA'.repeat(100)))
}));

describe('kartaBudowy - Z-71', () => {
    beforeEach(() => jest.clearAllMocks());

    it('generuje PDF kartaBudowy jako Buffer', async () => {
        (prisma.orders_studnie_rel.findUnique as jest.Mock).mockResolvedValue({
            id: 'order1',
            data: JSON.stringify({
                kartaBudowy: { uwagiOgolne: 'test' },
                wells: [],
                orderNumber: 'ZAM/001'
            })
        });
        const buf = await generateKartaBudowyPDF('order1');
        expect(Buffer.isBuffer(buf)).toBe(true);
        expect(buf.length).toBeGreaterThan(100);
        expect(pdfEngine.generatePDF).toHaveBeenCalled();
    });

    it('renderuje lokalizację, kontakt budowy i nabywcę w ustalonej kolejności', async () => {
        (prisma.orders_studnie_rel.findUnique as jest.Mock).mockResolvedValue({
            id: 'order-parties',
            data: JSON.stringify({
                orderNumber: 'ZAM/003',
                investName: 'Hala <A>',
                investPostalCode: '00-001',
                investCity: 'Warszawa',
                investStreet: 'Leśna 2',
                investLocationDescription: 'Wjazd od północy',
                investContacts: [
                    { name: 'Jan Kowalski', phone: '500 600 700', email: 'jan@example.test' }
                ],
                clientNumber: 'K-001',
                clientName: 'Budimex S.A.',
                clientNip: '1234567890',
                clientAddress: 'ul. Testowa 1, Warszawa',
                kartaBudowy: {
                    kontaktyBudowa: [
                        {
                            name: 'Jan Kowalski',
                            phone: '500 600 700',
                            email: 'jan@example.test',
                            role: 'Kierownik budowy'
                        },
                        {
                            name: 'Alicja Malinowska',
                            phone: '700 800 900',
                            email: 'alicja@example.test',
                            role: 'Odbiór dostawy'
                        }
                    ]
                },
                wells: []
            })
        });

        await generateKartaBudowyPDF('order-parties');

        const html = (pdfEngine.generatePDF as jest.Mock).mock.calls[0][0] as string;
        expect(html).toContain('Hala &lt;A&gt;');
        expect(html).toContain('Jan Kowalski');
        expect(html).toContain('Alicja Malinowska');
        expect(html).not.toContain('Odbiór dostawy');
        expect(html).not.toContain('Kierownik budowy');
        expect(html).toContain('K-001');
        expect(html.indexOf('Miejsce budowy / dostawy')).toBeLessThan(
            html.indexOf('Osoby do kontaktu — budowa')
        );
        expect(html.indexOf('Osoby do kontaktu — budowa')).toBeLessThan(
            html.indexOf('Dane nabywcy')
        );
        expect(html.indexOf('Dane nabywcy')).toBeLessThan(html.indexOf('Podstawowe Informacje'));
    });

    it('renderuje te same dane i kolejność w DOCX', async () => {
        (prisma.orders_studnie_rel.findUnique as jest.Mock).mockResolvedValue({
            id: 'order-parties-docx',
            data: JSON.stringify({
                orderNumber: 'ZAM/004',
                investName: 'Hala A',
                investPostalCode: '00-001',
                investCity: 'Warszawa',
                investStreet: 'Leśna 2',
                investLocationDescription: 'Wjazd od północy',
                investContacts: [
                    { name: 'Jan Kowalski', phone: '500 600 700', email: 'jan@example.test' }
                ],
                clientNumber: 'K-001',
                clientName: 'Budimex S.A.',
                clientNip: '1234567890',
                clientAddress: 'ul. Testowa 1, Warszawa',
                kartaBudowy: {
                    kontaktyBudowa: [
                        {
                            name: 'Jan Kowalski',
                            phone: '500 600 700',
                            email: 'jan@example.test',
                            role: 'Kierownik budowy'
                        },
                        {
                            name: 'Alicja Malinowska',
                            phone: '700 800 900',
                            email: 'alicja@example.test',
                            role: 'Odbiór dostawy'
                        }
                    ]
                },
                wells: []
            })
        });

        const buffer = await generateKartaBudowyDOCX('order-parties-docx');
        const archive = await JSZip.loadAsync(buffer);
        const xml = await archive.file('word/document.xml')!.async('string');

        expect(xml).toContain('Hala A');
        expect(xml).toContain('Jan Kowalski');
        expect(xml).toContain('Alicja Malinowska');
        expect(xml).not.toContain('Kierownik budowy');
        expect(xml).not.toContain('Odbiór dostawy');
        expect(xml).toContain('K-001');
        expect(xml.indexOf('MIEJSCE BUDOWY / DOSTAWY')).toBeLessThan(
            xml.indexOf('OSOBY DO KONTAKTU — BUDOWA')
        );
        expect(xml.indexOf('OSOBY DO KONTAKTU — BUDOWA')).toBeLessThan(xml.indexOf('DANE NABYWCY'));
        expect(xml.indexOf('DANE NABYWCY')).toBeLessThan(xml.indexOf('PODSTAWOWE INFORMACJE'));
    });

    it('rozdziela historyczny kontakt zamawiającego i budowy w PDF oraz DOCX', async () => {
        (prisma.orders_studnie_rel.findUnique as jest.Mock).mockResolvedValue({
            id: 'order-legacy-contacts',
            data: JSON.stringify({
                orderNumber: 'ZAM/005',
                investContacts: [{ name: 'Kontakt z oferty', phone: '111 222 333' }],
                kartaBudowy: {
                    osobaKontakt:
                        'Zamawiający: Anna Nowak, 600 700 800, Budowa: Jan Kowalski, 500 111 222'
                },
                wells: []
            })
        });

        await generateKartaBudowyPDF('order-legacy-contacts');
        const html = (pdfEngine.generatePDF as jest.Mock).mock.calls[0][0] as string;
        expect(html).toContain('Anna Nowak, 600 700 800');
        expect(html).toContain('Jan Kowalski');
        expect(html).not.toContain('Kontakt z oferty');

        const archive = await JSZip.loadAsync(
            await generateKartaBudowyDOCX('order-legacy-contacts')
        );
        const xml = await archive.file('word/document.xml')!.async('string');
        expect(xml).toContain('Anna Nowak');
        expect(xml).toContain('600 700 800');
        expect(xml).toContain('Jan Kowalski');
        expect(xml).toContain('500 111 222');
        expect(xml).not.toContain('Kontakt z oferty');
    });

    it('obsługuje duży payload', async () => {
        const largeWells = Array.from({ length: 20 }, (_, i) => ({
            dn: 1000 + i * 100,
            config: []
        }));
        (prisma.orders_studnie_rel.findUnique as jest.Mock).mockResolvedValue({
            id: 'order1',
            data: JSON.stringify({
                kartaBudowy: { uwagiOgolne: 'x'.repeat(1000) },
                wells: largeWells,
                orderNumber: 'ZAM/001'
            })
        });
        const buf = await generateKartaBudowyPDF('order1');
        expect(buf.length).toBeGreaterThan(100);
    });

    it('rzuca gdy zamówienie nie istnieje', async () => {
        (prisma.orders_studnie_rel.findUnique as jest.Mock).mockResolvedValue(null);
        await expect(generateKartaBudowyPDF('missing')).rejects.toThrow();
    });

    // ─── Faza D (plan 2026-08-23): pokrycie przejśćDetails, tabeli rzeczywistej i rur ───

    it('renderuje tabelę Szczegóły przejść z przejsciaDetails', async () => {
        (prisma.orders_studnie_rel.findUnique as jest.Mock).mockResolvedValue({
            id: 'order2',
            data: JSON.stringify({
                kartaBudowy: {
                    uwagiOgolne: 'x',
                    przejsciaDetails: [
                        { rodzaj: 'Tuliejowe', dnOd: '160', dnDo: '200', uwagi: 'test A' },
                        { rodzaj: 'Szczelne', dnOd: '300', dnDo: '400', czyPrzejscie: 'TAK' }
                    ]
                },
                wells: [],
                orderNumber: 'ZAM/002'
            })
        });
        await generateKartaBudowyPDF('order2');

        const htmlArg = (pdfEngine.generatePDF as jest.Mock).mock.calls[0][0] as string;
        expect(htmlArg).toContain('Szczegóły przejść');
        expect(htmlArg).toContain('Tuliejowe');
        expect(htmlArg).toContain('Szczelne');
        expect(htmlArg).toContain('TAK');
    });

    it('liczy Rzeczywistą ilość przejść (dennica/krag_ot) z konfiguracji studni', async () => {
        (prisma.orders_studnie_rel.findUnique as jest.Mock).mockResolvedValue({
            id: 'order3',
            data: JSON.stringify({
                kartaBudowy: {},
                orderNumber: 'ZAM/003',
                wells: [
                    {
                        dn: 1000,
                        rzednaDna: '0',
                        rzednaWlazu: '3',
                        config: [
                            { productId: 'DEN-1000', quantity: 1 },
                            { productId: 'KRG-1000-05', quantity: 4 },
                            { productId: 'KRG-1000-05_OT', quantity: 1 }
                        ],
                        przejscia: [{ productId: 'PRZ-0160', rzednaWlaczenia: '1.5' }]
                    }
                ]
            })
        });
        (getCatalogStudnieRows as jest.Mock).mockResolvedValue([
            {
                id: 'DEN-1000',
                componentType: 'dennica',
                category: 'Dennice',
                dn: 1000,
                height: 500
            },
            { id: 'KRG-1000-05', componentType: 'krag', category: 'Kręgi', dn: 1000, height: 500 },
            {
                id: 'KRG-1000-05_OT',
                componentType: 'krag_ot',
                category: 'Kręgi wiercone',
                dn: 1000,
                height: 500
            },
            {
                id: 'PRZ-0160',
                componentType: 'przejscie',
                category: 'Przejścia',
                dn: '160/200',
                height: 100
            }
        ]);
        await generateKartaBudowyPDF('order3');

        const htmlArg = (pdfEngine.generatePDF as jest.Mock).mock.calls[0][0] as string;
        expect(htmlArg).toContain('Rzeczywista ilość przejść w zamówieniu');
        expect(htmlArg).toContain('Kręgi wiercone');
        expect(htmlArg).toContain('Razem');
    });

    it('generuje KartaBudowyRury z tabelą elementów zamówienia', async () => {
        (prisma.orders_rury_rel.findUnique as jest.Mock).mockResolvedValue({
            id: 'rury1',
            data: JSON.stringify({
                investName: 'Hala Rur',
                clientName: 'Budimex Rury',
                clientContacts: [
                    { name: 'Anna Nowak', phone: '600 700 800', email: 'anna@example.test' },
                    { name: 'Jan Nowak', phone: '500 400 300', email: 'jan@example.test' }
                ],
                kartaBudowy: {
                    uwagiOgolne: 'rury',
                    kontaktyBudowa: [
                        {
                            name: 'Piotr Nowak',
                            phone: '500 111 222',
                            email: 'piotr@example.test',
                            role: 'Kierownik budowy'
                        }
                    ]
                },
                orderNumber: 'ZR/010',
                items: [
                    {
                        name: 'Rura DN300 2500',
                        productId: 'RTB-0-03-25-K00',
                        quantity: 5,
                        orderedQuantity: 3
                    },
                    {
                        name: 'Rura DN300 auto',
                        productId: 'RTB-0-03-10-K00',
                        quantity: 2,
                        autoAdded: true
                    }
                ]
            })
        });
        const buf = await generateKartaBudowyRuryPDF('rury1');

        expect(Buffer.isBuffer(buf)).toBe(true);
        const htmlArg = (pdfEngine.generatePDF as jest.Mock).mock.calls[0][0] as string;
        expect(htmlArg).toContain('Ilość elementów w zamówieniu');
        expect(htmlArg).toContain('Rura DN300 2500');
        expect(htmlArg).toContain('auto');
        expect(htmlArg).toContain('>3<'); // orderedQuantity
        expect(htmlArg).toContain('Hala Rur');
        expect(htmlArg).toContain('Budimex Rury');
        expect(htmlArg).toContain('anna@example.test');
        expect(htmlArg).toContain('jan@example.test');
        expect(htmlArg).not.toContain('Kierownik budowy');
    });

    it('eksport Rur zawiera wspólne sekcje oraz kontakty i zachowuje kolejność Studni', async () => {
        (prisma.orders_rury_rel.findUnique as jest.Mock).mockResolvedValue({
            id: 'rury-docx-parties',
            data: JSON.stringify({
                orderNumber: 'ZR/011',
                investName: 'Hala A',
                investPostalCode: '00-001',
                investCity: 'Warszawa',
                investStreet: 'Leśna 2',
                investLocationDescription: 'Wjazd od północy',
                clientNumber: 'K-002',
                clientName: 'Budimex S.A.',
                clientNip: '1234567890',
                clientAddress: 'Testowa 1',
                clientContacts: [
                    { name: 'Anna Nowak', phone: '600 700 800', email: 'anna@example.test' },
                    { name: 'Jan Nowak', phone: '500 400 300', email: 'jan@example.test' }
                ],
                kartaBudowy: {
                    kontaktyBudowa: [
                        {
                            name: 'Piotr Nowak',
                            phone: '500 111 222',
                            email: 'piotr@example.test',
                            role: 'Kierownik budowy'
                        }
                    ]
                },
                items: [{ name: 'Rura DN300', quantity: 1 }]
            })
        });

        const archive = await JSZip.loadAsync(
            await generateKartaBudowyRuryDOCX('rury-docx-parties')
        );
        const xml = await archive.file('word/document.xml')!.async('string');

        expect(xml).toContain('Hala A');
        expect(xml).toContain('anna@example.test');
        expect(xml).toContain('jan@example.test');
        expect(xml).not.toContain('Kierownik budowy');
        expect(xml).toContain('Rura DN300');
        expect(xml.indexOf('MIEJSCE BUDOWY / DOSTAWY')).toBeLessThan(
            xml.indexOf('OSOBY DO KONTAKTU — BUDOWA')
        );
        expect(xml.indexOf('OSOBY DO KONTAKTU — BUDOWA')).toBeLessThan(xml.indexOf('DANE NABYWCY'));
        expect(xml.indexOf('DANE NABYWCY')).toBeLessThan(xml.indexOf('PODSTAWOWE INFORMACJE'));
    });

    it('builds the shared party sections and restores legacy contacts', () => {
        const sections = getKartaBudowySharedSections(
            { investName: 'Hala A' },
            {
                investContacts: [{ name: 'Jan Kowalski', phone: '500', email: 'jan@example.test' }],
                contactPerson: 'Anna Nowak',
                clientPhone: '600',
                clientEmail: 'anna@example.test'
            }
        );

        expect(sections.map(({ title }) => title)).toEqual([
            'Miejsce budowy / dostawy',
            'Osoby do kontaktu — budowa',
            'Dane nabywcy'
        ]);
        expect(sections[1].rows).toContainEqual({
            label: 'Imię i nazwisko',
            value: 'Jan Kowalski'
        });
        expect(sections[2].rows).toContainEqual({
            label: 'Kontakt zamawiającego — imię i nazwisko',
            value: 'Anna Nowak'
        });
        expect(JSON.stringify(sections)).not.toContain('Rola');

        const explicitlyEmpty = getKartaBudowySharedSections(
            { kontaktyBudowa: [] },
            { investContacts: [{ name: 'Legacy builder' }] }
        );
        expect(explicitlyEmpty[1].rows[0].value).toBe('—');

        const legacyRury = getKartaBudowySharedSections(
            { osobaKontakt: 'Zamawiający: Anna Nowak, 600 700 800, Budowa: Jan Kowalski' },
            {}
        );
        expect(legacyRury[1].rows[0].value).toBe('Jan Kowalski');
        expect(legacyRury[2].rows[4].value).toBe('Anna Nowak');
        expect(legacyRury[2].rows[5].value).toBe('600 700 800');
    });
});
