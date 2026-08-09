// Wczytaj zmienne środowiskowe NAJWCZEŚNIEJ — importowane moduły mogą czytać process.env na starcie.
import 'dotenv/config';

/**
 * Aplikacja Express — centralny plik konfiguracyjny
 * Zawiera konfigurację middleware, routingu i obsługi błędów.
 */
import express from 'express';
import path from 'path';
import fs from 'fs';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
import * as Sentry from '@sentry/node';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './swagger';

import { ensureAdminExists } from './middleware/auth';
import {
    httpsRedirect,
    securityHeaders,
    charsetMiddleware,
    cspNonceMiddleware,
    cspReportOnly
} from './middleware/security';
import { createRateLimiter } from './middleware/rateLimiter';
import { logger } from './utils/logger';
import { cleanupAuditLogs } from './services/auditService';
import { modelRegistry } from './services/ml/ModelRegistry';
import { priceOverrideService } from './services/priceOverrideService';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import { getVersion } from './version';
import prisma from './prismaClient';

const app = express();
const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Rozwiązuje ścieżkę do katalogu public niezależnie od katalogu roboczego (process.cwd()).
 * W dev (ts-node-dev) moduł działa z src/ → public jest o poziom wyżej,
 * w prod (kompilacja tsc do dist/src) → dwa poziomy wyżej.
 * Wybieramy faktycznie istniejący katalog — odporny na zmianę struktury po buildzie.
 */
function resolvePublicDir(): string {
    const devPublic = path.resolve(__dirname, '../public');
    if (fs.existsSync(devPublic)) {
        return devPublic;
    }
    return path.resolve(__dirname, '../../public');
}

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

// Liczba hopów reverse proxy przed aplikacją — Express ufa ich nagłówkom.
// TRUST_PROXY=1 dla Caddy/Nginx; =2 tylko dla łańcucha np. Cloudflare → Nginx → App.
// Domyślnie 1 — nie ufaj niepotrzebnym hopom.
app.set('trust proxy', parseInt(process.env.TRUST_PROXY || '1', 10));

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
 *     description: Endpoint używany przez Docker do healthcheck. Zwraca status, uptime i wersję.
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
        customSiteTitle: 'S.O.K. — API Docs',
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
                connectSrc: ["'self'"],
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

/* ===== CSP NONCE + REPORT-ONLY (Faza 1 planu CSP) ===== */
app.use(cspNonceMiddleware);
app.use(cspReportOnly);

/* ===== KOMPONENTY POŚREDNICZĄCE (MIDDLEWARE) ===== */
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Cachowanie: wyłączone w dev, włączone w produkcji
if (NODE_ENV === 'production') {
    app.use(
        express.static(resolvePublicDir(), {
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
        express.static(resolvePublicDir(), {
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
import productRoutes from './routes/productsV2';
import productStudnieRoutes from './routes/productsStudnieV2';
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
import priceOverridesRoutes from './routes/priceOverrides';
import exportCombinedRoutes from './routes/exportCombined';

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
app.use('/api/price-overrides', apiLimiter, priceOverridesRoutes);
app.use('/api/export-combined', exportCombinedRoutes);

/* ===== RAPORTY VIOLACJI CSP (Faza 1 planu CSP — monitoring) ===== */
app.post('/api/csp-report', express.text({ type: 'application/csp-report' }), (req, res) => {
    if (req.body) {
        logger.warn('CSP', 'Violacja polityki bezpieczeństwa:', String(req.body).slice(0, 2000));
    }
    res.status(204).end();
});

/* ===== GLOBALNA OBSŁUGA BŁĘDÓW ===== */
app.use(errorHandler);

/* ===== SENTRY — error handler (po wszystkich route'ach) ===== */
if (process.env.SENTRY_DSN) {
    Sentry.setupExpressErrorHandler(app);
}

/**
 * Inicjalizacja aplikacji — administracja i PRAGMA user_version.
 */
export async function initApp(): Promise<void> {
    // WAL + synchronous=NORMAL — przyspiesza zapisy (oferty, audit logi) i
    // pozwala czytelnikom współistnieć z zapisem bez blokad (baza SQLite).
    try {
        await prisma.$executeRawUnsafe('PRAGMA journal_mode=WAL');
        await prisma.$executeRawUnsafe('PRAGMA synchronous=NORMAL');
    } catch (err) {
        logger.warn(
            'Server',
            'Nie udało się ustawić PRAGMA WAL/synchronous:',
            err instanceof Error ? err.message : err
        );
    }

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

    // Admin
    await ensureAdminExists();

    // Aplikuj nadpisania cen z price_overrides.json (jeśli istnieje)
    try {
        await priceOverrideService.applyOverrides();
    } catch (err) {
        logger.warn(
            'Server',
            'Nie udało się aplikować nadpisań cen:',
            err instanceof Error ? err.message : String(err)
        );
    }

    // Przywróć domyślne cenniki z price_defaults.json (jeśli istnieje)
    try {
        await priceOverrideService.restoreDefaultsFromJson();
    } catch (err) {
        logger.warn(
            'Server',
            'Nie udało się przywrócić domyślnych cenników z JSON:',
            err instanceof Error ? err.message : String(err)
        );
    }

    // Indeks na createdAt dla audit_logs (jeśli nie istnieje)
    try {
        await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(createdAt)`;
    } catch {
        // ignoruj — indeks istnieje lub baza nie ma uprawnień
    }

    // Indeksy deduplikacji telemetrii AI (auto-heal: na instalacjach bez migracji
    // prisma db push nie tworzy nowych indeksów, a check-db.js sprawdza tylko tabele)
    try {
        await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "idx_logs_well" ON "ai_telemetry_logs"("wellId")`;
        await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "idx_logs_source_well" ON "ai_telemetry_logs"("solverSource", "wellId")`;
    } catch {
        // ignoruj — tabela ai_telemetry_logs może nie istnieć (start przed db push)
    }

    // Zapewnij pełny schemat FTS5 (m.in. kolumna clientNumber) — idempotentne
    try {
        const { ensureFts5Schema } = await import('./utils/fts5Sync');
        await ensureFts5Schema();
    } catch (e) {
        logger.warn(
            'Server',
            'Nie udało się upewnić schematu FTS5:',
            e instanceof Error ? e.message : String(e)
        );
    }

    // Czyszczenie starych logów audytowych (sekwencyjnie — unikamy równoległych zapisów do SQLite;
    // funkcja sama łapie błędy wewnątrz, więc nie zablokuje startu)
    await cleanupAuditLogs();

    // Retencja rejestru modeli ML — przycięcie starych modeli do polityki z ML_CONFIG
    // (metoda sama łapie błędy; try/catch to dodatkowy pas bezpieczeństwa, nie blokuje startu)
    try {
        await modelRegistry.pruneOldModels();
    } catch (err) {
        logger.warn(
            'Server',
            'Przyciecie rejestru modeli ML nie powiodlo sie:',
            err instanceof Error ? err.message : String(err)
        );
    }

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
