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
    BorderStyle,
    ShadingType
} from 'docx';
import prisma from '../../prismaClient';
import { lookupOfferUsers, UserContactInfo } from '../pdfGenerator';
import {
    FONT,
    COLOR_GRAY_HEADER,
    COLOR_WHITE,
    COLOR_LABEL,
    COLOR_BG_SUMMARY,
    COLOR_BG_NOTE,
    COLOR_NOTE_BORDER,
    NO_BORDERS,
    CELL_BORDERS,
    SZ_TITLE,
    SZ_BODY,
    SZ_TABLE_BODY,
    SZ_TABLE_HEADER,
    SZ_ZWIENCZENIE,
    SZ_INFO_BOX,
    SZ_INFO_LABEL,
    SZ_DN_HEADER,
    SZ_SUMMARY,
    SZ_GRAND_TOTAL,
    SZ_TERMS,
    SZ_TERMS_TABLE,
    SZ_TERMS_HEADER,
    SZ_THANKS
} from './constants';
import { fmtCurrency, fmtInt, fmtDate, textCell } from './helpers';
import { buildImageHeader, buildImageFooter } from './headerFooter';
import { logger } from '../../utils/logger';

// ─── Eksport publiczny ──────────────────────────────────────────────

export async function generateOfferStudnieDOCX(offerId: string): Promise<Buffer> {
    const offer = await prisma.offers_studnie_rel.findUnique({ where: { id: offerId } });
    if (!offer) throw new Error('Oferta studni nie znaleziona');

    let offerData: any = {};
    try {
        offerData = offer.data ? JSON.parse(offer.data) : {};
    } catch (e) {
        logger.warn('DocxStudnie', 'Failed to parse offer data', e);
    }

    let wells: any[] = [];
    if (offerData.wellsExport && Array.isArray(offerData.wellsExport)) {
        wells = offerData.wellsExport;
    } else if (offerData.wells && Array.isArray(offerData.wells)) {
        wells = offerData.wells;
    }

    logger.info('DocxStudnie', `Generowanie DOCX dla oferty ${offerId}, studni: ${wells.length}`);

    const client = offer.clientId
        ? await prisma.clients_rel.findUnique({ where: { id: offer.clientId } })
        : null;
    const { authorUser, guardianUser } = await lookupOfferUsers(offerData, offer.userId);
    const doc = buildStudnieDocument(offer, offerData, client, wells, authorUser, guardianUser);
    return Packer.toBuffer(doc);
}

// ─── Budowa dokumentu studni ────────────────────────────────────────

function buildStudnieDocument(
    offer: any,
    offerData: any,
    client: any,
    wells: any[],
    authorUser: UserContactInfo | null,
    guardianUser: UserContactInfo | null
): Document {
    const offerNumber = offer.offer_number || 'N/A';
    const offerDate = fmtDate(offerData.date || offer.createdAt || new Date().toISOString());
    const validity = offerData.validity || '30 dni';

    const clientName = client?.name || offerData.clientName || 'Klient niezidentyfikowany';
    const clientNip = client?.nip || offerData.clientNip || '';
    const clientAddress = client?.address || offerData.clientAddress || '';
    const clientContact = offerData.clientContact || client?.contact || client?.phone || '';
    const investName = offerData.investName || '';
    const investAddress = offerData.investAddress || '';
    const investContractor = offerData.investContractor || '';
    const notes = offerData.notes || '';
    const paymentTerms =
        offerData.paymentTerms || 'Do uzgodnienia lub według indywidualnych warunków handlowych.';

    const children: (Paragraph | Table)[] = [];

    // 1. Tytuł
    children.push(buildTitleParagraph(offerNumber));

    // 2. Daty
    children.push(...buildDateParagraphs(offerDate, validity));

    // 3. Info grid: Klient + Inwestycja
    children.push(
        buildClientInvestTable(
            clientName, clientNip, clientAddress, clientContact,
            investName, investAddress, investContractor
        )
    );

    // 4. Tabele studni per DN
    const { paragraphs: dnParagraphs, summaries, grandTotal } = buildWellTables(wells);
    children.push(...dnParagraphs);

    // 5. Podsumowanie
    children.push(...buildSummarySection(summaries, grandTotal));

    // 6. Uwagi
    if (notes) {
        children.push(buildNotesParagraph(notes));
    }

    // 7. Warunki płatności
    children.push(buildPaymentTermsParagraph(paymentTerms));

    // 8. Statyczne warunki handlowe
    children.push(...buildStaticTerms());

    // 9. Dane kontaktowe
    children.push(...buildContactSection(authorUser, guardianUser));

    return new Document({
        sections: [
            {
                properties: {
                    page: {
                        margin: {
                            top: 60, bottom: 280, right: 570, left: 570,
                            header: 60, footer: 280
                        }
                    }
                },
                headers: { default: buildImageHeader() },
                footers: { default: buildImageFooter() },
                children
            }
        ]
    });
}

