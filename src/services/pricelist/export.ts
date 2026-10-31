/**
 * pricelist/export — odczyt zamrożonej wersji (biznesowe id) i arkusze
 * eksportu w shape LIVE. Kod przeniesiony 1:1 z pricelistVersionService.ts.
 */

import prisma from '../../prismaClient';
import type { PricelistVersion } from '../../../generated/prisma';
import type { XlsxSheet } from '../../utils/minimalXlsx';
import { canonicalStringify, diffById } from './canonical';
import {
    PRECO_REFERENCE_STATUSES,
    PricelistVersionError,
    isPricelistType,
    loadVersionItems,
    toComparable
} from './validation';
import type { PricelistType, Tx } from './validation';
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

/**
 * Arkusz-techniczny z numerem cennika. Nazwa zaczyna się od `_`, więc importer
 * (FE i backend) pomija go — plik zostaje w pełni re-importowalny.
 */
export function cennikMetaSheet(typeLabel: string, label: string | null): XlsxSheet {
    return {
        name: '_Cennik',
        headers: ['Pole', 'Wartość'],
        rows: [
            ['Cennik', typeLabel],
            ['Numer cennika', label || 'brak wersji'],
            ['Eksport', new Date().toISOString()]
        ]
    };
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
    /** 'added' | 'removed' | 'changed' — changed tylko gdy różni się cena/pole. */
    kind: 'added' | 'removed' | 'changed';
    before: number | null;
    after: number | null;
    /** (after-before)/before*100, null gdy niepoliczalna. */
    deltaPct: number | null;
    /** PRECO kinety: które pole się różni. */
    field?: 'height' | 'cena';
}

/** Referencja wersji w diffie (from/to). */
export interface VersionDiffRef {
    id: string;
    version: string;
    seq: number;
}

export interface VersionDiff {
    version: string;
    previousVersion: string | null;
    /** Wersja bazowa (`against` albo seq-1); null gdy brak poprzedniej. */
    from: VersionDiffRef | null;
    /** Wersja porównywana (`id`). */
    to: VersionDiffRef;
    sections: Record<string, { added: number; removed: number; changed: number }>;
    /** Top zmian (max 100, sort po |deltaPct| malejąco + tiebreak). */
    changes: VersionDiffChange[];
    /** Liczba wszystkich zmian przed przycięciem do 100. */
    totalChanges: number;
    truncated: boolean;
}

type DiffRow = Record<string, unknown>;

/** Pierwsze pole cenowe wiersza (rury/studnie: price, preco kinety: cena). */
function rowPrice(row: DiffRow): number | null {
    for (const key of ['price', 'cena']) {
        const v = row[key];
        if (typeof v === 'number' && Number.isFinite(v)) return v;
    }
    return null;
}

function numberOrNull(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function rowName(row: DiffRow): string | null {
    for (const key of ['name', 'key', 'label']) {
        const v = row[key];
        if (typeof v === 'string' && v.length > 0) return v;
    }
    return null;
}

function diffDeltaPct(before: number | null, after: number | null): number | null {
    return before !== null && after !== null && before !== 0
        ? Math.round(((after - before) / before) * 1000) / 10
        : null;
}

function cmpText(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
}

/** Sort: |deltaPct| malejąco, potem section/id/field deterministycznie. */
function sortDiffChanges(changes: VersionDiffChange[]): void {
    changes.sort(
        (a, b) =>
            Math.abs(b.deltaPct ?? 0) - Math.abs(a.deltaPct ?? 0) ||
            cmpText(a.section, b.section) ||
            cmpText(a.id, b.id) ||
            cmpText(a.field ?? '', b.field ?? '')
    );
}

function diffRef(v: PricelistVersion | null): VersionDiffRef | null {
    return v ? { id: v.id, version: v.version, seq: v.seq } : null;
}

const DIFF_CHANGES_LIMIT = 100;

/** Rury/studnie: sections przez diffById, changes tylko przy zmianie ceny. */
function diffSimpleSections(
    curItems: Record<string, DiffRow[]>,
    prevItems: Record<string, DiffRow[]>,
    previousVersionId: string,
    currentVersionId: string,
    changes: VersionDiffChange[]
): VersionDiff['sections'] {
    const sections: VersionDiff['sections'] = {};
    for (const key of Object.keys(curItems)) {
        const prevRows = toComparable(prevItems[key] ?? [], previousVersionId);
        const curRows = toComparable(curItems[key], currentVersionId);
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
                continue;
            }
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
                    deltaPct: diffDeltaPct(before, after)
                });
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
    return sections;
}

