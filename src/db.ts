/**
 * Database & Audit — Backward-Compatible Re-exports
 *
 * This module re-exports audit functions from the dedicated AuditService
 * and the Prisma client singleton. Existing imports from '../../db' continue to work.
 */

export { logAudit, computeDiff, cleanupAuditLogs } from './services/auditService';
export { prisma } from './prismaClient';
