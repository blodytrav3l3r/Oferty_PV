#!/usr/bin/env node
/**
 * audit-createdAt-formats.ts — DB-01 (plan modernizacji F4): read-only raport
 * rozkładu formatów createdAt (ISO vs epoch-ms legacy vs NULL vs inne) w głównych
 * tabelach biznesowych. Tylko SELECT COUNT — bez zapisu, bez migracji.
 *
 * Użycie: npx ts-node scripts/audit-createdAt-formats.ts
 */
import 'dotenv/config';
import prisma from '../src/prismaClient';

const TABLES = [
    'offers_rel',
    'offers_studnie_rel',
    'orders_studnie_rel',
    'orders_rury_rel',
    'production_orders_rel',
    'clients_rel',
    'audit_logs'
];

async function main(): Promise<void> {
    for (const t of TABLES) {
        const rows = (await prisma.$queryRawUnsafe(
            `SELECT COUNT(*) AS total, ` +
                `SUM(CASE WHEN "createdAt" IS NULL THEN 1 ELSE 0 END) AS nulls, ` +
                `SUM(CASE WHEN "createdAt" GLOB '[0-9]*' AND length("createdAt") = 13 THEN 1 ELSE 0 END) AS epochMs, ` +
                `SUM(CASE WHEN "createdAt" GLOB '????-??-??*' THEN 1 ELSE 0 END) AS iso, ` +
                `SUM(CASE WHEN "createdAt" IS NOT NULL AND NOT ("createdAt" GLOB '[0-9]*' AND length("createdAt") = 13) AND NOT ("createdAt" GLOB '????-??-??*') THEN 1 ELSE 0 END) AS other ` +
                `FROM "${t}"`
        )) as Array<Record<string, number>>;
        console.log(
            `[${t}]`,
            JSON.stringify(rows[0], (_k, v) => (typeof v === 'bigint' ? Number(v) : v))
        );
    }
}

main()
    .catch((err: unknown) => {
        console.error('[audit-createdAt] Blad:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