type PrecoCounter = { added: number; removed: number; changed: number };

function precoText(row: DiffRow, key: string): string {
    return String(row[key] ?? '');
}

function precoNumber(row: DiffRow, key: string): number {
    const value = row[key];
    const num = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(num) ? num : 0;
}

/** Id wiersza bez prefiksu wersji — wyłącznie deterministyczny tie-break. */
function precoRowId(row: DiffRow): string {
    const id = String(row.id ?? '');
    const versionId = row.versionId;
    return typeof versionId === 'string' && id.startsWith(`${versionId}:`)
        ? id.slice(versionId.length + 1)
        : id;
}

function cmpBy(fields: Array<[string, 'text' | 'number']>) {
    return (a: DiffRow, b: DiffRow): number => {
        for (const [field, kind] of fields) {
            const cmp =
                kind === 'number'
                    ? precoNumber(a, field) - precoNumber(b, field)
                    : cmpText(precoText(a, field), precoText(b, field));
            if (cmp !== 0) return cmp;
        }
        return cmpText(precoRowId(a), precoRowId(b));
    };
}

/** Naturalny klucz po pre-sorcie; duplikaty dostają #2, #3... deterministycznie. */
function keyedPrecoRows(
    rows: DiffRow[],
    baseKey: (row: DiffRow) => string,
    compare: (a: DiffRow, b: DiffRow) => number
): Map<string, DiffRow> {
    const sorted = [...rows].sort(compare);
    const counts = new Map<string, number>();
    const out = new Map<string, DiffRow>();
    for (const row of sorted) {
        const base = baseKey(row);
        const seen = (counts.get(base) ?? 0) + 1;
        counts.set(base, seen);
        out.set(seen === 1 ? base : `${base}#${seen}`, row);
    }
    return out;
}

/** JSON kanoniczny pola; przy błędzie parse fallback do surowego stringa. */
function canonicalJsonField(row: DiffRow, field: string): string {
    const raw = row[field];
    if (typeof raw !== 'string') return canonicalStringify(raw);
    try {
        return canonicalStringify(JSON.parse(raw));
    } catch {
        return raw;
    }
}

const kinetyKey = (row: DiffRow): string =>
    `${precoText(row, 'wellDn')}|${precoText(row, 'dn')}|${precoText(row, 'order')}`;
const zakresyKey = (row: DiffRow): string =>
    `${precoText(row, 'wellDn')}|${precoText(row, 'label')}|${precoText(row, 'min')}|${precoText(row, 'max')}|${precoText(row, 'order')}`;
const cmpKinety = cmpBy([
    ['wellDn', 'number'],
    ['dn', 'number'],
    ['order', 'number']
]);
const cmpZakresy = cmpBy([
    ['wellDn', 'number'],
    ['label', 'text'],
    ['min', 'number'],
    ['max', 'number'],
    ['order', 'number']
]);
const cmpKonfig = cmpBy([['key', 'text']]);

function countKeyedDiff(
    counter: PrecoCounter,
    prevRows: DiffRow[],
    curRows: DiffRow[],
    baseKey: (row: DiffRow) => string,
    compare: (a: DiffRow, b: DiffRow) => number,
    equals: (a: DiffRow, b: DiffRow) => boolean
): void {
    const prev = keyedPrecoRows(prevRows, baseKey, compare);
    const cur = keyedPrecoRows(curRows, baseKey, compare);
    for (const [key, row] of cur) {
        const before = prev.get(key);
        if (!before) counter.added++;
        else if (!equals(before, row)) counter.changed++;
    }
    for (const key of prev.keys()) {
        if (!cur.has(key)) counter.removed++;
    }
}

