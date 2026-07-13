import { Paragraph, TextRun, Table, TableRow, TableCell, BorderStyle, ShadingType } from 'docx';
import { DOCX_COLORS } from '../colors';
import { FONT, COLOR_BODY, COLOR_GRAY_HEADER, SZ_TABLE_BODY, CELL_BORDERS } from '../constants';
import {
    sectionRow,
    infoRow,
    infoSection,
    transitionHeaderRow,
    transitionDataRow,
    SPACER
} from './kartaBudowyHelpers';

export function buildTitleSection(nrZamowienia: string): (Paragraph | Table)[] {
    return [
        new Paragraph({
            alignment: 'CENTER' as any,
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
        }),
        new Paragraph({
            alignment: 'CENTER' as any,
            spacing: { before: 60, after: 200 },
            children: [
                new TextRun({
                    text: `Nr zamówienia: ${nrZamowienia}`,
                    bold: true,
                    size: 20,
                    font: FONT,
                    color: '666666'
                })
            ]
        })
    ];
}

export function buildInfoSections(kb: Record<string, unknown>): (Paragraph | Table)[] {
    const children: (Paragraph | Table)[] = [];

    children.push(
        ...infoSection('Podstawowe Informacje', [
            infoRow('Nr powiązanej oferty', String(kb.offerNumbers || '—')),
            infoRow('Data zamówienia', String(kb.dataZamowienia || '—')),
            infoRow('Osoba kontaktowa', String(kb.osobaKontakt || '—')),
            infoRow('Adres wysyłki', String(kb.adresWysylki || '—')),
            infoRow('E-mail (Faktura)', String(kb.emailFaktura || '—')),
            infoRow('E-mail (e-Faktura)', String(kb.emailEfaktura || '—'))
        ])
    );

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

    children.push(
        ...infoSection('Studnia i Beton', [
            infoRow('Rodzaj studni', String(kb.rodzajStudni || '—')),
            infoRow('Właściwości betonu', String(kb.wlasciwosciBetonu || '—')),
            infoRow('Pozostałe właściwości', String(kb.pozostaleWlasciwosci || '—')),
            infoRow(
                'Rodzaj stopni',
                String(kb.rodzajStopni || '—') +
                    (kb.rodzajStopniInne ? ` (${kb.rodzajStopniInne})` : '')
            ),
            infoRow(
                'Uszczelka studni',
                String(kb.uszczelkaStudni || '—') +
                    (kb.uszczelkaStudniInne ? ` (${kb.uszczelkaStudniInne})` : '')
            )
        ])
    );

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

    children.push(
        ...infoSection('Przejścia', [
            infoRow('Przejścia szczelne', String(kb.przejsciaSzczelne || '—')),
            infoRow('Przejścia tulejowe', String(kb.przejsciaTulejowe || '—')),
            infoRow('Przejścia zamówione w', String(kb.przejsciaZamowione || '—'))
        ])
    );

    return children;
}

export function buildTransitionTable(kb: Record<string, unknown>): (Paragraph | Table)[] {
    const children: (Paragraph | Table)[] = [];
    const pd = kb.przejsciaDetails;
    if (Array.isArray(pd) && pd.length > 0) {
        children.push(
            new Table({
                width: { size: 100, type: 'PERCENTAGE' as any },
                rows: [
                    sectionRow('Szczegóły przejść', 6),
                    transitionHeaderRow(),
                    ...pd.map((p: any, idx: number) => transitionDataRow(p, idx))
                ]
            })
        );
        children.push(SPACER);
    }
    return children;
}

export function buildUwagiSection(kb: Record<string, unknown>): Table {
    const uwagiText = String(kb.uwagiOgolne || '—');
    const uwagiLines = uwagiText.split('\n');
    const uwagiRuns = uwagiLines.flatMap((line, i) => [
        ...(i > 0 ? [new TextRun({ break: 1 })] : []),
        new TextRun({ text: line, size: SZ_TABLE_BODY, font: FONT, color: COLOR_BODY })
    ]);

    return new Table({
        width: { size: 100, type: 'PERCENTAGE' as any },
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
    });
}
