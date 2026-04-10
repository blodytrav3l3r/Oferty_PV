import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';

import { ensureAdminExists } from './src/middleware/auth';
import { httpsRedirect, securityHeaders } from './src/middleware/security';
import { createRateLimiter } from './src/middleware/rateLimiter';
import { logger } from './src/utils/logger';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV || 'development';

/* ===== HEALTH CHECK (before security middleware to avoid HTTPS redirect) ===== */
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.version
    });
});

/* ===== SECURITY ===== */
app.use(
    helmet({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false
    })
);
app.use(securityHeaders);
app.use(httpsRedirect);
app.use(compression());

/* ===== MIDDLEWARE ===== */
app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());

// Cachowanie: wyłączone w dev, włączone w produkcji
if (NODE_ENV === 'production') {
    app.use(
        express.static(path.join(process.cwd(), 'public'), {
            index: 'index.html',
            extensions: ['html'],
            maxAge: '1h'
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
        express.static(path.join(process.cwd(), 'public'), {
            index: 'index.html',
            extensions: ['html']
        })
    );
}

/* ===== API RATE LIMITING ===== */
const apiLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minut
    maxHits: 300,
    message: 'Zbyt wiele żądań. Odczekaj chwilę.'
});

/* ===== ROUTES ===== */
import authRoutes from './src/routes/auth';
import userRoutes from './src/routes/users';
import productRoutes from './src/routes/products';
import productStudnieRoutes from './src/routes/productsStudnie';
import productStudnieAutoRoutes from './src/routes/productsStudnieAuto';
import offerRoutes from './src/routes/offers/index';
import orderRoutes from './src/routes/orders/index';
import clientRoutes from './src/routes/clients';
import pvMarketplaceRoutes from './src/routes/pv_marketplace';
import auditRoutes from './src/routes/audit';
import settingsRoutes from './src/routes/settings';
import telemetryRoutes from './src/routes/telemetry';

app.use('/api/auth', authRoutes);
app.use('/api/users', apiLimiter, userRoutes);
app.use('/api/users-for-assignment', (req, res, next) => {
    req.url = '/for-assignment' + (req.url === '/' ? '' : req.url);
    userRoutes(req, res, next);
});

app.use('/api/products', productRoutes);
app.use('/api/products-studnie', productStudnieRoutes);
app.use('/api/products-studnie', productStudnieAutoRoutes);

// Oferty Rury (standard path)
app.use('/api/offers-rury', offerRoutes);

// Oferty Studnie (Alias: /api/offers-studnie -> offers.js router with /studnie prefix)
app.use('/api/offers-studnie', (req, res, next) => {
    req.url = '/studnie' + (req.url === '/' ? '' : req.url);
    offerRoutes(req, res, next);
});

app.use('/api/orders-studnie', apiLimiter, orderRoutes);
app.use('/api/clients', apiLimiter, clientRoutes);
app.use('/api/pv-marketplace', apiLimiter, pvMarketplaceRoutes);
app.use('/api/audit', apiLimiter, auditRoutes);
app.use('/api/settings', apiLimiter, settingsRoutes);
app.use('/api/telemetry', telemetryRoutes);

/* ===== GLOBAL ERROR HANDLER ===== */
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error('Server', 'Unhandled error', err.stack || err.message);
    res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
});

/* ===== INIT ===== */
ensureAdminExists().then(() => {
    app.listen(PORT, HOST, () => {
        logger.info('Server', `WITROS Oferty — serwer działa na: http://localhost:${PORT}`);
        logger.info('Server', `Tryb: ${NODE_ENV === 'production' ? 'PRODUKCJA' : 'DEVELOPMENT'}`);
        logger.info('Server', 'Baza: SQLite (lokalna)');
    });
});

export default app;
