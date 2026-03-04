const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');

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
app.use(express.static(path.join(__dirname, 'public'), {
    index: 'index.html',
    extensions: ['html']
}));

/* ===== HELPERS ===== */
function getFilePath(name) {
    return path.join(DATA_DIR, `${name}.json`);
}

function readData(name, fallback = []) {
    const filePath = getFilePath(name);
    try {
        if (fs.existsSync(filePath)) {
            const raw = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(raw);
        }
    } catch (err) {
        console.error(`Error reading ${name}:`, err.message);
    }
    return fallback;
}

function writeData(name, data) {
    const filePath = getFilePath(name);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/* ===== AUTO-CREATE ADMIN ===== */
function ensureAdminExists() {
    let users = readData('users', []);
    if (users.length === 0) {
        const hash = bcrypt.hashSync('admin123', 10);
        users.push({
            id: 'user_admin',
            username: 'admin',
            password: hash,
            role: 'admin',
            createdAt: new Date().toISOString()
        });
        writeData('users', users);
        console.log('  ✅ Utworzono domyślne konto admina: admin / admin123');
    }
}
ensureAdminExists();

/* ===== SESSION MANAGEMENT ===== */
function createSession(userId) {
    const sessions = readData('sessions', []);
    const token = crypto.randomBytes(32).toString('hex');
    // Clean expired sessions (older than 7 days)
    const now = Date.now();
    const valid = sessions.filter(s => now - s.createdAt < 7 * 24 * 60 * 60 * 1000);
    valid.push({ token, userId, createdAt: now });
    writeData('sessions', valid);
    return token;
}

function getSession(token) {
    if (!token) return null;
    const sessions = readData('sessions', []);
    const session = sessions.find(s => s.token === token);
    if (!session) return null;
    // Check expiry (7 days)
    if (Date.now() - session.createdAt > 7 * 24 * 60 * 60 * 1000) return null;
    return session;
}

function deleteSession(token) {
    let sessions = readData('sessions', []);
    sessions = sessions.filter(s => s.token !== token);
    writeData('sessions', sessions);
}

/* ===== AUTH MIDDLEWARE ===== */
function requireAuth(req, res, next) {
    const token = req.headers['x-auth-token'] || req.cookies?.authToken;
    const session = getSession(token);
    if (!session) {
        return res.status(401).json({ error: 'Nieautoryzowany — zaloguj się' });
    }
    const users = readData('users', []);
    const user = users.find(u => u.id === session.userId);
    if (!user) {
        return res.status(401).json({ error: 'Użytkownik nie istnieje' });
    }
    req.user = { id: user.id, username: user.username, role: user.role };
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
    const users = readData('users', []);
    const user = users.find(u => u.username === username);
    if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ error: 'Nieprawidłowy login lub hasło' });
    }
    const token = createSession(user.id);
    res.cookie('authToken', token, { httpOnly: false, maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.json({ token, user: { id: user.id, username: user.username, role: user.role, firstName: user.firstName, lastName: user.lastName, phone: user.phone, email: user.email, symbol: user.symbol, subUsers: user.subUsers || [] } });
});

app.post('/api/auth/register', requireAuth, requireAdmin, (req, res) => {
    const { username, password, role, firstName, lastName, phone, email, symbol, subUsers } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Podaj login i hasło' });
    }
    if (username.length < 3) {
        return res.status(400).json({ error: 'Login musi mieć min. 3 znaki' });
    }
    if (password.length < 4) {
        return res.status(400).json({ error: 'Hasło musi mieć min. 4 znaki' });
    }
    const users = readData('users', []);
    if (users.find(u => u.username === username)) {
        return res.status(409).json({ error: 'Użytkownik o takim loginie już istnieje' });
    }
    const hash = bcrypt.hashSync(password, 10);
    const validRoles = ['admin', 'pro', 'user'];
    const newUserRole = validRoles.includes(role) ? role : 'user';
    const newUser = {
        id: 'user_' + Date.now(),
        username,
        password: hash,
        role: newUserRole,
        firstName: firstName || '',
        lastName: lastName || '',
        phone: phone || '',
        email: email || '',
        symbol: symbol || '',
        subUsers: Array.isArray(subUsers) ? subUsers : [],
        createdAt: new Date().toISOString()
    };
    users.push(newUser);
    writeData('users', users);
    res.json({ user: { id: newUser.id, username: newUser.username, role: newUser.role, firstName: newUser.firstName, lastName: newUser.lastName, phone: newUser.phone, email: newUser.email, symbol: newUser.symbol, subUsers: newUser.subUsers } });
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
    const users = readData('users', []);
    const user = users.find(u => u.id === session.userId);
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
    const users = readData('users', []);
    const user = users.find(u => u.id === req.user.id);
    if (!user || !bcrypt.compareSync(oldPassword, user.password)) {
        return res.status(401).json({ error: 'Nieprawidłowe stare hasło' });
    }
    user.password = bcrypt.hashSync(newPassword, 10);
    writeData('users', users);
    res.json({ ok: true });
});

