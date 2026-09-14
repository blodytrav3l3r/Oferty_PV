/**
 * mountRoutes.ts — BE-01 (plan modernizacji F5): montowanie tras Express
 * wydzielone z src/app.ts. Kolejność app.use NIE zmieniona.
 */
import express from 'express';
import * as Sentry from '@sentry/node';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import productRoutes from './routes/productsV2';
import productStudnieRoutes from './routes/productsStudnieV2';
import precoPricingRoutes from './routes/precoPricingV2';
import offerRoutes from './routes/offers/index';
import orderRoutes from './routes/orders/index';
import ruryOrdersRoutes from './routes/orders/ruryOrders';
import clientRoutes from './routes/clients';
import auditRoutes from './routes/audit';
import settingsRoutes from './routes/settings';
import telemetryRoutes from './routes/telemetry';
import telemetryAiRoutes from './routes/telemetryAi';
import telemetryAiDashboardRoutes from './routes/telemetryAiDashboard';
import featureFlagsRoutes from './routes/featureFlags';
import aiMlRoutes from './routes/telemetryAiMl';
import searchRoutes from './routes/offers/search';
import productionSearchRoutes from './routes/orders/productionSearch';
import priceOverridesRoutes from './routes/priceOverrides';
import exportCombinedRoutes from './routes/exportCombined';
import sharesRoutes from './routes/shares';
import adminRoutes from './routes/admin';
import locksRoutes from './routes/locks';

/**
 * Montuje wszystkie trasy API + raport CSP + globalny error handler.
 * MUSI być wołane po middleware (security/static/limiter), a errorHandler
 * MUSI zostać ostatni — nie przestawiać kolejności wewnątrz.
 */
export function mountRoutes(app: express.Express, apiLimiter: express.RequestHandler): void {
    app.use('/api/auth', apiLimiter, authRoutes);
    app.use('/api/users', apiLimiter, userRoutes);
    app.use('/api/users-for-assignment', (req, res, next) => {
        req.url = '/for-assignment' + (req.url === '/' ? '' : req.url);
        userRoutes(req, res, next);
    });

    app.use('/api/products', productRoutes);
    app.use('/api/products-studnie', productStudnieRoutes);
    app.use('/api/offers/search', apiLimiter, searchRoutes);
    app.use('/api/offers-rury', offerRoutes);
    app.use('/api/offers-studnie', (req, res, next) => {
        req.url = '/studnie' + req.url;
        offerRoutes(req, res, next);
    });

    app.use('/api/orders-studnie/production/search', apiLimiter, productionSearchRoutes);
    app.use('/api/orders-studnie', apiLimiter, orderRoutes);
    app.use('/api/orders-rury', apiLimiter, ruryOrdersRoutes);
    app.use('/api/clients', apiLimiter, express.json({ limit: '1mb' }), clientRoutes);
    app.use('/api/audit', apiLimiter, auditRoutes);
    app.use('/api/settings', apiLimiter, settingsRoutes);
    app.use('/api/telemetry', telemetryRoutes);
    // Nowy moduł telemetry AI - pasywny zapis konfiguracji, zdarzeń i wersji
    app.use('/api/telemetry', telemetryAiRoutes);
    // Dashboard AI (Knowledge Base, Learning Engine, Recommender) - admin only
    app.use('/api/telemetry', telemetryAiDashboardRoutes);
    app.use('/api/preco-pricing', apiLimiter, precoPricingRoutes);
    app.use('/api/feature-flags', featureFlagsRoutes);
    app.use('/api/telemetry', aiMlRoutes); // ML prediction API
    app.use('/api/price-overrides', apiLimiter, priceOverridesRoutes);
    app.use('/api/export-combined', exportCombinedRoutes);
    app.use('/api/shares', apiLimiter, sharesRoutes);
    app.use('/api/admin', apiLimiter, adminRoutes);
    app.use('/api/locks', apiLimiter, locksRoutes);

    /* ===== RAPORTY VIOLACJI CSP (Faza 1 planu CSP — monitoring) ===== */
    app.post('/api/csp-report', express.text({ type: 'application/csp-report' }), (req, res) => {
        if (req.body) {
            logger.warn(
                'CSP',
                'Violacja polityki bezpieczeństwa:',
                String(req.body).slice(0, 2000)
            );
        }
        res.status(204).end();
    });

    /* ===== GLOBALNA OBSŁUGA BŁĘDÓW (zawsze ostatnia) ===== */
    app.use(errorHandler);

    /* ===== SENTRY — error handler (po wszystkich route'ach) ===== */
    if (process.env.SENTRY_DSN) {
        Sentry.setupExpressErrorHandler(app);
    }
}
