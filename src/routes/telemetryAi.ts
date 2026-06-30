/**
 * REST API dla modułu telemetry AI.
 *
 * Ścieżki są zarezerwowane pod /api/telemetry/ai* aby nie kolidować
 * z istniejącym /api/telemetry/override.
 *
 * Telemetria jest pasywna — solver JS pozostaje jedynym źródłem prawdy.
 */

import express from 'express';
import crypto from 'crypto';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { WRITE_LIMITER, READ_LIMITER } from '../middleware/rateLimiters';
import { logger } from '../utils/logger';
import { telemetryService } from '../services/telemetry';
import {
    type TelemetryAcceptanceInput,
    type TelemetryConfigInput,
    type TelemetryEventsBulkInput,
    type TelemetryEventInputType,
    type TelemetryVersionInput,
    telemetryAcceptanceSchema,
    telemetryConfigSchema,
    telemetryEventSchema,
    telemetryEventsBulkSchema,
    telemetryVersionSchema
} from '../validators/telemetrySchemas';

const router = express.Router();

/**
 * POST /api/telemetry/ai/config
 * Zapisuje pełną konfigurację studni wraz z kontekstem, historią
 * wersji i snapshota przejść szczelnych.
 */
router.post(
    '/ai/config',
    requireAuth,
    WRITE_LIMITER,
    async (req, res) => {
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
    }
);

/**
 * POST /api/telemetry/ai/event
 * Zapisuje pojedyncze zdarzenie telemetryczne (user_change, accept, etc.).
 */
router.post(
    '/ai/event',
    requireAuth,
    WRITE_LIMITER,
    async (req, res) => {
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
    }
);

/**
 * POST /api/telemetry/ai/events/bulk
 * Zapisuje wiele zdarzeń naraz (do batch processing z JS polling).
 */
router.post(
    '/ai/events/bulk',
    requireAuth,
    WRITE_LIMITER,
    async (req, res) => {
        const authReq = req as AuthenticatedRequest;
        const userId = authReq.user?.id;

        const parse = telemetryEventsBulkSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({
                error: 'Nieprawidłowy bulk payload',
                details: parse.error.issues
            });
        }
        const data = parse.data as TelemetryEventsBulkInput;
        try {
            const result = await telemetryService.recordEventsBulk(
                data.events,
                userId
            );
            return res.json(result);
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            logger.error('Telemetry', `Błąd bulk events: ${message}`);
            return res.status(500).json({ error: 'Nie udało się zapisać zdarzeń' });
        }
    }
);

/**
 * POST /api/telemetry/ai/version
 * Rejestruje nową wersję solvera/reguł/AI.
 */
router.post(
    '/ai/version',
    requireAuth,
    WRITE_LIMITER,
    async (req, res) => {
        const parse = telemetryVersionSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({
                error: 'Nieprawidłowy payload wersji',
                details: parse.error.issues
            });
        }
        try {
            const result = await telemetryService.registerVersion(
                parse.data as TelemetryVersionInput
            );
            return res.json(result);
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            logger.error('Telemetry', `Błąd rejestracji wersji: ${message}`);
            return res.status(500).json({ error: 'Nie udało się zarejestrować wersji' });
        }
    }
);

/**
 * POST /api/telemetry/ai/acceptance
 * Oznacza konfigurację jako zaakceptowaną/odrzuconą przez użytkownika
 * (pasywne uczenie).
 */
router.post(
    '/ai/acceptance',
    requireAuth,
    WRITE_LIMITER,
    async (req, res) => {
        const parse = telemetryAcceptanceSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({
                error: 'Nieprawidłowy acceptance payload',
                details: parse.error.issues
            });
        }
        try {
            const data = parse.data as TelemetryAcceptanceInput;
            await telemetryService.recordAcceptance(data.telemetryId, data.accepted);
            return res.json({ success: true });
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            logger.error('Telemetry', `Błąd acceptance: ${message}`);
            return res.status(500).json({ error: 'Nie udało się zaktualizować acceptance' });
        }
    }
);

