const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname, {
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

/* ===== PRODUCTS (CENNIK) ===== */
app.get('/api/products', (req, res) => {
    const data = readData('products', null);
    res.json({ data });
});

app.put('/api/products', (req, res) => {
    writeData('products', req.body.data);
    res.json({ ok: true });
});

/* ===== PRODUCTS DEFAULT (do resetu) ===== */
app.get('/api/products/default', (req, res) => {
    const data = readData('products_default', null);
    res.json({ data });
});

app.put('/api/products/default', (req, res) => {
    writeData('products_default', req.body.data);
    res.json({ ok: true });
});

/* ===== OFFERS ===== */
app.get('/api/offers', (req, res) => {
    const data = readData('offers', []);
    res.json({ data });
});

app.put('/api/offers', (req, res) => {
    writeData('offers', req.body.data);
    res.json({ ok: true });
});

/* ===== CLIENTS ===== */
app.get('/api/clients', (req, res) => {
    const data = readData('clients', []);
    res.json({ data });
});

app.put('/api/clients', (req, res) => {
    writeData('clients', req.body.data);
    res.json({ ok: true });
});

/* ===== START ===== */
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n  🚀 WITROS Oferty — serwer działa na:`);
    console.log(`     http://localhost:${PORT}`);
    console.log(`     Dane zapisywane w: ${DATA_DIR}\n`);
});
