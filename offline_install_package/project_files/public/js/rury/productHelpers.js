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
