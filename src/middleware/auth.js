const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const axios = require('axios');
require('dotenv').config();

const COUCHDB_URL = process.env.COUCHDB_URL;
const DB_PREFIX = process.env.PV_DB_PREFIX || 'pv_';
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 dni

/**
 * Tworzy nową sesję dla użytkownika.
 */
async function createSession(userId) {
    const token = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    
    const sessionDoc = {
        _id: token,
        userId: userId,
        createdAt: now,
        type: 'session'
    };

    await axios.put(`${COUCHDB_URL}/${DB_PREFIX}sessions/${token}`, sessionDoc);
    return token;
}

/**
 * Pobiera sesję po tokenie.
 */
async function getSession(token) {
    if (!token) return null;
    try {
        const res = await axios.get(`${COUCHDB_URL}/${DB_PREFIX}sessions/${token}`);
        const session = res.data;
        if (Date.now() - session.createdAt > SESSION_MAX_AGE_MS) return null;
        return session;
    } catch (e) {
        return null;
    }
}

/**
 * Kasuje sesję po tokenie.
 */
async function deleteSession(token) {
    try {
        const res = await axios.get(`${COUCHDB_URL}/${DB_PREFIX}sessions/${token}`);
        await axios.delete(`${COUCHDB_URL}/${DB_PREFIX}sessions/${token}?rev=${res.data._rev}`);
    } catch (e) {}
}

/**
 * Middleware: wymaga autoryzacji (ważna sesja).
 */
async function requireAuth(req, res, next) {
    const token = req.headers['x-auth-token'] || req.cookies?.authToken;
    const session = await getSession(token);
    if (!session) {
        return res.status(401).json({ error: 'Nieautoryzowany — zaloguj się' });
    }
    
    try {
        const userRes = await axios.get(`${COUCHDB_URL}/${DB_PREFIX}users/user:${session.userId}`);
        const user = userRes.data;
        req.user = { 
            id: session.userId, 
            username: user.username, 
            role: user.role,
            symbol: user.symbol,
            subUsers: user.subUsers || []
        };
        next();
    } catch (e) {
        return res.status(401).json({ error: 'Użytkownik nie istnieje w bazie CouchDB' });
    }
}

/**
 * Middleware: wymaga roli admin (po requireAuth).
 */
function requireAdmin(req, res, next) {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Brak uprawnień — wymagany administrator' });
    }
    next();
}

/**
 * ensureAdminExists() — teraz obsłużone przez migrację i db_init.js
 */
function ensureAdminExists() {
    console.log('[INFO] ensureAdminExists() is now handled by migration scripts.');
}

module.exports = {
    createSession,
    getSession,
    deleteSession,
    requireAuth,
    requireAdmin,
    ensureAdminExists,
    SESSION_MAX_AGE_MS
};
