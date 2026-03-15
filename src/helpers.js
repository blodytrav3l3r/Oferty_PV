const fs = require('fs');
const path = require('path');
require('dotenv').config();

const COUCHDB_URL = process.env.COUCHDB_URL;
const DB_PREFIX = process.env.PV_DB_PREFIX || 'pv_';

/**
 * Mapuje dokument CouchDB na obiekt kompatybilny ze starym UI.
 * @param {object|null} doc - dokument z CouchDB
 * @returns {object|null}
 */
function getUserObject(doc) {
    if (!doc) return null;
    return {
        id: doc._id.replace('user:', ''),
        username: doc.username,
        password: doc.password,
        role: doc.role,
        firstName: doc.firstName,
        lastName: doc.lastName,
        phone: doc.phone,
        email: doc.email,
        symbol: doc.symbol,
        subUsers: doc.subUsers || [],
        orderStartNumber: doc.orderStartNumber || 1,
        createdAt: doc.createdAt
    };
}

/**
 * Filtruje wiersze (dokumenty) wg roli użytkownika.
 * @param {Array} docs - tablica dokumentów
 * @param {object} user - obiekt req.user z polami id, role, subUsers
 * @returns {Array} - przefiltrowane dokumenty
 */
function filterRowsByRole(docs, user) {
    if (user.role === 'user') {
        return docs.filter(o => o.userId === user.id);
    }
    if (user.role === 'pro') {
        const allowedIds = [user.id, ...(user.subUsers || [])];
        return docs.filter(o => allowedIds.includes(o.userId));
    }
    return docs; // admin — widzi wszystko
}

module.exports = {
    getUserObject,
    filterRowsByRole,
    COUCHDB_URL,
    DB_PREFIX
};
