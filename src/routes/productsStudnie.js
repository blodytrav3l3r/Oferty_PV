const express = require('express');
const axios = require('axios');
const { COUCHDB_URL, DB_PREFIX } = require('../helpers');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/* ===== PRODUCTS STUDNIE (CENNIK STUDNI) ===== */

// GET /api/products-studnie -> Pobiera produkty studzienne z CouchDB pv_products
router.get('/', async (req, res) => {
    try {
        const result = await axios.get(`${COUCHDB_URL}/${DB_PREFIX}products/_all_docs?include_docs=true`);
        // Filtrujemy tylko produkty typu studnia (po prefiksie ID)
        const products = result.data.rows
            .map(r => r.doc)
            .filter(d => d.type === 'product' && d._id.startsWith('product:studnia:'));
        
        const mapped = products.map(p => ({
            ...p,
            id: p._id.replace('product:studnia:', '')
        }));

        res.json({ data: mapped });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// PUT /api/products-studnie -> Aktualizacja bazy produktów studziennych (admin)
router.put('/', requireAuth, async (req, res) => {
    try {
        const arr = req.body.data;
        if (!Array.isArray(arr)) return res.status(400).json({ error: 'Dane muszą być tablicą' });

        const dbUrl = `${COUCHDB_URL}/${DB_PREFIX}products`;
        
        for (const p of arr) {
            const docId = `product:studnia:${p.id}`;
            const doc = {
                ...p,
                _id: docId,
                type: 'product',
                updatedAt: new Date().toISOString()
            };
            delete doc.id;

            try {
                const existing = await axios.get(`${dbUrl}/${docId}`);
                doc._rev = existing.data._rev;
            } catch (e) {}

            await axios.put(`${dbUrl}/${docId}`, doc);
        }
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/products-studnie/default -> Endpoint dla frontendu do resetu cennika
router.get('/default', async (req, res) => {
    try {
        const result = await axios.get(`${COUCHDB_URL}/${DB_PREFIX}products/default_studnie`);
        res.json({ data: result.data.data });
    } catch (e) {
        res.json({ data: [] });
    }
});

// PUT /api/products-studnie/default -> Zapisuje cennik domyślny
router.put('/default', requireAuth, async (req, res) => {
    try {
        const dbUrl = `${COUCHDB_URL}/${DB_PREFIX}products`;
        const docId = 'default_studnie';
        const doc = {
            _id: docId,
            type: 'default_config',
            data: req.body.data,
            updatedAt: new Date().toISOString()
        };

        try {
            const existing = await axios.get(`${dbUrl}/${docId}`);
            doc._rev = existing.data._rev;
        } catch (e) {}

        await axios.put(`${dbUrl}/${docId}`, doc);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
