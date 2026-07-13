// @ts-check
/* ===== API — produkty studni i cennik PRECO ===== */

async function loadStudnieProducts() {
    var result = await api.getWithRetry('/api/products-studnie', { silent: true }, 3, 1000);
    if (!result || !Array.isArray(result.data)) {
        logger.error(
            'uiHelpers',
            '[Studnie] B\u0142\u0105d loadStudnieProducts: brak danych po 3 pr\u00f3bach'
        );
        showToast('Nie uda\u0142o si\u0119 za\u0142adowa\u0107 cennika studni z serwera', 'error');
        return [];
    }
    var saved = result.data;
    var hadDn2500Bug = saved.some(function (p) {
        return (
            p.componentType === 'uszczelka' && p.id && p.id.indexOf('2500') >= 0 && p.dn === 2000
        );
    });
    saved.forEach(function (p) {
        if (p.componentType === 'uszczelka' && p.id && p.id.indexOf('2500') >= 0 && p.dn === 2000) {
            p.dn = 2500;
        }
    });
    if (hadDn2500Bug) {
        saveStudnieProducts(saved).catch(function () {});
    }
    return saved;
}

function renamePłyty(p) {}

async function saveStudnieProducts(data) {
    var result = await api.put('/api/products-studnie', { data: data });
    return result !== null;
}

async function loadPrecoPricing() {
    try {
        var res = await fetchWithTimeout('/api/preco-pricing');
        var json = await res.json();
        if (json.data && Array.isArray(json.data) && json.data.length > 0) {
            precoPricing = json.data[0];
            logger.info('uiHelpers', '[PRECO] Za\u0142adowano cennik z bazy');
            return;
        }
    } catch (e) {
        logger.warn('uiHelpers', '[PRECO] B\u0142\u0105d pobierania cennika z API:', e);
    }
    precoPricing = {};
    logger.warn('uiHelpers', '[PRECO] Brak cennika w bazie');
}

async function savePrecoPricing(data) {
    try {
        var res = await fetch('/api/preco-pricing', {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify({ data: data })
        });
        if (!res.ok) {
            var err = await res.json().catch(function () {
                return {};
            });
            logger.error('uiHelpers', '[PRECO] B\u0142\u0105d zapisu:', res.status, err);
            showToast('B\u0142\u0105d zapisu cennika PRECO: ' + (err.error || res.status), 'error');
            return false;
        }
        showToast('Cennik PRECO zapisany', 'success');
        return true;
    } catch (err) {
        logger.error('uiHelpers', '[PRECO] B\u0142\u0105d sieci:', err);
        showToast('B\u0142\u0105d sieci przy zapisie cennika PRECO', 'error');
        return false;
    }
}
