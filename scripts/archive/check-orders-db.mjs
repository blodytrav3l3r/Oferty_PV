import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'data', 'app_database.sqlite');
const db = new Database(dbPath);

console.log('=== OFFERS_REL (rury) : OF/000002/AD/2026 ===');
const rows = db.prepare("SELECT id, offer_number, 'rury' as type FROM offers_rel WHERE offer_number LIKE ?").all('%OF/000002/AD/2026%');
rows.forEach(r => console.log(JSON.stringify(r)));

console.log('\n=== OFFERS_STUDNIE_REL (studnie) : OS/000001/AD/2026 ===');
const rows2 = db.prepare("SELECT id, offer_number, 'studnie' as type FROM offers_studnie_rel WHERE offer_number LIKE ?").all('%OS/000001/AD/2026%');
rows2.forEach(r => console.log(JSON.stringify(r)));

if (rows.length > 0) {
  const oid = rows[0].id;
  const orders = db.prepare('SELECT id, offerId, status, createdAt FROM orders_rury_rel WHERE offerId = ?').all(oid);
  console.log('\n=== ORDERS_RURY_REL for offerId', oid, '=== Count:', orders.length);
  orders.forEach(o => console.log(JSON.stringify(o)));
}

if (rows2.length > 0) {
  const oid2 = rows2[0].id;
  const orders2 = db.prepare('SELECT id, offerStudnieId, status, createdAt FROM orders_studnie_rel WHERE offerStudnieId = ?').all(oid2);
  console.log('\n=== ORDERS_STUDNIE_REL for offerId', oid2, '=== Count:', orders2.length);
  orders2.forEach(o => console.log(JSON.stringify(o)));
}

// Also check all orders in both tables
console.log('\n=== ALL ORDERS RURY (first 20) ===');
const allOrders = db.prepare('SELECT id, offerId, status, createdAt FROM orders_rury_rel LIMIT 20').all();
console.log('Total:', allOrders.length);
allOrders.forEach(o => console.log(JSON.stringify(o)));

console.log('\n=== ALL ORDERS STUDNIE (first 20) ===');
const allOrders2 = db.prepare('SELECT id, offerStudnieId, status, createdAt FROM orders_studnie_rel LIMIT 20').all();
console.log('Total:', allOrders2.length);
allOrders2.forEach(o => console.log(JSON.stringify(o)));

// Check ALL offers to see offer_number patterns
console.log('\n=== ALL offer_number values ===');
const nums1 = db.prepare("SELECT id, offer_number FROM offers_rel WHERE offer_number IS NOT NULL AND offer_number != ''").all();
console.log('Rury offers with offer_number:', nums1.length);
nums1.forEach(o => console.log('  ', o.id.substring(0,20)+'...', '→', o.offer_number));

const nums2 = db.prepare("SELECT id, offer_number FROM offers_studnie_rel WHERE offer_number IS NOT NULL AND offer_number != ''").all();
console.log('Studnie offers with offer_number:', nums2.length);
nums2.forEach(o => console.log('  ', o.id.substring(0,20)+'...', '→', o.offer_number));

db.close();
