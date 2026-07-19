/**
 * Aplikacja Express — centralny plik konfiguracyjny
 * Zawiera konfigurację middleware, routingu i obsługi błędów.
 */
import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
import * as Sentry from '@sentry/node';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './swagger';

import { ensureAdminExists } from './middleware/auth';
import { httpsRedirect, securityHeaders, charsetMiddleware } from './middleware/security';
import { createRateLimiter } from './middleware/rateLimiter';
import { logger } from './utils/logger';
import { cleanupAuditLogs } from './services/auditService';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import { getVersion } from './version';
import prisma from './prismaClient';

dotenv.config();

const app = express();
const NODE_ENV = process.env.NODE_ENV || 'development';

/* ===== SENTRY (monitoring błędów) ===== */
if (process.env.SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: NODE_ENV,
        tracesSampleRate: NODE_ENV === 'production' ? 0.1 : 0,
        integrations: [Sentry.expressIntegration()]
    });
    logger.info('Server', 'Sentry — aktywny');
}

app.set('trust proxy', 1); // Trust Render's proxy to handle HTTPS correctly

/* ===== LOGOWANIE ŻĄDAŃ ===== */
app.use(requestLogger);

/* ===== STATUS I WERSJA (przed middleware bezpieczeństwa) ===== */

/**
 * @openapi
 * /api/version:
 *   get:
 *     tags: [System]
 *     summary: Informacje o wersji aplikacji
 *     responses:
 *       200:
 *         description: Szczegóły wersji (git commit, branch, build date, env)
 */
app.get('/api/version', (_req, res) => {
    res.json(getVersion());
});

/**
 * @openapi
 * /health:
 *   get:
 *     tags: [System]
 *     summary: Sprawdzenie statusu serwera
 *     description: Endpoint używany przez Docker/Render do healthcheck. Zwraca status, uptime i wersję.
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
        version: getVersion().version
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
                scriptSrcAttr: ["'unsafe-inline'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", 'data:', 'blob:'],
                connectSrc: [
                    "'self'",
                    'http://localhost:5000',
                    'http://127.0.0.1:5000',
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
app.use(charsetMiddleware);
app.use(httpsRedirect);
app.use(compression());

/* ===== KOMPONENTY POŚREDNICZĄCE (MIDDLEWARE) ===== */
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Cachowanie: wyłączone w dev, włączone w produkcji
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
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import productRoutes, { initRuryProductsTable } from './routes/productsV2';
import productStudnieRoutes, { initStudnieProductsTable } from './routes/productsStudnieV2';
import precoPricingRoutes from './routes/precoPricingV2';
import offerRoutes from './routes/offers/index';
import orderRoutes from './routes/orders/index';
import ruryOrdersRoutes from './routes/orders/ruryOrders';
import clientRoutes from './routes/clients';
import pvMarketplaceRoutes from './routes/pvMarketplace';
import auditRoutes from './routes/audit';
import settingsRoutes from './routes/settings';
import telemetryRoutes from './routes/telemetry';
import telemetryAiRoutes from './routes/telemetryAi';
import telemetryAiDashboardRoutes from './routes/telemetryAiDashboard';
import featureFlagsRoutes from './routes/featureFlags';
import aiMlRoutes from './routes/telemetryAiMl';
import searchRoutes from './routes/offers/search';
import productionSearchRoutes from './routes/orders/productionSearch';

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
app.use('/api/pv-marketplace', apiLimiter, pvMarketplaceRoutes);
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

/* ===== GLOBALNA OBSŁUGA BŁĘDÓW ===== */
app.use(errorHandler);

/* ===== SENTRY — error handler (po wszystkich route'ach) ===== */
if (process.env.SENTRY_DSN) {
    Sentry.setupExpressErrorHandler(app);
}

export { initRuryProductsTable, initStudnieProductsTable };

/**
 * Inicjalizacja aplikacji — seeding tabel produktowych, administracja i PRAGMA user_version.
 */
export async function initApp(): Promise<void> {
    // Ustawienie wersji bazy danych (2.0.0 → 20000)
    try {
        await prisma.$executeRawUnsafe('PRAGMA user_version = 20000');
        logger.info('Server', 'PRAGMA user_version ustawione na 20000');
    } catch (err) {
        logger.warn(
            'Server',
            'Nie udało się ustawić PRAGMA user_version:',
            err instanceof Error ? err.message : err
        );
    }

    // Seed tabel produktowych
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

    // Admin
    await ensureAdminExists();

    // Indeks na createdAt dla audit_logs (jeśli nie istnieje)
    try {
        await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(createdAt)`;
    } catch {
        // ignoruj — indeks istnieje lub baza nie ma uprawnień
    }

    // Czyszczenie starych logów audytowych
    cleanupAuditLogs().catch((err: unknown) =>
        logger.error(
            'AuditLog',
            'Błąd czyszczenia logów przy starcie serwera',
            err instanceof Error ? err.message : String(err)
        )
    );

    // Cron Service - cykliczne zadania AI Learning Engine (pasywne, nie wplywa na solver JS)
    if (process.env.NODE_ENV !== 'test') {
        try {
            const { cronService } = await import('./utils/cronService');
            cronService.init();
        } catch (err) {
            logger.warn(
                'Server',
                'CronService nie zostal zainicjalizowany:',
                err instanceof Error ? err.message : String(err)
            );
        }
    }
}

export default app;
