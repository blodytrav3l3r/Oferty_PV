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
            logger.warn('Seed', `Brak pliku seed: data/seed_preco.json dla PRECO`);
            return;
        }

        const raw = fs.readFileSync(seedPath, 'utf-8');
        const data = JSON.parse(raw);
        if (!Array.isArray(data) || data.length === 0) {
            logger.warn('Seed', `Pusty plik seed: data/seed_preco.json`);
            return;
        }

        const json = JSON.stringify(data);
        await upsertSetting('preco_pricing', json);
        await upsertSetting('preco_pricing_default', json);

        logger.info('Seed', `Zainicjalizowano cennik PRECO z pliku seed.`);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('Seed', `Błąd seedowania PRECO`, message);
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
        const products = JSON.parse(raw);
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
