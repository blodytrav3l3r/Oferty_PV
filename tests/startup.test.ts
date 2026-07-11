const mockPrisma = {
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
    users: {
        findUnique: jest.fn(),
        create: jest.fn()
    }
};

jest.mock('../src/prismaClient', () => ({
    __esModule: true,
    default: mockPrisma
}));

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
    jest.clearAllMocks();
});

afterAll(() => {
    process.env = ORIGINAL_ENV;
});

describe('envCheck — validateEnv', () => {
    it('powinien zaakceptować poprawną konfigurację', async () => {
        process.env.DATABASE_URL = 'file:./test.sqlite';
        process.env.DEFAULT_ADMIN_PASSWORD = 'hasloBardzoDlugie12';
        process.env.NODE_ENV = 'development';
        process.env.PORT = '3000';

        const { validateEnv: validate } = await import('../src/startup/envCheck');
        const result = await validate();

        expect(result.DATABASE_URL).toBe('file:./test.sqlite');
        expect(result.NODE_ENV).toBe('development');
        expect(result.PORT).toBe('3000');
    });

    it('powinien rzucić błąd gdy brak DATABASE_URL', async () => {
        delete process.env.DATABASE_URL;

        const { validateEnv: validate } = await import('../src/startup/envCheck');
        await expect(validate()).rejects.toThrow('Environment validation failed');
    });

    it('powinien rzucić błąd gdy DEFAULT_ADMIN_PASSWORD jest za krótkie', async () => {
        process.env.DATABASE_URL = 'file:./test.sqlite';
        process.env.DEFAULT_ADMIN_PASSWORD = 'short';

        const { validateEnv: validate } = await import('../src/startup/envCheck');
        await expect(validate()).rejects.toThrow('Environment validation failed');
    });

    it('powinien zaakceptować brak DEFAULT_ADMIN_PASSWORD', async () => {
        process.env.DATABASE_URL = 'file:./test.sqlite';
        delete process.env.DEFAULT_ADMIN_PASSWORD;

        const { validateEnv: validate } = await import('../src/startup/envCheck');
        const result = await validate();
        expect(result.DEFAULT_ADMIN_PASSWORD).toBeUndefined();
    });

    it('powinien rzucić błąd gdy PORT nie jest liczbą', async () => {
        process.env.DATABASE_URL = 'file:./test.sqlite';
        process.env.PORT = 'nieLiczba';

        const { validateEnv: validate } = await import('../src/startup/envCheck');
        await expect(validate()).rejects.toThrow('Environment validation failed');
    });

    it('powinien ustawić domyślne wartości', async () => {
        process.env.DATABASE_URL = 'file:./test.sqlite';
        delete process.env.PORT;
        delete process.env.HOST;
        delete process.env.NODE_ENV;

        const { validateEnv: validate } = await import('../src/startup/envCheck');
        const result = await validate();

        expect(result.PORT).toBe('3000');
        expect(result.HOST).toBe('0.0.0.0');
        expect(result.NODE_ENV).toBe('development');
    });

    it('getParsedEnv powinien rzucić błąd przed validateEnv', () => {
        // Specjalnie importujemy bez resetModules, by sprawdzić czy _parsedEnv jest null
        jest.resetModules();
        process.env.DATABASE_URL = 'file:./test.sqlite';

        // Dynamiczny import daje nową instancję modułu
        const mod = require('../src/startup/envCheck');
        expect(() => mod.getParsedEnv()).toThrow('nie zostało zweryfikowane');
    });

    it('getParsedEnv powinien zwrócić dane po validateEnv', async () => {
        process.env.DATABASE_URL = 'file:./test.sqlite';

        const { validateEnv: validate, getParsedEnv: getParsed } =
            await import('../src/startup/envCheck');
        await validate();
        const parsed = getParsed();
        expect(parsed.DATABASE_URL).toBe('file:./test.sqlite');
    });
});

