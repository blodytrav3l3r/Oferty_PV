/**
 * PricelistService — Współdzielona logika CRUD i migracji cenników
 *
 * Zapewnia reużywalne operacje do odczytu, zapisu i migracji
 * cenników opartych na formacie JSON przechowywanych w tabeli settings.
 * Używane zarówno przez trasy produktów rur (rury), jak i studni (productsStudnie).
 */

import prisma from '../prismaClient';
import { logger } from '../utils/logger';

export interface PricelistConfig {
    /** Klucz w tabeli settings dla bieżącego cennika (np. 'pricelist_rury') */
    keyCurrent: string;
    /** Klucz w tabeli settings dla domyślnego/fabrycznego cennika (np. 'pricelist_rury_default') */
    keyDefault: string;
    /** Nazwa starego modelu Prisma dla migracji (np. 'products_rury_rel') */
    legacyTable: string;
    /** Stary klucz domyślny, z którego należy migrować (np. 'default_rury') */
    legacyDefaultKey: string;
    /** Czytelna etykieta dla logowania (np. 'rury', 'studnie') */
    label: string;
}

// ─── Migracja ──────────────────────────────────────────────────────

/**
 * Jednorazowa migracja: kopiuje dane ze starej tabeli relacyjnej do ustawień JSON.
 * Bezpieczne przy wielokrotnym wywołaniu — pomija, jeśli już zmigrowano.
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

        let rows: Record<string, unknown>[] = [];
        try {
            rows = await (prisma as unknown as Record<string, { findMany: () => Promise<Record<string, unknown>[]> }>)[config.legacyTable].findMany();
        } catch (_e) {
            return; // Tabela nie istnieje
        }

        if (rows.length === 0) return;

        const products = rows.map((row) => {
            let extra = {};
            try {
                if (typeof row.data === 'string') extra = JSON.parse(row.data);
            } catch (_e) {}
            const { data: _data, ...rest } = row;
            return { ...rest, ...extra };
        });

        await upsertSetting(config.keyCurrent, JSON.stringify(products));
        logger.info(
            'Migration',
            `Przeniesiono ${products.length} produktów ${config.label} do nowego formatu JSON.`
        );
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('Migration', `Błąd migracji ${config.label}`, message);
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
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('Migration', `Błąd migracji default_${config.label}`, message);
    }
}

// ─── Operacje CRUD ────────────────────────────────────────────────

/**
 * Odczytuje cennik z ustawień (settings) po kluczu. Zwraca sparsowaną tablicę lub pustą tablicę.
 */
export async function readPricelist(key: string): Promise<any[]> {
    const row = await prisma.settings.findUnique({ where: { key } });
    return row ? JSON.parse(row.value || '[]') : [];
}

/**
 * Zapisuje cennik do ustawień (settings) po kluczu. Tworzy lub aktualizuje wpis.
 */
export async function writePricelist(key: string, data: unknown[]): Promise<number> {
    const json = JSON.stringify(data);
    await upsertSetting(key, json);
    return data.length;
}

// ─── Pomocnik wewnętrzny ────────────────────────────────────────────────

/**
 * Operacja Upsert dla ustawień: najpierw próbuje aktualizować, tworzy jeśli nie istnieje.
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
