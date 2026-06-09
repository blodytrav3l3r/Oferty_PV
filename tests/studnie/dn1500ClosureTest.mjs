import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/* ===== Załaduj produkty ===== */
const productsPath = join(__dirname, '..', '..', 'public', 'data', 'products_studnie.json');
const studnieProducts = JSON.parse(readFileSync(productsPath, 'utf8'));
console.log(`Załadowano ${studnieProducts.length} produktów\n`);

/* ===== Helpery (kopie z kodu źródłowego) ===== */
function getFormaField(warehouse) {
  return (warehouse || '').includes('oc') || (warehouse || '').includes('Włoc') ? 'formaStandardowa' : 'formaStandardowaKLB';
}

function getAvailableProducts(well) {
  if (!well || !studnieProducts) return [];
  const mag = well.magazyn || 'Kluczbork';
  const isWl = mag.includes('oc') || mag.includes('Włoc');
  const field = isWl ? 'magazynWL' : 'magazynKLB';
  return studnieProducts.filter(p => {
    const val = p[field];
    return val === 1 || val === '1' || val === undefined;
  });
}

function filterByWellParams(p, well) {
  if (!well) return true;
  const id = p.id || '';
  let checkId = id;
  if (checkId.endsWith('_OT')) checkId = checkId.slice(0, -3);
  else if (checkId.endsWith('-OT')) checkId = checkId.slice(0, -3);
  if (p.componentType === 'krag' || p.componentType === 'konus') {
    const isNierdzewna = checkId.endsWith('-N-D');
    const isDrabinka = !isNierdzewna && checkId.endsWith('-D');
    const isBrak = checkId.endsWith('-B');
    const hasStepSuffix = isNierdzewna || isDrabinka || isBrak;
    if (well.stopnie === 'brak') {
      if (hasStepSuffix && !isBrak) return false;
    } else if (well.stopnie === 'nierdzewna') {
      if (isBrak || isDrabinka) return false;
      if (!isNierdzewna) return false;
    } else {
      if (isBrak || isNierdzewna) return false;
      if (!hasStepSuffix) return false;
    }
  }
  return true;
}

function getTopClosure(products, topDn, forcedId, fallbackToDin, warehouse) {
  const ff = getFormaField(warehouse);
  const dn = parseInt(String(topDn));
  const blockKonus = fallbackToDin;
  if (forcedId && !fallbackToDin) {
    const forced = products.find(p => p.id === forcedId);
    if (forced && (parseInt(String(forced.dn)) === dn || forced.dn === null)) return forced;
  }
  const konusy = blockKonus ? [] : products
    .filter(p => p.componentType === 'konus' && parseInt(String(p.dn)) === dn)
    .sort((a, b) => (parseInt(String(b[ff])) || 0) - (parseInt(String(a[ff])) || 0));
  const dinPlates = products
    .filter(p => p.componentType === 'plyta_din' && parseInt(String(p.dn)) === dn)
    .sort((a, b) => (parseInt(String(b[ff])) || 0) - (parseInt(String(a[ff])) || 0));
  if (fallbackToDin) {
    if (dinPlates.length > 0) return dinPlates[0];
    if (konusy.length > 0) return konusy[0];
    return null;
  }
  if (konusy.length > 0) return konusy[0];
  if (dinPlates.length > 0) return dinPlates[0];
  return null;
}

/* ===== Konfiguracja studni ===== */
const well = {
  dn: 1500,
  magazyn: 'Kluczbork',
  stopnie: 'brak',
  wkladkaZwienczenie: 'brak',
  zakonczenie: null,
  redukcjaDN1000: false,
  rzednaDna: 0,
  rzednaWlazu: 5.0,
  nadbudowa: 'betonowa',
  dennicaMaterial: 'betonowa',
};

