import {
    Document,
    Packer,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
    AlignmentType,
    Header,
    Footer,
    PageNumber
} from 'docx';
import prisma from '../../prismaClient';

// ─── Typy ───────────────────────────────────────────────────────────

interface RuryOfferData {
    offerNumber: string;
    clientName: string;
    clientNip: string;
    clientAddress: string;
    items: Array<{
        productId?: string | null;
        quantity?: number | null;
        discount?: number | null;
        price?: number | null;
        dodatkowe_info?: string | null;
    }>;
    transportCost: number;
    createdAt: string;
}

// ─── Formatowanie (lokalne, bo rury mają inny format niż studnie) ──

function formatCurrency(val: number): string {
    return (
        val.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' zł'
    );
}

function formatDate(dateStr: string): string {
    try {
        return new Date(dateStr).toLocaleDateString('pl-PL');
    } catch {
        return dateStr;
    }
}

// ─── Eksport publiczny ──────────────────────────────────────────────

export async function generateOfferRuryDOCX(offerId: string): Promise<Buffer> {
    const offer = await prisma.offers_rel.findUnique({ where: { id: offerId } });
    if (!offer) throw new Error('Oferta nie znaleziona');

    const items = await prisma.offer_items_rel.findMany({ where: { offerId } });
    const client = offer.clientId
        ? await prisma.clients_rel.findUnique({ where: { id: offer.clientId } })
        : null;

    return buildRuryDocument({
        offerNumber: offer.offer_number || 'N/A',
        clientName: client?.name || 'Klient niezidentyfikowany',
        clientNip: client?.nip || '',
        clientAddress: client?.address || '',
        items,
        transportCost: offer.transportCost || 0,
        createdAt: offer.createdAt || new Date().toISOString()
    });
}

// ─── Budowa dokumentu rur ───────────────────────────────────────────

