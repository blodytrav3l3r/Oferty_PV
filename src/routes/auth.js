const express = require('express');
const bcrypt = require('bcryptjs');
const axios = require('axios');
const { createSession, deleteSession, getSession, requireAuth, requireAdmin, SESSION_MAX_AGE_MS } = require('../middleware/auth');
require('dotenv').config();

const COUCHDB_URL = process.env.COUCHDB_URL;
const DB_PREFIX = process.env.PV_DB_PREFIX || 'pv_';

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Podaj login i hasło' });
    }

    try {
        // Wyszukanie użytkownika po username w CouchDB
        const searchRes = await axios.post(`${COUCHDB_URL}/${DB_PREFIX}users/_find`, {
            selector: { username: username }
        });

        const user = searchRes.data.docs[0];

        if (!user || !user.password || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ error: 'Nieprawidłowy login lub hasło' });
        }

        const userId = user._id.replace('user:', '');
        const token = await createSession(userId);
        
        res.cookie('authToken', token, { httpOnly: false, maxAge: SESSION_MAX_AGE_MS });
        res.json({
            token,
            user: {
                id: userId, 
                username: user.username, 
                role: user.role,
                firstName: user.firstName, 
                lastName: user.lastName,
                phone: user.phone, 
                email: user.email, 
                symbol: user.symbol,
                subUsers: user.subUsers || []
            }
        });
    } catch (e) {
        console.error('[AUTH] Login error:', e.message);
        res.status(500).json({ error: 'Błąd serwera bazy danych CouchDB' });
    }
});

// POST /api/auth/register (admin only)
router.post('/register', requireAuth, requireAdmin, async (req, res) => {
    const { username, password, role, firstName, lastName, phone, email, symbol, subUsers } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Podaj login i hasło' });
    }

    try {
        const existingRes = await axios.post(`${COUCHDB_URL}/${DB_PREFIX}users/_find`, {
            selector: { username: username }
        });

        if (existingRes.data.docs.length > 0) {
            return res.status(409).json({ error: 'Użytkownik o takim loginie już istnieje' });
        }

        const hash = bcrypt.hashSync(password, 10);
        const userId = 'user_' + Date.now();
        
        const newUser = {
            _id: `user:${userId}`,
            type: 'user',
            username,
            password: hash,
            role: role || 'user',
            firstName: firstName || '',
            lastName: lastName || '',
            phone: phone || '',
            email: email || '',
            symbol: symbol || '',
            subUsers: Array.isArray(subUsers) ? subUsers : [],
            createdAt: new Date().toISOString()
        };

        await axios.put(`${COUCHDB_URL}/${DB_PREFIX}users/${newUser._id}`, newUser);
        
        // Utworzenie baz danych dla nowego użytkownika
        await axios.put(`${COUCHDB_URL}/${DB_PREFIX}offers_user_${userId}`);
        await axios.put(`${COUCHDB_URL}/${DB_PREFIX}clients_user_${userId}`);

        const userResponse = { ...newUser };
        delete userResponse.password;
        delete userResponse._id;
        userResponse.id = userId;

        res.json({ user: userResponse });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
    const token = req.headers['x-auth-token'] || req.cookies?.authToken;
    if (token) await deleteSession(token);
    res.clearCookie('authToken');
    res.json({ ok: true });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
    // req.user jest już wypełniony przez middleware requireAuth
    res.json({ user: req.user });
});

// POST /api/auth/change-password
router.post('/change-password', requireAuth, async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
        return res.status(400).json({ error: 'Podaj stare i nowe hasło' });
    }

    try {
        const userRes = await axios.get(`${COUCHDB_URL}/${DB_PREFIX}users/user:${req.user.id}`);
        const user = userRes.data;

        if (!bcrypt.compareSync(oldPassword, user.password)) {
            return res.status(401).json({ error: 'Nieprawidłowe stare hasło' });
        }

        const hash = bcrypt.hashSync(newPassword, 10);
        user.password = hash;
        
        await axios.put(`${COUCHDB_URL}/${DB_PREFIX}users/user:${req.user.id}`, user);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
