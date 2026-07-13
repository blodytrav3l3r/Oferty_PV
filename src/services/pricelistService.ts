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
    /** Ścieżka do pliku seed (np. 'data/seed_rury.json') — używane gdy seedDir nie jest ustawiony */
    seedPath: string;
    /** Ścieżka do katalogu z plikami seed (np. 'data/seed/studnie') — jeśli ustawiony, czyta wszystkie .json z katalogu */
    seedDir?: string;
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

function loadProductsFromDir(dir: string): unknown[] {
    const resolved = path.resolve(dir);
    if (!fs.existsSync(resolved)) return [];
    const files = fs
        .readdirSync(resolved)
        .filter((f) => f.endsWith('.json'))
        .sort();
    const products: unknown[] = [];
    for (const f of files) {
        const raw = fs.readFileSync(path.join(resolved, f), 'utf-8');
        try {
            const items = JSON.parse(raw);
            if (Array.isArray(items)) products.push(...items);
        } catch {
            logger.warn('Seed', `Błąd parsowania pliku seed: ${f}`);
        }
    }
    return products;
}

export async function ensureProductsSeeded(config: PricelistConfig): Promise<void> {
    try {
        await cleanupLegacyDefaultKeys();
        const existing = await prisma.settings.findUnique({
            where: { key: config.keyCurrent }
        });
        if (existing) return;

        let products: unknown[] = [];

        if (config.seedDir) {
            products = loadProductsFromDir(config.seedDir);
            if (products.length === 0) {
                logger.warn(
                    'Seed',
                    `Brak plików seed w katalogu: ${config.seedDir} dla ${config.label}`
                );
                return;
            }
        } else {
            const seedPath = path.resolve(config.seedPath);
            if (!fs.existsSync(seedPath)) {
                logger.warn('Seed', `Brak pliku seed: ${seedPath} dla ${config.label}`);
                return;
            }

            const raw = fs.readFileSync(seedPath, 'utf-8');
            try {
                products = JSON.parse(raw);
            } catch {
                products = [];
            }
            if (!Array.isArray(products) || products.length === 0) {
                logger.warn('Seed', `Pusty plik seed: ${seedPath} dla ${config.label}`);
                return;
            }
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
