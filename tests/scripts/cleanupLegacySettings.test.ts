/*
 * tests/scripts/cleanupLegacySettings.test.ts
 * Testy rdzenia czyszczenia legacy kluczy cennikowych (scripts/cleanup-legacy-settings.cjs).
 *
 * Pokrycie: dry-run bez zapisu, apply z dumpem, zachowanie
 * pricelist_defaults_updated_at, guard pustych tabel.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/* eslint-disable @typescript-eslint/no-require-imports -- moduł CJS (skrypt CLI) */
const { cleanupLegacySettings, LEGACY_KEYS, KEEP_KEY } =
    require('../../scripts/cleanup-legacy-settings.cjs') as {
        cleanupLegacySettings: (
            prisma: unknown,
            opts?: { apply?: boolean; dumpFile?: string | null }
        ) => Promise<{
            found: number;
            deleted: number;
            guardEmpty: string[];
            dumpWritten: boolean;
            keepExists: boolean;
        }>;
        LEGACY_KEYS: string[];
        KEEP_KEY: string;
    };
/* eslint-enable @typescript-eslint/no-require-imports */

const ALL_ROWS: { key: string; value: string }[] = LEGACY_KEYS.map((key) => ({
    key,
    value: JSON.stringify([{ id: key }])
}));

interface WhereKeyIn {
    where: { key: { in: string[] } };
}

function makePrisma({ keep = true, emptyTables = false } = {}) {
    const settingsFindMany = jest.fn(
        async ({ where }: WhereKeyIn): Promise<{ key: string; value: string }[]> => {
            const wanted = where?.key?.in ?? [];
            return ALL_ROWS.filter((r) => wanted.includes(r.key));
        }
    );
    const settingsFindUnique = jest.fn(async ({ where }: { where: { key: string } }) =>
        where.key === KEEP_KEY && keep ? { key: KEEP_KEY, value: 'ts' } : null
    );
    const settingsDeleteMany = jest.fn(
        async ({ where }: WhereKeyIn): Promise<{ count: number }> => {
            const wanted = where?.key?.in ?? [];
            return { count: ALL_ROWS.filter((r) => wanted.includes(r.key)).length };
        }
    );
    const tablesCount = jest.fn(async (): Promise<number> => (emptyTables ? 0 : 5));

    const prisma = {
        settings: {
            findMany: settingsFindMany,
            findUnique: settingsFindUnique,
            deleteMany: settingsDeleteMany
        },
        productsRury: { count: tablesCount },
        productsStudnie: { count: tablesCount },
        precoKonfig: { count: tablesCount }
    };

    return { prisma, settingsFindMany, settingsFindUnique, settingsDeleteMany, tablesCount };
}

describe('cleanupLegacySettings', () => {
    it('dry-run: podgląd bez zapisu i bez dumpu', async () => {
        const { prisma, settingsFindMany, settingsDeleteMany } = makePrisma();

        const report = await cleanupLegacySettings(prisma, {
            apply: false,
            dumpFile: path.join(os.tmpdir(), 'dump-x.json')
        });

        expect(report.found).toBe(6);
        expect(report.deleted).toBe(0);
        expect(report.guardEmpty).toEqual([]);
        expect(report.dumpWritten).toBe(false);
        expect(report.keepExists).toBe(true);
        expect(settingsFindMany).toHaveBeenCalledTimes(1);
        expect(settingsDeleteMany).not.toHaveBeenCalled();
    });

    it('apply: usuwa 6 kluczy i zapisuje dump', async () => {
        const tmp = path.join(os.tmpdir(), `dump-${Date.now()}.json`);
        const { prisma, settingsDeleteMany } = makePrisma();

        const report = await cleanupLegacySettings(prisma, { apply: true, dumpFile: tmp });

        expect(report.deleted).toBe(6);
        expect(report.dumpWritten).toBe(true);
        expect(settingsDeleteMany).toHaveBeenCalledWith({
            where: { key: { in: LEGACY_KEYS } }
        });
        expect(fs.existsSync(tmp)).toBe(true);
        const dumped = JSON.parse(fs.readFileSync(tmp, 'utf-8'));
        expect(Object.keys(dumped.keys)).toEqual(LEGACY_KEYS);
        fs.unlinkSync(tmp);
    });

    it('apply: zachowuje pricelist_defaults_updated_at (nie na liście usuwanych)', async () => {
        const { prisma, settingsFindMany } = makePrisma();

        await cleanupLegacySettings(prisma, { apply: true, dumpFile: null });

        const queried = settingsFindMany.mock.calls[0][0];
        expect(queried.where.key.in).not.toContain(KEEP_KEY);
    });

    it('apply: brak klucza w bazie -> nic nie usuwa, keepExists=false', async () => {
        const { prisma, settingsDeleteMany } = makePrisma({ keep: false });
        const prismaNone = {
            ...prisma,
            settings: {
                ...prisma.settings,
                findMany: jest.fn(async () => [])
            }
        };

        const report = await cleanupLegacySettings(prismaNone, { apply: true, dumpFile: null });

        expect(report.found).toBe(0);
        expect(report.deleted).toBe(0);
        expect(report.dumpWritten).toBe(false);
        expect(report.keepExists).toBe(false);
        expect(settingsDeleteMany).not.toHaveBeenCalled();
    });

    it('guard: puste tabele cenników blokują usunięcie', async () => {
        const { prisma, settingsDeleteMany } = makePrisma({ emptyTables: true });

        const report = await cleanupLegacySettings(prisma, { apply: true, dumpFile: null });

        expect(report.guardEmpty).toEqual(['productsRury', 'productsStudnie', 'precoKonfig']);
        expect(report.found).toBe(0);
        expect(settingsDeleteMany).not.toHaveBeenCalled();
    });
});
