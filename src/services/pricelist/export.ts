/**
 * pricelist/export — odczyt zamrożonej wersji (biznesowe id) i arkusze
 * eksportu w shape LIVE. Kod przeniesiony 1:1 z pricelistVersionService.ts.
 */

import prisma from '../../prismaClient';
import type { PricelistVersion } from '../../../generated/prisma';
import type { XlsxSheet } from '../../utils/minimalXlsx';
import { diffById } from '../priceOverrideService';
import {
    PricelistVersionError,
    isPricelistType,
    loadVersionItems,
    toComparable
} from './validation';
import type { PricelistType } from './validation';
import { projectVersionToLiveShape } from './liveProjection';
import type { LiveSheetRows } from './liveProjection';

export interface VersionExport {
    version: PricelistVersion;
    sections: Record<string, Array<Record<string, unknown>>>;
}

function toXlsxCell(value: unknown): string | number | boolean | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }
    return String(value);
}

/**
 * Arkusze LIVE → wiersze buildXlsx (nagłówki z pierwszego wiersza).
 * Pusto → 1 pusty arkusz fallback (jak GET /:id/export wersji).
 */
export function liveSheetsToXlsxSheets(live: LiveSheetRows, fallbackName: string): XlsxSheet[] {
    const sheets: XlsxSheet[] = Object.entries(live).map(([name, rows]) => {
        const headers = rows.length > 0 ? Object.keys(rows[0]) : ['id'];
        return {
            name,
            headers,
            rows: rows.map((row) => headers.map((h) => toXlsxCell(row[h])))
        };
    });
    return sheets.length > 0 ? sheets : [{ name: fallbackName, headers: ['id'], rows: [] }];
}

/** Wiersze wersji z biznesowymi id (bez prefiksu versionId:) — pod diff/eksport. */
export async function getVersionExport(id: string): Promise<VersionExport> {
    const version = await prisma.pricelistVersion.findUnique({ where: { id } });
    if (!version) {
        throw new PricelistVersionError(404, 'NOT_FOUND', `Wersja ${id} nie istnieje`);
    }
    if (!isPricelistType(version.type)) {
        throw new PricelistVersionError(422, 'INVALID_TYPE', `Wersja ${id} ma nieznany typ`);
    }
    const items = await loadVersionItems(prisma, version.type, version.id);
    const sections: VersionExport['sections'] = {};
    for (const [key, rows] of Object.entries(items)) {
        sections[key] = toComparable(rows, version.id);
    }
    return { version, sections };
}

export interface VersionDiff {
    version: string;
    previousVersion: string | null;
    sections: Record<string, { added: number; removed: number; changed: number }>;
}

/** Diff wersji względem poprzedniej (seq-1) przez diffById. */
export async function getVersionDiff(id: string): Promise<VersionDiff> {
    const current = await prisma.pricelistVersion.findUnique({ where: { id } });
    if (!current) {
        throw new PricelistVersionError(404, 'NOT_FOUND', `Wersja ${id} nie istnieje`);
    }
    if (!isPricelistType(current.type)) {
        throw new PricelistVersionError(422, 'INVALID_TYPE', `Wersja ${id} ma nieznany typ`);
    }
    const type = current.type;
    const previous = await prisma.pricelistVersion.findFirst({
        where: { type, seq: current.seq - 1 }
    });
    const curItems = await loadVersionItems(prisma, type, current.id);
    const prevItems = previous
        ? await loadVersionItems(prisma, type, previous.id)
        : Object.fromEntries(Object.keys(curItems).map((k) => [k, []]));
    const sections: VersionDiff['sections'] = {};
    for (const key of Object.keys(curItems)) {
        sections[key] = diffById(
            toComparable(prevItems[key] ?? [], previous?.id ?? ''),
            toComparable(curItems[key], current.id)
        );
    }
    return { version: current.version, previousVersion: previous?.version ?? null, sections };
}

/**
 * Arkusze eksportu wersji (shape LIVE) — domknięcie asymetrii LIVE vs VERSION.
 * LIVE (GET /api/products-studnie/export.xlsx, F1) dokleja PRECO po arkuszach
 * studni; eksport zamrożonej wersji studni robi to samo: najnowsza wersja
 * PRECO nie nowsza niż eksportowana (seq <=, dowolny status — snapshot),
 * arkusze PO studni (merge {...studnie, ...preco} jak w F1). Brak starszej
 * lub równej PRECO → tylko studnie (bez błędu, flaga precoIncluded=false).
 * Rury i preco bez zmian.
 */
export async function getVersionExportSheets(
    id: string
): Promise<{ version: PricelistVersion; sheets: LiveSheetRows; precoIncluded: boolean }> {
    const { version, sections } = await getVersionExport(id);
    if (!isPricelistType(version.type)) {
        throw new PricelistVersionError(422, 'INVALID_TYPE', `Wersja ${id} ma nieznany typ`);
    }
    const type: PricelistType = version.type;
    const sheets = projectVersionToLiveShape(type, sections);
    if (type !== 'studnie') return { version, sheets, precoIncluded: true };
    // PRECO: najnowsza wersja nie nowsza niż eksportowana (seq <=) — parowanie
    // po equal-seq gubiło PRECO zawsze gdy typy miały rozjechane seq.
    const precoVersion = await prisma.pricelistVersion.findFirst({
        where: { type: 'preco', seq: { lte: version.seq } },
        orderBy: { seq: 'desc' }
    });
    if (!precoVersion) return { version, sheets, precoIncluded: false };
    const preco = await getVersionExport(precoVersion.id);
    return {
        version,
        sheets: { ...sheets, ...projectVersionToLiveShape('preco', preco.sections) },
        precoIncluded: true
    };
}