/* ===== USERS MANAGEMENT (admin only) ===== */
app.get('/api/users', requireAuth, requireAdmin, (req, res) => {
    const users = readData('users', []);
    res.json({ data: users.map(u => ({ id: u.id, username: u.username, role: u.role, firstName: u.firstName, lastName: u.lastName, phone: u.phone, email: u.email, symbol: u.symbol, subUsers: u.subUsers || [], createdAt: u.createdAt })) });
});

app.put('/api/users/:id', requireAuth, requireAdmin, (req, res) => {
    const { username, password, role, firstName, lastName, phone, email, symbol, subUsers } = req.body;
    let users = readData('users', []);
    const userIndex = users.findIndex(u => u.id === req.params.id);

    if (userIndex === -1) {
        return res.status(404).json({ error: 'Użytkownik nie znaleziony' });
    }

    // Check if new username is already taken by someone else
    if (username && username !== users[userIndex].username) {
        if (users.find(u => u.username === username)) {
            return res.status(409).json({ error: 'Login jest już zajęty' });
        }
        if (username.length < 3) {
            return res.status(400).json({ error: 'Login musi mieć min. 3 znaki' });
        }
        users[userIndex].username = username;
    }

    if (password) {
        if (password.length < 4) {
            return res.status(400).json({ error: 'Hasło musi mieć min. 4 znaki' });
        }
        users[userIndex].password = bcrypt.hashSync(password, 10);
    }

    if (role && ['admin', 'pro', 'user'].includes(role)) {
        // Prevent admin from removing their own admin role if they are the last admin
        if (req.params.id === req.user.id && role !== 'admin') {
            const adminCount = users.filter(u => u.role === 'admin').length;
            if (adminCount <= 1) {
                return res.status(400).json({ error: 'Nie możesz odebrać sobie roli administratora (jesteś ostatnim)' });
            }
        }
        users[userIndex].role = role;
    }

    if (firstName !== undefined) users[userIndex].firstName = firstName;
    if (lastName !== undefined) users[userIndex].lastName = lastName;
    if (phone !== undefined) users[userIndex].phone = phone;
    if (email !== undefined) users[userIndex].email = email;
    if (symbol !== undefined) users[userIndex].symbol = symbol;
    if (subUsers !== undefined) users[userIndex].subUsers = Array.isArray(subUsers) ? subUsers : [];

    writeData('users', users);
    res.json({ ok: true });
});

app.delete('/api/users/:id', requireAuth, requireAdmin, (req, res) => {
    if (req.params.id === req.user.id) {
        return res.status(400).json({ error: 'Nie można usunąć własnego konta' });
    }
    let users = readData('users', []);
    users = users.filter(u => u.id !== req.params.id);
    writeData('users', users);
    res.json({ ok: true });
});

/* ===== PRODUCTS (CENNIK) ===== */
app.get('/api/products', (req, res) => {
    const data = readData('products', null);
    res.json({ data });
});

app.put('/api/products', requireAuth, (req, res) => {
    writeData('products', req.body.data);
    res.json({ ok: true });
});

/* ===== PRODUCTS DEFAULT (do resetu) ===== */
app.get('/api/products/default', (req, res) => {
    const data = readData('products_default', null);
    res.json({ data });
});

app.put('/api/products/default', requireAuth, (req, res) => {
    writeData('products_default', req.body.data);
    res.json({ ok: true });
});

/* ===== PRODUCTS STUDNIE (CENNIK STUDNI) ===== */
app.get('/api/products-studnie', (req, res) => {
    const data = readData('products_studnie', null);
    res.json({ data });
});

app.put('/api/products-studnie', requireAuth, (req, res) => {
    writeData('products_studnie', req.body.data);
    res.json({ ok: true });
});

/* ===== PRODUCTS STUDNIE DEFAULT (do resetu) ===== */
app.get('/api/products-studnie/default', (req, res) => {
    const data = readData('products_studnie_default', null);
    res.json({ data });
});

app.put('/api/products-studnie/default', requireAuth, (req, res) => {
    writeData('products_studnie_default', req.body.data);
    res.json({ ok: true });
});

/* ===== OFFERS ===== */
app.get('/api/offers', requireAuth, (req, res) => {
    let data = readData('offers', []);
    if (req.user.role === 'user') {
        data = data.filter(o => o.userId === req.user.id);
    } else if (req.user.role === 'pro') {
        const allowedIds = [req.user.id, ...(req.user.subUsers || [])];
        data = data.filter(o => allowedIds.includes(o.userId));
    }
    res.json({ data });
});

