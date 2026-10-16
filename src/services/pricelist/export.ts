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

export interface VersionDiffChange {
    section: string;
    id: string;
    name: string | null;
    /** 'added' | 'removed' | 'changed' — changed tylko gdy różni się cena. */
    kind: 'added' | 'removed' | 'changed';
    before: number | null;
    after: number | null;
    /** (after-before)/before*100, null gdy niepoliczalna. */
    deltaPct: number | null;
}

export interface VersionDiff {
    version: string;
    previousVersion: string | null;
    sections: Record<string, { added: number; removed: number; changed: number }>;
    /** Top zmian cenowych (max 100, sort po |deltaPct| malejąco). */
    changes: VersionDiffChange[];
    truncated: boolean;
}

/** Pierwsze pole cenowe wiersza (rury/studnie: price, preco kinety: cena). */
function rowPrice(row: Record<string, unknown>): number | null {
    for (const key of ['price', 'cena']) {
        const v = row[key];
        if (typeof v === 'number' && Number.isFinite(v)) return v;
    }
    return null;
}

function rowName(row: Record<string, unknown>): string | null {
    for (const key of ['name', 'key', 'label']) {
        const v = row[key];
        if (typeof v === 'string' && v.length > 0) return v;
    }
    return null;
}

const DIFF_CHANGES_LIMIT = 100;

/** Diff wersji względem poprzedniej (seq-1) przez diffById + top zmian cen. */
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
    const changes: VersionDiffChange[] = [];
    for (const key of Object.keys(curItems)) {
        const prevRows = toComparable(prevItems[key] ?? [], previous?.id ?? '');
        const curRows = toComparable(curItems[key], current.id);
        sections[key] = diffById(prevRows, curRows);
        const prevById = new Map(prevRows.map((r) => [String(r.id), r]));
        const curById = new Map(curRows.map((r) => [String(r.id), r]));
        for (const [rowId, cur] of curById) {
            const prev = prevById.get(rowId);
            if (!prev) {
                changes.push({
                    section: key,
                    id: rowId,
                    name: rowName(cur),
                    kind: 'added',
                    before: null,
                    after: rowPrice(cur),
                    deltaPct: null
                });
            } else {
                const before = rowPrice(prev);
                const after = rowPrice(cur);
                if (before !== after) {
                    changes.push({
                        section: key,
                        id: rowId,
                        name: rowName(cur) ?? rowName(prev),
                        kind: 'changed',
                        before,
                        after,
                        deltaPct:
                            before !== null && after !== null && before !== 0
                                ? Math.round(((after - before) / before) * 1000) / 10
                                : null
                    });
                }
            }
        }
        for (const [rowId, prev] of prevById) {
            if (!curById.has(rowId)) {
                changes.push({
                    section: key,
                    id: rowId,
                    name: rowName(prev),
                    kind: 'removed',
                    before: rowPrice(prev),
                    after: null,
                    deltaPct: null
                });
            }
        }
    }
    changes.sort((a, b) => Math.abs(b.deltaPct ?? 0) - Math.abs(a.deltaPct ?? 0));
    const truncated = changes.length > DIFF_CHANGES_LIMIT;
    return {
        version: current.version,
        previousVersion: previous?.version ?? null,
        sections,
        changes: changes.slice(0, DIFF_CHANGES_LIMIT),
        truncated
    };
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
    // PRECO: najnowsza wersja obowiązująca w dacie eksportowanej studni
    // (effectiveFrom <=, sort eff DESC, seq DESC). Fallback seq <= dla
    // wersji bez effectiveFrom (legacy / mocki testowe).
    let precoVersion = null as Awaited<ReturnType<typeof prisma.pricelistVersion.findFirst>>;
    if (version.effectiveFrom) {
        precoVersion = await prisma.pricelistVersion.findFirst({
            where: { type: 'preco', effectiveFrom: { lte: version.effectiveFrom } },
            orderBy: [{ effectiveFrom: 'desc' }, { seq: 'desc' }]
        });
    }
    if (!precoVersion) {
        precoVersion = await prisma.pricelistVersion.findFirst({
            where: { type: 'preco', seq: { lte: version.seq } },
            orderBy: { seq: 'desc' }
        });
    }
    if (!precoVersion) return { version, sheets, precoIncluded: false };
    const preco = await getVersionExport(precoVersion.id);
    return {
        version,
        sheets: { ...sheets, ...projectVersionToLiveShape('preco', preco.sections) },
        precoIncluded: true
    };
}
