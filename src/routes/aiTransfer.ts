import express, { type Request, type Response } from 'express';
import { z } from 'zod';
import prisma from '../prismaClient';
import { logger } from '../utils/logger';
import { requireAuth, requireAdmin, type AuthenticatedRequest } from '../middleware/auth';
import { requireAiMlEnabled } from '../middleware/aiMlGuard';
import { READ_LIMITER, WRITE_LIMITER, EXPORT_LIMITER } from '../middleware/rateLimiters';
import { SOKML_LIMITS } from '../services/ml/transfer/transferConstants';
import { TransferError } from '../services/ml/transfer/transferErrors';
import { buildExportPreview, buildModelPackage } from '../services/ml/transfer/exportModel';
import { runDryRun } from '../services/ml/transfer/dryRun';
import { importPackage } from '../services/ml/transfer/importModel';
import { logAudit } from '../services/auditService';

/**
 * P7 — AI/ML Transfer Center (endpointy .sokml).
 * Montowane pod /api/telemetry (jak telemetryAiMl): pełny prefix
 * /api/telemetry/ai/transfer/*. Upload binarny przez express.raw
 * (bez multera — zero nowych zależności).
 */
const router = express.Router();

const sokmlRaw = express.raw({
    type: 'application/octet-stream',
    limit: SOKML_LIMITS.maxUploadBytes
});

function sendInternalError(res: Response, scope: string, e: unknown): void {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error(scope, `Blad wewnetrzny: ${msg}`);
    res.status(500).json({ error: 'Wewnetrzny blad serwera' });
}

function sendTransferError(res: Response, e: TransferError): void {
    const status =
        e.code === 'MODEL_NOT_FOUND'
            ? 404
            : e.code === 'UPLOAD_TOO_LARGE' ||
                e.code === 'ARTIFACT_TOO_LARGE' ||
                e.code === 'UNPACKED_TOO_LARGE'
              ? 413
              : e.code === 'DRY_RUN_PACKAGE_MISMATCH' || e.code === 'MODEL_DUPLICATE'
                ? 409
                : 400;
    res.status(status).json({ error: e.message, code: e.code });
}

const exportBodySchema = z.object({
    modelId: z.string().min(1),
    dataset: z.enum(['fingerprint-only', 'full', 'not-included']).optional(),
    knowledge: z.boolean().optional(),
    telemetry: z.boolean().optional()
});

type ExportScope = {
    dataset?: 'fingerprint-only' | 'full' | 'not-included';
    knowledge?: boolean;
    telemetry?: boolean;
};

function scopeFromQuery(query: Request['query']): ExportScope {
    const scope: ExportScope = {};
    const dataset = String(query.dataset ?? '');
    if (dataset === 'full' || dataset === 'fingerprint-only' || dataset === 'not-included') {
        scope.dataset = dataset;
    }
    if (query.knowledge === '1' || query.knowledge === 'true') scope.knowledge = true;
    if (query.telemetry === '1' || query.telemetry === 'true') scope.telemetry = true;
    return scope;
}

/* ===== EXPORT: podgląd (co opuszcza komputer) ===== */
router.get(
    '/ai/transfer/preview-export',
    requireAuth,
    requireAdmin,
    READ_LIMITER,
    requireAiMlEnabled,
    async (req: Request, res: Response) => {
        try {
            const modelId = String(req.query.modelId ?? '');
            if (!modelId) {
                res.status(400).json({ error: 'Brak modelId', code: 'MODEL_NOT_FOUND' });
                return;
            }
            res.json(await buildExportPreview(modelId, scopeFromQuery(req.query)));
        } catch (e) {
            if (e instanceof TransferError) sendTransferError(res, e);
            else sendInternalError(res, 'AiTransferRoute', e);
        }
    }
);

