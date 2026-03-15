const express = require('express');
const axios = require('axios');
const { COUCHDB_URL, DB_PREFIX } = require('../helpers');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/clients -> Pobiera klientów z bazy użytkownika
router.get('/', requireAuth, async (req, res) => {
    try {
        const dbUrl = `${COUCHDB_URL}/${DB_PREFIX}clients_user_${req.user.id}/_all_docs?include_docs=true`;
        const result = await axios.get(dbUrl);
        const docs = result.data.rows.map(r => r.doc).filter(d => !d._id.startsWith('_'));
        
        const mapped = docs.map(d => ({
            ...d,
            id: d._id
        }));

        res.json({ data: mapped });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// PUT /api/clients -> Synchronizacja klientów
router.put('/', requireAuth, async (req, res) => {
    try {
        const arr = req.body.data || [];
        const dbUrl = `${COUCHDB_URL}/${DB_PREFIX}clients_user_${req.user.id}`;

        for (const c of arr) {
            const docId = c.id || c._id || `client:${req.user.id}:${Date.now()}`;
            const doc = {
                ...c,
                _id: docId,
                type: 'client',
                userId: req.user.id,
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

module.exports = router;
