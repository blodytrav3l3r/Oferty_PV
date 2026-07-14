import {
    Packer,
    Document,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
    AlignmentType,
    ShadingType,
    BorderStyle
} from 'docx';
import prisma from '../../../prismaClient';
import { logger } from '../../../utils/logger';
import { textCell } from '../helpers';
import { DOCX_COLORS } from '../colors';
import {
    FONT,
    COLOR_BODY,
    COLOR_GRAY_HEADER,
    COLOR_WHITE,
    COLOR_LABEL,
    SZ_TABLE_BODY,
    SZ_TABLE_HEADER,
    BORDER_DOTTED,
    BORDER_NONE,
    NO_BORDERS,
    CELL_BORDERS,
    type CellBorders
} from '../constants';

const INFO_BOTTOM: CellBorders = {
    top: BORDER_NONE,
    bottom: BORDER_DOTTED,
    left: BORDER_NONE,
    right: BORDER_NONE
};

const SPACER = new Paragraph({ spacing: { before: 240 }, children: [] });

function sectionRow(text: string, span: number = 2): TableRow {
    return new TableRow({
        children: [
            new TableCell({
                columnSpan: span,
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: NO_BORDERS,
                shading: {
                    type: ShadingType.SOLID,
                    color: COLOR_GRAY_HEADER,
                    fill: COLOR_GRAY_HEADER
                },
                children: [
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: text.toUpperCase(),
                                bold: true,
                                size: SZ_TABLE_BODY,
                                font: FONT,
                                color: COLOR_WHITE
                            })
                        ],
                        spacing: { before: 30, after: 30 }
                    })
                ]
            })
        ]
    });
}

function infoRow(label: string, value: string, labelWidth: number = 45): TableRow {
    return new TableRow({
        children: [
            textCell(label, {
                bold: true,
                width: labelWidth,
                color: COLOR_LABEL,
                size: SZ_TABLE_BODY,
                borders: INFO_BOTTOM
            }),
            textCell(value, { width: 100 - labelWidth, size: SZ_TABLE_BODY, borders: INFO_BOTTOM })
        ]
    });
}

function infoSection(heading: string, rows: TableRow[]): (Table | Paragraph)[] {
    return [
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            columnWidths: [4500, 5500],
            rows: [sectionRow(heading), ...rows]
        }),
        SPACER
    ];
}

const TBL_COLS = [
    { text: 'Lp.', width: 8 },
    { text: 'Rodzaj przejścia', width: 28 },
    { text: 'DN OD', width: 14 },
    { text: 'DN DO', width: 14 },
    { text: 'Uwagi', width: 26 },
    { text: 'Czy przejście?', width: 10 }
];

function transitionHeaderRow(): TableRow {
    return new TableRow({
        children: TBL_COLS.map((c) =>
            textCell(c.text, {
                width: c.width,
                size: SZ_TABLE_HEADER,
                alignment: AlignmentType.CENTER,
                bold: true,
                fill: COLOR_GRAY_HEADER,
                color: COLOR_WHITE
            })
        )
    });
}

function transitionDataRow(p: Record<string, unknown>, idx: number): TableRow {
    const vals = [
        String(idx + 1),
        String(p.rodzaj || '—'),
        String(p.dnOd || '—'),
        String(p.dnDo || '—'),
        String(p.uwagi || '—'),
        String(p.czyPrzejscie || '—')
    ];
    return new TableRow({
        children: vals.map((v, ci) =>
            textCell(v, {
                width: TBL_COLS[ci].width,
                size: SZ_TABLE_BODY,
                alignment: AlignmentType.CENTER,
                fill: idx % 2 === 1 ? DOCX_COLORS.rowAlt : undefined
            })
        )
    });
}

