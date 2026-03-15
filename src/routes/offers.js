const express = require('express');
const axios = require('axios');
const { filterRowsByRole, COUCHDB_URL, DB_PREFIX } = require('../helpers');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * POMOCNICZE: Pobieranie wszystkich dokumentów z bazy użytkownika
 */
async function getUserOffers(userId) {
    try {
        const res = await axios.get(`${COUCHDB_URL}/${DB_PREFIX}offers_user_${userId}/_all_docs?include_docs=true`);
        return res.data.rows.map(r => r.doc).filter(d => !d._id.startsWith('_'));
    } catch (e) {
        console.error(`[Offers] Error fetching from CouchDB for user ${userId}:`, e.message);
        return [];
    }
}

/* ===== OFFERS (RURY + STUDNIE) ===== */

// GET /api/offers -> Pobiera oferty typu 'offer' (Rury)
router.get('/', requireAuth, async (req, res) => {
    try {
        let allOffers = [];
        // Jeśli admin, pobierz ze wszystkich baz? Dla uproszczenia na razie z bazy aktualnego usera
        // W pełnej wersji admin mógłby przeszukiwać pv_offers_global
        allOffers = await getUserOffers(req.user.id);
        
        const filtered = allOffers.filter(d => d.type === 'offer');
        // Mapujemy na format oczekiwany przez stary frontend
        const mapped = filtered.map(doc => ({
            ...doc,
            id: doc._id
        }));

        res.json({ data: mapped });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/offers/studnie -> Pobiera oferty typu 'studnia_oferta'
router.get('/studnie', requireAuth, async (req, res) => {
    try {
        const allOffers = await getUserOffers(req.user.id);
        const filtered = allOffers.filter(d => d.type === 'studnia_oferta');
        const mapped = filtered.map(doc => ({
            ...doc,
            id: doc._id
        }));
        res.json({ data: mapped });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// PUT /api/offers -> Masowy zapis (używany jako fallback lub pełna synchronizacja)
router.put('/', requireAuth, async (req, res) => {
    try {
        const incoming = req.body.data || [];
        const dbUrl = `${COUCHDB_URL}/${DB_PREFIX}offers_user_${req.user.id}`;
        
        for (const o of incoming) {
            const docId = o.id || o._id || `offer:${req.user.id}:${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            const doc = { 
                ...o, 
                _id: docId, 
                type: 'offer',
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

// PUT /api/offers/studnie -> Masowy zapis Studni
router.put('/studnie', requireAuth, async (req, res) => {
    try {
        const incoming = req.body.data || [];
        const dbUrl = `${COUCHDB_URL}/${DB_PREFIX}offers_user_${req.user.id}`;
        
        for (const o of incoming) {
            const docId = o.id || o._id || `offer:studnie:${req.user.id}:${Date.now()}`;
            const doc = { 
                ...o, 
                _id: docId, 
                type: 'studnia_oferta',
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