async function buildRuryDocument(data: RuryOfferData): Promise<Buffer> {
    const totalNet = data.items.reduce(
        (sum, item) => sum + (item.price || 0) * (item.quantity || 1),
        0
    );
    const totalWithTransport = totalNet + data.transportCost;

    const tableHeaders = ['Lp.', 'Produkt', 'Ilość', 'Rabat', 'Cena jedn.', 'Wartość'];

    const tableRows = [
        new TableRow({
            children: tableHeaders.map(
                (h) =>
                    new TableCell({
                        children: [
                            new Paragraph({
                                children: [new TextRun({ text: h, bold: true, size: 18 })],
                                alignment: AlignmentType.CENTER
                            })
                        ],
                        width: { size: 100 / tableHeaders.length, type: WidthType.PERCENTAGE },
                        shading: { fill: 'F0F0F0' }
                    })
            ),
            tableHeader: true
        }),
        ...data.items.map(
            (item, idx) =>
                new TableRow({
                    children: [
                        new TableCell({
                            children: [
                                new Paragraph({
                                    children: [new TextRun({ text: String(idx + 1), size: 18 })]
                                })
                            ]
                        }),
                        new TableCell({
                            children: [
                                new Paragraph({
                                    children: [
                                        new TextRun({ text: item.productId || 'Produkt', size: 18 })
                                    ]
                                })
                            ]
                        }),
                        new TableCell({
                            children: [
                                new Paragraph({
                                    children: [
                                        new TextRun({ text: String(item.quantity || 1), size: 18 })
                                    ],
                                    alignment: AlignmentType.CENTER
                                })
                            ]
                        }),
                        new TableCell({
                            children: [
                                new Paragraph({
                                    children: [
                                        new TextRun({
                                            text: item.discount ? item.discount + '%' : '-',
                                            size: 18
                                        })
                                    ],
                                    alignment: AlignmentType.RIGHT
                                })
                            ]
                        }),
                        new TableCell({
                            children: [
                                new Paragraph({
                                    children: [
                                        new TextRun({
                                            text: formatCurrency(item.price || 0),
                                            size: 18
                                        })
                                    ],
                                    alignment: AlignmentType.RIGHT
                                })
                            ]
                        }),
                        new TableCell({
                            children: [
                                new Paragraph({
                                    children: [
                                        new TextRun({
                                            text: formatCurrency(
                                                (item.price || 0) * (item.quantity || 1)
                                            ),
                                            size: 18
                                        })
                                    ],
                                    alignment: AlignmentType.RIGHT
                                })
                            ]
                        })
                    ]
                })
        )
    ];

    const doc = new Document({
        sections: [
            {
                properties: {},
                headers: {
                    default: new Header({
                        children: [
                            new Paragraph({
                                children: [
                                    new TextRun({
                                        text: 'WITROS',
                                        bold: true,
                                        size: 32,
                                        color: '333333'
                                    })
                                ],
                                alignment: AlignmentType.CENTER,
                                spacing: { after: 100 }
                            }),
                            new Paragraph({
                                children: [
                                    new TextRun({
                                        text: 'Oferta handlowa - Rury betonowe',
                                        size: 20,
                                        color: '666666'
                                    })
                                ],
                                alignment: AlignmentType.CENTER,
                                spacing: { after: 200 }
                            })
                        ]
                    })
                },
                footers: {
                    default: new Footer({
                        children: [
                            new Paragraph({
                                children: [
                                    new TextRun({
                                        text: 'Oferta ważna przez 30 dni od daty wystawienia | WITROS - Generator Ofert',
                                        size: 16,
                                        color: '666666'
                                    })
                                ],
                                alignment: AlignmentType.CENTER
                            }),
                            new Paragraph({
                                children: [
                                    new TextRun({ text: 'Strona ', size: 16 }),
                                    new TextRun({ children: [PageNumber.CURRENT], size: 16 }),
                                    new TextRun({ text: ' z ', size: 16 }),
                                    new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16 })
                                ],
                                alignment: AlignmentType.CENTER
                            })
                        ]
                    })
                },
                children: [
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: 'Dane oferty',
                                bold: true,
                                size: 20,
                                color: '666666'
                            })
                        ],
                        spacing: { before: 200, after: 100 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: 'Nr oferty: ', bold: true, size: 22 }),
                            new TextRun({ text: data.offerNumber, size: 22 })
                        ],
                        spacing: { after: 50 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: 'Data: ', bold: true, size: 22 }),
                            new TextRun({ text: formatDate(data.createdAt), size: 22 })
                        ],
                        spacing: { after: 200 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: 'Dane klienta',
                                bold: true,
                                size: 20,
                                color: '666666'
                            })
                        ],
                        spacing: { before: 200, after: 100 }
                    }),
                    new Paragraph({
                        children: [new TextRun({ text: data.clientName, bold: true, size: 22 })],
                        spacing: { after: 50 }
                    }),
                    data.clientNip
                        ? new Paragraph({
                              children: [
                                  new TextRun({ text: 'NIP: ', size: 22 }),
                                  new TextRun({ text: data.clientNip, size: 22 })
                              ],
                              spacing: { after: 50 }
                          })
                        : new Paragraph({ children: [] }),
                    data.clientAddress
                        ? new Paragraph({
                              children: [new TextRun({ text: data.clientAddress, size: 22 })],
                              spacing: { after: 200 }
                          })
                        : new Paragraph({ children: [] }),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: 'Pozycje ofertowe',
                                bold: true,
                                size: 20,
                                color: '666666'
                            })
                        ],
                        spacing: { before: 200, after: 100 }
                    }),
                    new Table({
                        rows: tableRows,
                        width: { size: 100, type: WidthType.PERCENTAGE }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: 'Podsumowanie',
                                bold: true,
                                size: 20,
                                color: '666666'
                            })
                        ],
                        spacing: { before: 300, after: 100 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: 'Suma netto: ', size: 22 }),
                            new TextRun({ text: formatCurrency(totalNet), bold: true, size: 22 })
                        ],
                        spacing: { after: 50 }
                    }),
                    data.transportCost > 0
                        ? new Paragraph({
                              children: [
                                  new TextRun({ text: 'Koszt transportu: ', size: 22 }),
                                  new TextRun({
                                      text: formatCurrency(data.transportCost),
                                      size: 22
                                  })
                              ],
                              spacing: { after: 50 }
                          })
                        : new Paragraph({ children: [] }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: 'RAZEM: ', bold: true, size: 26 }),
                            new TextRun({
                                text: formatCurrency(totalWithTransport),
                                bold: true,
                                size: 26,
                                color: '333333'
                            })
                        ],
                        spacing: { after: 200 }
                    })
                ]
            }
        ]
    });

    return Packer.toBuffer(doc);
}
