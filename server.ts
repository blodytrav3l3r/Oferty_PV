import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
import * as Sentry from '@sentry/node';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './src/swagger';

import { ensureAdminExists } from './src/middleware/auth';
import { httpsRedirect, securityHeaders } from './src/middleware/security';
import { createRateLimiter } from './src/middleware/rateLimiter';
import { logger } from './src/utils/logger';
import { cleanupAuditLogs } from './src/services/auditService';

dotenv.config();

/* ===== SENTRY (monitoring błędów) ===== */
if (process.env.SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
        integrations: [Sentry.expressIntegration()]
    });
    logger.info('Server', 'Sentry — aktywny');
}

const app = express();
app.set('trust proxy', 1); // Trust Render's proxy to handle HTTPS correctly
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV || 'development';

/* ===== SPRAWDZENIE STATUSU (przed middleware bezpieczeństwa, aby uniknąć przekierowania HTTPS) ===== */

/**
 * @openapi
 * /health:
 *   get:
 *     tags: [System]
 *     summary: Sprawdzenie statusu serwera
 *     description: Endpoint używany przez Docker/Render do healthcheck. Zwraca status, uptime i wersję Node.
 *     responses:
 *       200:
 *         description: Serwer działa
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 */
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.version
    });
});

/* ===== DOKUMENTACJA API (Swagger) ===== */
app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
        customSiteTitle: 'WITROS Oferty PV — API Docs',
        customfavIcon: '/favicon.ico',
        swaggerOptions: {
            persistAuthorization: true,
            tryItOutEnabled: true
        }
    })
);

/* ===== API — surowy JSON docs ===== */
app.get('/api/docs.json', (_req, res) => {
    res.json(swaggerSpec);
});

/* ===== BEZPIECZEŃSTWO ===== */
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'"],
                scriptSrcAttr: ["'unsafe-inline'"], // Pozwala na inline event handlers (onclick, etc.)
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", 'data:', 'blob:'],
                connectSrc: [
                    "'self'",
                    'http://localhost:5000',
                    'http://localhost:8000',
                    'ws://localhost:*'
                ],
                fontSrc: ["'self'"],
                objectSrc: ["'none'"],
                mediaSrc: ["'self'"],
                frameSrc: ["'self'"]
            }
        },
        crossOriginEmbedderPolicy: false
    })
);
app.use(securityHeaders);
app.use(httpsRedirect);
app.use(compression());

/* ===== KOMPONENTY POŚREDNICZĄCE (MIDDLEWARE) ===== */
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Cachowanie: wyłączone w dev, włączone w produkcji
// Frontend to vanilla JS/CSS/HTML w public/ — nie wymaga bundlowania.
// Vite jest dostępny tylko w dev (npm run dev:frontend).
const staticDir = 'public';
if (NODE_ENV === 'production') {
    app.use(
        express.static(path.join(process.cwd(), staticDir), {
            index: 'index.html',
            extensions: ['html'],
            maxAge: '7d'
        })
    );
} else {
    app.use((req, res, next) => {
        if (req.path.endsWith('.js') || req.path.endsWith('.css') || req.path.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
        next();
    });
    app.use(
        express.static(path.join(process.cwd(), staticDir), {
            index: 'index.html',
            extensions: ['html']
        })
    );
}

/* ===== LIMITOWANIE ŻĄDAŃ API ===== */
const apiLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minut
    maxHits: 300,
    message: 'Zbyt wiele żądań. Odczekaj chwilę.'
});

/* ===== ŚCIEŻKI (ROUTES) ===== */
import authRoutes from './src/routes/auth';
import userRoutes from './src/routes/users';
import productRoutes, { initRuryProductsTable } from './src/routes/productsV2';
import productStudnieRoutes, { initStudnieProductsTable } from './src/routes/productsStudnieV2';
import precoPricingRoutes from './src/routes/precoPricingV2';
import offerRoutes from './src/routes/offers/index';
import orderRoutes from './src/routes/orders/index';
import ruryOrdersRoutes from './src/routes/orders/ruryOrders';
import clientRoutes from './src/routes/clients';
import pvMarketplaceRoutes from './src/routes/pvMarketplace';
import auditRoutes from './src/routes/audit';
import settingsRoutes from './src/routes/settings';
import telemetryRoutes from './src/routes/telemetry';

app.use('/api/auth', apiLimiter, authRoutes);
app.use('/api/users', apiLimiter, userRoutes);
app.use('/api/users-for-assignment', (req, res, next) => {
    req.url = '/for-assignment' + (req.url === '/' ? '' : req.url);
    userRoutes(req, res, next);
});

app.use('/api/products', productRoutes);
app.use('/api/products-studnie', productStudnieRoutes);
// Oferty Rury (standardowa ścieżka)
app.use('/api/offers-rury', offerRoutes);

// Oferty Studnie - alias dla /api/offers-rury/studnie
// Dodajemy /studnie do URL aby trafić na właściwy route
app.use('/api/offers-studnie', (req, res, next) => {
    // Przekieruj /api/offers-studnie -> /api/offers-rury/studnie
    req.url = '/studnie' + req.url;
    offerRoutes(req, res, next);
});

app.use('/api/orders-studnie', apiLimiter, orderRoutes);
app.use('/api/orders-rury', apiLimiter, ruryOrdersRoutes);
app.use('/api/clients', apiLimiter, express.json({ limit: '1mb' }), clientRoutes);
app.use('/api/pv-marketplace', apiLimiter, pvMarketplaceRoutes);
app.use('/api/audit', apiLimiter, auditRoutes);
app.use('/api/settings', apiLimiter, settingsRoutes);
app.use('/api/telemetry', telemetryRoutes);
app.use('/api/preco-pricing', apiLimiter, precoPricingRoutes);

/* ===== GLOBALNA OBSŁUGA BŁĘDÓW ===== */
app.use(
    (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        const errorMessage = err instanceof Error ? err.stack || err.message : 'Unknown error';
        logger.error('Server', 'Nieobsłużony błąd', errorMessage);
        res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
    }
);

/* ===== SENTRY — error handler (po wszystkich route'ach) ===== */
if (process.env.SENTRY_DSN) {
    Sentry.setupExpressErrorHandler(app);
}

/* ===== INICJALIZACJA ===== */
(async function initServer() {
    // 1. Seed tabel produktowych — sekwencyjnie, aby uniknąć race condition na SQLite
    try {
        await initRuryProductsTable();
        logger.info('Server', 'productsRury — OK');
    } catch (err) {
        logger.warn(
            'Server',
            'initRuryProductsTable failed:',
            err instanceof Error ? err.message : err
        );
    }
    try {
        await initStudnieProductsTable();
        logger.info('Server', 'productsStudnie — OK');
    } catch (err) {
        logger.warn(
            'Server',
            'initStudnieProductsTable failed:',
            err instanceof Error ? err.message : err
        );
    }

    // 2. Admin + start serwera
    await ensureAdminExists();
    app.listen(PORT, HOST, () => {
        logger.info('Server', `WITROS Oferty — serwer działa na: http://localhost:${PORT}`);
        logger.info('Server', `Tryb: ${NODE_ENV === 'production' ? 'PRODUKCJA' : 'DEVELOPMENT'}`);
        logger.info('Server', 'Baza: SQLite (lokalna)');
        cleanupAuditLogs().catch((err) =>
            logger.error(
                'AuditLog',
                'Błąd czyszczenia logów przy starcie serwera',
                err instanceof Error ? err.message : String(err)
            )
        );
    });
})();

export default app;