export async function generateKartaBudowyRuryDOCX(orderId: string): Promise<Buffer> {
    const order = await prisma.orders_rury_rel.findUnique({ where: { id: orderId } });

    if (!order) {
        throw new Error('Zamówienie rur nie znalezione');
    }

    let orderData: Record<string, unknown> = {};
    if (order.data) {
        try {
            orderData = JSON.parse(order.data) as Record<string, unknown>;
        } catch (e) {
            logger.warn('DocxKartaBudowyRury', 'Nie udało się sparsować danych zamówienia', e);
        }
    }

    const kb = (orderData.kartaBudowy as Record<string, unknown>) || {};

    const nrZamowienia = String(
        orderData.orderNumber || orderData.id || String(order.id).substring(0, 8)
    );
    const nrOferty = String(
        orderData.offerNumber ||
            orderData.number ||
            (Array.isArray(kb.offerNumbers) ? kb.offerNumbers.join(', ') : '—')
    );

    const children: (Paragraph | Table)[] = [];

    // 0. Tytuł dokumentu (raz, na pierwszej stronie)
    children.push(
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 0 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: COLOR_GRAY_HEADER } },
            children: [
                new TextRun({
                    text: 'KARTA BUDOWY',
                    bold: true,
                    size: 28,
                    font: FONT,
                    color: COLOR_BODY
                })
            ]
        })
    );
    children.push(
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 60, after: 200 },
            children: [
                new TextRun({
                    text: `Nr zamówienia: ${nrZamowienia}`,
                    bold: true,
                    size: 20,
                    font: FONT,
                    color: COLOR_LABEL
                })
            ]
        })
    );

    // 1. Podstawowe Informacje
    children.push(
        ...infoSection('Podstawowe Informacje', [
            infoRow('Nr powiązanej oferty', nrOferty),
            infoRow('Data zamówienia', String(kb.dataZamowienia || '—')),
            infoRow('Osoba kontaktowa', String(kb.osobaKontakt || '—')),
            infoRow('Adres wysyłki', String(kb.adresWysylki || '—')),
            infoRow('E-mail (Faktura)', String(kb.emailFaktura || '—')),
            infoRow('E-mail (e-Faktura)', String(kb.emailEfaktura || '—'))
        ])
    );

    // 2. Logistyka i Płatności
    children.push(
        ...infoSection('Logistyka i Płatności', [
            infoRow('Warunki płatności', String(kb.warunkiPlatnosci || '—')),
            infoRow('Ilość dni', String(kb.iloscDni || '—')),
            infoRow('Rodzaj transportu', String(kb.rodzajTransportu || '—')),
            infoRow('Koszt transportu', String(kb.wyliczonyTransport || '—')),
            infoRow('Zabezpieczenie transportu', String(kb.zabezpieczenieTransportu || '—')),
            infoRow('Ubezpieczenie', String(kb.ubezpieczenie || '—'))
        ])
    );

    // 3. Studnia i Beton
    children.push(
        ...infoSection('Produkty i Materiał', [
            infoRow('Rodzaj produktu', String(kb.rodzajStudni || '—')),
            infoRow('Właściwości betonu', String(kb.wlasciwosciBetonu || '—')),
            infoRow('Pozostałe właściwości', String(kb.pozostaleWlasciwosci || '—')),
            infoRow(
                'Rodzaj elementów',
                String(kb.rodzajStopni || '—') +
                    (kb.rodzajStopniInne ? ` (${kb.rodzajStopniInne})` : '')
            ),
            infoRow(
                'Uszczelka',
                String(kb.uszczelkaStudni || '—') +
                    (kb.uszczelkaStudniInne ? ` (${kb.uszczelkaStudniInne})` : '')
            )
        ])
    );

    // 4. Kineta i Spocznik
    children.push(
        ...infoSection('Kineta i Spocznik', [
            infoRow(
                'Kineta',
                String(kb.kineta || '—') + (kb.kinetaInne ? ` (${kb.kinetaInne})` : '')
            ),
            infoRow('Redukcja kinety', String(kb.redukcjaKinety || '—')),
            infoRow('Usytuowanie', String(kb.usytuowanie || '—')),
            infoRow('Wysokość spocznika', String(kb.wysokoscSpocznika || '—')),
            infoRow(
                'Ślepa kineta',
                String(kb.slepaKineta || '—') +
                    (kb.slepaKinetaUwagi ? ` (${kb.slepaKinetaUwagi})` : '')
            ),
            infoRow(
                'Kaskada',
                String(kb.kaskada || '—') + (kb.kaskadaUwagi ? ` (${kb.kaskadaUwagi})` : '')
            )
        ])
    );

    // 5. Przejścia
    children.push(
        ...infoSection('Przejścia', [
            infoRow('Przejścia szczelne', String(kb.przejsciaSzczelne || '—')),
            infoRow('Przejścia tulejowe', String(kb.przejsciaTulejowe || '—')),
            infoRow('Przejścia zamówione w', String(kb.przejsciaZamowione || '—'))
        ])
    );

    // 6. Transition table (conditional)
    if (Array.isArray(kb.przejsciaDetails) && kb.przejsciaDetails.length > 0) {
        children.push(
            new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                    sectionRow('Szczegóły przejść', 6),
                    transitionHeaderRow(),
                    ...kb.przejsciaDetails.map((p: any, idx: number) => transitionDataRow(p, idx))
                ]
            })
        );
        children.push(SPACER);
    }

    // 7. Uwagi ogólne
    const uwagiText = String(kb.uwagiOgolne || '—');
    const uwagiLines = uwagiText.split('\n');
    const uwagiRuns = uwagiLines.flatMap((line, i) => [
        ...(i > 0 ? [new TextRun({ break: 1 })] : []),
        new TextRun({ text: line, size: SZ_TABLE_BODY, font: FONT, color: COLOR_BODY })
    ]);

    children.push(
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
                sectionRow('Uwagi ogólne', 1),
                new TableRow({
                    children: [
                        new TableCell({
                            borders: CELL_BORDERS,
                            shading: {
                                type: ShadingType.SOLID,
                                color: DOCX_COLORS.infoBg,
                                fill: DOCX_COLORS.infoBg
                            },
                            children: [
                                new Paragraph({
                                    spacing: { before: 60, after: 60 },
                                    children: uwagiRuns
                                })
                            ]
                        })
                    ]
                })
            ]
        })
    );

    const doc = new Document({
        sections: [
            {
                properties: {},
                children
            }
        ]
    });

    return Packer.toBuffer(doc);
}
