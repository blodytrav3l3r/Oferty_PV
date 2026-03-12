const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());
// Disable caching for JS files in development
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

/* ===== SQLITE DATABASE INVITE & MIGRATION ===== */
const dbPath = path.join(DATA_DIR, 'app_database.sqlite');
const db = new Database(dbPath);

// Initialize tables
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT,
        firstName TEXT,
        lastName TEXT,
        phone TEXT,
        email TEXT,
        symbol TEXT,
        subUsers TEXT,
        createdAt TEXT
    );
    CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        userId TEXT,
        createdAt INTEGER
    );
    CREATE TABLE IF NOT EXISTS products_rel (
        id TEXT PRIMARY KEY,
        name TEXT,
        price REAL,
        category TEXT,
        weight INTEGER,
        transport INTEGER,
        area REAL
    );
    CREATE TABLE IF NOT EXISTS products_studnie_rel (
        id TEXT PRIMARY KEY,
        name TEXT,
        price REAL,
        category TEXT,
        weight INTEGER,
        componentType TEXT,
        dn INTEGER,
        h INTEGER,
        grubosc INTEGER,
        wewnetrzna INTEGER,
        l INTEGER,
        index_p TEXT,
        formaStandardowa INTEGER,
        spocznikH TEXT,
        data TEXT
    );
    CREATE TABLE IF NOT EXISTS clients_rel (
        id TEXT PRIMARY KEY,
        userId TEXT,
        name TEXT,
        nip TEXT,
        address TEXT,
        email TEXT,
        phone TEXT
    );
    CREATE TABLE IF NOT EXISTS offers_rel (
        id TEXT PRIMARY KEY,
        userId TEXT,
        clientId TEXT,
        state TEXT,
        createdAt TEXT,
        transportCost REAL,
        offer_number TEXT
    );
    CREATE TABLE IF NOT EXISTS offer_items_rel (
        id TEXT PRIMARY KEY,
        offerId TEXT,
        productId TEXT,
        quantity REAL,
        discount REAL,
        price REAL
    );
    CREATE TABLE IF NOT EXISTS offers_studnie_rel (
        id TEXT PRIMARY KEY,
        userId TEXT,
        clientId TEXT,
        state TEXT,
        createdAt TEXT,
        transportCost REAL,
        offer_number TEXT,
        data TEXT
    );
    CREATE TABLE IF NOT EXISTS offer_studnie_items_rel (
        id TEXT PRIMARY KEY,
        offerId TEXT,
        productId TEXT,
        quantity REAL,
        discount REAL,
        price REAL,
        dodatkowe_info TEXT
    );
    CREATE TABLE IF NOT EXISTS orders_studnie_rel (
        id TEXT PRIMARY KEY,
        userId TEXT,
        offerStudnieId TEXT,
        createdAt TEXT,
        status TEXT,
        data TEXT
    );
    CREATE TABLE IF NOT EXISTS production_orders_rel (
        id TEXT PRIMARY KEY,
        userId TEXT,
        orderId TEXT,
        wellId TEXT,
        elementIndex INTEGER,
        createdAt TEXT,
        updatedAt TEXT,
        data TEXT
    );
    CREATE TABLE IF NOT EXISTS order_counters (
        userId TEXT,
        year INTEGER,
        lastNumber INTEGER DEFAULT 0,
        PRIMARY KEY (userId, year)
    );