// ─── Sekcje dokumentu (prywatne) ────────────────────────────────────

function buildTitleParagraph(offerNumber: string): Paragraph {
    return new Paragraph({
        children: [
            new TextRun({
                text: `OFERTA HANDLOWA ${offerNumber}`,
                bold: true, size: SZ_TITLE, font: FONT, color: '000000'
            })
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 80, after: 40 }
    });
}

function buildDateParagraphs(offerDate: string, validity: string): Paragraph[] {
    return [
        new Paragraph({
            children: [
                new TextRun({ text: 'Data przygotowania oferty: ', bold: true, size: SZ_BODY, font: FONT, color: '333333' }),
                new TextRun({ text: offerDate, size: SZ_BODY, font: FONT })
            ],
            alignment: AlignmentType.RIGHT,
            spacing: { after: 0 }
        }),
        new Paragraph({
            children: [
                new TextRun({ text: 'Data ważności oferty: ', bold: true, size: SZ_BODY, font: FONT, color: '333333' }),
                new TextRun({ text: validity, size: SZ_BODY, font: FONT })
            ],
            alignment: AlignmentType.RIGHT,
            spacing: { after: 60 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: COLOR_GRAY_HEADER } }
        })
    ];
}

function buildNotesParagraph(notes: string): Paragraph {
    return new Paragraph({
        children: [
            new TextRun({ text: 'Uwagi: ', bold: true, size: SZ_TABLE_BODY, font: FONT }),
            new TextRun({ text: notes, size: SZ_TABLE_BODY, font: FONT })
        ],
        spacing: { before: 120, after: 60 },
        shading: { type: ShadingType.SOLID, color: COLOR_BG_NOTE, fill: COLOR_BG_NOTE },
        border: { left: { style: BorderStyle.SINGLE, size: 6, color: COLOR_NOTE_BORDER } }
    });
}

function buildPaymentTermsParagraph(paymentTerms: string): Paragraph {
    return new Paragraph({
        children: [
            new TextRun({ text: 'Warunki płatności: ', bold: true, size: SZ_TABLE_BODY, font: FONT }),
            new TextRun({ text: paymentTerms, size: SZ_TABLE_BODY, font: FONT })
        ],
        spacing: { before: 60, after: 20 }
    });
}

// ─── Klient + Inwestycja ────────────────────────────────────────────

function buildClientInvestTable(
    name: string, nip: string, address: string, contact: string,
    investName: string, investAddress: string, investContractor: string
): Table {
    const buildCell = (label: string, lines: TextRun[]): TableCell => {
        const runs: TextRun[] = [
            new TextRun({ text: label, size: SZ_INFO_LABEL, font: FONT, color: COLOR_LABEL }),
            new TextRun({ break: 1 } as any),
            ...lines
        ];
        return new TableCell({
            children: [new Paragraph({ children: runs, spacing: { before: 80, after: 80 } })],
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: CELL_BORDERS,
            shading: { type: ShadingType.SOLID, color: 'FFFFFF', fill: 'FFFFFF' }
        });
    };

    const clientRuns = buildClientRuns(name, address, nip, contact);
    const investRuns = buildInvestRuns(investName, investAddress, investContractor);

    return new Table({
        rows: [
            new TableRow({
                children: [
                    buildCell('DANE KLIENTA', clientRuns),
                    buildCell('DANE INWESTYCJI', investRuns)
                ]
            })
        ],
        width: { size: 100, type: WidthType.PERCENTAGE }
    });
}

