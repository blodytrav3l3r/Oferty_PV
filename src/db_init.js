/**
 * PV Marketplace - Database Initializer
 * Prepares CouchDB cluster for high-scale internal use.
 */

require('dotenv').config();
const axios = require('axios');

const COUCHDB_URL = process.env.COUCHDB_URL;
const DB_PREFIX = process.env.PV_DB_PREFIX || 'PV_';

const REQUIRED_DBS = [
  `${DB_PREFIX}users`,
  `${DB_PREFIX}offers_global`,
  `${DB_PREFIX}clients_global`,
  `${DB_PREFIX}products`,
  `${DB_PREFIX}sessions`,
  `${DB_PREFIX}counters`
];

async function enableCors() {
  console.log('[INFO] Enabling CORS in CouchDB...');
  try {
    // Enable CORS via local node config
    await axios.put(`${COUCHDB_URL}/_node/_local/_config/httpd/enable_cors`, '"true"');
    await axios.put(`${COUCHDB_URL}/_node/_local/_config/cors/origins`, '"*"');
    await axios.put(`${COUCHDB_URL}/_node/_local/_config/cors/methods`, '"GET, PUT, POST, HEAD, DELETE"');
    await axios.put(`${COUCHDB_URL}/_node/_local/_config/cors/headers`, '"accept, authorization, content-type, origin, referer, x-csrf-token"');
    await axios.put(`${COUCHDB_URL}/_node/_local/_config/cors/credentials`, '"true"');
    console.log('[OK] CORS enabled on local node.');
  } catch (err) {
    if (err.response && err.response.status === 412) {
      console.log('[INFO] CORS settings already applied.');
    } else {
      console.warn('[WARN] Could not set CORS via API. You may need to do it manually in Fauxton (Settings -> CORS).', err.message);
    }
  }
}

async function ensureUserDbs() {
  console.log('[INFO] Ensuring all users have their private databases...');
  try {
    const res = await axios.post(`${COUCHDB_URL}/${DB_PREFIX}users/_find`, { selector: { type: 'user' } });
    const users = res.data.docs;
    
    for (const user of users) {
      const userId = user._id.replace('user:', '');
      const userDbs = [
        `${DB_PREFIX}offers_user_${userId}`,
        `${DB_PREFIX}clients_user_${userId}`
      ];
      
      for (const dbName of userDbs) {
        try {
          await axios.put(`${COUCHDB_URL}/${dbName}`);
          console.log(`[OK] Created missing user database: ${dbName}`);
        } catch (e) {
          if (e.response && e.response.status === 412) {
             // console.log(`[INFO] User database exists: ${dbName}`);
             continue;
          }
          console.error(`[ERROR] Failed to create ${dbName}:`, e.message);
        }
      }
    }
  } catch (err) {
    console.error('[ERROR] Error ensuring user databases:', err.message);
  }
}

async function init() {
  console.log(`\n[INFO] Initializing PV Marketplace Databases at ${COUCHDB_URL}...`);

  await enableCors();

  for (const dbName of REQUIRED_DBS) {
    try {
      await axios.put(`${COUCHDB_URL}/${dbName}`);
      console.log(`[OK] Database created: ${dbName}`);
    } catch (err) {
      if (err.response && err.response.status === 412) {
        console.log(`[INFO] Database already exists: ${dbName}`);
      } else {
        console.error(`[ERROR] Error creating database ${dbName}:`, err.message);
      }
    }
  }

  // Tworzenie indeksu Mango dla Marketplace Global
  try {
    const indexData = {
      index: {
        fields: ['updatedAt', 'type', 'status']
      },
      name: 'pv-global-search-index',
      type: 'json'
    };
    await axios.post(`${COUCHDB_URL}/${DB_PREFIX}offers_global/_index`, indexData);
    console.log(`[OK] Search index created on global offers.`);
  } catch (err) {
    console.error(`[ERROR] Error creating index:`, err.message);
  }

  await ensureUserDbs();

  console.log('\n[DONE] Initialization complete.\n');
}

init();
