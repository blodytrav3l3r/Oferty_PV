/**
 * PV Marketplace - Data Migration Tool
 * Migrates data from SQLite to CouchDB Architecture.
 */

require('dotenv').config();
const axios = require('axios');
const { db } = require('./db');

const COUCHDB_URL = process.env.COUCHDB_URL;
const DB_PREFIX = process.env.PV_DB_PREFIX || 'pv_';

async function migrate() {
  console.log('[INFO] Starting Data Migration...');

  try {
    // 1. Migrate Users
    const users = db.prepare('SELECT * FROM users').all();
    console.log(`[INFO] Migrating ${users.length} users...`);
    
    for (const user of users) {
      const userDoc = {
        _id: `user:${user.id}`,
        type: 'user',
        username: user.username,
        role: user.role || 'user',
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        createdAt: user.createdAt || new Date().toISOString()
      };
      
      try {
        await axios.put(`${COUCHDB_URL}/${DB_PREFIX}users/${userDoc._id}`, userDoc);
        
        // Utwórz bazy izolowane dla użytkownika (Oferty i Klienci)
        await axios.put(`${COUCHDB_URL}/${DB_PREFIX}offers_user_${user.id}`);
        await axios.put(`${COUCHDB_URL}/${DB_PREFIX}clients_user_${user.id}`);
        console.log(`   [OK] User ${user.username} migrated and isolated DBs created.`);
      } catch (e) {
        if (e.response && e.response.status === 409) {
            console.log(`   [INFO] User ${user.username} already in CouchDB.`);
        } else {
             console.error(`   [ERROR] Error migrating user ${user.username}:`, e.message);
        }
      }

      // 2. Migrate Offers for this user
      const offers = db.prepare('SELECT * FROM offers_rel WHERE userId = ?').all(user.id);
      console.log(`   [INFO] Migrating ${offers.length} offers for ${user.username}...`);

      for (const offer of offers) {
        const items = db.prepare('SELECT * FROM offer_items_rel WHERE offerId = ?').all(offer.id);
        
        const offerDoc = {
          _id: `offer:${user.id}:${offer.id}`,
          type: 'offer',
          userId: user.id,
          title: `Oferta ${offer.offer_number || offer.id}`,
          price: items.reduce((sum, i) => sum + (i.price * i.quantity), 0),
          status: offer.state === 'final' ? 'active' : 'draft',
          createdAt: offer.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastEditedBy: user.id,
          lastEditedByRole: user.role || 'user',
          items: items,
          transportCost: offer.transportCost || 0
        };

        try {
          // Zapisz do bazy użytkownika
          await axios.put(`${COUCHDB_URL}/${DB_PREFIX}offers_user_${user.id}/${offerDoc._id}`, offerDoc);
          
          // Zapisz do bazy globalnej (skrócona wersja)
          if (offerDoc.status === 'active') {
             const globalDoc = { ...offerDoc };
             delete globalDoc.items; // Usuwamy szczegóły z globalnej bazy dla wydajności
             await axios.put(`${COUCHDB_URL}/${DB_PREFIX}offers_global/${offerDoc._id}`, globalDoc);
          }
        } catch (e) {
             console.error(`      [ERROR] Error migrating offer ${offer.id}:`, e.message);
        }
      }

      // 3. Migrate Studnie Offers for this user
      const offersStudnie = db.prepare('SELECT * FROM offers_studnie_rel WHERE userId = ?').all(user.id);
      console.log(`   [INFO] Migrating ${offersStudnie.length} Studnie offers for ${user.username}...`);

      for (const offer of offersStudnie) {
        let parsedData = {};
        try { if (offer.data) parsedData = JSON.parse(offer.data); } catch (e) { /* ignore */ }

        const offerDoc = {
          _id: `offer:studnie:${user.id}:${offer.id}`,
          type: 'offer',
          userId: user.id,
          title: `Oferta Studnia ${offer.offer_number || offer.id}`,
          price: parsedData.totalPrice || 0,
          status: offer.state === 'final' ? 'active' : 'draft',
          createdAt: offer.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastEditedBy: user.id,
          lastEditedByRole: user.role || 'user',
          data: parsedData
        };

        try {
          await axios.put(`${COUCHDB_URL}/${DB_PREFIX}offers_user_${user.id}/${offerDoc._id}`, offerDoc);
          if (offerDoc.status === 'active') {
             const globalDoc = { ...offerDoc };
             delete globalDoc.data;
             await axios.put(`${COUCHDB_URL}/${DB_PREFIX}offers_global/${offerDoc._id}`, globalDoc);
          }
        } catch (e) {
             console.error(`      [ERROR] Error migrating Studnie offer ${offer.id}:`, e.message);
        }
      }

      // 4. Migrate Clients for this user
      const clients = db.prepare('SELECT * FROM clients_rel').all();
      console.log(`   [INFO] Migrating ${clients.length} clients for ${user.username}...`);

      for (const client of clients) {
        const clientDoc = {
          _id: `client:${client.id}`,
          type: 'client',
          name: client.name,
          nip: client.nip,
          address: client.address,
          contact: client.contact,
          phone: client.phone,
          email: client.email,
          createdAt: client.createdAt || new Date().toISOString()
        };

        try {
          await axios.put(`${COUCHDB_URL}/${DB_PREFIX}clients_user_${user.id}/${clientDoc._id}`, clientDoc);
        } catch (e) {
          console.error(`      [ERROR] Error migrating client ${client.id}:`, e.message);
        }
      }
    }

    // 4. Migrate Products (Cenniki Rury)
    const products = db.prepare('SELECT * FROM products_rel').all();
    console.log(`\n[INFO] Migrating ${products.length} standard products to pv_products...`);
    for (const prod of products) {
      const prodDoc = {
        _id: `product:standard:${prod.id}`,
        type: 'product',
        category: prod.category || 'rury',
        name: prod.name,
        price: prod.price,
        weight: prod.weight,
        transport: prod.transport,
        area: prod.area
      };
      try {
        await axios.put(`${COUCHDB_URL}/${DB_PREFIX}products/${prodDoc._id}`, prodDoc);
      } catch (e) {
        console.error(`      [ERROR] Error migrating product ${prod.id}:`, e.message);
      }
    }

    // 5. Migrate Products (Cenniki Studnie)
    const productsStudnie = db.prepare('SELECT * FROM products_studnie_rel').all();
    console.log(`[INFO] Migrating ${productsStudnie.length} studnie products to pv_products...`);
    for (const prod of productsStudnie) {
      let parsedData = {};
      try { if (prod.data) parsedData = JSON.parse(prod.data); } catch (e) { /* ignore */ }

      const prodDoc = {
        _id: `product:studnia:${prod.id}`,
        type: 'product',
        category: prod.category || 'studnie',
        name: prod.name,
        price: prod.price,
        weight: prod.weight,
        componentType: prod.componentType,
        dn: prod.dn,
        h: prod.h,
        grubosc: prod.grubosc,
        wewnetrzna: prod.wewnetrzna,
        l: prod.l,
        index_p: prod.index_p,
        formaStandardowa: prod.formaStandardowa,
        spocznikH: prod.spocznikH,
        data: parsedData
      };
      try {
        await axios.put(`${COUCHDB_URL}/${DB_PREFIX}products/${prodDoc._id}`, prodDoc);
      } catch (e) {
        console.error(`      [ERROR] Error migrating studnie product ${prod.id}:`, e.message);
      }
    }

    console.log('\n[DONE] Migration finished successfully.');
  } catch (err) {
    console.error('\n[FATAL] Fatal migration error:', err.message);
  }
}

migrate();