/**
 * PRECO: klucze naturalne (bez `id` wiersza), konfig/zakresy tylko liczniki,
 * kinety po polach height/cena. Duplikaty klucza → sufiks #N.
 */
function diffPrecoSections(
    curItems: Record<string, DiffRow[]>,
    prevItems: Record<string, DiffRow[]>,
    changes: VersionDiffChange[]
): VersionDiff['sections'] {
    const konfig: PrecoCounter = { added: 0, removed: 0, changed: 0 };
    const kinety: PrecoCounter = { added: 0, removed: 0, changed: 0 };
    const zakresy: PrecoCounter = { added: 0, removed: 0, changed: 0 };

    countKeyedDiff(
        konfig,
        prevItems.konfig ?? [],
        curItems.konfig ?? [],
        (row) => precoText(row, 'key'),
        cmpKonfig,
        (a, b) => canonicalJsonField(a, 'value') === canonicalJsonField(b, 'value')
    );
    countKeyedDiff(
        zakresy,
        prevItems.zakresy ?? [],
        curItems.zakresy ?? [],
        zakresyKey,
        cmpZakresy,
        (a, b) => canonicalJsonField(a, 'grupy') === canonicalJsonField(b, 'grupy')
    );

    const prevRows = keyedPrecoRows(prevItems.kinety ?? [], kinetyKey, cmpKinety);
    const curRows = keyedPrecoRows(curItems.kinety ?? [], kinetyKey, cmpKinety);
    for (const [key, cur] of curRows) {
        const name = `DN${precoText(cur, 'wellDn')} / rura ${precoText(cur, 'dn')}`;
        const prev = prevRows.get(key);
        if (!prev) {
            kinety.added++;
            changes.push({
                section: 'kinety',
                id: key,
                name,
                kind: 'added',
                before: null,
                after: numberOrNull(cur.height),
                deltaPct: null,
                field: 'height'
            });
            continue;
        }
        const beforeHeight = numberOrNull(prev.height);
        const afterHeight = numberOrNull(cur.height);
        const beforeCena = numberOrNull(prev.cena);
        const afterCena = numberOrNull(cur.cena);
        let rowChanged = false;
        if (beforeHeight !== afterHeight) {
            rowChanged = true;
            changes.push({
                section: 'kinety',
                id: key,
                name,
                kind: 'changed',
                before: beforeHeight,
                after: afterHeight,
                deltaPct: diffDeltaPct(beforeHeight, afterHeight),
                field: 'height'
            });
        }
        if (beforeCena !== afterCena) {
            rowChanged = true;
            changes.push({
                section: 'kinety',
                id: key,
                name,
                kind: 'changed',
                before: beforeCena,
                after: afterCena,
                deltaPct: diffDeltaPct(beforeCena, afterCena),
                field: 'cena'
            });
        }
        if (rowChanged) kinety.changed++;
    }
    for (const [key, prev] of prevRows) {
        if (curRows.has(key)) continue;
        kinety.removed++;
        changes.push({
            section: 'kinety',
            id: key,
            name: `DN${precoText(prev, 'wellDn')} / rura ${precoText(prev, 'dn')}`,
            kind: 'removed',
            before: numberOrNull(prev.height),
            after: null,
            deltaPct: null,
            field: 'height'
        });
    }

    return { konfig, kinety, zakresy };
}

/**
 * Diff wersji względem `againstId` (dowolna wersja tego samego typu) albo
 * seq-1, gdy `againstId` brak. `from` = against/seq-1, `to` = `id`.
 */