function buildClientRuns(name: string, address: string, nip: string, contact: string): TextRun[] {
    const runs: TextRun[] = [
        new TextRun({ text: name, bold: true, size: SZ_INFO_BOX, font: FONT, color: '000000' })
    ];
    if (address) {
        runs.push(new TextRun({ break: 1 } as any));
        runs.push(new TextRun({ text: address, size: SZ_INFO_BOX, font: FONT, color: '000000' }));
    }
    if (nip) {
        runs.push(new TextRun({ break: 1 } as any));
        runs.push(new TextRun({ text: `NIP: ${nip}`, size: SZ_INFO_BOX, font: FONT, color: '000000' }));
    }
    if (contact) {
        runs.push(new TextRun({ break: 1 } as any));
        runs.push(new TextRun({ text: `Kontakt: ${contact}`, size: SZ_INFO_BOX, font: FONT, color: '000000' }));
    }
    return runs;
}

function buildInvestRuns(investName: string, investAddress: string, investContractor: string): TextRun[] {
    const runs: TextRun[] = [];
    if (investName) {
        runs.push(new TextRun({ text: 'Budowa: ', bold: true, size: SZ_INFO_BOX, font: FONT, color: '000000' }));
        runs.push(new TextRun({ text: investName, size: SZ_INFO_BOX, font: FONT, color: '000000' }));
    } else {
        runs.push(new TextRun({ text: '\u2014', size: SZ_INFO_BOX, font: FONT, color: '000000' }));
    }
    if (investAddress) {
        runs.push(new TextRun({ break: 1 } as any));
        runs.push(new TextRun({ text: 'Adres: ', bold: true, size: SZ_INFO_BOX, font: FONT, color: '000000' }));
        runs.push(new TextRun({ text: investAddress, size: SZ_INFO_BOX, font: FONT, color: '000000' }));
    }
    if (investContractor) {
        runs.push(new TextRun({ break: 1 } as any));
        runs.push(new TextRun({ text: 'Wykonawca: ', bold: true, size: SZ_INFO_BOX, font: FONT, color: '000000' }));
        runs.push(new TextRun({ text: investContractor, size: SZ_INFO_BOX, font: FONT, color: '000000' }));
    }
    return runs;
}

// ─── Tabele studni per DN ──────────────────────────────────────────

interface DnSummary {
    label: string;
    count: number;
    totalPrice: number;
}

function buildWellTables(wells: any[]): {
    paragraphs: (Paragraph | Table)[];
    summaries: DnSummary[];
    grandTotal: number;
} {
    const dnOrder = ['1000', '1200', '1500', '2000', '2500', 'styczna', 'Inne'];
    const itemsByDN: Record<string, any[]> = {};
    let grandTotal = 0;

    wells.forEach((well: any) => {
        const dn = String(well.dn || 'Inne');
        const wellPrice = well.totalPrice || well.price || 0;
        grandTotal += wellPrice;
        if (!itemsByDN[dn]) itemsByDN[dn] = [];
        itemsByDN[dn].push({
            name: well.name || `Studnia DN${dn}`,
            price: wellPrice,
            dn,
            height: well.height || 0,
            zwienczenie: well.zwienczenie || '\u2014'
        });
    });

    const paragraphs: (Paragraph | Table)[] = [];
    const summaries: DnSummary[] = [];
    let globalLp = 1;

    const thStyle = {
        bold: true, size: SZ_TABLE_HEADER,
        fill: COLOR_GRAY_HEADER, color: COLOR_WHITE,
        alignment: AlignmentType.CENTER
    };

    for (const dn of dnOrder) {
        if (!itemsByDN[dn]) continue;
        const dnItems = itemsByDN[dn];
        const dnLabel = dn === 'styczna' ? 'Studnie styczne' : `Studnie DN${dn}`;
        const dnTotal = dnItems.reduce((sum: number, item: any) => sum + (item.price || 0), 0);
        summaries.push({ label: dnLabel, count: dnItems.length, totalPrice: dnTotal });

        paragraphs.push(buildDnHeaderParagraph(dnLabel));

        const rows: TableRow[] = [];
        rows.push(buildDnTableHeaderRow(thStyle));
        rows.push(...buildDnDataRows(dnItems, dn, globalLp));
        rows.push(buildDnSummaryRow(dnLabel, dnItems.length, dnTotal));

        paragraphs.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));
        globalLp += dnItems.length;
    }

    return { paragraphs, summaries, grandTotal };
}

