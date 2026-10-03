/* ===== ZLECENIA PRODUKCYJNE — HELPERY ===== */

function getElementStatus(el) {
    const savedOrder =
        typeof pzGuard !== 'undefined'
            ? pzGuard.findPzForElement(
                  productionOrders || [],
                  el.well.id,
                  (el.configItem && el.configItem._elemId) || '',
                  el.elementIndex
              )
            : (productionOrders || []).find(
                  (po) => po.wellId === el.well.id && po.elementIndex === el.elementIndex
              );
    if (savedOrder && savedOrder.status === 'accepted') return 'accepted';
    if (savedOrder) return 'saved';
    return 'open';
}

function parseWysokoscGlebokosc(productName) {
    const m = productName && productName.match(/H\s*=\s*(\d+)\s*\/\s*(\d+)/i);
    if (m) return { wysokosc: parseInt(m[1]), glebokosc: parseInt(m[2]) };
    return { wysokosc: 0, glebokosc: 0 };
}

function getStudniaDIN(dn) {
    if ([1000, 1200].includes(dn)) return 'AT/2009-03-1733';
    if ([1500, 2000, 2500].includes(dn)) return 'PN-EN 1917:2004';
    return 'AT/2009-03-1733';
}

function calcStopnieExecution(angle) {
    const a = parseFloat(angle) || 0;
    return a > 0 ? 360 - a : 0;
}

function buildEtykietaElementsSnapshot(well) {
    const config = well.config || [];
    const findProduct = (id) =>
        typeof studnieProducts !== 'undefined'
            ? typeof getStudnieProductById === 'function'
                ? getStudnieProductById(id)
                : studnieProducts.find((p) => p.id === id)
            : null;
    const countMap = new Map();

    config.forEach((item) => {
        const productId = item.productId || item.id;
        const product = findProduct(productId);
        if (!product) return;
        if (product.componentType === 'kineta' || product.componentType === 'wlaz') return;

        if (countMap.has(product.id)) {
            countMap.get(product.id).count++;
        } else {
            countMap.set(product.id, {
                count: 1,
                indeks: product.id || '',
                nazwa: product.name || ''
            });
        }
    });

    if (typeof studnieProducts !== 'undefined') {
        const uszczelka = studnieProducts.find(
            (p) =>
                p.category === 'uszczelka' &&
                (String(p.dn) === String(well.dn) ||
                    p.name?.includes('DN ' + well.dn) ||
                    p.name?.includes('DN' + well.dn))
        );
        if (uszczelka && config.length > 1) {
            countMap.set('_seal_' + uszczelka.id, {
                count: config.length,
                indeks: uszczelka.id || '',
                nazwa: uszczelka.name || `USZCZELKI DO STUDNI DN ${well.dn}MM`
            });
        }
    }

    const items = [];
    countMap.forEach((val) =>
        items.push({ ilosc: val.count + ' szt.', indeks: val.indeks, nazwa: val.nazwa })
    );
    return items;
}

/**
 * D-008: stabilny Idempotency-Key per intencja single-claimu numeru PZ.
 * Retry MUSI nieść ten sam klucz (serwer replayuje ten sam numer przez
 * claimIdempotencyKey); losowy klucz per retry mintowałby nowy numer (gap).
 * Determinystyczny ze scopeId (id PZ albo tożsamość elementu) + userId —
 * double-click tej samej intencji trafia w ten sam klucz = 1 numer.
 * Limit 128 znaków nagłówka (idempotency.ts): 10 + 64 + 1 + 32 < 128.
 */
function singleProductionClaimKey(scopeId, targetUserId) {
    const safeScope = String(scopeId || 'noid')
        .replace(/[^A-Za-z0-9_-]/g, '_')
        .slice(0, 64);
    const safeUser = String(targetUserId || 'nouser')
        .replace(/[^A-Za-z0-9_-]/g, '_')
        .slice(0, 32);
    return 'pz-single_' + safeScope + '_' + safeUser;
}

/**
 * D-008: single-claim jednego numeru PZ przez wspólny fetchWithRetry429
 * (ten sam helper co bulk). Zwraca Response (caller robi .json() jak dotąd).
 * Semantyka helpera bez zmian: retry tylko 429 + sieć/abort sprzed odpowiedzi
 * (nagłówek Idempotency-Key czyni retry sieciowy bezpiecznym), 4xx/5xx bez retry.
 * Fallback do fetch z kluczem, gdy helpera brak — ręczny retry nadal idempotentny.
 */
async function claimSingleProductionNumber(targetUserId, scopeId) {
    const headers = Object.assign({}, authHeaders());
    headers['Idempotency-Key'] = singleProductionClaimKey(scopeId, targetUserId);
    const url = '/api/orders-studnie/claim-production-number/' + encodeURIComponent(targetUserId);
    const opts = { method: 'POST', headers: headers };
    if (typeof window !== 'undefined' && typeof window.fetchWithRetry429 === 'function') {
        const out = await window.fetchWithRetry429(url, opts);
        return out.res;
    }
    return fetch(url, opts);
}

/* ===== Rejestracja globali ===== */
window.getElementStatus = getElementStatus;
window.parseWysokoscGlebokosc = parseWysokoscGlebokosc;
window.getStudniaDIN = getStudniaDIN;
window.calcStopnieExecution = calcStopnieExecution;
window.buildEtykietaElementsSnapshot = buildEtykietaElementsSnapshot;
window.singleProductionClaimKey = singleProductionClaimKey;
window.claimSingleProductionNumber = claimSingleProductionNumber;