`);

// Migration: add orderStartNumber column to users if missing
try {
    db.exec(`ALTER TABLE users ADD COLUMN orderStartNumber INTEGER DEFAULT 1`);
    console.log('  ✅ Dodano kolumnę orderStartNumber do users');
} catch (e) {
    // Column already exists — ignore
}

/* ===== HELPERS ===== */

function readDocData(docName) {
    const filePath = path.join(DATA_DIR, docName + '.json');
    try {
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        }
    } catch (e) {
        console.error(`readDocData(${docName}) error:`, e.message);
    }
    return null;
}

function writeDocData(docName, data) {
    const filePath = path.join(DATA_DIR, docName + '.json');
    try {
        fs.writeFileSync(filePath, JSON.stringify(data), 'utf-8');
    } catch (e) {
        console.error(`writeDocData(${docName}) error:`, e.message);
    }
}

function getUserObject(row) {
    if (!row) return null;
    return {
        id: row.id,
        username: row.username,
        password: row.password,
        role: row.role,
        firstName: row.firstName,
        lastName: row.lastName,
        phone: row.phone,
        email: row.email,
        symbol: row.symbol,
        subUsers: JSON.parse(row.subUsers || '[]'),
        orderStartNumber: row.orderStartNumber || 1,
        createdAt: row.createdAt
    };
}


/* ===== AUTO-CREATE ADMIN ===== */
function ensureAdminExists() {
    const admin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
    if (!admin) {
        const hash = bcrypt.hashSync('admin123', 10);
        db.prepare(`INSERT INTO users (id, username, password, role, firstName, lastName, phone, email, symbol, subUsers, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
            'user_admin', 'admin', hash, 'admin', '', '', '', '', 'AD', '[]', new Date().toISOString()
        );
        console.log('  ✅ Utworzono domyślne konto admina: admin / admin123');
    }
}
ensureAdminExists();

/* ===== SESSION MANAGEMENT ===== */
function createSession(userId) {
    const token = crypto.randomBytes(32).toString('hex');
    const now = Date.now();

    // Clean expired
    db.prepare(`DELETE FROM sessions WHERE createdAt < ?`).run(now - 7 * 24 * 60 * 60 * 1000);

    // Insert new
    db.prepare(`INSERT INTO sessions (token, userId, createdAt) VALUES (?, ?, ?)`).run(token, userId, now);
    return token;
}

function getSession(token) {
    if (!token) return null;
    const session = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
    if (!session) return null;
    if (Date.now() - session.createdAt > 7 * 24 * 60 * 60 * 1000) return null;
    return session;
}

function deleteSession(token) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token); // Fix run command mapping
}

/* ===== AUTH MIDDLEWARE ===== */
function requireAuth(req, res, next) {
    const token = req.headers['x-auth-token'] || req.cookies?.authToken;
    const session = getSession(token);
    if (!session) {
        return res.status(401).json({ error: 'Nieautoryzowany — zaloguj się' });
    }
    const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(session.userId);
    if (!userRow) {
        return res.status(401).json({ error: 'Użytkownik nie istnieje' });
    }
    req.user = { id: userRow.id, username: userRow.username, role: userRow.role };
    next();
}

function requireAdmin(req, res, next) {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Brak uprawnień — wymagany administrator' });
    }
    next();
}

/* ===== AUTH ROUTES ===== */
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Podaj login i hasło' });
    }

    const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    const user = getUserObject(row);

    if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ error: 'Nieprawidłowy login lub hasło' });
    }

    const token = createSession(user.id);
    res.cookie('authToken', token, { httpOnly: false, maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.json({ token, user: { id: user.id, username: user.username, role: user.role, firstName: user.firstName, lastName: user.lastName, phone: user.phone, email: user.email, symbol: user.symbol, subUsers: user.subUsers || [] } });
});