/* ===== EXPORT: generowanie .sokml ===== */
router.post(
    '/ai/transfer/export',
    requireAuth,
    requireAdmin,
    EXPORT_LIMITER,
    requireAiMlEnabled,
    async (req: Request, res: Response) => {
        const authReq = req as AuthenticatedRequest;
        try {
            const parsed = exportBodySchema.safeParse(req.body);
            if (!parsed.success) {
                res.status(400).json({ error: 'Nieprawidłowe body', code: 'MODEL_NOT_FOUND' });
                return;
            }
            const userId = authReq.user?.id || '';
            const pkg = await buildModelPackage(parsed.data.modelId, userId, {
                dataset: parsed.data.dataset,
                knowledge: parsed.data.knowledge,
                telemetry: parsed.data.telemetry
            });
            await logAudit('ai_transfer', pkg.transferId, userId, 'TRANSFER_EXPORT_COMPLETED', {
                packageFingerprint: pkg.packageFingerprint,
                modelVersion: pkg.manifest.model.version,
                sourceSokVersion: pkg.manifest.sourceSokVersion,
                result: 'MODEL_ONLY'
            });
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader(
                'Content-Disposition',
                `attachment; filename="sok-ai-ml-${pkg.manifest.model.version}.sokml"`
            );
            res.send(pkg.buffer);
        } catch (e) {
            if (e instanceof TransferError) sendTransferError(res, e);
            else sendInternalError(res, 'AiTransferRoute', e);
        }
    }
);

/* ===== DRY-RUN: analiza pakietu bez zapisu ===== */
router.post(
    '/ai/transfer/dry-run',
    requireAuth,
    requireAdmin,
    WRITE_LIMITER,
    requireAiMlEnabled,
    sokmlRaw,
    async (req: Request, res: Response) => {
        const authReq = req as AuthenticatedRequest;
        try {
            if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
                res.status(400).json({ error: 'Brak pakietu .sokml', code: 'ARCHIVE_EMPTY' });
                return;
            }
            const { record, preview } = await runDryRun(req.body, authReq.user?.id || '');
            res.json({
                dryRunId: record.id,
                status: record.report.status,
                checks: record.report.checks,
                preview,
                result: 'CANDIDATE'
            });
        } catch (e) {
            if (e instanceof TransferError) sendTransferError(res, e);
            else sendInternalError(res, 'AiTransferRoute', e);
        }
    }
);

/* ===== IMPORT: tylko ze świeżym dry-run, zawsze CANDIDATE ===== */
router.post(
    '/ai/transfer/import',
    requireAuth,
    requireAdmin,
    WRITE_LIMITER,
    requireAiMlEnabled,
    sokmlRaw,
    async (req: Request, res: Response) => {
        const authReq = req as AuthenticatedRequest;
        try {
            const dryRunId = String(req.query.dryRunId ?? '');
            if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
                res.status(400).json({ error: 'Brak pakietu .sokml', code: 'ARCHIVE_EMPTY' });
                return;
            }
            if (!dryRunId) {
                res.status(400).json({
                    error: 'Import wymaga dryRunId',
                    code: 'DRY_RUN_NOT_FOUND'
                });
                return;
            }
            const result = await importPackage(req.body, dryRunId, authReq.user?.id || '');
            res.json(result);
        } catch (e) {
            if (e instanceof TransferError) sendTransferError(res, e);
            else sendInternalError(res, 'AiTransferRoute', e);
        }
    }
);

/* ===== HISTORIA transferów ===== */
router.get(
    '/ai/transfer/history',
    requireAuth,
    requireAdmin,
    READ_LIMITER,
    requireAiMlEnabled,
    async (_req: Request, res: Response) => {
        try {
            const rows = await prisma.aiTransfer.findMany({
                orderBy: { createdAt: 'desc' },
                take: 100
            });
            res.json({ data: rows });
        } catch (e) {
            sendInternalError(res, 'AiTransferRoute', e);
        }
    }
);

router.get(
    '/ai/transfer/:transferId',
    requireAuth,
    requireAdmin,
    READ_LIMITER,
    requireAiMlEnabled,
    async (req: Request, res: Response) => {
        try {
            const row = await prisma.aiTransfer.findUnique({
                where: { transferId: req.params.transferId }
            });
            if (!row) {
                res.status(404).json({ error: 'Transfer nie istnieje' });
                return;
            }
            res.json(row);
        } catch (e) {
            sendInternalError(res, 'AiTransferRoute', e);
        }
    }
);

export default router;
