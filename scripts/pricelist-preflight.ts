#!/usr/bin/env node
/**
 * pricelist-preflight.ts — S0/S2: read-only raport przed migracją statusów.
 *
 * Wykrywa kolizje (type, effectiveFrom) PO mapowaniu do APPROVED, inwentarz
 * statusów, niepoprawne daty i brak historii migracji. Nic nie zapisuje.
 * Exit: 0 = brak blokerów, 2 = blokery (kolizje/daty/statusy/legacy DB), 1 = błąd.
 *
 * Użycie:
 *   npm run pricelist:preflight
 *   npm run pricelist:preflight -- --type=studnie --out=docs/plans/raport.md
 *   npm run pricelist:preflight -- --json
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import prisma from '../src/prismaClient';

interface Row {
    id: string;
    type: string;
    seq: number;
    version: string;
    status: string;
    effectiveFrom: string;
    createdBy: string | null;
}

interface Collision {
    type: string;
    effectiveFrom: string;
    versions: Row[];
}

interface PreflightReport {
    generatedAt: string;
    total: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    invalidDates: Row[];
    unknownStatuses: Row[];
    collisions: Collision[];
    legacyDb: boolean;
}

const APPROVED_AFTER_MIGRATION = new Set([
    'ACTIVE',
    'SCHEDULED',
    'ARCHIVED',
    'BACKDATE',
    'APPROVED'
]);
const KNOWN_STATUSES = new Set([...APPROVED_AFTER_MIGRATION, 'DRAFT', 'BACKDATE_REQUESTED']);

function argValue(name: string): string | undefined {
    const prefix = `--${name}=`;
    const hit = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
    return hit ? hit.slice(prefix.length) : undefined;
}

function hasFlag(name: string): boolean {
    return process.argv.slice(2).includes(`--${name}`);
}

function isInvalidDate(value: string): boolean {
    // Ten sam predykat co guard migracji (GLOB ...T..:..:..*Z) — preflight
    // nie może dać EXIT 0, gdy migrate deploy odrzuci offset/lowercase z.
    return (
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.*Z$/.test(value) || Number.isNaN(Date.parse(value))
    );
}

export function buildReport(rows: Row[], legacyDb = false): PreflightReport {
    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const groups = new Map<string, Row[]>();

    for (const row of rows) {
        byType[row.type] = (byType[row.type] ?? 0) + 1;
        byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
        if (!APPROVED_AFTER_MIGRATION.has(row.status)) continue;
        const key = `${row.type}\u0000${row.effectiveFrom}`;
        const bucket = groups.get(key);
        if (bucket) bucket.push(row);
        else groups.set(key, [row]);
    }

    const collisions: Collision[] = [];
    for (const bucket of groups.values()) {
        if (bucket.length > 1) {
            collisions.push({
                type: bucket[0].type,
                effectiveFrom: bucket[0].effectiveFrom,
                versions: [...bucket].sort((a, b) => a.seq - b.seq)
            });
        }
    }

    return {
        generatedAt: new Date().toISOString(),
        total: rows.length,
        byType,
        byStatus,
        invalidDates: rows.filter((row) => isInvalidDate(row.effectiveFrom)),
        unknownStatuses: rows.filter((row) => !KNOWN_STATUSES.has(row.status)),
        collisions,
        legacyDb
    };
}

export function hasBlockers(report: PreflightReport): boolean {
    return (
        report.legacyDb ||
        report.collisions.length > 0 ||
        report.invalidDates.length > 0 ||
        report.unknownStatuses.length > 0
    );
}

function formatText(report: PreflightReport): string {
    const lines = [
        '# Preflight cenników — raport S2',
        '',
        `Wygenerowano: ${report.generatedAt}`,
        `Wersji: ${report.total}`,
        '',
        '## Inwentarz',
        '',
        `Typy: ${Object.entries(report.byType)
            .map(([k, v]) => `${k}=${v}`)
            .join(', ')}`,
        `Statusy: ${
            Object.entries(report.byStatus)
                .map(([k, v]) => `${k}=${v}`)
                .join(', ') || 'brak'
        }`,
        '',
        '## Kolizje po mapowaniu (type, effectiveFrom)',
        ''
    ];

    if (report.collisions.length === 0) {
        lines.push('Brak kolizji.');
    } else {
        for (const collision of report.collisions) {
            lines.push(
                `- **${collision.type} / ${collision.effectiveFrom}** — ${collision.versions.length} wersje`
            );
            for (const version of collision.versions) {
                lines.push(
                    `    - ${version.version} (seq ${version.seq}, ${version.status}, ${version.id})`
                );
            }
        }
    }

    lines.push('', '## Niepoprawne daty', '');
    if (report.invalidDates.length === 0) lines.push('Brak.');
    else {
        for (const row of report.invalidDates) {
            lines.push(`- ${row.type} / ${row.version}: \`${row.effectiveFrom}\``);
        }
    }

    lines.push('', '## Nieznane statusy', '');
    if (report.unknownStatuses.length === 0) lines.push('Brak.');
    else {
        for (const row of report.unknownStatuses) {
            lines.push(`- ${row.type} / ${row.version}: \`${row.status}\``);
        }
    }

    lines.push('', '## Baza', '');
    lines.push(
        report.legacyDb
            ? 'BLOKADA: brak `_prisma_migrations` — to baza legacy; `migrate deploy` nie zastosuje migracji danych.'
            : 'Historia migracji obecna.'
    );
    lines.push('');
    return lines.join('\n');
}

async function hasMigrationHistory(): Promise<boolean> {
    const rows = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = '_prisma_migrations'"
    );
    return rows.length > 0;
}

async function main(): Promise<void> {
    const type = argValue('type');
    const out = argValue('out');
    const asJson = hasFlag('json');

    const [rows, migrationHistory] = await Promise.all([
        prisma.pricelistVersion.findMany({
            where: type ? { type } : undefined,
            select: {
                id: true,
                type: true,
                seq: true,
                version: true,
                status: true,
                effectiveFrom: true,
                createdBy: true
            },
            orderBy: [{ type: 'asc' }, { effectiveFrom: 'asc' }, { seq: 'asc' }]
        }) as Promise<Row[]>,
        hasMigrationHistory()
    ]);

    const report = buildReport(rows, !migrationHistory);
    const payload = asJson ? JSON.stringify(report, null, 2) : formatText(report);

    if (out) {
        const target = path.resolve(process.cwd(), out);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, `${payload}\n`, 'utf8');
        console.log(`[pricelist:preflight] raport: ${target}`);
    }
    console.log(payload);

    if (hasBlockers(report)) {
        console.error(
            `[pricelist:preflight] BLOKADA: kolizje=${report.collisions.length}, ` +
                `daty=${report.invalidDates.length}, statusy=${report.unknownStatuses.length}, ` +
                `legacyDb=${report.legacyDb ? 'tak' : 'nie'}.`
        );
        process.exitCode = 2;
    }
}

if (require.main === module) {
    main()
        .catch((err: unknown) => {
            console.error('[pricelist:preflight] Błąd:', err);
            process.exitCode = 1;
        })
        .finally(async () => {
            await prisma.$disconnect();
        });
}
