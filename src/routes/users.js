const express = require('express');
const bcrypt = require('bcryptjs');
const axios = require('axios');
const { getUserObject, COUCHDB_URL, DB_PREFIX } = require('../helpers');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

/**
 * POMOCNICZE: Pobieranie licznika zamówień z CouchDB
 */
async function getNextOrderNumber(user, year) {
    const counterId = `counter:${user.id}:${year}`;
    const startNum = user.orderStartNumber || 1;
    const symbol = user.symbol || '??';
    
    try {
        const res = await axios.get(`${COUCHDB_URL}/${DB_PREFIX}counters/${counterId}`);
        const lastNum = res.data.lastNumber || 0;
        const nextNum = Math.max(lastNum + 1, startNum);
        return `${symbol}/${String(nextNum).padStart(6, '0')}/${year}`;
    } catch (e) {
        return `${symbol}/${String(startNum).padStart(6, '0')}/${year}`;
    }
}

// GET /api/users (admin only)
router.get('/', requireAuth, requireAdmin, async (req, res) => {
    try {
        const result = await axios.get(`${COUCHDB_URL}/${DB_PREFIX}users/_all_docs?include_docs=true`);
        const docs = result.data.rows.map(r => r.doc).filter(d => d.type === 'user');
        const year = new Date().getFullYear();

        const usersData = [];
        for (const doc of docs) {
            const u = getUserObject(doc);
            const nextOrderNumber = await getNextOrderNumber(u, year);
            usersData.push({
                ...u,
                nextOrderNumber
            });
        }
        res.json({ data: usersData });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// PUT /api/users/:id (admin only)
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
    const { username, password, role, firstName, lastName, phone, email, symbol, subUsers, orderStartNumber } = req.body;
    const docId = `user:${req.params.id}`;

    try {
        const userRes = await axios.get(`${COUCHDB_URL}/${DB_PREFIX}users/${docId}`);
        const user = userRes.data;

        if (username && username !== user.username) {
            const existRes = await axios.post(`${COUCHDB_URL}/${DB_PREFIX}users/_find`, { selector: { username } });
            if (existRes.data.docs.length > 0) return res.status(409).json({ error: 'Login zajęty' });
            user.username = username;
        }

        if (password) {
            user.password = bcrypt.hashSync(password, 10);
        }

        if (role) {
            // Logika zabezpieczenia ostatniego admina (sqlite) - ominięta dla CouchDB dla uproszczenia
            user.role = role;
        }

        if (firstName !== undefined) user.firstName = firstName;
        if (lastName !== undefined) user.lastName = lastName;
        if (phone !== undefined) user.phone = phone;
        if (email !== undefined) user.email = email;
        if (symbol !== undefined) user.symbol = symbol;
        if (subUsers !== undefined) user.subUsers = Array.isArray(subUsers) ? subUsers : [];
        if (orderStartNumber !== undefined) user.orderStartNumber = parseInt(orderStartNumber) || 1;

        await axios.put(`${COUCHDB_URL}/${DB_PREFIX}users/${docId}`, user);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// DELETE /api/users/:id (admin only)
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
    if (req.params.id === req.user.id) return res.status(400).json({ error: 'Nie możesz usunąć siebie' });
    
    try {
        const userRes = await axios.get(`${COUCHDB_URL}/${DB_PREFIX}users/user:${req.params.id}`);
        await axios.delete(`${COUCHDB_URL}/${DB_PREFIX}users/user:${req.params.id}?rev=${userRes.data._rev}`);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/users-for-assignment
router.get('/for-assignment', requireAuth, async (req, res) => {
    try {
        const result = await axios.get(`${COUCHDB_URL}/${DB_PREFIX}users/_all_docs?include_docs=true`);
        const allUsers = result.data.rows.map(r => r.doc).filter(d => d.type === 'user').map(d => getUserObject(d));

        const mapUser = (u) => ({
            id: u.id, username: u.username, role: u.role,
            firstName: u.firstName, lastName: u.lastName,
            symbol: u.symbol
        });

        if (req.user.role === 'admin') {
            return res.json({ data: allUsers.map(mapUser) });
        }

        const allowedIds = [req.user.id, ...(req.user.subUsers || [])];
        const filtered = allUsers.filter(u => allowedIds.includes(u.id));
        res.json({ data: filtered.map(mapUser) });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