export async function getVersionDiff(id: string, againstId?: string): Promise<VersionDiff> {
    if (againstId === id) {
        throw new PricelistVersionError(
            400,
            'INVALID_QUERY',
            'Wersja bazowa porównania musi być inna niż porównywana'
        );
    }
    const current = await prisma.pricelistVersion.findUnique({ where: { id } });
    if (!current) {
        throw new PricelistVersionError(404, 'NOT_FOUND', `Wersja ${id} nie istnieje`);
    }
    if (!isPricelistType(current.type)) {
        throw new PricelistVersionError(422, 'INVALID_TYPE', `Wersja ${id} ma nieznany typ`);
    }
    const type = current.type;
    let previous: PricelistVersion | null;
    if (againstId === undefined) {
        previous = await prisma.pricelistVersion.findFirst({
            where: { type, seq: current.seq - 1 }
        });
    } else {
        previous = await prisma.pricelistVersion.findUnique({ where: { id: againstId } });
        if (!previous) {
            throw new PricelistVersionError(
                404,
                'AGAINST_NOT_FOUND',
                'Wersja bazowa porównania nie istnieje'
            );
        }
        if (previous.type !== type) {
            throw new PricelistVersionError(
                422,
                'TYPE_MISMATCH',
                'Wersja bazowa ma inny typ cennika'
            );
        }
    }
    const curItems = await loadVersionItems(prisma, type, current.id);
    const prevItems = previous
        ? await loadVersionItems(prisma, type, previous.id)
        : Object.fromEntries(Object.keys(curItems).map((k) => [k, []]));
    const changes: VersionDiffChange[] = [];
    const sections =
        type === 'preco'
            ? diffPrecoSections(curItems, prevItems, changes)
            : diffSimpleSections(curItems, prevItems, previous?.id ?? '', current.id, changes);
    sortDiffChanges(changes);
    const totalChanges = changes.length;
    const truncated = totalChanges > DIFF_CHANGES_LIMIT;
    return {
        version: current.version,
        previousVersion: previous?.version ?? null,
        from: diffRef(previous),
        to: { id: current.id, version: current.version, seq: current.seq },
        sections,
        changes: changes.slice(0, DIFF_CHANGES_LIMIT),
        totalChanges,
        truncated
    };
}

/** Cap wierszy per arkusz w podglądzie (bez paginacji — plan §5). */
export const MAX_PREVIEW_ROWS = 5000;
/** Powyżej tego limitu preview → 413 (admin może użyć eksportu — plan §5). */
export const MAX_COMPARE_ROWS = 20000;

/** Referencja do PRECO, którą eksport studni by dokleił (plan §9.1). */
export interface VersionPreviewPrecoRef {
    id: string;
    version: string;
    seq: number;
}

/**
 * Podgląd wersji (GET /:id/preview): arkuszowe shape LIVE + liczniki.
 * `precoIncluded`/`precoVersion` występują WYŁĄCZNIE dla `studnie` (dla
 * rury/preco pola są pominięte — nie istnieje „dołączona PRECO"). PRECO nie
 * jest doklejana do `sheets`; to zawartość wersji, nie podgląd eksportu.
 */
export interface VersionPreview {
    version: PricelistVersion;
    sheets: LiveSheetRows;
    /** Liczniki sprzed capa: suma wierszy i liczba per arkusz. */
    counts: { totalRows: number; bySheet: Record<string, number> };
    totalRows: number;
    truncated: boolean;
    precoIncluded?: boolean;
    precoVersion?: VersionPreviewPrecoRef | null;
}

/**
 * Podgląd wersji bez eksportu XLSX. Wiersze obcinane do `MAX_PREVIEW_ROWS`
 * per arkusz; `totalRows`/`bySheet` zostają sprzed capa.
 * Ponad `MAX_COMPARE_ROWS` → 413 przed cięciem (plan §5).
 */
export async function getVersionPreview(id: string): Promise<VersionPreview> {
    const { version, sections } = await getVersionExport(id);
    if (!isPricelistType(version.type)) {
        throw new PricelistVersionError(422, 'INVALID_TYPE', `Wersja ${id} ma nieznany typ`);
    }
    const type: PricelistType = version.type;
    const live = projectVersionToLiveShape(type, sections);
    const bySheet: Record<string, number> = {};
    let totalRows = 0;
    for (const [name, rows] of Object.entries(live)) {
        bySheet[name] = rows.length;
        totalRows += rows.length;
    }
    if (totalRows > MAX_COMPARE_ROWS) {
        // ponytail: 413 liczone po load; count-before-findMany gdy duże wersje zaczną boleć.
        throw new PricelistVersionError(
            413,
            'VERSION_TOO_LARGE',
            `Wersja ${id} ma ${totalRows} wierszy (limit ${MAX_COMPARE_ROWS}) — użyj eksportu`
        );
    }
    let truncated = false;
    const sheets: LiveSheetRows = {};
    for (const [name, rows] of Object.entries(live)) {
        if (rows.length > MAX_PREVIEW_ROWS) truncated = true;
        sheets[name] = rows.slice(0, MAX_PREVIEW_ROWS);
    }
    const preview: VersionPreview = {
        version,
        sheets,
        counts: { totalRows, bySheet },
        totalRows,
        truncated
    };
    if (type === 'studnie') {
        const precoVersion = await pickPrecoVersionForStudnie(version);
        preview.precoIncluded = precoVersion !== null;
        preview.precoVersion = precoVersion
            ? { id: precoVersion.id, version: precoVersion.version, seq: precoVersion.seq }
            : null;
    }
    return preview;
}

