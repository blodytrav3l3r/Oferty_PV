import { Paragraph, TextRun, Header, Footer, PageNumber, ImageRun, AlignmentType } from 'docx';
import { FONT, COLOR_GRAY_HEADER } from './constants';
import { loadImageData } from './helpers';

// ─── Nagłówek / Stopka z obrazkami ─────────────────────────────────

/** Buduje natywny Header z obrazkiem naglowek.png (identyczny jak w PDF) */
export function buildImageHeader(): Header {
    const imgData = loadImageData('naglowek.png');
    if (!imgData) {
        return new Header({
            children: [
                new Paragraph({
                    children: [
                        new TextRun({
                            text: 'P.V. PREFABET KLUCZBORK S.A.',
                            bold: true,
                            size: 28,
                            font: FONT,
                            color: 'CC0000'
                        })
                    ],
                    alignment: AlignmentType.CENTER
                })
            ]
        });
    }

    // naglowek.png: 808x174px → szerokość strony minus marginesy ≈ 190mm ≈ 680pt
    return new Header({
        children: [
            new Paragraph({
                children: [
                    new ImageRun({
                        data: imgData,
                        transformation: { width: 680, height: Math.round(680 * (174 / 808)) },
                        type: 'png'
                    })
                ],
                alignment: AlignmentType.CENTER,
                spacing: { after: 60 }
            })
        ]
    });
}

/** Buduje natywny Footer z obrazkiem stopka.png + numeracja stron */
export function buildImageFooter(): Footer {
    const imgData = loadImageData('stopka.png');
    const children: Paragraph[] = [];

    if (imgData) {
        children.push(
            new Paragraph({
                children: [
                    new ImageRun({
                        data: imgData,
                        transformation: { width: 680, height: Math.round(680 * (103 / 771)) },
                        type: 'png'
                    })
                ],
                alignment: AlignmentType.CENTER,
                spacing: { before: 20 }
            })
        );
    }

    children.push(
        new Paragraph({
            children: [
                new TextRun({ text: 'Strona ', size: 14, color: COLOR_GRAY_HEADER, font: FONT }),
                new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 14,
                    color: COLOR_GRAY_HEADER,
                    font: FONT
                }),
                new TextRun({ text: ' z ', size: 14, color: COLOR_GRAY_HEADER, font: FONT }),
                new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 14,
                    color: COLOR_GRAY_HEADER,
                    font: FONT
                })
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 140, after: 140 } // połowa z 280, obniżone o 50%
        })
    );

    return new Footer({ children });
}
