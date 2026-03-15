const express = require('express');
const axios = require('axios');
const { filterRowsByRole, COUCHDB_URL, DB_PREFIX } = require('../helpers');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * POMOCNICZE: Pobieranie wszystkich dokumentów z bazy użytkownika o określonym typie
 */
async function getUserDocs(userId, type) {
    try {
        const res = await axios.get(`${COUCHDB_URL}/${DB_PREFIX}offers_user_${userId}/_all_docs?include_docs=true`);
        return res.data.rows.map(r => r.doc).filter(d => d.type === type);
    } catch (e) {
        return [];
    }
}

/* ===== ORDERS STUDNIE (Zamówienia) ===== */

router.get('/', requireAuth, async (req, res) => {
    try {
        const orders = await getUserDocs(req.user.id, 'order');
        res.json({ data: orders.map(o => ({ ...o, id: o._id })) });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.put('/', requireAuth, async (req, res) => {
    try {
        const incoming = req.body.data || [];
        const dbUrl = `${COUCHDB_URL}/${DB_PREFIX}offers_user_${req.user.id}`;
        
        for (const o of incoming) {
            const docId = o.id || o._id || `order:${req.user.id}:${Date.now()}`;
            const doc = { ...o, _id: docId, type: 'order', userId: req.user.id, updatedAt: new Date().toISOString() };
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

/* ===== PRODUCTION ORDERS (Zlecenia Produkcyjne) ===== */

router.get('/production', requireAuth, async (req, res) => {
    try {
        const orders = await getUserDocs(req.user.id, 'production_order');
        res.json({ data: orders.map(o => ({ ...o, id: o._id })) });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.put('/production', requireAuth, async (req, res) => {
    try {
        const incoming = req.body.data || [];
        const dbUrl = `${COUCHDB_URL}/${DB_PREFIX}offers_user_${req.user.id}`;
        
        for (const o of incoming) {
            const docId = o.id || o._id || `prod_order:${req.user.id}:${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            const doc = { ...o, _id: docId, type: 'production_order', userId: req.user.id, updatedAt: new Date().toISOString() };
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

router.get('/production/:id', requireAuth, async (req, res) => {
    try {
        const dbUrl = `${COUCHDB_URL}/${DB_PREFIX}offers_user_${req.user.id}/${req.params.id}`;
        const result = await axios.get(dbUrl);
        res.json({ data: result.data });
    } catch (e) {
        res.status(404).json({ error: 'Zlecenie nie znalezione' });
    }
});

router.delete('/production/:id', requireAuth, async (req, res) => {
    try {
        const dbUrl = `${COUCHDB_URL}/${DB_PREFIX}offers_user_${req.user.id}/${req.params.id}`;
        const existing = await axios.get(dbUrl);
        await axios.delete(`${dbUrl}?rev=${existing.data._rev}`);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/* ===== ORDER NUMBER GENERATION ===== */

router.get('/next-number/:userId', requireAuth, async (req, res) => {
    try {
        const userId = req.params.userId;
        const year = new Date().getFullYear();
        
        // Pobranie usera z CouchDB by znać symbol i startNum
        const userRes = await axios.get(`${COUCHDB_URL}/${DB_PREFIX}users/user:${userId}`);
        const user = userRes.data;
        const symbol = user.symbol || '??';
        const startNum = user.orderStartNumber || 1;

        const counterId = `counter:${userId}:${year}`;
        let nextNumber = startNum;

        try {
            const counterRes = await axios.get(`${COUCHDB_URL}/${DB_PREFIX}counters/${counterId}`);
            nextNumber = Math.max(counterRes.data.lastNumber + 1, startNum);
        } catch (e) { /* counter doesn't exist yet */ }

        const formatted = `${symbol}/${String(nextNumber).padStart(6, '0')}/${year}`;
        res.json({ number: formatted, nextSeq: nextNumber, symbol, year });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/claim-number/:userId', requireAuth, async (req, res) => {
    try {
        const userId = req.params.userId;
        const year = new Date().getFullYear();
        
        const userRes = await axios.get(`${COUCHDB_URL}/${DB_PREFIX}users/user:${userId}`);
        const user = userRes.data;
        const symbol = user.symbol || '??';
        const startNum = user.orderStartNumber || 1;

        const counterId = `counter:${userId}:${year}`;
        let counterDoc = { _id: counterId, userId, year, lastNumber: startNum };

        try {
            const existing = await axios.get(`${COUCHDB_URL}/${DB_PREFIX}counters/${counterId}`);
            counterDoc = existing.data;
            counterDoc.lastNumber = Math.max(counterDoc.lastNumber + 1, startNum);
        } catch (e) {}

        await axios.put(`${COUCHDB_URL}/${DB_PREFIX}counters/${counterId}`, counterDoc);

        const formatted = `${symbol}/${String(counterDoc.lastNumber).padStart(6, '0')}/${year}`;
        res.json({ number: formatted, nextSeq: counterDoc.lastNumber, symbol, year });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/* ===== ORDER BY ID ===== */

router.get('/:id', requireAuth, async (req, res) => {
    try {
        const dbUrl = `${COUCHDB_URL}/${DB_PREFIX}offers_user_${req.user.id}/${req.params.id}`;
        const result = await axios.get(dbUrl);
        res.json({ data: result.data });
    } catch (e) {
        res.status(404).json({ error: 'Zamówienie nie znalezione' });
    }
});

router.patch('/:id', requireAuth, async (req, res) => {
    try {
        const dbUrl = `${COUCHDB_URL}/${DB_PREFIX}offers_user_${req.user.id}/${req.params.id}`;
        const existing = await axios.get(dbUrl);
        const updated = { ...existing.data, ...req.body, updatedAt: new Date().toISOString() };
        
        await axios.put(dbUrl, updated);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
