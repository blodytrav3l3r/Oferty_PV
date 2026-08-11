/**
 * Singleton klienta Prisma - zapewnia jedno połączenie z bazą danych w całej aplikacji
 */
import fs from 'fs';
import path from 'path';
import { PrismaClient, Prisma } from '../generated/prisma';
import { resolveProjectRoot } from './utils/paths';

/**
 * Normalizuje względną ścieżkę w DATABASE_URL do absolutnej.
 *
 * Prisma rozwiązuje względne ścieżki w URL `file:` względem katalogu, w którym
 * znajduje się schema.prisma widziana przez klienta — a ten katalog różni się
 * między dev (root `prisma/`) a prod (bundlowane `dist/prisma`). To sprawia,
 * że na produkcji `file:../data/...` wskazuje w nieistniejące miejsce i każda
 * kwerenda pada z "Error code 14: Unable to open the database file".
 *
 * Ujednolicenie do absolutnej ścieżki (względem katalogu schema.prisma w root)
 * sprawia, że dev i prod używają tego samego pliku niezależnie od CWD.
 */
function normalizeDatabaseUrl(raw: string): string {
    if (!raw.startsWith('file:')) {
        return raw;
    }
    const rest = raw.slice('file:'.length);
    const queryIdx = rest.indexOf('?');
    const pathPart = queryIdx === -1 ? rest : rest.slice(0, queryIdx);
    const query = queryIdx === -1 ? '' : rest.slice(queryIdx);
    if (path.isAbsolute(pathPart)) {
        return raw;
    }
    // SQLite nie tworzy brakujących katalogów nadrzędnych — na świeżej instalacji
    // katalog bazy może nie istnieć, a wtedy Prisma zwraca CANTOPEN (Error code 14).
    const abs = path.resolve(resolveProjectRoot(), 'prisma', pathPart);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    return 'file:' + abs.replace(/\\/g, '/') + query;
}

const databaseUrl = normalizeDatabaseUrl(
    process.env.DATABASE_URL ||
        'file:../data/app_database.sqlite?connection_limit=1&busy_timeout=30000'
);

export const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

export { Prisma };
export default prisma;