export interface PrecoTimelineVersion {
    id: string;
    version: string;
    seq: number;
    status: string;
    effectiveFrom?: string | null;
}

function comparePrecoDesc(a: PrecoTimelineVersion, b: PrecoTimelineVersion): number {
    const ae = a.effectiveFrom ?? '';
    const be = b.effectiveFrom ?? '';
    if (ae !== be) return ae < be ? 1 : -1;
    return b.seq - a.seq;
}

/**
 * Wybiera PRECO obowiązującą w dacie wersji studni. D1: tylko
 * ACTIVE/BACKDATE/ARCHIVED; DRAFT/SCHEDULED/BACKDATE_REQUESTED nigdy nie
 * trafiają do historycznego eksportu. Wersje bez effectiveFrom (legacy/mocki)
 * używają fallbacku seq <=.
 */
export function pickPrecoVersionFromTimeline(
    studnie: { effectiveFrom?: string | null; seq: number },
    precoVersions: readonly PrecoTimelineVersion[]
): PrecoTimelineVersion | null {
    const eligible = precoVersions.filter((v) => PRECO_REFERENCE_STATUSES.includes(v.status));
    if (studnie.effectiveFrom) {
        return (
            eligible
                .filter(
                    (v) =>
                        typeof v.effectiveFrom === 'string' &&
                        v.effectiveFrom <= studnie.effectiveFrom!
                )
                .sort(comparePrecoDesc)[0] ?? null
        );
    }
    return eligible.filter((v) => v.seq <= studnie.seq).sort(comparePrecoDesc)[0] ?? null;
}

type PrecoVersionReader = Pick<Tx['pricelistVersion'], 'findFirst'>;

export async function pickPrecoVersionForStudnie(
    studnie: { effectiveFrom?: string | null; seq: number },
    client: { pricelistVersion: PrecoVersionReader } = prisma
): Promise<PricelistVersion | null> {
    const statuses = [...PRECO_REFERENCE_STATUSES];
    if (studnie.effectiveFrom) {
        return client.pricelistVersion.findFirst({
            where: {
                type: 'preco',
                status: { in: statuses },
                effectiveFrom: { lte: studnie.effectiveFrom }
            },
            orderBy: [{ effectiveFrom: 'desc' }, { seq: 'desc' }]
        });
    }
    return client.pricelistVersion.findFirst({
        where: { type: 'preco', status: { in: statuses }, seq: { lte: studnie.seq } },
        orderBy: { seq: 'desc' }
    });
}

/**
 * Arkusze eksportu wersji (shape LIVE) — domknięcie asymetrii LIVE vs VERSION.
 * LIVE (GET /api/products-studnie/export.xlsx, F1) dokleja PRECO po arkuszach
 * studni; eksport zamrożonej wersji studni robi to samo: najnowsza wersja
 * PRECO obowiązująca w dacie eksportu (D1: status ACTIVE/BACKDATE/ARCHIVED),
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
    const precoVersion = await pickPrecoVersionForStudnie(version);
    if (!precoVersion) return { version, sheets, precoIncluded: false };
    const preco = await getVersionExport(precoVersion.id);
    return {
        version,
        sheets: { ...sheets, ...projectVersionToLiveShape('preco', preco.sections) },
        precoIncluded: true
    };
}
