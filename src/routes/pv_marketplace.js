/**
 * PV Marketplace - API Gateway & Search Service
 * Node.js / Express Implementation (Senior Architect)
 */

const express = require('express');
const axios = require('axios');
const router = express.Router();

const COUCHDB_URL = process.env.COUCHDB_URL || 'http://admin:password@localhost:5984';
const GLOBAL_DB = 'pv_offers_global';

/**
 * SEARCH: Wyszukiwanie ofert w skali globalnej (10M ofert)
 * Wykorzystuje Mango Indexes na CouchDB dla maksymalnej wydajności.
 */
router.post('/search', async (req, res) => {
    const { query, category, region, minPrice, maxPrice, limit = 50, skip = 0 } = req.body;
  const DB_PREFIX = process.env.PV_DB_PREFIX || 'pv_';
  const GLOBAL_DB_FULL = `${DB_PREFIX}offers_global`;

  // Budowa selektora Mango
  const selector = {
    type: 'offer'
    // status: 'active' // Na razie pomijamy status active, bo nie wszystkie migrowane oferty go mają
  };

  if (category) selector.category = category;
  if (region) selector.region = region;
  if (minPrice || maxPrice) {
    selector.price = {};
    if (minPrice) selector.price.$gte = minPrice;
    if (maxPrice) selector.price.$lte = maxPrice;
  }
  
  // Wyszukiwanie tekstowe w numerze, kliencie lub nazwie inwestycji
  if (query) {
    selector.$or = [
      { number: { "$regex": `(?i)${query}` } },
      { clientName: { "$regex": `(?i)${query}` } },
      { investName: { "$regex": `(?i)${query}` } }
    ];
  }

  try {
    const response = await axios.post(`${COUCHDB_URL}/${GLOBAL_DB_FULL}/_find`, {
      selector,
      limit,
      skip,
      sort: [{ "updatedAt": "desc" }]
    });

    res.json({
      docs: response.data.docs, // Zmienione z 'items' na 'docs' dla zgodności z frontendem
      bookmark: response.data.bookmark
    });
  } catch (err) {
    console.error('[PV Search] Error:', err.message);
    res.status(500).json({ error: 'Search service unavailable' });
  }
});

/**
 * MODERACJA: Akcje administratora
 * Administrator może edytować/blokować dowolny dokument.
 */
router.post('/moderate/:offerId', async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can moderate offers' });
  }

  const { action, reason } = req.body;
  const { offerId } = req.params;

  try {
    // 1. Pobierz dokument (z bazy użytkownika lub globalnej)
    // Architektura zakłada, że moderator edytuje w bazach PV_offers_user_<userId>
    // a zmiany propagują się do PV_offers_global.
    
    // Uproszczenie: Bezpośrednia edycja statusu
    const docUrl = `${COUCHDB_URL}/${GLOBAL_DB}/${offerId}`;
    const { data: doc } = await axios.get(docUrl);

    doc.status = action === 'block' ? 'blocked' : 'active';
    doc.moderationReason = reason;
    doc.updatedAt = new Date().toISOString();
    doc.lastEditedBy = req.user.id;
    doc.lastEditedByRole = 'admin'; // Gwarantuje najwyższy priorytet w PouchDB sync

    await axios.put(docUrl, doc);

    res.json({ ok: true, status: doc.status });
  } catch (err) {
    res.status(500).json({ error: 'Moderation failed' });
  }
});

module.exports = router;