describe('adminCheck — ensureAdminExists', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('powinien utworzyć admina gdy nie istnieje i hasło jest ustawione', async () => {
        process.env.DEFAULT_ADMIN_PASSWORD = 'bezpieczneHaslo12';
        mockPrisma.users.findUnique.mockResolvedValue(null);
        mockPrisma.users.create.mockResolvedValue({ id: 'usr_admin', username: 'admin' });

        const { ensureAdminExists } = await import('../src/startup/adminCheck');
        await expect(ensureAdminExists()).resolves.toBeUndefined();
        expect(mockPrisma.users.create).toHaveBeenCalled();
    });

    it('nie powinien tworzyć admina gdy już istnieje', async () => {
        process.env.DEFAULT_ADMIN_PASSWORD = 'bezpieczneHaslo12';
        mockPrisma.users.findUnique.mockResolvedValue({ id: 'usr_admin', username: 'admin' });

        const { ensureAdminExists } = await import('../src/startup/adminCheck');
        await expect(ensureAdminExists()).resolves.toBeUndefined();
        expect(mockPrisma.users.create).not.toHaveBeenCalled();
    });

    it('powinien rzucić błąd gdy admin nie istnieje i brak DEFAULT_ADMIN_PASSWORD', async () => {
        delete process.env.DEFAULT_ADMIN_PASSWORD;
        mockPrisma.users.findUnique.mockResolvedValue(null);

        const { ensureAdminExists } = await import('../src/startup/adminCheck');
        await expect(ensureAdminExists()).rejects.toThrow(
            'DEFAULT_ADMIN_PASSWORD nie jest ustawione'
        );
    });

    it('powinien rzucić błąd gdy hasło jest za krótkie', async () => {
        process.env.DEFAULT_ADMIN_PASSWORD = 'short12';
        mockPrisma.users.findUnique.mockResolvedValue(null);

        const { ensureAdminExists } = await import('../src/startup/adminCheck');
        await expect(ensureAdminExists()).rejects.toThrow('DEFAULT_ADMIN_PASSWORD jest za krótkie');
    });
});

describe('runStartupChecks — integracja startupu', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('powinien przejść cały startup z poprawną konfiguracją', async () => {
        process.env.DATABASE_URL = 'file:./test.sqlite';
        process.env.DEFAULT_ADMIN_PASSWORD = 'bezpieczneHaslo12';
        process.env.NODE_ENV = 'development';

        // Kolejność zgodna z databaseCheck (7× $queryRaw):
        //  1. PRAGMA foreign_keys=ON        → result: [{ foreign_keys: 1 }]
        //  2. PRAGMA busy_timeout=5000      → (void, result ignored)
        //  3. PRAGMA synchronous=NORMAL    → (void, result ignored)
        //  4. PRAGMA journal_mode=WAL       → result: [{ journal_mode: 'wal' }]
        //  5. PRAGMA user_version=20000     → (void, result ignored)
        //  6. PRAGMA busy_timeout (odczyt)  → result: [{ busy_timeout: 5000 }]
        //  7. PRAGMA user_version (odczyt)  → result: [{ user_version: 20000 }]
        mockPrisma.$queryRaw
            .mockResolvedValueOnce([{ foreign_keys: 1 }])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ journal_mode: 'wal' }])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ busy_timeout: 5000 }])
            .mockResolvedValueOnce([{ user_version: 20000 }]);
        mockPrisma.$executeRaw.mockResolvedValue([]);
        mockPrisma.users.findUnique.mockResolvedValue({ id: 'usr_admin', username: 'admin' });

        const { runStartupChecks } = await import('../src/startup/index');
        const report = await runStartupChecks();

        expect(report.env.DATABASE_URL).toBe('file:./test.sqlite');
        expect(report.database.walMode).toBe(true);
        expect(report.database.foreignKeys).toBe(true);
        expect(report.database.busyTimeout).toBe(5000);
        expect(report.database.userVersion).toBe(20000);
    });

    it('powinien rzucić błąd gdy nie uda się włączyć WAL mode', async () => {
        process.env.DATABASE_URL = 'file:./test.sqlite';
        process.env.DEFAULT_ADMIN_PASSWORD = 'bezpieczneHaslo12';

        mockPrisma.$queryRaw
            .mockResolvedValueOnce([{ foreign_keys: 1 }]) // foreign_keys=ON
            .mockResolvedValueOnce([{ journal_mode: 'delete' }]); // WAL fails
        mockPrisma.$executeRaw.mockResolvedValue([]);
        mockPrisma.users.findUnique.mockResolvedValue({ id: 'usr_admin', username: 'admin' });

        const { runStartupChecks } = await import('../src/startup/index');
        await expect(runStartupChecks()).rejects.toThrow('Nie udało się włączyć WAL mode');
    });
});
