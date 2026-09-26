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
import userPreferencesRoutes from './routes/userPreferences';
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
import pricelistVersionsRoutes from './routes/pricelistVersions';
import exportCombinedRoutes from './routes/exportCombined';
import sharesRoutes from './routes/shares';
import adminRoutes from './routes/admin';
import locksRoutes from './routes/locks';

/**
 * Montuje wszystkie trasy API + raport CSP + globalny error handler.
 * MUSI być wołane po middleware (security/static/limiter), a errorHandler
 * MUSI zostać ostatni — nie przestawiać kolejności wewnątrz.
 *
 * P1.3: limity rozmiaru JSON per-route (celowo brak globalnego express.json
 * w app.ts — globalny unieważniałby limity per-route: mniejszy byłby martwy,
 * większy nieosiągalny; poprzedni per-route 1mb na /api/clients był martwy
 * wobec globalnego 50mb — teraz realnie działa).
 * Mały (1mb): auth, użytkownicy, klienci, audyt, ustawienia, telemetria,
 * flagi, eksporty (tylko ID ofert), udostępnienia, admin, locki, wyszukiwarki —
 * żadna nie przyjmuje tablic rekordów (małe obiekty/zapytania).
 * Duży (50mb): oferty/zamówienia rury+studnie (tablice items/wells z pełnymi
 * configami i snapshotami, do ~3000 studni; XLSX importowany jest w przeglądarce
 * i wysyłany jako JSON na te same trasy ofert/zamówień) oraz bulk PUT cenników
 * (products/products-studnie ~824 pozycje, preco-pricing pełna struktura).
 */
/**
 * Handler raportu CSP — wydzielony dla testowalności (bez montowania całej aplikacji).
 */
export function handleCspReport(req: express.Request, res: express.Response): void {
    if (req.body) {
        logger.warn('CSP', 'Violacja polityki bezpieczeństwa:', String(req.body).slice(0, 2000));
    }
    res.status(204).end();
}

export function mountRoutes(app: express.Express, apiLimiter: express.RequestHandler): void {
    // P1.3: parser JSON per-route zamiast globalnego (patrz komentarz wyżej).
    const smallJson = express.json({ limit: '1mb' });
    const largeJson = express.json({ limit: '50mb' });

    app.use('/api/auth', apiLimiter, smallJson, authRoutes);
    // Preferencje własne przed /api/users — inaczej ':id' połknęłoby 'me'.
    app.use('/api/users/me', apiLimiter, smallJson, userPreferencesRoutes);
    app.use('/api/users', apiLimiter, smallJson, userRoutes);
    app.use('/api/users-for-assignment', apiLimiter, smallJson, (req, res, next) => {
        req.url = '/for-assignment' + (req.url === '/' ? '' : req.url);
        userRoutes(req, res, next);
    });

    // E4b: apiLimiter także na cennikach/ofertach/exportach (rzadkie, kosztowne GET-y).
    // Telemetry celowo BEZ apiLimiter — własne TELEMETRY_WRITE/READ (polling dashboardu).
    app.use('/api/products', apiLimiter, largeJson, productRoutes);
    app.use('/api/products-studnie', apiLimiter, largeJson, productStudnieRoutes);
    app.use('/api/offers/search', apiLimiter, smallJson, searchRoutes);
    app.use('/api/offers-rury', apiLimiter, largeJson, offerRoutes);
    app.use('/api/offers-studnie', apiLimiter, largeJson, (req, res, next) => {
        req.url = '/studnie' + req.url;
        offerRoutes(req, res, next);
    });

    app.use('/api/orders-studnie/production/search', apiLimiter, smallJson, productionSearchRoutes);
    app.use('/api/orders-studnie', apiLimiter, largeJson, orderRoutes);
    app.use('/api/orders-rury', apiLimiter, largeJson, ruryOrdersRoutes);
    app.use('/api/clients', apiLimiter, smallJson, clientRoutes);
    app.use('/api/audit', apiLimiter, smallJson, auditRoutes);
    app.use('/api/settings', apiLimiter, smallJson, settingsRoutes);
    app.use('/api/telemetry', smallJson, telemetryRoutes);
    // Nowy moduł telemetry AI - pasywny zapis konfiguracji, zdarzeń i wersji
    app.use('/api/telemetry', smallJson, telemetryAiRoutes);
    // Dashboard AI (Knowledge Base, Learning Engine, Recommender) - admin only
    app.use('/api/telemetry', smallJson, telemetryAiDashboardRoutes);
    app.use('/api/preco-pricing', apiLimiter, largeJson, precoPricingRoutes);
    app.use('/api/feature-flags', smallJson, featureFlagsRoutes);
    app.use('/api/telemetry', smallJson, aiMlRoutes); // ML prediction API
    app.use('/api/price-overrides', apiLimiter, smallJson, priceOverridesRoutes);
    app.use('/api/pricelist-versions', apiLimiter, largeJson, pricelistVersionsRoutes);
    app.use('/api/export-combined', apiLimiter, smallJson, exportCombinedRoutes);
    app.use('/api/shares', apiLimiter, smallJson, sharesRoutes);
    app.use('/api/admin', apiLimiter, smallJson, adminRoutes);
    app.use('/api/locks', apiLimiter, smallJson, locksRoutes);

    /* ===== RAPORTY VIOLACJI CSP (Faza 1 planu CSP — monitoring) ===== */
    // apiLimiter: endpoint anonimowy, bez niego curl w pętli = log-spam/dysk.
    // limit 10kb: raporty przeglądarek to ~1kb, większe = śmieci.
    app.post(
        '/api/csp-report',
        apiLimiter,
        express.text({ type: 'application/csp-report', limit: '10kb' }),
        handleCspReport
    );

    /* ===== GLOBALNA OBSŁUGA BŁĘDÓW (zawsze ostatnia) ===== */
    app.use(errorHandler);

    /* ===== SENTRY — error handler (po wszystkich route'ach) ===== */
    if (process.env.SENTRY_DSN) {
        Sentry.setupExpressErrorHandler(app);
    }
}
