/**
 * Baza danych i audyt — Re-eksporty zachowujące kompatybilność wsteczną
 *
 * Ten moduł re-eksportuje funkcje audytu z dedykowanego serwisu AuditService
 * oraz singleton klienta Prisma. Istniejące importy z '../../db' nadal działają.
 */

export { logAudit, computeDiff, cleanupAuditLogs } from './services/auditService';
export { prisma } from './prismaClient';