app.put('/api/offers', requireAuth, (req, res) => {
    const allOffers = readData('offers', []);
    const incoming = req.body.data || [];

    if (req.user.role === 'admin') {
        writeData('offers', incoming);
    } else if (req.user.role === 'pro') {
        const allowedIds = [req.user.id, ...(req.user.subUsers || [])];
        const othersOffers = allOffers.filter(o => o.userId && !allowedIds.includes(o.userId));
        const userOffers = incoming.filter(o => !o.userId || allowedIds.includes(o.userId));
        writeData('offers', [...othersOffers, ...userOffers]);
    } else {
        const othersOffers = allOffers.filter(o => o.userId && o.userId !== req.user.id);
        const userOffers = incoming.filter(o => !o.userId || o.userId === req.user.id);
        writeData('offers', [...othersOffers, ...userOffers]);
    }
    res.json({ ok: true });
});

/* ===== OFFERS STUDNIE ===== */
app.get('/api/offers-studnie', requireAuth, (req, res) => {
    let data = readData('offers_studnie', []);
    if (req.user.role === 'user') {
        data = data.filter(o => o.userId === req.user.id);
    } else if (req.user.role === 'pro') {
        const allowedIds = [req.user.id, ...(req.user.subUsers || [])];
        data = data.filter(o => allowedIds.includes(o.userId));
    }
    res.json({ data });
});

app.put('/api/offers-studnie', requireAuth, (req, res) => {
    const allOffers = readData('offers_studnie', []);
    const incoming = req.body.data || [];

    if (req.user.role === 'admin') {
        writeData('offers_studnie', incoming);
    } else if (req.user.role === 'pro') {
        const allowedIds = [req.user.id, ...(req.user.subUsers || [])];
        const othersOffers = allOffers.filter(o => o.userId && !allowedIds.includes(o.userId));
        const userOffers = incoming.filter(o => !o.userId || allowedIds.includes(o.userId));
        writeData('offers_studnie', [...othersOffers, ...userOffers]);
    } else {
        const othersOffers = allOffers.filter(o => o.userId && o.userId !== req.user.id);
        const userOffers = incoming.filter(o => !o.userId || o.userId === req.user.id);
        writeData('offers_studnie', [...othersOffers, ...userOffers]);
    }
    res.json({ ok: true });
});

/* ===== ORDERS STUDNIE (Zamówienia) ===== */
app.get('/api/orders-studnie', requireAuth, (req, res) => {
    let data = readData('orders_studnie', []);
    if (req.user.role === 'user') {
        data = data.filter(o => o.userId === req.user.id);
    } else if (req.user.role === 'pro') {
        const allowedIds = [req.user.id, ...(req.user.subUsers || [])];
        data = data.filter(o => allowedIds.includes(o.userId));
    }
    res.json({ data });
});

app.put('/api/orders-studnie', requireAuth, (req, res) => {
    const allOrders = readData('orders_studnie', []);
    const incoming = req.body.data || [];

    if (req.user.role === 'admin') {
        writeData('orders_studnie', incoming);
    } else if (req.user.role === 'pro') {
        const allowedIds = [req.user.id, ...(req.user.subUsers || [])];
        const othersOrders = allOrders.filter(o => o.userId && !allowedIds.includes(o.userId));
        const userOrders = incoming.filter(o => !o.userId || allowedIds.includes(o.userId));
        writeData('orders_studnie', [...othersOrders, ...userOrders]);
    } else {
        const othersOrders = allOrders.filter(o => o.userId && o.userId !== req.user.id);
        const userOrders = incoming.filter(o => !o.userId || o.userId === req.user.id);
        writeData('orders_studnie', [...othersOrders, ...userOrders]);
    }
    res.json({ ok: true });
});

app.get('/api/orders-studnie/:id', requireAuth, (req, res) => {
    const data = readData('orders_studnie', []);
    const order = data.find(o => o.id === req.params.id);
    if (!order) return res.status(404).json({ error: 'Zamówienie nie znalezione' });
    res.json({ data: order });
});

app.patch('/api/orders-studnie/:id', requireAuth, (req, res) => {
    let data = readData('orders_studnie', []);
    const idx = data.findIndex(o => o.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Zamówienie nie znalezione' });
    data[idx] = { ...data[idx], ...req.body, id: req.params.id };
    writeData('orders_studnie', data);
    res.json({ ok: true });
});

/* ===== CLIENTS ===== */
app.get('/api/clients', requireAuth, (req, res) => {
    const data = readData('clients', []);
    res.json({ data });
});

app.put('/api/clients', requireAuth, (req, res) => {
    writeData('clients', req.body.data);
    res.json({ ok: true });
});

/* ===== START ===== */
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
    console.log(`\n  🚀 WITROS Oferty — serwer działa na:`);
    console.log(`     http://localhost:${PORT}`);
    console.log(`     Dane zapisywane w: ${DATA_DIR}\n`);
});
