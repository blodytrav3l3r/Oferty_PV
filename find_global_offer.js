const axios = require('axios');
const COUCHDB_URL = 'http://admin:admin123@localhost:5984';
const DB_PREFIX = 'pv_';

async function findGlobalOffer() {
  try {
    const dbUrl = `${COUCHDB_URL}/${DB_PREFIX}offers_global/_find`;
    const res = await axios.post(dbUrl, {
      selector: {
        $or: [
          { offerNumber: 'OF/000002/AD/2026' },
          { offer_number: 'OF/000002/AD/2026' }
        ]
      }
    });

    if (res.data.docs.length > 0) {
      const doc = res.data.docs[0];
      console.log('ZNALAZŁEM W GLOBALNEJ BAZIE!');
      console.log(`Baza: ${DB_PREFIX}offers_global`);
      console.log(`Użytkownik (userId): ${doc.userId}`);
      console.log(`Typ: ${doc.type}`);
    } else {
      console.log('Nie znaleziono również w bazie globalnej.');
    }
  } catch (err) {
    console.error('Błąd:', err.message);
  }
}

findGlobalOffer();
