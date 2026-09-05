// Wczytaj zmienne środowiskowe NAJWCZEŚNIEJ — importowane moduły mogą czytać process.env na starcie.
import 'dotenv/config';

/**
 * Aplikacja Express — centralny plik konfiguracyjny
 * Zawiera konfigurację middleware, routingu i obsługi błędów.
 */
import fs from 'fs';
import path from 'path';
import express from 'express';
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
import { APP_NAME } from './constants/appMeta';
import prisma from './prismaClient';
import { resolvePublicDir } from './utils/paths';
import { applyBrandTokens, injectAppNameScript } from './utils/brandHtml';

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

/**
 * @openapi
 * /health/live:
 *   get:
 *     tags: [System]
 *     summary: Liveness — czy proces Express odpowiada
 *     responses:
 *       200:
 *         description: Proces żyje
 */
app.get('/health/live', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * @openapi
 * /health/ready:
 *   get:
 *     tags: [System]
 *     summary: Readiness — czy DB gotowa (Prisma SELECT 1)
 *     responses:
 *       200:
 *         description: Gotowy do obsługi ruchu
 *       503:
 *         description: DB niedostępna
 */
app.get('/health/ready', async (_req, res) => {
    try {
        await prisma.$queryRawUnsafe('SELECT 1');
        res.json({ status: 'ready', db: 'ok', timestamp: new Date().toISOString() });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        res.status(503).json({ status: 'not_ready', db: 'error', error: msg.slice(0, 200) });
    }
});

/* ===== DOKUMENTACJA API (Swagger) ===== */
app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
        customSiteTitle: `${APP_NAME} — API Docs`,
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
// Zapis dużych ofert/zamówień (do ~3000 studni z snapshotami) wymaga wyższego limitu payloadu
app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());

/* ===== NAZWA APLIKACJI (branding) — konfigurowalna przez env =====
 * Statyczne HTML zawierają tokeny {{APP_NAME}}/{{APP_SUBTITLE}} zamiast twardej
 * nazwy; podmieniamy je przy serwowaniu i wstrzykujemy window.APP_NAME
 * dla frontendu. Nazwę ustawia się w .env (APP_NAME, APP_SUBTITLE). */
// P0: cache pliku po applyBrandTokens (bez nonce per-request) — mtime invalidacja
const brandHtmlCache = new Map<string, { html: string; mtimeMs: number }>();
function getBrandHtml(file: string): string | null {
    try {
        const stat = fs.statSync(file);
        const mtimeMs = stat.mtimeMs;
        const cached = brandHtmlCache.get(file);
        if (cached && cached.mtimeMs === mtimeMs) return cached.html;
        const raw = fs.readFileSync(file, 'utf-8');
        const html = applyBrandTokens(raw);
        brandHtmlCache.set(file, { html, mtimeMs });
        return html;
    } catch {
        return null;
    }
}
app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const raw = req.path;
    // Twardy guard path traversal / niejednoznacznych ścieżek.
    if (raw.includes('..') || raw.includes('\\') || raw.includes('//')) return next();
    const clean = raw.replace(/^\/+/, '').replace(/\/+$/, '');
    // Serwujemy tylko strony HTML (dokładny plik lub pojedynczy segment bez rozszerzenia).
    const isHtmlPage =
        clean === '' || clean.endsWith('.html') || (!clean.includes('/') && !clean.includes('.'));
    if (!isHtmlPage) return next();
    const rel = clean === '' ? 'index.html' : clean.endsWith('.html') ? clean : clean + '.html';
    const file = path.join(resolvePublicDir(), rel);
    if (!fs.existsSync(file)) return next();
    try {
        const baseHtml = getBrandHtml(file);
        if (baseHtml === null) return next();
        const html = injectAppNameScript(baseHtml, res.locals.cspNonce as string | undefined);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.send(html);
    } catch {
        next();
    }
});

