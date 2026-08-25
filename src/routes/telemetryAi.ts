/**
 * REST API dla modułu telemetry AI.
 *
 * Ścieżki są zarezerwowane pod /api/telemetry/ai* aby nie kolidować
 * z istniejącym /api/telemetry/override.
 *
 * Telemetria jest pasywna — solver JS pozostaje jedynym źródłem prawdy.
 */

import express from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { TELEMETRY_WRITE_LIMITER } from '../middleware/rateLimiters';
import { logger } from '../utils/logger';
import prisma from '../prismaClient';
import { telemetryService } from '../services/telemetry';
import {
    type TelemetryAcceptanceFullInput,
    type TelemetryConfigInput,
    type TelemetryEventInputType,
    type TelemetryVersionInput,
    telemetryAcceptanceFullSchema,
    telemetryConfigSchema,
    telemetryEventSchema,
    telemetryVersionSchema
} from '../validators/telemetrySchemas';

const router = express.Router();

/**
 * POST /api/telemetry/ai/config
 * Zapisuje pełną konfigurację studni wraz z kontekstem, historią
 * wersji i snapshota przejść szczelnych.
 */
router.post('/ai/config', requireAuth, TELEMETRY_WRITE_LIMITER, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id;

    const parse = telemetryConfigSchema.safeParse(req.body);
    if (!parse.success) {
        logger.warn('Telemetry', `Błędny payload ai/config: ${parse.error.message}`);
        return res.status(400).json({
            error: 'Nieprawidłowy payload telemetryczny',
            details: parse.error.issues
        });
    }

    try {
        const result = await telemetryService.recordConfig(
            parse.data as TelemetryConfigInput,
            userId
        );
        return res.json(result);
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        logger.error('Telemetry', `Błąd zapisu ai/config: ${message}`);
        return res.status(500).json({ error: 'Nie udało się zapisać telemetry' });
    }
});

/**
 * POST /api/telemetry/ai/event
 * Zapisuje pojedyncze zdarzenie telemetryczne (user_change, accept, etc.).
 */
router.post('/ai/event', requireAuth, TELEMETRY_WRITE_LIMITER, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id;

    const parse = telemetryEventSchema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({
            error: 'Nieprawidłowy payload eventu',
            details: parse.error.issues
        });
    }

    try {
        const result = await telemetryService.recordEvent(
            parse.data as TelemetryEventInputType,
            userId
        );
        return res.json(result);
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        logger.error('Telemetry', `Błąd zapisu ai/event: ${message}`);
        return res.status(500).json({ error: 'Nie udało się zapisać zdarzenia' });
    }
});

/**
 * POST /api/telemetry/ai/version
 * Rejestruje nową wersję solvera/reguł/AI.
 */
router.post('/ai/version', requireAuth, TELEMETRY_WRITE_LIMITER, async (req, res) => {
    const parse = telemetryVersionSchema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({
            error: 'Nieprawidłowy payload wersji',
            details: parse.error.issues
        });
    }
    try {
        const result = await telemetryService.registerVersion(parse.data as TelemetryVersionInput);
        return res.json(result);
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        logger.error('Telemetry', `Błąd rejestracji wersji: ${message}`);
        return res.status(500).json({ error: 'Nie udało się zarejestrować wersji' });
    }
});

/**
 * POST /api/telemetry/ai/acceptance-full
 * Rozszerzony acceptance z pełnym kontekstem (oferta + akceptacja).
 */
router.post('/ai/acceptance-full', requireAuth, TELEMETRY_WRITE_LIMITER, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id;

    const parse = telemetryAcceptanceFullSchema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({
            error: 'Nieprawidłowy acceptance-full payload',
            details: parse.error.issues
        });
    }

    try {
        const data = parse.data as TelemetryAcceptanceFullInput;
        await telemetryService.recordAcceptance(
            data.telemetryId,
            data.accepted,
            data.wellId || undefined
        );

        if (data.accepted && data.configSnapshot) {
            const snap = data.configSnapshot;

            // Zapisz kopię MANUAL tylko gdy studnia nie ma jeszcze żadnego rekordu
            // telemetrii (studnia w pełni ręczna, bez przejścia przez solver) —
            // uchwyć jej konfigurację, zamiast powielać rekord oznaczony już
            // przez recordAcceptance wyżej (duplikat zawyżał liczniki i mnożył
            // wiersze bez wartości treningowej).
            const hasTelemetryRecord = data.wellId
                ? await prisma.ai_telemetry_logs.findFirst({
                      where: { wellId: data.wellId },
                      select: { id: true }
                  })
                : null;

            if (!hasTelemetryRecord) {
                await telemetryService.recordConfig(
                    {
                        solverSource: 'MANUAL',
                        wasAccepted: true,
                        wasRejected: false,
                        wasModified: false,
                        offerId: data.offerId,
                        wellId: data.wellId,
                        warehouse: data.warehouse,
                        dn: snap.dn != null ? String(snap.dn) : undefined,
                        dennicaHeight:
                            typeof snap.dennicaHeight === 'number' ? snap.dennicaHeight : undefined,
                        ringCount: typeof snap.ringCount === 'number' ? snap.ringCount : undefined,
                        allComponentIds: Array.isArray(snap.allComponentIds)
                            ? (snap.allComponentIds as string[])
                            : undefined,
                        appliedReductions: Array.isArray(snap.appliedReductions)
                            ? (snap.appliedReductions as never[])
                            : undefined,
                        appliedKonus: Array.isArray(snap.appliedKonus)
                            ? (snap.appliedKonus as never[])
                            : undefined,
                        appliedHatches: Array.isArray(snap.appliedHatches)
                            ? (snap.appliedHatches as never[])
                            : undefined,
                        appliedSeals: Array.isArray(snap.appliedSeals)
                            ? (snap.appliedSeals as never[])
                            : undefined,
                        originalConfig: data.originalConfig as never[] | undefined,
                        finalConfig: data.finalConfig as never[] | undefined,
                        transitions: data.transitions as never[] | undefined,
                        selectionReason: 'user_accepted_post_solver',
                        featureSnapshot:
                            typeof snap.featureSnapshot === 'object' && snap.featureSnapshot
                                ? (snap.featureSnapshot as Record<string, unknown>)
                                : undefined,
                        labelSnapshot:
                            typeof snap.labelSnapshot === 'object' && snap.labelSnapshot
                                ? (snap.labelSnapshot as Record<string, unknown>)
                                : undefined
                    },
                    userId
                );
            }
        }

        await telemetryService.recordEvent(
            {
                eventType: data.accepted ? 'accept' : 'reject',
                wellId: data.wellId,
                telemetryId: data.telemetryId,
                changeReason: data.accepted ? 'offer_saved_user_accept' : 'offer_rejected'
            },
            userId
        );

        return res.json({ success: true });
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        logger.error('Telemetry', `Błąd acceptance-full: ${message}`);
        return res.status(500).json({ error: 'Nie udało się zapisać acceptance' });
    }
});

export default router;