/* ===== KROK 1: availProducts ===== */
console.log('=== KROK 1: getAvailableProducts (magazyn) ===');
const rawAvail = getAvailableProducts(well);
console.log(`  Produkty po magazynie: ${rawAvail.length}`);
const konusDN1500raw = rawAvail.find(p => p.id === 'JZW-15-625-D');
console.log(`  Konus JZW-15-625-D w magazynie: ${konusDN1500raw ? 'TAK' : 'NIE'}`);
const dinDN1500raw = rawAvail.find(p => p.id === 'PDD-15-62-00');
console.log(`  Płyta DIN PDD-15-62-00 w magazynie: ${dinDN1500raw ? 'TAK' : 'NIE'}`);

/* ===== KROK 2: filterByWellParams ===== */
console.log('\n=== KROK 2: filterByWellParams (stopnie=brak) ===');
const availProducts = rawAvail.filter(p => filterByWellParams(p, well));
console.log(`  Produkty po filtrze: ${availProducts.length}`);
const konusFiltered = availProducts.find(p => p.id === 'JZW-15-625-D');
console.log(`  Konus JZW-15-625-D: ${konusFiltered ? 'PRZEZEDŁ (błąd!)' : 'ODFILTROWANY PRZEZ STOPNIE'}`);
const dinFiltered = availProducts.find(p => p.id === 'PDD-15-62-00');
console.log(`  Płyta DIN PDD-15-62-00: ${dinFiltered ? 'DOSTĘPNA' : 'NIE'}`);

/* ===== KROK 3: getTopClosure ===== */
console.log('\n=== KROK 3: getTopClosure z przefiltrowanych produktów ===');
const topProd = getTopClosure(availProducts, 1500, null, false, 'Kluczbork');
console.log(`  getTopClosure zwrócił: ${topProd ? topProd.id + ' (' + topProd.name + ')' : 'NULL'}`);

/* ===== KROK 4: JS solver — NOWY FIX ===== */
console.log('\n=== KROK 4: JS solver — nadpisanie Płyty DIN konusem (NOWY FIX) ===');
const forcedZak = well.zakonczenie || null;
const isWkladka = well.wkladkaZwienczenie && well.wkladkaZwienczenie !== 'brak';
let topProdFinal = topProd;
if (topProdFinal && topProdFinal.componentType !== 'konus' && !isWkladka) {
  const konusFromCatalog = studnieProducts.find(
    p => p.componentType === 'konus' &&
         (parseInt(String(p.dn)) === parseInt(String(1500)) || p.dn === null)
  );
  if (konusFromCatalog) {
    console.log(`  Nadpisanie ${topProdFinal.id} konusem ${konusFromCatalog.id}`);
    topProdFinal = konusFromCatalog;
  }
}
if (!topProdFinal && forcedZak) {
  topProdFinal = studnieProducts.find(
    p => p.id === forcedZak && (parseInt(String(p.dn)) === parseInt(String(1500)) || p.dn === null)
  );
}
if (!topProdFinal) {
  topProdFinal = studnieProducts.find(
    p => p.componentType === 'konus' && (parseInt(String(p.dn)) === parseInt(String(1500)) || p.dn === null)
  );
}
console.log(`  Wynik końcowy: ${topProdFinal ? topProdFinal.id + ' (' + topProdFinal.name + ')' : 'NULL'}`);

/* ===== KROK 5: Wniosek ===== */
console.log('\n========================================');
console.log('=== WNIOSEK ===');
console.log('========================================');
console.log(`Dla studni DN1500, wys. 5m, stopnie=brak (domyślne):`);
console.log(`  - Konus JZW-15-625-D odfiltrowany przez filterByWellParams (stopnie=brak => -D odrzucony)`);
console.log(`  - getTopClosure zwraca Płytę DIN (jedyny dostępny top closure w przefiltrowanych produktach)`);
console.log(`  - NOWY FIX: JS solver sprawdza czy wynik to konus, jeśli nie i konus dostępny => nadpisuje`);
console.log(`  - WYBRANE ZAKOŃCZENIE: ${topProdFinal ? topProdFinal.id + ' (' + topProdFinal.name + ')' : 'NONE'}`);
