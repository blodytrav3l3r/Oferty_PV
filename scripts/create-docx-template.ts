/**
 * Skrypt do generowania szablonu DOCX dla ofert studni
 * Uruchom: npx ts-node scripts/create-docx-template.ts
 */

import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, Header, Footer, PageNumber, BorderStyle } from 'docx';
import fs from 'fs';
import path from 'path';

async function createTemplate() {
  const doc = new Document({
    styles: {
      paragraphStyles: [
        {
          id: 'Title',
          name: 'Title',
          run: { size: 28, bold: true, color: '333333' },
          paragraph: { alignment: AlignmentType.CENTER, spacing: { after: 200 } },
        },
        {
          id: 'Heading1',
          name: 'Heading 1',
          run: { size: 24, bold: true, color: '666666' },
          paragraph: { spacing: { before: 240, after: 120 } },
        },
        {
          id: 'Heading2',
          name: 'Heading 2',
          run: { size: 20, bold: true, color: '999999' },
          paragraph: { spacing: { before: 180, after: 80 } },
        },
        {
          id: 'Normal',
          name: 'Normal',
          run: { size: 20, font: 'Arial' },
          paragraph: { spacing: { after: 80 } },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, right: 1080, bottom: 1440, left: 1080 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: 'WITROS', bold: true, size: 32, color: '333333', font: 'Arial' }),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { after: 60 },
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: 'Oferta handlowa - Studnie żelbetowe', size: 18, color: '666666', font: 'Arial' }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: 'Oferta ważna przez 30 dni od daty wystawienia | WITROS - Generator Ofert', size: 14, color: '999999', font: 'Arial' }),
                ],
                alignment: AlignmentType.CENTER,
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: 'Strona ', size: 14, color: '999999' }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 14, color: '999999' }),
                  new TextRun({ text: ' z ', size: 14, color: '999999' }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 14, color: '999999' }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
        },
        children: [
          // Title
          new Paragraph({
            children: [
              new TextRun({ text: 'OFERTA HANDLOWA {nr_oferty}', bold: true, size: 28, color: '333333', font: 'Arial' }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),

          // Offer meta
          new Paragraph({
            children: [
              new TextRun({ text: 'Data przygotowania: ', bold: true, size: 20, font: 'Arial' }),
              new TextRun({ text: '{data_oferty}', size: 20, font: 'Arial' }),
            ],
            spacing: { after: 60 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Data ważności: ', bold: true, size: 20, font: 'Arial' }),
              new TextRun({ text: '{data_waznosci}', size: 20, font: 'Arial' }),
            ],
            spacing: { after: 200 },
          }),

          // Client data
          new Paragraph({
            children: [
              new TextRun({ text: 'Dane klienta', bold: true, size: 22, color: '666666', font: 'Arial' }),
            ],
            spacing: { before: 200, after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '{klient_nazwa}', bold: true, size: 20, font: 'Arial' }),
            ],
            spacing: { after: 40 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '{klient_adres}', size: 20, font: 'Arial' }),
            ],
            spacing: { after: 40 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'NIP: {klient_nip}', size: 20, font: 'Arial' }),
            ],
            spacing: { after: 40 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Kontakt: {klient_telefon}', size: 20, font: 'Arial' }),
            ],
            spacing: { after: 200 },
          }),

          // Investment data
          new Paragraph({
            children: [
              new TextRun({ text: 'Dane inwestycji', bold: true, size: 22, color: '666666', font: 'Arial' }),
            ],
            spacing: { before: 200, after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Budowa: {inwestycja_nazwa}', bold: true, size: 20, font: 'Arial' }),
            ],
            spacing: { after: 40 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Adres: {inwestycja_adres}', size: 20, font: 'Arial' }),
            ],
            spacing: { after: 200 },
          }),

          // Products table header
          new Paragraph({
            children: [
              new TextRun({ text: 'Pozycje ofertowe', bold: true, size: 22, color: '666666', font: 'Arial' }),
            ],
            spacing: { before: 200, after: 100 },
          }),

          // Table header row
          new Table({
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: 'Lp.', bold: true, size: 16, font: 'Arial' })], alignment: AlignmentType.CENTER })],
                    width: { size: 8, type: WidthType.PERCENTAGE },
                    shading: { fill: 'E0E0E0' },
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: 'Nazwa elementu', bold: true, size: 16, font: 'Arial' })], alignment: AlignmentType.CENTER })],
                    width: { size: 35, type: WidthType.PERCENTAGE },
                    shading: { fill: 'E0E0E0' },
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: 'Ilość', bold: true, size: 16, font: 'Arial' })], alignment: AlignmentType.CENTER })],
                    width: { size: 10, type: WidthType.PERCENTAGE },
                    shading: { fill: 'E0E0E0' },
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: 'Rabat', bold: true, size: 16, font: 'Arial' })], alignment: AlignmentType.CENTER })],
                    width: { size: 10, type: WidthType.PERCENTAGE },
                    shading: { fill: 'E0E0E0' },
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: 'Cena netto [zł]', bold: true, size: 16, font: 'Arial' })], alignment: AlignmentType.CENTER })],
                    width: { size: 17, type: WidthType.PERCENTAGE },
                    shading: { fill: 'E0E0E0' },
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: 'Wartość netto [zł]', bold: true, size: 16, font: 'Arial' })], alignment: AlignmentType.CENTER })],
                    width: { size: 20, type: WidthType.PERCENTAGE },
                    shading: { fill: 'E0E0E0' },
                  }),
                ],
              }),
              // Example row with placeholders
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '1', size: 18, font: 'Arial' })], alignment: AlignmentType.CENTER })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Przykładowy produkt', size: 18, font: 'Arial' })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '10', size: 18, font: 'Arial' })], alignment: AlignmentType.CENTER })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '—', size: 18, font: 'Arial' })], alignment: AlignmentType.CENTER })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '1 000,00 zł', size: 18, font: 'Arial' })], alignment: AlignmentType.RIGHT })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '10 000,00 zł', size: 18, font: 'Arial' })], alignment: AlignmentType.RIGHT })] }),
                ],
              }),
            ],
            width: { size: 100, type: WidthType.PERCENTAGE },
          }),

          new Paragraph({
            children: [
              new TextRun({ text: '(Tabela produktów generowana automatycznie - grupowanie po DN)', size: 14, color: '999999', italics: true, font: 'Arial' }),
            ],
            spacing: { before: 60, after: 200 },
          }),

          // Summary
          new Paragraph({
            children: [
              new TextRun({ text: 'Podsumowanie oferty', bold: true, size: 22, color: '666666', font: 'Arial' }),
            ],
            spacing: { before: 200, after: 100 },
          }),
          new Table({
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: 'Wartość netto elementów:', size: 20, font: 'Arial' })] })],
                    width: { size: 70, type: WidthType.PERCENTAGE },
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: '{wartosc_elementow}', bold: true, size: 20, font: 'Arial' })], alignment: AlignmentType.RIGHT })],
                    width: { size: 30, type: WidthType.PERCENTAGE },
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: 'Koszt transportu:', size: 20, font: 'Arial' })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: '{koszt_transportu}', size: 20, font: 'Arial' })], alignment: AlignmentType.RIGHT })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: 'RAZEM NETTO:', bold: true, size: 24, font: 'Arial' })] })],
                    shading: { fill: 'F0F0F0' },
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: '{razem_netto}', bold: true, size: 24, color: '333333', font: 'Arial' })], alignment: AlignmentType.RIGHT })],
                    shading: { fill: 'F0F0F0' },
                  }),
                ],
              }),
            ],
            width: { size: 100, type: WidthType.PERCENTAGE },
          }),

          // Notes
          new Paragraph({
            children: [
              new TextRun({ text: 'Uwagi', bold: true, size: 22, color: '666666', font: 'Arial' }),
            ],
            spacing: { before: 300, after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '{uwagi}', size: 20, font: 'Arial' }),
            ],
            spacing: { after: 200 },
          }),

          // Standard terms
          new Paragraph({
            children: [
              new TextRun({ text: 'Standardowe warunki dostawy', bold: true, size: 18, color: '999999', font: 'Arial' }),
            ],
            spacing: { before: 300, after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '1. Termin realizacji zamówienia: według indywidualnych ustaleń z doradcą techniczno-handlowym.', size: 16, font: 'Arial' }),
            ],
            spacing: { after: 40 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '2. Warunki płatności: do uzgodnienia. Oferta ważna przez 30 dni od daty wystawienia.', size: 16, font: 'Arial' }),
            ],
            spacing: { after: 40 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '3. Transport: loco budowa przy zamówieniu na całość zadania.', size: 16, font: 'Arial' }),
            ],
            spacing: { after: 40 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '4. Gwarancja: 36 miesięcy od daty podpisania dokumentu WZ.', size: 16, font: 'Arial' }),
            ],
            spacing: { after: 40 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '5. Ceny mogą ulec zmianie w przypadku wzrostu cen materiałów wsadowych powyżej 3%.', size: 16, font: 'Arial' }),
            ],
            spacing: { after: 200 },
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const outputPath = path.join(process.cwd(), 'public', 'templates', 'oferta_studnie_template.docx');
  fs.writeFileSync(outputPath, buffer);
  console.log(`Szablon zapisany: ${outputPath}`);
}

createTemplate().catch(console.error);