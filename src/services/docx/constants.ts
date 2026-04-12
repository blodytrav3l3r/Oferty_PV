import { BorderStyle } from 'docx';

// ─── Stałe stylów (dopasowane 1:1 do oferta_studnie.html) ──────────

export const FONT = 'Arial';
export const COLOR_BODY = '1a1a2e';
export const COLOR_GRAY_HEADER = '999999'; // .dn-header, tło th tabeli, tło .grand-total
export const COLOR_WHITE = 'FFFFFF';
export const COLOR_LABEL = '888888'; // .info-box h3
export const COLOR_BORDER = 'CCCCCC'; // obramowanie td tabeli (border)

export const COLOR_BG_SUMMARY = 'F0F0F0'; // .dn-summary-row, nagłówki tabel transportowych
export const COLOR_BG_NOTE = 'FFFBE6'; // .note-box
export const COLOR_NOTE_BORDER = 'F5A623'; // lewe obramowanie .note-box

export type BorderDef = {
    style: (typeof BorderStyle)[keyof typeof BorderStyle];
    size: number;
    color: string;
};
export type CellBorders = { top: BorderDef; bottom: BorderDef; left: BorderDef; right: BorderDef };

export const BORDER_THIN: BorderDef = { style: BorderStyle.SINGLE, size: 1, color: COLOR_BORDER };
export const BORDER_NONE: BorderDef = { style: BorderStyle.NONE, size: 0, color: COLOR_WHITE };
export const NO_BORDERS: CellBorders = {
    top: BORDER_NONE,
    bottom: BORDER_NONE,
    left: BORDER_NONE,
    right: BORDER_NONE
};
export const CELL_BORDERS: CellBorders = {
    top: BORDER_THIN,
    bottom: BORDER_THIN,
    left: BORDER_THIN,
    right: BORDER_THIN
};

// Rozmiary czcionek w półpunktach (half-points) (1pt = 2 half-points) — z CSS szablonu
export const SZ_TITLE = 32; // 16pt — tytuł oferty (.offer-title)
export const SZ_BODY = 20; // 10pt — body
export const SZ_TABLE_BODY = 18; // 9pt  — tabela ofertowa (.offer-table) / warunki (.conditions)
export const SZ_TABLE_HEADER = 16; // 8pt  — nagłówek tabeli ofertowej (.offer-table th)
export const SZ_ZWIENCZENIE = 17; // 8.4pt — .zwienczenie-cell
export const SZ_INFO_BOX = 18; // 9pt  — .info-box
export const SZ_INFO_LABEL = 16; // 8pt  — .info-box h3
export const SZ_DN_HEADER = 22; // 11pt — .dn-header
export const SZ_SUMMARY = 20; // 10pt — table.summary-table
export const SZ_GRAND_TOTAL = 22; // 11pt — .grand-total
export const SZ_TERMS = 16; // 8pt  — .standard-terms
export const SZ_TERMS_TABLE = 15; // 7.5pt — tabele transportowe
export const SZ_TERMS_HEADER = 18; // 9pt  — nagłówek warunków
export const SZ_THANKS = 17; // 8.5pt — podziękowanie
