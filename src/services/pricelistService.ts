/**
 * PricelistService — Shared Pricelist CRUD & Migration Logic
 *
 * Provides reusable operations for reading, writing, and migrating
 * JSON-based pricelists stored in the settings table.
 * Used by both products (rury) and productsStudnie routes.
 */

import prisma from '../prismaClient';
import { logger } from '../utils/logger';

export interface PricelistConfig {
    /** Settings key for the current pricelist (e.g. 'pricelist_rury') */
    keyCurrent: string;
    /** Settings key for default/factory pricelist (e.g. 'pricelist_rury_default') */
    keyDefault: string;
    /** Legacy Prisma model name for migration (e.g. 'products_rury_rel') */
    legacyTable: string;
    /** Old default key to migrate from (e.g. 'default_rury') */
    legacyDefaultKey: string;
    /** Human-readable label for logging (e.g. 'rury', 'studnie') */
    label: string;
}

// ─── Migration ──────────────────────────────────────────────────────

/**
 * One-time migration: copy data from legacy relational table to JSON settings.
 * Safe to call multiple times — skips if already migrated.
 */
export async function migrateFromLegacyIfNeeded(config: PricelistConfig): Promise<void> {
    await migrateLegacyData(config);
    await migrateLegacyDefaults(config);
}

async function migrateLegacyData(config: PricelistConfig): Promise<void> {
    try {
        const existing = await prisma.settings.findUnique({
            where: { key: config.keyCurrent }
        });
        if (existing) return;

        let rows: any[] = [];
        try {
            rows = await (prisma as any)[config.legacyTable].findMany();
        } catch (_e) {
            return; // Tabela nie istnieje
        }

        if (rows.length === 0) return;

        const products = rows.map((row: any) => {
            let extra = {};
            try {
                if (row.data) extra = JSON.parse(row.data);
            } catch (_e) {}
            const { data: _data, ...rest } = row;
            return { ...rest, ...extra };
        });

        await upsertSetting(config.keyCurrent, JSON.stringify(products));
        logger.info(
            'Migration',
            `Przeniesiono ${products.length} produktów ${config.label} do nowego formatu JSON.`
        );
    } catch (err: any) {
        logger.error('Migration', `Migracja ${config.label} error`, err.message);
    }
}

async function migrateLegacyDefaults(config: PricelistConfig): Promise<void> {
    try {
        const oldDefault = await prisma.settings.findUnique({
            where: { key: config.legacyDefaultKey }
        });
        if (!oldDefault?.value) return;

        const existingNew = await prisma.settings.findUnique({
            where: { key: config.keyDefault }
        });
        if (existingNew) return;

        await prisma.settings.upsert({
            where: { key: config.keyDefault },
            update: { value: oldDefault.value },
            create: { key: config.keyDefault, value: oldDefault.value }
        });
        logger.info(
            'Migration',
            `Przeniesiono wartości fabryczne ${config.label} do nowego klucza.`
        );
    } catch (err: any) {
        logger.error('Migration', `Migracja default_${config.label} error`, err.message);
    }
}

// ─── CRUD Operations ────────────────────────────────────────────────

/**
 * Read pricelist from settings by key. Returns parsed array or empty array.
 */
export async function readPricelist(key: string): Promise<any[]> {
    const row = await prisma.settings.findUnique({ where: { key } });
    return row ? JSON.parse(row.value || '[]') : [];
}

/**
 * Write pricelist to settings by key. Creates or updates the setting.
 */
export async function writePricelist(key: string, data: any[]): Promise<number> {
    const json = JSON.stringify(data);
    await upsertSetting(key, json);
    return data.length;
}

// ─── Internal Helper ────────────────────────────────────────────────

/**
 * Upsert a settings row: try update first, create if not exists.
 */
async function upsertSetting(key: string, value: string): Promise<void> {
    try {
        await prisma.settings.update({
            where: { key },
            data: { value }
        });
    } catch {
        await prisma.settings.create({
            data: { key, value }
        });
    }
}