function buildDnHeaderParagraph(dnLabel: string): Paragraph {
    return new Paragraph({
        children: [
            new TextRun({ text: dnLabel, bold: true, size: SZ_DN_HEADER, font: FONT, color: COLOR_GRAY_HEADER })
        ],
        spacing: { before: 140, after: 60 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: COLOR_GRAY_HEADER } }
    });
}

function buildDnTableHeaderRow(thStyle: any): TableRow {
    return new TableRow({
        tableHeader: true,
        children: [
            textCell('Lp.', { ...thStyle, width: 5 }),
            textCell('Nr studni', { ...thStyle, width: 30 }),
            textCell('Średnica', { ...thStyle, width: 10 }),
            textCell('H [mm]', { ...thStyle, width: 8 }),
            textCell('Zwieńczenie', { ...thStyle, width: 32 }),
            textCell('Cena netto [PLN]', { ...thStyle, width: 15 })
        ]
    });
}

function buildDnDataRows(dnItems: any[], dn: string, globalLp: number): TableRow[] {
    return dnItems.map((item: any, idx: number) => {
        const dnDisplay = dn === 'styczna' ? 'Styczna' : `DN${dn}`;
        const rowFill = idx % 2 === 1 ? 'FAFAFA' : undefined;

        return new TableRow({
            children: [
                textCell(String(globalLp + idx), { size: SZ_TABLE_BODY, alignment: AlignmentType.CENTER, fill: rowFill }),
                textCell(item.name, { bold: true, size: SZ_TABLE_BODY, alignment: AlignmentType.CENTER, fill: rowFill }),
                textCell(dnDisplay, { size: SZ_TABLE_BODY, alignment: AlignmentType.CENTER, fill: rowFill }),
                textCell(fmtInt(item.height), { size: SZ_TABLE_BODY, alignment: AlignmentType.CENTER, fill: rowFill }),
                textCell(item.zwienczenie, { size: SZ_ZWIENCZENIE, alignment: AlignmentType.CENTER, fill: rowFill }),
                textCell(fmtCurrency(item.price), { bold: true, size: SZ_TABLE_BODY, alignment: AlignmentType.CENTER, fill: rowFill })
            ]
        });
    });
}

function buildDnSummaryRow(dnLabel: string, count: number, dnTotal: number): TableRow {
    return new TableRow({
        children: [
            textCell('', { columnSpan: 4, fill: COLOR_BG_SUMMARY, size: SZ_TABLE_BODY }),
            textCell(`Razem ${dnLabel} (${count} szt.):`, { bold: true, size: SZ_TABLE_BODY, alignment: AlignmentType.RIGHT, fill: COLOR_BG_SUMMARY }),
            textCell(`${fmtCurrency(dnTotal)} PLN`, { bold: true, size: SZ_TABLE_BODY, alignment: AlignmentType.CENTER, fill: COLOR_BG_SUMMARY })
        ]
    });
}

// ─── Podsumowanie oferty ────────────────────────────────────────────

