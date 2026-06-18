/**
 * Singleton klienta Prisma - zapewnia jedno połączenie z bazą danych w całej aplikacji
 */
import { PrismaClient } from '../generated/prisma';

export const prisma = new PrismaClient();

export default prisma;
