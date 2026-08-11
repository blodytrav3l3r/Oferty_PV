/**
 * Singleton klienta Prisma - zapewnia jedno połączenie z bazą danych w całej aplikacji
 */
import fs from 'fs';
import { PrismaClient, Prisma } from '../generated/prisma';
import { resolveDataDir } from './utils/paths';

// SQLite nie tworzy brakujących katalogów nadrzędnych — na świeżej instalacji
// (pominięcie start.bat, bezpośredni `npm run dev`) katalog data/ może nie
// istnieć i każda kwerenda pada z "Error code 14: Unable to open the database file".
fs.mkdirSync(resolveDataDir(), { recursive: true });

export const prisma = new PrismaClient();

export { Prisma };
export default prisma;
