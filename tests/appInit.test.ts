const queryRawUnsafe = jest.fn();
const settingsUpsert = jest.fn();
const ensureAdminExists = jest.fn();
const ensureBaselineVersionsAtStartup = jest.fn();
const ensureSlaConfigRow = jest.fn();
const cleanupAuditLogs = jest.fn();
const ensureStarterModelExists = jest.fn();
const pruneOldModels = jest.fn();

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: {
        $queryRawUnsafe: (...args: unknown[]) => queryRawUnsafe(...args),
        settings: { upsert: (...args: unknown[]) => settingsUpsert(...args) }
    },
    Prisma: { empty: '', sql: () => '', raw: (s: string) => s, join: () => '' }
}));

jest.mock('../src/middleware/auth', () => ({
    ensureAdminExists: (...args: unknown[]) => ensureAdminExists(...args),
    requireAuth: (_req: any, _res: any, next: any) => next(),
    requireAdmin: (_req: any, _res: any, next: any) => next()
}));

jest.mock('../src/services/pricelist/bootstrap', () => ({
    ensureBaselineVersionsAtStartup: (...args: unknown[]) =>
        ensureBaselineVersionsAtStartup(...args)
}));

jest.mock('../src/services/careService', () => ({
    ensureSlaConfigRow: (...args: unknown[]) => ensureSlaConfigRow(...args)
}));

jest.mock('../src/services/auditService', () => ({
    cleanupAuditLogs: (...args: unknown[]) => cleanupAuditLogs(...args)
}));

jest.mock('../src/services/ml/ModelRegistry', () => ({
    modelRegistry: {
        ensureStarterModelExists: (...args: unknown[]) => ensureStarterModelExists(...args),
        pruneOldModels: (...args: unknown[]) => pruneOldModels(...args)
    }
}));

jest.mock('../src/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

import { initApp } from '../src/app';
import { logger } from '../src/utils/logger';

beforeEach(() => {
    jest.clearAllMocks();
    queryRawUnsafe.mockResolvedValue([{ '?column?': 1 }]);
    ensureAdminExists.mockResolvedValue(undefined);
    ensureBaselineVersionsAtStartup.mockResolvedValue(undefined);
    ensureSlaConfigRow.mockResolvedValue({
        created: false,
        globalRepaired: false,
        scopedRepaired: 0
    });
    cleanupAuditLogs.mockResolvedValue(undefined);
    ensureStarterModelExists.mockResolvedValue(undefined);
    pruneOldModels.mockResolvedValue(undefined);
    settingsUpsert.mockResolvedValue({});
});

describe('initApp', () => {
    it('przerywa start, gdy baza nie odpowiada (fail-fast)', async () => {
        queryRawUnsafe.mockRejectedValueOnce(new Error('connection refused'));

        await expect(initApp()).rejects.toThrow('connection refused');

        expect(logger.error).toHaveBeenCalledWith(
            'Server',
            expect.stringContaining('Nie można połączyć się z PostgreSQL'),
            'connection refused'
        );
        expect(ensureAdminExists).not.toHaveBeenCalled();
    });

    it('wykonuje wszystkie kroki auto-heal przy poprawnym starcie', async () => {
        await initApp();

        expect(ensureAdminExists).toHaveBeenCalledTimes(1);
        expect(ensureBaselineVersionsAtStartup).toHaveBeenCalledTimes(1);
        expect(ensureSlaConfigRow).toHaveBeenCalledTimes(1);
        expect(ensureStarterModelExists).toHaveBeenCalledTimes(1);
        expect(cleanupAuditLogs).toHaveBeenCalledTimes(1);
        expect(pruneOldModels).toHaveBeenCalledTimes(1);
        expect(settingsUpsert).toHaveBeenCalledTimes(2);
        expect(settingsUpsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { key: 'feature_import_export_enabled' },
                update: {},
                create: { key: 'feature_import_export_enabled', value: '"1"' }
            })
        );
        expect(settingsUpsert).toHaveBeenCalledWith(
            expect.objectContaining({ where: { key: 'feature_ai_ml_enabled' } })
        );
        expect(logger.error).not.toHaveBeenCalled();
    });

    it('brak konta admina nie przerywa startu', async () => {
        ensureAdminExists.mockRejectedValueOnce(new Error('admin fail'));

        await expect(initApp()).resolves.toBeUndefined();

        expect(logger.error).toHaveBeenCalledWith(
            'Server',
            expect.stringContaining('administratora'),
            'admin fail'
        );
        expect(ensureBaselineVersionsAtStartup).toHaveBeenCalled();
    });

    it('błąd bootstrapu wersji cennika przerywa start', async () => {
        ensureBaselineVersionsAtStartup.mockRejectedValueOnce(new Error('bootstrap fail'));

        await expect(initApp()).rejects.toThrow('bootstrap fail');
        expect(cleanupAuditLogs).not.toHaveBeenCalled();
    });

    it('błąd SLA jest logowany, ale nie blokuje dalszych kroków', async () => {
        ensureSlaConfigRow.mockRejectedValueOnce(new Error('sla fail'));

        await expect(initApp()).resolves.toBeUndefined();

        expect(logger.warn).toHaveBeenCalledWith(
            'Care',
            expect.stringContaining('SLA'),
            'sla fail'
        );
        expect(ensureStarterModelExists).toHaveBeenCalled();
    });

    it('raportuje utworzenie i naprawę wiersza SLA', async () => {
        ensureSlaConfigRow.mockResolvedValueOnce({
            created: true,
            globalRepaired: true,
            scopedRepaired: 2
        });

        await initApp();

        expect(logger.info).toHaveBeenCalledWith('Care', 'Utworzono domyślny wiersz SLA (24/7/72)');
        expect(logger.warn).toHaveBeenCalledWith(
            'Care',
            expect.stringContaining('Naprawiono uszkodzoną konfigurację SLA'),
            { globalRepaired: true, scopedRepaired: 2 }
        );
    });

    it('błąd modelu ML i feature flag nie blokuje startu', async () => {
        ensureStarterModelExists.mockRejectedValueOnce(new Error('ml fail'));
        settingsUpsert.mockRejectedValue(new Error('settings fail'));

        await expect(initApp()).resolves.toBeUndefined();

        expect(logger.warn).toHaveBeenCalledWith(
            'Server',
            expect.stringContaining('modelu ML'),
            'ml fail'
        );
        expect(logger.warn).toHaveBeenCalledWith(
            'Server',
            expect.stringContaining('feature flagi importu/eksportu'),
            'settings fail'
        );
        expect(logger.warn).toHaveBeenCalledWith(
            'Server',
            expect.stringContaining('feature flagi AI/ML'),
            'settings fail'
        );
        expect(cleanupAuditLogs).toHaveBeenCalled();
    });

    it('błąd przycinania rejestru modeli jest logowany', async () => {
        pruneOldModels.mockRejectedValueOnce(new Error('prune fail'));

        await expect(initApp()).resolves.toBeUndefined();

        expect(logger.warn).toHaveBeenCalledWith(
            'Server',
            expect.stringContaining('Przyciecie rejestru'),
            'prune fail'
        );
    });

    it('cron nie startuje w NODE_ENV=test', async () => {
        await initApp();
        expect(logger.warn).not.toHaveBeenCalledWith(
            'Server',
            expect.stringContaining('CronService'),
            expect.anything()
        );
    });
});
