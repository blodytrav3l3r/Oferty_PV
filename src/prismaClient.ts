/**
 * Singleton klienta Prisma - zapewnia jedno połączenie z bazą danych w całej aplikacji
 */
import { PrismaClient, Prisma } from '../generated/prisma';

export const prisma = new PrismaClient();

export { Prisma };
export default prisma;
