/**
 * mountRoutes.ts — BE-01 (plan modernizacji F5): montowanie tras Express
 * wydzielone z src/app.ts. Kolejność app.use NIE zmieniona.
 */
import express from 'express';
import * as Sentry from '@sentry/node';
import { logger, sanitizeForLog } from './utils/logger';
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
import aiTransferRoutes from './routes/aiTransfer';
import searchRoutes from './routes/offers/search';
import productionSearchRoutes from './routes/orders/productionSearch';
import priceOverridesRoutes from './routes/priceOverrides';
import pricelistVersionsRoutes from './routes/pricelistVersions';
import exportCombinedRoutes from './routes/exportCombined';
import sharesRoutes from './routes/shares';
import adminRoutes from './routes/admin';
import locksRoutes from './routes/locks';
import careRoutes from './routes/care';
import draftRoutes from './routes/drafts';

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
 * Duży (50mb): zamówienia rury+studnie (tablice items/wells z pełnymi
 * configami i snapshotami) oraz bulk PUT cenników (products/products-studnie
 * ~824 pozycje, preco-pricing pełna struktura).
 * Oferty (128mb): zapis oferty niesie `wells` + `wellsExport` (dwie kopie
 * configu, ~4 KB na studnię) — 50mb wypadało już przy ~12 000 studni i kończyło
 * się 413 po długim uploadzie. Limit klienta liczy ten sam próg:
 * `OFFER_SAVE_PAYLOAD_LIMIT_BYTES` w `public/js/studnie/offerSave.js`
 * (kontrakt pilnuje `tests/studnie/offerSavePayloadGuard.test.ts`).
 */
export const JSON_BODY_LIMITS = {
    small: '1mb',
    large: '50mb',
    offers: '128mb',
    draft: '320kb'
} as const;
/**
 * Handler raportu CSP — wydzielony dla testowalności (bez montowania całej aplikacji).
 */
export function handleCspReport(req: express.Request, res: express.Response): void {
    if (req.body) {
        // Treść raportu pochodzi od klienta → sanityzacja CRLF (log forging).
        logger.warn(
            'CSP',
            'Violacja polityki bezpieczeństwa:',
            sanitizeForLog(String(req.body).slice(0, 2000))
        );
    }
    res.status(204).end();
}

export function mountRoutes(app: express.Express, apiLimiter: express.RequestHandler): void {
    // P1.3: parser JSON per-route zamiast globalnego (patrz komentarz wyżej).
    const smallJson = express.json({ limit: JSON_BODY_LIMITS.small });
    const largeJson = express.json({ limit: JSON_BODY_LIMITS.large });
    // Oferty: `wells` + `wellsExport` to dwie kopie configu — osobny, większy limit.
    const offersJson = express.json({ limit: JSON_BODY_LIMITS.offers });
    // L2: drafty mają własny, węższy parser. Limit payloadu (256 KB) pilnuje
    // serwis; parser 320 KB odrzuca nadmiar wcześniej, bez parsowania 1 MB.
    const draftJson = express.json({ limit: JSON_BODY_LIMITS.draft });

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
    app.use('/api/offers-rury', apiLimiter, offersJson, offerRoutes);
    app.use('/api/offers-studnie', apiLimiter, offersJson, (req, res, next) => {
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
    app.use('/api/feature-flags', apiLimiter, smallJson, featureFlagsRoutes);
    app.use('/api/telemetry', smallJson, aiMlRoutes); // ML prediction API
    app.use('/api/telemetry', smallJson, aiTransferRoutes); // P7: AI/ML Transfer Center (.sokml)
    app.use('/api/price-overrides', apiLimiter, smallJson, priceOverridesRoutes);
    app.use('/api/pricelist-versions', apiLimiter, largeJson, pricelistVersionsRoutes);
    app.use('/api/export-combined', apiLimiter, smallJson, exportCombinedRoutes);
    app.use('/api/shares', apiLimiter, smallJson, sharesRoutes);
    app.use('/api/admin', apiLimiter, smallJson, adminRoutes);
    app.use('/api/locks', apiLimiter, smallJson, locksRoutes);
    app.use('/api/care', apiLimiter, smallJson, careRoutes);
    app.use('/api/drafts', apiLimiter, draftJson, draftRoutes);

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
