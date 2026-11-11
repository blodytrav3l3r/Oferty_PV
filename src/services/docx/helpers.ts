import {
    Paragraph,
    TextRun,
    TableCell,
    TableRow,
    WidthType,
    AlignmentType,
    ShadingType
} from 'docx';
import fs from 'fs';
import path from 'path';
import {
    FONT,
    COLOR_BODY,
    SZ_TABLE_BODY,
    CELL_BORDERS,
    BORDER_DOTTED,
    BORDER_NONE,
    type CellBorders
} from './constants';
import { logger } from '../../utils/logger';
import { resolvePublicDir } from '../../utils/paths';

// ─── Formatowanie wartości ──────────────────────────────────────────

export function fmtCurrency(val: number): string {
    return val.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtInt(val: number): string {
    return val.toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function fmtDate(dateStr: string): string {
    try {
        return new Date(dateStr).toLocaleDateString('pl-PL');
    } catch {
        return dateStr;
    }
}

// ─── Stempel uszkodzonych danych (A-01) ─────────────────────────────────
// Best-effort render z nieparsowalnego bloba JSON MUSI być jawnie oznaczony,
// żeby dokument nie wyglądał na ważny. Statyczny tekst, brak interpolacji.
export function buildCorruptedBanner(): Paragraph {
    return new Paragraph({
        children: [
            new TextRun({
                text: 'DANE_USZKODZONE — dokument wygenerowany z niepełnych danych (uszkodzony zapis oferty/zamówienia). Nie używać jako ważny dokument.',
                bold: true,
                color: 'CC0000'
            })
        ]
    });
}

// ─── Budowanie komórek tabeli ───────────────────────────────────────

/** Tworzy komórkę tabeli z tekstem — reużywalny helper */
export function textCell(
    text: string,
    opts: {
        bold?: boolean;
        size?: number;
        alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
        fill?: string;
        color?: string;
        width?: number;
        columnSpan?: number;
        borders?: CellBorders;
    } = {}
): TableCell {
    return new TableCell({
        children: [
            new Paragraph({
                children: [
                    new TextRun({
                        text,
                        bold: opts.bold ?? false,
                        size: opts.size ?? SZ_TABLE_BODY,
                        font: FONT,
                        color: opts.color ?? COLOR_BODY
                    })
                ],
                alignment: opts.alignment ?? AlignmentType.LEFT,
                spacing: { before: 15, after: 15 }
            })
        ],
        width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
        columnSpan: opts.columnSpan,
        shading: opts.fill
            ? { type: ShadingType.SOLID, color: opts.fill, fill: opts.fill }
            : undefined,
        borders: opts.borders ?? CELL_BORDERS
    });
}

// ─── Wiersze kontaktów (jedna osoba = jedna linia) ──────────────

export interface ContactRowData {
    name?: string;
    phone?: string;
    email?: string;
}

/**
 * Nagłówek + po jednym wierszu na osobę: imię i nazwisko | telefon | e-mail.
 * Szerokości procentowe sumują się do 100.
 */
export function contactRows(contacts: ContactRowData[]): TableRow[] {
    const dotted: CellBorders = {
        top: BORDER_NONE,
        bottom: BORDER_DOTTED,
        left: BORDER_NONE,
        right: BORDER_NONE
    };
    const cells = (name: string, phone: string, email: string, bold = false) => [
        textCell(name, { bold, width: 42, size: SZ_TABLE_BODY, borders: dotted }),
        textCell(phone, { bold, width: 25, size: SZ_TABLE_BODY, borders: dotted }),
        textCell(email, { bold, width: 33, size: SZ_TABLE_BODY, borders: dotted })
    ];
    const head = new TableRow({
        children: cells('Imię i nazwisko', 'Telefon', 'E-mail', true)
    });
    const body = (contacts.length ? contacts : [{}]).map(
        (c) =>
            new TableRow({
                children: cells(c.name || '—', c.phone || '—', c.email || '—')
            })
    );
    return [head, ...body];
}

// ─── Ładowanie obrazów ──────────────────────────────────────────────

export function loadImageData(filename: string): Buffer | null {
    const filePath = path.join(resolvePublicDir(), 'images', filename);
    try {
        return fs.readFileSync(filePath);
    } catch {
        logger.warn('DocxHelpers', `Brak pliku ${filename}`);
        return null;
    }
}
