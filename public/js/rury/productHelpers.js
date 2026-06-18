/* ===== HELPERY PRODUKTU (RURY) ===== */
/* Wydzielone z app.js — odpowiedzialność: kalkulacja wymiarów ze wzoru ID */

/**
 * Oblicza długość produktu na podstawie formatu ID.
 * Format: XXX-X-DD-LL-XXX, gdzie LL = długość w setkach mm.
 * Np. RTB-0-03-25-K00 → 25 → 2500mm
 */
function getProductLength(id) {
    const parts = id.split('-');
    if (parts.length >= 4) {
        const code = parseInt(parts[3]);
        if (!isNaN(code) && code >= 10) return code * 100; // mm
    }
    return null;
}

/**
 * Oblicza średnicę produktu na podstawie formatu ID.
 * Format: XXX-X-DD-LL-XXX, gdzie DD = kod średnicy.
 * Np. RTB-0-03-25-K00 → 03 → DN 300
 */
function getProductDiameter(id) {
    const parts = id.split('-');
    if (parts.length >= 3) {
        const code = parseInt(parts[2]);
        if (!isNaN(code) && code > 0) return code * 100; // mm
    }
    if (parts.length === 2 && parts[0] === 'ZT') {
        const code = parseInt(parts[1]);
        if (!isNaN(code) && code > 0) return code; // ZT-0300 → 300 (DN)
    }
    return null;
}

/**
 * Zwraca pole powierzchni wewnętrznej rury.
 * Najpierw sprawdza pole `area` w produkcie, potem oblicza z PI*D*L.
 * Dla rur jajowych (RJB/RJZ) używa przybliżonego obwodu elipsy.
 */
function getPipeInnerArea(id) {
    const product = products.find((p) => p.id === id);
    if (product && product.area != null) {
        return product.area;
    }

    const d = getProductDiameter(id);
    const l = getProductLength(id);
    if (!d || !l) return 0;

    if (id.startsWith('RJB') || id.startsWith('RJZ')) {
        // Jajowa — przybliżony obwód elipsy (h = 1.5 × d)
        const h = d * 1.5;
        const perimeter = (Math.PI * ((d + h) / 2)) / 1000;
        return perimeter * (l / 1000);
    }
    return Math.PI * (d / 1000) * (l / 1000);
}

/**
 * Sprawdza czy produkt to rura 1-metrowa (1000mm).
 */
function isOneMetrePipe(id) {
    const len = getProductLength(id);
    return len === 1000;
}

/**
 * Grupuje i sortuje pozycje oferty rur według kategorii → średnicy → Bosy-Bosy → długości.
 * Zwraca { grouped, sortedCategories, flat } gdzie flat to tablica { cat, dk, entries[] }.
 */
function getSortedRuryItems(items) {
    const grouped = {};
    items.forEach((item, i) => {
        const product = products.find((p) => p.id === item.productId);
        const category = product ? product.category : 'Inne';
        if (!grouped[category]) grouped[category] = {};
        let diameter = getProductDiameter(item.productId);
        if (!diameter && item.productId) {
            const parts = item.productId.split('-');
            if (parts.length >= 5) {
                const code = parseInt(parts[4]);
                if (!isNaN(code) && code > 0) diameter = code * 100;
            }
        }
        const diamKey = diameter ? `DN ${diameter}` : 'Inne';
        if (!grouped[category][diamKey]) grouped[category][diamKey] = [];
        grouped[category][diamKey].push({ item, originalIndex: i });
    });

    const sortedCategories = Object.keys(grouped).sort((a, b) => {
        const ia = CATEGORIES.indexOf(a);
        const ib = CATEGORIES.indexOf(b);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });

    const flat = [];
    sortedCategories.forEach((cat) => {
        const diamKeys = Object.keys(grouped[cat]).sort((a, b) => {
            const da = parseInt(a.replace('DN ', '')) || 99999;
            const db = parseInt(b.replace('DN ', '')) || 99999;
            return da - db;
        });
        diamKeys.forEach((dk) => {
            grouped[cat][dk].sort((a, b) => {
                const aBB = a.item.name.toLowerCase().includes('bosy') || a.item.productId.endsWith('-B00');
                const bBB = b.item.name.toLowerCase().includes('bosy') || b.item.productId.endsWith('-B00');
                if (aBB !== bBB) return aBB ? -1 : 1;
                return (a.item.lengthM || 0) - (b.item.lengthM || 0);
            });
            flat.push({ cat, dk, entries: grouped[cat][dk] });
        });
    });

    return { grouped, sortedCategories, flat };
}

window.getSortedRuryItems = getSortedRuryItems;
