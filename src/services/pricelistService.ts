/**
 * PricelistService — Współdzielona logika CRUD i seedowania cenników
 *
 * Zapewnia reużywalne operacje do odczytu, zapisu i seedowania
 * cenników opartych na formacie JSON przechowywanych w tabeli settings.
 * Używane zarówno przez trasy produktów rur (rury), jak i studni (productsStudnie).
 */

import fs from 'fs';
import path from 'path';
import prisma from '../prismaClient';
import { logger } from '../utils/logger';

export interface PricelistConfig {
    /** Klucz w tabeli settings dla bieżącego cennika (np. 'pricelist_rury') */
    keyCurrent: string;
    /** Klucz w tabeli settings dla domyślnego/fabrycznego cennika (np. 'pricelist_rury_default') */
    keyDefault: string;
    /** Ścieżka do pliku seed (np. 'data/seed_rury.json') */
    seedPath: string;
    /** Czytelna etykieta dla logowania (np. 'rury', 'studnie') */
    label: string;
}

// ─── Sprzątanie legacy kluczy ────────────────────────────────────────

const LEGACY_KEYS = ['default_rury', 'default_studnie'];

async function cleanupLegacyDefaultKeys(): Promise<void> {
    try {
        const deleted = await prisma.settings.deleteMany({
            where: { key: { in: LEGACY_KEYS } }
        });
        if (deleted.count > 0) {
            logger.info('Seed', `Usunięto ${deleted.count} legacy kluczy domyślnych`);
        }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.warn('Seed', 'Błąd przy usuwaniu legacy kluczy:', message);
    }
}

// ─── Seedowanie ──────────────────────────────────────────────────────

/**
 * Jednorazowe seedowanie: jeśli brak bieżącego cennika w settings,
 * ładuje produkty z pliku seed i zapisuje jako bieżący oraz domyślny.
 */
export async function ensurePrecoSeeded(): Promise<void> {
    try {
        await cleanupLegacyDefaultKeys();
        const existing = await prisma.settings.findUnique({
            where: { key: 'preco_pricing' }
        });
        if (existing) return;

        const seedPath = path.resolve('data/seed_preco.json');
        if (!fs.existsSync(seedPath)) {
            logger.warn('Seed', 'Brak pliku seed: data/seed_preco.json dla PRECO');
            return;
        }

        const raw = fs.readFileSync(seedPath, 'utf-8');
        let data: unknown[] = [];
        try {
            data = JSON.parse(raw);
        } catch {
            data = [];
        }
        if (!Array.isArray(data) || data.length === 0) {
            logger.warn('Seed', 'Pusty plik seed: data/seed_preco.json');
            return;
        }

        const json = JSON.stringify(data);
        await upsertSetting('preco_pricing', json);
        await upsertSetting('preco_pricing_default', json);

        logger.info('Seed', 'Zainicjalizowano cennik PRECO z pliku seed.');
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('Seed', 'Błąd seedowania PRECO', message);
    }
}

export async function ensureProductsSeeded(config: PricelistConfig): Promise<void> {
    try {
        await cleanupLegacyDefaultKeys();
        const existing = await prisma.settings.findUnique({
            where: { key: config.keyCurrent }
        });
        if (existing) return;

        const seedPath = path.resolve(config.seedPath);
        if (!fs.existsSync(seedPath)) {
            logger.warn('Seed', `Brak pliku seed: ${seedPath} dla ${config.label}`);
            return;
        }

        const raw = fs.readFileSync(seedPath, 'utf-8');
        let products: unknown[] = [];
        try {
            products = JSON.parse(raw);
        } catch {
            products = [];
        }
        if (!Array.isArray(products) || products.length === 0) {
            logger.warn('Seed', `Pusty plik seed: ${seedPath} dla ${config.label}`);
            return;
        }

        const json = JSON.stringify(products);
        await upsertSetting(config.keyCurrent, json);
        await upsertSetting(config.keyDefault, json);

        logger.info(
            'Seed',
            `Zainicjalizowano ${products.length} produktów ${config.label} z pliku seed.`
        );
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('Seed', `Błąd seedowania ${config.label}`, message);
    }
}

// ─── Operacje CRUD ────────────────────────────────────────────────

/**
 * Odczytuje cennik z ustawień (settings) po kluczu. Zwraca sparsowaną tablicę lub pustą tablicę.
 */
export async function readPricelist(key: string): Promise<Record<string, unknown>[]> {
    const row = await prisma.settings.findUnique({ where: { key } });
    if (row) {
        try {
            return JSON.parse(row.value || '[]');
        } catch {
            return [];
        }
    }
    return [];
}

/**
 * Zapisuje cennik do ustawień (settings) po kluczu. Tworzy lub aktualizuje wpis.
 */
export async function writePricelist(key: string, data: unknown[]): Promise<number> {
    const json = JSON.stringify(data);
    await upsertSetting(key, json);
    return data.length;
}

// ─── Sync seed JSON ─────────────────────────────────────────────────

/**
 * Zapisuje dane do pliku seed JSON w tle, po odpowiedzi API.
 * Błędy zapisu są logowane ale nie przerywają odpowiedzi.
 */
export function syncSeedFile(filePath: string, data: unknown[]): void {
    try {
        const absPath = path.resolve(filePath);
        fs.writeFileSync(absPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
        logger.info('Sync', `Zaktualizowano plik seed: ${filePath}`);
    } catch (err) {
        logger.error('Sync', `Błąd zapisu pliku seed ${filePath}:`, err);
    }
}

/**
 * Aktualizuje pojedynczy rekord w pliku seed JSON (dla PATCH).
 */
export function syncSeedFilePatch(
    filePath: string,
    id: string,
    patch: Record<string, unknown>
): void {
    const absPath = path.resolve(filePath);
    if (!fs.existsSync(absPath)) return;
    try {
        const raw = fs.readFileSync(absPath, 'utf-8');
        const data: Record<string, unknown>[] = JSON.parse(raw);
        const idx = data.findIndex((item) => item.id === id);
        if (idx !== -1) {
            data[idx] = { ...data[idx], ...patch };
            fs.writeFileSync(absPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
            logger.info('Sync', `Zaktualizowano ${id} w pliku seed: ${filePath}`);
        }
    } catch (err) {
        logger.warn('Sync', `Nie udało się zaktualizować ${id} w ${filePath}:`, err);
    }
}

/**
 * Usuwa rekord z pliku seed JSON (dla DELETE).
 */
export function syncSeedFileDelete(filePath: string, id: string): void {
    const absPath = path.resolve(filePath);
    if (!fs.existsSync(absPath)) return;
    try {
        const raw = fs.readFileSync(absPath, 'utf-8');
        const data: Record<string, unknown>[] = JSON.parse(raw);
        const filtered = data.filter((item) => item.id !== id);
        if (filtered.length < data.length) {
            fs.writeFileSync(absPath, JSON.stringify(filtered, null, 2) + '\n', 'utf-8');
            logger.info('Sync', `Usunięto ${id} z pliku seed: ${filePath}`);
        }
    } catch (err) {
        logger.warn('Sync', `Nie udało się usunąć ${id} z ${filePath}:`, err);
    }
}

// ─── Pomocnik wewnętrzny ────────────────────────────────────────────────

/**
 * Operacja Upsert dla ustawień: najpierw próbuje aktualizować, tworzy jeśli nie istnieje.
 */
async function upsertSetting(key: string, value: string): Promise<void> {
    await prisma.settings.upsert({
        where: { key },
        update: { value },
        create: { key, value }
    });
}
