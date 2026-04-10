import { Paragraph, TextRun, TableCell, WidthType, AlignmentType, ShadingType } from 'docx';
import fs from 'fs';
import path from 'path';
import { FONT, COLOR_BODY, SZ_TABLE_BODY, CELL_BORDERS, type CellBorders } from './constants';
import { logger } from '../../utils/logger';

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

// ─── Ładowanie obrazów ──────────────────────────────────────────────

export function loadImageData(filename: string): Buffer | null {
    const filePath = path.join(process.cwd(), 'public', 'templates', filename);
    try {
        return fs.readFileSync(filePath);
    } catch {
        logger.warn('DocxHelpers', `Brak pliku ${filename}`);
        return null;
    }
}