/**
 * GET /api/telemetry/ai/list
 * Lista ostatnich rekordów telemetry (admin only).
 */
router.get(
    '/ai/list',
    requireAuth,
    READ_LIMITER,
    async (req, res) => {
        const authReq = req as AuthenticatedRequest;
        if (authReq.user?.role !== 'admin') {
            return res.status(403).json({ error: 'Brak uprawnień' });
        }
        const limit = Math.min(
            parseInt((req.query.limit as string) || '100', 10) || 100,
            500
        );
        try {
            const items = await telemetryService.listRecent(limit);
            return res.json({ items, total: items.length });
        } catch (e) {
            logger.error('Telemetry', `Błąd listy: ${e}`);
            return res.status(500).json({ error: 'Błąd bazy' });
        }
    }
);

/**
 * GET /api/telemetry/ai/history/:wellId
 * Pełna historia konfiguracji dla danej studni (admin only).
 */
router.get(
    '/ai/history/:wellId',
    requireAuth,
    READ_LIMITER,
    async (req, res) => {
        const authReq = req as AuthenticatedRequest;
        if (authReq.user?.role !== 'admin') {
            return res.status(403).json({ error: 'Brak uprawnień' });
        }
        try {
            const items = await telemetryService.getConfigHistory(req.params.wellId);
            return res.json({ items, total: items.length });
        } catch (e) {
            logger.error('Telemetry', `Błąd historia: ${e}`);
            return res.status(500).json({ error: 'Błąd bazy' });
        }
    }
);

/**
 * GET /api/telemetry/ai/transitions/:configId
 * Snapshot przejść szczelnych dla danej konfiguracji (admin only).
 */
router.get(
    '/ai/transitions/:configId',
    requireAuth,
    READ_LIMITER,
    async (req, res) => {
        const authReq = req as AuthenticatedRequest;
        if (authReq.user?.role !== 'admin') {
            return res.status(403).json({ error: 'Brak uprawnień' });
        }
        try {
            const items = await telemetryService.getTransitions(req.params.configId);
            return res.json({ items, total: items.length });
        } catch (e) {
            logger.error('Telemetry', `Błąd przejść: ${e}`);
            return res.status(500).json({ error: 'Błąd bazy' });
        }
    }
);

/**
 * GET /api/telemetry/ai/events/:wellId
 * Lista wszystkich zdarzeń telemetrycznych dla danej studni (admin only).
 */
router.get(
    '/ai/events/:wellId',
    requireAuth,
    READ_LIMITER,
    async (req, res) => {
        const authReq = req as AuthenticatedRequest;
        if (authReq.user?.role !== 'admin') {
            return res.status(403).json({ error: 'Brak uprawnień' });
        }
        try {
            const items = await telemetryService.getEvents(req.params.wellId);
            return res.json({ items, total: items.length });
        } catch (e) {
            logger.error('Telemetry', `Błąd eventów: ${e}`);
            return res.status(500).json({ error: 'Błąd bazy' });
        }
    }
);

/**
 * GET /api/telemetry/ai/versions
 * Aktywne wersje solvera/reguł/AI (admin only).
 */
router.get(
    '/ai/versions',
    requireAuth,
    READ_LIMITER,
    async (req, res) => {
        const authReq = req as AuthenticatedRequest;
        if (authReq.user?.role !== 'admin') {
            return res.status(403).json({ error: 'Brak uprawnień' });
        }
        try {
            const items = await telemetryService.getActiveVersions();
            return res.json({ items, total: items.length });
        } catch (e) {
            logger.error('Telemetry', `Błąd wersji: ${e}`);
            return res.status(500).json({ error: 'Błąd bazy' });
        }
    }
);

// Generator ID (eksportowany dla testów)
export function _generateId(): string {
    return crypto.randomUUID();
}

export default router;
