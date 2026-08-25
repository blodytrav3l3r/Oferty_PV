import fs from 'node:fs';
import path from 'node:path';
import express from 'express';

// Root-cause fix dla tests/tmp: jesli poprzedni run zginął na Windows locku,
// katalog zostaje. Sprzatamy STALE przed startem testow (nie ukrywamy przez
// samo .gitignore). helpers.ts dodatkowo sprzata per-project w finally + na
// starcie createIsolatedProject.
try {
    const tmpRoot = path.resolve(__dirname, 'tmp');
    if (fs.existsSync(tmpRoot)) {
        // best-effort: usun tylko stare katalogi (>5min) by nie walczyc z
        // rownoleglym runem; jesli lock nadal trzyma - zignoruj
        const entries = fs.readdirSync(tmpRoot, { withFileTypes: true });
        const now = Date.now();
        for (const e of entries) {
            if (!e.isDirectory()) continue;
            const full = path.join(tmpRoot, e.name);
            try {
                const stat = fs.statSync(full);
                if (now - stat.mtimeMs > 5 * 60 * 1000) {
                    fs.rmSync(full, {
                        recursive: true,
                        force: true,
                        maxRetries: 10,
                        retryDelay: 200
                    });
                }
            } catch {
                // ignore - Windows lock lub brak uprawnien
            }
        }
    }
} catch {
    // ignore - setup nie moze wywalic testow
}

/**
 * Helper do tworzenia testowego serwera Express
 */
export function createTestApp(
    routes: express.Router,
    mountPath: string = '/api'
): express.Application {
    const app = express();
    app.use(express.json());
    app.use(mountPath, routes);
    return app;
}

/**
 * Mock użytkownika do testów
 */
export const mockUser = {
    id: 'test_user_id',
    username: 'testuser',
    role: 'user',
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com',
    symbol: 'TU',
    subUsers: []
};

export const mockAdmin = {
    id: 'test_admin_id',
    username: 'admin',
    role: 'admin',
    firstName: 'Admin',
    lastName: 'Admin',
    email: 'admin@example.com',
    symbol: 'AD',
    subUsers: []
};

/**
 * Token testowy (mock)
 */
export const mockToken = 'test-auth-token-12345';