function buildSummarySection(summaries: DnSummary[], grandTotal: number): (Paragraph | Table)[] {
    const result: (Paragraph | Table)[] = [];

    result.push(
        new Paragraph({
            children: [
                new TextRun({ text: 'Podsumowanie oferty', bold: true, size: SZ_DN_HEADER, font: FONT, color: COLOR_GRAY_HEADER })
            ],
            spacing: { before: 160, after: 60 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: COLOR_GRAY_HEADER } }
        })
    );

    const rows: TableRow[] = summaries.map(
        (s) =>
            new TableRow({
                children: [
                    textCell(s.label, { size: SZ_SUMMARY, alignment: AlignmentType.CENTER }),
                    textCell(`${s.count} szt.`, { size: SZ_SUMMARY, alignment: AlignmentType.CENTER }),
                    textCell(`${fmtCurrency(s.totalPrice)} PLN`, { bold: true, size: SZ_SUMMARY, alignment: AlignmentType.CENTER })
                ]
            })
    );

    const totalCount = summaries.reduce((s, x) => s + x.count, 0);
    rows.push(
        new TableRow({
            children: [
                textCell('RAZEM NETTO', { bold: true, size: SZ_GRAND_TOTAL, alignment: AlignmentType.CENTER, fill: COLOR_GRAY_HEADER, color: COLOR_WHITE, borders: NO_BORDERS }),
                textCell(`${totalCount} szt.`, { bold: true, size: SZ_GRAND_TOTAL, alignment: AlignmentType.CENTER, fill: COLOR_GRAY_HEADER, color: COLOR_WHITE, borders: NO_BORDERS }),
                textCell(`${fmtCurrency(grandTotal)} PLN`, { bold: true, size: SZ_GRAND_TOTAL, alignment: AlignmentType.CENTER, fill: COLOR_GRAY_HEADER, color: COLOR_WHITE, borders: NO_BORDERS })
            ]
        })
    );

    result.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));

    return result;
}

// ─── Dane kontaktowe ────────────────────────────────────────────────

function buildContactSection(
    authorUser: UserContactInfo | null,
    guardianUser: UserContactInfo | null
): (Paragraph | Table)[] {
    const result: (Paragraph | Table)[] = [];

    result.push(
        new Paragraph({
            children: [],
            spacing: { before: 200 },
            border: { top: { style: BorderStyle.SINGLE, size: 2, color: COLOR_GRAY_HEADER } }
        })
    );

    if (!guardianUser && !authorUser) {
        result.push(
            new Paragraph({
                children: [
                    new TextRun({ text: 'W razie pytań prosimy o kontakt z opiekunem oferty.', size: SZ_TABLE_BODY, font: FONT })
                ],
                spacing: { before: 40 }
            })
        );
        return result;
    }

    const buildUserCell = (title: string, u: UserContactInfo): TableCell => {
        const runs: TextRun[] = [
            new TextRun({ text: `${title}:`, bold: true, size: SZ_TABLE_BODY, font: FONT, color: COLOR_GRAY_HEADER }),
            new TextRun({ break: 1 } as any),
            new TextRun({ text: u.name, bold: true, size: SZ_TABLE_BODY, font: FONT })
        ];
        if (u.email) {
            runs.push(new TextRun({ break: 1 } as any));
            runs.push(new TextRun({ text: `Email: ${u.email}`, size: SZ_TABLE_BODY, font: FONT }));
        }
        if (u.phone) {
            runs.push(new TextRun({ break: 1 } as any));
            runs.push(new TextRun({ text: `Telefon: ${u.phone}`, size: SZ_TABLE_BODY, font: FONT }));
        }
        return new TableCell({
            children: [new Paragraph({ children: runs, spacing: { before: 40, after: 40 } })],
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: NO_BORDERS
        });
    };

    const cells: TableCell[] = [];
    if (authorUser) cells.push(buildUserCell('Ofertę przygotował(-a)', authorUser));
    if (guardianUser) cells.push(buildUserCell('Opiekun handlowy (kontakt)', guardianUser));
    if (cells.length === 1) {
        cells.push(
            new TableCell({
                children: [new Paragraph({ children: [] })],
                width: { size: 50, type: WidthType.PERCENTAGE },
                borders: NO_BORDERS
            })
        );
    }

    result.push(new Table({
        rows: [new TableRow({ children: cells })],
        width: { size: 100, type: WidthType.PERCENTAGE }
    }));

    return result;
}

// ─── Statyczne warunki handlowe ─────────────────────────────────────

