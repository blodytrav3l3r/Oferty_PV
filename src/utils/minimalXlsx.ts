/**
 * Minimalny builder XLSX (bez nowych zależności — jszip już w projekcie).
 * Jeden arkusz = nagłówek + wiersze inline strings; Excel/Libre otwierają
 * bez ostrzeżeń. Wystarcza pod GET /:id/export (format danych jak
 * frontendowy pricelistImportExport.js: jeden wiersz = jedna pozycja).
 */

import JSZip from 'jszip';

export interface XlsxSheet {
    name: string;
    headers: string[];
    rows: Array<Array<string | number | boolean | null | undefined>>;
}

/** Escape XML + odrzucenie niedozwolonych znaków kontrolnych (poza \n \r \t). */
function escapeXml(value: string): string {
    let out = '';
    for (const ch of value) {
        const code = ch.codePointAt(0) ?? 32;
        if (code < 32 && ch !== '\n' && ch !== '\r' && ch !== '\t') continue;
        out += ch;
    }
    return out
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

// Nazwa arkusza jak we frontendzie: bez nawiasów i znakow [ ] * / \ ? : (limit 31).
export function sanitizeSheetName(name: string): string {
    const clean = name.replace(/[[\\\]*/\\?:]/g, '_').slice(0, 31);
    return clean === '' ? 'Arkusz' : clean;
}

function cellToInlineStr(value: string | number | boolean | null | undefined): string {
    const text = value === null || value === undefined ? '' : String(value);
    return `<c t="inlineStr"><is><t>${escapeXml(text)}</t></is></c>`;
}

function sheetXml(sheet: XlsxSheet): string {
    const header = sheet.headers.map((h) => cellToInlineStr(h)).join('');
    const body = sheet.rows
        .map((row) => `<row>${row.map((v) => cellToInlineStr(v)).join('')}</row>`)
        .join('');
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        `<sheetData><row>${header}</row>${body}</sheetData></worksheet>`
    );
}

export async function buildXlsx(sheets: XlsxSheet[]): Promise<Buffer> {
    const zip = new JSZip();
    const names = sheets.map((s, i) => sanitizeSheetName(s.name) || `Arkusz${i + 1}`);

    zip.file(
        '[Content_Types].xml',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
            '<Default Extension="xml" ContentType="application/xml"/>' +
            '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
            names
                .map(
                    (_, i) =>
                        `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ` +
                        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
                )
                .join('') +
            '</Types>'
    );
    zip.file(
        '_rels/.rels',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
            '</Relationships>'
    );
    zip.file(
        'xl/workbook.xml',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
            '<sheets>' +
            names
                .map(
                    (n, i) =>
                        `<sheet name="${escapeXml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`
                )
                .join('') +
            '</sheets></workbook>'
    );
    zip.file(
        'xl/_rels/workbook.xml.rels',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
            names
                .map(
                    (_, i) =>
                        `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
                )
                .join('') +
            '</Relationships>'
    );
    sheets.forEach((sheet, i) => {
        zip.file(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(sheet));
    });
    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