// Cachowanie: wyłączone w dev, włączone w produkcji
if (NODE_ENV === 'production') {
    // Minifikacja CSS (Faza P0-2): /css/X.css → public/css/min/X.css gdy istnieje.
    // Pliki generuje scripts/minify-css.mjs (hook prestart); dev serwuje źródła.
    const cssMinDir = path.join(resolvePublicDir(), 'css', 'min');
    const CSS_CACHE = 'public, max-age=604800'; // 7d, spójnie z express.static poniżej
    app.use((req, res, next) => {
        if (req.method === 'GET' && req.path.startsWith('/css/') && req.path.endsWith('.css')) {
            const rel = req.path.slice('/css/'.length);
            // Blokada ścieżek wychodzących poza katalog min (.., absolutne)
            if (!rel.includes('..') && !path.isAbsolute(rel)) {
                const minFile = path.join(cssMinDir, rel);
                if (fs.existsSync(minFile) && fs.statSync(minFile).isFile()) {
                    res.setHeader('Cache-Control', CSS_CACHE);
                    return res.sendFile(minFile);
                }
            }
        }
        next();
    });
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
    // Fail-fast: jeśli baza jest niedostępna (np. brak katalogu data/ na świeżej
    // instalacji), przerywamy start czytelnym błędem zamiast serii
    // "Error code 14: Unable to open the database file" i pozornie działającego serwera.
    try {
        await prisma.$queryRawUnsafe('SELECT 1');
    } catch (err) {
        logger.error(
            'Server',
            'Nie można otworzyć bazy danych. Sprawdź, czy katalog data/ istnieje i ma uprawnienia do zapisu (uruchom start.bat):',
            err instanceof Error ? err.message : String(err)
        );
        throw err;
    }

    // WAL + synchronous=NORMAL + busy_timeout — parallel batch (P1-4) — niezależne PRAGMA
    try {
        await Promise.all([
            prisma.$queryRawUnsafe('PRAGMA journal_mode=WAL'),
            prisma.$queryRawUnsafe('PRAGMA synchronous=NORMAL'),
            prisma.$queryRawUnsafe('PRAGMA busy_timeout=30000'),
            prisma.$executeRawUnsafe('PRAGMA user_version = 20000')
        ]);
        logger.info('Server', 'PRAGMA WAL/synchronous/busy_timeout/user_version ustawione');
    } catch (err) {
        logger.warn(
            'Server',
            'Nie udało się ustawić PRAGMA WAL/synchronous/busy_timeout/user_version:',
            err instanceof Error ? err.message : err
        );
    }

    // Admin — błąd nie może crashować serwera (ts-node-dev --respawn pętliłby się w nieskończoność).
    try {
        await ensureAdminExists();
    } catch (err) {
        logger.error(
            'Server',
            'Nie udało się sprawdzić/utworzyć konta administratora:',
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
    } catch (err) {
        logger.warn(
            'Server',
            'Nie udało się utworzyć indeksu idx_audit_created_at:',
            err instanceof Error ? err.message : String(err)
        );
    }

    // Indeksy deduplikacji telemetrii AI (auto-heal: na instalacjach bez migracji
    // prisma db push nie tworzy nowych indeksów, a check-db.js sprawdza tylko tabele)
    // UWAGA: auto-heal można wyciąć po pełnym przejściu na migracje (A8) —
    // baseline zawiera te indeksy (20260815000000_baseline), a ścieżki startowe
    // (ensure-db.bat, install.*, docker-entrypoint.sh) używają już migrate deploy.
    try {
        await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "idx_logs_well" ON "ai_telemetry_logs"("wellId")`;
        await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "idx_logs_source_well" ON "ai_telemetry_logs"("solverSource", "wellId")`;
    } catch (err) {
        logger.warn(
            'Server',
            'Nie udało się utworzyć indeksów deduplikacji telemetrii AI:',
            err instanceof Error ? err.message : String(err)
        );
    }
    // Model ML — auto-heal: upewnij się, że w bazie istnieje aktywny model ML dla bieżącej wersji cech
    try {
        await modelRegistry.ensureStarterModelExists();
    } catch (err) {
        logger.warn(
            'Server',
            'Nie udało się weryfikować/utworzyć aktywnego modelu ML:',
            err instanceof Error ? err.message : String(err)
        );
    }

    // Feature flag import/export — domyslnie wlaczona. Migracja
    // 20260705000000_feature_import_export dziala tylko na instalacjach z historia
    // migracji; instalacje z 'prisma db push' nie maja tej flagi w settings,
    // wiec auto-heal upsertem (bez nadpisywania wartosci zmienionej przez uzytkownika).
    try {
        await prisma.settings.upsert({
            where: { key: 'feature_import_export_enabled' },
            update: {},
            create: { key: 'feature_import_export_enabled', value: '"1"' }
        });
    } catch (err) {
        logger.warn(
            'Server',
            'Nie udało się włączyć feature flagi importu/eksportu (tabela settings):',
            err instanceof Error ? err.message : String(err)
        );
    }

    // Kill-switch AI/ML — domyslnie wlaczony. Ten sam wzorzec auto-heal:
    // upsert bez nadpisywania wartosci zmienionej przez uzytkownika (OFF zostaje OFF).
    try {
        await prisma.settings.upsert({
            where: { key: 'feature_ai_ml_enabled' },
            update: {},
            create: { key: 'feature_ai_ml_enabled', value: '"1"' }
        });
    } catch (err) {
        logger.warn(
            'Server',
            'Nie udało się włączyć feature flagi AI/ML (tabela settings):',
            err instanceof Error ? err.message : String(err)
        );
    }

    // Auto-heal: tabela shares (instalacje bez migrate deploy — legacy db push)
    try {
        await prisma.$executeRaw`CREATE TABLE IF NOT EXISTS "document_shares" ("id" TEXT NOT NULL PRIMARY KEY, "documentType" TEXT NOT NULL, "documentId" TEXT NOT NULL, "ownerId" TEXT NOT NULL, "sharedWithUserId" TEXT NOT NULL, "permission" TEXT NOT NULL DEFAULT 'read', "createdAt" TEXT NOT NULL, "createdBy" TEXT NOT NULL)`;
        await prisma.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "uq_share_doc_user" ON "document_shares"("documentType", "documentId", "sharedWithUserId")`;
        await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "idx_shares_sharedwith" ON "document_shares"("sharedWithUserId")`;
        await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "idx_shares_docid" ON "document_shares"("documentId")`;
        await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "idx_shares_doctype_docid" ON "document_shares"("documentType", "documentId")`;
        await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "idx_shares_owner" ON "document_shares"("ownerId")`;
    } catch (e) {
        logger.warn(
            'Server',
            'Nie udało się upewnić schematu document_shares:',
            e instanceof Error ? e.message : String(e)
        );
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