function buildStaticTerms(): (Paragraph | Table)[] {
    const result: (Paragraph | Table)[] = [];

    result.push(
        new Paragraph({
            children: [
                new TextRun({ text: 'Informacje dodatkowe i ogólne warunki:', bold: true, size: SZ_TERMS_HEADER, font: FONT, color: COLOR_GRAY_HEADER })
            ],
            spacing: { before: 150, after: 50 }
        })
    );

    const addP = (text: string, opts?: { bold?: boolean; marginTop?: number }) => {
        result.push(
            new Paragraph({
                children: [
                    new TextRun({ text, size: SZ_TERMS, font: FONT, color: '333333', bold: opts?.bold })
                ],
                spacing: { before: opts?.marginTop ?? 60, after: 0 },
                alignment: AlignmentType.JUSTIFIED
            })
        );
    };

    addP('Transport rur w średnicach DN 300 – DN 1600 odbywa się na jednorazowych podkładach drewnianych jako „Zabezpieczenie transportu\". Koszt podkładów zostanie zafakturowany na fakturze VAT wg poniższego zestawienia (wartości w tabeli podają cenę Zabezpieczenia transportu do jednej sztuki rury).');
    result.push(buildTransportSecurityTable());
    addP('Rozładunek studni w średnicach DN 1000 – DN 2000 i kręgów DN 1500 - DN 2000 odbywa się za pomocą pętli transportowych zgodnie z instrukcją montażu PV.');
    result.push(buildTransportLoopsTable());
    addP('Dla rur powyżej średnicy DN1200 oferujemy kotwy montażowe 45 PLN/szt. w rurze są montowane dwie kotwy. Sprzęgi uniwersalne mogą być przez nas dostarczane za kaucją 2300 PLN/szt., na wyraźne zamówienie. Po zwrocie w stanie nieuszkodzonym zostanie z kaucji potrącone 40% jako koszty własne P.V. Prefabet S.A. i amortyzacja.');
    addP('Do montażu studni i rur P.V. Prefabet Kluczbork S.A. oferuje środek poślizgowy w wiaderkach 5kg w cenie 225 PLN. Dedykowany środek poślizgowy ułatwia montaż, nie wpływa negatywnie na uszczelki przez co gwarantujemy szczelność naszych wyrobów. W celu prawidłowego montażu rur i studni do każdego transportu studni i co do drugiego transportu rur należy uwzględnić 5kg środka poślizgowego. Koszt środka poślizgowego stanowi osobną pozycję na fakturze. Zastosowanie innych środków o nieznanym składzie chemicznym może negatywnie wpłynąć na szczelność połączeń, a tym samym wyklucza odpowiedzialność gwarancyjną Producenta.');
    addP('Termin realizacji zamówienia: I partia towaru według indywidualnych ustaleń z doradcą techniczno-handlowym. Zamówienie należy złożyć w formie pisemnej z wszystkimi istotnymi parametrami potrzebnymi do zrealizowania zamówienia.', { bold: true });
    addP('Odstąpienie od złożonego zamówienia powoduje konieczność zapłaty 100% wartości wyprodukowanego towaru oraz pokrycie kosztów przygotowania produkcji.', { marginTop: 30 });
    addP('Technologia produkcji studni P.V. Prefabet Kluczbork S.A. pozwala na uformowanie przejścia szczelnego w betonie. Zastrzegamy sobie prawo dostawy studni z tego typu przejściami. Powyższe rozwiązanie gwarantuje pełną funkcjonalność i szczelność studni. Na wyraźną mailową prośbę zamawiającego P.V. Prefabet przygotuje ofertę z uwzględnieniem w wycenie oryginalnych przejść producenta rur lub zamienników tworzywowych w zależności od zapytania. Oferta wówczas zawiera odpowiedni zapis „przejścia producenta\" lub „zamienniki tworzywowe\". P.V. Prefabet oferuje przejścia szczelne z betonu dla rur: K2KAN, Incor, Pragma ID - DN600; DN500; DN400; DN300; DN250; DN200; X-Stream; Magnacor – DN300; DN250; DN200; PCV – DN600; GRP/GRK - DN600; DN500; DN400; DN300. Zastrzegamy sobie prawo do produkcji studni z przejściami betonowymi dla innych rodzajów rur i średnic.');
    addP('Włączenia kanałów w studniach monolitycznych „Unolith\" oraz studnie z wkładką „PRECO\" są wykonywane w linii górnej.');
    addP('Ceny podane w ofercie uwzględniają rabat obowiązujący przy terminowym uregulowaniu należności oraz przy zamówieniu całości asortymentu objętego ofertą.');
    addP('Po otrzymaniu zamówienia na kwotą wyższą niż 50 tys. PLN netto P.V. Prefabet Kluczbork S.A. przedstawi umowę określającą warunki dostaw, która zostanie podpisana przed rozpoczęciem dostaw. P.V. Prefabet Kluczbork S.A. ubezpiecza wszystkie transakcje z odroczonym terminem płatności, w związku z tym sprzedaż na przelew może nastąpić po weryfikacji przez firmę ubezpieczeniową i ubezpieczeniu transakcji. Procedura ubezpieczenia trwa do 10 dni roboczych, a wszelkie formalności i koszty leżą po stronie P.V. Prefabet Kluczbork S.A.');
    addP('Wszelkie spory mogące wyniknąć w związku z realizacją zamówienia, Strony poddają pod rozstrzygnięcie sądu powszechnego właściwego dla siedziby Dostawcy.');
    addP('Niewymienione elementy dodatkowe (elementy do wbudowania, powłoki itp.) nie są częścią tej oferty. Wszelkie zmiany ilościowe bądź jakościowe w zamówieniu korygowane będą poprzez wystawienie kolejnej oferty cenowej lub ustaleniach między stronami. Cena loco budowa przy zamówieniu na całość zadania i dostawie pełnych transportów 24-tonowych. W przypadku niepełnych dostaw zostanie doliczony dodatkowy koszt transportu.');
    addP('Drogi dojazdowe do miejsca budowy muszą być przejezdne dla pojazdów ciężkich (ładowność 24 tony). Zleceniodawca jest odpowiedzialny za zapewnienie odpowiedniego dojazdu i miejsca rozładunku na budowie. Rozładunek oraz wynajęcie dźwigu na miejscu budowy leży po stronie zamawiającego. Oferta standardowa obejmuje jedno miejsce rozładunku. W przypadku, gdy miejsc rozładunku jest więcej - za każde dodatkowe miejsce rozładunku klient płaci 500 PLN. Standardowy czas rozładunku wyrobów wynosi maksymalnie do 1,5 godz. Za każdą następną rozpoczętą godzinę klient zapłaci 200 PLN netto. Czas liczony jest od momentu zgłoszenia przez kierowcę osobie upoważnionej gotowości do rozładunku.');
    addP('W przypadku wzrostu cen materiałów wsadowych (cement, kruszywa, usługi transportowe itp.) powyżej 3 % zastrzegamy sobie prawo zmiany cen.');
    addP('Na oferowane prefabrykaty betonowe i żelbetowe udzielamy 36 miesięcy gwarancji licząc od daty podpisania dokumentu WZ pod warunkiem montażu ze sztuką budowlaną i zgodnie z dokumentacją techniczną producenta (instrukcje montażu wyrobów do pobrania na stronie www.pv-prefabet.com.pl). W zamówieniach prosimy powoływać się na nr niniejszej oferty.');
    addP('Parametry techniczne oferowanych wyrobów, według odpowiednich deklaracji dostępnych na https://www.pv-prefabet.com.pl lub po przesłaniu przez odpowiedni dział P.V. Prefabet Kluczbork S.A.');
    addP('Obligatoryjnym załącznikiem do niniejszej oferty są Ogólne Warunki Sprzedaży dostępne na stronie internetowej www.pv-prefabet.com.pl oraz Polityka Prywatności dostępna na stronie internetowej www.pv-prefabet.com.pl/rodo-dane');

    result.push(
        new Paragraph({
            children: [
                new TextRun({ text: 'Dziękujemy Państwu za zainteresowanie ofertą naszej firmy i mamy nadzieję na dalszą owocną współpracę.', bold: true, size: SZ_THANKS, font: FONT, color: '333333' })
            ],
            spacing: { before: 100, after: 40 }
        })
    );

    return result;
}

