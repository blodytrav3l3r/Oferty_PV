const express = require('express');
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const cookieParser = require('cookie-parser');

const { ensureAdminExists } = require('./src/middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

/* ===== MIDDLEWARE ===== */
app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());

// Disable caching for dev assets
app.use((req, res, next) => {
    if (req.path.endsWith('.js') || req.path.endsWith('.css') || req.path.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
    next();
});

app.use(express.static(path.join(__dirname, 'public'), {
    index: 'index.html',
    extensions: ['html']
}));

/* ===== ROUTES ===== */
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/users', require('./src/routes/users'));
app.use('/api/users-for-assignment', (req, res, next) => {
    // Backward compatibility: redirect /api/users-for-assignment to /api/users/for-assignment
    req.url = '/for-assignment' + (req.url === '/' ? '' : req.url);
    require('./src/routes/users')(req, res, next);
});
app.use('/api/products', require('./src/routes/products'));
app.use('/api/products-studnie', require('./src/routes/productsStudnie'));
app.use('/api/offers', require('./src/routes/offers'));
app.use('/api/offers-studnie', (req, res, next) => {
    // Backward compatibility: /api/offers-studnie → /api/offers/studnie
    req.url = '/studnie' + (req.url === '/' ? '' : req.url);
    require('./src/routes/offers')(req, res, next);
});
app.use('/api/orders-studnie', require('./src/routes/orders'));
app.use('/api/production-orders', (req, res, next) => {
    // Backward compatibility: /api/production-orders → /api/orders-studnie/production
    req.url = '/production' + (req.url === '/' ? '' : req.url);
    require('./src/routes/orders')(req, res, next);
});
app.use('/api/next-order-number', (req, res, next) => {
    // Backward compatibility: /api/next-order-number/:userId → /api/orders-studnie/next-number/:userId
    req.url = '/next-number' + (req.url === '/' ? '' : req.url);
    require('./src/routes/orders')(req, res, next);
});
app.use('/api/claim-order-number', (req, res, next) => {
    // Backward compatibility: /api/claim-order-number/:userId → /api/orders-studnie/claim-number/:userId
    req.url = '/claim-number' + (req.url === '/' ? '' : req.url);
    require('./src/routes/orders')(req, res, next);
});
app.use('/api/clients', require('./src/routes/clients'));
app.use('/api/pv-marketplace', require('./src/routes/pv_marketplace'));

/* ===== AI PROXY ===== */
const axios = require('axios');
app.post('/api/ai/configure', async (req, res) => {
    try {
        const aiResponse = await axios.post('http://127.0.0.1:8000/api/v1/configure', req.body);
        res.json(aiResponse.data);
    } catch (error) {
        console.error('[AI PROXY ERROR]', error.message);
        res.status(502).json({ 
            error: 'AI Backend offline', 
            details: error.message 
        });
    }
});

app.get('/api/ai/health', async (req, res) => {
    try {
        await axios.get('http://127.0.0.1:8000/api/v1/sync/pull');
        res.json({ status: 'online' });
    } catch (error) {
        res.status(502).json({ status: 'offline' });
    }
});

/* ===== INIT ===== */
ensureAdminExists();

const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
    console.log(`\n  🚀 WITROS Oferty — serwer działa na: `);
    console.log(`     http://localhost:${PORT}\n`);
    console.log(`     Tryb: COUCHDB ONLY\n`);
});