app.post('/api/auth/register', requireAuth, requireAdmin, (req, res) => {
    const { username, password, role, firstName, lastName, phone, email, symbol, subUsers, orderStartNumber } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Podaj login i hasło' });
    }
    if (username.length < 3) {
        return res.status(400).json({ error: 'Login musi mieć min. 3 znaki' });
    }
    if (password.length < 4) {
        return res.status(400).json({ error: 'Hasło musi mieć min. 4 znaki' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
        return res.status(409).json({ error: 'Użytkownik o takim loginie już istnieje' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const validRoles = ['admin', 'pro', 'user'];
    const newUserRole = validRoles.includes(role) ? role : 'user';
    const startNum = parseInt(orderStartNumber) || 1;

    const newUser = {
        id: 'user_' + Date.now(),
        username,
        role: newUserRole,
        firstName: firstName || '',
        lastName: lastName || '',
        phone: phone || '',
        email: email || '',
        symbol: symbol || '',
        subUsers: Array.isArray(subUsers) ? subUsers : [],
        createdAt: new Date().toISOString()
    };

    db.prepare(`INSERT INTO users (id, username, password, role, firstName, lastName, phone, email, symbol, subUsers, createdAt, orderStartNumber) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        newUser.id, newUser.username, hash, newUser.role, newUser.firstName, newUser.lastName, newUser.phone, newUser.email, newUser.symbol, JSON.stringify(newUser.subUsers), newUser.createdAt, startNum
    );

    res.json({ user: newUser });
});

app.post('/api/auth/logout', (req, res) => {
    const token = req.headers['x-auth-token'] || req.cookies?.authToken;
    if (token) deleteSession(token);
    res.clearCookie('authToken');
    res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
    const token = req.headers['x-auth-token'] || req.cookies?.authToken;
    const session = getSession(token);
    if (!session) return res.json({ user: null });

    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(session.userId);
    const user = getUserObject(row);
    if (!user) return res.json({ user: null });

    res.json({ user: { id: user.id, username: user.username, role: user.role, firstName: user.firstName, lastName: user.lastName, phone: user.phone, email: user.email, symbol: user.symbol, subUsers: user.subUsers || [] } });
});

app.post('/api/auth/change-password', requireAuth, (req, res) => {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
        return res.status(400).json({ error: 'Podaj stare i nowe hasło' });
    }
    if (newPassword.length < 4) {
        return res.status(400).json({ error: 'Nowe hasło musi mieć min. 4 znaki' });
    }

    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    const user = getUserObject(row);
    if (!user || !bcrypt.compareSync(oldPassword, user.password)) {
        return res.status(401).json({ error: 'Nieprawidłowe stare hasło' });
    }

    const hash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, user.id);

    res.json({ ok: true });
});

/* ===== USERS MANAGEMENT (admin only) ===== */
app.get('/api/users', requireAuth, requireAdmin, (req, res) => {
    const rows = db.prepare('SELECT * FROM users').all();
    const users = rows.map(r => getUserObject(r));
    res.json({ data: users.map(u => ({ id: u.id, username: u.username, role: u.role, firstName: u.firstName, lastName: u.lastName, phone: u.phone, email: u.email, symbol: u.symbol, subUsers: u.subUsers || [], orderStartNumber: u.orderStartNumber || 1, createdAt: u.createdAt })) });
});

app.put('/api/users/:id', requireAuth, requireAdmin, (req, res) => {
    const { username, password, role, firstName, lastName, phone, email, symbol, subUsers, orderStartNumber } = req.body;

    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!row) {
        return res.status(404).json({ error: 'Użytkownik nie znaleziony' });
    }
    const user = getUserObject(row);

    // Check if new username is already taken by someone else
    if (username && username !== user.username) {
        const exist = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
        if (exist) {
            return res.status(409).json({ error: 'Login jest już zajęty' });
        }
        if (username.length < 3) {
            return res.status(400).json({ error: 'Login musi mieć min. 3 znaki' });
        }
        user.username = username;
    }

    let newPasswordHash = row.password;
    if (password) {
        if (password.length < 4) {
            return res.status(400).json({ error: 'Hasło musi mieć min. 4 znaki' });
        }
        newPasswordHash = bcrypt.hashSync(password, 10);
    }

    if (role && ['admin', 'pro', 'user'].includes(role)) {
        if (req.params.id === req.user.id && role !== 'admin') {
            const adminCount = db.prepare("SELECT count(*) as c FROM users WHERE role = 'admin'").get().c;
            if (adminCount <= 1) {
                return res.status(400).json({ error: 'Nie możesz odebrać sobie roli administratora (jesteś ostatnim)' });
            }
        }
        user.role = role;
    }

    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (phone !== undefined) user.phone = phone;
    if (email !== undefined) user.email = email;
    if (symbol !== undefined) user.symbol = symbol;
    if (subUsers !== undefined) user.subUsers = Array.isArray(subUsers) ? subUsers : [];

    const newOrderStart = (orderStartNumber !== undefined) ? (parseInt(orderStartNumber) || 1) : (row.orderStartNumber || 1);

    db.prepare(`UPDATE users SET username=?, password=?, role=?, firstName=?, lastName=?, phone=?, email=?, symbol=?, subUsers=?, orderStartNumber=? WHERE id=?`).run(
        user.username, newPasswordHash, user.role, user.firstName, user.lastName, user.phone, user.email, user.symbol, JSON.stringify(user.subUsers), newOrderStart, user.id
    );

    res.json({ ok: true });
});

app.delete('/api/users/:id', requireAuth, requireAdmin, (req, res) => {
    if (req.params.id === req.user.id) {
        return res.status(400).json({ error: 'Nie można usunąć własnego konta' });
    }
    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
});

/* ===== PRODUCTS (CENNIK) ===== */
app.get('/api/products', (req, res) => {
    try {
        const rows = db.prepare('SELECT * FROM products_rel').all();
        res.json({ data: rows });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/products', requireAuth, (req, res) => {
    try {
        const arr = req.body.data || [];
        db.exec('BEGIN TRANSACTION');
        db.prepare('DELETE FROM products_rel').run();
        const insert = db.prepare('INSERT INTO products_rel (id, name, price, category, weight, transport, area) VALUES (?, ?, ?, ?, ?, ?, ?)');
        for (const p of arr) {
            insert.run(p.id, p.name, p.price, p.category, p.weight, p.transport, p.area);
        }
        db.exec('COMMIT');
        res.json({ ok: true });
    } catch (e) {
        if (db.inTransaction) db.exec('ROLLBACK');
        res.status(500).json({ error: e.message });
    }
});

/* ===== PRODUCTS DEFAULT (do resetu) ===== */
app.get('/api/products/default', (req, res) => {
    const data = readDocData('products_default') || [];
    res.json({ data });
});

app.put('/api/products/default', requireAuth, (req, res) => {
    writeDocData('products_default', req.body.data);
    res.json({ ok: true });
});

/* ===== PRODUCTS STUDNIE (CENNIK STUDNI) ===== */
app.get('/api/products-studnie', (req, res) => {
    try {
        const rows = db.prepare('SELECT * FROM products_studnie_rel').all();
        const mapped = rows.map(r => {
            if (r.data) {
                try {
                    const parsed = JSON.parse(r.data);
                    // Merge relational fields into parsed data just in case
                    return { ...r, ...parsed, data: undefined };
                } catch (e) { }
            }
            return r;
        });
        res.json({ data: mapped });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/products-studnie', requireAuth, (req, res) => {
    try {
        const arr = req.body.data || [];
        db.exec('BEGIN TRANSACTION');
        db.prepare('DELETE FROM products_studnie_rel').run();
        const insert = db.prepare('INSERT INTO products_studnie_rel (id, name, price, category, weight, componentType, dn, h, grubosc, wewnetrzna, l, index_p, formaStandardowa, spocznikH, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        for (const p of arr) {
            insert.run(p.id, p.name, p.price, p.category, p.weight, p.componentType, p.dn, p.height || p.h, p.grubosc, p.wewnetrzna, p.l, p.index_p, p.formaStandardowa, p.spocznikH, JSON.stringify(p));
        }
        db.exec('COMMIT');
        res.json({ ok: true });
    } catch (e) {
        if (db.inTransaction) db.exec('ROLLBACK');
        res.status(500).json({ error: e.message });
    }
});

/* ===== PRODUCTS STUDNIE DEFAULT (do resetu) ===== */
app.get('/api/products-studnie/default', (req, res) => {
    const data = readDocData('products_studnie_default') || [];
    res.json({ data });
});

app.put('/api/products-studnie/default', requireAuth, (req, res) => {
    writeDocData('products_studnie_default', req.body.data);
    res.json({ ok: true });
});

/* ===== OFFERS ===== */
app.get('/api/offers', requireAuth, (req, res) => {
    try {
        let rows = db.prepare('SELECT * FROM offers_rel').all();
        if (req.user.role === 'user') {
            rows = rows.filter(o => o.userId === req.user.id);
        } else if (req.user.role === 'pro') {
            const userRow = db.prepare('SELECT subUsers FROM users WHERE id = ?').get(req.user.id);
            const sub = JSON.parse(userRow?.subUsers || '[]');
            const allowedIds = [req.user.id, ...sub];
            rows = rows.filter(o => allowedIds.includes(o.userId));
        }

        const offersWithDetails = rows.map(offer => {
            const client = db.prepare('SELECT * FROM clients_rel WHERE id = ?').get(offer.clientId) || null;
            const items = db.prepare('SELECT * FROM offer_items_rel WHERE offerId = ?').all(offer.id);
            // Remap for frontend expectations
            const mappedItems = items.map(i => ({ ...i, id: i.productId }));

            let parsedData = {};
            try { if (offer.data) parsedData = JSON.parse(offer.data); } catch (e) { }

            return {
                ...parsedData, // Restores frontend specific props
                ...offer,
                client: client,
                items: mappedItems,
                offerNumber: offer.offer_number || parsedData.offerNumber || parsedData.number,
                data: undefined
            };
        });

        res.json({ data: offersWithDetails });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/offers', requireAuth, (req, res) => {
    try {
        const incoming = req.body.data || [];
        db.exec('BEGIN TRANSACTION');

        const deletedIds = syncDeletions(db, 'offers_rel', incoming, req.user);
        if (deletedIds.length > 0) {
            const placeholders = deletedIds.map(() => '?').join(',');
            db.prepare(`DELETE FROM offer_items_rel WHERE offerId IN (${placeholders})`).run(...deletedIds);
        }

        const stmtOffer = db.prepare('INSERT OR REPLACE INTO offers_rel (id, userId, clientId, state, createdAt, transportCost, offer_number, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        const stmtItem = db.prepare('INSERT OR REPLACE INTO offer_items_rel (id, offerId, productId, quantity, discount, price) VALUES (?, ?, ?, ?, ?, ?)');

        for (const o of incoming) {
            let clientId = null;
            if (o.client && o.client.id) clientId = o.client.id;

            stmtOffer.run(o.id, o.userId || req.user.id, clientId, o.state || 'draft', o.createdAt || new Date().toISOString(), o.transportCost || 0, o.offerNumber || o.offer_number || '', JSON.stringify(o));

            // Delete old items for this offer to replace them
            db.prepare('DELETE FROM offer_items_rel WHERE offerId = ?').run(o.id);

            if (Array.isArray(o.items)) {
                for (const item of o.items) {
                    const itemId = `item_${crypto.randomBytes(8).toString('hex')}`;
                    // Note: frontend sends 'id' as productId
                    stmtItem.run(itemId, o.id, item.id || null, item.quantity || 1, item.discount || 0, item.price || 0);
                }
            }
        }
        db.exec('COMMIT');
        res.json({ ok: true });
    } catch (e) {
        if (db.inTransaction) db.exec('ROLLBACK');
        res.status(500).json({ error: e.message });
    }
});

/* ===== OFFERS STUDNIE ===== */
app.get('/api/offers-studnie', requireAuth, (req, res) => {
    try {
        let rows = db.prepare('SELECT * FROM offers_studnie_rel').all();
        if (req.user.role === 'user') {
            rows = rows.filter(o => o.userId === req.user.id);
        } else if (req.user.role === 'pro') {
            const userRow = db.prepare('SELECT subUsers FROM users WHERE id = ?').get(req.user.id);
            const sub = JSON.parse(userRow?.subUsers || '[]');
            const allowedIds = [req.user.id, ...sub];
            rows = rows.filter(o => allowedIds.includes(o.userId));
        }

        const offersWithDetails = rows.map(offer => {
            const client = db.prepare('SELECT * FROM clients_rel WHERE id = ?').get(offer.clientId) || null;
            let parsedData = {};
            try { if (offer.data) parsedData = JSON.parse(offer.data); } catch (e) { }

            return {
                ...parsedData, // Restores missing fields like date, totalBrutto
                ...offer,
                client: client,
                offerNumber: offer.offer_number || parsedData.offerNumber || parsedData.number,
                wells: parsedData.wells || [],
                items: parsedData.items || [],
                data: undefined
            };
        });

        res.json({ data: offersWithDetails });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/offers-studnie', requireAuth, (req, res) => {
    try {
        const incoming = req.body.data || [];
        db.exec('BEGIN TRANSACTION');

        syncDeletions(db, 'offers_studnie_rel', incoming, req.user);

        const stmtOffer = db.prepare('INSERT OR REPLACE INTO offers_studnie_rel (id, userId, clientId, state, createdAt, transportCost, offer_number, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        for (const o of incoming) {
            let clientId = null;
            if (o.client && o.client.id) clientId = o.client.id;
            // Store the full object 'o' in data so we don't lose frontend properties
            stmtOffer.run(o.id, o.userId || req.user.id, clientId, o.state || 'draft', o.createdAt || new Date().toISOString(), o.transportCost || 0, o.offerNumber || o.offer_number || '', JSON.stringify(o));
        }
        db.exec('COMMIT');
        res.json({ ok: true });
    } catch (e) {
        if (db.inTransaction) db.exec('ROLLBACK');
        res.status(500).json({ error: e.message });
    }
});

// Pomocnicza funkcja do synchronizacji usuwania elementów przesłanych jako pełna lista w żądaniach PUT
function syncDeletions(db, tableName, incomingArray, userReq) {
    const incomingIds = incomingArray.map(item => item.id);
    let currentRows = db.prepare(`SELECT id, userId FROM ${tableName}`).all();

    // Filtrowanie po uprawnieniach wzorem GET
    if (userReq.role === 'user') {
        currentRows = currentRows.filter(o => o.userId === userReq.id);
    } else if (userReq.role === 'pro') {
        const userRow = db.prepare('SELECT subUsers FROM users WHERE id = ?').get(userReq.id);
        const sub = JSON.parse(userRow?.subUsers || '[]');
        const allowedUserIds = [userReq.id, ...sub];
        currentRows = currentRows.filter(o => allowedUserIds.includes(o.userId));
    }

    const allowedIds = currentRows.map(r => r.id);
    const toDelete = allowedIds.filter(id => !incomingIds.includes(id));

    if (toDelete.length > 0) {
        const placeholders = toDelete.map(() => '?').join(',');
        db.prepare(`DELETE FROM ${tableName} WHERE id IN (${placeholders})`).run(...toDelete);
        return toDelete;
    }
    return [];
}

/* ===== ORDERS STUDNIE (Zamówienia) ===== */
app.get('/api/orders-studnie', requireAuth, (req, res) => {
    try {
        let rows = db.prepare('SELECT * FROM orders_studnie_rel').all();
        if (req.user.role === 'user') {
            rows = rows.filter(o => o.userId === req.user.id);
        } else if (req.user.role === 'pro') {
            const userRow = db.prepare('SELECT subUsers FROM users WHERE id = ?').get(req.user.id);
            const sub = JSON.parse(userRow?.subUsers || '[]');
            const allowedIds = [req.user.id, ...sub];
            rows = rows.filter(o => allowedIds.includes(o.userId));
        }

        const mapped = rows.map(r => {
            if (r.data) {
                return JSON.parse(r.data); // Fallback to full data to not break old frontend layout completely
            }
            return r;
        });

        res.json({ data: mapped });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/orders-studnie', requireAuth, (req, res) => {
    try {
        const incoming = req.body.data || [];
        db.exec('BEGIN TRANSACTION');

        syncDeletions(db, 'orders_studnie_rel', incoming, req.user);

        const stmt = db.prepare('INSERT OR REPLACE INTO orders_studnie_rel (id, userId, offerStudnieId, createdAt, status, data) VALUES (?, ?, ?, ?, ?, ?)');
        for (const o of incoming) {
            stmt.run(o.id, o.userId || null, o.offerStudnieId || o.offerId || null, o.createdAt || new Date().toISOString(), o.status || 'nowe', JSON.stringify(o));
        }
        db.exec('COMMIT');
        res.json({ ok: true });
    } catch (e) {
        if (db.inTransaction) db.exec('ROLLBACK');
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/orders-studnie/:id', requireAuth, (req, res) => {
    try {
        const row = db.prepare('SELECT * FROM orders_studnie_rel WHERE id = ?').get(req.params.id);
        if (!row) return res.status(404).json({ error: 'Zamówienie nie znalezione' });
        const order = row.data ? JSON.parse(row.data) : row;
        res.json({ data: order });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.patch('/api/orders-studnie/:id', requireAuth, (req, res) => {
    try {
        const row = db.prepare('SELECT * FROM orders_studnie_rel WHERE id = ?').get(req.params.id);
        if (!row) return res.status(404).json({ error: 'Zamówienie nie znalezione' });

        let order = row.data ? JSON.parse(row.data) : row;
        order = { ...order, ...req.body, id: req.params.id };

        db.prepare('UPDATE orders_studnie_rel SET status = ?, data = ? WHERE id = ?').run(
            order.status || 'nowe', JSON.stringify(order), req.params.id
        );
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/* ===== PRODUCTION ORDERS (Zlecenia Produkcyjne) ===== */
app.get('/api/production-orders', requireAuth, (req, res) => {
    try {
        let rows = db.prepare('SELECT * FROM production_orders_rel').all();
        if (req.user.role === 'user') {
            rows = rows.filter(o => o.userId === req.user.id);
        } else if (req.user.role === 'pro') {
            const userRow = db.prepare('SELECT subUsers FROM users WHERE id = ?').get(req.user.id);
            const sub = JSON.parse(userRow?.subUsers || '[]');
            const allowedIds = [req.user.id, ...sub];
            rows = rows.filter(o => allowedIds.includes(o.userId));
        }
        const mapped = rows.map(r => {
            if (r.data) {
                try { return { ...JSON.parse(r.data), id: r.id }; } catch (e) { }
            }
            return r;
        });
        res.json({ data: mapped });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/production-orders', requireAuth, (req, res) => {
    try {
        const incoming = req.body.data || [];
        db.exec('BEGIN TRANSACTION');
        const stmt = db.prepare('INSERT OR REPLACE INTO production_orders_rel (id, userId, orderId, wellId, elementIndex, createdAt, updatedAt, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        for (const o of incoming) {
            stmt.run(o.id, o.userId || req.user.id, o.orderId || null, o.wellId || null, o.elementIndex ?? 0, o.createdAt || new Date().toISOString(), new Date().toISOString(), JSON.stringify(o));
        }
        db.exec('COMMIT');
        res.json({ ok: true });
    } catch (e) {
        if (db.inTransaction) db.exec('ROLLBACK');
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/production-orders/:id', requireAuth, (req, res) => {
    try {
        const row = db.prepare('SELECT * FROM production_orders_rel WHERE id = ?').get(req.params.id);
        if (!row) return res.status(404).json({ error: 'Zlecenie nie znalezione' });
        const order = row.data ? JSON.parse(row.data) : row;
        res.json({ data: order });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/production-orders/:id', requireAuth, (req, res) => {
    try {
        db.prepare('DELETE FROM production_orders_rel WHERE id = ?').run(req.params.id);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/* ===== CLIENTS ===== */
app.get('/api/clients', requireAuth, (req, res) => {
    try {
        const rows = db.prepare('SELECT * FROM clients_rel').all();
        res.json({ data: rows });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/clients', requireAuth, (req, res) => {
    try {
        const arr = req.body.data || [];
        db.exec('BEGIN TRANSACTION');

        syncDeletions(db, 'clients_rel', arr, req.user);

        const stmt = db.prepare('INSERT OR REPLACE INTO clients_rel (id, userId, name, nip, address, email, phone) VALUES (?, ?, ?, ?, ?, ?, ?)');
        for (const c of arr) {
            stmt.run(c.id, c.userId || null, c.name || '', c.nip || '', c.address || '', c.email || '', c.phone || '');
        }
        db.exec('COMMIT');
        res.json({ ok: true });
    } catch (e) {
        if (db.inTransaction) db.exec('ROLLBACK');
        res.status(500).json({ error: e.message });
    }
});

/* ===== ORDER NUMBER GENERATION ===== */
app.get('/api/next-order-number/:userId', requireAuth, (req, res) => {
    try {
        const userId = req.params.userId;
        const userRow = db.prepare('SELECT symbol, orderStartNumber FROM users WHERE id = ?').get(userId);
        if (!userRow) return res.status(404).json({ error: 'Użytkownik nie znaleziony' });

        const symbol = userRow.symbol || '??';
        const startNum = userRow.orderStartNumber || 1;
        const year = new Date().getFullYear();

        const counter = db.prepare('SELECT lastNumber FROM order_counters WHERE userId = ? AND year = ?').get(userId, year);
        let nextNumber;
        if (!counter) {
            nextNumber = startNum;
        } else {
            nextNumber = Math.max(counter.lastNumber + 1, startNum);
        }

        const formatted = `${symbol}/${String(nextNumber).padStart(3, '0')}/${year}`;
        res.json({ number: formatted, nextSeq: nextNumber, symbol, year });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/claim-order-number/:userId', requireAuth, (req, res) => {
    try {
        const userId = req.params.userId;
        const userRow = db.prepare('SELECT symbol, orderStartNumber FROM users WHERE id = ?').get(userId);
        if (!userRow) return res.status(404).json({ error: 'Użytkownik nie znaleziony' });

        const symbol = userRow.symbol || '??';
        const startNum = userRow.orderStartNumber || 1;
        const year = new Date().getFullYear();

        const counter = db.prepare('SELECT lastNumber FROM order_counters WHERE userId = ? AND year = ?').get(userId, year);
        let nextNumber;
        if (!counter) {
            nextNumber = startNum;
            db.prepare('INSERT INTO order_counters (userId, year, lastNumber) VALUES (?, ?, ?)').run(userId, year, nextNumber);
        } else {
            nextNumber = Math.max(counter.lastNumber + 1, startNum);
            db.prepare('UPDATE order_counters SET lastNumber = ? WHERE userId = ? AND year = ?').run(nextNumber, userId, year);
        }

        const formatted = `${symbol}/${String(nextNumber).padStart(3, '0')}/${year}`;
        res.json({ number: formatted, nextSeq: nextNumber, symbol, year });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/* ===== START ===== */
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
    console.log(`\n  🚀 WITROS Oferty — serwer działa na: `);
    console.log(`     http://localhost:${PORT}`);
    console.log(`     Baza SQLite: ${dbPath}\n`);
});