// ─── Tabele transportowe ────────────────────────────────────────────

function buildTransportSecurityTable(): Table {
    const thStyle = { bold: true, size: SZ_TERMS_TABLE, fill: COLOR_BG_SUMMARY, alignment: AlignmentType.CENTER };
    const tdStyle = { size: SZ_TERMS_TABLE };
    const tdcStyle = { size: SZ_TERMS_TABLE, alignment: AlignmentType.CENTER };

    const data: [string, string][] = [
        ['DN 300', '13,00'], ['DN 400', '13,00'], ['DN 500', '14,00'],
        ['DN 600', '20,00'], ['DN 800', '20,00'], ['DN 1000', '40,00'],
        ['DN 1200', '50,00'], ['DN 1400', '90,00'], ['DN 1500', '90,00'],
        ['DN 1600', '90,00'], ['DN 1800', '230,00'], ['DN 2000', '310,00']
    ];

    const rows: TableRow[] = [
        new TableRow({
            children: [
                textCell('Zabezpieczenie transportu wg średnicy rur', { ...thStyle, width: 35 }),
                textCell('Cena netto [PLN]', { ...thStyle, width: 15 }),
                textCell('Zabezpieczenie transportu wg średnicy rur', { ...thStyle, width: 35 }),
                textCell('Cena netto [PLN]', { ...thStyle, width: 15 })
            ]
        })
    ];

    for (let i = 0; i < 6; i++) {
        const left = data[i];
        const right = data[i + 6];
        rows.push(
            new TableRow({
                children: [
                    textCell(`Zabezpieczenie transportu ${left[0]}`, { ...tdStyle }),
                    textCell(left[1], { ...tdcStyle }),
                    textCell(right ? `Zabezpieczenie transportu ${right[0]}` : '', { ...tdStyle }),
                    textCell(right ? right[1] : '', { ...tdcStyle })
                ]
            })
        );
    }

    rows.push(
        new TableRow({
            children: [
                textCell('Zabezpieczenie transportu WPUST ULICZNY', { ...tdStyle }),
                textCell('14,00', { ...tdcStyle }),
                textCell('', { ...tdStyle, columnSpan: 2 })
            ]
        })
    );

    return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } });
}

function buildTransportLoopsTable(): Table {
    const thStyle = { bold: true, size: SZ_TERMS_TABLE, fill: COLOR_BG_SUMMARY, alignment: AlignmentType.CENTER };
    const tdStyle = { size: SZ_TERMS_TABLE };
    const tdcStyle = { size: SZ_TERMS_TABLE, alignment: AlignmentType.CENTER };

    const loopData: [string, string, string, string, string][] = [
        ['Pętle transportowe dla studni DN1000', 'RD16', '65,00', '3', '195,00'],
        ['Pętle transportowe dla studni DN1200', 'RD18', '70,00', '3', '210,00'],
        ['Pętle transportowe dla studni DN1500', 'RD24', '80,00', '4', '320,00'],
        ['Pętle transportowe dla studni DN2000', 'RD36', '135,00', '4', '540,00'],
        ['Pętle transportowe dla kręgów DN1500', 'RD16', '65,00', '3', '195,00'],
        ['Pętle transportowe dla kręgów DN2000', 'RD16', '65,00', '3', '195,00']
    ];

    const rows: TableRow[] = [
        new TableRow({
            children: [
                textCell('Pętle transportowe wg średnic studni', { ...thStyle, width: 40 }),
                textCell('Oznaczenie pętli', { ...thStyle, width: 15 }),
                textCell('Cena za sztukę [PLN]', { ...thStyle, width: 15 }),
                textCell('Ilość szt. na komplet', { ...thStyle, width: 15 }),
                textCell('Cena kompletu [PLN]', { ...thStyle, width: 15 })
            ]
        })
    ];

    for (const [name, oznaczenie, cena, ilosc, komplet] of loopData) {
        rows.push(
            new TableRow({
                children: [
                    textCell(name, { ...tdStyle }),
                    textCell(oznaczenie, { ...tdcStyle }),
                    textCell(cena, { ...tdcStyle }),
                    textCell(ilosc, { ...tdcStyle }),
                    textCell(komplet, { ...tdcStyle })
                ]
            })
        );
    }

    return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } });
}
